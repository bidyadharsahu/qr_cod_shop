// Gemini API Integration for conversational enhancement only
// Does NOT control ordering logic - only enhances conversation
// API calls go through backend to keep API key secure

export async function getGeminiResponse(
  userMessage: string, 
  context?: string,
  menuItems?: Array<{ id: number; name: string; available: boolean }>
): Promise<string> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        context,
        menuItems: menuItems?.filter(item => item.available)
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.statusText);
      return '';
    }

    const data = await response.json();
    return data.response || '';
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
