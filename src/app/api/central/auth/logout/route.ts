import { NextResponse } from 'next/server';
import { CENTRAL_ADMIN_COOKIE_NAME } from '@/lib/central-auth';

export async function POST() {
  const response = NextResponse.json({ authenticated: false });

  response.cookies.set({
    name: CENTRAL_ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
