import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Incolla qui la configurazione del tuo progetto Firebase.
// La trovi su: Firebase Console > Project settings (icona ingranaggio) >
// General > "Your apps" > icona Web (</>) > "SDK setup and configuration".
// Se non hai ancora registrato un'app Web nel progetto, creala da lì: è gratis
// e non richiede hosting separato, è solo per ottenere queste chiavi.
const firebaseConfig = {
  apiKey: "AIzaSyB6we5krTRA-WolzbMkf4O6a-VF8z555Bw",
  authDomain: "ghisa-tracker-2026.firebaseapp.com",
  projectId: "ghisa-tracker-2026",
  storageBucket: "ghisa-tracker-2026.firebasestorage.app",
  messagingSenderId: "694466878823",
  appId: "1:694466878823:web:3c673c5b7280a8f88723c2",
  measurementId: "G-XCSJHZGR9J"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);
