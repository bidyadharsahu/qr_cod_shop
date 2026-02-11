export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantTable {
  id: number;
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
}

export interface Order {
  id: number;
  receipt_id: string;
  table_number: number;
  items: OrderItem[];
  subtotal: number;
  tip_amount: number;
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
