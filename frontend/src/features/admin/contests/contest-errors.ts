import { ApiError } from '../../auth/api'

export function contestErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  if (error.status === 403) return 'Tài khoản hiện tại không có quyền quản lý cuộc thi.'
  if (error.status === 404) return 'Không tìm thấy cuộc thi hoặc bài tập được yêu cầu.'
  if (error.status === 409) return `Dữ liệu xung đột: ${error.message}`
  if (error.status === 0) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
  return error.message || fallback
}
