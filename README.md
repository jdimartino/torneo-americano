# Torneo Americano

App de gestión de torneos de tenis.

## Configuración

1.  Crea el archivo `public/js/config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

2.  Este archivo no se sube a Git.
3.  Deploy: `firebase deploy`
