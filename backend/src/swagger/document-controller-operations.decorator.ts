import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const GUARDS_METADATA = '__guards__';
const API_OPERATION_METADATA = 'swagger/apiOperation';
const API_SECURITY_METADATA = 'swagger/apiSecurity';

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

const routePathOf = (controller: Function, methodName: string): string => {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, controller);
  const methodPath = Reflect.getMetadata(PATH_METADATA, controller.prototype[methodName]);
  return [controllerPath, methodPath]
    .flat()
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('/');
};

const routeLabels: Record<string, string> = {
  admin: '',
  me: 'tài khoản hiện tại',
  dashboard: 'bảng điều khiển',
  catalog: 'danh mục',
  judge0: 'Judge0',
  problems: 'bài tập',
  problem: 'bài tập',
  'test-cases': 'test case',
  users: 'người dùng',
  role: 'vai trò',
  status: 'trạng thái',
  contests: 'kỳ thi',
  contest: 'kỳ thi',
  submissions: 'bài nộp',
  registration: 'đăng ký',
  organizations: 'tổ chức',
  'organization-requests': 'yêu cầu tạo tổ chức',
  members: 'thành viên',
  grants: 'quyền sử dụng bài tập',
  leaderboard: 'bảng xếp hạng',
  discussions: 'chủ đề thảo luận',
  'discussion-comments': 'bình luận thảo luận',
  comments: 'bình luận',
  news: 'tin tức',
  'contact-messages': 'yêu cầu liên hệ',
  notifications: 'thông báo',
  reports: 'báo cáo',
  profile: 'hồ sơ',
  avatar: 'ảnh đại diện',
  cover: 'ảnh bìa',
  auth: 'xác thực',
  'password-setup': 'thiết lập mật khẩu',
  'reset-password': 'đặt lại mật khẩu',
  'forgot-password': 'khôi phục mật khẩu',
  'password-status': 'trạng thái mật khẩu',
  'change-password': 'đổi mật khẩu',
  'verify-reset-otp': 'xác minh OTP đặt lại mật khẩu',
  'verify-otp': 'xác minh OTP',
  complete: 'hoàn tất',
  otp: 'OTP',
  login: 'đăng nhập',
  register: 'đăng ký',
  google: 'Google OAuth',
  github: 'GitHub OAuth',
  callback: 'callback OAuth',
  languages: 'ngôn ngữ',
  'problem-options': 'bài tập khả dụng',
  illustrations: 'ảnh minh họa',
  'problem-comments': 'bình luận bài tập',
  discussion: 'chủ đề thảo luận',
  reaction: 'cảm xúc',
  replies: 'phản hồi',
  messages: 'yêu cầu liên hệ',
  participants: 'thí sinh',
  statistics: 'thống kê',
  lock: 'khóa',
  my: 'của tôi',
  source: 'mã nguồn',
  mine: 'dữ liệu của tôi',
  best: 'kết quả tốt nhất',
  'read-all': 'đánh dấu đã đọc',
};

const operationSummary = (
  method: string,
  routePath: string,
  methodName: string,
): string => {
  const action = methodName === 'getHealth'
    ? 'Kiểm tra tình trạng'
    : methodName.startsWith('list')
      ? 'Liệt kê'
      : methodName.startsWith('get') || methodName.startsWith('find')
        ? 'Tra cứu'
        : methodName.startsWith('create')
          ? 'Tạo'
          : methodName.startsWith('add')
            ? 'Thêm'
            : methodName.startsWith('update') || methodName.startsWith('set')
              ? 'Cập nhật'
              : methodName.startsWith('delete') || methodName.startsWith('remove')
                ? 'Xóa'
                : methodName.startsWith('register')
                  ? 'Đăng ký'
                  : methodName.startsWith('cancel')
                    ? 'Hủy'
                    : methodName.startsWith('restore')
                      ? 'Khôi phục'
                      : methodName.startsWith('publish')
                        ? 'Xuất bản'
                        : methodName.startsWith('archive')
                          ? 'Lưu trữ'
                          : methodName.startsWith('submit')
                            ? 'Nộp'
                            : method === 'GET'
                              ? 'Tra cứu'
                              : method === 'POST'
                                ? 'Thực hiện'
                                : method === 'PUT'
                                  ? 'Thay thế'
                                  : method === 'PATCH'
                                    ? 'Cập nhật'
                                    : method === 'DELETE'
                                      ? 'Xóa'
                                      : 'Xử lý';
  const resources = routePath
    .split('/')
    .filter((part) => part && !part.startsWith(':'))
    .map((part) => routeLabels[part] ?? part.replaceAll('-', ' '))
    .filter(Boolean);
  const resource = resources.join(' / ') || 'API';
  return `${action} ${resource}`;
};

const hasGuard = (guards: unknown[], name: string): boolean =>
  guards.some((guard) => typeof guard === 'function' && guard.name === name);

const hasSecurityScheme = (security: unknown[], scheme: string): boolean =>
  security.some(
    (item) => typeof item === 'object' && item !== null && scheme in item,
  );

const operationDescription = (
  summary: string,
  method: string,
  methodName: string,
  routePath: string,
  guards: unknown[],
  security: unknown[],
): string => {
  const previousAccessDescription = hasGuard(guards, 'JwtAuthGuard')
    ? hasGuard(guards, 'AdminRoleGuard')
      ? 'Chỉ quản trị viên hệ thống có access token Bearer hợp lệ được phép sử dụng.'
      : 'Yêu cầu access token Bearer hợp lệ; quyền nghiệp vụ tiếp tục được kiểm tra theo endpoint.'
    : hasGuard(guards, 'OptionalJwtAuthGuard')
      ? 'Không bắt buộc đăng nhập; Bearer token hợp lệ (nếu có) được dùng làm ngữ cảnh người xem.'
      : security.some((item) => typeof item === 'object' && item !== null && 'uth_refresh_token' in item)
        ? 'Sử dụng refresh token trong cookie HttpOnly theo cấu hình của ứng dụng; không yêu cầu Bearer token.'
        : 'Không yêu cầu đăng nhập.';
  const access = hasGuard(guards, 'JwtAuthGuard')
    ? hasGuard(guards, 'AdminRoleGuard')
      ? 'Chỉ System Admin có Bearer access token hợp lệ được phép sử dụng.'
      : 'Yêu cầu Bearer access token hợp lệ; quyền nghiệp vụ tiếp tục được kiểm tra theo endpoint.'
    : hasGuard(guards, 'OptionalJwtAuthGuard')
      ? 'Không bắt buộc đăng nhập; Bearer access token hợp lệ (nếu có) được dùng làm ngữ cảnh người xem.'
      : security.some((item) => typeof item === 'object' && item !== null && 'uth_refresh_token' in item)
        ? 'Sử dụng refresh token trong cookie HttpOnly theo cấu hình của ứng dụng.'
        : previousAccessDescription;
  const effect =
    methodName === 'getHealth'
      ? 'Trả về trạng thái hoạt động của API.'
      : method === 'GET' && routePath.includes('illustrations')
        ? 'Trả về tệp ảnh minh họa công khai; kết quả không chứa test case hay dữ liệu quản trị.'
        : routePath.startsWith('auth/google') || routePath.startsWith('auth/github')
          ? 'Khởi tạo hoặc hoàn tất luồng OAuth và điều hướng trình duyệt theo kết quả xác thực.'
          : method === 'GET'
            ? 'API chỉ đọc và không thay đổi dữ liệu.'
            : 'API có thể thay đổi dữ liệu hoặc trạng thái theo thao tác được yêu cầu.';
  const conditions = routePath.startsWith('organizations/')
    ? 'Phạm vi tổ chức, trạng thái ACTIVE/ARCHIVED, visibility, membership hiện tại và quyền quản lý được áp dụng theo nghiệp vụ của endpoint.'
    : routePath.startsWith('admin/')
      ? 'Thao tác quản trị áp dụng quyền System Admin và các điều kiện trạng thái của tài nguyên.'
      : routePath.startsWith('contests/')
        ? 'Việc xem, đăng ký và nộp bài tuân theo trạng thái publication, visibility, thời gian và điều kiện của kỳ thi.'
        : routePath.startsWith('submissions')
          ? 'Việc xem hoặc tạo bài nộp tuân theo quyền người dùng, trạng thái bài tập và ngữ cảnh contest nếu có.'
          : 'Request phải thỏa validation và các quy tắc nghiệp vụ, quyền truy cập do endpoint áp dụng.';
  return `Mục đích: ${summary}. Quyền truy cập: ${access} Điều kiện: ${conditions} ${effect}`;
};

export function DocumentControllerOperations(): ClassDecorator {
  return (controller) => {
    const prototype = controller.prototype as Record<string, unknown>;
    const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];

    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[methodName];
      if (typeof handler !== 'function') continue;

      const methodNumber = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (methodNumber === undefined) continue;

      const method = httpMethods[methodNumber] ?? 'GET';
      const routePath = routePathOf(controller, methodName);
      const existing = (Reflect.getMetadata(API_OPERATION_METADATA, handler) ?? {}) as {
        summary?: string;
        description?: string;
        [key: string]: unknown;
      };
      const summary =
        existing.summary?.trim() ||
        operationSummary(method, routePath, methodName);
      const methodGuards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
      const guards = [...classGuards, ...methodGuards];
      const security = [
        ...((Reflect.getMetadata(API_SECURITY_METADATA, controller) ?? []) as unknown[]),
        ...((Reflect.getMetadata(API_SECURITY_METADATA, handler) ?? []) as unknown[]),
      ];

      if (hasGuard(guards, 'JwtAuthGuard') && !hasSecurityScheme(security, 'bearer')) {
        ApiBearerAuth()(prototype, methodName, Object.getOwnPropertyDescriptor(prototype, methodName)!);
      }

      ApiOperation({
        ...existing,
        summary,
        description:
          existing.description?.trim() ||
          operationDescription(
            summary,
            method,
            methodName,
            routePath,
            guards,
            security,
          ),
      })(prototype, methodName, Object.getOwnPropertyDescriptor(prototype, methodName)!);
    }
  };
}
