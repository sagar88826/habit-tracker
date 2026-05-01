import { describe, it, expect } from 'bun:test';
import {
  toUtcMidnight,
  toDateStr,
  getDayBounds,
  getWeekBounds,
  getMonthBounds,
  formatMoney,
} from '../../cli/utils/dateUtils';

describe('toUtcMidnight', () => {
  it('parses YYYY-MM-DD as UTC midnight', () => {
    const d = toUtcMidnight('2026-05-01');
    expect(d.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('handles end-of-month dates', () => {
    const d = toUtcMidnight('2026-01-31');
    expect(d.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('handles leap-day dates', () => {
    const d = toUtcMidnight('2024-02-29');
    expect(d.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

describe('toDateStr', () => {
  it('converts UTC date to YYYY-MM-DD', () => {
    expect(toDateStr(new Date('2026-05-01T00:00:00.000Z'))).toBe('2026-05-01');
  });

  it('pads month and day with leading zero', () => {
    expect(toDateStr(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-01-05');
  });

  it('round-trips with toUtcMidnight', () => {
    expect(toDateStr(toUtcMidnight('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('getDayBounds', () => {
  it('start is UTC midnight of the given day', () => {
    const { start } = getDayBounds('2026-05-01');
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('end is exactly 24 hours after start', () => {
    const { start, end } = getDayBounds('2026-05-01');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('end is UTC midnight of the next day', () => {
    const { end } = getDayBounds('2026-05-31');
    expect(end.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
});

describe('getWeekBounds', () => {
  // 2026-04-27 is a Monday
  it('Monday start: week containing Monday lands on that Monday', () => {
    const { start } = getWeekBounds(new Date('2026-04-27T00:00:00Z'), 1);
    expect(start.toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });

  it('Monday start: week containing Friday starts on previous Monday', () => {
    const { start } = getWeekBounds(new Date('2026-05-01T00:00:00Z'), 1);
    expect(start.toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });

  it('Monday start: end is exactly 7 days after start', () => {
    const { start, end } = getWeekBounds(new Date('2026-04-27T00:00:00Z'), 1);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('Sunday start: week containing Sunday lands on that Sunday', () => {
    // 2026-04-26 is a Sunday
    const { start } = getWeekBounds(new Date('2026-04-26T00:00:00Z'), 0);
    expect(start.toISOString()).toBe('2026-04-26T00:00:00.000Z');
  });

  it('Sunday start: week containing Saturday starts on previous Sunday', () => {
    // 2026-05-02 is a Saturday
    const { start } = getWeekBounds(new Date('2026-05-02T00:00:00Z'), 0);
    expect(start.toISOString()).toBe('2026-04-26T00:00:00.000Z');
  });
});

describe('getMonthBounds', () => {
  it('starts on the first of the given month', () => {
    const { start } = getMonthBounds(2026, 5);
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('end is the first of the following month', () => {
    const { end } = getMonthBounds(2026, 5);
    expect(end.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('handles December → January rollover', () => {
    const { end } = getMonthBounds(2026, 12);
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('handles February in a leap year (28 days in non-leap, 29 in leap)', () => {
    const { start, end } = getMonthBounds(2024, 2);
    const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(29);
  });
});

describe('formatMoney', () => {
  it('formats zero cents', () => {
    expect(formatMoney(0)).toBe('₹0.00');
  });

  it('formats whole dollars', () => {
    expect(formatMoney(500)).toBe('₹5.00');
  });

  it('formats cents with decimal', () => {
    expect(formatMoney(125)).toBe('₹1.25');
  });

  it('formats large amounts', () => {
    expect(formatMoney(100000)).toBe('₹1000.00');
  });
});
