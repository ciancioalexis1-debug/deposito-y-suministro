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
      const emailLower = emailOrName.trim().toLowerCase();

      // Check superadmin static fallback first to avoid blocking on Firestore errors on first load
      if (emailLower === 'ciancioalexis1@gmail.com' && password === 'admin123') {
        const superAdminProfile: UserProfile = {
          id: 'ciancio_admin',
          email: 'ciancioalexis1@gmail.com',
          displayName: 'Alexis Ciancio',
          role: 'admin',
        };

        // Try to save/sync to Firestore in background, but do not block login if it fails
        try {
          await setDoc(doc(db, 'userProfiles', 'ciancio_admin'), {
            email: 'ciancioalexis1@gmail.com',
            displayName: 'Alexis Ciancio',
            role: 'admin',
            password: 'admin123',
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn("Could not save fallback superadmin profile to Firestore:", e);
        }

        setProfile(superAdminProfile);
        localStorage.setItem('manual_auth_session', JSON.stringify(superAdminProfile));
        return superAdminProfile;
      }

      // If not superadmin, proceed with Firestore query
      const uSnap = await getDocs(collection(db, 'userProfiles'));
      let foundProfile: (UserProfile & { password?: string }) | null = null;

      // Safe validation of users from 'usuarios' array in localStorage as requested
      let localUsuarios: any[] = [];
      try {
        const storedUsuarios = localStorage.getItem('usuarios');
        if (storedUsuarios) {
          const parsed = JSON.parse(storedUsuarios);
          if (Array.isArray(parsed)) {
            localUsuarios = parsed;
          }
        }
      } catch (err) {
        console.warn("No se pudo parsear 'usuarios' de localStorage, se usará vacío:", err);
        localUsuarios = [];
      }

      localUsuarios.forEach((userObj: any) => {
        if (userObj && typeof userObj === 'object') {
          const email = userObj.email || '';
          const dispName = userObj.displayName || '';
          const uid = userObj.id || userObj.uid || '';
          if (
            email.toLowerCase() === emailLower ||
            dispName.toLowerCase() === emailLower ||
            uid.toLowerCase() === emailLower
          ) {
            foundProfile = {
              id: uid,
              email: email,
              displayName: dispName,
              role: userObj.role || 'operator',
              password: userObj.password || '',
            };
          }
        }
      });

      if (!foundProfile) {
        uSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const dispName = data.displayName || '';
          const email = data.email || '';
          if (
            email.toLowerCase() === emailLower ||
            dispName.toLowerCase() === emailLower ||
            docSnap.id.toLowerCase() === emailLower
          ) {
            foundProfile = { id: docSnap.id, email, displayName: dispName, role: data.role, password: data.password } as any;
          }
        });
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
