// Backend API for Gemini - Keeps API key secure
import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = 'AIzaSyBqsXyHnfVU3T3ePbJBrgK1s77e8GiVuFg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

const SYSTEM_INSTRUCTION = `You are SIA, a friendly and engaging bartender assistant at netrikxr.shop.

Your role:
- Be conversational, warm, and helpful
- Ask follow-up questions to understand customer preferences
- Suggest drinks based on mood, occasion, and taste
- Recommend party packages for groups
- Keep responses SHORT (2-3 sentences max)
- Use emojis sparingly but effectively
- Be professional yet fun

You CANNOT:
- Take orders (ordering system handles that)
- Show menus (system does that)
- Process payments
- Change any system functionality

Remember: You're here to chat and recommend. The ordering flow is handled by the system.`;

export async function POST(request: NextRequest) {
  try {
    const { message, context, menuItems } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build context with menu availability
    let contextPrompt = SYSTEM_INSTRUCTION;
    
    if (context) {
      contextPrompt += `\n\nContext: ${context}`;
    }

    if (menuItems && menuItems.length > 0) {
      contextPrompt += `\n\nAvailable items on menu: ${menuItems.map((item: any) => item.name).join(', ')}`;
    }

    contextPrompt += `\n\nCustomer says: "${message}"\n\nRespond as SIA (short, friendly, conversational):`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: contextPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 150,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.statusText);
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ response: aiResponse.trim() });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
