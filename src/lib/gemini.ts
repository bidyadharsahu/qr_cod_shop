// Gemini API Integration for conversational enhancement only
// Does NOT control ordering logic - only enhances conversation

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

export async function getGeminiResponse(userMessage: string, context?: string): Promise<string> {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}\n\n${context ? `Context: ${context}\n\n` : ''}Customer says: "${userMessage}"\n\nRespond as SIA (short, friendly, conversational):`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
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
      return '';
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return aiResponse.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    return '';
  }
}

// Check if message needs AI enhancement
export function shouldUseGemini(message: string): boolean {
  const keywords = [
    'recommend', 'suggest', 'what should', 'which', 'help me choose',
    'opinion', 'think', 'advice', 'best', 'favorite', 'popular',
    'tell me about', 'explain', 'describe', 'what is', 'how is'
  ];
  
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}
