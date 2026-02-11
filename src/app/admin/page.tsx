'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { MenuItem, Order, RestaurantTable } from '@/lib/types';

type User = { id: string; email?: string };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState<Order | null>(null);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: '' });
  const [paymentForm, setPaymentForm] = useState({ method: 'cash', transactionId: '', paymentType: 'direct_cash' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [receiptInput, setReceiptInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<Order | null>(null);
  const [verificationError, setVerificationError] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Failed to fetch orders:', error.message); return; }
    if (data) setOrders(data as Order[]);
  }, []);

  const fetchMenu = useCallback(async () => {
    const { data, error } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
    if (error) { console.error('Failed to fetch menu:', error.message); return; }
    if (data) setMenuItems(data as MenuItem[]);
  }, []);

  const fetchTables = useCallback(async () => {
    const { data, error } = await supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (error) { console.error('Failed to fetch tables:', error.message); return; }
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const confirmOrder = async (order: Order) => {
    const { error: orderError } = await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
    if (orderError) { showToast(`Failed to confirm order: ${orderError.message}`); return; }
    await supabase.from('restaurant_tables').update({ status: 'booked', current_order_id: order.receipt_id, updated_at: new Date().toISOString() }).eq('table_number', order.table_number);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order confirmed', 'success');
    fetchOrders();
    fetchTables();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (error) { showToast(`Failed to update order: ${error.message}`); return; }
    showToast(`Order status updated to ${status}`, 'success');
    fetchOrders();
  };

  const handleMarkPaid = async () => {
    if (!showPaymentModal) return;
    const { error: payError } = await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: paymentForm.method,
      payment_type: paymentForm.paymentType,
      transaction_id: paymentForm.transactionId || null,
      updated_at: new Date().toISOString()
    }).eq('id', showPaymentModal.id);
    if (payError) { showToast(`Failed to record payment: ${payError.message}`); return; }
    await supabase.from('restaurant_tables').update({
      status: 'available',
      current_order_id: null,
      updated_at: new Date().toISOString()
    }).eq('table_number', showPaymentModal.table_number);
    showToast('Payment recorded successfully', 'success');
    setShowPaymentModal(null);
    setPaymentForm({ method: 'cash', transactionId: '', paymentType: 'direct_cash' });
    fetchOrders();
    fetchTables();
  };

  const releaseTable = async (tableNumber: number) => {
    const { error } = await supabase.from('restaurant_tables').update({
      status: 'available', current_order_id: null, updated_at: new Date().toISOString()
    }).eq('table_number', tableNumber);
    if (error) { showToast(`Failed to release table: ${error.message}`); return; }
    showToast('Table released', 'success');
    fetchTables();
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !menuForm.category) { 
      showToast('Please fill in name, price, and category'); 
      return; 
    }
    const data = { 
      name: menuForm.name, 
      price: parseFloat(menuForm.price), 
      category: menuForm.category, 
      available: true, 
      updated_at: new Date().toISOString() 
    };
    let error;
    if (editMenuItem) {
      ({ error } = await supabase.from('menu_items').update(data).eq('id', editMenuItem.id));
    } else {
      ({ error } = await supabase.from('menu_items').insert(data));
    }
    if (error) { showToast(`Failed to save menu item: ${error.message}`); return; }
    showToast(editMenuItem ? 'Menu item updated' : 'Menu item added', 'success');
    setShowMenuModal(false);
    setEditMenuItem(null);
    setMenuForm({ name: '', price: '', category: '' });
    fetchMenu();
  };

  const toggleMenuAvailability = async (item: MenuItem) => {
    const { error } = await supabase.from('menu_items').update({ available: !item.available, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) { showToast(`Failed to toggle availability: ${error.message}`); return; }
    fetchMenu();
  };

  const deleteMenuItem = async (id: number) => {
    if (!confirm('Delete this menu item?')) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { showToast(`Failed to delete menu item: ${error.message}`); return; }
    showToast('Menu item deleted', 'success');
    fetchMenu();
  };

  const addTable = async () => {
    const maxNum = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) : 0;
    const { error } = await supabase.from('restaurant_tables').insert({ table_number: maxNum + 1 });
    if (error) { showToast(`Failed to add table: ${error.message}`); return; }
    showToast(`Table ${maxNum + 1} added`, 'success');
    fetchTables();
  };

  const removeTable = async (id: number) => {
    if (!confirm('Remove this table?')) return;
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
    if (error) { showToast(`Failed to remove table: ${error.message}`); return; }
    showToast('Table removed', 'success');
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

  const stats = {
    totalOrders: orders.length,
    revenue: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total), 0),
    pending: orders.filter(o => o.status === 'pending').length,
    activeTables: tables.filter(t => t.status !== 'available').length,
    totalTables: tables.length,
    todayOrders: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    totalTips: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.tip_amount || 0), 0),
  };

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
  const uniqueCategories = [...new Set(menuItems.map(m => m.category))];

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
    { id: 'orders', label: 'Orders', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg> },
    { id: 'menu', label: 'Menu', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg> },
    { id: 'tables', label: 'Tables', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg> },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#030303] pb-20 md:pb-0">
      {/* Background */}
      <div className="fixed inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#d4af37]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,175,55,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-[#d4af37]/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/" className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f4e4bc] via-[#d4af37] to-[#996515] flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.126-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12" />
                  </svg>
                </div>
              </Link>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] bg-clip-text text-transparent">netrikxr.shop</h1>
                <p className="text-xs text-gray-500">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-mono text-[#d4af37]">{currentTime.toLocaleTimeString('en-US')}</p>
                <p className="text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
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

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-lg transition-all animate-slideIn ${toast.type === 'error' ? 'bg-red-900/95 border border-red-500/50 text-red-200' : 'bg-green-900/95 border border-green-500/50 text-green-200'}`}>
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        )}

        {/* New Order Notifications */}
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
                    <p className="text-xs text-gray-400 mt-1 truncate">{notif.items?.map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                    <p className="text-sm font-semibold text-[#d4af37] mt-1">${Number(notif.total).toFixed(2)}</p>
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

        {/* Desktop Tabs */}
        <nav className="hidden md:flex border-b border-[#d4af37]/10 bg-[#030303]/50 backdrop-blur-xl sticky top-[65px] z-40">
          <div className="max-w-7xl mx-auto flex w-full">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-gray-500 hover:text-white'}`}>
                {tab.icon} {tab.label}
                {tab.id === 'orders' && stats.pending > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{stats.pending}</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Orders', value: stats.totalOrders, sub: `${stats.todayOrders} today`, gradient: 'from-[#d4af37] to-[#996515]' },
                  { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}`, sub: 'Total earned', gradient: 'from-green-500 to-emerald-600' },
                  { label: 'Pending', value: stats.pending, sub: 'Awaiting confirm', gradient: 'from-amber-500 to-orange-600' },
                  { label: 'Active Tables', value: `${stats.activeTables}/${stats.totalTables}`, sub: 'Occupied', gradient: 'from-blue-500 to-indigo-600' },
                ].map((stat, i) => (
                  <div key={i} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-4">
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.gradient} opacity-10 blur-2xl`} />
                    <div className="relative">
                      <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                      <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions & Verify */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                    Quick Actions
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowQRModal(true)} className="p-4 rounded-xl bg-gradient-to-br from-[#d4af37]/10 to-transparent border border-[#d4af37]/20 hover:border-[#d4af37]/50 transition-all text-left">
                      <svg className="w-6 h-6 text-[#d4af37] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
                      <p className="text-sm font-medium text-white">Print QR Codes</p>
                      <p className="text-xs text-gray-500 mt-0.5">For all tables</p>
                    </button>
                    <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 hover:border-green-500/50 transition-all text-left">
                      <svg className="w-6 h-6 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      <p className="text-sm font-medium text-white">Add Menu Item</p>
                      <p className="text-xs text-gray-500 mt-0.5">New product</p>
                    </button>
                    <button onClick={addTable} className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 hover:border-blue-500/50 transition-all text-left">
                      <svg className="w-6 h-6 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg>
                      <p className="text-sm font-medium text-white">Add Table</p>
                      <p className="text-xs text-gray-500 mt-0.5">New seating</p>
                    </button>
                    <Link href="/" className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/50 transition-all text-left block">
                      <svg className="w-6 h-6 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                      <p className="text-sm font-medium text-white">View Site</p>
                      <p className="text-xs text-gray-500 mt-0.5">Customer view</p>
                    </Link>
                  </div>
                </div>

                {/* Verify Payment */}
                <div className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    Verify Payment
                  </h2>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={receiptInput} onChange={(e) => setReceiptInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && verifyReceipt()} placeholder="Enter Order ID (e.g., NX-ABC123)" className="flex-1 bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3 px-4 text-white font-mono text-sm placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none" />
                    <button onClick={verifyReceipt} className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium text-sm hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all">Verify</button>
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
                      <p className="text-lg font-bold text-[#d4af37]">Total: ${Number(verificationResult.total).toFixed(2)}</p>
                      {verificationResult.payment_status !== 'paid' && (
                        <button onClick={() => { setShowPaymentModal(verificationResult); setVerificationResult(null); setReceiptInput(''); }} className="mt-3 w-full py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">Mark as Paid</button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Orders & Tables */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Recent Orders</h2>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {orders.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No orders yet</p>
                    ) : orders.slice(0, 8).map((order) => (
                      <div key={order.id} className={`p-3 rounded-xl bg-[#0a0a0a] border-l-4 cursor-pointer hover:bg-[#111] transition-colors ${order.status === 'paid' ? 'border-gray-600 opacity-60' : order.status === 'confirmed' ? 'border-green-500' : order.status === 'pending' ? 'border-[#d4af37]' : 'border-blue-500'}`} onClick={() => setShowOrderDetail(order)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono text-[#d4af37] text-xs">{order.receipt_id}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{order.items?.map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37]">Table {order.table_number}</span>
                            <p className="font-semibold text-sm text-white mt-1">${Number(order.total).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Tables</h2>
                  <div className="grid grid-cols-5 gap-2">
                    {tables.map((table) => (
                      <div key={table.id} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 ${table.status !== 'available' ? 'bg-gradient-to-br from-[#d4af37] to-[#996515] text-black shadow-lg shadow-[#d4af37]/20' : 'bg-[#0a0a0a] border border-[#d4af37]/20 text-white'}`}>
                        <span className="text-lg font-bold">{table.table_number}</span>
                        <span className="text-[8px] opacity-70">{table.status === 'available' ? 'Open' : 'Booked'}</span>
                      </div>
                    ))}
                  </div>
                  {tables.length === 0 && <p className="text-center text-gray-500 py-4">No tables. Add some!</p>}
                </div>
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {['all', 'pending', 'confirmed', 'preparing', 'served', 'paid', 'cancelled'].map(f => (
                  <button key={f} onClick={() => setOrderFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${orderFilter === f ? 'bg-gradient-to-r from-[#d4af37] to-[#996515] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#d4af37]/10'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? orders.length : orders.filter(o => o.status === f).length})
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">No {orderFilter === 'all' ? '' : orderFilter} orders</p>
                ) : filteredOrders.map(order => (
                  <div key={order.id} className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-[#d4af37] text-sm">{order.receipt_id}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37]">Table {order.table_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${order.status === 'paid' ? 'bg-gray-800 text-gray-400' : order.status === 'confirmed' ? 'bg-green-900/50 text-green-400' : order.status === 'pending' ? 'bg-amber-900/50 text-amber-400' : order.status === 'cancelled' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>{order.status}</span>
                        </div>
                        <p className="text-sm text-gray-400">{order.items?.map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`).join(', ')}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xl font-bold text-white">${Number(order.total).toFixed(2)}</span>
                          <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString('en-US')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        {order.status === 'pending' && <button onClick={() => confirmOrder(order)} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">Confirm</button>}
                        {order.status === 'confirmed' && <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">Preparing</button>}
                        {order.status === 'preparing' && <button onClick={() => updateOrderStatus(order.id, 'served')} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors">Served</button>}
                        {order.payment_status !== 'paid' && order.status !== 'cancelled' && <button onClick={() => setShowPaymentModal(order)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#996515] text-black text-sm font-medium">Mark Paid</button>}
                        <button onClick={() => setShowOrderDetail(order)} className="px-4 py-2 rounded-lg bg-[#2d2d2d] text-gray-300 text-sm font-medium hover:bg-[#3d3d3d] transition-colors">Details</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MENU TAB */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Menu Management</h2>
                <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '' }); setShowMenuModal(true); }} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Item
                </button>
              </div>
              {uniqueCategories.map(cat => {
                const items = menuItems.filter(m => m.category === cat);
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-medium text-[#d4af37] uppercase tracking-wider mb-3">{cat}</h3>
                    <div className="grid gap-3">
                      {items.map(item => (
                        <div key={item.id} className={`rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#d4af37]/10 p-4 flex items-center gap-4 ${!item.available ? 'opacity-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-[#d4af37] font-semibold">${Number(item.price).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleMenuAvailability(item)} className={`w-12 h-6 rounded-full transition-colors relative ${item.available ? 'bg-green-600' : 'bg-gray-600'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${item.available ? 'left-[26px]' : 'left-0.5'}`} />
                            </button>
                            <button onClick={() => { setEditMenuItem(item); setMenuForm({ name: item.name, price: String(item.price), category: item.category }); setShowMenuModal(true); }} className="p-2 rounded-lg bg-[#2d2d2d] text-gray-300 hover:text-white hover:bg-[#3d3d3d] transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
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
              {menuItems.length === 0 && <p className="text-center text-gray-500 py-12">No menu items. Add your first item!</p>}
            </div>
          )}

          {/* TABLES TAB */}
          {activeTab === 'tables' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Table Management</h2>
                <button onClick={addTable} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Table
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {tables.map(table => {
                  const tableOrder = orders.find(o => o.receipt_id === table.current_order_id && o.status !== 'paid');
                  return (
                    <div key={table.id} className={`rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border p-4 text-center ${table.status !== 'available' ? 'border-[#d4af37]/50' : 'border-[#d4af37]/10'}`}>
                      <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-3 ${table.status !== 'available' ? 'bg-gradient-to-br from-[#d4af37] to-[#996515] text-black' : 'bg-[#0a0a0a] border border-[#d4af37]/20 text-white'}`}>
                        <span className="text-2xl font-bold">{table.table_number}</span>
                      </div>
                      <p className={`text-sm font-medium mb-2 ${table.status !== 'available' ? 'text-[#d4af37]' : 'text-gray-500'}`}>
                        {table.status === 'available' ? 'Available' : 'Booked'}
                      </p>
                      {tableOrder && (
                        <div className="text-left bg-[#0a0a0a] rounded-lg p-2 mb-2">
                          <p className="font-mono text-[10px] text-[#d4af37]">{tableOrder.receipt_id}</p>
                          <p className="text-sm font-bold text-white">${Number(tableOrder.total).toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex gap-1">
                        {table.status !== 'available' && <button onClick={() => releaseTable(table.table_number)} className="flex-1 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30">Release</button>}
                        {table.status !== 'available' && tableOrder && <button onClick={() => setShowPaymentModal(tableOrder)} className="flex-1 py-1.5 rounded-lg bg-[#d4af37]/20 text-[#d4af37] text-xs font-medium hover:bg-[#d4af37]/30">Pay</button>}
                        <button onClick={() => removeTable(table.id)} className="py-1.5 px-2 rounded-lg bg-red-900/20 text-red-400 text-xs hover:bg-red-900/30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {tables.length === 0 && <p className="text-center text-gray-500 py-12">No tables. Add some to get started!</p>}
            </div>
          )}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#030303]/95 backdrop-blur-xl border-t border-[#d4af37]/10">
          <div className="flex justify-around py-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-0.5 px-3 py-1 relative ${activeTab === tab.id ? 'text-[#d4af37]' : 'text-gray-600'}`}>
                {tab.icon}
                <span className="text-[9px] font-medium">{tab.label}</span>
                {tab.id === 'orders' && stats.pending > 0 && <span className="absolute -top-0.5 right-0 w-4 h-4 bg-amber-500 text-black text-[8px] rounded-full flex items-center justify-center font-bold">{stats.pending}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* QR MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-[#d4af37]/20 max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#d4af37]/20">
              <h2 className="text-xl font-semibold text-white text-center">Table QR Codes</h2>
              <p className="text-center text-gray-500 text-sm mt-1">Print these for each table</p>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
              {tables.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-400">No tables configured. Add tables first!</p>
                </div>
              ) : tables.map((table) => (
                <div key={table.id} className="bg-white rounded-xl p-4 text-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table.table_number}`)}&bgcolor=ffffff&color=000000&margin=10`} 
                    alt={`Table ${table.table_number} QR`} 
                    className="mx-auto mb-2 w-[140px] h-[140px]" 
                  />
                  <p className="text-black font-bold text-lg">Table {table.table_number}</p>
                  <p className="text-gray-600 text-xs">Scan to Order</p>
                  <p className="text-gray-400 text-[10px] mt-1 break-all">{getBaseUrl()}/order?table={table.table_number}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#d4af37]/20 flex gap-2">
              <button className="flex-1 py-3 rounded-xl bg-[#2d2d2d] text-gray-300 font-medium" onClick={() => setShowQRModal(false)}>Close</button>
              {tables.length > 0 && <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium" onClick={() => window.print()}>Print All</button>}
            </div>
          </div>
        </div>
      )}

      {/* MENU MODAL */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowMenuModal(false)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-[#d4af37]/20 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-6">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Item Name</label>
                  <input type="text" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none" placeholder="e.g., Mojito, Burger, etc." />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none" placeholder="9.99" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Category (type anything)</label>
                  <input type="text" value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none" placeholder="e.g., Cocktails, Food, Beer, Specials..." list="category-suggestions" />
                  <datalist id="category-suggestions">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">Enter any category name you want</p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="flex-1 py-3 rounded-xl bg-[#2d2d2d] text-gray-300 font-medium">Cancel</button>
                <button onClick={handleSaveMenuItem} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium">{editMenuItem ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowPaymentModal(null)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-[#d4af37]/20 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-1">Record Payment</h2>
              <p className="text-sm text-gray-500 mb-4">{showPaymentModal.receipt_id} - Table {showPaymentModal.table_number}</p>
              <p className="text-3xl font-bold text-[#d4af37] mb-6">${Number(showPaymentModal.total).toFixed(2)}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['cash', 'card', 'online'].map(m => (
                      <button key={m} onClick={() => setPaymentForm({ ...paymentForm, method: m })} className={`py-3 rounded-xl text-sm font-medium transition-all capitalize ${paymentForm.method === m ? 'bg-gradient-to-r from-[#d4af37] to-[#996515] text-black' : 'bg-[#0a0a0a] text-gray-400 border border-[#d4af37]/20'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                {(paymentForm.method === 'card' || paymentForm.method === 'online') && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Transaction ID (optional)</label>
                    <input type="text" value={paymentForm.transactionId} onChange={e => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] transition-all outline-none" placeholder="Enter transaction ID" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowPaymentModal(null); setPaymentForm({ method: 'cash', transactionId: '', paymentType: 'direct_cash' }); }} className="flex-1 py-3 rounded-xl bg-[#2d2d2d] text-gray-300 font-medium">Cancel</button>
                <button onClick={handleMarkPaid} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700">Confirm Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      {showOrderDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowOrderDetail(null)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-[#d4af37]/20 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#d4af37] font-mono">{showOrderDetail.receipt_id}</h2>
                  <p className="text-sm text-gray-500">Table {showOrderDetail.table_number}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${showOrderDetail.status === 'paid' ? 'bg-gray-800 text-gray-400' : showOrderDetail.status === 'confirmed' ? 'bg-green-900/50 text-green-400' : showOrderDetail.status === 'pending' ? 'bg-amber-900/50 text-amber-400' : 'bg-blue-900/50 text-blue-400'}`}>{showOrderDetail.status}</span>
              </div>
              <div className="space-y-2 mb-4">
                {showOrderDetail.items?.map((item: { id: number; name: string; price: number; quantity: number; category: string }, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-[#0a0a0a] rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-gray-500">${Number(item.price).toFixed(2)} x {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#d4af37]/20 pt-4 space-y-2">
                {Number(showOrderDetail.tip_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tip</span>
                    <span className="text-green-400">${Number(showOrderDetail.tip_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold text-[#d4af37]">${Number(showOrderDetail.total).toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">{new Date(showOrderDetail.created_at).toLocaleString('en-US')}</p>
              <div className="flex gap-2 mt-4">
                {showOrderDetail.status === 'pending' && <button onClick={() => { confirmOrder(showOrderDetail); setShowOrderDetail(null); }} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium">Confirm</button>}
                {showOrderDetail.payment_status !== 'paid' && showOrderDetail.status !== 'cancelled' && <button onClick={() => { setShowPaymentModal(showOrderDetail); setShowOrderDetail(null); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#996515] text-black font-medium">Mark Paid</button>}
                <button onClick={() => setShowOrderDetail(null)} className="flex-1 py-3 rounded-xl bg-[#2d2d2d] text-gray-300 font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        @media print {
          body * { visibility: hidden; }
          .fixed { position: absolute !important; }
        }
      `}</style>
    </main>
  );
}
