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
/* v202: versión de las reglas de lectura (la app vuelve a leer sola los N° dudosos solo con estas reglas o más nuevas) */
export const REGLAS_LECTURA = 203;
/* v203: documentos en dólares o euros: pesos con el valor del Banco Central (dólar observado o euro) de la fecha del documento,
   desde mindicador.cl; si ese día no hay valor (fin de semana o feriado), el último anterior del año */
const INDICADOR = { USD: "dolar", EUR: "euro" };
const ddmmaaaa = f => `${f.slice(8, 10)}-${f.slice(5, 7)}-${f.slice(0, 4)}`;
export async function valorMoneda(moneda, fecha, fetchFn) {
  const ind = INDICADOR[moneda]; if (!ind || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return null;
  const f = fetchFn || fetch, leer = async u => { try { const r = await f(u, { headers: { accept: "application/json" } }); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j.serie) ? j.serie : [] } catch (e) { return [] } };
  let s = await leer(`https://mindicador.cl/api/${ind}/${ddmmaaaa(fecha)}`);
  if (!s.length) s = (await leer(`https://mindicador.cl/api/${ind}/${fecha.slice(0, 4)}`)).filter(x => String(x.fecha).slice(0, 10) <= fecha);
  const x = s.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
  return x && +x.valor > 0 ? { valor: +x.valor, fecha: String(x.fecha).slice(0, 10) } : null;
}
/* v203: sugerencia de tipo de gasto (y del centro, si el texto lo nombra) a partir de lo que la persona escribe */
export async function sugerirGasto(env, { texto, tipos, centros }) {
  if (!env.ANTHROPIC_API_KEY) throw { status: 500, error: "Las sugerencias no están configuradas en el servidor." };
  const T = (Array.isArray(tipos) ? tipos : []).slice(0, 90).map(t => ({ id: String(t.id || "").slice(0, 30), n: String(t.n || "").slice(0, 80), g: String(t.g || "").slice(0, 40) })).filter(t => t.id);
  const C = (Array.isArray(centros) ? centros : []).slice(0, 80).map(c => ({ c: String(c.c || "").slice(0, 30), n: String(c.n || "").slice(0, 80) })).filter(c => c.c);
  const tx = String(texto || "").replace(/[<>]/g, "").trim().slice(0, 200);
  if (!tx || !T.length) return { opciones: [], centro: "" };
  const p = `Eres asistente contable de una empresa lechera del sur de Chile. Un trabajador del campo describe con sus palabras un gasto que quiere rendir: «${tx}».
Elige del catálogo los tipos de gasto que mejor calcen, máximo 3, el más probable primero. Catálogo (id: nombre — grupo):
${T.map(t => `${t.id}: ${t.n}${t.g ? " — " + t.g : ""}`).join("\n")}
${C.length ? `Centros de costo (código: nombre):\n${C.map(c => `${c.c}: ${c.n}`).join("\n")}\nSi el texto nombra claramente un predio o lugar que corresponde a uno de estos centros, pon su código en "centro"; si no, deja "centro" vacío.` : ""}
Pon "segura": true solo si la primera opción calza claramente con lo descrito; si hay dudas, false.
Devuelve SOLO un objeto JSON, sin texto adicional: {"opciones":[{"tipo":"id del catálogo","razon":"por qué, máximo 8 palabras"}],"segura":false,"centro":""}`;
  const r = await llamar(env, env.MODELO_LECTURA || MODELO_LECTURA, [{ type: "text", text: p }], false);
  const okT = new Set(T.map(t => t.id)), okC = new Set(C.map(c => c.c)), d = r.datos || {};
  const op = (Array.isArray(d.opciones) ? d.opciones : []).filter(o => o && okT.has(o.tipo)).slice(0, 3).map(o => ({ tipo: o.tipo, razon: String(o.razon || "").slice(0, 80) }));
  return { opciones: op, segura: d.segura === true && op.length > 0, centro: okC.has(d.centro) ? d.centro : "", modelo: r.modelo };
}
export async function convertirMoneda(datos, fetchFn) {
  const m = String(datos && datos.moneda || "CLP").toUpperCase().replace("US$", "USD");
  if (!datos || m === "CLP" || !INDICADOR[m]) return datos;
  const monto = typeof datos.total_moneda === "number" ? datos.total_moneda : parseFloat(String(datos.total_moneda || "").replace(",", "."));
  if (!(monto > 0)) return datos;
  const v = await valorMoneda(m, datos.fecha, fetchFn);
  datos.neto = 0; datos.iva = 0;
  if (!v) { datos.total = 0; (datos.problemas = datos.problemas || []).push(`no se pudo obtener el valor del ${m === "USD" ? "dólar" : "euro"} de la fecha: escribe el total en pesos`); datos.cambio = { moneda: m, monto }; return datos }
  datos.total = Math.round(monto * v.valor); datos.cambio = { moneda: m, monto, valor: v.valor, fecha: v.fecha };
  return datos;
}

export const PROMPT_BOLETA = `Eres un asistente contable chileno. Lee la foto de este documento tributario (boleta, factura, boleta de honorarios, vale o comprobante) y devuelve SOLO un objeto JSON, sin texto adicional ni marcas de código, con esta forma exacta:
{"legible":true,"tipo":"boleta|factura|boleta_honorarios|vale|otro","emisor":"razón social o nombre del comercio","rut_emisor":"12.345.678-9 o cadena vacía","folio":"número de boleta o factura, cadena vacía si no se ve","fecha":"AAAA-MM-DD o cadena vacía","hora":"HH:MM impresa en el documento, o cadena vacía","neto":0,"iva":0,"total":0,"propina":0,"moneda":"CLP","glosa":"descripción breve de lo comprado, máximo 12 palabras","rut_receptor":"RUT del cliente al que se emitió (solo facturas), o cadena vacía","receptor":"razón social del cliente (solo facturas), o cadena vacía","problemas":["lista de problemas: foto borrosa, documento cortado, no se lee el total, no se lee el folio, no se lee la fecha, no es un documento tributario, etc."],"confianza":0.0}
Reglas: los montos son números enteros en pesos chilenos, sin puntos ni símbolos; si el documento no desglosa IVA (boletas), deja neto e iva en 0 y pon solo el total; si el total no se lee con claridad, pon 0 y agrégalo a problemas; la fecha en formato AAAA-MM-DD, interpretando día/mes/año como en Chile; el RUT con puntos y guion si aparece; verifica el dígito verificador del RUT (módulo 11) y, si no calza, vuelve a mirar cada número (es común confundir 0, 6, 8 y 9, o 1 y 7); si aun así no calza, déjalo tal como se ve y agrega "RUT con dígito verificador que no calza" a problemas; en facturas, revisa que neto + IVA = total y que el IVA sea el 19 % del neto (salvo facturas exentas); confianza entre 0 y 1 según cuán seguro estés del total, la fecha y el folio. Comprobantes de pago con tarjeta: si dice «VÁLIDO COMO BOLETA» (Mercado Pago, Getnet, SumUp, Transbank u otro), tipo "boleta" y en "folio" el número de operación o transacción impreso (por ejemplo «Operación #188215521371» → "188215521371"); si no dice «válido como boleta» (solo «comprobante de venta», «copia cliente», «acepto pagar según contrato»), tipo "vale". En "folio" va solo el número del documento: nunca uses números de la dirección del comercio (calle, número o local), del terminal, de la caja, de la tienda, de la tarjeta ni del código de autorización. Moneda: si el documento está en otra moneda (por ejemplo dólares, «USD», «US$»), pon en "moneda" su código ("USD" o "EUR") y en "total_moneda" el total con decimales tal como aparece, como número con punto decimal (por ejemplo 23.8); en ese caso deja "total", "neto" e "iva" en 0 (el servidor calcula los pesos). Si la imagen no es un documento tributario, legible=false y explica en problemas. "propina": la propina o el servicio voluntario si el comprobante lo muestra aparte (0 si no); el total es lo que se pagó, con la propina incluida si está en el mismo comprobante. Comprobantes de peaje o de autopista (concesionarias): en "folio" va el número que identifica el ticket, el que sigue a «Id:», «N°» o «Ticket», o el número impreso junto al código de barras, sin espacios (ese número distingue cada pasada); en "hora" la hora impresa. En "problemas" anota solo lo que pueda dejar mal leído un dato (total, fecha, folio, RUT, neto o IVA); si los datos se leen bien, deja la lista vacía (no anotes manchas, arrugas, propinas ni redondeos que no cambian los datos).`;

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
    else if (!String(x.folio || "").trim() && /peaje|concesionari|autopista|autov[ií]a|t[uú]nel/i.test(`${x.emisor || ""} ${x.glosa || ""}`)) m.push("no se leyó el número del ticket de peaje"); /* v234: sin número no se distingue una pasada de una foto repetida */
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
/* v142: revisión diaria de la clave de Claude (la llama scheduled en worker.js). Devuelve { estado, detalle }:
   ok, sin_clave, clave (401/403), modelo (404), creditos (402 o saldo agotado), temporal (429, 5xx, sin conexión) u otro. */
export function clasificarClaude(s, tipo, mensaje, modelo) {
  if (s === 401) return { estado: "clave", detalle: "La clave de Claude no es válida o fue borrada." };
  if (s === 403) return { estado: "clave", detalle: "La clave de Claude no tiene permiso para usar los modelos." };
  if (s === 402 || /credit balance|billing/i.test(mensaje || "") || tipo === "billing_error") return { estado: "creditos", detalle: "La cuenta de Claude no tiene créditos o tiene un problema de pago." };
  if (s === 404) return { estado: "modelo", detalle: `El modelo ${modelo} ya no está disponible.` };
  if (s === 429 || s >= 500) return { estado: "temporal", detalle: `Claude respondió ${s} (problema temporal).` };
  return { estado: "otro", detalle: `Claude respondió ${s}${tipo ? " (" + tipo + ")" : ""}.` };
}
export async function revisarClaveClaude(env) {
  if (!env.ANTHROPIC_API_KEY) return { estado: "sin_clave", detalle: "No hay clave de Claude cargada en el servidor." };
  const h = { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" };
  const modelos = [...new Set([env.MODELO_LECTURA || MODELO_LECTURA, env.MODELO_REVISION || MODELO_REVISION])];
  const error = async (r, m) => { let j = null; try { j = await r.json(); } catch (e) {} const e = (j && j.error) || {}; return clasificarClaude(r.status, e.type || "", e.message || "", m); };
  try {
    for (const m of modelos) { const r = await fetch("https://api.anthropic.com/v1/models/" + encodeURIComponent(m), { headers: h }); if (!r.ok) return await error(r, m); }
    const b = { model: modelos[0], max_tokens: 16, messages: [{ role: "user", content: "Responde solo: ok" }] };
    if (/claude-haiku-5/.test(modelos[0])) b.thinking = { type: "disabled" };
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify(b) });
    if (!r.ok) return await error(r, modelos[0]);
    return { estado: "ok", detalle: "La clave funciona." };
  } catch (e) { return { estado: "temporal", detalle: "No se pudo conectar con Claude." }; }
}
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
