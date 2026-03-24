/**
 * throttle utility — unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '@/utils/throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call function immediately', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls function after the delay', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('uses the latest arguments when multiple calls in same window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    throttled('c');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('does not fire again if no new calls after first window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows a new call after the window resets', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    throttled('b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('passes multiple arguments correctly', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled(1, 'two', { three: 3 });
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith(1, 'two', { three: 3 });
  });

  it('respects the delay parameter', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 500);
    throttled('a');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
