import { NextRequest, NextResponse } from 'next/server';

interface ChatHumanizeRequest {
  userMessage?: string;
  baseMessage?: string;
  intent?: string;
  chatMode?: 'friendly' | 'order';
  entities?: Record<string, unknown>;
  history?: Array<{
    role?: 'user' | 'assistant' | 'bot';
    content?: string;
  }>;
  restaurantName?: string;
  assistantName?: string;
  menuHighlights?: string[];
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

function buildRewritePrompt(payload: Required<Pick<ChatHumanizeRequest, 'userMessage' | 'baseMessage' | 'intent'>>): string {
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

function sanitizeHistory(history: ChatHumanizeRequest['history']) {
  if (!Array.isArray(history) || history.length === 0) return [];

  return history
    .map((entry) => {
      const role = entry?.role === 'user' ? 'user' : 'assistant';
      const content = (entry?.content || '').trim().slice(0, 320);
      return content ? { role, content } : null;
    })
    .filter((entry): entry is { role: 'user' | 'assistant'; content: string } => Boolean(entry))
    .slice(-8);
}

function buildConversationalPrompt(payload: {
  userMessage: string;
  baseMessage: string;
  intent: string;
  restaurantName: string;
  assistantName: string;
  menuHighlights: string[];
}) {
  return [
    'Generate the final assistant message for a restaurant chat app.',
    'The user should feel they are chatting with a warm human companion.',
    'Conversation rules:',
    '- Keep it natural, friendly, and emotionally aware.',
    '- You can do small talk like a good friend, then smoothly guide back to food when appropriate.',
    '- Use 1-3 emojis naturally when it fits the mood.',
    '- Do not rely on button/tap language; use natural conversational prompts and open-ended questions.',
    '- Never do romantic/sexual roleplay or intimacy.',
    '- Keep it concise and mobile-friendly (max 130 words).',
    '- Plain text only (no markdown, no JSON).',
    'Safety and ordering rules:',
    '- Do not invent prices, quantities, policy, or unavailable dishes.',
    '- If the deterministic response contains food facts, keep those facts accurate.',
    '- If user asks non-food topics, answer briefly then offer to help with menu/order.',
    `Assistant name: ${payload.assistantName}`,
    `Restaurant: ${payload.restaurantName}`,
    `Detected intent: ${payload.intent}`,
    `Deterministic fallback reply: ${payload.baseMessage}`,
    payload.menuHighlights.length > 0
      ? `Menu highlights you may reference (no price invention): ${payload.menuHighlights.join(', ')}`
      : 'Menu highlights unavailable.',
    `Latest user message: ${payload.userMessage}`,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  let baseMessage = '';

  try {
    const body = (await request.json()) as ChatHumanizeRequest;
    baseMessage = body.baseMessage?.trim() || '';
    const userMessage = body.userMessage?.trim() || '';
    const intent = body.intent?.trim() || 'UNKNOWN';

    if (!baseMessage && !userMessage) {
      return NextResponse.json({ message: '' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // No key configured: deterministic local chatbot remains source of truth.
      return NextResponse.json({ message: baseMessage || userMessage });
    }

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const requestedMode = body.chatMode === 'order' ? 'order' : 'friendly';
    const conversationalMode = requestedMode === 'friendly';
    const history = sanitizeHistory(body.history);
    const restaurantName = (body.restaurantName || 'the restaurant').trim() || 'the restaurant';
    const assistantName = (body.assistantName || 'SIA').trim() || 'SIA';
    const menuHighlights = Array.isArray(body.menuHighlights)
      ? body.menuHighlights.map(item => (item || '').trim()).filter(Boolean).slice(0, 10)
      : [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), conversationalMode ? 6500 : 4500);

    const userPrompt = conversationalMode
      ? buildConversationalPrompt({
          userMessage,
          baseMessage,
          intent,
          restaurantName,
          assistantName,
          menuHighlights,
        })
      : buildRewritePrompt({ userMessage, baseMessage, intent });

    const systemPrompt = conversationalMode
      ? 'You are a human-like restaurant chat companion. Be warm, concise, and emotionally intelligent. Support natural conversation and use occasional emojis naturally. Never do romantic or sexual roleplay. Keep factual menu/order details accurate.'
      : 'You rewrite a restaurant assistant response to be concise and efficient for quick ordering while preserving exact facts and actions. Keep wording clear, short, and non-robotic. Never add romantic or sexual roleplay.';

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
        temperature: conversationalMode ? 0.78 : 0.62,
        max_tokens: conversationalMode ? 280 : 220,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...history,
          {
            role: 'user',
            content: userPrompt,
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
      return NextResponse.json({ message: baseMessage || userMessage });
    }

    return NextResponse.json({ message: rewritten.slice(0, 800) });
  } catch {
    // Keep UX stable: if AI call or parsing fails, return the deterministic message.
    return NextResponse.json({ message: baseMessage || '' });
  }
}
