importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

// Configuración dinámica por URL params o fallback al proyecto foodsense-revive
const urlParams = new URL(location.href).searchParams;
const firebaseConfig = {
  apiKey: urlParams.get("apiKey") || "AIzaSyChxgGBbkGYc4H0LdMaeEqoVikZ_dTLdro",
  authDomain: urlParams.get("authDomain") || "foodsense-revive.firebaseapp.com",
  projectId: urlParams.get("projectId") || "foodsense-revive",
  storageBucket: urlParams.get("storageBucket") || "foodsense-revive.firebasestorage.app",
  messagingSenderId: urlParams.get("messagingSenderId") || "392452066897",
  appId: urlParams.get("appId") || "1:392452066897:web:d82ad5a7138f3e926b7270",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "FoodSense";
  const options = {
    body: payload.notification?.body ?? "Tenés una nueva alerta de tu despensa.",
    icon: "/foodsense-icon-192.png",
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});
