'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';

interface CartItem extends MenuItem {
  quantity: number;
}

interface Message {
  id: number;
  type: 'bot' | 'user' | 'menu' | 'cart' | 'confirmation' | 'payment';
  text?: string;
  items?: MenuItem[];
  cartItems?: CartItem[];
  orderId?: string;
  total?: number;
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
      
      // Welcome message
      setMessages([
        {
          id: nextMsgId(),
          type: 'bot',
          text: `Welcome to Table ${tableNumber}! 👋\n\nI'm your AI waiter. Browse our menu below, add items to your cart, and I'll send your order to the kitchen!\n\nTap any item to add it to your cart.`
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
    
    // Add message
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'user',
      text: `Add ${item.name} to cart`
    }, {
      id: nextMsgId(),
      type: 'bot',
      text: `Added ${item.name} ($${item.price.toFixed(2)}) to your cart! ✓`
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

  const placeOrder = async () => {
    if (cart.length === 0) {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: 'Your cart is empty! Please add some items first.'
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
      customer_note: inputText || null
    };

    const { error } = await supabase.from('orders').insert(orderData);

    if (error) {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `Sorry, there was an error placing your order: ${error.message}. Please try again.`
      }]);
      return;
    }

    setCurrentOrderId(receiptId);
    setOrderPlaced(true);
    
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'confirmation',
      orderId: receiptId,
      total: cartTotal,
      cartItems: [...cart]
    }]);
    
    setCart([]);
    setInputText('');
  };

  const handlePayment = async (method: 'online' | 'cash') => {
    if (!currentOrderId) return;

    if (method === 'online') {
      // Simulate online payment - in real app, integrate with Stripe/PayPal
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
        text: `Payment successful! 🎉\n\nYour order ${currentOrderId} has been paid online.\n\nThe kitchen has been notified and your food will be served soon!\n\nThank you for dining with us! 🙏`
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        type: 'bot',
        text: `Noted! You'll pay with cash. 💵\n\nPlease pay $${cartTotal.toFixed(2)} to our staff after your meal.\n\nYour order ${currentOrderId} is being prepared!\n\nEnjoy your meal! 🍽️`
      }]);
    }
  };

  const shareToWhatsApp = () => {
    if (!currentOrderId) return;
    
    const orderSummary = cart.length > 0 
      ? cart.map(item => `${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}`).join('\n')
      : 'Order details in restaurant system';
    
    const message = encodeURIComponent(
      `🍽️ Order Confirmation - netrikxr.shop\n\n` +
      `Order ID: ${currentOrderId}\n` +
      `Table: ${tableNumber}\n\n` +
      `${orderSummary}\n\n` +
      `Total: $${cartTotal.toFixed(2)}\n\n` +
      `Thank you for your order!`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      type: 'user',
      text: inputText
    }]);
    
    // Simple bot response
    setTimeout(() => {
      const lowerText = inputText.toLowerCase();
      let response = "I can help you browse our menu and place orders. Use the menu below to add items to your cart!";
      
      if (lowerText.includes('recommend') || lowerText.includes('suggest')) {
        response = "I'd recommend our popular items! Check out the menu below - our cocktails and premium drinks are customer favorites! 🍸";
      } else if (lowerText.includes('price') || lowerText.includes('cost')) {
        response = "You can see all prices in our menu below. Tap on any item to add it to your cart!";
      } else if (lowerText.includes('spicy') || lowerText.includes('hot')) {
        response = "Looking for something with a kick? Check out our menu - some items have special preparation options!";
      } else if (lowerText.includes('vegetarian') || lowerText.includes('vegan')) {
        response = "We have vegetarian options! Browse through the categories to find dishes that suit your preference.";
      } else if (lowerText.includes('water') || lowerText.includes('drink')) {
        response = "Check out our Drinks section in the menu! We have a wide selection of beverages. 🥤";
      } else if (lowerText.includes('bill') || lowerText.includes('pay') || lowerText.includes('check')) {
        if (orderPlaced) {
          response = "Ready to pay? Use the payment buttons above to pay online or indicate you'll pay with cash!";
        } else {
          response = "Add items to your cart first, then place your order. After that, you can choose your payment method!";
        }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-black">N</span>
            </div>
            <div>
              <h1 className="font-bold text-white">netrikxr.shop</h1>
              <p className="text-xs text-gray-400">Table {tableNumber}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-600 px-3 py-1.5 rounded-full">
              <span className="text-black font-semibold">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              <span className="text-black font-bold">${cartTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.type === 'bot' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold shrink-0">N</div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-sm p-4 max-w-[280px] sm:max-w-sm">
                    <p className="text-sm whitespace-pre-line text-gray-100">{msg.text}</p>
                  </div>
                </div>
              )}
              
              {msg.type === 'user' && (
                <div className="flex gap-3 justify-end">
                  <div className="bg-amber-600/30 rounded-2xl rounded-tr-sm p-4 max-w-[280px] sm:max-w-sm">
                    <p className="text-sm text-amber-100">{msg.text}</p>
                  </div>
                </div>
              )}
              
              {msg.type === 'confirmation' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">✓</div>
                  <div className="bg-green-900/30 border border-green-600/30 rounded-2xl rounded-tl-sm p-4 max-w-sm">
                    <p className="text-green-400 font-semibold mb-2">Order Placed! 🎉</p>
                    <p className="text-sm text-gray-300">Order ID: <span className="font-mono font-bold">{msg.orderId}</span></p>
                    <p className="text-sm text-gray-300">Table: {tableNumber}</p>
                    <div className="mt-3 pt-3 border-t border-green-600/20">
                      {msg.cartItems?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-300">
                          <span>{item.quantity}x {item.name}</span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-base font-bold text-white mt-2 pt-2 border-t border-green-600/20">
                        <span>Total</span>
                        <span>${msg.total?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-gray-400 mb-2">Choose payment method:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handlePayment('online')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                        >
                          💳 Pay Online
                        </button>
                        <button 
                          onClick={() => handlePayment('cash')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
                        >
                          💵 Pay Cash
                        </button>
                      </div>
                      <button 
                        onClick={shareToWhatsApp}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      >
                        📱 Share to WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Menu Section */}
      {!orderPlaced && (
        <div className="bg-gray-800 border-t border-gray-700">
          {/* Category Tabs */}
          <div className="px-4 py-3 border-b border-gray-700 overflow-x-auto">
            <div className="flex gap-2 max-w-2xl mx-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat 
                      ? 'bg-amber-600 text-black' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {cat === 'all' ? 'All Items' : cat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="max-h-[40vh] overflow-y-auto px-4 py-4">
            <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map(item => {
                const cartItem = cart.find(i => i.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-gray-700 hover:bg-gray-600 rounded-xl p-3 text-left transition-colors relative"
                  >
                    {cartItem && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">{cartItem.quantity}</span>
                      </div>
                    )}
                    <p className="font-medium text-white text-sm leading-tight">{item.name}</p>
                    <p className="text-amber-400 font-bold mt-1">${item.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.category}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-750">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400">Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                  <span className="text-xl font-bold text-amber-400">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-2 mb-3 max-h-24 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                          className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white hover:bg-gray-500"
                        >
                          -
                        </button>
                        <span className="text-white font-medium w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                          className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-black hover:bg-amber-500"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={placeOrder}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-black hover:opacity-90 transition-opacity"
                >
                  Place Order - ${cartTotal.toFixed(2)}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Input */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={orderPlaced ? "Need help with anything else?" : "Ask me anything or add a note..."}
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl focus:border-amber-500 focus:outline-none text-white placeholder-gray-400"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl text-black font-medium"
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
