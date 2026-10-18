# Puduhue Terreno: mapa del código y reglas fijas

App de terreno de Puduhue (PWA) en https://puduhue.github.io/puduhue-terreno/. Este repositorio es **público**.
El proceso para hacer una versión (scripts, pruebas, vista previa, historial de decisiones) está en el repositorio
privado puduhue/puduhue-terreno-herramientas: leer su CLAUDE.md y su README antes de tocar el código.

## Archivos
- `index.html`: la app (HTML, CSS y el código general en un `<script>`), salvo Rendiciones. ~0,6 MB desde la v102.
- `modulos/rendiciones.js`: el módulo Rendiciones completo (desde la v102), ~225 KB. Ver «Mapa de modulos/rendiciones.js».
- `sw.js`: service worker. Guarda la app para abrir sin señal (index.html y `modulos/rendiciones.js` en la caché de la versión),
  separa las bibliotecas en cachés propias y muestra las notificaciones.
- `lib/<biblioteca>-<versión>/`: bibliotecas de terceros, sin cambios: MSAL 3.30.0 (inicio de sesión), SheetJS 0.18.5 mini (Excel),
  jsPDF 2.5.1 (PDF), pdf.js 6.3.289 (ver PDF) y zxing-wasm 3.1.4 (código del SII). Además, `lib/marca-puduhue-1/marcas.js` define
  los logos en base64 (`MARCA`, `MARCA_HZ` y `LOGO`, este último para los PDF), desde la v101.
- `servidor/`: Cloudflare Worker «puduhue-terreno» (notificaciones, recordatorios, Finnegans, lectura de boletas). Se publica solo con
  GitHub Actions al subir cambios de `servidor/` a main.
- `manifest.json`, `icon-*.png`, `badge-96.png`: instalación y notificaciones.
- `prueba/` (solo mientras se prueba una versión): copia para probar en el teléfono antes de publicar. Se arma con `armar_prueba.py` (herramientas).

## Cómo leer el código sin gastar de más
- No leer `index.html` entero. Sacar el código con `extraer_app.py` (herramientas) y buscar por los títulos de sección de abajo con grep.
- Para trabajar en Rendiciones basta `modulos/rendiciones.js`; de index.html, solo lo que se busque con grep (render(), barra, Inicio).
- Las bibliotecas de `lib/` no se leen ni se modifican.

## Mapa de index.html
1. `<head>`: metas, manifest, `<script src="lib/...">` de MSAL, SheetJS y jsPDF (normales, no diferidos: la app los usa al cargar).
2. `<style>` que empieza con `:root{`: todo el CSS (el de cada versión se agregó al final).
3. `<body>`: solo `<div id="app">` con «Cargando…»; todo lo demás lo dibuja el código. Antes del código, `<script src="lib/marca-puduhue-1/marcas.js">`.
   Orden de carga (v102): código general (`<script>` inline) → `<script src="modulos/rendiciones.js?v=NN">` → arranque (`<script>` inline
   con el registro del service worker e `init()`). Todos son scripts normales y comparten las variables globales. Si rendiciones.js
   no cargó (`window.MOD_RENDICIONES` falta), el arranque muestra «No se pudo cargar la app» con «Reintentar».
4. `<script>` que empieza con `const APP_VER=`: el código general. Está ordenado por versión, no por módulo. Donde salió un bloque de
   Rendiciones queda una línea `/* v102: «…» está en modulos/rendiciones.js */`. Secciones (buscar el título; líneas aproximadas en la v102):

| Líneas | Título de sección (buscar) | Qué hay |
|---|---|---|
| 1-92 | `const APP_VER=`, `Datos fijos del protocolo`, `Utilidades` | Constantes (los logos vienen de `marcas.js`; si no cargó, se reemplazan por uno transparente), utilidades |
| 93-411 | `Microsoft 365: inicio de sesión`, `Almacenamiento: primero en el teléfono` | MSAL, OneDrive (Graph), base local (IndexedDB) y sincronización |
| 412-913 | `v93:` a `v99:` | Bloques transversales: barra de navegación (v93), Administración (v95), diseño nativo y gestos (v96, sin lo de Rendiciones), hojas (v97), fila de notificaciones (v99). Aquí quedan los 4 escuchadores globales del botón «Rendir» y del buscador del fondo (`fdbus`) |
| 914-1849 | `Render`, `Acciones`, `Firma`, `Fotos`, `PDF`, `Pantalla de inicio: elegir versión` | Actas de vivienda |
| 1734-1849 | `Traspaso por archivo` | Restos de la versión descargable (ver abajo) |
| 1850-2088 | `Catálogo del check list` | Catálogo de puntos (valor inicial y el de OneDrive) |
| 2089-2819 | `MÓDULO: Check list de visitas` | Visitas, hallazgos, check list de bodega (v58), predios (v91), Excel e informe PDF; al final, Excel de actas de vivienda y `Servidor Puduhue (Cloudflare)` |
| 2820-2935 | `MÓDULO: Stock` | Stock desde Finnegans |
| 2936-3227 | `MÓDULO: Control de bodega` | Conteo físico contra el stock |
| 3228-3677 | `v83: notificaciones`, `v85: la app se muda`, `v86: instalar`, `v87`, `v88: diseño`, `v89`, `v90` | Bloques transversales que estaban en medio de Rendiciones |
| 3678-4323 | `Actas de entrega (v72)` | Actas de vehículos y activos fijos |
| 4324-4399 | `---------- Inicio ----------` | Pantalla de inicio |
| 4400-fin | `Actualización automática` | Aviso de versión nueva (el registro del service worker e `init()` están en el `<script>` de arranque) |

## Mapa de modulos/rendiciones.js (líneas aproximadas en la v102)
| Líneas | Título de sección (buscar) | Qué hay |
|---|---|---|
| 1-181 | `v94: saldo del fondo por rendir` | Fondo por rendir (cuenta 110106): tarjeta, movimientos, vista de Contabilidad |
| 182-270 | `«Para hoy»: fondo`, `1) botón flotante «Rendir»`, `disRendirArchivos` | «Para hoy» del fondo (v95), botón «Rendir», tarjeta del documento e íconos de estado (v96) |
| 271-494 | `v98: lectura de boletas` | Código del SII, foto borrosa, tipo de gasto por comercio, medición |
| 495-667 | `MÓDULO: Rendiciones`, `Maestros contables`, `Personas, roles y estados` | Catálogo de tipos de gasto, maestros, roles |
| 668-825 | `Avisos por correo (v78)`, `v84: agenda` | Correos de cada paso y agenda para los recordatorios automáticos |
| 826-1055 | `Link de los correos`, `Motor contable`, `Lectura con IA` | Link ?rd=, saveRend, problemas del documento, asiento para FinnegansGO, lectura vía servidor |
| 1056-1584 | `v92: seguimiento`, `Selector con buscador`, `Maestros contables: pantalla` | Pantallas |
| 1585-1784 | `Acciones`, `v81: facturas y boletas en PDF` | Acciones y PDF |
| 1785-fin | `OneDrive: carpeta, Excel mensual y PDF` | Excel mensual; al final `window.MOD_RENDICIONES=true` (no quitar) |

Funcionamiento general: el estado vive en variables globales (`view`, `cur`, `ACTAS`, `VIS`, `REND`, `MAE`…); `go(vista)` cambia
de pantalla y `render()` dibuja; los botones llevan `data-a="acción"` y cada módulo los atiende en su sección «Acciones».
Ojo: `saludo` y `fechaLarga` están definidas dos veces (cerca de «Pantalla de inicio: elegir versión»); vale la segunda.

## Reglas fijas
- **Versión:** en cada versión subir juntos `APP_VER` (index.html), `VER` de sw.js (`"actas-vNN"`) y el `?v=NN` del
  `<script src="modulos/rendiciones.js">`, con el mismo número.
  Si no cambia sw.js, el teléfono no se entera de la versión nueva.
- **Bibliotecas:** nunca cambiar un archivo dentro de una carpeta de `lib/` que ya existe (el teléfono lo tiene guardado y no lo
  vuelve a bajar). Para actualizar una: carpeta nueva con la versión en el nombre, agregarla a `LIBS` en sw.js (y a `LIB_INICIO`
  si la app la usa al abrir) y cambiar el `<script src>`.
- **Paridad entre módulos:** cuando se agrega o corrige algo en un módulo (eliminar borrador, anular con motivo, Excel consolidado,
  «⋯», fotos), revisar los demás módulos y dejarlos iguales.
- **Fotos:** botones Cámara y Galería en cada campo de foto; en el computador, «Subir foto».
- **Diseño:** sensación de app nativa, buen contraste en modo noche y día, y que se vea bien en el computador. Cambios visuales grandes,
  primero en vista previa con aprobación de Benja.
- **Textos:** español neutro, simple, sin modismos chilenos.
- **Repositorio público:** sin nombres ni RUT de colaboradores, sin claves ni tokens (las claves van como secretos en Cloudflare o GitHub).
- **Copia de prueba:** el service worker reconoce la carpeta `prueba/` y usa cachés con prefijo `prueba-`, sin tocar las de la app real.
  Comparte con la app real los datos del teléfono (misma dirección): lo que se hace en la prueba es real.

## Código sobrante (no se mantiene)
Restos de cuando la app era un archivo descargable: `URL_ONLINE`, `OFFLINE`, `PWA`, `CLOUD` y la sección `Traspaso por archivo`
(`sincronizar`, `abrirOnlineModal`, `exportarActas`, `marcarExportado`). Decidido el 18-10-2026 no mantener esa versión.
Se borran cuando toque trabajar en Actas de vivienda, revisando antes qué sigue en uso (`PWA` sí se usa) y con prueba.

## Reorganización para gastar menos (desde la v100, una versión por paso)
1. v100: MSAL, SheetJS y jsPDF a `lib/`, con cachés aparte. ✓
2. v101: logos en base64 (MARCA, MARCA_HZ, LOGO) a `lib/marca-puduhue-1/marcas.js`. ✓
3. v102: Rendiciones a `modulos/rendiciones.js`. ✓ Los demás módulos, solo si conviene (mismo método: `split102.py` en herramientas).
4. CSS a `estilos.css`, cuando convenga (ahorra poco).
