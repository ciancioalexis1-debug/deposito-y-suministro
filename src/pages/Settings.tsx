import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category, Location, OperationType } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import { 
  Plus, 
  Trash2, 
  Tag,
  Shield,
  Smartphone,
  Globe,
  MapPin,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');

  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });
    const unsubLocs = onSnapshot(collection(db, 'locations'), (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    });
    return () => {
        unsubCats();
        unsubLocs();
    };
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName,
        description: newCategoryDesc
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName) return;
    try {
      await addDoc(collection(db, 'locations'), {
        name: newLocationName,
        description: newLocationDesc
      });
      setNewLocationName('');
      setNewLocationDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'locations');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar categoría?')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('¿Eliminar ubicación?')) return;
    try {
      await deleteDoc(doc(db, 'locations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `locations/${id}`);
    }
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Configuración del Sistema</h1>
        <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Parámetros Operativos y Gestión de Categorías</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold italic text-white leading-none">Gestión de Categorías</h2>
          <p className="text-sm text-white/40 italic font-medium leading-relaxed">Las etiquetas semánticas permiten una segmentación lógica de los activos y una optimización en los flujos de auditoría.</p>
        </div>

        <div className="lg:col-span-2 space-y-10">
          <form onSubmit={handleAddCategory} className="bg-[#141414] p-10 rounded-xl border border-white/10 flex flex-col md:flex-row gap-6 items-end shadow-2xl relative overflow-hidden group">
            <div className="flex-1 space-y-3 w-full relative z-10">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] ml-1">Vincular Nueva Categoría</label>
              <input
                required
                type="text"
                placeholder="e.g. Materia Prima, Periféricos..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-4 py-4 bg-black/40 border border-white/5 rounded-xl text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/20 italic font-serif"
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 text-black font-black h-[56px] px-10 rounded-xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20 active:scale-95 whitespace-nowrap text-[10px] uppercase tracking-widest relative z-10"
            >
              Integrar
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(c => (
              <motion.div 
                layout
                key={c.id} 
                className="bg-[#1a1a1a] p-6 rounded-xl border border-white/5 flex items-center justify-between group hover:border-amber-500/10 transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg text-white/20 group-hover:text-amber-500 transition-colors shadow-inner">
                    <Tag size={16} />
                  </div>
                  <div>
                    <p className="font-serif italic font-bold text-white group-hover:text-amber-500 transition-colors leading-tight">{c.name}</p>
                    <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.2em] mt-1">REF:{c.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteCategory(c.id)}
                  className="p-2 text-white/5 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-white/5" />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold italic text-white leading-none">Ubicaciones del Almacén</h2>
          <p className="text-sm text-white/40 italic font-medium leading-relaxed">Defina los puntos físicos de almacenamiento (naves, estantes, niveles) para una localización precisa de los bienes.</p>
        </div>

        <div className="lg:col-span-2 space-y-10">
          <form onSubmit={handleAddLocation} className="bg-[#141414] p-10 rounded-xl border border-white/10 flex flex-col md:flex-row gap-6 items-end shadow-2xl relative overflow-hidden group">
            <div className="flex-1 space-y-3 w-full relative z-10">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] ml-1">Nueva Ubicación Física</label>
              <input
                required
                type="text"
                placeholder="e.g. Almacén Central, Nave A..."
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="w-full px-4 py-4 bg-black/40 border border-white/5 rounded-xl text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/20 italic font-serif"
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 text-black font-black h-[56px] px-10 rounded-xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20 active:scale-95 whitespace-nowrap text-[10px] uppercase tracking-widest relative z-10"
            >
              Vincular
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map(l => (
              <motion.div 
                layout
                key={l.id} 
                className="bg-[#1a1a1a] p-6 rounded-xl border border-white/5 flex items-center justify-between group hover:border-amber-500/10 transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg text-white/20 group-hover:text-amber-500 transition-colors shadow-inner">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="font-serif italic font-bold text-white group-hover:text-amber-500 transition-colors leading-tight">{l.name}</p>
                    <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.2em] mt-1">LOC:{l.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteLocation(l.id)}
                  className="p-2 text-white/5 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-white/5" />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold italic text-white">Preferencias de Auditoría</h2>
          <p className="text-sm text-white/40 italic font-medium leading-relaxed">Configuración de protocolos de rastreo y niveles de redundancia de datos.</p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#141414] p-10 rounded-xl border border-white/10 flex items-start gap-8 opacity-40 group hover:opacity-100 transition-all cursor-not-allowed">
             <div className="p-4 bg-white/5 text-white rounded-xl shadow-inner border border-white/5">
                <Globe size={24} className="opacity-40" />
             </div>
             <div>
                <h3 className="font-serif italic font-bold text-white">Protocolo de Red</h3>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">Región Latam-V1. La migración a nodos descentralizados estará disponible en la próxima actualización.</p>
             </div>
          </div>
          
          <div className="bg-[#141414] p-10 rounded-xl border border-white/10 flex items-start gap-8 opacity-40 group hover:opacity-100 transition-all cursor-not-allowed">
             <div className="p-4 bg-zinc-900 border border-white/10 text-white rounded-xl shadow-inner">
                <Shield size={24} className="opacity-40" />
             </div>
             <div>
                <h3 className="font-serif italic font-bold text-white">Inmunidad de Datos</h3>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">Los roles de administrador y supervisión garantizan una cadena de bloques de información inalterable.</p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}
