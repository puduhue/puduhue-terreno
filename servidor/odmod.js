/*
  v212: los demás módulos también guardan por el servidor (plan «que solo el servidor escriba», etapa 3; Benja la sumó el
  19-11-2026, junto con la etapa 4, para que al final la app no necesite el permiso Files.ReadWrite.All). Primero Stock y
  Control de bodega; desde la v213, Check list (visitas, bodegas, camionetas y casas de huéspedes, y su catálogo); desde la
  v214, Actas (viviendas, vehículos, activos fijos y capacitaciones) y «Permisos por persona». Desde la v215, también LEE por
  las personas (etapa 4): registros, stock.json, el catálogo y los archivos de los módulos.
  ----------------------------------------------------------------------------------------------------------------------------
  Igual que Rendiciones (rendod.js): la app combina en el teléfono (eTag, If-Match) y el servidor revisa quién pide y escribe con
  su credencial. Las reglas siguen OD_MODO («aviso»: anota y deja pasar; «bloquear»: 403); lo que está fuera del módulo (rutas,
  nombres o tipos de archivo) se rechaza siempre (400).
    POST /od/reg        { col, op: put|delete|conflicto, id, datos, ifMatch, nombre... } → { ok, eTag }   (un registro de _datos)
    POST /od/mod/subida { mod, tipo, ruta: [carpetas desde la raíz], nombre }          → { ok, uploadUrl } (sesión de carga)
                        (tipo: en Check list, la carpeta de cada check list: visitas, bodega, camionetas o huespedes)
    POST /od/mod/json   { mod, datos, ifMatch }                                         → { ok, eTag }   (stock.json)
    POST /od/mod/borrar { id }                                                          → { ok }         (una foto o archivo de un módulo)
    POST /od/permisos   { datos }                                                       → { ok, eTag }   (v214: Permisos_app.json, solo el administrador)
  v215, lectura (quien no tenga «no» en el módulo; el administrador, todo; OD_MODS_LEE = "no" la apaga):
    POST /od/mod/bajar  { col, conocidos: { id: eTag } }   → { ok, lista: [[id, eTag]], datos: { id: registro }, mas }
                        (todos los registros de _datos con su eTag; el contenido solo de los nuevos o cambiados, de a MAX_DATOS)
    POST /od/mod/leer   { col, id }                        → { ok, eTag, datos }   (un registro; 404 si no está)
    POST /od/mod/jsonleer { mod, soloMeta }                → { ok, eTag, datos }   (stock.json; 404 si no está)
    POST /od/mod/info   { mod, tipo, ruta, nombre }        → { ok, id, eTag, webUrl } (un archivo por su ruta dentro del módulo)
    POST /od/mod/archivo { id }                            → el archivo (dentro de la carpeta de un módulo)
  v216:
    POST /od/mod/meta   { id }                             → { ok, webUrl, eTag }  (el enlace de una foto para los Excel)
    POST /od/mod/mover  { id, ruta, nombre }               → { ok, id, webUrl }    (solo el administrador: «Ordenar fotos antiguas»,
                        de Actas/fotos —la carpeta de las primeras versiones— a la carpeta de su acta)
  Quién puede: el administrador, todo. Los demás, según «Permisos por persona» (Apps de terreno/_config/Permisos_app.json, que
  el servidor lee con su credencial, como la app: por correo y, si no está, por los otros correos de su ficha de colaborador):
  «agregar» guarda; «ver» o «no», no. En Stock (solo se ve) basta con no tener «no». El catálogo del check list
  (Check list de visitas/_config/Catalogo_check_list.xlsx), solo el administrador. Interruptor: OD_MODS = "no" → /yo dice
  odMods: false y la app vuelve a escribir directo.
*/
import { odConfig, graphApp } from "./onedrive.js";
import { idHijo, odRendActivo, odModo, anotarAviso, maestrosSrv, correosDe } from "./rendod.js";

export const MODS = {
  cb: { nombre: "Control de bodega", col: "conteos", root: "01RAJ2KQFXDFLPDNY2IJCIZ3BGSVPF74IH", ext: /\.(jpe?g|png|webp|heic|pdf|xlsx)$/i, prof: 3 },
  stock: { nombre: "Stock", root: "01RAJ2KQF2KBOXTJBS5VAJHLQZVCLBOCZ6", datos: "01RAJ2KQEA4AYAJGRSLVBI4JELXKHFCDUH", archivo: "stock.json", soloVer: true, ext: /^Stock_Finnegans\.xlsx$/, prof: 0 },
  /* v213: los registros de los cuatro check list están en «Check list de visitas»/_datos; los archivos, en la carpeta de cada uno
     (camionetas y casas de huéspedes se buscan por nombre junto a la de visitas, como clRaiz en la app) */
  cl: { nombre: "Check list de cumplimiento", col: "visitas", root: "01RAJ2KQCX5EEP6HGCTBA2KO2DSGC4F7LS", ext: /\.(jpe?g|png|webp|heic|pdf|xlsx)$/i, prof: 3,
    tipos: { visitas: { root: "01RAJ2KQCX5EEP6HGCTBA2KO2DSGC4F7LS" }, bodega: { root: "01RAJ2KQCDFWQKAL4FGVGIAV7CDLCSWXQW" }, camionetas: { carpeta: "Camionetas" }, huespedes: { carpeta: "Casas de huéspedes" } },
    especiales: [{ tipo: "visitas", ruta: ["_config"], nombre: "Catalogo_check_list.xlsx", soloAdmin: "el catálogo del check list lo cambia solo el administrador" }] },
  /* v214: Actas/{Viviendas|Vehículos|Activos fijos}/{predio}/{Entregas|Devoluciones}/{fecha …}/Fotos y Actas/Capacitaciones/{fecha tema}/Fotos
     (carpetaActa en index.html); los Excel consolidados en la carpeta de cada tipo */
  ax: { nombre: "Actas", col: "actas", root: "01RAJ2KQCIPH6SPKTJ5NA3JYZ3FTJGI5SC", ext: /\.(jpe?g|png|webp|heic|pdf|xlsx)$/i, prof: 5, primeras: ["Viviendas", "Vehículos", "Activos fijos", "Capacitaciones"],
    legado: "fotos" /* v216: Actas/fotos, de las primeras versiones (fotos guardadas por nombre); solo .jpg, para leer, borrar y ordenar */ },
};
const MOD_DE_COL = Object.fromEntries(Object.entries(MODS).filter(([, m]) => m.col).map(([k, m]) => [m.col, k]));
export const odModsActivo = env => odRendActivo(env) && String(env.OD_MODS || "").toLowerCase() !== "no";
export const odModsLeeActivo = env => odModsActivo(env) && String(env.OD_MODS_LEE || "").toLowerCase() !== "no"; /* v215 */
export const MAX_DATOS = 30; /* registros por pedido (los subpedidos de un Worker tienen límite) */
const ID_OK = /^[A-Za-z0-9_-]{4,80}$/;
const RUTA_OK = s => typeof s === "string" && s.length > 0 && s.length <= 100 && !/[\\/:*?"<>|#%]/.test(s) && s.trim() === s && s !== "." && s !== "..";

/* ---------- permisos por persona (Permisos_app.json), guardados 5 minutos ---------- */
let PERM = null, PERM_T = 0;
export function odOlvidarPermisos() { PERM = null; PERM_T = 0; for (const k of Object.keys(CARP)) delete CARP[k]; DATOS = {}; }
export async function permisosSrv(env, ahora = Date.now()) {
  if (PERM && ahora - PERM_T < 300000) return PERM;
  const c = odConfig(env), d = encodeURIComponent(c.drive);
  let conf = null; try { conf = await idHijo(env, c.raiz, "_config", false); } catch (e) { conf = null; }
  let x = { personas: {} };
  if (conf) {
    const r = await graphApp(env, `/drives/${d}/items/${conf}:/Permisos_app.json:/content`);
    if (r.ok) { try { const j = await r.json(); if (j && typeof j.personas === "object") x = j; } catch (e) {} }
    else if (r.status !== 404) throw { status: 502, error: `No se pudieron leer los permisos (${r.status}).` };
  }
  PERM = x; PERM_T = ahora; return x;
}
/* lo mismo que permDe y permMio en la app: «no», «ver» o «agregar» (en un módulo que solo se ve, «ver» cuenta como «agregar») */
export function permDe(P, mod, correos) {
  const m = MODS[mod], per = (P && P.personas) || {};
  const c = correos.find(x => x && per[x]); if (!c) return "agregar";
  const v = per[c][mod];
  return v === "no" || (v === "ver" && !(m && m.soloVer)) ? v : "agregar";
}
async function correosDeQuien(env, correo) {
  const L = [correo];
  try { const M = await maestrosSrv(env); (M.colab || []).filter(k => k && k.activo !== false && correosDe(k).includes(correo)).forEach(k => correosDe(k).forEach(y => { if (!L.includes(y)) L.push(y); })); } catch (e) {}
  return L;
}
/* lo que no cumple al guardar en un módulo (vacío = permitido) */
export function revisarMod(P, mod, correos, quien) {
  if (quien.admin) return [];
  const p = permDe(P, mod, correos), m = MODS[mod];
  if (m.soloVer) return p === "no" ? [`no tiene acceso a ${m.nombre}`] : [];
  return p === "agregar" ? [] : [p === "ver" ? `en ${m.nombre} solo puede ver` : `no tiene acceso a ${m.nombre}`];
}
/* v215: para leer basta con no tener «no» (en un módulo que solo se ve, igual) */
export function revisarLectura(P, mod, correos, quien) {
  if (quien.admin) return [];
  if (mod === "stock" && permDe(P, "cb", correos) !== "no") return []; /* quien hace conteos necesita el stock (puedeContar en la app) */
  return permDe(P, mod, correos) === "no" ? [`no tiene acceso a ${MODS[mod].nombre}`] : [];
}
/* qué archivo es: { error } (400), { especial } (un archivo fijo del módulo, con su regla) o null */
export function revisarArchivo(mod, ruta, nombre, tipo, op = {}) {
  const m = MODS[mod]; if (!m) return { error: "Módulo no válido." };
  if (m.tipos && !m.tipos[tipo || "visitas"]) return { error: "Tipo de check list no válido." };
  const esp = (m.especiales || []).find(e => e.tipo === (tipo || "visitas") && e.nombre === nombre && JSON.stringify(e.ruta) === JSON.stringify(ruta));
  if (esp) return { especial: esp };
  if (!Array.isArray(ruta) || ruta.length > m.prof || !ruta.every(RUTA_OK)) return { error: "Carpeta no válida." };
  if (!RUTA_OK(nombre) || nombre.length > 150 || nombre.toLowerCase().endsWith(".json")) return { error: "Nombre de archivo no válido." };
  if (!m.ext.test(nombre)) return { error: "Tipo de archivo no permitido en este módulo." };
  if (ruta[0] && ruta[0].startsWith("_")) return { error: "Carpeta no válida." };
  if (m.legado && ruta.length === 1 && ruta[0] === m.legado) return !op.legado ? { error: "En la carpeta antigua no se suben archivos." } : /\.jpe?g$/i.test(nombre) ? null : { error: "En la carpeta antigua solo hay fotos." }; /* v216: solo leer, borrar y ordenar */
  if (m.primeras && !m.primeras.includes(String(ruta[0] || "").normalize("NFC"))) return { error: "Carpeta no válida." };
  return null;
}

/* ---------- carpetas ---------- */
const CARP = {}; let DATOS = {};
/* v213: la raíz de los archivos de un módulo (en Check list, la de cada tipo) */
async function raizMod(env, mod, tipo, crear = true) {
  const m = MODS[mod]; if (!m.tipos) return m.root;
  const t = m.tipos[tipo || "visitas"]; if (t.root) return t.root;
  const k = "raiz:" + mod + ":" + tipo; if (CARP[k]) return CARP[k];
  const c = odConfig(env), q = await graphApp(env, `/drives/${encodeURIComponent(c.drive)}/items/${m.tipos.visitas.root}?$select=id,parentReference`);
  if (!q.ok) throw { status: 502, error: `No se encontró la carpeta de los check list (${q.status}).` };
  const padre = ((await q.json()).parentReference || {}).id; if (!padre) throw { status: 502, error: "No se encontró la carpeta de los check list." };
  return CARP[k] = await idHijo(env, padre, t.carpeta, crear);
}
async function carpetaMod(env, mod, segs, tipo) {
  let p = await raizMod(env, mod, tipo), k = mod + ":" + (tipo || "");
  for (const s of segs) { k += "/" + s; p = CARP[k] || (CARP[k] = await idHijo(env, p, s, true)); }
  return p;
}
const carpetaDatosMod = async (env, mod) => DATOS[mod] || (DATOS[mod] = await idHijo(env, MODS[mod].root, "_datos", true));

async function anotarOBloquear(env, ctx, avisos, json, e) {
  if (!e.reglas.length) return null;
  const x = { hora: new Date().toISOString(), modo: odModo(env), ...e, reglas: e.reglas.slice(0, 10) };
  if (avisos) ctx.waitUntil(anotarAviso(env, avisos, x).catch(() => {}));
  return odModo(env) === "bloquear" ? json({ error: "No tienes permiso para este cambio: " + e.reglas[0] + ".", reglas: e.reglas, status: 403 }, 403) : null;
}

const LEE = ["/od/mod/bajar", "/od/mod/leer", "/od/mod/jsonleer", "/od/mod/info", "/od/mod/archivo", "/od/mod/meta"];
/* v215: sube por las carpetas de un archivo, por id, hasta la raíz de un módulo (como máximo 7 niveles): { mod, tipo, segs, it } */
async function ubicar(env, id) {
  const c = odConfig(env), d = encodeURIComponent(c.drive);
  const r = await graphApp(env, `/drives/${d}/items/${id}?$select=id,name,parentReference,folder,eTag,webUrl`);
  if (r.status === 404) return null;
  if (!r.ok) throw { status: 502, error: `No se pudo leer el archivo (${r.status}).` };
  const it = await r.json(), raices = {};
  for (const [k, m] of Object.entries(MODS)) {
    if (!m.tipos) { raices[m.root] = [k, ""]; if (m.datos) raices[m.datos] = [k, ""]; continue; }
    for (const t of Object.keys(m.tipos)) { try { raices[await raizMod(env, k, t, false)] = [k, t]; } catch (e) {} }
  }
  let mod = null, tipo = "", pid = (it.parentReference || {}).id, segs = [];
  for (let i = 0; i < 8 && pid && !mod; i++) {
    if (raices[pid]) { [mod, tipo] = raices[pid]; break; }
    const q = await graphApp(env, `/drives/${d}/items/${pid}?$select=id,name,parentReference`); if (!q.ok) break;
    const p = await q.json(); segs.unshift(p.name); pid = (p.parentReference || {}).id;
  }
  return { mod, tipo, segs, it };
}
export async function rutasModulos(req, env, ctx, url, { correo, json, crudo, autorizado, avisos }) {
  const rutas = ["/od/reg", "/od/mod/subida", "/od/mod/json", "/od/mod/borrar", "/od/permisos", "/od/mod/mover"].concat(LEE);
  if (!rutas.includes(url.pathname)) return null;
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (LEE.includes(url.pathname) && !odModsLeeActivo(env)) return json({ error: "El servidor no está leyendo los módulos.", status: 503 }, 503);
  if (!odModsActivo(env)) return json({ error: "El servidor no está guardando en OneDrive (falta la clave o está apagado).", status: 503 }, 503);
  let b; try { b = await req.json(); } catch (e) { return json({ error: "Pedido sin JSON." }, 400); }
  const c = odConfig(env), d = encodeURIComponent(c.drive), quien = { correo, admin: autorizado };
  try {
    const P = await permisosSrv(env), correos = await correosDeQuien(env, correo);
    /* ---------- v215: lectura ---------- */
    const negar = async (mod, id) => { const v = revisarLectura(P, mod, correos, quien); if (!v.length) return null;
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${mod}:leer`, id, correo, reglas: v }); return no; };
    if (url.pathname === "/od/mod/bajar" || url.pathname === "/od/mod/leer") {
      const mod = MOD_DE_COL[String(b.col || "")]; if (!mod) return json({ error: "Colección no válida." }, 400);
      const no = await negar(mod, b.col); if (no) return no;
      const datos = await carpetaDatosMod(env, mod);
      if (url.pathname === "/od/mod/leer") {
        const id = String(b.id || ""); if (!ID_OK.test(id)) return json({ error: "Id de registro no válido." }, 400);
        const r0 = await graphApp(env, `/drives/${d}/items/${datos}:/${encodeURIComponent(id + ".json")}?$select=id,eTag`);
        if (r0.status === 404) return json({ error: "No está.", status: 404 }, 404);
        if (!r0.ok) return json({ error: `No se pudo leer el registro (${r0.status}).`, status: r0.status }, 502);
        const m = await r0.json(), rc = await graphApp(env, `/drives/${d}/items/${m.id}/content`);
        if (!rc.ok) return json({ error: `No se pudo leer el registro (${rc.status}).`, status: rc.status }, 502);
        return json({ ok: true, eTag: m.eTag, datos: await rc.json() });
      }
      const con = (b && typeof b.conocidos === "object" && b.conocidos) || {}, lista = [], cambiados = [];
      let u = `/drives/${d}/items/${datos}/children?$select=id,name,eTag,file&$top=200`;
      for (let i = 0; u && i < 20; i++) {
        const r = await graphApp(env, u.replace("https://graph.microsoft.com/v1.0", ""));
        if (!r.ok) return json({ error: `No se pudo leer la lista (${r.status}).`, status: r.status }, 502);
        const pg = await r.json();
        for (const it of pg.value || []) { if (!it.file || !/\.json$/i.test(it.name)) continue; const id = it.name.replace(/\.json$/i, ""); if (!ID_OK.test(id)) continue;
          lista.push([id, it.eTag]); if (con[id] !== it.eTag) cambiados.push(it); }
        u = pg["@odata.nextLink"] || null;
      }
      const out = {}, toca = cambiados.slice(0, MAX_DATOS);
      await Promise.all(toca.map(async it => { const rc = await graphApp(env, `/drives/${d}/items/${it.id}/content`); if (rc.ok) { try { out[it.name.replace(/\.json$/i, "")] = await rc.json(); } catch (e) {} } }));
      return json({ ok: true, lista, datos: out, mas: cambiados.length > toca.length });
    }
    if (url.pathname === "/od/mod/jsonleer") {
      const mod = String(b.mod || ""), m = MODS[mod]; if (!m || !m.archivo) return json({ error: "Módulo no válido." }, 400);
      const no = await negar(mod, m.archivo); if (no) return no;
      const r0 = await graphApp(env, `/drives/${d}/items/${m.datos}:/${encodeURIComponent(m.archivo)}?$select=id,eTag`);
      if (r0.status === 404) return json({ error: "No está.", status: 404 }, 404);
      if (!r0.ok) return json({ error: `No se pudo leer ${m.archivo} (${r0.status}).`, status: r0.status }, 502);
      const x = await r0.json(); if (b.soloMeta) return json({ ok: true, eTag: x.eTag });
      const rc = await graphApp(env, `/drives/${d}/items/${x.id}/content`); if (!rc.ok) return json({ error: `No se pudo leer ${m.archivo} (${rc.status}).`, status: rc.status }, 502);
      return json({ ok: true, eTag: x.eTag, datos: await rc.json() });
    }
    if (url.pathname === "/od/mod/info") {
      const mod = String(b.mod || ""), m = MODS[mod], ruta = b.ruta || [], arch = String(b.nombre || ""), tipo = m && m.tipos ? String(b.tipo || "visitas") : "";
      if (!m || (m.tipos && !m.tipos[tipo]) || !Array.isArray(ruta) || ruta.length > (m.prof || 0) + 1 || !ruta.every(RUTA_OK) || !RUTA_OK(arch)) return json({ error: "Archivo no válido." }, 400);
      const no = await negar(mod, ruta.concat([arch]).join("/")); if (no) return no;
      let p = await raizMod(env, mod, tipo);
      for (const sg of ruta) { const q = await graphApp(env, `/drives/${d}/items/${p}:/${encodeURIComponent(sg)}?$select=id`); if (q.status === 404) return json({ error: "No está.", status: 404 }, 404); if (!q.ok) return json({ error: `No se pudo leer (${q.status}).` }, 502); p = (await q.json()).id; }
      const q = await graphApp(env, `/drives/${d}/items/${p}:/${encodeURIComponent(arch)}?$select=id,eTag,webUrl`);
      if (q.status === 404) return json({ error: "No está.", status: 404 }, 404);
      if (!q.ok) return json({ error: `No se pudo leer (${q.status}).` }, 502);
      const x = await q.json(); return json({ ok: true, id: x.id, eTag: x.eTag, webUrl: x.webUrl });
    }
    if (url.pathname === "/od/mod/archivo") {
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      const u = await ubicar(env, id); if (!u) return json({ error: "No está.", status: 404 }, 404);
      if (!u.mod || u.it.folder) return json({ error: "No es un archivo de un módulo.", status: 403 }, 403);
      const no = await negar(u.mod, u.segs.concat([u.it.name]).join("/")); if (no) return no;
      const r = await graphApp(env, `/drives/${d}/items/${id}/content`);
      if (r.status === 404) return json({ error: "No está.", status: 404 }, 404);
      if (!r.ok) return json({ error: `No se pudo leer el archivo (${r.status}).`, status: r.status }, 502);
      return crudo(r.body, { "Content-Type": r.headers.get("Content-Type") || "application/octet-stream", "Cache-Control": "private, max-age=0", "X-WebUrl": encodeURI(u.it.webUrl || ""), "X-ETag": u.it.eTag || "" });
    }
    if (url.pathname === "/od/mod/meta") { /* v216 */
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      const u = await ubicar(env, id); if (!u) return json({ error: "No está.", status: 404 }, 404);
      if (!u.mod || u.it.folder) return json({ error: "No es un archivo de un módulo.", status: 403 }, 403);
      const no = await negar(u.mod, u.segs.concat([u.it.name]).join("/")); if (no) return no;
      return json({ ok: true, webUrl: u.it.webUrl || "", eTag: u.it.eTag || "" });
    }
    if (url.pathname === "/od/mod/mover") { /* v216: «Ordenar fotos antiguas» (administrador) */
      if (!quien.admin) return json({ error: "Solo el administrador ordena las fotos antiguas.", status: 403 }, 403);
      const id = String(b.id || ""), ruta = b.ruta || [], arch = String(b.nombre || "");
      if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      const v = revisarArchivo("ax", ruta, arch); if (v || ruta[0] === MODS.ax.legado) return json({ error: (v && v.error) || "Carpeta no válida." }, 400);
      const u = await ubicar(env, id); if (!u) return json({ error: "No está.", status: 404 }, 404);
      if (u.mod !== "ax" || u.segs.length !== 1 || u.segs[0] !== MODS.ax.legado || u.it.folder) return json({ error: "Solo se ordenan fotos de la carpeta antigua de Actas." }, 400);
      const destino = await carpetaMod(env, "ax", ruta, "");
      const r = await graphApp(env, `/drives/${d}/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentReference: { id: destino }, name: arch }) });
      if (!r.ok) return json({ error: `OneDrive no movió la foto (${r.status}).`, status: r.status }, r.status === 409 ? 409 : 502);
      const x = await r.json(); return json({ ok: true, id: x.id, webUrl: x.webUrl || "" });
    }
    if (url.pathname === "/od/reg") {
      const mod = MOD_DE_COL[String(b.col || "")], op = b.op, id = String(b.id || "");
      if (!mod) return json({ error: "Colección no válida." }, 400);
      if (!ID_OK.test(id)) return json({ error: "Id de registro no válido." }, 400);
      const datos = await carpetaDatosMod(env, mod), ruta = `/drives/${d}/items/${datos}:/${encodeURIComponent(id + ".json")}`;
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${b.col}:${op}`, id, correo, reglas: revisarMod(P, mod, correos, quien) }); if (no) return no;
      if (op === "conflicto") {
        const nombre = String(b.nombre || "").replace(/[\\/:*?"<>|#%]/g, "-").slice(0, 120);
        if (!nombre.startsWith(id + " ") || !nombre.endsWith(".json")) return json({ error: "Nombre de copia no válido." }, 400);
        const conf = await idHijo(env, datos, "_conflictos", true);
        const cuerpo = JSON.stringify({ guardado: new Date().toISOString(), por: b.por || null, cuenta: correo, motivo: String(b.motivo || "").slice(0, 200), campos: Array.isArray(b.campos) ? b.campos.slice(0, 200) : [], version: b.version || null });
        const r = await graphApp(env, `/drives/${d}/items/${conf}:/${encodeURIComponent(nombre)}:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: cuerpo });
        if (!r.ok) return json({ error: `OneDrive no guardó la copia (${r.status}).`, status: r.status }, 502);
        return json({ ok: true });
      }
      if (op !== "put" && op !== "delete") return json({ error: "Operación desconocida." }, 400);
      const h = {}; if (b.ifMatch) h["If-Match"] = b.ifMatch;
      if (op === "delete") {
        const r = await graphApp(env, ruta, { method: "DELETE", headers: h });
        if (r.status === 412) return json({ error: "El registro cambió en OneDrive.", status: 412 }, 412);
        if (!r.ok && r.status !== 404) return json({ error: `OneDrive no eliminó el registro (${r.status}).`, status: r.status }, 502);
        return json({ ok: true });
      }
      if (!b.datos || typeof b.datos !== "object" || Array.isArray(b.datos)) return json({ error: "Faltan los datos del registro." }, 400);
      h["Content-Type"] = "application/json";
      const r = await graphApp(env, ruta + ":/content", { method: "PUT", headers: h, body: JSON.stringify(b.datos) });
      if (r.status === 412) return json({ error: "El registro cambió en OneDrive.", status: 412 }, 412);
      if (r.status === 404 && b.ifMatch) return json({ error: "El registro ya no está en OneDrive.", status: 404 }, 404);
      if (!r.ok) { if (r.status === 404) odOlvidarPermisos(); return json({ error: `OneDrive no guardó el registro (${r.status}).`, status: r.status }, 502); }
      const it = await r.json(); return json({ ok: true, eTag: it.eTag, id: it.id });
    }
    if (url.pathname === "/od/mod/subida") {
      const mod = String(b.mod || ""), ruta = b.ruta || [], arch = String(b.nombre || ""), tipo = MODS[mod] && MODS[mod].tipos ? String(b.tipo || "visitas") : "";
      const v = revisarArchivo(mod, ruta, arch, tipo); if (v && v.error) return json({ error: v.error }, 400);
      const reglas = v && v.especial && v.especial.soloAdmin ? (quien.admin ? [] : [v.especial.soloAdmin]) : revisarMod(P, mod, correos, quien);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${mod}:subida`, id: (tipo ? [tipo] : []).concat(ruta, [arch]).join("/"), correo, reglas }); if (no) return no;
      const carpeta = await carpetaMod(env, mod, ruta, tipo);
      const r = await graphApp(env, `/drives/${d}/items/${carpeta}:/${encodeURIComponent(arch)}:/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) });
      if (!r.ok) { if (r.status === 404) odOlvidarPermisos(); return json({ error: `OneDrive no abrió la carga (${r.status}).`, status: r.status }, 502); }
      const s = await r.json(); return json({ ok: true, uploadUrl: s.uploadUrl, vence: s.expirationDateTime });
    }
    if (url.pathname === "/od/mod/json") {
      const mod = String(b.mod || ""), m = MODS[mod];
      if (!m || !m.archivo) return json({ error: "Módulo no válido." }, 400);
      if (!b.datos || typeof b.datos !== "object" || Array.isArray(b.datos)) return json({ error: "Faltan los datos." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${mod}:json`, id: m.archivo, correo, reglas: revisarMod(P, mod, correos, quien) }); if (no) return no;
      const h = { "Content-Type": "application/json" }; if (b.ifMatch) h["If-Match"] = b.ifMatch;
      const r = await graphApp(env, `/drives/${d}/items/${m.datos}:/${encodeURIComponent(m.archivo)}:/content`, { method: "PUT", headers: h, body: JSON.stringify(b.datos) });
      if (r.status === 412) return json({ error: "El archivo cambió en OneDrive.", status: 412 }, 412);
      if (!r.ok) return json({ error: `OneDrive no guardó ${m.archivo} (${r.status}).`, status: r.status }, 502);
      return json({ ok: true, eTag: (await r.json()).eTag });
    }
    if (url.pathname === "/od/permisos") { /* v214: «Permisos por persona» (Apps de terreno/_config/Permisos_app.json) */
      const x = b.datos; if (!x || typeof x !== "object" || Array.isArray(x) || !x.personas || typeof x.personas !== "object") return json({ error: "Faltan los permisos." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "permisos", id: "Permisos_app.json", correo, reglas: quien.admin ? [] : ["los permisos los cambia solo el administrador"] }); if (no) return no;
      const conf = await idHijo(env, c.raiz, "_config", true);
      const r = await graphApp(env, `/drives/${d}/items/${conf}:/Permisos_app.json:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x, null, 1) });
      if (!r.ok) return json({ error: `OneDrive no guardó los permisos (${r.status}).`, status: r.status }, 502);
      PERM = null; PERM_T = 0; return json({ ok: true, eTag: (await r.json()).eTag });
    }
    if (url.pathname === "/od/mod/borrar") {
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      let r = await graphApp(env, `/drives/${d}/items/${id}?$select=id,name,parentReference,folder`);
      if (r.status === 404) return json({ ok: true, yaNoEstaba: true });
      if (!r.ok) return json({ error: `No se pudo leer el archivo (${r.status}).`, status: r.status }, 502);
      const it = await r.json();
      /* sube por las carpetas, por id, hasta la raíz de un módulo (como máximo 6 niveles); en Check list, la de cada tipo */
      const raices = {};
      for (const [k, m] of Object.entries(MODS)) {
        if (!m.tipos) { raices[m.root] = [k, ""]; continue; }
        for (const t of Object.keys(m.tipos)) { try { raices[await raizMod(env, k, t, false)] = [k, t]; } catch (e) {} }
      }
      let mod = null, tipo = "", pid = (it.parentReference || {}).id, segs = [];
      for (let i = 0; i < 7 && pid && !mod; i++) {
        if (raices[pid]) { [mod, tipo] = raices[pid]; break; }
        const q = await graphApp(env, `/drives/${d}/items/${pid}?$select=id,name,parentReference`); if (!q.ok) break;
        const p = await q.json(); segs.unshift(p.name); pid = (p.parentReference || {}).id;
      }
      if (it.folder || !mod || segs.some(s => String(s).startsWith("_")) || revisarArchivo(mod, segs, it.name, tipo, { legado: true })) return json({ error: "Solo se eliminan fotos o archivos de un módulo." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${mod}:borrar`, id: segs.concat([it.name]).join("/"), correo, reglas: revisarMod(P, mod, correos, quien) }); if (no) return no;
      r = await graphApp(env, `/drives/${d}/items/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) return json({ error: `OneDrive no eliminó el archivo (${r.status}).`, status: r.status }, 502);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: (e && e.error) || "Error al guardar en OneDrive.", status: (e && e.status) || 502 }, (e && e.status) || 502);
  }
  return null;
}
