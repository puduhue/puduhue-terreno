/*
  Puduhue Terreno · servidor pequeño (Cloudflare Worker)
  ------------------------------------------------------
  Qué hace: recibe pedidos desde la app, verifica que quien pide tenga sesión Microsoft de
  Puduhue, pide la clave (token) a Finnegans con las credenciales guardadas aquí y consulta
  el reporte. Las credenciales nunca viajan al teléfono.

  Publicación: este archivo vive en el repositorio actas-vivienda (carpeta servidor) y se publica solo en Cloudflare
  con GitHub Actions al subir cambios. Las variables y claves de abajo se quedan en Cloudflare (no están en el código).

  Variables en Cloudflare (Settings → Variables and Secrets, entorno Production):
    FINN_CLIENT_ID      (Secret)  client_id de Finnegans
    FINN_CLIENT_SECRET  (Secret)  client_secret de Finnegans
    FINN_REPORTE_STOCK  (texto)   nombre del reporte de stock: resumenStockPorDeposito
    FINN_PARAMS_STOCK   (texto)   opcional. Parámetros fijos del reporte de stock; si no se define se usan los de abajo
    FINN_REPORTES       (texto)   otros reportes que la app puede consultar, separados por coma (ej.: HACREPORTELECHE)
    CORREOS_ACTUALIZAR  (texto)   correos autorizados a usar /reporte (pantalla de prueba de Finnegans) y a cambiar
                                  parámetros del stock, separados por coma (el correo del administrador). Si queda vacía, nadie
                                  (desde la app v132; antes, todos).
                                  El stock (/stock) lo puede traer cualquier cuenta de Puduhue (desde la app v61).
    ANTHROPIC_API_KEY   (Secret)  clave de la API de Claude, para leer boletas (módulo Rendiciones)
    MODELO_LECTURA      (texto)   opcional. Modelo de la primera lectura. Por defecto claude-haiku-5-5 (desde la v98)
    MODELO_REVISION     (texto)   opcional. Modelo que revisa las lecturas dudosas. Por defecto claude-sonnet-5-5; "no" la desactiva
                                  (ANTHROPIC_MODEL ya no se usa: se puede borrar)
    ORIGEN_APP          (texto)   opcional. Direcciones adicionales desde donde se puede usar el servidor, separadas por coma.
                                  Siempre se aceptan https://puduhue.github.io (app en la organización Puduhue, desde la v85)
                                  y https://benjaminbarrientoscardenas-glitch.github.io (dirección anterior, durante la mudanza).
    DOMINIO             (texto)   opcional. Por defecto puduhue.cl
    CORREOS_CONTAB      (texto)   desde la v138: correos de Contabilidad, separados por coma (antes estaban en el código). Sin
                                  ella, Contabilidad depende de la lista que publica junto con el padrón del fondo.
    TENANT_ID           (texto)   opcional (v134). Organización de Microsoft de Puduhue; por defecto la de TENANT_PUDUHUE
    CLIENT_ID           (texto)   opcional (v134). Aplicaciones de Entra aceptadas, separadas por coma; por defecto la de la app
    LIMITE_BOLETAS      (texto)   opcional (v134). Lecturas de boletas por persona al día; por defecto 150
    LIMITE_NOTIFICACIONES (texto) opcional (v134). Notificaciones que envía cada persona al día; por defecto 40
  Notificaciones (v83): no requieren variables. Los equipos registrados y las claves de envío se guardan en el
  Durable Object AVISOS (ver push.js y wrangler.toml); se crea solo al publicar.
  Fondo por rendir (v94): ver fondo.js. Usa el reporte libroMayor directo (no hace falta agregarlo a FINN_REPORTES).
  Recordatorios (v84): una tarea programada cada hora (wrangler.toml, [triggers]); a las 9:00 de Santiago en
  días hábiles revisa la agenda de pendientes que deja la app y avisa (ver recordatorios.js).
  (También acepta los nombres anteriores FINN_API_KEY y FINN_SECRET_KEY.)
*/
import { rutasPush, Avisos, sujetoDe, objetoAvisos } from "./push.js";
import { rutasFondo, esContabSrv, contabDef } from "./fondo.js";
import { santiago } from "./recordatorios.js";
import { leerBoleta, MODELO_LECTURA, MODELO_REVISION } from "./boleta.js";
export { Avisos };
/* v134 (A-08): la sesión debe ser de la organización de Puduhue en Microsoft y de la aplicación de Entra de la app (los dos datos
   son públicos: están en la app). Graph ya revisa la firma y el vencimiento del token; aquí se leen sus datos. */
const TENANT_PUDUHUE = "8812d491-c151-4cf4-ad03-7671f57a4a23", APP_ENTRA = "7dbe6da2-d0de-49f1-a4a5-76fe822ce9d0";
export function datosToken(auth) {
  try { const p = String(auth || "").replace(/^Bearer\s+/i, "").split(".")[1]; if (!p) return null;
    const b = atob(p.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((p.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)))); } catch (e) { return null; }
}
export function tokenDePuduhue(auth, env) {
  const t = datosToken(auth); if (!t) return false;
  const tenant = String(env.TENANT_ID || TENANT_PUDUHUE).trim().toLowerCase();
  const apps = String(env.CLIENT_ID || APP_ENTRA).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return String(t.tid || "").toLowerCase() === tenant && apps.includes(String(t.appid || t.azp || "").toLowerCase());
}
/* v141 (M-26): token propio de la app para el servidor (ámbito «Acceso» de api://<id de la app>). Se revisa aquí, sin llamar a Graph:
   firma RS256 con las llaves públicas de Microsoft, audiencia, emisor, organización, aplicación, ámbito y vigencia. */
export const ALCANCE_API = "Acceso";
const b64uBytes = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
let LLAVES = { t: 0, tenant: "", k: {} };
async function llavesMicrosoft(tenant, forzar) {
  if (!forzar && LLAVES.tenant === tenant && Date.now() - LLAVES.t < 864e5 && Object.keys(LLAVES.k).length) return LLAVES.k;
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`);
  if (!r.ok) throw new Error("llaves de Microsoft: " + r.status);
  const j = await r.json(), k = {};
  for (const x of (j && j.keys) || []) if (x && x.kid && x.kty === "RSA" && x.n && x.e) k[x.kid] = x;
  LLAVES = { t: Date.now(), tenant, k }; return k;
}
export const audienciasApi = env => { const a = String(env.CLIENT_ID || APP_ENTRA).split(",")[0].trim().toLowerCase(); return ["api://" + a, a]; };
export const esTokenApi = (auth, env) => { const t = datosToken(auth); return !!t && audienciasApi(env).includes(String(t.aud || "").toLowerCase()); };
/* devuelve { correo, nombre } si el token es válido; null si no (y lanza un error solo si no se pudo consultar a Microsoft) */
export async function verificarTokenApi(auth, env, ahora = Date.now()) {
  const tok = String(auth || "").replace(/^Bearer\s+/i, ""), [h, p, f] = tok.split(".");
  if (!h || !p || !f) return null;
  let cab, t; try { cab = JSON.parse(new TextDecoder().decode(b64uBytes(h))); t = JSON.parse(new TextDecoder().decode(b64uBytes(p))); } catch (e) { return null; }
  const tenant = String(env.TENANT_ID || TENANT_PUDUHUE).trim().toLowerCase();
  const apps = String(env.CLIENT_ID || APP_ENTRA).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!cab || cab.alg !== "RS256" || !cab.kid) return null;
  if (!audienciasApi(env).includes(String(t.aud || "").toLowerCase())) return null;
  if (![`https://sts.windows.net/${tenant}/`, `https://login.microsoftonline.com/${tenant}/v2.0`].includes(String(t.iss || "").toLowerCase())) return null;
  if (String(t.tid || "").toLowerCase() !== tenant || !apps.includes(String(t.appid || t.azp || "").toLowerCase())) return null;
  if (!String(t.scp || "").split(" ").includes(ALCANCE_API)) return null;
  const margen = 300e3;
  if (!(+t.exp * 1000 + margen > ahora) || (t.nbf && +t.nbf * 1000 - margen > ahora)) return null;
  let k = (await llavesMicrosoft(tenant))[cab.kid];
  if (!k) k = (await llavesMicrosoft(tenant, true))[cab.kid];
  if (!k) return null;
  const llave = await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", llave, b64uBytes(f), new TextEncoder().encode(h + "." + p)))) return null;
  const correo = String(t.preferred_username || t.upn || t.email || t.unique_name || "").toLowerCase();
  return correo ? { correo, nombre: String(t.name || "") } : null;
}
const FINN = "https://api.finneg.com/api";
const VERSION_SERVIDOR = "v141.1"; /* se publica sola desde GitHub (carpeta servidor del repositorio actas-vivienda) */

/* ---- Lectura de boletas con Claude: ver boleta.js (desde la v98, con revisión y timbre del SII) ---- */
const PARAMS_STOCK = "PARAMWEBREPORT_Empresa=2&PARAMWEBREPORT_tipoStock=0&PARAMWEBREPORT_soloStockNoCero=true&PARAMWEBREPORT_soloStockDebajoPtoReposicion=false&PARAMWEBREPORT_soloDepositos=0&PARAMWEBREPORT_TipoPrecio=0&PARAMWEBREPORT_AgruparPor=1";
const hoyChile = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

async function tokenFinnegans(env) {
  const id = env.FINN_CLIENT_ID || env.FINN_API_KEY, sec = env.FINN_CLIENT_SECRET || env.FINN_SECRET_KEY;
  if (!id || !sec) throw { status: 500, error: "Faltan las credenciales de Finnegans en el servidor." };
  const u = `${FINN}/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(sec)}`;
  const r = await fetch(u);
  const t = (await r.text()).trim();
  if (!r.ok) throw { status: 502, error: "Finnegans rechazó las credenciales.", detalle: t.slice(0, 300) };
  let tok = t; try { const j = JSON.parse(t); tok = typeof j === "string" ? j : (j.access_token || j.token || ""); } catch (e) {}
  tok = String(tok).replace(/"/g, "").trim();
  if (!tok) throw { status: 502, error: "Finnegans no devolvió una clave." };
  return tok;
}

async function reporte(env, nombre, params) {
  const tok = await tokenFinnegans(env);
  const u = new URL(`${FINN}/reports/${encodeURIComponent(nombre)}`);
  u.searchParams.set("ACCESS_TOKEN", tok);
  for (const [k, v] of params) if (k.startsWith("PARAMWEBREPORT_")) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const t = await r.text();
  if (!r.ok) throw { status: 502, error: `Finnegans rechazó el reporte ${nombre}.`, estado: r.status, detalle: t.slice(0, 500) };
  try { return JSON.parse(t) } catch (e) { throw { status: 502, error: "El reporte no vino en formato JSON.", detalle: t.slice(0, 500) } }
}

/* ---- Maestros de Finnegans: listado de una entidad (para mantener al día los maestros de Rendiciones) ---- */
const MAESTROS_FINN = ["organizacion", "producto", "proveedor", "cliente"];
async function listarMaestro(env, entidad, desde) {
  const tok = await tokenFinnegans(env);
  const bases = [FINN, "https://api.teamplace.finneg.com/api"];
  const fechas = desde ? [desde] : ["", "01-01-2000", "2000-01-01"]; // sin fecha entrega el maestro completo (probado con organizacion)
  const intentos = [];
  for (const base of bases) for (const f of fechas) {
    const u = new URL(`${base}/${entidad}/list`);
    u.searchParams.set("ACCESS_TOKEN", tok);
    if (f) u.searchParams.set("updatedSince", f);
    let r, t;
    try { r = await fetch(u.toString(), { headers: { Accept: "application/json" } }); t = await r.text(); }
    catch (e) { intentos.push({ base, fecha: f, estado: "sin conexión" }); continue; }
    const i = { base, fecha: f, estado: r.status }; intentos.push(i);
    if (!r.ok) { i.muestra = t.slice(0, 200); continue; }
    try { return { datos: JSON.parse(t), base, fecha: f, intentos }; } catch (e) { i.muestra = t.slice(0, 200); }
  }
  throw { status: 502, error: `Finnegans no entregó el listado de ${entidad}.`, detalle: JSON.stringify(intentos).slice(0, 1500) };
}

const url0 = req => new URL(req.url);
export default {
  async fetch(req, env, ctx) {
    const origenes = ["https://puduhue.github.io", "https://benjaminbarrientoscardenas-glitch.github.io"].concat((env.ORIGEN_APP || "").split(",").map(x => x.trim().replace(/\/+$/, "")).filter(Boolean));
    const pide = req.headers.get("Origin") || "", origen = origenes.includes(pide) ? pide : origenes[0];
    const cors = { "Access-Control-Allow-Origin": origen, Vary: "Origin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Max-Age": "86400" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    /* v136 (A-09): cuántos pedidos llegan todavía desde la dirección antigua (para saber cuándo retirarla) */
    if (pide === "https://benjaminbarrientoscardenas-glitch.github.io" && env.AVISOS && url0(req).pathname !== "/salud") ctx.waitUntil(objetoAvisos(env).contarAntiguo(hoyChile()).catch(() => {}));
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/salud") return json({ ok: true, servicio: "Puduhue Terreno", version: VERSION_SERVIDOR, hora: new Date().toISOString(), credenciales: !!((env.FINN_CLIENT_ID || env.FINN_API_KEY) && (env.FINN_CLIENT_SECRET || env.FINN_SECRET_KEY)), reporteStock: env.FINN_REPORTE_STOCK || null, lecturaBoletas: !!env.ANTHROPIC_API_KEY, modeloLectura: env.MODELO_LECTURA || MODELO_LECTURA, modeloRevision: env.MODELO_REVISION || MODELO_REVISION, notificaciones: !!env.AVISOS, recordatorios: env.AVISOS ? await objetoAvisos(env).estadoRec().catch(() => null) : null, direccionAntigua: env.AVISOS ? await objetoAvisos(env).leerAntiguo().catch(() => null) : null, sesiones: env.AVISOS ? await objetoAvisos(env).leerSesiones(hoyChile()).catch(() => null) : null });

    // Quién pide: se valida la sesión Microsoft que ya tiene la app
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesión de Microsoft." }, 401);
    if (!tokenDePuduhue(auth, env)) return json({ error: "Solo cuentas de Puduhue, desde la app Puduhue Terreno." }, 403); /* v134 (A-08) */
    let yo;
    if (esTokenApi(auth, env)) { /* v141 (M-26): token propio de la app, revisado aquí */
      let v = null; try { v = await verificarTokenApi(auth, env); } catch (e) { return json({ error: "No se pudo verificar la sesión." }, 502); }
      if (!v) return json({ error: "La sesión de Microsoft no es válida o venció." }, 401);
      yo = { mail: v.correo, displayName: v.nombre };
    } else { /* camino antiguo (token de Graph), para los teléfonos que todavía no tienen la v141; se quita en una versión aparte */
      try { const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", { headers: { Authorization: auth } }); if (!r.ok) return json({ error: "La sesión de Microsoft no es válida o venció." }, 401); yo = await r.json(); }
      catch (e) { return json({ error: "No se pudo verificar la sesión." }, 502); }
    }
    const correo = String(yo.mail || yo.userPrincipalName || "").toLowerCase();
    if (!correo.endsWith("@" + (env.DOMINIO || "puduhue.cl").toLowerCase())) return json({ error: "Solo cuentas de Puduhue." }, 403);
    if (env.AVISOS) ctx.waitUntil(objetoAvisos(env).contarSesion(esTokenApi(auth, env) ? "api" : "graph", correo, hoyChile()).catch(() => {})); /* v141.1 (M-26) */
    const permitidos = (env.CORREOS_ACTUALIZAR || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const autorizado = permitidos.includes(correo); // v132 (M-22): con CORREOS_ACTUALIZAR vacía no queda nadie autorizado (antes, todos)
    if (url.pathname === "/reporte" && !autorizado) return json({ error: "Tu cuenta no está autorizada para consultar reportes de Finnegans." }, 403);
    /* v134 (M-20, M-21): Contabilidad (lista fija o la que publica Contabilidad con el padrón del fondo) o el administrador */
    let contab = null; const esContab = async () => contab ??= await esContabSrv(env.AVISOS ? objetoAvisos(env) : null, correo, autorizado, env);

    try {
      // /yo → roles de quien pide (v138, B-15): administrador, Contabilidad y la lista de Contabilidad
      if (url.pathname === "/yo") return json({ ok: true, correo, admin: autorizado, contab: await esContab(), contabCorreos: contabDef(env) });
      // /push/... → notificaciones en el teléfono (cualquier cuenta de Puduhue)
      const rp = await rutasPush(req, env, url, correo, json, autorizado, esContab); if (rp) return rp;
      // /fondo → saldo del fondo por rendir (110106) desde el Libro Mayor de Finnegans (v94)
      const rf = await rutasFondo(req, env, ctx, url, correo, json, permitidos.includes(correo), env.AVISOS ? objetoAvisos(env) : null, reporte); if (rf) return rf;
      // /boleta → lectura de un documento con IA (cualquier cuenta de Puduhue)
      if (url.pathname === "/boleta" && req.method === "POST") {
        let body; try { body = await req.json() } catch (e) { return json({ error: "Cuerpo inválido." }, 400); }
        const imagen = String(body.imagen || "").replace(/^data:[^;]+;base64,/, "");
        if (!imagen || imagen.length < 100) return json({ error: "Falta la imagen." }, 400);
        if (imagen.length > 6_000_000) return json({ error: "La imagen es demasiado grande." }, 413);
        /* v134 (M-21): límite diario de lecturas por persona (cada lectura tiene costo) */
        if (env.AVISOS) { const tope = +env.LIMITE_BOLETAS || 150, u = await objetoAvisos(env).usar("boleta", correo, tope, santiago().fecha);
          if (!u.ok) return json({ error: `Llegaste al límite de ${tope} lecturas automáticas de hoy. Escribe los datos a mano; mañana la app vuelve a leer sola.` }, 429); }
        const r = await leerBoleta(env, { imagen, mime: body.mime || "image/jpeg", tipos: body.tipos, timbre: body.timbre, escaneo: body.escaneo === true });
        return json({ ok: true, leidoPor: correo, hora: new Date().toISOString(), datos: r.datos, uso: r.uso, modelo: r.modelo, revision: r.revision });
      }
      // /stock → reporte de stock por depósito configurado en el servidor
      if (url.pathname === "/stock") {
        if (!env.FINN_REPORTE_STOCK) return json({ error: "Falta FINN_REPORTE_STOCK en el servidor." }, 500);
        const p = new URLSearchParams(env.FINN_PARAMS_STOCK || PARAMS_STOCK);
        if (!p.get("PARAMWEBREPORT_fecha")) p.set("PARAMWEBREPORT_fecha", hoyChile());
        if (autorizado) for (const [k, v] of url.searchParams) p.set(k, v); // los demás usan siempre los parámetros fijos
        const datos = await reporte(env, env.FINN_REPORTE_STOCK, p);
        return json({ ok: true, reporte: env.FINN_REPORTE_STOCK, consultadoPor: correo, hora: new Date().toISOString(), datos });
      }
      // /maestro?entidad=organizacion → listado de un maestro de Finnegans (desde la v134, solo Contabilidad y el administrador)
      if (url.pathname === "/maestro") {
        const entidad = (url.searchParams.get("entidad") || "").trim().toLowerCase();
        if (!MAESTROS_FINN.includes(entidad)) return json({ error: "Ese maestro no está habilitado en el servidor." }, 403);
        if (!(await esContab())) return json({ error: "Solo Contabilidad o el administrador consultan los maestros de Finnegans." }, 403); /* v134 (M-21) */
        const r = await listarMaestro(env, entidad, (url.searchParams.get("desde") || "").trim());
        return json({ ok: true, entidad, consultadoPor: correo, hora: new Date().toISOString(), origen: r.base === FINN ? "api" : "teamplace", desde: r.fecha, cantidad: Array.isArray(r.datos) ? r.datos.length : null, datos: r.datos });
      }
      // /reporte?nombre=X&PARAMWEBREPORT_...=... → solo reportes autorizados en FINN_REPORTES
      if (url.pathname === "/reporte") {
        const pedido = (url.searchParams.get("nombre") || "").trim();
        const lista = (env.FINN_REPORTES || "").split(",").map(s => s.trim()).filter(Boolean).concat(env.FINN_REPORTE_STOCK ? [env.FINN_REPORTE_STOCK.trim()] : []);
        const nombre = lista.find(n => n.toLowerCase() === pedido.toLowerCase());
        if (!nombre) return json({ error: `El reporte ${pedido || "(sin nombre)"} no está autorizado en el servidor. Agrégalo en la variable FINN_REPORTES de Cloudflare.` }, 403);
        const datos = await reporte(env, nombre, url.searchParams);
        return json({ ok: true, reporte: nombre, consultadoPor: correo, hora: new Date().toISOString(), datos });
      }
    } catch (e) { return json({ error: e.error || "Error inesperado.", estado: e.estado, detalle: e.detalle || String(e.message || "") }, e.status || 500); }

    return json({ error: "Ruta no encontrada." }, 404);
  },
  /* v84: cada hora; los recordatorios salen a las 9:00 de Santiago en días hábiles (una vez al día) */
  async scheduled(ev, env, ctx) {
    if (!env.AVISOS) return;
    ctx.waitUntil(objetoAvisos(env).correrRecordatorios(sujetoDe(env), ev.scheduledTime, false).then(r => console.log("recordatorios", JSON.stringify(r))).catch(e => console.error("recordatorios", e)));
  }
};
