/* ---- Lectura de boletas y facturas con Claude (v98) ----
   - Primera lectura con un modelo rápido (por defecto claude-haiku-5-5, sin razonamiento extra).
   - Si la lectura queda con algo raro (dígito verificador del RUT, total o fecha que no se leen, neto + IVA que no cuadra,
     IVA distinto del 19 %, poca confianza), se vuelve a leer SOLO esa boleta con un modelo más capaz (por defecto
     claude-sonnet-5-5), mostrándole la primera lectura y lo que hay que revisar.
   - Si la app ya leyó el timbre electrónico del SII (código PDF417 del pie del documento), esos datos son exactos: se le dan
     al modelo para que no los vuelva a leer y se dejan tal cual en la respuesta (tipo, RUT del emisor, N°, fecha y total).
   Variables (opcionales) en Cloudflare: MODELO_LECTURA y MODELO_REVISION. ANTHROPIC_MODEL ya no se usa. */
export const MODELO_LECTURA = "claude-haiku-5-5";
export const MODELO_REVISION = "claude-sonnet-5-5";

export const PROMPT_BOLETA = `Eres un asistente contable chileno. Lee la foto de este documento tributario (boleta, factura, boleta de honorarios, vale o comprobante) y devuelve SOLO un objeto JSON, sin texto adicional ni marcas de código, con esta forma exacta:
{"legible":true,"tipo":"boleta|factura|boleta_honorarios|vale|otro","emisor":"razón social o nombre del comercio","rut_emisor":"12.345.678-9 o cadena vacía","folio":"número de boleta o factura, cadena vacía si no se ve","fecha":"AAAA-MM-DD o cadena vacía","neto":0,"iva":0,"total":0,"propina":0,"moneda":"CLP","glosa":"descripción breve de lo comprado, máximo 12 palabras","rut_receptor":"RUT del cliente al que se emitió (solo facturas), o cadena vacía","receptor":"razón social del cliente (solo facturas), o cadena vacía","problemas":["lista de problemas: foto borrosa, documento cortado, no se lee el total, no se lee el folio, no se lee la fecha, no es un documento tributario, etc."],"confianza":0.0}
Reglas: los montos son números enteros en pesos chilenos, sin puntos ni símbolos; si el documento no desglosa IVA (boletas), deja neto e iva en 0 y pon solo el total; si el total no se lee con claridad, pon 0 y agrégalo a problemas; la fecha en formato AAAA-MM-DD, interpretando día/mes/año como en Chile; el RUT con puntos y guion si aparece; verifica el dígito verificador del RUT (módulo 11) y, si no calza, vuelve a mirar cada número (es común confundir 0, 6, 8 y 9, o 1 y 7); si aun así no calza, déjalo tal como se ve y agrega "RUT con dígito verificador que no calza" a problemas; en facturas, revisa que neto + IVA = total y que el IVA sea el 19 % del neto (salvo facturas exentas); confianza entre 0 y 1 según cuán seguro estés del total, la fecha y el folio. Si la imagen no es un documento tributario, legible=false y explica en problemas. "propina": la propina o el servicio voluntario si el comprobante lo muestra aparte (0 si no); el total es lo que se pagó, con la propina incluida si está en el mismo comprobante. En "problemas" anota solo lo que pueda dejar mal leído un dato (total, fecha, folio, RUT, neto o IVA); si los datos se leen bien, deja la lista vacía (no anotes manchas, arrugas, propinas ni redondeos que no cambian los datos).`;

const TD_NOMBRE = { 33: "factura electrónica", 34: "factura exenta electrónica", 39: "boleta electrónica", 41: "boleta exenta electrónica", 46: "factura de compra electrónica", 48: "comprobante de pago electrónico", 52: "guía de despacho electrónica", 56: "nota de débito electrónica", 61: "nota de crédito electrónica" };
const TD_TIPO = { 33: "factura", 34: "factura", 46: "factura", 39: "boleta", 41: "boleta", 48: "boleta" };
export const numero = v => { if (typeof v === "number") return isFinite(v) ? v : 0; const s = String(v ?? "").replace(/[^\d-]/g, ""); return s ? Number(s) || 0 : 0 };
export function rutOk(r) {
  const c = String(r || "").replace(/[^0-9kK]/g, "").toUpperCase(); if (c.length < 8) return false;
  const n = c.slice(0, -1), dv = c.slice(-1); let s = 0, m = 2;
  for (let i = n.length - 1; i >= 0; i--) { s += +n[i] * m; m = m === 7 ? 2 : m + 1 }
  const x = 11 - (s % 11); return (x === 11 ? "0" : x === 10 ? "K" : String(x)) === dv;
}
/* timbre que manda la app: se acepta solo si tiene forma válida (RUT con dígito correcto, folio, fecha y tipo SII) */
export function limpiarTimbre(t) {
  if (!t || typeof t !== "object") return null;
  const s = (v, n) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
  const x = { re: s(t.re, 14), td: numero(t.td), f: s(t.f, 12).replace(/\D/g, ""), fe: s(t.fe, 10), mnt: numero(t.mnt), rs: s(t.rs, 100), rr: s(t.rr, 14), rsr: s(t.rsr, 100) };
  if (!rutOk(x.re) || !x.td || !x.f || !/^\d{4}-\d{2}-\d{2}$/.test(x.fe)) return null;
  return x;
}
const textoTimbre = (t, escaneo) => `\nDatos EXACTOS del timbre electrónico del SII de este documento (vienen del código de barras; no los vuelvas a leer y úsalos tal cual en el JSON): tipo SII ${t.td} (${TD_NOMBRE[t.td] || "otro documento"}), RUT del emisor ${t.re}, número ${t.f}, fecha ${t.fe}, total ${t.mnt}${t.rs ? `, razón social del emisor «${t.rs}»` : ""}${t.rr ? `, RUT del receptor ${t.rr}` : ""}. Lee de la foto lo demás: nombre del comercio, neto, IVA, glosa${t.rr ? ", receptor" : ""} y tipo de gasto. Para controlar que el código sea de este documento, agrega también al JSON "total_impreso" con el total que se ve impreso en la foto, leído por ti (0 si no se ve). Si en la foto no se ven el neto, el IVA o el detalle, déjalos en 0 o vacíos: no los calcules a partir del total.${escaneo ? " Esta foto se tomó al escanear el código, así que puede mostrar solo el pie del documento." : ""}`;
export const promptBoleta = (tipos, timbre, escaneo) => PROMPT_BOLETA + (timbre ? textoTimbre(timbre, escaneo) : "") + (!Array.isArray(tipos) || !tipos.length ? "" :
  `\nAdemás agrega al JSON el campo "tipo_gasto" con el id del tipo de gasto que mejor calce con lo comprado, eligiendo solo uno de esta lista (id: nombre); si ninguno calza, usa "otro":\n` +
  tipos.slice(0, 60).map(t => `${String(t.id).slice(0, 30)}: ${String(t.n).slice(0, 80)}`).join("\n"));

/* cuerpo de la solicitud según el modelo: los de la generación 5 razonan por defecto; para leer una boleta basta poco */
export function cuerpo(modelo, contenido, revision) {
  const b = { model: modelo, max_tokens: revision ? 8000 : 2000, messages: [{ role: "user", content: contenido }] };
  if (/claude-haiku-5/.test(modelo)) { b.thinking = { type: "disabled" }; b.output_config = { effort: revision ? "high" : "medium" } }
  else if (/claude-(sonnet|opus|fable)-5/.test(modelo)) { b.output_config = { effort: revision ? "medium" : "low" } }
  return b;
}
async function llamar(env, modelo, contenido, revision) {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify(cuerpo(modelo, contenido, revision)) });
  const t = await r.text();
  if (!r.ok) throw { status: 502, error: "El servicio de lectura rechazó la solicitud.", detalle: t.slice(0, 300) };
  let j; try { j = JSON.parse(t) } catch (e) { throw { status: 502, error: "Respuesta no válida del servicio de lectura." } }
  if (j.stop_reason === "refusal") throw { status: 502, error: "El servicio de lectura no quiso leer esta imagen." };
  const texto = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").replace(/```json|```/g, "").trim();
  let datos; try { datos = JSON.parse(texto) } catch (e) { const m = texto.match(/\{[\s\S]*\}/); if (m) { try { datos = JSON.parse(m[0]) } catch (e2) {} } }
  if (!datos || typeof datos !== "object") throw { status: 502, error: j.stop_reason === "max_tokens" ? "La lectura quedó incompleta." : "No se pudo interpretar la lectura de la boleta.", detalle: texto.slice(0, 300) };
  return { datos, uso: j.usage || null, modelo: j.model || modelo };
}
/* el timbre manda: tipo, RUT, número, fecha y total quedan como dice el SII */
export function aplicarTimbre(d, t) {
  if (!t) return d;
  d.rut_emisor = t.re; d.folio = t.f; d.fecha = t.fe; if (t.mnt > 0) d.total = t.mnt;
  d.tipo = TD_TIPO[t.td] || "otro"; d.tipo_sii = t.td;
  if (!d.emisor && t.rs) d.emisor = t.rs;
  if (t.rr && d.tipo === "factura") { d.rut_receptor = t.rr; if (t.rsr && !d.receptor) d.receptor = t.rsr }
  return d;
}
/* foto y timbre se controlan entre sí: si el total impreso no es el del timbre, se marca (el código puede ser de otra boleta) */
export function marcarDiferencia(d, t) {
  if (!t || !(t.mnt > 0)) return d;
  const ti = numero(d.total_impreso);
  if (ti > 0 && Math.abs(ti - t.mnt) > 1) { d.timbre_difiere = true; d.problemas = (Array.isArray(d.problemas) ? d.problemas : []).concat([`El total impreso en la foto (${ti}) no coincide con el del timbre (${t.mnt}).`]) }
  else delete d.timbre_difiere;
  return d;
}
/* qué revisar de una lectura (vacío = se ve bien) */
export function revisarLectura(x, timbre, hoy, op) {
  const m = []; if (!x || typeof x !== "object") return ["no hubo lectura"];
  if (x.legible === false) return m; /* si no es un documento o no se ve, otra lectura no lo arregla */
  const tot = numero(x.total), neto = numero(x.neto), iva = numero(x.iva), tipo = x.tipo;
  if (!timbre) {
    if (!(tot > 0)) m.push("no se leyó el total");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.fecha || ""))) m.push("no se leyó la fecha");
    else if (hoy && x.fecha > hoy) m.push("la fecha quedó en el futuro");
    if (x.rut_emisor && !rutOk(x.rut_emisor)) m.push("el RUT del emisor no cuadra con su dígito verificador");
    if ((tipo === "boleta" || tipo === "factura") && !String(x.folio || "").trim()) m.push("no se leyó el número del documento");
  }
  const exenta = timbre && (timbre.td === 34 || timbre.td === 41);
  if (tipo === "factura" && !exenta) {
    if (neto > 0 && iva > 0) {
      if (Math.abs(neto + iva - (timbre && timbre.mnt > 0 ? timbre.mnt : tot - numero(x.propina))) > 2) m.push("neto más IVA no cuadra con el total"); /* v135: el total puede incluir la propina */
      else if (Math.abs(Math.round(neto * 0.19) - iva) > 2) m.push("el IVA no es el 19 % del neto");
    } else if (tot > 0 && !(op && op.escaneo)) m.push("faltan el neto o el IVA de la factura"); /* al escanear, la foto suele mostrar solo el pie: otra lectura no lo arregla */
  }
  if (timbre && timbre.mnt > 0 && numero(x.total_impreso) > 0 && Math.abs(numero(x.total_impreso) - timbre.mnt) > 1) m.push("el total impreso no coincide con el del timbre");
  if (typeof x.confianza === "number" && x.confianza < 0.7) m.push("la primera lectura tuvo dudas");
  return m;
}
/* lectura completa: primera pasada y, si hace falta, revisión con el modelo más capaz */
export async function leerBoleta(env, { imagen, mime, tipos, timbre, escaneo }) {
  if (!env.ANTHROPIC_API_KEY) throw { status: 500, error: "La lectura automática no está configurada: falta ANTHROPIC_API_KEY en el servidor." };
  const t = limpiarTimbre(timbre), img = { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: imagen } };
  const m1 = env.MODELO_LECTURA || MODELO_LECTURA, m2 = env.MODELO_REVISION || MODELO_REVISION;
  const esc = !!(escaneo && t), p = promptBoleta(tipos, t, esc);
  const r1 = await llamar(env, m1, [img, { type: "text", text: p }], false);
  aplicarTimbre(r1.datos, t);
  const hoy = new Date(Date.now() - 3 * 3600 * 1000 + 86400000).toISOString().slice(0, 10); /* mañana en Chile: margen por zona horaria */
  const motivos = revisarLectura(r1.datos, t, hoy, { escaneo: esc });
  if (!motivos.length || !m2 || m2 === "no") return { datos: marcarDiferencia(r1.datos, t), uso: r1.uso, modelo: r1.modelo, revision: null };
  try {
    const p2 = p + `\n\nUna primera lectura automática devolvió este JSON:\n${JSON.stringify(r1.datos)}\nHay que revisar: ${motivos.join("; ")}. Mira la imagen con mucho cuidado, corrige lo que esté mal y devuelve el JSON completo, con la misma forma.`;
    const r2 = await llamar(env, m2, [img, { type: "text", text: p2 }], true);
    aplicarTimbre(r2.datos, t);
    return { datos: marcarDiferencia(r2.datos, t), uso: r1.uso, modelo: r1.modelo, revision: { modelo: r2.modelo, motivos, uso: r2.uso, pendientes: revisarLectura(r2.datos, t, hoy, { escaneo: esc }) } };
  } catch (e) {
    return { datos: marcarDiferencia(r1.datos, t), uso: r1.uso, modelo: r1.modelo, revision: { modelo: m2, motivos, error: (e && e.error) || "no se pudo revisar" } };
  }
}
