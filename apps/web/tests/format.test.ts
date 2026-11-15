import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, formatTime, formatTotal, greeting, pluralize, relativeTime } from '../src/lib/format';

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3723)).toBe('1:02:03');
  });
  it('guards against NaN, Infinity and negatives (unknown durations)', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('formatTotal', () => {
  it('uses minutes under an hour, then hours', () => {
    expect(formatTotal(29)).toBe('0 min');
    expect(formatTotal(42 * 60)).toBe('42 min');
    expect(formatTotal(3600 + 5 * 60)).toBe('1 h 05');
  });
});

describe('pluralize', () => {
  it('keeps the singular for 0 and 1 (French rule)', () => {
    expect(pluralize(0, 'titre')).toBe('0 titre');
    expect(pluralize(1, 'titre')).toBe('1 titre');
    expect(pluralize(2, 'titre')).toBe('2 titres');
    expect(pluralize(3, 'travail', 'travaux')).toBe('3 travaux');
  });
});

describe('greeting', () => {
  const at = (h: number) => new Date(2026, 0, 1, h);
  it('follows the time of day', () => {
    expect(greeting(at(2))).toBe('Bonne nuit');
    expect(greeting(at(9))).toBe('Bonjour');
    expect(greeting(at(14))).toBe('Bon après-midi');
    expect(greeting(at(21))).toBe('Bonsoir');
  });
});

describe('relativeTime', () => {
  afterEach(() => vi.useRealTimers());
  it('describes recent dates relative to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    expect(relativeTime('2026-11-15T11:59:30Z')).toBe("à l'instant");
    expect(relativeTime('2026-11-15T11:45:00Z')).toBe('il y a 15 min');
    expect(relativeTime('2026-11-15T09:00:00Z')).toBe('il y a 3 h');
    expect(relativeTime('2026-11-13T12:00:00Z')).toBe('il y a 2 j');
    expect(relativeTime('2026-10-01T12:00:00Z')).toMatch(/1 oct/);
  });
});

describe('cn', () => {
  it('joins truthy class names only', () => expect(cn('a', false, null, undefined, 'b')).toBe('a b'));
});
