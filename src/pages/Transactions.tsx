import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Product, UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Calendar,
  Filter,
  User,
  RefreshCw,
  History,
  Package
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'ADJUST'>('ALL');
  const [productFilter, setProductFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(docs);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const loadRefData = async () => {
      try {
        const [pSnap, uSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'userProfiles'))
        ]);
        
        const prodMap: Record<string, Product> = {};
        pSnap.docs.forEach(doc => {
          prodMap[doc.id] = { id: doc.id, ...doc.data() } as Product;
        });
        setProducts(prodMap);

        const userMap: Record<string, UserProfile> = {};
        uSnap.docs.forEach(doc => {
          userMap[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
        });
        setUserProfiles(userMap);
      } catch (err: any) {
        console.error("Error cargando referencias de movimientos:", err);
      }
    };
    loadRefData();

    return () => unsub();
  }, []);

  const filteredTransactions = transactions.filter(t => {
    const product = products[t.productId];
    const user = userProfiles[t.userId];
    
    const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user?.displayName.toLowerCase().includes(searchTerm.toLowerCase());
                          
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesProduct = productFilter === 'all' || t.productId === productFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const transDate = t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd') : '';
      matchesDate = transDate === dateFilter;
    }
    
    return matchesSearch && matchesType && matchesProduct && matchesDate;
  });

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Log de Operaciones</h1>
        <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Historial Integral de la Flota de Inventario</p>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-[#111111] p-4 rounded-xl border border-white/10 shadow-2xl">
        <div className="lg:col-span-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input
            type="text"
            placeholder="Buscar por articulo, nota o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500/40 transition-all placeholder:text-white/20"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-4">
          <Filter size={14} className="text-white/30" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-3 outline-none cursor-pointer"
          >
            <option value="ALL">Tipos Globales</option>
            <option value="IN">Entradas (+)</option>
            <option value="OUT">Salidas (-)</option>
            <option value="ADJUST">Ajustes (!)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-4">
          <Package size={14} className="text-white/30" />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-3 outline-none cursor-pointer"
          >
            <option value="all">Filtro por SKU</option>
            {Object.values(products).map((p: Product) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-4">
          <Calendar size={14} className="text-white/30" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-3 outline-none cursor-pointer inverted-calendar"
          />
        </div>
      </div>

      {/* Table-like List */}
      <div className="bg-[#141414] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="hidden md:grid grid-cols-12 gap-4 p-8 border-b border-white/5 bg-[#1a1a1a]">
          <div className="col-span-1 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">Flujo</div>
          <div className="col-span-4 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">Articulo / Operador</div>
          <div className="col-span-1 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">Cant.</div>
          <div className="col-span-3 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">Cronología</div>
          <div className="col-span-3 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic text-right">Referencia / Glosa</div>
        </div>

        <div className="divide-y divide-white/5">
          {filteredTransactions.map((t) => {
            const product = products[t.productId];
            const profile = userProfiles[t.userId];
            const isAdjust = t.type === 'ADJUST';
            const isIn = t.type === 'IN';
            
            return (
              <div key={t.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-8 items-center hover:bg-white/[0.02] transition-colors group">
                <div className="col-span-1 flex md:block">
                  <div className={`p-3 rounded-lg inline-flex border ${
                    isIn ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                    isAdjust ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                    'bg-red-500/10 border-red-500/20 text-red-500'
                  }`}>
                    {isIn ? <ArrowUpRight size={18} /> : isAdjust ? <RefreshCw size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                </div>
                
                <div className="col-span-4">
                  <p className="font-serif italic text-lg text-white group-hover:text-amber-500 transition-colors">{product?.name || '---'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">SKU: {product?.sku || t.productId.slice(0,8)}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest flex items-center gap-1">
                      <User size={10} />
                      {profile?.displayName || 'Sistema'}
                    </span>
                  </div>
                </div>

                <div className="col-span-1">
                  <p className={`text-2xl font-mono font-bold tracking-tight ${
                    isIn ? 'text-emerald-500' : 
                    isAdjust ? 'text-amber-500' : 
                    'text-red-500'
                  }`}>
                    {isIn ? '+' : isAdjust ? '' : '-'}{t.quantity.toString().padStart(2, '0')}
                  </p>
                </div>

                <div className="col-span-3 md:flex flex-col gap-1 text-white/40">
                  <p className="text-xs font-serif italic text-white/60">
                    {t.timestamp ? format(t.timestamp.toDate(), "d 'de' MMMM, yyyy", { locale: es }) : 'Cargando...'}
                  </p>
                  <div className="flex items-center gap-2 opacity-50">
                    <Calendar size={10} />
                    <span className="text-[10px] font-mono tracking-widest">
                      {t.timestamp ? format(t.timestamp.toDate(), "HH:mm 'HRS'") : '00:00'}
                    </span>
                  </div>
                </div>

                <div className="col-span-3 text-right font-medium">
                  <p className="text-xs text-white/40 italic leading-relaxed font-serif truncate hover:whitespace-normal transition-all">{t.notes || 'Sin especificaciones.'}</p>
                  {t.recipient && (
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1">
                      Destinatario: {t.recipient}
                    </p>
                  )}
                  <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.3em] mt-1">ID:{t.id.slice(-6).toUpperCase()}</p>
                </div>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && !loading && (
            <div className="py-32 text-center">
              <History className="mx-auto text-white/5 mb-6" size={64} />
              <p className="text-white/20 text-xs font-bold uppercase tracking-[0.2em] italic">No se han detectado operaciones para este filtro</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
