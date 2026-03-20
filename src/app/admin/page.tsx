'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal, formatCurrency } from '@/lib/calculations';
import { getCurrentTheme, type AppTheme } from '@/lib/themes';
import type { Order, MenuItem, RestaurantTable } from '@/lib/types';
import { 
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid3X3, 
  LogOut, Plus, QrCode, Bell, X, Check, ChefHat,
  DollarSign, Clock, Users, Trash2, Edit, Search,
  PhoneCall, Filter, Sparkles, AlertTriangle, TrendingUp
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'tables'>('dashboard');
  const [notifications, setNotifications] = useState<Order[]>([]);
  
  // Tampa timezone clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  
  // Theme
  const [theme, setTheme] = useState<AppTheme>(getCurrentTheme());
  
  // Real-time payment modal updates (separate from the base showPaymentModal value)
  const [realtimePaymentUpdate, setRealtimePaymentUpdate] = useState<Order | null>(null);
  
  // Order filtering
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderTableFilter, setOrderTableFilter] = useState<string>('all');
  
  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  // Derive the displayed payment data: prefer real-time updates, fall back to the modal order
  const paymentModalData = showPaymentModal ? (realtimePaymentUpdate ?? showPaymentModal) : null;
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  
  // Forms
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: '' });
  const [tableNumberInput, setTableNumberInput] = useState('');
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isAddOnOrder = (order: Order) => (order.customer_note || '').includes('ADD_ON_ORDER');
  const isNewOrder = (order: Order) => (order.customer_note || '').includes('NEW_ORDER');

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'https://qr-cod-shop.vercel.app';
  };

  // Auth check - using sessionStorage
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('admin_authenticated');
      if (isLoggedIn !== 'true') { 
        router.push('/admin/login'); 
        return; 
      }
      setIsAuthenticated(true);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  // Tampa timezone clock - updates every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setCurrentDate(now.toLocaleDateString('en-US', options));
      setCurrentTime(now.toLocaleTimeString('en-US', timeOptions));
    };
    
    updateClock(); // Initial call
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

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
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [isAuthenticated, fetchOrders, fetchMenu, fetchTables]);

  // Real-time payment modal updates
  useEffect(() => {
    if (!showPaymentModal) return;

    const paymentSub = supabase
      .channel(`order-payment-${showPaymentModal.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${showPaymentModal.id}`
        },
        (payload: any) => {
          setRealtimePaymentUpdate(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentSub);
      setRealtimePaymentUpdate(null);
    };
  }, [showPaymentModal]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    router.push('/admin/login');
  };

  // Order actions - NO WhatsApp redirect
  const confirmOrder = async (order: Order) => {
    await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('restaurant_tables').update({ status: 'occupied', current_order_id: order.receipt_id }).eq('table_number', order.table_number);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order confirmed!');
  };

  const cancelOrder = async (order: Order) => {
    await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order cancelled', 'error');
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    showToast(`Order marked as ${status}`);
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;
    await supabase.from('orders').update({
      status: 'paid', payment_status: 'paid', payment_method: 'cash',
      payment_type: 'direct_cash'
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
    try {
      if (editMenuItem) {
        const { error } = await supabase.from('menu_items').update(data).eq('id', editMenuItem.id);
        if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
      } else {
        const { error } = await supabase.from('menu_items').insert(data);
        if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
      }
      showToast(editMenuItem ? 'Item updated!' : 'Item added!');
      setShowMenuModal(false); setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' });
      fetchMenu(); // Refresh data
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const deleteMenuItem = async (id: number) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Item deleted');
    fetchMenu();
  };

  const toggleAvailability = async (item: MenuItem) => {
    const { error } = await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    fetchMenu();
  };

  // Table actions
  const addTable = async () => {
    const num = parseInt(tableNumberInput);
    if (isNaN(num) || num <= 0) { showToast('Invalid table number', 'error'); return; }
    try {
      const { error } = await supabase.from('restaurant_tables').insert({ table_number: num, status: 'available' });
      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          showToast('Table already exists', 'error');
        } else {
          showToast(`Error: ${error.message}`, 'error');
        }
        return;
      }
      showToast('Table added!'); setTableNumberInput(''); setShowAddTableModal(false);
      fetchTables();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const deleteTable = async (id: number) => {
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Table deleted');
    fetchTables();
  };

  const updateTableStatus = async (id: number, status: string) => {
    const { error } = await supabase.from('restaurant_tables').update({ status }).eq('id', id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    fetchTables();
  };

  // Stats
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const activeTables = tables.filter(t => t.status !== 'available').length;
  
  // Estimated wait time based on pending/preparing orders
  const estimatedWaitMinutes = useMemo(() => {
    const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status));
    return Math.max(5, activeOrders.length * 8); // ~8 min per active order, min 5
  }, [orders]);

  // Waiter calls derived from orders (avoids redundant setState-in-effect)
  const waiterCalls = useMemo(
    () => orders.filter(o => o.receipt_id?.startsWith('CALL-') && o.status === 'pending'),
    [orders]
  );

  // Filtered orders (excluding waiter calls for the orders list)
  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(o => !o.receipt_id?.startsWith('CALL-'));
    
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === orderStatusFilter);
    }
    if (orderTableFilter !== 'all') {
      filtered = filtered.filter(o => o.table_number.toString() === orderTableFilter);
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      filtered = filtered.filter(o => 
        o.receipt_id?.toLowerCase().includes(q) ||
        o.table_number.toString().includes(q) ||
        o.items?.some(item => item.name.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [orders, orderStatusFilter, orderTableFilter, orderSearch]);

  // Dismiss waiter call
  const dismissWaiterCall = async (call: Order) => {
    await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', call.id);
    showToast('Waiter call acknowledged');
  };

  // Update theme every minute (initial value comes from useState initializer above)
  useEffect(() => {
    const interval = setInterval(() => setTheme(getCurrentTheme()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#f59e0b' }}></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders' },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
    { id: 'tables', icon: Grid3X3, label: 'Tables' },
  ];

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
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

      {/* Waiter Call Alerts */}
      <AnimatePresence>
        {waiterCalls.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed top-20 left-4 z-50 space-y-2 max-w-sm"
          >
            {waiterCalls.map(call => (
              <motion.div 
                key={call.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-4 shadow-2xl border-2 border-white/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center animate-bounce">
                    <PhoneCall className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">🔔 Waiter Needed!</p>
                    <p className="text-white/90 text-lg font-bold">Table {call.table_number}</p>
                    <p className="text-white/60 text-xs">{new Date(call.created_at).toLocaleTimeString()}</p>
                  </div>
                  <button onClick={() => dismissWaiterCall(call)} className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors">
                    ✓ On it
                  </button>
                </div>
              </motion.div>
            ))}
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
            className="fixed top-20 right-4 z-50 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 shadow-2xl max-w-md border-2 border-white/20"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center animate-pulse">
                  <Bell className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                      <p className="font-bold text-white text-lg">🔔 {isAddOnOrder(notifications[0]) ? 'Add-on Order!' : 'New Order!'}</p>
                  <p className="text-sm text-white/80">Table {notifications[0].table_number}</p>
                  <p className="text-xs text-white/60 font-mono">{notifications[0].receipt_id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => cancelOrder(notifications[0])} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-bold">
                  ✕ Cancel
                </button>
                <button onClick={() => confirmOrder(notifications[0])} className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 text-green-600 rounded-lg transition-colors text-sm font-bold">
                  ✓ Confirm
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with horizontal menu */}
      <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            {/* Site Name */}
            <div className="flex-shrink-0">
              <p className="font-bold text-base" style={{ color: theme.primary }}>netrikxr.shop</p>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>

            {/* Tampa Timezone Clock */}
            <div className="hidden md:flex flex-col items-center text-center">
              <p className="text-sm font-medium text-white">{currentDate}</p>
              <p className="text-lg font-bold" style={{ color: theme.primary }}>{currentTime} <span className="text-xs text-gray-400 font-normal">(Tampa, USA)</span></p>
            </div>

            {/* Horizontal Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg text-sm sm:text-base font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                  }`}
                  style={activeTab === tab.id ? { background: `${theme.primary}1a`, color: theme.primary, border: `1px solid ${theme.primary}4d` } : {}}
                >
                  <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === 'orders' && pendingOrders > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">{pendingOrders}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Theme badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${theme.primary}1a`, color: theme.primary, border: `1px solid ${theme.primary}33` }}>
                <Sparkles className="w-3 h-3" />
                {theme.occasion === 'default' ? 'Classic' : theme.name}
              </div>
              {waiterCalls.length > 0 && (
                <div className="relative">
                  <PhoneCall className="w-5 h-5 text-orange-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">{waiterCalls.length}</span>
                </div>
              )}
              <button onClick={() => setShowQRModal(true)} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-gray-400 hover:text-white transition-colors">
                <QrCode className="w-5 h-5" />
                <span className="hidden lg:inline text-sm">QR Codes</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-gray-400 hover:text-white transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="hidden lg:inline text-sm">Log Out</span>
              </button>
              <div className="px-3 py-1 text-black text-sm font-medium rounded-full" style={{ background: theme.primary }}>
                Admin
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Mobile Clock & Theme - Only shows on small screens */}
            <div className="md:hidden rounded-xl p-4 text-center" style={{ background: `linear-gradient(to right, ${theme.primary}1a, ${theme.primaryDark || theme.primary}1a)`, border: `1px solid ${theme.primary}4d` }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" style={{ color: theme.primary }} />
                <span className="text-xs font-medium" style={{ color: theme.primary }}>{theme.name} Theme</span>
              </div>
              <p className="text-sm font-medium text-white">{currentDate}</p>
              <p className="text-xl font-bold" style={{ color: theme.primary }}>{currentTime}</p>
              <p className="text-xs text-gray-400">(Tampa, USA)</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 border border-zinc-700 hover:border-zinc-600 transition-colors">
                <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center mb-2">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-gray-400 text-xs">Today&apos;s Orders</p>
                <p className="text-xl font-bold">{todayOrders.length}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 border border-zinc-700">
                <div className="w-8 h-8 bg-green-500/20 rounded-md flex items-center justify-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-gray-400 text-xs">Revenue</p>
                <p className="text-xl font-bold text-green-400">${todayRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 border border-zinc-700">
                <div className="w-8 h-8 bg-red-500/20 rounded-md flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-gray-400 text-xs">Pending</p>
                <p className="text-xl font-bold">{pendingOrders}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 border border-zinc-700">
                <div className="w-8 h-8 bg-purple-500/20 rounded-md flex items-center justify-center mb-2">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-gray-400 text-xs">Active Tables</p>
                <p className="text-xl font-bold">{activeTables}/{tables.length}</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 border border-zinc-700">
                <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2" style={{ background: `${theme.primary}33` }}>
                  <Clock className="w-4 h-4" style={{ color: theme.primary }} />
                </div>
                <p className="text-gray-400 text-xs">Est. Wait</p>
                <p className="text-xl font-bold" style={{ color: theme.primary }}>{estimatedWaitMinutes}m</p>
              </div>
            </div>

            {/* Waiter Calls Banner */}
            {waiterCalls.length > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <PhoneCall className="w-5 h-5 text-orange-400 animate-pulse" />
                  <h3 className="font-bold text-orange-400">Active Waiter Calls ({waiterCalls.length})</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {waiterCalls.map(call => (
                    <div key={call.id} className="flex items-center justify-between bg-zinc-900/60 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div>
                        <p className="font-bold text-white">Table {call.table_number}</p>
                        <p className="text-xs text-gray-400">{new Date(call.created_at).toLocaleTimeString()}</p>
                      </div>
                      <button onClick={() => dismissWaiterCall(call)} className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-xs font-medium transition-colors">
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button onClick={() => setShowQRModal(true)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 text-left transition-colors">
                <div className="w-8 h-8 bg-purple-500/20 rounded-md flex items-center justify-center mb-2">
                  <QrCode className="w-4 h-4 text-purple-400" />
                </div>
                <p className="font-medium text-sm">Print QR Codes</p>
                <p className="text-xs text-gray-500">For all tables</p>
              </button>
              <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-3 text-left transition-colors">
                <div className="w-8 h-8 bg-green-500/20 rounded-md flex items-center justify-center mb-2">
                  <Plus className="w-4 h-4 text-green-400" />
                </div>
                <p className="font-medium text-sm">Add Menu Item</p>
                <p className="text-xs text-gray-500">New product</p>
              </button>
              <button onClick={() => setShowAddTableModal(true)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-3 text-left transition-colors">
                <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center mb-2">
                  <Grid3X3 className="w-4 h-4 text-blue-400" />
                </div>
                <p className="font-medium text-sm">Add Table</p>
                <p className="text-xs text-gray-500">New seating</p>
              </button>
              <button onClick={() => setActiveTab('orders')} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-3 text-left transition-colors">
                <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2" style={{ background: `${theme.primary}33` }}>
                  <ShoppingBag className="w-4 h-4" style={{ color: theme.primary }} />
                </div>
                <p className="font-medium text-sm">View Orders</p>
                <p className="text-xs text-gray-500">Manage orders</p>
              </button>
            </div>

            {/* Recent Orders & Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Orders */}
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <h2 className="text-base font-semibold mb-3">Recent Orders</h2>
                {orders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No orders yet</p>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 5).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                        <div>
                          <p className="font-medium" style={{ color: theme.primary }}>{order.receipt_id}</p>
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
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <h2 className="text-base font-semibold mb-3">Tables</h2>
                {tables.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No tables configured</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {tables.map(table => (
                      <div key={table.id} className={`aspect-square rounded-md flex flex-col items-center justify-center text-center p-2 ${
                        table.status === 'available' ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' :
                        table.status === 'occupied' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
                        'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                      }`}
                      style={table.status !== 'available' && table.status !== 'occupied' ? { background: `${theme.primary}1a`, borderColor: `${theme.primary}4d`, color: theme.primary } : {}}>
                        <span className="text-xl font-bold">{table.table_number}</span>
                        <span className="text-xs capitalize">{table.status}</span>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h1 className="text-xl font-bold">Orders</h1>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Est. wait:</span>
                <span className="font-bold" style={{ color: theme.primary }}>{estimatedWaitMinutes} min</span>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
              <select  
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="served">Served</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={orderTableFilter}
                onChange={(e) => setOrderTableFilter(e.target.value)}
                className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none"
              >
                <option value="all">All Tables</option>
                {tables.map(t => (
                  <option key={t.id} value={t.table_number.toString()}>Table {t.table_number}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-gray-500">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found</p>

            {filteredOrders.length === 0 ? (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-10 text-center">
                <ShoppingBag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <motion.div
                    key={order.id}
                    layout
                    className={`rounded-lg p-3 border ${isAddOnOrder(order) ? 'order-addon-card border-amber-500/40' : 'bg-zinc-800 border-zinc-700'}`}
                  >
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
                          {isAddOnOrder(order) && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">ADD-ON</span>
                          )}
                          {isNewOrder(order) && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">NEW</span>
                          )}
                        </div>
                        <p className="text-xl font-bold" style={{ color: theme.primary }}>{order.receipt_id}</p>
                        <p className="text-gray-400">Table {order.table_number} • {new Date(order.created_at).toLocaleString()}</p>
                        {order.customer_note && (
                          <p className="text-xs text-gray-500 mt-1">{order.customer_note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                        {order.tip_amount > 0 && <p className="text-sm text-gray-400">Tip: ${order.tip_amount.toFixed(2)}</p>}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {order.items?.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <>
                          <button onClick={() => confirmOrder(order)} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Check className="w-4 h-4" /> Confirm
                          </button>
                          <button onClick={() => cancelOrder(order)} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <X className="w-4 h-4" /> Cancel
                          </button>
                        </>
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
                        <button onClick={() => setShowPaymentModal(order)} className="px-4 py-2 text-black rounded-lg text-sm font-medium transition-colors" style={{ background: theme.primary }}>
                          Record Cash Payment
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Menu</h1>
              <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="px-4 py-2 text-black rounded-lg font-medium text-sm flex items-center gap-2 transition-colors" style={{ background: theme.primary }}>
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            
            {menuItems.length === 0 ? (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-10 text-center">
                <UtensilsCrossed className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No menu items yet</p>
                <button onClick={() => setShowMenuModal(true)} className="px-5 py-2 text-black rounded-lg font-medium text-sm" style={{ background: theme.primary }}>
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {menuItems.map(item => (
                  <motion.div key={item.id} layout className={`bg-zinc-800 border rounded-lg p-3 ${item.available ? 'border-zinc-700' : 'border-red-700/30 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}33`, color: theme.primary }}>{item.category}</span>
                        <h3 className="text-base font-semibold mt-1">{item.name}</h3>
                      </div>
                      <p className="text-xl font-bold text-green-400">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => toggleAvailability(item)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${item.available ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                        {item.available ? '✓ Available' : '✗ Unavailable'}
                      </button>
                      <button onClick={() => { setEditMenuItem(item); setMenuForm({ name: item.name, price: item.price.toString(), category: item.category }); setShowMenuModal(true); }} className="px-2 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMenuItem(item.id)} className="px-2 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md">
                        <Trash2 className="w-3.5 h-3.5" />
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Tables</h1>
              <button onClick={() => setShowAddTableModal(true)} className="px-4 py-2 text-black rounded-lg font-medium text-sm flex items-center gap-2 transition-colors" style={{ background: theme.primary }}>
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </div>
            
            {tables.length === 0 ? (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-10 text-center">
                <Grid3X3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No tables configured</p>
                <button onClick={() => setShowAddTableModal(true)} className="px-5 py-2 text-black rounded-lg font-medium text-sm" style={{ background: theme.primary }}>
                  Add First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {tables.map(table => (
                  <motion.div key={table.id} layout className={`bg-zinc-800 border rounded-lg p-3 text-center ${
                    table.status === 'available' ? 'border-teal-500/30' :
                    table.status === 'occupied' ? 'border-red-500/30' :
                    'border-amber-500/30'
                  }`}>
                    <div className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center text-xl font-bold mb-2 ${
                      table.status === 'available' ? 'bg-teal-500/10 text-teal-400' :
                      table.status === 'occupied' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {table.table_number}
                    </div>
                    <p className="text-xs text-gray-400 capitalize mb-2">{table.status}</p>
                    {table.current_order_id && <p className="text-xs text-gray-500 mb-2">{table.current_order_id}</p>}
                    <select value={table.status} onChange={(e) => updateTableStatus(table.id, e.target.value)} className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-xs mb-2">
                      <option value="available">Available</option>
                      <option value="booked">Booked</option>
                      <option value="occupied">Occupied</option>
                    </select>
                    <button onClick={() => deleteTable(table.id)} className="w-full px-2 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md text-xs">
                      Remove
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center sticky top-0 bg-zinc-800 rounded-t-2xl">
                <h2 className="text-xl font-bold">Table QR Codes</h2>
                <button onClick={() => setShowQRModal(false)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
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
                  <button onClick={() => window.print()} className="px-6 py-3 text-black rounded-lg font-medium transition-colors" style={{ background: theme.primary }}>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Item Name</label>
                  <input type="text" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none" placeholder="e.g., Margherita Pizza" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price ($)</label>
                  <input type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none" placeholder="12.99" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <input type="text" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none" placeholder="e.g., Cocktails, Beer, Whiskey" list="cat-list" />
                  <datalist id="cat-list">
                    {[...new Set(menuItems.map(i => i.category))].map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <button onClick={saveMenuItem} className="w-full py-3 text-black rounded-lg font-semibold transition-colors" style={{ background: theme.primary }}>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-sm w-full">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Add Table</h2>
                <button onClick={() => setShowAddTableModal(false)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Table Number</label>
                  <input type="number" value={tableNumberInput} onChange={(e) => setTableNumberInput(e.target.value)} className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none" placeholder="e.g., 11" min="1" />
                </div>
                <button onClick={addTable} className="w-full py-3 text-black rounded-lg font-semibold transition-colors" style={{ background: theme.primary }}>
                  Add Table
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal - Cash Only with Real-time Updates */}
      <AnimatePresence>
        {showPaymentModal && paymentModalData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-sm w-full">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Record Cash Payment</h2>
                <button onClick={() => setShowPaymentModal(null)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
                  <p className="text-gray-400 text-sm">Order: {paymentModalData.receipt_id}</p>
                  <p className="text-gray-400 text-sm">Table: {paymentModalData.table_number}</p>
                  <div className="border-t border-zinc-700 pt-3 mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Subtotal:</span>
                      <span className="text-white">${paymentModalData.subtotal.toFixed(2)}</span>
                    </div>
                    {paymentModalData.tip_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Tip:</span>
                        <span className="text-green-400">${paymentModalData.tip_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax (3%):</span>
                      <span className="text-white">${(paymentModalData.tax_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-700">
                      <span className="text-white">Total:</span>
                      <span style={{ color: theme.primary }}>${paymentModalData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}4d` }}>
                  <p className="text-center text-sm" style={{ color: theme.primary }}>💵 Cash payment to manager</p>
                </div>
                <button onClick={handlePayment} className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-colors">
                  Confirm Cash Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
