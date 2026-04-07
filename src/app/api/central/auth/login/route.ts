import { NextRequest, NextResponse } from 'next/server';
import {
  CENTRAL_ADMIN_COOKIE_MAX_AGE,
  CENTRAL_ADMIN_COOKIE_NAME,
  createCentralAdminSessionToken,
  verifyCentralAdminCredentials,
} from '@/lib/central-auth';

interface LoginRequestBody {
  username?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  let body: LoginRequestBody;
  try {
    body = await req.json() as LoginRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const credentialCheck = verifyCentralAdminCredentials(username, password);

  if (!credentialCheck.ok) {
    if (credentialCheck.reason === 'not_configured') {
      return NextResponse.json({
        error: 'Central admin credentials are not configured on the server.',
      }, { status: 503 });
    }

    return NextResponse.json({ error: 'Invalid central admin credentials.' }, { status: 401 });
  }

  const sessionToken = createCentralAdminSessionToken(credentialCheck.username);
  if (!sessionToken) {
    return NextResponse.json({
      error: 'Central admin session secret is not configured.',
    }, { status: 503 });
  }

  const response = NextResponse.json({
    authenticated: true,
    role: 'super_admin',
    username: credentialCheck.username,
  });

  response.cookies.set({
    name: CENTRAL_ADMIN_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CENTRAL_ADMIN_COOKIE_MAX_AGE,
  });

  return response;
}
