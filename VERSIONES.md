# Versiones publicadas de Puduhue Terreno

Cada fila es una versión publicada y el commit de main que la contiene (el último con ese número en `APP_VER`).
Para ver o recuperar una versión, abrir su enlace: muestra todos los archivos tal como estaban en esa versión.
Este archivo reemplaza a las ramas `vNN` y a las etiquetas como historial: las ramas de prueba se borran después de publicar.
Se agrega una fila en cada publicación (ver CLAUDE.md, «Reglas fijas»).

| Versión | Fecha | Commit | Resumen |
|---|---|---|---|
| 130 | 2026-10-30 | [6cac61b](https://github.com/puduhue/puduhue-terreno/tree/6cac61b) | Actas: el acta de vehículo trae el punto 3.4 completo y «4. Aceptación» y ya se puede cerrar; una devolución anulada deja la entrega disponible para otra; la devolución de vivienda solo desde una entrega cerrada; km y valores con punto de miles y coma decimal; no se cierra un acta con fecha futura ni una devolución anterior a su entrega; el PDF de un acta anulada lleva la marca «ANULADA» con el motivo (también en OneDrive); eliminar un borrador actualiza el Excel |
| 129 | 2026-10-30 | [d5ba3d5](https://github.com/puduhue/puduhue-terreno/tree/d5ba3d5) | Control de bodega: «= Coincide» con decimales (por ejemplo 12,345 kg) guardaba la cantidad con punto y se leía como miles, con una diferencia falsa en el conteo, el Excel y el PDF; ahora guarda con coma y los conteos ya guardados así se leen bien. Regla: el punto es de miles y la coma de decimales |
| 128 | 2026-10-30 | [ac99856](https://github.com/puduhue/puduhue-terreno/tree/ac99856) | Rendiciones › Maestros contables: «Revisión de datos» enlaza a «Colaboradores y aprobadores» (ya no dice que la lista se corrige en el Excel); en «Rinden y no están en la lista», la tarjeta muestra el nombre de quien creó la rendición con esa cuenta (antes, si Contabilidad la había asignado a otra persona, salía el nombre de esa persona) |
| 127 | 2026-10-28 | [c77e7a2](https://github.com/puduhue/puduhue-terreno/tree/c77e7a2) | «Para hoy» del inicio muestra solo lo que creó la persona (acta de vivienda en borrador, visitas abiertas del check list y conteo de bodega abierto); antes salían también los de otras personas. Los registros antiguos sin creador no salen ahí; en los módulos se ven todos, como antes |
| 126 | 2026-10-28 | [5a44570](https://github.com/puduhue/puduhue-terreno/tree/5a44570) | Rendiciones: con una foto HEIC (iPhone) de una boleta o factura, ahora se lee el timbre del SII y se revisa la nitidez (antes se saltaba); también al cambiar la foto de un documento |
| 125 | 2026-10-27 | [a1246b5](https://github.com/puduhue/puduhue-terreno/tree/a1246b5) | fotos elegidas con Galería que no se podían leer («No se pudo leer la imagen»): ahora se abren también las fotos HEIC (se convierten a JPEG con heic2any), las muy grandes, y el aviso dice la causa (foto solo en la nube, sin señal para el conversor, demasiado grande) en todos los módulos |
| 124 | 2026-10-27 | [968ec81](https://github.com/puduhue/puduhue-terreno/tree/968ec81) | check list de bodega: se agrega la bodega Corte Alto (no aparece en «Visitas a predios» ni en las actas) |
| 123 | 2026-10-26 | [ed7aa5e](https://github.com/puduhue/puduhue-terreno/tree/ed7aa5e) | en las pantallas principales (Actas, Rendiciones, Check list, Control de bodega y Stock), flecha «‹» arriba a la izquierda para volver al inicio |
| 122 | 2026-10-26 | [e4b3644](https://github.com/puduhue/puduhue-terreno/tree/e4b3644) | actas de vivienda: se elige «Casa de familia» o «Casa de huéspedes»; en la casa de huéspedes se pide el cargo y el acta de entrega trae el reglamento de convivencia (en pantalla y en el PDF como Anexo 4, con la firma del trabajador) |
| 121 | 2026-10-23 | [8786c31](https://github.com/puduhue/puduhue-terreno/tree/8786c31) | permisos por persona en Administración: en Check list, Actas, Control de bodega y Stock cada persona puede quedar con «Ve y edita», «Solo ve» o «No ve»; incluye la v120 (fotos pendientes más visibles y subida de a 3) |
| 119 | 2026-10-21 | [d25b84c](https://github.com/puduhue/puduhue-terreno/tree/d25b84c) | quien rinde puede eliminar su rendición en borrador o devuelta; Contabilidad puede anular la que no esté contabilizada; el fondo llega hasta abajo en teléfonos altos |
| 118 | 2026-10-20 | [57750a8](https://github.com/puduhue/puduhue-terreno/tree/57750a8) | carpetas de OneDrive ordenadas como la app: Actas › Viviendas, Vehículos, Activos fijos › predio › Entregas o Devoluciones; check list en «Check list de cumplimiento»; los enlaces de fotos del Excel se corrigen solos |
| 117 | 2026-10-19 | [0fa95b3](https://github.com/puduhue/puduhue-terreno/tree/0fa95b3) | colaboradores y aprobadores se editan desde la app (Maestros contables), con el Excel de _maestros al día |
| 116 | 2026-10-19 | [97a553b](https://github.com/puduhue/puduhue-terreno/tree/97a553b) | la app responde mejor al tocar: los toques ya no se pierden cuando llega la sincronización, botones chicos con más área de toque, «Revisando la foto…» al rendir y visitas más rápidas |
| 115 | 2026-10-19 | [e21bd39](https://github.com/puduhue/puduhue-terreno/tree/e21bd39) | Rendiciones: «Devolver» siempre activo (sin documentos observados devuelve la rendición completa) y con comentario obligatorio para la persona |
| 114 | 2026-10-19 | [2a8239e](https://github.com/puduhue/puduhue-terreno/tree/2a8239e) | Rendiciones: agregar varios documentos juntos sin quedarse sin memoria (las lecturas van de a una) y, si falta espacio para una foto, se libera la copia local de fotos ya subidas |
| 113 | 2026-10-19 | [1f6a654](https://github.com/puduhue/puduhue-terreno/tree/1f6a654) | módulo «Check list de cumplimiento» (visitas a predios, bodegas y camionetas) con el check list de camionetas aparte, una revisión por patente con los puntos del acta de entrega; nombres más específicos en Actas |
| 112 | 2026-10-19 | [6bf5a0c](https://github.com/puduhue/puduhue-terreno/tree/6bf5a0c) | estado de las camionetas en el check list de visitas, con botones para marcar las patentes con problemas |
| 111 | 2026-10-19 | [45c6c5b](https://github.com/puduhue/puduhue-terreno/tree/45c6c5b) | una rendición nueva sin documentos ya no queda como borrador; las vacías que ya había se borran al volver a la lista |
| 110 | 2026-10-19 | [1d0a092](https://github.com/puduhue/puduhue-terreno/tree/1d0a092) | peajes en Rendiciones (tipo «Peaje», solo con el gasto «Peajes / barcaza») y el aviso de documento duplicado dice con qué rendición choca |
| 109 | 2026-10-19 | [bccecee](https://github.com/puduhue/puduhue-terreno/tree/bccecee) | registro de capacitaciones en Actas (la pantalla «Actas de entrega» pasa a «Actas»): participantes con RUT y firma en el teléfono, PDF con el formato de Control de Gestión y Excel consolidado |
| 108 | 2026-10-19 | [e05b042](https://github.com/puduhue/puduhue-terreno/tree/e05b042) | escribir sin que se borre lo escrito: cantidad y comentario en Control de bodega, pasar de un campo a otro en bodega y Rendiciones, fecha escrita con el teclado en el computador, buscador del catálogo del check list |
| 107 | 2026-10-19 | [542f176](https://github.com/puduhue/puduhue-terreno/tree/542f176) | el ícono en Android dice «Puduhue Terreno» (nombre corto del manifiesto); sin cambios de código |
| 106 | 2026-10-18 | [935bb8d](https://github.com/puduhue/puduhue-terreno/tree/935bb8d) | no perder datos (auditoría): guardar al pasar a segundo plano, la subida se recupera tras un 403 y no se detiene por un registro, fotos sin espacio avisan, doble toque bloqueado, fechas locales |
| 105 | 2026-10-18 | [1ca7f4e](https://github.com/puduhue/puduhue-terreno/tree/1ca7f4e) | Valle Verde sale de la lista de predios (es planta lechera); los registros antiguos lo conservan |
| 104 | 2026-10-18 | [d494232](https://github.com/puduhue/puduhue-terreno/tree/d494232) | conflictos entre teléfonos en su módulo (rendiciones y conteos) y actualización automática solo en pantallas de lista |
| 103 | 2026-10-18 | [c9e8437](https://github.com/puduhue/puduhue-terreno/tree/c9e8437) | CSS a estilos.css, módulos Check list, Stock/Bodega y Actas de entrega aparte, código sin uso borrado |
| 102 | 2026-10-18 | [43487d0](https://github.com/puduhue/puduhue-terreno/tree/43487d0) | Rendiciones a modulos/rendiciones.js (paso 3 de la reorganización) |
| 101 | 2026-10-18 | [35efc0f](https://github.com/puduhue/puduhue-terreno/tree/35efc0f) | logos en lib/marca-puduhue-1/marcas.js (publicación) |
| 100 | 2026-10-18 | [0575846](https://github.com/puduhue/puduhue-terreno/tree/0575846) | bibliotecas en lib/ y CLAUDE.md (publicación) |
| 99 | 2026-10-18 | [3bed1c3](https://github.com/puduhue/puduhue-terreno/tree/3bed1c3) | notificaciones con interruptor en «Más» |
| 98 | 2026-10-18 | [26a891c](https://github.com/puduhue/puduhue-terreno/tree/26a891c) | lectura más exacta de boletas y facturas |
| 97 | 2026-10-18 | [8f389f0](https://github.com/puduhue/puduhue-terreno/tree/8f389f0) | las hojas que suben desde abajo se cierran arrastrándolas |
| 96 | 2026-10-18 | [1e7296c](https://github.com/puduhue/puduhue-terreno/tree/1e7296c) | la app se siente más nativa |
| 95 | 2026-10-18 | [129bcce](https://github.com/puduhue/puduhue-terreno/tree/129bcce) | se quita «Regenerar informes» de Administración |
| 94 | 2026-10-17 | [ba89ce3](https://github.com/puduhue/puduhue-terreno/tree/ba89ce3) | «Último fondo» toma cualquier abono a la 110106 |
| 93 | 2026-10-17 | [51c1402](https://github.com/puduhue/puduhue-terreno/tree/51c1402) | Servidor v94: columnas reales del Libro Mayor y organización del documento |
| 92 | 2026-10-17 | [d7dc474](https://github.com/puduhue/puduhue-terreno/tree/d7dc474) | seguimiento por pasos de la rendición y documentos uno por uno |
| 91 | 2026-10-17 | [c8f66a5](https://github.com/puduhue/puduhue-terreno/tree/c8f66a5) | semáforo de predios y pantalla de predio para muchas visitas |
| 90 | 2026-10-17 | [f9c9639](https://github.com/puduhue/puduhue-terreno/tree/f9c9639) | se comporta como app en el teléfono |
| 89 | 2026-10-17 | [290c5c7](https://github.com/puduhue/puduhue-terreno/tree/290c5c7) | check list más rápido de llenar |
| 88 | 2026-10-17 | [268a8b9](https://github.com/puduhue/puduhue-terreno/tree/268a8b9) | inicio con «Para hoy», barra superior única y botón principal fijo abajo |
| 87 | 2026-10-17 | [9732576](https://github.com/puduhue/puduhue-terreno/tree/9732576) | aviso para activar las notificaciones al entrar |
| 86 | 2026-10-17 | [04d6332](https://github.com/puduhue/puduhue-terreno/tree/04d6332) | instalar la app es más fácil |
| 85 | 2026-10-17 | [a0ac6eb](https://github.com/puduhue/puduhue-terreno/tree/a0ac6eb) | preparada para la mudanza a puduhue.github.io/puduhue-terreno |
| 84 | 2026-10-17 | [501bc57](https://github.com/puduhue/puduhue-terreno/tree/501bc57) | Servidor v85: acepta la app desde la organización Puduhue |
| 83 | 2026-10-17 | [707c890](https://github.com/puduhue/puduhue-terreno/tree/707c890) | notificaciones en el teléfono para las rendiciones |
| 82 | 2026-10-17 | [317e1cc](https://github.com/puduhue/puduhue-terreno/tree/317e1cc) | Servidor v83: notificaciones en el teléfono (Web Push) |
| 81 | 2026-10-15 | [f33bdd5](https://github.com/puduhue/puduhue-terreno/tree/f33bdd5) | facturas y boletas en PDF en las rendiciones |
| 80 | 2026-10-15 | [2656656](https://github.com/puduhue/puduhue-terreno/tree/2656656) | se ve y se usa bien en el computador, en cualquier navegador |
| 79 | 2026-10-15 | [5ac930f](https://github.com/puduhue/puduhue-terreno/tree/5ac930f) | para rendir solo facturas y boletas |
| 78 | 2026-10-15 | [32b94d8](https://github.com/puduhue/puduhue-terreno/tree/32b94d8) | avisos por correo en cada paso de la rendición |
| 77 | 2026-10-15 | [ba7db1a](https://github.com/puduhue/puduhue-terreno/tree/ba7db1a) | devoluciones de vehículos y activos, actas en el check list, asiento en tarjetas, revisión de datos y recordatorio de cierre (en revisión) |
| 76 | 2026-10-15 | [775e3b7](https://github.com/puduhue/puduhue-terreno/tree/775e3b7) | varias rendiciones por persona en el mismo mes (en revisión) |
| 75 | 2026-10-15 | [20838f4](https://github.com/puduhue/puduhue-terreno/tree/20838f4) | Contabilidad busca cuenta, producto, partida, tercero y centro por nombre (en revisión) |
| 74 | 2026-10-15 | [40c969f](https://github.com/puduhue/puduhue-terreno/tree/40c969f) | sin jefatura va directo a Contabilidad; Contabilidad corrige líneas del asiento (en revisión) |
| 73 | 2026-10-15 | [204e19f](https://github.com/puduhue/puduhue-terreno/tree/204e19f) | RUT de quien rinde por correo y opciones para abrir el Excel (en revisión) |
| 72 | 2026-10-15 | [17e490f](https://github.com/puduhue/puduhue-terreno/tree/17e490f) | módulo Actas de entrega (vivienda, vehículo y activo fijo) — en revisión |
| 71 | 2026-10-15 | [1c16900](https://github.com/puduhue/puduhue-terreno/tree/1c16900) | número de versión visible |
| 70 | 2026-10-15 | [abda242](https://github.com/puduhue/puduhue-terreno/tree/abda242) | grupo Camionetas en el check list de visitas (en revisión) |
| 69 | 2026-10-15 | [f01cf36](https://github.com/puduhue/puduhue-terreno/tree/f01cf36) | ayuda con el RUT y avisos que llevan al dato que falta |
| 68 | 2026-10-15 | [480ac33](https://github.com/puduhue/puduhue-terreno/tree/480ac33) | RUT del emisor obligatorio en facturas y boletas de honorarios |
| 67 | 2026-10-15 | [7fc5b01](https://github.com/puduhue/puduhue-terreno/tree/7fc5b01) | buscador para centro de costo y tipo de gasto, con los sugeridos marcados |
| 66 | 2026-10-15 | [3b20682](https://github.com/puduhue/puduhue-terreno/tree/3b20682) | un proveedor sin ficha en Finnegans ya no frena la aprobación |
| 65 | 2026-10-15 | [d8d0d86](https://github.com/puduhue/puduhue-terreno/tree/d8d0d86) | organizaciones de Rendiciones directo desde Finnegans |
| 64 | 2026-10-15 | [4160399](https://github.com/puduhue/puduhue-terreno/tree/4160399) | Servidor: listado de maestros de Finnegans (organizaciones) para Rendiciones |
| 63 | 2026-10-15 | [3933f62](https://github.com/puduhue/puduhue-terreno/tree/3933f62) | cafetería y papelería con producto GGE002 mientras G101 y G102 están inactivos |
| 62 | 2026-10-15 | [451c954](https://github.com/puduhue/puduhue-terreno/tree/451c954) | Servidor de Puduhue Terreno: publicación automática en Cloudflare desde GitHub |
| 61 | 2026-10-14 | [daaa137](https://github.com/puduhue/puduhue-terreno/tree/daaa137) | filtros por familia y subfamilia, orden alfabético y stock desde Finnegans para todos |
| 60 | 2026-10-14 | [f7ab869](https://github.com/puduhue/puduhue-terreno/tree/f7ab869) | cámara directa y botón Galería en todas las fotos |
| 59 | 2026-10-14 | [d86bbe1](https://github.com/puduhue/puduhue-terreno/tree/d86bbe1) | Control de bodega y Stock abiertos a todo el equipo |
| 58 | 2026-10-14 | [a6d2f07](https://github.com/puduhue/puduhue-terreno/tree/a6d2f07) | Check list de bodega como módulo aparte |
| 57 | 2026-10-06 | [fa887ae](https://github.com/puduhue/puduhue-terreno/tree/fa887ae) | sw.js |
| 56 | 2026-10-06 | [9c51046](https://github.com/puduhue/puduhue-terreno/tree/9c51046) | sw.js |
| 55 | 2026-10-02 | [c748a18](https://github.com/puduhue/puduhue-terreno/tree/c748a18) | sw.js |
| 54 | 2026-10-02 | [6a90c93](https://github.com/puduhue/puduhue-terreno/tree/6a90c93) | sw.js |
| 53 | 2026-10-02 | [4a8ae0c](https://github.com/puduhue/puduhue-terreno/tree/4a8ae0c) | sw.js |
| 52 | 2026-10-02 | [4de8666](https://github.com/puduhue/puduhue-terreno/tree/4de8666) | sw.js |
| 51 | 2026-10-02 | [bd44582](https://github.com/puduhue/puduhue-terreno/tree/bd44582) | sw.js |
| 50 | 2026-10-02 | [e8103d0](https://github.com/puduhue/puduhue-terreno/tree/e8103d0) | sw.js |
| 49 | 2026-10-02 | [8efd0ff](https://github.com/puduhue/puduhue-terreno/tree/8efd0ff) | sw.js |
| 48 | 2026-10-02 | [ce28f32](https://github.com/puduhue/puduhue-terreno/tree/ce28f32) | sw.js |
| 47 | 2026-10-02 | [ef71205](https://github.com/puduhue/puduhue-terreno/tree/ef71205) | sw.js |
| 46 | 2026-10-02 | [a347a94](https://github.com/puduhue/puduhue-terreno/tree/a347a94) | sw.js |
| 45 | 2026-10-02 | [d6cf4b2](https://github.com/puduhue/puduhue-terreno/tree/d6cf4b2) | sw.js |
| 44 | 2026-10-02 | [f5542a8](https://github.com/puduhue/puduhue-terreno/tree/f5542a8) | sw.js |
| 43 | 2026-10-02 | [9735584](https://github.com/puduhue/puduhue-terreno/tree/9735584) | sw.js |
| 42 | 2026-10-02 | [0090407](https://github.com/puduhue/puduhue-terreno/tree/0090407) | icon-512.png |
| 41 | 2026-10-02 | [e9bf7a2](https://github.com/puduhue/puduhue-terreno/tree/e9bf7a2) | sw.js |
| 40 | 2026-10-02 | [4897f81](https://github.com/puduhue/puduhue-terreno/tree/4897f81) | sw.js |
| 39 | 2026-10-02 | [0027e5e](https://github.com/puduhue/puduhue-terreno/tree/0027e5e) | sw.js |
| 38 | 2026-10-02 | [ed42c8a](https://github.com/puduhue/puduhue-terreno/tree/ed42c8a) | sw.js |
| 37 | 2026-10-02 | [cd9e9f1](https://github.com/puduhue/puduhue-terreno/tree/cd9e9f1) | sw.js |
| 36 | 2026-10-02 | [7b5a63e](https://github.com/puduhue/puduhue-terreno/tree/7b5a63e) | manifest.json |
| 35 | 2026-10-02 | [93af3fc](https://github.com/puduhue/puduhue-terreno/tree/93af3fc) | (subida manual) |
| 34 | 2026-10-02 | [d4a2c65](https://github.com/puduhue/puduhue-terreno/tree/d4a2c65) | (subida manual) |
| 33 | 2026-10-02 | [3345c63](https://github.com/puduhue/puduhue-terreno/tree/3345c63) | (subida manual) |
| 30 | 2026-10-02 | [0005732](https://github.com/puduhue/puduhue-terreno/tree/0005732) | (subida manual) |
| 26 | 2026-10-01 | [3dc8d16](https://github.com/puduhue/puduhue-terreno/tree/3dc8d16) | (subida manual) |
| 25 | 2026-10-01 | [bbfadef](https://github.com/puduhue/puduhue-terreno/tree/bbfadef) | (subida manual) |
| 22 | 2026-10-01 | [3f30148](https://github.com/puduhue/puduhue-terreno/tree/3f30148) | (subida manual) |
| 21 | 2026-10-01 | [74e79b1](https://github.com/puduhue/puduhue-terreno/tree/74e79b1) | (subida manual) |
| 17 | 2026-10-01 | [df276d6](https://github.com/puduhue/puduhue-terreno/tree/df276d6) | (subida manual) |
| 16 | 2026-10-01 | [6614072](https://github.com/puduhue/puduhue-terreno/tree/6614072) | (subida manual) |
