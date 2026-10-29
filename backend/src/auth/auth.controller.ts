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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type {} from 'multer';
import { AuthService, type AuthResult } from './auth.service.js';
import { AVATAR_MAX_BYTES } from './avatar-storage.service.js';
import { COVER_MAX_BYTES } from './cover-storage.service.js';
import { CoverUploadDto } from './dto/cover-upload.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ProfileUpdateDto } from './dto/profile-update.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

export const REFRESH_COOKIE_NAME = 'uth_refresh_token';
export const REMEMBER_LOGIN_COOKIE_NAME = 'uth_remember_login';
export const REFRESH_COOKIE_PATH = '/auth';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };

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
    setRefreshCookie(response, result.refreshToken, true);
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
    setRefreshCookie(response, result.refreshToken, input.rememberMe ?? true);
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
    const rememberLogin = readCookie(request, REMEMBER_LOGIN_COOKIE_NAME) !== '0';
    setRefreshCookie(response, result.refreshToken, rememberLogin);
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
    clearRememberLoginCookie(response);
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
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ người dùng hiện tại' })
  @ApiOkResponse({ description: 'Thông tin người dùng đã được cập nhật' })
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() input: ProfileUpdateDto,
  ) {
    return this.auth.updateProfile(request.user.id, input);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải ảnh đại diện (PNG, JPEG, WebP, GIF, tối đa 2 MB)' })
  @ApiOkResponse({ description: 'Thông tin người dùng sau khi cập nhật ảnh đại diện' })
  async uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() input: ProfileUpdateDto,
  ) {
    return this.auth.uploadAvatar(request.user.id, file?.buffer, input);
  }

  @Post('me/cover')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('cover', { limits: { fileSize: COVER_MAX_BYTES, files: 1 } }))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải ảnh bìa đã cắt cho hồ sơ hiện tại (PNG, JPEG, WebP hoặc GIF, tối đa 5 MB)' })
  @ApiOkResponse({ description: 'Thông tin người dùng sau khi cập nhật ảnh bìa' })
  async uploadCover(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() input: CoverUploadDto,
  ) {
    return this.auth.uploadCover(request.user.id, file?.buffer, input.crop);
  }
}

function toClientResult(result: AuthResult) {
  const { refreshToken: _refreshToken, ...clientResult } = result;
  return clientResult;
}

function readRefreshCookie(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE_NAME);
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === cookieName) {
      return valueParts.join('=');
    }
  }

  return undefined;
}

function setRefreshCookie(response: Response, token: string, rememberLogin: boolean): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    ...(rememberLogin ? { maxAge: REFRESH_TOKEN_TTL_MS } : {}),
  });
  response.cookie(REMEMBER_LOGIN_COOKIE_NAME, rememberLogin ? '1' : '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    ...(rememberLogin ? { maxAge: REFRESH_TOKEN_TTL_MS } : {}),
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

function clearRememberLoginCookie(response: Response): void {
  response.clearCookie(REMEMBER_LOGIN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}
