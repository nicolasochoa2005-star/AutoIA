export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { readRunStatus } from '@/lib/manifest';
import { getLogs } from '@/lib/process-manager';

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const status = await readRunStatus(runId);
  if (req.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({ ...status, rawLogs: getLogs(runId) });
  }
  return NextResponse.json(status);
}
