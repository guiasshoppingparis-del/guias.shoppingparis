# Changelog — Sistema de Gestión de Visitas — Shopping Paris

Versionado simplificado `vMAJOR.MINOR`. MAJOR = cambios de arquitectura o que rompen datos existentes. MINOR = funcionalidad nueva incremental.

## v0.1 — 2026-07-10

Estructura base del sistema.

- Autenticación por email/contraseña (Firebase Auth).
- Setup inicial: primer ingreso crea la cuenta de Admin sin necesidad de backend.
- Roles configurables por el Admin, con permisos granulares (`gestionar_usuarios`, `gestionar_catalogos`, `registrar_visitas`, `liberar_estacionamiento`, `ver_reportes`).
- Gestión de usuarios: alta, edición, activar/desactivar, asignación de rol.
- Catálogo de empresas de turismo (CRUD).
- Catálogo de tipos de vehículo con monto mínimo de compra (CRUD).
- Panel inicial con conteos generales.
- Reglas de seguridad de Firestore basadas en permisos por rol.
- Soporte offline (cache local de Firestore).
- Identidad visual base (paleta, tipografía, componente "ticket").

## Roadmap

| Versión | Alcance |
|---|---|
| v0.2 | Ingreso de visitas (formulario + escaneo QR/código de barras del ticket de estacionamiento) |
| v0.3 | Registro de monto acumulado + liberación de estacionamiento + PDF de ticket de salida |
| v0.4 | Cierre manual de día + estado "no liberado" |
| v0.5 | Reportes: personas/vehículos por período, guías no liberados |
| v0.6 | Ranking de guías + fidelidad (fórmula combinada y configurable) |
| v0.7 | Mapa de calor de afluencia |
| v0.8 | Logo configurable (Firebase Storage) en header y encabezado de reportes/PDFs |
| v1.0 | Primera versión estable end-to-end |
