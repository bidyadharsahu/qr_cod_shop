'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import type { MenuItem, Order, RestaurantTable } from '@/lib/types';
import { 
  LogOut, Home, Bell, QrCode, Plus, Armchair, ShoppingBag, 
  Menu as MenuIcon, LayoutGrid, DollarSign, Clock, TrendingUp,
  Check, ChefHat, UtensilsCrossed, CreditCard, Eye, EyeOff, Trash2, Edit,
  X, Printer, Phone
} from 'lucide-react';

type User = { id: string; email?: string };

// WhatsApp Admin Number
const ADMIN_WHATSAPP = '+16562145190';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'tables'>('orders');
  const [notifications, setNotifications] = useState<Order[]>([]);
  
  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
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

  // Get base URL for QR codes
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://qr-cod-shop.vercel.app';
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }
      setUser(user);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch functions
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as Order[]);
  }, []);

  const fetchMenu = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true });
    if (!error && data) setMenuItems(data as MenuItem[]);
  }, []);

  const fetchTables = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_number', { ascending: true });
    if (!error && data) setTables(data as RestaurantTable[]);
  }, []);

  // Initial fetch & realtime subscriptions
  useEffect(() => {
    if (!user) return;
    
    fetchOrders();
    fetchMenu();
    fetchTables();

    const ordersSub = supabase.channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order;
          setNotifications(prev => [newOrder, ...prev]);
          setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newOrder.id)), 30000);
        }
      }).subscribe();

    const menuSub = supabase.channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu())
      .subscribe();

    const tablesSub = supabase.channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchTables())
      .subscribe();

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
    const { error } = await supabase
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', order.id);
    
    if (error) {
      showToast('Failed to confirm order: ' + error.message, 'error');
      return;
    }

    await supabase
      .from('restaurant_tables')
      .update({ status: 'occupied', current_order_id: order.receipt_id, updated_at: new Date().toISOString() })
      .eq('table_number', order.table_number);
    
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order confirmed!');
    fetchOrders();
    fetchTables();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (error) {
      showToast('Failed to update status', 'error');
      return;
    }
    showToast(`Order marked as ${status}`);
    fetchOrders();
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'paid',
        payment_method: paymentMethod,
        payment_type: paymentMethod === 'cash' ? 'direct_cash' : 'chatbot_payment',
        updated_at: new Date().toISOString()
      })
      .eq('id', showPaymentModal.id);

    if (error) {
      showToast('Failed to record payment: ' + error.message, 'error');
      return;
    }

    await supabase
      .from('restaurant_tables')
      .update({ status: 'available', current_order_id: null, updated_at: new Date().toISOString() })
      .eq('table_number', showPaymentModal.table_number);

    showToast('Payment recorded!');
    setShowPaymentModal(null);
    fetchOrders();
    fetchTables();
  };

  // Menu actions
  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !menuForm.category) {
      showToast('Please fill all fields', 'error');
      return;
    }

    const itemData = {
      name: menuForm.name.trim(),
      price: parseFloat(menuForm.price),
      category: menuForm.category.trim(),
      available: true,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editMenuItem) {
      ({ error } = await supabase.from('menu_items').update(itemData).eq('id', editMenuItem.id));
    } else {
      ({ error } = await supabase.from('menu_items').insert(itemData));
    }

    if (error) {
      showToast('Failed to save menu item: ' + error.message, 'error');
      return;
    }

    showToast(editMenuItem ? 'Item updated!' : 'Item added!');
    setShowMenuModal(false);
    setEditMenuItem(null);
    setMenuForm({ name: '', price: '', category: '' });
    fetchMenu();
  };

  const deleteMenuItem = async (id: number) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete item', 'error');
      return;
    }
    showToast('Item deleted');
    fetchMenu();
  };

  const toggleAvailability = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id);
    fetchMenu();
  };

  // Table actions
  const addTable = async () => {
    const num = parseInt(tableNumberInput);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid table number', 'error');
      return;
    }
    
    const { error } = await supabase.from('restaurant_tables').insert({ table_number: num, status: 'available' });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        showToast('Table number already exists', 'error');
      } else {
        showToast('Failed to add table: ' + error.message, 'error');
      }
      return;
    }
    
    showToast('Table added!');
    setTableNumberInput('');
    setShowAddTableModal(false);
    fetchTables();
  };

  const deleteTable = async (id: number) => {
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete table', 'error');
      return;
    }
    showToast('Table deleted');
    fetchTables();
  };

  const updateTableStatus = async (id: number, status: string) => {
    await supabase.from('restaurant_tables').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    fetchTables();
  };

  // Stats
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + o.total, 0);
  const activeTables = tables.filter(t => t.status !== 'available').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-amber-950/10 via-black to-amber-900/10 pointer-events-none"></div>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-sm ${
              toast.type === 'success' 
                ? 'bg-green-900/90 border-green-500/30 text-green-100' 
                : 'bg-red-900/90 border-red-500/30 text-red-100'
            }`}
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
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-600 to-amber-500 text-black px-6 py-4 rounded-2xl shadow-2xl max-w-md border border-amber-400/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">New Order!</p>
                <p className="text-sm opacity-80">Table {notifications[0].table_number} • {notifications[0].receipt_id}</p>
              </div>
              <button 
                onClick={() => confirmOrder(notifications[0])}
                className="px-5 py-2.5 bg-black text-amber-400 rounded-xl hover:bg-gray-900 transition-colors font-medium"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-40 bg-black/80 backdrop-blur-xl border-b border-amber-700/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-xl font-bold text-black">N</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">Admin Dashboard</span>
                <p className="text-xs text-gray-500">netrikxr.shop</p>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* WhatsApp Contact */}
              <a 
                href={`https://wa.me/${ADMIN_WHATSAPP.replace(/\+/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-600/30 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">{ADMIN_WHATSAPP}</span>
              </a>
              
              <span className="text-gray-400 text-sm hidden md:block">{user?.email}</span>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {[
            { label: "Today's Orders", value: todayOrders.length, icon: ShoppingBag, color: 'from-blue-500 to-blue-600' },
            { label: "Today's Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: DollarSign, color: 'from-green-500 to-green-600' },
            { label: 'Pending Orders', value: pendingOrders, icon: Clock, color: 'from-amber-500 to-amber-600' },
            { label: 'Active Tables', value: `${activeTables}/${tables.length}`, icon: TrendingUp, color: 'from-purple-500 to-purple-600' },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-4 sm:p-6 border border-amber-700/20 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mb-1">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Print QR Codes', icon: QrCode, color: 'from-purple-600 to-purple-800', onClick: () => setShowQRModal(true) },
            { label: 'Add Menu Item', icon: Plus, color: 'from-green-600 to-green-800', onClick: () => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); } },
            { label: 'Add Table', icon: Armchair, color: 'from-blue-600 to-blue-800', onClick: () => setShowAddTableModal(true) },
            { label: 'View Site', icon: Home, color: 'from-amber-600 to-amber-800', href: '/' },
          ].map((action, idx) => (
            action.href ? (
              <Link key={action.label} href={action.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className={`bg-gradient-to-br ${action.color} rounded-xl p-4 sm:p-5 hover:opacity-90 transition-opacity cursor-pointer`}
                >
                  <action.icon className="w-6 h-6 sm:w-7 sm:h-7 mb-2 sm:mb-3" />
                  <p className="font-semibold text-sm sm:text-base">{action.label}</p>
                </motion.div>
              </Link>
            ) : (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                onClick={action.onClick}
                className={`bg-gradient-to-br ${action.color} rounded-xl p-4 sm:p-5 hover:opacity-90 transition-opacity text-left`}
              >
                <action.icon className="w-6 h-6 sm:w-7 sm:h-7 mb-2 sm:mb-3" />
                <p className="font-semibold text-sm sm:text-base">{action.label}</p>
              </motion.button>
            )
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-6 border-b border-amber-700/30 overflow-x-auto pb-px">
          {[
            { id: 'orders', label: 'Orders', icon: ShoppingBag, count: pendingOrders },
            { id: 'menu', label: 'Menu', icon: MenuIcon },
            { id: 'tables', label: 'Tables', icon: LayoutGrid },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'orders' | 'menu' | 'tables')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium capitalize transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-amber-400 border-b-2 border-amber-400 -mb-px' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-12 text-center border border-amber-700/20">
                <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No orders yet</p>
              </div>
            ) : (
              orders.map((order, idx) => (
                <motion.div 
                  key={order.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-4 sm:p-6 border border-amber-700/20 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          order.status === 'preparing' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          order.status === 'served' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {order.status.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.payment_status === 'paid' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                        </span>
                        {order.payment_type && (
                          <span className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-gray-300 border border-zinc-700">
                            {order.payment_type === 'direct_cash' ? '💵 Cash' : '💳 Online'}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-amber-100">{order.receipt_id}</p>
                      <p className="text-gray-400">Table {order.table_number}</p>
                      <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    
                    {/* Total */}
                    <div className="text-left lg:text-right">
                      <p className="text-2xl sm:text-3xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                      <p className="text-sm text-gray-400">{order.items?.length || 0} items</p>
                    </div>
                  </div>
                  
                  {/* Items */}
                  <div className="mt-4 pt-4 border-t border-amber-700/20">
                    <p className="text-sm text-gray-400 mb-2">Items:</p>
                    <div className="flex flex-wrap gap-2">
                      {order.items?.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-gray-200 border border-zinc-700">
                          {item.quantity}× {item.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-amber-700/20 flex flex-wrap gap-2">
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => confirmOrder(order)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium transition-colors"
                      >
                        <Check className="w-4 h-4" /> Confirm
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium transition-colors"
                      >
                        <ChefHat className="w-4 h-4" /> Preparing
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium transition-colors"
                      >
                        <UtensilsCrossed className="w-4 h-4" /> Served
                      </button>
                    )}
                    {order.payment_status !== 'paid' && order.status !== 'pending' && (
                      <button 
                        onClick={() => setShowPaymentModal(order)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-xl text-sm font-medium transition-colors"
                      >
                        <CreditCard className="w-4 h-4" /> Record Payment
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm font-medium transition-colors"
                    >
                      {selectedOrder?.id === order.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {selectedOrder?.id === order.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-zinc-800/50 rounded-xl border border-amber-700/20 overflow-hidden"
                      >
                        <h4 className="font-semibold mb-3 text-amber-100">Order Details</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[300px]">
                            <thead>
                              <tr className="text-left text-gray-400 text-sm border-b border-zinc-700">
                                <th className="pb-2">Item</th>
                                <th className="pb-2 text-center">Qty</th>
                                <th className="pb-2 text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item, idx) => (
                                <tr key={idx} className="border-b border-zinc-700/50">
                                  <td className="py-2 text-gray-200">{item.name}</td>
                                  <td className="py-2 text-center text-gray-200">{item.quantity}</td>
                                  <td className="py-2 text-right text-gray-200">${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="font-bold text-white">
                                <td className="pt-3" colSpan={2}>Total</td>
                                <td className="pt-3 text-right text-green-400">${order.total.toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {order.customer_note && (
                          <div className="mt-3 p-3 bg-zinc-700/50 rounded-lg">
                            <p className="text-sm text-gray-300"><strong>Note:</strong> {order.customer_note}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div>
            {menuItems.length === 0 ? (
              <div className="bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-12 text-center border border-amber-700/20">
                <MenuIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No menu items yet</p>
                <button 
                  onClick={() => setShowMenuModal(true)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition-colors"
                >
                  Add Your First Item
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-5 border transition-colors ${
                      item.available 
                        ? 'border-amber-700/20 hover:border-amber-500/30' 
                        : 'border-red-800/30 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-gray-300 border border-zinc-700">{item.category}</span>
                        <h3 className="text-lg font-semibold mt-2 text-amber-100">{item.name}</h3>
                      </div>
                      <p className="text-xl font-bold text-green-400">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAvailability(item)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          item.available 
                            ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30' 
                            : 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                        }`}
                      >
                        {item.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {item.available ? 'Available' : 'Unavailable'}
                      </button>
                      <button
                        onClick={() => {
                          setEditMenuItem(item);
                          setMenuForm({ name: item.name, price: item.price.toString(), category: item.category });
                          setShowMenuModal(true);
                        }}
                        className="px-3 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-xl transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMenuItem(item.id)}
                        className="px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div>
            {tables.length === 0 ? (
              <div className="bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-12 text-center border border-amber-700/20">
                <Armchair className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No tables configured</p>
                <button 
                  onClick={() => setShowAddTableModal(true)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition-colors"
                >
                  Add Your First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tables.map((table, idx) => (
                  <motion.div 
                    key={table.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-5 border transition-colors ${
                      table.status === 'available' ? 'border-green-600/30 hover:border-green-500/50' :
                      table.status === 'booked' ? 'border-amber-600/30 hover:border-amber-500/50' :
                      'border-red-600/30 hover:border-red-500/50'
                    }`}
                  >
                    <div className="text-center mb-4">
                      <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl font-bold ${
                        table.status === 'available' ? 'bg-green-600/20 text-green-400' :
                        table.status === 'booked' ? 'bg-amber-600/20 text-amber-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {table.table_number}
                      </div>
                      <p className="text-sm text-gray-400 mt-2 capitalize">{table.status}</p>
                      {table.current_order_id && (
                        <p className="text-xs text-gray-500 mt-1">{table.current_order_id}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <select
                        value={table.status}
                        onChange={(e) => updateTableStatus(table.id, e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="occupied">Occupied</option>
                      </select>
                      <button
                        onClick={() => deleteTable(table.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 rounded-xl text-sm transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-amber-700/30"
            >
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center sticky top-0 bg-zinc-900/95 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-amber-100">Table QR Codes</h2>
                <button onClick={() => setShowQRModal(false)} className="text-gray-400 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                {tables.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No tables configured. Add tables first!</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {tables.map(table => (
                      <div key={table.id} className="bg-white rounded-2xl p-4 text-center">
                        <Image
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table.table_number}`)}`}
                          alt={`Table ${table.table_number} QR`}
                          width={200}
                          height={200}
                          className="mx-auto"
                        />
                        <p className="mt-2 font-bold text-black text-lg">Table {table.table_number}</p>
                        <p className="text-xs text-gray-600">Scan to order</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition-colors"
                  >
                    <Printer className="w-5 h-5" /> Print All QR Codes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Item Modal */}
      <AnimatePresence>
        {showMenuModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl max-w-md w-full border border-amber-700/30"
            >
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold text-amber-100">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="text-gray-400 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white"
                    placeholder="e.g., Margherita Pizza"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white"
                    placeholder="e.g., 12.99"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <input
                    type="text"
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white"
                    placeholder="e.g., Appetizers, Main Course, Drinks"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {[...new Set(menuItems.map(i => i.category))].map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <button
                  onClick={saveMenuItem}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl font-semibold text-black transition-colors"
                >
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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl max-w-sm w-full border border-amber-700/30"
            >
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold text-amber-100">Add Table</h2>
                <button onClick={() => setShowAddTableModal(false)} className="text-gray-400 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Table Number</label>
                  <input
                    type="number"
                    value={tableNumberInput}
                    onChange={(e) => setTableNumberInput(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800 border border-amber-700/30 rounded-xl focus:border-amber-500 focus:outline-none text-white"
                    placeholder="e.g., 11"
                    min="1"
                  />
                </div>
                <button
                  onClick={addTable}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl font-semibold text-black transition-colors"
                >
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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl max-w-sm w-full border border-amber-700/30"
            >
              <div className="p-6 border-b border-amber-700/20 flex justify-between items-center">
                <h2 className="text-xl font-bold text-amber-100">Record Payment</h2>
                <button onClick={() => setShowPaymentModal(null)} className="text-gray-400 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-amber-700/20">
                  <p className="text-gray-400 text-sm">Order: {showPaymentModal.receipt_id}</p>
                  <p className="text-3xl font-bold text-green-400">${showPaymentModal.total.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-3 rounded-xl font-medium transition-colors ${
                        paymentMethod === 'cash' 
                          ? 'bg-amber-600 text-black' 
                          : 'bg-zinc-800 text-white border border-zinc-700 hover:border-amber-500/50'
                      }`}
                    >
                      💵 Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('online')}
                      className={`py-3 rounded-xl font-medium transition-colors ${
                        paymentMethod === 'online' 
                          ? 'bg-amber-600 text-black' 
                          : 'bg-zinc-800 text-white border border-zinc-700 hover:border-amber-500/50'
                      }`}
                    >
                      💳 Online
                    </button>
                  </div>
                </div>
                <button
                  onClick={handlePayment}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-colors"
                >
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
