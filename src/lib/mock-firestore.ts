export class MockTimestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000));
  }
  static now() {
    return MockTimestamp.fromDate(new Date());
  }
  static fromDate(date: Date) {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }
}

export const Timestamp = MockTimestamp;

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof MockTimestamp) {
    return { __type: 'Timestamp', seconds: obj.seconds, nanoseconds: obj.nanoseconds };
  }
  if (obj instanceof Date) {
    return { __type: 'Timestamp', seconds: Math.floor(obj.getTime() / 1000), nanoseconds: (obj.getTime() % 1000) * 1000000 };
  }
  if (Array.isArray(obj)) {
    return obj.map(serialize);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = serialize(obj[key]);
    }
    return res;
  }
  return obj;
}

function deserialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if (obj.__type === 'Timestamp') {
      return new MockTimestamp(obj.seconds, obj.nanoseconds);
    }
    if (Array.isArray(obj)) {
      return obj.map(deserialize);
    }
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = deserialize(obj[key]);
    }
    return res;
  }
  return obj;
}

// Global listeners registry to allow reactive real-time onSnapshot updates
const listeners: { [collName: string]: (() => void)[] } = {};

function notifyListeners(collName: string) {
  if (listeners[collName]) {
    for (const cb of listeners[collName]) {
      try {
        cb();
      } catch (err) {
        console.error("Error triggering firestore listener:", err);
      }
    }
  }
}

// Initial seed data defined for professional immediate login experience
const INITIAL_SEED: { [collectionName: string]: { [id: string]: any } } = {
  categories: {
    cat_1: { name: "Equipos Médicos", description: "Dispositivos médicos complejos y maquinarias de diagnóstico" },
    cat_2: { name: "Insumos Descartables", description: "Materiales desechables de uso diario clínico" },
    cat_3: { name: "Medicamentos de Control", description: "Fármacos especializados bajo regulación estricta" }
  },
  locations: {
    loc_1: { name: "Almacén Central - Sector A", description: "Estanterías de alta densidad refrigeradas" },
    loc_2: { name: "Almacén Central - Sector B", description: "Zona general de insumos descartables" },
    loc_3: { name: "Farmacia Satélite - Piso 2", description: "Suministro inmediato para quirófanos" }
  },
  suppliers: {
    sup_1: { name: "Medicamentos Médica S.A.", contactName: "Dr. Roberto Gómez", email: "contacto@medicasa.com", phone: "+54 11 4567-8910", address: "Av. Corrientes 1234, CABA" },
    sup_2: { name: "Descartables de Emergencia SRL", contactName: "Lic. María Plaza", email: "ventas@descartables.com", phone: "+54 11 5000-1122", address: "Ruta 8 Km 45, Pilar" },
    sup_3: { name: "TecnoSalud S.A.", contactName: "Ing. Alejandro Cruz", email: "soporte@tecnosalud.com", phone: "+54 11 3220-4321", address: "Parque Industrial, Berazategui" }
  },
  products: {
    prod_1: { name: "Oxímetro de Pulso Portátil", description: "Oxímetro digital de alta precisión para control continuo", sku: "OXI-001", categoryId: "cat_1", supplierId: "sup_3", locationId: "loc_1", exactLocation: "Estante 3 - Fila B", unit: "unidades", currentStock: 15, minStock: 5, maxStock: 30, securityStock: 8, imageUrl: "" },
    prod_2: { name: "Kit de Jeringas Descartables 10ml", description: "Caja de 100 unidades con aguja esterilizada", sku: "JER-10ML", categoryId: "cat_2", supplierId: "sup_2", locationId: "loc_2", exactLocation: "Estante 12 - Fila C", unit: "unidades", currentStock: 120, minStock: 40, maxStock: 300, securityStock: 80, imageUrl: "" },
    prod_3: { name: "Amoxicilina 500mg - Suspensión", description: "Fórmula antibiótica de amplio espectro, frasco de 90ml", sku: "AMO-500", categoryId: "cat_3", supplierId: "sup_1", locationId: "loc_3", exactLocation: "Gabinete de Seguridad A", unit: "unidades", currentStock: 8, minStock: 15, maxStock: 50, securityStock: 20, imageUrl: "" }
  },
  userProfiles: {
    ciancio_admin: { email: "ciancioalexis1@gmail.com", displayName: "Alexis Ciancio", role: "admin", password: "admin123" },
    user_operator: { email: "operario@emergencia.com", displayName: "Operador de Guardia", role: "operator", password: "operator123" }
  }
};

// Seed initial transactions based on times
INITIAL_SEED.transactions = {
  t_1: { productId: "prod_1", type: "IN", quantity: 15, timestamp: new MockTimestamp(Math.floor(Date.now() / 1000) - 86400, 0), userId: "ciancio_admin", notes: "Lote inicial de control de calidad" },
  t_2: { productId: "prod_2", type: "IN", quantity: 120, timestamp: new MockTimestamp(Math.floor(Date.now() / 1000) - 86400, 0), userId: "ciancio_admin", notes: "Recepción de proveedor" },
  t_3: { productId: "prod_3", type: "IN", quantity: 8, timestamp: new MockTimestamp(Math.floor(Date.now() / 1000) - 172800, 0), userId: "ciancio_admin", notes: "Inventario inicial de seguridad" }
};

// Auto-initialize standard seed data into localStorage if empty
for (const collName of Object.keys(INITIAL_SEED)) {
  const customKey = `mock_fs_${collName}`;
  if (!localStorage.getItem(customKey)) {
    localStorage.setItem(customKey, JSON.stringify(serialize(INITIAL_SEED[collName])));
  }
}

// Mock Firestore Classes
export class MockFirestore {
  _dbName: string;
  constructor(dbName = 'default') {
    this._dbName = dbName;
  }
}

export class MockCollectionReference {
  db: MockFirestore;
  path: string;
  constructor(db: MockFirestore, path: string) {
    this.db = db;
    this.path = path;
  }
}

export class MockDocumentReference {
  db: MockFirestore;
  collectionPath: string;
  id: string;
  constructor(db: MockFirestore, collectionPath: string, id: string) {
    this.db = db;
    this.collectionPath = collectionPath;
    this.id = id;
  }
}

export class MockDocumentSnapshot {
  id: string;
  _exists: boolean;
  _data: any;
  constructor(id: string, exists: boolean, data?: any) {
    this.id = id;
    this._exists = exists;
    this._data = data;
  }
  exists() {
    return this._exists;
  }
  data() {
    return this._data ? deserialize(this._data) : undefined;
  }
}

export class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  constructor(docs: MockDocumentSnapshot[]) {
    this.docs = docs;
  }
  forEach(callback: (doc: MockDocumentSnapshot, index: number) => void) {
    this.docs.forEach(callback);
  }
}

export class MockQuery {
  collection: MockCollectionReference;
  constraints: any[];
  constructor(collection: MockCollectionReference, constraints: any[] = []) {
    this.collection = collection;
    this.constraints = constraints;
  }
}

// API Functions
export function getFirestore(app?: any, databaseId?: string) {
  return new MockFirestore(databaseId);
}

export function collection(db: MockFirestore, path: string): MockCollectionReference {
  return new MockCollectionReference(db, path);
}

export function doc(dbOrCol: any, pathOrId: string, ...childPaths: string[]): MockDocumentReference {
  if (dbOrCol instanceof MockFirestore) {
    const parentPath = pathOrId;
    const docId = childPaths[0];
    return new MockDocumentReference(dbOrCol, parentPath, docId);
  } else if (dbOrCol instanceof MockCollectionReference) {
    return new MockDocumentReference(dbOrCol.db, dbOrCol.path, pathOrId);
  } else if (dbOrCol && dbOrCol.collectionPath) {
    // If ref is a document reference, construct subcollection doc (dummy fallback fallback)
    return new MockDocumentReference(dbOrCol.db, dbOrCol.collectionPath + '/' + dbOrCol.id + '/' + pathOrId, childPaths[0]);
  }
  return new MockDocumentReference(new MockFirestore(), 'unknown', pathOrId);
}

export async function getDoc(docRef: MockDocumentReference): Promise<MockDocumentSnapshot> {
  const storeKey = `mock_fs_${docRef.collectionPath}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};
  const docData = dataMap[docRef.id];
  if (docData) {
    return new MockDocumentSnapshot(docRef.id, true, docData);
  }
  return new MockDocumentSnapshot(docRef.id, false, null);
}

export async function getDocFromServer(docRef: MockDocumentReference): Promise<MockDocumentSnapshot> {
  return getDoc(docRef);
}

export async function getDocs(queryOrCol: any): Promise<MockQuerySnapshot> {
  let colRef: MockCollectionReference;
  let constraints: any[] = [];

  if (queryOrCol instanceof MockQuery) {
    colRef = queryOrCol.collection;
    constraints = queryOrCol.constraints;
  } else {
    colRef = queryOrCol;
  }

  const storeKey = `mock_fs_${colRef.path}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};

  // Map to snapshots and filter out soft elements structure
  let docs = Object.keys(dataMap).map(id => ({
    id,
    ...dataMap[id]
  }));

  // Perform active query executions (where, orderBy, limit filter routines)
  if (constraints && constraints.length > 0) {
    for (const c of constraints) {
      if (c.type === 'orderBy') {
        const { field, direction } = c;
        docs.sort((a, b) => {
          let valA = a[field];
          let valB = b[field];

          // Reconstruct Timestamp values if they are stored as JSON representations
          if (valA && valA.__type === 'Timestamp') {
            valA = valA.seconds * 1000 + Math.floor(valA.nanoseconds / 1000000);
          }
          if (valB && valB.__type === 'Timestamp') {
            valB = valB.seconds * 1000 + Math.floor(valB.nanoseconds / 1000000);
          }

          if (valA < valB) return direction === 'desc' ? 1 : -1;
          if (valA > valB) return direction === 'desc' ? -1 : 1;
          return 0;
        });
      } else if (c.type === 'where') {
        const { field, op, value } = c;
        docs = docs.filter(doc => {
          const val = doc[field];
          if (op === '==') return val === value;
          if (op === '!=') return val !== value;
          if (op === '<') return val < value;
          if (op === '<=') return val <= value;
          if (op === '>') return val > value;
          if (op === '>=') return val >= value;
          return true;
        });
      } else if (c.type === 'limit') {
        docs = docs.slice(0, c.count);
      }
    }
  }

  const snapshots = docs.map(d => {
    const { id, ...rest } = d;
    return new MockDocumentSnapshot(id, true, rest);
  });

  return new MockQuerySnapshot(snapshots);
}

export function onSnapshot(
  queryOrCol: any,
  onNext: (snapshot: MockQuerySnapshot) => void,
  onError?: (err: any) => void
) {
  let colPath = '';
  if (queryOrCol instanceof MockQuery) {
    colPath = queryOrCol.collection.path;
  } else if (queryOrCol instanceof MockCollectionReference) {
    colPath = queryOrCol.path;
  } else if (queryOrCol && queryOrCol.collectionPath) {
    // If given a Document reference, we can emulating single doc reference listens
    const docRef = queryOrCol as MockDocumentReference;
    const docTrigger = () => {
      getDoc(docRef).then(snap => {
        onNext(snap as any);
      }).catch(err => {
        if (onError) onError(err);
      });
    };
    if (!listeners[docRef.collectionPath]) {
      listeners[docRef.collectionPath] = [];
    }
    listeners[docRef.collectionPath].push(docTrigger);
    setTimeout(docTrigger, 0);

    return () => {
      if (listeners[docRef.collectionPath]) {
        listeners[docRef.collectionPath] = listeners[docRef.collectionPath].filter(l => l !== docTrigger);
      }
    };
  }

  if (!colPath) {
    return () => {};
  }

  const trigger = () => {
    getDocs(queryOrCol).then(snap => {
      onNext(snap);
    }).catch(err => {
      if (onError) onError(err);
    });
  };

  if (!listeners[colPath]) {
    listeners[colPath] = [];
  }
  listeners[colPath].push(trigger);

  // Trigger snapshot dispatch on separate event loop microtask
  setTimeout(trigger, 0);

  return () => {
    if (listeners[colPath]) {
      listeners[colPath] = listeners[colPath].filter(l => l !== trigger);
    }
  };
}

export async function setDoc(
  docRef: MockDocumentReference,
  data: any,
  options?: { merge?: boolean }
): Promise<void> {
  const storeKey = `mock_fs_${docRef.collectionPath}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};

  const existing = dataMap[docRef.id] || {};
  let finalData: any;
  if (options && options.merge) {
    finalData = { ...existing, ...serialize(data) };
  } else {
    finalData = serialize(data);
  }

  dataMap[docRef.id] = finalData;
  localStorage.setItem(storeKey, JSON.stringify(dataMap));

  notifyListeners(docRef.collectionPath);
  return Promise.resolve();
}

export async function addDoc(
  colRef: MockCollectionReference,
  data: any
): Promise<{ id: string }> {
  const storeKey = `mock_fs_${colRef.path}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};

  const newId = 'doc_' + Math.random().toString(36).substring(2, 11);
  dataMap[newId] = serialize(data);
  localStorage.setItem(storeKey, JSON.stringify(dataMap));

  notifyListeners(colRef.path);
  return Promise.resolve({ id: newId });
}

export async function updateDoc(
  docRef: MockDocumentReference,
  data: any
): Promise<void> {
  const storeKey = `mock_fs_${docRef.collectionPath}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};

  const existing = dataMap[docRef.id] || {};
  dataMap[docRef.id] = { ...existing, ...serialize(data) };
  localStorage.setItem(storeKey, JSON.stringify(dataMap));

  notifyListeners(docRef.collectionPath);
  return Promise.resolve();
}

export async function deleteDoc(docRef: MockDocumentReference): Promise<void> {
  const storeKey = `mock_fs_${docRef.collectionPath}`;
  const rawStore = localStorage.getItem(storeKey);
  const dataMap = rawStore ? JSON.parse(rawStore) : {};

  delete dataMap[docRef.id];
  localStorage.setItem(storeKey, JSON.stringify(dataMap));

  notifyListeners(docRef.collectionPath);
  return Promise.resolve();
}

export function query(collectionRef: MockCollectionReference, ...constraints: any[]): MockQuery {
  return new MockQuery(collectionRef, constraints);
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number) {
  return { type: 'limit', count };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function serverTimestamp() {
  return MockTimestamp.now();
}
