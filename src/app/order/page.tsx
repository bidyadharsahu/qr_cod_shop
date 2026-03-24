'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { processChatMessage, type ChatbotResponse, type ConversationContext } from '@/lib/chatbot';
import { getCurrentTheme, applyTheme, type AppTheme } from '@/lib/themes';
import jsPDF from 'jspdf';
import { 
  Send, ShoppingCart, Plus, Minus, Trash2, Star,
  FileText, Check, MessageCircle, Download, 
  Heart, PhoneCall, Clock, Sparkles, Flame
} from 'lucide-react';
import { calculateOrderTotal } from '@/lib/calculations';

const ADMIN_WHATSAPP = '+16562145190';
const TIP_OPTIONS = [0, 10, 15, 20, 25];

interface CartItem extends MenuItem {
  quantity: number;
}

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  content: string;
  createdAt: number;
  options?: { label: string; value: string }[];
  showMenu?: boolean;
  showCart?: boolean;
  showTip?: boolean;
  showRating?: boolean;
  showBill?: boolean;
}

const formatDayLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function OrderContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table');

  // Helper: read table from cookie (synchronous, works in all browsers)
  const getTableFromCookie = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)netrikxr-table=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Helper: save table to both localStorage and cookie
  const persistTable = (table: string) => {
    try { localStorage.setItem('netrikxr-table', table); } catch (_) {}
    document.cookie = `netrikxr-table=${encodeURIComponent(table)};path=/;max-age=${60*60*24*30};SameSite=Lax`;
  };

  // Table number: URL param > cookie > localStorage > '1'
  // Initialize synchronously so table is correct on first render
  const [tableNumber, setTableNumber] = useState(() => {
    if (tableParam) return tableParam;
    if (typeof document !== 'undefined') {
      const fromCookie = getTableFromCookie();
      if (fromCookie) return fromCookie;
      try { return localStorage.getItem('netrikxr-table') || '1'; } catch (_) {}
    }
    return '1';
  });

  // When URL param changes (new QR scan), update and persist
  useEffect(() => {
    if (tableParam && tableParam !== tableNumber) {
      setTableNumber(tableParam);
    }
    // Always persist current table
    persistTable(tableParam || tableNumber);
  }, [tableParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  const [selectedTip, setSelectedTip] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [canInstallPWA, setCanInstallPWA] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => getCurrentTheme());
  const [favorites, setFavorites] = useState<number[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('netrikxr-favorites') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [lastAskedItem, setLastAskedItem] = useState<MenuItem | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({ preferences: [] });
  const [orderCount, setOrderCount] = useState(0);
  const [submittedQuantities, setSubmittedQuantities] = useState<Record<number, number>>({});
  const [lastSubmittedSubtotal, setLastSubmittedSubtotal] = useState(0);
  const [lastSubmittedItemsCount, setLastSubmittedItemsCount] = useState(0);
  const [lastOrderWasAddOn, setLastOrderWasAddOn] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const calculation = calculateOrderTotal(subtotal, selectedTip);
  const { tipAmount, taxAmount, total } = calculation;
  const categories = [...new Set(menuItems.map(i => i.category))];

  // Track online/offline state
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Apply occasion-based theme on mount
  useEffect(() => {
    const currentTheme = getCurrentTheme();
    setTheme(currentTheme);
    applyTheme(currentTheme);
  }, []);

  // Persist favorites
  useEffect(() => {
    try { localStorage.setItem('netrikxr-favorites', JSON.stringify(favorites)); } catch (_) {}
  }, [favorites]);

  // If the customer empties cart after the flow completes, start a fresh add-on baseline.
  useEffect(() => {
    if (cart.length === 0 && !waitingForConfirmation) {
      setSubmittedQuantities({});
      setLastOrderWasAddOn(false);
      setLastSubmittedItemsCount(0);
      setLastSubmittedSubtotal(0);
    }
  }, [cart.length, waitingForConfirmation]);

  // Toggle favorite
  const toggleFavorite = (itemId: number) => {
    setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  // Call waiter function
  const callWaiter = async () => {
    if (callingWaiter) return;
    setCallingWaiter(true);
    try {
      await supabase.from('orders').insert({
        table_number: parseInt(tableNumber),
        items: [{ id: 0, name: 'WAITER CALL', quantity: 1, price: 0 }],
        subtotal: 0, tip_amount: 0, tax_amount: 0, total: 0,
        status: 'pending', payment_status: 'unpaid',
        receipt_id: `CALL-${tableNumber}-${Date.now().toString().slice(-4)}`,
        customer_note: 'Customer is calling for a waiter'
      });
      addBotMessage('🔔 Waiter has been notified! Someone will be at your table shortly.', [
        { label: '🍹 See Menu', value: 'menu' },
        { label: '💬 Chat with SIA', value: 'recommend' }
      ]);
    } catch { 
      addBotMessage('❌ Could not call waiter. Please try again.', []);
    }
    setTimeout(() => setCallingWaiter(false), 10000); // Cooldown
  };

  // Detect PWA install availability and standalone mode
  useEffect(() => {
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if install prompt is already available
    if ((window as any).__pwaInstallPrompt) {
      setCanInstallPWA(true);
    }

    // Listen for install prompt becoming available
    const handleInstallAvailable = () => setCanInstallPWA(true);
    window.addEventListener('pwa-install-available', handleInstallAvailable);

    // Listen for app installed (clear install state)
    const handleInstalled = () => setCanInstallPWA(false);
    window.addEventListener('appinstalled', handleInstalled);

    // Listen for our custom pwa-installed event with redirect info
    const handlePWAInstalled = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetUrl) {
        // Store the open-app URL so we can show an "Open App" button
        sessionStorage.setItem('netrikxr-open-url', detail.targetUrl);
      }
    };
    window.addEventListener('pwa-installed', handlePWAInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('pwa-installed', handlePWAInstalled);
    };
  }, []);

  // Initial fetch + real-time menu sync
  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await supabase.from('menu_items').select('*').eq('available', true).order('category');
      if (data) setMenuItems(data as MenuItem[]);
    };
    fetchMenu();

    // Real-time menu updates
    const menuSub = supabase
      .channel('menu-realtime-order')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    // Re-fetch when app returns from background (PWA resume)
    const handleResume = () => {
      console.log('[Order] PWA resumed, re-fetching menu...');
      fetchMenu();
    };
    window.addEventListener('pwa-resume', handleResume);
    window.addEventListener('pwa-online', handleResume);

    return () => {
      supabase.removeChannel(menuSub);
      window.removeEventListener('pwa-resume', handleResume);
      window.removeEventListener('pwa-online', handleResume);
    };
  }, []);

  // Listen for order confirmation/cancellation from admin
  useEffect(() => {
    if (!currentOrderId || !waitingForConfirmation) return;

    const orderSub = supabase
      .channel('order-confirmation')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrderId}`
        },
        (payload: any) => {
          if (payload.new.status === 'confirmed') {
            setWaitingForConfirmation(false);
            addBotMessage(
              `✅ Your ${lastOrderWasAddOn ? 'add-on ' : ''}order has been confirmed!\n\nReceipt: ${receiptId}\nTable: ${tableNumber}\nItems: ${lastSubmittedItemsCount}\nSubtotal: $${lastSubmittedSubtotal.toFixed(2)}\n\n🍹 Your drinks are being prepared!\n💵 Pay cash to the manager when ready.`,
              [
                { label: '➕ Order More', value: 'more' },
                { label: '💵 Add Tip & Bill', value: 'pay' }
              ]
            );
          } else if (payload.new.status === 'cancelled') {
            setWaitingForConfirmation(false);
            setCurrentOrderId(null);
            addBotMessage(
              `😔 Sorry, this item is currently unavailable.\n\nWould you like to see the menu again?`,
              [
                { label: '🍹 Show Menu', value: 'menu' },
                { label: '💬 Get Recommendation', value: 'recommend' }
              ]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSub);
    };
  }, [currentOrderId, waitingForConfirmation, receiptId, tableNumber, lastSubmittedSubtotal, lastSubmittedItemsCount, lastOrderWasAddOn]);

  // Welcome message - show install prompt if available, otherwise themed welcome
  useEffect(() => {
    if (menuItems.length > 0 && chatMessages.length === 0) {
      // Count previous orders from this table (for loyalty feature)
      const storedCount = parseInt(localStorage.getItem('netrikxr-order-count') || '0');
      setOrderCount(storedCount);
      const loyaltyMsg = storedCount > 0 ? `\n\n🌟 Welcome back! You've ordered ${storedCount} time${storedCount > 1 ? 's' : ''} with us!` : '';

      if (canInstallPWA && !isStandalone) {
        addBotMessage(
          `Welcome to Coasis! ${theme.emoji}\n\nI'm SIA, your ordering assistant at Table ${tableNumber}.${loyaltyMsg}\n\n📲 For the best experience, install our app! It's instant and takes no storage.`,
          [
            { label: '📲 Install App', value: 'install_app' },
            { label: '⏭️ Skip, Order Now', value: 'skip_install' }
          ]
        );
      } else {
        addBotMessage(
          `Welcome to Coasis! ${theme.emoji}\n\nI'm SIA, your ordering assistant at Table ${tableNumber}.${loyaltyMsg}\n\n🔥 Popular tonight:\n• Marinated Lambchops\n• Seafood Trio\n• Strip Steak\n\nWhat would you like to try?`,
          [
            { label: '🍽️ See Menu', value: 'menu' },
            { label: '🔥 Popular', value: 'popular' },
            { label: '🌶️ Spicy', value: 'spicy' },
            { label: '🦞 Seafood', value: 'seafood' },
            { label: '❤️ Favorites', value: 'favorites' },
            { label: '❓ Help', value: 'help' }
          ]
        );
      }
    }
  }, [menuItems, tableNumber, chatMessages.length, canInstallPWA, isStandalone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto scroll
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [chatMessages, isBotTyping]);

  function addBotMessage(content: string, options?: { label: string; value: string }[], extra?: Partial<ChatMessage>) {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'bot',
      content,
      createdAt: Date.now(),
      options,
      ...extra
    };
    setChatMessages(prev => [...prev, msg]);
  }

  const addUserMessage = (content: string) => {
    setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content, createdAt: Date.now() }]);
  };

  const humanizeBotResponse = async (userMessage: string, baseResponse: ChatbotResponse): Promise<ChatbotResponse> => {
    if (!baseResponse.message?.trim()) return baseResponse;

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          baseMessage: baseResponse.message,
          intent: baseResponse.intent,
          entities: baseResponse.entities,
        }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      if (!res.ok) return baseResponse;

      const data = await res.json() as { message?: string };
      const improvedMessage = data.message?.trim();

      if (!improvedMessage) return baseResponse;

      return {
        ...baseResponse,
        message: improvedMessage,
      };
    } catch {
      return baseResponse;
    }
  };

  // Handle PWA install from chatbot
  const handlePWAInstall = async () => {
    const doInstall = (window as any).__pwaDoInstall;
    if (!doInstall) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        addBotMessage(
          `?? **Install on iPhone:**\n\n` +
          `1?? Tap the **Share** button ?? (bottom center of Safari)\n` +
          `2?? Scroll down ? tap **"Add to Home Screen"**\n` +
          `3?? Tap **"Add"** in the top right\n\n` +
          `Then open **"Coasis"** from your home screen � it'll work just like a real app! ??\n\n` +
          `?? Your table number (${tableNumber}) is saved automatically.`,
          [
            { label: '? Done! Let me order', value: 'skip_install' },
            { label: '?? Skip & See Menu', value: 'menu' }
          ]
        );
      } else {
        addBotMessage(
          `Hmm, install isn't available right now. Let's get you ordering instead! ??`,
          [
            { label: '?? See Menu', value: 'menu' },
            { label: '?? Recommend', value: 'recommend' }
          ]
        );
      }
      return;
    }

    addBotMessage(`?? Installing... Tap "Install" on the popup that appears!`);

    const accepted = await doInstall();
    if (accepted) {
      setCanInstallPWA(false);
      const table = tableNumber;
      document.cookie = `netrikxr-table=${encodeURIComponent(table)};path=/;max-age=${60*60*24*30};SameSite=Lax`;

      addBotMessage(
        `?? App installed! Opening now...\n\nIf it doesn't open automatically, look for "Coasis" on your home screen and tap it!`,
        [
          { label: '?? Open App', value: 'open_installed_app' }
        ]
      );
    } else {
      addBotMessage(
        `No worries! You can always install later. Let's get you ordering! ??`,
        [
          { label: '?? See Menu', value: 'menu' },
          { label: '?? Party Package', value: 'party' },
          { label: '?? Recommend', value: 'recommend' },
          { label: '? Help', value: 'help' }
        ]
      );
    }
  };

  const handleOptionClick = (value: string) => {
    switch (value) {
      case 'install_app':
        addUserMessage('Install the app');
        handlePWAInstall();
        return;
      case 'open_installed_app':
        addUserMessage('Open the app');
        {
          const table = tableNumber;
          const url = `${window.location.origin}/order?table=${table}`;
          window.open(url, '_blank');
          setTimeout(() => window.location.replace(url), 1000);
        }
        return;
      case 'skip_install':
        addUserMessage('Skip, let me order');
        addBotMessage(
          `No problem! Let's get you ordering! ???`,
          [
            { label: '??? See Menu', value: 'menu' },
            { label: '?? Popular', value: 'popular' },
            { label: '??? Spicy', value: 'spicy' },
            { label: '?? Seafood', value: 'seafood' },
            { label: '?? Favorites', value: 'favorites' },
            { label: '? Help', value: 'help' }
          ]
        );
        break;
      case 'popular':
        addUserMessage('Show popular items');
        addBotMessage(
          `?? Most Popular Tonight:\n\n� **Marinated Lambchops** � $42\n� **Strip Steak** � $30\n� **Seafood Trio** � $42\n� **Southern Fried Chicken** � $28\n� **Coasis Burger** � $18\n\nType any dish name and I'll tell you all about it!`,
          [
            { label: '??? Full Menu', value: 'menu' },
            { label: '?? View Cart', value: 'cart' }
          ]
        );
        break;
      case 'spicy':
        addUserMessage('Show spicy dishes');
        addBotMessage(
          `??? Spicy picks:\n\n?? **Crispy Chilli Garlic Shrimp** � $14\n?? **Blue Cheese Buffalo Wings** � $14\n?? **Cajun Seafood Dip** � $18\n?? **Salmon & Crab Fried Rice** � $38\n\nWant to try one? Just type the name!`,
          [
            { label: '??? Full Menu', value: 'menu' },
            { label: '?? View Cart', value: 'cart' }
          ]
        );
        break;
      case 'seafood':
        addUserMessage('Show seafood dishes');
        addBotMessage(
          `?? Seafood Favorites:\n\n� **Chargrilled Oysters** � $18/$32\n� **Seafood Trio** � $42\n� **Lobster & Crab Fried Rice** � $42\n� **Salmon & Crab Fried Rice** � $38\n� **Crispy Chilli Garlic Shrimp** � $14\n� **Grilled or Fried Branzino** � $34\n\nType any dish name for details!`,
          [
            { label: '??? Full Menu', value: 'menu' },
            { label: '?? View Cart', value: 'cart' }
          ]
        );
        break;
      case 'favorites':
        addUserMessage('Show my favorites');
        {
          const favItems = menuItems.filter(item => favorites.includes(item.id));
          if (favItems.length === 0) {
            addBotMessage(
              `?? You haven't saved any favorites yet!\n\nBrowse the menu and tap the heart icon to save your go-to drinks.`,
              [
                { label: '?? See Menu', value: 'menu' },
                { label: '?? Recommend', value: 'recommend' }
              ]
            );
          } else {
            addBotMessage(`?? Your favorite drinks:`, undefined, { showMenu: true });
            setSelectedCategory(null);
          }
        }
        break;
      case 'call_waiter':
        addUserMessage('Call waiter');
        callWaiter();
        break;
      case 'menu':
        addUserMessage('Show me the menu');
        addBotMessage('Here\'s what we\'ve got tonight! ?? Tap any category or just tell me what you\'re feeling.', undefined, { showMenu: true });
        break;
      case 'cart':
        addUserMessage('Show my cart');
        if (cart.length === 0) {
          addBotMessage('Your cart is empty! ?? What can I get you?', [
            { label: '?? See Menu', value: 'menu' },
            { label: '?? Recommend', value: 'recommend' }
          ]);
        } else {
          addBotMessage(`You have ${cart.length} item${cart.length > 1 ? 's' : ''} in your cart:`, undefined, { showCart: true });
        }
        break;
      case 'help':
        addUserMessage('Help');
        addBotMessage(
          `No worries, I got you! Here's how it works:\n\n1?? Browse menu or tell me what you want\n2?? Add items to cart\n3?? Place your order\n4?? Wait for confirmation\n5?? Add tip & get your bill\n\nEasy! What would you like?`,
          [
            { label: '?? Show Menu', value: 'menu' },
            { label: '?? Talk to SIA', value: 'recommend' }
          ]
        );
        break;
      case 'party':
        addUserMessage('Party package');
        addBotMessage(
          `?? Party time! That's awesome!\n\nFor groups, I'd suggest:\n� **Chargrilled Oysters** � great for sharing\n� **Cajun Seafood Dip** � crowd favorite\n� **Steak & Cheese Egg Rolls** � everyone loves these\n� **Seafood Trio** or **Marinated Lambchops** for mains\n\nHow many people are you dining with?`,
          [
            { label: '??? See Menu', value: 'menu' },
            { label: '?? Popular', value: 'popular' }
          ]
        );
        break;
      case 'recommend':
        addUserMessage('What do you recommend?');
        addBotMessage(
          `Great question! ?? Here are tonight's top picks:\n\n� **Marinated Lambchops** � $42 (most popular!)\n� **Seafood Trio** � $42\n� **Strip Steak** � $30\n\nType any dish name and I'll tell you more!`,
          [
            { label: '??? Spicy', value: 'spicy' },
            { label: '?? Seafood', value: 'seafood' },
            { label: '??? Full Menu', value: 'menu' }
          ]
        );
        break;
      case 'add_last_item':
        if (lastAskedItem) {
          const itemToAdd = lastAskedItem;
          setCart(prev => {
            const existing = prev.find(i => i.id === itemToAdd.id);
            if (existing) {
              return prev.map(i => i.id === itemToAdd.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...itemToAdd, quantity: 1 }];
          });
          addUserMessage(`Add ${itemToAdd.name}`);
          addBotMessage(`Great choice! ?? ${itemToAdd.name} added to your cart.\n\nAnything else?`, [
            { label: '??? See Menu', value: 'menu' },
            { label: '?? View Cart', value: 'cart' },
            { label: '? Checkout', value: 'checkout' }
          ]);
          setLastAskedItem(null);
        }
        break;
      case 'no_thanks':
        addUserMessage('No thanks');
        setLastAskedItem(null);
        addBotMessage('No problem! What else can I help with?', [
          { label: '??? See Menu', value: 'menu' },
          { label: '?? Popular', value: 'popular' },
          { label: '?? View Cart', value: 'cart' }
        ]);
        break;
      case 'checkout':
        handleCheckout();
        break;
      case 'more':
        addUserMessage('Order more');
        addBotMessage('Let\'s add more! ?? What else sounds good?', undefined, { showMenu: true });
        break;
      case 'pay':
        addUserMessage('Pay now');
        addBotMessage('Almost done! ?? Would you like to add a tip?', undefined, { showTip: true });
        break;
      case 'skip_tip':
        setSelectedTip(0);
        addUserMessage('No tip');
        addBotMessage('No problem! Ready for your bill?', [{ label: '?? Get Bill', value: 'bill' }]);
        break;
      case 'confirm_tip':
        addUserMessage(`Tip: ${selectedTip}%`);
        addBotMessage(`Thanks! ?? ${selectedTip}% tip added. Ready for your bill?`, [{ label: '?? Get Bill', value: 'bill' }]);
        break;
      case 'bill':
        addUserMessage('Get bill');
        addBotMessage('Here\'s your bill! ?? Pay cash to the manager when ready. Thanks for hanging with us!', undefined, { showBill: true });
        break;
      case 'done':
        addUserMessage('Done');
        setWaitingForConfirmation(false);
        setCurrentOrderId(null);
        addBotMessage('One last thing! How was everything? ?', undefined, { showRating: true });
        break;
      default:
        break;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.trim();
    addUserMessage(input);
    setUserInput('');
    setIsBotTyping(true);

    try {
      const baseResponse = processChatMessage(
        input,
        menuItems,
        cart.map(c => ({ id: c.id, name: c.name, quantity: c.quantity })),
        conversationContext
      );
      const response = await humanizeBotResponse(input, baseResponse);

      setConversationContext(prev => {
        const updated = { ...prev };
        if (response.entities.preference) {
          updated.lastPreference = response.entities.preference;
          if (!updated.preferences.includes(response.entities.preference)) {
            updated.preferences = [...updated.preferences, response.entities.preference];
          }
        }
        if (response.intent) updated.lastAction = response.intent;
        if (response.intent === 'RECOMMEND_SPICY' && !updated.preferences.includes('spicy')) {
          updated.preferences = [...updated.preferences, 'spicy'];
        }
        if (response.intent === 'RECOMMEND_SEAFOOD' && !updated.preferences.includes('seafood')) {
          updated.preferences = [...updated.preferences, 'seafood'];
        }
        return updated;
      });

      if (response.action === 'checkout') {
        handleCheckout();
        return;
      }

      if (response.action === 'show_cart') {
        if (cart.length === 0) {
          addBotMessage(response.message, [
            { label: '?? See Menu', value: 'menu' },
            { label: '?? Recommend', value: 'recommend' }
          ]);
        } else {
          addBotMessage(response.message, undefined, { showCart: true });
        }
        return;
      }

      if (response.action === 'show_tip') {
        addBotMessage(response.message, undefined, { showTip: true });
        return;
      }

      if (response.action === 'ask_dish') {
        if (response.matchedItems && response.matchedItems.length > 0) {
          setLastAskedItem(response.matchedItems[0].item);
        }
        addBotMessage(
          response.message,
          [
            { label: '? Add to Cart', value: 'add_last_item' },
            { label: '??? See Menu', value: 'menu' },
            { label: '? No Thanks', value: 'no_thanks' }
          ]
        );
        return;
      }

      if (response.action === 'add_item' && response.matchedItems && response.matchedItems.length > 0) {
        for (const matched of response.matchedItems) {
          const item = matched.item;
          const qty = matched.quantity || 1;

          setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
              return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + qty } : i);
            }
            return [...prev, { ...item, quantity: qty }];
          });
        }

        addBotMessage(
          response.message,
          [
            { label: '??? Add More', value: 'menu' },
            { label: '?? View Cart', value: 'cart' },
            { label: '? Checkout', value: 'checkout' }
          ]
        );
        return;
      }

      if (response.action === 'remove_item' && response.matchedItems && response.matchedItems.length > 0) {
        const itemToRemove = response.matchedItems[0].item;
        setCart(prev => prev.filter(i => i.id !== itemToRemove.id));
        addBotMessage(
          response.message,
          [
            { label: '??? See Menu', value: 'menu' },
            { label: '?? View Cart', value: 'cart' },
            { label: '? Checkout', value: 'checkout' }
          ]
        );
        return;
      }

      if (response.action === 'clear_cart') {
        setCart([]);
        setSubmittedQuantities({});
        addBotMessage(response.message, [
          { label: '?? See Menu', value: 'menu' },
          { label: '?? Recommend', value: 'recommend' }
        ]);
        return;
      }

      if (response.suggestedItems && response.suggestedItems.length > 0) {
        addBotMessage(response.message, undefined, { showMenu: true });
        return;
      }

      if (response.action === 'show_menu' || response.action === 'show_category') {
        addBotMessage(response.message, undefined, { showMenu: true });
        return;
      }

      if (response.intent === 'YES_CONFIRM' && lastAskedItem) {
        const itemToAdd = lastAskedItem;
        setCart(prev => {
          const existing = prev.find(i => i.id === itemToAdd.id);
          if (existing) {
            return prev.map(i => i.id === itemToAdd.id ? { ...i, quantity: i.quantity + 1 } : i);
          }
          return [...prev, { ...itemToAdd, quantity: 1 }];
        });
        addBotMessage(`Excellent choice! ?? ${itemToAdd.name} is in your cart.\n\nMany guests also pair it with some appetizers or a side. Want to see the menu for more, or ready to checkout?`, [
          { label: '??? Add More', value: 'menu' },
          { label: '?? View Cart', value: 'cart' },
          { label: '? Checkout', value: 'checkout' }
        ]);
        setLastAskedItem(null);
        return;
      }

      if (response.intent === 'DRINK_REQUEST') {
        addBotMessage(response.message, [
          { label: '?? Call Waiter', value: 'call_waiter' },
          { label: '??? Food Menu', value: 'menu' },
          { label: '?? Popular', value: 'popular' }
        ]);
        return;
      }

      if (response.intent === 'VEGETARIAN_REQUEST') {
        addBotMessage(response.message, [
          { label: '?? Call Waiter', value: 'call_waiter' },
          { label: '??? Full Menu', value: 'menu' },
          { label: '?? View Cart', value: 'cart' }
        ]);
        return;
      }

      if (response.intent === 'SYSTEM_QUESTION' || response.intent === 'CASUAL_CHAT') {
        addBotMessage(response.message, [
          { label: '??? See Menu', value: 'menu' },
          { label: '?? Popular', value: 'popular' },
          { label: '?? Recommend', value: 'recommend' }
        ]);
        return;
      }

      if (response.intent === 'VAGUE_MESSAGE') {
        addBotMessage(response.message, [
          { label: '?? Popular', value: 'popular' },
          { label: '??? Spicy', value: 'spicy' },
          { label: '?? Seafood', value: 'seafood' },
          { label: '??? Full Menu', value: 'menu' }
        ]);
        return;
      }

      addBotMessage(
        response.message || "I'm here to help! What can I get you?",
        [
          { label: '??? See Menu', value: 'menu' },
          { label: '?? View Cart', value: 'cart' },
          { label: '?? Recommend', value: 'recommend' }
        ]
      );
    } finally {
      setIsBotTyping(false);
    }
  };
const handleCheckout = async () => {
    if (cart.length === 0) {
      addBotMessage('Your cart is empty! Add some items first.', [{ label: '📋 View Menu', value: 'menu' }]);
      return;
    }

    if (!navigator.onLine) {
      addBotMessage('📡 You\'re offline! Please check your internet connection and try again.', [{ label: '🔄 Try Again', value: 'checkout' }]);
      return;
    }

    setLoading(true);
    addUserMessage('Place my order');

    const pendingItems = cart
      .map(item => {
        const alreadySubmitted = submittedQuantities[item.id] || 0;
        const unsentQty = Math.max(0, item.quantity - alreadySubmitted);
        return {
          id: item.id,
          name: item.name,
          quantity: unsentQty,
          price: item.price
        };
      })
      .filter(item => item.quantity > 0);

    if (pendingItems.length === 0) {
      setLoading(false);
      addBotMessage(
        'I do not see any new items to send. Add or increase an item first, then place order again.',
        [
          { label: '🍽️ Add More', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' }
        ]
      );
      return;
    }

    const pendingSubtotal = pendingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const pendingTax = calculateOrderTotal(pendingSubtotal, 0).taxAmount;
    const pendingTotal = pendingSubtotal + pendingTax;
    const isAddOnOrder = Object.keys(submittedQuantities).length > 0;
    const itemCount = pendingItems.reduce((sum, item) => sum + item.quantity, 0);
    
    const receiptPrefix = isAddOnOrder ? 'ADD' : 'ORD';
    const receipt = `${receiptPrefix}-${tableNumber}-${Date.now().toString().slice(-6)}`;
    setReceiptId(receipt);
    setLastSubmittedSubtotal(pendingSubtotal);
    setLastSubmittedItemsCount(itemCount);
    setLastOrderWasAddOn(isAddOnOrder);

    const orderData = {
      table_number: parseInt(tableNumber),
      items: pendingItems,
      subtotal: pendingSubtotal,
      tip_amount: 0,
      tax_amount: pendingTax,
      total: pendingTotal,
      status: 'pending',
      payment_status: 'unpaid',
      receipt_id: receipt,
      customer_note: isAddOnOrder
        ? `ADD_ON_ORDER | table ${tableNumber} | contains only newly added items`
        : 'NEW_ORDER | initial order from chatbot'
    };

    const { data: insertedData, error } = await supabase.from('orders').insert(orderData).select();
    setLoading(false);

    if (error) {
      console.error('Order error:', error);
      addBotMessage(`❌ Error: ${error.message || 'Could not place order'}. Please try again.`, [{ label: '🔄 Try Again', value: 'checkout' }]);
      return;
    }

    if (insertedData && insertedData[0]) {
      setCurrentOrderId(insertedData[0].id);
      setSubmittedQuantities(prev => {
        const next = { ...prev };
        for (const item of cart) {
          next[item.id] = item.quantity;
        }
        return next;
      });
    }

    setOrderPlaced(true);
    setWaitingForConfirmation(true);
    
    // Increment order count for loyalty
    const newCount = orderCount + 1;
    setOrderCount(newCount);
    try { localStorage.setItem('netrikxr-order-count', newCount.toString()); } catch (_) {}
    
    // Estimate wait time (3-8 min based on items)
    const waitMin = Math.min(3 + itemCount, 12);
    setEstimatedWait(waitMin);

    addBotMessage(
      `📤 ${isAddOnOrder ? 'Add-on Order' : 'Order'} Sent!\n\nReceipt: ${receipt}\nTable: ${tableNumber}\nItems: ${itemCount}\nSubtotal: $${pendingSubtotal.toFixed(2)}\n⏱️ Est. wait: ~${waitMin} min\n\n⏳ Waiting for staff confirmation...`,
      [
        { label: '🔔 Call Waiter', value: 'call_waiter' }
      ]
    );
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    addBotMessage(`👍 ${item.name} added to your cart!\n\nAnything else?`, [
      { label: '➕ Add More', value: 'menu' },
      { label: '🛒 View Cart', value: 'cart' },
      { label: '✅ Checkout', value: 'checkout' }
    ]);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const handleTipSelect = (tip: number) => {
    setSelectedTip(tip);
  };

  const handleRatingSubmit = async () => {
    if (rating === 0) return;
    
    if (receiptId) {
      const finalCalculation = calculateOrderTotal(subtotal, selectedTip);
      const { error } = await supabase.from('orders').update({ 
        rating, 
        tip_amount: finalCalculation.tipAmount,
        tax_amount: finalCalculation.taxAmount,
        total: finalCalculation.total 
      }).eq('receipt_id', receiptId);
      if (error) console.error('Rating update error:', error);
    }
    
    setShowThankYou(true);
    setCart([]);
    setSubmittedQuantities({});
    setLastOrderWasAddOn(false);
    setLastSubmittedItemsCount(0);
    setLastSubmittedSubtotal(0);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(0);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('netrikxr.shop', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Restaurant Bill', pageWidth / 2, 30, { align: 'center' });
    
    doc.setTextColor(60);
    doc.setFontSize(10);
    let y = 55;
    doc.text(`Receipt: ${receiptId}`, 20, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
    y += 8;
    doc.text(`Table: ${tableNumber}`, 20, y);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, pageWidth - 20, y, { align: 'right' });
    
    y += 10;
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Item', 20, y);
    doc.text('Qty', 100, y);
    doc.text('Price', 130, y);
    doc.text('Total', pageWidth - 20, y, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    y += 8;
    cart.forEach(item => {
      doc.text(item.name.substring(0, 25), 20, y);
      doc.text(item.quantity.toString(), 105, y);
      doc.text(`$${item.price.toFixed(2)}`, 130, y);
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
    });
    
    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    
    y += 10;
    doc.text('Subtotal:', 100, y);
    doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    
    if (tipAmount > 0) {
      y += 7;
      doc.text(`Tip (${selectedTip}%):`, 100, y);
      doc.text(`$${tipAmount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    }
    
    y += 7;
    doc.text('Tax (3%):', 100, y);
    doc.text(`$${taxAmount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', 100, y);
    doc.text(`$${total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('Tampa, Florida | netrikxr.shop', pageWidth / 2, y, { align: 'center' });
    
    doc.save(`bill_${receiptId}.pdf`);
  };

  // Thank You Screen
  if (showThankYou) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center w-full max-w-sm mx-auto flex flex-col items-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
            style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.primaryDark})` }}
          >
            <Check className="w-12 h-12 text-black" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-4">Thank You!</h1>
          <p className="text-gray-400 text-lg mb-4">You rated us {rating} star{rating > 1 ? 's' : ''}</p>
          <div className="flex justify-center gap-2 mb-8">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-8 h-8 ${i <= rating ? 'fill-current' : 'text-gray-600'}`} style={i <= rating ? { color: theme.primary } : {}} />
            ))}
          </div>
          <p className="text-gray-500 text-base mb-10">We hope to see you again soon!</p>
          <div className="pt-6 border-t border-white/10 w-full">
            <p className="text-sm text-gray-600">netrikxr.shop</p>
            <p className="text-xs text-gray-700 mt-1">Tampa, Florida</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden chat-surface" style={{ height: '100dvh' }}>
      <div className="chat-ambient-bubble chat-ambient-bubble-a" />
      <div className="chat-ambient-bubble chat-ambient-bubble-b" />
      {/* Status bar spacer for standalone PWA mode (notch/dynamic island) */}
      <div className="status-bar-spacer" />

      {/* ========================================== */}
      {/* FIXED HEADER - Native App Style */}
      {/* ========================================== */}
      <header className="flex-shrink-0 sticky top-0 bg-black/95 backdrop-blur-xl border-b px-4 py-3 z-50" style={{ borderColor: `${theme.primary}33` }}>
        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-1.5 mb-2 text-center">
            <p className="text-red-400 text-[12px] font-medium">📡 No internet connection</p>
          </div>
        )}
        {/* Waiting for confirmation indicator */}
        {waitingForConfirmation && (
          <div className="rounded-lg px-3 py-1.5 mb-2 flex items-center justify-center gap-2" style={{ background: `${theme.primary}1a`, borderColor: `${theme.primary}4d`, borderWidth: 1, borderStyle: 'solid' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: theme.primary }} />
            <p className="text-[12px] font-medium" style={{ color: theme.primary }}>
              {estimatedWait ? `⏱️ ~${estimatedWait} min wait • ` : ''}Waiting for staff confirmation...
            </p>
          </div>
        )}
        {/* Theme occasion badge */}
        {theme.id !== 'default' && (
          <div className="text-center mb-1">
            <span className="text-[11px] px-3 py-0.5 rounded-full" style={{ background: `${theme.primary}1a`, color: theme.primary }}>
              {theme.emoji} {theme.name}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`, boxShadow: `0 4px 15px ${theme.primary}33` }}>
              <img src="/icons/icon-96x96.png" alt="N" className="w-7 h-7 rounded-md" />
            </div>
            <div>
              <p className="font-semibold text-[15px] leading-tight" style={{ color: theme.primary }}>Coasis</p>
              <p className="text-[11px] text-gray-500 leading-tight">Table {tableNumber} • SIA Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Call Waiter button */}
            <button 
              onClick={callWaiter}
              disabled={callingWaiter}
              className="p-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
              style={{ background: `${theme.accent || theme.primary}1a`, border: `1px solid ${theme.accent || theme.primary}4d` }}
              title="Call Waiter"
            >
              <PhoneCall className="w-4 h-4" style={{ color: theme.accent || theme.primary }} />
            </button>
            {/* Cart button */}
            <button 
              onClick={() => handleOptionClick('cart')}
              className={`relative p-2.5 rounded-xl active:scale-95 transition-transform ${cart.length > 0 ? 'cart-pulse' : ''}`}
              style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}4d` }}
            >
              <ShoppingCart className="w-5 h-5" style={{ color: theme.primary }} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold animate-bounce-subtle">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* SCROLLABLE CHAT AREA - Only this scrolls */}
      {/* ========================================== */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-6">
          <AnimatePresence mode="popLayout">
            {chatMessages.map((msg, index) => {
              const previous = chatMessages[index - 1];
              const showDateSeparator = !previous || new Date(previous.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

              return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex justify-center py-1.5">
                    <span className="px-3 py-1 rounded-full text-[11px] text-gray-300 bg-zinc-900/80 border border-zinc-700/70">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
                  {/* Bot Avatar */}
                  {msg.role === 'bot' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})` }}>
                        <MessageCircle className="w-3 h-3 text-black" />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: `${theme.primary}cc` }}>SIA</span>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div 
                    className={`message-bubble rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'rounded-br-sm ml-auto user-chat-pop' : 'rounded-bl-sm bot-chat-pop'}`}
                    style={msg.role === 'user' 
                      ? { background: theme.userBubbleBg, color: '#000' }
                      : { background: theme.botBubbleBg, border: `1px solid ${theme.botBubbleBorder}` }
                    }
                  >
                    <p className={`leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-[14px] font-medium' : 'text-[15px]'}`}>{msg.content}</p>
                  </div>
                  <div className={`mt-1 text-[10px] ${msg.role === 'user' ? 'text-right' : 'text-left'} text-gray-500 flex items-center gap-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'user' && (
                      <span className="text-sky-400 text-[11px] leading-none tracking-[-1px]" aria-label="Read">
                        ✓✓
                      </span>
                    )}
                  </div>

                  {/* Quick Options */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionClick(opt.value)}
                          className="quick-chip-pop px-3.5 py-2 bg-zinc-900 rounded-xl text-[13px] font-medium active:scale-95 transition-transform"
                          style={{ border: `1px solid ${theme.primary}4d`, color: theme.primary }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ========================================== */}
                  {/* MENU DISPLAY */}
                  {/* ========================================== */}
                  {msg.showMenu && (
                    <div className="mt-4 space-y-3">
                      {/* Category Pills */}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className="flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all"
                          style={!selectedCategory ? { background: theme.primary, color: '#000' } : { background: '#27272a', color: '#9ca3af' }}
                        >
                          All
                        </button>
                        {categories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className="flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all whitespace-nowrap"
                            style={selectedCategory === cat ? { background: theme.primary, color: '#000' } : { background: '#27272a', color: '#9ca3af' }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      
                      {/* Menu Items */}
                      <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl">
                        {menuItems
                          .filter(i => !selectedCategory || i.category === selectedCategory)
                          .map((item, idx) => {
                            const inCart = cart.find(c => c.id === item.id);
                            const isFav = favorites.includes(item.id);
                            return (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                                <div className="flex-1 min-w-0 mr-2">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium text-[14px] truncate">{item.name}</p>
                                    {idx < 3 && <Flame className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-semibold" style={{ color: theme.primary }}>${item.price.toFixed(2)}</p>
                                    <button 
                                      onClick={() => toggleFavorite(item.id)} 
                                      className="active:scale-110 transition-transform"
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'text-red-400 fill-red-400' : 'text-gray-600'}`} />
                                    </button>
                                  </div>
                                </div>
                                {inCart ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center active:scale-95">
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-6 text-center font-bold text-[14px]">{inCart.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 text-black rounded-lg flex items-center justify-center active:scale-95" style={{ background: theme.primary }}>
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => addToCart(item)} className="px-4 py-2 rounded-lg text-[13px] font-medium active:scale-95 flex items-center gap-1.5" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}4d`, color: theme.primary }}>
                                    <Plus className="w-4 h-4" />
                                    Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      
                      {cart.length > 0 && (
                        <button onClick={() => handleOptionClick('cart')} className="w-full py-3 text-black rounded-xl font-bold text-[14px] active:scale-[0.98] transition-transform" style={{ background: theme.primary }}>
                          View Cart ({cart.reduce((s, i) => s + i.quantity, 0)}) • ${subtotal.toFixed(2)}
                        </button>
                      )}
                    </div>
                  )}

                  {/* ========================================== */}
                  {/* CART DISPLAY */}
                  {/* ========================================== */}
                  {msg.showCart && cart.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                          <div className="flex-1 mr-3">
                            <p className="font-medium text-[14px]">{item.name}</p>
                            <p className="text-[12px] text-gray-500">${item.price.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center active:scale-95">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center font-bold text-[14px]">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 text-black rounded-lg flex items-center justify-center active:scale-95" style={{ background: theme.primary }}>
                              <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center active:scale-95 ml-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="p-3 rounded-xl" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}4d` }}>
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span style={{ color: theme.primary }}>${subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleOptionClick('menu')} className="flex-1 py-3 rounded-xl font-medium text-[14px] active:scale-[0.98]" style={{ border: `1px solid ${theme.primary}4d`, color: theme.primary }}>
                          <Plus className="w-4 h-4 inline mr-1" /> Add More
                        </button>
                        <button onClick={handleCheckout} disabled={loading} className="flex-1 py-3 text-black rounded-xl font-bold text-[14px] disabled:opacity-50 active:scale-[0.98]" style={{ background: theme.primary }}>
                          {loading ? 'Placing...' : 'Place Order'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================== */}
                  {/* TIP SELECTION */}
                  {/* ========================================== */}
                  {msg.showTip && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[13px] text-gray-400 text-center">Select tip amount</p>
                      <div className="grid grid-cols-5 gap-2">
                        {TIP_OPTIONS.map(tip => (
                          <button
                            key={tip}
                            onClick={() => handleTipSelect(tip)}
                            className={`py-3 rounded-xl text-[14px] font-bold active:scale-95 transition-all ${
                              selectedTip === tip 
                                ? 'text-black' 
                                : 'bg-zinc-800 text-gray-400'
                            }`}
                            style={selectedTip === tip ? { background: theme.primary } : {}}
                          >
                            {tip}%
                          </button>
                        ))}
                      </div>
                      {selectedTip > 0 && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <p className="text-green-400 text-center font-medium text-[14px]">Tip: ${(subtotal * selectedTip / 100).toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => handleOptionClick('skip_tip')} className="flex-1 py-3 border border-zinc-700 text-gray-400 rounded-xl font-medium active:scale-[0.98]">
                          Skip
                        </button>
                        <button onClick={() => handleOptionClick('confirm_tip')} className="flex-1 py-3 text-black rounded-xl font-bold active:scale-[0.98]" style={{ background: theme.primary }}>
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================== */}
                  {/* BILL DISPLAY */}
                  {/* ========================================== */}
                  {msg.showBill && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-zinc-900 rounded-2xl p-4" style={{ border: `1px solid ${theme.primary}4d` }}>
                        <div className="text-center border-b border-zinc-800 pb-3 mb-3">
                          <h3 className="text-lg font-bold" style={{ color: theme.primary }}>netrikxr.shop</h3>
                          <p className="text-[11px] text-gray-500">Tampa, Florida</p>
                        </div>
                        <div className="space-y-1.5 text-[13px] mb-3">
                          <div className="flex justify-between text-gray-400">
                            <span>Receipt:</span>
                            <span className="text-white">{receiptId}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Table:</span>
                            <span className="text-white">{tableNumber}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Date:</span>
                            <span className="text-white">{new Date().toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                          {cart.map(item => (
                            <div key={item.id} className="flex justify-between text-[13px]">
                              <span>{item.quantity}x {item.name}</span>
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-zinc-800 pt-3 mt-3 space-y-1.5">
                          <div className="flex justify-between text-gray-400 text-[13px]">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                          </div>
                          {tipAmount > 0 && (
                            <div className="flex justify-between text-gray-400 text-[13px]">
                              <span>Tip ({selectedTip}%)</span>
                              <span>${tipAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-400 text-[13px]">
                            <span>Tax (3%)</span>
                            <span>${taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-800">
                            <span>Total</span>
                            <span style={{ color: theme.primary }}>${total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}4d` }}>
                        <p className="font-medium text-[14px]" style={{ color: theme.primary }}>💵 Pay cash to the manager</p>
                      </div>
                      <button onClick={generatePDF} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium text-[14px]">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={() => handleOptionClick('done')} className="w-full py-3 text-black rounded-xl font-bold text-[14px]" style={{ background: theme.primary }}>
                        Done
                      </button>
                    </div>
                  )}

                  {/* ========================================== */}
                  {/* STAR RATING */}
                  {/* ========================================== */}
                  {msg.showRating && (
                    <div className="mt-4 space-y-4">
                      <p className="text-center text-gray-400 text-[14px]">How was your experience?</p>
                      <div className="flex justify-center gap-2">
                        {[1,2,3,4,5].map(i => (
                          <button
                            key={i}
                            onClick={() => setRating(i)}
                            onMouseEnter={() => setHoverRating(i)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 active:scale-110 transition-transform"
                          >
                            <Star 
                              className={`w-10 h-10 transition-colors ${
                                i <= (hoverRating || rating) 
                                  ? 'fill-current' 
                                  : 'text-gray-600'
                              }`}
                              style={i <= (hoverRating || rating) ? { color: theme.primary } : {}}
                            />
                          </button>
                        ))}
                      </div>
                      {rating > 0 && (
                        <button 
                          onClick={handleRatingSubmit}
                          className="w-full py-3 text-black rounded-xl font-bold text-[14px]"
                          style={{ background: theme.primary }}
                        >
                          Submit Rating
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
              </div>
              );
            })}

            {isBotTyping && (
              <motion.div
                key="typing-indicator"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})` }}>
                      <MessageCircle className="w-3 h-3 text-black" />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: `${theme.primary}cc` }}>SIA</span>
                  </div>
                  <div className="message-bubble rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: theme.botBubbleBg, border: `1px solid ${theme.botBubbleBorder}` }}>
                    <div className="typing-dots" aria-label="SIA is typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} className="h-1" />
        </div>
      </div>

      {/* ========================================== */}
      {/* FIXED INPUT BAR - Native App Style */}
      {/* ========================================== */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-2 safe-bottom-mini">
          <div
            className="max-w-lg mx-auto rounded-2xl px-3.5 py-2.5 flex items-center justify-between"
            style={{ background: '#111111', border: `1px solid ${theme.primary}66`, boxShadow: `0 10px 24px ${theme.primary}22` }}
          >
            <button
              onClick={() => handleOptionClick('cart')}
              className="flex items-center gap-2 text-left min-w-0"
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black" style={{ background: theme.primary }}>
                {totalCartItems}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-gray-400 leading-tight">Your cart</p>
                <p className="text-[14px] font-semibold truncate" style={{ color: theme.primary }}>${subtotal.toFixed(2)}</p>
              </div>
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading || waitingForConfirmation}
              className="px-4 py-2 rounded-xl text-black text-[13px] font-bold active:scale-95 transition-transform disabled:opacity-50"
              style={{ background: theme.primary }}
            >
              {loading ? 'Placing...' : waitingForConfirmation ? 'Pending...' : 'Checkout'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 sticky bottom-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 safe-bottom">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-lg mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask SIA anything..."
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl focus:outline-none text-[16px] placeholder-gray-500"
            style={{ '--tw-ring-color': theme.primary } as React.CSSProperties}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
          />
          <button 
            type="submit" 
            disabled={!userInput.trim()}
            className="w-12 h-12 text-black rounded-2xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: theme.primary }}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* CSS for safe areas and scrollbar */}
      <style jsx global>{`
        .status-bar-spacer {
          height: env(safe-area-inset-top, 0px);
        }
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .safe-bottom-mini {
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) * 0.35);
        }
        .chat-surface {
          background:
            radial-gradient(1200px 700px at -10% -20%, rgba(245, 158, 11, 0.08), transparent 60%),
            radial-gradient(900px 500px at 110% 120%, rgba(245, 158, 11, 0.06), transparent 60%),
            #000;
        }
        .message-bubble {
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
        }
        .cart-pulse {
          animation: cartPulse 1.8s ease-in-out infinite;
        }
        .typing-dots {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .typing-dots span {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(156, 163, 175, 0.95);
          animation: typingBlink 1.2s infinite ease-in-out;
        }
        .typing-dots span:nth-child(2) {
          animation-delay: 0.18s;
        }
        .typing-dots span:nth-child(3) {
          animation-delay: 0.36s;
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 1.4s ease-in-out infinite;
        }
        @keyframes cartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes typingBlink {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-2px); opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#f59e0b' }}></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}

