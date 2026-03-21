/**
 * Tests for alert delivery routing: push, email, telegram, and unknown channels.
 */

const mockQuery = jest.fn();
const mockPublish = jest.fn();
const mockSendMail = jest.fn();

jest.mock('../config/database.js', () => ({
  query: mockQuery,
  default: {},
  __esModule: true,
}));

jest.mock('../config/redis.js', () => ({
  publisher: { publish: mockPublish },
  __esModule: true,
}));

jest.mock('../config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  __esModule: true,
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

jest.mock('../index.js', () => ({
  alertDeliveryQueue: { add: jest.fn() },
  __esModule: true,
}));

import { deliverAlert } from '../delivery/index';

describe('deliverAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deliver via push channel by default when no channels specified', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-1',
          name: 'Test Alert',
          channels_json: '[]',
          email: 'user@example.com',
        },
      ],
    });
    mockPublish.mockResolvedValue(1);

    await deliverAlert('alert-1', 'user-1', { triggeredCondition: 'Price above 40k' });

    expect(mockPublish).toHaveBeenCalledWith(
      'alert:push',
      expect.stringContaining('"alertId":"alert-1"')
    );
  });

  it('should deliver via push channel when explicitly specified', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-2',
          name: 'Push Alert',
          channels_json: JSON.stringify([{ type: 'push' }]),
          email: 'user@example.com',
        },
      ],
    });
    mockPublish.mockResolvedValue(1);

    await deliverAlert('alert-2', 'user-2', { symbol: 'BTCUSDT' });

    expect(mockPublish).toHaveBeenCalledWith(
      'alert:push',
      expect.stringContaining('"userId":"user-2"')
    );
  });

  it('should deliver via email channel when specified', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-3',
          name: 'Email Alert',
          channels_json: JSON.stringify([{ type: 'email' }]),
          email: 'user@example.com',
        },
      ],
    });
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

    await deliverAlert('alert-3', 'user-3', { currentPrice: 42000 });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Email Alert'),
      })
    );
  });

  it('should skip email delivery when user has no email', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-4',
          name: 'No Email Alert',
          channels_json: JSON.stringify([{ type: 'email' }]),
          email: null,
        },
      ],
    });

    await deliverAlert('alert-4', 'user-4', {});

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should handle telegram channel as not yet implemented', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-5',
          name: 'Telegram Alert',
          channels_json: JSON.stringify([{ type: 'telegram' }]),
          email: 'user@example.com',
        },
      ],
    });

    await deliverAlert('alert-5', 'user-5', {});

    // Should complete without error (telegram is a stub)
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should handle multiple delivery channels', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-6',
          name: 'Multi-channel Alert',
          channels_json: JSON.stringify([
            { type: 'push' },
            { type: 'email' },
          ]),
          email: 'multi@example.com',
        },
      ],
    });
    mockPublish.mockResolvedValue(1);
    mockSendMail.mockResolvedValue({ messageId: 'msg-2' });

    await deliverAlert('alert-6', 'user-6', { symbol: 'ETHUSDT' });

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when alert is not found in database', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await deliverAlert('nonexistent', 'user-x', {});

    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should handle unknown channel type gracefully', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-7',
          name: 'Unknown Channel',
          channels_json: JSON.stringify([{ type: 'sms' }]),
          email: 'user@example.com',
        },
      ],
    });

    await expect(
      deliverAlert('alert-7', 'user-7', {})
    ).resolves.not.toThrow();
  });

  it('should continue delivering to other channels if one fails', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-8',
          name: 'Resilient Alert',
          channels_json: JSON.stringify([
            { type: 'email' },
            { type: 'push' },
          ]),
          email: 'user@example.com',
        },
      ],
    });
    mockSendMail.mockRejectedValue(new Error('SMTP timeout'));
    mockPublish.mockResolvedValue(1);

    await deliverAlert('alert-8', 'user-8', { symbol: 'BTCUSDT' });

    // Push should still be delivered even though email failed
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('should throw when the main database query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      deliverAlert('alert-x', 'user-x', {})
    ).rejects.toThrow('DB connection lost');
  });
});
