/*
  v212: los demás módulos también guardan por el servidor (plan «que solo el servidor escriba», etapa 3; Benja la sumó el
  19-11-2026, junto con la etapa 4, para que al final la app no necesite el permiso Files.ReadWrite.All). Primero Stock y
  Control de bodega; Check list y Actas se suman después en MODS, con las mismas rutas.
  ----------------------------------------------------------------------------------------------------------------------------
  Igual que Rendiciones (rendod.js): la app combina en el teléfono (eTag, If-Match) y el servidor revisa quién pide y escribe con
  su credencial. Las reglas siguen OD_MODO («aviso»: anota y deja pasar; «bloquear»: 403); lo que está fuera del módulo (rutas,
  nombres o tipos de archivo) se rechaza siempre (400).
    POST /od/reg        { col, op: put|delete|conflicto, id, datos, ifMatch, nombre... } → { ok, eTag }   (un registro de _datos)
    POST /od/mod/subida { mod, ruta: [carpetas desde la raíz del módulo], nombre }     → { ok, uploadUrl } (sesión de carga)
    POST /od/mod/json   { mod, datos, ifMatch }                                         → { ok, eTag }   (stock.json)
    POST /od/mod/borrar { id }                                                          → { ok }         (una foto o archivo de un módulo)
  Quién puede: el administrador, todo. Los demás, según «Permisos por persona» (Apps de terreno/_config/Permisos_app.json, que
  el servidor lee con su credencial, como la app: por correo y, si no está, por los otros correos de su ficha de colaborador):
  «agregar» guarda; «ver» o «no», no. En Stock (solo se ve) basta con no tener «no». Interruptor: OD_MODS = "no" → /yo dice
  odMods: false y la app vuelve a escribir directo.
*/
import { odConfig, graphApp } from "./onedrive.js";
import { idHijo, odRendActivo, odModo, anotarAviso, maestrosSrv, correosDe } from "./rendod.js";

export const MODS = {
  cb: { nombre: "Control de bodega", col: "conteos", root: "01RAJ2KQFXDFLPDNY2IJCIZ3BGSVPF74IH", ext: /\.(jpe?g|png|webp|heic|pdf|xlsx)$/i, prof: 3 },
  stock: { nombre: "Stock", root: "01RAJ2KQF2KBOXTJBS5VAJHLQZVCLBOCZ6", datos: "01RAJ2KQEA4AYAJGRSLVBI4JELXKHFCDUH", archivo: "stock.json", soloVer: true, ext: /^Stock_Finnegans\.xlsx$/, prof: 0 },
};
const MOD_DE_COL = Object.fromEntries(Object.entries(MODS).filter(([, m]) => m.col).map(([k, m]) => [m.col, k]));
export const odModsActivo = env => odRendActivo(env) && String(env.OD_MODS || "").toLowerCase() !== "no";
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
/* qué archivo es: { error } (400) o null */
export function revisarArchivo(mod, ruta, nombre) {
  const m = MODS[mod]; if (!m) return { error: "Módulo no válido." };
  if (!Array.isArray(ruta) || ruta.length > m.prof || !ruta.every(RUTA_OK)) return { error: "Carpeta no válida." };
  if (!RUTA_OK(nombre) || nombre.length > 150 || nombre.toLowerCase().endsWith(".json")) return { error: "Nombre de archivo no válido." };
  if (!m.ext.test(nombre)) return { error: "Tipo de archivo no permitido en este módulo." };
  if (ruta[0] && ruta[0].startsWith("_")) return { error: "Carpeta no válida." };
  return null;
}

/* ---------- carpetas ---------- */
const CARP = {}; let DATOS = {};
async function carpetaMod(env, mod, segs) {
  let p = MODS[mod].root, k = mod;
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

export async function rutasModulos(req, env, ctx, url, { correo, json, autorizado, avisos }) {
  const rutas = ["/od/reg", "/od/mod/subida", "/od/mod/json", "/od/mod/borrar"];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!odModsActivo(env)) return json({ error: "El servidor no está guardando en OneDrive (falta la clave o está apagado).", status: 503 }, 503);
  let b; try { b = await req.json(); } catch (e) { return json({ error: "Pedido sin JSON." }, 400); }
  const c = odConfig(env), d = encodeURIComponent(c.drive), quien = { correo, admin: autorizado };
  try {
    const P = await permisosSrv(env), correos = await correosDeQuien(env, correo);
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
      const mod = String(b.mod || ""), ruta = b.ruta || [], arch = String(b.nombre || "");
      const v = revisarArchivo(mod, ruta, arch); if (v) return json({ error: v.error }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: `${mod}:subida`, id: ruta.concat([arch]).join("/"), correo, reglas: revisarMod(P, mod, correos, quien) }); if (no) return no;
      const carpeta = await carpetaMod(env, mod, ruta);
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
    if (url.pathname === "/od/mod/borrar") {
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      let r = await graphApp(env, `/drives/${d}/items/${id}?$select=id,name,parentReference,folder`);
      if (r.status === 404) return json({ ok: true, yaNoEstaba: true });
      if (!r.ok) return json({ error: `No se pudo leer el archivo (${r.status}).`, status: r.status }, 502);
      const it = await r.json();
      /* sube por las carpetas, por id, hasta la raíz de un módulo (como máximo 4 niveles) */
      const raices = Object.fromEntries(Object.entries(MODS).map(([k, m]) => [m.root, k]));
      let mod = null, pid = (it.parentReference || {}).id, segs = [];
      for (let i = 0; i < 5 && pid && !mod; i++) {
        if (raices[pid]) { mod = raices[pid]; break; }
        const q = await graphApp(env, `/drives/${d}/items/${pid}?$select=id,name,parentReference`); if (!q.ok) break;
        const p = await q.json(); segs.unshift(p.name); pid = (p.parentReference || {}).id;
      }
      if (it.folder || !mod || segs.some(s => String(s).startsWith("_")) || revisarArchivo(mod, segs, it.name)) return json({ error: "Solo se eliminan fotos o archivos de un módulo." }, 400);
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
