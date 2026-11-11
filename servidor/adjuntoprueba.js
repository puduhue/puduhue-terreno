/*
  v181.1 · Prueba temporal: adjuntar archivos a un asiento de FinnegansGO (para preparar el adjunto de las fotos de las rendiciones)
  ------------------------------------------------------------------------------------------------------------------------------
  Uso: Administración → Servidor y Finnegans → Conexión con Finnegans, reporte «adjuntoPrueba» (solo el administrador, igual que
  /reporte). Parámetros opcionales, uno por línea:
    (sin parámetros)             SOLO LECTURA: el servidor lee la guía de la Base de Conocimiento de Finnegans «¿Cómo adjuntar
                                 archivos a una transacción por API?» (y los temas parecidos y documentos que enlace), que las
                                 sesiones de Claude no pueden abrir. parte=2, parte=3… muestran el resto del texto.
    id=<IdentificacionExterna>   SOLO LECTURA: busca ese asiento (por ejemplo «RD-…» o «AG - 3865») y muestra su cabecera
                                 (TransaccionID y los campos que podrían listar adjuntos).
    id=… y subir=1               PRUEBA REAL: adjunta a ese asiento un PDF de una página que dice «PRUEBA API PUDUHUE - ELIMINAR»
                                 (descripción «PRUEBA API - ELIMINAR»). Prueba las formas posibles de la API (PUT/POST,
                                 multipart o el PDF directo; api y teamplace) y se detiene en la primera que Finnegans acepte.
                                 Después hay que quitar ese adjunto en FinnegansGO.
    ruta=<ruta>                  (opcional, con subir=1) otra ruta de la API en vez de custom/files/upload, si la guía dice otra.
  La respuesta usa el formato de /reporte (filas «paso · resultado · detalle») para que la pantalla de prueba de la app la muestre
  sin cambios. La clave de Finnegans nunca va en la respuesta. Quitar este archivo cuando termine la prueba.
*/
const ENTIDAD = "asientoGenerico";
const GUIA = "https://bc.finneg.com";
const TEMA_GUIA = 2835; // «¿Cómo adjuntar archivos a una transacción por API?»
const DOC_SPEC = "10hZ7iEYY0zOQKfbcxgmSA-Tc8XOnraR4"; // «Especificación funcional» uploadFileCustom (Google Docs), si es pública
const RUTA_SUBIR = "custom/files/upload";
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
export function formasSubir(bases, ruta) {
  const L = [];
  for (const base of bases) {
    L.push({ base, ruta, metodo: "PUT", cuerpo: "multipart" });
    L.push({ base, ruta, metodo: "POST", cuerpo: "multipart" });
    L.push({ base, ruta, metodo: "PUT", cuerpo: "pdf" });
  }
  return L;
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
  if (!subir) return salida(filas, "asiento, solo lectura");

  // 3. Subir un PDF de prueba, probando las formas posibles hasta que una funcione
  const ruta = String(q.get("ruta") || RUTA_SUBIR).trim().replace(/^\/+|\/+$/g, "").replace(/[^A-Za-z0-9/_-]/g, "") || RUTA_SUBIR;
  const pdf = pdfPrueba("PRUEBA API PUDUHUE - ELIMINAR"), nombre = "PRUEBA_API_PUDUHUE_ELIMINAR.pdf";
  const params = { identificacionExterna: asiento.IdentificacionExterna || id, transaccionID: trans, descripcion: "PRUEBA API - ELIMINAR" };
  let exito = null;
  for (const f of formasSubir(bases, ruta)) {
    const r = await subirUna(f, tok, params, pdf, nombre);
    const quien = `${f.metodo} ${f.base.includes("teamplace") ? "teamplace" : "api"}/${f.ruta} · ${f.cuerpo === "multipart" ? "multipart (campo file)" : "PDF directo"}`;
    fila(`3. ${quien}`, r.ok ? `estado ${r.estado}: ACEPTADO · revisar el adjunto en FinnegansGO y quitarlo` : `estado ${r.estado}`, sinClave(String(r.texto || "").slice(0, 800), tok));
    if (r.ok) { exito = f; break; }
    if (filas.length >= 14) break;
  }
  fila("4. Resultado", exito ? `se adjuntó con ${exito.metodo} (${exito.cuerpo}) en ${exito.base.includes("teamplace") ? "teamplace" : "api"}` : "ninguna forma funcionó: revisar los motivos de arriba y la guía (sin parámetros)", `Parámetros enviados: ${sinClave(JSON.stringify(params), tok)} · archivo ${nombre} (${pdf.length} bytes)`);
  return salida(filas, subir ? "prueba real de adjunto" : "asiento");
}
