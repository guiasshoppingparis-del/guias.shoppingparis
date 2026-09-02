# Changelog — Sistema de Gestión de Visitas — Shopping Paris

Versionado simplificado `vMAJOR.MINOR`. MAJOR = cambios de arquitectura o que rompen datos existentes. MINOR = funcionalidad nueva incremental.

## v1.8 — 2026-08-18

Nuevo módulo: Paris Store.

- Ítem nuevo en el menú lateral, con el mismo permiso `registrar_visitas`. Pensado para un punto de atención distinto a la sala de guías.
- Carga básica de datos (guía con autocompletado, empresa, pasajeros, tipo de vehículo, chapa, ticket de estacionamiento opcional) — **sin** manejo de estacionamiento (no hay monto acumulado ni liberación) y **sin** generación de ningún PDF/comprobante.
- Colección propia en Firestore (`registrosParisStore`), separada de `visitas`, para poder diferenciar el origen de los datos.
- Lista de "Registros recientes" con edición (lápiz) y anulación, igual que en Visitas.
- **Reportes** y **Mapa de calor** suman un selector de fuente ("Sala de Guías" / "Paris Store" / "Ambos") para consultar cada punto por separado o combinado. Cuando se consulta "Ambos", el detalle muestra una columna "Origen".
- El Ranking de fidelidad no cambia: sigue calculándose solo sobre visitas liberadas de la Sala de Guías (Paris Store no maneja compras ni liberación, así que no aporta puntaje).

## v1.7 — 2026-08-11

Limpieza de Reportes.

- Se sacó el botón general "Descargar PDF" de arriba (el que generaba un PDF con todo junto) — quedó reemplazado por los botones de PDF específicos de cada categoría desplegable, que cubren el mismo caso de uso de forma más precisa.

## v1.6 — 2026-08-11

Detalle desplegable en Reportes.

- Las 4 tarjetas de resumen (Personas ingresadas, Vehículos ingresados, Liberados, No liberados) ahora son clickeables: al tocarlas, despliegan una tabla con el detalle de las visitas que componen ese número.
- Cada detalle desplegado tiene su propio botón "⬇ Descargar PDF", con el total de esa categoría indicado en el encabezado del PDF.
- Reemplaza la tabla fija de "Guías no liberados" (ahora es una de las cuatro categorías desplegables, junto a las otras).

## v1.5 — 2026-08-11

Exportación de Reportes a PDF.

- Nuevo botón "⬇ Descargar PDF" en la pantalla de Reportes: genera un PDF en A4 con el resumen del período (personas ingresadas, vehículos, liberados, no liberados) y la tabla completa de "Guías no liberados", con salto de página automático si la tabla es larga.
- Incluye logo del shopping (si está configurado) y el rango de fechas consultado.

## v1.4 — 2026-08-05

Edición de visitas en curso.

- Ícono de lápiz junto al nombre del guía en cada tarjeta de "Visitas en curso", para corregir cualquier dato cargado por error (guía, empresa, pasajeros, tipo de vehículo, chapa, ticket) sin tener que anular y recargar toda la visita.
- Si se cambia el tipo de vehículo, el monto mínimo requerido se recalcula automáticamente; el monto ya acumulado en compras no se toca.

## v1.3 — 2026-08-05

Renovación de ticket al reingresar.

- Al "quitar" el permiso de salida, ahora se abre una ventana pidiendo el **nuevo número de ticket** que le dieron al guía al volver a entrar (en vez de sacar el permiso directo).
- El N° de ticket de la visita se actualiza con el valor nuevo, para que el ticket que figure en el PDF de liberación final y en los reportes sea siempre el correcto.

## v1.2 — 2026-08-05

Permiso de salida.

- Nuevo botón "Otorgar permiso de salida" en cada tarjeta de "Visitas en curso": marca el vehículo como autorizado a salir y reingresar sin cerrar la visita ni liberar el estacionamiento. No requiere motivo.
- Mientras está activo, la tarjeta muestra la etiqueta "🚗 Permiso de salida otorgado".
- Al otorgarlo, se descarga automáticamente un PDF con el permiso (guía, empresa, vehículo/chapa, N° de ticket, quién lo otorgó y cuándo) para mostrar en la salida del estacionamiento.

## v1.1 — 2026-08-05

Optimización del PDF de liberación.

- El ticket de liberación ahora imprime **dos copias en una sola hoja**: "ORIGINAL" arriba y "COPIA — PARA EL GUÍA" abajo, separadas por una línea de corte punteada. Reduce el uso de papel a la mitad respecto de imprimir cada copia por separado.

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
