const firebaseConfig = {
  apiKey: 'AIzaSyDT6bW6kErdyhVK3WTMDEERsCLRTdjnoTg',
  authDomain: 'opex-nortura.firebaseapp.com',
  databaseURL: 'https://opex-nortura-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'opex-nortura',
  storageBucket: 'opex-nortura.firebasestorage.app',
  messagingSenderId: '72695195747',
  appId: '1:72695195747:web:cb8ca9c1970b4fc3c9b056',
};

if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);

export const auth = window.firebase.auth();
export const db = window.firebase.database();
export const lorRoot = db.ref('lor');

export function serverTimestamp() {
  return window.firebase.database.ServerValue.TIMESTAMP;
}
