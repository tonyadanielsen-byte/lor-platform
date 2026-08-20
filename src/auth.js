import { auth, db } from './firebase.js';

function friendlyAuthError(code) {
  const messages = {
    'auth/invalid-credential': 'Feil e-postadresse eller passord.',
    'auth/wrong-password': 'Feil e-postadresse eller passord.',
    'auth/user-not-found': 'Ingen bruker er registrert med denne e-postadressen.',
    'auth/invalid-email': 'Kontroller e-postadressen.',
    'auth/user-disabled': 'Denne brukeren er deaktivert.',
    'auth/too-many-requests': 'For mange forsøk. Prøv igjen senere.',
    'auth/network-request-failed': 'Nettverksfeil. Kontroller forbindelsen.',
  };
  return messages[code] || 'Innloggingen mislyktes.';
}

export async function signIn(email, password) {
  try {
    return await auth.signInWithEmailAndPassword(email.trim(), password);
  } catch (error) {
    error.friendlyMessage = friendlyAuthError(error.code);
    throw error;
  }
}

export function signOut() {
  return auth.signOut();
}

export function sendPasswordReset(email) {
  return auth.sendPasswordResetEmail(email.trim());
}

export function onAuth(callback) {
  return auth.onAuthStateChanged(async user => {
    if (!user) return callback(null);
    let profile = null;
    try {
      const snap = await db.ref(`lor/users/${user.uid}`).once('value');
      profile = snap.val();
    } catch (error) {
      console.warn('[LOR] Profile lookup failed', error);
    }
    callback({
      uid: user.uid,
      email: user.email || '',
      name: profile?.name || user.displayName || user.email?.split('@')[0] || 'Bruker',
      role: profile?.role || 'leder',
      departments: profile?.departments || [],
    });
  });
}
