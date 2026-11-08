import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CleanText, PaginationQueryDto } from '../community/dto/pagination.dto.js';
import {
  ORGANIZATION_MEMBER_ROLES,
  ORGANIZATION_REQUEST_STATUSES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_VISIBILITIES,
  type OrganizationMemberRole,
  type OrganizationRequestStatus,
  type OrganizationStatus,
  type OrganizationVisibility,
} from './organizations.types.js';
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, SLUG_PATTERN } from './organization-slug.js';

const PHONE_PATTERN = /^[0-9+()\-. ]{9,20}$/;
const WEBSITE_PATTERN = /^https?:\/\/\S+$/i;
const WEBSITE_MESSAGE = 'Website phải bắt đầu bằng http:// hoặc https://.';

// Chuỗi rỗng sau khi trim được coi là "không có giá trị" cho các trường tùy chọn.
const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );

const LowerCase = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  );

export class CreateOrganizationRequestDto {
  @ApiProperty({ maxLength: 100 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên.' })
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ maxLength: 200 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị công tác.' })
  @MaxLength(200)
  workplace!: string;

  @ApiProperty({ maxLength: 100 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập chức vụ.' })
  @MaxLength(100)
  position!: string;

  @ApiProperty({ example: '0901234567' })
  @CleanText()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ.' })
  phoneNumber!: string;

  @ApiProperty({ maxLength: 2000 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mong muốn.' })
  @MaxLength(2000)
  motivation!: string;
}

export class ListMyOrganizationRequestsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;
}

export class ListAdminOrganizationRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORGANIZATION_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(ORGANIZATION_REQUEST_STATUSES, { message: 'Trạng thái lọc không hợp lệ.' })
  status?: OrganizationRequestStatus;

  @ApiPropertyOptional({ enum: ['newest', 'oldest'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'oldest'], { message: 'Cách sắp xếp không hợp lệ.' })
  sort: 'newest' | 'oldest' = 'newest';
}

export class RejectOrganizationRequestDto {
  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string | null;
}

export class ApproveOrganizationRequestDto {
  @ApiPropertyOptional({ maxLength: 150, description: 'Mặc định là đơn vị công tác của người gửi.' })
  @IsOptional()
  @CleanText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Mặc định sinh từ tên tổ chức.' })
  @IsOptional()
  @CleanText()
  @LowerCase()
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang giữa các cụm.' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2048)
  @Matches(WEBSITE_PATTERN, { message: WEBSITE_MESSAGE })
  websiteUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Username hoặc email của OWNER; null/bỏ trống để tổ chức chưa có OWNER.',
  })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(254)
  ownerIdentifier?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string | null;
}

export class CreateOrganizationDto {
  @ApiProperty({ maxLength: 150 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên tổ chức.' })
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ description: 'Mặc định sinh từ tên tổ chức.' })
  @IsOptional()
  @CleanText()
  @LowerCase()
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang giữa các cụm.' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2048)
  @Matches(WEBSITE_PATTERN, { message: WEBSITE_MESSAGE })
  websiteUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Username hoặc email của OWNER.' })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(254)
  ownerIdentifier?: string | null;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Tên tổ chức không được để trống.' })
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @CleanText()
  @LowerCase()
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang giữa các cụm.' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @CleanText()
  @EmptyToNull()
  @IsString()
  @MaxLength(2048)
  @Matches(WEBSITE_PATTERN, { message: WEBSITE_MESSAGE })
  websiteUrl?: string | null;
}

export class UpdateOrganizationVisibilityDto {
  @ApiPropertyOptional({ enum: ORGANIZATION_VISIBILITIES })
  @IsOptional()
  @IsIn(ORGANIZATION_VISIBILITIES, { message: 'Thiết lập hiển thị không hợp lệ.' })
  problemsVisibility?: OrganizationVisibility;

  @ApiPropertyOptional({ enum: ORGANIZATION_VISIBILITIES })
  @IsOptional()
  @IsIn(ORGANIZATION_VISIBILITIES, { message: 'Thiết lập hiển thị không hợp lệ.' })
  contestsVisibility?: OrganizationVisibility;

  @ApiPropertyOptional({ enum: ORGANIZATION_VISIBILITIES })
  @IsOptional()
  @IsIn(ORGANIZATION_VISIBILITIES, { message: 'Thiết lập hiển thị không hợp lệ.' })
  submissionsVisibility?: OrganizationVisibility;
}

export class ChangeOrganizationOwnerDto {
  @ApiProperty({
    nullable: true,
    description: 'Username hoặc email của OWNER mới; null để gỡ OWNER.',
  })
  @ValidateIf((_object, value) => value !== null)
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập username hoặc email, hoặc null để gỡ OWNER.' })
  @MaxLength(254)
  ownerIdentifier!: string | null;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER'], default: 'ADMIN' })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'], { message: 'Vai trò của OWNER cũ không hợp lệ.' })
  previousOwnerRole: Exclude<OrganizationMemberRole, 'OWNER'> = 'ADMIN';
}

export class ListOrganizationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['members', 'newest', 'name'], default: 'members' })
  @IsOptional()
  @IsIn(['members', 'newest', 'name'], { message: 'Cách sắp xếp không hợp lệ.' })
  sort: 'members' | 'newest' | 'name' = 'members';
}

export class ListAdminOrganizationsQueryDto extends ListOrganizationsQueryDto {
  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES, { message: 'Trạng thái lọc không hợp lệ.' })
  status?: OrganizationStatus;
}

export class ListOrganizationMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORGANIZATION_MEMBER_ROLES })
  @IsOptional()
  @IsIn(ORGANIZATION_MEMBER_ROLES, { message: 'Vai trò lọc không hợp lệ.' })
  role?: OrganizationMemberRole;
}

export class AddOrganizationMemberDto {
  @ApiProperty({ description: 'Username hoặc email của tài khoản đang hoạt động.' })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập username hoặc email.' })
  @MaxLength(254)
  identifier!: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'], { message: 'Vai trò không hợp lệ.' })
  role: 'ADMIN' | 'MEMBER' = 'MEMBER';
}

export class ChangeOrganizationMemberRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] })
  @IsIn(['ADMIN', 'MEMBER'], { message: 'Vai trò không hợp lệ.' })
  role!: 'ADMIN' | 'MEMBER';
}
