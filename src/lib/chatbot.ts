// ============================================
// SIA - INTELLIGENT RESTAURANT ASSISTANT
// Intent-based NLP + Menu Keyword Detection
// For Coasis Restaurant Bar & Suites
// ============================================

import type { MenuItem } from './types';

// ============================================
// TYPES
// ============================================
export interface ChatbotResponse {
  message: string;
  action?: 'show_menu' | 'show_cart' | 'checkout' | 'show_tip' | 'show_category' | 'add_item' | 'remove_item' | 'clear_cart' | 'ask_dish';
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
  | 'ADD_TO_CART'
  | 'ASK_ABOUT_DISH'
  | 'MODIFY_QUANTITY'
  | 'REMOVE_ITEM'
  | 'VIEW_CART'
  | 'ADD_TIP'
  | 'CHECK_PRICE'
  | 'RECOMMEND'
  | 'RECOMMEND_SPICY'
  | 'RECOMMEND_SEAFOOD'
  | 'RECOMMEND_LIGHT'
  | 'PARTY_ORDER'
  | 'PLACE_ORDER'
  | 'CANCEL_ORDER'
  | 'THANK_YOU'
  | 'HELP'
  | 'YES_CONFIRM'
  | 'UNKNOWN';

// ============================================
// COASIS MENU KNOWLEDGE BASE
// Full dish descriptions, keywords, pairings
// ============================================
interface DishInfo {
  displayName: string;
  keywords: string[];
  description: string;
  details: string;
  price: string;
  pairings: string[];
  category: 'appetizer' | 'salad' | 'main' | 'sandwich' | 'dessert' | 'sides';
  spicy?: boolean;
  seafood?: boolean;
  popular?: boolean;
}

const DISH_KNOWLEDGE: Record<string, DishInfo> = {
  chargrilled_oysters: {
    displayName: 'Chargrilled Oysters',
    keywords: ['oyster', 'oysters', 'chargrilled oyster', 'chargrilled oysters', 'grilled oysters'],
    description: 'Chargrilled Oysters are grilled with garlic parmesan and chimichurri sauce, giving them a rich smoky flavor.',
    details: '• Garlic Parmesan\n• Chimichurri Sauce\n• Half Dozen or Full Dozen',
    price: 'Half dozen $18 | Full dozen $32',
    pairings: ['Coasis House Salad', 'Crispy Chilli Garlic Shrimp'],
    category: 'appetizer',
    seafood: true,
    popular: true,
  },
  crab_fried_rice: {
    displayName: 'Crab Fried Rice',
    keywords: ['crab rice', 'crab fried rice', 'fried rice'],
    description: 'Our Crab Fried Rice is made with fried rice, crab meat, vegetables, and egg, giving it a savory seafood flavor.',
    details: '• Fried Rice\n• Crab Meat\n• Vegetables & Egg',
    price: '$15',
    pairings: ['Crispy Chilli Garlic Shrimp', 'Grilled Caesar Salad'],
    category: 'appetizer',
    seafood: true,
  },
  blue_cheese_buffalo_wings: {
    displayName: 'Blue Cheese Buffalo Wings',
    keywords: ['buffalo wings', 'wings', 'blue cheese wings', 'chicken wings', 'hot wings'],
    description: 'Blue Cheese Buffalo Wings are crispy chicken wings tossed in buffalo sauce and topped with blue cheese crumbles.',
    details: '• Crispy Chicken Wings\n• Buffalo Sauce\n• Blue Cheese Crumbles',
    price: '$14',
    pairings: ['Grilled Caesar Salad', 'Strip Steak'],
    category: 'appetizer',
    spicy: true,
    popular: true,
  },
  crispy_chilli_garlic_shrimp: {
    displayName: 'Crispy Chilli Garlic Shrimp',
    keywords: ['shrimp', 'garlic shrimp', 'chilli shrimp', 'crispy shrimp', 'chili shrimp', 'chilli garlic shrimp'],
    description: 'Our Crispy Chilli Garlic Shrimp are crispy fried shrimp tossed in a spicy garlic sauce.',
    details: '• Crispy Fried Shrimp\n• Spicy Garlic Sauce',
    price: '$14',
    pairings: ['Marinated Lambchops', 'Strip Steak', 'Coasis House Salad'],
    category: 'appetizer',
    spicy: true,
    seafood: true,
    popular: true,
  },
  fried_lobster_bites: {
    displayName: 'Fried Lobster Bites',
    keywords: ['lobster bites', 'fried lobster bites', 'lobster appetizer'],
    description: 'Fried Lobster Bites are crispy lobster pieces served with sriracha aioli.',
    details: '• Crispy Lobster Pieces\n• Sriracha Aioli',
    price: '$32',
    pairings: ['Grilled Caesar Salad', 'Crab Fried Rice'],
    category: 'appetizer',
    seafood: true,
  },
  steak_cheese_egg_rolls: {
    displayName: 'Steak & Cheese Egg Rolls',
    keywords: ['steak egg roll', 'cheese egg roll', 'steak cheese egg roll', 'egg rolls', 'egg roll'],
    description: 'These Steak & Cheese Egg Rolls are filled with carne asada steak and melted cheeses, wrapped in a crispy roll.',
    details: '• Carne Asada Steak\n• Melted Cheeses\n• Crispy Wrapper',
    price: '$14',
    pairings: ['Blue Cheese Buffalo Wings', 'Cajun Seafood Dip'],
    category: 'appetizer',
    popular: true,
  },
  cajun_seafood_dip: {
    displayName: 'Cajun Seafood Dip',
    keywords: ['seafood dip', 'cajun dip', 'cajun seafood', 'crawfish dip', 'crab dip'],
    description: 'Our Cajun Seafood Dip is a creamy blend of crawfish, crab, and cheeses with Cajun spices.',
    details: '• Crawfish & Crab\n• Creamy Cheese Blend\n• Cajun Spices',
    price: '$18',
    pairings: ['Steak & Cheese Egg Rolls', 'Blue Cheese Buffalo Wings'],
    category: 'appetizer',
    spicy: true,
    seafood: true,
  },
  grilled_caesar_salad: {
    displayName: 'Grilled Caesar Salad',
    keywords: ['caesar salad', 'grilled caesar', 'caesar'],
    description: 'Grilled Caesar Salad features grilled romaine lettuce with house-made croutons and Caesar dressing.',
    details: '• Grilled Romaine\n• House-made Croutons\n• Caesar Dressing',
    price: '$14',
    pairings: ['Strip Steak', 'Airline Chicken Breast'],
    category: 'salad',
  },
  coasis_house_salad: {
    displayName: 'Coasis House Salad',
    keywords: ['house salad', 'coasis salad'],
    description: 'The Coasis House Salad includes feta cheese, egg, red onion, pecans, and Dijon vinaigrette.',
    details: '• Feta Cheese\n• Egg & Red Onion\n• Pecans\n• Dijon Vinaigrette',
    price: '$14',
    pairings: ['Marinated Lambchops', 'Chargrilled Oysters'],
    category: 'salad',
  },
  strip_steak: {
    displayName: 'Strip Steak',
    keywords: ['steak', 'strip steak', 'grilled steak', 'ny strip', 'new york strip'],
    description: 'Our Strip Steak is a tender chargrilled marinated steak cooked to perfection.',
    details: '• Chargrilled Marinated Steak\n• Optional add-on: Grilled Caribbean Lobster Tail ($22)',
    price: '$30',
    pairings: ['Grilled Caesar Salad', 'Crispy Chilli Garlic Shrimp', 'Coasis House Salad'],
    category: 'main',
    popular: true,
  },
  marinated_lambchops: {
    displayName: 'Marinated Lambchops',
    keywords: ['lamb', 'lamb chop', 'lambchops', 'marinated lamb', 'marinated lambchops', 'lamb chops'],
    description: 'Marinated Lambchops are served with truffle chimichurri, honey chilli sauce, and garlic green beans.',
    details: '• Truffle Chimichurri\n• Honey Chilli Sauce\n• Garlic Green Beans',
    price: '$42',
    pairings: ['Crispy Chilli Garlic Shrimp', 'Cajun Seafood Dip', 'Coasis House Salad'],
    category: 'main',
    popular: true,
  },
  airline_chicken_breast: {
    displayName: 'Airline Chicken Breast',
    keywords: ['airline chicken', 'chicken breast', 'airline chicken breast'],
    description: 'Airline Chicken Breast is a grilled chicken dish served with lemon herb butter and red skin mashed potatoes.',
    details: '• Lemon Herb Butter\n• Red Skin Mashed Potatoes',
    price: '$26',
    pairings: ['Grilled Caesar Salad', 'Blue Cheese Buffalo Wings'],
    category: 'main',
  },
  southern_fried_chicken: {
    displayName: 'Southern Fried Chicken',
    keywords: ['fried chicken', 'southern chicken', 'southern fried chicken', 'southern fried'],
    description: 'Southern Fried Chicken comes with collard greens, sweet potato mac and cheese, and honey butter biscuit.',
    details: '• Collard Greens\n• Sweet Potato Mac & Cheese\n• Honey Butter Biscuit',
    price: '$28',
    pairings: ['Blue Cheese Buffalo Wings', 'Coasis House Salad'],
    category: 'main',
    popular: true,
  },
  grilled_fried_branzino: {
    displayName: 'Grilled or Fried Branzino',
    keywords: ['branzino', 'grilled fish', 'fried fish', 'whole fish'],
    description: 'Branzino is a whole fish marinated in spices, served grilled or fried.',
    details: '• Whole Fish\n• Spice Marinated\n• Your choice: Grilled or Fried',
    price: '$34',
    pairings: ['Crab Fried Rice', 'Coasis House Salad'],
    category: 'main',
    seafood: true,
  },
  salmon_crab_fried_rice: {
    displayName: 'Salmon & Crab Fried Rice',
    keywords: ['salmon rice', 'salmon crab rice', 'salmon fried rice', 'asian chilli salmon', 'salmon'],
    description: 'Salmon & Crab Fried Rice includes Asian chilli salmon, fried rice, vegetables, and lump crab with sriracha aioli.',
    details: '• Asian Chilli Salmon\n• Fried Rice & Vegetables\n• Lump Crab\n• Sriracha Aioli',
    price: '$38',
    pairings: ['Crispy Chilli Garlic Shrimp', 'Grilled Caesar Salad'],
    category: 'main',
    seafood: true,
    spicy: true,
  },
  lobster_crab_fried_rice: {
    displayName: 'Lobster & Crab Fried Rice',
    keywords: ['lobster rice', 'lobster crab rice', 'lobster fried rice', 'lobster'],
    description: 'This dish features 8oz fried lobster with fried rice, vegetables, lump crab, and sriracha aioli.',
    details: '• 8oz Fried Lobster\n• Fried Rice & Vegetables\n• Lump Crab\n• Sriracha Aioli',
    price: '$42',
    pairings: ['Chargrilled Oysters', 'Coasis House Salad'],
    category: 'main',
    seafood: true,
  },
  seafood_trio: {
    displayName: 'Seafood Trio',
    keywords: ['seafood trio', 'seafood platter', 'seafood plate', 'fish shrimp lobster'],
    description: 'Seafood Trio includes fried lobster, catfish, and shrimp served with one side.',
    details: '• Fried Lobster\n• Catfish\n• Shrimp\n• Served with one side',
    price: '$42',
    pairings: ['Cajun Seafood Dip', 'Crab Fried Rice'],
    category: 'main',
    seafood: true,
    popular: true,
  },
  garlic_alfredo_pasta: {
    displayName: 'Garlic Alfredo Pasta',
    keywords: ['alfredo pasta', 'garlic alfredo', 'pasta', 'alfredo', 'fettuccine'],
    description: 'Garlic Alfredo Pasta is a creamy pasta dish.',
    details: '• Chicken $22\n• Shrimp $22\n• Lobster $36\n\nWhich protein would you like?',
    price: 'From $22',
    pairings: ['Grilled Caesar Salad', 'Blue Cheese Buffalo Wings'],
    category: 'main',
  },
  salmon_sandwich: {
    displayName: 'Salmon Sandwich',
    keywords: ['salmon sandwich', 'salmon burger', 'blackened salmon sandwich'],
    description: 'The Salmon Sandwich is fried or blackened salmon with onion rings, garlic aioli, lettuce, and tomato.',
    details: '• Fried or Blackened Salmon\n• Onion Rings\n• Garlic Aioli\n• Lettuce & Tomato',
    price: '$22',
    pairings: ['Crispy Chilli Garlic Shrimp', 'Coasis House Salad'],
    category: 'sandwich',
    seafood: true,
  },
  coasis_burger: {
    displayName: 'Coasis Burger',
    keywords: ['burger', 'coasis burger', 'cheeseburger', 'hamburger'],
    description: 'The Coasis Burger includes cheese, lettuce, tomato, and onion on a fresh bun.',
    details: '• Cheese\n• Lettuce & Tomato\n• Onion\n• Fresh Bun',
    price: '$18',
    pairings: ['Blue Cheese Buffalo Wings', 'Steak & Cheese Egg Rolls'],
    category: 'sandwich',
    popular: true,
  },
  dessert_special: {
    displayName: 'Dessert Special',
    keywords: ['dessert', 'sweet', 'cookie', 'brownie', 'ice cream', 'chocolate', 'something sweet'],
    description: 'Our dessert options include warm chocolate treats perfect for finishing your meal.',
    details: '• Warm Chocolate Chip Cookie & Skillet Milk\n• Warm Chewy Chocolate Brownie with Pecans, Strawberries & Vanilla Ice Cream',
    price: '$10',
    pairings: [],
    category: 'dessert',
  },
};

// ============================================
// KEYWORD PATTERNS FOR INTENT DETECTION
// ============================================
const INTENT_PATTERNS: Record<IntentType, string[]> = {
  GREETING: ['hi', 'hello', 'hey', 'bro', 'boss', 'waiter', 'yo', 'whats up', "what's up", 'sup', 'hola', 'howdy', 'good morning', 'good evening', 'good afternoon'],
  VIEW_MENU: ['show menu', 'see menu', 'full menu', 'what do you have', 'available items', 'what can i get', 'let me see', 'whatcha got', 'what you got', 'show me everything', 'see the menu', 'browse menu', 'open menu', 'menu please'],
  VIEW_CATEGORY: ['appetizers', 'appetizer', 'starters', 'starter', 'salads', 'mains', 'main dish', 'main course', 'entree', 'entrees', 'sandwiches', 'desserts', 'sides'],
  ORDER_ITEM: ['i want', 'give me', 'add', 'include', 'get me', 'bring me', 'make it', 'serve me', 'pour me', 'i need', 'can i have', "i'll have", 'ill have', 'i will have', 'let me get', 'one', 'two', 'three', 'order'],
  ADD_TO_CART: ['add it', 'add that', 'yes add', 'add to cart', 'put it in', 'add this', 'yes please add', 'add to my order', 'add to order', 'yes add it'],
  ASK_ABOUT_DISH: ['what is', 'what are', 'tell me about', 'what does', 'come with', 'comes with', 'whats in', "what's in", 'describe', 'explain', 'ingredients', 'what goes in'],
  MODIFY_QUANTITY: ['more', 'extra', 'another', 'make it', 'increase', 'double', 'triple', 'add more', 'one more', 'two more'],
  REMOVE_ITEM: ['remove', 'delete', 'cancel item', 'take off', 'take out', 'no more', 'dont want', "don't want", 'remove that', 'scratch that', 'get rid of'],
  VIEW_CART: ['cart', 'show cart', 'what did i order', 'my order', 'total amount', 'my items', 'show order', 'what i got', 'current order', 'bill so far', 'check order', 'whats in my cart'],
  ADD_TIP: ['tip', 'add tip', 'include tip', 'gratuity', '$5 tip', '$10 tip', '10%', '15%', '20%', '25%'],
  CHECK_PRICE: ['how much', 'price of', 'cost', 'cheapest', 'expensive', 'affordable', 'budget', 'pricing', 'rate', 'whats the price', "what's the price"],
  RECOMMEND: ['recommend', 'suggest', 'best dish', 'popular item', "what's good", 'whats good', 'special', 'favorite', 'must try', 'signature', 'top pick', 'what should i', 'help me choose', 'your best', 'something good', 'popular tonight', 'what do you suggest'],
  RECOMMEND_SPICY: ['something spicy', 'spicy food', 'hot food', 'i want spicy', 'i like spicy', 'spicy dish', 'anything spicy'],
  RECOMMEND_SEAFOOD: ['something seafood', 'seafood dish', 'fish dish', 'i want seafood', 'i like seafood', 'anything with fish', 'seafood options'],
  RECOMMEND_LIGHT: ['something light', 'light meal', 'not heavy', 'something healthy', 'lighter option', 'light food'],
  PARTY_ORDER: ['we are', 'group of', 'party', 'for us', 'celebrating', 'bunch of us', 'friends', 'birthday', 'celebration'],
  PLACE_ORDER: ['place order', 'checkout', 'confirm order', 'confirm', "i'm done", 'im done', 'thats all', "that's all", 'done ordering', 'send order', 'submit', 'finish', 'complete order', 'ready to order'],
  CANCEL_ORDER: ['cancel order', 'clear cart', 'forget it', 'nevermind', 'never mind', 'start over', 'remove all', 'clear all', 'cancel everything', 'scratch everything'],
  THANK_YOU: ['thank', 'thanks', 'appreciate', 'awesome', 'great', 'perfect', 'nice', 'cool', 'cheers', 'wonderful'],
  HELP: ['help', 'how does this work', 'confused', 'what can you do', 'guide me', 'assist', 'support', 'how to order', 'instructions'],
  YES_CONFIRM: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yea', 'ya', 'absolutely', 'definitely', 'please do', 'go ahead', 'do it'],
  UNKNOWN: [],
};

// ============================================
// QUANTITY & PREFERENCE PATTERNS
// ============================================
const QUANTITY_WORDS: Record<string, number> = {
  'one': 1, 'a': 1, 'an': 1, 'single': 1,
  'two': 2, 'couple': 2, 'pair': 2, 'double': 2,
  'three': 3, 'triple': 3,
  'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
};

const PREFERENCE_PATTERNS = [
  { pattern: /with ice|on the rocks|iced|cold/i, value: 'with ice' },
  { pattern: /no ice|without ice|neat/i, value: 'neat' },
  { pattern: /chilled|frozen|extra cold/i, value: 'chilled' },
  { pattern: /spicy|hot|extra spicy/i, value: 'spicy' },
  { pattern: /less spicy|mild|not spicy/i, value: 'less spicy' },
  { pattern: /extra sauce|more sauce/i, value: 'extra sauce' },
  { pattern: /grilled/i, value: 'grilled' },
  { pattern: /fried/i, value: 'fried' },
  { pattern: /blackened/i, value: 'blackened' },
  { pattern: /crispy|extra crispy/i, value: 'crispy' },
];

// ============================================
// RESPONSE TEMPLATES
// ============================================
const RESPONSES = {
  GREETING: [
    "Welcome to Coasis! 🍽️ I'm SIA, your ordering assistant.\n\n🔥 Popular tonight:\n• Marinated Lambchops\n• Airline Chicken Breast\n• Seafood Trio\n\nWhat would you like to try?",
    "Hey there! 👋 Welcome to Coasis Restaurant Bar & Suites!\n\nI'm SIA — I can help you explore the menu, explain dishes, and take your order.\n\nWhat are you in the mood for?",
    "Hello! Welcome to Coasis! 🍽️\n\nLet me know what you're craving — I know the menu inside and out!",
  ],
  VIEW_MENU: [
    "Here's our full menu! 👇 Tap a category or just tell me what sounds good.",
    "Check out what Coasis has to offer! 🔥 You can also just type a dish name and I'll tell you all about it.",
    "Take a look at our menu! Tell me if anything catches your eye — I can recommend pairings too.",
  ],
  ITEM_ADDED: [
    "Great choice! 👍 {quantity}x {item} added to your cart.\n\n{upsell}",
    "Done! 🎉 {quantity}x {item} is in your order.\n\n{upsell}",
    "You got it! {quantity}x {item} added! 👌\n\n{upsell}",
  ],
  ITEM_REMOVED: [
    "Done! {item} removed from your cart. 👍",
    "{item} has been removed. Anything else you'd like to change?",
  ],
  ITEM_NOT_FOUND: [
    "Hmm, I couldn't find that on our menu. 🤔\n\nWant me to show you the menu? Or tell me what you're in the mood for — I'll find something perfect!",
    "I don't think we have that one. Let me show you what's available!\n\nOr just tell me: are you feeling meat, seafood, or something lighter?",
  ],
  ITEM_UNAVAILABLE: [
    "Sorry! 😔 {item} is currently unavailable.\n\nWant me to suggest something similar?",
  ],
  VIEW_CART: [
    "Here's your order so far:",
    "Let's see what you've got:",
    "Your current order:",
  ],
  CART_EMPTY: [
    "Your cart is empty! Let's change that 😄\n\nWhat would you like to order?",
    "Nothing in the cart yet. Ready to explore the menu?",
  ],
  CHECKOUT: [
    "Perfect! 👍 Sending your order now...",
    "Got it! Your order is being submitted.",
  ],
  CANCEL: [
    "Cart cleared! 🗑️ Fresh start — what would you like?",
    "All cleared! Ready when you are. 👍",
  ],
  THANK_YOU: [
    "You're welcome! 😊 Need anything else?",
    "Anytime! Enjoy your meal! 🍽️",
    "Cheers! Let me know if you need anything. 🎉",
  ],
  HELP: [
    "I'm SIA, your Coasis ordering assistant! Here's how it works: 👇\n\n1️⃣ **Browse** — Say \"show menu\" to see all items\n2️⃣ **Order** — Type a dish name (like \"lamb chops\") to add it to cart\n3️⃣ **Learn** — Say \"tell me about\" + dish name for details\n4️⃣ **Checkout** — Say \"place order\" or \"confirm\" when ready\n\nYou can also ask me:\n• \"What's good?\" — I'll recommend dishes\n• \"Something spicy\" — Spicy picks\n• \"How much is the steak?\" — Price check\n\nWhat would you like?",
  ],
  UNKNOWN: [
    "Sorry, didn't quite get that 😅 Try 'show menu' or tell me what you'd like!",
    "Hmm? Want to see the menu or just tell me what you're craving?",
    "Not sure what you mean. Try typing a dish name like \"steak\" or say \"show menu\"!",
  ],
  FOLLOWUP: [
    "Anything else to go with that?",
    "Want something else?",
    "What else can I get you?",
    "Need anything else?",
  ],
};

// ============================================
// UPSELL SUGGESTIONS PER CATEGORY
// ============================================
const UPSELL_MAP: Record<string, string[]> = {
  main: [
    'Crispy Chilli Garlic Shrimp',
    'Coasis House Salad',
    'Cajun Seafood Dip',
  ],
  appetizer: [
    'Marinated Lambchops',
    'Strip Steak',
    'Airline Chicken Breast',
  ],
  salad: [
    'Marinated Lambchops',
    'Airline Chicken Breast',
    'Coasis Burger',
  ],
  sandwich: [
    'Crispy Chilli Garlic Shrimp',
    'Blue Cheese Buffalo Wings',
    'Steak & Cheese Egg Rolls',
  ],
  dessert: [],
  sides: [],
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
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num > 0 && num <= 20) return num;
  }
  for (const [word, qty] of Object.entries(QUANTITY_WORDS)) {
    if (normalized.includes(word)) return qty;
  }
  return 1;
}

function extractPreference(text: string): string | undefined {
  for (const { pattern, value } of PREFERENCE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

// ============================================
// DISH KEYWORD DETECTION (NLP LAYER)
// Match user input to known dishes
// ============================================
function detectDishFromKnowledge(text: string): DishInfo | null {
  const normalized = normalize(text);

  // Sort by keyword length descending (longer/more specific matches first)
  const allDishes = Object.values(DISH_KNOWLEDGE);
  let bestMatch: DishInfo | null = null;
  let bestMatchLength = 0;

  for (const dish of allDishes) {
    for (const keyword of dish.keywords) {
      if (normalized.includes(keyword.toLowerCase()) && keyword.length > bestMatchLength) {
        bestMatch = dish;
        bestMatchLength = keyword.length;
      }
    }
  }
  return bestMatch;
}

// ============================================
// MENU ITEM MATCHING (from Supabase menu)
// ============================================
function findMatchingItems(text: string, menuItems: MenuItem[]): { item: MenuItem; quantity: number; preference?: string }[] {
  const normalized = normalize(text);
  const matches: { item: MenuItem; quantity: number; preference?: string }[] = [];
  const quantity = extractQuantity(text);
  const preference = extractPreference(text);

  // Also try to match using dish knowledge keywords
  const knownDish = detectDishFromKnowledge(text);

  const sortedItems = [...menuItems].sort((a, b) => b.name.length - a.name.length);

  for (const item of sortedItems) {
    const itemNameLower = item.name.toLowerCase();
    const itemWords = itemNameLower.split(' ').filter(w => w.length > 2);

    // Full name match
    if (normalized.includes(itemNameLower)) {
      matches.push({ item, quantity, preference });
      continue;
    }

    // Match via dish knowledge display name
    if (knownDish && item.name.toLowerCase() === knownDish.displayName.toLowerCase()) {
      if (!matches.find(m => m.item.id === item.id)) {
        matches.push({ item, quantity, preference });
      }
      continue;
    }

    // Partial word match (significant words only)
    for (const word of itemWords) {
      if (word.length > 3 && normalized.includes(word)) {
        if (!matches.find(m => m.item.id === item.id)) {
          matches.push({ item, quantity, preference });
        }
        break;
      }
    }
  }

  return matches;
}

function findItemsByCategory(menuItems: MenuItem[], category: string): MenuItem[] {
  const normalizedCat = category.toLowerCase();
  return menuItems.filter(item =>
    item.category.toLowerCase().includes(normalizedCat) ||
    item.name.toLowerCase().includes(normalizedCat)
  );
}

function findCheapestItem(menuItems: MenuItem[]): MenuItem | null {
  if (menuItems.length === 0) return null;
  return menuItems.reduce((min, item) => item.price < min.price ? item : min, menuItems[0]);
}

function detectCategory(text: string): string | null {
  const normalized = normalize(text);
  const categoryMap: Record<string, string> = {
    'appetizer': 'Appetizers', 'appetizers': 'Appetizers', 'starter': 'Appetizers', 'starters': 'Appetizers',
    'salad': 'Salads', 'salads': 'Salads',
    'main': 'Mains', 'mains': 'Mains', 'main dish': 'Mains', 'entree': 'Mains', 'entrees': 'Mains', 'main course': 'Mains',
    'sandwich': 'Sandwiches', 'sandwiches': 'Sandwiches',
    'dessert': 'Desserts', 'desserts': 'Desserts',
    'side': 'Sides', 'sides': 'Sides',
    'food': 'Mains',
  };
  for (const [keyword, cat] of Object.entries(categoryMap)) {
    if (normalized.includes(keyword)) return cat;
  }
  return null;
}

// ============================================
// INTENT DETECTION (NLP Layer)
// ============================================
function detectIntent(text: string, menuItems: MenuItem[], cart: CartItem[]): IntentType {
  const normalized = normalize(text);

  // Priority 1: Explicit action intents (order of specificity)
  // Check remove first
  for (const keyword of INTENT_PATTERNS.REMOVE_ITEM) {
    if (normalized.includes(keyword)) return 'REMOVE_ITEM';
  }

  // Check add to cart (explicit "add it" / "yes add" confirmations)
  for (const keyword of INTENT_PATTERNS.ADD_TO_CART) {
    if (normalized.includes(keyword)) {
      // If a specific dish is mentioned, treat as cart add
      const dish = detectDishFromKnowledge(text);
      const matchItems = findMatchingItems(text, menuItems);
      if (dish || matchItems.length > 0) return 'ADD_TO_CART';
      // No dish specified ("add it", "yes add") → confirm previous item
      return 'YES_CONFIRM';
    }
  }

  // Check place order / checkout
  for (const keyword of INTENT_PATTERNS.PLACE_ORDER) {
    if (normalized.includes(keyword)) return 'PLACE_ORDER';
  }

  // Check cancel
  for (const keyword of INTENT_PATTERNS.CANCEL_ORDER) {
    if (normalized.includes(keyword)) return 'CANCEL_ORDER';
  }

  // Check view cart
  for (const keyword of INTENT_PATTERNS.VIEW_CART) {
    if (normalized.includes(keyword)) return 'VIEW_CART';
  }

  // Check explicit order intent ("i want", "give me", etc.)
  for (const keyword of INTENT_PATTERNS.ORDER_ITEM) {
    if (normalized.includes(keyword)) {
      const dish = detectDishFromKnowledge(text);
      const menuMatch = findMatchingItems(text, menuItems);
      if (dish || menuMatch.length > 0) return 'ORDER_ITEM';
    }
  }

  // Check greeting (only short messages)
  if (normalized.split(' ').length <= 4) {
    for (const keyword of INTENT_PATTERNS.GREETING) {
      if (normalized.includes(keyword)) return 'GREETING';
    }
  }

  // Check view menu
  for (const keyword of INTENT_PATTERNS.VIEW_MENU) {
    if (normalized.includes(keyword)) return 'VIEW_MENU';
  }

  // Check ask about dish
  for (const keyword of INTENT_PATTERNS.ASK_ABOUT_DISH) {
    if (normalized.includes(keyword)) return 'ASK_ABOUT_DISH';
  }

  // Check price check
  for (const keyword of INTENT_PATTERNS.CHECK_PRICE) {
    if (normalized.includes(keyword)) return 'CHECK_PRICE';
  }

  // Check specific recommend types first
  for (const keyword of INTENT_PATTERNS.RECOMMEND_SPICY) {
    if (normalized.includes(keyword)) return 'RECOMMEND_SPICY';
  }
  for (const keyword of INTENT_PATTERNS.RECOMMEND_SEAFOOD) {
    if (normalized.includes(keyword)) return 'RECOMMEND_SEAFOOD';
  }
  for (const keyword of INTENT_PATTERNS.RECOMMEND_LIGHT) {
    if (normalized.includes(keyword)) return 'RECOMMEND_LIGHT';
  }

  // Check general recommend
  for (const keyword of INTENT_PATTERNS.RECOMMEND) {
    if (normalized.includes(keyword)) return 'RECOMMEND';
  }

  // Check tip
  for (const keyword of INTENT_PATTERNS.ADD_TIP) {
    if (normalized.includes(keyword)) return 'ADD_TIP';
  }

  // Check help
  for (const keyword of INTENT_PATTERNS.HELP) {
    if (normalized.includes(keyword)) return 'HELP';
  }

  // Check thank you
  for (const keyword of INTENT_PATTERNS.THANK_YOU) {
    if (normalized.includes(keyword)) return 'THANK_YOU';
  }

  // Check category browsing
  if (detectCategory(text)) return 'VIEW_CATEGORY';

  // Check yes/confirmation
  for (const keyword of INTENT_PATTERNS.YES_CONFIRM) {
    if (normalized === keyword || normalized === keyword + ' please') return 'YES_CONFIRM';
  }

  // Check party
  for (const keyword of INTENT_PATTERNS.PARTY_ORDER) {
    if (normalized.includes(keyword)) return 'PARTY_ORDER';
  }

  // ---- FALLBACK: If message matches a dish keyword, auto-add to cart ----
  const knownDish = detectDishFromKnowledge(text);
  if (knownDish) return 'ORDER_ITEM';

  // Check if it matches a menu item name
  const menuMatch = findMatchingItems(text, menuItems);
  if (menuMatch.length > 0) return 'ORDER_ITEM';

  return 'UNKNOWN';
}

// ============================================
// BUILD DISH DESCRIPTION MESSAGE
// ============================================
function buildDishDescription(dish: DishInfo): string {
  let msg = `${dish.description}\n\n${dish.details}\n\n💰 Price: ${dish.price}`;

  if (dish.pairings.length > 0) {
    msg += `\n\n🍽️ Pairs well with:\n${dish.pairings.map(p => `• ${p}`).join('\n')}`;
  }

  msg += `\n\nWould you like me to add it to your cart?`;
  return msg;
}

// ============================================
// BUILD UPSELL MESSAGE
// ============================================
function buildUpsell(dish: DishInfo | null, cart: CartItem[]): string {
  if (!dish) return getRandomResponse('FOLLOWUP');

  const suggestions = dish.pairings.length > 0
    ? dish.pairings
    : (UPSELL_MAP[dish.category] || []);

  if (suggestions.length === 0) return getRandomResponse('FOLLOWUP');

  // Filter out items already in cart
  const cartNames = cart.map(c => c.name.toLowerCase());
  const filtered = suggestions.filter(s => !cartNames.includes(s.toLowerCase()));

  if (filtered.length === 0) return getRandomResponse('FOLLOWUP');

  return `Many guests also enjoy:\n${filtered.slice(0, 3).map(s => `• ${s}`).join('\n')}\n\nWould you like to add one?`;
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

  entities.quantity = extractQuantity(message);
  entities.preference = extractPreference(message);
  entities.category = detectCategory(message) || undefined;

  switch (intent) {
    // ---- GREETING ----
    case 'GREETING': {
      return {
        message: getRandomResponse('GREETING'),
        intent,
        entities,
      };
    }

    // ---- VIEW MENU ----
    case 'VIEW_MENU': {
      return {
        message: getRandomResponse('VIEW_MENU'),
        action: 'show_menu',
        intent,
        entities,
      };
    }

    // ---- VIEW CATEGORY ----
    case 'VIEW_CATEGORY': {
      const category = entities.category;
      if (category) {
        const categoryItems = findItemsByCategory(menuItems, category);
        if (categoryItems.length > 0) {
          return {
            message: `Here's our ${category} selection! 👇`,
            action: 'show_category',
            category,
            suggestedItems: categoryItems,
            intent,
            entities,
          };
        }
      }
      return {
        message: getRandomResponse('VIEW_MENU'),
        action: 'show_menu',
        intent,
        entities,
      };
    }

    // ---- ASK ABOUT DISH (describe + suggest pairing) ----
    case 'ASK_ABOUT_DISH': {
      const knownDish = detectDishFromKnowledge(message);
      if (knownDish) {
        const msg = buildDishDescription(knownDish);
        const menuMatch = findMatchingItems(knownDish.displayName, menuItems);
        return {
          message: msg,
          action: 'ask_dish',
          matchedItems: menuMatch.length > 0 ? [{ item: menuMatch[0].item, quantity: 1 }] : undefined,
          intent,
          entities,
        };
      }

      // Fallback: try matching menu items by name
      const menuMatch = findMatchingItems(message, menuItems);
      if (menuMatch.length > 0) {
        const item = menuMatch[0].item;
        return {
          message: `**${item.name}** — $${item.price.toFixed(2)}\n\nWould you like to add it to your cart?`,
          action: 'ask_dish',
          matchedItems: [{ item, quantity: 1 }],
          intent,
          entities,
        };
      }

      return {
        message: getRandomResponse('ITEM_NOT_FOUND'),
        action: 'show_menu',
        intent,
        entities,
      };
    }

    // ---- ORDER ITEM (explicit "I want" / "give me") ----
    case 'ORDER_ITEM':
    case 'ADD_TO_CART': {
      const matchedItems = findMatchingItems(message, menuItems);

      if (matchedItems.length === 0) {
        const knownDish = detectDishFromKnowledge(message);
        if (knownDish) {
          const byName = menuItems.filter(m => m.name.toLowerCase() === knownDish.displayName.toLowerCase());
          if (byName.length > 0 && byName[0].available) {
            const dish = knownDish;
            const item = byName[0];
            const qty = entities.quantity || 1;
            const upsell = buildUpsell(dish, cart);
            const msg = getRandomResponse('ITEM_ADDED')
              .replace('{quantity}', qty.toString())
              .replace('{item}', item.name)
              .replace('{upsell}', upsell);
            return {
              message: msg,
              action: 'add_item',
              matchedItems: [{ item, quantity: qty, preference: entities.preference }],
              intent,
              entities,
            };
          }
        }
        return {
          message: getRandomResponse('ITEM_NOT_FOUND'),
          action: 'show_menu',
          intent,
          entities,
        };
      }

      const availableItems = matchedItems.filter(m => m.item.available);
      const unavailableItems = matchedItems.filter(m => !m.item.available);

      if (unavailableItems.length > 0 && availableItems.length === 0) {
        return {
          message: getRandomResponse('ITEM_UNAVAILABLE').replace('{item}', unavailableItems[0].item.name),
          action: 'show_menu',
          suggestedItems: menuItems.filter(m => m.available).slice(0, 3),
          intent,
          entities,
        };
      }

      const firstItem = availableItems[0];
      const knownDish = detectDishFromKnowledge(firstItem.item.name);
      const upsell = buildUpsell(knownDish, cart);

      let responseMsg: string;
      if (availableItems.length === 1) {
        const { item, quantity, preference } = availableItems[0];
        if (preference) {
          responseMsg = `Got it! 👍 ${quantity}x ${item.name} (${preference}) added.\n\n${upsell}`;
        } else {
          responseMsg = getRandomResponse('ITEM_ADDED')
            .replace('{quantity}', quantity.toString())
            .replace('{item}', item.name)
            .replace('{upsell}', upsell);
        }
      } else {
        const itemsList = availableItems.map(m => `${m.quantity}x ${m.item.name}`).join(' + ');
        responseMsg = `Love it! 🔥 Added ${itemsList} to your order.\n\n${upsell}`;
      }

      return {
        message: responseMsg,
        action: 'add_item',
        matchedItems: availableItems,
        intent,
        entities,
      };
    }

    // ---- REMOVE ITEM ----
    case 'REMOVE_ITEM': {
      const matchedItems = findMatchingItems(message, menuItems);
      const knownDish = detectDishFromKnowledge(message);
      const cartNames = cart.map(c => c.name.toLowerCase());

      if (knownDish && cartNames.includes(knownDish.displayName.toLowerCase())) {
        return {
          message: getRandomResponse('ITEM_REMOVED').replace('{item}', knownDish.displayName),
          action: 'remove_item',
          matchedItems: matchedItems.length > 0 ? [matchedItems[0]] : undefined,
          intent,
          entities,
        };
      }

      if (matchedItems.length > 0) {
        const inCart = matchedItems.find(m => cartNames.includes(m.item.name.toLowerCase()));
        if (inCart) {
          return {
            message: getRandomResponse('ITEM_REMOVED').replace('{item}', inCart.item.name),
            action: 'remove_item',
            matchedItems: [inCart],
            intent,
            entities,
          };
        }
      }

      return {
        message: "Which item would you like to remove? Here's your cart:",
        action: 'show_cart',
        intent,
        entities,
      };
    }

    // ---- VIEW CART ----
    case 'VIEW_CART': {
      if (cart.length === 0) {
        return {
          message: getRandomResponse('CART_EMPTY'),
          action: 'show_menu',
          intent,
          entities,
        };
      }
      return {
        message: getRandomResponse('VIEW_CART'),
        action: 'show_cart',
        intent,
        entities,
      };
    }

    // ---- CHECK PRICE ----
    case 'CHECK_PRICE': {
      const knownDish = detectDishFromKnowledge(message);
      if (knownDish) {
        const priceMatch = findMatchingItems(knownDish.displayName, menuItems);
        return {
          message: `${knownDish.displayName} is ${knownDish.price} 💰\n\n${knownDish.description}\n\nWould you like to add it to your cart?`,
          action: 'ask_dish',
          matchedItems: priceMatch.length > 0 ? [{ item: priceMatch[0].item, quantity: 1 }] : undefined,
          intent,
          entities,
        };
      }
      const matchedItems = findMatchingItems(message, menuItems);
      if (matchedItems.length > 0) {
        const item = matchedItems[0].item;
        return {
          message: `${item.name} is $${item.price.toFixed(2)} 💰\n\nWould you like to order it?`,
          action: 'ask_dish',
          matchedItems: [{ item, quantity: 1 }],
          intent,
          entities,
        };
      }

      // Cheapest / budget query
      if (normalized.includes('cheap') || normalized.includes('budget') || normalized.includes('affordable')) {
        const cheapest = findCheapestItem(menuItems.filter(m => m.available));
        if (cheapest) {
          return {
            message: `Looking for a deal? 💸 Our most affordable option is ${cheapest.name} at $${cheapest.price.toFixed(2)}!`,
            action: 'ask_dish',
            matchedItems: [{ item: cheapest, quantity: 1 }],
            suggestedItems: [cheapest],
            intent,
            entities,
          };
        }
      }

      return {
        message: "Check out our menu to see all prices! 💰",
        action: 'show_menu',
        intent,
        entities,
      };
    }

    // ---- RECOMMEND ----
    case 'RECOMMEND': {
      const popular = Object.values(DISH_KNOWLEDGE).filter(d => d.popular);
      const picks = popular.sort(() => Math.random() - 0.5).slice(0, 3);
      const list = picks.map(p => `• **${p.displayName}** — ${p.price}`).join('\n');
      return {
        message: `Great question! 🔥 Here are tonight's top picks:\n\n${list}\n\nJust type a dish name to add it, or say "tell me about" + name for details!`,
        intent,
        entities,
      };
    }

    // ---- RECOMMEND SPICY ----
    case 'RECOMMEND_SPICY': {
      const spicy = Object.values(DISH_KNOWLEDGE).filter(d => d.spicy);
      const list = spicy.map(d => `🔥 **${d.displayName}** — ${d.price}`).join('\n');
      return {
        message: `You like it hot! Here are our spicy dishes:\n\n${list}\n\nJust type a dish name to add it!`,
        intent,
        entities,
      };
    }

    // ---- RECOMMEND SEAFOOD ----
    case 'RECOMMEND_SEAFOOD': {
      const seafood = Object.values(DISH_KNOWLEDGE).filter(d => d.seafood);
      const picks = seafood.sort(() => Math.random() - 0.5).slice(0, 4);
      const list = picks.map(d => `🐟 **${d.displayName}** — ${d.price}`).join('\n');
      return {
        message: `We have some amazing seafood! 🦞\n\n${list}\n\nType a dish name to add it to your order!`,
        intent,
        entities,
      };
    }

    // ---- RECOMMEND LIGHT ----
    case 'RECOMMEND_LIGHT': {
      const light = Object.values(DISH_KNOWLEDGE).filter(d =>
        d.category === 'salad' || d.displayName.includes('Chicken') || d.displayName.includes('Salad')
      );
      const list = light.map(d => `🥗 **${d.displayName}** — ${d.price}`).join('\n');
      return {
        message: `Looking for something lighter? Great picks:\n\n${list}\n\nWant details on any of these?`,
        intent,
        entities,
      };
    }

    // ---- PARTY ORDER ----
    case 'PARTY_ORDER': {
      return {
        message: `🎉 Party time! That's awesome!\n\nFor groups, I'd suggest:\n• **Chargrilled Oysters** — great for sharing\n• **Cajun Seafood Dip** — crowd favorite\n• **Steak & Cheese Egg Rolls** — everyone loves these\n• **Seafood Trio** or **Marinated Lambchops** for mains\n\nHow many people are you dining with?`,
        action: 'show_menu',
        intent,
        entities,
      };
    }

    // ---- PLACE ORDER ----
    case 'PLACE_ORDER': {
      if (cart.length === 0) {
        return {
          message: getRandomResponse('CART_EMPTY'),
          action: 'show_menu',
          intent,
          entities,
        };
      }
      return {
        message: getRandomResponse('CHECKOUT'),
        action: 'checkout',
        intent,
        entities,
      };
    }

    // ---- CANCEL ORDER ----
    case 'CANCEL_ORDER': {
      return {
        message: getRandomResponse('CANCEL'),
        action: 'clear_cart',
        intent,
        entities,
      };
    }

    // ---- THANK YOU ----
    case 'THANK_YOU': {
      return {
        message: getRandomResponse('THANK_YOU'),
        intent,
        entities,
      };
    }

    // ---- HELP ----
    case 'HELP': {
      return {
        message: getRandomResponse('HELP'),
        intent,
        entities,
      };
    }

    // ---- ADD TIP ----
    case 'ADD_TIP': {
      const tipMatch = normalized.match(/\$?(\d+)/);
      if (tipMatch) {
        entities.tipAmount = parseInt(tipMatch[1]);
      }
      return {
        message: "Great! Let's add that tip 💰",
        action: 'show_tip',
        intent,
        entities,
      };
    }

    // ---- YES / CONFIRM ----
    case 'YES_CONFIRM': {
      return {
        message: "What would you like me to add? Just type the dish name!",
        intent,
        entities,
      };
    }

    // ---- UNKNOWN ----
    default: {
      // Last resort: try to match any menu item → auto-add to cart (like old behavior)
      const possibleItems = findMatchingItems(message, menuItems);
      if (possibleItems.length > 0 && possibleItems[0].item.available) {
        const { item, quantity, preference } = possibleItems[0];
        const knownDish = detectDishFromKnowledge(item.name);
        const upsell = buildUpsell(knownDish, cart);

        let msg: string;
        if (preference) {
          msg = `Got it! 👍 ${quantity}x ${item.name} (${preference}) added.\n\n${upsell}`;
        } else {
          msg = getRandomResponse('ITEM_ADDED')
            .replace('{quantity}', quantity.toString())
            .replace('{item}', item.name)
            .replace('{upsell}', upsell);
        }
        msg += '\n' + getRandomResponse('FOLLOWUP');

        return {
          message: msg,
          action: 'add_item',
          matchedItems: [possibleItems[0]],
          intent: 'ORDER_ITEM',
          entities,
        };
      }

      return {
        message: getRandomResponse('UNKNOWN'),
        intent: 'UNKNOWN',
        entities,
      };
    }
  }
}

// ============================================
// EXPORTS
// ============================================
export { normalize, detectIntent, extractQuantity, extractPreference, detectDishFromKnowledge, DISH_KNOWLEDGE };
