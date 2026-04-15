import { NextRequest, NextResponse } from 'next/server';

interface ChatHumanizeRequest {
  userMessage?: string;
  baseMessage?: string;
  intent?: string;
  entities?: Record<string, unknown>;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-8b-instruct:free';

function buildPrompt(payload: Required<Pick<ChatHumanizeRequest, 'userMessage' | 'baseMessage' | 'intent'>>): string {
  return [
    'Rewrite the assistant reply to sound like a real human chatting live in a restaurant app.',
    'Style goals:',
    '- Conversational, emotionally aware, and naturally warm.',
    '- Sound like a real person at the table: attentive, clear, and calm.',
    '- Mirror the guest tone lightly (friendly, excited, confused, tired) without copying slang excessively.',
    '- Keep short, mobile-friendly lines and avoid robotic wording.',
    '- Use light friend-like energy when suitable (not formal, not stiff).',
    '- If the user makes small talk, answer briefly and then guide back to ordering.',
    '- Do not roleplay romance or intimacy; keep it respectful and service-focused.',
    'Hard rules:',
    '- Preserve ordering intent exactly. Do not change action meaning.',
    '- Do not invent dishes, prices, quantities, or policy.',
    '- Keep all factual details from the original response.',
    '- Keep all item names and numbers exactly the same as in the original response.',
    '- Do not add extra recommendations unless already present.',
    '- Do not claim to be an AI, bot, or non-human unless explicitly asked.',
    '- Be clear, short sentences, easy to scan on a phone screen.',
    '- If the user sounds confused, add one short clarifying line.',
    '- Keep it concise (max 120 words).',
    '- Return plain text only (no markdown, no JSON).',
    `User message: ${payload.userMessage}`,
    `Detected intent: ${payload.intent}`,
    `Original assistant response: ${payload.baseMessage}`,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  let baseMessage = '';

  try {
    const body = (await request.json()) as ChatHumanizeRequest;
    baseMessage = body.baseMessage?.trim() || '';

    if (!baseMessage) {
      return NextResponse.json({ message: '' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // No key configured: deterministic local chatbot remains source of truth.
      return NextResponse.json({ message: baseMessage });
    }

    const userMessage = body.userMessage?.trim() || '';
    const intent = body.intent?.trim() || 'UNKNOWN';
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const llmResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'netrikxr.shop SIA Chat Humanizer',
      },
      body: JSON.stringify({
        model,
        temperature: 0.62,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: 'You rewrite a restaurant assistant response so it feels like a real person chatting naturally while preserving exact facts and actions. Keep empathy high, wording simple, and responses concise for mobile. Never add romantic or sexual roleplay.',
          },
          {
            role: 'user',
            content: buildPrompt({ userMessage, baseMessage, intent }),
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!llmResponse.ok) {
      return NextResponse.json({ message: baseMessage });
    }

    const data = (await llmResponse.json()) as OpenRouterResponse;
    const rewritten = data.choices?.[0]?.message?.content?.trim();

    if (!rewritten) {
      return NextResponse.json({ message: baseMessage });
    }

    return NextResponse.json({ message: rewritten.slice(0, 800) });
  } catch {
    // Keep UX stable: if AI call or parsing fails, return the deterministic message.
    return NextResponse.json({ message: baseMessage || '' });
  }
}
