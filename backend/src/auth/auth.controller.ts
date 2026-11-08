import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type {} from 'multer';
import {
  AuthService,
  hashRefreshToken,
  type AuthResult,
} from './auth.service.js';
import { AVATAR_MAX_BYTES } from './avatar-storage.service.js';
import { COVER_MAX_BYTES } from './cover-storage.service.js';
import { CoverUploadDto } from './dto/cover-upload.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ProfileUpdateDto } from './dto/profile-update.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyPasswordSetupOtpDto } from './dto/verify-password-setup-otp.dto.js';
import { CompletePasswordSetupDto } from './dto/complete-password-setup.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PasswordResetService } from './password-reset.service.js';
import {
  GoogleOAuthFlowError,
  GoogleOAuthService,
} from './google-oauth.service.js';
import {
  GitHubOAuthFlowError,
  GitHubOAuthService,
} from './github-oauth.service.js';
import {
  GOOGLE_OAUTH_STATE_COOKIE_PATH,
  googleOAuthStateCookieName,
  type GoogleOAuthMode,
} from './google-oauth-state.store.js';
import {
  GITHUB_OAUTH_STATE_COOKIE_PATH,
  githubOAuthStateCookieName,
  type GitHubOAuthMode,
} from './github-oauth-state.store.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

export const REFRESH_COOKIE_NAME = 'uth_refresh_token';
export const REMEMBER_LOGIN_COOKIE_NAME = 'uth_remember_login';
export const REFRESH_COOKIE_PATH = '/auth';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & {
  user: { id: string; role: 'STUDENT' | 'ADMIN' };
};

@ApiTags('Authentication')
@DocumentControllerOperations()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly githubOAuth: GitHubOAuthService,
  ) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Gửi mã OTP đặt lại mật khẩu nếu email thuộc tài khoản phù hợp',
  })
  async forgotPassword(
    @Body() input: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    return this.passwordReset.requestOtp(input.email, ipAddress);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác minh OTP và cấp reset token sử dụng một lần' })
  async verifyResetOtp(@Body() input: VerifyResetOtpDto) {
    return this.passwordReset.verifyOtp(input.email, input.otp);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Mật khẩu đã được cập nhật; không có nội dung phản hồi.' })
  @ApiOperation({ summary: 'Đặt mật khẩu mới bằng reset token đã xác minh' })
  async resetPassword(
    @Body() input: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.passwordReset.resetPassword(input.resetToken, input.newPassword);
    clearRefreshCookie(response);
    clearRememberLoginCookie(response);
  }

  @Post('register')
  @ApiBody({
    type: RegisterDto,
    examples: {
      example: {
        summary: 'Thông tin đăng ký minh họa',
        value: {
          username: 'example_student',
          email: 'student@example.com',
          password: 'ExamplePass123!',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Đăng ký bằng tên người dùng, email và mật khẩu',
    description:
      'Tạo tài khoản sinh viên và đăng nhập; access token nằm trong phản hồi, refresh token được đặt trong cookie HttpOnly.',
  })
  @ApiCreatedResponse({
    description: 'Tạo tài khoản và đăng nhập; giá trị token và UUID trong ví dụ là placeholder.',
    schema: {
      example: {
        user: {
          id: '00000000-0000-4000-8000-000000000000',
          username: 'example_student',
          email: 'student@example.com',
          full_name: null,
          avatar_url: null,
          cover_image_url: null,
          cover_crop: null,
          bio: null,
          organization: null,
          is_active: true,
          role: 'STUDENT',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'ACCESS_TOKEN_PLACEHOLDER',
        expiresIn: 900,
      },
    },
  })
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
  @ApiOperation({
    summary: 'Đăng nhập bằng tên người dùng hoặc email',
    description:
      'Đăng nhập công khai bằng thông tin tài khoản; access token nằm trong phản hồi và refresh token được đặt trong cookie HttpOnly.',
  })
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

  @Get('google')
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['login', 'register'],
    description: 'Mặc định là login; register bắt đầu luồng đăng ký.',
  })
  @ApiQuery({
    name: 'rememberLogin',
    required: false,
    enum: ['true', 'false'],
    description: 'Mặc định ghi nhớ đăng nhập; giá trị false tắt tùy chọn này.',
  })
  @ApiOperation({
    summary:
      'Bắt đầu đăng nhập hoặc đăng ký Google bằng Authorization Code Flow',
  })
  async startGoogleOAuth(
    @Query('mode') modeValue: string | undefined,
    @Query('rememberLogin') rememberLoginValue: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const mode: GoogleOAuthMode =
      modeValue === 'register' ? 'register' : 'login';
    if (modeValue && modeValue !== 'login' && modeValue !== 'register') {
      response.redirect(frontendRedirect('/login', 'oauth_failed'));
      return;
    }

    try {
      const authorization = await this.googleOAuth.start(
        mode,
        mode === 'register' || rememberLoginValue !== 'false',
      );
      response.cookie(authorization.cookieName, authorization.cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: GOOGLE_OAUTH_STATE_COOKIE_PATH,
        maxAge: 5 * 60 * 1000,
      });
      response.redirect(authorization.url);
    } catch {
      this.logger.warn('Google OAuth initiation failed.');
      response.redirect(frontendRedirect(`/${mode}`, 'provider_unavailable'));
    }
  }

  @Get('google/callback')
  @ApiQuery({ name: 'state', required: false, description: 'Tham số state do nhà cung cấp OAuth trả về.' })
  @ApiQuery({ name: 'code', required: false, description: 'Mã ủy quyền do Google trả về.' })
  @ApiQuery({ name: 'error', required: false, description: 'Mã lỗi nếu người dùng hoặc nhà cung cấp từ chối luồng.' })
  @ApiOperation({
    summary: 'Xác minh callback Google và tạo phiên đăng nhập hiện tại',
  })
  async completeGoogleOAuth(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const callbackUrl = new URL(request.originalUrl, 'http://localhost');
    const stateValues = callbackUrl.searchParams.getAll('state');
    const state = stateValues.length === 1 ? stateValues[0] : undefined;
    const stateCookieName = state
      ? googleOAuthStateCookieName(state)
      : undefined;
    const stateCookieValue = stateCookieName
      ? readCookie(request, stateCookieName)
      : undefined;

    if (stateCookieName) clearGoogleOAuthStateCookie(response, stateCookieName);

    try {
      const completed = await this.googleOAuth.complete(
        request.originalUrl,
        stateCookieValue,
      );
      const result = await this.auth.loginWithGoogle(completed.identity);
      setRefreshCookie(response, result.refreshToken, completed.rememberLogin);
      response.redirect(frontendRedirect('/'));
    } catch (error) {
      this.logger.warn('Google OAuth callback was rejected.');
      const mode =
        error instanceof GoogleOAuthFlowError && error.mode
          ? error.mode
          : 'login';
      response.redirect(frontendRedirect(`/${mode}`, oauthFailureCode(error)));
    }
  }

  @Get('github')
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['login', 'register'],
    description: 'Mặc định là login; register bắt đầu luồng đăng ký.',
  })
  @ApiQuery({
    name: 'rememberLogin',
    required: false,
    enum: ['true', 'false'],
    description: 'Mặc định ghi nhớ đăng nhập; giá trị false tắt tùy chọn này.',
  })
  @ApiOperation({
    summary:
      'Bắt đầu đăng nhập hoặc đăng ký GitHub bằng Authorization Code Flow',
  })
  async startGitHubOAuth(
    @Query('mode') modeValue: string | undefined,
    @Query('rememberLogin') rememberLoginValue: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const mode: GitHubOAuthMode =
      modeValue === 'register' ? 'register' : 'login';
    if (modeValue && modeValue !== 'login' && modeValue !== 'register') {
      response.redirect(frontendRedirect('/login', 'oauth_failed', 'github'));
      return;
    }

    try {
      const authorization = await this.githubOAuth.start(
        mode,
        mode === 'register' || rememberLoginValue !== 'false',
      );
      response.cookie(authorization.cookieName, authorization.cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: GITHUB_OAUTH_STATE_COOKIE_PATH,
        maxAge: 5 * 60 * 1000,
      });
      response.redirect(authorization.url);
    } catch {
      this.logger.warn('GitHub OAuth initiation failed.');
      response.redirect(
        frontendRedirect(`/${mode}`, 'provider_unavailable', 'github'),
      );
    }
  }

  @Get('github/callback')
  @ApiQuery({ name: 'state', required: false, description: 'Tham số state do nhà cung cấp OAuth trả về.' })
  @ApiQuery({ name: 'code', required: false, description: 'Mã ủy quyền do GitHub trả về.' })
  @ApiQuery({ name: 'error', required: false, description: 'Mã lỗi nếu người dùng hoặc nhà cung cấp từ chối luồng.' })
  @ApiOperation({
    summary: 'Xác minh callback GitHub và tạo phiên đăng nhập hiện tại',
  })
  async completeGitHubOAuth(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const callbackUrl = new URL(request.originalUrl, 'http://localhost');
    const stateValues = callbackUrl.searchParams.getAll('state');
    const state = stateValues.length === 1 ? stateValues[0] : undefined;
    const stateCookieName = state
      ? githubOAuthStateCookieName(state)
      : undefined;
    const stateCookieValue = stateCookieName
      ? readCookie(request, stateCookieName)
      : undefined;

    if (stateCookieName) clearGitHubOAuthStateCookie(response, stateCookieName);

    try {
      const completed = await this.githubOAuth.complete(
        request.originalUrl,
        stateCookieValue,
      );
      const result = await this.auth.loginWithGitHub(completed.identity);
      setRefreshCookie(response, result.refreshToken, completed.rememberLogin);
      response.redirect(frontendRedirect('/'));
    } catch (error) {
      this.logger.warn('GitHub OAuth callback was rejected.');
      const mode =
        error instanceof GitHubOAuthFlowError && error.mode
          ? error.mode
          : 'login';
      response.redirect(
        frontendRedirect(`/${mode}`, githubOAuthFailureCode(error), 'github'),
      );
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cập nhật cookie làm mới (refresh cookie) và cấp mã truy cập (access token) mới',
    description:
      'Yêu cầu cookie uth_refresh_token HttpOnly hợp lệ. Xoay vòng cookie phiên và trả về access token mới.',
  })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOkResponse({
    description: 'Mã truy cập đã được làm mới; cookie làm mới đã được thay mới',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.refresh(readRefreshCookie(request));
    const rememberLogin =
      readCookie(request, REMEMBER_LOGIN_COOKIE_NAME) !== '0';
    setRefreshCookie(response, result.refreshToken, rememberLogin);
    return toClientResult(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Phiên đã được xử lý và cookie đã bị xóa.' })
  @ApiOperation({
    summary: 'Hủy phiên làm việc hiện tại và xóa cookie của nó',
    description:
      'Không yêu cầu đăng nhập. Nếu có refresh cookie HttpOnly hợp lệ, thu hồi phiên tương ứng; phản hồi luôn xóa cookie hiện tại.',
  })
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

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu của người dùng hiện tại',
    description:
      'Yêu cầu access token Bearer. Nếu có refresh cookie HttpOnly, hệ thống dùng cookie đó để kết thúc phiên hiện tại.',
  })
  @ApiBadRequestResponse({
    description:
      'Thông tin mật khẩu không hợp lệ hoặc mật khẩu hiện tại không đúng',
  })
  @ApiNoContentResponse({ description: 'Mật khẩu đã được đổi; không có nội dung phản hồi.' })
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(
      request.user.id,
      input.currentPassword,
      input.newPassword,
      readRefreshCookie(request),
    );
  }

  @Get('me/password-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra tài khoản hiện tại đã có mật khẩu hay chưa' })
  async getPasswordStatus(@Req() request: AuthenticatedRequest) {
    return this.auth.getPasswordStatus(request.user.id);
  }

  @Post('me/password-setup/otp')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi OTP xác minh email để thiết lập mật khẩu' })
  async requestPasswordSetupOtp(@Req() request: AuthenticatedRequest) {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    return this.passwordReset.requestPasswordSetupOtp(
      request.user.id,
      ipAddress,
    );
  }

  @Post('me/password-setup/verify-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác minh OTP cho giao dịch thiết lập mật khẩu' })
  async verifyPasswordSetupOtp(
    @Req() request: AuthenticatedRequest,
    @Body() input: VerifyPasswordSetupOtpDto,
  ) {
    return this.passwordReset.verifyPasswordSetupOtp(
      request.user.id,
      input.transactionId,
      input.otp,
    );
  }

  @Post('me/password-setup/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lưu mật khẩu sau khi xác minh email',
    description:
      'Yêu cầu access token Bearer và setup token hợp lệ. Refresh cookie HttpOnly là tùy chọn để nhận diện phiên hiện tại.',
  })
  async completePasswordSetup(
    @Req() request: AuthenticatedRequest,
    @Body() input: CompletePasswordSetupDto,
  ) {
    const refreshToken = readRefreshCookie(request);
    await this.passwordReset.completePasswordSetup(
      request.user.id,
      input.setupToken,
      input.newPassword,
      refreshToken ? hashRefreshToken(refreshToken) : undefined,
    );
    return this.auth.issueAccessToken(request.user.id);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: { type: 'string', format: 'binary' },
        fullName: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        coverImageUrl: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
        organization: { type: 'string', nullable: true },
      },
    },
  })
  @ApiOperation({
    summary: 'Tải ảnh đại diện (PNG, JPEG, WebP, GIF, tối đa 2 MB)',
  })
  @ApiOkResponse({
    description: 'Thông tin người dùng sau khi cập nhật ảnh đại diện',
  })
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
  @UseInterceptors(
    FileInterceptor('cover', {
      limits: { fileSize: COVER_MAX_BYTES, files: 1 },
    }),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['cover'],
      properties: {
        cover: { type: 'string', format: 'binary' },
        crop: {
          type: 'string',
          description: 'JSON CoverCropMetadataDto đã tuần tự hóa; bắt buộc khi tải ảnh bìa.',
          example:
            '{"x":100,"y":50,"width":800,"height":400,"sourceWidth":1600,"sourceHeight":900,"aspect":2}',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Tải ảnh bìa đã cắt cho hồ sơ hiện tại (PNG, JPEG, WebP hoặc GIF, tối đa 5 MB)',
  })
  @ApiOkResponse({
    description: 'Thông tin người dùng sau khi cập nhật ảnh bìa',
  })
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

function clearGoogleOAuthStateCookie(
  response: Response,
  cookieName: string,
): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: GOOGLE_OAUTH_STATE_COOKIE_PATH,
  });
}

function clearGitHubOAuthStateCookie(
  response: Response,
  cookieName: string,
): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: GITHUB_OAUTH_STATE_COOKIE_PATH,
  });
}

function frontendRedirect(
  path: string,
  errorCode?: string,
  oauthProvider?: 'github',
): string {
  const configuredUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const baseUrl = new URL(configuredUrl);
  if (
    !['http:', 'https:'].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== '/' ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error('FRONTEND_URL must be an HTTP(S) origin.');
  }

  const destination = new URL(path, baseUrl);
  if (errorCode) destination.searchParams.set('oauthError', errorCode);
  if (oauthProvider)
    destination.searchParams.set('oauthProvider', oauthProvider);
  return destination.href;
}

function oauthFailureCode(error: unknown): string {
  if (error instanceof GoogleOAuthFlowError) {
    switch (error.code) {
      case 'invalid_state':
        return 'state_invalid';
      case 'provider_cancelled':
        return 'provider_cancelled';
      case 'email_unverified':
        return 'email_unverified';
      case 'invalid_callback':
      case 'invalid_identity':
        return 'oauth_failed';
    }
  }
  if (error instanceof ConflictException) return 'account_exists';
  if (error instanceof UnauthorizedException) return 'account_disabled';
  return 'oauth_failed';
}

function githubOAuthFailureCode(error: unknown): string {
  if (error instanceof GitHubOAuthFlowError) {
    switch (error.code) {
      case 'invalid_state':
        return 'state_invalid';
      case 'provider_cancelled':
        return 'provider_cancelled';
      case 'email_unverified':
        return 'email_unverified';
      case 'provider_unavailable':
        return 'provider_unavailable';
      case 'invalid_callback':
      case 'invalid_identity':
        return 'oauth_failed';
    }
  }
  if (error instanceof ConflictException) return 'account_exists';
  if (error instanceof UnauthorizedException) return 'account_disabled';
  return 'oauth_failed';
}

function setRefreshCookie(
  response: Response,
  token: string,
  rememberLogin: boolean,
): void {
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
