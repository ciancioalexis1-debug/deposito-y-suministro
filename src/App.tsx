import React, { useState, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, googleProvider, auth } from './lib/firebase';
import { AuthProvider, useAuth } from './lib/auth';
import { 
  BarChart3, 
  Package, 
  History, 
  Truck, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard,
  Users as UsersIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Components
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import ProductDetail from './pages/ProductDetail';
import Reports from './pages/Reports';
import Users from './pages/Users';

const NavItem = ({ to, icon: Icon, children, onClick }: { to: string, icon: any, children: ReactNode, onClick?: () => void }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        isActive 
          ? 'bg-white/5 border border-white/10 text-white shadow-lg shadow-black/20' 
          : 'text-white/50 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium text-sm">{children}</span>
    </Link>
  );
};

const AuthWrapper = ({ children }: { children: ReactNode }) => {
  const { user, loading, signInWithEmail } = useAuth();
  const [emailOrName, setEmailOrName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrName.trim() || !password) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await signInWithEmail(emailOrName, password);
    } catch (err: any) {
      setAuthError(err.message || "Credenciales incorrectas.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#111111] p-10 rounded-3xl border border-white/10 shadow-2xl shadow-black/50"
        >
          <div className="w-16 h-16 bg-amber-600 rounded-xl flex items-center justify-center mb-8 mx-auto shadow-lg shadow-amber-900/20">
            <Package className="text-black" size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3 italic font-serif">
            Almacén Pro
          </h1>
          <p className="text-white/40 mb-10 max-w-[280px] mx-auto text-[10px] uppercase font-bold tracking-[0.2em] leading-relaxed">
            Ingreso y Control de Colaboradores
          </p>

          <form onSubmit={handleLocalLogin} className="space-y-5 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">
                E-mail o Nombre de Colaborador
              </label>
              <input
                required
                type="text"
                value={emailOrName}
                onChange={(e) => setEmailOrName(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20 italic font-serif"
                placeholder="Ej: Alexis, Juan, ciancioalexis1@gmail.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">
                Clave de Acceso Fija
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20 font-mono"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left text-red-400 text-[11px] leading-relaxed space-y-1">
                <p className="font-bold uppercase tracking-wider text-[9px]">Aviso de Seguridad</p>
                <p>{authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-amber-600 text-black font-bold py-4 px-6 rounded-xl hover:bg-amber-500 transition-all shadow-lg active:scale-95 mt-4 disabled:opacity-50"
            >
              {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar al Almacén'}
            </button>

            <div className="pt-4 border-t border-white/5 text-center">
              <p className="text-[9px] text-white/20 uppercase tracking-widest leading-loose">
                Para el primer acceso del administrador, use: <br/>
                <span className="text-amber-500/50">ciancioalexis1@gmail.com</span> / <span className="text-amber-500/50">admin123</span>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

const Layout = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex font-sans text-white selection:bg-amber-600 selection:text-black">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/10 p-6 bg-[#0d0d0d] sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center shadow-lg shadow-amber-900/20">
            <Package className="text-black" size={18} />
          </div>
          <h1 className="text-2xl font-serif font-bold italic tracking-tight text-white">Almacén <span className="text-xs font-sans not-italic uppercase tracking-[0.2em] opacity-40 ml-1">Pro</span></h1>
        </div>
        
        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 px-4 font-bold">Navegación</div>
        <nav className="flex-1 space-y-1">
          <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
          <NavItem to="/inventory" icon={Package}>Inventario</NavItem>
          <NavItem to="/transactions" icon={History}>Movimientos</NavItem>
          <NavItem to="/suppliers" icon={Truck}>Proveedores</NavItem>
          <NavItem to="/reports" icon={BarChart3}>Reportes</NavItem>
          
          {isAdmin && (
            <>
              <div className="pt-6 pb-2 text-[10px] uppercase tracking-widest text-white/30 px-4 font-bold">Administración</div>
              <NavItem to="/users" icon={UsersIcon}>Usuarios</NavItem>
            </>
          )}

          <div className="pt-6 pb-2 text-[10px] uppercase tracking-widest text-white/30 px-4 font-bold">Configuración</div>
          <NavItem to="/settings" icon={SettingsIcon}>Ajustes</NavItem>
        </nav>

        <div className="pt-6 border-t border-white/10 mt-6">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-8 h-8 rounded-full border border-white/20 bg-amber-600/10 text-amber-500 flex items-center justify-center font-bold text-xs uppercase select-none shrink-0">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.displayName}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-white/30 truncate uppercase tracking-wider">{user?.email}</p>
                <span className={`text-[8px] px-1 rounded uppercase font-bold tracking-tighter ${isAdmin ? 'bg-amber-600/20 text-amber-500' : 'bg-white/10 text-white/40'}`}>
                    {profile?.role || 'User'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full px-4 py-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/10 z-40 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
           <div className="w-7 h-7 bg-amber-600 rounded flex items-center justify-center">
             <Package className="text-black" size={16} />
           </div>
           <span className="font-serif font-bold italic tracking-tight text-white leading-none">Almacén Pro</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-white"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-[#0d0d0d] z-[60] p-6 flex flex-col shadow-2xl ring-1 ring-white/10"
          >
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center">
                  <Package className="text-black" size={18} />
                </div>
                <span className="text-xl font-serif font-bold italic tracking-tight text-white">Almacén Pro</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md text-white/50"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 px-4 font-bold">Navegación</div>
            <nav className="flex-1 space-y-1">
              <NavItem to="/" icon={LayoutDashboard} onClick={() => setIsSidebarOpen(false)}>Dashboard</NavItem>
              <NavItem to="/inventory" icon={Package} onClick={() => setIsSidebarOpen(false)}>Inventario</NavItem>
              <NavItem to="/transactions" icon={History} onClick={() => setIsSidebarOpen(false)}>Movimientos</NavItem>
              <NavItem to="/suppliers" icon={Truck} onClick={() => setIsSidebarOpen(false)}>Proveedores</NavItem>
              <NavItem to="/reports" icon={BarChart3} onClick={() => setIsSidebarOpen(false)}>Reportes</NavItem>
              
              {isAdmin && (
                <>
                  <div className="pt-6 pb-2 text-[10px] uppercase tracking-widest text-white/30 px-4 font-bold">Administración</div>
                  <NavItem to="/users" icon={UsersIcon} onClick={() => setIsSidebarOpen(false)}>Usuarios</NavItem>
                </>
              )}

              <div className="pt-6 pb-2 text-[10px] uppercase tracking-widest text-white/30 px-4 font-bold">Configuración</div>
              <NavItem to="/settings" icon={SettingsIcon} onClick={() => setIsSidebarOpen(false)}>Ajustes</NavItem>
            </nav>

            <button 
              onClick={() => {
                setIsSidebarOpen(false);
                signOut();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 mt-auto text-white/40 text-xs font-bold uppercase tracking-widest"
            >
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-8 pt-24 lg:pt-12 max-w-7xl mx-auto w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthWrapper>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/:id" element={<ProductDetail />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AuthWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}
