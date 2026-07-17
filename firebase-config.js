/**
 * firebase-config.js
 * Sistema de Gestión de Visitas — Shopping Paris
 *
 * Reemplazá los valores de firebaseConfig por los de tu proyecto:
 * Firebase Console > Configuración del proyecto > Tus apps > SDK setup and configuration
 *
 * No requiere build step: se sube tal cual a GitHub Pages.
 */

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// App principal: sesión activa del usuario logueado.
firebase.initializeApp(firebaseConfig);

// App secundaria: se usa SOLO cuando un Admin crea la cuenta de otro usuario.
// Es necesaria porque el SDK de cliente de Firebase Auth inicia sesión
// automáticamente con la cuenta recién creada; usando una app secundaria
// evitamos que eso reemplace la sesión del Admin que está trabajando.
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

const auth = firebase.auth();
const db = firebase.firestore();
const secondaryAuth = secondaryApp.auth();

// Cache offline: si se corta la señal en el estacionamiento/subsuelo,
// la app sigue funcionando localmente y sincroniza al volver la conexión.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("No se pudo habilitar persistencia offline:", err.code);
});

// Roles semilla: se crean automáticamente la primera vez que se usa el sistema.
// El Admin puede editarlos o crear roles nuevos desde la pantalla de Usuarios y Roles.
const ROLES_POR_DEFECTO = [
  {
    id: "admin",
    nombre: "Administrador",
    permisos: [
      "gestionar_usuarios",
      "gestionar_catalogos",
      "registrar_visitas",
      "liberar_estacionamiento",
      "ver_reportes"
    ]
  },
  {
    id: "encargado_sala",
    nombre: "Encargado de Sala",
    permisos: ["registrar_visitas", "liberar_estacionamiento"]
  },
  {
    id: "reportes",
    nombre: "Solo Reportes",
    permisos: ["ver_reportes"]
  }
];

// Catálogo de permisos disponibles para armar roles personalizados.
const PERMISOS_DISPONIBLES = [
  { id: "gestionar_usuarios", label: "Gestionar usuarios y roles" },
  { id: "gestionar_catalogos", label: "Gestionar empresas y tipos de vehículo" },
  { id: "registrar_visitas", label: "Registrar ingreso de visitas" },
  { id: "liberar_estacionamiento", label: "Liberar estacionamiento" },
  { id: "ver_reportes", label: "Ver reportes" }
];
