# Changelog — Sistema de Gestión de Visitas — Shopping Paris

Versionado simplificado `vMAJOR.MINOR`. MAJOR = cambios de arquitectura o que rompen datos existentes. MINOR = funcionalidad nueva incremental.

## v1.5 — 2026-08-25

Reordenamiento de botones en las tarjetas de "Visitas en curso".

- Con el botón "Partner" agregado en v1.4, la fila de 3 botones ("Registrar compra" / "Partner" / "✕") quedaba apretada y el de anular se cortaba en tarjetas angostas. Ahora "Registrar compra" / "Liberar estacionamiento" ocupa una fila propia (ancho completo), y "Partner" + "Anular visita" van debajo en una segunda fila. El botón de anular ahora dice "✕ Anular visita" (antes solo el ícono) para que sea más claro qué hace.

## v1.4 — 2026-08-25

Buscador de guías + liberación Partner sin monto mínimo.

- **Buscador** por nombre de guía en "Visitas en curso", junto al título — filtra la grilla de tarjetas a medida que se escribe, para no tener que recorrerlas todas cuando hay muchas visitas activas.
- Nuevo botón **"Partner"** en cada tarjeta (visible cuando todavía no se alcanzó el monto mínimo): permite liberar el estacionamiento sin exigir compra, para las empresas que son tiendas Partner del shopping. Abre el mismo modal de liberación, pero con un aviso claro y sin el formulario de carga de monto. Se guarda `liberadoComoPartner: true` en el registro, y el ticket impreso muestra "Liberación: PARTNER (sin monto mínimo)" en vez de la línea de monto acumulado.

## v1.3 — 2026-08-25

Correcciones al ticket de permiso de salida.

- El ticket de permiso de salida ahora imprime el **código de barras** (CODE128) debajo del N° de ticket de estacionamiento — se había agregado en el comprobante de liberación pero faltaba en este.
- El campo **"Autorizado por local"** ahora se guarda e imprime siempre en **mayúsculas** (se convierte a medida que se escribe, igual que la chapa del vehículo).

## v1.2 — 2026-08-25

Correcciones y mejoras al flujo de impresión + carga manual de datos.

- Corregido: al reimprimir un ticket desde "🖨️ Reimprimir último ticket", la fecha de ingreso aparecía como "Invalid Date" y la permanencia como "NaN min" — el Timestamp de Firestore pierde su método `.toDate()` al guardarse y recuperarse de `localStorage` vía JSON. Ahora `formatearFechaHora` y `tiempoTranscurrido` reconocen también ese formato "aplanado" (nueva función `aFechaJS`).
- En "Nuevo ingreso", la **hora de ingreso** ahora se carga a mano (junto al N° de ticket), en vez de tomarse automáticamente del momento en que se registra el formulario — útil cuando el guía entró un rato antes de que se cargue el ingreso en el sistema. Se precarga con la hora actual y se puede editar antes de guardar.
- **Permiso de salida**: ahora, antes de generar el ticket, se abre un modal para cargar el **motivo de la salida** (checklist: Buscar pasajero / Entregar mercaderías-pedidos / Asuntos administrativos / Taller mecánico-mantenimiento, más un campo de texto libre "Otro motivo" sin checkbox) y el campo obligatorio **"Autorizado por local"**.
- El permiso de salida **ya no se genera como PDF**: imprime **directo por la ticketera** (2 copias — "COPIA: GUÍA" y "COPIA: LOCAL"), igual que el comprobante de liberación, incluyendo espacio en blanco al final para firmar a mano (guía y autorizante del local). Si falla la impresión, igual que en la liberación: el permiso queda otorgado en la base, se muestra el error, y el botón cambia a "Reintentar impresión". La función de PDF (`generarPdfPermisoSalida`) queda en el código sin usarse, por si hace falta como referencia.

## v1.1 — 2026-08-24

Impresión directa del comprobante de liberación (impresora térmica).

- El botón "Liberar estacionamiento y emitir ticket" ya no descarga un PDF: imprime **directo** en la impresora térmica del punto de cobro (Epson TM-T20IV-L, conectada por USB a la misma PC de la sala de guías y compartida como impresora de Windows), vía un servidor local ("print-bridge") que corre en esa PC. Ver carpeta `print-bridge/` y `SISTEMA-DE-IMPRESION.md`.
- Se imprimen **2 copias separadas** (corte de papel entre una y otra): "COPIA: GUÍA" y "COPIA: SHOPPING", cada una con el mismo contenido que antes tenía el PDF (guía, empresa, vehículo/chapa, N° de ticket, ingreso, salida, permanencia, monto acumulado) más el logo del shopping.
- Nuevo: **código de barras real** (CODE128) del N° de ticket, impreso por la propia impresora (no como imagen).
- Si el servidor de impresión no responde (PC apagada, servidor no iniciado, impresora compartida no accesible, etc.): el estacionamiento igual queda liberado en la base, se muestra un aviso claro, y el botón cambia a "Reintentar impresión" sin volver a tocar el registro.
- Nuevo botón **"🖨️ Reimprimir último ticket"** en "Visitas en curso", disponible por unas horas después de cada liberación, por si hace falta reimprimir más tarde.
- La generación de PDF (`generarPdfLiberacion`) queda en el código sin usarse en este flujo, por si se necesita como referencia o respaldo a futuro.
- `print-server.js` manda los comandos ESC/POS a la impresora copiando un archivo binario directo a su ruta de impresora compartida por Windows en la misma PC (`\\192.168.58.11\guiaticket`), en vez de un socket TCP directo — la impresora es USB (no de red), así que este es el mecanismo que funciona.

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
