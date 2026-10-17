/*
  v94 · Saldo del fondo por rendir (cuenta 110106) desde el Libro Mayor de Finnegans
  ----------------------------------------------------------------------------------
  - El Libro Mayor (reporte libroMayor) trae cada movimiento de la 110106 con la organización (la persona) cuando
    Contabilidad la registró. Aquí se agrupa por organización y se devuelve a la app.
  - Cada persona ve solo lo suyo: el servidor sabe qué RUT corresponde a cada correo por el «padrón» que publica
    Contabilidad (o el administrador) desde la app, con la lista de colaboradores de los maestros contables.
  - Contabilidad (y el administrador) puede pedir todas las personas (?todos=1) y ve además lo que está sin persona.
  - El Libro Mayor se guarda 5 minutos en la caché del servidor para no consultar Finnegans en cada pedido.
  Variables opcionales en Cloudflare:
    FONDO_DESDE         fecha desde la que se leen los movimientos (AAAA-MM-DD). Por defecto 2026-01-01.
    FONDO_CUENTA        cuenta del fondo. Por defecto 110106.
    FINN_PARAMS_FONDO   parámetros extra del Libro Mayor (ej.: PARAMWEBREPORT_Empresa=2).
*/
const CONTAB_DEF = ["emartinez@puduhue.cl", "nvidal@puduhue.cl"];
const MAX_PERSONAS = 400;
const normK = k => String(k).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const normTxt = t => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const normRut = r => String(r == null ? "" : r).toUpperCase().replace(/[^0-9K]/g, "").replace(/^0+/, "");

export function numero(x) {
  if (x == null || x === "") return 0;
  if (typeof x === "number") return isFinite(x) ? x : 0;
  let s = String(x).trim().replace(/\s|\$/g, "");
  if (/^-?[\d.]+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");           // 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");                  // 1.234.567
  else if (/^-?[\d,]+\.\d+$/.test(s)) s = s.replace(/,/g, "");                         // 1,234.56
  else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");                    // 1,234,567
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
}
export function fechaISO(x) {
  if (x == null || x === "") return "";
  const s = String(x).trim();
  let m = s.match(/\/Date\((-?\d+)/); if (m) return new Date(+m[1]).toISOString().slice(0, 10);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
/* columnas del Libro Mayor: se reconocen por nombre aunque cambien mayúsculas, tildes o espacios */
export function columnas(filas) {
  const f0 = filas.find(f => f && typeof f === "object") || {};
  const n = Object.keys(f0).map(k => [k, normK(k)]);
  const uno = (...pr) => { for (const p of pr) { const h = n.find(([, v]) => typeof p === "string" ? v === p : p(v)); if (h) return h[0]; } return null; };
  return {
    fecha: uno("fecha", v => /^fecha/.test(v) && !/comprob|venc|alta|modif|contab/.test(v), v => v.includes("fecha") && !/ano|mes|comprob|venc/.test(v)),
    debe: uno("debe", v => /^debe/.test(v) && !/moneda|ext/.test(v)),
    haber: uno("haber", v => /^haber/.test(v) && !/moneda|ext/.test(v)),
    imp: uno(v => v.includes("importeoperacion") || v.includes("impoperacion"), "importe", "saldo"),
    orgCod: uno(v => v.includes("organizacion") && v.includes("codigo"), v => v.includes("organizacion") && v.includes("rut")),
    orgNom: uno("organizaciontransaccion", "organizacion", v => v.includes("organizacion") && !v.includes("codigo") && !v.endsWith("id") && !v.includes("rut")),
    doc: uno("documento", v => /^documento/.test(v) && !v.includes("tipo")),
    tipo: uno("tipodedocumento", "tipodocumento", v => v.includes("tipo") && v.includes("doc")),
    comp: uno("comprobante", "numero", v => v.includes("comprobante") && !/adicional|fecha/.test(v)),
    desc: uno("descripcion", v => /^descrip/.test(v)),
    det: uno("detalle", v => /^detalle/.test(v)),
    cta: uno("codigocuenta", v => v.includes("cuenta") && v.includes("codigo")),
  };
}
const filasDe = d => Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : d && Array.isArray(d.datos) ? d.datos : d && Array.isArray(d.rows) ? d.rows : [];
const txt = (f, k) => k && f[k] != null ? String(f[k]).trim() : "";
/* cada línea del mayor → un movimiento: + lo entregado (debe), − lo rendido o devuelto (haber) */
export function movimientos(datos, cuenta) {
  const filas = filasDe(datos), C = columnas(filas), out = [];
  for (const f of filas) {
    if (!f || typeof f !== "object") continue;
    if (C.cta && txt(f, C.cta) && normTxt(txt(f, C.cta)) !== normTxt(cuenta)) continue;
    const m = Math.round(C.debe || C.haber ? numero(f[C.debe]) - numero(f[C.haber]) : numero(f[C.imp]));
    const fe = fechaISO(f[C.fecha]);
    const desc = txt(f, C.desc), det = txt(f, C.det), tipo = txt(f, C.tipo), doc = txt(f, C.doc), comp = txt(f, C.comp);
    const todo = normTxt([desc, det, tipo, doc].join(" "));
    if (!m) continue;
    let t;
    if (/SALDOINICIAL|SALDOANTERIOR|APERTURA/.test(todo)) t = "inicial";
    else if (/REVERS|ANULA/.test(todo)) t = "ajuste";
    else if (m > 0) t = "entrega";
    else if (/DEPOSITO|DEVOLUC|COBRANZA|INGRESO|RECIBO/.test(todo)) t = "devolucion";
    else if (/RENDIC|ASIENTO/.test(todo)) t = "rendicion";
    else t = "otro";
    const ref = [doc || tipo, comp].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 60);
    out.push({ f: fe, t, m, ref, d: (desc || det).slice(0, 80), oc: txt(f, C.orgCod), on: txt(f, C.orgNom) });
  }
  const f0 = filas.find(f => f && typeof f === "object");
  return { movs: out, columnas: C, filas: filas.length, claves: f0 ? Object.keys(f0) : [], crudo: filas.slice(0, 3) };
}
/* padrón: correo → personas (RUT, nombre, organización en Finnegans). Lo publica Contabilidad o el administrador. */
export function validarPadron(b, dominio) {
  const personas = (Array.isArray(b && b.personas) ? b.personas : []).slice(0, MAX_PERSONAS).map(p => ({
    rut: String(p.rut || "").slice(0, 14), nombre: String(p.nombre || "").slice(0, 80),
    correos: (Array.isArray(p.correos) ? p.correos : []).map(x => String(x || "").trim().toLowerCase()).filter(x => x.endsWith(dominio)).slice(0, 6),
    org: p.org && typeof p.org === "object" ? { codigo: String(p.org.codigo || "").slice(0, 30), nombre: String(p.org.nombre || "").slice(0, 120) } : null,
  })).filter(p => normRut(p.rut));
  const contab = (Array.isArray(b && b.contab) ? b.contab : []).map(x => String(x || "").trim().toLowerCase()).filter(x => x.endsWith(dominio)).slice(0, 10);
  return { personas, contab };
}
const esDe = (p, mv) => {
  const oc = normTxt(mv.oc), on = normTxt(mv.on);
  if (p.org && p.org.codigo && oc && normTxt(p.org.codigo) === oc) return true;
  if (oc && normRut(mv.oc).length >= 7 && normRut(mv.oc) === normRut(p.rut)) return true;
  if (!oc && on && p.org && p.org.nombre && normTxt(p.org.nombre) === on) return true;
  return false;
};
/* agrupa los movimientos por persona; lo que no tiene organización va a «sin persona» */
export function agrupar(movs, padron, soloRuts) {
  const per = new Map(), sin = { total: 0, n: 0 }, otras = new Map();
  const P = padron.personas.filter(p => !soloRuts || soloRuts.has(normRut(p.rut)));
  for (const p of P) per.set(normRut(p.rut), { rut: p.rut, nombre: p.nombre, org: p.org ? p.org.codigo : "", movs: [] });
  for (const mv of movs) {
    const limpio = { f: mv.f, t: mv.t, m: mv.m, ref: mv.ref, d: mv.d };
    if (!normTxt(mv.oc) && !normTxt(mv.on)) { sin.total += mv.m; sin.n++; continue; }
    const p = P.find(x => esDe(x, mv));
    if (p) { per.get(normRut(p.rut)).movs.push(limpio); continue; }
    if (soloRuts) continue;
    const k = normTxt(mv.oc) || normTxt(mv.on);
    if (!otras.has(k)) otras.set(k, { rut: normRut(mv.oc).length >= 7 ? mv.oc : "", org: mv.oc || mv.on, nombre: mv.on || mv.oc, movs: [] });
    otras.get(k).movs.push(limpio);
  }
  return { personas: [...per.values(), ...otras.values()], sinPersona: Math.round(sin.total), sinPersonaN: sin.n };
}
async function mayorFondo(env, ctx, reporte, forzar) {
  const cuenta = (env.FONDO_CUENTA || "110106").trim(), desde = (env.FONDO_DESDE || "2026-01-01").trim();
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const clave = new Request(`https://cache.puduhue-terreno/fondo-mayor?c=${encodeURIComponent(cuenta)}&d=${desde}&h=${hoy}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache && !forzar) { const r = await cache.match(clave); if (r) return await r.json(); }
  const p = new URLSearchParams(env.FINN_PARAMS_FONDO || "");
  p.set("PARAMWEBREPORT_FechaDesde", desde); p.set("PARAMWEBREPORT_FechaHasta", hoy); p.set("PARAMWEBREPORT_cuenta", cuenta);
  const datos = await reporte(env, "libroMayor", p);
  const r = movimientos(datos, cuenta);
  const x = { hora: new Date().toISOString(), desde, cuenta, movs: r.movs, columnas: r.columnas, filas: r.filas, claves: r.claves };
  if (cache) ctx.waitUntil(cache.put(clave, new Response(JSON.stringify(x), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" } })));
  return forzar ? { ...x, crudo: r.crudo } : x;
}
/* rutas /fondo… */
export async function rutasFondo(req, env, ctx, url, correo, json, admin, obj, reporte) {
  if (url.pathname !== "/fondo" && !url.pathname.startsWith("/fondo/")) return null;
  const dominio = "@" + (env.DOMINIO || "puduhue.cl").toLowerCase();
  const padron = (obj && await obj.leerPadron()) || { personas: [], contab: [] };
  const esContab = admin || CONTAB_DEF.includes(correo) || (padron.contab || []).includes(correo);
  if (url.pathname === "/fondo/padron") {
    if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
    if (!esContab) return json({ error: "Solo Contabilidad o el administrador publican la lista de colaboradores." }, 403);
    if (!obj) return json({ error: "Falta el almacenamiento del servidor." }, 500);
    let b; try { b = await req.json() } catch (e) { return json({ error: "Cuerpo inválido." }, 400) }
    const v = validarPadron(b, dominio);
    if (v.personas.length < 3) return json({ error: "La lista de colaboradores viene casi vacía; no se reemplazó." }, 400);
    await obj.guardarPadron({ ...v, hora: new Date().toISOString(), por: correo });
    return json({ ok: true, personas: v.personas.length });
  }
  if (url.pathname !== "/fondo") return json({ error: "Ruta no encontrada." }, 404);
  const todos = url.searchParams.get("todos") === "1", diag = url.searchParams.get("diag") === "1";
  if ((todos || diag) && !esContab) return json({ error: "Solo Contabilidad ve los fondos de todas las personas." }, 403);
  const mios = new Set(padron.personas.filter(p => p.correos.includes(correo)).map(p => normRut(p.rut)));
  if (!todos && !diag && !mios.size) return json({ ok: true, hora: new Date().toISOString(), personas: [], sinPadron: !padron.personas.length, aviso: padron.personas.length ? "Tu correo no está en la lista de colaboradores." : "Contabilidad todavía no publica la lista de colaboradores." });
  const M = await mayorFondo(env, ctx, reporte, diag || url.searchParams.get("forzar") === "1" && esContab);
  if (diag) return json({ ok: true, hora: M.hora, desde: M.desde, cuenta: M.cuenta, filas: M.filas, claves: M.claves, columnas: M.columnas, crudo: M.crudo || [], movimientos: M.movs.length, muestra: M.movs.slice(0, 8), padron: { personas: padron.personas.length, hora: padron.hora || null } });
  const g = agrupar(M.movs, padron, todos ? null : mios);
  return json({ ok: true, hora: M.hora, desde: M.desde, cuenta: M.cuenta, personas: g.personas, ...(todos ? { sinPersona: g.sinPersona, sinPersonaN: g.sinPersonaN } : {}) });
}
