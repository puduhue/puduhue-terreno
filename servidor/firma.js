/*
  Puduhue Terreno · firma por link (servidor v154, pedido por Benja el 03-11-2026)
  ---------------------------------------------------------------------------------
  Quien llena un documento en la app (acta de vivienda, de vehículo, de activos fijos o registro de capacitación) puede pedir que la
  otra persona (trabajador, conductor, responsable, participante o relator) firme desde su celular con un link, sin cuenta ni app.
  Decisiones de Benja: todos los documentos con firma; por link firma solo la otra persona (quien entrega por la empresa firma en la
  app); sin verificar el RUT; el link vence a los 7 días.

  Datos (en el Durable Object AVISOS, el mismo de las notificaciones):
    fl:<link>        { por, creado, vence, estado: pendiente | firmada | entregada | anulada, acta: {titulo, detalle, rol, nombre}, partes, firma }
    flp:<link>:<n>   el PDF del documento (en partes de hasta 1 MB, en base64); se borra apenas se firma o se anula el link
  La firma (imagen) queda hasta que vence el link (para que cualquier teléfono con el acta la reciba) y después se borra todo.

  Rutas:
    sin sesión (las abre la persona que firma):  GET /f/<link> (página), GET /f/<link>/pdf (el documento), POST /f/<link> (firma)
    con sesión de Puduhue (la app):  POST /firma/crear, /firma/estado, /firma/anular, /firma/recibida
*/
export const FL_DIAS = 7;
export const FL_MAX_PDF = 8_000_000;       // caracteres en base64 (unos 6 MB de PDF)
export const FL_MAX_FIRMA = 400_000;       // caracteres de la imagen de la firma (data:image/png;base64,...)
export const FL_PARTE = 1_000_000;
export const FL_LIMITE = 80;               // links por persona al día
const RE_LINK = /^[A-Za-z0-9_-]{32,64}$/;
export const linkValido = t => RE_LINK.test(String(t || ""));
const corta = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export function nuevoLink() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/* estado visible de un registro: vencido si pasó la fecha y no se firmó */
export function estadoDe(m, ahora = Date.now()) {
  if (!m) return "noexiste";
  if (m.estado === "pendiente" && Date.parse(m.vence) <= ahora) return "vencida";
  return m.estado === "entregada" ? "firmada" : m.estado;
}

/* ---- funciones sobre el almacenamiento (las llama la clase Avisos de push.js) ---- */
export async function flCrear(st, { por, acta, pdf }, ahora = Date.now()) {
  await flLimpiar(st, ahora);
  const t = nuevoLink(), partes = Math.ceil(pdf.length / FL_PARTE);
  for (let i = 0; i < partes; i++) await st.put(`flp:${t}:${i}`, pdf.slice(i * FL_PARTE, (i + 1) * FL_PARTE));
  const m = { por, creado: new Date(ahora).toISOString(), vence: new Date(ahora + FL_DIAS * 864e5).toISOString(), estado: "pendiente",
    acta: { titulo: corta(acta.titulo, 120), detalle: corta(acta.detalle, 200), rol: corta(acta.rol, 120), nombre: corta(acta.nombre, 120) }, partes };
  await st.put("fl:" + t, m);
  return { link: t, vence: m.vence };
}
export async function flLeer(st, t) { return linkValido(t) ? (await st.get("fl:" + t)) || null : null; }
export async function flPdf(st, t) {
  const m = await flLeer(st, t); if (!m || !m.partes) return null;
  let s = ""; for (let i = 0; i < m.partes; i++) { const p = await st.get(`flp:${t}:${i}`); if (p == null) return null; s += p; }
  return s;
}
async function borrarPdf(st, t, m) { for (let i = 0; i < ((m && m.partes) || 0); i++) await st.delete(`flp:${t}:${i}`); if (m) m.partes = 0; }
export async function flFirmar(st, t, { img, equipo }, ahora = Date.now()) {
  const m = await flLeer(st, t), e = estadoDe(m, ahora);
  if (e !== "pendiente") return { ok: false, estado: e };
  m.firma = { img, fecha: new Date(ahora).toISOString(), equipo: corta(equipo, 160) };
  m.estado = "firmada"; await borrarPdf(st, t, m); await st.put("fl:" + t, m);
  return { ok: true, m };
}
export async function flEstado(st, links, ahora = Date.now()) {
  const out = {};
  for (const t of links.slice(0, 200)) { if (!linkValido(t)) continue; const m = await flLeer(st, t), e = estadoDe(m, ahora);
    out[t] = e === "firmada" ? { estado: e, firma: m.firma } : { estado: e, vence: m ? m.vence : null }; }
  return out;
}
export async function flAnular(st, t) {
  const m = await flLeer(st, t); if (!m) return { ok: true, estado: "noexiste" };
  if (m.estado === "firmada" || m.estado === "entregada") return { ok: false, estado: "firmada" };
  m.estado = "anulada"; await borrarPdf(st, t, m); await st.put("fl:" + t, m); return { ok: true, estado: "anulada" };
}
export async function flRecibida(st, t) {
  const m = await flLeer(st, t); if (!m || (m.estado !== "firmada" && m.estado !== "entregada")) return false;
  m.estado = "entregada"; await st.put("fl:" + t, m); return true;
}
/* borra lo vencido: un día después de vencer el link (firmado o no), todo se borra */
export async function flLimpiar(st, ahora = Date.now()) {
  let n = 0; const L = await st.list({ prefix: "fl:" });
  for (const [k, m] of L) { if (!String(k).startsWith("fl:") || !m || !m.vence || !(Date.parse(m.vence) + 864e5 <= ahora)) continue;
    const t = k.slice(3); await borrarPdf(st, t, m); await st.delete(k); n++; }
  return n;
}

/* ---- página que ve la persona que firma ---- */
const escH = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fechaCl = iso => { try { return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(",", ""); } catch (e) { return String(iso || "").slice(0, 16); } };
const fechaDia = iso => { try { return new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric" }); } catch (e) { return String(iso || "").slice(0, 10); } };
const ESTILO = `:root{--bg:#F3F4F1;--card:#fff;--ink:#101828;--muted:#5B6472;--line:#E3E6EA;--act:#17375E;--act-ink:#fff;--ok:#1E6E32;--bad:#A12828}
@media (prefers-color-scheme:dark){:root{--bg:#0B0E12;--card:#161A20;--ink:#F2F4F7;--muted:#AAB2BD;--line:#2A313B;--act:#9CC3F5;--act-ink:#0B1826;--ok:#7BD88F;--bad:#FF9C9C}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:#17375E;color:#fff;padding:calc(env(safe-area-inset-top,0px) + 14px) 18px 14px}header b{letter-spacing:.08em;font-size:15px}header span{display:block;font-size:13px;opacity:.85}
main{max-width:560px;margin:0 auto;padding:16px 16px calc(env(safe-area-inset-bottom,0px) + 28px)}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 14px}
h1{font-size:22px;line-height:1.2;margin:4px 0 6px}p{margin:6px 0}.muted{color:var(--muted);font-size:14px}
.btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:50px;padding:12px 16px;border-radius:999px;border:1.5px solid var(--act);background:transparent;color:var(--act);font-family:inherit;font-size:16px;font-weight:700;line-height:1.2;text-decoration:none;cursor:pointer}
.btn.pri{background:var(--act);color:var(--act-ink)}.btn:disabled{opacity:.45;cursor:default}
.chk{display:flex;gap:10px;align-items:flex-start;margin:12px 0;font-size:15px}.chk input{width:22px;height:22px;margin:1px 0 0;flex:none}
canvas{display:block;width:100%;height:190px;border:1.5px dashed var(--muted);border-radius:14px;background:#fff;touch-action:none}
.fila{display:flex;gap:10px;margin-top:10px}.fila .btn{flex:1}.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}
.nota{font-size:12.5px;color:var(--muted);margin-top:14px}`;
function pagina(nonce, cuerpo, script) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Firma de documento · Puduhue</title><style>${ESTILO}</style></head><body><header><b>PUDUHUE</b><span>Firma de documento</span></header><main>${cuerpo}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;
}
const AVISO = { firmada: ["Este documento ya fue firmado.", "Ya no hace falta hacer nada. Si crees que es un error, avisa a quien te mandó el link."],
  vencida: ["Este link venció.", "Pide a quien te lo mandó que te envíe uno nuevo."],
  anulada: ["Este link fue anulado.", "Pide a quien te lo mandó que te envíe uno nuevo si todavía tienes que firmar."],
  noexiste: ["Este link no existe o ya no está disponible.", "Revisa que lo hayas copiado completo o pide uno nuevo a quien te lo mandó."] };
export function htmlFirma(m, t, estado, nonce) {
  if (estado !== "pendiente") { const [a, b] = AVISO[estado] || AVISO.noexiste;
    return pagina(nonce, `<div class="card"><h1>${escH(a)}</h1><p class="muted">${escH(b)}</p>${m && estado === "firmada" && m.firma ? `<p class="muted">Firmado el ${escH(fechaCl(m.firma.fecha))}.</p>` : ""}</div>`); }
  const A = m.acta || {};
  const cuerpo = `<div class="card"><p class="muted">Te pidieron firmar este documento de Puduhue:</p><h1>${escH(A.titulo || "Documento")}</h1>${A.detalle ? `<p class="muted">${escH(A.detalle)}</p>` : ""}
    <p>Firma: <b>${escH(A.rol || "")}</b>${A.nombre ? ` · ${escH(A.nombre)}` : ""}</p>
    <a class="btn" href="/f/${escH(t)}/pdf" target="_blank" rel="noopener" id="ver">Ver el documento (PDF)</a>
    <p class="muted" style="margin-top:8px">Léelo completo antes de firmar. El link vence el ${escH(fechaDia(m.vence))}.</p></div>
  <div class="card" id="zona"><label class="chk"><input type="checkbox" id="acepto"><span>Leí el documento y estoy de acuerdo con su contenido.</span></label>
    <p class="muted" style="margin:0 0 6px">Firma con el dedo dentro del recuadro:</p><canvas id="pad" aria-label="Recuadro para firmar"></canvas>
    <div class="fila"><button class="btn" id="borrar" type="button">Borrar</button><button class="btn pri" id="firmar" type="button" disabled>Firmar</button></div>
    <p class="muted" id="msg" role="status" aria-live="polite"></p>
    <p class="nota">Firma electrónica simple. Se registran la fecha y la hora de la firma. Tu firma queda en el documento que lleva Puduhue.</p></div>`;
  const script = `(()=>{const c=document.getElementById("pad"),acc=document.getElementById("acepto"),bf=document.getElementById("firmar"),msg=document.getElementById("msg");
const dpr=Math.max(1,window.devicePixelRatio||1);let g,W,H,largo=0,last=null,dib=false;
const prep=()=>{W=c.clientWidth;H=c.clientHeight;c.width=W*dpr;c.height=H*dpr;g=c.getContext("2d");g.scale(dpr,dpr);g.lineCap="round";g.lineJoin="round";g.strokeStyle="#0E2238";g.lineWidth=2.6;largo=0;upd()};
const upd=()=>{bf.disabled=!(acc.checked&&largo>=40)};
const pt=e=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
c.addEventListener("pointerdown",e=>{e.preventDefault();try{c.setPointerCapture(e.pointerId)}catch(x){}dib=true;last=pt(e);g.beginPath();g.arc(last.x,last.y,1.2,0,Math.PI*2);g.fillStyle="#0E2238";g.fill()});
c.addEventListener("pointermove",e=>{if(!dib)return;e.preventDefault();const p=pt(e);g.beginPath();g.moveTo(last.x,last.y);g.lineTo(p.x,p.y);g.stroke();largo+=Math.hypot(p.x-last.x,p.y-last.y);last=p;upd()});
const fin=()=>{dib=false};c.addEventListener("pointerup",fin);c.addEventListener("pointercancel",fin);
document.getElementById("borrar").addEventListener("click",()=>{g.clearRect(0,0,W,H);largo=0;upd()});acc.addEventListener("change",upd);
bf.addEventListener("click",async()=>{if(bf.disabled)return;bf.disabled=true;msg.textContent="Enviando la firma…";
  const o=document.createElement("canvas");o.width=600;o.height=Math.round(600*H/W);o.getContext("2d").drawImage(c,0,0,o.width,o.height);
  try{const r=await fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({img:o.toDataURL("image/png"),acepto:true})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok){document.getElementById("zona").innerHTML='<h1 class="ok">Listo, tu firma quedó registrada.</h1><p class="muted">Firmado el '+(j.fecha||"")+'. Ya puedes cerrar esta página.</p>';document.getElementById("ver").remove()}
    else{msg.innerHTML='<span class="bad">'+(j.error||"No se pudo registrar la firma.")+'</span>';bf.disabled=false}}
  catch(e){msg.innerHTML='<span class="bad">No se pudo enviar la firma. Revisa la señal e inténtalo de nuevo.</span>';upd()}});
addEventListener("resize",()=>{if(!largo)prep()});prep()})();`;
  return pagina(nonce, cuerpo, script);
}

/* ---- rutas ---- */
const cabPagina = nonce => ({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` });
/* sin sesión: la persona que firma (el link es la autorización) */
export async function rutasFirmaPublica(req, env, ctx, url, avisos, enviarAviso) {
  const mm = /^\/f\/([A-Za-z0-9_-]+)(\/pdf)?\/?$/.exec(url.pathname); if (!mm) return null;
  const t = mm[1], ahora = Date.now();
  const jsonP = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (!avisos || !linkValido(t)) { const n = nuevoLink().slice(0, 16); return req.method === "POST" ? jsonP({ ok: false, error: "Este link no existe." }, 404) : new Response(htmlFirma(null, t, "noexiste", n), { status: 404, headers: cabPagina(n) }); }
  const m = await avisos.flLeer(t), e = estadoDe(m, ahora);
  if (mm[2]) { /* el PDF */
    if (req.method !== "GET" || e !== "pendiente") return new Response("Este documento ya no está disponible.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    const b = await avisos.flPdf(t); if (!b) return new Response("Este documento ya no está disponible.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const bytes = Uint8Array.from(atob(b), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Documento_Puduhue.pdf"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" } });
  }
  if (req.method === "GET") { const n = nuevoLink().slice(0, 16); return new Response(htmlFirma(m, t, e, n), { status: e === "noexiste" ? 404 : 200, headers: cabPagina(n) }); }
  if (req.method !== "POST") return jsonP({ ok: false, error: "Método no permitido." }, 405);
  if (+(req.headers.get("Content-Length") || 0) > FL_MAX_FIRMA + 2000) return jsonP({ ok: false, error: "La firma es demasiado grande." }, 413);
  let b; try { b = await req.json(); } catch (x) { return jsonP({ ok: false, error: "No se pudo leer la firma." }, 400); }
  const img = String((b && b.img) || "");
  if (!b || b.acepto !== true) return jsonP({ ok: false, error: "Marca que leíste el documento antes de firmar." }, 400);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length < 1500 || img.length > FL_MAX_FIRMA) return jsonP({ ok: false, error: "La firma no es válida. Firma de nuevo dentro del recuadro." }, 400);
  const r = await avisos.flFirmar(t, { img, equipo: req.headers.get("User-Agent") || "" }, ahora);
  if (!r.ok) return jsonP({ ok: false, estado: r.estado, error: (AVISO[r.estado] || AVISO.noexiste)[0] }, 409);
  if (enviarAviso) ctx.waitUntil(enviarAviso(r.m, t).catch(() => {}));
  return jsonP({ ok: true, fecha: fechaCl(r.m.firma.fecha) });
}
/* con sesión de Puduhue: la app pide, revisa, anula y confirma */
export async function rutasFirma(req, env, url, correo, json, avisos, usar) {
  if (!url.pathname.startsWith("/firma/")) return null;
  if (!avisos) return json({ error: "La firma por link no está configurada en el servidor." }, 500);
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b; try { b = await req.json(); } catch (e) { return json({ error: "Cuerpo inválido." }, 400); }
  const p = url.pathname.slice(7);
  if (p === "crear") {
    const pdf = String((b && b.pdf) || "").replace(/^data:application\/pdf[^,]*,/, "");
    if (!pdf || pdf.length < 200 || pdf.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return json({ error: "Falta el documento en PDF." }, 400);
    if (pdf.length > FL_MAX_PDF) return json({ error: "El documento es demasiado grande para enviarlo por link." }, 413);
    const acta = (b && b.acta) || {}; if (!corta(acta.titulo, 120)) return json({ error: "Falta el título del documento." }, 400);
    if (usar) { const u = await usar(correo); if (!u.ok) return json({ error: `Llegaste al límite de ${FL_LIMITE} links de firma de hoy.` }, 429); }
    const r = await avisos.flCrear({ por: correo, acta, pdf });
    return json({ ok: true, link: r.link, url: url.origin + "/f/" + r.link, vence: r.vence });
  }
  if (p === "estado") return json({ ok: true, links: await avisos.flEstado(Array.isArray(b.links) ? b.links.map(String) : []) });
  if (p === "anular") return json({ ok: true, ...(await avisos.flAnular(String(b.link || ""))) });
  if (p === "recibida") return json({ ok: await avisos.flRecibida(String(b.link || "")) });
  return json({ error: "Ruta no encontrada." }, 404);
}
