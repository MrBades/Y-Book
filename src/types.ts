export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  cost_price?: number;
  total: number;
}

export interface Invoice {
  id: string;
  customerName: string;
  productName: string;
  items: InvoiceItem[];
  totalAmount: number;
  amountPaid: number;
  debtBalance: number;
  transactionType: 'sale' | 'expense' | 'payment_on_account';
  createdAt: string;
  status?: 'DRAFT' | 'PAID' | 'OVERDUE';
  staffName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  activeDebtBalance: number;
  createdDate: string;
  invoices: Invoice[];
}

export interface TextSectionStyles {
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  textColor?: string;
  backgroundColor?: string;
}

export interface BusinessProfile {
  businessName: string;
  businessType?: 'buy_and_sell' | 'service';
  phone?: string;
  address?: string;
  invoiceTemplatePreference: 'classic' | 'modern_blue' | 'kiosk_compact' | 'custom_build';
  businessLogo?: string; // base64 representation or URL
  businessRegion?: { latitude: number; longitude: number };
  customAccentColor?: string;
  customFontSize?: 'sm' | 'md' | 'lg';
  customFontFamily?: 'sans' | 'serif' | 'mono';
  customShowLogo?: boolean;
  customHeaderTitle?: string;
  customFooterNotes?: string;
  customShadowStyle?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  // Logo & Header transformations
  logoWidth?: number;
  logoHeight?: number;
  logoRotation?: number;
  headerRotation?: number;
  // Section-by-section text attributes
  headerStyles?: TextSectionStyles;
  customerStyles?: TextSectionStyles;
  tableStyles?: TextSectionStyles;
  footerStyles?: TextSectionStyles;
}

export interface BillingInvoice {
  id: string;
  plan: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

export interface UserState {
  authenticated: boolean;
  onboarded: boolean;
  username: string;
  email: string;
  business?: BusinessProfile;
  trialCount: number;
  ownerPin?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  billingHistory?: BillingInvoice[];
  verification_skipped?: boolean;
  skippedOnboarding?: boolean;
}

export interface RestockEvent {
  id: string;
  productId: string;
  amount: number;
  date: string;
}

export interface SupplierRecord {
  id: string;
  supplier_name: string;
  phone_number: string;
  outstanding_balance_owed: number;
  timestamp: string;
}

export interface InventoryIntakeLog {
  id: string;
  productId: string;
  supplierId?: string;
  amount: number;
  unit_cost_price?: number;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  cost_price?: number;
  minQuantityCount: number; // For low stock alerts if stock <= minQuantityCount
}

