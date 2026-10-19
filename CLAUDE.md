# Puduhue Terreno: mapa del código y reglas fijas

App de terreno de Puduhue (PWA) en https://puduhue.github.io/puduhue-terreno/. Este repositorio es **público**.
El proceso para hacer una versión (scripts, pruebas, vista previa, historial de decisiones) está en el repositorio
privado puduhue/puduhue-terreno-herramientas: leer su CLAUDE.md y su README antes de tocar el código.

## Archivos
- `index.html`: HTML y el código general (sesión, OneDrive, base local, bloques transversales, Actas de vivienda, Inicio)
  y el arranque. ~250 KB desde la v103.
- `estilos.css`: todo el CSS (desde la v103), ~105 KB. El de cada versión se agregó al final.
- `modulos/`: un archivo por módulo (desde la v102-v103). Cada uno termina con `window.MOD_…=true` (no quitar):
  - `checklist.js` (~110 KB): catálogo y MÓDULO: Check list de cumplimiento (v113): visitas a predios, bodegas (v58) y camionetas
    (v113), con los predios (v91). Los tres usan el mismo motor (`CLK`, `tipoDe`, `enTipo`).
  - `bodega.js` (~55 KB): MÓDULO: Stock y MÓDULO: Control de bodega.
  - `rendiciones.js` (~220 KB): Rendiciones completo, con el fondo por rendir y la lectura de boletas.
  - `actas-entrega.js` (~100 KB): Actas de entrega de vehículos y activos fijos (v72) y registro de capacitaciones (v109).
- `sw.js`: service worker. Guarda la app para abrir sin señal (index.html, estilos.css y los módulos, en la caché de la versión),
  separa las bibliotecas en cachés propias y muestra las notificaciones.
- `lib/<biblioteca>-<versión>/`: bibliotecas de terceros, sin cambios: MSAL 3.30.0 (inicio de sesión), SheetJS 0.18.5 mini (Excel),
  jsPDF 2.5.1 (PDF), pdf.js 6.3.289 (ver PDF) y zxing-wasm 3.1.4 (código del SII). Además, `lib/marca-puduhue-1/marcas.js` define
  los logos en base64 (`MARCA`, `MARCA_HZ` y `LOGO`, este último para los PDF), desde la v101.
- `servidor/`: Cloudflare Worker «puduhue-terreno» (notificaciones, recordatorios, Finnegans, lectura de boletas). Se publica solo con
  GitHub Actions al subir cambios de `servidor/` a main.
- `manifest.json`, `icon-*.png`, `badge-96.png`: instalación y notificaciones.
- `VERSIONES.md`: historial de versiones publicadas (versión, fecha y commit de main, con enlace para ver o recuperar cada una).
- `prueba/` (solo mientras se prueba una versión): copia para probar en el teléfono antes de publicar. Se arma con `armar_prueba.py` (herramientas).

## Cómo leer el código sin gastar de más
- Leer solo el archivo del módulo en que se trabaja. De index.html, solo lo que se busque con grep (render(), barra, Inicio);
  sacar su código con `extraer_app.py` (herramientas). No leer index.html ni estilos.css enteros.
- Las bibliotecas de `lib/` no se leen ni se modifican.

## Carga
`<head>`: metas, manifest, `<script src="lib/...">` de MSAL, SheetJS y jsPDF (normales: la app los usa al cargar) y
`<link rel="stylesheet" href="estilos.css?v=NN">`. `<body>`: `<div id="app">` con «Cargando…» y, en este orden:
`lib/marca-puduhue-1/marcas.js` → código general (inline) → `modulos/checklist.js` → `bodega.js` → `rendiciones.js` →
`actas-entrega.js` → arranque (inline: registro del service worker e `init()`). Todos son scripts normales y comparten las
variables globales; el orden es el mismo que tenían en el archivo único. Si falta un módulo, el arranque muestra «No se pudo cargar
la app» con «Reintentar». Los escuchadores globales (`document/window.addEventListener`) de los módulos se quedaron en index.html,
en su lugar, para no cambiar el orden en que reaccionan. Al mover código entre archivos, revisar el orden con
`analiza_division.js`/`carga_modulos.js` (herramientas).

## Mapa del código general (index.html, líneas aproximadas en la v103)
Ordenado por versión. Donde salió un módulo queda una línea `/* v102/v103: «…» está en modulos/… */`.

| Líneas | Título de sección (buscar) | Qué hay |
|---|---|---|
| 1-91 | `const APP_VER=`, `Datos fijos del protocolo`, `Utilidades` | Constantes, utilidades |
| 92-409 | `Microsoft 365: inicio de sesión`, `Almacenamiento: primero en el teléfono` | MSAL, OneDrive (Graph), base local (IndexedDB) y sincronización |
| 410-911 | `v93:` a `v99:` | Transversal: barra de navegación (v93), Administración (v95), diseño nativo y gestos (v96), hojas (v97), fila de notificaciones (v99); escuchadores del botón «Rendir» y del buscador del fondo |
| 912-1843 | `Render`, `Acciones`, `Firma`, `Fotos`, `PDF`, `Pantalla de inicio: elegir versión`, `Traspaso por archivo` | Actas de vivienda; pantalla de sincronización e importar desde archivo |
| 1844-1972 | `Excel: reintentos`, `Excel consolidado de actas de vivienda`, `Servidor Puduhue (Cloudflare)` | Reintentos de Excel (todos los módulos), Excel de actas de vivienda, servidor |
| 1973-1979 | (escuchadores de Stock y Control de bodega) | |
| 1981-2421 | `v83: notificaciones`, `v85`, `v86: instalar`, `v87`, `v88: diseño`, `v89`, `v90` | Transversal |
| 2423-2498 | `---------- Inicio ----------` | Pantalla de inicio |
| 2499-fin | `Actualización automática` | Aviso de versión nueva |

## Mapa de los módulos (líneas aproximadas en la v103)
- `checklist.js` (v113): 5 catálogo inicial (con `CM_ITEMS`, los ítems de camionetas) · 182 catálogo en OneDrive · 293 `MÓDULO: Check list de
  visitas` · 315 camionetas desde las actas de vehículo (v113) · 363 traspaso al check list de bodega (v58) · 402 predios (v91) ·
  457 pantalla «Check list de cumplimiento» (v113) · 580 la visita · 674 administración del catálogo · 735 acciones · 815 OneDrive ·
  867 informe PDF.
- `bodega.js`: 6 `MÓDULO: Stock` · 122 `MÓDULO: Control de bodega` · 171 pantallas · 269 acciones · 345 OneDrive, Excel e informe.
- `rendiciones.js`: 7 fondo por rendir (v94) · 192 botón «Rendir» y tarjeta (v96) · 270 lectura de boletas (v98) · 496 `MÓDULO:
  Rendiciones` (tipos de gasto, maestros, roles) · 665 avisos por correo (v78) y agenda (v84) · 823 link ?rd=, motor contable, lectura
  con IA · 1052 pantallas (v92) · 1580 acciones y PDF (v81) · 1780 OneDrive y Excel mensual.
- `actas-entrega.js` (v109): 18 textos del acta · 68 capacitaciones (v109) · 97 devoluciones (v77) · 113 datos comunes · 181 pantallas · 441 eventos · 536 PDF · 779 Excel.

Funcionamiento general: el estado vive en variables globales (`view`, `cur`, `ACTAS`, `VIS`, `REND`, `MAE`…); `go(vista)` cambia
de pantalla y `render()` dibuja; los botones llevan `data-a="acción"` y cada módulo los atiende en su sección «Acciones».
Ojo: `saludo` y `fechaLarga` están definidas dos veces (cerca de «Pantalla de inicio: elegir versión»); vale la segunda.

## Reglas fijas
- **Versión:** en cada versión subir juntos `APP_VER` (index.html), `VER` de sw.js (`"actas-vNN"`) y el `?v=NN` de `estilos.css`
  y de cada `modulos/*.js`, con el mismo número. Si no cambia sw.js, el teléfono no se entera de la versión nueva.
- **Archivo nuevo:** todo archivo propio que la app cargue al abrir va en `FILES` de sw.js y en el control del arranque (`MOD_OK`).
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
- **Historial de versiones:** al publicar, agregar arriba en `VERSIONES.md` la fila de la versión con el commit de publicación.
  Las ramas `vNN` son solo para probar; después de publicar las borra Benja (esta sesión no puede borrar ramas ni crear etiquetas).
- **Copia de prueba:** el service worker reconoce la carpeta `prueba/` y usa cachés con prefijo `prueba-`, sin tocar las de la app real.
  Comparte con la app real los datos del teléfono (misma dirección): lo que se hace en la prueba es real.

## Código sobrante
En la v103 se borró el código sin uso (16 declaraciones, entre ellas `OFFLINE` y `CLOUD`; se buscan con `muertos.js` en herramientas).
La sección `Traspaso por archivo` sigue en uso: arma la pantalla de sincronización («Sincronizar ahora», «Importar actas desde archivo»)
y funciones para compartir y descargar archivos. Quitar «Importar actas desde archivo» cambia lo que ve el usuario: requiere la
aprobación de Benja.

## Reorganización para gastar menos (desde la v100) ✓
v100 bibliotecas a `lib/` · v101 logos a `lib/marca-puduhue-1/` · v102 Rendiciones a `modulos/` · v103 Check list, Stock/Bodega
y Actas de entrega a `modulos/`, CSS a `estilos.css` y código sin uso borrado.
