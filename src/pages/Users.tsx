import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Trash2, 
  Shield, 
  Mail, 
  Key, 
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Users() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'operator' as 'admin' | 'operator'
  });

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'userProfiles'));
      const activeUsers: UserProfile[] = [];
      snap.forEach((doc) => {
        activeUsers.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      // Sort users: admins first, then older to newer
      activeUsers.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
      });
      setUsers(activeUsers);
    } catch (err: any) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim() || !formData.password.trim()) return;
    setActionLoading(true);
    setMessage(null);

    try {
      // Check if email/displayName is already occupied
      const duplicateExists = users.some(u => 
        (u.email && u.email.toLowerCase() === formData.email.trim().toLowerCase()) ||
        (u.displayName && u.displayName.toLowerCase() === formData.displayName.trim().toLowerCase())
      );

      if (duplicateExists) {
        throw new Error('Ya existe un colaborador con este mismo nombre o dirección de correo electrónico.');
      }

      // Generate manual safe user ID
      const customUid = 'user_' + Math.random().toString(36).substring(2, 11);
      const profileRef = doc(db, 'userProfiles', customUid);

      await setDoc(profileRef, {
        email: formData.email.trim(),
        displayName: formData.displayName.trim(),
        role: formData.role,
        password: formData.password.trim(),
        createdAt: serverTimestamp()
      });

      setMessage({ 
        type: 'success', 
        text: 'Usuario colaborador registrado y vinculado exitosamente.' 
      });
      setFormData({ email: '', password: '', displayName: '', role: 'operator' });
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Error creating user:", err);
      setMessage({ type: 'error', text: err.message || 'Error al crear usuario' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('¿Estás seguro de que deseas desvincular este colaborador del sistema? Perderá acceso inmediato.')) return;
    
    setActionLoading(true);
    try {
      const profileRef = doc(db, 'userProfiles', uid);
      await deleteDoc(profileRef);

      setMessage({ type: 'success', text: 'Usuario desvinculado con éxito.' });
      fetchUsers();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      alert(err.message || 'Error al eliminar usuario');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle size={48} className="text-red-500 mb-4 opacity-20" />
        <h2 className="text-xl font-serif italic text-white/40">Acceso Restringido</h2>
        <p className="text-xs uppercase tracking-[0.2em] text-white/20 mt-2">Sólo administradores pueden acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white">Gestión de Accesos</h1>
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">Control de Permisos y Usuarios del Sistema</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-amber-600 text-black font-bold py-3 px-8 rounded-xl hover:bg-amber-500 transition-all shadow-lg active:scale-95"
        >
          <UserPlus size={18} />
          <span className="text-[10px] uppercase tracking-widest leading-none mt-0.5">Vincular Usuario</span>
        </button>
      </header>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 border ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-bold uppercase tracking-wider">{message.text}</span>
        </motion.div>
      )}

      {loading ? (
        <div className="py-20 text-center text-white/20 uppercase tracking-[0.2em] font-bold text-xs">Cargando nómina...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {users.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#111111] border border-white/5 p-8 rounded-xl hover:border-white/10 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {u.email !== 'ciancioalexis1@gmail.com' && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-white/20 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    u.role === 'admin' ? 'bg-amber-600/10 text-amber-500' : 'bg-white/5 text-white/30'
                  }`}>
                    {u.role === 'admin' ? <Shield size={24} /> : <UsersIcon size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold italic text-white leading-tight">{u.displayName || 'Anonimo'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] px-2 py-0.5 rounded uppercase font-black tracking-widest ${
                            u.role === 'admin' ? 'bg-amber-600 text-black' : 'bg-white/10 text-white/40'
                        }`}>
                            {u.role}
                        </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-white/40">
                    <Mail size={14} />
                    <span className="text-xs font-medium">{u.email || '(Sin email)'}</span>
                  </div>
                  {(u as any).password && (
                    <div className="flex items-center gap-3 text-amber-500/70">
                      <Key size={14} />
                      <span className="text-xs font-mono font-medium">Clave: {(u as any).password}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-white/10 pt-4 border-t border-white/5">
                    ID: {u.id.substring(0, 8)}...
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal Nueva Usuario */}
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
                <h2 className="text-2xl font-serif italic text-white leading-none">Alta de Usuario</h2>
                <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-2 text-white/20 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                  <input
                    required
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white focus:outline-none focus:border-amber-500/20 italic font-serif"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">E-mail Corporativo</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20"
                    placeholder="juan@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Clave de Acceso</label>
                  <div className="relative">
                    <input
                        required
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/20 pr-10"
                        placeholder="••••••••"
                    />
                    <Key className="absolute right-3 top-3 text-white/10" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Rango / Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500/20 appearance-none cursor-pointer"
                  >
                    <option value="operator">Operador (Edición)</option>
                    <option value="admin">Administrador (Total)</option>
                  </select>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-amber-600 text-black font-black py-4 rounded-xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20 uppercase tracking-widest text-[10px] disabled:opacity-50"
                  >
                    {actionLoading ? 'Procesando...' : 'Crear Acceso'}
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
