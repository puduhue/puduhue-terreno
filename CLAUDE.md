# Puduhue Terreno: mapa del código y reglas fijas

App de terreno de Puduhue (PWA) en https://puduhue.github.io/puduhue-terreno/. Este repositorio es **público**.
El proceso para hacer una versión (scripts, pruebas, vista previa, historial de decisiones) está en el repositorio
privado puduhue/puduhue-terreno-herramientas: leer su CLAUDE.md y su README antes de tocar el código.

## Archivos
- `index.html`: la app completa (HTML, CSS y el código propio en un solo `<script>`). ~0,8 MB desde la v101.
- `sw.js`: service worker. Guarda la app para abrir sin señal, separa las bibliotecas en cachés propias y muestra las notificaciones.
- `lib/<biblioteca>-<versión>/`: bibliotecas de terceros, sin cambios: MSAL 3.30.0 (inicio de sesión), SheetJS 0.18.5 mini (Excel),
  jsPDF 2.5.1 (PDF), pdf.js 6.3.289 (ver PDF) y zxing-wasm 3.1.4 (código del SII). Además, `lib/marca-puduhue-1/marcas.js` define
  los logos en base64 (`MARCA`, `MARCA_HZ` y `LOGO`, este último para los PDF), desde la v101.
- `servidor/`: Cloudflare Worker «puduhue-terreno» (notificaciones, recordatorios, Finnegans, lectura de boletas). Se publica solo con
  GitHub Actions al subir cambios de `servidor/` a main.
- `manifest.json`, `icon-*.png`, `badge-96.png`: instalación y notificaciones.
- `prueba/` (solo mientras se prueba una versión): copia para probar en el teléfono antes de publicar. Se arma con `armar_prueba.py` (herramientas).

## Cómo leer el código sin gastar de más
- No leer `index.html` entero. Sacar el código con `extraer_app.py` (herramientas) y buscar por los títulos de sección de abajo con grep.
- Las bibliotecas de `lib/` no se leen ni se modifican.

## Mapa de index.html
1. `<head>`: metas, manifest, `<script src="lib/...">` de MSAL, SheetJS y jsPDF (normales, no diferidos: la app los usa al cargar).
2. `<style>` que empieza con `:root{`: todo el CSS (el de cada versión se agregó al final).
3. `<body>`: solo `<div id="app">` con «Cargando…»; todo lo demás lo dibuja el código. Antes del código, `<script src="lib/marca-puduhue-1/marcas.js">`.
4. `<script>` que empieza con `const APP_VER=`: el código propio. Está ordenado por versión, no por módulo. Secciones
   (buscar el título; líneas aproximadas en la v101):

| Líneas | Título de sección (buscar) | Qué hay |
|---|---|---|
| 1-91 | `const APP_VER=`, `Datos fijos del protocolo`, `Utilidades` | Constantes (los logos vienen de `marcas.js`; si no cargó, se reemplazan por uno transparente), utilidades |
| 92-411 | `Microsoft 365: inicio de sesión`, `Almacenamiento: primero en el teléfono` | MSAL, OneDrive (Graph), base local (IndexedDB) y sincronización |
| 412-1396 | `v93:` a `v99:` | Bloques de las versiones 93-99: barra de navegación, fondo por rendir, Administración, diseño nativo, hojas, lectura de boletas, fila de notificaciones. Mezclan módulos |
| 1397-2332 | `Render`, `Acciones`, `Firma`, `Fotos`, `PDF`, `Pantalla de inicio: elegir versión` | Actas de vivienda |
| 2217-2332 | `Traspaso por archivo` | Restos de la versión descargable (ver abajo) |
| 2333-2570 | `Catálogo del check list` | Catálogo de puntos (valor inicial y el de OneDrive) |
| 2571-3301 | `MÓDULO: Check list de visitas` | Visitas, hallazgos, check list de bodega (v58), predios (v91), Excel e informe PDF; al final, Excel de actas de vivienda y `Servidor Puduhue (Cloudflare)` |
| 3302-3417 | `MÓDULO: Stock` | Stock desde Finnegans |
| 3418-3710 | `MÓDULO: Control de bodega` | Conteo físico contra el stock |
| 3711-5504 | `MÓDULO: Rendiciones` | Rendiciones, maestros, motor contable, lectura con IA, PDF. En medio hay bloques transversales: `Avisos por correo (v78)`, `v83: notificaciones`, `v84: agenda`, `v85: la app se muda`, `v86: instalar`, `v87`, `v88: diseño`, `v89`, `v90` |
| 5505-6151 | `Actas de entrega (v72)` | Actas de vehículos y activos fijos |
| 6152-6227 | `---------- Inicio ----------` | Pantalla de inicio |
| 6228-fin | `Actualización automática` | Registro del service worker y aviso de versión nueva |

Funcionamiento general: el estado vive en variables globales (`view`, `cur`, `ACTAS`, `VIS`, `REND`, `MAE`…); `go(vista)` cambia
de pantalla y `render()` dibuja; los botones llevan `data-a="acción"` y cada módulo los atiende en su sección «Acciones».
Ojo: `saludo` y `fechaLarga` están definidas dos veces (cerca de «Pantalla de inicio: elegir versión»); vale la segunda.

## Reglas fijas
- **Versión:** en cada versión subir juntos `APP_VER` (index.html) y `VER` de sw.js (`"actas-vNN"`), con el mismo número.
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
3. Separar el código por módulo, empezando por Rendiciones (el que más se trabaja).
4. CSS a `estilos.css`, cuando convenga (ahorra poco).
