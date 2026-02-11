'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';

const ADMIN_WHATSAPP = '+16562145190';

interface CartItem extends MenuItem {
  quantity: number;
}

interface Message {
  id: number;
  type: 'bot' | 'user';
  text: string;
}

function OrderContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'menu' | 'cart' | 'payment' | 'done'>('menu');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  const addMsg = (type: 'bot' | 'user', text: string) => {
    setMessages(prev => [...prev, { id: ++msgIdRef.current, type, text }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch menu
  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category');
      
      if (data) setMenuItems(data as MenuItem[]);
      setLoading(false);
      
      addMsg('bot', `Welcome to Table ${tableNumber}! 👋\n\nI'm here to help you order. Browse the menu below and tap items to add them to your cart.\n\nWhen ready, tap "View Cart" to checkout.`);
    };
    fetchMenu();
  }, [tableNumber]);

  // Add to cart
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    addMsg('user', `Add ${item.name}`);
    addMsg('bot', `Added ${item.name} to cart! 🛒`);
  };

  // Update quantity
  const updateQty = (itemId: number, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== itemId);
      return prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // View cart
  const viewCart = () => {
    if (cart.length === 0) {
      addMsg('bot', 'Your cart is empty! Tap on menu items to add them.');
      return;
    }
    setStep('cart');
    const items = cart.map(i => `${i.quantity}x ${i.name} - $${(i.price * i.quantity).toFixed(2)}`).join('\n');
    addMsg('bot', `Your Cart:\n\n${items}\n\nTotal: $${cartTotal.toFixed(2)}\n\nReady to order? Tap "Place Order" below.`);
  };

  // Place order
  const placeOrder = async () => {
    const receiptId = `NX-${Date.now().toString(36).toUpperCase()}`;
    
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
      total: cartTotal,
      status: 'pending',
      payment_status: 'unpaid'
    };

    const { error } = await supabase.from('orders').insert(orderData);

    if (error) {
      addMsg('bot', `Sorry, there was an error: ${error.message}. Please try again.`);
      return;
    }

    setCurrentOrderId(receiptId);
    setOrderTotal(cartTotal);
    setStep('payment');
    
    addMsg('bot', `Order placed! 🎉\n\nOrder ID: ${receiptId}\nTable: ${tableNumber}\nTotal: $${cartTotal.toFixed(2)}\n\nThe kitchen has been notified. Now choose how you'd like to pay:`);
    
    // Send WhatsApp notification to admin
    const items = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
    const waMsg = encodeURIComponent(
      `🆕 New Order!\n\nOrder: ${receiptId}\nTable: ${tableNumber}\nItems: ${items}\nTotal: $${cartTotal.toFixed(2)}`
    );
    
    // Open WhatsApp in background (admin notification)
    const waUrl = `https://wa.me/${ADMIN_WHATSAPP.replace('+', '')}?text=${waMsg}`;
    window.open(waUrl, '_blank');
    
    setCart([]);
  };

  // Handle payment
  const handlePayment = async (method: 'online' | 'cash') => {
    if (!currentOrderId) return;

    if (method === 'online') {
      // Update payment status
      await supabase.from('orders').update({
        payment_status: 'paid',
        payment_method: 'online'
      }).eq('receipt_id', currentOrderId);
      
      addMsg('bot', `Payment of $${orderTotal.toFixed(2)} received! ✅\n\nYour order is being prepared. Thank you for dining with us!`);
    } else {
      addMsg('bot', `You'll pay $${orderTotal.toFixed(2)} in cash when your order arrives.\n\nYour order is being prepared. Thank you!`);
    }

    setStep('done');

    // Send invoice to WhatsApp
    setTimeout(() => {
      addMsg('bot', 'Would you like a copy of your receipt on WhatsApp?');
    }, 1000);
  };

  // Send receipt to WhatsApp
  const sendReceipt = () => {
    const receipt = encodeURIComponent(
      `🧾 Receipt - netrikxr.shop\n\nOrder: ${currentOrderId}\nTable: ${tableNumber}\nTotal: $${orderTotal.toFixed(2)}\n\nThank you for your order!`
    );
    window.open(`https://wa.me/?text=${receipt}`, '_blank');
    addMsg('bot', 'Receipt sent! 📱 Thank you for dining with us. Enjoy your meal! 🍽️');
  };

  // Handle text input
  const handleSend = () => {
    if (!inputText.trim()) return;
    addMsg('user', inputText);
    
    const lower = inputText.toLowerCase();
    
    if (lower.includes('help')) {
      addMsg('bot', 'Here\'s how to order:\n\n1. Tap items from the menu to add to cart\n2. Tap "View Cart" to see your order\n3. Tap "Place Order" to confirm\n4. Choose payment method\n\nNeed anything else? Just ask!');
    } else if (lower.includes('menu') || lower.includes('what')) {
      addMsg('bot', 'Check out our menu below! Tap any item to add it to your cart. 👇');
    } else if (lower.includes('cart') || lower.includes('order')) {
      viewCart();
    } else if (lower.includes('thank')) {
      addMsg('bot', 'You\'re welcome! Enjoy your meal! 😊');
    } else {
      addMsg('bot', 'I can help you order food! Tap items from the menu below, or type "help" for instructions.');
    }
    
    setInputText('');
  };

  // Group menu by category
  const categories = [...new Set(menuItems.map(item => item.category))];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-slate-800">netrikxr.shop</h1>
            <p className="text-xs text-slate-500">Table {tableNumber}</p>
          </div>
          {cart.length > 0 && step === 'menu' && (
            <button 
              onClick={viewCart}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg"
            >
              Cart ({cart.length}) - ${cartTotal.toFixed(2)}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-48">
        <div className="max-w-lg mx-auto space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line ${
                msg.type === 'user' 
                  ? 'bg-slate-800 text-white rounded-br-sm' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Action Buttons based on step */}
      {step === 'cart' && cart.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-lg mx-auto">
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-slate-800">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-slate-200 rounded-full text-slate-700 font-bold">-</button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-emerald-600 rounded-full text-white font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setStep('menu')}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg"
              >
                Add More
              </button>
              <button 
                onClick={placeOrder}
                className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-lg"
              >
                Place Order - ${cartTotal.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-slate-600 mb-3 text-center">Choose payment method:</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handlePayment('online')}
                className="py-3 bg-blue-600 text-white font-medium rounded-lg"
              >
                💳 Pay Online
              </button>
              <button 
                onClick={() => handlePayment('cash')}
                className="py-3 bg-emerald-600 text-white font-medium rounded-lg"
              >
                💵 Pay Cash
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-lg mx-auto">
            <button 
              onClick={sendReceipt}
              className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg"
            >
              📱 Send Receipt to WhatsApp
            </button>
            <button 
              onClick={() => {
                setStep('menu');
                setCurrentOrderId(null);
                addMsg('bot', 'Starting a new order. Browse the menu below! 👇');
              }}
              className="w-full py-3 mt-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
            >
              Start New Order
            </button>
          </div>
        </div>
      )}

      {/* Menu - shown when in menu step */}
      {step === 'menu' && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-slate-200 max-h-[45vh] overflow-y-auto">
          <div className="p-4">
            {categories.map(category => (
              <div key={category} className="mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{category}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.filter(item => item.category === category).map(item => {
                    const inCart = cart.find(i => i.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-left relative border border-slate-200"
                      >
                        {inCart && (
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {inCart.quantity}
                          </span>
                        )}
                        <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                        <p className="text-emerald-600 font-semibold text-sm">${item.price.toFixed(2)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-slate-100 rounded-full text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-slate-800 text-white rounded-full text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
