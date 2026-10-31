import assert from 'node:assert/strict'
import test from 'node:test'
import { validateContactForm, type ContactFormValues } from '../src/features/contact/contact-validation.ts'

const validValues: ContactFormValues = {
  name: 'Nguyen Van A',
  email: 'student@example.com',
  subject: 'Hỗ trợ bài tập',
  message: 'Tôi cần hỗ trợ về một bài tập.',
}

test('accepts a complete contact form with a valid email address', () => {
  assert.deepEqual(validateContactForm(validValues), {})
})

test('rejects whitespace-only required fields', () => {
  assert.deepEqual(validateContactForm({
    name: '  ',
    email: ' ',
    subject: '\t',
    message: '\n ',
  }), {
    name: 'Vui lòng nhập họ và tên.',
    email: 'Vui lòng nhập email.',
    subject: 'Vui lòng nhập tiêu đề.',
    message: 'Vui lòng nhập nội dung cần hỗ trợ.',
  })
})

test('rejects malformed email and values beyond field limits', () => {
  const errors = validateContactForm({
    ...validValues,
    email: 'student@invalid',
    subject: 'x'.repeat(121),
    message: 'x'.repeat(2001),
  })

  assert.equal(errors.email, 'Vui lòng nhập địa chỉ email hợp lệ.')
  assert.equal(errors.subject, 'Tiêu đề không được vượt quá 120 ký tự.')
  assert.equal(errors.message, 'Nội dung không được vượt quá 2000 ký tự.')
})
