import {
  UserTier,
  Language,
  ExperienceLevel,
  SubscriptionStatus,
  PaymentStatus,
  SignalType,
  SignalStrength,
  SignalStatus,
} from '../types/index';
import {
  formatPrice,
  formatPercent,
  formatVolume,
  isValidTimeframe,
  generateId,
} from '../utils/index';

// ── Enum value tests ───────────────────────────────────────────────

describe('UserTier enum', () => {
  it('should have 4 tiers', () => {
    expect(Object.keys(UserTier)).toHaveLength(4);
  });

  it('should have expected values', () => {
    expect(UserTier.STARTER).toBe('STARTER');
    expect(UserTier.TRADER).toBe('TRADER');
    expect(UserTier.PRO).toBe('PRO');
    expect(UserTier.INSTITUTIONAL).toBe('INSTITUTIONAL');
  });
});

describe('Language enum', () => {
  it('should have 3 languages', () => {
    expect(Object.keys(Language)).toHaveLength(3);
  });

  it('should have EN, UA, RU', () => {
    expect(Language.EN).toBe('EN');
    expect(Language.UA).toBe('UA');
    expect(Language.RU).toBe('RU');
  });
});

describe('ExperienceLevel enum', () => {
  it('should have 3 levels', () => {
    expect(Object.keys(ExperienceLevel)).toHaveLength(3);
  });

  it('should have expected values', () => {
    expect(ExperienceLevel.BEGINNER).toBe('BEGINNER');
    expect(ExperienceLevel.INTERMEDIATE).toBe('INTERMEDIATE');
    expect(ExperienceLevel.ADVANCED).toBe('ADVANCED');
  });
});

describe('SubscriptionStatus enum', () => {
  it('should have 4 statuses', () => {
    expect(Object.keys(SubscriptionStatus)).toHaveLength(4);
  });

  it('should have expected values', () => {
    expect(SubscriptionStatus.ACTIVE).toBe('ACTIVE');
    expect(SubscriptionStatus.EXPIRED).toBe('EXPIRED');
    expect(SubscriptionStatus.CANCELLED).toBe('CANCELLED');
    expect(SubscriptionStatus.GRACE_PERIOD).toBe('GRACE_PERIOD');
  });
});

describe('PaymentStatus enum', () => {
  it('should have 4 statuses', () => {
    expect(Object.keys(PaymentStatus)).toHaveLength(4);
  });

  it('should have expected values', () => {
    expect(PaymentStatus.PENDING).toBe('PENDING');
    expect(PaymentStatus.CONFIRMED).toBe('CONFIRMED');
    expect(PaymentStatus.FAILED).toBe('FAILED');
    expect(PaymentStatus.REFUNDED).toBe('REFUNDED');
  });
});

describe('SignalType enum', () => {
  it('should have 3 types', () => {
    expect(Object.keys(SignalType)).toHaveLength(3);
  });

  it('should have BUY, SELL, CLOSE', () => {
    expect(SignalType.BUY).toBe('BUY');
    expect(SignalType.SELL).toBe('SELL');
    expect(SignalType.CLOSE).toBe('CLOSE');
  });
});

describe('SignalStrength enum', () => {
  it('should have 3 strengths', () => {
    expect(Object.keys(SignalStrength)).toHaveLength(3);
  });

  it('should have WEAK, MEDIUM, STRONG', () => {
    expect(SignalStrength.WEAK).toBe('WEAK');
    expect(SignalStrength.MEDIUM).toBe('MEDIUM');
    expect(SignalStrength.STRONG).toBe('STRONG');
  });
});

describe('SignalStatus enum', () => {
  it('should have 4 statuses', () => {
    expect(Object.keys(SignalStatus)).toHaveLength(4);
  });

  it('should have expected values', () => {
    expect(SignalStatus.ACTIVE).toBe('ACTIVE');
    expect(SignalStatus.TRIGGERED).toBe('TRIGGERED');
    expect(SignalStatus.EXPIRED).toBe('EXPIRED');
    expect(SignalStatus.CANCELLED).toBe('CANCELLED');
  });
});

// ── Type guard and utility tests ───────────────────────────────────

describe('isValidTimeframe', () => {
  it('should return true for valid timeframes', () => {
    expect(isValidTimeframe('1m')).toBe(true);
    expect(isValidTimeframe('5m')).toBe(true);
    expect(isValidTimeframe('1H')).toBe(true);
    expect(isValidTimeframe('4H')).toBe(true);
    expect(isValidTimeframe('1D')).toBe(true);
    expect(isValidTimeframe('1W')).toBe(true);
    expect(isValidTimeframe('1M')).toBe(true);
  });

  it('should return false for invalid timeframes', () => {
    expect(isValidTimeframe('2m')).toBe(false);
    expect(isValidTimeframe('10m')).toBe(false);
    expect(isValidTimeframe('1h')).toBe(false); // lowercase h
    expect(isValidTimeframe('1Y')).toBe(false);
    expect(isValidTimeframe('')).toBe(false);
    expect(isValidTimeframe('invalid')).toBe(false);
  });
});

describe('formatPrice', () => {
  it('should format with 2 decimal places by default', () => {
    expect(formatPrice(42000.5)).toBe('42000.50');
  });

  it('should format with custom decimal places', () => {
    expect(formatPrice(42000.12346, 4)).toBe('42000.1235');
    expect(formatPrice(42000, 0)).toBe('42000');
  });

  it('should handle zero', () => {
    expect(formatPrice(0)).toBe('0.00');
  });
});

describe('formatPercent', () => {
  it('should add + prefix for positive values', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
  });

  it('should add - prefix for negative values', () => {
    expect(formatPercent(-3.2)).toBe('-3.20%');
  });

  it('should handle zero as positive', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });
});

describe('formatVolume', () => {
  it('should format billions with B suffix', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
  });

  it('should format millions with M suffix', () => {
    expect(formatVolume(2_500_000)).toBe('2.50M');
  });

  it('should format thousands with K suffix', () => {
    expect(formatVolume(42_500)).toBe('42.50K');
  });

  it('should format small numbers without suffix', () => {
    expect(formatVolume(500)).toBe('500.00');
  });

  it('should handle zero', () => {
    expect(formatVolume(0)).toBe('0.00');
  });
});

describe('generateId', () => {
  it('should return a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
