// ============================================
// CUSTOM BARTENDER CHATBOT ENGINE
// ============================================
// Rule-based intelligent chatbot with natural conversation
// No external AI dependencies - pure intent detection
// ============================================

import type { MenuItem } from './types';

// Intent types for the chatbot
export type Intent = 
  | 'GREETING'
  | 'VIEW_MENU'
  | 'VIEW_CATEGORY'
  | 'ORDER_ITEM'
  | 'MODIFY_QUANTITY'
  | 'REMOVE_ITEM'
  | 'VIEW_CART'
  | 'ADD_TIP'
  | 'CHECK_PRICE'
  | 'RECOMMEND'
  | 'PARTY_ORDER'
  | 'PLACE_ORDER'
  | 'CANCEL_ORDER'
  | 'THANK_YOU'
  | 'HELP'
  | 'OUT_OF_STOCK'
  | 'UNKNOWN';

// Entity extraction result
export interface ExtractedEntities {
  itemName?: string;
  quantity?: number;
  category?: string;
  tipAmount?: number;
  tipPercent?: number;
  preference?: string; // ice, neat, double, etc.
  action?: 'add' | 'remove' | 'modify';
}

// Chatbot response
export interface ChatbotResponse {
  intent: Intent;
  message: string;
  entities: ExtractedEntities;
  action?: 'show_menu' | 'show_cart' | 'show_tip' | 'checkout' | 'show_category';
  matchedItem?: MenuItem;
  suggestedItems?: MenuItem[];
}

// Response templates with variations for natural feel
const RESPONSE_TEMPLATES: Record<string, string[]> = {
  GREETING: [
    "Hey there! 🍹 What can I get you tonight?",
    "Welcome! I'm SIA. Ready for something refreshing?",
    "Hi! Drinks or food today?",
    "Hey! 👋 Great to see you. What sounds good?",
    "Hello! What are we drinking tonight?"
  ],
  VIEW_MENU: [
    "Here's our full menu 👇",
    "Take a look at what we've got!",
    "Check out our selection 🍹",
    "Here's everything we have today!"
  ],
  VIEW_CART: [
    "Here's what you've got so far:",
    "Your current order:",
    "Let me check your cart 🛒"
  ],
  CART_EMPTY: [
    "Your cart is empty! Let's fix that 😄",
    "Nothing in your cart yet! What can I get you?",
    "Cart's looking empty! What sounds good?"
  ],
  ITEM_ADDED: [
    "Got it 👍",
    "Done!",
    "Nice choice!",
    "Adding that now 🍹",
    "Coming right up!",
    "Great pick! 🔥",
    "You got it!"
  ],
  ITEM_UNAVAILABLE: [
    "Ahh 😔 That one's currently unavailable. Would you like me to suggest something similar?",
    "Sorry, we're out of that right now. Can I recommend something else?",
    "That's not available at the moment 😔 Try something else?"
  ],
  QUANTITY_CONFIRM: [
    "Perfect 👍",
    "Done!",
    "Updated!",
    "You got it!"
  ],
  REMOVE_CONFIRM: [
    "Removed 👍",
    "Done, took that off.",
    "Got it, removed!"
  ],
  TIP_THANKS: [
    "Thank you! 💛 Adding that tip.",
    "You're awesome! 🙏 Tip added.",
    "Thanks so much! 💛"
  ],
  CHECKOUT_CONFIRM: [
    "Perfect 👍 Sending your order to the manager.",
    "Nice! I've sent your order to the manager 👍",
    "Order sent! Please wait for confirmation.",
    "Got it! Your order is on its way to the staff."
  ],
  RECOMMEND: [
    "Great question! Here's what's popular tonight:",
    "Ooo let me think... 🤔 How about:",
    "I'd recommend:",
    "People are loving these tonight:"
  ],
  PARTY: [
    "Nice! 🎉 Are you planning drinks only or food too?",
    "Party time! 🎊 How many people?",
    "Let's get this party started! What's the vibe?"
  ],
  PRICE_CHECK: [
    "Let me check that for you:",
    "Here's the price:",
    "That one costs:"
  ],
  THANK_YOU: [
    "You're welcome! 😊 Anything else?",
    "Happy to help! Need anything else?",
    "No problem! Let me know if you need more."
  ],
  CANCEL: [
    "No worries, cleared that for you!",
    "Done, all cleared!",
    "Cart cleared 👍"
  ],
  HELP: [
    "I'm here to help! Just tell me what you'd like to drink or eat, and I'll add it to your cart.",
    "No worries! Just say what you want - like 'I want a beer' or 'show menu'.",
    "Easy! Just tell me what sounds good, or say 'menu' to see options."
  ],
  FALLBACK: [
    "I didn't quite catch that. Want to see the menu?",
    "Hmm, not sure what you mean. Try 'show menu' or tell me what you'd like!",
    "Let me help you out - try saying 'menu' or tell me what you're craving!"
  ],
  ASK_QUANTITY: [
    "How many?",
    "Just one or more?",
    "How many would you like?"
  ],
  ASK_MORE: [
    "Want anything else?",
    "Anything else I can get you?",
    "What else sounds good?"
  ],
  CATEGORY_BEER: [
    "A beer lover! 🍺 Great choice. Here's what we've got:",
    "Nice! 🍺 Check out our beers:",
    "Beer it is! Here's our selection:"
  ],
  CATEGORY_COCKTAIL: [
    "Cocktails - my specialty! 🍸 Here's what we make:",
    "Great taste! 🍹 Our cocktails menu:",
    "Ooo cocktails! Here are our signatures:"
  ],
  CATEGORY_WHISKEY: [
    "A person of fine taste! 🥃 Here's our whiskey collection:",
    "Going for the good stuff! 🥃",
    "Excellent choice! Here's what we have:"
  ],
  CATEGORY_VODKA: [
    "Vodka coming up! Here's our selection:",
    "Nice! Here's our vodka menu:"
  ],
  CATEGORY_WINE: [
    "Wine it is! 🍷 Red, white, or rosé?",
    "Classy choice! 🍷 Here's our wine list:"
  ],
  CATEGORY_FOOD: [
    "Hungry? 🍗 Here's our food menu:",
    "Food menu coming up! 🍟",
    "Let's see what we've got to eat:"
  ],
  STRONG_DRINK: [
    "Going strong! 🥃 I like your style. Here are some powerful options:",
    "Something with a kick! Let me show you:"
  ],
  REFRESHING_DRINK: [
    "Something refreshing! 🧊 Perfect choice:",
    "Cool and refreshing - got it! How about:"
  ],
  SWEET_DRINK: [
    "Sweet drinks! 🍓 You'll love these:",
    "Something sweet coming up!"
  ],
  CHEAP_OPTION: [
    "On a budget? No problem! Here are our best value picks:",
    "Smart choice! Here are affordable options:"
  ],
  PREMIUM_OPTION: [
    "Going premium! 🌟 Our top shelf picks:",
    "The good stuff! Here's our premium selection:"
  ]
};

// Keyword patterns for intent detection
const INTENT_PATTERNS: Record<Intent, string[][]> = {
  GREETING: [
    ['hi'], ['hello'], ['hey'], ["what's up"], ['sup'], ['yo'], 
    ['good morning'], ['good evening'], ['good afternoon'], ['anyone there']
  ],
  VIEW_MENU: [
    ['show', 'menu'], ['see', 'menu'], ['menu'], ['what do you have'],
    ["what's available"], ['show me'], ['see drinks'], ['see food'],
    ['drinks menu'], ['food menu'], ['full menu']
  ],
  VIEW_CATEGORY: [
    ['beer'], ['beers'], ['vodka'], ['whiskey'], ['whisky'], ['bourbon'],
    ['scotch'], ['rum'], ['tequila'], ['cocktail'], ['cocktails'],
    ['wine'], ['wines'], ['shots'], ['shot'], ['juice'], ['soda'],
    ['water'], ['non-alcohol'], ['mocktail'], ['food'], ['snacks'],
    ['fries'], ['wings'], ['pizza'], ['tacos']
  ],
  ORDER_ITEM: [
    ['i want'], ['i need'], ['give me'], ['get me'], ["i'll have"],
    ["i'll take"], ['add'], ['order'], ['one'], ['two'], ['three'],
    ['double'], ['single'], ['make it'], ['please']
  ],
  MODIFY_QUANTITY: [
    ['make it'], ['change to'], ['add one more'], ['one more'],
    ['another'], ['increase'], ['add more'], ['extra']
  ],
  REMOVE_ITEM: [
    ['remove'], ['delete'], ['take off'], ['cancel that'],
    ['don\'t want'], ['no more'], ['minus']
  ],
  VIEW_CART: [
    ['cart'], ['my order'], ['what did i order'], ['show cart'],
    ['view cart'], ['my items'], ['basket']
  ],
  ADD_TIP: [
    ['tip'], ['add tip'], ['$'], ['percent tip'], ['% tip']
  ],
  CHECK_PRICE: [
    ['price'], ['how much'], ['cost'], ['what\'s the price'],
    ['cheapest'], ['expensive'], ['affordable'], ['budget']
  ],
  RECOMMEND: [
    ['recommend'], ['suggest'], ['what\'s good'], ['what\'s popular'],
    ['best'], ['favorite'], ['popular'], ['special'], ['signature'],
    ['what should i'], ['help me choose'], ['something good']
  ],
  PARTY_ORDER: [
    ['party'], ['group'], ['celebration'], ['birthday'], ['friends'],
    ['people'], ['we are'], ['for us']
  ],
  PLACE_ORDER: [
    ['place order'], ['checkout'], ['confirm'], ['send order'],
    ['done ordering'], ['that\'s all'], ["i'm done"], ['finish']
  ],
  CANCEL_ORDER: [
    ['cancel'], ['clear cart'], ['remove all'], ['forget it'],
    ['start over'], ['nevermind'], ['clear']
  ],
  THANK_YOU: [
    ['thank'], ['thanks'], ['awesome'], ['great'], ['perfect'],
    ['amazing'], ['wonderful'], ['appreciate']
  ],
  HELP: [
    ['help'], ['how do'], ['how does'], ['confused'], ['what can you'],
    ['instructions']
  ],
  OUT_OF_STOCK: [], // System triggered
  UNKNOWN: []
};

// Preference keywords
const PREFERENCE_KEYWORDS: Record<string, string[]> = {
  ice: ['ice', 'iced', 'cold', 'chilled', 'on the rocks'],
  neat: ['neat', 'straight', 'no ice', 'plain'],
  double: ['double', 'large', 'big'],
  single: ['single', 'small', 'regular'],
  spicy: ['spicy', 'hot', 'extra spice'],
  strong: ['strong', 'powerful', 'kick', 'boozy'],
  sweet: ['sweet', 'sugary'],
  refreshing: ['refreshing', 'cool', 'light', 'fresh'],
  sour: ['sour', 'tangy', 'citrus']
};

// Quantity words to numbers
const QUANTITY_WORDS: Record<string, number> = {
  one: 1, a: 1, an: 1, single: 1,
  two: 2, couple: 2, pair: 2, double: 2,
  three: 3, few: 3,
  four: 4,
  five: 5,
  six: 6
};

// Category mappings
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  beer: ['beer', 'beers', 'brew', 'ale', 'lager', 'ipa', 'stout'],
  vodka: ['vodka'],
  whiskey: ['whiskey', 'whisky', 'bourbon', 'scotch'],
  rum: ['rum'],
  tequila: ['tequila'],
  cocktail: ['cocktail', 'cocktails', 'mixed', 'mojito', 'margarita', 'martini'],
  wine: ['wine', 'wines', 'red wine', 'white wine', 'rosé'],
  shots: ['shot', 'shots'],
  food: ['food', 'eat', 'snacks', 'hungry', 'fries', 'wings', 'pizza', 'tacos', 'chicken']
};

// Get random response from template
function getRandomResponse(key: string): string {
  const templates = RESPONSE_TEMPLATES[key];
  if (!templates || templates.length === 0) {
    return RESPONSE_TEMPLATES.FALLBACK[0];
  }
  return templates[Math.floor(Math.random() * templates.length)];
}

// Normalize message for processing
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .trim()
    .replace(/[^\w\s$%]/g, ' ')
    .replace(/\s+/g, ' ');
}

// Detect intent from message
function detectIntent(normalized: string, menuItems: MenuItem[]): Intent {
  const words = normalized.split(' ');
  
  // Score each intent
  const scores: Record<Intent, number> = {} as Record<Intent, number>;
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intent as Intent] = 0;
    
    for (const pattern of patterns) {
      const patternMatched = pattern.every(keyword => 
        normalized.includes(keyword)
      );
      if (patternMatched) {
        scores[intent as Intent] += pattern.length * 2; // Longer patterns score higher
      }
      
      // Also check individual keywords
      for (const keyword of pattern) {
        if (normalized.includes(keyword)) {
          scores[intent as Intent] += 1;
        }
      }
    }
  }
  
  // Check if any menu item is mentioned (ORDER_ITEM boost)
  for (const item of menuItems) {
    const itemNameLower = item.name.toLowerCase();
    if (normalized.includes(itemNameLower) || 
        words.some(w => itemNameLower.includes(w) && w.length > 3)) {
      scores.ORDER_ITEM += 10;
      break;
    }
  }
  
  // Find highest scoring intent
  let maxScore = 0;
  let detectedIntent: Intent = 'UNKNOWN';
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedIntent = intent as Intent;
    }
  }
  
  // Minimum threshold
  if (maxScore < 2) {
    detectedIntent = 'UNKNOWN';
  }
  
  return detectedIntent;
}

// Extract entities from message
function extractEntities(normalized: string, menuItems: MenuItem[]): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const words = normalized.split(' ');
  
  // Extract quantity
  for (const word of words) {
    if (QUANTITY_WORDS[word]) {
      entities.quantity = QUANTITY_WORDS[word];
      break;
    }
    // Check numeric
    const num = parseInt(word);
    if (!isNaN(num) && num > 0 && num <= 20) {
      entities.quantity = num;
      break;
    }
  }
  
  // Extract item name (match against menu)
  for (const item of menuItems) {
    const itemNameLower = item.name.toLowerCase();
    if (normalized.includes(itemNameLower)) {
      entities.itemName = item.name;
      break;
    }
    // Partial match (at least 4 characters)
    const itemWords = itemNameLower.split(' ');
    for (const itemWord of itemWords) {
      if (itemWord.length >= 4 && normalized.includes(itemWord)) {
        entities.itemName = item.name;
        break;
      }
    }
    if (entities.itemName) break;
  }
  
  // Extract category
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        entities.category = category;
        break;
      }
    }
    if (entities.category) break;
  }
  
  // Extract preferences
  for (const [pref, keywords] of Object.entries(PREFERENCE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        entities.preference = pref;
        break;
      }
    }
    if (entities.preference) break;
  }
  
  // Extract tip amount
  const tipMatch = normalized.match(/\$(\d+)/); // $5, $10, etc.
  if (tipMatch) {
    entities.tipAmount = parseInt(tipMatch[1]);
  }
  
  const tipPercentMatch = normalized.match(/(\d+)\s*%/);
  if (tipPercentMatch) {
    entities.tipPercent = parseInt(tipPercentMatch[1]);
  }
  
  // Extract action
  if (normalized.includes('remove') || normalized.includes('delete') || normalized.includes('cancel')) {
    entities.action = 'remove';
  } else if (normalized.includes('add') || normalized.includes('more') || normalized.includes('another')) {
    entities.action = 'add';
  } else if (normalized.includes('change') || normalized.includes('make it')) {
    entities.action = 'modify';
  }
  
  return entities;
}

// Find best matching menu item
function findMenuItem(itemName: string | undefined, menuItems: MenuItem[]): MenuItem | undefined {
  if (!itemName) return undefined;
  
  const nameLower = itemName.toLowerCase();
  
  // Exact match
  let match = menuItems.find(i => i.name.toLowerCase() === nameLower);
  if (match) return match;
  
  // Partial match
  match = menuItems.find(i => i.name.toLowerCase().includes(nameLower));
  if (match) return match;
  
  // Word match
  const words = nameLower.split(' ');
  for (const word of words) {
    if (word.length >= 4) {
      match = menuItems.find(i => i.name.toLowerCase().includes(word));
      if (match) return match;
    }
  }
  
  return undefined;
}

// Get items by category
function getItemsByCategory(category: string, menuItems: MenuItem[]): MenuItem[] {
  const keywords = CATEGORY_KEYWORDS[category] || [category];
  
  return menuItems.filter(item => {
    const itemLower = item.name.toLowerCase();
    const catLower = item.category.toLowerCase();
    
    return keywords.some(kw => 
      itemLower.includes(kw) || catLower.includes(kw)
    );
  });
}

// Get suggestions based on preference
function getSuggestions(preference: string | undefined, menuItems: MenuItem[]): MenuItem[] {
  if (!preference) {
    // Return random popular items
    return menuItems.slice(0, 3);
  }
  
  // Filter by preference (this is simplified - could be enhanced)
  let filtered = menuItems;
  
  switch (preference) {
    case 'strong':
      filtered = menuItems.filter(i => 
        i.category.toLowerCase().includes('whiskey') ||
        i.category.toLowerCase().includes('vodka') ||
        i.category.toLowerCase().includes('rum') ||
        i.name.toLowerCase().includes('double')
      );
      break;
    case 'refreshing':
    case 'cold':
      filtered = menuItems.filter(i =>
        i.category.toLowerCase().includes('beer') ||
        i.category.toLowerCase().includes('cocktail') ||
        i.name.toLowerCase().includes('mojito') ||
        i.name.toLowerCase().includes('margarita')
      );
      break;
    case 'sweet':
      filtered = menuItems.filter(i =>
        i.category.toLowerCase().includes('cocktail') ||
        i.name.toLowerCase().includes('sweet') ||
        i.name.toLowerCase().includes('strawberry')
      );
      break;
  }
  
  return filtered.length > 0 ? filtered.slice(0, 3) : menuItems.slice(0, 3);
}

// Main chatbot process function
export function processChatMessage(
  message: string,
  menuItems: MenuItem[],
  cart: Array<{ id: number; name: string; quantity: number }>,
  context?: { lastIntent?: Intent; awaitingQuantity?: string }
): ChatbotResponse {
  const normalized = normalizeMessage(message);
  const intent = detectIntent(normalized, menuItems);
  const entities = extractEntities(normalized, menuItems);
  
  let responseMessage = '';
  let action: ChatbotResponse['action'] = undefined;
  let matchedItem: MenuItem | undefined = undefined;
  let suggestedItems: MenuItem[] | undefined = undefined;
  
  // Handle based on intent
  switch (intent) {
    case 'GREETING':
      responseMessage = getRandomResponse('GREETING');
      break;
      
    case 'VIEW_MENU':
      responseMessage = getRandomResponse('VIEW_MENU');
      action = 'show_menu';
      break;
      
    case 'VIEW_CATEGORY':
      if (entities.category) {
        const categoryItems = getItemsByCategory(entities.category, menuItems);
        if (categoryItems.length > 0) {
          const categoryKey = `CATEGORY_${entities.category.toUpperCase()}`;
          responseMessage = RESPONSE_TEMPLATES[categoryKey]?.[0] || 
            `Here's our ${entities.category} selection:`;
          suggestedItems = categoryItems;
          action = 'show_menu';
        } else {
          responseMessage = getRandomResponse('VIEW_MENU');
          action = 'show_menu';
        }
      } else {
        responseMessage = getRandomResponse('VIEW_MENU');
        action = 'show_menu';
      }
      break;
      
    case 'ORDER_ITEM':
      matchedItem = findMenuItem(entities.itemName, menuItems);
      
      if (matchedItem) {
        if (!matchedItem.available) {
          responseMessage = getRandomResponse('ITEM_UNAVAILABLE');
          suggestedItems = getSuggestions(entities.category, menuItems.filter(i => i.available));
        } else {
          const qty = entities.quantity || 1;
          const prefText = entities.preference ? ` with ${entities.preference}` : '';
          responseMessage = `${getRandomResponse('ITEM_ADDED')} Adding ${qty} ${matchedItem.name}${prefText} to your cart.\n\n${getRandomResponse('ASK_MORE')}`;
        }
      } else if (entities.category) {
        // Show category menu
        responseMessage = `Let me show you our ${entities.category} options:`;
        action = 'show_menu';
      } else {
        // Couldn't find item
        responseMessage = "I didn't find that on our menu. Let me show you what we've got:";
        action = 'show_menu';
      }
      break;
      
    case 'MODIFY_QUANTITY':
      if (entities.quantity) {
        responseMessage = `${getRandomResponse('QUANTITY_CONFIRM')} Changed to ${entities.quantity}.`;
      } else {
        responseMessage = "How many would you like?";
      }
      break;
      
    case 'REMOVE_ITEM':
      responseMessage = getRandomResponse('REMOVE_CONFIRM');
      break;
      
    case 'VIEW_CART':
      if (cart.length === 0) {
        responseMessage = getRandomResponse('CART_EMPTY');
        action = 'show_menu';
      } else {
        responseMessage = getRandomResponse('VIEW_CART');
        action = 'show_cart';
      }
      break;
      
    case 'ADD_TIP':
      if (entities.tipAmount || entities.tipPercent) {
        const tipText = entities.tipAmount ? `$${entities.tipAmount}` : `${entities.tipPercent}%`;
        responseMessage = `${getRandomResponse('TIP_THANKS')}\n\n${tipText} tip will be added to your bill.`;
      } else {
        responseMessage = "How much would you like to tip?";
        action = 'show_tip';
      }
      break;
      
    case 'CHECK_PRICE':
      if (entities.itemName) {
        matchedItem = findMenuItem(entities.itemName, menuItems);
        if (matchedItem) {
          responseMessage = `${matchedItem.name} is $${matchedItem.price.toFixed(2)}. Want me to add it?`;
        } else {
          responseMessage = "Let me show you our menu with prices:";
          action = 'show_menu';
        }
      } else if (normalized.includes('cheap') || normalized.includes('budget') || normalized.includes('affordable')) {
        const cheapest = [...menuItems].sort((a, b) => a.price - b.price).slice(0, 3);
        responseMessage = getRandomResponse('CHEAP_OPTION');
        suggestedItems = cheapest;
        action = 'show_menu';
      } else {
        responseMessage = "Here's our menu with all prices:";
        action = 'show_menu';
      }
      break;
      
    case 'RECOMMEND':
      if (entities.preference) {
        const prefKey = `${entities.preference.toUpperCase()}_DRINK`;
        responseMessage = RESPONSE_TEMPLATES[prefKey]?.[0] || getRandomResponse('RECOMMEND');
        suggestedItems = getSuggestions(entities.preference, menuItems.filter(i => i.available));
      } else {
        responseMessage = getRandomResponse('RECOMMEND');
        suggestedItems = getSuggestions(undefined, menuItems.filter(i => i.available));
      }
      action = 'show_menu';
      break;
      
    case 'PARTY_ORDER':
      responseMessage = getRandomResponse('PARTY');
      break;
      
    case 'PLACE_ORDER':
      if (cart.length === 0) {
        responseMessage = "Your cart is empty! Add some items first.";
        action = 'show_menu';
      } else {
        responseMessage = getRandomResponse('CHECKOUT_CONFIRM');
        action = 'checkout';
      }
      break;
      
    case 'CANCEL_ORDER':
      responseMessage = getRandomResponse('CANCEL');
      break;
      
    case 'THANK_YOU':
      responseMessage = getRandomResponse('THANK_YOU');
      break;
      
    case 'HELP':
      responseMessage = getRandomResponse('HELP');
      break;
      
    case 'UNKNOWN':
    default:
      // Try to be helpful even with unknown input
      if (entities.category) {
        responseMessage = `Let me show you our ${entities.category} options:`;
        action = 'show_menu';
      } else if (entities.preference) {
        responseMessage = `Looking for something ${entities.preference}? Check these out:`;
        suggestedItems = getSuggestions(entities.preference, menuItems);
        action = 'show_menu';
      } else {
        responseMessage = getRandomResponse('FALLBACK');
      }
      break;
  }
  
  return {
    intent,
    message: responseMessage,
    entities,
    action,
    matchedItem,
    suggestedItems
  };
}

// Format menu items for display
export function formatMenuForChat(items: MenuItem[], category?: string): string {
  const filtered = category 
    ? items.filter(i => i.category.toLowerCase().includes(category.toLowerCase()))
    : items;
  
  if (filtered.length === 0) return "No items available in this category.";
  
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  
  let result = '';
  for (const [cat, catItems] of Object.entries(grouped)) {
    result += `\n**${cat}**\n`;
    for (const item of catItems) {
      if (item.available) {
        result += `• ${item.name} – $${item.price.toFixed(2)}\n`;
      }
    }
  }
  
  return result.trim();
}

// Format cart for display
export function formatCartForChat(
  cart: Array<{ id: number; name: string; price: number; quantity: number }>,
  subtotal: number
): string {
  if (cart.length === 0) return "Your cart is empty!";
  
  let result = '\n';
  for (const item of cart) {
    result += `• ${item.quantity}x ${item.name} – $${(item.price * item.quantity).toFixed(2)}\n`;
  }
  result += `\n**Subtotal: $${subtotal.toFixed(2)}**`;
  
  return result;
}

// Format bill for display
export function formatBillForChat(
  cart: Array<{ id: number; name: string; price: number; quantity: number }>,
  receiptId: string,
  tableNumber: string,
  subtotal: number,
  tipAmount: number,
  taxAmount: number,
  total: number
): string {
  let result = `\n📄 **Bill**\n`;
  result += `Receipt: ${receiptId}\n`;
  result += `Table: ${tableNumber}\n\n`;
  
  for (const item of cart) {
    result += `${item.quantity}x ${item.name} – $${(item.price * item.quantity).toFixed(2)}\n`;
  }
  
  result += `\nSubtotal: $${subtotal.toFixed(2)}\n`;
  if (tipAmount > 0) {
    result += `Tip: $${tipAmount.toFixed(2)}\n`;
  }
  result += `Tax (3%): $${taxAmount.toFixed(2)}\n`;
  result += `**Total: $${total.toFixed(2)}**`;
  
  return result;
}
