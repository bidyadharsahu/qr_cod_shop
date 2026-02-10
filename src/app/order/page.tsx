'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Menu data
const menu = [
  { id: 1, name: "Long Island Iced Tea", price: 11, emoji: "🍹", category: "Cocktails" },
  { id: 2, name: "Lemon Drop Martini", price: 8, emoji: "🍋", category: "Cocktails" },
  { id: 3, name: "Patrón Tequila", price: 12, emoji: "🥃", category: "Premium" },
  { id: 4, name: "Hennessy Cognac", price: 12, emoji: "🥃", category: "Premium" },
  { id: 5, name: "Corona Extra", price: 5, emoji: "🍺", category: "Beer" },
  { id: 6, name: "Bud Light", price: 5, emoji: "🍺", category: "Beer" },
  { id: 7, name: "Crown Royal Apple", price: 9, emoji: "🍎", category: "Whiskey" },
  { id: 8, name: "Smirnoff Vodka", price: 6, emoji: "🍸", category: "Vodka" },
  { id: 9, name: "Budweiser", price: 6, emoji: "🍺", category: "Beer" }
];

const ADMIN_WHATSAPP = "+6562145190";

interface Message {
  id: number;
  type: 'bot' | 'user';
  content: string;
  component?: 'menu' | 'cart' | 'quantity';
}

// Helper function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface OrderItem {
  item: typeof menu[0];
  quantity: number;
}

function OrderContent() {
  const searchParams = useSearchParams();
  const tableNumber = parseInt(searchParams.get('table') || '1');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof menu[0] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const addBotMessage = (content: string, component?: 'menu' | 'cart' | 'quantity') => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'bot',
      content,
      component
    }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'user',
      content
    }]);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Welcome sequence
  useEffect(() => {
    const welcomeSequence = async () => {
      await delay(500);
      addBotMessage(`Welcome to Table ${tableNumber} ✨`);
      await delay(800);
      addBotMessage("I'm your personal concierge. I'll help you discover our finest selections today.");
      await delay(800);
      addBotMessage("What would you like to explore?", 'menu');
    };
    welcomeSequence();
  }, [tableNumber]);

  const handleMenuItemClick = (item: typeof menu[0]) => {
    setSelectedItem(item);
    setQuantity(1);
    setShowQuantityModal(true);
  };

  const handleAddToOrder = () => {
    if (!selectedItem) return;
    
    setOrder(prev => {
      const existing = prev.findIndex(o => o.item.id === selectedItem.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing].quantity += quantity;
        return updated;
      }
      return [...prev, { item: selectedItem, quantity }];
    });
    
    setShowQuantityModal(false);
    addUserMessage(`${quantity}x ${selectedItem.emoji} ${selectedItem.name}`);
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addBotMessage(`Excellent choice! ${quantity}x ${selectedItem.name} added. 🎯`);
      setTimeout(() => {
        addBotMessage("Would you like anything else?", 'menu');
      }, 500);
    }, 600);
    
    setSelectedItem(null);
    setQuantity(1);
  };

  const handleViewCart = () => {
    if (order.length === 0) {
      addUserMessage("View my order");
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage("Your order is empty. Let me show you our selections.", 'menu');
      }, 500);
      return;
    }
    setShowCartModal(true);
  };

  const handleRemoveItem = (itemId: number) => {
    setOrder(prev => prev.filter(o => o.item.id !== itemId));
  };

  const handleUpdateQuantity = (itemId: number, newQty: number) => {
    if (newQty < 1) {
      handleRemoveItem(itemId);
      return;
    }
    setOrder(prev => prev.map(o => 
      o.item.id === itemId ? { ...o, quantity: newQty } : o
    ));
  };

  const generateReceiptId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'GB-';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  };

  const handleCheckout = () => {
    if (order.length === 0) return;
    
    const newReceiptId = generateReceiptId();
    setReceiptId(newReceiptId);
    
    const total = order.reduce((sum, o) => sum + (o.item.price * o.quantity), 0);
    const timestamp = new Date();
    
    // Create WhatsApp message
    let msg = `🥂 *NETRIKXR.SHOP - NEW ORDER*\n\n`;
    msg += `📋 *Order ID:* ${newReceiptId}\n`;
    msg += `🪑 *Table:* ${tableNumber}\n`;
    msg += `📅 *${timestamp.toLocaleDateString()}* at *${timestamp.toLocaleTimeString()}*\n\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `*ORDER DETAILS*\n`;
    msg += `━━━━━━━━━━━━━━━━━\n\n`;
    
    order.forEach(o => {
      msg += `${o.item.emoji} *${o.item.name}*\n`;
      msg += `    ${o.quantity} × $${o.item.price} = *$${o.item.price * o.quantity}*\n\n`;
    });
    
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL: $${total}*\n`;
    msg += `━━━━━━━━━━━━━━━━━\n\n`;
    msg += `✅ Please confirm this order`;
    
    const whatsappURL = `https://wa.me/${ADMIN_WHATSAPP.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    
    setShowCartModal(false);
    window.open(whatsappURL, '_blank');
    
    setShowSuccessModal(true);
    setOrder([]);
  };

  const handleSendMessage = () => {
    const text = input.trim().toLowerCase();
    if (!text) return;
    
    addUserMessage(input);
    setInput('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      
      // Intent detection
      if (text.includes('menu') || text.includes('drink') || text.includes('what') || text.includes('show')) {
        addBotMessage("Here's our premium selection:", 'menu');
      } else if (text.includes('cart') || text.includes('order') || text.includes('checkout') || text.includes('pay')) {
        if (order.length === 0) {
          addBotMessage("Your cart is empty. Let me show you what we have.", 'menu');
        } else {
          setShowCartModal(true);
        }
      } else if (text.includes('help')) {
        addBotMessage("I can help you with:\n• View our menu\n• Add drinks to your order\n• Review your cart\n• Place your order");
        setTimeout(() => addBotMessage("What would you like to do?", 'menu'), 500);
      } else if (text.includes('thank') || text.includes('done')) {
        if (order.length > 0) {
          addBotMessage("Ready to place your order? Tap the cart to checkout.");
        } else {
          addBotMessage("You're welcome! Feel free to browse our menu anytime.", 'menu');
        }
      } else {
        // Try to find a drink match
        const matchedItem = menu.find(item => 
          text.includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().split(' ').some(word => text.includes(word))
        );
        
        if (matchedItem) {
          setSelectedItem(matchedItem);
          setQuantity(1);
          setShowQuantityModal(true);
        } else {
          addBotMessage("I'd love to help! Tap on any drink below to add it to your order.", 'menu');
        }
      }
    }, 600);
  };

  const totalItems = order.reduce((sum, o) => sum + o.quantity, 0);
  const totalPrice = order.reduce((sum, o) => sum + (o.item.price * o.quantity), 0);

  return (
    <div className="chat-container">
      <div className="luxury-bg" />
      
      {/* Header */}
      <header className="relative z-10 glass-card mx-0 rounded-none border-x-0 border-t-0 p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center shadow-lg">
              <span className="text-lg">🥂</span>
            </div>
            <div>
              <h1 className="text-base font-semibold gold-text">netrikxr.shop</h1>
              <p className="text-xs text-gray-500">Table {tableNumber}</p>
            </div>
          </div>
          
          {/* Cart button */}
          <button 
            onClick={handleViewCart}
            className="relative w-11 h-11 rounded-xl bg-[#1a1a1a] border border-[#d4af37]/30 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {totalItems > 0 && (
              <span className="cart-badge">{totalItems}</span>
            )}
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages relative z-10 hide-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type}-message`}>
            {msg.type === 'bot' ? (
              <div className="bot-bubble">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                {/* Menu component */}
                {msg.component === 'menu' && (
                  <div className="mt-4 space-y-2">
                    {menu.map(item => (
                      <div 
                        key={item.id}
                        className="menu-item"
                        onClick={() => handleMenuItemClick(item)}
                      >
                        <div className="menu-item-name">
                          <span className="text-xl">{item.emoji}</span>
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.category}</p>
                          </div>
                        </div>
                        <span className="menu-item-price">${item.price}</span>
                      </div>
                    ))}
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
        {isTyping && (
          <div className="message bot-message">
            <div className="bot-bubble typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="relative z-10 px-4 py-3 flex gap-2 overflow-x-auto hide-scrollbar">
        <button className="chip" onClick={() => { addUserMessage("Show menu"); setIsTyping(true); setTimeout(() => { setIsTyping(false); addBotMessage("Here's our selection:", 'menu'); }, 500); }}>
          📋 Menu
        </button>
        <button className="chip" onClick={handleViewCart}>
          🛒 Cart {totalItems > 0 && `(${totalItems})`}
        </button>
        {order.length > 0 && (
          <button className="chip" onClick={() => setShowCartModal(true)}>
            ✅ Checkout
          </button>
        )}
      </div>

      {/* Input */}
      <div className="relative z-10 p-4 glass-card mx-0 rounded-none border-x-0 border-b-0 safe-bottom">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="luxury-input flex-1"
          />
          <button 
            onClick={handleSendMessage}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center shadow-lg shadow-[#d4af37]/20 active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quantity Modal */}
      {showQuantityModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowQuantityModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {/* Item info */}
              <div className="text-center mb-6">
                <span className="text-5xl mb-3 block">{selectedItem.emoji}</span>
                <h3 className="text-xl font-semibold mb-1">{selectedItem.name}</h3>
                <p className="text-[#d4af37] text-lg font-medium">${selectedItem.price} each</p>
              </div>
              
              {/* Quantity selector */}
              <div className="flex justify-center mb-6">
                <div className="qty-selector">
                  <button 
                    className="qty-btn"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    −
                  </button>
                  <span className="qty-value">{quantity}</span>
                  <button 
                    className="qty-btn"
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Total */}
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold gold-text">${selectedItem.price * quantity}</p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  className="secondary-btn flex-1"
                  onClick={() => setShowQuantityModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="luxury-btn flex-1"
                  onClick={handleAddToOrder}
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCartModal && (
        <div className="modal-overlay" onClick={() => setShowCartModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#d4af37]/20">
              <h2 className="text-xl font-semibold text-center gold-text">Your Order</h2>
              <p className="text-center text-gray-500 text-sm mt-1">Table {tableNumber}</p>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {order.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Your cart is empty</p>
              ) : (
                <div className="space-y-3">
                  {order.map((o) => (
                    <div key={o.item.id} className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-xl">
                      <span className="text-2xl">{o.item.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{o.item.name}</p>
                        <p className="text-[#d4af37] text-sm">${o.item.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          className="w-8 h-8 rounded-lg bg-[#2d2d2d] text-[#d4af37] flex items-center justify-center"
                          onClick={() => handleUpdateQuantity(o.item.id, o.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-medium">{o.quantity}</span>
                        <button 
                          className="w-8 h-8 rounded-lg bg-[#2d2d2d] text-[#d4af37] flex items-center justify-center"
                          onClick={() => handleUpdateQuantity(o.item.id, o.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {order.length > 0 && (
              <div className="p-4 border-t border-[#d4af37]/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold gold-text">${totalPrice}</span>
                </div>
                <button 
                  className="luxury-btn w-full"
                  onClick={handleCheckout}
                >
                  Place Order via WhatsApp
                </button>
                <p className="text-center text-gray-500 text-xs mt-3">
                  Order will be sent to our staff for confirmation
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-8 text-center">
              <div className="success-check mb-6">
                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">Order Sent!</h2>
              <p className="text-gray-400 mb-6">Your order has been sent to our staff</p>
              
              <div className="receipt-id mb-6">
                <p className="text-gray-500 text-xs mb-1">Your Order ID</p>
                <p className="text-xl font-bold gold-text tracking-wider">{receiptId}</p>
              </div>
              
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-gray-400 mb-2">What happens next:</p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[#d4af37]">1.</span>
                    <span>Staff will confirm your order via WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#d4af37]">2.</span>
                    <span>Your drinks will be prepared and served</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#d4af37]">3.</span>
                    <span>Pay at the counter with your Order ID</span>
                  </li>
                </ul>
              </div>
              
              <button 
                className="luxury-btn w-full"
                onClick={() => setShowSuccessModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen min-h-dvh flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce-subtle">🥂</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
