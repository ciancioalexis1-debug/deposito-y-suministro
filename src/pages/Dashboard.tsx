import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Transaction } from '../types';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Package, 
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qProducts = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    });

    const qTransactions = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(5));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setRecentTransactions(docs);
    });

    return () => {
      unsubProducts();
      unsubTransactions();
    };
  }, []);

  const outOfStock = products.filter(p => p.currentStock <= 0);
  const lowStock = products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock);
  const securityStockAlert = products.filter(p => p.currentStock > p.minStock && p.currentStock <= p.securityStock);

  const chartData = products.slice(0, 10).map(p => ({
    name: p.name,
    stock: p.currentStock,
    min: p.minStock
  }));

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-[#141414] p-6 rounded-xl border border-white/10 flex flex-col gap-2 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{title}</span>
        <div className={`p-2 rounded-lg ${color === 'red' ? 'bg-red-500/10 text-red-500' : color === 'orange' ? 'bg-amber-500/10 text-amber-500' : color === 'yellow' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-white/5 text-white/60'}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-serif font-bold text-white tracking-tight">{value}</span>
        {subtitle && <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">{subtitle}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Panel de Control</h1>
        <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Resumen Operativo del Almacén</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="SKUs Registrados" 
          value={products.length} 
          icon={Package} 
          color="zinc" 
          subtitle="Artículos base"
        />
        <StatCard 
          title="Agotados" 
          value={outOfStock.length} 
          icon={TrendingDown} 
          color="red" 
          subtitle="Requiere Acción"
        />
        <StatCard 
          title="Stock Bajo (Mín)" 
          value={lowStock.length} 
          icon={AlertTriangle} 
          color="orange" 
          subtitle="En Alerta"
        />
        <StatCard 
          title="S. Seguridad" 
          value={securityStockAlert.length} 
          icon={TrendingUp} 
          color="yellow" 
          subtitle="Preventivo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Chart */}
        <div className="lg:col-span-2 bg-[#141414] p-8 rounded-xl border border-white/10 shadow-2xl">
          <div className="mb-10">
            <h2 className="text-2xl font-serif font-bold italic text-white">Estado de Niveles</h2>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1">Comparativa Detallada de Existencias</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#ffffff08' }}
                  contentStyle={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="stock" radius={[4, 4, 0, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.stock <= entry.min ? '#ef4444' : '#d97706'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-[#141414] p-8 rounded-xl border border-white/10 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-serif font-bold italic text-white">Movimientos</h2>
            <Link to="/transactions" className="text-[10px] font-bold text-white/40 hover:text-amber-500 transition-colors uppercase tracking-[0.2em]">Ver Historial</Link>
          </div>
          <div className="space-y-5 flex-1">
            {recentTransactions.map((t) => {
              const product = products.find(p => p.id === t.productId);
              return (
                <div key={t.id} className="flex items-center gap-4 group border-b border-white/5 pb-5 last:border-0 last:pb-0">
                  <div className={`p-2 rounded-lg ${t.type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {t.type === 'IN' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-serif italic text-white truncate group-hover:text-amber-500 transition-colors">{product?.name || 'Desconocido'}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-0.5">{t.type === 'IN' ? 'Entrada' : 'Salida'} • {format(t.timestamp?.toDate() || new Date(), "d MMM", { locale: es })}</p>
                  </div>
                  <div className={`text-sm font-mono font-bold ${t.type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'IN' ? '+' : '-'}{t.quantity}
                  </div>
                </div>
              );
            })}
            {recentTransactions.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Sin movimientos registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <section className="bg-red-500/5 border border-red-500/10 p-10 rounded-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-8 text-red-500">
            <AlertTriangle size={24} />
            <h2 className="text-2xl font-bold italic font-serif">Alertas de Reposición Urgente</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outOfStock.map(p => (
              <Link key={p.id} to={`/inventory/${p.id}`} className="bg-[#1a1a1a] p-5 rounded-xl border border-red-500/20 flex items-center justify-between hover:border-red-500/50 transition-all group">
                <div>
                  <p className="font-serif italic text-white text-lg leading-tight">{p.name}</p>
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">STOCK AGOTADO</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">
                  <ArrowUpRight size={14} />
                </div>
              </Link>
            ))}
            {lowStock.map(p => (
              <Link key={p.id} to={`/inventory/${p.id}`} className="bg-[#1a1a1a] p-5 rounded-xl border border-amber-500/20 flex items-center justify-between hover:border-amber-500/50 transition-all group">
                <div>
                  <p className="font-serif italic text-white text-lg leading-tight">{p.name}</p>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1">BAJO MÍNIMO: {p.currentStock} / {p.minStock}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">
                  <ArrowUpRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
