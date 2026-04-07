import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

export const CENTRAL_ADMIN_COOKIE_NAME = 'central_admin_session';
export const CENTRAL_ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

export interface CentralAdminSession {
  username: string;
  role: 'super_admin';
  expiresAt: number;
}

function safeTextCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function safeHexCompare(leftHex: string, rightHex: string): boolean {
  try {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');

    if (left.length !== right.length) {
      return false;
    }

    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getCentralAdminCredentials(): { username: string; password: string } | null {
  const configuredUsername = process.env.CENTRAL_ADMIN_USERNAME?.trim();
  const configuredPassword = process.env.CENTRAL_ADMIN_PASSWORD;

  if (configuredUsername && configuredPassword) {
    return {
      username: configuredUsername,
      password: configuredPassword,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      username: (process.env.NEXT_PUBLIC_CENTRAL_ADMIN_USERNAME || 'owner').trim(),
      password: process.env.NEXT_PUBLIC_CENTRAL_ADMIN_PASSWORD || 'owner123',
    };
  }

  return null;
}

function getSessionSecret(): string | null {
  const configured = process.env.CENTRAL_ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV !== 'production') {
    return 'local-central-admin-session-secret-change-me';
  }

  return null;
}

function signSessionPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export function verifyCentralAdminCredentials(
  username: string,
  password: string,
): { ok: true; username: string } | { ok: false; reason: 'not_configured' | 'invalid_credentials' } {
  const credentials = getCentralAdminCredentials();
  if (!credentials) {
    return { ok: false, reason: 'not_configured' };
  }

  const normalizedUsername = username.trim();
  if (
    !safeTextCompare(normalizedUsername, credentials.username)
    || !safeTextCompare(password, credentials.password)
  ) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  return { ok: true, username: normalizedUsername };
}

export function createCentralAdminSessionToken(username: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payloadObject = {
    username,
    role: 'super_admin' as const,
    expiresAt: Date.now() + (CENTRAL_ADMIN_COOKIE_MAX_AGE * 1000),
  };

  const payload = Buffer.from(JSON.stringify(payloadObject)).toString('base64url');
  const signature = signSessionPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function readCentralAdminSession(req: NextRequest): CentralAdminSession | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const token = req.cookies.get(CENTRAL_ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = signSessionPayload(payload, secret);
  if (!safeHexCompare(expectedSignature, signature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      username?: unknown;
      role?: unknown;
      expiresAt?: unknown;
    };

    if (decoded.role !== 'super_admin') return null;
    if (typeof decoded.username !== 'string' || !decoded.username.trim()) return null;
    if (typeof decoded.expiresAt !== 'number' || decoded.expiresAt <= Date.now()) return null;

    return {
      username: decoded.username,
      role: 'super_admin',
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
}
