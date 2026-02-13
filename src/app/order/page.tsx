'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';
import jsPDF from 'jspdf';
import { 
  Send, ShoppingCart, Plus, Minus, Trash2, Star, X, Phone,
  FileText, ArrowLeft, Check, MessageCircle, UtensilsCrossed
} from 'lucide-react';
import { getGeminiResponse, shouldUseGemini } from '@/lib/gemini';

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
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tipAmount = subtotal * (selectedTip / 100);
  const total = subtotal + tipAmount;
  const categories = [...new Set(menuItems.map(i => i.category))];

  // Initial fetch
  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await supabase.from('menu_items').select('*').eq('available', true).order('category');
      if (data) setMenuItems(data as MenuItem[]);
    };
    fetchMenu();
  }, []);

  // Listen for order confirmation from admin
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
              `✅ **Order Confirmed!**\n\nYour order has been confirmed by our staff!\n\nReceipt: **${receiptId}**\nTable: ${tableNumber}\nSubtotal: $${subtotal.toFixed(2)}\n\n🍹 Your drinks are being prepared!\n💵 **Pay cash to the manager when ready.**`,
              [
                { label: '➕ Order More', value: 'more' },
                { label: '💵 Add Tip & Bill', value: 'pay' }
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
        `👋 Hey there! Welcome to netrikxr.shop!\n\nI'm **SIA**, your virtual bartender at **Table ${tableNumber}**.\n\nI'm here to help you order drinks and make your experience amazing. What sounds good today?`,
        [
          { label: '🍹 See Drinks Menu', value: 'menu' },
          { label: '🎉 Party Package', value: 'party' },
          { label: '💰 Check Prices', value: 'prices' },
          { label: '❓ Need Help', value: 'help' }
        ]
      );
    }
  }, [menuItems, tableNumber, chatMessages.length]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        addUserMessage('Show me the drinks menu');
        addBotMessage('Awesome choice! 🍹 Here\'s what we\'ve got on tap today. Tap any category to explore, or just tell me what vibe you\'re going for!', undefined, { showMenu: true });
        break;
      case 'cart':
        addUserMessage('Show my cart');
        if (cart.length === 0) {
          addBotMessage('Your cart is looking a bit empty! 😄 Let me help you fix that. What are you in the mood for - something refreshing, strong, or maybe a mix?', [
            { label: '🍹 See Drinks Menu', value: 'menu' },
            { label: '🍺 Something Cold', value: 'cold' },
            { label: '🥃 Something Strong', value: 'strong' }
          ]);
        } else {
          addBotMessage(`Great selection! You have ${cart.length} item(s) ready to go:`, undefined, { showCart: true });
        }
        break;
      case 'help':
        addUserMessage('I need help');
        addBotMessage(
          `No worries, I've got you covered! Here's the quick rundown:\n\n1️⃣ Browse our menu - I'll show you the good stuff\n2️⃣ Tap + to add what catches your eye\n3️⃣ Review your picks in the cart\n4️⃣ Place your order when ready\n5️⃣ Add a tip if you'd like to show some love\n6️⃣ Get your bill and you're all set!\n\nWhat would you like to start with?`,
          [
            { label: '🍹 Show Menu', value: 'menu' },
            { label: '💬 Talk to SIA', value: 'recommend' }
          ]
        );
        break;
      case 'party':
        addUserMessage('Tell me about party packages');
        addBotMessage(
          `🎉 Party time! I love it!\n\nAre you celebrating something special today? Birthday, promotion, or just because it's a great day?\n\nTell me:\n• How many people in your group?\n• What's the vibe - classy, wild, or chill?\n\nI'll put together some perfect recommendations!`,
          [
            { label: '🎂 Birthday Party', value: 'birthday' },
            { label: '👔 Work Celebration', value: 'celebration' },
            { label: '😎 Just Vibing', value: 'casual' }
          ]
        );
        break;
      case 'prices':
        addUserMessage('Show me prices');
        addBotMessage(
          `💰 Great question! Here's a quick rundown:\n\nOur menu has something for every budget. Most drinks range from affordable classics to premium selections.\n\nWant me to show you:\n• 🏷️ Best value picks\n• 🍹 Full menu with prices\n• ⭐ Today's specials`,
          [
            { label: '🏷️ Best Value', value: 'value' },
            { label: '🍹 Full Menu', value: 'menu' }
          ]
        );
        break;
      case 'birthday':
        addUserMessage('Birthday party');
        addBotMessage(
          `🎂 Happy Birthday vibes! Let's make it memorable!\n\nFor birthdays, I'd recommend:\n• A round of shots to kick things off\n• Some signature cocktails\n• A bottle if you're going big!\n\nHow many people are celebrating?`,
          [{ label: '🍹 See Menu', value: 'menu' }]
        );
        break;
      case 'celebration':
        addUserMessage('Work celebration');
        addBotMessage(
          `👔 Congrats on whatever you're celebrating!\n\nFor office celebrations, classics work great:\n• Whiskey for the distinguished\n• Wine for the refined\n• Cocktails for the adventurous\n\nLet me show you what we've got!`,
          [{ label: '🍹 See Menu', value: 'menu' }]
        );
        break;
      case 'casual':
        addUserMessage('Just hanging out');
        addBotMessage(
          `😎 Nothing wrong with that! Sometimes the best nights are unplanned.\n\nWhat's calling your name - beer, cocktails, or something stronger to get things started?`,
          [
            { label: '🍺 Beers', value: 'menu' },
            { label: '🍸 Cocktails', value: 'menu' },
            { label: '🥃 Spirits', value: 'menu' }
          ]
        );
        break;
      case 'value':
        addUserMessage('Show me best value options');
        addBotMessage(
          `🏷️ Smart choice! Here are great picks that won't break the bank.\n\nCheck out our menu - I've sorted the best value options for you. Happy hour favorites and classic pours!`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'cold':
        addUserMessage('Something cold');
        addBotMessage(
          `🧊 Ice cold coming up! Perfect for cooling down.\n\nWe've got refreshing beers, frozen cocktails, and chilled spirits. What catches your eye?`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'strong':
        addUserMessage('Something strong');
        addBotMessage(
          `🥃 I like your style! Going for the good stuff.\n\nWhiskey, rum, vodka, or a strong cocktail? Let's find your poison!`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'recommend':
        addUserMessage('What do you recommend?');
        addBotMessage(
          `Great question! Here's what's popular tonight:\n\n🔥 **Hot picks:**\n• Classic cocktails are always a hit\n• Our craft beers are flying off the taps\n• Premium whiskey for the connoisseurs\n\nWhat sounds good? Or tell me your mood and I'll suggest something perfect!`,
          [
            { label: '🍹 Show Menu', value: 'menu' },
            { label: '😌 Relaxed', value: 'relaxed' },
            { label: '🎊 Celebrating', value: 'party' }
          ]
        );
        break;
      case 'relaxed':
        addUserMessage('Feeling relaxed');
        addBotMessage(
          `😌 Perfect chill vibes! For a relaxed evening, I'd suggest:\n\n• A smooth beer to sip on\n• A classic cocktail - nothing too crazy\n• A nice glass of wine\n\nLet's find your perfect match!`,
          undefined, 
          { showMenu: true }
        );
        break;
      case 'checkout':
        handleCheckout();
        break;
      case 'more':
        addUserMessage('I want to order more');
        addBotMessage('Coming right up! 🍹 Here\'s the menu - go ahead and add whatever looks good!', undefined, { showMenu: true });
        break;
      case 'pay':
        addUserMessage('Pay now');
        addBotMessage('Almost done! 💰 Would you like to add a tip for our hardworking staff?', undefined, { showTip: true });
        break;
      case 'skip_tip':
        setSelectedTip(0);
        addUserMessage('No tip');
        addBotMessage('No problem at all! Ready to wrap things up?', [{ label: '📄 Get My Bill', value: 'bill' }]);
        break;
      case 'confirm_tip':
        addUserMessage(`Tip: ${selectedTip}%`);
        addBotMessage(`You're awesome! 🙏 ${selectedTip}% tip added. Ready for your bill?`, [{ label: '📄 Get My Bill', value: 'bill' }]);
        break;
      case 'bill':
        addUserMessage('Generate bill');
        addBotMessage('Here\'s your bill! 🧾 Please pay cash to the manager when ready. Thanks for hanging out with us!', undefined, { showBill: true });
        break;
      case 'done':
        addUserMessage('Done');
        addBotMessage('One last thing! How was everything tonight? Your feedback means the world to us! ⭐', undefined, { showRating: true });
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

    setLoading(true);
    addUserMessage('Place my order');
    
    const receipt = `ORD-${tableNumber}-${Date.now().toString().slice(-6)}`;
    setReceiptId(receipt);

    const orderData = {
      table_number: parseInt(tableNumber),
      items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      subtotal: subtotal,
      tip_amount: 0,
      total: subtotal,
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

    // Store order ID for real-time confirmation listening
    if (insertedData && insertedData[0]) {
      setCurrentOrderId(insertedData[0].id);
    }

    setOrderPlaced(true);
    setWaitingForConfirmation(true);
    
    // Show "waiting for confirmation" message instead of immediate confirmation
    addBotMessage(
      `📤 **Order Sent!**\n\nReceipt: **${receipt}**\nTable: ${tableNumber}\nSubtotal: $${subtotal.toFixed(2)}\n\n⏳ Your order has been sent to our staff for confirmation.\n\nI'll let you know as soon as it's confirmed!`,
      []
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.toLowerCase().trim();
    const originalInput = userInput;
    addUserMessage(userInput);
    setUserInput('');

    // Try Gemini for conversational enhancement
    if (shouldUseGemini(input)) {
      const aiResponse = await getGeminiResponse(originalInput, `Customer is at table ${tableNumber}`);
      if (aiResponse) {
        addBotMessage(aiResponse, [
          { label: '🍹 See Menu', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' }
        ]);
        return;
      }
    }

    // Smart keyword-based responses - like a real bartender
    if (input.includes('hi') || input.includes('hello') || input.includes('hey')) {
      addBotMessage(
        `Hey there! 👋 I'm SIA, your bartender tonight! What can I get for you? Something refreshing, or are we going all out today?`,
        [
          { label: '🍹 See Menu', value: 'menu' },
          { label: '💬 Recommend Something', value: 'recommend' }
        ]
      );
    } else if (input.includes('drink') || input.includes('thirsty') || input.includes('beverage')) {
      addBotMessage(
        `🍹 Coming right up! What kind of drink are you in the mood for?\n\n• Something cold and refreshing?\n• A classic cocktail?\n• Beer or wine?\n• Something stronger?`,
        [
          { label: '🧊 Cold Drinks', value: 'cold' },
          { label: '🍸 Cocktails', value: 'menu' },
          { label: '🥃 Strong Stuff', value: 'strong' }
        ]
      );
    } else if (input.includes('party') || input.includes('celebrate') || input.includes('celebration') || input.includes('group')) {
      handleOptionClick('party');
    } else if (input.includes('price') || input.includes('cost') || input.includes('expensive') || input.includes('cheap') || input.includes('affordable')) {
      handleOptionClick('prices');
    } else if (input.includes('recommend') || input.includes('suggest') || input.includes('best') || input.includes('popular') || input.includes('favorite')) {
      handleOptionClick('recommend');
    } else if (input.includes('beer') || input.includes('brew') || input.includes('ale') || input.includes('lager')) {
      addBotMessage(
        `🍺 A beer lover! Great choice. We've got craft beers, imports, and classic favorites.\n\nWant to see what's on tap?`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('cocktail') || input.includes('mixed')) {
      addBotMessage(
        `🍸 Cocktails - my specialty! We've got classics like Mojitos, Margaritas, and some house specials.\n\nWhat's your vibe - fruity, strong, or classic?`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('whiskey') || input.includes('bourbon') || input.includes('scotch') || input.includes('rum') || input.includes('vodka') || input.includes('tequila')) {
      addBotMessage(
        `🥃 A person of fine taste! Let me show you our spirits collection. We've got some great picks!`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('wine')) {
      addBotMessage(
        `🍷 Wine it is! Red, white, or rosé? Check out our selection:`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('shot') || input.includes('shots')) {
      addBotMessage(
        `🔥 Shots! Let's get this started! We've got tequila, vodka, whiskey shots and more. How many are we doing?`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('water') || input.includes('soda') || input.includes('juice') || input.includes('non-alcohol') || input.includes('soft drink')) {
      addBotMessage(
        `No problem! We've got non-alcoholic options too - water, sodas, juices, and mocktails. What sounds good?`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('birthday')) {
      handleOptionClick('birthday');
    } else if (input.includes('relax') || input.includes('chill') || input.includes('calm')) {
      handleOptionClick('relaxed');
    } else if (input.includes('strong') || input.includes('kick') || input.includes('powerful')) {
      handleOptionClick('strong');
    } else if (input.includes('cold') || input.includes('refresh') || input.includes('cool')) {
      handleOptionClick('cold');
    } else if (input.includes('menu') || input.includes('order') || input.includes('food') || input.includes('what do you have')) {
      addBotMessage('Here\'s our full menu! 🍹 Take your pick:', undefined, { showMenu: true });
    } else if (input.includes('cart') || input.includes('basket') || input.includes('my order')) {
      handleOptionClick('cart');
    } else if (input.includes('checkout') || input.includes('place order') || input.includes('confirm') || input.includes('done ordering')) {
      handleCheckout();
    } else if (input.includes('help') || input.includes('how')) {
      handleOptionClick('help');
    } else if (input.includes('pay') || input.includes('bill') || input.includes('check')) {
      handleOptionClick('pay');
    } else if (input.includes('thank') || input.includes('thanks') || input.includes('awesome') || input.includes('great')) {
      addBotMessage(
        `You're welcome! 😊 That's what I'm here for. Anything else I can help you with?`,
        [
          { label: '🍹 More Drinks', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' },
          { label: '✅ I\'m Good', value: 'checkout' }
        ]
      );
    } else if (input.includes('special') || input.includes('deal') || input.includes('discount') || input.includes('offer')) {
      addBotMessage(
        `Great question! 🌟 Check out our menu for today's specials and popular picks. Some items are flying off the shelf tonight!`,
        undefined, 
        { showMenu: true }
      );
    } else if (input.includes('quick') || input.includes('fast') || input.includes('hurry') || input.includes('rush')) {
      addBotMessage(
        `Got it - let's be quick! 🏃 Here's the menu, tap what you want and hit checkout. I'll make sure it's ready fast!`,
        undefined, 
        { showMenu: true }
      );
    } else {
      // Smart fallback - still helpful
      addBotMessage(
        `I hear you! Let me help with that. Here's what I can do for you:`,
        [
          { label: '🍹 See Menu', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' },
          { label: '💬 Get Recommendations', value: 'recommend' },
          { label: '✅ Checkout', value: 'checkout' }
        ]
      );
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
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
    
    // Update order with rating and tip
    if (receiptId) {
      const { error } = await supabase.from('orders').update({ 
        rating, 
        tip_amount: tipAmount,
        total: total 
      }).eq('receipt_id', receiptId);
      if (error) console.error('Rating update error:', error);
    }
    
    setShowThankYou(true);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(0);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('netrikxr.shop', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Restaurant Bill', pageWidth / 2, 30, { align: 'center' });
    
    // Receipt info
    doc.setTextColor(60);
    doc.setFontSize(10);
    let y = 55;
    doc.text(`Receipt: ${receiptId}`, 20, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
    y += 8;
    doc.text(`Table: ${tableNumber}`, 20, y);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, pageWidth - 20, y, { align: 'right' });
    
    // Line
    y += 10;
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    
    // Items header
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Item', 20, y);
    doc.text('Qty', 100, y);
    doc.text('Price', 130, y);
    doc.text('Total', pageWidth - 20, y, { align: 'right' });
    
    // Items
    doc.setFont('helvetica', 'normal');
    y += 8;
    cart.forEach(item => {
      doc.text(item.name.substring(0, 25), 20, y);
      doc.text(item.quantity.toString(), 105, y);
      doc.text(`$${item.price.toFixed(2)}`, 130, y);
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
    });
    
    // Line
    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    
    // Totals
    y += 10;
    doc.text('Subtotal:', 100, y);
    doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    
    if (tipAmount > 0) {
      y += 7;
      doc.text(`Tip (${selectedTip}%):`, 100, y);
      doc.text(`$${tipAmount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    }
    
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', 100, y);
    doc.text(`$${total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    
    // Footer
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('Tampa, Florida | netrikxr.shop', pageWidth / 2, y, { align: 'center' });
    
    // Save
    doc.save(`bill_${receiptId}.pdf`);
  };

  const shareWhatsApp = () => {
    const items = cart.map(i => `${i.quantity}x ${i.name} - $${(i.price * i.quantity).toFixed(2)}`).join('\n');
    const message = encodeURIComponent(
      `🧾 *Bill from netrikxr.shop*\n\n` +
      `Receipt: ${receiptId}\n` +
      `Table: ${tableNumber}\n` +
      `Date: ${new Date().toLocaleString()}\n\n` +
      `*Items:*\n${items}\n\n` +
      `Subtotal: $${subtotal.toFixed(2)}\n` +
      (tipAmount > 0 ? `Tip (${selectedTip}%): $${tipAmount.toFixed(2)}\n` : '') +
      `*Total: $${total.toFixed(2)}*\n\n` +
      `Thank you for dining with us! 🍽️`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${message}`, '_blank');
  };

  // Thank You Screen
  if (showThankYou) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm mx-auto"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-8"
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
          <div className="pt-6 border-t border-white/10">
            <p className="text-sm text-gray-600">netrikxr.shop</p>
            <p className="text-xs text-gray-700 mt-1">Tampa, Florida</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black text-white flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-black via-black/98 to-black/95 backdrop-blur-xl border-b border-amber-700/20 px-5 py-4 safe-area-top shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-lg font-bold text-black">N</span>
            </div>
            <div>
              <p className="font-bold text-amber-400 text-base">netrikxr.shop</p>
              <p className="text-xs text-gray-500">Table {tableNumber} • SIA</p>
            </div>
          </div>
          <button 
            onClick={() => handleOptionClick('cart')}
            className="relative p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold shadow-lg">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scroll-smooth">
        <AnimatePresence>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} px-1`}
            >
              <div className={`max-w-[87%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {/* Avatar */}
                {msg.role === 'bot' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-3 h-3 text-black" />
                    </div>
                    <span className="text-xs text-amber-400 font-medium">SIA</span>
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-amber-500 text-black rounded-br-sm shadow-lg shadow-amber-500/20' 
                    : 'bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 border border-amber-700/25 rounded-bl-sm shadow-xl shadow-black/40'
                }`}>
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.6]">{msg.content}</p>
                </div>

                {/* Options */}
                {msg.options && (
                  <div className="grid grid-cols-2 gap-2.5 mt-4">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleOptionClick(opt.value)}
                        className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-[14px] font-medium hover:bg-amber-500/20 active:scale-[0.97] transition-all shadow-md"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Menu Display */}
                {msg.showMenu && (
                  <div className="mt-4 space-y-3">
                    {/* Categories */}
                    <div className="flex flex-wrap gap-2 pb-2">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}
                      >
                        All
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    
                    {/* Menu Items */}
                    <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl">
                      {menuItems
                        .filter(i => !selectedCategory || i.category === selectedCategory)
                        .map(item => {
                          const inCart = cart.find(c => c.id === item.id);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-black/50 border border-white/5 rounded-xl hover:border-amber-500/20 transition-colors">
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="font-medium text-base truncate">{item.name}</p>
                                <p className="text-sm text-amber-400 font-semibold">${item.price.toFixed(2)}</p>
                              </div>
                              {inCart ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-8 text-center font-bold text-lg">{inCart.quantity}</span>
                                  <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 bg-amber-500 text-black rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => addToCart(item)} className="px-5 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-500/20 active:scale-95 transition-all flex items-center gap-2">
                                  <Plus className="w-4 h-4" />
                                  <span>Add</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    
                    {cart.length > 0 && (
                      <button onClick={() => handleOptionClick('cart')} className="w-full py-3.5 bg-amber-500 text-black rounded-xl font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20">
                        View Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items) • ${subtotal.toFixed(2)}
                      </button>
                    )}
                  </div>
                )}

                {/* Cart Display */}
                {msg.showCart && cart.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-black/50 border border-white/5 rounded-xl">
                        <div className="flex-1 mr-3">
                          <p className="font-medium text-base">{item.name}</p>
                          <p className="text-sm text-gray-400">${item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 bg-amber-500 text-black rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeFromCart(item.id)} className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center active:scale-95 transition-transform ml-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex justify-between text-xl font-bold">
                        <span>Total</span>
                        <span className="text-amber-400">${subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleOptionClick('menu')} className="flex-1 py-3.5 border border-amber-500/30 text-amber-400 rounded-xl font-medium text-base active:scale-[0.98] transition-transform">
                        <Plus className="w-4 h-4 inline mr-1" /> Add More
                      </button>
                      <button onClick={handleCheckout} disabled={loading} className="flex-1 py-3.5 bg-amber-500 text-black rounded-xl font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20">
                        {loading ? 'Placing...' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tip Selection */}
                {msg.showTip && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-gray-400 text-center mb-2">Select tip amount</p>
                    <div className="grid grid-cols-5 gap-2">
                      {TIP_OPTIONS.map(tip => (
                        <button
                          key={tip}
                          onClick={() => handleTipSelect(tip)}
                          className={`py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                            selectedTip === tip 
                              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          {tip}%
                        </button>
                      ))}
                    </div>
                    {selectedTip > 0 && (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-green-400 text-center font-medium text-base">Tip: ${(subtotal * selectedTip / 100).toFixed(2)}</p>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => handleOptionClick('skip_tip')} className="flex-1 py-3.5 border border-white/10 text-gray-400 rounded-xl font-medium active:scale-[0.98] transition-transform">
                        Skip
                      </button>
                      <button onClick={() => handleOptionClick('confirm_tip')} className="flex-1 py-3.5 bg-amber-500 text-black rounded-xl font-bold active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20">
                        Confirm Tip
                      </button>
                    </div>
                  </div>
                )}

                {/* Bill Display */}
                {msg.showBill && (
                  <div className="mt-4 space-y-4">
                    <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-amber-500/30 rounded-2xl p-5">
                      <div className="text-center border-b border-white/10 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-amber-400">netrikxr.shop</h3>
                        <p className="text-xs text-gray-500">Tampa, Florida</p>
                      </div>
                      <div className="space-y-1 text-sm mb-4">
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
                      <div className="border-t border-white/10 pt-4 space-y-2">
                        {cart.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/10 pt-4 mt-4 space-y-2">
                        <div className="flex justify-between text-gray-400">
                          <span>Subtotal</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        {tipAmount > 0 && (
                          <div className="flex justify-between text-gray-400">
                            <span>Tip ({selectedTip}%)</span>
                            <span>${tipAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xl font-bold pt-2">
                          <span>Total</span>
                          <span className="text-amber-400">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                      <p className="text-amber-400 font-medium">💵 Please pay cash to the manager</p>
                      <p className="text-xs text-gray-500 mt-1">Show this bill when paying</p>
                    </div>
                    <button onClick={generatePDF} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium">
                      <FileText className="w-5 h-5" /> Download PDF Bill
                    </button>
                    <button onClick={() => handleOptionClick('done')} className="w-full py-3 bg-amber-500 text-black rounded-xl font-semibold">
                      Done
                    </button>
                  </div>
                )}

                {/* Star Rating */}
                {msg.showRating && (
                  <div className="mt-4 space-y-4">
                    <p className="text-center text-gray-400">How was your experience?</p>
                    <div className="flex justify-center gap-2">
                      {[1,2,3,4,5].map(i => (
                        <button
                          key={i}
                          onClick={() => setRating(i)}
                          onMouseEnter={() => setHoverRating(i)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform hover:scale-110"
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
                        className="w-full py-3 bg-amber-500 text-black rounded-xl font-semibold"
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
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-black via-black/99 to-black/95 backdrop-blur-xl border-t border-amber-700/25 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask SIA anything..."
            className="flex-1 px-5 py-4 bg-zinc-900 border border-amber-700/40 rounded-2xl focus:border-amber-500/60 focus:outline-none text-[15px] placeholder-gray-500 shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!userInput.trim()}
            className="px-6 py-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all active:scale-95 flex items-center justify-center min-w-[60px] shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
