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
    dishName?: string;
    modifiers?: string[];
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
  | 'DRINK_REQUEST'
  | 'VEGETARIAN_REQUEST'
  | 'SYSTEM_QUESTION'
  | 'VAGUE_MESSAGE'
  | 'CASUAL_CHAT'
  | 'UNKNOWN';

// ============================================
// CONVERSATION CONTEXT (Memory)
// ============================================
export interface ConversationContext {
  lastPreference?: string;
  lastAction?: string;
  lastDishAsked?: string;
  preferences: string[];
}

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

interface ParsedDishIntent {
  dishName?: string;
  category?: string;
  modifiers: string[];
  tokens: string[];
  isGeneric: boolean;
}

interface MenuSearchMetadata {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  tags: string[];
  synonyms: string[];
}

interface RankedMenuMatch {
  item: MenuItem;
  score: number;
  quantity: number;
  preference?: string;
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
  DRINK_REQUEST: ['beer', 'wine', 'cocktail', 'cocktails', 'drink', 'drinks', 'something to drink', 'beverages', 'drink menu', 'a drink', 'bourbon', 'whiskey', 'whisky', 'vodka', 'tequila', 'margarita', 'mojito', 'rum', 'gin', 'sangria', 'mimosa', 'champagne', 'prosecco', 'soda', 'juice', 'lemonade', 'iced tea'],
  VEGETARIAN_REQUEST: ['paneer', 'vegetarian', 'no meat', 'plant based', 'vegan', 'meatless', 'veggie', 'vegetarian options', 'veg options', 'meatfree', 'meat free', 'without meat'],
  SYSTEM_QUESTION: ['how do you work', 'what are you', 'who are you', 'who made you', 'are you real', 'are you ai', 'are you a bot', 'are you human', 'your name', 'what is sia', 'who is sia', 'what company', 'who built you', 'who created you'],
  VAGUE_MESSAGE: ['im hungry', 'hungry', 'i dont know', 'whatever', 'surprise me', 'dealers choice', 'not sure', 'idk', 'feed me', 'hmm', 'hmmm', 'umm', 'ummm', 'dunno', 'no idea', 'you pick', 'you choose', 'just something'],
  CASUAL_CHAT: ['how are you', 'whats up', 'wassup', 'sup', 'hows it going', 'good morning', 'good evening', 'good afternoon', 'good night', 'hey there', 'yo', 'heya'],
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
  { pattern: /no egg|without egg/i, value: 'no egg' },
  { pattern: /no onion|without onion/i, value: 'no onion' },
  { pattern: /no garlic|without garlic/i, value: 'no garlic' },
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
    "Hey! Welcome to Coasis! 🍽️ I'm SIA, your personal waiter tonight.\n\n🔥 What's hot right now:\n• Marinated Lambchops — absolute favorite\n• Seafood Trio — fresh catch of the day\n• Strip Steak — cooked to perfection\n\nWhat catches your eye? Just type a dish name and I'll tell you all about it!",
    "Welcome in! 👋 I'm SIA — think of me as your table-side assistant.\n\nHungry? Here's what people are loving tonight:\n• Marinated Lambchops 🔥\n• Southern Fried Chicken\n• Chargrilled Oysters\n\nJust say a dish name and I'll break it down for you, or say 'menu' to browse!",
    "Hey there! 🍴 Welcome to Coasis Restaurant Bar & Suites!\n\nI'm SIA — I know every dish on this menu. Ask me about anything!\n\nFeeling adventurous? Try 'something spicy' or 'seafood' — or just browse the menu!",
  ],
  VIEW_MENU: [
    "Here's the full lineup! 👇 Tap a category or just type any dish name — I'll tell you what makes it special.",
    "Coming right up! 🔥 Take a look and let me know what catches your eye. I can explain any dish in detail!",
    "Here's what Chef has going tonight! Browse around, and just type a dish name if you want the full story on it.",
  ],
  ITEM_ADDED: [
    "Nice pick! 👍 {quantity}x {item} — locked in.\n\n{upsell}",
    "Done and done! 🎉 {quantity}x {item} heading your way.\n\n{upsell}",
    "Good taste! {quantity}x {item} added to your order! 👌\n\n{upsell}",
    "You got it! {quantity}x {item} is on the list. 🔥\n\n{upsell}",
  ],
  ITEM_REMOVED: [
    "Taken care of! {item} is off your order. 👍\n\nAnything else you'd like to change, or ready to keep going?",
    "Done! {item} removed. No worries at all.\n\nWant to add something else instead?",
  ],
  ITEM_NOT_FOUND: [
    "Hmm, I don't think we have that one. 🤔 But no worries — let me help!\n\nAre you in the mood for something meaty, seafood, or lighter? I'll point you in the right direction!",
    "That's not on our menu, but I've got plenty of great suggestions!\n\nTell me what you're craving — spicy? Seafood? Something hearty? I'll find your perfect match.",
    "I couldn't find that one here. But hey, Coasis has some amazing options!\n\nWhat vibe are you going for? I'll steer you right. 🍽️",
  ],
  ITEM_UNAVAILABLE: [
    "Ah, bummer! 😔 {item} is unavailable right now.\n\nBut I've got some great alternatives — want me to suggest something similar?",
  ],
  VIEW_CART: [
    "Let's see what we've got going! Here's your order so far:",
    "Here's the rundown of your order:",
    "Alright, here's everything you've added:",
  ],
  CART_EMPTY: [
    "Your cart's looking lonely! 😄 Let's fix that.\n\nWhat are you in the mood for? Type a dish name or say 'menu' to browse!",
    "Nothing in the cart yet! No rush — browse the menu or tell me what you're craving.",
  ],
  CHECKOUT: [
    "Alright, let's get this order in! 👍 Sending it to the kitchen now...",
    "Perfect! Submitting your order — sit tight! 🍳",
  ],
  CANCEL: [
    "All cleared! 🗑️ Fresh start. What would you like instead?",
    "Cart's empty now! Ready for a do-over. What sounds good?",
  ],
  THANK_YOU: [
    "Anytime! 😊 Need anything else? I'm right here.",
    "You're welcome! Enjoy your meal! 🍽️ Just holler if you need me.",
    "Cheers! 🎉 Let me know if anything else comes to mind.",
  ],
  HELP: [
    "No worries, I've got you! Here's the easy version: 👇\n\n🍽️ **Browse** — Say 'menu' or a category like 'seafood' or 'appetizers'\n💬 **Learn** — Type a dish name (like 'lamb chops') and I'll describe it\n🛒 **Order** — Say 'add lamb chops' or 'I want the steak' to add directly\n✅ **Checkout** — Say 'place order' when you're ready\n\nPro tips:\n• Ask me 'what's good?' for recommendations\n• Say 'something spicy' for heat lovers\n• Say 'how much is...' for pricing\n\nWhat would you like to start with?",
  ],
  UNKNOWN: [
    "Hmm, I didn't catch that one. 😅 No worries though!\n\nTry typing a dish name like 'steak' or 'oysters' — I'll tell you all about it. Or say 'menu' to browse everything!",
    "Not sure what you mean, but I'm here to help! 🍽️\n\nWant to see the menu? Or just tell me what kind of food you're craving!",
    "I got a little lost there! But hey, just type a dish name and I'll describe it, or say 'menu' to see everything we've got.",
  ],
  FOLLOWUP: [
    "What else can I get you?",
    "Anything else catching your eye?",
    "Want to add something else to go with that?",
    "Still hungry? I've got more suggestions! 😄",
  ],
  DRINK_REQUEST: [
    "Great taste! 🍹 For cocktails, beer, and wine — our bar team has you covered!\n\nJust let your waiter know, or tap 'Call Waiter' and they'll come right over with the drink menu.\n\nIn the meantime, want to check out our food menu? We've got some amazing appetizers that pair perfectly with drinks!",
    "Looking for a drink? 🥂 Our bar has a full selection of cocktails, wine, beer, and more!\n\nTap 'Call Waiter' to get the drink menu brought to your table.\n\nWhile you wait, how about browsing our appetizers? The Chargrilled Oysters go amazing with a cold beer! 🦞",
  ],
  VEGETARIAN_REQUEST: [
    "I hear you! 🥗 While our menu leans toward seafood and grilled meats, we do have some great options:\n\n• **Coasis House Salad** — $14 (fresh & flavorful)\n• **Grilled Caesar Salad** — $16 (classic done right)\n• **Brownie Bites** — $10 (for dessert!)\n\nI can also ask the kitchen about modifying dishes. Want me to call a waiter to discuss options?",
    "Totally get it! 🌱 Here's what works great for vegetarians:\n\n🥗 **Coasis House Salad** — $14\n🥗 **Grilled Caesar Salad** — $16\n🍫 **Brownie Bites** — $10\n\nWant to add any of these? Just type the name!",
  ],
  SYSTEM_QUESTION: [
    "I'm SIA — your Smart Interactive Assistant! 🤖 I work right here at Coasis Restaurant Bar & Suites.\n\nI know the entire menu, can describe any dish, take your order, and get it straight to the kitchen. Think of me as your digital waiter! 🍽️\n\nSo... what are you hungry for?",
    "Hey! I'm SIA, Coasis's AI ordering assistant. 🤖\n\nI'm built to make your dining experience smooth — ask me about any dish, I'll tell you what's in it, what pairs well, and add it to your order when you're ready.\n\nReady to explore the menu?",
  ],
  VAGUE_MESSAGE: [
    "No worries, I'll help you decide! 🤔\n\nHere's what I'd go with tonight:\n• 🔥 **Marinated Lambchops** — our number one seller\n• 🦞 **Seafood Trio** — if you love the ocean\n• 🍗 **Southern Fried Chicken** — comfort food done right\n\nJust type a dish name and I'll tell you everything about it!",
    "Let me make it easy! Here are tonight's can't-miss picks:\n\n• **Strip Steak** — $30 (meat lover's dream)\n• **Chargrilled Oysters** — $18 (smoky and buttery)\n• **Coasis Burger** — $18 (if you want something classic)\n\nType any dish name to learn more, or say 'menu' to see it all!",
    "Surprise you? I thought you'd never ask! 🎉\n\nIf I were sitting at your table, I'd go with the **Marinated Lambchops** ($42) — they're unreal. Pair them with **Chargrilled Oysters** to start and you're golden.\n\nWant me to tell you more about either one?",
  ],
  CASUAL_CHAT: [
    "I'm doing great, thanks for asking! 😊 Ready to help you have an amazing meal.\n\nSo, what are you in the mood for tonight? Anything catch your eye yet?",
    "Hey hey! 👋 I'm always good when there's good food around!\n\nLet's get you something delicious. Want to see the menu or hear my recommendations?",
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

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'us', 'please', 'want', 'need', 'like', 'have', 'get', 'give', 'add',
  'to', 'for', 'with', 'without', 'and', 'or', 'the', 'a', 'an', 'this', 'that', 'it', 'some',
  'show', 'menu', 'can', 'could', 'would', 'should', 'is', 'are', 'of', 'on', 'in', 'at', 'from',
  'place', 'order', 'myself', 'your', 'our', 'do', 'make', 'put', 'include', 'one', 'two', 'three',
]);

const MODIFIER_WORDS = new Set([
  'fried', 'grilled', 'spicy', 'mild', 'crispy', 'hot', 'cold', 'vegan', 'vegetarian', 'veg',
  'chicken', 'beef', 'lamb', 'fish', 'seafood', 'shrimp', 'crab', 'lobster', 'salmon', 'rice',
]);

const PROTEIN_MODIFIERS = new Set([
  'chicken', 'beef', 'lamb', 'fish', 'seafood', 'shrimp', 'crab', 'lobster', 'salmon',
]);

const GENERIC_QUERY_TERMS = new Set([
  'fried', 'spicy', 'veg', 'vegan', 'vegetarian', 'seafood', 'fish', 'chicken', 'rice', 'salad',
  'starter', 'appetizer', 'main', 'dessert', 'drink', 'drinks', 'food',
]);

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

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = normalize(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
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

function extractMeaningfulTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function parseDishIntent(text: string): ParsedDishIntent {
  const tokens = extractMeaningfulTokens(text);
  const category = detectCategory(text) || undefined;
  const modifiers = tokens.filter(t => MODIFIER_WORDS.has(t));

  const dishTokens = tokens.filter(t => !STOP_WORDS.has(t));
  const dishNameTokens = dishTokens.filter((token, idx) => !(idx === 0 && PROTEIN_MODIFIERS.has(token)));
  const dishName = dishNameTokens.length > 0 ? dishNameTokens.join(' ') : undefined;

  const isGeneric =
    !dishName ||
    (dishNameTokens.length === 1 && GENERIC_QUERY_TERMS.has(dishNameTokens[0]));

  return { dishName, category, modifiers, tokens, isGeneric };
}

function buildMenuMetadata(item: MenuItem): MenuSearchMetadata {
  const normalizedName = normalize(item.name);
  const dish = Object.values(DISH_KNOWLEDGE).find(d => normalize(d.displayName) === normalizedName);
  const knowledgeKeywords = dish?.keywords ?? [];

  const baseKeywords = [
    normalizedName,
    ...normalizedName.split(' ').filter(w => w.length > 2),
    ...knowledgeKeywords,
    ...(item.keywords || []),
  ];

  const tags = uniqueStrings([
    ...baseKeywords,
    normalize(item.category),
    ...(item.tags || []),
    dish?.spicy ? 'spicy' : '',
    dish?.seafood ? 'seafood' : '',
  ].filter(Boolean));

  const keywords = uniqueStrings(baseKeywords);

  return {
    id: String(item.id),
    name: normalizedName,
    category: normalize(item.category),
    keywords,
    tags,
    synonyms: uniqueStrings([
      ...keywords,
      ...(item.synonyms || []),
    ]),
  };
}

function scoreMenuItem(text: string, intent: ParsedDishIntent, item: MenuItem, metadata: MenuSearchMetadata): number {
  const normalizedInput = normalize(text);
  let score = 0;

  // Exact dish match
  if (
    (intent.dishName && (metadata.name === intent.dishName || metadata.synonyms.includes(intent.dishName))) ||
    normalizedInput === metadata.name
  ) {
    score += 100;
  } else if (
    intent.dishName &&
    (metadata.name.includes(intent.dishName) || metadata.synonyms.some(s => s.includes(intent.dishName)))
  ) {
    score += 70;
  }

  const modifierHit = intent.modifiers.some(mod => metadata.tags.includes(mod) || metadata.keywords.includes(mod));
  if (modifierHit) score += 40;

  if (intent.category && metadata.category === normalize(intent.category)) {
    score += 20;
  }

  // Token overlap bonus to break ties
  const preciseTokens = intent.tokens.filter(t => !GENERIC_QUERY_TERMS.has(t));
  const overlap = preciseTokens.filter(t =>
    metadata.name.includes(t) || metadata.keywords.some(k => k.includes(t)) || metadata.tags.includes(t)
  );
  if (overlap.length > 0) {
    score += Math.min(overlap.length * 10, 30);
  }

  // Soft penalty for vague single-word queries
  if (intent.isGeneric && score < 70) {
    score -= 15;
  }

  if (!item.available) {
    score -= 25;
  }

  return score;
}

function findRankedMatchingItems(
  text: string,
  menuItems: MenuItem[]
): { matches: { item: MenuItem; quantity: number; preference?: string }[]; requiresClarification: boolean; intent: ParsedDishIntent } {
  const quantity = extractQuantity(text);
  const preference = extractPreference(text);
  const intent = parseDishIntent(text);

  const scored: RankedMenuMatch[] = menuItems
    .map((item) => {
      const metadata = buildMenuMetadata(item);
      const score = scoreMenuItem(text, intent, item, metadata);
      return { item, score, quantity, preference };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const limited = scored.slice(0, 5);
  const topScore = limited[0]?.score ?? 0;
  const secondScore = limited[1]?.score ?? 0;

  const requiresClarification =
    intent.isGeneric ||
    topScore < 60 ||
    (!intent.dishName && limited.length > 1 && topScore - secondScore < 20);

  return {
    matches: limited.map(({ item, quantity, preference }) => ({ item, quantity, preference })),
    requiresClarification,
    intent,
  };
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
  return findRankedMatchingItems(text, menuItems).matches;
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

  // Check casual chat (how are you, etc.) — before other checks
  for (const keyword of INTENT_PATTERNS.CASUAL_CHAT) {
    if (normalized.includes(keyword)) return 'CASUAL_CHAT';
  }

  // Check system questions (who are you, etc.)
  for (const keyword of INTENT_PATTERNS.SYSTEM_QUESTION) {
    if (normalized.includes(keyword)) return 'SYSTEM_QUESTION';
  }

  // Check drink requests — before menu matching (drinks aren't on food menu)
  for (const keyword of INTENT_PATTERNS.DRINK_REQUEST) {
    if (normalized.includes(keyword)) return 'DRINK_REQUEST';
  }

  // Check vegetarian requests
  for (const keyword of INTENT_PATTERNS.VEGETARIAN_REQUEST) {
    if (normalized.includes(keyword)) return 'VEGETARIAN_REQUEST';
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

  // Check vague messages (hungry, whatever, surprise me, hmm)
  for (const keyword of INTENT_PATTERNS.VAGUE_MESSAGE) {
    if (normalized.includes(keyword)) return 'VAGUE_MESSAGE';
  }

  // ---- FALLBACK: If message matches a dish keyword, DESCRIBE first (don't auto-add) ----
  const knownDish = detectDishFromKnowledge(text);
  if (knownDish) return 'ASK_ABOUT_DISH';

  // Check if it matches a menu item name
  const menuMatch = findMatchingItems(text, menuItems);
  if (menuMatch.length > 0) return 'ASK_ABOUT_DISH';

  return 'UNKNOWN';
}

// ============================================
// BUILD DISH DESCRIPTION MESSAGE
// ============================================
function buildDishDescription(dish: DishInfo): string {
  let msg = `Here\u2019s ${dish.displayName} 😋\n${dish.description}\n\n${dish.details}\n\n💰 ${dish.price}`;

  if (dish.pairings.length > 0) {
    msg += `\n\n🍽️ Pairs well with:\n${dish.pairings.map(p => `• ${p}`).join('\n')}`;
  }

  msg += `\n\nWant me to add it to your cart?`;
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
  cart: CartItem[],
  context?: ConversationContext
): ChatbotResponse {
  const normalized = normalize(message);
  const intent = detectIntent(message, menuItems, cart);
  const parsedDishIntent = parseDishIntent(message);
  const entities: ChatbotResponse['entities'] = {};

  entities.quantity = extractQuantity(message);
  entities.preference = extractPreference(message);
  entities.category = detectCategory(message) || parsedDishIntent.category || undefined;
  entities.dishName = parsedDishIntent.dishName;
  entities.modifiers = parsedDishIntent.modifiers;

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
      const ranked = findRankedMatchingItems(message, menuItems);
      if (ranked.requiresClarification) {
        const suggestions = ranked.matches.slice(0, 3).map(m => m.item.name).join(', ');
        return {
          message: suggestions
            ? `Just to be sure 😅 which dish did you mean? I heard: ${suggestions}. Tell me the exact name so I nail it.`
            : `That sounds tasty! 👀 Can you share the full dish name (e.g., "chicken fried rice") so I don't guess?`,
          action: 'show_menu',
          suggestedItems: ranked.matches.slice(0, 3).map(m => m.item),
          intent,
          entities,
        };
      }

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
      const ranked = findRankedMatchingItems(message, menuItems);
      const matchedItems = ranked.matches;

      if (ranked.requiresClarification) {
        return {
          message: `I’m catching a vibe, but tell me the exact dish so I don’t guess 😅 Think: "crab fried rice", "lobster & crab fried rice", or "southern fried chicken".`,
          action: 'show_menu',
          suggestedItems: matchedItems.slice(0, 3).map(m => m.item),
          intent,
          entities,
        };
      }

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
      const ranked = findRankedMatchingItems(message, menuItems);
      if (ranked.requiresClarification) {
        return {
          message: `Happy to check! 👀 Tell me the exact dish name so I give you the right price (no mix-ups).`,
          action: 'show_menu',
          suggestedItems: ranked.matches.slice(0, 3).map(m => m.item),
          intent,
          entities,
        };
      }

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
        message: "Sure thing! What would you like me to add? Just type the dish name — or say 'menu' to browse!",
        intent,
        entities,
      };
    }

    // ---- DRINK REQUEST ----
    case 'DRINK_REQUEST': {
      return {
        message: getRandomResponse('DRINK_REQUEST'),
        intent,
        entities,
      };
    }

    // ---- VEGETARIAN REQUEST ----
    case 'VEGETARIAN_REQUEST': {
      const vegItems = menuItems.filter(m =>
        m.name.toLowerCase().includes('salad') ||
        m.name.toLowerCase().includes('house') ||
        m.category.toLowerCase() === 'salads' ||
        m.name.toLowerCase().includes('brownie')
      );
      const list = vegItems.map(v => `• **${v.name}** — $${v.price.toFixed(2)}`).join('\n');
      const msg = list
        ? `I hear you! 🥗 Here are our best vegetarian-friendly options:\n\n${list}\n\nType a dish name for the full description, or say 'add' + name to order!`
        : getRandomResponse('VEGETARIAN_REQUEST');
      return {
        message: msg,
        suggestedItems: vegItems.length > 0 ? vegItems : undefined,
        intent,
        entities,
      };
    }

    // ---- SYSTEM QUESTION ----
    case 'SYSTEM_QUESTION': {
      return {
        message: getRandomResponse('SYSTEM_QUESTION'),
        intent,
        entities,
      };
    }

    // ---- VAGUE MESSAGE ----
    case 'VAGUE_MESSAGE': {
      // Use context preferences to give smarter recommendations
      if (context?.preferences?.includes('spicy')) {
        const spicy = Object.values(DISH_KNOWLEDGE).filter(d => d.spicy);
        const picks = spicy.sort(() => Math.random() - 0.5).slice(0, 3);
        const list = picks.map(p => `🔥 **${p.displayName}** — ${p.price}`).join('\n');
        return {
          message: `Since you like it spicy, how about these? 🌶️\n\n${list}\n\nType a name to learn more!`,
          intent,
          entities,
        };
      }
      if (context?.preferences?.includes('seafood')) {
        const seafood = Object.values(DISH_KNOWLEDGE).filter(d => d.seafood);
        const picks = seafood.sort(() => Math.random() - 0.5).slice(0, 3);
        const list = picks.map(p => `🦞 **${p.displayName}** — ${p.price}`).join('\n');
        return {
          message: `I remember you like seafood! How about these? 🐟\n\n${list}\n\nType a name to learn more!`,
          intent,
          entities,
        };
      }
      return {
        message: getRandomResponse('VAGUE_MESSAGE'),
        intent,
        entities,
      };
    }

    // ---- CASUAL CHAT ----
    case 'CASUAL_CHAT': {
      return {
        message: getRandomResponse('CASUAL_CHAT'),
        intent,
        entities,
      };
    }

    // ---- UNKNOWN ----
    default: {
      // Last resort: try to match a dish → DESCRIBE it (don't auto-add)
      const ranked = findRankedMatchingItems(message, menuItems);
      if (ranked.requiresClarification) {
        return {
          message: `I spotted a few possibilities, but I don't want to guess 😅 Drop the full dish name and I'll handle it.`,
          action: 'show_menu',
          suggestedItems: ranked.matches.slice(0, 3).map(m => m.item),
          intent: 'UNKNOWN',
          entities,
        };
      }

      const possibleItems = ranked.matches;
      if (possibleItems.length > 0 && possibleItems[0].item.available) {
        const item = possibleItems[0].item;
        const knownDish = detectDishFromKnowledge(item.name);
        if (knownDish) {
          const msg = buildDishDescription(knownDish);
          return {
            message: msg,
            action: 'ask_dish',
            matchedItems: [{ item, quantity: 1 }],
            intent: 'ASK_ABOUT_DISH',
            entities,
          };
        }
        return {
          message: `**${item.name}** — $${item.price.toFixed(2)}\n\nWant me to add it to your cart?`,
          action: 'ask_dish',
          matchedItems: [{ item, quantity: 1 }],
          intent: 'ASK_ABOUT_DISH',
          entities,
        };
      }

      // Check if user might be naming something not on the menu — give helpful suggestion
      const preference = extractPreference(message);
      if (preference) {
        const suggested = Object.values(DISH_KNOWLEDGE)
          .filter(d => preference === 'spicy' ? d.spicy : preference === 'seafood' ? d.seafood : d.popular)
          .slice(0, 3);
        if (suggested.length > 0) {
          const list = suggested.map(s => `• **${s.displayName}** — ${s.price}`).join('\n');
          return {
            message: `I couldn't find that exact dish, but based on your taste, you might love:\n\n${list}\n\nType a name to learn more!`,
            intent: 'UNKNOWN',
            entities,
          };
        }
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
