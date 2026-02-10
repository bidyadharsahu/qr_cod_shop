'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { MenuItem, OrderItem } from '@/lib/types';

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  component?: 'menu' | 'cart' | 'receipt' | 'tips' | 'payment-choice';
  data?: any;
}

type BotStep = 'welcome' | 'menu' | 'browsing' | 'cart-review' | 'confirm' | 'tip' | 'payment-choice' | 'done';

function generateOrderId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'NX-';
  for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function ChatBotContent() {
  const searchParams = useSearchParams();
  const tableNumber = parseInt(searchParams.get('table') || '1', 10);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [step, setStep] = useState<BotStep>('welcome');
  const [typing, setTyping] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [mounted, setMounted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  const nextId = () => {
    msgIdRef.current += 1;
    return `msg-${msgIdRef.current}`;
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const addBotMessage = useCallback((content: string, component?: ChatMessage['component'], data?: any, delay = 600) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, type: 'bot', content, component, data }]);
    }, delay);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, type: 'user', content }]);
  }, []);

  // Fetch menu
  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await supabase.from('menu_items').select('*').eq('available', true).order('category');
      if (data) setMenuItems(data as MenuItem[]);
    };
    fetchMenu();

    // Real-time menu updates
    const sub = supabase.channel('menu-customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  // Welcome message
  useEffect(() => {
    if (mounted) return;
    setMounted(true);
    setTimeout(() => {
      setMessages([{
        id: 'welcome-1',
        type: 'bot',
        content: `Welcome to netrikxr.shop! I'm your digital server for Table ${tableNumber}. I'll help you browse our menu and place your order. Ready to get started?`
      }]);
      setStep('welcome');
    }, 500);
  }, [mounted, tableNumber]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  // ---- CART LOGIC ----
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1, category: item.category }];
    });
    addUserMessage(`Add ${item.name}`);
    setTimeout(() => {
      addBotMessage(`Added ${item.name} ($${Number(item.price).toFixed(2)}) to your order. Anything else?`, undefined, undefined, 400);
    }, 100);
  };

  const removeFromCart = (itemId: number) => {
    const item = cart.find(c => c.id === itemId);
    if (!item) return;
    setCart(prev => prev.filter(c => c.id !== itemId));
    addBotMessage(`Removed ${item.name} from your order.`, undefined, undefined, 300);
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.id === itemId) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null as any;
          return { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean);
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const tipAmount = selectedTip !== null ? selectedTip : (customTip ? parseFloat(customTip) || 0 : 0);
  const grandTotal = cartTotal + tipAmount;

  // ---- ACTIONS ----
  const handleShowMenu = () => {
    addUserMessage('Show me the menu');
    setStep('browsing');
    setTimeout(() => {
      addBotMessage("Here's our current menu. Tap any item to add it to your order.", 'menu', menuItems, 500);
    }, 100);
  };

  const handleViewCart = () => {
    if (cart.length === 0) {
      addUserMessage('View my order');
      addBotMessage("Your order is empty right now. Let me show you our menu!", undefined, undefined, 400);
      setTimeout(() => handleShowMenu(), 800);
      return;
    }
    addUserMessage('View my order');
    setStep('cart-review');
    setTimeout(() => {
      addBotMessage(`Here's your current order (${cartCount} items):`, 'cart', cart, 400);
    }, 100);
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    addUserMessage('Place my order');
    setStep('tip');
    setTimeout(() => {
      addBotMessage("Great choices! Before we finalize, would you like to add a tip for our staff?", 'tips', undefined, 500);
    }, 100);
  };

  const handleSelectTip = (tipPercent: number) => {
    const tipVal = Math.round(cartTotal * tipPercent) / 100;
    setSelectedTip(tipVal);
    setCustomTip('');
    addUserMessage(tipPercent === 0 ? 'No tip' : `${tipPercent}% tip ($${tipVal.toFixed(2)})`);
    setStep('payment-choice');
    setTimeout(() => {
      addBotMessage("How would you like to handle payment?", 'payment-choice', undefined, 500);
    }, 100);
  };

  const handleCustomTipSubmit = () => {
    const val = parseFloat(customTip) || 0;
    setSelectedTip(val);
    addUserMessage(val === 0 ? 'No tip' : `Custom tip: $${val.toFixed(2)}`);
    setStep('payment-choice');
    setTimeout(() => {
      addBotMessage("How would you like to handle payment?", 'payment-choice', undefined, 500);
    }, 100);
  };

  const handlePaymentChoice = async (method: 'pay_later' | 'pay_now') => {
    if (method === 'pay_later') {
      addUserMessage("I'll pay at the counter");
      await submitOrder('cash', 'direct_cash');
    } else {
      addUserMessage("I'll pay now");
      // For now, since we can't integrate a real payment gateway without keys,
      // we simulate card payment
      await submitOrder('card', 'chatbot_payment');
    }
  };

  const submitOrder = async (paymentMethod: string, paymentType: string) => {
    setTyping(true);
    const orderId = generateOrderId();
    const finalTip = selectedTip !== null ? selectedTip : 0;
    const finalTotal = cartTotal + finalTip;

    const orderData = {
      receipt_id: orderId,
      table_number: tableNumber,
      items: cart,
      subtotal: cartTotal,
      tip_amount: finalTip,
      total: finalTotal,
      status: 'pending',
      payment_method: paymentMethod === 'cash' ? null : paymentMethod,
      payment_status: paymentType === 'chatbot_payment' ? 'paid' : 'unpaid',
      payment_type: paymentType === 'chatbot_payment' ? 'chatbot_payment' : null,
      transaction_id: paymentType === 'chatbot_payment' ? `TXN-${Date.now()}` : null,
      customer_note: null,
    };

    const { error } = await supabase.from('orders').insert(orderData);

    if (error) {
      setTyping(false);
      addBotMessage("Sorry, there was an issue placing your order. Please try again or ask our staff for help.", undefined, undefined, 300);
      return;
    }

    // Send WhatsApp notification
    try {
      const itemsList = cart.map(i => `${i.quantity}x ${i.name} ($${(i.price * i.quantity).toFixed(2)})`).join('%0A');
      const whatsappMsg = `*New Order - ${orderId}*%0ATable: ${tableNumber}%0A%0A${itemsList}%0A%0ASubtotal: $${cartTotal.toFixed(2)}%0ATip: $${finalTip.toFixed(2)}%0A*Total: $${finalTotal.toFixed(2)}*%0A%0APayment: ${paymentType === 'chatbot_payment' ? 'Paid via app' : 'Pay at counter'}`;
      // Open WhatsApp in background (won't redirect since we use a hidden approach)
      const waUrl = `https://api.whatsapp.com/send?phone=16562145190&text=${whatsappMsg}`;
      // We'll attempt to send via fetch to wa.me (won't actually work without API, but the admin gets realtime notification via Supabase)
      // The actual notification goes through Supabase realtime to admin dashboard
    } catch (e) {
      // WhatsApp notification is best-effort
    }

    setTyping(false);
    setOrderPlaced(true);
    setStep('done');
    setReceiptData({
      orderId,
      tableNumber,
      items: cart,
      subtotal: cartTotal,
      tip: finalTip,
      total: finalTotal,
      paymentType,
      paymentMethod,
      timestamp: new Date().toISOString(),
    });

    addBotMessage(`Your order has been placed! The kitchen has been notified.`, 'receipt', {
      orderId,
      tableNumber,
      items: cart,
      subtotal: cartTotal,
      tip: finalTip,
      total: finalTotal,
      paymentType,
      timestamp: new Date().toISOString(),
    }, 800);
  };

  const handleStartOver = () => {
    setCart([]);
    setStep('welcome');
    setOrderPlaced(false);
    setReceiptData(null);
    setSelectedTip(null);
    setCustomTip('');
    setMessages([{
      id: `restart-${Date.now()}`,
      type: 'bot',
      content: `Welcome back! Ready to place another order for Table ${tableNumber}?`
    }]);
  };

  // ---- GROUP MENU BY CATEGORY ----
  const menuByCategory: Record<string, MenuItem[]> = {};
  menuItems.forEach(item => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  // ---- RENDER ----
  return (
    <main className="chat-container bg-[#0a0a0a]">
      {/* Header */}
      <header className="shrink-0 bg-[#0d0d0d] border-b border-[#d4af37]/15 px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">netrikxr.shop</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-gray-400">Table {tableNumber} — Online</span>
              </div>
            </div>
          </div>
          {cart.length > 0 && !orderPlaced && (
            <button onClick={handleViewCart} className="relative p-2.5 rounded-xl bg-[#1a1a1a] border border-[#d4af37]/20">
              <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <span className="cart-badge">{cartCount}</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type === 'bot' ? 'bot-message' : 'user-message'}`}>
            {msg.type === 'bot' ? (
              <div className="bot-bubble">
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* MENU COMPONENT */}
                {msg.component === 'menu' && (
                  <div className="mt-3 space-y-4">
                    {Object.entries(menuByCategory).map(([category, items]) => (
                      <div key={category}>
                        <p className="text-xs uppercase tracking-wider text-[#d4af37] font-medium mb-2">{category}</p>
                        <div className="space-y-1.5">
                          {items.map(item => {
                            const inCart = cart.find(c => c.id === item.id);
                            return (
                              <div key={item.id} className="menu-item" onClick={() => !orderPlaced && addToCart(item)}>
                                <div className="menu-item-name">
                                  <span>{item.name}</span>
                                  {inCart && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#d4af37]/20 text-[#d4af37]">x{inCart.quantity}</span>
                                  )}
                                </div>
                                <span className="menu-item-price">${Number(item.price).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CART COMPONENT */}
                {msg.component === 'cart' && (
                  <div className="mt-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-[#0a0a0a] rounded-xl mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} className="qty-btn w-7 h-7 text-sm rounded-lg">-</button>
                          <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                          <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} className="qty-btn w-7 h-7 text-sm rounded-lg">+</button>
                          <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} className="ml-1 p-1 text-red-400 hover:text-red-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-[#d4af37]/20 mt-3 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Subtotal</span>
                        <span className="text-lg font-bold gold-text">${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TIPS COMPONENT */}
                {msg.component === 'tips' && !orderPlaced && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 18, 20, 25].map(pct => {
                        const val = Math.round(cartTotal * pct) / 100;
                        return (
                          <button key={pct} onClick={() => handleSelectTip(pct)}
                            className={`p-3 rounded-xl text-center transition-all ${selectedTip === val ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] border border-[#d4af37]/20 hover:border-[#d4af37]/50'}`}>
                            <span className="text-sm font-bold block">{pct}%</span>
                            <span className="text-[10px] opacity-70">${val.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37] text-sm font-semibold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.50"
                          value={customTip}
                          onChange={e => { setCustomTip(e.target.value); setSelectedTip(null); }}
                          placeholder="Custom"
                          className="luxury-input py-3 pl-7 text-sm"
                        />
                      </div>
                      <button onClick={handleCustomTipSubmit} className="luxury-btn px-4 text-sm">Set</button>
                    </div>
                    <button onClick={() => handleSelectTip(0)} className="w-full py-2.5 rounded-xl bg-[#1a1a1a] border border-gray-700 text-gray-400 text-sm hover:border-gray-600 transition-colors">
                      No tip this time
                    </button>
                  </div>
                )}

                {/* PAYMENT CHOICE */}
                {msg.component === 'payment-choice' && !orderPlaced && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-[#0a0a0a] rounded-xl mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      {tipAmount > 0 && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-400">Tip</span>
                          <span className="text-green-400">${tipAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-800">
                        <span className="font-semibold">Total</span>
                        <span className="text-lg font-bold gold-text">${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => handlePaymentChoice('pay_later')}
                      className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-[#d4af37]/20 text-left hover:border-[#d4af37]/50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pay at counter</p>
                          <p className="text-[11px] text-gray-500">Cash or card to the manager</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handlePaymentChoice('pay_now')}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-[#d4af37]/10 to-transparent border border-[#d4af37]/30 text-left hover:border-[#d4af37]/60 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pay now</p>
                          <p className="text-[11px] text-gray-500">Quick payment via app</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* RECEIPT COMPONENT */}
                {msg.component === 'receipt' && msg.data && (
                  <div className="mt-3">
                    <div className="bg-[#0a0a0a] border border-[#d4af37]/30 rounded-xl p-4">
                      <div className="text-center mb-3 pb-3 border-b border-dashed border-[#d4af37]/20">
                        <p className="text-xs uppercase tracking-widest text-gray-500">Order Confirmation</p>
                        <p className="text-lg font-bold gold-text mt-1">{msg.data.orderId}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Table {msg.data.tableNumber}</p>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {msg.data.items.map((item: OrderItem, i: number) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-300">{item.quantity}x {item.name}</span>
                            <span className="text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-dashed border-[#d4af37]/20 pt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Subtotal</span>
                          <span>${msg.data.subtotal.toFixed(2)}</span>
                        </div>
                        {msg.data.tip > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Tip</span>
                            <span className="text-green-400">${msg.data.tip.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-bold pt-1">
                          <span>Total</span>
                          <span className="gold-text">${msg.data.total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-dashed border-[#d4af37]/20 text-center">
                        <p className="text-[11px] text-gray-500">
                          {msg.data.paymentType === 'chatbot_payment' ? 'Paid via app' : 'Payment: At counter'}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">
                          {new Date(msg.data.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="user-bubble">
                <p>{msg.content}</p>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="message bot-message">
            <div className="bot-bubble">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom Action Area */}
      <div className="shrink-0 border-t border-[#d4af37]/15 bg-[#0d0d0d] safe-bottom">
        {!orderPlaced ? (
          <div className="p-3">
            {/* Quick action chips based on current step */}
            {step === 'welcome' && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                <button onClick={handleShowMenu} className="chip">
                  <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  View Menu
                </button>
                {cart.length > 0 && (
                  <button onClick={handleViewCart} className="chip">
                    <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                    My Order ({cartCount})
                  </button>
                )}
              </div>
            )}

            {step === 'browsing' && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                <button onClick={handleShowMenu} className="chip">
                  <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  Refresh Menu
                </button>
                {cart.length > 0 && (
                  <>
                    <button onClick={handleViewCart} className="chip">
                      <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                      My Order ({cartCount})
                    </button>
                    <button onClick={handlePlaceOrder} className="chip bg-[#d4af37]/10 border-[#d4af37]/40">
                      <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Place Order
                    </button>
                  </>
                )}
              </div>
            )}

            {step === 'cart-review' && cart.length > 0 && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                <button onClick={handleShowMenu} className="chip">
                  <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add More
                </button>
                <button onClick={handlePlaceOrder} className="chip bg-[#d4af37]/10 border-[#d4af37]/40">
                  <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Place Order (${cartTotal.toFixed(2)})
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            <div className="flex gap-2">
              <button onClick={handleStartOver} className="flex-1 luxury-btn text-sm py-3">
                New Order
              </button>
              <a href={`https://wa.me/16562145190?text=Hi, I have a question about my order ${receiptData?.orderId} at Table ${tableNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                <button className="w-full secondary-btn text-sm py-3 border-green-500/30 text-green-400">
                  Contact Staff
                </button>
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your server...</p>
        </div>
      </div>
    }>
      <ChatBotContent />
    </Suspense>
  );
}
