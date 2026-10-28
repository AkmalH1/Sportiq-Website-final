/** Ways the remaining balance of a half-paid pre-order can be collected. Staff enable them in Admin > Settings. */
export const BALANCE_METHODS = {
  cash_pickup: "Cash when you collect from our store",
  cash_delivery: "Cash on delivery (Sri Lanka)",
  bank: "Bank transfer (verified by our team)",
  online: "Online card payment",
} as const;
export type BalanceMethod = keyof typeof BALANCE_METHODS;
export const enabledBalanceMethods = (csv: string): BalanceMethod[] =>
  csv.split(",").map((x) => x.trim()).filter((x): x is BalanceMethod => x in BALANCE_METHODS);
