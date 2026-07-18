# Changelog — Sistema de Gestión de Visitas — Shopping Paris

Versionado simplificado `vMAJOR.MINOR`. MAJOR = cambios de arquitectura o que rompen datos existentes. MINOR = funcionalidad nueva incremental.

## v0.3 — 2026-07-18

Monto acumulado + liberación de estacionamiento.

- Cada visita en curso muestra una barra de progreso de compras (monto acumulado vs. mínimo requerido según el tipo de vehículo).
- Se pueden ir sumando montos de comprobantes a medida que el guía los trae (suma incremental, atómica).
- Botón "Liberar estacionamiento" habilitado solo al alcanzar el mínimo, visible únicamente para roles con el permiso `liberar_estacionamiento`.
- Al liberar: se actualiza el estado de la visita a `liberado`, se registra quién y cuándo, y se genera automáticamente un PDF con el comprobante (guía, empresa, vehículo, N° de ticket, horario de ingreso/salida, tiempo de permanencia y monto acumulado).
- v0.2: se sacó el escaneo de cámara del formulario de ingreso (carga manual del N° de ticket, más simple para el flujo real de trabajo).

## v0.2 — 2026-07-17

Ingreso de visitas.

- Formulario de registro de ingreso: guía (con autocompletado de guías ya cargados o alta de uno nuevo), empresa, cantidad de pasajeros, tipo de vehículo, chapa y ticket de estacionamiento.
- Nueva colección `guias`, reutilizable entre visitas.
- Vista "Visitas en curso" con tarjetas estilo ticket, tiempo transcurrido en sala en tiempo real.
- Conteo de visitas en curso en el panel inicial.
- Reglas de seguridad para `guias` y `visitas`.
- Corrección de estabilidad: versiones de React/Babel fijadas por CDN (antes sin versión, lo que generaba comportamiento impredecible), variables de Firebase expuestas explícitamente en `window`, y long polling automático en Firestore para redes con firewall/proxy restrictivo.

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
| v0.4 | Cierre manual de día + estado "no liberado" |
| v0.5 | Reportes: personas/vehículos por período, guías no liberados |
| v0.6 | Ranking de guías + fidelidad (fórmula combinada y configurable) |
| v0.7 | Mapa de calor de afluencia |
| v0.8 | Logo configurable (Firebase Storage) en header y encabezado de reportes/PDFs |
| v1.0 | Primera versión estable end-to-end |
