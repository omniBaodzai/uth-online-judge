import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, type AuthResult } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ProfileUpdateDto } from './dto/profile-update.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

export const REFRESH_COOKIE_NAME = 'uth_refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký bằng tên người dùng, email và mật khẩu' })
  @ApiCreatedResponse({ description: 'Tạo tài khoản và đăng nhập' })
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(input);
    setRefreshCookie(response, result.refreshToken);
    return toClientResult(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng tên người dùng hoặc email' })
  @ApiOkResponse({ description: 'Đã đăng nhập' })
  @ApiUnauthorizedResponse({ description: 'Thông tin đăng nhập không hợp lệ' })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.identifier, input.password);
    setRefreshCookie(response, result.refreshToken);
    return toClientResult(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật cookie làm mới (refresh cookie) và cấp mã truy cập (access token) mới' })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOkResponse({ description: 'Mã truy cập đã được làm mới; cookie làm mới đã được thay mới' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.refresh(readRefreshCookie(request));
    setRefreshCookie(response, result.refreshToken);
    return toClientResult(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hủy phiên làm việc hiện tại và xóa cookie của nó' })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin người dùng đã xác thực' })
  @ApiOkResponse({ description: 'Thông tin người dùng hiện tại' })
  async me(@Req() request: AuthenticatedRequest) {
    return this.auth.getProfile(request.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật họ tên hoặc ảnh đại diện người dùng hiện tại' })
  @ApiOkResponse({ description: 'Thông tin người dùng đã được cập nhật' })
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() input: ProfileUpdateDto,
  ) {
    return this.auth.updateProfile(request.user.id, input);
  }
}

function toClientResult(result: AuthResult) {
  const { refreshToken: _refreshToken, ...clientResult } = result;
  return clientResult;
}

function readRefreshCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      return valueParts.join('=');
    }
  }

  return undefined;
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}
