import { NextRequest, NextResponse } from 'next/server';
import { readCentralAdminSession } from '@/lib/central-auth';

export async function GET(req: NextRequest) {
  const session = readCentralAdminSession(req);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    username: session.username,
    expiresAt: session.expiresAt,
  });
}
