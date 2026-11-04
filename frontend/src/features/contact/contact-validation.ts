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

  if (!name) errors.name = 'contactNameRequired'
  else if (name.length > 100) errors.name = 'contactNameTooLong'

  if (!email) errors.email = 'contactEmailRequired'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'contactEmailInvalid'
  }

  if (!subject) errors.subject = 'contactSubjectRequired'
  else if (subject.length > 120) errors.subject = 'contactSubjectTooLong'

  if (!message) errors.message = 'contactMessageRequired'
  else if (message.length > 2000) errors.message = 'contactMessageTooLong'

  return errors
}
