export class GoogleAuthProvider {
  scopes = [];
}

export function getAuth(app?: any) {
  return {
    currentUser: null,
    app,
  };
}

export async function signInWithPopup(auth: any, provider: any) {
  return {
    user: {
      uid: 'ciancio_admin',
      email: 'ciancioalexis1@gmail.com',
      displayName: 'Alexis Ciancio',
    },
  };
}

export async function signOut(auth: any) {
  localStorage.removeItem('manual_auth_session');
  return Promise.resolve();
}

export async function signInWithEmailAndPassword(auth: any, email: string, dbpassword?: string) {
  return {
    user: {
      uid: 'ciancio_admin',
      email,
      displayName: 'Alexis Ciancio',
    },
  };
}
