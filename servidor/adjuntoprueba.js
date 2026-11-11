/*
  v181.1-v181.2 · Prueba temporal: adjuntar archivos a un asiento de FinnegansGO (para preparar el adjunto de las fotos de las rendiciones)
  ------------------------------------------------------------------------------------------------------------------------------
  Uso: Administración → Servidor y Finnegans → Conexión con Finnegans, reporte «adjuntoPrueba» (solo el administrador, igual que
  /reporte). Parámetros opcionales, uno por línea:
    (sin parámetros)             SOLO LECTURA: el servidor lee la guía de la Base de Conocimiento de Finnegans «¿Cómo adjuntar
                                 archivos a una transacción por API?» (y los temas parecidos y documentos que enlace), que las
                                 sesiones de Claude no pueden abrir. parte=2, parte=3… muestran el resto del texto.
    id=<IdentificacionExterna>   SOLO LECTURA: busca ese asiento (por ejemplo «RD-…» o «AG - 3865») y muestra su cabecera
                                 (TransaccionID y los campos que podrían listar adjuntos).
                                 (v181.2) también lista sus adjuntos (custom/files/list/{Entidad}/{Código}, guía 2975).
    id=… y subir=1               PRUEBA REAL: adjunta a ese asiento un PDF de una página que dice «PRUEBA API PUDUHUE - ELIMINAR»
                                 (descripción «PRUEBA API - ELIMINAR»). Se detiene en la primera forma que Finnegans acepte:
                                 (v181.2) 1.º la de la guía 2835 (PUT teamplace custom/files/upload?identificacionExterna&
                                 transaccionID&descripcion, form-data con el campo file); 2.º la de la guía 3889 y su
                                 especificación (POST api uploadFileCustom/subidaNuevoArchivo, JSON con clase, Tipo 10,
                                 NombreLogico, Descripcion, Empresa, Codigo = identificación externa y base64), con las clases
                                 de clase=… o, si no se indica, las probables. Después vuelve a listar los adjuntos para
                                 confirmar. Hay que quitar ese adjunto en FinnegansGO.
  La respuesta usa el formato de /reporte (filas «paso · resultado · detalle») para que la pantalla de prueba de la app la muestre
  sin cambios. La clave de Finnegans nunca va en la respuesta. Quitar este archivo cuando termine la prueba.
*/
const ENTIDAD = "asientoGenerico";
const GUIA = "https://bc.finneg.com";
const TEMA_GUIA = 2835; // «¿Cómo adjuntar archivos a una transacción por API?»
const DOC_SPEC = "10hZ7iEYY0zOQKfbcxgmSA-Tc8XOnraR4"; // «Especificación funcional» uploadFileCustom (Google Docs), si es pública
const RUTA_SUBIR = "custom/files/upload";
const TEAM = "https://api.teamplace.finneg.com/api";
const CLASES = ["AsientoGenericoVO", "AsientoVO", "TransaccionVO", "OperacionVO"]; // la guía 3889 solo da OperacionVO (facturas)
const TROZO = 1400, FILAS_PARTE = 14;

const sinClave = (s, tok) => { let t = String(s == null ? "" : s); if (tok) t = t.split(tok).join("***"); return t.replace(/ACCESS_TOKEN=[^&\s"]+/gi, "ACCESS_TOKEN=***"); };
const salida = (filas, modo) => ({ ok: true, reporte: `adjuntoPrueba (${modo})`, hora: new Date().toISOString(), datos: filas });

/* HTML de la Base de Conocimiento (Discourse) a texto con saltos de línea; deja los enlaces entre paréntesis */
export function htmlATexto(h) {
  return String(h || "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, u, t) => `${t} (${u})`)
    .replace(/<img [^>]*src="([^"]+)"[^>]*>/gi, " [imagen: $1] ")
    .replace(/<(br|\/p|\/li|\/h\d|\/pre|\/tr|\/blockquote)[^>]*>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
/* texto en trozos para las filas (la pantalla muestra 15 filas por consulta) */
export function trozos(t, n = TROZO) {
  const out = []; let s = String(t || "");
  while (s.length > n) { let i = s.lastIndexOf("\n", n); if (i < n / 2) i = s.lastIndexOf(" ", n); if (i < n / 2) i = n; out.push(s.slice(0, i).trim()); s = s.slice(i); }
  if (s.trim()) out.push(s.trim());
  return out;
}
async function leer(u, como = "json") {
  try { const r = await fetch(u, { headers: { Accept: como === "json" ? "application/json" : "text/plain,*/*", "User-Agent": "puduhue-terreno-servidor" } });
    const t = await r.text(); let d = null; if (como === "json") try { d = JSON.parse(t); } catch (e) {}
    return { estado: r.status, ok: r.ok, datos: d, texto: t };
  } catch (e) { return { estado: "sin conexión", ok: false, datos: null, texto: "" }; }
}

/* 1. La guía: el tema 2835, los temas que encuentre la búsqueda «adjuntar archivos api» y los Google Docs que enlacen */
export async function leerGuia() {
  const partes = [], vistos = new Set(), docs = new Set([DOC_SPEC]), estados = [];
  const tema = async id => {
    if (vistos.has(id) || vistos.size >= 4) return; vistos.add(id);
    const r = await leer(`${GUIA}/t/${id}.json`); estados.push(`tema ${id}: ${r.estado}`);
    const posts = r.datos && r.datos.post_stream && Array.isArray(r.datos.post_stream.posts) ? r.datos.post_stream.posts : [];
    if (!posts.length) return;
    const txt = posts.map((p, i) => `${i ? `— Respuesta ${i} (${p.username || ""}):\n` : ""}${htmlATexto(p.cooked)}`).join("\n\n");
    partes.push(`==== ${r.datos.title || "Tema " + id} (${GUIA}/t/${id}) ====\n${txt}`);
    for (const m of txt.matchAll(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{20,})/g)) docs.add(m[1]);
  };
  await tema(TEMA_GUIA);
  const b = await leer(`${GUIA}/search.json?q=${encodeURIComponent("adjuntar archivos api")}`); estados.push(`búsqueda: ${b.estado}`);
  const T = b.datos && Array.isArray(b.datos.topics) ? b.datos.topics : [];
  for (const t of T.filter(t => /adjunt|archiv|upload/i.test(t.title || "")).slice(0, 3)) await tema(t.id);
  for (const id of [...docs].slice(0, 2)) {
    const r = await leer(`https://docs.google.com/document/d/${id}/export?format=txt`, "texto"); estados.push(`documento ${id.slice(0, 8)}…: ${r.estado}`);
    if (r.ok && r.texto && !/<html/i.test(r.texto.slice(0, 500))) partes.push(`==== Google Docs ${id} ====\n${r.texto.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim()}`);
  }
  return { texto: partes.join("\n\n"), estados, temas: T.map(t => `${t.id}: ${t.title}`).slice(0, 10) };
}

/* PDF mínimo de una página con un texto (sin bibliotecas): para la prueba de adjunto */
export function pdfPrueba(texto) {
  const t = String(texto).replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
  const flujo = `BT /F1 18 Tf 60 760 Td (${t}) Tj ET`;
  const obj = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let s = "%PDF-1.4\n"; const off = [];
  obj.forEach((o, i) => { off.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = s.length;
  s += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  s += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return new TextEncoder().encode(s);
}

/* las formas de subir que se prueban, en orden; se detiene en la primera que Finnegans acepte (2xx) */
export function formasSubir(clases) {
  return [
    { base: TEAM, ruta: RUTA_SUBIR, metodo: "PUT", cuerpo: "multipart", nombre: "PUT teamplace custom/files/upload · form-data (guía 2835)" },
    ...clases.map(c => ({ json: true, clase: c, nombre: `POST api uploadFileCustom/subidaNuevoArchivo · JSON clase ${c} (guía 3889)` })),
  ];
}
export const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
async function subirJson(tok, cuerpo) {
  try { const r = await fetch(`https://api.finneg.com/api/uploadFileCustom/subidaNuevoArchivo?ACCESS_TOKEN=${encodeURIComponent(tok)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const t = await r.text(); let ok = r.ok; try { const j = JSON.parse(t); if (j && j.status != null && +j.status !== 200) ok = false; } catch (e) {}
    return { estado: r.status, ok, texto: t };
  } catch (e) { return { estado: "sin conexión", ok: false, texto: String(e && e.message || "") }; }
}
/* adjuntos de una transacción (guía 2975: custom/files/list/{Entidad}/{Código}); se prueban las combinaciones probables */
export async function listaAdjuntos(tok, idExt, trans) {
  const combos = [["asientoGenerico", idExt], ["BSTransaccion", trans], ["BSTransaccion", idExt], ["transaccion", trans]].filter(([, c]) => c !== "" && c != null);
  const est = []; let hallado = null;
  for (const [ent, cod] of combos) {
    const r = await leer(`${TEAM}/custom/files/list/${encodeURIComponent(ent)}/${encodeURIComponent(cod)}?ACCESS_TOKEN=${encodeURIComponent(tok)}`);
    est.push(`${ent}/${cod}: ${r.estado}`);
    if (r.ok && !hallado) hallado = { ent, cod, texto: r.texto };
  }
  return hallado ? [`${hallado.ent}/${hallado.cod} respondió`, sinClave(`${hallado.texto.slice(0, 1200)} · (${est.join(" · ")})`, tok)] : ["ninguna combinación respondió", sinClave(est.join(" · "), tok)];
}
async function subirUna(f, tok, q, pdf, nombre) {
  const u = new URL(`${f.base}/${f.ruta}`);
  u.searchParams.set("ACCESS_TOKEN", tok);
  for (const [k, v] of Object.entries(q)) if (v != null && v !== "") u.searchParams.set(k, String(v));
  let body, headers = { Accept: "application/json" };
  if (f.cuerpo === "multipart") {
    body = new FormData();
    for (const [k, v] of Object.entries(q)) if (v != null && v !== "") body.append(k, String(v));
    body.append("file", new Blob([pdf], { type: "application/pdf" }), nombre);
  } else { u.searchParams.set("fileName", nombre); body = pdf; headers["Content-Type"] = "application/pdf"; }
  try { const r = await fetch(u.toString(), { method: f.metodo, headers, body }); return { estado: r.status, ok: r.ok, texto: await r.text() }; }
  catch (e) { return { estado: "sin conexión", ok: false, texto: String(e && e.message || "") }; }
}

export async function pruebaAdjunto(env, q, { tokenFinnegans, FINN }) {
  const filas = [], fila = (paso, resultado, detalle = "") => filas.push({ paso, resultado, detalle });
  const id = String(q.get("id") || "").trim().slice(0, 60);
  const subir = q.get("subir") === "1";

  if (!id) {
    const parte = Math.max(1, parseInt(q.get("parte"), 10) || 1);
    const g = await leerGuia();
    const T = trozos(g.texto), total = Math.max(1, Math.ceil(T.length / FILAS_PARTE));
    fila("1. Base de Conocimiento de Finnegans", g.texto ? `${T.length} trozos de texto · parte ${parte} de ${total}${parte < total ? ` (sigue con parte=${parte + 1})` : ""}` : "no se pudo leer la guía", `${g.estados.join(" · ")}${g.temas.length ? ` · temas encontrados: ${g.temas.join(" / ")}` : ""}`);
    T.slice((parte - 1) * FILAS_PARTE, parte * FILAS_PARTE).forEach((t, i) => fila(`2. Texto ${(parte - 1) * FILAS_PARTE + i + 1}`, "", t));
    return salida(filas, "guía, solo lectura");
  }

  // 1. El asiento (solo lectura)
  const tok = await tokenFinnegans(env);
  const bases = [FINN, "https://api.teamplace.finneg.com/api"];
  let asiento = null; const intentos = [];
  for (const base of bases) {
    const r = await leer(`${base}/${ENTIDAD}/${encodeURIComponent(id)}?ACCESS_TOKEN=${encodeURIComponent(tok)}`);
    intentos.push(`${base.includes("teamplace") ? "teamplace" : "api"}: ${r.estado}`);
    const d = Array.isArray(r.datos) && r.datos.length === 1 ? r.datos[0] : r.datos;
    if (r.ok && d && typeof d === "object" && !Array.isArray(d)) { asiento = d; break; }
  }
  if (!asiento) { fila("1. Asiento", `no se encontró ${id}`, sinClave(intentos.join(" · "), tok)); return salida(filas, "asiento"); }
  const { AsientoItems, AsientoItemsAjuste, ...cab } = asiento;
  const trans = asiento.TransaccionID ?? asiento.TransaccionId ?? asiento.transaccionID ?? "";
  fila("1. Asiento", `${asiento.Nombre || id} · TransaccionID ${trans || "(no viene)"} · ${Array.isArray(AsientoItems) ? AsientoItems.length : 0} líneas`, sinClave(JSON.stringify(cab).slice(0, 2500), tok));
  const camposArch = Object.keys(asiento).filter(k => /adjunt|archiv|file|attach|document/i.test(k));
  fila("2. Campos de archivos en el asiento", camposArch.length ? camposArch.join(", ") : "ninguno", camposArch.length ? sinClave(JSON.stringify(Object.fromEntries(camposArch.map(k => [k, asiento[k]]))).slice(0, 1500), tok) : "");

  const idExt = asiento.IdentificacionExterna || id, empresa = String(asiento.EmpresaID ?? env.FINN_EMPRESA ?? "2");
  fila("3. Adjuntos del asiento (antes)", ...(await listaAdjuntos(tok, idExt, trans)));
  if (!subir) return salida(filas, "asiento, solo lectura");

  // 4. Subir un PDF de prueba, por la forma de la guía 2835 y, si no, por la de la guía 3889; se detiene en la primera que sirva
  const pdf = pdfPrueba("PRUEBA API PUDUHUE - ELIMINAR"), nombre = "PRUEBA_API_PUDUHUE_ELIMINAR.pdf";
  const params = { identificacionExterna: idExt, transaccionID: trans, descripcion: "PRUEBA API - ELIMINAR" };
  const clases = String(q.get("clase") || "").split(",").map(x => x.trim()).filter(x => /^[A-Za-z]{1,40}$/.test(x));
  let exito = null;
  for (const f of formasSubir(clases.length ? clases : CLASES)) {
    const r = f.json ? await subirJson(tok, { clase: f.clase, Tipo: "10", NombreLogico: nombre, Descripcion: "PRUEBA API - ELIMINAR", Empresa: empresa, Codigo: idExt, base64: b64(pdf) })
      : await subirUna(f, tok, params, pdf, nombre);
    fila(`4. ${f.nombre}`, r.ok ? `estado ${r.estado}: ACEPTADO · revisar el adjunto en FinnegansGO y quitarlo` : `estado ${r.estado}`, sinClave(String(r.texto || "").slice(0, 600), tok));
    if (r.ok) { exito = f; break; }
  }
  fila("5. Adjuntos del asiento (después)", ...(await listaAdjuntos(tok, idExt, trans)));
  fila("6. Resultado", exito ? `se adjuntó con: ${exito.nombre}` : "ninguna forma funcionó: revisar los motivos de arriba", `Parámetros: ${sinClave(JSON.stringify({ ...params, Empresa: empresa }), tok)} · archivo ${nombre} (${pdf.length} bytes)`);
  return salida(filas, "prueba real de adjunto");
}
