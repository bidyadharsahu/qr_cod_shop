'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Order {
  receiptId: string;
  table: number;
  items: { name: string; emoji: string; quantity: number; price: number }[];
  total: number;
  status: 'pending' | 'confirmed' | 'paid';
  time: string;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [receiptInput, setReceiptInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<Order | null>(null);
  const [verificationError, setVerificationError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('goldenbar_orders');
    if (saved) {
      setOrders(JSON.parse(saved));
    }
  }, []);

  const saveOrders = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('goldenbar_orders', JSON.stringify(newOrders));
  };

  const verifyReceipt = () => {
    setVerificationError('');
    setVerificationResult(null);
    
    if (!receiptInput.trim()) {
      setVerificationError('Please enter an Order ID');
      return;
    }
    
    const order = orders.find(o => o.receiptId.toUpperCase() === receiptInput.toUpperCase());
    
    if (order) {
      setVerificationResult(order);
    } else {
      setVerificationError(`No order found with ID: ${receiptInput}`);
    }
  };

  const markAsPaid = (receiptId: string) => {
    const newOrders = orders.map(o => 
      o.receiptId === receiptId ? { ...o, status: 'paid' as const } : o
    );
    saveOrders(newOrders);
    setVerificationResult(null);
    setReceiptInput('');
  };

  const addTestOrder = () => {
    const menu = [
      { name: "Long Island Iced Tea", price: 11, emoji: "🍹" },
      { name: "Corona Extra", price: 5, emoji: "🍺" },
      { name: "Hennessy Cognac", price: 12, emoji: "🥃" },
      { name: "Patrón Tequila", price: 12, emoji: "🥃" },
    ];
    
    const tableNum = Math.floor(Math.random() * 5) + 1;
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    
    for (let i = 0; i < numItems; i++) {
      const item = menu[Math.floor(Math.random() * menu.length)];
      items.push({ ...item, quantity: Math.floor(Math.random() * 3) + 1 });
    }
    
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const newOrder: Order = {
      receiptId: `GB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      table: tableNum,
      items,
      total,
      status: 'pending',
      time: new Date().toLocaleTimeString()
    };
    
    saveOrders([newOrder, ...orders]);
  };

  const clearAllOrders = () => {
    if (confirm('Clear all orders? This cannot be undone.')) {
      saveOrders([]);
    }
  };

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.total, 0),
    pending: orders.filter(o => o.status === 'pending').length,
    activeTables: new Set(orders.filter(o => o.status !== 'paid').map(o => o.table)).size
  };

  // Get the base URL for QR codes
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  return (
    <main className="min-h-screen min-h-dvh bg-[#0a0a0a]">
      <div className="luxury-bg" />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="glass-card m-0 rounded-none p-4 flex justify-between items-center border-x-0 border-t-0">
          <div className="flex items-center gap-4">
            <Link href="/" className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center">
              <span className="text-lg">🥂</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold gold-text">netrikxr.shop</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono text-[#d4af37]">{currentTime.toLocaleTimeString()}</p>
            <p className="text-xs text-gray-500">{currentTime.toLocaleDateString()}</p>
          </div>
        </header>

        <div className="container mx-auto p-4 max-w-6xl">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Orders', value: stats.total, icon: '📋', color: 'from-[#d4af37] to-[#996515]' },
              { label: 'Revenue', value: `$${stats.revenue}`, icon: '💰', color: 'from-green-600 to-emerald-700' },
              { label: 'Pending', value: stats.pending, icon: '⏳', color: 'from-amber-600 to-orange-700' },
              { label: 'Active Tables', value: stats.activeTables, icon: '🪑', color: 'from-[#d4af37] to-[#b8860b]' },
            ].map((stat, i) => (
              <div key={i} className="gold-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-xl shadow-lg`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Verify Payment */}
          <div className="gold-card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 gold-text">
              <span>🔍</span> Verify Payment
            </h2>
            
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && verifyReceipt()}
                placeholder="Enter Order ID (e.g., GB-ABC123)"
                className="luxury-input flex-1 font-mono"
              />
              <button onClick={verifyReceipt} className="luxury-btn px-6">
                Verify
              </button>
            </div>
            
            {verificationError && (
              <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400">
                ❌ {verificationError}
              </div>
            )}
            
            {verificationResult && (
              <div className="p-4 rounded-xl bg-green-950/50 border border-green-500/30">
                <h3 className="font-semibold text-green-400 mb-3">✅ Order Found!</h3>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <p><span className="text-gray-500">Order ID:</span> <span className="text-[#d4af37] font-mono">{verificationResult.receiptId}</span></p>
                  <p><span className="text-gray-500">Table:</span> #{verificationResult.table}</p>
                  <p><span className="text-gray-500">Time:</span> {verificationResult.time}</p>
                  <p><span className="text-gray-500">Status:</span> <span className={
                    verificationResult.status === 'paid' ? 'text-green-400' : 'text-amber-400'
                  }>{verificationResult.status}</span></p>
                </div>
                <div className="border-t border-[#d4af37]/20 pt-3 mb-3">
                  {verificationResult.items.map((item, i) => (
                    <p key={i} className="text-sm">{item.quantity}x {item.emoji} {item.name} - <span className="text-[#d4af37]">${item.price * item.quantity}</span></p>
                  ))}
                </div>
                <p className="text-xl font-bold gold-text mb-4">Total: ${verificationResult.total}</p>
                
                {verificationResult.status !== 'paid' && (
                  <button 
                    onClick={() => markAsPaid(verificationResult.receiptId)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 font-semibold hover:shadow-lg transition-all"
                  >
                    ✓ Mark as Paid
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Orders & Tables */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Orders List */}
            <div className="md:col-span-2 gold-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold gold-text">📋 Recent Orders</h2>
                <div className="flex gap-2">
                  <button onClick={addTestOrder} className="secondary-btn text-sm py-2 px-4">
                    + Test
                  </button>
                  {orders.length > 0 && (
                    <button onClick={clearAllOrders} className="secondary-btn text-sm py-2 px-4 border-red-500/30 text-red-400">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto hide-scrollbar">
                {orders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders yet. Orders from WhatsApp will appear here.</p>
                ) : (
                  orders.map((order) => (
                    <div 
                      key={order.receiptId}
                      className={`p-4 rounded-xl bg-[#1a1a1a] border-l-4 ${
                        order.status === 'paid' ? 'border-gray-600 opacity-60' :
                        order.status === 'confirmed' ? 'border-green-500' : 'border-[#d4af37]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-mono text-[#d4af37] text-sm">{order.receiptId}</p>
                          <p className="text-xs text-gray-500">{order.time}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 rounded-full text-xs bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium">
                            Table {order.table}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {order.items.map((item, i) => (
                          <span key={i}>{i > 0 && ', '}{item.quantity}x {item.emoji}{item.name}</span>
                        ))}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg gold-text">${order.total}</span>
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          order.status === 'paid' ? 'bg-gray-800 text-gray-400' :
                          order.status === 'confirmed' ? 'bg-green-950 text-green-400' : 
                          'bg-amber-950 text-amber-400'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Table Status & QR Codes */}
            <div className="space-y-6">
              {/* Tables */}
              <div className="gold-card p-6">
                <h2 className="text-xl font-semibold mb-4 gold-text">🪑 Tables</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5].map((table) => {
                    const isActive = orders.some(o => o.table === table && o.status !== 'paid');
                    return (
                      <div 
                        key={table}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                          isActive 
                            ? 'bg-gradient-to-br from-[#d4af37] to-[#996515] shadow-lg shadow-[#d4af37]/30 text-black' 
                            : 'bg-[#1a1a1a] border border-[#d4af37]/20'
                        }`}
                      >
                        <span className="text-2xl font-bold">{table}</span>
                        <span className="text-xs opacity-70">{isActive ? 'Active' : 'Empty'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Actions */}
              <div className="gold-card p-6">
                <h2 className="text-xl font-semibold mb-4 gold-text">⚡ Quick Actions</h2>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowQRModal(true)}
                    className="w-full luxury-btn"
                  >
                    📱 Print QR Codes
                  </button>
                  <Link href="/" className="block w-full">
                    <button className="w-full secondary-btn">
                      🏠 Home Page
                    </button>
                  </Link>
                  <a href="https://wa.me/6562145190" target="_blank" className="block w-full">
                    <button className="w-full secondary-btn border-green-500/30">
                      <span className="text-green-400">📱 WhatsApp</span>
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Codes Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#d4af37]/20">
              <h2 className="text-xl font-semibold text-center gold-text">Print QR Codes for Tables</h2>
              <p className="text-center text-gray-500 text-sm mt-1">Place these on each table</p>
            </div>
            
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
              {[1, 2, 3, 4, 5].map((table) => (
                <div key={table} className="bg-white rounded-xl p-4 text-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table}`)}&bgcolor=ffffff&color=000000`}
                    alt={`Table ${table} QR`}
                    className="mx-auto mb-2"
                  />
                  <p className="text-black font-bold text-lg">Table {table}</p>
                  <p className="text-gray-600 text-xs">Scan to Order</p>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-[#d4af37]/20 flex gap-3">
              <button 
                className="secondary-btn flex-1"
                onClick={() => setShowQRModal(false)}
              >
                Close
              </button>
              <button 
                className="luxury-btn flex-1"
                onClick={() => window.print()}
              >
                🖨️ Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .modal-content, .modal-content * {
            visibility: visible;
          }
          .modal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }
          .modal-overlay {
            background: white !important;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
