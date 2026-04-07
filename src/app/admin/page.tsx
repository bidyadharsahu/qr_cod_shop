'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal, formatCurrency } from '@/lib/calculations';
import { getCurrentTheme, type AppTheme } from '@/lib/themes';
import type { Order, MenuItem, RestaurantTable, PaymentEventAudit } from '@/lib/types';
import { getDefaultMenuImage, withResolvedMenuImage } from '@/lib/menu-images';
import { clearAdminSession, readAdminSession } from '@/lib/tenant';
import { 
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid3X3, ShoppingCart, CircleDollarSign, ClipboardList, Timer, Eye, Table as TableIcon, 
  LogOut, Plus, QrCode, Bell, X, Check, ChefHat,
  DollarSign, Clock, Users, Trash2, Edit, Search,
  PhoneCall, Sparkles, AlertTriangle, TrendingUp, CreditCard, WandSparkles, Printer, Download, Palette, Zap
} from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface PaymentGatewayStatus {
  stripeConfigured: boolean;
  paypalConfigured: boolean;
  mode: 'sandbox' | 'live';
  anyProviderConfigured: boolean;
}

type AdminUiTone = 'corporate' | 'luxury' | 'fintech';
type StaffRole = 'manager' | 'chef' | 'restaurant_admin';

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
  const [staffRole, setStaffRole] = useState<StaffRole>('manager');
  const [staffUser, setStaffUser] = useState<string>('');
  const [restaurantId, setRestaurantId] = useState<number>(1);
  const [restaurantName, setRestaurantName] = useState<string>('Default Restaurant');
  const [restaurantPlan, setRestaurantPlan] = useState<'basic' | 'premium'>('premium');
  const [restaurantStatus, setRestaurantStatus] = useState<'active' | 'disabled'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventAudit[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'kitchen' | 'menu' | 'tables'>('dashboard');
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
  const [headerSearch, setHeaderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderTableFilter, setOrderTableFilter] = useState<string>('all');
  
  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [checkoutGateTable, setCheckoutGateTable] = useState<RestaurantTable | null>(null);
  const [checkoutGateReason, setCheckoutGateReason] = useState('');
  const [checkoutGateBlockingOrders, setCheckoutGateBlockingOrders] = useState<Order[]>([]);
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
  const syncIntervalRef = useRef<number | null>(null);
  const tableReconcileRef = useRef(false);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isAddOnOrder = (order: Order) => (order.customer_note || '').includes('ADD_ON_ORDER');
  const isNewOrder = (order: Order) => (order.customer_note || '').includes('NEW_ORDER');

  const extractGlobalKitchenNotes = useCallback((customerNote?: string | null) => {
    const note = customerNote || '';
    return {
      allergies: note.match(/ALLERGIES:\s*([^|]+)/i)?.[1]?.trim() || '',
      exclusions: note.match(/EXCLUDE:\s*([^|]+)/i)?.[1]?.trim() || '',
      spice: note.match(/SPICE:\s*([^|]+)/i)?.[1]?.trim() || '',
      notes: note.match(/NOTES:\s*([^|]+)/i)?.[1]?.trim() || '',
    };
  }, []);

  const getOrderKitchenRisk = useCallback((order: Order) => {
    const global = extractGlobalKitchenNotes(order.customer_note);
    const itemAllergyCount = (order.items || []).filter(item => item.allergy_alerts && item.allergy_alerts.length > 0).length;
    const hasGlobalAllergy = global.allergies.length > 0;
    const hasSpiceNote = global.spice.length > 0 || (order.items || []).some(item => Boolean(item.spice_level));
    const hasChefNote = global.notes.length > 0 || (order.items || []).some(item => Boolean(item.special_instructions));
    return {
      global,
      hasAllergy: hasGlobalAllergy || itemAllergyCount > 0,
      itemAllergyCount,
      hasSpiceNote,
      hasChefNote,
    };
  }, [extractGlobalKitchenNotes]);

  const getItemKitchenSummary = (item: Order['items'][number]) => {
    const notes: string[] = [];
    if (item.spice_level) notes.push(`Spice: ${item.spice_level}`);
    if (item.allergy_alerts && item.allergy_alerts.length > 0) notes.push(`Allergy: ${item.allergy_alerts.join(', ')}`);
    if (item.special_instructions) notes.push(item.special_instructions);
    return notes.join(' | ');
  };

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

    const kitchenRisk = getOrderKitchenRisk(order);
    const globalInstructionLines = [
      kitchenRisk.global.allergies && `Allergies: ${kitchenRisk.global.allergies}`,
      kitchenRisk.global.exclusions && `Exclusions: ${kitchenRisk.global.exclusions}`,
      kitchenRisk.global.spice && `Spice: ${kitchenRisk.global.spice}`,
      kitchenRisk.global.notes && `Notes: ${kitchenRisk.global.notes}`,
    ].filter(Boolean) as string[];

    const itemsHtml = (order.items || [])
      .map(item => {
        const perItemNotes: string[] = [];
        if (item.spice_level) perItemNotes.push(`Spice: ${item.spice_level}`);
        if (item.allergy_alerts && item.allergy_alerts.length > 0) perItemNotes.push(`Allergy: ${item.allergy_alerts.join(', ')}`);
        if (item.special_instructions) perItemNotes.push(item.special_instructions);
        return `
          <tr>
            <td>${item.quantity}x ${item.name}</td>
            <td style="text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
          ${perItemNotes.length > 0 ? `<tr><td colspan="2" class="item-note">${perItemNotes.join(' | ')}</td></tr>` : ''}
        `;
      })
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
            .item-note { font-size: 11px; color: #8b4513; padding: 2px 0 6px; }
            .kitchen-notes { margin-top: 10px; border: 1px solid #f4d1d1; background: #fff5f5; border-radius: 8px; padding: 8px; }
            .kitchen-notes h4 { margin: 0 0 6px; font-size: 12px; color: #a11; }
            .kitchen-notes p { margin: 3px 0; font-size: 12px; color: #5a1a1a; }
            .allergy-banner { margin-top: 10px; border: 2px solid #c31818; background: #fff0f0; border-radius: 10px; padding: 8px; font-weight: 700; color: #a10e0e; text-transform: uppercase; font-size: 12px; letter-spacing: 0.03em; }
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
          ${kitchenRisk.hasAllergy ? `<div class="allergy-banner">Allergy Alert: Follow allergy-safe prep protocol</div>` : ''}
          ${globalInstructionLines.length > 0 ? `
            <div class="kitchen-notes">
              <h4>Kitchen Instructions</h4>
              ${globalInstructionLines.map(line => `<p>${line}</p>`).join('')}
            </div>
          ` : ''}
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

  const estimatePrepMinutes = (order: Order) => {
    const qty = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
    return Math.max(10, qty * 4);
  };

  const printKitchenTicket = (order: Order) => {
    if (typeof window === 'undefined') return;

    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      showToast('Pop-up blocked. Please allow pop-ups to print kitchen ticket.', 'error');
      return;
    }

    const kitchenRisk = getOrderKitchenRisk(order);
    const globalInstructionLines = [
      kitchenRisk.global.allergies && `Allergies: ${kitchenRisk.global.allergies}`,
      kitchenRisk.global.exclusions && `Exclusions: ${kitchenRisk.global.exclusions}`,
      kitchenRisk.global.spice && `Spice: ${kitchenRisk.global.spice}`,
      kitchenRisk.global.notes && `Notes: ${kitchenRisk.global.notes}`,
    ].filter(Boolean) as string[];

    const itemsHtml = (order.items || [])
      .map(item => {
        const perItemNotes: string[] = [];
        if (item.spice_level) perItemNotes.push(`Spice: ${item.spice_level}`);
        if (item.allergy_alerts && item.allergy_alerts.length > 0) perItemNotes.push(`Allergy: ${item.allergy_alerts.join(', ')}`);
        if (item.special_instructions) perItemNotes.push(item.special_instructions);

        return `
          <tr>
            <td>${item.quantity}x</td>
            <td>${item.name}</td>
          </tr>
          ${perItemNotes.length > 0 ? `<tr><td></td><td class="item-note">${perItemNotes.join(' | ')}</td></tr>` : ''}
        `;
      })
      .join('');

    popup.document.write(`
      <html>
        <head>
          <title>Kitchen Ticket - ${order.receipt_id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 14px; color: #111; }
            .top { border-bottom: 2px dashed #444; margin-bottom: 8px; padding-bottom: 8px; }
            h2 { margin: 0; }
            p { margin: 3px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            td { padding: 6px 0; border-bottom: 1px dashed #bbb; font-size: 13px; }
            .item-note { font-size: 11px; color: #7a1f1f; padding: 2px 0 6px; }
            .kitchen-notes { margin-top: 10px; border: 1px solid #d7a7a7; background: #fff4f4; border-radius: 8px; padding: 8px; }
            .kitchen-notes h4 { margin: 0 0 6px; font-size: 12px; color: #8a1111; }
            .kitchen-notes p { margin: 3px 0; font-size: 12px; color: #651313; }
            .allergy-banner { margin-top: 10px; border: 2px solid #b40f0f; background: #ffe9e9; border-radius: 10px; padding: 8px; font-weight: 700; color: #7f0909; text-transform: uppercase; font-size: 12px; letter-spacing: 0.04em; }
            .eta { margin-top: 10px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="top">
            <h2>KITCHEN TICKET</h2>
            <p>Receipt: ${order.receipt_id}</p>
            <p>Table: ${order.table_number}</p>
            <p>Created: ${new Date(order.created_at).toLocaleString()}</p>
          </div>
          <table>
            ${itemsHtml}
          </table>
          ${kitchenRisk.hasAllergy ? `<div class="allergy-banner">Allergy Alert: separate tools and avoid cross-contact</div>` : ''}
          ${globalInstructionLines.length > 0 ? `
            <div class="kitchen-notes">
              <h4>Guest-Level Kitchen Instructions</h4>
              ${globalInstructionLines.map(line => `<p>${line}</p>`).join('')}
            </div>
          ` : ''}
          <p class="eta">Estimated prep: ${estimatePrepMinutes(order)} min</p>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const logPaymentFollowUp = async (order: Order, eventType: 'payment_followup_sent' | 'walkout_risk_flagged') => {
    await supabase.from('payment_event_audit').insert({
      restaurant_id: restaurantId,
      order_id: order.id,
      receipt_id: order.receipt_id,
      provider: 'system',
      event_type: eventType,
      status: 'received',
      amount: order.total,
      currency: 'USD',
      transaction_id: order.transaction_id,
      source: 'manager-dashboard',
      event_time: new Date().toISOString(),
      raw_payload: {
        table_number: order.table_number,
        payment_status: order.payment_status,
        order_status: order.status,
      },
    });
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const raw = value === null || value === undefined ? '' : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const fetchBrandingSettings = useCallback(async () => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('app_settings')
      .select('business_name, admin_subtitle, logo_url, logo_hint')
      .eq('restaurant_id', restaurantId)
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
  }, [restaurantId]);

  const saveBrandingSettings = async () => {
    setSavingBranding(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        business_name: brandingForm.name.trim() || DEFAULT_COMPANY_PROFILE.name,
        admin_subtitle: brandingForm.subtitle.trim() || DEFAULT_COMPANY_PROFILE.subtitle,
        logo_url: brandingForm.logo.trim() || DEFAULT_COMPANY_PROFILE.logo,
        logo_hint: brandingForm.logoHint.trim() || DEFAULT_COMPANY_PROFILE.logoHint,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'restaurant_id' });

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

    const reportHtml = `
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
              <p class="sub">Report Date: ${formatIsoDayLabel(reportDateIso)} | Printed: ${new Date().toLocaleString()} | ${companyProfile.logoHint}</p>
            </div>
          </div>
          <div class="grid">
            <div class="card"><h4>Total Orders</h4><p class="big">${reportOrdersSnapshot.length}</p></div>
            <div class="card"><h4>Total Paid Revenue</h4><p class="big">$${reportRevenueSnapshot.toFixed(2)}</p></div>
            <div class="card"><h4>Cash Payments</h4><p class="big">${reportCashCount} | $${reportCashAmount.toFixed(2)}</p></div>
            <div class="card"><h4>Online Payments</h4><p class="big">${reportOnlineCount} | $${reportOnlineAmount.toFixed(2)}</p></div>
          </div>
          <div class="card" style="margin-bottom: 12px;"><h4>Operational Summary</h4><p style="margin:0;">Paid orders: ${reportPaidOrdersSnapshot.length} | Cancelled: ${reportCancelledCount}</p></div>
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
    `;

    const popup = window.open('', '_blank', 'width=900,height=1200');
    if (!popup) {
      showToast('Pop-up blocked. Please allow pop-ups to print report.', 'error');
      return;
    }

    popup.document.write(reportHtml);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadDailyClosingReportA4 = (
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

    const reportHtml = `
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
              <p class="sub">Report Date: ${formatIsoDayLabel(reportDateIso)} | Exported: ${new Date().toLocaleString()} | ${companyProfile.logoHint}</p>
            </div>
          </div>
          <div class="grid">
            <div class="card"><h4>Total Orders</h4><p class="big">${reportOrdersSnapshot.length}</p></div>
            <div class="card"><h4>Total Paid Revenue</h4><p class="big">$${reportRevenueSnapshot.toFixed(2)}</p></div>
            <div class="card"><h4>Cash Payments</h4><p class="big">${reportCashCount} | $${reportCashAmount.toFixed(2)}</p></div>
            <div class="card"><h4>Online Payments</h4><p class="big">${reportOnlineCount} | $${reportOnlineAmount.toFixed(2)}</p></div>
          </div>
          <div class="card" style="margin-bottom: 12px;"><h4>Operational Summary</h4><p style="margin:0;">Paid orders: ${reportPaidOrdersSnapshot.length} | Cancelled: ${reportCancelledCount}</p></div>
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
    `;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-closing-report-${reportDateIso}-A4.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('A4 report downloaded (HTML)');
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

  // Auth check with tenant-scoped staff session
  useEffect(() => {
    const checkAuth = async () => {
      const session = readAdminSession();
      if (!session.authenticated) {
        router.push('/admin/login');
        return;
      }

      const nextRole: StaffRole = session.staffRole === 'chef' || session.staffRole === 'restaurant_admin'
        ? session.staffRole
        : 'manager';

      setStaffRole(nextRole);
      setStaffUser(session.staffUser || '');
      setRestaurantId(session.restaurantId);
      setRestaurantName(session.restaurantName || 'Default Restaurant');
      setIsAuthenticated(true);
      setActiveTab(nextRole === 'chef' ? 'kitchen' : 'dashboard');

      const { data } = await supabase
        .from('restaurants')
        .select('name, plan, status')
        .eq('id', session.restaurantId)
        .maybeSingle();

      if (data) {
        setRestaurantName((data.name || session.restaurantName || 'Default Restaurant').trim());
        setRestaurantPlan(data.plan === 'premium' ? 'premium' : 'basic');
        const nextStatus = data.status === 'disabled' ? 'disabled' : 'active';
        setRestaurantStatus(nextStatus);

        if (nextStatus === 'disabled') {
          clearAdminSession();
          router.push('/admin/login');
          return;
        }
      }

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
    if (!restaurantId) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
  }, [restaurantId]);

  const fetchMenu = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true });
    if (data) setMenuItems((data as MenuItem[]).map(withResolvedMenuImage));
  }, [restaurantId]);

  const fetchTables = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true });
    if (data) setTables(data as RestaurantTable[]);
  }, [restaurantId]);

  const fetchPaymentEvents = useCallback(async () => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('payment_event_audit')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('event_time', { ascending: false })
      .limit(120);

    if (data) setPaymentEvents(data as PaymentEventAudit[]);
  }, [restaurantId]);

  // Initial fetch & realtime
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOrders(); fetchMenu(); fetchTables(); fetchPaymentEvents();

    const ordersSub = supabase.channel(`orders-rt-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order;
          setNotifications(prev => [newOrder, ...prev]);
          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsffK3O5cR1Gga9zvPwm1IAAKrJ7fSxZgkAlbTY5rF6IwB4o9Lss3okAHGb0vK9gSwAYJHQ87WHLgBVitLyuYYsAFGF0fXAhhYAAI/W//bPZQAAoNz/+M1WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
          audio.play().catch(() => {});
          setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newOrder.id)), 30000);
        }
      }).subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchOrders();
        }
      });

    const menuSub = supabase
      .channel(`menu-rt-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_items',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => fetchMenu())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchMenu();
        }
      });

    const tablesSub = supabase
      .channel(`tables-rt-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurant_tables',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => fetchTables())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchTables();
        }
      });

    const paymentEventsSub = supabase
      .channel(`payment-events-rt-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_event_audit',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => fetchPaymentEvents())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchPaymentEvents();
        }
      });

    return () => {
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(menuSub);
      supabase.removeChannel(tablesSub);
      supabase.removeChannel(paymentEventsSub);
    };
  }, [isAuthenticated, restaurantId, fetchOrders, fetchMenu, fetchTables, fetchPaymentEvents]);

  useEffect(() => {
    if (!isAuthenticated || !restaurantId) return;

    const restaurantStatusSub = supabase
      .channel(`restaurant-status-${restaurantId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurants',
        filter: `id=eq.${restaurantId}`,
      }, (payload: any) => {
        const nextStatus = payload?.new?.status === 'disabled' ? 'disabled' : 'active';
        setRestaurantStatus(nextStatus);
        if (nextStatus === 'disabled') {
          clearAdminSession();
          router.push('/admin/login');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(restaurantStatusSub);
    };
  }, [isAuthenticated, restaurantId, router]);

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
      .channel(`order-payment-${restaurantId}-${showPaymentModal.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: any) => {
          const nextOrder = payload.new as Order;
          if (nextOrder.id === showPaymentModal.id) {
            setPaymentModalData(nextOrder);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentSub);
    };
  }, [showPaymentModal, restaurantId]);

  const handleLogout = () => {
    clearAdminSession();
    router.push('/admin/login');
  };

  // Order actions - NO WhatsApp redirect
  const confirmOrder = async (order: Order) => {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('restaurant_id', restaurantId);

    if (orderError) {
      showToast(`Error confirming order: ${orderError.message}`, 'error');
      return;
    }

    const { error: tableError } = await supabase
      .from('restaurant_tables')
      .update({ status: 'occupied', current_order_id: order.receipt_id })
      .eq('table_number', order.table_number)
      .eq('restaurant_id', restaurantId);

    if (tableError) {
      showToast(`Order confirmed, but table status failed: ${tableError.message}`, 'error');
      return;
    }

    setTables(prev => prev.map(t => (
      t.table_number === order.table_number
        ? { ...t, status: 'occupied', current_order_id: order.receipt_id }
        : t
    )));
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order confirmed!');
  };

  const cancelOrder = async (order: Order) => {
    await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('restaurant_id', restaurantId);
    setNotifications(prev => prev.filter(n => n.id !== order.id));
    showToast('Order cancelled', 'error');
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      showToast(`Error updating order: ${error.message}`, 'error');
      return;
    }

    showToast(`Order marked as ${status}`);
  };

  const sendOrderToKitchen = async (order: Order) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'preparing', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      showToast(`Error sending order to kitchen: ${error.message}`, 'error');
      return;
    }

    await supabase.from('payment_event_audit').insert({
      restaurant_id: restaurantId,
      order_id: order.id,
      receipt_id: order.receipt_id,
      provider: 'system',
      event_type: 'kitchen_ticket_printed',
      status: 'success',
      amount: order.total,
      currency: 'USD',
      transaction_id: order.transaction_id,
      source: 'manager-dashboard',
      event_time: new Date().toISOString(),
      raw_payload: {
        table_number: order.table_number,
        estimated_prep_minutes: estimatePrepMinutes(order),
      },
    });
    printKitchenTicket(order);
    showToast('Order sent to kitchen and ticket printed');
  };

  const handlePayment = async () => {
    if (!showPaymentModal) return;

    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'paid', payment_status: 'paid', payment_method: 'cash',
        payment_type: 'direct_cash'
      })
      .eq('id', showPaymentModal.id)
      .eq('restaurant_id', restaurantId);

    if (orderError) {
      showToast(`Could not record payment: ${orderError.message}`, 'error');
      return;
    }

    const { error: tableError } = await supabase
      .from('restaurant_tables')
      .update({ status: 'available', current_order_id: null })
      .eq('table_number', showPaymentModal.table_number)
      .eq('restaurant_id', restaurantId);

    if (tableError) {
      showToast(`Payment saved, but table release failed: ${tableError.message}`, 'error');
      return;
    }

    setTables(prev => prev.map(t => (
      t.table_number === showPaymentModal.table_number
        ? { ...t, status: 'available', current_order_id: null }
        : t
    )));

    await supabase.from('payment_event_audit').insert({
      restaurant_id: restaurantId,
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
      restaurant_id: restaurantId,
      name: normalizedName,
      price: parseFloat(menuForm.price),
      category: normalizedCategory,
      image_url: menuForm.imageUrl.trim() || getDefaultMenuImage(normalizedName, normalizedCategory),
      available: editMenuItem ? editMenuItem.available : true,
    };
    try {
      if (editMenuItem) {
        const { error } = await supabase
          .from('menu_items')
          .update(data)
          .eq('id', editMenuItem.id)
          .eq('restaurant_id', restaurantId);
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
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Item deleted');
    fetchMenu();
  };

  const toggleAvailability = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id)
      .eq('restaurant_id', restaurantId);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    fetchMenu();
  };

  // Table actions
  const addTable = async () => {
    const num = parseInt(tableNumberInput);
    if (isNaN(num) || num <= 0) { showToast('Invalid table number', 'error'); return; }
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .insert({ restaurant_id: restaurantId, table_number: num, status: 'available' });
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
    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Table deleted');
    fetchTables();
  };

  const updateTableStatus = async (id: number, status: string) => {
    const targetTable = tables.find(t => t.id === id);

    if (status === 'available' && targetTable) {
      const blocking = orders
        .filter(o => !o.receipt_id?.startsWith('CALL-'))
        .filter(o => o.table_number === targetTable.table_number)
        .filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled');

      if (blocking.length > 0) {
        setCheckoutGateTable(targetTable);
        setCheckoutGateReason('');
        setCheckoutGateBlockingOrders(blocking);
        showToast('Checkout gate: payment required before table can be available.', 'error');
        return;
      }
    }

    const nextStatus = status as RestaurantTable['status'];
    const fallbackLiveReceipt = targetTable
      ? (liveUnpaidOrderByTable.get(targetTable.table_number)?.receipt_id || null)
      : null;
    const nextCurrentOrderId = nextStatus === 'available'
      ? null
      : (targetTable?.current_order_id || fallbackLiveReceipt);

    const { error } = await supabase
      .from('restaurant_tables')
      .update({
        status: nextStatus,
        current_order_id: nextCurrentOrderId,
      })
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }

    setTables(prev => prev.map(table => (
      table.id === id
        ? {
            ...table,
            status: nextStatus,
            current_order_id: table.id === id ? nextCurrentOrderId : table.current_order_id,
          }
        : table
    )));
  };

  const applyCheckoutGateOverride = async () => {
    if (!checkoutGateTable) return;
    if (!canManage) {
      showToast('Only manager or restaurant admin can apply checkout override.', 'error');
      return;
    }

    const reason = checkoutGateReason.trim();
    if (!reason) {
      showToast('Override reason is required.', 'error');
      return;
    }

    const { error } = await supabase
      .from('restaurant_tables')
      .update({ status: 'available', current_order_id: null })
      .eq('id', checkoutGateTable.id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      showToast(`Error: ${error.message}`, 'error');
      return;
    }

    await supabase.from('payment_event_audit').insert({
      restaurant_id: restaurantId,
      order_id: checkoutGateBlockingOrders[0]?.id ?? null,
      receipt_id: checkoutGateBlockingOrders[0]?.receipt_id ?? null,
      provider: 'system',
      event_type: 'table_checkout_override',
      status: 'success',
      amount: checkoutGateBlockingOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      currency: 'USD',
      transaction_id: null,
      source: 'manager-dashboard',
      event_time: new Date().toISOString(),
      raw_payload: {
        table_number: checkoutGateTable.table_number,
        reason,
        staff_user: staffUser || 'manager',
        unpaid_order_ids: checkoutGateBlockingOrders.map(o => o.id),
        unpaid_receipts: checkoutGateBlockingOrders.map(o => o.receipt_id),
      },
    });

    setCheckoutGateTable(null);
    setCheckoutGateReason('');
    setCheckoutGateBlockingOrders([]);
    fetchTables();
    showToast('Manager override recorded and table released.');
  };

  const liveUnpaidOrderByTable = useMemo(() => {
    const openByTable = new Map<number, Order>();
    const sorted = [...orders]
      .filter(o => !o.receipt_id?.startsWith('CALL-'))
      .filter(o => o.payment_status !== 'paid' && !['cancelled', 'paid', 'completed'].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const order of sorted) {
      if (!openByTable.has(order.table_number)) {
        openByTable.set(order.table_number, order);
      }
    }

    return openByTable;
  }, [orders]);

  const effectiveTables = useMemo(() => {
    const orderByReceipt = new Map<string, Order>();
    for (const order of orders) {
      if (order.receipt_id) orderByReceipt.set(order.receipt_id, order);
    }

    return tables.map(table => {
      const liveOrder = liveUnpaidOrderByTable.get(table.table_number);
      if (liveOrder) {
        if (table.status === 'available' || table.current_order_id !== liveOrder.receipt_id) {
          return {
            ...table,
            status: 'occupied' as RestaurantTable['status'],
            current_order_id: liveOrder.receipt_id,
          };
        }
        return table;
      }

      if (table.status !== 'occupied' || !table.current_order_id) return table;

      const orderForCurrentReceipt = orderByReceipt.get(table.current_order_id);
      if (!orderForCurrentReceipt) return table;

      if (orderForCurrentReceipt.payment_status === 'paid' || ['cancelled', 'paid', 'completed'].includes(orderForCurrentReceipt.status)) {
        return {
          ...table,
          status: 'available' as RestaurantTable['status'],
          current_order_id: null,
        };
      }

      return table;
    });
  }, [tables, liveUnpaidOrderByTable, orders]);

  // Persist derived table occupancy so stale records self-heal after dropped events.
  useEffect(() => {
    if (!isAuthenticated || !restaurantId || tables.length === 0) return;
    if (tableReconcileRef.current) return;

    const pendingUpdates = effectiveTables
      .map((effectiveTable) => {
        const rawTable = tables.find((table) => table.id === effectiveTable.id);
        if (!rawTable) return null;
        if (rawTable.status === effectiveTable.status && rawTable.current_order_id === effectiveTable.current_order_id) {
          return null;
        }
        return {
          id: effectiveTable.id,
          status: effectiveTable.status,
          current_order_id: effectiveTable.current_order_id,
        };
      })
      .filter(Boolean) as Array<{ id: number; status: RestaurantTable['status']; current_order_id: string | null }>;

    if (pendingUpdates.length === 0) return;

    tableReconcileRef.current = true;

    const reconcile = async () => {
      try {
        await Promise.all(
          pendingUpdates.map((update) =>
            supabase
              .from('restaurant_tables')
              .update({
                status: update.status,
                current_order_id: update.current_order_id,
              })
              .eq('id', update.id)
              .eq('restaurant_id', restaurantId)
          )
        );
      } finally {
        tableReconcileRef.current = false;
      }
    };

    reconcile();
  }, [effectiveTables, isAuthenticated, restaurantId, tables]);

  // Stats
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => !o.receipt_id?.startsWith('CALL-') && o.status === 'pending').length;
  const activeTables = effectiveTables.filter(t => t.status !== 'available').length;
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

  const kitchenOrders = useMemo(() => {
    return orders
      .filter(o => !o.receipt_id?.startsWith('CALL-'))
      .filter(o => ['confirmed', 'preparing', 'served'].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders]);

  const unpaidOrders = useMemo(() => {
    return orders
      .filter(o => !o.receipt_id?.startsWith('CALL-'))
      .filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);

  const riskyUnpaidOrders = useMemo(() => {
    return unpaidOrders.filter(order => {
      const ageMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
      return order.status === 'served' || ageMinutes >= 45;
    });
  }, [unpaidOrders]);

  const orderTypeSummary = useMemo(() => {
    const addOnCount = filteredOrders.filter(isAddOnOrder).length;
    const newCount = filteredOrders.filter(isNewOrder).length;
    return { addOnCount, newCount };
  }, [filteredOrders]);

  const kitchenRiskSummary = useMemo(() => {
    let allergyAlertOrders = 0;
    let spiceNoteOrders = 0;
    let chefNoteOrders = 0;

    for (const order of filteredOrders) {
      const risk = getOrderKitchenRisk(order);
      if (risk.hasAllergy) allergyAlertOrders += 1;
      if (risk.hasSpiceNote) spiceNoteOrders += 1;
      if (risk.hasChefNote) chefNoteOrders += 1;
    }

    return { allergyAlertOrders, spiceNoteOrders, chefNoteOrders };
  }, [filteredOrders, getOrderKitchenRisk]);

  const kitchenQueueRiskSummary = useMemo(() => {
    let allergyAlertOrders = 0;
    let spiceNoteOrders = 0;

    for (const order of kitchenOrders) {
      const risk = getOrderKitchenRisk(order);
      if (risk.hasAllergy) allergyAlertOrders += 1;
      if (risk.hasSpiceNote) spiceNoteOrders += 1;
    }

    return { allergyAlertOrders, spiceNoteOrders };
  }, [kitchenOrders, getOrderKitchenRisk]);

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

  const latestOrderByTable = useMemo(() => {
    const tableMap = new Map<number, Order>();
    const sorted = [...orders]
      .filter(o => !o.receipt_id?.startsWith('CALL-'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const order of sorted) {
      if (!tableMap.has(order.table_number)) {
        tableMap.set(order.table_number, order);
      }
    }

    return tableMap;
  }, [orders]);

  // Fallback sync polling protects dashboard flow if websocket subscriptions drop.
  useEffect(() => {
    if (!isAuthenticated) return;

    syncIntervalRef.current = window.setInterval(() => {
      fetchOrders();
      fetchTables();
      fetchPaymentEvents();
    }, 12000);

    return () => {
      if (syncIntervalRef.current) {
        window.clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, fetchOrders, fetchTables, fetchPaymentEvents]);

  // Dismiss waiter call
  const dismissWaiterCall = async (call: Order) => {
    setWaiterCalls(prev => prev.filter(c => c.id !== call.id));
    const { error } = await supabase
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', call.id)
      .eq('restaurant_id', restaurantId);
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
        const res = await fetch(`/api/payment/status?restaurantId=${restaurantId}`, {
          headers: {
            'x-restaurant-id': String(restaurantId),
          },
        });
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
  }, [restaurantId]);

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

  const tabs = staffRole === 'chef'
    ? [
      { id: 'kitchen', label: 'Kitchen' },
    ]
    : [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'orders', label: 'Orders' },
      { id: 'kitchen', label: 'Kitchen' },
      { id: 'menu', label: 'Menu' },
      { id: 'tables', label: 'Tables' },
    ];

  const canManage = staffRole === 'manager' || staffRole === 'restaurant_admin';

  const toneOptions: Array<{ id: AdminUiTone; label: string }> = [
    { id: 'corporate', label: 'Corporate' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'fintech', label: 'Fintech' },
  ];

  return (
    <div className={`admin-shell vanguard-slate admin-tone-${uiTone} min-h-screen text-white relative overflow-x-clip`}>
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
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <PhoneCall className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">Waiter Needed</p>
                    <p className="text-white/90 text-lg font-bold">Table {call.table_number}</p>
                    <p className="text-white/60 text-xs">{new Date(call.created_at).toLocaleTimeString()}</p>
                  </div>
                  <button onClick={() => dismissWaiterCall(call)} className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors">
                    On it
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
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center">
                  <Bell className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                      <p className="font-bold text-white text-lg">{isAddOnOrder(notifications[0]) ? 'Add-on Order' : 'New Order'}</p>
                  <p className="text-sm text-white/80">Table {notifications[0].table_number}</p>
                  <p className="text-xs text-white/60 font-mono">{notifications[0].receipt_id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => cancelOrder(notifications[0])} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-bold">
                  Cancel
                </button>
                <button onClick={() => confirmOrder(notifications[0])} className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 text-green-600 rounded-lg transition-colors text-sm font-bold">
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with horizontal menu */}
      <header className="admin-topbar bg-[#131316]/95 border-b border-[#2a2a33] sticky top-0 z-40">
        <div className="admin-canvas max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[76px] gap-3 sm:gap-5">
            {/* Site Name */}
            <div className="flex-shrink-0 flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#3a3a45] bg-[#1f1f22]">
                <Image src={companyProfile.logo} alt="Company logo" fill sizes="36px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-xl tracking-tight truncate text-[#e4e1e6]">{companyProfile.name}</p>
                <p className="text-[10px] text-[#958da1] uppercase tracking-[0.14em] truncate">
                  {companyProfile.subtitle} | {restaurantName} | {restaurantPlan.toUpperCase()} | {restaurantStatus.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Horizontal Tabs */}
            <nav className="admin-nav flex-1 min-w-0 flex items-center gap-2 sm:gap-5 overflow-x-auto px-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`admin-nav-link px-2.5 sm:px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap border-b-2 rounded-lg ${
                    activeTab === tab.id 
                      ? 'is-active text-white border-current' 
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                  style={activeTab === tab.id ? { color: theme.primary } : {}}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'orders' && pendingOrders > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">{pendingOrders}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="hidden xl:flex items-center gap-3 border-l border-[#2a2a33] pl-3">
              {toneOptions.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setUiTone(tone.id)}
                  className={`tone-chip admin-nav-link px-2 py-2 text-xs font-semibold uppercase tracking-[0.12em] border-b-2 ${
                    uiTone === tone.id ? 'is-active text-white border-current' : 'text-gray-500 border-transparent hover:text-white'
                  }`}
                  style={uiTone === tone.id ? { color: theme.primary } : {}}
                >
                  {tone.label}
                </button>
              ))}
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="hidden lg:flex items-center w-44 xl:w-52 h-10 rounded-xl border border-[#3b3450] bg-[#0e0e11] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus-within:border-[#7c3aed] focus-within:ring-1 focus-within:ring-[#7c3aed]/35 transition-all">
                <Search className="w-4 h-4 text-[#958da1] mr-2.5" />
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder="Global search..."
                  className="w-full bg-transparent border-0 p-0 text-sm text-[#e4e1e6] placeholder-[#6b6478] focus:outline-none"
                />
              </div>
              {waiterCalls.length > 0 && (
                <div className="relative">
                  <PhoneCall className="w-5 h-5 text-orange-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">{waiterCalls.length}</span>
                </div>
              )}
              <button onClick={() => setShowQRModal(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#958da1] hover:text-white hover:bg-[#1f1f22] transition-colors">
                <QrCode className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#958da1] hover:text-white hover:bg-[#1f1f22] transition-colors" title="Log Out">
                <LogOut className="w-5 h-5" />
              </button>
              <div className="hidden sm:block h-6 w-px bg-[#2a2a33]" />
              <div className="flex items-center gap-2 rounded-xl border border-[#2a2a33] bg-[#111118] px-3 py-1.5">
                <div className="text-right leading-tight">
                  <p className="text-[11px] text-[#9f97b2]">Tampa, FL</p>
                  <p className="text-xs font-semibold text-[#e4e1e6]">{currentDate}</p>
                  <p className="text-xs font-bold" style={{ color: theme.primary }}>{currentTime}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-canvas max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-14 relative z-[1]">
                {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 text-[#e4e1e6]">
            <section className="flex justify-end items-center">
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    fetchOrders();
                    fetchMenu();
                    fetchTables();
                    fetchPaymentEvents();
                    showToast('Force sync completed');
                  }}
                  className="px-6 py-2.5 bg-[#7c3aed] text-[#ede0ff] rounded-xl text-sm font-bold shadow-lg shadow-[#7c3aed]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Zap size={16} fill="currentColor" />
                  Force Sync
                </button>
              </div>
            </section>

            {/* Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Today's Orders */}
              <div className="admin-metric-card bg-[#1b1b1e] p-5 rounded-xl relative min-h-[118px] group transition-all hover:bg-[#1f1f22]">
                <div className="absolute right-3 bottom-3 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity pointer-events-none">
                  <ShoppingCart size={74} />
                </div>
                <div className="relative z-10">
                  <p className="text-[#958da1] text-[10px] font-bold uppercase tracking-widest mb-1">Today's Orders</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-[#e4e1e6]">{todayOrders.length}</h3>
                    <span className="text-xs font-medium text-[#4edea3]">+Live</span>
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="admin-metric-card bg-[#1b1b1e] p-5 rounded-xl relative min-h-[118px] group transition-all hover:bg-[#1f1f22]">
                <div className="absolute right-3 bottom-3 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity pointer-events-none">
                  <CircleDollarSign size={74} />
                </div>
                <div className="relative z-10">
                  <p className="text-[#958da1] text-[10px] font-bold uppercase tracking-widest mb-1">Revenue</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-[#e4e1e6]">
                      {formatCurrency(todayRevenue)}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Pending */}
              <div className="admin-metric-card bg-[#1b1b1e] border-l-2 border-[#ffb95f]/30 p-5 rounded-xl relative min-h-[118px] group transition-all hover:bg-[#1f1f22]">
                <div className="absolute right-3 bottom-3 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity pointer-events-none">
                  <ClipboardList size={74} />
                </div>
                <div className="relative z-10">
                  <p className="text-[#958da1] text-[10px] font-bold uppercase tracking-widest mb-1">Pending</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-[#ffb95f]">{pendingOrders}</h3>
                  </div>
                </div>
              </div>

              {/* Active Tables */}
              <div className="admin-metric-card bg-[#1b1b1e] p-5 rounded-xl relative min-h-[118px] group transition-all hover:bg-[#1f1f22]">
                <div className="absolute right-3 bottom-3 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity pointer-events-none">
                  <TableIcon size={74} />
                </div>
                <div className="relative z-10">
                  <p className="text-[#958da1] text-[10px] font-bold uppercase tracking-widest mb-1">Active Tables</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-[#e4e1e6]">{activeTables}/{tables.length}</h3>
                  </div>
                </div>
              </div>

              {/* Est. Wait */}
              <div className="admin-metric-card bg-[#1b1b1e] p-5 rounded-xl relative min-h-[118px] group transition-all hover:bg-[#1f1f22]">
                <div className="absolute right-3 bottom-3 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity pointer-events-none">
                  <Timer size={74} />
                </div>
                <div className="relative z-10">
                  <p className="text-[#958da1] text-[10px] font-bold uppercase tracking-widest mb-1">Est. Wait</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-[#e4e1e6]">{estimatedWaitMinutes}m</h3>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-panel rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#e4e1e6]">Accounting Exports</h3>
                  <p className="text-xs text-[#958da1] mt-1">Download CSV and A4 closing reports by date or date range.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#4edea3]/30 bg-[#1b1b1e]/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="text-sm font-semibold text-[#e4e1e6]">Daily Report</h4>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4edea3]">Single Day</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[130px_minmax(0,1fr)] items-center gap-2 md:gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-[#958da1]">Report Date</label>
                      <input
                        type="date"
                        value={selectedReportDate}
                        onChange={(e) => setSelectedReportDate(e.target.value)}
                        className="admin-input w-full px-3 py-2 text-sm text-[#e4e1e6] focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-[#4edea3] mt-2 font-medium">{formatIsoDayLabel(selectedReportDate)}</p>
                    <p className="text-[11px] text-[#958da1] mt-1">Used by Daily CSV and Print/Download A4 actions.</p>
                  </div>

                  <div className="rounded-xl border border-[#4a4455]/35 bg-[#1b1b1e]/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="text-sm font-semibold text-[#e4e1e6]">Date Range Report</h4>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#958da1]">From - To</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[130px_minmax(0,1fr)] items-center gap-2 md:gap-3 mb-2">
                      <label className="text-[10px] uppercase tracking-widest text-[#958da1]">From</label>
                      <input
                        type="date"
                        value={reportFromDate}
                        onChange={(e) => setReportFromDate(e.target.value)}
                        className="admin-input w-full px-3 py-2 text-sm text-[#e4e1e6] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[130px_minmax(0,1fr)] items-center gap-2 md:gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-[#958da1]">To</label>
                      <input
                        type="date"
                        value={reportToDate}
                        onChange={(e) => setReportToDate(e.target.value)}
                        className="admin-input w-full px-3 py-2 text-sm text-[#e4e1e6] focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-[#958da1] mt-2">
                      Effective range: <span className="text-[#e4e1e6] font-medium">{formatIsoDayLabel(rangeStartIso)}</span> to <span className="text-[#e4e1e6] font-medium">{formatIsoDayLabel(rangeEndIso)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => exportTodayAccountingCsv(selectedReportDate, selectedDayOrders, selectedDayPaymentEvents)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1f1f22] border border-[#4a4455]/20 text-[#e4e1e6] hover:bg-[#2a2a2d] flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Daily CSV
                </button>
                <button
                  onClick={() => exportDateRangeAccountingCsv(rangeStartIso, rangeEndIso, rangeOrders, rangePaymentEvents)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1f1f22] border border-[#4a4455]/20 text-[#e4e1e6] hover:bg-[#2a2a2d] flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Range CSV
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
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#7c3aed] text-[#ede0ff] hover:brightness-110 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print A4
                </button>
                <button
                  onClick={() => downloadDailyClosingReportA4(
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
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#4edea3] text-[#003824] hover:brightness-110 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download A4
                </button>
              </div>
            </section>

            {/* Bento Grid */}
            <div className="grid grid-cols-12 gap-5">
              {/* Unpaid Risk Monitor */}
              <section className="col-span-12 lg:col-span-8 bg-[#1b1b1e] rounded-xl overflow-hidden flex flex-col border border-[#4a4455]/10">
                <div className="px-8 py-6 flex justify-between items-center border-b border-[#4a4455]/5">
                  <div>
                    <h3 className="text-lg font-bold text-[#e4e1e6]">Unpaid Risk Monitor</h3>
                    <p className="text-xs text-[#958da1]">High priority monitoring for served, uncollected bills.</p>
                  </div>
                  <span className="px-3 py-1 bg-[#ffb4ab]/10 text-[#ffb4ab] text-[10px] font-bold uppercase tracking-tighter rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#ffb4ab] rounded-full animate-pulse"></span>
                    {orders.filter(o => o.status === 'served' && o.payment_status !== 'paid').length} Alerts
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="admin-table-shell w-full text-left">
                    <thead className="bg-[#353438]/30">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#958da1]">Order ID</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#958da1]">Table</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#958da1]">Time Elapsed</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#958da1]">Status</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#958da1] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#4a4455]/5">
                      {orders.filter(o => o.status === 'served' && o.payment_status !== 'paid').length > 0 ? (
                        orders.filter(o => o.status === 'served' && o.payment_status !== 'paid').map(order => (
                          <tr key={order.id} className="hover:bg-[#1f1f22]/50 transition-colors">
                            <td className="px-8 py-5 font-mono text-xs text-[#d2bbff] font-bold">#ORD-{String(order.id).slice(0, 4).toUpperCase()}</td>
                            <td className="px-8 py-5 text-sm font-medium">Table {order.table_number}</td>
                            <td className="px-8 py-5 text-sm text-[#e4e1e6]">
                              {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)}m
                              {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000) > 40 && <span className="text-[#ffb4ab] text-xs ml-2 font-bold">Overdue</span>}
                            </td>
                            <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-[#ffb95f]/10 text-[#ffb95f] text-[10px] font-bold uppercase tracking-widest rounded-md">
                                {order.status}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right space-x-4 flex justify-end">
                              <button onClick={() => { setPaymentModalData(order); setShowPaymentModal(order); }} className="text-[10px] font-bold uppercase tracking-widest text-[#4edea3] hover:underline">Record Payment</button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-10 text-center text-sm text-[#958da1]">No risky unpaid orders detected. You are clear.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Table Status Grid */}
              <section className="col-span-12 lg:col-span-4 bg-[#1b1b1e] rounded-xl p-8 border border-[#4a4455]/10">
                <h3 className="text-lg font-bold text-[#e4e1e6] mb-6 flex justify-between items-center">
                  Table Status Grid
                  <button onClick={() => setShowAddTableModal(true)} className="text-xs font-normal text-[#958da1] hover:text-[#d2bbff] flex items-center gap-1 transition-colors">
                    <Plus size={14} /> Add Table
                  </button>
                </h3>
                <div className="grid grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {effectiveTables.map((table) => {
                     const isAvailable = table.status === 'available';
                     return (
                      <div 
                        key={table.id}
                        className={`aspect-square rounded-xl bg-[#353438]/20 border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${isAvailable ? "border-[#4edea3]/20 hover:bg-[#4edea3]/10" : "border-[#ffb4ab]/20 hover:bg-[#ffb4ab]/10"}`}
                      >
                        <span className="text-2xl font-black text-[#e4e1e6]">{table.table_number}</span>
                        <span className={`text-[9px] uppercase tracking-widest font-bold ${isAvailable ? "text-[#4edea3]" : "text-[#ffb4ab]"}`}>
                          {table.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Chart Section */}
              <section className="col-span-12 lg:col-span-7 bg-[#1b1b1e] rounded-xl p-8 h-[320px] flex flex-col border border-[#4a4455]/10">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-[#e4e1e6]">Orders & Revenue Per Hour</h3>
                    <p className="text-xs text-[#958da1]">Real-time performance distribution across shift.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-[#7c3aed] rounded-full"></span>
                      <span className="text-[10px] uppercase font-bold text-[#958da1]">Orders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-[#4edea3] rounded-full"></span>
                      <span className="text-[10px] uppercase font-bold text-[#958da1]">Revenue</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 w-full relative">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-[#958da1] text-sm font-medium z-10 opacity-50">Chart active with live data</p>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                        return [12, 13, 14, 15, 16, 17, 18, 19].map((h) => {
                          const point = hourlyTrend[h];
                          return {
                            hour: `${h > 12 ? h - 12 : h} PM`,
                            orders: point?.orders ?? 0,
                            revenue: point?.revenue ?? 0,
                          };
                        });
                    })()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4A4455" opacity={0.1} />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#958da1', fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'rgba(210, 187, 255, 0.05)' }} contentStyle={{ backgroundColor: '#1F1F22', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="orders" fill="#7c3aed" radius={[2, 2, 0, 0]} barSize={32}>
                        {Array.from({length: 8}).map((_, index) => <Cell key={`cell-orders-${index}`} fillOpacity={0.6} className="hover:fill-opacity-100 transition-all cursor-pointer" />)}
                      </Bar>
                      <Bar dataKey="revenue" fill="#4edea3" radius={[2, 2, 0, 0]} barSize={32}>
                        {Array.from({length: 8}).map((_, index) => <Cell key={`cell-revenue-${index}`} fillOpacity={0.6} className="hover:fill-opacity-100 transition-all cursor-pointer" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Quick Actions Grid */}
              <section className="col-span-12 lg:col-span-5 bg-[#1b1b1e] border border-[#4a4455]/10 rounded-xl p-5 sm:p-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#e4e1e6] mb-1">Quick Actions</h3>
                  <p className="text-xs text-[#958da1]">Management shortcuts and rapid tools.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 auto-rows-fr">
                  <button onClick={() => setShowQRModal(true)} className="p-4 rounded-xl flex flex-col items-start justify-between min-h-[108px] gap-3 transition-all border border-[#4a4455]/10 bg-[#1f1f22] hover:bg-[#2a2a2d] group">
                    <div className="p-2 rounded-lg group-hover:scale-110 transition-transform text-[#d2bbff] bg-[#d2bbff]/10"><QrCode size={20} /></div>
                    <span className="text-sm font-bold text-[#e4e1e6]">Print QR Codes</span>
                  </button>
                  <button onClick={() => setShowMenuModal(true)} className="p-4 rounded-xl flex flex-col items-start justify-between min-h-[108px] gap-3 transition-all border border-[#4a4455]/10 bg-[#1f1f22] hover:bg-[#2a2a2d] group">
                    <div className="p-2 rounded-lg group-hover:scale-110 transition-transform text-[#4edea3] bg-[#4edea3]/10"><Plus size={20} /></div>
                    <span className="text-sm font-bold text-[#e4e1e6]">Add Menu Item</span>
                  </button>
                  <button onClick={() => setShowAddTableModal(true)} className="p-4 rounded-xl flex flex-col items-start justify-between min-h-[108px] gap-3 transition-all border border-[#4a4455]/10 bg-[#1f1f22] hover:bg-[#2a2a2d] group">
                    <div className="p-2 rounded-lg group-hover:scale-110 transition-transform text-[#ffb95f] bg-[#ffb95f]/10"><TableIcon size={20} /></div>
                    <span className="text-sm font-bold text-[#e4e1e6]">Add Table</span>
                  </button>
                  <button onClick={() => setActiveTab('orders')} className="p-4 rounded-xl flex flex-col items-start justify-between min-h-[108px] gap-3 transition-all border border-[#4a4455]/10 bg-[#7c3aed] hover:brightness-110 shadow-lg shadow-[#7c3aed]/20 group">
                    <div className="p-2 rounded-lg group-hover:scale-110 transition-transform bg-[#ede0ff]/10 text-[#ede0ff]"><Eye size={20} /></div>
                    <span className="text-sm font-bold text-[#ede0ff]">View Orders</span>
                  </button>
                </div>
              </section>

            </div>
          </div>
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
                  {effectiveTables.map(t => (
                  <option key={t.id} value={t.table_number.toString()}>Table {t.table_number}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-rose-300/80">Allergy Alerts</p>
                <p className="text-2xl font-bold text-rose-300">{kitchenRiskSummary.allergyAlertOrders}</p>
                <p className="text-xs text-rose-200/70">Require allergy-safe prep</p>
              </div>
            </div>

            <p className="text-xs text-gray-500">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found</p>

            <div className="admin-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Payment Tracking Board</h3>
                <span className="text-xs text-gray-500">Live unpaid monitoring</span>
              </div>
              {unpaidOrders.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-sm font-semibold text-emerald-200">All clear. No unpaid open orders right now.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {unpaidOrders.slice(0, 12).map(order => {
                    const ageMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                    return (
                      <div key={`unpaid-${order.id}`} className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-gray-200">
                          {order.receipt_id} | Table {order.table_number} | {order.status} | {ageMin} min open
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowPaymentModal(order)}
                            className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-black"
                            style={{ background: theme.primary }}
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => {
                              void logPaymentFollowUp(order, 'payment_followup_sent');
                              showToast('Payment follow-up logged');
                            }}
                            className="px-2.5 py-1.5 rounded-md text-xs border border-zinc-600 text-gray-200 bg-zinc-800"
                          >
                            Log Follow-up
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                              {new Date(event.event_time || event.created_at).toLocaleString()} | {event.source || 'unknown source'}
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
                {filteredOrders.map(order => {
                  const kitchenRisk = getOrderKitchenRisk(order);
                  return (
                  <motion.div
                    key={order.id}
                    layout
                    className={`rounded-xl p-4 border ${kitchenRisk.hasAllergy ? 'border-rose-500/60 bg-rose-950/10' : isAddOnOrder(order) ? 'order-addon-card border-amber-500/40' : 'bg-zinc-800/95 border-zinc-700'}`}
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
                          {kitchenRisk.hasAllergy && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-200 border border-rose-400/70 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> ALLERGY ALERT
                            </span>
                          )}
                          {kitchenRisk.hasSpiceNote && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-200 border border-orange-400/50">SPICE NOTE</span>
                          )}
                          {kitchenRisk.hasChefNote && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-200 border border-sky-400/40">CHEF NOTE</span>
                          )}
                        </div>
                        <p className="text-xl font-bold" style={{ color: theme.primary }}>{order.receipt_id}</p>
                        <p className="text-gray-400">Table {order.table_number} | {new Date(order.created_at).toLocaleString()}</p>
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
                      {order.items?.map((item, idx) => {
                        const itemSummary = getItemKitchenSummary(item);
                        return (
                          <div key={idx} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm">
                            <p>{item.quantity}x {item.name}</p>
                            {itemSummary && <p className="text-[11px] text-amber-300 mt-1">{itemSummary}</p>}
                          </div>
                        );
                      })}
                    </div>

                    {kitchenRisk.global.allergies && (
                      <div className="mb-4 rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-100 uppercase tracking-wide">Allergy Alert</p>
                        <p className="text-sm text-rose-50 mt-0.5">{kitchenRisk.global.allergies}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => printOrderBill(order)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Printer className="w-4 h-4" /> Print Bill
                      </button>
                      {canManage && order.status === 'pending' && (
                        <>
                          <button onClick={() => confirmOrder(order)} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Check className="w-4 h-4" /> Confirm
                          </button>
                          <button onClick={() => cancelOrder(order)} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <X className="w-4 h-4" /> Cancel
                          </button>
                        </>
                      )}
                      {canManage && order.status === 'confirmed' && (
                        <button onClick={() => sendOrderToKitchen(order)} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                          <Printer className="w-4 h-4" /> Send to Kitchen
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button onClick={() => updateOrderStatus(order.id, 'served')} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors">
                          Served
                        </button>
                      )}
                      {canManage && order.payment_status !== 'paid' && order.status !== 'pending' && (
                        <button onClick={() => setShowPaymentModal(order)} className="px-4 py-2 text-black rounded-lg text-sm font-medium transition-colors" style={{ background: theme.primary }}>
                          Record Cash Payment
                        </button>
                      )}
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Kitchen Tab */}
        {activeTab === 'kitchen' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="admin-panel rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Kitchen Queue</h1>
                <p className="text-xs text-gray-400 mt-1">Chef-focused view with only live kitchen orders.</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-400/60 bg-rose-500/20 text-rose-100">Allergy Alerts: {kitchenQueueRiskSummary.allergyAlertOrders}</span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-orange-400/50 bg-orange-500/20 text-orange-100">Spice Notes: {kitchenQueueRiskSummary.spiceNoteOrders}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Active tickets</p>
                <p className="text-2xl font-bold" style={{ color: theme.primary }}>{kitchenOrders.length}</p>
              </div>
            </div>

            {kitchenOrders.length === 0 ? (
              <div className="admin-panel rounded-2xl p-10 text-center">
                <ChefHat className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No kitchen orders right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {kitchenOrders.map(order => {
                  const ageMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                  const kitchenRisk = getOrderKitchenRisk(order);
                  return (
                    <div key={`kitchen-${order.id}`} className={`admin-panel rounded-2xl p-4 border ${kitchenRisk.hasAllergy ? 'border-rose-500/70 bg-rose-950/10' : 'border-zinc-700/80'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-lg font-bold" style={{ color: theme.primary }}>{order.receipt_id}</p>
                          <p className="text-sm text-gray-300">Table {order.table_number} | {order.status.toUpperCase()}</p>
                          <p className="text-xs text-gray-500 mt-1">Queued {ageMin} min ago | ETA {estimatePrepMinutes(order)} min</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {kitchenRisk.hasAllergy && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-400/70 bg-rose-500/20 text-rose-100 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> ALLERGY ALERT
                              </span>
                            )}
                            {kitchenRisk.hasSpiceNote && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-orange-400/50 bg-orange-500/20 text-orange-100">SPICE NOTE</span>
                            )}
                            {kitchenRisk.hasChefNote && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-sky-400/40 bg-sky-500/15 text-sky-100">CHEF NOTE</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' :
                          order.status === 'preparing' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {(order.items || []).map((item, idx) => {
                          const itemSummary = getItemKitchenSummary(item);
                          return (
                            <div key={`${order.id}-${idx}`} className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-sm">
                              <p>{item.quantity}x {item.name}</p>
                              {itemSummary && <p className="text-[11px] text-amber-300 mt-1">{itemSummary}</p>}
                            </div>
                          );
                        })}
                      </div>

                      {kitchenRisk.global.allergies && (
                        <div className="mb-3 rounded-lg border border-rose-500/60 bg-rose-500/20 px-3 py-2">
                          <p className="text-xs uppercase font-semibold tracking-wide text-rose-100">Allergy Alert</p>
                          <p className="text-sm text-rose-50 mt-0.5">{kitchenRisk.global.allergies}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {order.status === 'confirmed' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-500 hover:bg-purple-600"
                          >
                            Start Prep
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'served')}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-600"
                          >
                            Mark Ready / Served
                          </button>
                        )}
                        <button
                          onClick={() => printKitchenTicket(order)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 flex items-center gap-2"
                        >
                          <Printer className="w-4 h-4" /> Print Ticket
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 admin-panel rounded-2xl overflow-hidden border border-[#2f2d36]">
                <div className="relative min-h-[210px]">
                  <Image
                    src={menuItems[0]?.image_url || getDefaultMenuImage('Seasonal Menu', 'Chef Specials')}
                    alt="Menu hero"
                    fill
                    sizes="(max-width: 1280px) 100vw, 66vw"
                    className="object-cover opacity-30"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f1013]/95 via-[#0f1013]/75 to-transparent" />
                  <div className="relative p-6 sm:p-7">
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Live Status</p>
                    <h1 className="text-4xl font-black tracking-tight text-[#e4e1e6] mt-2">Menu Management</h1>
                    <p className="text-sm text-[#b2acbd] mt-1">Maintain items, pricing, and availability with realtime chatbot sync.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                        {menuItems.filter(item => item.available).length} Active Items
                      </span>
                      <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-700 text-[#d0c9db] text-xs font-semibold">
                        {[...new Set(menuItems.map(item => item.category))].length} Categories
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-panel rounded-2xl p-5 border border-[#2f2d36] flex flex-col justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>Smart Recommendations</h2>
                  <p className="text-sm text-[#b2acbd] mt-1">Use fast actions to keep menu flow optimized.</p>
                </div>
                <button
                  onClick={() => { setEditMenuItem(null); setMenuForm({ name: '', price: '', category: '', imageUrl: '' }); setShowMenuModal(true); }}
                  className="w-full py-3 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${theme.primaryDark || '#5b21b6'}, ${theme.primary})` }}
                >
                  <Plus className="w-4 h-4" /> Add Menu Item
                </button>
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <motion.div key={item.id} className={`bg-[#1b1b1e] border rounded-2xl p-3.5 shadow-sm ${item.available ? 'border-[#2f2d36]' : 'border-red-700/30 opacity-70'}`}>
                    <div className="relative h-44 mb-3 rounded-xl overflow-hidden border border-[#2f2d36]">
                      <Image
                        src={item.image_url || getDefaultMenuImage(item.name, item.category)}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-[#0e0e11]/85 border border-[#3b3845] text-sm font-bold" style={{ color: theme.primary }}>
                        ${item.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${theme.primary}1a`, border: `1px solid ${theme.primary}33`, color: theme.primary }}>{item.category.toUpperCase()}</span>
                        <h3 className="text-xl font-semibold mt-2 text-[#e4e1e6]">{item.name}</h3>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => toggleAvailability(item)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${item.available ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                        {item.available ? 'Available' : 'Unavailable'}
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
            <div className="admin-panel rounded-2xl p-6 sm:p-7 border border-[#2f2d36] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#958da1]">Operational View</p>
                <h1 className="text-5xl font-black tracking-tight text-[#e4e1e6] mt-2">Dining Floor</h1>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                    {effectiveTables.filter(t => t.status === 'available').length} Tables Available
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
                    {effectiveTables.filter(t => t.status === 'occupied').length} Tables Occupied
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#23232a] border border-[#3a3743] text-[#e4e1e6]">Layout Mode</button>
                <button onClick={() => setShowAddTableModal(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-black flex items-center gap-2" style={{ background: theme.primary }}>
                  <Plus className="w-4 h-4" /> Add Table
                </button>
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {effectiveTables.map(table => (
                  <motion.div key={table.id} className={`bg-[#1b1b1e] border rounded-2xl p-5 shadow-sm ${
                    table.status === 'available' ? 'border-emerald-500/30' :
                    table.status === 'occupied' ? 'border-amber-500/40' :
                    'border-rose-500/30'
                  }`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className={`text-xs uppercase tracking-[0.18em] font-semibold ${
                          table.status === 'available' ? 'text-emerald-300' : table.status === 'occupied' ? 'text-amber-300' : 'text-rose-300'
                        }`}>
                          {table.status}
                        </p>
                        <h3 className="text-3xl sm:text-4xl font-black text-[#e4e1e6] mt-2 leading-none">Table {table.table_number}</h3>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#141419] border border-[#2f2d36] p-3 mb-3">
                      <p className="text-xs text-[#958da1] mb-1">Current Balance</p>
                      <p className="text-3xl font-black" style={{ color: theme.primary }}>
                        ${latestOrderByTable.get(table.table_number)?.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>

                    {table.current_order_id && <p className="text-xs text-gray-500 mb-2">{table.current_order_id}</p>}
                    <select value={table.status} onChange={(e) => updateTableStatus(table.id, e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm mb-2">
                      <option value="available">Available</option>
                      <option value="booked">Booked</option>
                      <option value="occupied">Occupied</option>
                    </select>
                    <button onClick={() => deleteTable(table.id)} className="w-full px-2 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm">
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
                        <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${getBaseUrl()}/order?table=${table.table_number}&restaurant=${restaurantId}`)}`} alt={`Table ${table.table_number}`} width={200} height={200} className="mx-auto" />
                        <p className="mt-3 font-bold text-black text-xl">Table {table.table_number}</p>
                        <p className="text-xs text-gray-500">Scan to order</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <button onClick={() => window.print()} className="px-6 py-3 text-black rounded-lg font-medium transition-colors" style={{ background: theme.primary }}>
                    Print All QR Codes
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
                  <p className="text-center text-sm" style={{ color: theme.primary }}>Cash payment to manager</p>
                </div>
                <button onClick={handlePayment} className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-colors">
                  Confirm Cash Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Gate Override Modal */}
      <AnimatePresence>
        {checkoutGateTable && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-lg w-full">
              <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Checkout Gate</h2>
                <button onClick={() => setCheckoutGateTable(null)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-sm text-amber-200 font-semibold">Table {checkoutGateTable.table_number} has unpaid order(s)</p>
                  <p className="text-xs text-amber-100/80 mt-1">Payment must be recorded before releasing table, unless manager override is logged.</p>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {checkoutGateBlockingOrders.map(order => (
                    <div key={`gate-${order.id}`} className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-gray-200">
                      <p>{order.receipt_id} | {order.status} | {order.payment_status}</p>
                      <p className="text-gray-400">Total: ${order.total.toFixed(2)} | {new Date(order.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Manager override reason (required)</label>
                  <textarea
                    value={checkoutGateReason}
                    onChange={(e) => setCheckoutGateReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-500"
                    placeholder="Example: customer paid at counter, manager verified with receipt #..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckoutGateTable(null)}
                    className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-gray-300"
                  >
                    Keep Blocked
                  </button>
                  <button
                    onClick={applyCheckoutGateOverride}
                    disabled={!canManage}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-black disabled:opacity-50"
                    style={{ background: theme.primary }}
                  >
                    Manager Override
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
