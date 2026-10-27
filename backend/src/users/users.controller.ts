import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { LeaderboardService, type LeaderboardSort } from './leaderboard.service.js';
import { UserProfileService } from './user-profile.service.js';

type AuthRequest = Request & { user?: { id: string; role?: string } | null };

class UsernameParamDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{1,50}$/, { message: 'Tên đăng nhập không hợp lệ.' })
  username!: string;
}

class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @IsOptional()
  @IsIn(['score', 'contributions'])
  sort: LeaderboardSort = 'score';
}

class UpdateAboutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Giới thiệu tối đa 500 ký tự.' })
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Trường/đơn vị tối đa 150 ký tự.' })
  school?: string | null;
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly profiles: UserProfileService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Bảng xếp hạng thành viên theo tổng điểm hoặc đóng góp' })
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboard.getLeaderboard({ ...query, q: query.q?.trim() || undefined });
  }

  @Get('profile/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Hồ sơ công khai của người dùng (email chỉ hiện cho chính chủ/admin)' })
  getProfile(@Param() params: UsernameParamDto, @Req() request: AuthRequest) {
    return this.profiles.getProfile(params.username, request.user ?? null);
  }

  @Patch('me/about')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật giới thiệu và trường/đơn vị của chính mình' })
  updateAbout(@Body() dto: UpdateAboutDto, @Req() request: AuthRequest) {
    return this.profiles.updateAbout(request.user!.id, dto);
  }
}
