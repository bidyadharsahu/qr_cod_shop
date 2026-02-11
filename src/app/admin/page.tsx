'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { MenuItem, Order, RestaurantTable } from '@/lib/types';

type User = { id: string; email?: string };

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Notification Popup */}
      {notifications.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-black px-6 py-4 rounded-xl shadow-2xl max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">🔔</div>
            <div>
              <p className="font-bold">New Order!</p>
              <p className="text-sm">Table {notifications[0].table_number} - {notifications[0].receipt_id}</p>
            </div>
            <button 
              onClick={() => {
                confirmOrder(notifications[0]);
              }}
              className="ml-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-black">N</span>
              </div>
              <span className="text-xl font-bold">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.email}</span>
            <button onClick={handleLogout} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-400 text-sm">Today&apos;s Orders</p>
            <p className="text-3xl font-bold text-white mt-1">{todayOrders.length}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-400 text-sm">Today&apos;s Revenue</p>
            <p className="text-3xl font-bold text-green-400 mt-1">${todayRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-400 text-sm">Pending Orders</p>
            <p className="text-3xl font-bold text-amber-400 mt-1">{pendingOrders}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <p className="text-gray-400 text-sm">Active Tables</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{activeTables}/{tables.length}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => setShowQRModal(true)}
            className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">📱</div>
            <p className="font-semibold">Print QR Codes</p>
            <p className="text-sm text-purple-200">For all tables</p>
          </button>
          <button 
            onClick={() => {
              setEditMenuItem(null);
              setMenuForm({ name: '', price: '', category: '' });
              setShowMenuModal(true);
            }}
            className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">➕</div>
            <p className="font-semibold">Add Menu Item</p>
            <p className="text-sm text-green-200">New product</p>
          </button>
          <button 
            onClick={() => setShowAddTableModal(true)}
            className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">🪑</div>
            <p className="font-semibold">Add Table</p>
            <p className="text-sm text-blue-200">New seating</p>
          </button>
          <Link 
            href="/"
            className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">🏠</div>
            <p className="font-semibold">View Site</p>
            <p className="text-sm text-amber-200">Customer view</p>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {(['orders', 'menu', 'tables'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium capitalize transition-colors ${
                activeTab === tab 
                  ? 'text-amber-400 border-b-2 border-amber-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
              {tab === 'orders' && pendingOrders > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                  {pendingOrders}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <p className="text-gray-400">No orders yet</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                          order.status === 'preparing' ? 'bg-purple-500/20 text-purple-400' :
                          order.status === 'served' ? 'bg-green-500/20 text-green-400' :
                          order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {order.status.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                        </span>
                        {order.payment_type && (
                          <span className="px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
                            {order.payment_type === 'direct_cash' ? '💵 Cash' : '💳 Online'}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-semibold">{order.receipt_id}</p>
                      <p className="text-gray-400">Table {order.table_number}</p>
                      <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                      <p className="text-sm text-gray-400">{order.items?.length || 0} items</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Items:</p>
                    <div className="flex flex-wrap gap-2">
                      {order.items?.map((item, idx) => (
                        <span key={idx} className="px-3 py-1 bg-gray-700 rounded-full text-sm">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => confirmOrder(order)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
                      >
                        ✓ Confirm
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
                      >
                        🍳 Preparing
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                      >
                        🍽️ Served
                      </button>
                    )}
                    {order.payment_status !== 'paid' && order.status !== 'pending' && (
                      <button 
                        onClick={() => setShowPaymentModal(order)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium"
                      >
                        💰 Record Payment
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
                    >
                      {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {selectedOrder?.id === order.id && (
                    <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                      <h4 className="font-semibold mb-3">Order Details</h4>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-gray-400 text-sm">
                            <th className="pb-2">Item</th>
                            <th className="pb-2">Qty</th>
                            <th className="pb-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items?.map((item, idx) => (
                            <tr key={idx} className="border-t border-gray-600">
                              <td className="py-2">{item.name}</td>
                              <td className="py-2">{item.quantity}</td>
                              <td className="py-2 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-500 font-semibold">
                            <td className="pt-2" colSpan={2}>Total</td>
                            <td className="pt-2 text-right">${order.total.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                      {order.customer_note && (
                        <div className="mt-3 p-3 bg-gray-600/50 rounded">
                          <p className="text-sm text-gray-300">Note: {order.customer_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            {menuItems.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <p className="text-gray-400 mb-4">No menu items yet</p>
                <button 
                  onClick={() => setShowMenuModal(true)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium"
                >
                  Add Your First Item
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <div key={item.id} className={`bg-gray-800 rounded-xl p-5 border transition-colors ${
                    item.available ? 'border-gray-700' : 'border-red-800/50 opacity-60'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{item.category}</span>
                        <h3 className="text-lg font-semibold mt-2">{item.name}</h3>
                      </div>
                      <p className="text-xl font-bold text-green-400">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => toggleAvailability(item)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                          item.available 
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                            : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                        }`}
                      >
                        {item.available ? '✓ Available' : '✗ Unavailable'}
                      </button>
                      <button
                        onClick={() => {
                          setEditMenuItem(item);
                          setMenuForm({ name: item.name, price: item.price.toString(), category: item.category });
                          setShowMenuModal(true);
                        }}
                        className="px-3 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMenuItem(item.id)}
                        className="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            {tables.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <p className="text-gray-400 mb-4">No tables configured</p>
                <button 
                  onClick={() => setShowAddTableModal(true)}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium"
                >
                  Add Your First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tables.map(table => (
                  <div key={table.id} className={`bg-gray-800 rounded-xl p-5 border transition-colors ${
                    table.status === 'available' ? 'border-green-600/50' :
                    table.status === 'booked' ? 'border-amber-600/50' :
                    'border-red-600/50'
                  }`}>
                    <div className="text-center mb-4">
                      <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center text-2xl font-bold ${
                        table.status === 'available' ? 'bg-green-600/20 text-green-400' :
                        table.status === 'booked' ? 'bg-amber-600/20 text-amber-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {table.table_number}
                      </div>
                      <p className="text-sm text-gray-400 mt-2 capitalize">{table.status}</p>
                      {table.current_order_id && (
                        <p className="text-xs text-gray-500">{table.current_order_id}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <select
                        value={table.status}
                        onChange={(e) => updateTableStatus(table.id, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm"
                      >
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="occupied">Occupied</option>
                      </select>
                      <button
                        onClick={() => deleteTable(table.id)}
                        className="w-full px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Table QR Codes</h2>
              <button onClick={() => setShowQRModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6">
              {tables.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No tables configured. Add tables first!</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {tables.map(table => (
                    <div key={table.id} className="bg-white rounded-xl p-4 text-center">
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
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium"
                >
                  🖨️ Print All QR Codes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <button onClick={() => { setShowMenuModal(false); setEditMenuItem(null); }} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Item Name</label>
                <input
                  type="text"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-amber-500 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-amber-500 focus:outline-none"
                  placeholder="e.g., 12.99"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Category (free text)</label>
                <input
                  type="text"
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-amber-500 focus:outline-none"
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
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold"
              >
                {editMenuItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-sm w-full">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Add Table</h2>
              <button onClick={() => setShowAddTableModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Table Number</label>
                <input
                  type="number"
                  value={tableNumberInput}
                  onChange={(e) => setTableNumberInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-amber-500 focus:outline-none"
                  placeholder="e.g., 11"
                  min="1"
                />
              </div>
              <button
                onClick={addTable}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold"
              >
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-sm w-full">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-400">Order: {showPaymentModal.receipt_id}</p>
                <p className="text-2xl font-bold text-green-400">${showPaymentModal.total.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-3 rounded-lg font-medium ${
                      paymentMethod === 'cash' ? 'bg-amber-600 text-black' : 'bg-gray-700'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('online')}
                    className={`py-3 rounded-lg font-medium ${
                      paymentMethod === 'online' ? 'bg-amber-600 text-black' : 'bg-gray-700'
                    }`}
                  >
                    💳 Online
                  </button>
                </div>
              </div>
              <button
                onClick={handlePayment}
                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
