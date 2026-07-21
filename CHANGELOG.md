# Changelog — Sistema de Gestión de Visitas — Shopping Paris

Versionado simplificado `vMAJOR.MINOR`. MAJOR = cambios de arquitectura o que rompen datos existentes. MINOR = funcionalidad nueva incremental.

## v1.0 — 2026-07-18

Versión estable. Cierre del roadmap inicial (v0.1 a v0.8).

- **Anular visita**: nuevo botón "✕" en cada tarjeta de "Visitas en curso" para dar de baja una visita cargada por error (guía, empresa o vehículo equivocado). Requiere el mismo permiso que registrar visitas.
- Número de versión visible en el pie del menú lateral.
- Revisión general de consistencia en las 8 versiones anteriores.
- `README.md` ampliado con una guía de uso diario para el equipo (Admin y Encargado de Sala), además de la documentación técnica de instalación.

## v0.8 — 2026-07-18

Logo configurable.

- Nueva pantalla "Configuración" (permiso `gestionar_catalogos`) para subir el logo del shopping (JPG/PNG, hasta 2MB) a Firebase Storage.
- El logo reemplaza el placeholder "SP" en el menú lateral apenas se sube.
- Se incrusta automáticamente en el encabezado del ticket de liberación en PDF; si no se puede cargar (sin logo configurado, o problema de red/CORS), el PDF se genera igual sin logo, sin romper el flujo.
- Nuevo archivo `storage.rules` con las reglas de seguridad de Firebase Storage (se pegan en una pestaña distinta a las de Firestore).

## v0.7 — 2026-07-18

Mapa de calor de afluencia.

- Nueva pantalla "Mapa de calor" (permiso `ver_reportes`): ingresos por día de la semana × horario (8:00 a 22:00), con intensidad de color según cantidad de ingresos.
- Filtro por rango de fechas con los mismos atajos que Ranking ("Este mes" / "Últimos 3 meses" / "Este año").
- Destaca automáticamente el día y horario de mayor afluencia del período consultado.
- Referencia de color (menor → mayor afluencia) al pie del mapa.

## v0.6 — 2026-07-18

Ranking de guías + fidelidad. Además, pantalla "Guías" para corregir nombres cargados mal.

- Nueva pantalla "Ranking" (permiso `ver_reportes`): puntaje combinado por guía = (pasajeros × peso) + (visitas × peso) + (monto de compras × peso), calculado solo sobre visitas `liberado` del período consultado.
- Filtro por rango de fechas con atajos "Este mes" / "Últimos 3 meses" / "Este año".
- Pesos configurables desde la propia pantalla (botón "Configurar pesos", visible para `gestionar_catalogos`), guardados en `config/fidelidad`.
- Podio con medallas para el top 3.
- Nueva pantalla "Guías" (permiso `registrar_visitas`) para corregir el nombre de un guía cargado mal; si tiene una visita en curso, se sincroniza automáticamente.

## v0.5 — 2026-07-18

Reportes + mayúsculas en todos los formularios.

- Nueva pantalla "Reportes" (visible con el permiso `ver_reportes`): personas y vehículos ingresados por rango de fechas, con atajos "Hoy" / "Esta semana" / "Este mes".
- Resumen de liberados / no liberados del período consultado.
- Tabla de "Guías no liberados": guía, empresa, vehículo, pasajeros, monto acumulado vs. mínimo y cuánto faltó.
- Todos los campos de texto de la app (nombres, empresas, chapas, tickets, roles) ahora se guardan en mayúsculas de forma consistente. Se excluyen email y contraseña.

## v0.4 — 2026-07-18

Cierre de día.

- Botón "Cerrar día" (visible para roles con permiso `registrar_visitas`) sobre la lista de "Visitas en curso".
- Antes de confirmar, muestra una vista previa de todas las visitas que se van a cerrar, con el resultado estimado de cada una (liberada / no liberada) según el monto acumulado.
- Al confirmar: cierra todas en un solo lote (batch de Firestore). Las que alcanzaron el mínimo pasan a `liberado`; las que no, a `no_liberado`, quedando etiquetadas para que el guía abone por caja tradicional.
- Se registra quién ejecutó el cierre y se marca `cerradaPorCierreDia: true` para poder diferenciarlas en reportes futuros de las liberaciones manuales.

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
