import { isAuthFailure, isQuotaExceeded, nextPacificQuotaReset } from './quota';

describe('quota helpers', () => {
  it('detects quotaExceeded from Google error shape', () => {
    expect(isQuotaExceeded({ code: 403, errors: [{ reason: 'quotaExceeded' }] })).toBe(true);
    expect(isQuotaExceeded(new Error('403 quotaExceeded'))).toBe(true);
    expect(isQuotaExceeded(new Error('AUTH_FAILED'))).toBe(false);
  });

  it('detects auth failures', () => {
    expect(isAuthFailure({ code: 401 })).toBe(true);
    expect(isAuthFailure(new Error('invalid_grant'))).toBe(true);
    expect(isAuthFailure({ code: 403, errors: [{ reason: 'quotaExceeded' }] })).toBe(false);
  });

  it('schedules the next Pacific midnight after now', () => {
    const now = new Date('2026-08-19T15:00:00Z');
    const next = nextPacificQuotaReset(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(next);
    expect(hour).toBe('00');
  });
});
