import { PasswordResetEmailService, passwordResetEmailHtml } from './password-reset-email.service.js';

describe('PasswordResetEmailService', () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'UTH Test <test@example.com>';
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  });

  it('sends the OTP through Resend without logging or embedding the API key', async () => {
    await new PasswordResetEmailService().sendOtp('user@example.com', '012345');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-resend-key' }),
      }),
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      to: string[];
      from: string;
      html: string;
    };
    expect(requestBody.to).toEqual(['user@example.com']);
    expect(requestBody.from).toBe('UTH Test <test@example.com>');
    expect(requestBody.html).toContain('012345');
    expect(requestBody.html).toContain('Mã có hiệu lực trong 5 phút');
    expect(passwordResetEmailHtml('012345')).not.toContain('test-resend-key');
  });

  it('surfaces provider and configuration errors without returning provider response content', async () => {
    fetchMock.mockResolvedValue(new Response('secret response body', { status: 500 }));
    await expect(new PasswordResetEmailService().sendOtp('user@example.com', '012345'))
      .rejects.toThrow('status 500');

    delete process.env.RESEND_API_KEY;
    await expect(new PasswordResetEmailService().sendOtp('user@example.com', '012345'))
      .rejects.toThrow('RESEND_API_KEY is not configured');
  });
});
