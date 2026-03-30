import { NextResponse } from 'next/server';

export async function GET() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';

  return NextResponse.json({
    stripeConfigured,
    paypalConfigured,
    mode,
    anyProviderConfigured: stripeConfigured || paypalConfigured,
  });
}
