/**
 * Mailer utility — unit tests
 */

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    SMTP_HOST: '',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'test@quantis.io',
  },
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('mailer', () => {
  test('sendEmail returns false when SMTP not configured', async () => {
    const { sendEmail } = await import('../utils/mailer.js');
    const result = await sendEmail('test@test.com', 'Test', '<p>Hello</p>');
    expect(result).toBe(false);
  });

  test('sendEmail logs warning when SMTP not configured', async () => {
    const logger = (await import('../config/logger.js')).default;
    const { sendEmail } = await import('../utils/mailer.js');
    await sendEmail('test@test.com', 'Subject', '<p>Body</p>');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SMTP not configured'),
      expect.any(Object)
    );
  });
});
