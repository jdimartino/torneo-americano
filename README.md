# Torneo Americano

App de gestión de torneos de tenis.

## Configuración

1. Crea el archivo `public/js/config.js`:

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

2. Este archivo no se sube a Git.
3. Deploy: `firebase deploy`

## Modelo de datos (Firestore)

| Colección | Campos |
|-----------|--------|
| `jugadores` | `nombre`, `apellidos`, `categoria`, `telefono`, `email`, `numero_accion`, `pago_recibido` (bool), `JJ`, `GG` |
| `partidos_eliminatoria` | `p1a_id`, `p1b_id`, `p2c_id`, `p2d_id`, `pareja1_nombre`, `pareja2_nombre`, `score`, `games1`, `games2`, `fecha` |
| `cuartos` | `grupo` (1–4), `pareja1_id_a`, `pareja1_id_b`, `pareja1_nombre`, `pareja2_id_a`, `pareja2_id_b`, `pareja2_nombre`, `score`, `ganador` |
| `semifinales` | `cruce` (1–2), `pareja1_nombre`, `pareja2_nombre`, `score`, `ganador` |
| `final` | `pareja1_nombre`, `pareja2_nombre`, `score`, `ganador` |

## Scripts de mantenimiento

Los scripts `repair-data.js` y `reset-gg.js` están en la raíz del proyecto y contienen la config de Firebase. **No commitear keys reales al repo.**
