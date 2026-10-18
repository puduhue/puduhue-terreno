/* Guarda la app en el teléfono para que abra sin señal. Cambia VER al publicar una versión nueva. */
const VER="actas-v103";
/* v100: la copia de prueba (carpeta prueba/) usa cachés con otro nombre y solo borra las suyas,
   para no tocar las de la app real (las cachés son comunes a todo puduhue.github.io). */
const PRUEBA=self.registration.scope.includes("/prueba/"),PRE=PRUEBA?"prueba-":"";
const CACHE=PRE+VER;
/* v102-v103: estilos.css y los módulos (modulos/*.js) van en la misma caché que index.html: se bajan juntos en cada versión */
const FILES=["./","index.html","estilos.css","modulos/checklist.js","modulos/bodega.js","modulos/rendiciones.js","modulos/actas-entrega.js","manifest.json","icon-180.png","icon-192.png","icon-512.png","badge-96.png"];
/* Bibliotecas que no cambian entre versiones: cada una queda guardada en su propia caché (por carpeta y versión)
   y no se baja de nuevo con cada versión de la app. */
const LIBS=["pdfjs-6.3.289","zxing-wasm-3.1.4","msal-browser-3.30.0","xlsx-0.18.5","jspdf-2.5.1","marca-puduhue-1"];
/* Las que la app carga al abrir (inicio de sesión, Excel, PDF y, desde la v101, los logos) se descargan al instalar, si no están ya,
   para que abra sin señal desde el primer momento. El lector de PDF y el del código del SII se guardan
   la primera vez que se usan. */
const LIB_INICIO=["lib/msal-browser-3.30.0/msal-browser.min.js","lib/xlsx-0.18.5/xlsx.mini.min.js","lib/jspdf-2.5.1/jspdf.umd.min.js","lib/marca-puduhue-1/marcas.js"];
const libCache=n=>PRE+"lib-"+n;
self.addEventListener("install",e=>{e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"}))))
  .then(()=>Promise.all(LIB_INICIO.map(f=>caches.open(libCache(f.split("/")[1])).then(c=>c.match(f).then(r=>r||c.add(new Request(f,{cache:"reload"})))))))
  .then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("prueba-")===PRUEBA&&k!==CACHE&&!LIBS.map(libCache).includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  if(e.request.url.includes("__ping"))return; /* prueba de conexión: siempre va a la red */
  const lib=u.pathname.match(/\/lib\/([^/]+)\//);
  if(lib&&LIBS.includes(lib[1])){
    e.respondWith(caches.open(libCache(lib[1])).then(c=>c.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok)c.put(e.request,res.clone());return res}))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok)c.put(e.request,res.clone());return res
  }).catch(()=>e.request.mode==="navigate"?c.match("index.html"):Response.error()))))
});
/* v83: notificaciones. Llegan cifradas desde el servidor de la app; aquí se muestran y, al tocarlas, se abre la app. */
self.addEventListener("push",e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(x){d={texto:e.data?e.data.text():""}}
  const op={body:d.texto||"",icon:"icon-192.png",badge:"badge-96.png",lang:"es",data:{url:d.url||"./"}};
  if(d.etiqueta){op.tag=d.etiqueta;op.renotify=true}
  e.waitUntil(self.registration.showNotification(d.titulo||"Puduhue Terreno",op));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if(c.url.startsWith(self.registration.scope)&&"focus" in c){c.postMessage({tipo:"abrir",url});return c.focus()}}
    return self.clients.openWindow(url);
  }));
});
