import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCRIQ-OpQUygS51I1yhbX6yYtCAQv_mW3g",
  authDomain: "toma-6191d.firebaseapp.com",
  projectId: "toma-6191d",
  storageBucket: "toma-6191d.firebasestorage.app",
  messagingSenderId: "169460558068",
  appId: "1:169460558068:web:bafe09146b603e3cf916a1",
  measurementId: "G-68G2EVJJBH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };