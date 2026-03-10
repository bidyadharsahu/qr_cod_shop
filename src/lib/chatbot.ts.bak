// ============================================
// INTELLIGENT BARTENDER CHATBOT ENGINE - SIA
// Human-like conversation with intent detection
// ============================================

import type { MenuItem } from './types';

// ============================================
// TYPES
// ============================================
export interface ChatbotResponse {
  message: string;
  action?: 'show_menu' | 'show_cart' | 'checkout' | 'show_tip' | 'show_category' | 'add_item' | 'remove_item' | 'clear_cart';
  matchedItems?: { item: MenuItem; quantity: number; preference?: string }[];
  suggestedItems?: MenuItem[];
  category?: string;
  intent: string;
  entities: {
    quantity?: number;
    preference?: string;
    category?: string;
    tipAmount?: number;
    itemNames?: string[];
  };
}

interface CartItem {
  id: number;
  name: string;
  quantity: number;
}

// ============================================
// INTENT DEFINITIONS
// ============================================
type IntentType = 
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
  | 'UNKNOWN';

// ============================================
// KEYWORD PATTERNS
// ============================================
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  GREETING: ['hi', 'hello', 'hey', 'bro', 'boss', 'bartender', 'waiter', 'yo', 'whats up', "what's up", 'sup', 'hola', 'howdy', 'good morning', 'good evening', 'good afternoon'],
  VIEW_MENU: ['menu', 'show menu', 'what do you have', 'drinks menu', 'food menu', 'available items', 'what can i get', 'let me see', 'options', 'list', 'show me', 'whatcha got', 'what you got'],
  VIEW_CATEGORY: ['beer', 'beers', 'vodka', 'whiskey', 'whisky', 'rum', 'tequila', 'cocktail', 'cocktails', 'snacks', 'starters', 'food', 'combo', 'wine', 'shots', 'mocktail', 'juice', 'soft drink', 'soda'],
  ORDER_ITEM: ['i want', 'give me', 'add', 'include', 'get me', 'bring me', 'make it', 'take this', 'order', 'i need', 'can i have', 'ill have', "i'll have", 'i will have', 'one', 'two', 'three', 'pour me', 'serve me'],
  MODIFY_QUANTITY: ['more', 'extra', 'another', 'make it', 'increase', 'double', 'triple', 'add more', 'one more', 'two more'],
  REMOVE_ITEM: ['remove', 'delete', 'cancel item', 'take off', 'reduce', 'less', 'no more', 'dont want', "don't want", 'remove that', 'scratch that'],
  VIEW_CART: ['cart', 'show cart', 'what did i order', 'my order', 'total amount', 'my items', 'show order', 'what i got', 'current order', 'bill so far', 'check order'],
  ADD_TIP: ['tip', 'add tip', 'include tip', 'gratuity', '$5 tip', '$10 tip', '10%', '15%', '20%', '25%'],
  CHECK_PRICE: ['how much', 'price of', 'cost', 'cheapest', 'expensive', 'affordable', 'budget', 'pricing', 'rate', 'whats the price', "what's the price"],
  RECOMMEND: ['recommend', 'suggest', 'best drink', 'popular item', "what's good", 'whats good', 'special', 'favorite', 'must try', 'signature', 'top pick', 'what should i', 'help me choose', 'your best', 'something good'],
  PARTY_ORDER: ['we are', 'group of', 'party', 'combo offer', 'package', 'for us', 'celebrating', 'bunch of us', 'friends', 'birthday', 'celebration'],
  PLACE_ORDER: ['place order', 'checkout', 'confirm', "i'm done", 'im done', 'thats all', "that's all", 'done ordering', 'send order', 'submit', 'finish', 'complete order', 'ready to order'],
  CANCEL_ORDER: ['cancel order', 'clear cart', 'forget it', 'nevermind', 'never mind', 'start over', 'remove all', 'clear all', 'cancel everything', 'scratch everything'],
  THANK_YOU: ['thank', 'thanks', 'appreciate', 'awesome', 'great', 'perfect', 'nice', 'cool', 'cheers', 'wonderful'],
  HELP: ['help', 'how does this work', 'confused', 'what can you do', 'guide me', 'assist', 'support', 'how to order', 'instructions'],
  UNKNOWN: []
};

// ============================================
// QUANTITY PATTERNS
// ============================================
const QUANTITY_WORDS: Record<string, number> = {
  'one': 1, 'a': 1, 'an': 1, 'single': 1,
  'two': 2, 'couple': 2, 'pair': 2, 'double': 2,
  'three': 3, 'triple': 3,
  'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10
};

// ============================================
// PREFERENCE/CUSTOMIZATION PATTERNS
// ============================================
const PREFERENCE_PATTERNS = [
  { pattern: /with ice|on the rocks|iced|cold/i, value: 'with ice' },
  { pattern: /no ice|without ice|neat/i, value: 'neat' },
  { pattern: /chilled|frozen|extra cold/i, value: 'chilled' },
  { pattern: /spicy|hot|extra spicy/i, value: 'spicy' },
  { pattern: /less spicy|mild|not spicy/i, value: 'less spicy' },
  { pattern: /extra sauce|more sauce/i, value: 'extra sauce' },
  { pattern: /strong|extra strong|double shot/i, value: 'strong' },
  { pattern: /light|weak|easy/i, value: 'light' },
  { pattern: /crispy|extra crispy/i, value: 'crispy' },
  { pattern: /fresh|freshly made/i, value: 'fresh' }
];

// ============================================
// RESPONSE TEMPLATES (Randomized for natural feel)
// ============================================
const RESPONSES = {
  GREETING: [
    "Hey there! 🍹 What can I get you tonight?",
    "Welcome! I'm SIA, your bartender. What's your vibe today?",
    "Hey! 👋 Ready for something good?",
    "What's up! Drinks or food first?",
    "Yo! Let's get this party started 🎉 What'll it be?"
  ],
  VIEW_MENU: [
    "Here's what we've got! 👇 Tap any category or just tell me what you're feeling.",
    "Check out our menu! Everything's fresh 🔥",
    "Take a look! What catches your eye?"
  ],
  VIEW_CATEGORY: [
    "Nice choice! Here's what we've got in {category}:",
    "Good taste! Check out our {category} selection:",
    "{category} coming right up! Here's what's available:"
  ],
  ITEM_ADDED: [
    "Got it! 👍 {quantity}x {item} added.",
    "Nice choice! 🍹 Adding {quantity} {item}.",
    "Done! {quantity}x {item} in your cart.",
    "You got it! {quantity} {item} coming up.",
    "Perfect pick! 👌 {quantity}x {item} added."
  ],
  ITEM_ADDED_WITH_PREF: [
    "Got it! 👍 {quantity}x {item} ({preference}) added.",
    "Nice! {quantity} {item}, {preference} - done! 🍹",
    "You got it! {quantity}x {item} made {preference}."
  ],
  MULTIPLE_ITEMS_ADDED: [
    "Love it! 🔥 Added {items} to your order.",
    "Great combo! {items} - all added 👍",
    "You know what you want! {items} in the cart."
  ],
  ITEM_NOT_FOUND: [
    "Hmm, I don't think we have that one. Want to check the menu? 📋",
    "Can't find that 😅 Maybe try something similar?",
    "Not sure about that one. Let me show you what we've got!"
  ],
  ITEM_UNAVAILABLE: [
    "Ahh 😔 {item} is currently unavailable. Would you like something similar?",
    "Sorry! {item} just ran out. Can I suggest an alternative?",
    "Bad timing! We're out of {item}. Want me to recommend something else?"
  ],
  VIEW_CART: [
    "Here's your order so far:",
    "Let's see what you've got:",
    "Your current order:"
  ],
  CART_EMPTY: [
    "Your cart is empty! 😄 What can I get you?",
    "Nothing in the cart yet. Ready to order?",
    "Cart's empty! Let's fix that 🍹"
  ],
  RECOMMEND: [
    "Ooo, let me think... 🤔 Our {item} is really popular right now!",
    "You should definitely try the {item}! It's 🔥",
    "Can't go wrong with {item}! Customer favorite 👌"
  ],
  PARTY: [
    "Nice! 🎉 How many people are we serving?",
    "Party time! Tell me the group size and I'll suggest a combo.",
    "Let's set you up! Drinks only or food too?"
  ],
  CHECKOUT: [
    "Perfect! 👍 Sending your order to the manager now...",
    "Got it! Your order is on its way to confirmation.",
    "Alright! Submitting your order now ⏳"
  ],
  CANCEL: [
    "Cart cleared! 🗑️ Fresh start - what would you like?",
    "Done! Everything removed. Ready when you are.",
    "All cleared! Let's start over 👍"
  ],
  THANK_YOU: [
    "You're welcome! 😊 Need anything else?",
    "Anytime! 🍹 Just holler if you need more.",
    "Cheers! Enjoy! 🎉"
  ],
  HELP: [
    "No worries, I got you! 👇\n\n1️⃣ Browse menu or tell me what you want\n2️⃣ Add items to cart\n3️⃣ Place order & wait for confirmation\n4️⃣ Add tip & get your bill\n\nEasy! What would you like?",
  ],
  FOLLOWUP: [
    "Anything else to go with that?",
    "Want something else?",
    "What else can I get you?",
    "Need anything else?",
    "Add more?"
  ],
  UPSELL_FOOD: [
    "Want some snacks to go with that? 🍟",
    "How about some food to pair with your drinks?",
    "Fries or wings go great with that! 🍗"
  ],
  UPSELL_DRINKS: [
    "Want to add drinks too? 🍹",
    "How about something to drink with that?",
    "Pair it with a cocktail? 🍸"
  ],
  UNKNOWN: [
    "Sorry, didn't quite get that 😅 Try 'show menu' or tell me what you'd like!",
    "Hmm? Want to see the menu or just tell me what you're craving?",
    "Not sure what you mean. Menu, cart, or ordering something?"
  ],
  PRICE_CHECK: [
    "Let me check... {item} is ${price}",
    "{item} costs ${price} 💰",
    "That's ${price} for {item}"
  ],
  CHEAPEST: [
    "Looking for a deal? 💸 Our cheapest is {item} at ${price}!",
    "Budget-friendly option: {item} for just ${price}!"
  ]
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
}

function getRandomResponse(key: keyof typeof RESPONSES): string {
  const responses = RESPONSES[key];
  return responses[Math.floor(Math.random() * responses.length)];
}

function extractQuantity(text: string): number {
  const normalized = normalize(text);
  
  // Check for number patterns first
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num > 0 && num <= 20) return num;
  }
  
  // Check word patterns
  for (const [word, qty] of Object.entries(QUANTITY_WORDS)) {
    if (normalized.includes(word)) return qty;
  }
  
  return 1; // Default
}

function extractPreference(text: string): string | undefined {
  for (const { pattern, value } of PREFERENCE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

function detectIntent(text: string, menuItems: MenuItem[], cart: CartItem[]): IntentType {
  const normalized = normalize(text);
  const scores: Record<IntentType, number> = {} as Record<IntentType, number>;
  
  // Initialize scores
  for (const intent of Object.keys(INTENT_KEYWORDS) as IntentType[]) {
    scores[intent] = 0;
  }
  
  // Score each intent based on keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [IntentType, string[]][]) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        scores[intent] += keyword.length; // Longer matches = higher score
      }
    }
  }
  
  // Check if message contains any menu item names (ORDER_ITEM intent)
  for (const item of menuItems) {
    const itemNameLower = item.name.toLowerCase();
    if (normalized.includes(itemNameLower) || 
        itemNameLower.split(' ').some(word => normalized.includes(word) && word.length > 3)) {
      scores.ORDER_ITEM += 10; // Boost ORDER_ITEM if item name found
    }
  }
  
  // Find highest scoring intent
  let maxScore = 0;
  let bestIntent: IntentType = 'UNKNOWN';
  
  for (const [intent, score] of Object.entries(scores) as [IntentType, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }
  
  // If no strong match, check context
  if (maxScore < 2) {
    // Maybe user just typed an item name
    for (const item of menuItems) {
      if (normalized.includes(item.name.toLowerCase())) {
        return 'ORDER_ITEM';
      }
    }
    return 'UNKNOWN';
  }
  
  return bestIntent;
}

function findMatchingItems(text: string, menuItems: MenuItem[]): { item: MenuItem; quantity: number; preference?: string }[] {
  const normalized = normalize(text);
  const matches: { item: MenuItem; quantity: number; preference?: string }[] = [];
  const quantity = extractQuantity(text);
  const preference = extractPreference(text);
  
  // Sort menu items by name length (longer first) to match more specific items first
  const sortedItems = [...menuItems].sort((a, b) => b.name.length - a.name.length);
  
  for (const item of sortedItems) {
    const itemNameLower = item.name.toLowerCase();
    const itemWords = itemNameLower.split(' ').filter(w => w.length > 2);
    
    // Check full name match
    if (normalized.includes(itemNameLower)) {
      matches.push({ item, quantity, preference });
      continue;
    }
    
    // Check partial word match (at least one significant word)
    for (const word of itemWords) {
      if (word.length > 3 && normalized.includes(word)) {
        // Avoid duplicates
        if (!matches.find(m => m.item.id === item.id)) {
          matches.push({ item, quantity, preference });
        }
        break;
      }
    }
  }
  
  return matches;
}

function findCheapestItem(menuItems: MenuItem[]): MenuItem | null {
  if (menuItems.length === 0) return null;
  return menuItems.reduce((min, item) => item.price < min.price ? item : min, menuItems[0]);
}

function findMostExpensive(menuItems: MenuItem[]): MenuItem | null {
  if (menuItems.length === 0) return null;
  return menuItems.reduce((max, item) => item.price > max.price ? item : max, menuItems[0]);
}

function findItemsByCategory(menuItems: MenuItem[], category: string): MenuItem[] {
  const normalizedCat = category.toLowerCase();
  return menuItems.filter(item => 
    item.category.toLowerCase().includes(normalizedCat) ||
    item.name.toLowerCase().includes(normalizedCat)
  );
}

function detectCategory(text: string): string | null {
  const normalized = normalize(text);
  const categories = ['beer', 'cocktail', 'whiskey', 'vodka', 'rum', 'wine', 'snacks', 'food', 'shots', 'mocktail'];
  
  for (const cat of categories) {
    if (normalized.includes(cat)) return cat;
  }
  return null;
}

// ============================================
// MAIN CHATBOT PROCESSOR
// ============================================
export function processChatMessage(
  message: string,
  menuItems: MenuItem[],
  cart: CartItem[]
): ChatbotResponse {
  const normalized = normalize(message);
  const intent = detectIntent(message, menuItems, cart);
  const entities: ChatbotResponse['entities'] = {};
  
  // Extract quantity
  entities.quantity = extractQuantity(message);
  
  // Extract preference
  entities.preference = extractPreference(message);
  
  // Extract category
  entities.category = detectCategory(message) || undefined;
  
  // Process based on intent
  switch (intent) {
    case 'GREETING': {
      return {
        message: getRandomResponse('GREETING'),
        intent,
        entities
      };
    }
    
    case 'VIEW_MENU': {
      return {
        message: getRandomResponse('VIEW_MENU'),
        action: 'show_menu',
        intent,
        entities
      };
    }
    
    case 'VIEW_CATEGORY': {
      const category = entities.category;
      if (category) {
        const categoryItems = findItemsByCategory(menuItems, category);
        if (categoryItems.length > 0) {
          return {
            message: getRandomResponse('VIEW_CATEGORY').replace('{category}', category),
            action: 'show_category',
            category,
            suggestedItems: categoryItems,
            intent,
            entities
          };
        }
      }
      // Fallback to full menu
      return {
        message: getRandomResponse('VIEW_MENU'),
        action: 'show_menu',
        intent,
        entities
      };
    }
    
    case 'ORDER_ITEM': {
      const matchedItems = findMatchingItems(message, menuItems);
      
      if (matchedItems.length === 0) {
        return {
          message: getRandomResponse('ITEM_NOT_FOUND'),
          action: 'show_menu',
          intent,
          entities
        };
      }
      
      // Check availability
      const availableItems = matchedItems.filter(m => m.item.available);
      const unavailableItems = matchedItems.filter(m => !m.item.available);
      
      if (unavailableItems.length > 0 && availableItems.length === 0) {
        // All items unavailable
        return {
          message: getRandomResponse('ITEM_UNAVAILABLE').replace('{item}', unavailableItems[0].item.name),
          action: 'show_menu',
          suggestedItems: menuItems.filter(m => m.available).slice(0, 3),
          intent,
          entities
        };
      }
      
      // Build response for available items
      let responseMsg: string;
      if (availableItems.length === 1) {
        const { item, quantity, preference } = availableItems[0];
        if (preference) {
          responseMsg = getRandomResponse('ITEM_ADDED_WITH_PREF')
            .replace('{quantity}', quantity.toString())
            .replace('{item}', item.name)
            .replace('{preference}', preference);
        } else {
          responseMsg = getRandomResponse('ITEM_ADDED')
            .replace('{quantity}', quantity.toString())
            .replace('{item}', item.name);
        }
      } else {
        const itemsList = availableItems.map(m => `${m.quantity}x ${m.item.name}`).join(' + ');
        responseMsg = getRandomResponse('MULTIPLE_ITEMS_ADDED').replace('{items}', itemsList);
      }
      
      // Add follow-up
      responseMsg += '\n' + getRandomResponse('FOLLOWUP');
      
      // Check if we should upsell
      const hasFood = availableItems.some(m => 
        ['snacks', 'food', 'starters'].includes(m.item.category.toLowerCase())
      );
      const hasDrinks = availableItems.some(m => 
        !['snacks', 'food', 'starters'].includes(m.item.category.toLowerCase())
      );
      
      if (hasDrinks && !hasFood && Math.random() > 0.5) {
        responseMsg += '\n' + getRandomResponse('UPSELL_FOOD');
      } else if (hasFood && !hasDrinks && Math.random() > 0.5) {
        responseMsg += '\n' + getRandomResponse('UPSELL_DRINKS');
      }
      
      return {
        message: responseMsg,
        action: 'add_item',
        matchedItems: availableItems,
        intent,
        entities
      };
    }
    
    case 'VIEW_CART': {
      if (cart.length === 0) {
        return {
          message: getRandomResponse('CART_EMPTY'),
          action: 'show_menu',
          intent,
          entities
        };
      }
      return {
        message: getRandomResponse('VIEW_CART'),
        action: 'show_cart',
        intent,
        entities
      };
    }
    
    case 'REMOVE_ITEM': {
      return {
        message: "What would you like to remove?",
        action: 'show_cart',
        intent,
        entities
      };
    }
    
    case 'CHECK_PRICE': {
      // Check for specific item
      const matchedItems = findMatchingItems(message, menuItems);
      if (matchedItems.length > 0) {
        const item = matchedItems[0].item;
        return {
          message: getRandomResponse('PRICE_CHECK')
            .replace('{item}', item.name)
            .replace('{price}', item.price.toFixed(2)),
          intent,
          entities
        };
      }
      
      // Check for cheapest/expensive
      if (normalized.includes('cheap')) {
        const cheapest = findCheapestItem(menuItems.filter(m => m.available));
        if (cheapest) {
          return {
            message: getRandomResponse('CHEAPEST')
              .replace('{item}', cheapest.name)
              .replace('{price}', cheapest.price.toFixed(2)),
            suggestedItems: [cheapest],
            intent,
            entities
          };
        }
      }
      
      // Default: show menu
      return {
        message: "Check out our menu to see prices! 💰",
        action: 'show_menu',
        intent,
        entities
      };
    }
    
    case 'RECOMMEND': {
      const available = menuItems.filter(m => m.available);
      if (available.length === 0) {
        return {
          message: "Our menu is updating, check back soon!",
          intent,
          entities
        };
      }
      
      // Pick 1-3 random items to recommend
      const shuffled = available.sort(() => Math.random() - 0.5);
      const recommended = shuffled.slice(0, Math.min(3, shuffled.length));
      const mainRec = recommended[0];
      
      let msg = getRandomResponse('RECOMMEND').replace('{item}', mainRec.name);
      if (recommended.length > 1) {
        msg += `\nAlso try: ${recommended.slice(1).map(i => i.name).join(', ')} 👌`;
      }
      
      return {
        message: msg,
        suggestedItems: recommended,
        intent,
        entities
      };
    }
    
    case 'PARTY_ORDER': {
      // Extract group size
      const sizeMatch = normalized.match(/(\d+)\s*(people|persons|guys|friends)?/);
      const groupSize = sizeMatch ? parseInt(sizeMatch[1]) : 4;
      
      return {
        message: `Nice! 🎉 Party of ${groupSize}?\n\nI'd suggest:\n🍾 1-2 Premium bottles\n🍹 Some cocktails to share\n🍟 Snacks for the table\n\nWant me to show you our party specials?`,
        action: 'show_menu',
        intent,
        entities: { ...entities, quantity: groupSize }
      };
    }
    
    case 'PLACE_ORDER': {
      if (cart.length === 0) {
        return {
          message: getRandomResponse('CART_EMPTY'),
          action: 'show_menu',
          intent,
          entities
        };
      }
      return {
        message: getRandomResponse('CHECKOUT'),
        action: 'checkout',
        intent,
        entities
      };
    }
    
    case 'CANCEL_ORDER': {
      return {
        message: getRandomResponse('CANCEL'),
        action: 'clear_cart',
        intent,
        entities
      };
    }
    
    case 'THANK_YOU': {
      return {
        message: getRandomResponse('THANK_YOU'),
        intent,
        entities
      };
    }
    
    case 'HELP': {
      return {
        message: getRandomResponse('HELP'),
        intent,
        entities
      };
    }
    
    case 'ADD_TIP': {
      // Extract tip amount
      const tipMatch = normalized.match(/\$?(\d+)/);
      if (tipMatch) {
        entities.tipAmount = parseInt(tipMatch[1]);
      }
      return {
        message: "Great! Let's add that tip 💰",
        action: 'show_tip',
        intent,
        entities
      };
    }
    
    default: {
      // Try to be helpful even with unknown intent
      // Check if the message might be an item name
      const possibleItems = findMatchingItems(message, menuItems);
      if (possibleItems.length > 0 && possibleItems[0].item.available) {
        const { item, quantity, preference } = possibleItems[0];
        let msg = preference
          ? getRandomResponse('ITEM_ADDED_WITH_PREF')
              .replace('{quantity}', quantity.toString())
              .replace('{item}', item.name)
              .replace('{preference}', preference)
          : getRandomResponse('ITEM_ADDED')
              .replace('{quantity}', quantity.toString())
              .replace('{item}', item.name);
        
        msg += '\n' + getRandomResponse('FOLLOWUP');
        
        return {
          message: msg,
          action: 'add_item',
          matchedItems: [possibleItems[0]],
          intent: 'ORDER_ITEM',
          entities
        };
      }
      
      return {
        message: getRandomResponse('UNKNOWN'),
        intent: 'UNKNOWN',
        entities
      };
    }
  }
}

// ============================================
// EXPORT HELPER FOR COMPATIBILITY
// ============================================
export { normalize, detectIntent, extractQuantity, extractPreference };
