'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import jsPDF from 'jspdf';
import { 
  Send, ShoppingCart, Plus, Minus, Star, X, Phone, 
  MessageCircle, CreditCard, Banknote, Download, Check
} from 'lucide-react';

// WhatsApp Admin Number (Tampa, FL USA)
const ADMIN_WHATSAPP = '+16562145190';
const RESTAURANT_NAME = 'netrikxr.shop';
const RESTAURANT_ADDRESS = 'Tampa, FL 33601, USA';
const RESTAURANT_PHONE = '+1 (656) 214-5190';

interface CartItem extends MenuItem {
  quantity: number;
}

interface Message {
  id: number;
  type: 'bot' | 'user' | 'menu' | 'cart' | 'confirmation' | 'payment' | 'feedback';
  text?: string;
  items?: MenuItem[];
  cartItems?: CartItem[];
  orderId?: string;
  total?: number;
}

// Star Rating Component
function StarRating({ rating, onRate, interactive = true }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!interactive || !containerRef.current) return;
    setIsDragging(true);
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const starWidth = rect.width / 5;
    const newRating = Math.max(1, Math.min(5, Math.ceil(x / starWidth)));
    setHoverRating(newRating);
  };

  const handleTouchEnd = () => {
    if (isDragging && hoverRating > 0 && onRate) {
      onRate(hoverRating);
    }
    setIsDragging(false);
    setHoverRating(0);
  };

  return (
    <div 
      ref={containerRef}
      className="flex gap-2 justify-center touch-none select-none"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          whileTap={interactive ? { scale: 0.9 } : {}}
          onClick={() => interactive && onRate && onRate(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && !isDragging && setHoverRating(0)}
          className={`transition-all ${interactive ? 'cursor-pointer active:scale-90' : 'cursor-default'}`}
          disabled={!interactive}
        >
          <Star 
            className={`w-10 h-10 sm:w-12 sm:h-12 transition-all ${
              (hoverRating || rating) >= star 
                ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                : 'text-gray-600'
            }`}
          />
        </motion.button>
      ))}
    </div>
  );
}

// USA Phone Input Component
function USPhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const formatPhone = (input: string) => {
    const numbers = input.replace(/\D/g, '').slice(0, 10);
    if (numbers.length === 0) return '';
    if (numbers.length <= 3) return `(${numbers}`;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-3 bg-zinc-800 rounded-xl border border-amber-700/30 text-gray-400">
        <span className="text-lg">🇺🇸</span>
        <span>+1</span>
      </div>
      <input
        type="tel"
        value={formatPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="(555) 123-4567"
        className="flex-1 px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white placeholder-gray-500"
      />
    </div>
  );
}

function OrderContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{ items: CartItem[]; total: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  const nextMsgId = () => ++messageIdRef.current;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch menu items
  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category', { ascending: true });
      
      if (!error && data) {
        setMenuItems(data as MenuItem[]);
      }
      setLoading(false);
      
      // Welcome message - engaging
      setMessages([
        {
          id: nextMsgId(),
          type: 'bot',
          text: `Hey there! 👋 Welcome to Table ${tableNumber}!\n\nI'm your personal AI assistant today. Ready to make your dining experience amazing!\n\n🍽️ Browse our delicious menu below\n🛒 Tap items to add to cart\n💬 Ask me anything - recommendations, dietary needs, you name it!\n\nWhat catches your eye today? 😋`
        }
      ]);
    };
    
    fetchMenu();
  }, [tableNumber]);

  // Categories
  const categories = ['all', ...new Set(menuItems.map(item => item.category))];

  const filteredItems = activeCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    
    // Engaging response
    const responses = [
      `Excellent choice! 🎉 ${item.name} added to your cart!`,
      `Ooh, ${item.name}! Great pick! 👌`,
      `${item.name} - you've got good taste! ✨`,
      `Added ${item.name}! Your order is looking amazing! 🌟`,
    ];
    
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'user',
      text: `Add ${item.name}`
    }, {
      id: nextMsgId(),
      type: 'bot',
      text: responses[Math.floor(Math.random() * responses.length)]
    }]);
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(i => i.id !== itemId);
      }
      return prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const generateReceiptId = () => {
    const prefix = 'NX';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  };

  // Generate PDF Bill
  const generatePDFBill = () => {
    if (!orderDetails || !currentOrderId) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(212, 175, 55); // Gold
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(RESTAURANT_NAME, pageWidth / 2, 20, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(RESTAURANT_ADDRESS, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Tel: ${RESTAURANT_PHONE}`, pageWidth / 2, 34, { align: 'center' });
    
    // Receipt Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    let y = 55;
    
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Order ID: ${currentOrderId}`, 20, y);
    y += 6;
    doc.text(`Table: ${tableNumber}`, 20, y);
    y += 6;
    doc.text(`Date: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`, 20, y);
    if (customerPhone) {
      y += 6;
      doc.text(`Phone: +1 ${customerPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}`, 20, y);
    }
    y += 12;
    
    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    
    // Items Header
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, y);
    doc.text('Qty', 120, y);
    doc.text('Price', pageWidth - 20, y, { align: 'right' });
    y += 8;
    
    // Items
    doc.setFont('helvetica', 'normal');
    orderDetails.items.forEach(item => {
      doc.text(item.name, 20, y);
      doc.text(item.quantity.toString(), 125, y);
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
    });
    
    // Separator
    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    
    // Totals
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Subtotal:', 100, y);
    doc.text(`$${orderDetails.total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    y += 7;
    
    const tax = orderDetails.total * 0.075; // 7.5% FL tax
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Tax (7.5%):', 100, y);
    doc.text(`$${tax.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    y += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL:', 100, y);
    doc.text(`$${(orderDetails.total + tax).toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    y += 20;
    
    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('Please visit again soon!', pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    // WhatsApp Info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact us on WhatsApp: ${ADMIN_WHATSAPP}`, pageWidth / 2, y, { align: 'center' });
    
    // Save
    doc.save(`Receipt_${currentOrderId}.pdf`);
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: 'Oops! Your cart is empty! 🛒 Browse our menu and add some delicious items first!'
      }]);
      return;
    }

    const receiptId = generateReceiptId();
    const orderData = {
      receipt_id: receiptId,
      table_number: parseInt(tableNumber),
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      subtotal: cartTotal,
      tip_amount: 0,
      total: cartTotal,
      status: 'pending',
      payment_status: 'unpaid',
      customer_note: inputText || null,
      customer_phone: customerPhone ? `+1${customerPhone}` : null
    };

    const { error } = await supabase.from('orders').insert(orderData);

    if (error) {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `Oh no! Something went wrong: ${error.message}. Let's try again! 🔄`
      }]);
      return;
    }

    setCurrentOrderId(receiptId);
    setOrderPlaced(true);
    setOrderDetails({ items: [...cart], total: cartTotal });
    
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'confirmation',
      orderId: receiptId,
      total: cartTotal,
      cartItems: [...cart]
    }]);
    
    setCart([]);
    setInputText('');
    setShowCart(false);
  };

  const handlePayment = async (method: 'online' | 'cash') => {
    if (!currentOrderId) return;

    if (method === 'online') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'online',
          payment_type: 'chatbot_payment',
          updated_at: new Date().toISOString()
        })
        .eq('receipt_id', currentOrderId);
      
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `Payment successful! 🎉💳\n\nYour order ${currentOrderId} is confirmed and paid!\n\nThe kitchen is now preparing your delicious food. Can't wait for you to taste it! 🍽️✨`
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `Perfect! 💵 You'll pay $${orderDetails?.total.toFixed(2)} in cash.\n\nYour order ${currentOrderId} is being prepared as we speak!\n\nSit back and relax - your food will be served soon! 🍽️`
      }]);
    }

    // Show phone input for bill delivery
    setTimeout(() => {
      setShowPhoneInput(true);
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `📱 Would you like to receive your bill via WhatsApp? Enter your US phone number below (optional):`
      }]);
    }, 1500);
  };

  const handlePhoneSubmit = () => {
    setShowPhoneInput(false);
    
    if (customerPhone) {
      // Format phone for WhatsApp
      const formattedPhone = `1${customerPhone}`;
      const billText = encodeURIComponent(
        `🧾 *${RESTAURANT_NAME} Receipt*\n\n` +
        `📍 ${RESTAURANT_ADDRESS}\n` +
        `📞 ${RESTAURANT_PHONE}\n\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `Order: ${currentOrderId}\n` +
        `Table: ${tableNumber}\n` +
        `Date: ${new Date().toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━\n\n` +
        `*Items:*\n` +
        orderDetails?.items.map(item => `• ${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}`).join('\n') +
        `\n\n━━━━━━━━━━━━━━━━━\n` +
        `*Subtotal:* $${orderDetails?.total.toFixed(2)}\n` +
        `*Tax (7.5%):* $${(orderDetails!.total * 0.075).toFixed(2)}\n` +
        `*TOTAL:* $${(orderDetails!.total * 1.075).toFixed(2)}\n` +
        `━━━━━━━━━━━━━━━━━\n\n` +
        `Thank you for dining with us! 🙏`
      );
      
      window.open(`https://wa.me/${formattedPhone}?text=${billText}`, '_blank');
    }
    
    // Show feedback after a delay
    setTimeout(() => {
      setShowFeedback(true);
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'feedback'
      }]);
    }, 2000);
  };

  const submitFeedback = async (rating: number) => {
    setFeedbackRating(rating);
    setFeedbackSubmitted(true);

    // Save feedback to database (optional - create feedback table if needed)
    try {
      await supabase.from('orders').update({
        customer_rating: rating,
        updated_at: new Date().toISOString()
      }).eq('receipt_id', currentOrderId);
    } catch {
      // Silently fail if column doesn't exist
    }

    const feedbackMessages: Record<number, string> = {
      1: "We're sorry to hear that. We'll do better! 😔",
      2: "Thanks for your feedback. We'll improve! 🙏",
      3: "Thanks! We appreciate your visit! 👍",
      4: "Wonderful! So glad you enjoyed it! 😊",
      5: "WOW! You made our day! Thank you! 🌟🎉"
    };

    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'bot',
      text: `${feedbackMessages[rating]}\n\nThank you for dining at ${RESTAURANT_NAME}!\n\nThis chat will close soon. Have a wonderful day! 👋✨`
    }]);

    // Close chat after 5 seconds
    setTimeout(() => {
      setChatClosed(true);
    }, 5000);
  };

  const shareToWhatsApp = () => {
    if (!currentOrderId || !orderDetails) return;
    
    const orderSummary = orderDetails.items.map(item => 
      `• ${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');
    
    const message = encodeURIComponent(
      `🍽️ *Order from ${RESTAURANT_NAME}*\n\n` +
      `Order ID: ${currentOrderId}\n` +
      `Table: ${tableNumber}\n\n` +
      `*Items:*\n${orderSummary}\n\n` +
      `*Total:* $${orderDetails.total.toFixed(2)}\n\n` +
      `Contact: ${ADMIN_WHATSAPP}`
    );
    
    window.open(`https://wa.me/${ADMIN_WHATSAPP.replace(/\+/g, '')}?text=${message}`, '_blank');
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'user',
      text: inputText
    }]);
    
    // Smart bot responses - engaging
    setTimeout(() => {
      const lowerText = inputText.toLowerCase();
      let response = "I'm here to help! 💫 Use the menu below to add items, or ask me about recommendations!";
      
      if (lowerText.includes('recommend') || lowerText.includes('suggest') || lowerText.includes('best')) {
        response = "Great question! 🌟 Our customers absolutely LOVE our signature items! Check out the menu below - anything from the top categories is a crowd favorite! What type of food are you in the mood for?";
      } else if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('cheap')) {
        response = "You can see all prices right in the menu below! 💰 We've got options for every budget. What's catching your eye?";
      } else if (lowerText.includes('spicy') || lowerText.includes('hot')) {
        response = "Love the heat? 🌶️ Check out our menu - I can tell you which items pack some spice! Just ask about specific items!";
      } else if (lowerText.includes('vegetarian') || lowerText.includes('vegan') || lowerText.includes('veggie')) {
        response = "Absolutely! 🥗 We have some fantastic vegetarian options! Browse the menu and feel free to ask about any item's ingredients!";
      } else if (lowerText.includes('water') || lowerText.includes('drink') || lowerText.includes('beverage')) {
        response = "Thirsty? 🥤 Check out our Drinks section in the menu! We've got refreshing options from soft drinks to specialty beverages!";
      } else if (lowerText.includes('bill') || lowerText.includes('pay') || lowerText.includes('check')) {
        if (orderPlaced) {
          response = "Ready to settle up? 💳 Use the payment buttons above to pay online or let us know you'll pay cash!";
        } else {
          response = "Add items to your cart first, then hit 'Place Order'! After that, you can choose how to pay! 🛒";
        }
      } else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
        response = "Hey there! 👋 Welcome! I'm your AI assistant today. Ready to help you have an amazing meal! What sounds good?";
      } else if (lowerText.includes('thank')) {
        response = "You're so welcome! 🙏✨ It's my pleasure to help! Let me know if you need anything else!";
      } else if (lowerText.includes('allerg') || lowerText.includes('gluten') || lowerText.includes('nut')) {
        response = "Important question! 🏥 Please inform our staff about any allergies when your order arrives. We take food safety seriously!";
      }
      
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: response
      }]);
    }, 500);
    
    setInputText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading menu...</p>
        </div>
      </div>
    );
  }

  // Chat closed screen
  if (chatClosed) {
    return (
      <div className="min-h-screen min-h-dvh bg-black flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/30">
            <Check className="w-12 h-12 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-amber-100 mb-4">Thank You!</h1>
          <p className="text-gray-400 mb-2">Your visit means the world to us</p>
          <div className="flex justify-center gap-1 my-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={`w-8 h-8 ${feedbackRating >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-600'}`}
              />
            ))}
          </div>
          <p className="text-gray-500 text-sm mb-6">You rated us {feedbackRating} star{feedbackRating > 1 ? 's' : ''}</p>
          <a 
            href={`https://wa.me/${ADMIN_WHATSAPP.replace(/\+/g, '')}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-white font-medium transition-colors"
          >
            <Phone className="w-5 h-5" />
            Contact Us on WhatsApp
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-black flex flex-col relative">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-amber-950/10 via-black to-amber-900/10 pointer-events-none"></div>

      {/* Header */}
      <header className="bg-black/80 backdrop-blur-xl border-b border-amber-700/20 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-lg font-bold text-black">N</span>
            </div>
            <div>
              <h1 className="font-bold text-amber-100">{RESTAURANT_NAME}</h1>
              <p className="text-xs text-gray-400">Table {tableNumber} • Tampa, FL</p>
            </div>
          </div>
          
          {/* Cart Button */}
          {cart.length > 0 && !orderPlaced && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setShowCart(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 rounded-full text-black font-semibold shadow-lg"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              <span className="font-bold">${cartTotal.toFixed(2)}</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {msg.type === 'bot' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-black font-bold shrink-0 shadow-lg">N</div>
                  <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 border border-amber-700/20 rounded-2xl rounded-tl-sm p-4 max-w-[280px] sm:max-w-sm shadow-xl">
                    <p className="text-sm whitespace-pre-line text-gray-100 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              )}
              
              {msg.type === 'user' && (
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-500/30 rounded-2xl rounded-tr-sm p-4 max-w-[280px] sm:max-w-sm">
                    <p className="text-sm text-amber-100">{msg.text}</p>
                  </div>
                </div>
              )}
              
              {msg.type === 'confirmation' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0 shadow-lg">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gradient-to-br from-green-900/40 to-green-950/40 border border-green-600/30 rounded-2xl rounded-tl-sm p-4 max-w-sm shadow-xl">
                    <p className="text-green-400 font-semibold mb-2 text-lg">Order Placed! 🎉</p>
                    <p className="text-sm text-gray-300">Order ID: <span className="font-mono font-bold text-amber-100">{msg.orderId}</span></p>
                    <p className="text-sm text-gray-300">Table: {tableNumber}</p>
                    <div className="mt-3 pt-3 border-t border-green-600/20">
                      {msg.cartItems?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-300 py-1">
                          <span>{item.quantity}× {item.name}</span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-base font-bold text-white mt-2 pt-2 border-t border-green-600/20">
                        <span>Total</span>
                        <span className="text-green-400">${msg.total?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-gray-400 mb-2">Choose payment method:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handlePayment('online')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium transition-colors shadow-lg"
                        >
                          <CreditCard className="w-4 h-4" /> Pay Online
                        </button>
                        <button 
                          onClick={() => handlePayment('cash')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium transition-colors shadow-lg"
                        >
                          <Banknote className="w-4 h-4" /> Pay Cash
                        </button>
                      </div>
                      <button 
                        onClick={shareToWhatsApp}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-medium transition-colors shadow-lg"
                      >
                        <MessageCircle className="w-4 h-4" /> Share to WhatsApp
                      </button>
                      {orderDetails && (
                        <button 
                          onClick={generatePDFBill}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium transition-colors shadow-lg"
                        >
                          <Download className="w-4 h-4" /> Download Bill (PDF)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {msg.type === 'feedback' && !feedbackSubmitted && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-black font-bold shrink-0 shadow-lg">N</div>
                  <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 border border-amber-700/30 rounded-2xl rounded-tl-sm p-6 shadow-xl">
                    <p className="text-amber-100 font-semibold text-center mb-4">How was your experience today?</p>
                    <p className="text-gray-400 text-sm text-center mb-4">Tap or drag to rate us ⭐</p>
                    <StarRating rating={feedbackRating} onRate={submitFeedback} />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}

          {/* Phone Input */}
          {showPhoneInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-black font-bold shrink-0 shadow-lg">N</div>
              <div className="bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 border border-amber-700/30 rounded-2xl rounded-tl-sm p-4 shadow-xl flex-1 max-w-sm">
                <p className="text-gray-300 text-sm mb-3">Your US phone number (optional):</p>
                <USPhoneInput value={customerPhone} onChange={setCustomerPhone} />
                <button
                  onClick={handlePhoneSubmit}
                  className="w-full mt-3 py-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl font-semibold text-black transition-colors"
                >
                  {customerPhone ? 'Send Bill via WhatsApp' : 'Skip'}
                </button>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Menu Section - Fixed at bottom when not ordered */}
      {!orderPlaced && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-amber-700/30 z-30">
          {/* Category Tabs */}
          <div className="px-4 py-3 border-b border-amber-700/20 overflow-x-auto">
            <div className="flex gap-2 max-w-2xl mx-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat 
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg' 
                      : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                >
                  {cat === 'all' ? '✨ All Items' : cat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="max-h-[35vh] overflow-y-auto px-4 py-4">
            <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map(item => {
                const cartItem = cart.find(i => i.id === item.id);
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCart(item)}
                    className="bg-gradient-to-br from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 rounded-xl p-3 text-left transition-colors relative border border-amber-700/20 hover:border-amber-500/40"
                  >
                    {cartItem && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xs font-bold text-black">{cartItem.quantity}</span>
                      </div>
                    )}
                    <p className="font-medium text-amber-100 text-sm leading-tight">{item.name}</p>
                    <p className="text-amber-400 font-bold mt-1">${item.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cart Overlay */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-gradient-to-br from-zinc-900 to-black border-t border-amber-700/30 rounded-t-3xl max-h-[80vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-amber-700/20 flex justify-between items-center sticky top-0 bg-zinc-900/95 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-amber-100">Your Cart</h2>
                <button onClick={() => setShowCart(false)} className="p-2 text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-700">
                    <div className="flex-1">
                      <p className="font-medium text-amber-100">{item.name}</p>
                      <p className="text-sm text-amber-400">${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-white hover:bg-zinc-600 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-white font-medium w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-black hover:bg-amber-500 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-amber-700/20 sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold text-green-400">${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={placeOrder}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl font-bold text-black text-lg hover:from-amber-400 hover:to-amber-500 transition-colors shadow-lg"
                >
                  Place Order - ${cartTotal.toFixed(2)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Input - Only show when order is not placed or is being completed */}
      {(!orderPlaced || (orderPlaced && !showFeedback && !showPhoneInput)) && (
        <div className={`fixed ${orderPlaced ? 'bottom-0' : 'bottom-[45vh]'} left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-amber-700/30 px-4 py-3 z-20`}>
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={orderPlaced ? "Need help with anything?" : "Ask me anything..."}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white placeholder-gray-500"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl text-black font-medium transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
