// Thông tin liên hệ dùng chung, lấy từ phần chân trang và menu hiện có.
export const CONTACT_EMAIL = 'huynhlebaoes@gmail.com'

export const contactLinks = [
  {
    label: 'Gửi yêu cầu hỗ trợ',
    description: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}?subject=Ho%20tro%20UTH%20Online%20Judge`,
  },
  {
    label: 'Báo lỗi hệ thống',
    description: 'Gửi email cho đội ngũ phát triển',
    href: `mailto:${CONTACT_EMAIL}?subject=Bao%20loi%20UTH%20Online%20Judge`,
  },
] as const

export const CONTACT_ORGANIZATION = 'Trường Đại học Giao thông Vận tải Thành phố Hồ Chí Minh'
