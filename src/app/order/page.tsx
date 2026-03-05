'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import { processChatMessage } from '@/lib/chatbot';
import jsPDF from 'jspdf';
import { 
  Send, ShoppingCart, Plus, Minus, Trash2, Star,
  FileText, Check, MessageCircle, Download
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
  options?: { label: string; value: string }[];
  showMenu?: boolean;
  showCart?: boolean;
  showTip?: boolean;
  showRating?: boolean;
  showBill?: boolean;
}

function OrderContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';
  
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
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
              `✅ Your order has been confirmed!\n\nReceipt: ${receiptId}\nTable: ${tableNumber}\nSubtotal: $${subtotal.toFixed(2)}\n\n🍹 Your drinks are being prepared!\n💵 Pay cash to the manager when ready.`,
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
  }, [currentOrderId, waitingForConfirmation, receiptId, tableNumber, subtotal]);

  // Welcome message
  useEffect(() => {
    if (menuItems.length > 0 && chatMessages.length === 0) {
      addBotMessage(
        `Hey there! 👋 Welcome to netrikxr.shop!\n\nI'm SIA, your bartender at Table ${tableNumber}.\n\nWhat can I get you tonight?`,
        [
          { label: '🍹 See Menu', value: 'menu' },
          { label: '🎉 Party Package', value: 'party' },
          { label: '💬 Recommend', value: 'recommend' },
          { label: '❓ Help', value: 'help' }
        ]
      );
    }
  }, [menuItems, tableNumber, chatMessages.length]);

  // Auto scroll
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [chatMessages]);

  const addBotMessage = (content: string, options?: { label: string; value: string }[], extra?: Partial<ChatMessage>) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'bot',
      content,
      options,
      ...extra
    };
    setChatMessages(prev => [...prev, msg]);
  };

  const addUserMessage = (content: string) => {
    setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content }]);
  };

  const handleOptionClick = (value: string) => {
    switch (value) {
      case 'menu':
        addUserMessage('Show me the menu');
        addBotMessage('Here\'s what we\'ve got tonight! 🍹 Tap any category or just tell me what you\'re feeling.', undefined, { showMenu: true });
        break;
      case 'cart':
        addUserMessage('Show my cart');
        if (cart.length === 0) {
          addBotMessage('Your cart is empty! 😄 What can I get you?', [
            { label: '🍹 See Menu', value: 'menu' },
            { label: '💬 Recommend', value: 'recommend' }
          ]);
        } else {
          addBotMessage(`You have ${cart.length} item${cart.length > 1 ? 's' : ''} in your cart:`, undefined, { showCart: true });
        }
        break;
      case 'help':
        addUserMessage('Help');
        addBotMessage(
          `No worries, I got you! Here's how it works:\n\n1️⃣ Browse menu or tell me what you want\n2️⃣ Add items to cart\n3️⃣ Place your order\n4️⃣ Wait for confirmation\n5️⃣ Add tip & get your bill\n\nEasy! What would you like?`,
          [
            { label: '🍹 Show Menu', value: 'menu' },
            { label: '💬 Talk to SIA', value: 'recommend' }
          ]
        );
        break;
      case 'party':
        addUserMessage('Party package');
        addBotMessage(
          `🎉 Party time! Nice!\n\nHow many people are celebrating?\nWhat's the vibe - classy, wild, or chill?`,
          [
            { label: '🎂 Birthday', value: 'birthday' },
            { label: '👔 Work Celebration', value: 'celebration' },
            { label: '😎 Just Vibing', value: 'casual' }
          ]
        );
        break;
      case 'recommend':
        addUserMessage('What do you recommend?');
        addBotMessage(
          `Great question! 🤔 Here's what's popular tonight:\n\n🔥 Our cocktails are flying\n🍺 Craft beers are fresh\n🥃 Premium whiskey for the refined taste\n\nWhat's your mood?`,
          [
            { label: '🧊 Refreshing', value: 'cold' },
            { label: '🥃 Strong', value: 'strong' },
            { label: '🍹 Full Menu', value: 'menu' }
          ]
        );
        break;
      case 'birthday':
        addUserMessage('Birthday party');
        addBotMessage(
          `🎂 Happy Birthday vibes! Let's make it special!\n\nHow about:\n• Shots to kick it off\n• Signature cocktails\n• A premium bottle\n\nHow many people?`,
          [{ label: '🍹 See Menu', value: 'menu' }]
        );
        break;
      case 'celebration':
        addUserMessage('Work celebration');
        addBotMessage(
          `👔 Congrats on whatever you're celebrating!\n\nFor office celebrations:\n• Whiskey for the distinguished\n• Wine for the refined\n• Cocktails for the adventurous`,
          [{ label: '🍹 See Menu', value: 'menu' }]
        );
        break;
      case 'casual':
        addUserMessage('Just hanging out');
        addBotMessage(
          `😎 Nothing wrong with that! Best nights are unplanned.\n\nBeer, cocktails, or something stronger?`,
          [
            { label: '🍺 Beers', value: 'menu' },
            { label: '🍸 Cocktails', value: 'menu' },
            { label: '🥃 Spirits', value: 'menu' }
          ]
        );
        break;
      case 'cold':
        addUserMessage('Something refreshing');
        addBotMessage(
          `🧊 Ice cold coming up! Perfect choice.\n\nRefreshing beers, frozen cocktails, chilled spirits...`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'strong':
        addUserMessage('Something strong');
        addBotMessage(
          `🥃 I like your style! Going for the good stuff.\n\nWhiskey, rum, vodka, or a strong cocktail?`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'checkout':
        handleCheckout();
        break;
      case 'more':
        addUserMessage('Order more');
        addBotMessage('Let\'s add more! 🍹 What else sounds good?', undefined, { showMenu: true });
        break;
      case 'pay':
        addUserMessage('Pay now');
        addBotMessage('Almost done! 💰 Would you like to add a tip?', undefined, { showTip: true });
        break;
      case 'skip_tip':
        setSelectedTip(0);
        addUserMessage('No tip');
        addBotMessage('No problem! Ready for your bill?', [{ label: '📄 Get Bill', value: 'bill' }]);
        break;
      case 'confirm_tip':
        addUserMessage(`Tip: ${selectedTip}%`);
        addBotMessage(`Thanks! 🙏 ${selectedTip}% tip added. Ready for your bill?`, [{ label: '📄 Get Bill', value: 'bill' }]);
        break;
      case 'bill':
        addUserMessage('Get bill');
        addBotMessage('Here\'s your bill! 🧾 Pay cash to the manager when ready. Thanks for hanging with us!', undefined, { showBill: true });
        break;
      case 'done':
        addUserMessage('Done');
        addBotMessage('One last thing! How was everything? ⭐', undefined, { showRating: true });
        break;
      default:
        break;
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
    
    const receipt = `ORD-${tableNumber}-${Date.now().toString().slice(-6)}`;
    setReceiptId(receipt);

    const orderData = {
      table_number: parseInt(tableNumber),
      items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      subtotal: subtotal,
      tip_amount: 0,
      tax_amount: calculation.taxAmount,
      total: calculation.total,
      status: 'pending',
      payment_status: 'unpaid',
      receipt_id: receipt
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
    }

    setOrderPlaced(true);
    setWaitingForConfirmation(true);
    
    addBotMessage(
      `📤 Order Sent!\n\nReceipt: ${receipt}\nTable: ${tableNumber}\nSubtotal: $${subtotal.toFixed(2)}\n\n⏳ Waiting for staff confirmation...`,
      []
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.trim();
    const inputLower = input.toLowerCase();
    addUserMessage(input);
    setUserInput('');

    // Use custom chatbot engine
    const response = processChatMessage(
      input, 
      menuItems, 
      cart.map(c => ({ id: c.id, name: c.name, quantity: c.quantity }))
    );

    // Handle actions based on chatbot response
    if (response.action === 'checkout') {
      handleCheckout();
      return;
    }

    if (response.action === 'show_cart') {
      if (cart.length === 0) {
        addBotMessage(response.message, [
          { label: '🍹 See Menu', value: 'menu' },
          { label: '💬 Recommend', value: 'recommend' }
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

    // Handle item ordering - new format with matchedItems array
    if (response.action === 'add_item' && response.matchedItems && response.matchedItems.length > 0) {
      // Add all matched items to cart
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
          { label: '🍹 More Drinks', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' },
          { label: '✅ Checkout', value: 'checkout' }
        ]
      );
      return;
    }
    
    // Handle clear cart action
    if (response.action === 'clear_cart') {
      setCart([]);
      addBotMessage(response.message, [
        { label: '🍹 See Menu', value: 'menu' },
        { label: '💬 Recommend', value: 'recommend' }
      ]);
      return;
    }

    // Handle suggested items
    if (response.suggestedItems && response.suggestedItems.length > 0) {
      addBotMessage(response.message, undefined, { showMenu: true });
      return;
    }

    // Handle menu/category display
    if (response.action === 'show_menu' || response.action === 'show_category') {
      addBotMessage(response.message, undefined, { showMenu: true });
      return;
    }

    // Handle special keyword-based responses for better conversations
    if (inputLower.includes('cart') || inputLower.includes('my order')) {
      handleOptionClick('cart');
      return;
    }

    if (inputLower.includes('checkout') || inputLower.includes('place order') || inputLower.includes('done ordering')) {
      handleCheckout();
      return;
    }

    if (inputLower.includes('pay') || inputLower.includes('bill')) {
      handleOptionClick('pay');
      return;
    }

    if (inputLower.includes('menu') || inputLower.includes('what do you have')) {
      handleOptionClick('menu');
      return;
    }

    if (inputLower.includes('cancel') || inputLower.includes('clear')) {
      setCart([]);
      addBotMessage('Cart cleared! 👍 Start fresh?', [
        { label: '🍹 See Menu', value: 'menu' },
        { label: '💬 Recommend', value: 'recommend' }
      ]);
      return;
    }

    if (inputLower.includes('thank')) {
      addBotMessage('You\'re welcome! 😊 Need anything else?', [
        { label: '🍹 More Drinks', value: 'menu' },
        { label: '🛒 View Cart', value: 'cart' }
      ]);
      return;
    }

    // Default response with options
    addBotMessage(
      response.message || "I'm here to help! What can I get you?",
      [
        { label: '🍹 See Menu', value: 'menu' },
        { label: '🛒 View Cart', value: 'cart' },
        { label: '💬 Recommend', value: 'recommend' }
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
    // Show quick confirmation
    addBotMessage(`Nice choice! 👍 Added ${item.name} to your cart.`, [
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
            className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-8"
          >
            <Check className="w-12 h-12 text-black" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-4">Thank You!</h1>
          <p className="text-gray-400 text-lg mb-4">You rated us {rating} star{rating > 1 ? 's' : ''}</p>
          <div className="flex justify-center gap-2 mb-8">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-8 h-8 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
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
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Status bar spacer for standalone PWA mode (notch/dynamic island) */}
      <div className="status-bar-spacer" />

      {/* ========================================== */}
      {/* FIXED HEADER - Native App Style */}
      {/* ========================================== */}
      <header className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-b border-amber-500/20 px-4 py-3 z-50">
        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-1.5 mb-2 text-center">
            <p className="text-red-400 text-[12px] font-medium">📡 No internet connection</p>
          </div>
        )}
        {/* Waiting for confirmation indicator */}
        {waitingForConfirmation && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 mb-2 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-amber-400 text-[12px] font-medium">Waiting for staff confirmation...</p>
          </div>
        )}
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <img src="/icons/icon-96x96.png" alt="N" className="w-7 h-7 rounded-md" />
            </div>
            <div>
              <p className="font-semibold text-amber-400 text-[15px] leading-tight">Netrik XR</p>
              <p className="text-[11px] text-gray-500 leading-tight">Table {tableNumber} • SIA Bartender</p>
            </div>
          </div>
          <button 
            onClick={() => handleOptionClick('cart')}
            className={`relative p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl active:scale-95 transition-transform ${cart.length > 0 ? 'cart-pulse' : ''}`}
          >
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold animate-bounce-subtle">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* SCROLLABLE CHAT AREA - Only this scrolls */}
      {/* ========================================== */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-4">
          <AnimatePresence mode="popLayout">
            {chatMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
                  {/* Bot Avatar */}
                  {msg.role === 'bot' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-3 h-3 text-black" />
                      </div>
                      <span className="text-[11px] text-amber-400/80 font-medium">SIA</span>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user' 
                      ? 'bg-amber-500 text-black rounded-br-sm ml-auto' 
                      : 'bg-zinc-900 border border-zinc-800 rounded-bl-sm'
                  }`}>
                    <p className={`leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-[14px] font-medium' : 'text-[15px]'}`}>{msg.content}</p>
                  </div>

                  {/* Quick Options */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionClick(opt.value)}
                          className="px-3.5 py-2 bg-zinc-900 border border-amber-500/30 rounded-xl text-amber-400 text-[13px] font-medium active:scale-95 transition-transform"
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
                          className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${!selectedCategory ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-gray-400'}`}
                        >
                          All
                        </button>
                        {categories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-gray-400'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      
                      {/* Menu Items */}
                      <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl">
                        {menuItems
                          .filter(i => !selectedCategory || i.category === selectedCategory)
                          .map(item => {
                            const inCart = cart.find(c => c.id === item.id);
                            return (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="font-medium text-[14px] truncate">{item.name}</p>
                                  <p className="text-[13px] text-amber-400 font-semibold">${item.price.toFixed(2)}</p>
                                </div>
                                {inCart ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center active:scale-95">
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-6 text-center font-bold text-[14px]">{inCart.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-amber-500 text-black rounded-lg flex items-center justify-center active:scale-95">
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => addToCart(item)} className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[13px] font-medium active:scale-95 flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" />
                                    Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      
                      {cart.length > 0 && (
                        <button onClick={() => handleOptionClick('cart')} className="w-full py-3 bg-amber-500 text-black rounded-xl font-bold text-[14px] active:scale-[0.98] transition-transform">
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
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-amber-500 text-black rounded-lg flex items-center justify-center active:scale-95">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center active:scale-95 ml-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span className="text-amber-400">${subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleOptionClick('menu')} className="flex-1 py-3 border border-amber-500/30 text-amber-400 rounded-xl font-medium text-[14px] active:scale-[0.98]">
                          <Plus className="w-4 h-4 inline mr-1" /> Add More
                        </button>
                        <button onClick={handleCheckout} disabled={loading} className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-bold text-[14px] disabled:opacity-50 active:scale-[0.98]">
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
                                ? 'bg-amber-500 text-black' 
                                : 'bg-zinc-800 text-gray-400'
                            }`}
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
                        <button onClick={() => handleOptionClick('confirm_tip')} className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-bold active:scale-[0.98]">
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
                      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4">
                        <div className="text-center border-b border-zinc-800 pb-3 mb-3">
                          <h3 className="text-lg font-bold text-amber-400">netrikxr.shop</h3>
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
                            <span className="text-amber-400">${total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                        <p className="text-amber-400 font-medium text-[14px]">💵 Pay cash to the manager</p>
                      </div>
                      <button onClick={generatePDF} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium text-[14px]">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={() => handleOptionClick('done')} className="w-full py-3 bg-amber-500 text-black rounded-xl font-bold text-[14px]">
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
                                  ? 'text-amber-400 fill-amber-400' 
                                  : 'text-gray-600'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                      {rating > 0 && (
                        <button 
                          onClick={handleRatingSubmit}
                          className="w-full py-3 bg-amber-500 text-black rounded-xl font-bold text-[14px]"
                        >
                          Submit Rating
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} className="h-1" />
        </div>
      </div>

      {/* ========================================== */}
      {/* FIXED INPUT BAR - Native App Style */}
      {/* ========================================== */}
      <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 safe-bottom">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-lg mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask SIA anything..."
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl focus:border-amber-500/50 focus:outline-none text-[16px] placeholder-gray-500"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
          />
          <button 
            type="submit" 
            disabled={!userInput.trim()}
            className="w-12 h-12 bg-amber-500 text-black rounded-2xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* CSS for safe areas and scrollbar */}
      <style jsx global>{`
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 0);
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
