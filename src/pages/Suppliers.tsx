import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, Product, OperationType } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import { 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  User,
  X,
  Truck,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean, supplier: Supplier | null }>({ isOpen: false, supplier: null });
  const [products, setProducts] = useState<Product[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    paymentTerms: 'Contado'
  });

  useEffect(() => {
    const qS = query(collection(db, 'suppliers'));
    const unsubS = onSnapshot(qS, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(docs);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers'));

    const qP = query(collection(db, 'products'));
    const unsubP = onSnapshot(qP, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
    });

    return () => { unsubS(); unsubP(); };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...formData,
        createdAt: new Date()
      });
      setIsModalOpen(false);
      setFormData({ name: '', contactName: '', email: '', phone: '', address: '', paymentTerms: 'Contado' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'suppliers');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar proveedor?')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  const getSupplierProducts = (supplierId: string) => {
    return products.filter(p => p.supplierId === supplierId);
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Directorio de Proveedores</h1>
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Gestión de Enlaces y Alianzas de Suministro</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-amber-600 text-black font-bold py-3 px-8 rounded-xl hover:bg-amber-500 transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} />
          <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">Vincular Proveedor</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((s) => (
          <motion.div
            layout
            key={s.id}
            className="bg-[#141414] rounded-xl border border-white/10 p-8 flex flex-col group hover:border-white/20 transition-all shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8 relative z-10">
               <div className="w-14 h-14 bg-black/40 rounded-xl flex items-center justify-center border border-white/5 group-hover:border-amber-500/30 transition-all">
                  <Truck className="text-white/20 group-hover:text-amber-500 transition-colors" size={24} />
               </div>
               <button 
                 onClick={() => handleDelete(s.id)}
                 className="p-2 text-white/10 hover:text-red-500 transition-colors"
                >
                 <Trash2 size={16} />
               </button>
            </div>

            <div className="flex-1 relative z-10">
              <div className="flex justify-between items-start gap-4 mb-2">
                <h3 className="text-xl font-serif font-bold italic text-white leading-tight group-hover:text-amber-500 transition-colors">{s.name}</h3>
                <span className="text-[9px] px-2 py-1 bg-white/5 border border-white/10 rounded uppercase font-bold tracking-widest text-white/40 whitespace-nowrap">{s.paymentTerms || 'Contado'}</span>
              </div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-6">{s.contactName || 'Partner Homologado'}</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-white/40">
                  <Mail size={14} className="opacity-40" />
                  <span className="text-xs font-medium truncate">{s.email || 'Sin contacto digital'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/40">
                  <Phone size={14} className="opacity-40" />
                  <span className="text-xs font-medium">{s.phone || 'Sin terminal'}</span>
                </div>
                {s.address && (
                  <div className="flex items-start gap-3 text-white/40">
                    <MapPin size={14} className="opacity-40 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed italic">{s.address}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity relative z-10">
               <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">ID:{s.id.slice(-6).toUpperCase()}</span>
               <button 
                onClick={() => setHistoryModal({ isOpen: true, supplier: s })}
                className="text-[9px] font-bold uppercase tracking-widest text-white/60 hover:text-amber-500 transition-colors"
               >
                Relatar Historial
               </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {historyModal.isOpen && historyModal.supplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryModal({ isOpen: false, supplier: null })}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-[#111111] border border-white/10 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
                <div>
                  <h2 className="text-2xl font-serif italic text-white leading-none mb-1">Catálogo de Suministro</h2>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{historyModal.supplier.name}</p>
                </div>
                <button onClick={() => setHistoryModal({ isOpen: false, supplier: null })} className="p-2 text-white/20 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {getSupplierProducts(historyModal.supplier.id).length > 0 ? (
                  <div className="space-y-4">
                    {getSupplierProducts(historyModal.supplier.id).map(p => (
                      <div key={p.id} className="bg-black/40 border border-white/5 p-4 rounded-lg flex items-center justify-between group hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/5 rounded border border-white/10 flex items-center justify-center text-white/20 group-hover:text-amber-500 transition-colors">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="font-serif italic font-bold text-white leading-tight">{p.name}</p>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">SKU: {p.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg font-bold text-white">{p.currentStock}</p>
                          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">En Stock</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <Package className="mx-auto text-white/5 mb-4" size={48} />
                    <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">No hay productos vinculados a este proveedor</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="relative bg-[#111111] border border-white/10 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
                <h2 className="text-2xl font-serif italic text-white">Vincular Proveedor</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-white/20 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Empresa / Razón Social</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white focus:outline-none focus:border-amber-500/20 italic font-serif"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Contacto Principal</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Términos de Pago</label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500/20 appearance-none cursor-pointer"
                    >
                      <option value="Contado">Contado</option>
                      <option value="30 Días">30 Días</option>
                      <option value="60 Días">60 Días</option>
                      <option value="90 Días">90 Días</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Teléfono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Dirección de Sede</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20"
                  />
                </div>

                <div className="pt-8 flex gap-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 text-black font-black py-4 rounded-xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20 uppercase tracking-widest text-[10px]"
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
