export type Variant = { sku: string; size: string; stock: number };

export type Product = {
  id: number;
  slug: string;
  name: string;
  sportSlug: string;
  type: string;
  version: string;
  priceLkr: number;
  description: string;
  status: "published" | "draft" | "archived";
  preorderEnabled: boolean;
  preorderEta: string;
  imageUrl: string;
  isDemo: boolean;
  subcategorySlug: string;
  leagueSlug: string;
  competitionSlug: string;
  subgroupSlug: string;
  brandSlug: string;
  customizable: boolean;
  weightG: number;
  gallery: string[];
  variants: Variant[];
};

export type Banner = {
  id: number;
  position: "hero" | "slider";
  sort: number;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  fromColor: string;
  toColor: string;
  imageUrl: string;
  active: boolean;
};

export type Sport = {
  slug: string;
  name: string;
  tagline: string;
  subcategories: string[];
  accent: string;
};

export type Faq = { q: string; a: string };

export type SizeState = {
  size: string;
  sku: string;
  stock: number;
  mode: "ready" | "preorder" | "soldout";
};

export type OrderRow = {
  id: number;
  reference: string;
  created_at: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: "payhere" | "bank";
  payment_plan: "full" | "half";
  idempotency_key: string | null; balance_method: string;
  due_now: number;
  paid_amount: number;
  payment_status: "pending" | "partial" | "paid" | "failed" | "cancelled";
  stage: string;
  has_preorder: number;
  country: string;
  delivery_method: "delivery" | "pickup" | "international";
  postal_code: string;
  credit_code: string;
  credit_applied: number;
  voucher_code?: string;
  discount?: number;
  kind?: "shop" | "giftcard";
  batch_id: number | null;
  admin_note: string;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  sku: string;
  name: string;
  size: string;
  qty: number;
  unit_price: number;
  source: "ready" | "preorder";
  options: string;
  addon_price: number;
};
