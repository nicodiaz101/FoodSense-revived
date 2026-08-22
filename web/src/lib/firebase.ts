import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyChxgGBbkGYc4H0LdMaeEqoVikZ_dTLdro",
  authDomain: "foodsense-revive.firebaseapp.com",
  projectId: "foodsense-revive",
  storageBucket: "foodsense-revive.firebasestorage.app",
  messagingSenderId: "392452066897",
  appId: "1:392452066897:web:d82ad5a7138f3e926b7270",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app, firebaseConfig };
