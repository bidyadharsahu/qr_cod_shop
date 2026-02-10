'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { MenuItem, Order, RestaurantTable } from '@/lib/types';

type User = { id: string; email?: string };

export default function AdminPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // UI
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');

  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState<Order | null>(null);

  // Forms
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: 'Cocktails' });
  const [paymentForm, setPaymentForm] = useState({ method: 'cash' as string, transactionId: '', paymentType: 'direct_cash' as string });

  // Receipt verification
  const [receiptInput, setReceiptInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<Order | null>(null);
  const [verificationError, setVerificationError] = useState('');

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/admin/login');
      }
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [router]);

  // Data fetching
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

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    fetchMenu();
    fetchTables();

    const ordersSub = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order;
          setNotifications(prev => [newOrder, ...prev]);
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newOrder.id));
          }, 30000);
        }
      }).subscribe();

    const menuSub = supabase.channel('menu-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu())
      .subscribe();

    const tablesSub = supabase.channel('tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchTables())
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(menuSub);
      supabase.removeChannel(tablesSub);
    };
  }, [user, fetchOrders, fetchMenu, fetchTables]);

  // --- Actions ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const confirmOrder = async (order: Order) => {
    await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('restaurant_tables').update({ status: 'booked', current_order_id: order.receipt_id, updated_at: new Date().toISOString() }).eq('table_number', order.table_number);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    fetchOrders();
    fetchTables();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    fetchOrders();
  };

  const handleMarkPaid = async () => {
    if (!showPaymentModal) return;
    await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: paymentForm.method,
      payment_type: paymentForm.paymentType,
      transaction_id: paymentForm.transactionId || null,
      updated_at: new Date().toISOString()
    }).eq('id', showPaymentModal.id);
    await supabase.from('restaurant_tables').update({
      status: 'available',
      current_order_id: null,
      updated_at: new Date().toISOString()
    }).eq('table_number', showPaymentModal.table_number);
    setShowPaymentModal(null);
    setPaymentForm({ method: 'cash', transactionId: '', paymentType: 'direct_cash' });
    fetchOrders();
    fetchTables();
  };

  const releaseTable = async (tableNumber: number) => {
    await supabase.from('restaurant_tables').update({
      status: 'available', current_order_id: null, updated_at: new Date().toISOString()
    }).eq('table_number', tableNumber);
    fetchTables();
  };

  // Menu CRUD
  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price) return;
    const data = { name: menuForm.name, price: parseFloat(menuForm.price), category: menuForm.category, available: true, updated_at: new Date().toISOString() };
    if (editMenuItem) {
      await supabase.from('menu_items').update(data).eq('id', editMenuItem.id);
    } else {
      await supabase.from('menu_items').insert(data);
    }
    setShowMenuModal(false);
    setEditMenuItem(null);
    setMenuForm({ name: '', price: '', category: 'Cocktails' });
    fetchMenu();
  };

  const toggleMenuAvailability = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ available: !item.available, updated_at: new Date().toISOString() }).eq('id', item.id);
    fetchMenu();
  };

  const deleteMenuItem = async (id: number) => {
    if (!confirm('Delete this menu item?')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    fetchMenu();
  };

  const addTable = async () => {
    const maxNum = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) : 0;
    await supabase.from('restaurant_tables').insert({ table_number: maxNum + 1 });
    fetchTables();
  };

  const removeTable = async (id: number) => {
    if (!confirm('Remove this table?')) return;
    await supabase.from('restaurant_tables').delete().eq('id', id);
    fetchTables();
  };

  const verifyReceipt = () => {
    setVerificationError('');
    setVerificationResult(null);
    if (!receiptInput.trim()) { setVerificationError('Enter an Order ID'); return; }
    const order = orders.find(o => o.receipt_id.toUpperCase() === receiptInput.toUpperCase());
    if (order) setVerificationResult(order);
    else setVerificationError(`No order found: ${receiptInput}`);
  };

  // --- Stats ---
  const stats = {
    totalOrders: orders.length,
    revenue: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total), 0),
    pending: orders.filter(o => o.status === 'pending').length,
    activeTables: tables.filter(t => t.status !== 'available').length,
    totalTables: tables.length,
    cashRevenue: orders.filter(o => o.payment_status === 'paid' && o.payment_method === 'cash').reduce((sum, o) => sum + Number(o.total), 0),
    onlineRevenue: orders.filter(o => o.payment_status === 'paid' && (o.payment_method === 'card' || o.payment_method === 'online')).reduce((sum, o) => sum + Number(o.total), 0),
    todayOrders: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    totalTips: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.tip_amount || 0), 0),
  };

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
  const paidOrders = orders.filter(o => o.payment_status === 'paid');

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';

  const categories = ['Cocktails', 'Premium', 'Beer', 'Whiskey', 'Vodka', 'Wine', 'Other'];

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
    { id: 'orders', label: 'Orders', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg> },
    { id: 'menu', label: 'Menu', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg> },
    { id: 'tables', label: 'Tables', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
    { id: 'payments', label: 'Payments', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg> },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] pb-20 md:pb-0">
      <div className="luxury-bg" />
      <div className="relative z-10">
        {/* Header */}
        <header className="glass-card m-0 rounded-none p-3 md:p-4 border-x-0 border-t-0">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <Link href="/" className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </Link>
              <div>
                <h1 className="text-base md:text-xl font-bold gold-text">netrikxr.shop</h1>
                <p className="text-[10px] md:text-xs text-gray-500">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm md:text-lg font-mono text-[#d4af37]">{currentTime.toLocaleTimeString('en-US')}</p>
                <p className="text-[10px] md:text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              {notifications.length > 0 && (
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center animate-pulse">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{notifications.length}</span>
                </div>
              )}
              <button onClick={handleLogout} className="text-gray-500 hover:text-[#d4af37] transition-colors p-2" title="Logout">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              </button>
            </div>
          </div>
        </header>

        {/* Notification Toasts */}
        {notifications.length > 0 && (
          <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
            {notifications.slice(0, 3).map((notif) => (
              <div key={notif.id} className="bg-[#1a1a1a] border border-amber-500/40 rounded-xl p-4 shadow-lg shadow-amber-500/10 animate-slideIn">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">New order - Table {notif.table_number}</p>
                    <p className="text-xs text-gray-400 mt-1">{notif.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                    <p className="text-sm font-semibold text-[#d4af37] mt-1">${Number(notif.total).toFixed(2)}{Number(notif.tip_amount || 0) > 0 && <span className="text-green-400 text-xs ml-1">(tip: ${Number(notif.tip_amount).toFixed(2)})</span>}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => confirmOrder(notif)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">Confirm</button>
                  <button onClick={() => { setShowOrderDetail(notif); setNotifications(prev => prev.filter(n => n.id !== notif.id)); }} className="flex-1 py-2 rounded-lg bg-[#2d2d2d] text-gray-300 text-xs font-medium hover:bg-[#3d3d3d] transition-colors">View</button>
                  <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))} className="py-2 px-3 rounded-lg bg-[#2d2d2d] text-gray-500 text-xs hover:bg-[#3d3d3d] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop Tab Navigation */}
        <nav className="hidden md:flex border-b border-gray-800/50 bg-[#0d0d0d] sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex w-full">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {tab.icon} {tab.label}
                {tab.id === 'orders' && stats.pending > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{stats.pending}</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-3 md:p-6">
          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 md:space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: 'Total Orders', value: stats.totalOrders, sub: `${stats.todayOrders} today`, color: 'from-[#d4af37] to-[#996515]', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg> },
                  { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}`, sub: 'Total earned', color: 'from-green-600 to-emerald-700', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                  { label: 'Pending', value: stats.pending, sub: 'Awaiting confirm', color: 'from-amber-600 to-orange-700', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                  { label: 'Active Tables', value: `${stats.activeTables}/${stats.totalTables}`, sub: 'Currently occupied', color: 'from-[#d4af37] to-[#b8860b]', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" /></svg> },
                ].map((stat, i) => (
                  <div key={i} className="gold-card p-3 md:p-4 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                        {stat.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg md:text-2xl font-bold truncate">{stat.value}</p>
                        <p className="text-[10px] md:text-xs text-gray-500">{stat.label}</p>
                        <p className="text-[10px] text-gray-600 hidden md:block">{stat.sub}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verify Payment */}
              <div className="gold-card p-4 md:p-6 rounded-xl">
                <h2 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2 gold-text">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                  Verify Payment
                </h2>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={receiptInput} onChange={(e) => setReceiptInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && verifyReceipt()} placeholder="Enter Order ID (e.g., NX-ABC123)" className="luxury-input flex-1 font-mono text-sm py-3" />
                  <button onClick={verifyReceipt} className="luxury-btn px-4 md:px-6 text-sm">Verify</button>
                </div>
                {verificationError && <p className="text-red-400 text-sm p-3 bg-red-950/30 rounded-lg border border-red-500/20">{verificationError}</p>}
                {verificationResult && (
                  <div className="p-4 rounded-xl bg-green-950/30 border border-green-500/20">
                    <p className="font-semibold text-green-400 mb-2">Order Found</p>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <p><span className="text-gray-500">ID:</span> <span className="text-[#d4af37] font-mono">{verificationResult.receipt_id}</span></p>
                      <p><span className="text-gray-500">Table:</span> #{verificationResult.table_number}</p>
                      <p><span className="text-gray-500">Status:</span> <span className={verificationResult.payment_status === 'paid' ? 'text-green-400' : 'text-amber-400'}>{verificationResult.status}</span></p>
                      <p><span className="text-gray-500">Payment:</span> <span className={verificationResult.payment_status === 'paid' ? 'text-green-400' : 'text-amber-400'}>{verificationResult.payment_status}</span></p>
                    </div>
                    <div className="border-t border-green-500/10 pt-2">
                      {verificationResult.items?.map((item: any, i: number) => (
                        <p key={i} className="text-sm">{item.quantity}x {item.name} - <span className="text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</span></p>
                      ))}
                    </div>
                    <p className="text-lg font-bold gold-text mt-2">Total: ${Number(verificationResult.total).toFixed(2)}</p>
                    {verificationResult.payment_status !== 'paid' && (
                      <button onClick={() => { setShowPaymentModal(verificationResult); setVerificationResult(null); setReceiptInput(''); }} className="mt-3 w-full py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">Mark as Paid</button>
                    )}
                  </div>
                )}
              </div>

              {/* Orders & Tables Row */}
              <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                {/* Recent Orders */}
                <div className="md:col-span-2 gold-card p-4 md:p-6 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base md:text-lg font-semibold gold-text flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                      Recent Orders
                    </h2>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto hide-scrollbar">
                    {orders.length === 0 ? (
                      <p className="text-center text-gray-500 py-8 text-sm">No orders yet. Orders from customers will appear here in real-time.</p>
                    ) : orders.slice(0, 8).map((order) => (
                      <div key={order.id} className={`p-3 rounded-xl bg-[#1a1a1a] border-l-4 cursor-pointer hover:bg-[#1e1e1e] transition-colors ${order.status === 'paid' ? 'border-gray-600 opacity-60' : order.status === 'confirmed' ? 'border-green-500' : order.status === 'pending' ? 'border-[#d4af37]' : 'border-blue-500'}`} onClick={() => setShowOrderDetail(order)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono text-[#d4af37] text-xs">{order.receipt_id}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37] font-medium">Table {order.table_number}</span>
                            <p className="font-semibold text-sm gold-text mt-1">${Number(order.total).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-gray-500">{new Date(order.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${order.status === 'paid' ? 'bg-gray-800 text-gray-400' : order.status === 'confirmed' ? 'bg-green-900/50 text-green-400' : order.status === 'pending' ? 'bg-amber-900/50 text-amber-400' : 'bg-blue-900/50 text-blue-400'}`}>{order.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tables & Quick Actions */}
                <div className="space-y-4">
                  <div className="gold-card p-4 md:p-6 rounded-xl">
                    <h2 className="text-base md:text-lg font-semibold mb-3 gold-text flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg>
                      Tables
                    </h2>
                    <div className="grid grid-cols-5 gap-2">
                      {tables.map((table) => (
                        <div key={table.id} className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all text-center ${table.status !== 'available' ? 'bg-gradient-to-br from-[#d4af37] to-[#996515] shadow-lg shadow-[#d4af37]/20 text-black' : 'bg-[#1a1a1a] border border-[#d4af37]/15'}`}>
                          <span className="text-lg font-bold">{table.table_number}</span>
                          <span className="text-[8px] opacity-70">{table.status === 'available' ? 'Open' : 'Booked'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="gold-card p-4 md:p-6 rounded-xl">
                    <h2 className="text-base md:text-lg font-semibold mb-3 gold-text flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                      Quick Actions
                    </h2>
                    <div className="space-y-2">
                      <button onClick={() => setShowQRModal(true)} className="w-full luxury-btn text-sm py-3 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-2.25 0h.008v.008H16.5V12z" /></svg>
                        Print QR Codes
                      </button>
                      <Link href="/" className="block w-full">
                        <button className="w-full secondary-btn text-sm py-3 flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                          Home Page
                        </button>
                      </Link>
                      <a href="https://wa.me/16562145190" target="_blank" rel="noopener noreferrer" className="block w-full">
                        <button className="w-full secondary-btn text-sm py-3 border-green-500/30 flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                          <span className="text-green-400">WhatsApp</span>
                        </button>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== ORDERS TAB ===== */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
                {['all', 'pending', 'confirmed', 'preparing', 'served', 'paid', 'cancelled'].map(f => (
                  <button key={f} onClick={() => setOrderFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${orderFilter === f ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800 hover:border-[#d4af37]/30'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${orders.length})` : `(${orders.filter(o => o.status === f).length})`}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-12 text-sm">No {orderFilter === 'all' ? '' : orderFilter} orders found.</p>
                ) : filteredOrders.map(order => (
                  <div key={order.id} className="gold-card p-4 rounded-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[#d4af37] text-sm">{order.receipt_id}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37]">Table {order.table_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${order.status === 'paid' ? 'bg-gray-800 text-gray-400' : order.status === 'confirmed' ? 'bg-green-900/50 text-green-400' : order.status === 'pending' ? 'bg-amber-900/50 text-amber-400' : order.status === 'cancelled' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>{order.status}</span>
                        </div>
                        <p className="text-sm text-gray-400">{order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-lg font-bold gold-text">${Number(order.total).toFixed(2)}</span>
                          <span className="text-[10px] text-gray-500">{new Date(order.created_at).toLocaleString('en-US')}</span>
                        </div>
                        {order.payment_status === 'paid' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Paid via {order.payment_method} {order.payment_type === 'direct_cash' ? '(Direct to manager)' : order.payment_type === 'chatbot_payment' ? '(Via app)' : ''} {order.transaction_id ? `| Txn: ${order.transaction_id}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {order.status === 'pending' && (
                          <button onClick={() => confirmOrder(order)} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">Confirm</button>
                        )}
                        {order.status === 'confirmed' && (
                          <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">Preparing</button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateOrderStatus(order.id, 'served')} className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors">Served</button>
                        )}
                        {order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                          <button onClick={() => setShowPaymentModal(order)} className="px-3 py-2 rounded-lg bg-[#d4af37] text-black text-xs font-medium hover:bg-[#b8960b] transition-colors">Mark Paid</button>
                        )}
                        {order.status !== 'paid' && order.status !== 'cancelled' && (
                          <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-3 py-2 rounded-lg bg-[#2d2d2d] text-red-400 text-xs font-medium hover:bg-[#3d3d3d] transition-colors">Cancel</button>
                        )}
                        <button onClick={() => setShowOrderDetail(order)} className="px-3 py-2 rounded-lg bg-[#2d2d2d] text-gray-300 text-xs font-medium hover:bg-[#3d3d3d] transition-colors">Details</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== MENU TAB ===== */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold gold-text">Menu Management</h2>
                <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: 'Cocktails' }); setShowMenuModal(true); }} className="luxury-btn text-sm py-2.5 px-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Item
                </button>
              </div>
              {categories.map(cat => {
                const items = menuItems.filter(m => m.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">{cat}</h3>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className={`gold-card p-3 md:p-4 rounded-xl flex items-center gap-3 ${!item.available ? 'opacity-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-[#d4af37] text-sm font-semibold">${Number(item.price).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleMenuAvailability(item)} className={`w-10 h-6 rounded-full transition-colors relative ${item.available ? 'bg-green-600' : 'bg-gray-600'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${item.available ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                            <button onClick={() => { setEditMenuItem(item); setMenuForm({ name: item.name, price: String(item.price), category: item.category }); setShowMenuModal(true); }} className="p-2 rounded-lg bg-[#2d2d2d] text-gray-300 hover:bg-[#3d3d3d] transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                            </button>
                            <button onClick={() => deleteMenuItem(item.id)} className="p-2 rounded-lg bg-[#2d2d2d] text-red-400 hover:bg-red-900/30 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {menuItems.length === 0 && <p className="text-center text-gray-500 py-12 text-sm">No menu items. Add your first item to get started.</p>}
            </div>
          )}

          {/* ===== TABLES TAB ===== */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold gold-text">Table Management</h2>
                <button onClick={addTable} className="luxury-btn text-sm py-2.5 px-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Table
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tables.map(table => {
                  const tableOrder = orders.find(o => o.receipt_id === table.current_order_id && o.status !== 'paid');
                  return (
                    <div key={table.id} className={`gold-card p-4 rounded-xl text-center ${table.status !== 'available' ? 'border-[#d4af37] bg-gradient-to-br from-[#d4af37]/10 to-transparent' : ''}`}>
                      <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 ${table.status !== 'available' ? 'bg-gradient-to-br from-[#d4af37] to-[#996515] text-black' : 'bg-[#1a1a1a] border border-[#d4af37]/20'}`}>
                        <span className="text-xl font-bold">{table.table_number}</span>
                      </div>
                      <p className={`text-xs font-medium mb-1 ${table.status !== 'available' ? 'text-[#d4af37]' : 'text-gray-500'}`}>
                        {table.status === 'available' ? 'Available' : 'Booked'}
                      </p>
                      {tableOrder && (
                        <div className="mt-2 text-left bg-[#0a0a0a] rounded-lg p-2">
                          <p className="font-mono text-[10px] text-[#d4af37]">{tableOrder.receipt_id}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{tableOrder.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                          <p className="text-xs font-bold gold-text mt-1">${Number(tableOrder.total).toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex gap-1 mt-2">
                        {table.status !== 'available' && (
                          <button onClick={() => releaseTable(table.table_number)} className="flex-1 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-[10px] font-medium hover:bg-green-600/30 transition-colors">Release</button>
                        )}
                        {table.status !== 'available' && tableOrder && (
                          <button onClick={() => setShowPaymentModal(tableOrder)} className="flex-1 py-1.5 rounded-lg bg-[#d4af37]/20 text-[#d4af37] text-[10px] font-medium hover:bg-[#d4af37]/30 transition-colors">Pay</button>
                        )}
                        <button onClick={() => removeTable(table.id)} className="py-1.5 px-2 rounded-lg bg-red-900/20 text-red-400 text-[10px] hover:bg-red-900/30 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {tables.length === 0 && <p className="text-center text-gray-500 py-12 text-sm">No tables configured. Add tables to get started.</p>}
            </div>
          )}

          {/* ===== PAYMENTS TAB ===== */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {/* Payment Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Revenue', value: `$${stats.revenue.toFixed(2)}`, color: 'from-green-600 to-emerald-700' },
                  { label: 'Cash Payments', value: `$${stats.cashRevenue.toFixed(2)}`, color: 'from-blue-600 to-blue-700' },
                  { label: 'Online Payments', value: `$${stats.onlineRevenue.toFixed(2)}`, color: 'from-purple-600 to-purple-700' },
                  { label: 'Transactions', value: paidOrders.length, color: 'from-[#d4af37] to-[#996515]' },
                ].map((s, i) => (
                  <div key={i} className="gold-card p-3 md:p-4 rounded-xl">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-lg md:text-xl font-bold">{s.value}</p>
                    <p className="text-[10px] md:text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Payment History */}
              <div className="gold-card p-4 md:p-6 rounded-xl">
                <h2 className="text-lg font-semibold gold-text mb-4">Payment History</h2>
                <div className="space-y-2 max-h-[500px] overflow-y-auto hide-scrollbar">
                  {paidOrders.length === 0 ? (
                    <p className="text-center text-gray-500 py-12 text-sm">No payments recorded yet.</p>
                  ) : paidOrders.map(order => (
                    <div key={order.id} className="p-3 bg-[#1a1a1a] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[#d4af37] text-xs">{order.receipt_id}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37]">Table {order.table_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${order.payment_type === 'direct_cash' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                            {order.payment_type === 'direct_cash' ? 'Direct Cash' : 'Via App'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(order.created_at).toLocaleString('en-US')}
                          {order.payment_method && ` | Method: ${order.payment_method}`}
                          {order.transaction_id && ` | Txn: ${order.transaction_id}`}
                        </p>
                      </div>
                      <span className="text-lg font-bold gold-text shrink-0">${Number(order.total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-gray-800/50 safe-bottom">
          <div className="flex justify-around py-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-0.5 px-3 py-1 relative ${activeTab === tab.id ? 'text-[#d4af37]' : 'text-gray-600'}`}>
                {tab.icon}
                <span className="text-[9px] font-medium">{tab.label}</span>
                {tab.id === 'orders' && stats.pending > 0 && (
                  <span className="absolute -top-0.5 right-0 w-4 h-4 bg-amber-500 text-black text-[8px] rounded-full flex items-center justify-center font-bold">{stats.pending}</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* ===== MODALS ===== */}

      {/* QR Codes Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b border-[#d4af37]/20">
              <h2 className="text-lg font-semibold text-center gold-text">Table QR Codes</h2>
              <p className="text-center text-gray-500 text-xs mt-1">Print and place on each table</p>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              {tables.map((table) => (
                <div key={table.id} className="bg-white rounded-xl p-3 text-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table.table_number}`)}&bgcolor=ffffff&color=000000`} alt={`Table ${table.table_number} QR`} className="mx-auto mb-2 w-[120px] h-[120px]" />
                  <p className="text-black font-bold">Table {table.table_number}</p>
                  <p className="text-gray-600 text-xs">Scan to Order</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#d4af37]/20 flex gap-2">
              <button className="secondary-btn flex-1 text-sm py-2.5" onClick={() => setShowQRModal(false)}>Close</button>
              <button className="luxury-btn flex-1 text-sm py-2.5" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Add/Edit Modal */}
      {showMenuModal && (
        <div className="modal-overlay" onClick={() => setShowMenuModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold gold-text mb-4">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Name</label>
                  <input type="text" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} className="luxury-input text-sm py-3" placeholder="e.g., Mojito" required />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} className="luxury-input text-sm py-3" placeholder="e.g., 9.00" required />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Category</label>
                  <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} className="luxury-input text-sm py-3">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="secondary-btn flex-1 text-sm py-2.5">Cancel</button>
                <button onClick={handleSaveMenuItem} className="luxury-btn flex-1 text-sm py-2.5">{editMenuItem ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold gold-text mb-1">Record Payment</h2>
              <p className="text-sm text-gray-500 mb-4">Order {showPaymentModal.receipt_id} - Table {showPaymentModal.table_number}</p>
              <p className="text-2xl font-bold gold-text mb-4">${Number(showPaymentModal.total).toFixed(2)}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'cash', label: 'Cash' },
                      { val: 'card', label: 'Card' },
                      { val: 'online', label: 'Online' },
                    ].map(m => (
                      <button key={m.val} onClick={() => setPaymentForm({ ...paymentForm, method: m.val })} className={`py-2.5 rounded-xl text-sm font-medium transition-all ${paymentForm.method === m.val ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-gray-400 border border-gray-700'}`}>{m.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Payment Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPaymentForm({ ...paymentForm, paymentType: 'direct_cash' })} className={`py-2.5 rounded-xl text-xs font-medium transition-all ${paymentForm.paymentType === 'direct_cash' ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-gray-400 border border-gray-700'}`}>Direct to Manager</button>
                    <button onClick={() => setPaymentForm({ ...paymentForm, paymentType: 'chatbot_payment' })} className={`py-2.5 rounded-xl text-xs font-medium transition-all ${paymentForm.paymentType === 'chatbot_payment' ? 'bg-[#d4af37] text-black' : 'bg-[#1a1a1a] text-gray-400 border border-gray-700'}`}>Via App</button>
                  </div>
                </div>
                {(paymentForm.method === 'card' || paymentForm.method === 'online') && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Transaction ID</label>
                    <input type="text" value={paymentForm.transactionId} onChange={e => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} className="luxury-input text-sm py-3" placeholder="Enter transaction ID" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowPaymentModal(null); setPaymentForm({ method: 'cash', transactionId: '', paymentType: 'direct_cash' }); }} className="secondary-btn flex-1 text-sm py-2.5">Cancel</button>
                <button onClick={handleMarkPaid} className="luxury-btn flex-1 text-sm py-2.5">Confirm Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetail && (
        <div className="modal-overlay" onClick={() => setShowOrderDetail(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold gold-text">{showOrderDetail.receipt_id}</h2>
                  <p className="text-sm text-gray-500">Table {showOrderDetail.table_number}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${showOrderDetail.status === 'paid' ? 'bg-gray-800 text-gray-400' : showOrderDetail.status === 'confirmed' ? 'bg-green-900/50 text-green-400' : showOrderDetail.status === 'pending' ? 'bg-amber-900/50 text-amber-400' : showOrderDetail.status === 'cancelled' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>{showOrderDetail.status}</span>
              </div>
              <div className="space-y-2 mb-4">
                {showOrderDetail.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-[#1a1a1a] rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category} - ${Number(item.price).toFixed(2)} each</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">x{item.quantity}</p>
                      <p className="text-sm font-semibold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#d4af37]/20 pt-3 mb-4 space-y-1">
                {Number(showOrderDetail.subtotal || 0) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>${Number(showOrderDetail.subtotal).toFixed(2)}</span>
                  </div>
                )}
                {Number(showOrderDetail.tip_amount || 0) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Tip</span>
                    <span className="text-green-400">${Number(showOrderDetail.tip_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold gold-text">${Number(showOrderDetail.total).toFixed(2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <p className="text-gray-500">Payment Status</p>
                  <p className={showOrderDetail.payment_status === 'paid' ? 'text-green-400 font-medium' : 'text-amber-400 font-medium'}>{showOrderDetail.payment_status}</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <p className="text-gray-500">Method</p>
                  <p className="text-white font-medium">{showOrderDetail.payment_method || 'N/A'}</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <p className="text-gray-500">Type</p>
                  <p className="text-white font-medium">{showOrderDetail.payment_type === 'direct_cash' ? 'Direct Cash' : showOrderDetail.payment_type === 'chatbot_payment' ? 'Via App' : 'N/A'}</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <p className="text-gray-500">Transaction ID</p>
                  <p className="text-white font-medium font-mono">{showOrderDetail.transaction_id || 'N/A'}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mb-4">Ordered: {new Date(showOrderDetail.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <div className="flex gap-2">
                {showOrderDetail.status === 'pending' && (
                  <button onClick={() => { confirmOrder(showOrderDetail); setShowOrderDetail(null); }} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium">Confirm</button>
                )}
                {showOrderDetail.payment_status !== 'paid' && showOrderDetail.status !== 'cancelled' && (
                  <button onClick={() => { setShowPaymentModal(showOrderDetail); setShowOrderDetail(null); }} className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-black text-sm font-medium">Mark Paid</button>
                )}
                <button onClick={() => setShowOrderDetail(null)} className="flex-1 py-2.5 rounded-xl bg-[#2d2d2d] text-gray-300 text-sm font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .modal-content, .modal-content * { visibility: visible; }
          .modal-content { position: absolute; left: 0; top: 0; width: 100%; background: white !important; }
          .modal-overlay { background: white !important; }
          button { display: none !important; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </main>
  );
}
