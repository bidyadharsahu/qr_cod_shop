'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { MenuItem, Order, RestaurantTable } from '@/lib/types';
import { 
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid3X3, 
  LogOut, Plus, QrCode, Home, Bell, X, Check, ChefHat,
  DollarSign, Clock, Users, Trash2, Edit, Phone
} from 'lucide-react';

const ADMIN_WHATSAPP = '+16562145190';

type User = { id: string; email?: string };

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'tables'>('dashboard');
  const [notifications, setNotifications] = useState<Order[]>([]);
  
  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  
  // Forms
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: '' });
  const [tableNumberInput, setTableNumberInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'https://qr-cod-shop.vercel.app';
  };

  // Send WhatsApp notification
  const sendWhatsAppNotification = (order: Order, action: string) => {
    const items = order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'N/A';
    const message = encodeURIComponent(
      `🍽️ *${action}*\n\n` +
      `Order: ${order.receipt_id}\n` +
      `Table: ${order.table_number}\n` +
      `Items: ${items}\n` +
      `Total: $${order.total.toFixed(2)}\n` +
      `Status: ${order.status.toUpperCase()}\n` +
      `Payment: ${order.payment_status === 'paid' ? 'PAID' : 'PENDING'}`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${message}`, '_blank');
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      setUser(user);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch functions
  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
  }, []);

  const fetchMenu = useCallback(async () => {
    const { data } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
    if (data) setMenuItems(data as MenuItem[]);
  }, []);

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (data) setTables(data as RestaurantTable[]);
  }, []);

  // Initial fetch & realtime
  useEffect(() => {
    if (!user) return;
    fetchOrders(); fetchMenu(); fetchTables();

    const ordersSub = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order;
          setNotifications(prev => [newOrder, ...prev]);
          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsffK3O5cR1Gga9zvPwm1IAAKrJ7fSxZgkAlbTY5rF6IwB4o9Lss3okAHGb0vK9gSwAYJHQ87WHLgBVitLyuYYsAFGF0fXAhhYAAI/W//bPZQAAoNz/+M1WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
          audio.play().catch(() => {});
          setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newOrder.id)), 30000);
        }
      }).subscribe();

    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu()).subscribe();
    const tablesSub = supabase.channel('tables-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchTables()).subscribe();

    return () => {
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(menuSub);
      supabase.removeChannel(tablesSub);
    };
  }, [user, fetchOrders, fetchMenu, fetchTables]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Order actions
  const confirmOrder = async (order: Order) => {
    await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('restaurant_tables').update({ status: 'occupied', current_order_id: order.receipt_id }).eq('table_number', order.table_number);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order confirmed!');
    sendWhatsAppNotification({ ...order, status: 'confirmed' }, 'Order Confirmed');
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    showToast(`Order marked as ${status}`);
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    await supabase.from('orders').update({
      status: 'paid', payment_status: 'paid', payment_method: paymentMethod,
      payment_type: paymentMethod === 'cash' ? 'direct_cash' : 'chatbot_payment'
    }).eq('id', showPaymentModal.id);
    await supabase.from('restaurant_tables').update({ status: 'available', current_order_id: null }).eq('table_number', showPaymentModal.table_number);
    showToast('Payment recorded!');
    setShowPaymentModal(null);
  };

  // Menu actions
  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !menuForm.category) {
      showToast('Please fill all fields', 'error'); return;
    }
    const data = { name: menuForm.name.trim(), price: parseFloat(menuForm.price), category: menuForm.category.trim(), available: true };
    if (editMenuItem) {
      await supabase.from('menu_items').update(data).eq('id', editMenuItem.id);
    } else {
      await supabase.from('menu_items').insert(data);
    }
    showToast(editMenuItem ? 'Item updated!' : 'Item added!');
    setShowMenuModal(false); setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' });
  };

  const deleteMenuItem = async (id: number) => {
    await supabase.from('menu_items').delete().eq('id', id);
    showToast('Item deleted');
  };

  const toggleAvailability = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id);
  };

  // Table actions
  const addTable = async () => {
    const num = parseInt(tableNumberInput);
    if (isNaN(num) || num <= 0) { showToast('Invalid table number', 'error'); return; }
    const { error } = await supabase.from('restaurant_tables').insert({ table_number: num, status: 'available' });
    if (error?.message.includes('duplicate')) { showToast('Table already exists', 'error'); return; }
    showToast('Table added!'); setTableNumberInput(''); setShowAddTableModal(false);
  };

  const deleteTable = async (id: number) => {
    await supabase.from('restaurant_tables').delete().eq('id', id);
    showToast('Table deleted');
  };

  const updateTableStatus = async (id: number, status: string) => {
    await supabase.from('restaurant_tables').update({ status }).eq('id', id);
  };

  // Stats
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const activeTables = tables.filter(t => t.status !== 'available').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const sidebarItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders', badge: pendingOrders },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
    { id: 'tables', icon: Grid3X3, label: 'Tables' },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-4 left-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Order Notification */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 shadow-2xl max-w-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-black">New Order!</p>
                <p className="text-sm text-black/70">Table {notifications[0].table_number} • {notifications[0].receipt_id}</p>
              </div>
              <button onClick={() => confirmOrder(notifications[0])} className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium">
                Confirm
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-zinc-900/90 to-black/90 backdrop-blur-xl border-r border-amber-700/20 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-amber-700/20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-black">N</span>
            </div>
            <div>
              <p className="font-bold text-amber-400">netrikxr.shop</p>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-400 border border-amber-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="p-4 border-t border-amber-700/20 space-y-2">
          <button onClick={() => setShowQRModal(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/20 transition-colors">
            <QrCode className="w-5 h-5" />
            <span>QR Codes</span>
          </button>
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 transition-colors">
            <Home className="w-5 h-5" />
            <span>View Site</span>
          </Link>
        </div>

        {/* User */}
        <div className="p-4 border-t border-amber-700/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <span className="text-amber-400 font-bold">{user?.email?.[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Today's Orders", value: todayOrders.length, icon: ShoppingBag, color: 'amber' },
                  { label: "Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: DollarSign, color: 'green' },
                  { label: "Pending", value: pendingOrders, icon: Clock, color: 'red' },
                  { label: "Active Tables", value: `${activeTables}/${tables.length}`, icon: Users, color: 'blue' },
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`bg-gradient-to-br from-${stat.color}-500/10 to-black/50 backdrop-blur-xl border border-${stat.color}-500/20 rounded-2xl p-6`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
                    </div>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => setShowQRModal(true)} className="bg-gradient-to-br from-purple-500/10 to-purple-900/20 border border-purple-500/30 rounded-2xl p-4 text-left hover:border-purple-400/50 transition-colors">
                  <QrCode className="w-8 h-8 text-purple-400 mb-2" />
                  <p className="font-medium">Print QR Codes</p>
                  <p className="text-xs text-gray-500">For all tables</p>
                </button>
                <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="bg-gradient-to-br from-green-500/10 to-green-900/20 border border-green-500/30 rounded-2xl p-4 text-left hover:border-green-400/50 transition-colors">
                  <Plus className="w-8 h-8 text-green-400 mb-2" />
                  <p className="font-medium">Add Menu Item</p>
                  <p className="text-xs text-gray-500">New product</p>
                </button>
                <button onClick={() => setShowAddTableModal(true)} className="bg-gradient-to-br from-blue-500/10 to-blue-900/20 border border-blue-500/30 rounded-2xl p-4 text-left hover:border-blue-400/50 transition-colors">
                  <Grid3X3 className="w-8 h-8 text-blue-400 mb-2" />
                  <p className="font-medium">Add Table</p>
                  <p className="text-xs text-gray-500">New seating</p>
                </button>
                <a href={`https://wa.me/${ADMIN_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 text-left hover:border-emerald-400/50 transition-colors">
                  <Phone className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-xs text-gray-500">Open chat</p>
                </a>
              </div>

              {/* Recent Orders & Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                    Recent Orders
                  </h2>
                  {orders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No orders yet</p>
                  ) : (
                    <div className="space-y-3">
                      {orders.slice(0, 5).map(order => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                          <div>
                            <p className="font-medium text-amber-400">{order.receipt_id}</p>
                            <p className="text-xs text-gray-500">Table {order.table_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${order.total.toFixed(2)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{order.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tables Overview */}
                <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5 text-amber-400" />
                    Tables
                  </h2>
                  {tables.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tables configured</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {tables.map(table => (
                        <div key={table.id} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-center ${
                          table.status === 'available' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
                          table.status === 'occupied' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
                          'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                        }`}>
                          <span className="text-lg font-bold">{table.table_number}</span>
                          <span className="text-[10px] opacity-70">{table.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h1 className="text-2xl font-bold">Orders</h1>
              {orders.length === 0 ? (
                <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-12 text-center">
                  <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <motion.div key={order.id} layout className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                              order.status === 'preparing' ? 'bg-purple-500/20 text-purple-400' :
                              order.status === 'served' ? 'bg-cyan-500/20 text-cyan-400' :
                              order.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>{order.status.toUpperCase()}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>{order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}</span>
                            {order.payment_type && (
                              <span className="px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
                                {order.payment_type === 'direct_cash' ? '💵 Cash' : '💳 Online'}
                              </span>
                            )}
                          </div>
                          <p className="text-xl font-bold text-amber-400">{order.receipt_id}</p>
                          <p className="text-gray-400">Table {order.table_number} • {new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                          {order.tip_amount > 0 && <p className="text-sm text-gray-400">Tip: ${order.tip_amount.toFixed(2)}</p>}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {order.items?.map((item, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <button onClick={() => confirmOrder(order)} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Check className="w-4 h-4" /> Confirm
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <ChefHat className="w-4 h-4" /> Preparing
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateOrderStatus(order.id, 'served')} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors">
                            Served
                          </button>
                        )}
                        {order.payment_status !== 'paid' && order.status !== 'pending' && (
                          <button onClick={() => setShowPaymentModal(order)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium transition-colors">
                            Record Payment
                          </button>
                        )}
                        <button onClick={() => sendWhatsAppNotification(order, 'Order Update')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                          <Phone className="w-4 h-4" /> WhatsApp
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Menu Tab */}
          {activeTab === 'menu' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Menu</h1>
                <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <Plus className="w-5 h-5" /> Add Item
                </button>
              </div>
              
              {menuItems.length === 0 ? (
                <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-12 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No menu items yet</p>
                  <button onClick={() => setShowMenuModal(true)} className="px-6 py-3 bg-amber-500 text-black rounded-xl font-medium">
                    Add First Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menuItems.map(item => (
                    <motion.div key={item.id} layout className={`bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border rounded-2xl p-5 ${item.available ? 'border-amber-700/20' : 'border-red-700/30 opacity-60'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">{item.category}</span>
                          <h3 className="text-lg font-semibold mt-2">{item.name}</h3>
                        </div>
                        <p className="text-2xl font-bold text-green-400">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => toggleAvailability(item)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${item.available ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                          {item.available ? '✓ Available' : '✗ Unavailable'}
                        </button>
                        <button onClick={() => { setEditMenuItem(item); setMenuForm({ name: item.name, price: item.price.toString(), category: item.category }); setShowMenuModal(true); }} className="px-3 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMenuItem(item.id)} className="px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Tables</h1>
                <button onClick={() => setShowAddTableModal(true)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <Plus className="w-5 h-5" /> Add Table
                </button>
              </div>
              
              {tables.length === 0 ? (
                <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-12 text-center">
                  <Grid3X3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No tables configured</p>
                  <button onClick={() => setShowAddTableModal(true)} className="px-6 py-3 bg-amber-500 text-black rounded-xl font-medium">
                    Add First Table
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {tables.map(table => (
                    <motion.div key={table.id} layout className={`bg-gradient-to-br from-zinc-900/50 to-black/50 backdrop-blur-xl border rounded-2xl p-5 text-center ${
                      table.status === 'available' ? 'border-green-500/30' :
                      table.status === 'occupied' ? 'border-red-500/30' :
                      'border-amber-500/30'
                    }`}>
                      <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl font-bold mb-3 ${
                        table.status === 'available' ? 'bg-green-500/10 text-green-400' :
                        table.status === 'occupied' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {table.table_number}
                      </div>
                      <p className="text-sm text-gray-400 capitalize mb-3">{table.status}</p>
                      {table.current_order_id && <p className="text-xs text-gray-500 mb-3">{table.current_order_id}</p>}
                      <select value={table.status} onChange={(e) => updateTableStatus(table.id, e.target.value)} className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm mb-2">
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="occupied">Occupied</option>
                      </select>
                      <button onClick={() => deleteTable(table.id)} className="w-full px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm">
                        Remove
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-zinc-900 to-black border border-amber-700/30 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center sticky top-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl">
                <h2 className="text-xl font-bold">Table QR Codes</h2>
                <button onClick={() => setShowQRModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {tables.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No tables configured. Add tables first!</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {tables.map(table => (
                      <div key={table.id} className="bg-white rounded-2xl p-4 text-center">
                        <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table.table_number}`)}`} alt={`Table ${table.table_number}`} width={200} height={200} className="mx-auto" />
                        <p className="mt-3 font-bold text-black text-xl">Table {table.table_number}</p>
                        <p className="text-xs text-gray-500">Scan to order</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <button onClick={() => window.print()} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl font-medium transition-colors">
                    🖨️ Print All QR Codes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenuModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-zinc-900 to-black border border-amber-700/30 rounded-3xl max-w-md w-full">
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Item Name</label>
                  <input type="text" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full px-4 py-3 bg-black/50 border border-amber-700/30 rounded-xl focus:border-amber-500/50 focus:outline-none" placeholder="e.g., Margherita Pizza" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price ($)</label>
                  <input type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} className="w-full px-4 py-3 bg-black/50 border border-amber-700/30 rounded-xl focus:border-amber-500/50 focus:outline-none" placeholder="12.99" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <input type="text" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} className="w-full px-4 py-3 bg-black/50 border border-amber-700/30 rounded-xl focus:border-amber-500/50 focus:outline-none" placeholder="e.g., Appetizers, Drinks, Main Course" list="cat-list" />
                  <datalist id="cat-list">
                    {[...new Set(menuItems.map(i => i.category))].map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <button onClick={saveMenuItem} className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  {editMenuItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Table Modal */}
      <AnimatePresence>
        {showAddTableModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-zinc-900 to-black border border-amber-700/30 rounded-3xl max-w-sm w-full">
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold">Add Table</h2>
                <button onClick={() => setShowAddTableModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Table Number</label>
                  <input type="number" value={tableNumberInput} onChange={(e) => setTableNumberInput(e.target.value)} className="w-full px-4 py-3 bg-black/50 border border-amber-700/30 rounded-xl focus:border-amber-500/50 focus:outline-none" placeholder="e.g., 11" min="1" />
                </div>
                <button onClick={addTable} className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Add Table
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-zinc-900 to-black border border-amber-700/30 rounded-3xl max-w-sm w-full">
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold">Record Payment</h2>
                <button onClick={() => setShowPaymentModal(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-black/30 rounded-xl p-4">
                  <p className="text-gray-400">Order: {showPaymentModal.receipt_id}</p>
                  <p className="text-3xl font-bold text-green-400">${showPaymentModal.total.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPaymentMethod('cash')} className={`py-3 rounded-xl font-medium ${paymentMethod === 'cash' ? 'bg-amber-500 text-black' : 'bg-black/30 border border-white/10'}`}>💵 Cash</button>
                    <button onClick={() => setPaymentMethod('online')} className={`py-3 rounded-xl font-medium ${paymentMethod === 'online' ? 'bg-amber-500 text-black' : 'bg-black/30 border border-white/10'}`}>💳 Online</button>
                  </div>
                </div>
                <button onClick={handlePayment} className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-xl font-semibold transition-colors">
                  Confirm Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
