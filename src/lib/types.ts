export interface MenuItem {
  id: number;
  restaurant_id: number;
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantTable {
  id: number;
  restaurant_id: number;
  table_number: number;
  seats?: number;
  status: 'available' | 'booked' | 'occupied';
  current_order_id: string | null;
  updated_at?: string;
}

export type Table = RestaurantTable;

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image_url?: string | null;
  special_instructions?: string;
  spice_level?: 'mild' | 'medium' | 'hot';
  allergy_alerts?: string[];
}

export interface Order {
  id: number;
  restaurant_id: number;
  receipt_id: string;
  table_number: number;
  items: OrderItem[];
  subtotal: number;
  tip_amount: number;
  tax_amount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'served' | 'paid' | 'completed' | 'cancelled';
  payment_method: 'card' | 'cash' | 'online' | null;
  payment_status: 'unpaid' | 'paid';
  payment_type: 'direct_cash' | 'chatbot_payment' | null;
  transaction_id: string | null;
  customer_note: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentEventAudit {
  id: number;
  restaurant_id: number;
  order_id: number | null;
  receipt_id: string | null;
  provider: 'stripe' | 'paypal' | 'system' | null;
  event_type: string;
  status: 'received' | 'success' | 'failed' | 'skipped';
  amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  source: string | null;
  event_time: string;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface Restaurant {
  id: number;
  slug: string;
  name: string;
  owner_email?: string | null;
  plan: 'basic' | 'premium';
  status: 'active' | 'disabled';
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type StaffRole = 'manager' | 'chef' | 'restaurant_admin' | 'super_admin';

export interface RestaurantStaff {
  id: number;
  restaurant_id: number;
  username: string;
  password: string;
  role: Exclude<StaffRole, 'super_admin'>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
