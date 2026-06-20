import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Product, Category, Supplier, Location, OperationType, TransactionType } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import { 
  ArrowLeft, 
  Trash2, 
  Edit3, 
  History, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Package,
  Calendar,
  Hash,
  Info,
  MapPin,
  X,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { getDocs } from 'firebase/firestore';

export default function ProductDetail() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<TransactionType>('IN');
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementNotes, setMovementNotes] = useState('');
  const [recipient, setRecipient] = useState('');

  // Edit State
  const [editFormData, setEditFormData] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    supplierId: '',
    locationId: '',
    exactLocation: '',
    unit: '',
    purchasePrice: 0,
    minStock: 0,
    maxStock: 0,
    securityStock: 0,
  });

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'products', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.id ? { id: snapshot.id, ...snapshot.data() } as Product : null;
        if (data) {
          setProduct(data);
          setEditFormData({
            name: data.name,
            sku: data.sku,
            description: data.description,
            categoryId: data.categoryId,
            supplierId: data.supplierId,
            locationId: data.locationId || '',
            exactLocation: data.exactLocation || '',
            unit: data.unit,
            purchasePrice: data.purchasePrice,
            minStock: data.minStock,
            maxStock: data.maxStock,
            securityStock: data.securityStock,
          });
        }
      } else {
        navigate('/inventory');
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `products/${id}`));

    const loadExtras = async () => {
        const [cats, sups, locs] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'suppliers')),
          getDocs(collection(db, 'locations'))
        ]);
        setCategories(cats.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setSuppliers(sups.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        setLocations(locs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    };
    loadExtras();

    return () => unsub();
  }, [id, navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await updateDoc(doc(db, 'products', id), {
        ...editFormData,
        purchasePrice: Number(editFormData.purchasePrice),
        minStock: Number(editFormData.minStock),
        maxStock: Number(editFormData.maxStock),
        securityStock: Number(editFormData.securityStock),
        lastUpdated: serverTimestamp()
      });
      setIsEditModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !id) return;

    try {
      let newStock = product.currentStock;
      if (movementType === 'IN') newStock += movementQuantity;
      else if (movementType === 'OUT') newStock -= movementQuantity;
      else if (movementType === 'ADJUST') newStock = movementQuantity; // Absolute adjustment

      if (newStock < 0) {
        alert('El stock no puede ser negativo');
        return;
      }

      await updateDoc(doc(db, 'products', id), {
        currentStock: newStock,
        lastUpdated: serverTimestamp()
      });

      const txData: any = {
        productId: id,
        type: movementType,
        quantity: movementQuantity,
        timestamp: serverTimestamp(),
        userId: user?.uid || 'anonymous',
        notes: movementNotes
      };

      if (movementType === 'OUT') {
        txData.recipient = recipient.trim();
      }

      await addDoc(collection(db, 'transactions'), txData);

      setIsMovementModalOpen(false);
      setMovementQuantity(1);
      setMovementNotes('');
      setRecipient('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      navigate('/inventory');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
    </div>
  );

  if (!product) return null;

  const isLow = product.currentStock <= product.minStock;
  const isSecurity = product.currentStock <= product.securityStock;
  const isOver = product.currentStock >= product.maxStock;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="flex items-center justify-between gap-6">
        <button 
          onClick={() => navigate('/inventory')}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-all font-bold p-3 bg-white/5 border border-white/10 rounded-xl"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">Inventario</span>
        </button>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsEditModalOpen(true)} 
            className="flex items-center justify-center gap-2 bg-amber-600 border border-amber-600/20 text-black font-bold py-3 px-8 rounded-xl hover:bg-amber-500 transition-all text-[10px] uppercase tracking-widest"
          >
            <Edit3 size={16} />
            Editar Datos
          </button>
          <button 
            onClick={handleDelete} 
            className="flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 font-bold py-3 px-8 rounded-xl hover:bg-red-500/20 transition-all text-[10px] uppercase tracking-widest"
          >
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Details Card */}
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-[#141414] p-10 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white mb-2">{product.name}</h1>
                <div className="flex items-center gap-6 mt-3">
                  <span className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] bg-black/40 border border-white/5 px-2 py-1 rounded">
                    <Hash size={12} className="opacity-40" />
                    {product.sku}
                  </span>
                  <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="opacity-40" />
                    ACT: {product.lastUpdated ? format(product.lastUpdated.toDate(), "d MMM, HH:mm", { locale: es }) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/40 border border-white/5 rounded-lg text-amber-500/60">
                        <MapPin size={14} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Ubicación</p>
                        <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">{locations.find(l => l.id === product.locationId)?.name || 'General'}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/40 border border-white/5 rounded-lg text-white/20">
                        <CheckCircle2 size={14} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Posición Exacta</p>
                        <p className="text-[11px] font-bold text-white/60 lowercase tracking-widest italic">{product.exactLocation || 'No especificada'}</p>
                      </div>
                   </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl flex flex-col items-center justify-center min-w-[140px] shadow-2xl border ${isLow ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                <span className="text-5xl font-mono font-bold leading-none tracking-tighter">{product.currentStock}</span>
                <span className="text-[10px] font-black uppercase tracking-widest mt-3 opacity-60">{product.unit || 'uds'}</span>
              </div>
            </div>

            <p className="text-sm text-white/40 leading-loose italic font-medium mb-10 border-l-2 border-white/5 pl-6">{product.description || 'Sin especificaciones técnicas registradas en la base de datos.'}</p>
            
            <div className="grid grid-cols-3 gap-8 pt-10 border-t border-white/5">
               <div>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2 text-center">Referencia Mínima</p>
                  <p className="p-3 bg-black/40 rounded-lg text-xl font-mono font-bold text-white border border-white/5 text-center">{product.minStock}</p>
               </div>
               <div>
                  <p className="p-3 bg-white/5 rounded-lg text-xl font-mono font-bold text-white border border-white/10 text-center mt-6 shadow-inner">{product.securityStock}</p>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-2 text-center">Seguridad</p>
               </div>
               <div>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2 text-center">Límite Máximo</p>
                  <p className="p-3 bg-black/40 rounded-lg text-xl font-mono font-bold text-white border border-white/5 text-center">{product.maxStock}</p>
               </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-6">
            <button 
              onClick={() => { setMovementType('IN'); setIsMovementModalOpen(true); }}
              className="bg-amber-600 text-black p-8 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20 active:scale-95 group"
            >
              <TrendingUp size={28} className="group-hover:-translate-y-1 transition-transform" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px]">Registrar Entrada</span>
            </button>
            <button 
              onClick={() => { setMovementType('OUT'); setIsMovementModalOpen(true); }}
              className="bg-[#1a1a1a] text-white border border-white/10 p-8 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-white/[0.08] transition-all shadow-2xl active:scale-95 group"
            >
              <TrendingDown size={28} className="group-hover:translate-y-1 transition-transform opacity-60" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px] opacity-60">Registrar Salida</span>
            </button>
          </div>
        </div>

        {/* Side Panel: Status & Alerts */}
        <div className="space-y-6">
          <div className="bg-[#141414] p-8 rounded-xl border border-white/10 shadow-2xl">
            <h2 className="text-xl font-serif font-bold italic text-white mb-8 flex items-center gap-3">
              <AlertCircle size={20} className="text-white/20" />
              Estatus Logístico
            </h2>
            <div className="space-y-6">
              <div className={`p-6 rounded-xl border flex items-start gap-4 transition-all ${isLow ? 'bg-red-500/5 border-red-500/20 text-red-500' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'}`}>
                {isLow ? <AlertCircle size={24} className="mt-1 flex-shrink-0" /> : <CheckCircle2 size={24} className="mt-1 flex-shrink-0" />}
                <div>
                  <p className="font-black text-[10px] uppercase tracking-widest leading-tight">{isLow ? 'Reposición Crítica' : 'Nivel Certificado'}</p>
                  <p className="text-[11px] font-medium opacity-60 mt-2 leading-relaxed">
                    {isLow 
                      ? 'Las existencias actuales no garantizan la continuidad operativa.' 
                      : 'El inventario cumple con los estándares de seguridad establecidos.'}
                  </p>
                </div>
              </div>

               {isSecurity && !isLow && (
                <div className="p-6 rounded-xl border bg-yellow-500/5 border-yellow-500/20 text-yellow-500 flex items-start gap-4">
                  <AlertCircle size={24} className="mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-black text-[10px] uppercase tracking-widest leading-tight">Umbral de Seguridad</p>
                    <p className="text-[11px] font-medium opacity-60 mt-2 leading-relaxed">Entrando en zona de pre-alerta: Monitorizar abastecimiento.</p>
                  </div>
                </div>
              )}

              {isOver && (
                <div className="p-6 rounded-xl border bg-white/5 border-white/10 text-white flex items-start gap-4">
                  <Info size={24} className="mt-1 flex-shrink-0 opacity-40" />
                  <div>
                    <p className="font-black text-[10px] uppercase tracking-widest leading-tight opacity-40">Excedente de Stock</p>
                    <p className="text-[11px] font-medium opacity-40 mt-2 leading-relaxed">Inventario optimizado por encima del máximo ideal sugerido.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] p-8 rounded-xl border border-white/10 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package size={80} />
             </div>
             <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Métricas Pro</h3>
             <p className="text-white font-medium text-sm leading-relaxed relative z-10 italic font-serif">Algoritmos de predicción sugieren un incremento de demanda del 12% para este SKU el próximo trimestre.</p>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-[#111111] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
                <h2 className="text-2xl font-serif italic text-white leading-none">Editar Producto</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-white/40 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleUpdate} className="p-8 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Nombre</label>
                      <input
                        required
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">SKU</label>
                      <input
                        required
                        type="text"
                        value={editFormData.sku}
                        onChange={(e) => setEditFormData({...editFormData, sku: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Categoría</label>
                       <select
                         required
                         value={editFormData.categoryId}
                         onChange={(e) => setEditFormData({...editFormData, categoryId: e.target.value})}
                         className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white/60 text-xs font-bold uppercase tracking-widest"
                       >
                         <option value="">Seleccionar Categoría</option>
                         {categories.map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                         ))}
                       </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Ubicación</label>
                       <select
                         value={editFormData.locationId}
                         onChange={(e) => setEditFormData({...editFormData, locationId: e.target.value})}
                         className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white/60 text-xs font-bold uppercase tracking-widest"
                       >
                         <option value="">Seleccionar Ubicación</option>
                         {locations.map(l => (
                           <option key={l.id} value={l.id}>{l.name}</option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Posición Exacta</label>
                       <input
                         type="text"
                         value={editFormData.exactLocation}
                         onChange={(e) => setEditFormData({...editFormData, exactLocation: e.target.value})}
                         className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">P. Compra</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.purchasePrice}
                          onChange={(e) => setEditFormData({...editFormData, purchasePrice: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Unidad</label>
                        <input
                          type="text"
                          value={editFormData.unit}
                          onChange={(e) => setEditFormData({...editFormData, unit: e.target.value})}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8">
                   <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest block text-center">Stock Mín.</label>
                    <input
                      type="number"
                      value={editFormData.minStock}
                      onChange={(e) => setEditFormData({...editFormData, minStock: Number(e.target.value)})}
                      className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-center font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest block text-center">Seguridad</label>
                    <input
                      type="number"
                      value={editFormData.securityStock}
                      onChange={(e) => setEditFormData({...editFormData, securityStock: Number(e.target.value)})}
                      className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-center font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest block text-center">Máximo</label>
                    <input
                      type="number"
                      value={editFormData.maxStock}
                      onChange={(e) => setEditFormData({...editFormData, maxStock: Number(e.target.value)})}
                      className="w-full px-2 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-center font-mono"
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Descripción</label>
                  <textarea
                    rows={3}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white mt-1"
                  ></textarea>
                </div>

                <div className="mt-10 flex gap-6">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-4 font-bold text-white/30 hover:text-white uppercase tracking-widest text-[10px]"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 text-black font-black py-4 rounded-xl hover:bg-amber-500 uppercase tracking-widest text-xs"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMovementModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-[#111111] border border-white/10 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className={`p-6 border-b border-white/5 bg-[#1a1a1a] flex items-center gap-4`}>
                <div className={`p-3 rounded-lg ${movementType === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : movementType === 'OUT' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {movementType === 'IN' ? <TrendingUp size={24} /> : movementType === 'OUT' ? <TrendingDown size={24} /> : <RefreshCw size={24} />}
                </div>
                <h2 className="text-2xl font-serif italic text-white leading-none">Registrar {movementType === 'IN' ? 'Entrada' : movementType === 'OUT' ? 'Salida' : 'Ajuste'}</h2>
              </div>
              
              <div className="flex border-b border-white/5 bg-black/20">
                {(['IN', 'OUT', 'ADJUST'] as TransactionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMovementType(type)}
                    className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${movementType === type ? 'text-amber-500 bg-amber-500/5' : 'text-white/20 hover:text-white/40'}`}
                  >
                    {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajustar Total'}
                  </button>
                ))}
              </div>
              
              <form onSubmit={handleMovement} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">
                    {movementType === 'ADJUST' ? 'Nuevo Stock Total' : `Cantidad Detallada (${product.unit})`}
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={movementQuantity}
                    onChange={(e) => setMovementQuantity(Number(e.target.value))}
                    className="w-full px-4 py-8 bg-black/40 border border-white/5 rounded-2xl text-white text-5xl font-mono font-bold text-center focus:outline-none focus:border-amber-500/40"
                  />
                </div>

                {movementType === 'OUT' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">
                      Entregado A (Destinatario) <span className="text-amber-500">*</span>
                    </label>
                    <input
                      required={movementType === 'OUT'}
                      type="text"
                      placeholder="Nombre del personal receptor, servicio o sector"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full px-4 py-4 bg-black/40 border border-white/5 rounded-xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-amber-500/20 transition-all font-medium"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Notas / Justificación</label>
                  <textarea
                    rows={2}
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="e.g. Albarán #XJ-88, Reposición Mensual"
                    className="w-full px-4 py-4 bg-black/40 border border-white/5 rounded-xl text-white placeholder:text-white/10 italic text-sm focus:outline-none focus:border-amber-500/20 transition-all font-medium"
                  ></textarea>
                </div>

                <div className="flex gap-6 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsMovementModalOpen(false)}
                    className="flex-1 py-4 font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 text-black font-black py-4 rounded-xl transition-all shadow-xl shadow-black/40 uppercase tracking-widest text-xs ${movementType === 'IN' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-white hover:bg-white/90'}`}
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
