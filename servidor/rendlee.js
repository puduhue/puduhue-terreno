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
  «rl:idx» (por rendición: eTag, cuenta, correo y RUT de la persona, jefatura y las fotos/PDF «a:») y «rl:d:<id>» (la rendición).
  En cada /od/rend/bajar lista _datos (solo nombres y eTag) y vuelve a leer solo las que cambiaron.
  Interruptor: OD_LEE = "no" → /yo dice odLee: false y la app vuelve a leer directo (para quien tenga acceso a la carpeta).
*/
import { odConfig, graphApp } from "./onedrive.js";
import { odRendActivo, maestrosSrv, correosDueno, carpetaDatos, idHijo, correosDe, RD_ROOT } from "./rendod.js";

export const odLeeActivo = env => odRendActivo(env) && String(env.OD_LEE || "").toLowerCase() !== "no";
const ID_OK = /^[A-Za-z0-9_-]{4,80}$/;

/* lo que el índice guarda de cada rendición (lo justo para saber quién la ve y qué archivos tiene) */
export function metaDe(r, eTag) {
  const p = (r && r.persona) || {}, f = [];
  Object.values((r && r.docs) || {}).forEach(d => { [d && d.foto, d && d.pdf].forEach(x => { if (/^a:/.test(String(x || ""))) f.push(String(x).slice(2)); }); });
  return { e: eTag, c: String((r && r.cuenta) || "").toLowerCase(), pc: String(p.correo || "").toLowerCase(), rut: p.rut || "", j: String(((r && r.jefatura) || {}).correo || "").toLowerCase(), f };
}
export function puedeVer(M, m, quien) {
  if (quien.admin || quien.contab) return true;
  if (!m) return false;
  if (m.j && m.j === quien.correo) return true;
  return correosDueno(M, { cuenta: m.c, persona: { correo: m.pc, rut: m.rut } }).includes(quien.correo);
}
async function enParalelo(L, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, L.length) }, async () => { while (i < L.length) { const x = L[i++]; await fn(x); } })); }

/* lista _datos, actualiza el índice con lo que cambió y devuelve { idx, frescos } */
export async function indiceAlDia(env, avisos) {
  const c = odConfig(env), d = encodeURIComponent(c.drive), datos = await carpetaDatos(env);
  const vistos = {}; let url = `/drives/${d}/items/${datos}/children?$select=id,name,eTag&$top=999`;
  while (url) {
    const r = await graphApp(env, url); if (!r.ok) throw { status: 502, error: `No se pudo listar las rendiciones (${r.status}).` };
    const j = await r.json(); (j.value || []).forEach(it => { if (/\.json$/i.test(it.name || "")) vistos[it.name.replace(/\.json$/i, "")] = it; });
    url = j["@odata.nextLink"] || null;
  }
  const idx = (await avisos.odIdx()) || {}, frescos = {}, cambios = {};
  const leer = Object.keys(vistos).filter(id => !idx[id] || idx[id].e !== vistos[id].eTag);
  await enParalelo(leer, 6, async id => {
    const r = await graphApp(env, `/drives/${d}/items/${vistos[id].id}/content`); if (!r.ok) return;
    let x = null; try { x = await r.json(); } catch (e) { return; }
    idx[id] = metaDe(x, vistos[id].eTag); frescos[id] = x; cambios[id] = x;
  });
  Object.keys(idx).forEach(id => { if (!vistos[id]) { delete idx[id]; cambios[id] = null; } });
  if (Object.keys(cambios).length) await avisos.odIdxCambiar(idx, cambios);
  return { idx, frescos };
}

export async function rutasLectura(req, env, ctx, url, { correo, json, crudo, autorizado, esContab, avisos }) {
  const rutas = ["/od/rend/bajar", "/od/rend/leer", "/od/maestros/leer", "/od/permisos/leer", "/od/archivo"];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!odLeeActivo(env) || !avisos) return json({ error: "El servidor no está leyendo rendiciones.", status: 503 }, 503);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const c = odConfig(env), d = encodeURIComponent(c.drive), quien = { correo, admin: autorizado, contab: await esContab() };
  try {
    if (url.pathname === "/od/rend/bajar") {
      const { idx, frescos } = await indiceAlDia(env, avisos), M = await maestrosSrv(env), con = (b && b.conocidos) || {};
      const vis = Object.keys(idx).filter(id => puedeVer(M, idx[id], quien));
      const faltan = vis.filter(id => con[id] !== idx[id].e), guardados = faltan.filter(id => !frescos[id]);
      const otros = guardados.length ? await avisos.odDatos(guardados) : {};
      const datos = {}; faltan.forEach(id => { const x = frescos[id] || otros[id]; if (x) datos[id] = x; });
      return json({ ok: true, lista: vis.map(id => [id, idx[id].e]), datos });
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
        const idx = (await avisos.odIdx()) || {}, M = await maestrosSrv(env);
        const ok = Object.values(idx).some(m => (m.f || []).includes(id) && puedeVer(M, m, quien));
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
