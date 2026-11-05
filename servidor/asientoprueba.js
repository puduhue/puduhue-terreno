/*
  v162.1-v162.2 · Pruebas temporales con la API asientoGenerico de Finnegans (para preparar «Contabilizar en FinnegansGO»)
  ------------------------------------------------------------------------------------------------------------------------
  Uso: Administración → Servidor y Finnegans → Conexión con Finnegans, reporte «asientoGenerico» (solo el administrador, igual que
  /reporte). Parámetros opcionales, uno por línea:
    id=<IdentificacionExterna>   pide ese asiento directo (por ejemplo «AG - 3865»)
    dias=<n>                     días hacia atrás en el Libro Mayor de la 110106 (por defecto 60)
    prueba=descuadrado           (v162.2) además envía con POST un asiento DESCUADRADO A PROPÓSITO (debe $1, haber $2), armado con
                                 los códigos del último asiento de rendición. Finnegans debería rechazarlo por no cuadrar: así se
                                 sabe si las credenciales pueden crear asientos sin crear ninguno. Si Finnegans lo aceptara, la
                                 respuesta lo dice y Contabilidad lo anula (descripción «PRUEBA API - ANULAR»).
    prueba=duplicar              (v163.1) PRUEBA REAL: vuelve a enviar el último asiento de rendición con el mismo código que el botón
                                 «Contabilizar en FinnegansGO» (armarAsiento y enviarAsiento de contabilizar.js), con la descripción
                                 «PRUEBA API - ELIMINAR - …» e IdentificacionExterna «RD-PRUEBA<N° del asiento original>» (si ya
                                 existe, no lo crea otra vez). Crea un asiento real que Benja elimina después en FinnegansGO.
  Sin «prueba» todo es solo lectura (GET). Lo que se sabe desde la v162.1: el GET de un asiento va por su
  IdentificacionExterna («AG - 3865») y no existe el listado (405 «No se puede hacer list sobre una transaccion»).
  La respuesta usa el formato de /reporte (filas «paso · resultado · detalle») para que la pantalla de prueba de la app la muestre
  sin cambios; en el computador se copia con Ctrl+A y Ctrl+C. La clave de Finnegans nunca va en la respuesta.
  Quitar este archivo cuando la versión con el botón esté publicada.
*/
import { columnas, numero, fechaISO } from "./fondo.js";
import { armarAsiento, enviarAsiento } from "./contabilizar.js"; /* v163.1 */

const ENTIDAD = "asientoGenerico";
const MAX_FILAS = 15; // la pantalla de prueba muestra hasta 15 filas
const filasDe = d => Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : d && Array.isArray(d.datos) ? d.datos : d && Array.isArray(d.rows) ? d.rows : [];
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

async function pedirFinn(base, ruta, tok, op = {}) {
  const u = new URL(`${base}/${ruta}`);
  u.searchParams.set("ACCESS_TOKEN", tok);
  let r, t;
  try {
    r = await fetch(u.toString(), op.cuerpo ? { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(op.cuerpo) } : { headers: { Accept: "application/json" } });
    t = await r.text();
  } catch (e) { return { estado: "sin conexión", datos: null, texto: "" }; }
  let datos = null; try { datos = JSON.parse(t); } catch (e) {}
  return { estado: r.status, ok: r.ok, datos, texto: t };
}
const esAsiento = d => !!d && typeof d === "object" && !Array.isArray(d) && (Array.isArray(d.AsientoItems) || d.TransaccionID != null || d.EmpresaID != null);
const unAsiento = d => esAsiento(d) ? d : Array.isArray(d) && d.length === 1 && esAsiento(d[0]) ? d[0] : null;

/* posibles identificadores de un registro; primero la IdentificacionExterna, que es la que sirve para el GET (v162.1) */
export function candidatosId(f) {
  const out = [];
  if (!f || typeof f !== "object") return out;
  const ent = Object.entries(f), ext = ent.filter(([k]) => /identificacionexterna/i.test(k)), resto = ent.filter(([k]) => !/identificacionexterna/i.test(k));
  for (const [k, v] of [...ext, ...resto]) {
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

/* v162.2: asiento descuadrado a propósito (debe 1, haber 2), con los códigos de un asiento real; nada de datos fijos en el código */
export function asientoDescuadrado(base, hoy, marca) {
  const items = Array.isArray(base && base.AsientoItems) ? base.AsientoItems : [];
  const d = items.find(x => x && x.DebeHaber === 1), h = items.find(x => x && x.DebeHaber === -1);
  if (!d || !h) return null;
  const desc = "PRUEBA API - DESCUADRADO A PROPOSITO - ANULAR";
  const linea = (x, dh, monto) => compacto({
    DebeHaber: dh, CuentaID: x.CuentaID, ProductoID: x.ProductoID, OrganizacionID: x.OrganizacionID, Descripcion: desc,
    MonedaIDTransaccion: x.MonedaIDTransaccion || "PES", CotizacionMonTransaccion: 1, ImporteMonTransaccion: monto, ImporteMonPrincipal: monto,
    FechaVto: dh === -1 ? hoy : undefined,
    DimensionDistribucion: Array.isArray(x.DimensionDistribucion) ? x.DimensionDistribucion.map(z => ({ dimensionCodigo: z.dimensionCodigo, distribucionItems: (z.distribucionItems || []).map(i => ({ codigo: i.codigo, porcentaje: i.porcentaje })) })) : undefined,
  });
  return compacto({
    EmpresaID: base.EmpresaID, TransaccionTipoID: base.TransaccionTipoID, TransaccionSubtipoID: base.TransaccionSubtipoID, MonedaID: base.MonedaID || "PES",
    Fecha: hoy, FechaComprobante: hoy, Descripcion: desc, IdentificacionExterna: `PRUEBA-API-${marca}`,
    AsientoGenericoCotizaciones: [{ MonedaID: base.MonedaID || "PES", Cotizacion: 1 }],
    AsientoItems: [linea(d, 1, 1), linea(h, -1, 2)],
  });
}

export async function pruebaAsiento(env, q, { reporte, tokenFinnegans, FINN }) {
  const filas = [], fila = (paso, resultado, detalle = "") => filas.push({ paso, resultado, detalle });
  const tok = await tokenFinnegans(env);
  const bases = [FINN, "https://api.teamplace.finneg.com/api"];
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dias = Math.min(366, Math.max(1, parseInt(q.get("dias"), 10) || 60));
  const desde = isoHace(dias, hoy);
  const modo = String(q.get("prueba") || "").trim().toLowerCase(), prueba = modo === "descuadrado" || modo === "duplicar";
  let ids = [];
  const idPedido = String(q.get("id") || "").trim();

  if (idPedido) { ids = [idPedido]; fila("1. Asiento pedido", `id ${idPedido}`); }
  else {
    // 1. Libro Mayor de la 110106: el último asiento de rendición
    const p = new URLSearchParams(env.FINN_PARAMS_FONDO || "");
    p.set("PARAMWEBREPORT_FechaDesde", desde); p.set("PARAMWEBREPORT_FechaHasta", hoy); p.set("PARAMWEBREPORT_cuenta", (env.FONDO_CUENTA || "110106").trim());
    let mayor;
    try { mayor = await reporte(env, "libroMayor", p); }
    catch (e) { fila("1. Libro Mayor 110106", "error", sinClave(`${e.error || ""} ${e.detalle || ""}`, tok)); return salida(filas, modo); }
    const u = ultimoAsientoRendicion(mayor);
    if (!u.fila) { fila("1. Libro Mayor 110106", `sin asientos de rendición desde el ${desde}`, `Filas: ${filasDe(mayor).length}. Prueba con dias=180.`); return salida(filas, modo); }
    ids = candidatosId(u.fila);
    fila("1. Libro Mayor 110106", `último asiento de rendición: ${fechaISO(u.fila[u.C.fecha])} · ${String(u.fila[u.C.desc] || "")}`.slice(0, 160), prueba ? "" : sinClave(js(u.fila), tok));
  }

  // 2. GET del asiento por cada identificador posible, hasta que uno responda (solo lectura)
  let asiento = null; const intentos = [];
  for (const id of ids.slice(0, 6)) {
    for (const base of bases) {
      const r = await pedirFinn(base, `${ENTIDAD}/${encodeURIComponent(id)}`, tok);
      intentos.push(`${id} (${base.includes("teamplace") ? "teamplace" : "api"}): ${r.estado}`);
      if (r.ok && unAsiento(r.datos)) { asiento = unAsiento(r.datos); break; }
    }
    if (asiento) break;
  }
  fila(`2. GET ${ENTIDAD}/<id>`, asiento ? `asiento encontrado: ${asiento.Nombre || asiento.IdentificacionExterna || ""}` : ids.length ? "ningún identificador sirvió" : "no hay identificadores para probar", sinClave(intentos.join(" · "), tok));
  if (!asiento) { if (prueba) fila("3. POST descuadrado", "no se envió", "Sin un asiento de rendición del que copiar los códigos."); return salida(filas, modo); }

  if (modo === "duplicar") {
    // 3. (v163.1) el asiento de base, en el formato que manda la app, con el mismo armado y envío que el botón
    const lineas = (Array.isArray(asiento.AsientoItems) ? asiento.AsientoItems : []).map(lineaApp);
    const n = String(asiento.NumeroInterno ?? String(asiento.Nombre || "")).replace(/\D/g, "");
    const a = armarAsiento({ idExt: "RD-PRUEBA" + (n || "0000000"), asiento: { fecha: asiento.Fecha, desc: `PRUEBA API - ELIMINAR - ${asiento.Descripcion || ""}`, lineas } }, env);
    if (a.error) { fila("3. Asiento para la prueba", "no se envió", a.error); return salida(filas, modo); }
    fila("3. Asiento enviado (POST)", `copia de ${asiento.Nombre || "el asiento"}: ${lineas.length} líneas, debe $${a.debe}`, sinClave(JSON.stringify(a.cuerpo), tok));
    const [r] = await enviarAsiento(env, a, { tokenFinnegans, FINN });
    fila("4. Resultado", r.ok ? (r.ya ? `ya existía: ${r.numero} (no se creó otro)` : `CREADO: ${r.numero}${r.sinConfirmar ? " (sin confirmar con GET)" : ""} · eliminarlo en FinnegansGO`) : `no se creó: ${r.error || ""}`, sinClave(JSON.stringify(r), tok));
    return salida(filas, modo);
  }

  if (prueba) {
    // 3. POST de un asiento descuadrado a propósito: Finnegans debería rechazarlo
    const marca = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const cuerpo = asientoDescuadrado(asiento, hoy, marca);
    if (!cuerpo) { fila("3. POST descuadrado", "no se envió", "El asiento de base no tiene una línea al debe y una al haber."); return salida(filas, modo); }
    fila("3. Asiento enviado (POST)", "debe $1 · haber $2 (descuadrado a propósito)", sinClave(JSON.stringify(cuerpo), tok));
    const r = await pedirFinn(FINN, ENTIDAD, tok, { cuerpo });
    const sinPermiso = r.estado === 401 || r.estado === 403;
    fila("4. Respuesta de Finnegans", r.ok ? `estado ${r.estado}: ¡LO ACEPTÓ! Hay que anularlo en FinnegansGO` : sinPermiso ? `estado ${r.estado}: sin permiso para crear asientos` : `estado ${r.estado}: rechazado (no se creó)`, sinClave(String(r.texto || "").slice(0, 2000), tok));
    // 5. Revisión: ¿quedó creado? (GET por la IdentificacionExterna de la prueba)
    const v = await pedirFinn(FINN, `${ENTIDAD}/${encodeURIComponent(cuerpo.IdentificacionExterna)}`, tok);
    const creado = v.ok && unAsiento(v.datos);
    fila("5. ¿Quedó creado?", creado ? `SÍ: ${creado.Nombre || cuerpo.IdentificacionExterna} · avisar a Contabilidad para anularlo` : `no (GET ${cuerpo.IdentificacionExterna}: ${v.estado})`, creado ? sinClave(js({ Nombre: creado.Nombre, NumeroInterno: creado.NumeroInterno, IdentificacionExterna: creado.IdentificacionExterna, EstadoID: creado.EstadoID }), tok) : sinClave(String(v.texto || "").slice(0, 300), tok));
    return salida(filas, modo);
  }

  // 3. El asiento: cabecera y cada línea (sin campos vacíos)
  const { AsientoItems, AsientoItemsAjuste, ...cab } = asiento;
  fila("3. Cabecera del asiento", `${asiento.Descripcion || ""}`.slice(0, 120), sinClave(js(cab), tok));
  const items = Array.isArray(AsientoItems) ? AsientoItems : [];
  const libres = MAX_FILAS - filas.length;
  items.forEach((it, i) => {
    if (i < libres - 1 || items.length <= libres) fila(`4. Línea ${i + 1} de ${items.length}`, `${it.DebeHaber === -1 ? "haber" : "debe"} ${it.CuentaID || ""} ${it.ImporteMonPrincipal ?? ""}`.trim(), sinClave(js(it), tok));
  });
  if (items.length > libres) fila(`4. Líneas ${libres} a ${items.length}`, "resto de las líneas", sinClave(js(items.slice(libres - 1)), tok));
  return salida(filas, modo);
}
const salida = (filas, modo) => ({ ok: true, reporte: `${ENTIDAD} (${modo === "duplicar" ? "prueba real: copia del último asiento" : modo === "descuadrado" ? "prueba de envío descuadrado" : "solo lectura"})`, hora: new Date().toISOString(), datos: filas });
/* v163.1: una línea de la API (AsientoItems) al formato de línea de la app (rdAsiento) */
export function lineaApp(it) {
  const dim = c => { const d = (it.DimensionDistribucion || []).find(x => x && x.dimensionCodigo === c); return d && d.distribucionItems && d.distribucionItems[0] ? String(d.distribucionItems[0].codigo || "") : ""; };
  return { lado: it.DebeHaber === -1 ? "H" : "D", cuenta: String(it.CuentaID || ""), prod: it.ProductoID || "", part: dim("DIMPARFIN"), centro: dim("DIMCTC"), ter: it.OrganizacionID || "", bu: dim("DIMBU"), monto: Math.round(Number(it.ImporteMonPrincipal) || 0), glosa: it.Descripcion || "" };
}
