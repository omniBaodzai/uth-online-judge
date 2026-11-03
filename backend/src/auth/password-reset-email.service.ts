import { Injectable } from '@nestjs/common';
import type { PasswordChallengePurpose } from './password-reset.repository.js';

@Injectable()
export class PasswordResetEmailService {
  async sendOtp(
    email: string,
    otp: string,
    purpose: PasswordChallengePurpose = 'PASSWORD_RESET',
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'UTH Online Judge <onboarding@resend.dev>',
        to: [email],
        subject:
          purpose === 'PASSWORD_SETUP'
            ? 'UTH Online Judge - Mã xác nhận thiết lập mật khẩu'
            : 'UTH Online Judge - Mã xác nhận đặt lại mật khẩu',
        html: passwordResetEmailHtml(otp, purpose),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Resend request failed with status ${response.status}`);
    }
  }
}

export function passwordResetEmailHtml(
  otp: string,
  purpose: PasswordChallengePurpose = 'PASSWORD_RESET',
): string {
  const isSetup = purpose === 'PASSWORD_SETUP';
  const heading = isSetup
    ? 'Xác minh thiết lập mật khẩu'
    : 'Xác nhận đặt lại mật khẩu';
  const explanation = isSetup
    ? 'Chúng tôi đã nhận được yêu cầu thiết lập mật khẩu đăng nhập bằng email cho tài khoản UTH Online Judge của bạn.'
    : 'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản UTH Online Judge của bạn.';
  const destination = isSetup
    ? 'Nhập mã này vào cửa sổ thiết lập mật khẩu để tiếp tục.'
    : 'Nhập mã này vào trang Quên mật khẩu để tiếp tục.';
  const warning = isSetup
    ? 'Nếu bạn không yêu cầu thiết lập mật khẩu, hãy bỏ qua email này. Phương thức đăng nhập hiện tại của bạn sẽ không thay đổi.'
    : 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại của bạn sẽ không thay đổi.';

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:32px 12px;background:#edf5f5;font-family:Arial,Helvetica,sans-serif;color:#17383e;">
  <table role="presentation" cellpadding="0" cellspacing="0"
    style="max-width:560px;width:100%;margin:auto;background:#ffffff;border-radius:12px;">
    <tr>
      <td style="padding:32px 28px;text-align:center;">
        <h2 style="color:#008b8c;margin:0 0 8px;">UTH Online Judge</h2>
        <p style="font-size:12px;color:#789092;margin:0;">HỆ THỐNG LUYỆN TẬP LẬP TRÌNH</p>
        <hr style="border:0;border-top:1px solid #e5eeee;margin:28px 0;">
        <h2 style="font-size:23px;margin:0 0 14px;">${heading}</h2>
        <p style="font-size:14px;line-height:1.7;color:#526b70;">
          ${explanation}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0"
          style="width:100%;margin:26px 0;background:#eff9f8;border:1px solid #d0ebe8;border-radius:10px;">
          <tr>
            <td style="padding:24px 12px;text-align:center;">
              <p style="font-size:12px;letter-spacing:1px;color:#587b7f;margin:0 0 12px;">MÃ XÁC NHẬN CỦA BẠN</p>
              <div style="font-size:38px;font-weight:700;letter-spacing:7px;color:#008b8c;">${otp}</div>
              <p style="font-size:13px;color:#587b7f;margin:14px 0 0;">Mã có hiệu lực trong 5 phút</p>
            </td>
          </tr>
        </table>
        <p style="font-size:14px;line-height:1.7;color:#526b70;">
          ${destination} Không chia sẻ mã với bất kỳ ai.
        </p>
        <p style="font-size:12px;line-height:1.7;background:#f6f9f9;padding:14px;border-radius:8px;color:#6d8083;">
          ${warning}
        </p>
        <hr style="border:0;border-top:1px solid #e5eeee;margin:26px 0;">
        <p style="font-size:12px;color:#91a1a3;">© 2026 UTH Online Judge</p>
        <p style="font-size:11px;color:#91a1a3;">Email bảo mật tự động - Vui lòng không trả lời</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
