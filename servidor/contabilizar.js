/*
  v163 · Contabilizar una rendición en FinnegansGO (API asientoGenerico)
  ----------------------------------------------------------------------
  POST /finnegans/asiento  { idExt: "RD-<id de la rendición>", asiento: { fecha, desc, lineas: [{ lado, cuenta, prod, part, centro,
  ter, bu, monto, glosa }] } }. Solo Contabilidad y el administrador. Las líneas son las del asiento que aprobó Contabilidad, las
  mismas que lleva el «Excel para FinnegansGO» (rdImportXlsx en modulos/rendiciones.js), pasadas al formato de la API.
  1. Revisa con GET si ya existe un asiento con esa IdentificacionExterna (otro teléfono o un intento anterior que no alcanzó a
     guardar la respuesta): si existe, no envía nada y devuelve ese número.
  2. Envía el asiento con POST. Finnegans responde los rechazos contables con estado 500 y el motivo en «error» (probado el
     05-11-2026: «… no balancea …»): se devuelve ese motivo.
  3. Confirma con GET por la IdentificacionExterna y devuelve el número («AG - N»). Si el POST falló pero el asiento quedó creado,
     también lo dice como creado.
  Probado en la v162.1-v162.2: el GET va por IdentificacionExterna; con las credenciales del servidor se puede crear; el formato de
  abajo (sin talonario ni cotización en dólares) pasa todas las validaciones salvo la del cuadre.
  Variables opcionales en Cloudflare: FINN_EMPRESA (por defecto "2", la de CAPAC SPA, como el Excel).
  v163.2-v163.3: FinnegansGO exige también la cotización del dólar («Debe indicar la cotización para la moneda DOLARES», prueba del
  05-11-2026); el Excel no la lleva porque el importador la pone solo. Se lee del reporte MONEDACOTIZACION («Cotizaciones de
  Monedas»: PAIS, MONEDA, COTIZACION, FECHA, CODIGO) la última del dólar con fecha hasta la del asiento. Sin ella no se envía nada.
*/
import { numero, fechaISO as fechaRep } from "./fondo.js";
const ENTIDAD = "asientoGenerico";
const MAX_LINEAS = 300;

const fechaISO = f => { const s = String(f || "").trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return s;
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const txt = (x, n) => String(x == null ? "" : x).trim().slice(0, n);

/* revisa el pedido y arma el JSON de la API; devuelve { error } o { cuerpo, debe } */
export function armarAsiento(body, env = {}) {
  const idExt = txt(body && body.idExt, 60);
  if (!/^RD-[A-Za-z0-9]{6,40}$/.test(idExt)) return { error: "Falta el identificador de la rendición." };
  const A = body && body.asiento;
  if (!A || !Array.isArray(A.lineas) || !A.lineas.length) return { error: "El asiento no tiene líneas." };
  if (A.lineas.length > MAX_LINEAS) return { error: "El asiento tiene demasiadas líneas." };
  const fecha = fechaISO(A.fecha);
  if (!fecha) return { error: "La fecha del asiento no es válida." };
  const desc = txt(A.desc, 200);
  if (!desc) return { error: "Falta la descripción del asiento." };
  let debe = 0, haber = 0; const items = [];
  for (const l of A.lineas) {
    const lado = l && l.lado, monto = Number(l && l.monto), cuenta = txt(l && l.cuenta, 30), centro = txt(l && l.centro, 40);
    if (lado !== "D" && lado !== "H") return { error: "Hay una línea sin debe ni haber." };
    if (!cuenta) return { error: "Hay una línea sin cuenta." };
    if (!Number.isInteger(monto) || monto <= 0 || monto > 1e12) return { error: `La línea de la cuenta ${cuenta} no tiene un monto válido.` };
    if (!centro) return { error: `La línea de la cuenta ${cuenta} no tiene centro de costo.` };
    if (lado === "D") debe += monto; else haber += monto;
    const dims = [];
    if (txt(l.part, 40)) dims.push({ dimensionCodigo: "DIMPARFIN", distribucionItems: [{ codigo: txt(l.part, 40), porcentaje: 100 }] });
    dims.push({ dimensionCodigo: "DIMCTC", distribucionItems: [{ codigo: centro, porcentaje: 100 }] });
    if (txt(l.bu, 40)) dims.push({ dimensionCodigo: "DIMBU", distribucionItems: [{ codigo: txt(l.bu, 40), porcentaje: 100 }] });
    const it = { DebeHaber: lado === "D" ? 1 : -1, CuentaID: cuenta, Descripcion: txt(l.glosa, 500) || desc, MonedaIDTransaccion: "PES",
      CotizacionMonTransaccion: 1, ImporteMonTransaccion: monto, ImporteMonPrincipal: monto, DimensionDistribucion: dims };
    if (txt(l.prod, 40)) it.ProductoID = txt(l.prod, 40);
    if (txt(l.ter, 40)) it.OrganizacionID = txt(l.ter, 40);
    if (cuenta === "110111") it.OperacionBancariaID = "TRANSREALIZADAS"; // como el Excel
    items.push(it);
  }
  if (debe !== haber) return { error: `El asiento no cuadra: debe ${debe}, haber ${haber}.` };
  return { debe, idExt, cuerpo: {
    EmpresaID: txt(env.FINN_EMPRESA, 10) || "2", TransaccionTipoID: "ASIENTOGENERICO", TransaccionSubtipoID: "AG", MonedaID: "PES",
    Fecha: fecha, FechaComprobante: fecha, Descripcion: desc, IdentificacionExterna: idExt,
    AsientoGenericoCotizaciones: [{ MonedaID: "PES", Cotizacion: 1 }], AsientoItems: items } };
}

/* v163.2: cotización del dólar a una fecha (AAAA-MM-DD), del reporte MONEDACOTIZACION; se guarda 10 minutos */
const COT = new Map();
export function cotizacionDe(filas, fecha) {
  const L = (Array.isArray(filas) ? filas : []).filter(f => f && typeof f === "object").map(f => {
    const k = Object.fromEntries(Object.entries(f).map(([a, b]) => [String(a).toUpperCase(), b]));
    return { cod: String(k.CODIGO || "").trim().toUpperCase(), mon: String(k.MONEDA || "").toUpperCase(), pais: String(k.PAIS || "").toUpperCase(), f: fechaRep(k.FECHA), c: numero(k.COTIZACION) };
  }).filter(x => (x.cod === "DOL" || (!x.cod && /D[OÓ]LAR/.test(x.mon))) && x.c > 0 && x.f && x.f <= fecha);
  const ch = L.filter(x => /CHILE/.test(x.pais)), M = ch.length ? ch : L;
  M.sort((a, b) => a.f.localeCompare(b.f));
  return M.length ? { cotizacion: M[M.length - 1].c, fecha: M[M.length - 1].f } : null;
}
/* v163.3-v163.4: el reporte pide Moneda (el nombre, «DOLARES») y Fecha Desde / Fecha Hasta (captura de Benja del 05-11-2026: hay una
   sola cotización del dólar, 700, del 21-12-2021, y es la que usa FinnegansGO). Se pide desde el 2000 hasta la fecha del asiento y se
   toma la última; se recuerda la combinación que sirvió. FINN_PARAMS_COTIZACION (Cloudflare, opcional) fija los parámetros. */
let COT_OK = null;
export async function cotizacionDolar(env, fecha, reporte) {
  const c = COT.get(fecha); if (c && Date.now() - c.t < 600e3) return c.v;
  const rango = o => Object.assign({}, o, { PARAMWEBREPORT_FechaDesde: "2000-01-01", PARAMWEBREPORT_FechaHasta: fecha });
  const fijos = env.FINN_PARAMS_COTIZACION ? Object.fromEntries(new URLSearchParams(env.FINN_PARAMS_COTIZACION)) : null;
  const base = [rango({ PARAMWEBREPORT_Moneda: "DOLARES" }), rango({ PARAMWEBREPORT_Moneda: "DOL" }), { PARAMWEBREPORT_Moneda: "DOLARES" }, { PARAMWEBREPORT_Moneda: "DOL" }];
  const cola = fijos ? (fijos.PARAMWEBREPORT_FechaDesde ? [fijos] : [rango(fijos), fijos]) : (COT_OK ? [rango(COT_OK)] : []).concat(base);
  const intentos = []; let v = null, n = 0;
  while (cola.length && n < 6 && !v) {
    const o = cola.shift(); n++;
    const txt = Object.entries(o).map(([k, x]) => `${k.replace("PARAMWEBREPORT_", "")}=${x}`).join("&") || "(sin parámetros)";
    try {
      const d = await reporte(env, "MONEDACOTIZACION", new URLSearchParams(o));
      v = cotizacionDe(d, fecha);
      if (v) { COT_OK = Object.fromEntries(Object.entries(o).filter(([k]) => !/Fecha(Desde|Hasta)$/.test(k))); break; }
      intentos.push(`${txt}: ${Array.isArray(d) ? d.length : 0} filas, sin el dólar al ${fecha}`);
    } catch (e) {
      const m = `${e.error || ""} ${e.detalle || ""}`.replace(/\s+/g, " ");
      intentos.push(`${txt}: ${(m.match(/Se ha producido un error: ([^"\\]+)/) || [null, m.slice(0, 120)])[1].trim()}`);
    }
  }
  if (v) { COT.set(fecha, { t: Date.now(), v }); return v; }
  return { error: intentos.join(" | ").slice(0, 900) };
}

async function finn(FINN, ruta, tok, cuerpo) {
  const u = new URL(`${FINN}/${ruta}`); u.searchParams.set("ACCESS_TOKEN", tok);
  let r, t;
  try { r = await fetch(u.toString(), cuerpo ? { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) } : { headers: { Accept: "application/json" } }); t = await r.text(); }
  catch (e) { return { estado: 0, ok: false, datos: null, texto: "" }; }
  let datos = null; try { datos = JSON.parse(t); } catch (e) {}
  return { estado: r.status, ok: r.ok, datos, texto: t };
}
const asientoDe = d => { const x = Array.isArray(d) && d.length === 1 ? d[0] : d; return x && typeof x === "object" && !Array.isArray(x) && (x.Nombre || x.NumeroInterno != null || Array.isArray(x.AsientoItems)) ? x : null; };
const numeroDe = x => String(x.Nombre || (x.NumeroInterno != null ? `AG - ${x.NumeroInterno}` : "") || x.IdentificacionExterna || "").trim();
/* motivo legible del rechazo: «Internal Server Error: Genérico del servicio de contabilidad \n\t El movimiento … no balancea …» */
export function motivoFinn(r, tok) {
  let m = r.datos && typeof r.datos === "object" ? (r.datos.error || r.datos.message || r.datos.mensaje || "") : "";
  if (!m) m = String(r.texto || "");
  m = String(m).replace(/^(Internal Server Error|Bad Request|Not Found|Forbidden|Unauthorized)\s*:\s*/i, "").replace(/Gen[eé]rico del servicio de contabilidad\s*/i, "").replace(/\s+/g, " ").trim();
  if (tok) m = m.split(tok).join("***");
  return m.slice(0, 600) || (r.estado ? `Estado ${r.estado}.` : "Sin conexión con Finnegans.");
}

/* revisar si ya está, enviar y confirmar; devuelve [cuerpo de la respuesta, estado]. (v163.1-v163.4 lo usó también la prueba real de
   asientoprueba.js, que se quitó en la v163.5 después de probar con el AG - 3866) */
export async function enviarAsiento(env, a, { tokenFinnegans, FINN, reporte }) {
  const tok = await tokenFinnegans(env);
  const ruta = `${ENTIDAD}/${encodeURIComponent(a.idExt)}`;
  // 1. ¿Ya está cargada?
  let g = await finn(FINN, ruta, tok);
  let x = g.ok ? asientoDe(g.datos) : null;
  if (x) return [{ ok: true, ya: true, numero: numeroDe(x), interno: x.NumeroInterno ?? null, idExt: a.idExt }, 200];
  if (g.estado !== 404) return [{ error: "No se pudo revisar en FinnegansGO si la rendición ya estaba cargada. No se envió nada; intenta de nuevo.", detalle: motivoFinn(g, tok) }, 502];
  // v163.2: cotización del dólar (FinnegansGO la exige)
  const cot = await cotizacionDolar(env, a.cuerpo.Fecha, reporte);
  if (!cot || cot.error) return [{ error: `No se encontró en FinnegansGO la cotización del dólar al ${a.cuerpo.Fecha}. No se envió nada.`, detalle: cot && cot.error ? cot.error.slice(0, 900) : "El reporte de cotizaciones no trae el dólar para esa fecha." }, 502];
  a.cuerpo.AsientoGenericoCotizaciones = [{ MonedaID: "PES", Cotizacion: 1 }, { MonedaID: "DOL", Cotizacion: cot.cotizacion }];
  // 2. Enviar
  const p = await finn(FINN, ENTIDAD, tok, a.cuerpo);
  // 3. Confirmar (también si el POST falló: puede haber quedado creado)
  g = await finn(FINN, ruta, tok);
  x = g.ok ? asientoDe(g.datos) : null;
  if (x) return [{ ok: true, numero: numeroDe(x), interno: x.NumeroInterno ?? null, idExt: a.idExt, debe: a.debe, dolar: cot.cotizacion }, 200];
  if (!p.ok) return [{ error: "FinnegansGO no aceptó el asiento.", detalle: motivoFinn(p, tok), estado: p.estado, dolar: cot.cotizacion }, p.estado === 401 || p.estado === 403 ? 403 : 422];
  // el POST dijo que sí pero el GET aún no lo encuentra: se toma lo que devolvió el POST
  const y = asientoDe(p.datos);
  return [{ ok: true, numero: y ? numeroDe(y) : "", interno: y ? y.NumeroInterno ?? null : null, idExt: a.idExt, debe: a.debe, sinConfirmar: true }, 200];
}

/* v182 · Adjuntar un archivo al asiento de una rendición (API uploadFileCustom, probada en la v181.1-v181.3 con el AG - 3865)
   POST /finnegans/adjunto { idExt: "RD-…", nombre: "x.pdf|x.jpg", descripcion, base64 }. Revisa que el asiento exista (GET por
   IdentificacionExterna; lo recuerda unos minutos) y lo adjunta con uploadFileCustom/subidaNuevoArchivo: clase AsientoGenericoVO,
   Tipo "10", Empresa FINN_EMPRESA (por defecto 2), Codigo = idExt. La forma antigua (custom/files/upload) responde 405. */
export const MAX_ADJUNTO = 14_000_000; // caracteres de base64 (unos 10 MB de archivo)
const EXISTE = new Map();
export function revisarAdjunto(body) {
  const idExt = txt(body && body.idExt, 60);
  if (!/^RD-[A-Za-z0-9]{6,40}$/.test(idExt)) return { error: "Falta el identificador de la rendición." };
  let nombre = txt(body && body.nombre, 120).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^[._ ]+/, "");
  if (!/\.(pdf|jpe?g|png)$/i.test(nombre) || nombre.length < 5) return { error: "El archivo debe ser PDF o una foto (JPEG o PNG)." };
  const b64 = String(body && body.base64 || "").replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (b64.length < 50) return { error: "Falta el archivo." };
  if (b64.length > MAX_ADJUNTO) return { error: "El archivo es demasiado grande para adjuntarlo (más de 10 MB)." };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: "El archivo no viene en base64." };
  return { idExt, nombre, b64, desc: txt(body && body.descripcion, 200) };
}
export async function adjuntarArchivo(req, env, { correo, json, esContab, tokenFinnegans, FINN }) {
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!(await esContab())) return json({ error: "Solo Contabilidad o el administrador adjuntan en FinnegansGO." }, 403);
  let body; try { body = await req.json(); } catch (e) { return json({ error: "Cuerpo inválido." }, 400); }
  const a = revisarAdjunto(body);
  if (a.error) return json({ error: a.error }, 400);
  const tok = await tokenFinnegans(env);
  if (!(EXISTE.get(a.idExt) > Date.now())) {
    const g = await finn(FINN, `${ENTIDAD}/${encodeURIComponent(a.idExt)}`, tok);
    if (!(g.ok && asientoDe(g.datos))) return json({ error: g.estado === 404 ? "El asiento de esta rendición no está en FinnegansGO." : "No se pudo revisar el asiento en FinnegansGO.", detalle: motivoFinn(g, tok) }, g.estado === 404 ? 404 : 502);
    EXISTE.set(a.idExt, Date.now() + 10 * 60e3);
  }
  const cuerpo = { clase: "AsientoGenericoVO", Tipo: "10", NombreLogico: a.nombre, Descripcion: a.desc, Empresa: txt(env.FINN_EMPRESA, 10) || "2", Codigo: a.idExt, base64: a.b64 };
  const r = await finn(FINN, "uploadFileCustom/subidaNuevoArchivo", tok, cuerpo);
  const st = r.datos && typeof r.datos === "object" && r.datos.status != null ? +r.datos.status : r.estado;
  if (!r.ok || st !== 200) return json({ error: "FinnegansGO no aceptó el archivo.", detalle: motivoFinn(r, tok), estado: r.estado }, 422);
  return json({ ok: true, nombre: a.nombre, idExt: a.idExt, por: correo });
}

export async function contabilizarAsiento(req, env, { correo, json, esContab, tokenFinnegans, FINN, reporte }) {
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!(await esContab())) return json({ error: "Solo Contabilidad o el administrador contabilizan en FinnegansGO." }, 403);
  let body; try { body = await req.json(); } catch (e) { return json({ error: "Cuerpo inválido." }, 400); }
  const a = armarAsiento(body, env);
  if (a.error) return json({ error: a.error }, 400);
  const [r, st] = await enviarAsiento(env, a, { tokenFinnegans, FINN, reporte });
  return json(r.ok ? { ...r, por: correo } : r, st);
}
