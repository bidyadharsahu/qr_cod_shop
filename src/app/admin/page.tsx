'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal, formatCurrency } from '@/lib/calculations';
import { getCurrentTheme, type AppTheme } from '@/lib/themes';
import type { Order, MenuItem, RestaurantTable, PaymentEventAudit } from '@/lib/types';
import { getDefaultMenuImage, withResolvedMenuImage } from '@/lib/menu-images';
import { 
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid3X3, 
  LogOut, Plus, QrCode, Bell, X, Check, ChefHat,
  DollarSign, Clock, Users, Trash2, Edit, Search,
  PhoneCall, Filter, Sparkles, AlertTriangle, TrendingUp, CreditCard, WandSparkles, Printer, Download, Palette
} from 'lucide-react';

interface PaymentGatewayStatus {
  stripeConfigured: boolean;
  paypalConfigured: boolean;
  mode: 'sandbox' | 'live';
  anyProviderConfigured: boolean;
}

type AdminUiTone = 'corporate' | 'luxury' | 'fintech';

const DEFAULT_COMPANY_PROFILE = {
  name: 'netrikxr.shop',
  subtitle: 'Admin Panel',
  logo: '/icons/icon-192x192.png',
  logoHint: 'Logo Placeholder',
};

const toIsoDay = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatIsoDayLabel = (isoDay: string) => {
  const parts = isoDay.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDay;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventAudit[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'tables'>('dashboard');
  const [notifications, setNotifications] = useState<Order[]>([]);
  
  // Tampa timezone clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  
  // Theme
  const [theme, setTheme] = useState<AppTheme>(getCurrentTheme());
  const [uiTone, setUiTone] = useState<AdminUiTone>('fintech');
  
  // Waiter calls
  const [waiterCalls, setWaiterCalls] = useState<Order[]>([]);
  
  // Order filtering
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderTableFilter, setOrderTableFilter] = useState<string>('all');
  
  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [paymentModalData, setPaymentModalData] = useState<Order | null>(null);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  const [paymentGatewayStatus, setPaymentGatewayStatus] = useState<PaymentGatewayStatus>({
    stripeConfigured: false,
    paypalConfigured: false,
    mode: 'sandbox',
    anyProviderConfigured: false,
  });
  const [paymentGatewayLoading, setPaymentGatewayLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_COMPANY_PROFILE);
  const [brandingForm, setBrandingForm] = useState({
    name: DEFAULT_COMPANY_PROFILE.name,
    subtitle: DEFAULT_COMPANY_PROFILE.subtitle,
    logo: DEFAULT_COMPANY_PROFILE.logo,
    logoHint: DEFAULT_COMPANY_PROFILE.logoHint,
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState<string>(toIsoDay(new Date()));
  const [reportFromDate, setReportFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toIsoDay(d);
  });
  const [reportToDate, setReportToDate] = useState<string>(toIsoDay(new Date()));
  
  // Forms
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: '', imageUrl: '' });
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

  const printOrderBill = (order: Order) => {
    if (typeof window === 'undefined') return;

    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      showToast('Pop-up blocked. Please allow pop-ups to print bill.', 'error');
      return;
    }

    const itemsHtml = (order.items || [])
      .map(item => `<tr><td>${item.quantity}x ${item.name}</td><td style="text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td></tr>`)
      .join('');

    popup.document.write(`
      <html>
        <head>
          <title>Bill - ${order.receipt_id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #111; }
            .brand { text-align: center; margin-bottom: 12px; }
            .logo { width: 56px; height: 56px; border-radius: 10px; display:block; margin: 0 auto 6px; }
            .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            td { padding: 6px 0; border-bottom: 1px solid #ececec; }
            .totals { margin-top: 10px; font-size: 13px; }
            .totals div { display:flex; justify-content:space-between; padding: 3px 0; }
            .grand { font-weight: 700; font-size: 16px; border-top: 1px solid #ddd; margin-top: 6px; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="brand">
            <img class="logo" src="${getBaseUrl()}${companyProfile.logo}" alt="Logo" />
            <h3 style="margin:0;">${companyProfile.name}</h3>
            <p style="margin:2px 0 0; font-size: 12px; color:#666;">${companyProfile.logoHint}</p>
          </div>
          <div class="meta">
            <div>Receipt: ${order.receipt_id}</div>
            <div>Table: ${order.table_number}</div>
            <div>Date: ${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <table>
            ${itemsHtml}
          </table>
          <div class="totals">
            <div><span>Subtotal</span><span>$${order.subtotal.toFixed(2)}</span></div>
            <div><span>Tax</span><span>$${(order.tax_amount || 0).toFixed(2)}</span></div>
            <div><span>Tip</span><span>$${(order.tip_amount || 0).toFixed(2)}</span></div>
            <div class="grand"><span>Total</span><span>$${order.total.toFixed(2)}</span></div>
          </div>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const raw = value === null || value === undefined ? '' : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const fetchBrandingSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('business_name, admin_subtitle, logo_url, logo_hint')
      .eq('id', 1)
      .maybeSingle();

    if (!data) return;

    const next = {
      name: data.business_name || DEFAULT_COMPANY_PROFILE.name,
      subtitle: data.admin_subtitle || DEFAULT_COMPANY_PROFILE.subtitle,
      logo: data.logo_url || DEFAULT_COMPANY_PROFILE.logo,
      logoHint: data.logo_hint || DEFAULT_COMPANY_PROFILE.logoHint,
    };

    setCompanyProfile(next);
    setBrandingForm(next);
  }, []);

  const saveBrandingSettings = async () => {
    setSavingBranding(true);
    try {
      const payload = {
        id: 1,
        business_name: brandingForm.name.trim() || DEFAULT_COMPANY_PROFILE.name,
        admin_subtitle: brandingForm.subtitle.trim() || DEFAULT_COMPANY_PROFILE.subtitle,
        logo_url: brandingForm.logo.trim() || DEFAULT_COMPANY_PROFILE.logo,
        logo_hint: brandingForm.logoHint.trim() || DEFAULT_COMPANY_PROFILE.logoHint,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'id' });

      if (error) {
        showToast('Could not save branding settings. Run app settings SQL first.', 'error');
        return;
      }

      const next = {
        name: payload.business_name,
        subtitle: payload.admin_subtitle,
        logo: payload.logo_url,
        logoHint: payload.logo_hint,
      };
      setCompanyProfile(next);
      showToast('Branding saved successfully');
      setShowBrandingModal(false);
    } finally {
      setSavingBranding(false);
    }
  };

  const printDailyClosingReport = (
    reportDateIso: string,
    reportOrdersSnapshot: Order[],
    reportPaidOrdersSnapshot: Order[],
    reportRevenueSnapshot: number,
    reportCashCount: number,
    reportOnlineCount: number,
    reportCashAmount: number,
    reportOnlineAmount: number,
    reportCancelledCount: number
  ) => {
    if (typeof window === 'undefined') return;

    const popup = window.open('', '_blank', 'width=900,height=1200');
    if (!popup) {
      showToast('Pop-up blocked. Please allow pop-ups to print report.', 'error');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Daily Closing Report - ${reportDateIso}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { font-family: Arial, sans-serif; color: #111; }
            .head { display:flex; align-items:center; gap:12px; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 14px; }
            .logo { width: 54px; height: 54px; border-radius: 10px; }
            .title { margin:0; font-size: 20px; }
            .sub { margin:2px 0 0; color:#666; font-size:12px; }
            .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 12px; }
            .card { border:1px solid #ddd; border-radius:10px; padding:10px; }
            .card h4 { margin:0 0 6px; font-size: 13px; color:#444; }
            .big { font-size: 24px; font-weight: 700; margin: 0; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #eee; padding: 6px; font-size: 12px; text-align:left; }
            th { background:#fafafa; }
          </style>
        </head>
        <body>
          <div class="head">
            <img class="logo" src="${getBaseUrl()}${companyProfile.logo}" alt="Logo" />
            <div>
              <h1 class="title">${companyProfile.name} - Daily Closing Report</h1>
              <p class="sub">Report Date: ${formatIsoDayLabel(reportDateIso)} • Printed: ${new Date().toLocaleString()} • ${companyProfile.logoHint}</p>
            </div>
          </div>
          <div class="grid">
            <div class="card"><h4>Total Orders</h4><p class="big">${reportOrdersSnapshot.length}</p></div>
            <div class="card"><h4>Total Paid Revenue</h4><p class="big">$${reportRevenueSnapshot.toFixed(2)}</p></div>
            <div class="card"><h4>Cash Payments</h4><p class="big">${reportCashCount} • $${reportCashAmount.toFixed(2)}</p></div>
            <div class="card"><h4>Online Payments</h4><p class="big">${reportOnlineCount} • $${reportOnlineAmount.toFixed(2)}</p></div>
          </div>
          <div class="card" style="margin-bottom: 12px;"><h4>Operational Summary</h4><p style="margin:0;">Paid orders: ${reportPaidOrdersSnapshot.length} • Cancelled: ${reportCancelledCount}</p></div>
          <table>
            <thead>
              <tr><th>Receipt</th><th>Table</th><th>Status</th><th>Payment</th><th>Total</th><th>Created</th></tr>
            </thead>
            <tbody>
              ${reportOrdersSnapshot.map(order => `<tr><td>${order.receipt_id}</td><td>${order.table_number}</td><td>${order.status}</td><td>${order.payment_status}</td><td>$${order.total.toFixed(2)}</td><td>${new Date(order.created_at).toLocaleString()}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportTodayAccountingCsv = (reportDateIso: string, reportOrdersSnapshot: Order[], reportPaymentEventsSnapshot: PaymentEventAudit[]) => {
    const lines: string[] = [];
    lines.push('SECTION,TYPE,ORDER_ID,RECEIPT_ID,TABLE,STATUS,PAYMENT_STATUS,PAYMENT_TYPE,TOTAL,EVENT_TYPE,EVENT_STATUS,PROVIDER,TRANSACTION_ID,SOURCE,TIME');

    for (const order of reportOrdersSnapshot) {
      lines.push([
        escapeCsv('orders'),
        escapeCsv('order_row'),
        escapeCsv(order.id),
        escapeCsv(order.receipt_id),
        escapeCsv(order.table_number),
        escapeCsv(order.status),
        escapeCsv(order.payment_status),
        escapeCsv(order.payment_type),
        escapeCsv(order.total.toFixed(2)),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(order.transaction_id),
        escapeCsv(''),
        escapeCsv(order.created_at),
      ].join(','));
    }

    for (const evt of reportPaymentEventsSnapshot) {
      lines.push([
        escapeCsv('payments'),
        escapeCsv('event_row'),
        escapeCsv(evt.order_id),
        escapeCsv(evt.receipt_id),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(evt.amount ?? ''),
        escapeCsv(evt.event_type),
        escapeCsv(evt.status),
        escapeCsv(evt.provider),
        escapeCsv(evt.transaction_id),
        escapeCsv(evt.source),
        escapeCsv(evt.event_time || evt.created_at),
      ].join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting-export-${reportDateIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported');
  };

  const exportDateRangeAccountingCsv = (
    fromDateIso: string,
    toDateIso: string,
    rangeOrdersSnapshot: Order[],
    rangePaymentEventsSnapshot: PaymentEventAudit[]
  ) => {
    const lines: string[] = [];
    lines.push('SECTION,TYPE,ORDER_ID,RECEIPT_ID,TABLE,STATUS,PAYMENT_STATUS,PAYMENT_TYPE,TOTAL,EVENT_TYPE,EVENT_STATUS,PROVIDER,TRANSACTION_ID,SOURCE,TIME');

    for (const order of rangeOrdersSnapshot) {
      lines.push([
        escapeCsv('orders'),
        escapeCsv('order_row'),
        escapeCsv(order.id),
        escapeCsv(order.receipt_id),
        escapeCsv(order.table_number),
        escapeCsv(order.status),
        escapeCsv(order.payment_status),
        escapeCsv(order.payment_type),
        escapeCsv(order.total.toFixed(2)),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(order.transaction_id),
        escapeCsv(''),
        escapeCsv(order.created_at),
      ].join(','));
    }

    for (const evt of rangePaymentEventsSnapshot) {
      lines.push([
        escapeCsv('payments'),
        escapeCsv('event_row'),
        escapeCsv(evt.order_id),
        escapeCsv(evt.receipt_id),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(''),
        escapeCsv(evt.amount ?? ''),
        escapeCsv(evt.event_type),
        escapeCsv(evt.status),
        escapeCsv(evt.provider),
        escapeCsv(evt.transaction_id),
        escapeCsv(evt.source),
        escapeCsv(evt.event_time || evt.created_at),
      ].join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting-export-${fromDateIso}-to-${toDateIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Date-range CSV exported');
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
    if (data) setMenuItems((data as MenuItem[]).map(withResolvedMenuImage));
  }, []);

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (data) setTables(data as RestaurantTable[]);
  }, []);

  const fetchPaymentEvents = useCallback(async () => {
    const { data } = await supabase
      .from('payment_event_audit')
      .select('*')
      .order('event_time', { ascending: false })
      .limit(120);

    if (data) setPaymentEvents(data as PaymentEventAudit[]);
  }, []);

  // Initial fetch & realtime
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOrders(); fetchMenu(); fetchTables(); fetchPaymentEvents();

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
    const paymentEventsSub = supabase.channel('payment-events-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'payment_event_audit' }, () => fetchPaymentEvents()).subscribe();

    return () => {
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(menuSub);
      supabase.removeChannel(tablesSub);
      supabase.removeChannel(paymentEventsSub);
    };
  }, [isAuthenticated, fetchOrders, fetchMenu, fetchTables, fetchPaymentEvents]);

  // Real-time payment modal updates
  useEffect(() => {
    if (!showPaymentModal) {
      setPaymentModalData(null);
      return;
    }

    // Set initial data
    setPaymentModalData(showPaymentModal);

    // Listen for real-time updates to this specific order
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
          setPaymentModalData(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentSub);
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
    await supabase.from('payment_event_audit').insert({
      order_id: showPaymentModal.id,
      receipt_id: showPaymentModal.receipt_id,
      provider: 'system',
      event_type: 'cash_payment_recorded',
      status: 'success',
      amount: showPaymentModal.total,
      currency: 'USD',
      transaction_id: showPaymentModal.receipt_id,
      source: 'admin-dashboard',
      event_time: new Date().toISOString(),
      raw_payload: { payment_type: 'direct_cash' },
    });
    showToast('Payment recorded!');
    setShowPaymentModal(null);
  };

  // Menu actions
  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !menuForm.category) {
      showToast('Please fill all fields', 'error'); return;
    }
    const normalizedName = menuForm.name.trim();
    const normalizedCategory = menuForm.category.trim();
    const data = {
      name: normalizedName,
      price: parseFloat(menuForm.price),
      category: normalizedCategory,
      image_url: menuForm.imageUrl.trim() || getDefaultMenuImage(normalizedName, normalizedCategory),
      available: editMenuItem ? editMenuItem.available : true,
    };
    try {
      if (editMenuItem) {
        const { error } = await supabase.from('menu_items').update(data).eq('id', editMenuItem.id);
        if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
      } else {
        const { error } = await supabase.from('menu_items').insert(data);
        if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
      }
      showToast(editMenuItem ? 'Item updated!' : 'Item added!');
      setShowMenuModal(false); setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '', imageUrl: '' });
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
  const todayCancelledOrders = todayOrders.filter(o => o.status === 'cancelled').length;
  const todayPaidOrders = todayOrders.filter(o => o.payment_status === 'paid');
  const avgOrderValue = todayPaidOrders.length > 0 ? todayRevenue / todayPaidOrders.length : 0;
  const paymentCaptureRate = todayOrders.length > 0 ? (todayPaidOrders.length / todayOrders.length) * 100 : 0;
  const onlinePaymentsToday = todayPaidOrders.filter(o => o.payment_type === 'chatbot_payment').length;
  const cashPaymentsToday = todayPaidOrders.filter(o => o.payment_type === 'direct_cash').length;
  const onlineAmountToday = todayPaidOrders
    .filter(o => o.payment_type === 'chatbot_payment')
    .reduce((sum, o) => sum + o.total, 0);
  const cashAmountToday = todayPaidOrders
    .filter(o => o.payment_type === 'direct_cash' || o.payment_method === 'cash')
    .reduce((sum, o) => sum + o.total, 0);
  const todayPaymentEvents = paymentEvents.filter(evt => new Date(evt.event_time || evt.created_at).toDateString() === new Date().toDateString());
  const selectedDayOrders = orders.filter(o => toIsoDay(new Date(o.created_at)) === selectedReportDate);
  const selectedDayPaidOrders = selectedDayOrders.filter(o => o.payment_status === 'paid');
  const selectedDayRevenue = selectedDayPaidOrders.reduce((sum, o) => sum + o.total, 0);
  const selectedDayCancelledOrders = selectedDayOrders.filter(o => o.status === 'cancelled').length;
  const selectedDayOnlineCount = selectedDayPaidOrders.filter(o => o.payment_type === 'chatbot_payment').length;
  const selectedDayCashCount = selectedDayPaidOrders.filter(o => o.payment_type === 'direct_cash' || o.payment_method === 'cash').length;
  const selectedDayOnlineAmount = selectedDayPaidOrders
    .filter(o => o.payment_type === 'chatbot_payment')
    .reduce((sum, o) => sum + o.total, 0);
  const selectedDayCashAmount = selectedDayPaidOrders
    .filter(o => o.payment_type === 'direct_cash' || o.payment_method === 'cash')
    .reduce((sum, o) => sum + o.total, 0);
  const selectedDayPaymentEvents = paymentEvents.filter(evt => toIsoDay(new Date(evt.event_time || evt.created_at)) === selectedReportDate);
  const rangeStartIso = reportFromDate <= reportToDate ? reportFromDate : reportToDate;
  const rangeEndIso = reportFromDate <= reportToDate ? reportToDate : reportFromDate;
  const rangeOrders = orders.filter(o => {
    const day = toIsoDay(new Date(o.created_at));
    return day >= rangeStartIso && day <= rangeEndIso;
  });
  const rangePaymentEvents = paymentEvents.filter(evt => {
    const day = toIsoDay(new Date(evt.event_time || evt.created_at));
    return day >= rangeStartIso && day <= rangeEndIso;
  });
  const topSellingItemsToday = (() => {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const order of todayOrders) {
      for (const item of order.items || []) {
        const existing = map.get(item.name) || { qty: 0, amount: 0 };
        map.set(item.name, {
          qty: existing.qty + item.quantity,
          amount: existing.amount + (item.price * item.quantity),
        });
      }
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  })();
  const hourlyTrend = (() => {
    const points = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));

    for (const order of todayOrders) {
      const hour = new Date(order.created_at).getHours();
      points[hour].orders += 1;
      if (order.payment_status === 'paid') {
        points[hour].revenue += order.total;
      }
    }

    const maxOrders = Math.max(1, ...points.map(point => point.orders));
    const maxRevenue = Math.max(1, ...points.map(point => point.revenue));

    return points.map(point => ({
      ...point,
      orderHeight: Math.max(8, Math.round((point.orders / maxOrders) * 100)),
      revenueHeight: Math.max(8, Math.round((point.revenue / maxRevenue) * 100)),
    }));
  })();
  
  // Estimated wait time based on pending/preparing orders
  const estimatedWaitMinutes = useMemo(() => {
    const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status));
    return Math.max(5, activeOrders.length * 8); // ~8 min per active order, min 5
  }, [orders]);

  // Separate waiter calls from regular orders
  useEffect(() => {
    const pendingCalls = orders
      .filter(o => o.receipt_id?.startsWith('CALL-') && o.status === 'pending')
      .filter(o => Date.now() - new Date(o.created_at).getTime() <= 1000 * 60 * 30)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const latestByTable = new Map<number, Order>();
    for (const call of pendingCalls) {
      if (!latestByTable.has(call.table_number)) {
        latestByTable.set(call.table_number, call);
      }
    }

    setWaiterCalls(Array.from(latestByTable.values()));
  }, [orders]);

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

  const orderTypeSummary = useMemo(() => {
    const addOnCount = filteredOrders.filter(isAddOnOrder).length;
    const newCount = filteredOrders.filter(isNewOrder).length;
    return { addOnCount, newCount };
  }, [filteredOrders]);

  const filteredPaymentEvents = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();

    return paymentEvents.filter(event => {
      const matchesSearch = !q
        || String(event.order_id || '').includes(q)
        || (event.receipt_id || '').toLowerCase().includes(q)
        || (event.event_type || '').toLowerCase().includes(q)
        || (event.source || '').toLowerCase().includes(q)
        || (event.transaction_id || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (orderTableFilter === 'all') return true;

      const orderMatch = orders.find(o => o.id === event.order_id);
      return orderMatch?.table_number.toString() === orderTableFilter;
    }).slice(0, 60);
  }, [paymentEvents, orderSearch, orderTableFilter, orders]);

  // Dismiss waiter call
  const dismissWaiterCall = async (call: Order) => {
    setWaiterCalls(prev => prev.filter(c => c.id !== call.id));
    const { error } = await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', call.id);
    if (error) {
      showToast('Could not acknowledge waiter call. Please retry.', 'error');
      return;
    }
    showToast('Waiter call acknowledged');
  };

  // Update theme on mount & every minute
  useEffect(() => {
    setTheme(getCurrentTheme());
    const interval = setInterval(() => setTheme(getCurrentTheme()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('admin_ui_tone') as AdminUiTone | null;
    if (stored === 'corporate' || stored === 'luxury' || stored === 'fintech') {
      setUiTone(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('admin_ui_tone', uiTone);
  }, [uiTone]);

  useEffect(() => {
    const fetchPaymentGatewayStatus = async () => {
      try {
        const res = await fetch('/api/payment/status');
        if (!res.ok) return;
        const data = await res.json() as PaymentGatewayStatus;
        setPaymentGatewayStatus(data);
      } catch {
        // Keep default fallback state.
      } finally {
        setPaymentGatewayLoading(false);
      }
    };

    fetchPaymentGatewayStatus();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBrandingSettings();
  }, [isAuthenticated, fetchBrandingSettings]);

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

  const toneOptions: Array<{ id: AdminUiTone; label: string }> = [
    { id: 'corporate', label: 'Corporate' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'fintech', label: 'Fintech' },
  ];

  return (
    <div className={`admin-shell admin-tone-${uiTone} min-h-screen text-white relative overflow-x-clip`}>
      <div className="admin-orb admin-orb-a" />
      <div className="admin-orb admin-orb-b" />
      <div className="admin-orb admin-orb-c" />
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
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/90 sticky top-0 z-40 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[74px] gap-3 sm:gap-5">
            {/* Site Name */}
            <div className="flex-shrink-0 flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-inner shadow-black/50">
                <Image src={companyProfile.logo} alt="Company logo" fill sizes="36px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base tracking-tight truncate" style={{ color: theme.primary }}>{companyProfile.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{companyProfile.subtitle} • {companyProfile.logoHint}</p>
              </div>
            </div>

            {/* Tampa Timezone Clock */}
            <div className="hidden md:flex flex-col items-center text-center">
              <p className="text-sm font-medium text-white">{currentDate}</p>
              <p className="text-lg font-bold" style={{ color: theme.primary }}>{currentTime} <span className="text-xs text-gray-400 font-normal">(Tampa, USA)</span></p>
            </div>

            {/* Horizontal Tabs */}
            <nav className="admin-nav flex items-center gap-1.5 sm:gap-2 overflow-x-auto px-1.5 py-1 rounded-xl border border-zinc-800/90 bg-zinc-900/70">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-zinc-800'
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
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Theme badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${theme.primary}1a`, color: theme.primary, border: `1px solid ${theme.primary}33` }}>
                <Sparkles className="w-3 h-3" />
                {theme.occasion === 'default' ? 'Classic' : theme.name}
              </div>
              <div className="hidden xl:flex items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1">
                {toneOptions.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => setUiTone(tone.id)}
                    className={`tone-chip px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-colors ${uiTone === tone.id ? 'is-active' : ''}`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
              {waiterCalls.length > 0 && (
                <div className="relative">
                  <PhoneCall className="w-5 h-5 text-orange-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">{waiterCalls.length}</span>
                </div>
              )}
              <button onClick={() => setShowQRModal(true)} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/90 border border-transparent hover:border-zinc-700/80">
                <QrCode className="w-5 h-5" />
                <span className="hidden lg:inline text-sm">QR Codes</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/90 border border-transparent hover:border-zinc-700/80">
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
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12 relative z-[1]">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-7">
            <div className="admin-panel rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Operations Hub</p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Executive Dashboard</h1>
                  <p className="text-sm text-gray-400 mt-1">Live orders, payments, and table operations in one clean workflow.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2">
                    <p className="text-[11px] text-gray-500 uppercase">Open Orders</p>
                    <p className="text-lg font-semibold text-white">{pendingOrders}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2">
                    <p className="text-[11px] text-gray-500 uppercase">Paid Today</p>
                    <p className="text-lg font-semibold text-emerald-300">{todayPaidOrders.length}</p>
                  </div>
                </div>
              </div>
              <div className="xl:hidden mt-4 flex flex-wrap items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Tone</p>
                <div className="flex items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1">
                  {toneOptions.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => setUiTone(tone.id)}
                      className={`tone-chip px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-colors ${uiTone === tone.id ? 'is-active' : ''}`}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Clock & Theme - Only shows on small screens */}
            <div className="md:hidden rounded-2xl p-4 text-center" style={{ background: `linear-gradient(to right, ${theme.primary}1a, ${theme.primaryDark || theme.primary}1a)`, border: `1px solid ${theme.primary}4d` }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" style={{ color: theme.primary }} />
                <span className="text-xs font-medium" style={{ color: theme.primary }}>{theme.name} Theme</span>
              </div>
              <p className="text-sm font-medium text-white">{currentDate}</p>
              <p className="text-xl font-bold" style={{ color: theme.primary }}>{currentTime}</p>
              <p className="text-xs text-gray-400">(Tampa, USA)</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 hover:border-zinc-600 transition-colors shadow-sm min-h-[118px]">
                <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center mb-2">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-gray-400 text-xs">Today&apos;s Orders</p>
                <p className="text-xl font-bold">{todayOrders.length}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 shadow-sm min-h-[118px]">
                <div className="w-8 h-8 bg-green-500/20 rounded-md flex items-center justify-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-gray-400 text-xs">Revenue</p>
                <p className="text-xl font-bold text-green-400">${todayRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 shadow-sm min-h-[118px]">
                <div className="w-8 h-8 bg-red-500/20 rounded-md flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-gray-400 text-xs">Pending</p>
                <p className="text-xl font-bold">{pendingOrders}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 shadow-sm min-h-[118px]">
                <div className="w-8 h-8 bg-purple-500/20 rounded-md flex items-center justify-center mb-2">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-gray-400 text-xs">Active Tables</p>
                <p className="text-xl font-bold">{activeTables}/{tables.length}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 shadow-sm min-h-[118px]">
                <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2" style={{ background: `${theme.primary}33` }}>
                  <Clock className="w-4 h-4" style={{ color: theme.primary }} />
                </div>
                <p className="text-gray-400 text-xs">Est. Wait</p>
                <p className="text-xl font-bold" style={{ color: theme.primary }}>{estimatedWaitMinutes}m</p>
              </div>
            </div>

            <div className="rounded-2xl border p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)]" style={{ borderColor: `${theme.primary}4d`, background: `${theme.primary}14` }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: theme.primary }}>Payment Gateway Readiness</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {paymentGatewayLoading
                      ? 'Checking gateway setup status...'
                      : (paymentGatewayStatus.anyProviderConfigured
                        ? `At least one gateway is enabled (${paymentGatewayStatus.mode} mode).`
                        : 'No online gateway keys detected. Cash flow stays fully active.')}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-md border ${paymentGatewayStatus.stripeConfigured ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-amber-300 border-amber-400/40 bg-amber-500/10'}`}>
                    Stripe: {paymentGatewayStatus.stripeConfigured ? 'Ready' : 'Setup Pending'}
                  </span>
                  <span className={`px-2 py-1 rounded-md border ${paymentGatewayStatus.paypalConfigured ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-amber-300 border-amber-400/40 bg-amber-500/10'}`}>
                    PayPal: {paymentGatewayStatus.paypalConfigured ? 'Ready' : 'Setup Pending'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Report Date</p>
                <p className="text-sm text-gray-300">{formatIsoDayLabel(selectedReportDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setSelectedReportDate(toIsoDay(d));
                  }}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs text-gray-200"
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setSelectedReportDate(toIsoDay(new Date()))}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs text-gray-200"
                >
                  Today
                </button>
                <input
                  type="date"
                  value={selectedReportDate}
                  onChange={(e) => setSelectedReportDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-gray-200"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Date Range Export</p>
                <p className="text-sm text-gray-300">{formatIsoDayLabel(rangeStartIso)} → {formatIsoDayLabel(rangeEndIso)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-gray-200"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-gray-200"
                />
                <button
                  onClick={() => exportDateRangeAccountingCsv(rangeStartIso, rangeEndIso, rangeOrders, rangePaymentEvents)}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs text-gray-200 font-semibold"
                >
                  Export Range CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowBrandingModal(true)}
                className="rounded-2xl border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-800 px-4 py-3 text-left transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="text-sm font-semibold">Company Branding</span>
                </div>
                <p className="text-xs text-gray-500">Edit logo URL and business name</p>
              </button>
              <button
                onClick={() => printDailyClosingReport(
                  selectedReportDate,
                  selectedDayOrders,
                  selectedDayPaidOrders,
                  selectedDayRevenue,
                  selectedDayCashCount,
                  selectedDayOnlineCount,
                  selectedDayCashAmount,
                  selectedDayOnlineAmount,
                  selectedDayCancelledOrders
                )}
                className="rounded-2xl border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-800 px-4 py-3 text-left transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Printer className="w-4 h-4 text-emerald-300" />
                  <span className="text-sm font-semibold">Print Closing (A4)</span>
                </div>
                <p className="text-xs text-gray-500">Selected day cash, online, and order summary</p>
              </button>
              <button
                onClick={() => exportTodayAccountingCsv(selectedReportDate, selectedDayOrders, selectedDayPaymentEvents)}
                className="rounded-2xl border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-800 px-4 py-3 text-left transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Download className="w-4 h-4 text-sky-300" />
                  <span className="text-sm font-semibold">Export Accountant CSV</span>
                </div>
                <p className="text-xs text-gray-500">Selected day orders + payment timeline</p>
              </button>
            </div>

            {/* Analytics KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Avg Ticket</p>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-300">{formatCurrency(avgOrderValue)}</p>
                <p className="text-xs text-gray-500 mt-1">Based on paid orders today</p>
              </div>

              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Payment Capture</p>
                  <DollarSign className="w-4 h-4 text-sky-400" />
                </div>
                <p className="text-2xl font-bold text-sky-300">{paymentCaptureRate.toFixed(0)}%</p>
                <p className="text-xs text-gray-500 mt-1">{todayPaidOrders.length}/{todayOrders.length || 0} orders paid</p>
              </div>

              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Online vs Cash</p>
                  <CreditCard className="w-4 h-4" style={{ color: theme.primary }} />
                </div>
                <p className="text-xl font-bold" style={{ color: theme.primary }}>{onlinePaymentsToday} online</p>
                <p className="text-xs text-gray-500 mt-1">{cashPaymentsToday} cash today</p>
              </div>

              <div className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Cancellations</p>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <p className="text-2xl font-bold text-rose-300">{todayCancelledOrders}</p>
                <p className="text-xs text-gray-500 mt-1">Keep this as low as possible</p>
              </div>
            </div>

            {/* Top selling dishes */}
            <div className="admin-panel rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Top Selling Dishes (Today)</h3>
                <span className="text-xs text-gray-500">Live from current day orders</span>
              </div>
              {topSellingItemsToday.length === 0 ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: `${theme.primary}22` }}>
                    <WandSparkles className="w-6 h-6" style={{ color: theme.primary }} />
                  </div>
                  <p className="text-sm font-semibold text-gray-200">No dish sales yet today</p>
                  <p className="text-xs text-gray-500 mt-1">Once orders arrive, your top-selling dishes will appear here automatically.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topSellingItemsToday.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between bg-zinc-900/70 border border-zinc-700 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">#{index + 1} {item.name}</p>
                        <p className="text-xs text-gray-500">Qty sold: {item.qty}</p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: theme.primary }}>{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mini hourly trend bars */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="admin-panel rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Orders Per Hour</h3>
                  <span className="text-xs text-gray-500">Today</span>
                </div>
                {todayOrders.length === 0 ? (
                  <div className="h-28 rounded-lg border border-zinc-700 bg-zinc-900/70 flex flex-col items-center justify-center text-center px-4">
                    <Clock className="w-6 h-6 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-300">No hourly order data yet</p>
                    <p className="text-xs text-gray-500 mt-1">Bars will animate in as your first orders come in.</p>
                  </div>
                ) : (
                  <div className="h-28 flex items-end gap-1">
                    {hourlyTrend.map(point => (
                      <div key={`orders-${point.hour}`} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                        <div className="w-full h-20 bg-zinc-900 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-sm"
                            style={{
                              height: `${point.orderHeight}%`,
                              background: `linear-gradient(to top, ${theme.primary}, ${theme.primaryDark})`,
                            }}
                            title={`${point.orders} order(s) at ${point.hour.toString().padStart(2, '0')}:00`}
                          />
                        </div>
                        <span className="text-[9px] text-gray-500">{point.hour % 3 === 0 ? point.hour.toString().padStart(2, '0') : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-panel rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Revenue Per Hour</h3>
                  <span className="text-xs text-gray-500">Paid orders only</span>
                </div>
                {todayPaidOrders.length === 0 ? (
                  <div className="h-28 rounded-lg border border-zinc-700 bg-zinc-900/70 flex flex-col items-center justify-center text-center px-4">
                    <DollarSign className="w-6 h-6 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-300">No paid revenue yet</p>
                    <p className="text-xs text-gray-500 mt-1">Revenue bars appear once first payment is recorded.</p>
                  </div>
                ) : (
                  <div className="h-28 flex items-end gap-1">
                    {hourlyTrend.map(point => (
                      <div key={`revenue-${point.hour}`} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                        <div className="w-full h-20 bg-zinc-900 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-sm bg-emerald-400"
                            style={{ height: `${point.revenueHeight}%` }}
                            title={`${formatCurrency(point.revenue)} at ${point.hour.toString().padStart(2, '0')}:00`}
                          />
                        </div>
                        <span className="text-[9px] text-gray-500">{point.hour % 3 === 0 ? point.hour.toString().padStart(2, '0') : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Waiter Calls Banner */}
            {waiterCalls.length > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl p-4">
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
              <button onClick={() => setShowQRModal(true)} className="bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-left transition-colors shadow-sm">
                <div className="w-8 h-8 bg-purple-500/20 rounded-md flex items-center justify-center mb-2">
                  <QrCode className="w-4 h-4 text-purple-400" />
                </div>
                <p className="font-medium text-sm">Print QR Codes</p>
                <p className="text-xs text-gray-500">For all tables</p>
              </button>
              <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '', imageUrl: '' }); setShowMenuModal(true); }} className="bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-left transition-colors shadow-sm">
                <div className="w-8 h-8 bg-green-500/20 rounded-md flex items-center justify-center mb-2">
                  <Plus className="w-4 h-4 text-green-400" />
                </div>
                <p className="font-medium text-sm">Add Menu Item</p>
                <p className="text-xs text-gray-500">New product</p>
              </button>
              <button onClick={() => setShowAddTableModal(true)} className="bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-left transition-colors shadow-sm">
                <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center mb-2">
                  <Grid3X3 className="w-4 h-4 text-blue-400" />
                </div>
                <p className="font-medium text-sm">Add Table</p>
                <p className="text-xs text-gray-500">New seating</p>
              </button>
              <button onClick={() => setActiveTab('orders')} className="bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-left transition-colors shadow-sm">
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
              <div className="admin-panel rounded-2xl p-4">
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
              <div className="admin-panel rounded-2xl p-4">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="admin-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h1 className="text-xl font-bold">Orders</h1>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Est. wait:</span>
                <span className="font-bold" style={{ color: theme.primary }}>{estimatedWaitMinutes} min</span>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="admin-panel rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-emerald-300/80">New Orders</p>
                <p className="text-2xl font-bold text-emerald-300">{orderTypeSummary.newCount}</p>
                <p className="text-xs text-emerald-200/70">First request from table</p>
              </div>
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-amber-300/80">Add-on Orders</p>
                <p className="text-2xl font-bold text-amber-300">{orderTypeSummary.addOnCount}</p>
                <p className="text-xs text-amber-200/70">Extra items after first order</p>
              </div>
            </div>

            <p className="text-xs text-gray-500">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found</p>

            <div className="admin-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Payment Event Timeline</h3>
                <span className="text-xs text-gray-500">Latest {filteredPaymentEvents.length} events</span>
              </div>

              {filteredPaymentEvents.length === 0 ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-sky-500/15 flex items-center justify-center mb-3">
                    <CreditCard className="w-6 h-6 text-sky-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-200">No payment events captured yet</p>
                  <p className="text-xs text-gray-500 mt-1">Run a test checkout or cash record action and the timeline will populate instantly.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                  {filteredPaymentEvents.map((event) => {
                    const orderForEvent = orders.find(o => o.id === event.order_id);
                    const statusClass = event.status === 'success'
                      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                      : event.status === 'failed'
                        ? 'text-rose-300 border-rose-500/40 bg-rose-500/10'
                        : event.status === 'received'
                          ? 'text-sky-300 border-sky-500/40 bg-sky-500/10'
                          : 'text-amber-300 border-amber-500/40 bg-amber-500/10';

                    return (
                      <div key={event.id} className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div>
                            <p className="text-sm font-semibold text-white">{event.event_type}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(event.event_time || event.created_at).toLocaleString()} • {event.source || 'unknown source'}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] uppercase ${statusClass}`}>{event.status}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs text-gray-300">
                          <p>Order: <span className="text-white">{event.order_id || '-'}</span></p>
                          <p>Table: <span className="text-white">{orderForEvent?.table_number || '-'}</span></p>
                          <p>Provider: <span className="text-white uppercase">{event.provider || '-'}</span></p>
                          <p>Amount: <span className="text-white">{event.amount ? formatCurrency(event.amount) : '-'}</span></p>
                        </div>

                        <div className="mt-1.5 grid grid-cols-1 xl:grid-cols-2 gap-2 text-xs text-gray-400">
                          <p className="truncate">Receipt: <span className="text-gray-200">{event.receipt_id || '-'}</span></p>
                          <p className="truncate">Transaction: <span className="text-gray-200">{event.transaction_id || '-'}</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="admin-panel rounded-2xl p-10 text-center">
                <ShoppingBag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <motion.div
                    key={order.id}
                    layout
                    className={`rounded-xl p-4 border ${isAddOnOrder(order) ? 'order-addon-card border-amber-500/40' : 'bg-zinc-800/95 border-zinc-700'}`}
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
                      <button onClick={() => printOrderBill(order)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Printer className="w-4 h-4" /> Print Bill
                      </button>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="admin-panel rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <h1 className="text-xl font-bold">Menu</h1>
              <button onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '', imageUrl: '' }); setShowMenuModal(true); }} className="px-4 py-2 text-black rounded-lg font-medium text-sm flex items-center gap-2 transition-colors" style={{ background: theme.primary }}>
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            
            {menuItems.length === 0 ? (
              <div className="admin-panel rounded-2xl p-10 text-center">
                <UtensilsCrossed className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No menu items yet</p>
                <button onClick={() => setShowMenuModal(true)} className="px-5 py-2 text-black rounded-lg font-medium text-sm" style={{ background: theme.primary }}>
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {menuItems.map(item => (
                  <motion.div key={item.id} layout className={`bg-zinc-800/95 border rounded-2xl p-3.5 shadow-sm ${item.available ? 'border-zinc-700' : 'border-red-700/30 opacity-60'}`}>
                    <div className="relative h-32 mb-3 rounded-lg overflow-hidden border border-zinc-700">
                      <Image
                        src={item.image_url || getDefaultMenuImage(item.name, item.category)}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>
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
                      <button onClick={() => { setEditMenuItem(item); setMenuForm({ name: item.name, price: item.price.toString(), category: item.category, imageUrl: item.image_url || '' }); setShowMenuModal(true); }} className="px-2 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="admin-panel rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <h1 className="text-xl font-bold">Tables</h1>
              <button onClick={() => setShowAddTableModal(true)} className="px-4 py-2 text-black rounded-lg font-medium text-sm flex items-center gap-2 transition-colors" style={{ background: theme.primary }}>
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </div>
            
            {tables.length === 0 ? (
              <div className="admin-panel rounded-2xl p-10 text-center">
                <Grid3X3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No tables configured</p>
                <button onClick={() => setShowAddTableModal(true)} className="px-5 py-2 text-black rounded-lg font-medium text-sm" style={{ background: theme.primary }}>
                  Add First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {tables.map(table => (
                  <motion.div key={table.id} layout className={`bg-zinc-800/95 border rounded-2xl p-3 text-center shadow-sm ${
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
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Photo URL</label>
                  <input
                    type="url"
                    value={menuForm.imageUrl}
                    onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={() => setMenuForm(prev => ({ ...prev, imageUrl: getDefaultMenuImage(prev.name || 'Dish', prev.category || 'Mains') }))}
                    className="mt-2 text-xs px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors"
                  >
                    Use Free Stock Food Photo
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
                  <div className="relative h-36 w-full">
                    <Image
                      src={menuForm.imageUrl || getDefaultMenuImage(menuForm.name || 'Dish', menuForm.category || 'Mains')}
                      alt="Dish preview"
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
                <button onClick={saveMenuItem} className="w-full py-3 text-black rounded-lg font-semibold transition-colors" style={{ background: theme.primary }}>
                  {editMenuItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branding Modal */}
      <AnimatePresence>
        {showBrandingModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-lg w-full">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Company Branding</h2>
                <button onClick={() => setShowBrandingModal(false)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Business Name</label>
                  <input
                    type="text"
                    value={brandingForm.name}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
                    placeholder="Your business name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Admin Subtitle</label>
                  <input
                    type="text"
                    value={brandingForm.subtitle}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, subtitle: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
                    placeholder="Admin Panel"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={brandingForm.logo}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, logo: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
                    placeholder="/icons/icon-192x192.png"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Logo Hint</label>
                  <input
                    type="text"
                    value={brandingForm.logoHint}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, logoHint: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
                    placeholder="Logo Placeholder"
                  />
                </div>
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                  <p className="text-xs text-gray-500 mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
                      <Image src={brandingForm.logo || DEFAULT_COMPANY_PROFILE.logo} alt="Brand preview" fill sizes="40px" className="object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{brandingForm.name || DEFAULT_COMPANY_PROFILE.name}</p>
                      <p className="text-xs text-gray-400">{brandingForm.subtitle || DEFAULT_COMPANY_PROFILE.subtitle}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={saveBrandingSettings}
                  disabled={savingBranding}
                  className="w-full py-3 text-black rounded-lg font-semibold transition-colors disabled:opacity-60"
                  style={{ background: theme.primary }}
                >
                  {savingBranding ? 'Saving...' : 'Save Branding'}
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
