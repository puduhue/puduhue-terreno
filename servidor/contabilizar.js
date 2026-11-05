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
*/
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

/* revisar si ya está, enviar y confirmar; devuelve [cuerpo de la respuesta, estado]. Lo usa también la prueba de asientoprueba.js (v163.1) */
export async function enviarAsiento(env, a, { tokenFinnegans, FINN }) {
  const tok = await tokenFinnegans(env);
  const ruta = `${ENTIDAD}/${encodeURIComponent(a.idExt)}`;
  // 1. ¿Ya está cargada?
  let g = await finn(FINN, ruta, tok);
  let x = g.ok ? asientoDe(g.datos) : null;
  if (x) return [{ ok: true, ya: true, numero: numeroDe(x), interno: x.NumeroInterno ?? null, idExt: a.idExt }, 200];
  if (g.estado !== 404) return [{ error: "No se pudo revisar en FinnegansGO si la rendición ya estaba cargada. No se envió nada; intenta de nuevo.", detalle: motivoFinn(g, tok) }, 502];
  // 2. Enviar
  const p = await finn(FINN, ENTIDAD, tok, a.cuerpo);
  // 3. Confirmar (también si el POST falló: puede haber quedado creado)
  g = await finn(FINN, ruta, tok);
  x = g.ok ? asientoDe(g.datos) : null;
  if (x) return [{ ok: true, numero: numeroDe(x), interno: x.NumeroInterno ?? null, idExt: a.idExt, debe: a.debe }, 200];
  if (!p.ok) return [{ error: "FinnegansGO no aceptó el asiento.", detalle: motivoFinn(p, tok), estado: p.estado }, p.estado === 401 || p.estado === 403 ? 403 : 422];
  // el POST dijo que sí pero el GET aún no lo encuentra: se toma lo que devolvió el POST
  const y = asientoDe(p.datos);
  return [{ ok: true, numero: y ? numeroDe(y) : "", interno: y ? y.NumeroInterno ?? null : null, idExt: a.idExt, debe: a.debe, sinConfirmar: true }, 200];
}

export async function contabilizarAsiento(req, env, { correo, json, esContab, tokenFinnegans, FINN }) {
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!(await esContab())) return json({ error: "Solo Contabilidad o el administrador contabilizan en FinnegansGO." }, 403);
  let body; try { body = await req.json(); } catch (e) { return json({ error: "Cuerpo inválido." }, 400); }
  const a = armarAsiento(body, env);
  if (a.error) return json({ error: a.error }, 400);
  const [r, st] = await enviarAsiento(env, a, { tokenFinnegans, FINN });
  return json(r.ok ? { ...r, por: correo } : r, st);
}
