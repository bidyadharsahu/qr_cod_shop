'use client';

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { processChatMessage, type ChatbotResponse, type ConversationContext } from '@/lib/chatbot';
import { getCurrentTheme, applyTheme, type AppTheme } from '@/lib/themes';
import { getDefaultMenuImage, withResolvedMenuImage } from '@/lib/menu-images';
import { DEFAULT_RESTAURANT_CONTEXT, normalizeRestaurantSlug, persistRestaurantContext, readRestaurantContext } from '@/lib/tenant';
import jsPDF from 'jspdf';
import { 
  Send, ShoppingCart, Plus, Minus, Trash2, Star,
  FileText, Check, MessageCircle, Download, 
  Heart, PhoneCall, Clock, Sparkles, Flame, CreditCard, Mic, MicOff
} from 'lucide-react';
import { calculateOrderTotal } from '@/lib/calculations';

const ADMIN_WHATSAPP = '+16562145190';
const TIP_OPTIONS = [0, 10, 15, 20, 25];

interface CartItem extends MenuItem {
  quantity: number;
}

interface ItemKitchenInstruction {
  spiceLevel?: 'mild' | 'medium' | 'hot';
  notes: string;
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

interface PendingCheckoutItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  image_url?: string | null;
  special_instructions?: string;
  spice_level?: 'mild' | 'medium' | 'hot';
  allergy_alerts?: string[];
}

interface QueuedCheckout {
  restaurantId: number;
  tableNumber: string;
  pendingItems: PendingCheckoutItem[];
  isAddOnOrder: boolean;
  queuedAt: number;
}

interface GuestOrderInstructions {
  allergies: string[];
  ingredientExclusions: string[];
  spiceLevel?: 'mild' | 'medium' | 'hot';
  specialInstructions: string[];
}

interface PaymentGatewayStatus {
  stripeConfigured: boolean;
  paypalConfigured: boolean;
  mode: 'sandbox' | 'live';
  anyProviderConfigured: boolean;
  accountActive?: boolean;
  plan?: 'basic' | 'premium';
}

interface TenantResolveResponse {
  restaurant?: {
    id: number;
    slug: string;
    name: string;
    plan: 'basic' | 'premium';
    status: 'active' | 'disabled';
  };
  error?: string;
}

interface VoiceRecognitionEvent {
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface VoiceRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface VoiceRecognitionFactory {
  new (): VoiceRecognitionInstance;
}

interface OrderPageProps {
  forcedTenantSlug?: string;
}

const VOICE_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const normalizeVoiceText = (raw: string): string => {
  const lower = raw
    .toLowerCase()
    .replace(/\b(pay pal|paper)\b/g, 'paypal')
    .replace(/\b(sea food)\b/g, 'seafood')
    .replace(/\b(card payment|pay by card)\b/g, 'card')
    .replace(/\b(add to cut|add two cart|add to card)\b/g, 'add to cart')
    .replace(/\b(please|can you|could you|would you|um|uh)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedWords = lower.split(' ').map((word) => {
    if (VOICE_NUMBERS[word] !== undefined) return String(VOICE_NUMBERS[word]);
    return word;
  });

  return normalizedWords.join(' ').trim();
};

const getBestMenuVoiceMatch = (items: MenuItem[], query: string): MenuItem | null => {
  const q = normalizeVoiceText(query);
  if (!q) return null;

  const queryTokens = q.split(' ').filter(token => token.length > 1);
  if (queryTokens.length === 0) return null;

  let best: { score: number; item: MenuItem } | null = null;

  for (const item of items) {
    const name = normalizeVoiceText(item.name);
    const nameTokens = name.split(' ').filter(token => token.length > 1);

    if (name.includes(q) || q.includes(name)) {
      const exactScore = 1.2;
      if (!best || exactScore > best.score) best = { score: exactScore, item };
      continue;
    }

    const matches = queryTokens.filter(token => nameTokens.some(nt => nt.startsWith(token) || token.startsWith(nt))).length;
    const score = matches / Math.max(queryTokens.length, nameTokens.length);
    if (!best || score > best.score) best = { score, item };
  }

  return best && best.score >= 0.34 ? best.item : null;
};

const CHECKOUT_QUEUE_KEY = 'netrikxr-pending-checkout-v1';
const LEGACY_DEFAULT_RESTAURANT_SLUG = 'default';

const parsePositiveInt = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

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

const getSmartDayGreeting = (themeName: string): string => {
  const now = new Date();
  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const monthDay = `${now.getMonth() + 1}-${now.getDate()}`;
  const specials: Record<string, string> = {
    '1-1': 'Happy New Year. Wishing you a fresh and amazing start.',
    '2-14': 'Happy Valentine\'s Day. Great day for a special table.',
    '12-25': 'Merry Christmas. We hope your day is full of joy.',
    '12-31': 'Happy New Year\'s Eve. Let\'s celebrate in style.',
  };

  const dayVibe = now.getDay() === 0 || now.getDay() === 6
    ? `It\'s ${weekday}, perfect for a relaxed treat.`
    : `It\'s ${weekday}, let\'s make your meal the best part of today.`;

  const special = specials[monthDay];
  if (special) return `${special} ${dayVibe}`;
  if (themeName && themeName !== 'Default') return `${dayVibe} Today\'s vibe: ${themeName}.`;
  return dayVibe;
};

function OrderContent({ forcedTenantSlug }: OrderPageProps) {
  const searchParams = useSearchParams();
  const normalizedForcedTenantSlug = normalizeRestaurantSlug(forcedTenantSlug || '');
  const tenantScopedOrder = Boolean(normalizedForcedTenantSlug);
  const tableParam = searchParams.get('table');
  const restaurantSlugParam = normalizeRestaurantSlug(
    searchParams.get('restaurantSlug')
    || searchParams.get('tenant')
    || ''
  );
  const restaurantIdParam = parsePositiveInt(searchParams.get('restaurant') || searchParams.get('restaurantId'));

  const [restaurantId, setRestaurantId] = useState<number>(() => {
    if (tenantScopedOrder) return 0;
    return restaurantIdParam || readRestaurantContext().restaurantId;
  });
  const [restaurantSlug, setRestaurantSlug] = useState<string>(() => {
    if (tenantScopedOrder) return normalizedForcedTenantSlug;
    return restaurantSlugParam || readRestaurantContext().restaurantSlug;
  });
  const [restaurantName, setRestaurantName] = useState<string>(() => readRestaurantContext().restaurantName);
  const [restaurantStatus, setRestaurantStatus] = useState<'active' | 'disabled'>('active');
  const [restaurantPlan, setRestaurantPlan] = useState<'basic' | 'premium'>('premium');
  const [tenantResolving, setTenantResolving] = useState<boolean>(tenantScopedOrder);

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

  useEffect(() => {
    if (tenantScopedOrder) return;
    if (!restaurantIdParam || restaurantIdParam === restaurantId) return;
    setRestaurantId(restaurantIdParam);
  }, [restaurantIdParam, restaurantId, tenantScopedOrder]);

  useEffect(() => {
    if (tenantScopedOrder) return;
    if (!restaurantSlugParam || restaurantSlugParam === restaurantSlug) return;
    setRestaurantSlug(restaurantSlugParam);
  }, [restaurantSlug, restaurantSlugParam, tenantScopedOrder]);

  useEffect(() => {
    if (!tenantScopedOrder) {
      setTenantResolving(false);
      return;
    }

    const resolveTenant = async () => {
      setTenantResolving(true);

      try {
        const response = await fetch(`/api/tenant/resolve?slug=${encodeURIComponent(normalizedForcedTenantSlug)}`, {
          cache: 'no-store',
        });
        const payload = await response.json() as TenantResolveResponse;

        if (!response.ok || !payload.restaurant) {
          setRestaurantStatus('disabled');
          setMenuLoadError(payload.error || 'Tenant URL is invalid or unavailable.');
          return;
        }

        const tenant = payload.restaurant;
        setRestaurantId(tenant.id);
        setRestaurantSlug(normalizeRestaurantSlug(tenant.slug || normalizedForcedTenantSlug));
        setRestaurantName((tenant.name || DEFAULT_RESTAURANT_CONTEXT.restaurantName).trim() || DEFAULT_RESTAURANT_CONTEXT.restaurantName);
        setRestaurantPlan(tenant.plan === 'premium' ? 'premium' : 'basic');
        setRestaurantStatus(tenant.status === 'disabled' ? 'disabled' : 'active');

        persistRestaurantContext({
          restaurantId: tenant.id,
          restaurantSlug: tenant.slug,
          restaurantName: tenant.name,
        });
      } catch {
        setRestaurantStatus('disabled');
        setMenuLoadError('Could not resolve tenant URL. Please verify the QR/link and try again.');
      } finally {
        setTenantResolving(false);
      }
    };

    resolveTenant();
  }, [normalizedForcedTenantSlug, tenantScopedOrder]);

  useEffect(() => {
    if (!restaurantId) return;
    persistRestaurantContext({
      restaurantId,
      restaurantSlug,
      restaurantName,
    });
  }, [restaurantId, restaurantName, restaurantSlug]);

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
  const [showConfirmationFlash, setShowConfirmationFlash] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
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
  const [latestOrderIdForPayment, setLatestOrderIdForPayment] = useState<number | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<'card' | 'paypal' | null>(null);
  const [cashPaymentLoading, setCashPaymentLoading] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [lastPaymentProvider, setLastPaymentProvider] = useState<'card' | 'paypal' | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);
  const [menuReloadTick, setMenuReloadTick] = useState(0);
  const [queuedCheckout, setQueuedCheckout] = useState<QueuedCheckout | null>(null);
  const [retryingQueuedCheckout, setRetryingQueuedCheckout] = useState(false);
  const [paymentGatewayStatus, setPaymentGatewayStatus] = useState<PaymentGatewayStatus>({
    stripeConfigured: false,
    paypalConfigured: false,
    mode: 'sandbox',
    anyProviderConfigured: false,
  });
  const [paymentGatewayLoading, setPaymentGatewayLoading] = useState(true);
  const [submittedQuantities, setSubmittedQuantities] = useState<Record<number, number>>({});
  const [lastSubmittedSubtotal, setLastSubmittedSubtotal] = useState(0);
  const [lastSubmittedItemsCount, setLastSubmittedItemsCount] = useState(0);
  const [lastOrderWasAddOn, setLastOrderWasAddOn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState<string | null>(null);
  const [interimVoiceTranscript, setInterimVoiceTranscript] = useState('');
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState<string | null>(null);
  const [guestInstructions, setGuestInstructions] = useState<GuestOrderInstructions>({
    allergies: [],
    ingredientExclusions: [],
    specialInstructions: [],
  });
  const [itemInstructions, setItemInstructions] = useState<Record<number, ItemKitchenInstruction>>({});
  const [instructionReviewConfirmed, setInstructionReviewConfirmed] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmationFlashTimerRef = useRef<number | null>(null);
  const voiceRecognitionRef = useRef<VoiceRecognitionInstance | null>(null);
  const voiceStatusTimerRef = useRef<number | null>(null);
  const handledOrderTransitionsRef = useRef<Set<string>>(new Set());
  const tenantDisabledNoticeRef = useRef(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pendingCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + Math.max(0, item.quantity - (submittedQuantities[item.id] || 0)), 0),
    [cart, submittedQuantities]
  );
  const pendingSubtotal = useMemo(
    () => cart.reduce((sum, item) => {
      const unsentQty = Math.max(0, item.quantity - (submittedQuantities[item.id] || 0));
      return sum + (item.price * unsentQty);
    }, 0),
    [cart, submittedQuantities]
  );
  const hasPendingCartChanges = pendingCartItems > 0;
  const showOrderStatusDock = waitingForConfirmation || hasPendingCartChanges || showConfirmationFlash;
  const orderDockState: 'pending' | 'unsent' | 'confirmed' = showConfirmationFlash
    ? 'confirmed'
    : (waitingForConfirmation ? 'pending' : 'unsent');
  const confirmationTone = useMemo(() => {
    const isHoliday = theme.occasion === 'holiday';
    const isWeekend = theme.id === 'weekend' || theme.id === 'miamisunday';

    if (isHoliday) {
      return {
        accent: theme.accent,
        cardBackground: `linear-gradient(135deg, ${theme.primary}24, ${theme.accent}1f, rgba(17, 17, 17, 0.96))`,
      };
    }

    if (isWeekend) {
      return {
        accent: theme.primary,
        cardBackground: `linear-gradient(135deg, ${theme.primary}26, ${theme.primaryLight}1f, rgba(17, 17, 17, 0.96))`,
      };
    }

    return {
      accent: theme.primary,
      cardBackground: `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryDark}1f, rgba(17, 17, 17, 0.95))`,
    };
  }, [theme]);
  const orderDockAccent = orderDockState === 'confirmed' ? confirmationTone.accent : theme.primary;
  const orderDockTitle = orderDockState === 'confirmed'
    ? 'Order confirmed'
    : (orderDockState === 'pending' ? 'Pending confirmation' : 'Ready to send');
  const orderDockCta = orderDockState === 'confirmed'
    ? 'Done'
    : (orderDockState === 'pending' ? 'View' : 'Send now');
  const calculation = calculateOrderTotal(subtotal, selectedTip);
  const { tipAmount, taxAmount, total } = calculation;
  const categories = [...new Set(menuItems.map(i => i.category))];
  const paymentOrderId = latestOrderIdForPayment || currentOrderId;

  const motionProfile = useMemo(() => {
    const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
    return {
      bubble: { duration: 0.34, ease: smoothEase },
      panel: { duration: 0.38, ease: smoothEase },
      dock: { duration: 0.34, ease: smoothEase },
      typing: { duration: 0.3, ease: smoothEase },
      badge: { delay: 0.26, type: 'spring' as const, stiffness: 170, damping: 16 },
    };
  }, []);

  const getDisplayImage = (item: MenuItem): string => item.image_url || getDefaultMenuImage(item.name, item.category);

  const mergeUnique = (a: string[], b: string[]) => Array.from(new Set([...a, ...b].map(v => v.trim()).filter(Boolean)));

  const applyEntitiesToGuestInstructions = (entities?: ChatbotResponse['entities']) => {
    if (!entities) return;
    setGuestInstructions(prev => ({
      allergies: mergeUnique(prev.allergies, entities.allergies || []),
      ingredientExclusions: mergeUnique(prev.ingredientExclusions, entities.ingredientExclusions || []),
      specialInstructions: mergeUnique(prev.specialInstructions, entities.specialInstructions || []),
      spiceLevel: entities.spiceLevel || prev.spiceLevel,
    }));
    if (entities.allergies?.length || entities.ingredientExclusions?.length || entities.specialInstructions?.length || entities.spiceLevel) {
      setInstructionReviewConfirmed(false);
    }
  };

  const setItemInstruction = (itemId: number, patch: Partial<ItemKitchenInstruction>) => {
    setItemInstructions(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...patch,
      },
    }));
    setInstructionReviewConfirmed(false);
  };

  const getPendingItemsFromCart = (): PendingCheckoutItem[] => {
    return cart
      .map(item => {
        const alreadySubmitted = submittedQuantities[item.id] || 0;
        const unsentQty = Math.max(0, item.quantity - alreadySubmitted);
        const perItemInstruction = itemInstructions[item.id];
        const instructionParts: string[] = [];

        if (perItemInstruction?.notes?.trim()) instructionParts.push(perItemInstruction.notes.trim());
        if (guestInstructions.ingredientExclusions.length > 0) instructionParts.push(`Exclude: ${guestInstructions.ingredientExclusions.join(', ')}`);
        if (guestInstructions.specialInstructions.length > 0) instructionParts.push(`Guest note: ${guestInstructions.specialInstructions.join(', ')}`);

        return {
          id: item.id,
          name: item.name,
          quantity: unsentQty,
          price: item.price,
          category: item.category,
          image_url: item.image_url,
          special_instructions: instructionParts.length > 0 ? instructionParts.join(' | ') : undefined,
          spice_level: perItemInstruction?.spiceLevel || guestInstructions.spiceLevel,
          allergy_alerts: guestInstructions.allergies.length > 0 ? guestInstructions.allergies : undefined,
        };
      })
      .filter(item => item.quantity > 0);
  };

  const saveQueuedCheckout = useCallback((queued: QueuedCheckout | null) => {
    try {
      if (!queued) {
        localStorage.removeItem(CHECKOUT_QUEUE_KEY);
        return;
      }
      localStorage.setItem(CHECKOUT_QUEUE_KEY, JSON.stringify(queued));
    } catch {
      // Local storage can fail in private mode; UI still handles in-memory fallback.
    }
  }, []);

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

  // Apply occasion-based theme automatically using Tampa-aware logic.
  useEffect(() => {
    const syncTheme = () => {
      const currentTheme = getCurrentTheme();
      setTheme(currentTheme);
      applyTheme(currentTheme);
    };

    syncTheme();
    const interval = window.setInterval(syncTheme, 60000);
    window.addEventListener('focus', syncTheme);
    document.addEventListener('visibilitychange', syncTheme);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncTheme);
      document.removeEventListener('visibilitychange', syncTheme);
    };
  }, []);

  // Persist favorites
  useEffect(() => {
    try { localStorage.setItem('netrikxr-favorites', JSON.stringify(favorites)); } catch (_) {}
  }, [favorites]);

  const fetchRestaurantMeta = useCallback(async (cancelState?: { cancelled: boolean }) => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, status, plan')
      .eq('id', restaurantId)
      .maybeSingle();

    if (cancelState?.cancelled) return;

    if (!data) {
      if (tenantScopedOrder) {
        setRestaurantStatus('disabled');
        setMenuLoadError('Tenant could not be resolved from this URL.');
        return;
      }

      const fallback = readRestaurantContext();
      setRestaurantName(fallback.restaurantName);
      setRestaurantStatus('active');
      setRestaurantPlan('premium');
      return;
    }

    const nextSlugRaw = normalizeRestaurantSlug(data.slug || DEFAULT_RESTAURANT_CONTEXT.restaurantSlug);
    const nextSlug = nextSlugRaw === LEGACY_DEFAULT_RESTAURANT_SLUG
      ? DEFAULT_RESTAURANT_CONTEXT.restaurantSlug
      : nextSlugRaw;
    if (tenantScopedOrder && nextSlug !== normalizedForcedTenantSlug) {
      setRestaurantStatus('disabled');
      setMenuLoadError('Tenant URL does not match this restaurant context.');
      return;
    }

    const nextName = (data.name || DEFAULT_RESTAURANT_CONTEXT.restaurantName).trim() || DEFAULT_RESTAURANT_CONTEXT.restaurantName;
    const nextStatus = data.status === 'disabled' ? 'disabled' : 'active';
    const nextPlan = data.plan === 'premium' ? 'premium' : 'basic';

    setRestaurantSlug(nextSlug);
    setRestaurantName(nextName);
    setRestaurantStatus(nextStatus);
    setRestaurantPlan(nextPlan);

    persistRestaurantContext({
      restaurantId: data.id,
      restaurantSlug: nextSlug,
      restaurantName: nextName,
    });
  }, [normalizedForcedTenantSlug, restaurantId, tenantScopedOrder]);

  useEffect(() => {
    const cancelState = { cancelled: false };
    fetchRestaurantMeta(cancelState);

    return () => {
      cancelState.cancelled = true;
    };
  }, [fetchRestaurantMeta]);

  useEffect(() => {
    if (!restaurantId) return;

    const restaurantStatusSub = supabase
      .channel(`order-restaurant-status-${restaurantId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurants',
        filter: `id=eq.${restaurantId}`,
      }, (payload: any) => {
        const nextStatus = payload?.new?.status === 'disabled' ? 'disabled' : 'active';
        const nextPlan = payload?.new?.plan === 'premium' ? 'premium' : 'basic';
        setRestaurantStatus(nextStatus);
        setRestaurantPlan(nextPlan);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || status === 'SUBSCRIBED') {
          fetchRestaurantMeta();
        }
      });

    return () => {
      supabase.removeChannel(restaurantStatusSub);
    };
  }, [restaurantId, fetchRestaurantMeta]);

  useEffect(() => {
    if (restaurantStatus === 'disabled') {
      setMenuLoadError('Restaurant is temporarily disabled. Please contact staff.');
      if (!tenantDisabledNoticeRef.current) {
        addBotMessage('Service is temporarily paused for this restaurant. Please contact staff for assistance.', []);
        tenantDisabledNoticeRef.current = true;
      }
      return;
    }

    if (tenantDisabledNoticeRef.current) {
      tenantDisabledNoticeRef.current = false;
      setMenuLoadError(null);
      addBotMessage('Service is back online. You can continue ordering.', [{ label: '🍽️ See Menu', value: 'menu' }]);
    }
  }, [restaurantStatus]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QueuedCheckout;
      if (!parsed?.pendingItems?.length) {
        localStorage.removeItem(CHECKOUT_QUEUE_KEY);
        return;
      }
      const queuedRestaurantId = parsed.restaurantId || 1;
      if (parsed.tableNumber === tableNumber && queuedRestaurantId === restaurantId) {
        setQueuedCheckout(parsed);
      }
    } catch {
      localStorage.removeItem(CHECKOUT_QUEUE_KEY);
    }
  }, [tableNumber, restaurantId]);

  useEffect(() => {
    if (!restaurantId || tenantResolving) {
      if (!tenantResolving) setPaymentGatewayLoading(false);
      return;
    }

    const fetchPaymentGatewayStatus = async () => {
      try {
        const res = await fetch(`/api/payment/status?restaurantId=${restaurantId}&restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
          headers: {
            'x-restaurant-id': String(restaurantId),
            'x-restaurant-slug': restaurantSlug,
          },
        });
        if (!res.ok) return;
        const data = await res.json() as PaymentGatewayStatus;
        setPaymentGatewayStatus(data);
      } catch {
        // Keep default fallback state.
      } finally {
        setPaymentGatewayLoading(false);
      }
    };

    fetchPaymentGatewayStatus();
  }, [restaurantId, restaurantSlug, tenantResolving]);

  // If the customer empties cart after the flow completes, start a fresh add-on baseline.
  useEffect(() => {
    if (cart.length === 0 && !waitingForConfirmation) {
      setSubmittedQuantities({});
      setLastOrderWasAddOn(false);
      setLastSubmittedItemsCount(0);
      setLastSubmittedSubtotal(0);
    }
  }, [cart.length, waitingForConfirmation]);

  useEffect(() => {
    return () => {
      if (confirmationFlashTimerRef.current) {
        window.clearTimeout(confirmationFlashTimerRef.current);
      }
    };
  }, []);

  // Toggle favorite
  const toggleFavorite = (itemId: number) => {
    setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const triggerConfirmationHaptic = () => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Short success pattern: tap, pause, tap.
    navigator.vibrate([45, 30, 65]);
  };

  const handleOrderTransition = useCallback((nextStatus: string, orderId: number) => {
    const transitionKey = `${orderId}:${nextStatus}`;
    if (handledOrderTransitionsRef.current.has(transitionKey)) return;
    handledOrderTransitionsRef.current.add(transitionKey);

    if (nextStatus === 'confirmed') {
      triggerConfirmationHaptic();
      setWaitingForConfirmation(false);
      setCurrentOrderId(null);
      setShowConfirmationFlash(true);
      if (confirmationFlashTimerRef.current) {
        window.clearTimeout(confirmationFlashTimerRef.current);
      }
      confirmationFlashTimerRef.current = window.setTimeout(() => {
        setShowConfirmationFlash(false);
      }, 1200);
      addBotMessage(
        `✅ Your ${lastOrderWasAddOn ? 'add-on ' : ''}order has been confirmed!\n\nReceipt: ${receiptId}\nTable: ${tableNumber}\nItems: ${lastSubmittedItemsCount}\nSubtotal: $${lastSubmittedSubtotal.toFixed(2)}\n\n🍹 Your drinks are being prepared!\n💵 Pay cash to the manager when ready.`,
        [
          { label: '➕ Order More', value: 'more' },
          { label: '💵 Add Tip & Bill', value: 'pay' }
        ]
      );
      return;
    }

    if (nextStatus === 'cancelled') {
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
  }, [lastOrderWasAddOn, receiptId, tableNumber, lastSubmittedItemsCount, lastSubmittedSubtotal]);

  // Call waiter function
  const callWaiter = async () => {
    if (callingWaiter) return;
    if (restaurantStatus === 'disabled') {
      addBotMessage('This restaurant account is currently unavailable. Please ask staff for help.', []);
      return;
    }

    setCallingWaiter(true);
    try {
      await supabase.from('orders').insert({
        restaurant_id: restaurantId,
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

  // Initial fetch + real-time menu sync
  useEffect(() => {
    const fetchMenu = async () => {
      if (!restaurantId || tenantResolving) {
        if (!tenantResolving) setMenuLoading(false);
        return;
      }

      if (restaurantStatus === 'disabled') {
        setMenuLoading(false);
        setMenuLoadError('Restaurant is temporarily disabled. Please contact support.');
        return;
      }

      try {
        setMenuLoadError(null);
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('available', true)
          .order('category');
        if (error) {
          setMenuLoadError('Could not sync menu. Pull to refresh or tap retry.');
          return;
        }
        if (data) setMenuItems((data as MenuItem[]).map(withResolvedMenuImage));
      } finally {
        setMenuLoading(false);
      }
    };
    fetchMenu();

    // Real-time menu updates
    const menuSub = supabase
      .channel(`menu-realtime-order-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchMenu();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || status === 'SUBSCRIBED') {
          fetchMenu();
        }
      });

    return () => {
      supabase.removeChannel(menuSub);
    };
  }, [menuReloadTick, restaurantId, restaurantStatus, tenantResolving]);

  // Verify payment on return from Stripe or PayPal checkout pages.
  useEffect(() => {
    const paymentState = searchParams.get('payment');
    const provider = searchParams.get('provider');
    const orderIdRaw = searchParams.get('order');

    if (!paymentState || !provider || !orderIdRaw) return;

    if (paymentState === 'cancel') {
      setLastPaymentProvider(provider === 'paypal' ? 'paypal' : 'card');
      setPaymentStatusMessage('Payment was cancelled. You can try again any time.');
      return;
    }

    if (paymentState !== 'success') return;

    const orderId = Number(orderIdRaw);
    if (!Number.isFinite(orderId)) return;

    const verifyPayment = async () => {
      setPaymentVerifying(true);
      try {
        const payload: {
          provider: 'stripe' | 'paypal';
          orderId: number;
          restaurantId: number;
          restaurantSlug: string;
          sessionId?: string;
          paypalToken?: string;
        } = {
          provider: provider === 'paypal' ? 'paypal' : 'stripe',
          orderId,
          restaurantId,
          restaurantSlug,
        };

        if (provider === 'paypal') {
          const token = searchParams.get('token');
          if (!token) return;
          payload.paypalToken = token;
        } else {
          const sessionId = searchParams.get('session_id');
          if (!sessionId) return;
          payload.sessionId = sessionId;
        }

        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-restaurant-id': String(restaurantId),
            'x-restaurant-slug': restaurantSlug,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json() as { success?: boolean };
        if (data.success) {
          setLastPaymentProvider(null);
          setPaymentStatusMessage('Payment successful. Your order is marked as paid.');
          addBotMessage('✅ Payment received successfully! Your order is now marked as paid.', [
            { label: '🍽️ Order More', value: 'menu' },
            { label: '⭐ Rate Experience', value: 'done' }
          ]);
        } else {
          setLastPaymentProvider(provider === 'paypal' ? 'paypal' : 'card');
          setPaymentStatusMessage('We could not verify payment automatically. Please contact staff.');
        }
      } catch {
        setLastPaymentProvider(provider === 'paypal' ? 'paypal' : 'card');
        setPaymentStatusMessage('Payment verification failed. Please contact staff if amount was charged.');
      } finally {
        setPaymentVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, restaurantId, restaurantSlug]);

  // Listen for order confirmation/cancellation from admin
  useEffect(() => {
    if (!currentOrderId || !waitingForConfirmation) return;

    const syncCurrentOrderStatus = async () => {
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', currentOrderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!data?.status) return;
      if (data.status === 'confirmed' || data.status === 'cancelled') {
        handleOrderTransition(data.status, currentOrderId);
      }
    };

    const orderSub = supabase
      .channel(`order-confirmation-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload: any) => {
          if (payload.new?.id === currentOrderId) {
            handleOrderTransition(payload.new.status, currentOrderId);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || status === 'SUBSCRIBED') {
          syncCurrentOrderStatus();
        }
      });

    return () => {
      supabase.removeChannel(orderSub);
    };
  }, [currentOrderId, waitingForConfirmation, handleOrderTransition, restaurantId]);

  // Fallback polling prevents stuck "waiting" state if websocket updates are missed.
  useEffect(() => {
    if (!currentOrderId || !waitingForConfirmation) return;

    const pollId = window.setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', currentOrderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!data?.status) return;
      if (data.status === 'confirmed' || data.status === 'cancelled') {
        handleOrderTransition(data.status, currentOrderId);
      }
    }, 9000);

    return () => window.clearInterval(pollId);
  }, [currentOrderId, waitingForConfirmation, handleOrderTransition, restaurantId]);

  // Welcome message
  useEffect(() => {
    if (menuItems.length > 0 && chatMessages.length === 0) {
      const storedCount = parseInt(localStorage.getItem('netrikxr-order-count') || '0');
      setOrderCount(storedCount);
      const loyaltyMsg = storedCount > 0 ? `\n\n🌟 Welcome back! You've ordered ${storedCount} time${storedCount > 1 ? 's' : ''} with us!` : '';
      const displayRestaurantName = (restaurantName || 'this restaurant').trim() || 'this restaurant';

      addBotMessage(
        `Welcome to ${displayRestaurantName}! ${theme.emoji}\n\nI'm SIA, your ordering assistant at Table ${tableNumber}.${loyaltyMsg}\n\n${getSmartDayGreeting(theme.name)}\n\nBefore we place your order, I can note allergies, ingredient exclusions, and spice level for the kitchen.\n\nPopular tonight:\n- Marinated Lambchops\n- Seafood Trio\n- Strip Steak\n\nWhat would you like to try?`,
        [
          { label: '🍽️ See Menu', value: 'menu' },
          { label: '🔥 Popular', value: 'popular' },
          { label: '🌶️ Spicy', value: 'spicy' },
          { label: '🦞 Seafood', value: 'seafood' },
          { label: '🛡️ Add Allergy Notes', value: 'instructions' },
          { label: '❤️ Favorites', value: 'favorites' },
          { label: '❓ Help', value: 'help' }
        ]
      );
    }
  }, [menuItems, tableNumber, chatMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto scroll
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [chatMessages, isBotTyping]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionCtor = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as VoiceRecognitionFactory | undefined;
    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';
      const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

      for (let i = startIndex; i < event.results.length; i++) {
        const part = event.results[i]?.[0]?.transcript || '';
        if (!part) continue;
        if (event.results[i].isFinal) finalTranscript += ` ${part}`;
        else interim += ` ${part}`;
      }

      if (interim.trim()) {
        setInterimVoiceTranscript(interim.trim());
      }

      if (finalTranscript.trim()) {
        const cleaned = normalizeVoiceText(finalTranscript);
        if (!cleaned) return;
        setInterimVoiceTranscript('');
        setPendingVoiceTranscript(cleaned);
        setVoiceStatusMessage('Voice captured. Processing command...');
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      setInterimVoiceTranscript('');
      setVoiceStatusMessage('Voice input failed. Try again.');
      setTimeout(() => setVoiceStatusMessage(null), 2200);
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimVoiceTranscript('');
    };

    voiceRecognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      if (voiceStatusTimerRef.current) window.clearTimeout(voiceStatusTimerRef.current);
      recognition.stop();
      voiceRecognitionRef.current = null;
    };
  }, []);

  function addBotMessage(content: string, options?: { label: string; value: string }[], extra?: Partial<ChatMessage>) {
    const tenantDisplayName = (restaurantName || 'this restaurant').trim() || 'this restaurant';
    const normalizedContent = content
      .replace(/Coasis Restaurant Bar & Suites/gi, tenantDisplayName)
      .replace(/Welcome to Coasis/gi, `Welcome to ${tenantDisplayName}`)
      .replace(/Coasis's\s+AI/gi, `${tenantDisplayName}'s AI`)
      .replace(/Coasis has/gi, 'this restaurant has');

    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'bot',
      content: normalizedContent,
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

  const handleOptionClick = (value: string) => {
    switch (value) {
      case 'instructions':
        addUserMessage('Add allergy and instruction notes');
        addBotMessage(
          `Perfect. Please share any of the following:\n\n• Allergies (US major allergens): peanuts, tree nuts, milk/dairy, egg, fish, shellfish, wheat/gluten, soy, sesame\n• Ingredient exclusions: no potato, no tomato, no onion, no garlic\n• Spice level: mild, medium, or hot\n• Prep notes: sauce on side, well-done, extra crispy\n\nExample: "Shellfish allergy, no tomato, mild spice."`,
          [
            { label: '🌶️ Mild Spice', value: 'mild_spice' },
            { label: '🌶️ Medium Spice', value: 'medium_spice' },
            { label: '🌶️ Hot Spice', value: 'hot_spice' }
          ]
        );
        break;
      case 'mild_spice':
        addUserMessage('Set spice level to mild');
        setGuestInstructions(prev => ({ ...prev, spiceLevel: 'mild' }));
        addBotMessage('Got it. I saved your spice level as mild.');
        break;
      case 'medium_spice':
        addUserMessage('Set spice level to medium');
        setGuestInstructions(prev => ({ ...prev, spiceLevel: 'medium' }));
        addBotMessage('Got it. I saved your spice level as medium.');
        break;
      case 'hot_spice':
        addUserMessage('Set spice level to hot');
        setGuestInstructions(prev => ({ ...prev, spiceLevel: 'hot' }));
        addBotMessage('Got it. I saved your spice level as hot.');
        break;
      case 'popular':
        addUserMessage('Show popular items');
        addBotMessage(
          `Most Popular Tonight:\n\n- Marinated Lambchops - $42\n- Strip Steak - $30\n- Seafood Trio - $42\n- Southern Fried Chicken - $28\n\nType any dish name and I will tell you all about it.`,
          [
            { label: 'Full Menu', value: 'menu' },
            { label: 'View Cart', value: 'cart' }
          ]
        );
        break;
      case 'spicy':
        addUserMessage('Show spicy dishes');
        addBotMessage(
          `Spicy Picks:\n\n- Crispy Chilli Garlic Shrimp - $14\n- Blue Cheese Buffalo Wings - $14\n- Cajun Seafood Dip - $18\n- Salmon and Crab Fried Rice - $38\n\nWant to try one? Just type the name.`,
          [
            { label: 'Full Menu', value: 'menu' },
            { label: 'View Cart', value: 'cart' }
          ]
        );
        break;
      case 'seafood':
        addUserMessage('Show seafood dishes');
        addBotMessage(
          `Seafood Favorites:\n\n- Chargrilled Oysters - $18/$32\n- Seafood Trio - $42\n- Lobster and Crab Fried Rice - $42\n- Salmon and Crab Fried Rice - $38\n- Crispy Chilli Garlic Shrimp - $14\n- Grilled or Fried Branzino - $34\n\nType any dish name for details.`,
          [
            { label: 'Full Menu', value: 'menu' },
            { label: 'View Cart', value: 'cart' }
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
          setInstructionReviewConfirmed(false);
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
      applyEntitiesToGuestInstructions(response.entities);

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
        if (response.entities.allergies && response.entities.allergies.length > 0) {
          updated.allergies = Array.from(new Set([...(updated.allergies || []), ...response.entities.allergies]));
        }
        if (response.entities.ingredientExclusions && response.entities.ingredientExclusions.length > 0) {
          updated.ingredientExclusions = Array.from(new Set([...(updated.ingredientExclusions || []), ...response.entities.ingredientExclusions]));
        }
        if (response.entities.spiceLevel) {
          updated.spiceLevel = response.entities.spiceLevel;
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
        setInstructionReviewConfirmed(false);
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
        setInstructionReviewConfirmed(false);
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

  const toggleVoiceInput = () => {
    if (!voiceRecognitionRef.current) {
      setVoiceStatusMessage('Voice input is not supported in this browser.');
      setTimeout(() => setVoiceStatusMessage(null), 2200);
      return;
    }

    if (isListening) {
      voiceRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    setVoiceStatusMessage('Listening... speak now');
    setIsListening(true);
    try {
      voiceRecognitionRef.current.start();
    } catch {
      setIsListening(false);
      setVoiceStatusMessage('Could not start voice input.');
      setTimeout(() => setVoiceStatusMessage(null), 2000);
    }
  };

  useEffect(() => {
    if (!pendingVoiceTranscript) return;

    const spoken = pendingVoiceTranscript;
    setPendingVoiceTranscript(null);

    const executeIntent = (intent: string) => {
      handleOptionClick(intent);
      if (voiceStatusTimerRef.current) window.clearTimeout(voiceStatusTimerRef.current);
      setVoiceStatusMessage('Voice command executed.');
      voiceStatusTimerRef.current = window.setTimeout(() => setVoiceStatusMessage(null), 1500);
    };

    if (/(show|open|see).*(menu)|\bmenu\b/.test(spoken)) return executeIntent('menu');
    if (/(show|open|view).*(cart)|\bcart\b/.test(spoken)) return executeIntent('cart');
    if (/(checkout|place order|send order)/.test(spoken)) return executeIntent('checkout');
    if (/(call|need).*(waiter)|\bwaiter\b/.test(spoken)) return executeIntent('call_waiter');
    if (/(popular|best seller|top)/.test(spoken)) return executeIntent('popular');
    if (/(seafood|fish|shrimp|lobster)/.test(spoken)) return executeIntent('seafood');
    if (/(spicy|hot)/.test(spoken)) return executeIntent('spicy');
    if (/(favorite|favourites|favorites)/.test(spoken)) return executeIntent('favorites');
    if (/(recommend|suggest)/.test(spoken)) return executeIntent('recommend');
    if (/(help|how to)/.test(spoken)) return executeIntent('help');
    if (/(bill|payment|pay now)/.test(spoken)) return executeIntent('pay');

    const addMatch = spoken.match(/(?:add|order|get)\s+(\d+)?\s*(.*)/);
    if (addMatch) {
      const quantity = Math.max(1, Number(addMatch[1] || '1'));
      const dishQuery = addMatch[2]?.trim();
      const matched = dishQuery ? getBestMenuVoiceMatch(menuItems, dishQuery) : null;

      if (matched) {
        setInstructionReviewConfirmed(false);
        setCart(prev => {
          const existing = prev.find(i => i.id === matched.id);
          if (existing) {
            return prev.map(i => i.id === matched.id ? { ...i, quantity: i.quantity + quantity } : i);
          }
          return [...prev, { ...matched, quantity }];
        });
        addBotMessage(`🎤 Added ${quantity}x ${matched.name} from voice command.`, [
          { label: '🛒 View Cart', value: 'cart' },
          { label: '➕ Add More', value: 'menu' },
        ]);
        if (voiceStatusTimerRef.current) window.clearTimeout(voiceStatusTimerRef.current);
        setVoiceStatusMessage('Voice order added to cart.');
        voiceStatusTimerRef.current = window.setTimeout(() => setVoiceStatusMessage(null), 1600);
        return;
      }
    }

    setUserInput(prev => (prev ? `${prev} ${spoken}` : spoken));
    if (voiceStatusTimerRef.current) window.clearTimeout(voiceStatusTimerRef.current);
    setVoiceStatusMessage('Voice converted to text. Tap send.');
    voiceStatusTimerRef.current = window.setTimeout(() => setVoiceStatusMessage(null), 1800);
  // We intentionally depend on transcript/menu data only; function identities are stable enough for this immediate command flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceTranscript, menuItems]);

  const submitPendingOrder = useCallback(async (
    pendingItems: PendingCheckoutItem[],
    isAddOnOrder: boolean,
    source: 'live' | 'queued'
  ) => {
    if (pendingItems.length === 0) return { success: false, reason: 'empty' as const };
    if (restaurantStatus === 'disabled') {
      return { success: false, reason: 'disabled' as const, message: 'Restaurant account is disabled.' };
    }

    if (source === 'queued') setRetryingQueuedCheckout(true);
    else setLoading(true);

    const pendingSubtotalAmount = pendingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const pendingTax = calculateOrderTotal(pendingSubtotalAmount, 0).taxAmount;
    const pendingTotal = pendingSubtotalAmount + pendingTax;
    const itemCount = pendingItems.reduce((sum, item) => sum + item.quantity, 0);

    const receiptPrefix = isAddOnOrder ? 'ADD' : 'ORD';
    const receipt = `${receiptPrefix}-${tableNumber}-${Date.now().toString().slice(-6)}`;
    setReceiptId(receipt);
    setLastSubmittedSubtotal(pendingSubtotalAmount);
    setLastSubmittedItemsCount(itemCount);
    setLastOrderWasAddOn(isAddOnOrder);

    const orderData = {
      restaurant_id: restaurantId,
      table_number: parseInt(tableNumber),
      items: pendingItems,
      subtotal: pendingSubtotalAmount,
      tip_amount: 0,
      tax_amount: pendingTax,
      total: pendingTotal,
      status: 'pending',
      payment_status: 'unpaid',
      receipt_id: receipt,
      customer_note: (() => {
        const instructionParts: string[] = [];
        if (guestInstructions.allergies.length > 0) instructionParts.push(`ALLERGIES: ${guestInstructions.allergies.join(', ')}`);
        if (guestInstructions.ingredientExclusions.length > 0) instructionParts.push(`EXCLUDE: ${guestInstructions.ingredientExclusions.join(', ')}`);
        if (guestInstructions.spiceLevel) instructionParts.push(`SPICE: ${guestInstructions.spiceLevel}`);
        if (guestInstructions.specialInstructions.length > 0) instructionParts.push(`NOTES: ${guestInstructions.specialInstructions.join(', ')}`);

        const base = isAddOnOrder
          ? `ADD_ON_ORDER | table ${tableNumber} | contains only newly added items`
          : 'NEW_ORDER | initial order from chatbot';

        return instructionParts.length > 0
          ? `${base} | ${instructionParts.join(' | ')}`
          : base;
      })()
    };

    try {
      const { data: insertedData, error } = await supabase.from('orders').insert(orderData).select();

      if (error) {
        console.error('Order error:', error);
        return { success: false, reason: 'insert_error' as const, message: error.message || 'Could not place order' };
      }

      if (insertedData && insertedData[0]) {
        const insertedOrderId = insertedData[0].id;
        setCurrentOrderId(insertedOrderId);
        setLatestOrderIdForPayment(insertedOrderId);
        // Keep table occupancy in sync immediately instead of waiting for manual admin actions.
        await supabase
          .from('restaurant_tables')
          .update({ status: 'occupied', current_order_id: receipt })
          .eq('table_number', parseInt(tableNumber))
          .eq('restaurant_id', restaurantId);
      }

      setSubmittedQuantities(prev => {
        const next = { ...prev };
        for (const item of pendingItems) {
          next[item.id] = (next[item.id] || 0) + item.quantity;
        }
        return next;
      });

      setOrderPlaced(true);
      setWaitingForConfirmation(true);

      const newCount = orderCount + 1;
      setOrderCount(newCount);
      try { localStorage.setItem('netrikxr-order-count', newCount.toString()); } catch (_) {}

      const waitMin = Math.min(3 + itemCount, 12);
      setEstimatedWait(waitMin);

      if (source === 'queued') {
        setQueuedCheckout(null);
        saveQueuedCheckout(null);
      }

      addBotMessage(
        `${source === 'queued' ? '🌐 Reconnected and sent queued order!' : '📤'} ${isAddOnOrder ? 'Add-on Order' : 'Order'} Sent!\n\nReceipt: ${receipt}\nTable: ${tableNumber}\nItems: ${itemCount}\nSubtotal: $${pendingSubtotalAmount.toFixed(2)}\n⏱️ Est. wait: ~${waitMin} min\n\n⏳ Waiting for staff confirmation...`,
        [{ label: '🔔 Call Waiter', value: 'call_waiter' }]
      );

      return { success: true as const };
    } catch {
      return { success: false, reason: 'network' as const, message: 'Network error while placing order' };
    } finally {
      if (source === 'queued') setRetryingQueuedCheckout(false);
      else setLoading(false);
    }
  }, [guestInstructions, orderCount, saveQueuedCheckout, tableNumber, restaurantId, restaurantStatus]);

  const retryQueuedCheckout = useCallback(async () => {
    if (!queuedCheckout || !navigator.onLine || retryingQueuedCheckout || waitingForConfirmation) return;
    if ((queuedCheckout.restaurantId || 1) !== restaurantId) return;

    const result = await submitPendingOrder(queuedCheckout.pendingItems, queuedCheckout.isAddOnOrder, 'queued');
    if (!result.success) {
      addBotMessage(
        'Still unable to sync queued order. We will retry automatically when network is stable.',
        [{ label: '🔄 Retry Now', value: 'checkout' }]
      );
    }
  }, [queuedCheckout, retryingQueuedCheckout, submitPendingOrder, waitingForConfirmation, restaurantId]);

  useEffect(() => {
    if (!isOnline || !queuedCheckout || retryingQueuedCheckout || waitingForConfirmation) return;
    retryQueuedCheckout();
  }, [isOnline, queuedCheckout, retryingQueuedCheckout, retryQueuedCheckout, waitingForConfirmation]);

  const handleCheckout = async () => {
    if (restaurantStatus === 'disabled') {
      addBotMessage('Ordering is temporarily disabled for this restaurant. Please contact staff.', []);
      return;
    }

    if (cart.length === 0) {
      addBotMessage('Your cart is empty! Add some items first.', [{ label: '📋 View Menu', value: 'menu' }]);
      return;
    }

    const pendingItems = getPendingItemsFromCart();
    if (pendingItems.length === 0) {
      addBotMessage(
        'I do not see any new items to send. Add or increase an item first, then place order again.',
        [
          { label: '🍽️ Add More', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' }
        ]
      );
      return;
    }

    const isAddOnOrder = Object.keys(submittedQuantities).length > 0;

    if (!instructionReviewConfirmed) {
      addBotMessage(
        'Before placing your order, please review kitchen instructions (allergy, spice, exclusions) in cart and tap "Confirm Kitchen Instructions".',
        [{ label: '🛒 Review Instructions', value: 'cart' }]
      );
      return;
    }

    if (!navigator.onLine) {
      const queued: QueuedCheckout = {
        restaurantId,
        tableNumber,
        pendingItems,
        isAddOnOrder,
        queuedAt: Date.now(),
      };

      setQueuedCheckout(queued);
      saveQueuedCheckout(queued);
      addBotMessage(
        '📡 You are offline. I queued your order and will auto-send it when internet reconnects.',
        [{ label: '🛒 View Cart', value: 'cart' }]
      );
      return;
    }

    addUserMessage('Place my order');
    const result = await submitPendingOrder(pendingItems, isAddOnOrder, 'live');

    if (!result.success) {
      if (result.reason === 'network') {
        const queued: QueuedCheckout = {
          restaurantId,
          tableNumber,
          pendingItems,
          isAddOnOrder,
          queuedAt: Date.now(),
        };
        setQueuedCheckout(queued);
        saveQueuedCheckout(queued);
        addBotMessage(
          '📡 Network was unstable. I queued your order and will retry automatically once online.',
          [{ label: '🛒 View Cart', value: 'cart' }]
        );
        return;
      }

      addBotMessage(`❌ Error: ${result.message || 'Could not place order'}. Please try again.`, [{ label: '🔄 Try Again', value: 'checkout' }]);
    }
  };

  const addToCart = (item: MenuItem) => {
    setInstructionReviewConfirmed(false);
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
    setInstructionReviewConfirmed(false);
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
    setItemInstructions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInstructionReviewConfirmed(false);
  };

  const handleTipSelect = (tip: number) => {
    setSelectedTip(tip);
  };

  const handleOnlinePayment = async (provider: 'card' | 'paypal') => {
    const providerConfigured = provider === 'card'
      ? paymentGatewayStatus.stripeConfigured
      : paymentGatewayStatus.paypalConfigured;

    if (!providerConfigured) {
      if (paymentGatewayStatus.plan === 'basic') {
        setPaymentStatusMessage('Online payment is enabled on premium plan only. Please pay cash to manager.');
        return;
      }

      setPaymentStatusMessage(
        provider === 'card'
          ? 'Card payment is in setup mode right now. Please pay cash to manager.'
          : 'PayPal is in setup mode right now. Please pay cash to manager.'
      );
      return;
    }

    if (!paymentOrderId || !receiptId) {
      setPaymentStatusMessage('Place an order first before paying online.');
      return;
    }

    setLastPaymentProvider(provider);
    setPaymentStatusMessage(null);
    setPaymentLoading(provider);

    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-id': String(restaurantId),
          'x-restaurant-slug': restaurantSlug,
        },
        body: JSON.stringify({
          provider,
          orderId: paymentOrderId,
          receiptId,
          amount: total,
          tableNumber,
          restaurantId,
          restaurantSlug,
        }),
      });

      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setPaymentStatusMessage(data.error || 'Online payment is not available right now.');
        return;
      }

      window.location.href = data.url;
    } catch {
      setPaymentStatusMessage('Unable to start payment right now. Please try again.');
    } finally {
      setPaymentLoading(null);
    }
  };

  const handleCashPaidToManager = async () => {
    if (!paymentOrderId || !receiptId) {
      setPaymentStatusMessage('Place an order first before confirming cash payment.');
      return;
    }

    const confirmed = window.confirm('Confirm that you paid cash to the manager?');
    if (!confirmed) return;

    setCashPaymentLoading(true);
    setPaymentStatusMessage(null);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'paid',
          payment_method: 'cash',
          payment_type: 'direct_cash',
          transaction_id: `cash-${Date.now()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentOrderId)
        .eq('restaurant_id', restaurantId);

      if (error) {
        setPaymentStatusMessage('Could not confirm cash payment right now. Please ask manager to confirm.');
        return;
      }

      await supabase
        .from('restaurant_tables')
        .update({ status: 'available', current_order_id: null })
        .eq('table_number', Number(tableNumber))
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('payment_event_audit')
        .insert({
          restaurant_id: restaurantId,
          order_id: paymentOrderId,
          receipt_id: receiptId,
          provider: 'system',
          event_type: 'cash_paid_to_manager_customer_confirmed',
          status: 'success',
          amount: total,
          currency: 'USD',
          transaction_id: `cash-${Date.now()}`,
          source: 'customer-bill',
          event_time: new Date().toISOString(),
          raw_payload: { table_number: tableNumber },
        });

      setPaymentStatusMessage('Cash payment confirmed. Thank you!');
      addBotMessage('✅ Cash payment marked as paid. Thanks for dining with us!', [
        { label: '⭐ Rate Experience', value: 'done' },
        { label: '🍽️ Order More', value: 'menu' }
      ]);
    } catch {
      setPaymentStatusMessage('Could not confirm cash payment right now. Please ask manager to confirm.');
    } finally {
      setCashPaymentLoading(false);
    }
  };

  const handleRatingSubmit = async () => {
    if (rating === 0) return;
    
    if (receiptId) {
      const finalCalculation = calculateOrderTotal(subtotal, selectedTip);
      const { error } = await supabase
        .from('orders')
        .update({
          rating,
          tip_amount: finalCalculation.tipAmount,
          tax_amount: finalCalculation.taxAmount,
          total: finalCalculation.total,
        })
        .eq('receipt_id', receiptId)
        .eq('restaurant_id', restaurantId);
      if (error) console.error('Rating update error:', error);
    }
    
    setShowThankYou(true);
    setCart([]);
    setSubmittedQuantities({});
    setLatestOrderIdForPayment(null);
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
      const currentInstruction = itemInstructions[item.id];
      doc.text(item.name.substring(0, 25), 20, y);
      doc.text(item.quantity.toString(), 105, y);
      doc.text(`$${item.price.toFixed(2)}`, 130, y);
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
      const notes: string[] = [];
      if (currentInstruction?.spiceLevel) notes.push(`spice: ${currentInstruction.spiceLevel}`);
      if (currentInstruction?.notes?.trim()) notes.push(currentInstruction.notes.trim());
      if (notes.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(`  note: ${notes.join(' | ').slice(0, 80)}`, 20, y);
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(0);
      }
    });

    if (guestInstructions.allergies.length > 0 || guestInstructions.ingredientExclusions.length > 0 || guestInstructions.specialInstructions.length > 0) {
      y += 4;
      doc.line(20, y, pageWidth - 20, y);
      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Kitchen Instructions', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      if (guestInstructions.allergies.length > 0) {
        y += 5;
        doc.text(`Allergies: ${guestInstructions.allergies.join(', ')}`.slice(0, 100), 20, y);
      }
      if (guestInstructions.ingredientExclusions.length > 0) {
        y += 5;
        doc.text(`Exclusions: ${guestInstructions.ingredientExclusions.join(', ')}`.slice(0, 100), 20, y);
      }
      if (guestInstructions.specialInstructions.length > 0) {
        y += 5;
        doc.text(`Notes: ${guestInstructions.specialInstructions.join(', ')}`.slice(0, 100), 20, y);
      }
      doc.setFontSize(10);
      doc.setTextColor(60);
    }
    
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
            transition={motionProfile.badge}
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

      {/* Status bar spacer for mobile browser safe-area */}
      <div className="status-bar-spacer" />

      {/* ========================================== */}
      {/* FIXED HEADER - Native App Style */}
      {/* ========================================== */}
      <header className="flex-shrink-0 sticky top-0 bg-black/95 backdrop-blur-xl border-b px-4 py-3 z-50 relative overflow-visible" style={{ borderColor: `${theme.primary}33` }}>
        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-1.5 mb-2 text-center">
            <p className="text-red-400 text-[12px] font-medium">📡 No internet connection</p>
          </div>
        )}
        {menuLoading && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 mb-2 text-center">
            <p className="text-gray-300 text-[12px] font-medium">Syncing latest menu...</p>
          </div>
        )}
        {menuLoadError && (
          <div className="rounded-lg px-3 py-2 mb-2 border border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-2">
            <p className="text-amber-300 text-[12px] font-medium">{menuLoadError}</p>
            <button
              type="button"
              onClick={() => {
                setMenuLoading(true);
                setMenuReloadTick(v => v + 1);
              }}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
            >
              Retry
            </button>
          </div>
        )}
        {queuedCheckout && (
          <div className="rounded-lg px-3 py-2 mb-2 border border-sky-500/35 bg-sky-500/10 flex items-center justify-between gap-2">
            <div>
              <p className="text-sky-200 text-[12px] font-semibold">Queued order pending sync</p>
              <p className="text-sky-100/80 text-[11px]">
                {queuedCheckout.pendingItems.reduce((sum, item) => sum + item.quantity, 0)} item(s) • queued at {new Date(queuedCheckout.queuedAt).toLocaleTimeString()}
              </p>
            </div>
            <button
              type="button"
              disabled={!isOnline || retryingQueuedCheckout || waitingForConfirmation}
              onClick={() => retryQueuedCheckout()}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-500/20 text-sky-100 disabled:opacity-50"
            >
              {retryingQueuedCheckout ? 'Retrying...' : 'Retry'}
            </button>
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
        {theme.id === 'miamisunday' && (
          <div className="mb-2 rounded-xl px-3 py-1.5 border border-cyan-400/35 bg-cyan-500/10 miami-wave text-center">
            <p className="text-[12px] font-semibold text-cyan-200">🌴 Sunday Miami Vibe • Tampa Weekend Mode</p>
          </div>
        )}
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`, boxShadow: `0 4px 15px ${theme.primary}33` }}>
              <Image src="/icons/icon-96x96.png" alt="N" width={28} height={28} className="rounded-md" />
            </div>
            <div>
              <p className="font-semibold text-[15px] leading-tight" style={{ color: theme.primary }}>{restaurantName}</p>
              <p className="text-[11px] text-gray-500 leading-tight">Table {tableNumber} • SIA Assistant • {restaurantPlan.toUpperCase()}</p>
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
        <div className="max-w-lg mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-6">
          <section className="space-y-2.5 sm:space-y-3">
          </section>

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
                transition={motionProfile.bubble}
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
                    className={`message-bubble rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'rounded-br-sm ml-auto user-chat-pop msg-bubble-user' : 'rounded-bl-sm bot-chat-pop msg-bubble-bot'}`}
                    style={msg.role === 'user' 
                      ? { background: theme.userBubbleBg, color: '#000' }
                      : { background: theme.botBubbleBg, border: `1px solid ${theme.botBubbleBorder}` }
                    }
                  >
                    <p className={`message-copy whitespace-pre-wrap ${msg.role === 'user' ? 'text-[14px] font-medium text-black/95' : 'text-[15px] text-zinc-100'}`}>{msg.content}</p>
                  </div>
                  <div className={`chat-time-row mt-1.5 text-[10px] ${msg.role === 'user' ? 'text-right' : 'text-left'} flex items-center gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="chat-time-pill">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'user' && (
                      <span className="chat-read-pill" aria-label="Read">
                        ✓✓
                      </span>
                    )}
                  </div>

                  {/* Quick Options */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.options.map((opt, optIndex) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionClick(opt.value)}
                          className="quick-chip-pop px-3.5 py-2 bg-zinc-900 rounded-xl text-[13px] font-medium active:scale-95"
                          style={{
                            border: `1px solid ${theme.primary}4d`,
                            color: theme.primary,
                            animationDelay: `${Math.min(optIndex, 5) * 65}ms`,
                          }}
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
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={motionProfile.panel}
                      className="mt-4 space-y-3"
                    >
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
                              <div key={item.id} className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 flex-shrink-0">
                                  <Image
                                    src={getDisplayImage(item)}
                                    alt={item.name}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0 mr-1">
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
                    </motion.div>
                  )}

                  {/* ========================================== */}
                  {/* CART DISPLAY */}
                  {/* ========================================== */}
                  {msg.showCart && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={motionProfile.panel}
                      className="mt-4 space-y-3"
                    >
                      {cart.length === 0 ? (
                        <div className="empty-cart-state rounded-2xl p-4 border" style={{ borderColor: `${theme.primary}40`, background: `linear-gradient(135deg, ${theme.primary}16, rgba(24,24,27,0.95))` }}>
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${theme.primary}2b` }}>
                              <ShoppingCart className="w-4 h-4" style={{ color: theme.primary }} />
                            </div>
                            <div>
                              <p className="text-[14px] font-semibold" style={{ color: theme.primaryLight }}>Your cart is waiting</p>
                              <p className="text-[12px] text-gray-300">Add a few picks to start your order.</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOptionClick('menu')}
                              className="py-2.5 text-black rounded-xl font-semibold text-[13px] active:scale-[0.98] transition-transform"
                              style={{ background: theme.primary }}
                            >
                              Browse Menu
                            </button>
                            <button
                              onClick={() => handleOptionClick('recommend')}
                              className="py-2.5 rounded-xl font-medium text-[13px] active:scale-[0.98] transition-transform"
                              style={{ border: `1px solid ${theme.primary}55`, color: theme.primary }}
                            >
                              Ask SIA Picks
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 mr-3 flex-shrink-0">
                                <Image
                                  src={getDisplayImage(item)}
                                  alt={item.name}
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1 mr-3 min-w-0">
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

                          <div className="rounded-xl p-3 border border-amber-500/35 bg-amber-500/10">
                            <p className="text-[12px] font-semibold text-amber-200 mb-2">Kitchen Instruction Review (required)</p>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                              {cart.map(item => {
                                const current = itemInstructions[item.id] || { notes: '', spiceLevel: undefined };
                                return (
                                  <div key={`inst-${item.id}`} className="rounded-lg bg-zinc-950/70 border border-zinc-800 p-2.5">
                                    <p className="text-[12px] font-semibold text-gray-100 mb-1">{item.name}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <select
                                        value={current.spiceLevel || ''}
                                        onChange={(e) => setItemInstruction(item.id, { spiceLevel: (e.target.value || undefined) as 'mild' | 'medium' | 'hot' | undefined })}
                                        className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] focus:outline-none"
                                      >
                                        <option value="">Spice: as chef standard</option>
                                        <option value="mild">Mild</option>
                                        <option value="medium">Medium</option>
                                        <option value="hot">Hot</option>
                                      </select>
                                      <input
                                        type="text"
                                        value={current.notes}
                                        onChange={(e) => setItemInstruction(item.id, { notes: e.target.value })}
                                        className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[12px] focus:outline-none"
                                        placeholder="Per-dish note (no tomato, no garlic, etc.)"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                              <p className="text-[11px] text-gray-300">Allergy profile: {guestInstructions.allergies.length > 0 ? guestInstructions.allergies.join(', ') : 'none provided'}</p>
                              <p className="text-[11px] text-gray-400">Exclusions: {guestInstructions.ingredientExclusions.length > 0 ? guestInstructions.ingredientExclusions.join(', ') : 'none'}</p>
                            </div>
                            <button
                              onClick={() => {
                                setInstructionReviewConfirmed(true);
                                addBotMessage('Kitchen instructions confirmed. Chef will receive these notes on the kitchen slip and your bill.');
                              }}
                              className="mt-2 w-full py-2.5 rounded-lg font-semibold text-[12px]"
                              style={instructionReviewConfirmed ? { background: '#14532d', color: '#bbf7d0', border: '1px solid #166534' } : { background: '#f59e0b', color: '#111827' }}
                            >
                              {instructionReviewConfirmed ? 'Kitchen Instructions Confirmed' : 'Confirm Kitchen Instructions'}
                            </button>
                          </div>

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
                            <button onClick={handleCheckout} disabled={loading || !instructionReviewConfirmed} className="flex-1 py-3 text-black rounded-xl font-bold text-[14px] disabled:opacity-50 active:scale-[0.98]" style={{ background: theme.primary }}>
                              {loading ? 'Placing...' : (instructionReviewConfirmed ? 'Place Order' : 'Confirm Instructions First')}
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
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
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={motionProfile.panel}
                      className="mt-4 space-y-3"
                    >
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
                          {cart.map(item => {
                            const itemNote = itemInstructions[item.id];
                            return (
                              <div key={item.id} className="space-y-1">
                                <div className="flex justify-between text-[13px]">
                                  <span>{item.quantity}x {item.name}</span>
                                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                                {(itemNote?.spiceLevel || itemNote?.notes?.trim()) && (
                                  <p className="text-[11px] text-amber-200/90 pl-1">
                                    {itemNote?.spiceLevel ? `Spice: ${itemNote.spiceLevel}` : ''}
                                    {itemNote?.spiceLevel && itemNote?.notes?.trim() ? ' | ' : ''}
                                    {itemNote?.notes?.trim() || ''}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                          {(guestInstructions.allergies.length > 0 || guestInstructions.ingredientExclusions.length > 0 || guestInstructions.specialInstructions.length > 0) && (
                            <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">Kitchen Instructions</p>
                              {guestInstructions.allergies.length > 0 && (
                                <p className="text-[11px] text-rose-100">Allergies: {guestInstructions.allergies.join(', ')}</p>
                              )}
                              {guestInstructions.ingredientExclusions.length > 0 && (
                                <p className="text-[11px] text-rose-100">Exclusions: {guestInstructions.ingredientExclusions.join(', ')}</p>
                              )}
                              {guestInstructions.specialInstructions.length > 0 && (
                                <p className="text-[11px] text-rose-100">Notes: {guestInstructions.specialInstructions.join(', ')}</p>
                              )}
                            </div>
                          )}
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
                        <button
                          onClick={handleCashPaidToManager}
                          disabled={cashPaymentLoading}
                          className="mt-2 w-full py-2 rounded-lg text-black text-[12px] font-semibold disabled:opacity-60"
                          style={{ background: theme.primary }}
                        >
                          {cashPaymentLoading ? 'Confirming...' : 'I Paid to Manager (Cash)'}
                        </button>
                      </div>
                      <div className="rounded-xl p-3 border border-sky-500/30 bg-sky-500/10 space-y-2">
                        <p className="text-[13px] font-medium text-sky-300 text-center">Or pay online securely (USD)</p>
                        {!paymentGatewayLoading && !paymentGatewayStatus.anyProviderConfigured && (
                          <p className="text-[12px] text-center text-amber-200">Online payment setup pending. Cash flow is active.</p>
                        )}
                        {!paymentGatewayLoading && paymentGatewayStatus.anyProviderConfigured && paymentGatewayStatus.mode === 'sandbox' && (
                          <div className="flex justify-center">
                            <button
                              onClick={() => setPaymentStatusMessage('Test mode active: only sandbox/test payments will work right now.')}
                              className="px-2.5 py-1 rounded-full border border-sky-300/30 bg-sky-500/15 text-[11px] font-semibold text-sky-100"
                            >
                              Test Mode Active
                            </button>
                          </div>
                        )}
                        {paymentVerifying && (
                          <p className="text-[12px] text-center text-sky-100">Verifying payment status...</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOnlinePayment('card')}
                            disabled={paymentLoading !== null || paymentGatewayLoading || !paymentGatewayStatus.stripeConfigured}
                            className="w-full py-2.5 px-3 rounded-xl font-semibold text-[13px] bg-white text-black disabled:opacity-60"
                          >
                            <CreditCard className="w-4 h-4 inline mr-1" />
                            {paymentLoading === 'card'
                              ? 'Connecting...'
                              : (paymentGatewayStatus.stripeConfigured ? 'Pay by Card' : 'Card Setup Pending')}
                          </button>
                          <button
                            onClick={() => handleOnlinePayment('paypal')}
                            disabled={paymentLoading !== null || paymentGatewayLoading || !paymentGatewayStatus.paypalConfigured}
                            className="w-full py-2.5 px-3 rounded-xl font-semibold text-[13px] bg-[#0070ba] text-white disabled:opacity-60"
                          >
                            {paymentLoading === 'paypal'
                              ? 'Connecting...'
                              : (paymentGatewayStatus.paypalConfigured ? 'Pay with PayPal' : 'PayPal Setup Pending')}
                          </button>
                        </div>
                        {paymentStatusMessage && (
                          <p className="text-[12px] text-center text-sky-100">{paymentStatusMessage}</p>
                        )}
                        {paymentStatusMessage && !paymentVerifying && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOnlinePayment(lastPaymentProvider || 'card')}
                              disabled={paymentLoading !== null}
                              className="w-full py-2 px-3 rounded-lg border border-white/20 text-white text-[12px] font-semibold disabled:opacity-60"
                            >
                              Retry {lastPaymentProvider === 'paypal' ? 'PayPal' : 'Card'}
                            </button>
                            <button
                              onClick={() => handleOnlinePayment(lastPaymentProvider === 'paypal' ? 'card' : 'paypal')}
                              disabled={paymentLoading !== null}
                              className="w-full py-2 px-3 rounded-lg border border-sky-300/30 text-sky-100 text-[12px] font-semibold disabled:opacity-60"
                            >
                              Try {lastPaymentProvider === 'paypal' ? 'Card' : 'PayPal'}
                            </button>
                          </div>
                        )}
                      </div>
                      <button onClick={generatePDF} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium text-[14px]">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={() => handleOptionClick('done')} className="w-full py-3 text-black rounded-xl font-bold text-[14px]" style={{ background: theme.primary }}>
                        Done
                      </button>
                    </motion.div>
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
                transition={motionProfile.typing}
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
      <AnimatePresence>
        {showOrderStatusDock && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={motionProfile.dock}
            className="flex-shrink-0 px-4 pb-2 safe-bottom-mini"
          >
            <div
              className="max-w-lg mx-auto rounded-2xl px-3.5 py-2.5 flex items-center justify-between"
              style={{ background: '#111111', border: `1px solid ${orderDockAccent}66`, boxShadow: `0 10px 24px ${orderDockAccent}22` }}
            >
              <button
                onClick={() => handleOptionClick('cart')}
                className="flex items-center gap-2 text-left min-w-0"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black ${orderDockState === 'confirmed' ? 'dock-confirm-pop' : ''}`} style={{ background: orderDockAccent }}>
                  {orderDockState === 'confirmed' ? '✓' : (waitingForConfirmation ? totalCartItems : pendingCartItems)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] leading-tight flex items-center gap-1.5" style={{ color: `${orderDockAccent}dd` }}>
                    <span className={`order-dock-dot ${orderDockState === 'pending' ? 'is-pending' : ''}`} style={{ background: orderDockAccent }} />
                    {orderDockTitle}
                  </p>
                  {orderDockState === 'confirmed' ? (
                    <>
                      <p className="text-[14px] font-semibold truncate dock-confirm-text" style={{ color: orderDockAccent }}>
                        Your order is on the way
                      </p>
                    </>
                  ) : waitingForConfirmation ? (
                    <>
                      <p className="text-[14px] font-semibold truncate" style={{ color: orderDockAccent }}>
                        Awaiting confirmation{estimatedWait ? ` • ~${estimatedWait} min` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] font-semibold truncate" style={{ color: orderDockAccent }}>
                        {pendingCartItems} item{pendingCartItems > 1 ? 's' : ''} • ${pendingSubtotal.toFixed(2)}
                      </p>
                    </>
                  )}
                </div>
              </button>
              <button
                onClick={() => (orderDockState === 'unsent' ? handleCheckout() : handleOptionClick('cart'))}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-black text-[13px] font-bold active:scale-95 transition-transform disabled:opacity-50"
                style={{ background: orderDockAccent }}
              >
                {loading ? 'Placing...' : orderDockCta}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 sticky bottom-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-3 sm:px-4 py-2.5 sm:py-3 safe-bottom">
        {voiceStatusMessage && (
          <div className="max-w-lg mx-auto mb-2 rounded-xl px-3 py-2 text-[12px] border border-zinc-700 bg-zinc-900/90 text-gray-200">
            {voiceStatusMessage}
          </div>
        )}
        {isListening && interimVoiceTranscript && (
          <div className="max-w-lg mx-auto mb-2 rounded-xl px-3 py-2 text-[12px] border border-sky-500/40 bg-sky-500/10 text-sky-100">
            {interimVoiceTranscript}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2.5 sm:gap-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={!voiceSupported}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border transition-all ${isListening ? 'scale-105' : ''} disabled:opacity-40`}
            style={isListening
              ? { background: `${theme.primary}22`, borderColor: theme.primary, color: theme.primary }
              : { background: '#18181b', borderColor: '#3f3f46', color: '#a1a1aa' }}
            title={voiceSupported ? (isListening ? 'Stop voice input' : 'Start voice input') : 'Voice input not supported'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask SIA anything..."
            className="flex-1 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-zinc-900 border border-zinc-700 rounded-2xl focus:outline-none text-[15px] sm:text-[16px] placeholder-gray-500"
            style={{ '--tw-ring-color': theme.primary } as React.CSSProperties}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
          />
          <button 
            type="submit" 
            disabled={!userInput.trim()}
            className="w-11 h-11 sm:w-12 sm:h-12 text-black rounded-2xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
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
        .msg-bubble-bot {
          backdrop-filter: blur(6px);
        }
        .msg-bubble-user {
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
        }
        .message-copy {
          line-height: 1.56;
          letter-spacing: 0.012em;
          text-wrap: pretty;
        }
        .chat-time-row {
          color: #a1a1aa;
        }
        .chat-time-pill {
          border: 1px solid rgba(161, 161, 170, 0.24);
          border-radius: 999px;
          padding: 1px 7px;
          background: rgba(24, 24, 27, 0.72);
          letter-spacing: 0.04em;
          font-weight: 500;
        }
        .chat-read-pill {
          color: #7dd3fc;
          letter-spacing: -0.09em;
          font-size: 11px;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.35));
        }
        .quick-chip-pop {
          position: relative;
          overflow: hidden;
          transform: translateY(6px) scale(0.98);
          opacity: 0;
          animation: chipIn 0.36s ease-out forwards;
          transition: transform 0.16s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .quick-chip-pop::after {
          content: '';
          position: absolute;
          top: 0;
          left: -140%;
          width: 52%;
          height: 100%;
          background: linear-gradient(110deg, transparent, rgba(255, 255, 255, 0.12), transparent);
          animation: chipSheen 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        .quick-chip-pop:active {
          transform: scale(0.96);
        }
        .empty-cart-state {
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
        }
        .miami-wave {
          animation: miamiWave 2.2s ease-in-out infinite;
          box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.15), 0 10px 24px rgba(6, 182, 212, 0.12);
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
        .order-dock-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          opacity: 0.9;
        }
        .order-dock-dot.is-pending {
          animation: dockPulse 1.1s ease-in-out infinite;
        }
        .dock-confirm-pop {
          animation: confirmPop 0.35s ease-out;
        }
        .dock-confirm-text {
          animation: confirmGlow 0.8s ease-out;
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 1.4s ease-in-out infinite;
        }
        @keyframes cartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes chipIn {
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes chipSheen {
          0%, 65% { left: -140%; }
          85% { left: 130%; }
          100% { left: 130%; }
        }
        @keyframes miamiWave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes typingBlink {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-2px); opacity: 1; }
        }
        @keyframes dockPulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes confirmPop {
          0% { transform: scale(0.75); }
          65% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes confirmGlow {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.22); }
          100% { filter: brightness(1); }
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

export default function OrderPage(props: OrderPageProps = {}) {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#f59e0b' }}></div>
      </div>
    }>
      <OrderContent {...props} />
    </Suspense>
  );
}

