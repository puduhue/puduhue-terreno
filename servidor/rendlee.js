/*
  Rendiciones: el servidor también LEE por las personas (v196, opción B / etapa 4 del plan; docs/plan_servidor_onedrive.md).
  ---------------------------------------------------------------------------------------------------------------------
  Así nadie necesita acceso a la carpeta Rendiciones en OneDrive (ni a _config) para usar Rendiciones, y cada persona ve
  solo lo suyo:
    - quien rinde: sus rendiciones (su cuenta, el correo de la persona o los correos de su ficha por RUT);
    - la jefatura: las que tiene asignadas (jefatura.correo de la rendición);
    - Contabilidad y el administrador: todas.
  Rutas (POST, cualquier cuenta de Puduhue):
    /od/rend/bajar   { conocidos: { id: eTag } }  → { lista: [[id, eTag]…] (las que puede ver), datos: { id: rendición } (las nuevas o cambiadas) }
    /od/rend/leer    { id }                        → { eTag, datos } (para combinar antes de subir); 404 si no está; 403 si no es suya
    /od/maestros/leer { etag }                     → { igual: true } o { eTag, datos } (maestros.json)
    /od/permisos/leer {}                           → { eTag, datos } con solo lo de quien pide (el administrador, todo); { vacio: true } si no hay
    /od/archivo      { id }                        → los bytes de una foto o PDF de una rendición que puede ver
  Para no leer todas las rendiciones de OneDrive en cada pedido, el servidor guarda una copia en el Durable Object (AVISOS):
  desde la v197, un registro de cambios numerado (rl:m:, rl:d:, rl:s:, rl:seq en push.js): cada escritura por /od/rend lo
  actualiza al instante y /od/rend/cambios {cursor} devuelve solo lo cambiado desde ese número, de a 300 (como las apps grandes).
  Cada 2 minutos como máximo se compara con OneDrive (conciliar) por si alguien cambió algo directo allá.
  Interruptor: OD_LEE = "no" → /yo dice odLee: false y la app vuelve a leer directo (para quien tenga acceso a la carpeta).
*/
import { odConfig, graphApp } from "./onedrive.js";
import { odRendActivo, maestrosSrv, correosDueno, carpetaDatos, idHijo, correosDe, RD_ROOT, metaDe } from "./rendod.js";
export { metaDe };

export const odLeeActivo = env => odRendActivo(env) && String(env.OD_LEE || "").toLowerCase() !== "no";
const ID_OK = /^[A-Za-z0-9_-]{4,80}$/;

export function puedeVer(M, m, quien) {
  if (quien.admin || quien.contab) return true;
  if (!m) return false;
  if (m.j && m.j === quien.correo) return true;
  return correosDueno(M, { cuenta: m.c, persona: { correo: m.pc, rut: m.rut } }).includes(quien.correo);
}
async function enParalelo(L, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, L.length) }, async () => { while (i < L.length) { const x = L[i++]; await fn(x); } })); }

/* v197: compara OneDrive con el registro de cambios (por si alguien cambió algo directo en OneDrive: Contabilidad o el
   administrador, o un teléfono con una versión anterior) y le da un número nuevo a lo que cambió. Como máximo cada 2 minutos. */
export const CADA_CONCILIAR = 120000;
export async function conciliar(env, avisos, forzar = false, ahora = Date.now()) {
  const est = await avisos.rlEstado(); if (!forzar && ahora - est.lista < CADA_CONCILIAR) return { saltado: true };
  const c = odConfig(env), d = encodeURIComponent(c.drive), datos = await carpetaDatos(env);
  const vistos = {}; let url = `/drives/${d}/items/${datos}/children?$select=id,name,eTag&$top=999`;
  while (url) {
    const r = await graphApp(env, url); if (!r.ok) throw { status: 502, error: `No se pudo listar las rendiciones (${r.status}).` };
    const j = await r.json(); (j.value || []).forEach(it => { if (/\.json$/i.test(it.name || "")) vistos[it.name.replace(/\.json$/i, "")] = it; });
    url = j["@odata.nextLink"] || null;
  }
  const metas = await avisos.rlMetas(), cambios = {};
  const leer = Object.keys(vistos).filter(id => !metas[id] || metas[id].borrado || metas[id].e !== vistos[id].eTag);
  await enParalelo(leer, 6, async id => {
    const r = await graphApp(env, `/drives/${d}/items/${vistos[id].id}/content`); if (!r.ok) return;
    let x = null; try { x = await r.json(); } catch (e) { return; }
    cambios[id] = { meta: metaDe(x, vistos[id].eTag), data: x };
  });
  Object.keys(metas).forEach(id => { if (!vistos[id] && !metas[id].borrado) cambios[id] = null; });
  if (Object.keys(cambios).length) await avisos.rlAplicar(cambios);
  await avisos.rlListado(ahora);
  return { cambios: Object.keys(cambios).length };
}
/* versión de la lista de colaboradores (si cambia, quién ve qué puede cambiar: el teléfono vuelve a bajar todo lo suyo) */
const VV = new WeakMap();
export function versionVis(M) { if (!M) return "0"; if (VV.has(M)) return VV.get(M); const t = JSON.stringify([M.colab || [], M.aprob || []]); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; const v = (h >>> 0).toString(36); VV.set(M, v); return v; }
export const PAGINA = 300;

export async function rutasLectura(req, env, ctx, url, { correo, json, crudo, autorizado, esContab, avisos }) {
  const rutas = ["/od/rend/bajar", "/od/rend/cambios", "/od/rend/leer", "/od/maestros/leer", "/od/permisos/leer", "/od/archivo", "/sync/medida", "/od/medidas"];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method !== "POST" && !(url.pathname === "/od/medidas" && req.method === "GET")) return json({ error: "Usa POST." }, 405);
  if (!odLeeActivo(env) || !avisos) return json({ error: "El servidor no está leyendo rendiciones.", status: 503 }, 503);
  let b = {}; if (req.method === "POST") try { b = await req.json(); } catch (e) {}
  const c = odConfig(env), d = encodeURIComponent(c.drive), quien = { correo, admin: autorizado, contab: await esContab() };
  try {
    if (url.pathname === "/od/rend/bajar") { /* v196 (lo usan los teléfonos que no tienen la v197): todo lo visible, con eTag */
      await conciliar(env, avisos);
      const metas = await avisos.rlMetas(), M = await maestrosSrv(env), con = (b && b.conocidos) || {};
      const vis = Object.keys(metas).filter(id => !metas[id].borrado && puedeVer(M, metas[id], quien));
      const faltan = vis.filter(id => con[id] !== metas[id].e), datos = faltan.length ? await avisos.odDatos(faltan) : {};
      return json({ ok: true, lista: vis.map(id => [id, metas[id].e]), datos });
    }
    if (url.pathname === "/od/rend/cambios") { /* v197: solo lo que cambió desde el cursor, de a PAGINA */
      await conciliar(env, avisos);
      const M = await maestrosSrv(env), v = versionVis(M), [cs, cv] = String((b && b.cursor) || "").split(":");
      const desde = cv === v && /^\d+$/.test(cs || "") ? +cs : 0;
      const pg = await avisos.rlDesde(desde, PAGINA), ver = [], fuera = [];
      for (const x of pg.lista) { if (!x.m || x.m.borrado || !puedeVer(M, x.m, quien)) { if (desde) fuera.push(x.id); } else ver.push([x.id, x.m.e]); }
      const datos = ver.length ? await avisos.odDatos(ver.map(x => x[0])) : {};
      const ultimo = pg.lista.length ? pg.lista[pg.lista.length - 1].s : (pg.mas ? desde : Math.max(desde, pg.seq));
      return json({ ok: true, completo: !desde, cambios: ver.filter(x => datos[x[0]]).map(x => [x[0], x[1], datos[x[0]]]), fuera, cursor: `${ultimo}:${v}`, mas: pg.mas });
    }
    if (url.pathname === "/sync/medida") { /* v197: cuánto tardó la sincronización en este teléfono */
      const n = x => Math.max(0, Math.min(600000, Math.round(+x || 0)));
      const partes = {}; Object.entries((b && b.partes) || {}).slice(0, 20).forEach(([k, x]) => { if (/^[a-z]{2,20}$/i.test(k)) partes[k] = n(x); });
      ctx.waitUntil(avisos.syncMedir({ hora: new Date().toISOString(), correo, ver: String((b && b.ver) || "").slice(0, 10), total: n(b && b.total), partes, cambios: n(b && b.cambios) }).catch(() => {}));
      return json({ ok: true });
    }
    if (url.pathname === "/od/medidas") { /* v197: resumen para el administrador */
      if (!quien.admin) return json({ error: "Solo el administrador." }, 403);
      const L = await avisos.syncMedidas(), med = a => { const x = a.filter(y => y >= 0).sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : null; }, p90 = a => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.min(x.length - 1, Math.floor(x.length * 0.9))] : null; };
      const partes = {}; L.forEach(m => Object.entries(m.partes || {}).forEach(([k, x]) => (partes[k] = partes[k] || []).push(x)));
      return json({ ok: true, total: L.length, mediana: med(L.map(m => m.total)), p90: p90(L.map(m => m.total)), partes: Object.fromEntries(Object.entries(partes).map(([k, a]) => [k, med(a)])), ultimas: L.slice(-20).reverse() });
    }
    if (url.pathname === "/od/rend/leer") {
      const id = String(b.id || ""); if (!ID_OK.test(id)) return json({ error: "Id no válido." }, 400);
      const ruta = `/drives/${d}/items/${await carpetaDatos(env)}:/${encodeURIComponent(id + ".json")}`;
      const r0 = await graphApp(env, ruta + "?$select=id,eTag");
      if (r0.status === 404) return json({ error: "No está.", status: 404 }, 404);
      if (!r0.ok) return json({ error: `No se pudo leer la rendición (${r0.status}).`, status: r0.status }, 502);
      const m = await r0.json(), rc = await graphApp(env, `/drives/${d}/items/${m.id}/content`);
      if (!rc.ok) return json({ error: `No se pudo leer la rendición (${rc.status}).`, status: rc.status }, 502);
      const x = await rc.json();
      if (!puedeVer(await maestrosSrv(env), metaDe(x, m.eTag), quien)) return json({ error: "No es una rendición tuya.", status: 403 }, 403);
      return json({ ok: true, eTag: m.eTag, datos: x });
    }
    if (url.pathname === "/od/maestros/leer") {
      const ruta = `/drives/${d}/items/${await carpetaRdMae(env)}:/maestros.json`;
      const r0 = await graphApp(env, ruta + "?$select=id,eTag");
      if (r0.status === 404) return json({ ok: true, vacio: true });
      if (!r0.ok) return json({ error: `No se pudo leer la lista de colaboradores (${r0.status}).`, status: r0.status }, 502);
      const m = await r0.json(); if (b.etag && b.etag === m.eTag) return json({ ok: true, igual: true, eTag: m.eTag });
      const rc = await graphApp(env, `/drives/${d}/items/${m.id}/content`); if (!rc.ok) return json({ error: `No se pudo leer la lista de colaboradores (${rc.status}).` }, 502);
      return json({ ok: true, eTag: m.eTag, datos: await rc.json() });
    }
    if (url.pathname === "/od/permisos/leer") {
      let conf; try { conf = await idHijo(env, c.raiz, "_config", false); } catch (e) { return json({ ok: true, vacio: true }); }
      const r0 = await graphApp(env, `/drives/${d}/items/${conf}:/Permisos_app.json?$select=id,eTag`);
      if (r0.status === 404) return json({ ok: true, vacio: true });
      if (!r0.ok) return json({ error: `No se pudieron leer los permisos (${r0.status}).` }, 502);
      const m = await r0.json(), rc = await graphApp(env, `/drives/${d}/items/${m.id}/content`); if (!rc.ok) return json({ error: "No se pudieron leer los permisos." }, 502);
      const x = await rc.json(); if (!x || typeof x.personas !== "object") return json({ ok: true, vacio: true });
      if (!quien.admin) { /* solo lo de quien pide: su correo y los de su ficha de colaborador */
        let mios = [correo]; try { const M = await maestrosSrv(env); (M.colab || []).filter(k => k && k.activo !== false && correosDe(k).includes(correo)).forEach(k => correosDe(k).forEach(y => { if (!mios.includes(y)) mios.push(y); })); } catch (e) {}
        const p = {}; mios.forEach(k => { if (x.personas[k]) p[k] = x.personas[k]; });
        return json({ ok: true, eTag: m.eTag, datos: { personas: p, nombres: {}, actualizado: x.actualizado || "", por: x.por || "" } });
      }
      return json({ ok: true, eTag: m.eTag, datos: x });
    }
    if (url.pathname === "/od/archivo") {
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      if (!quien.admin && !quien.contab) {
        const metas = await avisos.rlMetas(), M = await maestrosSrv(env);
        const ok = Object.values(metas).some(m => !m.borrado && (m.f || []).includes(id) && puedeVer(M, m, quien));
        if (!ok) return json({ error: "No es un archivo de una rendición tuya.", status: 403 }, 403);
      }
      const r = await graphApp(env, `/drives/${d}/items/${id}/content`);
      if (r.status === 404) return json({ error: "No está.", status: 404 }, 404);
      if (!r.ok) return json({ error: `No se pudo leer el archivo (${r.status}).`, status: r.status }, 502);
      return crudo(r.body, { "Content-Type": r.headers.get("Content-Type") || "application/octet-stream", "Cache-Control": "private, max-age=0" });
    }
  } catch (e) {
    return json({ error: (e && e.error) || "Error al leer de OneDrive.", status: (e && e.status) || 502 }, (e && e.status) || 502);
  }
}
let MAE_DIR = null;
async function carpetaRdMae(env) { return MAE_DIR || (MAE_DIR = await idHijo(env, RD_ROOT, "_maestros", false)); }
