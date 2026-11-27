/* v236 del servidor (app v245): kilometraje en vehículo propio.
   /ruta  (POST {puntos:[[lat,lon],[lat,lon]]}) → km por camino y la línea de la ruta, con OpenRouteService de HeiGIT (api.heigit.org, perfil auto).
   /lugar (GET ?q=texto o ?lat=&lon=)           → lugares que calzan con el texto, o el nombre del punto tocado en el mapa.
   La clave va como secreto ORS_CLAVE en Cloudflare (la crea Benja). Sin la clave, responde 503 con un mensaje claro. */
const ORS = "https://api.heigit.org"; /* api.openrouteservice.org se retiró en noviembre de 2026 */
const FOCO = { lat: -40.574, lon: -73.133 }; /* Osorno: los resultados de la búsqueda se ordenan desde aquí */
/* v237: nombres de los lugares más claros (Benja: «¿por qué aparecen así y no como en Google Maps?»): la región con su nombre
   completo (no «LR»), qué es cada resultado (ciudad, calle, sector…), la dirección con número y sin repetidos; la búsqueda solo
   en el sur (RADIO_KM alrededor de Osorno). */
const RADIO_KM = 350;
const TIPO = { venue: "lugar", address: "dirección", street: "calle", neighbourhood: "sector", borough: "sector", locality: "ciudad", localadmin: "comuna", county: "provincia", region: "región" };
const sinRegion = r => String(r || "").replace(/^Regi[oó]n( del| de)?\s+/i, "").trim(); /* «Región de Los Ríos» → «Los Ríos» */
export function nombreLugar(pr, conTipo) {
  pr = pr || {};
  const base = pr.layer === "address" && pr.street ? `${pr.street}${pr.housenumber ? " " + pr.housenumber : ""}` : String(pr.name || pr.label || "").split(",")[0].trim();
  const partes = [base];
  const lugar = pr.locality || pr.localadmin || pr.county || "";
  if (lugar && lugar.toLowerCase() !== base.toLowerCase()) partes.push(lugar);
  const reg = sinRegion(pr.region);
  if (reg && !partes.some(x => x.toLowerCase() === reg.toLowerCase())) partes.push(reg);
  const n = partes.filter(Boolean).join(", ");
  return conTipo && TIPO[pr.layer] ? `${n} · ${TIPO[pr.layer]}` : n;
}
const enChile = (lat, lon) => lat > -56.5 && lat < -17 && lon > -76.5 && lon < -66;
const num = x => (typeof x === "number" ? x : parseFloat(x));

export async function rutaKm(env, body) {
  if (!env.ORS_CLAVE) return { estado: 503, cuerpo: { error: "El cálculo de km todavía no está activo: falta la clave del servicio de rutas en el servidor." } };
  const P = Array.isArray(body && body.puntos) ? body.puntos.map(p => [num(p[0]), num(p[1])]) : [];
  if (P.length < 2 || P.length > 6 || P.some(p => !isFinite(p[0]) || !isFinite(p[1]) || !enChile(p[0], p[1])))
    return { estado: 400, cuerpo: { error: "Marca el origen y el destino dentro de Chile." } };
  const r = await fetch(`${ORS}/openrouteservice/v2/directions/driving-car/geojson`, {
    method: "POST", headers: { Authorization: env.ORS_CLAVE, "Content-Type": "application/json", Accept: "application/geo+json" },
    body: JSON.stringify({ coordinates: P.map(p => [p[1], p[0]]), radiuses: P.map(() => 1500) })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = String((j.error && (j.error.message || j.error)) || "");
    if (r.status === 404 || /routable point|could not find/i.test(m)) return { estado: 422, cuerpo: { error: "Uno de los puntos está lejos de un camino. Márcalo sobre un camino o una calle." } };
    if (r.status === 401 || r.status === 403) return { estado: 502, cuerpo: { error: "El servicio de rutas rechazó la clave del servidor. Avísale al administrador." } };
    if (r.status === 429) return { estado: 429, cuerpo: { error: "Se pidieron muchas rutas seguidas. Espera un minuto y vuelve a intentar." } };
    return { estado: 502, cuerpo: { error: "El servicio de rutas no respondió. Vuelve a intentar en un rato." } };
  }
  const f = j.features && j.features[0];
  const m = f && f.properties && f.properties.summary && f.properties.summary.distance;
  if (!(m > 0)) return { estado: 422, cuerpo: { error: "No se encontró un camino entre esos puntos." } };
  const G = (f.geometry && f.geometry.coordinates || []).map(c => [Math.round(c[1] * 1e5) / 1e5, Math.round(c[0] * 1e5) / 1e5]);
  const paso = Math.max(1, Math.ceil(G.length / 400)), geo = G.filter((x, i) => i % paso === 0 || i === G.length - 1);
  return { estado: 200, cuerpo: { ok: true, km: Math.round(m / 100) / 10, geo, fuente: "openrouteservice" } };
}

export async function buscarLugar(env, url) {
  if (!env.ORS_CLAVE) return { estado: 503, cuerpo: { error: "La búsqueda de lugares todavía no está activa. Toca el lugar en el mapa." } };
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 120);
  const lat = num(url.searchParams.get("lat")), lon = num(url.searchParams.get("lon"));
  let u;
  if (q) {
    if (q.length < 3) return { estado: 400, cuerpo: { error: "Escribe al menos 3 letras." } };
    u = `${ORS}/pelias/v1/search?text=${encodeURIComponent(q)}&boundary.country=CL&boundary.circle.lat=${FOCO.lat}&boundary.circle.lon=${FOCO.lon}&boundary.circle.radius=${RADIO_KM}&focus.point.lat=${FOCO.lat}&focus.point.lon=${FOCO.lon}&size=10&lang=es`;
  } else if (isFinite(lat) && isFinite(lon) && enChile(lat, lon)) {
    u = `${ORS}/pelias/v1/reverse?point.lat=${lat}&point.lon=${lon}&size=1&lang=es`;
  } else return { estado: 400, cuerpo: { error: "Falta el texto o el punto." } };
  const r = await fetch(u, { headers: { Authorization: env.ORS_CLAVE, Accept: "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { estado: 502, cuerpo: { error: "No se pudo buscar el lugar. Toca el lugar en el mapa." } };
  const vistos = new Set(), lugares = [];
  for (const f of j.features || []) {
    const c = f.geometry && f.geometry.coordinates; if (!c) continue;
    const l = { n: nombreLugar(f.properties, !!q), lat: c[1], lon: c[0] };
    if (!l.n || !enChile(l.lat, l.lon) || vistos.has(l.n)) continue;
    vistos.add(l.n); lugares.push(l); if (lugares.length >= 6) break;
  }
  return { estado: 200, cuerpo: { ok: true, lugares } };
}
