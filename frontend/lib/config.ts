export const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"] as const;
export const ONE_SIZE = "One Size";
export const sizesFor = (sizeSet: string): readonly string[] => (sizeSet === "onesize" ? [ONE_SIZE] : SIZES);
export const skuSuffix = (size: string) => (size === ONE_SIZE ? "OS" : size);
export const stockColumn = (size: string) => (size === ONE_SIZE ? "stock_ONE" : `stock_${size}`);

export type Size = (typeof SIZES)[number];

/** Share of the pre-order total taken as a deposit when a customer picks "half payment". */
export const DEPOSIT_RATE = 0.5;

/** Unpaid orders release their reserved ready stock after this many hours. */
export const UNPAID_HOLD_HOURS = 48;

export const SHIPPING_FEE_LKR = Number(process.env.SHIPPING_FEE_LKR ?? 0);

export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const BANK = {
  name: process.env.BANK_NAME ?? "",
  branch: process.env.BANK_BRANCH ?? "",
  accountName: process.env.BANK_ACCOUNT_NAME ?? "",
  accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "",
};

export const bankConfigured = () => Boolean(BANK.name && BANK.accountName && BANK.accountNumber);

export const PREORDER_STAGES = [
  "Confirmed",
  "Supplier Paid",
  "Production",
  "Shipping",
  "Arrived in Sri Lanka",
  "Out for Delivery",
  "Delivered",
] as const;

export const READY_STAGES = ["Confirmed", "Out for Delivery", "Delivered"] as const;
