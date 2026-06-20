import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: { uid: string; email: string; displayName: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  signInWithEmail: (emailOrName: string, password: string) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem('manual_auth_session');
        if (stored) {
          const parsed = JSON.parse(stored) as UserProfile;
          // Verify with Firestore if record still exists and update state
          const docRef = doc(db, 'userProfiles', parsed.id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const updatedProfile: UserProfile = {
              id: snap.id,
              email: data.email || '',
              displayName: data.displayName || '',
              role: data.role || 'operator',
            };
            setProfile(updatedProfile);
            localStorage.setItem('manual_auth_session', JSON.stringify(updatedProfile));
          } else {
            console.warn("La sesión expiró o el colaborador fue desvinculado de la nómina.");
            localStorage.removeItem('manual_auth_session');
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("Error al restaurar sesión corporativa:", err);
        localStorage.removeItem('manual_auth_session');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'ciancioalexis1@gmail.com';

  const signInWithEmail = async (emailOrName: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const uSnap = await getDocs(collection(db, 'userProfiles'));
      let foundProfile: (UserProfile & { password?: string }) | null = null;

      uSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const dispName = data.displayName || '';
        const email = data.email || '';
        if (
          email.toLowerCase() === emailOrName.trim().toLowerCase() ||
          dispName.toLowerCase() === emailOrName.trim().toLowerCase() ||
          docSnap.id.toLowerCase() === emailOrName.trim().toLowerCase()
        ) {
          foundProfile = { id: docSnap.id, email, displayName: dispName, role: data.role, password: data.password } as any;
        }
      });

      // Superadmin seed/fallback flow in case userProfiles is blank or exact superadmin logs in with credentials
      if (emailOrName.trim().toLowerCase() === 'ciancioalexis1@gmail.com' && password === 'admin123') {
        const superAdminId = foundProfile?.id || 'ciancio_admin';
        await setDoc(doc(db, 'userProfiles', superAdminId), {
          email: 'ciancioalexis1@gmail.com',
          displayName: foundProfile?.displayName || 'Alexis Ciancio',
          role: 'admin',
          password: 'admin123',
          createdAt: serverTimestamp()
        }, { merge: true });
        foundProfile = {
          id: superAdminId,
          email: 'ciancioalexis1@gmail.com',
          displayName: foundProfile?.displayName || 'Alexis Ciancio',
          role: 'admin',
          password: 'admin123'
        };
      }

      if (!foundProfile) {
        throw new Error('Colaborador no registrado o nombre de usuario incorrecto.');
      }

      if (foundProfile.password !== password) {
        throw new Error('Contraseña de acceso incorrecta.');
      }

      const finalProfile: UserProfile = {
        id: foundProfile.id,
        email: foundProfile.email,
        displayName: foundProfile.displayName,
        role: foundProfile.role,
      };

      setProfile(finalProfile);
      localStorage.setItem('manual_auth_session', JSON.stringify(finalProfile));
      return finalProfile;
    } catch (err: any) {
      console.error("Fallo de acceso manual:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('manual_auth_session');
    setProfile(null);
  };

  const user = profile ? {
    uid: profile.id,
    email: profile.email,
    displayName: profile.displayName
  } : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signOut, signInWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
