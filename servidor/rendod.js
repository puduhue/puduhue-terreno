/*
  Rendiciones: el servidor guarda los registros en OneDrive y revisa quién puede cambiar qué (v194, etapa 2 del plan para que
  solo el servidor escriba en Rendiciones; ver docs/plan_servidor_onedrive.md en herramientas).
  ----------------------------------------------------------------------------------------------------------------------------
  La app sigue leyendo directo de OneDrive y sigue combinando los cambios en el teléfono (eTag, If-Match, versión de partida);
  solo las escrituras de Rendiciones/_datos pasan por aquí:
    POST /od/rend  { op: "put",       id, datos, ifMatch }        → escribe <id>.json (con If-Match si viene)
                   { op: "delete",    id, ifMatch }               → lo elimina
                   { op: "conflicto", id, nombre, version, motivo, campos } → copia en _datos/_conflictos (nunca se pierde trabajo)
  Respuestas: { ok: true, eTag } · 412 (cambió en OneDrive: la app vuelve a combinar) · 404 · 403 (regla, en modo «bloquear») ·
  502/503 (OneDrive o la credencial). El cuerpo de error trae { error, status }.

  Reglas (comparando la versión que está en OneDrive con la nueva; las aplica revisarRendicion):
    - El administrador y Contabilidad pueden todo, salvo aprobar o contabilizar su propia rendición (solo el administrador; v211:
      también Contabilidad si maestros.json trae autoCont.on, «Contabilidad revisa sus propias rendiciones»).
    - Quien rinde (su cuenta, el correo de la persona o los correos de su ficha por RUT) cambia lo que quiera mientras está en
      borrador o devuelta, y la envía: a la jefatura que dice la lista de colaboradores (no a otra) o, si no tiene jefatura, a
      Contabilidad. No puede ponerse aprobaciones ni contabilizarla. Después de enviarla solo puede completar su RUT y el enlace
      de sus fotos y PDF cuando terminan de subir (q: → a:).
    - La jefatura de esa rendición, mientras está enviada: aprueba (pasa a Contabilidad) o devuelve, y marca los documentos
      («Está bien» / «Pedir corrección»). Nada más.
    - El historial (hist) solo crece.
    - Eliminar: solo un borrador de quien rinde (o Contabilidad y el administrador).
  Modo (variable OD_MODO en Cloudflare): «aviso» (por defecto) anota lo que no cumple y lo guarda igual, para ajustar las reglas
  sin trabar a nadie; «bloquear» responde 403 y no guarda. Lo anotado se ve en GET /od/avisos (administrador).
  Interruptor: con OD_REND = "no", /yo dice odRend: false y la app vuelve a escribir directo (mientras la gente tenga permiso de editar).
*/
import { odConfig, odListo, graphApp } from "./onedrive.js";
import { sujetoDe } from "./push.js";
/* v195.1: anota lo que no cumplió una regla y, como máximo cada 30 minutos, avisa al administrador con una notificación */
export async function anotarAviso(env, avisos, e) {
  if (!avisos) return;
  const x = await avisos.odAnotar(e);
  if (!x || !x.avisar) return;
  if (/:leer$/.test(String(e.op || ""))) return; /* v226: una lectura negada no cambia nada: queda anotada, sin notificación */
  const admins = String(env.CORREOS_ACTUALIZAR || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (!admins.length) return;
  const mas = x.n > 1 ? ` (${x.n} desde el último aviso)` : "";
  await avisos.enviar(admins, { titulo: "Puduhue Terreno: un cambio fuera de las reglas", texto: `${e.correo}: ${(e.reglas || [])[0] || "regla"}${mas}. ${e.modo === "bloquear" ? "No se guardó." : "Se guardó igual (modo aviso)."}`, url: "./", etiqueta: "od-aviso" }, sujetoDe(env));
}

export const RD_ROOT = "01RAJ2KQBLDIZGFMASZVCIDO2PGKXQW5VY"; /* carpeta Rendiciones (la misma de modulos/rendiciones.js, RD.root) */
const ID_OK = /^[A-Za-z0-9_-]{4,80}$/;
export const odRendActivo = env => odListo(env) && String(env.OD_REND || "").toLowerCase() !== "no";
export const odModo = env => String(env.OD_MODO || "aviso").toLowerCase() === "bloquear" ? "bloquear" : "aviso";

/* ---------- utilidades (las mismas que la app) ---------- */
export const normRut = r => String(r || "").toUpperCase().replace(/[^0-9K]/g, "").replace(/^0+/, "");
export const normTxt = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 \-\/.,()&+:]/g, " ").replace(/\s+/g, " ").trim();
export const correosDe = c => String((c && c.correo) || "").toLowerCase().split(/[\s,;]+/).filter(x => /@/.test(x));
const igual = (a, b) => JSON.stringify(orden(a)) === JSON.stringify(orden(b));
function orden(x) { if (Array.isArray(x)) return x.map(orden); if (x && typeof x === "object") { const o = {}; Object.keys(x).sort().forEach(k => { if (x[k] !== undefined) o[k] = orden(x[k]); }); return o; } return x; }

/* ---------- la lista de colaboradores (maestros.json), leída por el servidor con su credencial, guardada 5 minutos ---------- */
let MAE = null, MAE_T = 0;
export function odOlvidarMaestros() { MAE = null; MAE_T = 0; DATOS_ID = null; CONF_ID = null; for (const k of Object.keys(CARP)) delete CARP[k]; }
export async function maestrosSrv(env, ahora = Date.now()) {
  if (MAE && ahora - MAE_T < 300000) return MAE;
  const c = odConfig(env);
  const r = await graphApp(env, `/drives/${encodeURIComponent(c.drive)}/items/${RD_ROOT}:/_maestros/maestros.json:/content`);
  if (!r.ok) throw { status: 502, error: `No se pudo leer la lista de colaboradores (${r.status}).` };
  MAE = await r.json(); MAE_T = ahora; return MAE;
}
const colabs = M => (M && Array.isArray(M.colab) ? M.colab : []).filter(c => c && c.activo !== false);
const aprobadores = M => M && Array.isArray(M.aprob) ? M.aprob : [];
export function colabDeRend(M, r) {
  const p = (r && r.persona) || {};
  if (p.rut) { const L = colabs(M).filter(c => normRut(c.rut) === normRut(p.rut)); if (L.length === 1) return L[0]; }
  const co = String(p.correo || "").toLowerCase(); if (!/@/.test(co)) return null;
  const L = colabs(M).filter(c => correosDe(c).includes(co)); return L.length === 1 ? L[0] : null;
}
/* la jefatura que corresponde según la lista (igual que jefaturaDe en la app); "" si no tiene */
export function jefaturaEsperada(M, r) {
  const c = colabDeRend(M, r); if (!c || !c.jefe) return "";
  const j = String(c.jefe).trim(); let co = "";
  if (/@/.test(j)) co = j.toLowerCase();
  else { const n = normTxt(j), a = aprobadores(M).find(x => normTxt(x.nombre) === n && x.correo);
    if (a) co = String(a.correo).toLowerCase();
    else { const c2 = colabs(M).find(x => normTxt(x.nombre) === n && correosDe(x).length); if (c2) co = correosDe(c2)[0]; } }
  if (co && (correosDe(c).includes(co) || co === String((r.persona || {}).correo || "").toLowerCase())) co = ""; /* nadie se aprueba a sí mismo */
  return co;
}
/* correos que «son» quien rinde: la cuenta que la creó, el correo de la persona y los de su ficha */
export function correosDueno(M, r) {
  if (!r) return [];
  const L = [r.cuenta, r.persona && r.persona.correo].map(x => String(x || "").toLowerCase()).filter(x => /@/.test(x));
  const c = colabDeRend(M, r); if (c) correosDe(c).forEach(x => { if (!L.includes(x)) L.push(x); });
  return L;
}

/* lo que el registro de cambios guarda de cada rendición (lo justo para saber quién la ve y qué archivos tiene; v196-v197) */
export function metaDe(r, eTag) {
  const p = (r && r.persona) || {}, f = [];
  Object.values((r && r.docs) || {}).forEach(d => { [d && d.foto, d && d.pdf].forEach(x => { if (/^a:/.test(String(x || ""))) f.push(String(x).slice(2)); }); });
  (r && Array.isArray(r.quitados) ? r.quitados : []).forEach(q => { const x = q && q.doc && q.doc.foto; if (/^a:/.test(String(x || ""))) f.push(String(x).slice(2)); }); /* v235: quien rinde ve la foto del quitado */
  return { e: eTag, c: String((r && r.cuenta) || "").toLowerCase(), pc: String(p.correo || "").toLowerCase(), rut: p.rut || "", j: String(((r && r.jefatura) || {}).correo || "").toLowerCase(), f };
}

/* ---------- reglas ---------- */
/* v207.1: «modificadoPor» (quién guardó por última vez) lo pone la app en cada guardado, también cuando la jefatura aprueba o
   devuelve y cuando quien rinde completa el enlace de una foto: es dato técnico, no un cambio de la rendición (antes avisaba
   «la jefatura no puede cambiar «modificadoPor»» en cada aprobación). */
const TECNICOS = ["id", "_col", "_etag", "actualizado", "modificadoPor"];
const cambiadas = (a, b) => { const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); return [...ks].filter(k => !TECNICOS.includes(k) && !igual((a || {})[k], (b || {})[k])); };
const histCrece = (a, b) => { const h0 = (a && a.hist) || [], h1 = (b && b.hist) || []; return Array.isArray(h1) && h1.length >= h0.length && igual(h1.slice(0, h0.length), h0); };
/* solo cambió el enlace de fotos o PDF (q: → a:) y su fotoUrl, o se completó el RUT */
function soloEnlaces(a, b) {
  const malo = [];
  cambiadas(a, b).forEach(k => {
    if (k === "fotoUrl") { const f0 = a.fotoUrl || {}, f1 = b.fotoUrl || {}; if (Object.keys(f0).some(x => f1[x] !== f0[x])) malo.push("fotoUrl"); return; }
    if (k === "persona") { const p0 = a.persona || {}, p1 = b.persona || {}; if (p0.rut || !igual({ ...p0, rut: undefined }, { ...p1, rut: undefined })) malo.push("persona"); return; }
    if (k === "docs") { const d0 = a.docs || {}, d1 = b.docs || {};
      if (!igual(Object.keys(d0).sort(), Object.keys(d1).sort())) { malo.push("docs (agregó o quitó documentos)"); return; }
      for (const dk of Object.keys(d0)) { const x = d0[dk] || {}, y = d1[dk] || {};
        for (const f of cambiadas(x, y)) { if ((f === "foto" || f === "pdf") && /^q:/.test(String(x[f] || "")) && /^a:/.test(String(y[f] || ""))) continue; malo.push(`docs.${dk}.${f}`); } }
      return; }
    malo.push(k);
  });
  return malo;
}
/* Devuelve la lista de lo que no cumple (vacía = permitido). quien = { correo, admin, contab } */
export function revisarRendicion(M, antes, despues, quien) {
  const v = [], co = quien.correo, est0 = antes ? antes.estado || "borrador" : null, est1 = despues.estado || "borrador";
  if (quien.admin) return v;
  const dueno = correosDueno(M, antes || despues).includes(co);
  if (antes && !histCrece(antes, despues) && !quien.contab) v.push("el historial no puede borrarse ni cambiarse");
  if (dueno) {
    const ks = cambiadas(antes, despues);
    /* v211: con «Contabilidad revisa sus propias rendiciones» (maestros.json autoCont.on), Contabilidad aprueba y contabiliza la suya */
    const propiaOk = !!(quien.contab && M && M.autoCont && M.autoCont.on);
    const prohibidas = propiaOk ? ["aprobJef"] : ["aprobJef", "aprobCont", "contab"];
    if (prohibidas.some(k => ks.includes(k) && despues[k])) v.push("quien rinde no puede ponerse aprobaciones ni contabilizar su propia rendición");
    if (!propiaOk && ["aprobada", "contabilizada"].includes(est1) && est1 !== est0) v.push(`quien rinde no puede pasar su rendición a «${est1}»`);
    if (!antes || ["borrador", "observada"].includes(est0)) {
      if (despues.anulada && !(antes && antes.anulada)) { if (!quien.contab) v.push("quien rinde no puede anular su rendición"); }
      if (!["borrador", "observada", "enviada", "revcont"].includes(est1)) v.push(`estado no permitido al enviar: «${est1}»`);
      const esp = jefaturaEsperada(M, despues), j1 = String((despues.jefatura || {}).correo || "").toLowerCase();
      if (est1 === "enviada" && est1 !== est0 && j1 !== esp) v.push(esp ? `la jefatura debe ser ${esp}, no ${j1 || "ninguna"}` : "sin jefatura en la lista: debe ir directo a Contabilidad");
      if (est1 === "revcont" && est1 !== est0) { const devCont = antes && antes.devueltaEn === "revcont" && !!antes.aprobJef;
        if (esp && !devCont) v.push(`tiene jefatura (${esp}): no puede enviarse directo a Contabilidad`); }
    } else if (!quien.contab) {
      soloEnlaces(antes, despues).forEach(x => v.push(`quien rinde no puede cambiar «${x}» con la rendición en «${est0}»`));
    }
    return v;
  }
  if (quien.contab) return v;
  const jef = antes && String((antes.jefatura || {}).correo || "").toLowerCase();
  if (antes && jef && jef === co) {
    if (est0 !== "enviada") { soloEnlaces(antes, despues).forEach(x => v.push(`la jefatura no puede cambiar «${x}» con la rendición en «${est0}»`)); return v; }
    if (!["enviada", "revcont", "observada"].includes(est1)) v.push(`la jefatura no puede pasarla a «${est1}»`);
    const permitidas = ["estado", "aprobJef", "docs", "comentario", "devueltaEn", "revisadaPor", "hist", "huellaDev"];
    cambiadas(antes, despues).forEach(k => {
      if (!permitidas.includes(k)) { v.push(`la jefatura no puede cambiar «${k}»`); return; }
      if (k === "aprobJef" && despues.aprobJef && String(despues.aprobJef.por || "").toLowerCase().indexOf("@") >= 0 && String(despues.aprobJef.por).toLowerCase() !== co) v.push("la aprobación debe quedar a nombre de quien aprueba");
      if (k === "docs") { const d0 = antes.docs || {}, d1 = despues.docs || {};
        if (!igual(Object.keys(d0).sort(), Object.keys(d1).sort())) { v.push("la jefatura no puede agregar ni quitar documentos"); return; }
        for (const dk of Object.keys(d0)) for (const f of cambiadas(d0[dk], d1[dk])) if (!["estadoRev", "obsRev", "obsCampo", "obsValor"].includes(f)) v.push(`la jefatura no puede cambiar «docs.${dk}.${f}»`); }
    });
    return v;
  }
  v.push(antes ? "no es quien rinde, ni su jefatura, ni Contabilidad" : "no puede crear una rendición a nombre de otra persona");
  return v;
}

/* ---------- carpetas ---------- */
let DATOS_ID = null, CONF_ID = null;
export async function idHijo(env, padre, nombre, crear) {
  const c = odConfig(env), d = encodeURIComponent(c.drive);
  let r = await graphApp(env, `/drives/${d}/items/${padre}:/${encodeURIComponent(nombre)}?$select=id`);
  if (r.ok) return (await r.json()).id;
  if (r.status !== 404 || !crear) throw { status: 502, error: `No se pudo ubicar «${nombre}» en OneDrive (${r.status}).` };
  r = await graphApp(env, `/drives/${d}/items/${padre}/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
  if (r.ok) return (await r.json()).id;
  if (r.status === 409) return idHijo(env, padre, nombre, false);
  throw { status: 502, error: `No se pudo crear «${nombre}» en OneDrive (${r.status}).` };
}
export const carpetaDatos = async env => DATOS_ID || (DATOS_ID = await idHijo(env, RD_ROOT, "_datos", true));
const carpetaConflictos = async env => CONF_ID || (CONF_ID = await idHijo(env, await carpetaDatos(env), "_conflictos", true));

/* ---------- la ruta ---------- */
export async function rutaRend(req, env, ctx, { correo, json, autorizado, esContab, avisos }) {
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!odRendActivo(env)) return json({ error: "El servidor no está guardando rendiciones en OneDrive (falta la clave o está apagado).", status: 503 }, 503);
  let b; try { b = await req.json(); } catch (e) { return json({ error: "Pedido sin JSON." }, 400); }
  const op = b && b.op, id = String((b && b.id) || "");
  if (!ID_OK.test(id)) return json({ error: "Id de rendición no válido." }, 400);
  const c = odConfig(env), d = encodeURIComponent(c.drive);
  try {
    const datos = await carpetaDatos(env), ruta = `/drives/${d}/items/${datos}:/${encodeURIComponent(id + ".json")}`;
    if (op === "conflicto") {
      const nombre = String(b.nombre || "").replace(/[\\/:*?"<>|#%]/g, "-").slice(0, 120);
      if (!nombre.startsWith(id + " ") || !nombre.endsWith(".json")) return json({ error: "Nombre de copia no válido." }, 400);
      const cuerpo = JSON.stringify({ guardado: new Date().toISOString(), por: b.por || null, cuenta: correo, motivo: String(b.motivo || "").slice(0, 200), campos: Array.isArray(b.campos) ? b.campos.slice(0, 200) : [], version: b.version || null });
      const r = await graphApp(env, `/drives/${d}/items/${await carpetaConflictos(env)}:/${encodeURIComponent(nombre)}:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: cuerpo });
      if (!r.ok) return json({ error: `OneDrive no guardó la copia (${r.status}).`, status: r.status }, r.status === 412 || r.status === 404 ? r.status : 502);
      return json({ ok: true });
    }
    if (op !== "put" && op !== "delete") return json({ error: "Operación desconocida." }, 400);
    /* la versión que está en OneDrive (para las reglas) */
    let antes = null, etag0 = null;
    const r0 = await graphApp(env, ruta + "?$select=id,eTag");
    if (r0.ok) { const m = await r0.json(); etag0 = m.eTag; const rc = await graphApp(env, `/drives/${d}/items/${m.id}/content`); if (rc.ok) { try { antes = await rc.json(); } catch (e) { antes = null; } } }
    else if (r0.status !== 404) return json({ error: `No se pudo leer la rendición en OneDrive (${r0.status}).`, status: r0.status }, 502);
    if (b.ifMatch && etag0 && b.ifMatch !== etag0) return json({ error: "La rendición cambió en OneDrive.", status: 412 }, 412);
    if (b.ifMatch && !etag0) return json({ error: "La rendición ya no está en OneDrive.", status: 404 }, 404);
    const M = await maestrosSrv(env), quien = { correo, admin: autorizado, contab: await esContab() };
    let viol;
    if (op === "delete") {
      if (!antes) return json({ ok: true, yaNoEstaba: true });
      viol = quien.admin || quien.contab ? [] : !correosDueno(M, antes).includes(correo) ? ["no es quien rinde"] : (antes.estado || "borrador") !== "borrador" ? [`solo se elimina un borrador (está en «${antes.estado}»)`] : [];
    } else {
      if (!b.datos || typeof b.datos !== "object" || Array.isArray(b.datos)) return json({ error: "Faltan los datos de la rendición." }, 400);
      viol = revisarRendicion(M, antes, b.datos, quien);
    }
    if (viol.length) {
      const e = { hora: new Date().toISOString(), modo: odModo(env), op, id, correo, estado: antes ? antes.estado || "borrador" : null, nuevo: op === "put" ? b.datos.estado || "borrador" : null, reglas: viol.slice(0, 10) };
      if (avisos) ctx.waitUntil(anotarAviso(env, avisos, e).catch(() => {}));
      if (odModo(env) === "bloquear") return json({ error: "No tienes permiso para este cambio: " + viol[0] + ".", reglas: viol, status: 403 }, 403);
    }
    const h = {}; if (b.ifMatch || etag0) h["If-Match"] = b.ifMatch || etag0;
    if (op === "delete") {
      const r = await graphApp(env, ruta, { method: "DELETE", headers: h });
      if (r.status === 412) return json({ error: "La rendición cambió en OneDrive.", status: 412 }, 412);
      if (!r.ok && r.status !== 404) return json({ error: `OneDrive no eliminó la rendición (${r.status}).`, status: r.status }, 502);
      if (avisos && avisos.rlAplicar) await avisos.rlAplicar({ [id]: null }).catch(() => {}); /* v197: al registro de cambios */
      return json({ ok: true, avisos: viol.length || undefined });
    }
    h["Content-Type"] = "application/json";
    const r = await graphApp(env, ruta + ":/content", { method: "PUT", headers: h, body: JSON.stringify(b.datos) });
    if (r.status === 412) return json({ error: "La rendición cambió en OneDrive.", status: 412 }, 412);
    if (!r.ok) return json({ error: `OneDrive no guardó la rendición (${r.status}).`, status: r.status }, 502);
    const it = await r.json();
    if (avisos && avisos.rlAplicar) await avisos.rlAplicar({ [id]: { meta: metaDe(b.datos, it.eTag), data: b.datos } }).catch(() => {}); /* v197: al registro de cambios, al instante */
    return json({ ok: true, eTag: it.eTag, id: it.id, avisos: viol.length || undefined });
  } catch (e) {
    return json({ error: (e && e.error) || "Error al guardar en OneDrive.", status: (e && e.status) || 502 }, (e && e.status) || 502);
  }
}

/* ======================================================================================================================
   v195: archivos de Rendiciones por el servidor (fotos y PDF de los documentos, PDF de la rendición, Excel del mes,
   Importaciones FinnegansGO, maestros). El servidor no recibe los bytes: crea una «sesión de carga» de OneDrive para ese
   archivo y le da a la app su dirección (uploadUrl), que solo sirve para subir ESE archivo y no lleva la sesión de nadie.
     POST /od/subida  { ruta: [carpetas desde Rendiciones], nombre }  → { ok, uploadUrl }
     POST /od/maestros { datos }                                      → { ok, eTag }   (maestros.json; Contabilidad y admin)
     POST /od/celdas  { archivo, hoja, addr, valor }                  → { ok }         (Excel de _maestros; Contabilidad y admin)
     POST /od/celdas/leer { archivo, hoja }                           → { ok, address, values } (v216: lo usado de una hoja; Contabilidad y admin)
     POST /od/borrar  { id }                                          → { ok }         (una foto o PDF dentro de Rendiciones)
   Las reglas que dependen de quién pide siguen OD_MODO (aviso: anota y deja pasar; bloquear: 403); las rutas fuera de lo
   permitido se rechazan siempre (400).
   ====================================================================================================================== */
export const limpiaNombre = t => String(t || "").normalize("NFC").replace(/[\\/:*?"<>|#%&{}~]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const EXT_DOC = /\.(jpe?g|png|pdf|heic|webp)$/i;
const RUTA_OK = s => typeof s === "string" && s.length > 0 && s.length <= 100 && !/[\\/:*?"<>|#%]/.test(s) && s.trim() === s && s !== "." && s !== "..";
const CARP = {};
async function carpetaRd(env, segs) {
  let p = RD_ROOT, k = "";
  for (const s of segs) { k += "/" + s; p = CARP[k] || (CARP[k] = await idHijo(env, p, s, true)); }
  return p;
}
export function odOlvidarCarpetas() { for (const k of Object.keys(CARP)) delete CARP[k]; }
/* qué archivo es y quién puede subirlo: { error } (400 siempre) o { reglas: [...] } (según OD_MODO) */
export function revisarSubida(M, ruta, nombre, quien) {
  if (!Array.isArray(ruta) || !ruta.length || ruta.length > 2 || !ruta.every(RUTA_OK)) return { error: "Carpeta no válida." };
  if (!RUTA_OK(nombre) || nombre.length > 150) return { error: "Nombre de archivo no válido." };
  const libre = quien.admin || quien.contab;
  if (ruta[0] === "_maestros" && ruta.length === 1) return { reglas: libre ? [] : ["solo Contabilidad sube archivos a los maestros"] };
  if (ruta[0] === "Importaciones FinnegansGO" && ruta.length === 1) {
    if (!/\.xlsx$/i.test(nombre)) return { error: "En Importaciones FinnegansGO solo van Excel." };
    return { reglas: libre ? [] : ["solo Contabilidad sube importaciones para FinnegansGO"] }; }
  if (!/^\d{4}-\d{2}$/.test(ruta[0])) return { error: "Carpeta no válida." };
  if (ruta.length === 1) return nombre === `Rendiciones_${ruta[0]}.xlsx` ? { reglas: [] } : { error: "En la carpeta del mes solo va su Excel." };
  if (!EXT_DOC.test(nombre)) return { error: "Solo fotos o PDF." };
  if (libre) return { reglas: [] };
  const nombres = [quien.nombre].concat(colabs(M).filter(c => correosDe(c).includes(quien.correo)).map(c => c.nombre)).map(limpiaNombre).filter(Boolean);
  return { reglas: nombres.includes(ruta[1]) ? [] : [`sube a la carpeta de «${ruta[1]}», que no es la suya`] };
}
async function anotarOBloquear(env, ctx, avisos, json, e) {
  if (!e.reglas.length) return null;
  const x = { hora: new Date().toISOString(), modo: odModo(env), ...e, reglas: e.reglas.slice(0, 10) };
  if (avisos) ctx.waitUntil(anotarAviso(env, avisos, x).catch(() => {}));
  return odModo(env) === "bloquear" ? json({ error: "No tienes permiso para este cambio: " + e.reglas[0] + ".", reglas: e.reglas, status: 403 }, 403) : null;
}
export async function rutasArchivos(req, env, ctx, url, { correo, nombre, json, autorizado, esContab, avisos }) {
  const rutas = ["/od/subida", "/od/maestros", "/od/celdas", "/od/celdas/leer", "/od/borrar"];
  if (!rutas.includes(url.pathname)) return null;
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!odRendActivo(env)) return json({ error: "El servidor no está guardando rendiciones en OneDrive.", status: 503 }, 503);
  let b; try { b = await req.json(); } catch (e) { return json({ error: "Pedido sin JSON." }, 400); }
  const c = odConfig(env), d = encodeURIComponent(c.drive), quien = { correo, nombre, admin: autorizado, contab: await esContab() };
  try {
    if (url.pathname === "/od/subida") {
      const M = await maestrosSrv(env), ruta = b.ruta, arch = String(b.nombre || "");
      const v = revisarSubida(M, ruta, arch, quien); if (v.error) return json({ error: v.error }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "subida", id: ruta.join("/") + "/" + arch, correo, reglas: v.reglas }); if (no) return no;
      const carpeta = await carpetaRd(env, ruta);
      const r = await graphApp(env, `/drives/${d}/items/${carpeta}:/${encodeURIComponent(arch)}:/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) });
      if (!r.ok) { if (r.status === 404) odOlvidarCarpetas(); return json({ error: `OneDrive no abrió la carga (${r.status}).`, status: r.status }, 502); }
      const s = await r.json(); return json({ ok: true, uploadUrl: s.uploadUrl, vence: s.expirationDateTime });
    }
    if (url.pathname === "/od/maestros") {
      if (!b.datos || typeof b.datos !== "object" || Array.isArray(b.datos)) return json({ error: "Faltan los maestros." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "maestros", id: "maestros.json", correo, reglas: quien.admin || quien.contab ? [] : ["solo Contabilidad cambia la lista de colaboradores"] }); if (no) return no;
      const r = await graphApp(env, `/drives/${d}/items/${await carpetaRd(env, ["_maestros"])}:/maestros.json:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b.datos) });
      if (!r.ok) return json({ error: `OneDrive no guardó los maestros (${r.status}).`, status: r.status }, 502);
      MAE = null; return json({ ok: true, eTag: (await r.json()).eTag });
    }
    if (url.pathname === "/od/celdas/leer") { /* v216: la app ya no lee el Excel de colaboradores con la cuenta de la persona */
      const arch = String(b.archivo || ""), hoja = String(b.hoja || "");
      if (!RUTA_OK(arch) || !/\.xlsx$/i.test(arch) || !hoja || hoja.length > 60) return json({ error: "Hoja no válida." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "celdas:leer", id: `${arch}!${hoja}`, correo, reglas: quien.admin || quien.contab ? [] : ["solo Contabilidad lee la lista de colaboradores en Excel"] }); if (no) return no;
      let r = await graphApp(env, `/drives/${d}/items/${await carpetaRd(env, ["_maestros"])}:/${encodeURIComponent(arch)}?$select=id`);
      if (!r.ok) return json({ error: `No se encontró «${arch}» en los maestros (${r.status}).`, status: r.status }, r.status === 404 ? 404 : 502);
      const id = (await r.json()).id;
      r = await graphApp(env, `/drives/${d}/items/${id}/workbook/worksheets/${encodeURIComponent(hoja)}/usedRange?$select=address,values`);
      if (!r.ok) return json({ error: `Excel no entregó la hoja ${hoja} (${r.status}).`, status: r.status }, r.status === 423 || r.status === 409 ? r.status : 502);
      const x = await r.json(); return json({ ok: true, address: x.address || "", values: x.values || [] });
    }
    if (url.pathname === "/od/celdas") {
      const arch = String(b.archivo || ""), hoja = String(b.hoja || ""), addr = String(b.addr || "");
      if (!RUTA_OK(arch) || !/\.xlsx$/i.test(arch) || !hoja || hoja.length > 60 || !/^[A-Z]{1,3}[0-9]{1,6}$/.test(addr)) return json({ error: "Celda no válida." }, 400);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "celdas", id: `${arch}!${hoja}!${addr}`, correo, reglas: quien.admin || quien.contab ? [] : ["solo Contabilidad cambia la lista de colaboradores"] }); if (no) return no;
      let r = await graphApp(env, `/drives/${d}/items/${await carpetaRd(env, ["_maestros"])}:/${encodeURIComponent(arch)}?$select=id`);
      if (!r.ok) return json({ error: `No se encontró «${arch}» en los maestros (${r.status}).`, status: r.status }, r.status === 404 ? 404 : 502);
      const id = (await r.json()).id;
      r = await graphApp(env, `/drives/${d}/items/${id}/workbook/worksheets/${encodeURIComponent(hoja)}/range(address='${addr}')`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [[b.valor == null ? "" : b.valor]] }) });
      if (!r.ok) return json({ error: `Excel no guardó la celda ${addr} (${r.status}).`, status: r.status }, r.status === 423 || r.status === 409 ? r.status : 502);
      return json({ ok: true });
    }
    if (url.pathname === "/od/borrar") {
      const id = String(b.id || ""); if (!/^01[A-Z0-9]{20,}$/i.test(id)) return json({ error: "Id no válido." }, 400);
      let r = await graphApp(env, `/drives/${d}/items/${id}?$select=id,name,parentReference,folder`);
      if (r.status === 404) return json({ ok: true, yaNoEstaba: true });
      if (!r.ok) return json({ error: `No se pudo leer el archivo (${r.status}).`, status: r.status }, 502);
      const it = await r.json();
      /* sube por las carpetas (persona → mes → Rendiciones) por id: no depende de la ruta, que Graph puede no mostrar */
      const padre = async x => { const q = await graphApp(env, `/drives/${d}/items/${x}?$select=id,name,parentReference`); return q.ok ? q.json() : null; };
      const pid = (it.parentReference || {}).id, p1 = pid ? await padre(pid) : null, p2 = p1 && (p1.parentReference || {}).id ? await padre(p1.parentReference.id) : null;
      const m = p1 && p2 && (p2.parentReference || {}).id === RD_ROOT && /^\d{4}-\d{2}$/.test(p2.name) ? [null, p2.name, p1.name] : null;
      if (it.folder || !m || !EXT_DOC.test(it.name || "")) return json({ error: "Solo se eliminan fotos o PDF de una rendición." }, 400);
      const v = revisarSubida(await maestrosSrv(env), [m[1], m[2]], it.name, quien);
      const no = await anotarOBloquear(env, ctx, avisos, json, { op: "borrar", id: m[1] + "/" + m[2] + "/" + it.name, correo, reglas: v.reglas || [] }); if (no) return no;
      r = await graphApp(env, `/drives/${d}/items/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) return json({ error: `OneDrive no eliminó el archivo (${r.status}).`, status: r.status }, 502);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: (e && e.error) || "Error al guardar en OneDrive.", status: (e && e.status) || 502 }, (e && e.status) || 502);
  }
}
