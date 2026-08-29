// ON1Ecosystem Firebase Authentication
// app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Your Firebase Web App configuration
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Make Firebase available to other pages/scripts
window.firebaseApp = app;
window.firebaseAuth = auth;

// Check authentication state
onAuthStateChanged(auth, user => {
  if (user) {
    console.log("ON1 user signed in:", user.email);
  } else {
    console.log("No ON1 user signed in.");
  }
});
