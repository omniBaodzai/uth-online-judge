import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import {
  AddOrganizationMemberDto,
  ApproveOrganizationRequestDto,
  ChangeOrganizationMemberRoleDto,
  ChangeOrganizationOwnerDto,
  CreateOrganizationDto,
  CreateOrganizationRequestDto,
  ListAdminOrganizationRequestsQueryDto,
  ListAdminOrganizationsQueryDto,
  ListMyOrganizationRequestsQueryDto,
  ListOrganizationMembersQueryDto,
  ListOrganizationsQueryDto,
  RejectOrganizationRequestDto,
  UpdateOrganizationDto,
  UpdateOrganizationVisibilityDto,
} from './organizations.dto.js';
import { OrganizationLeaderboardQueryDto } from './organization-leaderboard.dto.js';
import { OrganizationLeaderboardService } from './organization-leaderboard.service.js';
import { OrganizationsService } from './organizations.service.js';
import type { Viewer } from './organizations.types.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type AuthedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };
type OptionalRequest = Request & { user?: { id: string; role: 'STUDENT' | 'ADMIN' } | null };

const viewerOf = (request: OptionalRequest): Viewer =>
  request.user ? { id: request.user.id, role: request.user.role } : null;

@ApiTags('Organization requests')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organization-requests')
export class OrganizationRequestsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi yêu cầu tạo tổ chức (requester lấy từ JWT)' })
  create(@Body() input: CreateOrganizationRequestDto, @Req() request: AuthedRequest) {
    return this.organizations.createRequest(request.user.id, input);
  }

  @Get('me')
  @ApiOperation({ summary: 'Danh sách yêu cầu tạo tổ chức của tôi' })
  listMine(@Query() query: ListMyOrganizationRequestsQueryDto, @Req() request: AuthedRequest) {
    return this.organizations.listOwnRequests(request.user.id, query.page, query.pageSize);
  }
}

@ApiTags('Admin organization requests')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/organization-requests')
export class AdminOrganizationRequestsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: danh sách yêu cầu tạo tổ chức' })
  list(@Query() query: ListAdminOrganizationRequestsQueryDto) {
    return this.organizations.listAdminRequests(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: chi tiết yêu cầu tạo tổ chức' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.getAdminRequest(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: phê duyệt yêu cầu, tạo tổ chức và gán OWNER (một transaction)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ApproveOrganizationRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.organizations.approveRequest(id, request.user.id, input);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: từ chối yêu cầu' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RejectOrganizationRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.organizations.rejectRequest(id, request.user.id, input.reviewNote ?? null);
  }
}

@ApiTags('Admin organizations')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/organizations')
export class AdminOrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: danh sách tổ chức (gồm ARCHIVED)' })
  list(@Query() query: ListAdminOrganizationsQueryDto) {
    return this.organizations.listAdminOrganizations(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: chi tiết tổ chức theo ID (gồm ARCHIVED và sourceRequestId)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.getAdminOrganization(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Admin: thành viên tổ chức theo ID (chỉ hồ sơ công khai)' })
  members(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListOrganizationMembersQueryDto) {
    return this.organizations.listAdminMembers(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: tạo tổ chức trực tiếp, có hoặc không có OWNER' })
  create(@Body() input: CreateOrganizationDto) {
    return this.organizations.createOrganization(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: cập nhật thông tin tổ chức' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateOrganizationDto) {
    return this.organizations.updateOrganizationById(id, input);
  }

  @Patch(':id/owner')
  @ApiOperation({ summary: 'Admin: chuyển hoặc gỡ OWNER (ownerIdentifier = null để gỡ)' })
  changeOwner(@Param('id', ParseUUIDPipe) id: string, @Body() input: ChangeOrganizationOwnerDto) {
    return this.organizations.changeOwner(id, input.ownerIdentifier, input.previousOwnerRole);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: lưu trữ tổ chức' })
  archive(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthedRequest) {
    return this.organizations.archive(id, request.user.id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: khôi phục tổ chức đã lưu trữ' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.restore(id);
  }
}

@ApiTags('Organizations')
@DocumentControllerOperations()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly leaderboard: OrganizationLeaderboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tổ chức ACTIVE' })
  list(@Query() query: ListOrganizationsQueryDto) {
    return this.organizations.listOrganizations(query);
  }

  @Get(':slug/leaderboard')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Lấy bảng xếp hạng của tổ chức',
    description:
      'Trả về bảng xếp hạng của thành viên hiện tại, tính số problem khác nhau có submission ACCEPTED hợp lệ. Chỉ tính submission standalone thuộc Organization và submission trong contest của Organization sau khi contest kết thúc; submission trong Global Contest không được tính, kể cả khi dùng problem được cấp grant từ Organization. Organization ACTIVE cho phép xem công khai, độc lập với visibility của các tab nội dung; Organization ARCHIVED chỉ System Admin được truy cập. Response không chứa source code hoặc thông tin nhận diện problem riêng tư.',
  })
  @ApiOkResponse({
    description: 'Bảng xếp hạng phân trang; UUID trong ví dụ chỉ là placeholder, không đại diện người dùng có thật.',
    schema: {
      example: {
        items: [
          {
            rank: 1,
            userId: '00000000-0000-4000-8000-000000000000',
            username: 'example_student',
            solvedCount: 3,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    },
  })
  leaderboardPage(
    @Param('slug') slug: string,
    @Query() query: OrganizationLeaderboardQueryDto,
    @Req() request: OptionalRequest,
  ) {
    return this.leaderboard.get(slug, viewerOf(request), query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết tổ chức, viewerRole và viewerPermissions' })
  get(@Param('slug') slug: string, @Req() request: OptionalRequest) {
    return this.organizations.getOrganization(slug, viewerOf(request));
  }

  @Get(':slug/members')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Thành viên tổ chức (chỉ hồ sơ công khai)' })
  members(
    @Param('slug') slug: string,
    @Query() query: ListOrganizationMembersQueryDto,
    @Req() request: OptionalRequest,
  ) {
    return this.organizations.listMembers(slug, viewerOf(request), query);
  }

  @Post(':slug/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tham gia tổ chức ACTIVE với vai trò MEMBER' })
  join(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.organizations.join(slug, viewerOf(request));
  }

  @Post(':slug/leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rời tổ chức (OWNER không được tự rời)' })
  leave(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.organizations.leave(slug, viewerOf(request));
  }

  @Post(':slug/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm thành viên bằng username/email (OWNER, ADMIN tổ chức, Admin hệ thống)' })
  addMember(@Param('slug') slug: string, @Body() input: AddOrganizationMemberDto, @Req() request: AuthedRequest) {
    return this.organizations.addMember(slug, viewerOf(request), input.identifier, input.role);
  }

  @Patch(':slug/members/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi vai trò MEMBER ↔ ADMIN (OWNER hoặc Admin hệ thống)' })
  changeMemberRole(
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: ChangeOrganizationMemberRoleDto,
    @Req() request: AuthedRequest,
  ) {
    return this.organizations.changeMemberRole(slug, viewerOf(request), userId, input.role);
  }

  @Delete(':slug/members/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thành viên khỏi tổ chức' })
  removeMember(
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.organizations.removeMember(slug, viewerOf(request), userId);
  }

  @Get(':slug/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vai trò và quyền của tôi trong tổ chức' })
  me(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.organizations.getMyRole(slug, viewerOf(request));
  }

  @Get(':slug/manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dữ liệu trang quản lý (OWNER/ADMIN tổ chức hoặc Admin hệ thống)' })
  manage(@Param('slug') slug: string, @Req() request: AuthedRequest) {
    return this.organizations.getManage(slug, viewerOf(request));
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tên, slug, mô tả, website' })
  update(@Param('slug') slug: string, @Body() input: UpdateOrganizationDto, @Req() request: AuthedRequest) {
    return this.organizations.updateInfo(slug, viewerOf(request), input);
  }

  @Patch(':slug/visibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật PUBLIC/PRIVATE cho Problems, Contests, Submissions' })
  updateVisibility(
    @Param('slug') slug: string,
    @Body() input: UpdateOrganizationVisibilityDto,
    @Req() request: AuthedRequest,
  ) {
    return this.organizations.updateVisibility(slug, viewerOf(request), input);
  }
}
