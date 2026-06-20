import { OperationType, FirestoreErrorInfo, UserProfile } from '../types';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let storedProfile: UserProfile | null = null;
  try {
    const session = localStorage.getItem('manual_auth_session');
    if (session) {
      storedProfile = JSON.parse(session);
    }
  } catch (ex) {
    // ignore
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: storedProfile?.id || null,
      email: storedProfile?.email || null,
      emailVerified: true,
      isAnonymous: false,
    },
    operationType,
    path
  };
  
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error: ', jsonError);
  throw new Error(jsonError);
}
