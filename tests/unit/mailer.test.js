// functions/mailer.js lazily builds+caches a nodemailer transporter the
// first time sendMail() is called, and throws a guard-clause error if SMTP
// env vars aren't set. We reset the module registry between tests so that
// cache doesn't leak between the "missing config" and "configured" cases,
// and we always mock nodemailer itself so nothing here can ever open a real
// SMTP connection.
describe('mailer', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws a guard-clause error when SMTP env vars are missing', async () => {
    jest.doMock('nodemailer', () => ({ createTransport: jest.fn() }));
    const { sendMail } = require('../../functions/mailer');

    await expect(
      sendMail({ fromName: 'a', fromEmail: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' })
    ).rejects.toThrow('SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing).');
  });

  it('throws the same guard-clause error even if only some SMTP vars are set', async () => {
    jest.doMock('nodemailer', () => ({ createTransport: jest.fn() }));
    process.env.SMTP_HOST = 'smtp.example.com';
    // SMTP_USER / SMTP_PASS still missing
    const { sendMail } = require('../../functions/mailer');

    await expect(
      sendMail({ fromName: 'a', fromEmail: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' })
    ).rejects.toThrow('SMTP is not configured');
  });

  it('builds a transporter from env vars and delegates to nodemailer.sendMail when configured', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
    const createTransportMock = jest.fn().mockReturnValue({ sendMail: sendMailMock });
    jest.doMock('nodemailer', () => ({ createTransport: createTransportMock }));

    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendMail } = require('../../functions/mailer');
    const result = await sendMail({
      fromName: 'Employee Name',
      fromEmail: 'employee@example.com',
      to: ['client@example.com'],
      cc: [],
      bcc: [],
      subject: 'Invoice ABC-1',
      html: '<p>hi</p>',
      attachments: [{ filename: 'x.pdf', content: Buffer.from('x') }],
    });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'user@example.com', pass: 'secret' },
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Employee Name" <employee@example.com>',
        to: ['client@example.com'],
        cc: undefined,
        bcc: undefined,
        subject: 'Invoice ABC-1',
      })
    );
    expect(result).toEqual({ messageId: 'test-message-id' });
  });

  it('passes through non-empty cc/bcc lists but omits them (undefined) when empty', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: sendMailMock }),
    }));
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendMail } = require('../../functions/mailer');
    await sendMail({
      fromName: 'A',
      fromEmail: 'a@x.com',
      to: ['b@x.com'],
      cc: ['c@x.com'],
      bcc: [],
      subject: 's',
      html: '<p>h</p>',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ cc: ['c@x.com'], bcc: undefined })
    );
  });

  it('defaults SMTP_PORT to 587 and secure to false when not set', async () => {
    const createTransportMock = jest.fn().mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) });
    jest.doMock('nodemailer', () => ({ createTransport: createTransportMock }));
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendMail } = require('../../functions/mailer');
    await sendMail({ fromName: 'A', fromEmail: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false })
    );
  });
});
