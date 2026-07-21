# Sistema de Gestión de Visitas — Shopping Paris

Gestión de guías de turismo, visitas y liberación de estacionamiento en la sala VIP de guías.

**Versión actual: v1.0** — Sistema completo y estable.
Ver `CHANGELOG.md` para el detalle de todas las versiones.

---

## Guía de uso diario

### Primer ingreso a la app

La primera vez que alguien entra a la app (sin usuarios cargados todavía), aparece la pantalla **"Configurar administrador"**. Esa cuenta queda con el rol Admin y todos los permisos.

### Roles disponibles de fábrica

| Rol | Puede hacer |
|---|---|
| Administrador | Todo: usuarios, catálogos, visitas, liberar, reportes |
| Encargado de Sala | Registrar visitas, liberar estacionamiento |
| Solo Reportes | Ver reportes, ranking y mapa de calor (sin poder cargar nada) |

El Admin puede crear roles nuevos o editar los permisos de estos desde **Usuarios y roles → Roles**.

### Flujo de trabajo típico (Encargado de Sala)

1. **Ingreso del guía**: en "Visitas", completar el formulario (guía, empresa, pasajeros, vehículo, chapa, N° de ticket) → "Registrar ingreso". El guía queda visible en "Visitas en curso".
2. **A medida que trae comprobantes de compra**: abrir la tarjeta del guía → "Registrar compra" → cargar el monto → "Agregar". La barra de progreso muestra cuánto falta para el mínimo.
3. **Al llegar al mínimo**: el botón cambia a "Liberar estacionamiento". Al apretarlo, se descarga automáticamente el PDF con el comprobante para el guía.
4. **Si el guía se carga mal** (error de tipeo, vehículo equivocado, etc.): usar el botón "✕" en la tarjeta para anular la visita — no se puede deshacer.
5. **Al cerrar la sala** (fin de la jornada): botón "Cerrar día" — revisa todas las visitas que quedaron abiertas, muestra un preview de cuáles se liberarían y cuáles no, y al confirmar las cierra todas de una vez. Las que no llegaron al mínimo quedan como "no liberadas" (el guía paga por caja tradicional).

### Corregir datos

- **Nombre de un guía mal escrito**: pantalla "Guías" → Editar. Si tiene una visita abierta en ese momento, se actualiza sola.
- **Empresas / Tipos de vehículo**: se administran desde sus pantallas correspondientes (solo Admin / rol con permiso de catálogos). Ahí también se configura el **monto mínimo de compra** por tipo de vehículo.

### Reportes y análisis (Admin / rol con permiso de reportes)

- **Reportes**: personas y vehículos ingresados por rango de fechas, y detalle de guías no liberados.
- **Ranking**: puntaje de fidelidad por guía (configurable en "Configurar pesos"), solo sobre visitas liberadas.
- **Mapa de calor**: qué días/horarios tienen más afluencia.

### Configuración visual

- **Configuración → Logo**: subir el logo del shopping (JPG/PNG, hasta 2MB). Aparece en el menú y en los PDF de liberación.

---

## Arquitectura técnica

- **Frontend**: React puro por CDN (sin build step). Archivos: `index.html`, `app.js`, `firebase-config.js`, `styles.css`.
- **Base de datos**: Firebase Firestore.
- **Autenticación**: Firebase Auth (email/contraseña).
- **Almacenamiento de archivos**: Firebase Storage (logo).
- **Generación de PDF**: jsPDF (por CDN).
- **Hosting**: GitHub Pages.

No hay proceso de compilación: se edita cualquier archivo y se sube tal cual.

## Puesta en marcha desde cero

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

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000`.

### 4. Publicar en GitHub Pages

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
| `guias` | Guías registrados (nombre); se crean automáticamente al registrar una visita |
| `visitas` | Cada ingreso: guía, empresa, vehículo, chapa, ticket, montos, estado (`en_curso` / `liberado` / `no_liberado`) |
| `config` | `config/meta` (setup), `config/branding` (logo), `config/fidelidad` (pesos del ranking) |

## Permisos disponibles

`gestionar_usuarios`, `gestionar_catalogos`, `registrar_visitas`, `liberar_estacionamiento`, `ver_reportes`.

## Notas importantes

- **Alta de usuarios**: el Admin crea usuarios nuevos desde la app usando una segunda instancia de Firebase Auth, para que no se cierre su propia sesión.
- **Modo offline**: Firestore cachea datos localmente; si se corta la conexión, la app sigue funcionando y sincroniza al reconectar.
- **Redes restrictivas**: `firebase-config.js` fuerza long polling automático para evitar errores de conexión en redes con firewall/antivirus/proxy corporativo.
- **Versiones de CDN fijas**: React, ReactDOM y Babel Standalone usan versiones exactas (no "latest"), para evitar comportamiento impredecible por cambios silenciosos del CDN.
