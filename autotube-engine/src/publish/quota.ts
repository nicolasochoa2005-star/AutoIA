export function isQuotaExceeded(error: unknown): boolean {
  const record = error as {
    code?: number;
    status?: number;
    errors?: { reason?: string }[];
    response?: { data?: { error?: { errors?: { reason?: string }[]; message?: string } } };
  };
  if (record?.errors?.some((item) => item.reason === 'quotaExceeded')) {
    return true;
  }
  const nested = record?.response?.data?.error?.errors;
  if (nested?.some((item) => item.reason === 'quotaExceeded')) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /quotaExceeded/i.test(message);
}

export function isAuthFailure(error: unknown): boolean {
  const record = error as { code?: number; status?: number };
  const code = record.code ?? record.status;
  if (code === 401) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|unauthorized|UNAUTHENTICATED/i.test(message);
}

export function nextPacificQuotaReset(now = new Date()): Date {
  const tz = 'America/Los_Angeles';
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = dateFmt.format(now);

  for (let delta = 60_000; delta <= 36 * 3600_000; delta += 60_000) {
    const candidate = new Date(now.getTime() + delta);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(candidate);
    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    if (hour === '00' && minute === '00' && dateFmt.format(candidate) !== today) {
      return candidate;
    }
  }

  return new Date(now.getTime() + 24 * 3600_000);
}
