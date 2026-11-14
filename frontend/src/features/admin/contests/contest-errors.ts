import { ApiError } from '../../auth/api'

export function contestErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  if (error.status === 403) return 'Tài khoản hiện tại không có quyền quản lý cuộc thi.'
  if (error.status === 404) return 'Không tìm thấy cuộc thi hoặc bài tập được yêu cầu.'
  if (error.message.includes('Không thể thay đổi bài tập sau khi cuộc thi bắt đầu')) {
    return 'Cuộc thi đã bắt đầu. Không thể cập nhật danh sách bài tập; các thay đổi đã lưu trước đó vẫn được giữ nguyên.'
  }
  if (error.message.includes('Chỉ có thể xuất bản cuộc thi có thời gian kết thúc trong tương lai và chưa bắt đầu')) {
    return 'Thời gian bắt đầu phải lớn hơn thời gian hiện tại. Vui lòng chọn thời gian bắt đầu trong tương lai.'
  }
  if (error.status === 409) return `Dữ liệu xung đột: ${error.message}`
  if (error.status === 0) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
  return error.message || fallback
}

export function hasUncertainCreateOutcome(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}
