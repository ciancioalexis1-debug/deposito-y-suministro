import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Product, Category, Supplier, Location, OperationType } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  AlertTriangle, 
  ArrowUpRight,
  Package,
  X,
  FileSpreadsheet,
  Upload,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    supplierId: '',
    locationId: '',
    exactLocation: '',
    unit: 'unidades',
    purchasePrice: 0,
    currentStock: 0,
    minStock: 10,
    maxStock: 100,
    securityStock: 20,
    imageUrl: ''
  });

  useEffect(() => {
    const qProducts = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const loadExtras = async () => {
      const cats = await getDocs(collection(db, 'categories'));
      setCategories(cats.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      
      const sups = await getDocs(collection(db, 'suppliers'));
      setSuppliers(sups.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));

      const locs = await getDocs(collection(db, 'locations'));
      setLocations(locs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    };
    loadExtras();

    return () => unsubProducts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'products'), {
        ...formData,
        purchasePrice: Number(formData.purchasePrice),
        currentStock: Number(formData.currentStock),
        minStock: Number(formData.minStock),
        maxStock: Number(formData.maxStock),
        securityStock: Number(formData.securityStock),
        lastUpdated: serverTimestamp()
      });

      // Create initial transaction record
      await addDoc(collection(db, 'transactions'), {
        productId: docRef.id,
        type: 'IN',
        quantity: Number(formData.currentStock),
        timestamp: serverTimestamp(),
        userId: user?.uid || 'anonymous',
        notes: 'Stock Inicial'
      });

      setIsModalOpen(false);
      setFormData({
        name: '', sku: '', description: '', categoryId: '', supplierId: '',
        locationId: '', exactLocation: '',
        unit: 'unidades', purchasePrice: 0, currentStock: 0, minStock: 10, maxStock: 100,
        securityStock: 20, imageUrl: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        let importedCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            // Basic mapping (case insensitive or common headers)
            const name = row.Nombre || row.name || row.Item;
            const sku = row.SKU || row.sku || row.Codigo || row.Código;
            if (!name || !sku) {
              errorCount++;
              continue;
            }

            // Find IDs
            const categoryName = row.Categoria || row.Category || row.Categoría;
            const supplierName = row.Proveedor || row.Supplier;

            const categoryId = categories.find(c => c.name.toLowerCase() === String(categoryName).toLowerCase())?.id || '';
            const supplierId = suppliers.find(s => s.name.toLowerCase() === String(supplierName).toLowerCase())?.id || '';

            const productData = {
              name: String(name),
              sku: String(sku),
              description: String(row.Descripcion || row.Description || row.Descripción || ''),
              categoryId,
              supplierId,
              unit: String(row.Unidad || row.Unit || 'unidades'),
              purchasePrice: Number(row.Precio || row.Price || row['Precio Compra'] || 0),
              currentStock: Number(row.Stock || row.Existencias || 0),
              minStock: Number(row.Min || row['Stock Minimo'] || 10),
              maxStock: Number(row.Max || row['Stock Maximo'] || 100),
              securityStock: Number(row.Seguridad || row['Stock Seguridad'] || 20),
              imageUrl: '',
              lastUpdated: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'products'), productData);

            if (productData.currentStock > 0) {
              await addDoc(collection(db, 'transactions'), {
                productId: docRef.id,
                type: 'IN',
                quantity: productData.currentStock,
                timestamp: serverTimestamp(),
                userId: user?.uid || 'anonymous',
                notes: 'Importación Excel'
              });
            }

            importedCount++;
          } catch (err) {
            console.error('Error importing row:', row, err);
            errorCount++;
          }
        }

        alert(`Importación finalizada.\nÉxitos: ${importedCount}\nErrores: ${errorCount}`);
      } catch (err) {
        console.error('Error reading excel:', err);
        alert('Error al leer el archivo Excel.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Inventario Total</h1>
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Control Detallado de Existencias y Niveles</p>
        </div>
        <div className="flex gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelImport}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-white/10 text-white/60 font-bold py-3 px-6 rounded-xl hover:text-white hover:border-white/20 transition-all shadow-lg disabled:opacity-50"
          >
            <FileSpreadsheet size={18} />
            <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">
              {isImporting ? 'Importando...' : 'Importar Excel'}
            </span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-amber-600 text-black font-bold py-3 px-8 rounded-xl hover:bg-amber-500 transition-all shadow-lg active:scale-95"
          >
            <Plus size={18} />
            <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">Añadir SKU</span>
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#111111] p-4 rounded-xl border border-white/10 shadow-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input
            type="text"
            placeholder="Buscar por artículo o código SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500/40 transition-all placeholder:text-white/20"
          />
        </div>
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-4">
          <Filter size={14} className="text-white/30" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-3 outline-none cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((p) => {
          const isLow = p.currentStock <= p.minStock;
          const isCritical = p.currentStock <= 0;
          const isSecurity = p.currentStock <= p.securityStock;

          return (
            <motion.div
              layout
              key={p.id}
              className="bg-[#141414] rounded-xl border border-white/10 overflow-hidden flex flex-col group hover:border-white/20 transition-all shadow-2xl relative"
            >
              <div className="h-40 bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <Package size={32} className="text-white/10" />
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  {isCritical ? (
                    <span className="bg-red-500 text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-lg">Inseguro</span>
                  ) : isLow ? (
                    <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-lg">Stock Bajo</span>
                  ) : isSecurity && (
                    <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-lg">Seguridad</span>
                  )}
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-serif italic text-lg text-white leading-tight group-hover:text-amber-500 transition-colors">{p.name}</h3>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                   <span className="text-[9px] font-bold text-white/30 border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">{p.sku}</span>
                   <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest truncate max-w-[80px]">{categories.find(c => c.id === p.categoryId)?.name || 'General'}</span>
                   <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest truncate max-w-[80px] flex items-center gap-1">
                      <MapPin size={10} />
                      {locations.find(l => l.id === p.locationId)?.name || 'Sin Ubicación'}
                   </span>
                </div>
                
                <p className="text-[11px] text-white/40 line-clamp-2 mb-6 flex-1 leading-relaxed font-medium">{p.description || 'Sin descripción detallada.'}</p>
                
                <div className="pt-5 border-t border-white/5 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">Existencias</p>
                    <p className={`text-2xl font-mono font-bold leading-none ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-white'}`}>
                      {p.currentStock.toString().padStart(2, '0')} <span className="text-[10px] font-bold text-white/20 uppercase ml-1">{p.unit}</span>
                    </p>
                  </div>
                  <Link 
                    to={`/inventory/${p.id}`}
                    className="p-3 bg-white/5 text-white border border-white/10 rounded-lg hover:bg-white/10 transition-all group-hover:border-amber-500/40"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {loading && (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-[#111111] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
                <h2 className="text-2xl font-serif italic text-white leading-none">Alta de Producto</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-white/40 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="p-8 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Nombre del Artículo</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Código SKU</label>
                      <input
                        required
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Categoría</label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white/60 focus:outline-none focus:border-amber-500/50 outline-none text-xs font-bold uppercase tracking-widest"
                      >
                        <option value="">Seleccionar Categoría</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Ubicación Física</label>
                       <select
                         value={formData.locationId}
                         onChange={(e) => setFormData({...formData, locationId: e.target.value})}
                         className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white/60 focus:outline-none focus:border-amber-500/50 outline-none text-xs font-bold uppercase tracking-widest"
                       >
                         <option value="">Seleccionar Almacén/Nave</option>
                         {locations.map(l => (
                           <option key={l.id} value={l.id}>{l.name}</option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Posición Exacta</label>
                       <input
                         type="text"
                         value={formData.exactLocation}
                         onChange={(e) => setFormData({...formData, exactLocation: e.target.value})}
                         placeholder="Ej: Estante B, Nivel 2"
                         className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 placeholder:text-white/10"
                       />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Precio Compra ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.purchasePrice}
                          onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Unidad de Medida</label>
                        <input
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({...formData, unit: e.target.value})}
                          placeholder="uds, kg, l"
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 placeholder:text-white/10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Stock Inicial</label>
                      <input
                        type="number"
                        value={formData.currentStock}
                        onChange={(e) => setFormData({...formData, currentStock: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       <div className="space-y-2">
                        <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest ml-1 text-center block">Mín</label>
                        <input
                          type="number"
                          value={formData.minStock}
                          onChange={(e) => setFormData({...formData, minStock: Number(e.target.value)})}
                          className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50 text-center font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest ml-1 text-center block">Seg</label>
                        <input
                          type="number"
                          value={formData.securityStock}
                          onChange={(e) => setFormData({...formData, securityStock: Number(e.target.value)})}
                          className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500/50 text-center font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest ml-1 text-center block">Máx</label>
                        <input
                          type="number"
                          value={formData.maxStock}
                          onChange={(e) => setFormData({...formData, maxStock: Number(e.target.value)})}
                          className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50 text-center font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Proveedor Principal</label>
                      <select
                        value={formData.supplierId}
                        onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white/60 focus:outline-none focus:border-amber-500/50 outline-none text-xs font-bold uppercase tracking-widest"
                      >
                        <option value="">Seleccionar Proveedor</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Descripción Técnica</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 mt-2 text-sm"
                  ></textarea>
                </div>

                <div className="mt-10 flex gap-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 text-black font-black py-4 rounded-xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/40 uppercase tracking-widest text-xs"
                  >
                    Confirmar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
