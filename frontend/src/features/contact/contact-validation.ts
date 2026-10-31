export type ContactFormValues = {
  name: string
  email: string
  subject: string
  message: string
}

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}
  const name = values.name.trim()
  const email = values.email.trim()
  const subject = values.subject.trim()
  const message = values.message.trim()

  if (!name) errors.name = 'Vui lòng nhập họ và tên.'
  else if (name.length > 100) errors.name = 'Họ và tên không được vượt quá 100 ký tự.'

  if (!email) errors.email = 'Vui lòng nhập email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.'
  }

  if (!subject) errors.subject = 'Vui lòng nhập tiêu đề.'
  else if (subject.length > 120) errors.subject = 'Tiêu đề không được vượt quá 120 ký tự.'

  if (!message) errors.message = 'Vui lòng nhập nội dung cần hỗ trợ.'
  else if (message.length > 2000) errors.message = 'Nội dung không được vượt quá 2000 ký tự.'

  return errors
}
