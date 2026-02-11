'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Order, MenuItem, Table } from '@/lib/types';

const ADMIN_WHATSAPP = '+16562145190';

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'tables'>('orders');
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      fetchData();
    };
    checkAuth();
  }, [router]);

  // Fetch all data
  const fetchData = async () => {
    const [ordersRes, menuRes, tablesRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('menu_items').select('*').order('category'),
      supabase.from('tables').select('*').order('table_number')
    ]);
    
    if (ordersRes.data) setOrders(ordersRes.data as Order[]);
    if (menuRes.data) setMenuItems(menuRes.data as MenuItem[]);
    if (tablesRes.data) setTables(tablesRes.data as Table[]);
    setLoading(false);
  };

  // Real-time subscription for new orders
  useEffect(() => {
    const channel = supabase
      .channel('orders-channel')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders(prev => [newOrder, ...prev]);
        setNewOrderAlert(newOrder);
        
        // Play notification sound
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telezo7l+bv1YA2DV2p3e7JdC0jRpXV7tqPSR0nb5/I5NKqcU0/O4qvyt6+f1I+Slp/nKO1yayVg3xqc4KPnJaSiHxxb3mJo7rL0b2ffF9YVVlvg5eipZ2TfmxfXmZ0hJCajo2BdGdhYmx5h5GVkol7bmNfY2x5hY6TkYp+cWZiZW11gIqOjoh9cWVhY2xzfIaLi4h+c2hlZmlvd4CHioqHfHJnZGVpb3V9g4eHhH10a2dmaW1zeoCEhIN+eHJtampscHR5foGCgX55dXBtbG1vc3d7fn+Af3x4dXJwb29xc3Z5e31+fXx6d3VzcnFxcnR2eHp7fHx7enl3dnRzc3N0dXZ4eXp7e3t6eXh3dnV1dXV2d3h5enp6enl5eHd2dnV1dnd4eXl5eXl5eHh3dnZ2dnd3eHl5eXl5eHh4d3d3d3d4eHl5eXl5eXh4eHd3d3d4eHh5eXl5eXl4eHh4d3d4eHh4eXl5eXl5eXh4eHh4eHh4eHl5eXl5eXl4eHh4eHh4eHh5eXl5eXl5eHh4eHh4eHh4eHl5eXl5eXh4eHh4eA==');
        audio.play().catch(() => {});

        // Auto dismiss alert after 5 seconds
        setTimeout(() => setNewOrderAlert(null), 5000);
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Confirm order and reserve table
  const confirmOrder = async (order: Order) => {
    // Update order status
    await supabase.from('orders').update({ 
      status: 'confirmed',
      updated_at: new Date().toISOString()
    }).eq('id', order.id);

    // Reserve the table
    await supabase.from('tables').update({ 
      status: 'occupied',
      current_order_id: order.id
    }).eq('table_number', order.table_number);

    // Refresh tables
    const { data } = await supabase.from('tables').select('*').order('table_number');
    if (data) setTables(data as Table[]);

    // Send WhatsApp notification
    const items = order.items?.map((i: { name: string; quantity: number; price: number }) => 
      `${i.quantity}x ${i.name}`
    ).join(', ') || 'Items';
    
    const message = encodeURIComponent(
      `✅ Order Confirmed!\n\nOrder: ${order.receipt_id}\nTable: ${order.table_number}\nItems: ${items}\nTotal: $${order.total?.toFixed(2)}`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP.replace('+', '')}?text=${message}`, '_blank');
  };

  // Complete order and release table
  const completeOrder = async (order: Order) => {
    await supabase.from('orders').update({ 
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', order.id);

    // Release the table
    await supabase.from('tables').update({ 
      status: 'available',
      current_order_id: null
    }).eq('table_number', order.table_number);

    const { data } = await supabase.from('tables').select('*').order('table_number');
    if (data) setTables(data as Table[]);
  };

  // Cancel order
  const cancelOrder = async (order: Order) => {
    await supabase.from('orders').update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }).eq('id', order.id);

    // Release table if reserved
    await supabase.from('tables').update({ 
      status: 'available',
      current_order_id: null
    }).eq('table_number', order.table_number);

    const { data } = await supabase.from('tables').select('*').order('table_number');
    if (data) setTables(data as Table[]);
  };

  // Toggle menu item availability
  const toggleMenuAvailability = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ 
      available: !item.available 
    }).eq('id', item.id);
    
    setMenuItems(prev => prev.map(m => 
      m.id === item.id ? { ...m, available: !m.available } : m
    ));
  };

  // Toggle table status
  const toggleTableStatus = async (table: Table) => {
    const newStatus = table.status === 'available' ? 'occupied' : 'available';
    await supabase.from('tables').update({ 
      status: newStatus,
      current_order_id: newStatus === 'available' ? null : table.current_order_id
    }).eq('id', table.id);
    
    setTables(prev => prev.map(t => 
      t.id === table.id ? { ...t, status: newStatus } : t
    ));
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
  const availableTables = tables.filter(t => t.status === 'available').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* New Order Alert */}
      {newOrderAlert && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 bg-emerald-600 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">🔔 New Order!</p>
              <p className="text-sm">Table {newOrderAlert.table_number} - ${newOrderAlert.total?.toFixed(2)}</p>
            </div>
            <button onClick={() => setNewOrderAlert(null)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">netrikxr.shop</h1>
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-2xl font-bold text-orange-600">{pendingOrders}</p>
            <p className="text-sm text-slate-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-2xl font-bold text-emerald-600">{confirmedOrders}</p>
            <p className="text-sm text-slate-500">Confirmed</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-2xl font-bold text-slate-800">{availableTables}/{tables.length}</p>
            <p className="text-sm text-slate-500">Tables Free</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
          {(['orders', 'menu', 'tables'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'orders' && `Orders ${pendingOrders > 0 ? `(${pendingOrders})` : ''}`}
              {tab === 'menu' && 'Menu'}
              {tab === 'tables' && 'Tables'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center border border-slate-200">
                <p className="text-slate-500">No orders yet</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">Table {order.table_number}</p>
                      <p className="text-sm text-slate-500">{order.receipt_id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                      order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-3 mb-3">
                    {order.items?.map((item: { name: string; quantity: number; price: number }, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span className="text-slate-600">{item.quantity}x {item.name}</span>
                        <span className="text-slate-800">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-2 border-t border-slate-100 mt-2">
                      <span>Total</span>
                      <span className="text-emerald-600">${order.total?.toFixed(2)}</span>
                    </div>
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => confirmOrder(order)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                      >
                        Confirm & Reserve Table
                      </button>
                      <button 
                        onClick={() => cancelOrder(order)}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {order.status === 'confirmed' && (
                    <button 
                      onClick={() => completeOrder(order)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
                    >
                      Complete & Release Table
                    </button>
                  )}

                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="space-y-2">
            {menuItems.map(item => (
              <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.category} • ${item.price.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => toggleMenuAvailability(item)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    item.available 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.available ? 'Available' : 'Unavailable'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => toggleTableStatus(table)}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  table.status === 'available' 
                    ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' 
                    : 'bg-orange-50 border-orange-200 hover:border-orange-400'
                }`}
              >
                <p className="text-2xl font-bold text-slate-800">{table.table_number}</p>
                <p className={`text-sm ${table.status === 'available' ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {table.status === 'available' ? 'Available' : 'Occupied'}
                </p>
                <p className="text-xs text-slate-400 mt-1">{table.seats} seats</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
