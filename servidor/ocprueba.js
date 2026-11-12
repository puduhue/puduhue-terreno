/*
  v183.1 · Prueba temporal: adjuntar un archivo a una ORDEN DE COMPRA de FinnegansGO
  ---------------------------------------------------------------------------------
  Para saber qué valor de «clase» pide uploadFileCustom/subidaNuevoArchivo cuando la transacción es una orden de compra (para los
  asientos es AsientoGenericoVO, v182; la guía de Finnegans solo nombra OperacionVO, para facturas).
  Uso: Administración → Servidor y Finnegans → Conexión con Finnegans, reporte «ocPrueba» (solo el administrador, igual que
  /reporte). Parámetros, uno por línea:
    (sin parámetros)        SOLO LECTURA: el servidor lee en la Base de Conocimiento de Finnegans los temas de adjuntar archivos y
                            de órdenes de compra por API (las sesiones de Claude no pueden abrirla). parte=2, parte=3… siguen.
    listar=1                SOLO LECTURA: busca con qué nombre entrega la API las órdenes de compra (ordenCompra, ordenDeCompra…;
                            ent=… para probar otro) y muestra las últimas, para elegir una de prueba. dias=N cambia el período (45).
    oc=<código>             SOLO LECTURA: busca esa orden de compra (su identificación externa o su número) y muestra su cabecera.
    oc=… y subir=1          PRUEBA REAL: adjunta a esa orden un PDF de una página que dice «PRUEBA API PUDUHUE - ELIMINAR», probando
                            las clases probables (o las de clase=A,B) con el código dado y con la identificación externa de la
                            orden. Se detiene en la primera que Finnegans acepte. codigo=… cambia el código; empresa=… la empresa.
                            Después hay que mirar el clip de la orden en FinnegansGO y quitar el adjunto.
  La respuesta usa el formato de /reporte (filas «paso · resultado · detalle»). La clave de Finnegans nunca va en la respuesta.
  Quitar este archivo cuando termine la prueba.
*/
const GUIA = "https://bc.finneg.com";
const DOC_SPEC = "10hZ7iEYY0zOQKfbcxgmSA-Tc8XOnraR4"; // «Especificación funcional» de uploadFileCustom (Google Docs)
const TEAM = "https://api.teamplace.finneg.com/api";
export const ENTIDADES = ["ordenCompra", "ordenDeCompra", "ordencompra", "pedidoCompra", "ordenCompraProveedor"];
export const CLASES = ["OperacionVO", "OrdenCompraVO", "OrdenDeCompraVO", "PedidoCompraVO", "TransaccionVO"];
const BUSQUEDAS = ["adjuntar archivos api", "orden de compra api"];
const TROZO = 1400, FILAS_PARTE = 14;

const sinClave = (s, tok) => { let t = String(s == null ? "" : s); if (tok) t = t.split(tok).join("***"); return t.replace(/ACCESS_TOKEN=[^&\s"]+/gi, "ACCESS_TOKEN=***"); };
const salida = (filas, modo) => ({ ok: true, reporte: `ocPrueba (${modo})`, hora: new Date().toISOString(), datos: filas });
const nombres = (v, def) => { const L = String(v || "").split(",").map(x => x.trim()).filter(x => /^[A-Za-z]{1,40}$/.test(x)); return L.length ? L : def; };

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

/* 1. La guía: los temas que encuentren las búsquedas (adjuntar archivos; orden de compra por API) y la especificación en Google Docs */
export async function leerGuia() {
  const partes = [], vistos = new Set(), docs = new Set([DOC_SPEC]), estados = [], hallados = [];
  const tema = async id => {
    if (vistos.has(id) || vistos.size >= 6) return; vistos.add(id);
    const r = await leer(`${GUIA}/t/${id}.json`); estados.push(`tema ${id}: ${r.estado}`);
    const posts = r.datos && r.datos.post_stream && Array.isArray(r.datos.post_stream.posts) ? r.datos.post_stream.posts : [];
    if (!posts.length) return;
    const txt = posts.map((p, i) => `${i ? `— Respuesta ${i} (${p.username || ""}):\n` : ""}${htmlATexto(p.cooked)}`).join("\n\n");
    partes.push(`==== ${r.datos.title || "Tema " + id} (${GUIA}/t/${id}) ====\n${txt}`);
    for (const m of txt.matchAll(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{20,})/g)) docs.add(m[1]);
  };
  for (const q of BUSQUEDAS) {
    const b = await leer(`${GUIA}/search.json?q=${encodeURIComponent(q)}`); estados.push(`búsqueda «${q}»: ${b.estado}`);
    const T = b.datos && Array.isArray(b.datos.topics) ? b.datos.topics : [];
    T.forEach(t => hallados.push(`${t.id}: ${t.title}`));
    /* primero los de adjuntos; de órdenes de compra, solo los que hablan de la API o de adjuntar */
    for (const t of T.filter(t => /adjunt|archiv|upload/i.test(t.title || "")).slice(0, 3)) await tema(t.id);
    for (const t of T.filter(t => /orden(es)? de compra/i.test(t.title || "") && /api|adjunt/i.test(t.title || "")).slice(0, 2)) await tema(t.id);
  }
  for (const id of [...docs].slice(0, 2)) {
    const r = await leer(`https://docs.google.com/document/d/${id}/export?format=txt`, "texto"); estados.push(`documento ${id.slice(0, 8)}…: ${r.estado}`);
    if (r.ok && r.texto && !/<html/i.test(r.texto.slice(0, 500))) partes.push(`==== Google Docs ${id} ====\n${r.texto.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim()}`);
  }
  return { texto: partes.join("\n\n"), estados, temas: [...new Set(hallados)].slice(0, 16) };
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
export const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

/* resumen de una transacción para mostrarla en una fila: lo que sirve para reconocerla y para adjuntarle */
const CAMPOS = ["Nombre", "NumeroDocumento", "NumeroInterno", "IdentificacionExterna", "Fecha", "FechaComprobante", "Proveedor", "ProveedorID", "OrganizacionID", "Organizacion", "EmpresaID", "Empresa", "TransaccionID", "TransaccionTipoID", "TransaccionSubtipoID", "Estado", "ImporteTotal", "Total", "Descripcion"];
export function resumenDe(x) {
  if (!x || typeof x !== "object") return "";
  const o = {}; for (const k of CAMPOS) if (x[k] != null && x[k] !== "" && typeof x[k] !== "object") o[k] = x[k];
  return JSON.stringify(Object.keys(o).length ? o : Object.fromEntries(Object.entries(x).filter(([, v]) => v == null || typeof v !== "object").slice(0, 14)));
}
const unaDe = d => { const x = Array.isArray(d) && d.length === 1 ? d[0] : d; return x && typeof x === "object" && !Array.isArray(x) ? x : null; };
const dia = (n, fmt) => { const d = new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); return fmt === "dma" ? d.split("-").reverse().join("-") : d; };

/* 2. Con qué nombre entrega la API las órdenes de compra y cuáles son las últimas */
export async function listarOC(tok, FINN, ents, dias) {
  const intentos = [];
  for (const ent of ents) for (const base of [FINN, TEAM]) for (const desde of [dia(dias), dia(dias, "dma")]) {
    const r = await leer(`${base}/${encodeURIComponent(ent)}/list?ACCESS_TOKEN=${encodeURIComponent(tok)}&updatedSince=${desde}`);
    intentos.push(`${ent} (${base === TEAM ? "teamplace" : "api"}, ${desde}): ${r.estado}`);
    if (r.ok && Array.isArray(r.datos)) return { ent, base, desde, lista: r.datos, intentos };
    if (r.estado === 404 || r.estado === 405) break; /* esa entidad no existe en esa dirección: no vale la pena la otra fecha */
  }
  return { lista: null, intentos };
}
/* 3. Una orden de compra por su código */
export async function buscarOC(tok, FINN, ents, cod) {
  const intentos = [];
  for (const ent of ents) for (const base of [FINN, TEAM]) {
    const r = await leer(`${base}/${encodeURIComponent(ent)}/${encodeURIComponent(cod)}?ACCESS_TOKEN=${encodeURIComponent(tok)}`);
    intentos.push(`${ent} (${base === TEAM ? "teamplace" : "api"}): ${r.estado}`);
    const x = r.ok ? unaDe(r.datos) : null;
    if (x) return { oc: x, ent, base, intentos };
  }
  return { oc: null, intentos };
}
async function subirJson(tok, FINN, cuerpo) {
  try { const r = await fetch(`${FINN}/uploadFileCustom/subidaNuevoArchivo?ACCESS_TOKEN=${encodeURIComponent(tok)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const t = await r.text(); let ok = r.ok; try { const j = JSON.parse(t); if (j && j.status != null && +j.status !== 200) ok = false; } catch (e) {}
    return { estado: r.status, ok, texto: t };
  } catch (e) { return { estado: "sin conexión", ok: false, texto: String(e && e.message || "") }; }
}

export async function pruebaOC(env, q, { tokenFinnegans, FINN }) {
  const filas = [], fila = (paso, resultado, detalle = "") => filas.push({ paso, resultado, detalle });
  const cod = String(q.get("oc") || "").trim().slice(0, 80);
  const ents = nombres(q.get("ent"), ENTIDADES);

  if (!cod && q.get("listar") !== "1") {
    const parte = Math.max(1, parseInt(q.get("parte"), 10) || 1);
    const g = await leerGuia();
    const T = trozos(g.texto), total = Math.max(1, Math.ceil(T.length / FILAS_PARTE));
    fila("1. Base de Conocimiento de Finnegans", g.texto ? `${T.length} trozos de texto · parte ${parte} de ${total}${parte < total ? ` (sigue con parte=${parte + 1})` : ""}` : "no se pudo leer la guía", `${g.estados.join(" · ")}${g.temas.length ? ` · temas encontrados: ${g.temas.join(" / ")}` : ""}`);
    T.slice((parte - 1) * FILAS_PARTE, parte * FILAS_PARTE).forEach((t, i) => fila(`2. Texto ${(parte - 1) * FILAS_PARTE + i + 1}`, "", t));
    return salida(filas, "guía, solo lectura");
  }

  const tok = await tokenFinnegans(env);
  if (!cod) {
    const dias = Math.min(400, Math.max(1, parseInt(q.get("dias"), 10) || 45));
    const L = await listarOC(tok, FINN, ents, dias);
    if (!L.lista) { fila("1. Órdenes de compra", "ningún nombre respondió con un listado", sinClave(L.intentos.join(" · "), tok)); return salida(filas, "listado, solo lectura"); }
    fila("1. Órdenes de compra", `la API las entrega como «${L.ent}» · ${L.lista.length} desde ${L.desde}`, sinClave(L.intentos.join(" · "), tok));
    L.lista.slice(-12).reverse().forEach((x, i) => fila(`2. Orden ${i + 1}`, String(x && (x.Nombre || x.NumeroDocumento || x.IdentificacionExterna || x.Codigo || "")), sinClave(resumenDe(x).slice(0, 900), tok)));
    return salida(filas, "listado, solo lectura");
  }

  // 1. La orden de compra (solo lectura)
  const B = await buscarOC(tok, FINN, ents, cod);
  if (B.oc) fila("1. Orden de compra", `${B.oc.Nombre || cod} · se consulta como «${B.ent}»`, sinClave(`${resumenDe(B.oc).slice(0, 1500)} · (${B.intentos.join(" · ")})`, tok));
  else fila("1. Orden de compra", `no se pudo consultar ${cod} con los nombres probados`, sinClave(`${B.intentos.join(" · ")} · La prueba de adjunto no necesita esta consulta: usa el código tal como se escribió.`, tok));
  const camposArch = B.oc ? Object.keys(B.oc).filter(k => /adjunt|archiv|file|attach/i.test(k)) : [];
  if (B.oc) fila("2. Campos de archivos en la orden", camposArch.length ? camposArch.join(", ") : "ninguno", camposArch.length ? sinClave(JSON.stringify(Object.fromEntries(camposArch.map(k => [k, B.oc[k]]))).slice(0, 1200), tok) : "");
  if (q.get("subir") !== "1") return salida(filas, "orden de compra, solo lectura");

  // 3. Subir un PDF de prueba: cada clase con cada código; se detiene en la primera que Finnegans acepte
  const pdf = pdfPrueba("PRUEBA API PUDUHUE - ELIMINAR"), nombre = "PRUEBA_API_PUDUHUE_ELIMINAR.pdf", base64 = b64(pdf);
  const empresa = String(q.get("empresa") || (B.oc && B.oc.EmpresaID) || env.FINN_EMPRESA || "2").trim().slice(0, 10);
  const codigos = [...new Set([String(q.get("codigo") || "").trim(), B.oc && B.oc.IdentificacionExterna ? String(B.oc.IdentificacionExterna).trim() : "", cod].filter(Boolean))].slice(0, 2); /* como mucho 2 códigos × 5 clases: la pantalla muestra 15 filas */
  const clases = nombres(q.get("clase"), CLASES).slice(0, 5);
  let exito = null;
  busca: for (const clase of clases) for (const codigo of codigos) {
    const r = await subirJson(tok, FINN, { clase, Tipo: "10", NombreLogico: nombre, Descripcion: "PRUEBA API - ELIMINAR", Empresa: empresa, Codigo: codigo, base64 });
    fila(`3. clase ${clase} · Codigo ${codigo}`, r.ok ? `estado ${r.estado}: ACEPTADO · revisar el clip de la orden en FinnegansGO y quitar el adjunto` : `estado ${r.estado}`, sinClave(String(r.texto || "").slice(0, 500), tok));
    if (r.ok) { exito = { clase, codigo }; break busca; }
  }
  fila("4. Resultado", exito ? `se adjuntó con clase ${exito.clase} y Codigo ${exito.codigo}` : "ninguna combinación funcionó: revisar los motivos de arriba", `Empresa ${empresa} · archivo ${nombre} (${pdf.length} bytes) · clases probadas: ${clases.join(", ")} · códigos: ${codigos.join(", ")}`);
  return salida(filas, "prueba real de adjunto");
}
