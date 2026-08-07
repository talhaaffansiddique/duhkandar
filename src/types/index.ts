export type AccessLevel = "Admin" | "Employee";

export const PERMISSION_KEYS = [
  "viewDashboard",
  "recordSales",
  "manageInventory",
  "recordPurchases",
  "viewReports",
  "addExpenses",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionSet = Record<PermissionKey, boolean>;

export interface AuditFields {
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface Role extends AuditFields {
  id: string;
  name: string;
  fixed?: boolean;
  permissions: PermissionSet;
}

export type UserStatus = "Active" | "Invited" | "Inactive" | "Deleted";

export interface UserProfile extends AuditFields {
  id: string;
  name: string;
  email: string;
  access: AccessLevel;
  roleId?: string;
  status: UserStatus;
  shopId: string;
}

/** Every stored `name` string (cashierName, recordedBy, addedByName, ...) should
 * pass through this before rendering, so a deleted/inactive user's history
 * still reads correctly instead of silently going stale. */
export function nameWithStatus(name: string, users: Pick<UserProfile, "name" | "status">[]): string {
  const match = users.find((u) => u.name === name);
  if (!match) return name;
  if (match.status === "Deleted") return `${name} (ex)`;
  if (match.status === "Inactive") return `${name} (inactive)`;
  return name;
}

export interface Shop {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: number;
  businessName?: string;
  address?: string;
  logoUrl?: string;
  darkModeDefault?: boolean;
  showSubcategories?: boolean;
  printReceiptAfterSale?: boolean;
  acceptOnlinePayments?: boolean;
  acceptCardPayments?: boolean;
  seeded?: boolean;
  /** Daily receipt counter, e.g. "26-07-27", reset each new calendar day. */
  lastReceiptDateKey?: string;
  lastReceiptSeq?: number;
}

export interface Supplier extends AuditFields {
  id: string;
  name: string;
  contact: string;
  address: string;
  outstanding: number;
}

export type WarrantyUnit = "Months" | "Years";

export interface ProductVariant {
  size: string;
  colour: string;
  stock: number;
}

export interface Product extends AuditFields {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  avgCost: number;
  price: number;
  warrantyValue: number;
  warrantyUnit: WarrantyUnit;
  images: string[];
  variants?: ProductVariant[];
}

export interface PurchaseLineItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
}

export interface PurchasePayment {
  amount: number;
  paidAt: number;
  note?: string;
  recordedBy: string;
}

export type PurchaseStatus = "Paid" | "Partial" | "Unpaid";

export interface Purchase extends AuditFields {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNo: string;
  date: string;
  items: PurchaseLineItem[];
  total: number;
  attachmentUrl?: string;
  status: PurchaseStatus;
  payments?: PurchasePayment[];
}

export function purchasePaidTotal(p: Pick<Purchase, "payments">): number {
  return (p.payments ?? []).reduce((s, pay) => s + pay.amount, 0);
}

export function purchaseStatus(p: Pick<Purchase, "payments" | "total">): PurchaseStatus {
  const paid = purchasePaidTotal(p);
  if (paid <= 0) return "Unpaid";
  if (paid >= p.total) return "Paid";
  return "Partial";
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  warranty?: string;
}

export type PaymentMethod = "Cash" | "Online" | "Card";

export interface Sale extends AuditFields {
  id: string;
  receiptNo: string;
  customer: string;
  items: SaleLineItem[];
  amount: number;
  payment: PaymentMethod;
  status: "Paid" | "Refunded";
  cashierName: string;
}

export interface Expense extends AuditFields {
  id: string;
  date: string;
  category: "Rent" | "Utilities" | "Salaries" | "Transport" | "Miscellaneous";
  amount: number;
  note: string;
  addedByName: string;
}
