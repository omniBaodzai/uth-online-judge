// Thông tin liên hệ dùng chung, lấy từ phần chân trang và menu hiện có.
export const CONTACT_EMAIL = 'uthoj.mywork@gmail.com'
export const CONTACT_PHONE = '+84 94 8811 592'
export const CONTACT_PHONE_LINK = '+84948811592'
export const CONTACT_FANPAGE_URL = 'https://www.facebook.com/people/UTH-Online-Judge/61595822645452/'
export const CONTACT_SUPPORT_GROUP_URL: string | null = null

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
