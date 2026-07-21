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

export interface UserProfile extends AuditFields {
  id: string;
  name: string;
  email: string;
  access: AccessLevel;
  roleId?: string;
  status: "Active" | "Invited" | "On leave" | "Disabled";
  shopId: string;
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
  seeded?: boolean;
}

export interface Supplier extends AuditFields {
  id: string;
  name: string;
  contact: string;
  address: string;
  outstanding: number;
}

export interface Product extends AuditFields {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  avgCost: number;
  price: number;
  warrantyMonths: number;
  images: string[];
}

export interface PurchaseLineItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
}

export interface Purchase extends AuditFields {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNo: string;
  date: string;
  items: PurchaseLineItem[];
  total: number;
  attachmentUrl?: string;
  status: "Paid" | "Partial" | "Unpaid";
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface Sale extends AuditFields {
  id: string;
  receiptNo: string;
  customer: string;
  items: SaleLineItem[];
  amount: number;
  payment: "Cash" | "Credit";
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
