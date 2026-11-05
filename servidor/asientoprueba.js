/*
  v162.1 · Consulta de SOLO LECTURA de un asiento genérico de Finnegans (temporal)
  ---------------------------------------------------------------------------------
  Para preparar «Contabilizar en FinnegansGO» (enviar el asiento de una rendición con la API asientoGenerico) hace falta ver
  cómo guarda Finnegans un asiento de rendición ya cargado: códigos de empresa, tipo de documento, talonario, organización,
  dimensiones y el número que devuelve. Esta consulta busca el último asiento de rendición en el Libro Mayor de la 110106 y lo
  pide a la API con GET. No crea, cambia ni borra nada en Finnegans.

  Uso: Administración → Servidor y Finnegans → Conexión con Finnegans, reporte «asientoGenerico» (solo el administrador, igual
  que /reporte). Parámetros opcionales, uno por línea: id=<identificador del asiento> (lo pide directo) y dias=<días hacia atrás
  en el Libro Mayor; por defecto 60>. La respuesta usa el formato de /reporte (filas «paso · resultado · detalle») para que la
  pantalla de prueba de la app la muestre sin cambios; en el computador se copia con Ctrl+A y Ctrl+C.
  La clave de Finnegans nunca va en la respuesta. Quitar este archivo cuando la versión con el botón esté publicada.
*/
import { columnas, numero, fechaISO } from "./fondo.js";

const ENTIDAD = "asientoGenerico";
const MAX_FILAS = 15; // la pantalla de prueba muestra hasta 15 filas
const filasDe = d => Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : d && Array.isArray(d.datos) ? d.datos : d && Array.isArray(d.rows) ? d.rows : [];
const ddmmaaaa = iso => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };
const isoHace = (dias, hoy) => new Date(new Date(hoy + "T12:00:00Z").getTime() - dias * 864e5).toISOString().slice(0, 10);

/* JSON sin lo vacío (null, "", listas y objetos vacíos), para que se lea fácil */
export function compacto(x) {
  if (Array.isArray(x)) { const a = x.map(compacto).filter(v => v !== undefined); return a.length ? a : undefined; }
  if (x && typeof x === "object") { const o = {}; for (const [k, v] of Object.entries(x)) { const c = compacto(v); if (c !== undefined) o[k] = c; } return Object.keys(o).length ? o : undefined; }
  if (x === null || x === undefined || x === "") return undefined;
  return x;
}
const js = x => { const c = compacto(x); return c === undefined ? "" : JSON.stringify(c); };
/* nunca mostrar la clave de Finnegans */
const sinClave = (s, tok) => { let t = String(s == null ? "" : s); if (tok) t = t.split(tok).join("***"); return t.replace(/ACCESS_TOKEN=[^&\s"]+/gi, "ACCESS_TOKEN=***"); };

async function pedirFinn(base, ruta, params, tok) {
  const u = new URL(`${base}/${ruta}`);
  for (const [k, v] of params) u.searchParams.set(k, v);
  u.searchParams.set("ACCESS_TOKEN", tok);
  let r, t;
  try { r = await fetch(u.toString(), { headers: { Accept: "application/json" } }); t = await r.text(); }
  catch (e) { return { estado: "sin conexión", datos: null, texto: "" }; }
  let datos = null; try { datos = JSON.parse(t); } catch (e) {}
  return { estado: r.status, ok: r.ok, datos, texto: t };
}

/* posibles identificadores de un registro (fila del Libro Mayor o ítem del listado) */
export function candidatosId(f) {
  const out = [];
  if (!f || typeof f !== "object") return out;
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "" || typeof v === "object") continue;
    const n = String(k).toLowerCase();
    if (/(^id$|id$|^id|transaccion|numerointerno|identificacion|comprobante|^numero)/.test(n) && !/organizacion|cuenta|moneda|empresa|usuario|estado|producto|dimension/.test(n)) {
      const s = String(v).trim(); if (s && s.length <= 40 && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

/* el último asiento de rendición (haber de la 110106 con «RENDICION» en la descripción) en el Libro Mayor */
export function ultimoAsientoRendicion(datos) {
  const filas = filasDe(datos), C = columnas([Object.assign({}, ...filas.filter(f => f && typeof f === "object"))]); // columnas de todas las filas
  const txt = (f, k) => k && f[k] != null ? String(f[k]) : "";
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const L = filas.filter(f => f && typeof f === "object" && numero(f[C.haber]) > 0 && /RENDIC/.test(norm([txt(f, C.desc), txt(f, C.det), txt(f, C.doc), txt(f, C.tipo)].join(" "))));
  L.sort((a, b) => fechaISO(a[C.fecha]).localeCompare(fechaISO(b[C.fecha])));
  return { fila: L.length ? L[L.length - 1] : null, total: L.length, C };
}

export async function pruebaAsiento(env, q, { reporte, tokenFinnegans, FINN }) {
  const filas = [], fila = (paso, resultado, detalle = "") => filas.push({ paso, resultado, detalle });
  const tok = await tokenFinnegans(env);
  const bases = [FINN, "https://api.teamplace.finneg.com/api"];
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dias = Math.min(366, Math.max(1, parseInt(q.get("dias"), 10) || 60));
  const desde = isoHace(dias, hoy);
  let ids = [], desc = "", fechaMayor = "";
  const idPedido = String(q.get("id") || "").trim();

  if (idPedido) { ids = [idPedido]; fila("1. Asiento pedido", `id ${idPedido}`); }
  else {
    // 1. Libro Mayor de la 110106: el último asiento de rendición
    const p = new URLSearchParams(env.FINN_PARAMS_FONDO || "");
    p.set("PARAMWEBREPORT_FechaDesde", desde); p.set("PARAMWEBREPORT_FechaHasta", hoy); p.set("PARAMWEBREPORT_cuenta", (env.FONDO_CUENTA || "110106").trim());
    let mayor;
    try { mayor = await reporte(env, "libroMayor", p); }
    catch (e) { fila("1. Libro Mayor 110106", "error", sinClave(`${e.error || ""} ${e.detalle || ""}`, tok)); return salida(filas); }
    const u = ultimoAsientoRendicion(mayor);
    if (!u.fila) { fila("1. Libro Mayor 110106", `sin asientos de rendición desde el ${desde}`, `Filas: ${filasDe(mayor).length}. Prueba con dias=180.`); return salida(filas); }
    desc = String(u.fila[u.C.desc] || ""); fechaMayor = fechaISO(u.fila[u.C.fecha]);
    ids = candidatosId(u.fila);
    fila("1. Libro Mayor 110106", `último asiento de rendición: ${fechaMayor} · ${desc}`.slice(0, 160), sinClave(js(u.fila), tok));

    // 2. Listado de asientos genéricos (solo lectura), para encontrar el identificador del asiento
    let listado = null;
    for (const base of bases) {
      for (const params of [[["updatedSince", ddmmaaaa(fechaMayor || desde)]], [["FechaDesde", ddmmaaaa(fechaMayor || desde)], ["FechaHasta", ddmmaaaa(hoy)]], []]) {
        const r = await pedirFinn(base, `${ENTIDAD}/list`, params, tok);
        const L = filasDe(r.datos);
        const nombre = `2. GET ${base.includes("teamplace") ? "teamplace" : "api"}/${ENTIDAD}/list${params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : ""}`;
        if (!r.ok) { fila(nombre, `estado ${r.estado}`, sinClave(r.texto.slice(0, 300), tok)); continue; }
        if (!L.length) { fila(nombre, `estado ${r.estado} · 0 registros`, sinClave(String(r.texto).slice(0, 300), tok)); continue; }
        listado = L;
        const dn = desc.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
        const igual = L.filter(x => dn && Object.values(x || {}).some(v => typeof v === "string" && v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() === dn));
        const elegidos = igual.length ? igual : L.slice(-1);
        for (const x of elegidos) for (const c of candidatosId(x)) if (!ids.includes(c)) ids.unshift(c);
        fila(nombre, `estado ${r.estado} · ${L.length} registros${igual.length ? ` · ${igual.length} con la misma descripción` : " · ninguno con la misma descripción (se usa el último)"}`, sinClave(js(elegidos[elegidos.length - 1]), tok).slice(0, 1500));
        break;
      }
      if (listado) break;
    }
  }

  // 3. GET del asiento por cada identificador posible, hasta que uno responda
  let asiento = null, intentos = [];
  for (const id of ids.slice(0, 6)) {
    for (const base of bases) {
      const r = await pedirFinn(base, `${ENTIDAD}/${encodeURIComponent(id)}`, [], tok);
      const d = r.datos && !Array.isArray(r.datos) && typeof r.datos === "object" ? r.datos : Array.isArray(r.datos) && r.datos.length === 1 ? r.datos[0] : null;
      intentos.push(`${id} (${base.includes("teamplace") ? "teamplace" : "api"}): ${r.estado}`);
      if (r.ok && d && (Array.isArray(d.AsientoItems) || d.TransaccionID != null || d.EmpresaID != null)) { asiento = d; break; }
    }
    if (asiento) break;
  }
  fila(`3. GET ${ENTIDAD}/<id>`, asiento ? "asiento encontrado" : ids.length ? "ningún identificador sirvió" : "no hay identificadores para probar", sinClave(intentos.join(" · "), tok));
  if (!asiento) return salida(filas);

  // 4. El asiento: cabecera y cada línea (sin campos vacíos)
  const { AsientoItems, ...cab } = asiento;
  fila("4. Cabecera del asiento", `${asiento.Descripcion || desc || ""}`.slice(0, 120), sinClave(js(cab), tok));
  const items = Array.isArray(AsientoItems) ? AsientoItems : [];
  const libres = MAX_FILAS - filas.length;
  items.forEach((it, i) => {
    if (i < libres - 1 || items.length <= libres) fila(`5. Línea ${i + 1} de ${items.length}`, `${it.DebeHaber === -1 ? "haber" : "debe"} ${it.CuentaID || ""} ${it.ImporteMonPrincipal ?? ""}`.trim(), sinClave(js(it), tok));
  });
  if (items.length > libres) fila(`5. Líneas ${libres} a ${items.length}`, "resto de las líneas", sinClave(js(items.slice(libres - 1)), tok));
  return salida(filas);
}
const salida = filas => ({ ok: true, reporte: `${ENTIDAD} (solo lectura)`, hora: new Date().toISOString(), datos: filas });
