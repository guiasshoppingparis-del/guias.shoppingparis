# Sistema de Gestión de Visitas — Shopping Paris

Gestión de guías de turismo, visitas y liberación de estacionamiento en la sala VIP de guías.

**Versión actual: v0.1** — Estructura base (autenticación, roles y usuarios, catálogos).
Ver `CHANGELOG.md` para el detalle de versiones y el roadmap.

## Arquitectura

- **Frontend**: React puro por CDN (sin build step). Archivos: `index.html`, `app.js`, `firebase-config.js`, `styles.css`.
- **Base de datos**: Firebase Firestore.
- **Autenticación**: Firebase Auth (email/contraseña).
- **Hosting**: GitHub Pages.

No hay proceso de compilación: se edita cualquier archivo y se sube tal cual.

## Puesta en marcha (primera vez)

### 1. Crear el proyecto de Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com) → crear proyecto nuevo.
2. **Authentication** → Sign-in method → habilitar **Email/contraseña**.
3. **Firestore Database** → crear base de datos (modo producción).
4. En **Reglas** de Firestore, pegar el contenido de `firestore.rules` de este repo.
5. **Storage** (menú izquierdo) → si aparece "Comenzar" / "Get started", crearlo también. En la pestaña **Reglas** de Storage (distinta a la de Firestore), pegar el contenido de `storage.rules` de este repo.
6. **Configuración del proyecto** → "Tus apps" → agregar app Web → copiar el objeto `firebaseConfig`.

### 2. Configurar la app

Editar `firebase-config.js` y reemplazar los valores de `firebaseConfig` por los del paso anterior.

### 3. Probar en local

Como son archivos estáticos, alcanza con abrirlos con un servidor simple (no funciona con doble clic por CORS de módulos):

```bash
# Con Python
python3 -m http.server 8000

# o con VS Code: extensión "Live Server"
```

Abrir `http://localhost:8000`.

### 4. Primer ingreso

Al entrar por primera vez (sin usuarios cargados), la app muestra la pantalla **"Configurar administrador"**. Ese usuario queda con el rol Admin y todos los permisos. Desde ahí ya se pueden crear el resto de los usuarios, roles, empresas y tipos de vehículo.

### 5. Publicar en GitHub Pages

1. Subir estos archivos a un repositorio de GitHub.
2. Settings → Pages → Source: rama `main`, carpeta `/root`.
3. La URL pública queda en `https://TU_USUARIO.github.io/TU_REPO/`.

## Estructura de datos (Firestore)

| Colección | Descripción |
|---|---|
| `usuarios` | Cuentas de acceso: nombre, email, rolId, activo |
| `roles` | Nombre + array de permisos |
| `empresas` | Empresas de turismo (catálogo) |
| `tiposVehiculo` | Tipo de vehículo + monto mínimo de compra para liberar estacionamiento |
| `config` | `config/meta` (flag de setup) — más adelante sumará logo y parámetros de fidelidad |

## Notas importantes

- **Alta de usuarios**: el Admin crea usuarios nuevos desde la app. Internamente se usa una segunda instancia de Firebase Auth para que la creación de la cuenta no cierre la sesión del Admin.
- **Modo offline**: Firestore cachea datos localmente; si se corta la conexión en el subsuelo/estacionamiento, la app sigue funcionando y sincroniza al reconectar (aparece un aviso en pantalla).
- **Permisos disponibles hoy**: `gestionar_usuarios`, `gestionar_catalogos`, `registrar_visitas`, `liberar_estacionamiento`, `ver_reportes`. Los tres últimos ya están declarados para que los roles queden bien armados desde ahora, aunque las pantallas correspondientes se suman en v0.2 en adelante.
