export type TransactionType = 'IN' | 'OUT' | 'ADJUST';

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  categoryId: string;
  supplierId: string;
  locationId: string; // Physical location reference
  exactLocation: string; // e.g. 'Estante B, Nivel 2'
  unit: string;
  purchasePrice: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  securityStock: number;
  lastUpdated: any;
  imageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string; // Added for supplier management
  createdAt: any;
}

export interface Transaction {
  id: string;
  productId: string;
  type: TransactionType;
  quantity: number;
  timestamp: any; // Timestamp
  userId: string;
  notes: string;
  recipient?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'operator';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
