# Puduhue Terreno

App web instalable (PWA) que usa el personal de Puduhue en el teléfono: actas de vivienda, vehículos y activos,
check list de visitas y bodega, control de bodega, stock de Finnegans, rendiciones de gastos y fondos por rendir.
Interfaz y comentarios en español. Repositorio **público** (GitHub Pages: https://puduhue.github.io/puduhue-terreno/).

## Estructura
- `index.html`: toda la app en un solo archivo (~1,9 MB).
  - Líneas ~14–495: librerías incrustadas (MSAL 3.30, SheetJS 0.18.5, jsPDF 2.5.1).
  - ~496–1733: CSS.
  - ~1738 en adelante: el código de la app. Se dibuja con plantillas de texto + `innerHTML`, `render()` elige la
    pantalla según `view` y los clics pasan por un solo `onClick` que enruta por el atributo `data-a`.
- `sw.js`: service worker (funciona sin señal y recibe las notificaciones push).
- `lib/`: pdf.js y zxing-wasm. Se descargan la primera vez que se usan y quedan en una caché aparte (`LIBS` en `sw.js`).
- `servidor/`: Cloudflare Worker (`worker.js` + `push.js`, `fondo.js`, `boleta.js`, `recordatorios.js`). Hace de
  intermediario con Finnegans, lee boletas con la API de Claude, envía notificaciones push y los recordatorios diarios.

## Datos y sesión
- Inicio de sesión con Microsoft (MSAL). Los datos compartidos son archivos JSON en carpetas `_datos` de OneDrive,
  leídos y escritos con Microsoft Graph. En el teléfono se guardan en IndexedDB `actas-vivienda`, y localStorage es el respaldo.
- Configuración que vive en OneDrive, no en el repo: el Excel del catálogo de check list (`_config`) y
  `Rendiciones/_maestros/maestros.json`.
- El Worker recibe el token de Graph de la app y lo valida con `/me`. Solo acepta cuentas `@puduhue.cl`.
- Claves (Finnegans, Anthropic) solo como variables de Cloudflare. **Nunca** poner claves, tokens ni datos personales
  en el repo: es público.

## Publicar una versión
1. Subir **juntos** `APP_VER` en `index.html` y `VER` en `sw.js` (hoy `"99"` / `"actas-v99"`). Si no cambia `VER`,
   los teléfonos siguen usando la versión guardada.
2. Agregar el bloque de comentario `vNN:` que explica el cambio, como en las versiones anteriores.
3. Cualquier cambio en `servidor/**` que llegue a `main` publica el Worker solo (`.github/workflows/publicar-servidor.yml`).
   Al cambiarlo, actualizar también `VERSION_SERVIDOR` en `worker.js`.
4. Para actualizar pdf.js o zxing, renombrar a la vez la carpeta en `lib/` y su entrada en `LIBS` de `sw.js`.

## Convenciones
- IDs de registros con `uid()`. Prefijos de fotos: `q:` en cola, `a:` en OneDrive, `l:` en localStorage, `m:` solo en memoria,
  `p:` formato antiguo.
- Escapar con `esc()` todo texto que venga de usuarios o del servidor antes de meterlo en `innerHTML`.
- Probar requiere una cuenta real de Puduhue en Microsoft 365: sin sesión solo funcionan los borradores locales.
