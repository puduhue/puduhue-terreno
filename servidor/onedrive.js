/*
  OneDrive con la credencial propia del servidor (v193.1, etapa 1 del plan «que solo el servidor escriba en Rendiciones»).
  ---------------------------------------------------------------------------------------------------------------------
  El servidor entra a Microsoft Graph como aplicación («Puduhue Terreno Servidor» en Entra), no como una persona:
    - permiso de aplicación Files.SelectedOperations.Selected, con consentimiento de administrador;
    - acceso de escritura SOLO a la carpeta «Apps de terreno» (asignado el 16-11-2026 desde Graph Explorer con
      POST /drives/{drive}/items/{Apps de terreno}/permissions, roles ["write"]); fuera de esa carpeta Graph responde 403.
  El inquilino bloquea los secretos de cliente (directiva «Bloquear la adición de contraseñas»), así que se usa un CERTIFICADO:
  el servidor firma una «afirmación» (JWT RS256 con la clave privada, cabecera x5t con la huella del certificado) y la cambia
  por un token de Graph (client_credentials con client_assertion). El token se guarda en memoria hasta 5 minutos antes de vencer.

  Variables en Cloudflare:
    OD_CLAVE_PRIVADA  (Secret)  la clave privada del certificado, en PEM PKCS#8 («-----BEGIN PRIVATE KEY-----»). Solo Benja la tiene.
    OD_CLIENT_ID      (texto)   opcional. Id. de cliente de la aplicación del servidor; por defecto el de OD_POR_DEFECTO
    OD_CERT_X5T       (texto)   opcional. Huella SHA-1 del certificado en base64url; por defecto la de OD_POR_DEFECTO
    OD_DRIVE, OD_RAIZ (texto)   opcionales. El drive y la carpeta «Apps de terreno»; por defecto los de OD_POR_DEFECTO
    TENANT_ID         (texto)   el mismo de worker.js (organización de Microsoft de Puduhue)
  Ninguno de los valores por defecto es una clave: son identificadores (el drive ya está en index.html, que es público).

  Rutas (solo el administrador, CORREOS_ACTUALIZAR):
    GET /od/prueba             pide el token y lee la carpeta «Apps de terreno» (nombre y subcarpetas)
    GET /od/prueba?escribir=1  además escribe «Apps de terreno/_servidor/prueba.json» (comprueba el permiso de escritura)
*/
export const OD_POR_DEFECTO = {
  tenant: "8812d491-c151-4cf4-ad03-7671f57a4a23",
  client: "aebc4ba7-48e6-4203-9806-6a3fdb9ba0f3",
  x5t: "K3woSguk8_8xx6spcjEgpLktPjc",
  drive: "b!nCeXkUkQakyXzjNEG02DFgw2I-0bYBdJhlmDvTiBzBSTkCzagsNQTbjlr-nZSEjm",
  raiz: "01RAJ2KQG27XHPXON25ZHJ6JKECNPMSMV4",
};
export const GRAPH = "https://graph.microsoft.com/v1.0";
export const odConfig = env => ({
  tenant: String(env.TENANT_ID || OD_POR_DEFECTO.tenant).trim(),
  client: String(env.OD_CLIENT_ID || OD_POR_DEFECTO.client).trim(),
  x5t: String(env.OD_CERT_X5T || OD_POR_DEFECTO.x5t).trim(),
  drive: String(env.OD_DRIVE || OD_POR_DEFECTO.drive).trim(),
  raiz: String(env.OD_RAIZ || OD_POR_DEFECTO.raiz).trim(),
});
export const odListo = env => /-----BEGIN PRIVATE KEY-----/.test(String(env.OD_CLAVE_PRIVADA || ""));

const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uTxt = s => b64u(new TextEncoder().encode(s));

/* La clave privada PEM (PKCS#8) a una llave de WebCrypto. Acepta los saltos de línea escritos como «\n» (como suele quedar al
   pegarla en una sola línea). Una clave «BEGIN RSA PRIVATE KEY» (PKCS#1) no sirve: hay que convertirla a PKCS#8. */
let LLAVE = null, LLAVE_DE = "";
async function llave(env) {
  const pem = String(env.OD_CLAVE_PRIVADA || "").replace(/\\n/g, "\n");
  if (LLAVE && LLAVE_DE === pem) return LLAVE;
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) throw { status: 500, error: "La clave del certificado está en formato PKCS#1; se necesita PKCS#8 («BEGIN PRIVATE KEY»)." };
  const m = pem.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
  if (!m) throw { status: 503, error: "Falta la clave del certificado del servidor (OD_CLAVE_PRIVADA)." };
  const der = Uint8Array.from(atob(m[1].replace(/\s+/g, "")), c => c.charCodeAt(0));
  try { LLAVE = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]); }
  catch (e) { throw { status: 500, error: "La clave del certificado no se pudo leer (¿está completa y es RSA?)." }; }
  LLAVE_DE = pem; return LLAVE;
}

/* La afirmación firmada que Microsoft pide en lugar del secreto (client_assertion, válida 10 minutos) */
export async function afirmacion(env, ahora = Date.now()) {
  const c = odConfig(env), t = Math.floor(ahora / 1000);
  const h = b64uTxt(JSON.stringify({ alg: "RS256", typ: "JWT", x5t: c.x5t }));
  const p = b64uTxt(JSON.stringify({ aud: `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, iss: c.client, sub: c.client,
    jti: crypto.randomUUID(), nbf: t - 60, iat: t, exp: t + 600 }));
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await llave(env), new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64u(firma);
}

/* Token de Graph de la aplicación, guardado en memoria hasta 5 minutos antes de vencer */
let TOKEN = null;
export function odOlvidarToken() { TOKEN = null; LLAVE = null; LLAVE_DE = ""; }
export async function tokenGraphApp(env, ahora = Date.now()) {
  const c = odConfig(env);
  if (TOKEN && TOKEN.client === c.client && TOKEN.vence - 300000 > ahora) return TOKEN.valor;
  const cuerpo = new URLSearchParams({ client_id: c.client, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: await afirmacion(env, ahora) });
  let r;
  try { r = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: cuerpo.toString() }); }
  catch (e) { throw { status: 502, error: "No se pudo conectar con Microsoft para pedir el token del servidor." }; }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j.access_token) {
    /* el texto de Microsoft trae el código AADSTS (sin datos secretos): sirve para saber qué falta en Entra */
    const det = String(j.error_description || j.error || r.status).split(/\r?\n/)[0].slice(0, 300);
    throw { status: 502, error: "Microsoft no entregó el token del servidor: " + det };
  }
  TOKEN = { valor: j.access_token, vence: ahora + (+j.expires_in || 3600) * 1000, client: c.client };
  return TOKEN.valor;
}

/* Un pedido a Graph con el token de la aplicación. Devuelve la respuesta tal cual (el que llama decide qué hacer con 403, 412…);
   con 401 olvida el token y lo pide de nuevo una vez. */
export async function graphApp(env, ruta, op = {}, reintento = true) {
  const tok = await tokenGraphApp(env);
  const h = Object.assign({}, op.headers || {}, { Authorization: "Bearer " + tok });
  let r;
  try { r = await fetch(ruta.startsWith("https://") ? ruta : GRAPH + ruta, Object.assign({}, op, { headers: h })); }
  catch (e) { throw { status: 502, error: "No se pudo conectar con OneDrive." }; }
  if (r.status === 401 && reintento) { TOKEN = null; return graphApp(env, ruta, op, false); }
  return r;
}

const errGraph = async r => { let j = {}; try { j = await r.json(); } catch (e) {} return ((j.error && (j.error.code + ": " + j.error.message)) || String(r.status)).slice(0, 300); };

/* /od/prueba: comprueba la credencial (token), la lectura de «Apps de terreno» y, con ?escribir=1, la escritura */
export async function rutasOneDrive(req, env, url, { correo, json, autorizado }, extra) {
  if (!url.pathname.startsWith("/od/")) return null;
  if (url.pathname === "/od/rend" && extra && extra.rend) return extra.rend(); /* v194: rendiciones (rendod.js; cualquier cuenta, con reglas) */
  if (!autorizado) return json({ error: "Solo el administrador puede usar esta ruta." }, 403);
  if (url.pathname === "/od/avisos" && req.method === "GET" && extra && extra.avisos) { /* v194: lo que no cumplió las reglas */
    const L = await extra.avisos.odLeer(); return json({ ok: true, modo: extra.modo, total: L.length, avisos: L.slice(-100).reverse() }); }
  if (url.pathname !== "/od/prueba" || req.method !== "GET") return json({ error: "Ruta desconocida." }, 404);
  if (!odListo(env)) return json({ ok: false, paso: "clave", error: /BEGIN RSA PRIVATE KEY/.test(String(env.OD_CLAVE_PRIVADA || "")) ? "La clave del certificado está en formato PKCS#1; se necesita PKCS#8 («BEGIN PRIVATE KEY»)." : "Falta la clave del certificado del servidor (OD_CLAVE_PRIVADA) en Cloudflare." }, 503);
  const c = odConfig(env), res = { ok: false, client: c.client, raiz: c.raiz };
  try { await tokenGraphApp(env); res.token = true; }
  catch (e) { return json({ ...res, paso: "token", error: e.error || String(e) }, e.status || 502); }
  let r = await graphApp(env, `/drives/${encodeURIComponent(c.drive)}/items/${c.raiz}`);
  if (!r.ok) return json({ ...res, paso: "leer", status: r.status, error: "No se pudo leer «Apps de terreno»: " + await errGraph(r) }, 502);
  const it = await r.json(); res.carpeta = it.name;
  r = await graphApp(env, `/drives/${encodeURIComponent(c.drive)}/items/${c.raiz}/children?$select=name,folder&$top=200`);
  if (r.ok) res.subcarpetas = ((await r.json()).value || []).filter(x => x.folder).map(x => x.name).sort();
  else res.subcarpetas_error = await errGraph(r);
  if (url.searchParams.get("escribir") === "1") {
    const cuerpo = JSON.stringify({ hora: new Date().toISOString(), por: correo, nota: "Prueba de escritura del servidor (v193.1). Se puede borrar." }, null, 1);
    r = await graphApp(env, `/drives/${encodeURIComponent(c.drive)}/items/${c.raiz}:/_servidor/prueba.json:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: cuerpo });
    if (!r.ok) return json({ ...res, paso: "escribir", status: r.status, error: "No se pudo escribir en «Apps de terreno»: " + await errGraph(r) }, 502);
    const w = await r.json(); res.escrito = { nombre: w.name, ruta: "Apps de terreno/_servidor/" + w.name, tam: w.size };
  }
  res.ok = true; return json(res);
}
