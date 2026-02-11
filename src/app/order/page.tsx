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

  // Welcome message
  useEffect(() => {
    if (menuItems.length > 0 && chatMessages.length === 0) {
      addBotMessage(
        `👋 Welcome to netrikxr.shop!\n\nYou're at **Table ${tableNumber}**.\n\nI'm here to help you order. What would you like to do?`,
        [
          { label: '📋 View Menu', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' },
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
        addUserMessage('Show me the menu');
        addBotMessage('Here\'s our menu! Tap on any category to browse:', undefined, { showMenu: true });
        break;
      case 'cart':
        addUserMessage('Show my cart');
        if (cart.length === 0) {
          addBotMessage('Your cart is empty! Let me show you our menu.', [{ label: '📋 View Menu', value: 'menu' }]);
        } else {
          addBotMessage(`You have ${cart.length} item(s) in your cart:`, undefined, { showCart: true });
        }
        break;
      case 'help':
        addUserMessage('I need help');
        addBotMessage(
          `Here's how to order:\n\n1️⃣ Browse the menu\n2️⃣ Tap + to add items\n3️⃣ Review your cart\n4️⃣ Place your order\n5️⃣ Add a tip if you'd like\n6️⃣ Get your bill`,
          [{ label: '📋 View Menu', value: 'menu' }]
        );
        break;
      case 'checkout':
        handleCheckout();
        break;
      case 'more':
        addUserMessage('I want to order more');
        addBotMessage('No problem! Here\'s the menu:', undefined, { showMenu: true });
        break;
      case 'pay':
        addUserMessage('Pay now');
        addBotMessage('Would you like to add a tip for our staff?', undefined, { showTip: true });
        break;
      case 'skip_tip':
        setSelectedTip(0);
        addUserMessage('No tip');
        addBotMessage('No worries! Ready to generate your bill?', [{ label: '📄 Get Bill', value: 'bill' }]);
        break;
      case 'confirm_tip':
        addUserMessage(`Tip: ${selectedTip}%`);
        addBotMessage(`Great! ${selectedTip}% tip added. Ready for your bill?`, [{ label: '📄 Get Bill', value: 'bill' }]);
        break;
      case 'bill':
        addUserMessage('Generate bill');
        addBotMessage('Here\'s your bill! You can download it or share via WhatsApp:', undefined, { showBill: true });
        break;
      case 'done':
        addUserMessage('Done');
        addBotMessage('Please rate your experience!', undefined, { showRating: true });
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

    const { error } = await supabase.from('orders').insert(orderData);
    setLoading(false);

    if (error) {
      console.error('Order error:', error);
      addBotMessage(`❌ Error: ${error.message || 'Could not place order'}. Please try again.`, [{ label: '🔄 Try Again', value: 'checkout' }]);
      return;
    }

    setOrderPlaced(true);
    addBotMessage(
      `✅ **Order Placed!**\n\nReceipt: **${receipt}**\nTable: ${tableNumber}\nSubtotal: $${subtotal.toFixed(2)}\n\nYour order has been sent to the kitchen!`,
      [
        { label: '➕ Order More', value: 'more' },
        { label: '💳 Pay Now', value: 'pay' }
      ]
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.toLowerCase().trim();
    addUserMessage(userInput);
    setUserInput('');

    if (input.includes('menu') || input.includes('order') || input.includes('food')) {
      addBotMessage('Here\'s our menu:', undefined, { showMenu: true });
    } else if (input.includes('cart') || input.includes('basket')) {
      handleOptionClick('cart');
    } else if (input.includes('checkout') || input.includes('place order') || input.includes('confirm')) {
      handleCheckout();
    } else if (input.includes('help') || input.includes('how')) {
      handleOptionClick('help');
    } else if (input.includes('pay') || input.includes('bill')) {
      handleOptionClick('pay');
    } else {
      addBotMessage(
        'I understand you want to: ' + userInput + '\n\nHere\'s what I can help with:',
        [
          { label: '📋 View Menu', value: 'menu' },
          { label: '🛒 View Cart', value: 'cart' },
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
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-12 h-12 text-black" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-gray-400 mb-2">You rated us {rating} star{rating > 1 ? 's' : ''}</p>
          <div className="flex justify-center gap-1 mb-6">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-8 h-8 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
            ))}
          </div>
          <p className="text-gray-500 mb-8">We hope to see you again soon!</p>
          <p className="text-sm text-gray-600">netrikxr.shop • Tampa, Florida</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-black to-black/95 backdrop-blur-xl border-b border-amber-700/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold text-black">N</span>
            </div>
            <div>
              <p className="font-bold text-amber-400">netrikxr.shop</p>
              <p className="text-xs text-gray-500">Table {tableNumber}</p>
            </div>
          </div>
          <button 
            onClick={() => handleOptionClick('cart')}
            className="relative p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
          >
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {/* Avatar */}
                {msg.role === 'bot' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-3 h-3 text-black" />
                    </div>
                    <span className="text-xs text-gray-500">Assistant</span>
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-amber-500 text-black rounded-br-md' 
                    : 'bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-amber-700/20 rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Options */}
                {msg.options && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleOptionClick(opt.value)}
                        className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm hover:bg-amber-500/20 transition-colors"
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1.5 rounded-full text-xs ${!selectedCategory ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-gray-300'}`}
                      >
                        All
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs ${selectedCategory === cat ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-gray-300'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    
                    {/* Menu Items */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {menuItems
                        .filter(i => !selectedCategory || i.category === selectedCategory)
                        .map(item => {
                          const inCart = cart.find(c => c.id === item.id);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-sm text-amber-400">${item.price.toFixed(2)}</p>
                              </div>
                              {inCart ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-6 text-center">{inCart.quantity}</span>
                                  <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-amber-500 text-black rounded-lg flex items-center justify-center">
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => addToCart(item)} className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20">
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    
                    {cart.length > 0 && (
                      <button onClick={() => handleOptionClick('cart')} className="w-full py-3 bg-amber-500 text-black rounded-xl font-semibold">
                        View Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items) • ${subtotal.toFixed(2)}
                      </button>
                    )}
                  </div>
                )}

                {/* Cart Display */}
                {msg.showCart && cart.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-400">${item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-amber-500 text-black rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center">
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
                      <button onClick={() => handleOptionClick('menu')} className="flex-1 py-3 border border-amber-500/30 text-amber-400 rounded-xl font-medium">
                        <Plus className="w-4 h-4 inline mr-1" /> Add More
                      </button>
                      <button onClick={handleCheckout} disabled={loading} className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-semibold disabled:opacity-50">
                        {loading ? 'Placing...' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tip Selection */}
                {msg.showTip && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-5 gap-2">
                      {TIP_OPTIONS.map(tip => (
                        <button
                          key={tip}
                          onClick={() => handleTipSelect(tip)}
                          className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                            selectedTip === tip 
                              ? 'bg-amber-500 text-black' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          {tip}%
                        </button>
                      ))}
                    </div>
                    {selectedTip > 0 && (
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-green-400 text-center">Tip: ${(subtotal * selectedTip / 100).toFixed(2)}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleOptionClick('skip_tip')} className="flex-1 py-3 border border-white/10 text-gray-400 rounded-xl">
                        Skip
                      </button>
                      <button onClick={() => handleOptionClick('confirm_tip')} className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-semibold">
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
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={generatePDF} className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium">
                        <FileText className="w-5 h-5" /> Download PDF
                      </button>
                      <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl font-medium">
                        <Phone className="w-5 h-5" /> WhatsApp
                      </button>
                    </div>
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
      <div className="sticky bottom-0 bg-gradient-to-t from-black to-black/95 backdrop-blur-xl border-t border-amber-700/20 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-zinc-900 border border-amber-700/30 rounded-xl focus:border-amber-500/50 focus:outline-none text-sm"
          />
          <button 
            type="submit" 
            className="px-4 py-3 bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition-colors"
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
