/* Puduhue Terreno: módulo Stock y Control de bodega (desde la v103 vive en este archivo, aparte de index.html).
   Se carga como script normal después del código general de index.html y antes del arranque (init()), así que comparte
   las mismas variables y funciones globales. Sus escuchadores globales (document/window.addEventListener) quedaron en
   index.html, en su lugar de siempre. El service worker lo guarda junto con index.html. Ver el mapa en CLAUDE.md. */
/* ============================================================
   MÓDULO: Stock (Finnegans · resumenStockPorDeposito)
   Se actualiza a pedido del administrador vía el servidor de Puduhue;
   la foto del stock queda en OneDrive y en el teléfono para consultarla sin señal.
   ============================================================ */
const STK={root:"01RAJ2KQF2KBOXTJBS5VAJHLQZVCLBOCZ6",datos:"01RAJ2KQEA4AYAJGRSLVBI4JELXKHFCDUH",file:"stock.json"};
const puedeVerStock=()=>!!ME&&permVe("stock"); /* desde la v59 todo el equipo ve el stock; v121: salvo a quien el administrador se lo quite */
const puedeActStock=()=>!!ME; /* desde la v61 todo el equipo puede traer el stock desde Finnegans */
/* Familias y subfamilias de Finnegans vienen a veces con espacios al final: se comparan sin ellos */
const nfam=t=>String(t||"").trim();
const cmpEs=(a,b)=>String(a||"").localeCompare(String(b||""),"es",{sensitivity:"base",numeric:true});
const SK_CAMPOS=["PRODUCTOID","PRODUCTO","PRODUCTOCODIGO","DEPOSITOID","DEPOSITO","CANTIDAD1","UNIDAD1","CANTIDAD2","UNIDAD2","PRECIOUNIDADSTOCK1","IMPORTE","MONEDA","FAMILIA","SUBFAMILIA","RUBRO","PUNTOREPOSICION","STOCKMINIMO","STOCKDISPONIBLE","STOCKRESERVADO","PARTIDA","PARTIDA_VTO","LUGAR","ORGANIZACION"];
let STOCK=null,STOCK_ETAG="",skDep="",skQ="",skFam="",skSub="",skModo="dep",skLim=150,skCargando=false;
const num=x=>{if(x==null||x==="")return 0;if(typeof x==="number")return x;const n=parseFloat(String(x).replace(/\s/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."));return isNaN(n)?0:n};
/* v116: un formateador por cantidad de decimales (crearlo en cada número era lento) */
const FMTN_F={};
const fmtN=(n,d)=>{try{const k=d==null?2:d;const f=FMTN_F[k]||(FMTN_F[k]=new Intl.NumberFormat("es-CL",{maximumFractionDigits:k,minimumFractionDigits:0}));return f.format(Number(n))}catch(e){return String(n)}};
const fmtP=n=>"$"+fmtN(Math.round(n),0);
function stockFilas(){if(!STOCK)return[];return STOCK.filas.map(r=>{const o={};SK_CAMPOS.forEach((c,i)=>o[c]=r[i]);o.cant=num(o.CANTIDAD1);o.imp=num(o.IMPORTE);o.pr=num(o.PUNTOREPOSICION);o.bajo=o.pr>0&&o.cant<o.pr;return o})}
let SKF=null,SKF_T="";function filas(){if(!STOCK)return[];if(SKF_T!==STOCK.hora){SKF=stockFilas();SKF_T=STOCK.hora}return SKF}
async function stockCargarLocal(){try{if(IDB.db){const d=await IDB.get("remote","stock/actual");if(d&&d.filas){STOCK=d;STOCK_ETAG=d.etag||""}}}catch(e){}}
async function stockPull(){
  if(!DB||navigator.onLine===false||!(puedeVerStock()||puedeContar()))return false;
  let meta=null;try{meta=await gjson(`/drives/${M365.drive}/items/${STK.datos}:/${STK.file}?$select=id,eTag`)}catch(e){if(e.code!=="not_found")throw e;return false}
  if(meta.eTag===STOCK_ETAG&&STOCK)return false;
  const r=await gfetch(`/drives/${M365.drive}/items/${meta.id}/content`);const d=await r.json();d.etag=meta.eTag;STOCK=d;STOCK_ETAG=meta.eTag;
  try{if(IDB.db)await IDB.put("remote","stock/actual",d)}catch(e){}
  return true;
}
async function stockActualizar(silencioso){
  if(!puedeActStock()){toast("Tu cuenta no puede actualizar el stock.");return}
  if(navigator.onLine===false){toast("Necesita señal para consultar Finnegans.");return}
  /* para no consultar Finnegans muchas veces seguidas: si se actualizó hace menos de 5 minutos, ya está al día */
  if(!silencioso&&!esAdmin()&&STOCK&&Date.now()-new Date(STOCK.hora)<5*60000){toast(`El stock se actualizó ${hace_(STOCK.hora)}; ya está al día.`);return}
  skCargando=true;render();if(!silencioso)toast("Consultando Finnegans… puede tardar unos segundos.");
  try{
    const j=await workerFetch("/stock");
    const datos=Array.isArray(j.datos)?j.datos:(j.datos&&Array.isArray(j.datos.data)?j.datos.data:[]);
    if(!datos.length)throw{error:"Finnegans respondió sin filas de stock."};
    const snap={hora:j.hora||new Date().toISOString(),por:ME?{id:ME.id,nombre:ME.nombre}:null,reporte:j.reporte,campos:SK_CAMPOS,filas:datos.map(o=>SK_CAMPOS.map(c=>o[c]==null?"":o[c]))};
    const body=JSON.stringify(snap);
    const up=await gfetch(`/drives/${M365.drive}/items/${STK.datos}:/${STK.file}:/content`,{method:"PUT",headers:{"Content-Type":"application/json"},body});const it=await up.json();
    snap.etag=it.eTag;STOCK=snap;STOCK_ETAG=it.eTag;try{if(IDB.db)await IDB.put("remote","stock/actual",snap)}catch(e){}
    toast(`Stock actualizado: ${datos.length} registros.`);
    stockExcel().catch(e=>console.warn("excel stock",e));return true;
  }catch(e){toast(e&&e.error?e.error:"No se pudo actualizar el stock.");return false}
  finally{skCargando=false;render()}
}
async function stockExcel(){
  if(!window.XLSX||!STOCK)return;const F=filas();const wb=XLSX.utils.book_new();
  const h=["Depósito","Código","Producto","Familia","Subfamilia","Rubro","Cantidad","Unidad","Cantidad 2","Unidad 2","Precio unitario","Importe","Moneda","Punto reposición","Bajo reposición","Disponible","Reservado","Partida","Vencimiento"];
  const rows=[h].concat(F.map(o=>[o.DEPOSITO,o.PRODUCTOCODIGO,o.PRODUCTO,o.FAMILIA,o.SUBFAMILIA,o.RUBRO,o.cant,o.UNIDAD1,num(o.CANTIDAD2)||"",o.UNIDAD2,num(o.PRECIOUNIDADSTOCK1)||"",o.imp,o.MONEDA,o.pr||"",o.bajo?"Sí":"",num(o.STOCKDISPONIBLE)||"",num(o.STOCKRESERVADO)||"",o.PARTIDA,o.PARTIDA_VTO]));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[22,12,34,16,16,14,10,8,10,8,12,14,8,10,8,10,10,12,12].map(w=>({wch:w}));ws["!freeze"]={xSplit:0,ySplit:1};ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:h.length-1}})};
  XLSX.utils.book_append_sheet(wb,ws,"Stock");
  const dep={};F.forEach(o=>{const d=dep[o.DEPOSITO]||(dep[o.DEPOSITO]={n:0,imp:0,bajo:0});d.n++;d.imp+=o.imp;if(o.bajo)d.bajo++});
  const r2=[["Depósito","Productos","Importe total","Bajo punto de reposición"]].concat(Object.entries(dep).sort((a,b)=>b[1].imp-a[1].imp).map(([k,v])=>[k,v.n,v.imp,v.bajo]));
  r2.push([]);r2.push(["Stock al",fmtFecha(STOCK.hora)]);r2.push(["Actualizado por",STOCK.por?STOCK.por.nombre:""]);
  const w2=XLSX.utils.aoa_to_sheet(r2);w2["!cols"]=[{wch:28},{wch:10},{wch:16},{wch:22}];XLSX.utils.book_append_sheet(wb,w2,"Por depósito");
  const buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
  await subirExcel("stock",false,async()=>{const r=await gfetch(`/drives/${M365.drive}/items/${STK.root}:/Stock_Finnegans.xlsx:/content`,{method:"PUT",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},body:new Blob([buf])});await r.json()});
}
function fmtFecha(iso){try{const d=new Date(iso);return fmtD(iso)+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}catch(e){return iso}}
function hace_(iso){const m=Math.round((Date.now()-new Date(iso))/60000);if(m<60)return`hace ${m} min`;const h=Math.round(m/60);if(h<48)return`hace ${h} h`;return`hace ${Math.round(h/24)} días`}

function renderStock(){
  const head=band("Stock");
  const act=puedeActStock()?`<button class="btn pri" data-a="stkAct" ${skCargando||navigator.onLine===false?"disabled":""}>${skCargando?"Consultando Finnegans…":navigator.onLine===false?"Sin señal":"Actualizar desde Finnegans"}</button>`:"";
  if(!STOCK)return head+`<main class="wrap"><h1>Stock</h1><div class="empty">Todavía no hay una consulta de stock guardada.${puedeActStock()?" Toca Actualizar para traerla desde Finnegans.":" Pide que la traigan desde Finnegans."}</div><div class="btns">${act}</div></main>`;
  const F=filas();const deps=[...new Set(F.map(o=>o.DEPOSITO))].sort((a,b)=>String(a).localeCompare(String(b)));const fams=[...new Set(F.map(o=>nfam(o.FAMILIA)).filter(Boolean))].sort(cmpEs);
  const subs=[...new Set(F.filter(o=>!skFam||nfam(o.FAMILIA)===skFam).map(o=>nfam(o.SUBFAMILIA)).filter(Boolean))].sort(cmpEs);if(skSub&&!subs.includes(skSub))skSub="";
  const q=skQ.trim().toLowerCase();
  const L=F.filter(o=>(!skDep||o.DEPOSITO===skDep)&&(!skFam||nfam(o.FAMILIA)===skFam)&&(!skSub||nfam(o.SUBFAMILIA)===skSub)&&(!q||[o.PRODUCTO,o.PRODUCTOCODIGO,o.FAMILIA,o.SUBFAMILIA,o.DEPOSITO].join(" ").toLowerCase().includes(q)));
  const tot=L.reduce((s,o)=>s+o.imp,0),nb=L.filter(o=>o.bajo).length;
  const edad=(Date.now()-new Date(STOCK.hora))/3600000;
  const filtros=`<div class="skf c4">
    <div class="f"><label for="skDep">Depósito</label><select id="skDep" data-sk="dep"><option value="">Todos (${deps.length})</option>${deps.map(d=>`<option ${d===skDep?"selected":""}>${esc(d)}</option>`).join("")}</select></div>
    <div class="f"><label for="skFam">Familia</label><select id="skFam" data-sk="fam"><option value="">Todas</option>${fams.map(d=>`<option ${d===skFam?"selected":""}>${esc(d)}</option>`).join("")}</select></div>
    <div class="f"><label for="skSub">Subfamilia</label><select id="skSub" data-sk="sub"><option value="">Todas</option>${subs.map(d=>`<option ${d===skSub?"selected":""}>${esc(d)}</option>`).join("")}</select></div>
    <div class="f"><label for="skQ">Buscar</label><input id="skQ" type="search" data-sk="q" value="${esc(skQ)}" placeholder="Producto o código"></div></div>
    <div class="filt"><button class="fb" data-a="stkModo" data-m="dep" aria-pressed="${skModo==="dep"}">Por depósito</button><button class="fb" data-a="stkModo" data-m="prod" aria-pressed="${skModo==="prod"}">Por producto</button><button class="fb" data-a="stkModo" data-m="bajo" aria-pressed="${skModo==="bajo"}">Bajo reposición${F.some(o=>o.bajo)?` (${F.filter(o=>o.bajo).length})`:""}</button></div>`;
  let cuerpo="";
  const fila=(o,conDep)=>`<div class="skr${o.bajo?" bajo":""}"><div class="skn"><b>${esc(o.PRODUCTO)}</b><span>${esc(o.PRODUCTOCODIGO)}${conDep?` · ${esc(o.DEPOSITO)}`:""}${o.PARTIDA?` · Partida ${esc(o.PARTIDA)}`:""}${o.PARTIDA_VTO?` · vence ${esc(fmtD(String(o.PARTIDA_VTO).slice(0,10)))}`:""}</span>${o.bajo?`<span class="xp camb">Bajo punto de reposición (${fmtN(o.pr)})</span>`:""}</div><div class="skv"><b>${fmtN(o.cant)} ${esc(o.UNIDAD1||"")}</b><span>${fmtP(o.imp)}</span></div></div>`;
  if(skModo==="dep"&&!skDep&&!q){
    const g={};L.forEach(o=>{const d=g[o.DEPOSITO]||(g[o.DEPOSITO]={n:0,imp:0,bajo:0});d.n++;d.imp+=o.imp;if(o.bajo)d.bajo++});
    cuerpo=`<div class="list">${Object.entries(g).sort((a,b)=>b[1].imp-a[1].imp).map(([k,v])=>`<button class="bod" data-a="stkDep" data-d="${esc(k)}"><span class="bodn">${esc(k)}</span><span class="bodm">${esc(v.n)} ${v.n===1?"producto":"productos"} · <b>${fmtP(v.imp)}</b></span>${v.bajo?`<span class="bodc"><span class="xp camb">${v.bajo} bajo reposición</span></span>`:""}${ICO.arrow}</button>`).join("")}</div>`;
  }else if(skModo==="prod"){
    const g={};L.forEach(o=>{const k=o.PRODUCTOCODIGO||o.PRODUCTO;const p=g[k]||(g[k]={o,cant:0,imp:0,deps:[]});p.cant+=o.cant;p.imp+=o.imp;p.deps.push(o)});
    const P=Object.values(g).sort((a,b)=>String(a.o.PRODUCTO).localeCompare(String(b.o.PRODUCTO)));
    cuerpo=P.slice(0,skLim).map(p=>`<details class="skp"><summary><div class="skn"><b>${esc(p.o.PRODUCTO)}</b><span>${esc(p.o.PRODUCTOCODIGO)} · ${p.deps.length} ${p.deps.length===1?"depósito":"depósitos"}</span></div><div class="skv"><b>${fmtN(p.cant)} ${esc(p.o.UNIDAD1||"")}</b><span>${fmtP(p.imp)}</span></div></summary>${p.deps.sort((a,b)=>b.cant-a.cant).map(o=>`<div class="skd"><span>${esc(o.DEPOSITO)}</span><span>${fmtN(o.cant)} ${esc(o.UNIDAD1||"")} · ${fmtP(o.imp)}</span></div>`).join("")}</details>`).join("")+(P.length>skLim?`<div class="btns"><button class="btn" data-a="stkMas">Mostrar más (${P.length-skLim})</button></div>`:"");
  }else{
    const LL=(skModo==="bajo"?L.filter(o=>o.bajo):L).slice().sort((a,b)=>String(a.PRODUCTO).localeCompare(String(b.PRODUCTO)));
    cuerpo=(LL.length?LL.slice(0,skLim).map(o=>fila(o,!skDep)).join(""):`<div class="empty">Nada que mostrar con estos filtros.</div>`)+(LL.length>skLim?`<div class="btns"><button class="btn" data-a="stkMas">Mostrar más (${LL.length-skLim})</button></div>`:"");
  }
  return head+`<main class="wrap">
    <h1>Stock${skDep?` · ${esc(skDep)}`:""}</h1>
    <div class="lx-sync sks ${edad>48?"camb":"ok"}"><div class="lx-syncl"><span class="lx-synct">Stock al ${fmtFecha(STOCK.hora)}</span><span class="lx-syncs">${hace_(STOCK.hora)}${STOCK.por?` · actualizado por ${esc(STOCK.por.nombre)}`:""}. Se ve sin señal.</span></div>${act}</div>
    ${filtros}
    <div class="lx-stats" style="margin-top:12px"><div><b>${fmtP(tot)}</b><span>valor en stock</span></div><div><b>${fmtN(new Set(L.map(o=>o.PRODUCTOCODIGO)).size,0)}</b><span>productos</span></div><div class="${nb?"warn":""}"><b>${nb}</b><span>bajo reposición</span></div></div>
    <div style="margin-top:14px">${cuerpo}</div>
    <p class="note">El Excel <b>Stock_Finnegans.xlsx</b> en la carpeta <b>Apps de terreno / Stock</b> de OneDrive se regenera en cada actualización. Valores a precio de costo según Finnegans.</p>
  </main>`;
}
async function stkClick(A,b){
  if(A==="stock"){skLim=150;go("stock");return true}
  if(A==="stkAct"){await stockActualizar();return true}
  if(A==="stkModo"){skModo=b.dataset.m;skLim=150;render();return true}
  if(A==="stkDep"){skDep=b.dataset.d;skModo="lista";skLim=150;render();window.scrollTo(0,0);return true}
  if(A==="stkMas"){skLim+=300;render();return true}
  return false;
}
let skT=null;
function stkInput(ev){const t=ev.target;if(!t.dataset.sk)return false;
  if(t.dataset.sk==="dep"){skDep=t.value;if(skModo==="lista"&&!skDep)skModo="dep";skLim=150;render();return true}
  if(t.dataset.sk==="fam"){skFam=t.value;skSub="";skLim=150;render();return true}
  if(t.dataset.sk==="sub"){skSub=t.value;skLim=150;render();return true}
  if(t.dataset.sk==="q"){skQ=t.value;clearTimeout(skT);skT=setTimeout(()=>{skLim=150;if(skModo==="dep"&&skQ)skModo="lista";render();const i=$("#skQ");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250);return true}
  return false}

/* ============================================================
   MÓDULO: Control de bodega (conteo físico contra el stock de Finnegans)
   ============================================================ */
const CB={root:"01RAJ2KQFXDFLPDNY2IJCIZ3BGSVPF74IH"};
const puedeContar=()=>!!ME&&permVe("cb"); /* desde la v59 todo el equipo ve Control de bodega; v121: salvo a quien se le quite (agregar: permAgrega("cb")) */
let CONT={},cbv=null,cbQ="",cbFiltro="pend",cbLim=120,cbFam="",cbSub="";
/* Subfamilia de una línea: los conteos anteriores a la v61 no la guardaban, se toma del stock por código */
let SUBMAP={},SUBMAP_T=null;
function subDeLinea(l){if(l.sub!=null)return nfam(l.sub);const t=STOCK?STOCK.hora:"";if(SUBMAP_T!==t){SUBMAP={};filas().forEach(o=>{if(o.PRODUCTOCODIGO&&!SUBMAP[o.PRODUCTOCODIGO])SUBMAP[o.PRODUCTOCODIGO]=nfam(o.SUBFAMILIA)});SUBMAP_T=t}return SUBMAP[l.cod]||""}
const famDeLinea=l=>nfam(l.fam)||"Sin familia";
const cbRO=()=>!!cbv&&(cbv.estado==="cerrado"||!permAgrega("cb")); /* v121: con «Solo ve», como cerrado */
function conteosDe(dep){return Object.values(CONT).filter(c=>c.bodega===dep).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||(b.n-a.n))}
function conteoAbierto(dep){return conteosDe(dep).find(c=>c.estado!=="cerrado"&&!c.anulado)||null}
function saveCont(c,deb){
  c._col="conteos";CONT[c.id]=c;LOCAL[c.id]=c;status();clearTimeout(LT[c.id]);
  const run=()=>{delete LT[c.id];return localPut(c).then(ok=>{if(!ok&&STORE_OK!==false)toast("No queda espacio en el teléfono para guardar.");schedSync(1000);status()})};
  if(deb){LT[c.id]=setTimeout(run,250);return Promise.resolve()}
  return run();
}
function cbTouch(){if(!cbv)return;cbv.actualizado=new Date().toISOString();if(ME)cbv.modificadoPor=yo();saveCont(cbv,true)}
/* Líneas del conteo: copia del stock del sistema al momento de iniciar + productos agregados a mano */
function nuevoConteo(dep,op){
  op=op||{};const fams=op.familias&&op.familias.length?new Set(op.familias):null;
  const base=filas().filter(o=>o.DEPOSITO===dep&&(!fams||fams.has(o.FAMILIA||"")));
  const lineas={};
  if(op.porPartida){base.forEach((o,i)=>{let k="p"+(o.PRODUCTOID||o.PRODUCTOCODIGO||i)+(o.PARTIDA?"-"+o.PARTIDA:"");k=k.replace(/[^\w-]/g,"_");if(lineas[k])k+="_"+i;lineas[k]={k,cod:o.PRODUCTOCODIGO,prod:o.PRODUCTO,fam:o.FAMILIA||"",sub:nfam(o.SUBFAMILIA),un:o.UNIDAD1||"",un2:o.UNIDAD2||"",sis:o.cant,sis2:num(o.CANTIDAD2),pu:num(o.PRECIOUNIDADSTOCK1)||(o.cant?o.imp/o.cant:0),partida:o.PARTIDA||"",vto:o.PARTIDA_VTO||"",orden:i}})}
  else{/* una línea por producto: las partidas se suman y quedan como detalle */
    base.forEach((o,i)=>{let k=("p"+(o.PRODUCTOID||o.PRODUCTOCODIGO||i)).replace(/[^\w-]/g,"_");const l=lineas[k]||(lineas[k]={k,cod:o.PRODUCTOCODIGO,prod:o.PRODUCTO,fam:o.FAMILIA||"",sub:nfam(o.SUBFAMILIA),un:o.UNIDAD1||"",un2:o.UNIDAD2||"",sis:0,sis2:0,imp:0,partidas:[],orden:i});
      l.sis+=o.cant;l.sis2+=num(o.CANTIDAD2);l.imp+=o.imp;if(o.PARTIDA)l.partidas.push({p:o.PARTIDA,c:o.cant,v:o.PARTIDA_VTO||""})});
    Object.values(lineas).forEach(l=>{l.pu=l.sis?l.imp/l.sis:0;delete l.imp;if(l.partidas&&!l.partidas.length)delete l.partidas})}
  const prev=conteosDe(dep).filter(c=>!c.anulado);const n=(prev.length?Math.max(...prev.map(c=>c.n||0)):0)+1;
  return{id:uid(),_col:"conteos",bodega:dep,n,fecha:today(),responsable:ME?ME.nombre:"",acompanante:"",estado:"abierto",ciego:!!op.ciego,porPartida:!!op.porPartida,tol:op.tol==null?2:+op.tol,familias:fams?[...fams]:null,stockAl:STOCK?STOCK.hora:"",lineas,items:{},creadoPor:yo(),creado:new Date().toISOString(),actualizado:new Date().toISOString()};
}
/* tolerancia: una diferencia menor al % definido se informa pero no cuenta como discrepancia */
function enTol(c,l,d){if(d===null||Math.abs(d)<1e-9)return true;const t=c.tol==null?2:+c.tol;if(!t)return false;const base=l.sis||0;return base>0&&Math.abs(d)/base*100<=t}
const lineasDe=c=>Object.values(c.lineas||{}).sort((a,b)=>String(a.manual?"zzz":a.fam||"").localeCompare(String(b.manual?"zzz":b.fam||""))||String(a.prod).localeCompare(String(b.prod)));
/* v129: hasta la v128, «= Coincide» guardaba String(l.sis) con punto decimal («12.345» kg se leía 12345): si lo observado es
   exactamente eso, vale la cantidad del sistema */
const obsDe=(c,k)=>{const r=(c.items||{})[k];if(!(r&&r.obs!==undefined&&r.obs!==""))return null;const l=(c.lineas||{})[k];
  return l&&typeof r.obs==="string"&&r.obs===String(l.sis||0)?(l.sis||0):num(r.obs)};
function difDe(c,l){const o=obsDe(c,l.k);if(o===null)return null;return o-(l.sis||0)}
function resumenConteo(c){
  const L=lineasDe(c);let cont=0,ok=0,tol=0,dif=0,falt=0,sobr=0,vf=0,vs=0;
  L.forEach(l=>{const d=difDe(c,l);if(d===null)return;cont++;if(Math.abs(d)<1e-9)ok++;else if(enTol(c,l,d)){tol++}else{dif++;const v=d*(l.pu||0);if(d<0){falt++;vf+=v}else{sobr++;vs+=v}}});
  return{total:L.length,cont,ok,tol,dif,falt,sobr,vf,vs,neto:vf+vs,exact:cont?Math.round((ok+tol)/cont*100):null};
}
/* productos con diferencia en al menos 2 de los últimos 3 conteos cerrados: señal de un problema de proceso, no de un error puntual */
function recurrentes(dep){
  const cs=conteosDe(dep).filter(c=>c.estado==="cerrado"&&!c.anulado).slice(0,3);if(cs.length<2)return[];
  const m={};cs.forEach(c=>lineasDe(c).forEach(l=>{const d=difDe(c,l);if(d===null||enTol(c,l,d))return;const key=l.cod||l.prod;(m[key]=m[key]||{cod:l.cod,prod:l.prod,n:0,ult:null}).n++;if(!m[key].ult)m[key].ult={c:c.n,d,un:l.un}}));
  return Object.values(m).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n);
}

/* ---------- Pantallas ---------- */
function renderCB(){
  const head=band("Control de bodega");
  if(!STOCK)return head+`<main class="wrap"><h1>Control de bodega</h1><div class="empty">Para contar una bodega primero hay que traer el stock desde Finnegans (sección Stock).</div><div class="btns"><button class="btn pri" data-a="stock">Ir a Stock</button></div></main>`;
  const F=filas();const deps=[...new Set(F.map(o=>o.DEPOSITO))].sort((a,b)=>String(a).localeCompare(String(b)));
  const edad=(Date.now()-new Date(STOCK.hora))/3600000;
  const cards=deps.map(d=>{const ab=conteoAbierto(d),cs=conteosDe(d).filter(c=>c.estado==="cerrado"&&!c.anulado),u=cs[0],np=F.filter(o=>o.DEPOSITO===d).length;
    const r=u?resumenConteo(u):null;
    return `<button class="bod" data-a="cbBod" data-d="${esc(d)}"><span class="bodn">${esc(d)}</span><span class="bodm">${np} ${np===1?"producto":"productos"} en sistema${u?` · último conteo ${fmtD(u.fecha)}`:""}</span><span class="bodc">${ab?`<span class="xp camb">Conteo ${esc(ab.n)} en curso</span>`:u?`<span class="xp ok">${cs.length} ${cs.length===1?"conteo":"conteos"}</span>`:`<span class="xp" style="background:var(--soft);color:var(--muted)">Sin conteos</span>`}${r?`<span class="xp ${r.exact>=95?"ok":"nueva"}">${r.exact}% exacto</span>${r.dif?`<span class="xp camb">${r.dif} con diferencia</span>`:""}`:""}</span>${ICO.arrow}</button>`}).join("");
  return head+`<main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>Control de bodega</h1>
    <p class="lead">Elige la bodega, revisa producto por producto y anota la cantidad que encuentras. Al cerrar, la app compara con el stock del sistema y genera el informe.</p>
    ${edad>24?`<div class="info netbox">El stock del sistema es del <b>${fmtFecha(STOCK.hora)}</b> (${hace_(STOCK.hora)}). ${puedeActStock()?"Conviene actualizarlo antes de empezar un conteo.":"Pide que lo actualicen antes de empezar, para comparar con datos recientes."}${puedeActStock()?`<div class="btns" style="margin-top:8px"><button class="btn" data-a="stkAct" ${navigator.onLine===false?"disabled":""}>Actualizar stock ahora</button></div>`:""}</div>`:`<p class="note" style="margin-top:0">Stock del sistema al ${fmtFecha(STOCK.hora)}.</p>`}
    <div class="list">${cards}</div>
  </main>`;
}
function renderCBBod(){
  const d=cbBod,ab=conteoAbierto(d),cs=conteosDe(d);
  const filas_=cs.map(c=>{const r=resumenConteo(c),cer=c.estado==="cerrado",an=!!c.anulado;
    return `<div class="card mcard${an?" anulada":""}"><button class="row" data-a="cbAbrir" data-id="${esc(c.id)}"><span class="tag ${an?"none":cer?"cerrada":"borrador"}">${an?"Anulado":cer?"Cerrado":"En curso"}</span><span class="who">Conteo ${esc(c.n)}</span><span class="when">${fmtD(c.fecha)}</span>
      <span class="where">${esc(c.responsable||"")} · ${r.cont} de ${r.total} contados${r.dif?` · ${r.dif} con diferencia`:""}</span><span class="st">${!an&&r.exact!==null?`<b>${r.exact}%</b>`:""}</span>
      <span class="by">${chipSync(c)}${an?` <span class="aut">Anulado el ${fmtD(c.anulado.fecha)} por ${esc(quien(c.anulado.por))}${c.anulado.motivo?`: ${esc(c.anulado.motivo)}`:""}</span>`:autoriaTxt(c)?` <span class="aut">${autoriaHTML(c)}</span>`:""}</span></button>
      ${mnBtn("mnCb",c.id,"Opciones del conteo "+c.n)}</div>`}).join("");
  return `<div class="top"><div class="in"><div class="bar" style="padding-bottom:10px"><button class="back" data-a="cb">Bodegas</button><div class="ttl">${esc(d)}</div>${estadoChip()}</div></div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>${esc(d)}</h1>
    <div class="start" style="grid-template-columns:1fr">${ab?`<button class="big dev" data-a="cbAbrir" data-id="${esc(ab.id)}"><strong>Continuar conteo ${esc(ab.n)}</strong><span>Iniciado el ${fmtD(ab.fecha)} por ${esc(ab.responsable||"")} · ${resumenConteo(ab).cont} de ${resumenConteo(ab).total} contados</span></button>`
      :`<button class="big ent" data-a="cbNuevo" data-d="${esc(d)}"><strong>Nuevo conteo</strong><span>${filas().filter(o=>o.DEPOSITO===d).length} productos según el stock del ${fmtFecha(STOCK.hora)}</span></button>`}</div>
    ${(()=>{const rc=recurrentes(d);if(!rc.length)return"";return`<h2>Diferencias recurrentes<span class="cnt">${rc.length}</span></h2><p class="note" style="margin-top:0">Productos con discrepancia en al menos 2 de los últimos 3 conteos. Suele indicar un problema de registro o de manejo, no un error de conteo.</p>${rc.map(x=>`<div class="skr"><div class="skn"><b>${esc(x.prod)}</b><span>${esc(x.cod||"")} · en ${x.n} conteos</span></div><div class="skv"><b>${x.ult.d<0?"Faltaban":"Sobraban"} ${fmtN(Math.abs(x.ult.d))} ${esc(x.ult.un)}</b><span>conteo ${x.ult.c}</span></div></div>`).join("")}`})()}
    <h2>Conteos<span class="cnt">${cs.length}</span></h2>${cs.length?`${disTip("mncb",`En el «⋯» de cada conteo está el informe PDF${esAdmin()?", anular y restaurar":" y eliminar los que están en curso"}. En el teléfono también puedes deslizar la fila hacia la izquierda.`)}`:""}
    <div class="list">${filas_||`<div class="empty">Todavía no hay conteos en esta bodega.</div>`}</div>
    <p class="note">En OneDrive: <b>Control de bodega / ${esc(d)} / fecha Conteo N</b> con el informe PDF, el Excel del conteo y las fotos.</p>
  </main>`;
}
let cbBod="";
function cbLineaHTML(l){
  const c=cbv,r=(c.items||{})[l.k]||{},ro=cbRO(),o=obsDe(c,l.k),d=difDe(c,l);
  const est=d===null?"":Math.abs(d)<1e-9?"ok":enTol(c,l,d)?"tol":d<0?"falta":"sobra";
  const mostrarSis=!c.ciego||ro;
  const vtos=[...new Set((l.partidas||[]).map(p=>p.v).filter(Boolean))].sort();
  const fs=l.manual?"":[!cbFam?famDeLinea(l):"",!cbSub?subDeLinea(l):""].filter(Boolean).join(" · ");
  const meta=[fs,l.partida?`Partida ${l.partida}${l.vto?` · vence ${fmtD(String(l.vto).slice(0,10))}`:""}`:l.partidas&&l.partidas.length?`${l.partidas.length} partidas${vtos.length?` · vence ${fmtD(String(vtos[0]).slice(0,10))}${vtos.length>1?" y otras":""}`:""}`:"",l.sis2&&l.un2&&l.un2!==l.un&&mostrarSis?`${fmtN(l.sis2)} ${l.un2}`:""].filter(Boolean).join(" · ");
  return `<div class="it cbl ${est}" id="cbl-${esc(l.k)}">
    <div class="cbh"><span class="cod">${esc(l.cod||"")}</span>${l.manual?'<span class="xp camb">Agregado en terreno</span>':""}</div>
    <div class="txt">${esc(l.prod)}</div>
    ${meta?`<div class="ref">${esc(meta)}</div>`:""}
    <div class="cbsys">${mostrarSis?`Sistema: <b>${fmtN(l.sis||0)} ${esc(l.un)}</b>`:"Cantidad del sistema oculta (conteo ciego)"}</div>
    <div class="cbrow">
      <label class="cbin" for="cbo-${esc(l.k)}"><span class="cbl1">Observado</span><input id="cbo-${esc(l.k)}" type="text" inputmode="decimal" data-cbf="obs" data-k="${esc(l.k)}" value="${r.obs===undefined?"":esc(String(r.obs))}" placeholder="0" ${ro?"disabled":""}><span class="cbun" title="${esc(l.un)}">${esc(l.un)}</span></label>
      ${!ro&&mostrarSis?`<button class="mini cbeq" data-a="cbIgual" data-k="${esc(l.k)}" title="La cantidad coincide con el sistema">= Coincide</button>`:""}
    </div>
    ${d!==null&&mostrarSis?`<div class="cbd ${est}">${est==="ok"?"Coincide con el sistema":est==="tol"?`Diferencia de ${fmtN(Math.abs(d))} ${esc(l.un)}, dentro de la tolerancia`:`${d<0?"Faltan":"Sobran"} ${fmtN(Math.abs(d))} ${esc(l.un)}${l.pu?` · ${fmtP(Math.abs(d*l.pu))}`:""}`}${!ro&&(est==="falta"||est==="sobra")?` <button class="mini" data-a="cbRecontar" data-k="${esc(l.k)}" style="margin-left:8px">Recontar</button>`:""}</div>`:""}
    <div class="fotos"><div class="strip">${(r.fotos||[]).map(f=>ro?thumb(f,l.k,true,false):`<span class="thw">${thumb(f,l.k,true,false)}<button class="thx" data-a="cbDelFoto" data-ref="${esc(f)}" data-k="${esc(l.k)}" aria-label="Eliminar foto">✕</button></span>`).join("")}${!ro&&(r.fotos||[]).length<3?`${ESCRITORIO()?`<label class="addf"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span>Subir foto<input class="vh" type="file" accept="image/*" multiple data-cbfoto="${esc(l.k)}"></label>`:`<label class="addf"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>Cámara<input class="vh" type="file" accept="image/*" capture="environment" data-cbfoto="${esc(l.k)}"></label><label class="addf gal"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span>Galería<input class="vh" type="file" accept="image/*" multiple data-cbfoto="${esc(l.k)}"></label>`}`:""}</div></div>
    ${o!==null||r.com||ro?`<input class="obs" data-cbf="com" data-k="${esc(l.k)}" value="${esc(r.com||"")}" placeholder="Comentario (estado, ubicación, vencido, dañado…)" ${ro?"disabled":""}>`:""}
  </div>`;
}
function cbProgHTML(){const r=resumenConteo(cbv);const pct=r.total?Math.round(r.cont/r.total*100):0;return `<div class="prog" id="cbprog"><span>${r.cont} de ${r.total} contados</span><span class="meter"><i style="width:${pct}%"></i></span><span>${r.dif?`${r.dif} con dif.`:""}</span></div>`}
function renderCBV(){
  const c=cbv,ro=cbRO(),q=cbQ.trim().toLowerCase();
  /* filtros por familia y subfamilia; los productos van en orden alfabético */
  const TODAS=lineasDe(c),stk=TODAS.filter(l=>!l.manual);
  const fams=[...new Set(stk.map(famDeLinea))].sort(cmpEs);if(cbFam&&!fams.includes(cbFam)){cbFam="";cbSub=""}
  const subs=[...new Set(stk.filter(l=>!cbFam||famDeLinea(l)===cbFam).map(subDeLinea).filter(Boolean))].sort(cmpEs);if(cbSub&&!subs.includes(cbSub))cbSub="";
  const BASE=TODAS.filter(l=>(!cbFam||(!l.manual&&famDeLinea(l)===cbFam))&&(!cbSub||(!l.manual&&subDeLinea(l)===cbSub))&&(!q||[l.prod,l.cod,l.fam,subDeLinea(l),l.partida].join(" ").toLowerCase().includes(q)));
  const cuenta={pend:0,dif:0,ok:0};BASE.forEach(l=>{const d=difDe(c,l);if(d===null)cuenta.pend++;else if(enTol(c,l,d))cuenta.ok++;else cuenta.dif++});
  const L=BASE.filter(l=>{const d=difDe(c,l);if(cbFiltro==="pend")return d===null;if(cbFiltro==="dif")return d!==null&&!enTol(c,l,d);if(cbFiltro==="ok")return d!==null&&enTol(c,l,d);return true})
    .sort((a,b)=>(a.manual?1:0)-(b.manual?1:0)||cmpEs(a.prod,b.prod)||cmpEs(a.partida,b.partida));
  const R=resumenConteo(c);
  const nuevo=cbNuevoProd?`<div class="it cat nuevo"><h3 style="margin:0 0 8px">Producto encontrado que no está en el sistema</h3>
    <label class="f"><span>Producto</span><input data-cbn="prod" value="${esc(cbNuevoProd.prod||"")}" placeholder="Nombre del producto"></label>
    <div class="plan2"><label class="f"><span>Código (si lo sabes)</span><input data-cbn="cod" value="${esc(cbNuevoProd.cod||"")}"></label><label class="f"><span>Unidad</span><input data-cbn="un" value="${esc(cbNuevoProd.un||"")}" placeholder="KG, LT, UN…"></label></div>
    <div class="btns"><button class="btn" data-a="cbNuevoCancel">Cancelar</button><button class="btn pri" data-a="cbNuevoAdd" style="flex:1">Agregar al conteo</button></div></div>`:"";
  return `<div class="top"><div class="in"><div class="bar"><button class="back" data-a="cbBodBack">${esc(c.bodega)}</button><div class="ttl">Conteo ${esc(c.n)}</div>${estadoChip()}</div></div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    ${c.anulado?`<div class="info netbox"><b>Conteo anulado</b> el ${fmtD(c.anulado.fecha)} por ${esc(quien(c.anulado.por))}${c.anulado.motivo?`: ${esc(c.anulado.motivo)}`:""}.</div>`:ro?`<div class="info lock">Conteo cerrado el ${fmtD(c.cerrado)}. Ya no se puede modificar.</div>`:""}
    <div class="enc"><div class="f"><label for="cbfe">Fecha</label><input id="cbfe" type="date" data-cbenc="fecha" value="${esc(c.fecha)}" ${ro?"disabled":""}></div>
      <div class="f"><label for="cbre">Responsable</label><input id="cbre" data-cbenc="responsable" value="${esc(c.responsable||"")}" ${ro?"disabled":""}></div>
      <div class="f"><label for="cbac">Acompañante (bodeguero / administrador)</label><input id="cbac" data-cbenc="acompanante" value="${esc(c.acompanante||"")}" ${ro?"disabled":""}></div></div>
    <p class="note" style="margin-top:0">Comparando con el stock del sistema al ${fmtFecha(c.stockAl)}. ${c.familias?`Alcance: ${c.familias.map(esc).join(", ")}. `:""}${c.porPartida?"Por partida. ":"Por producto. "}Tolerancia ${c.tol==null?2:c.tol} %.${ro?"":` <label class="chk" style="display:inline-flex;gap:6px;align-items:center;margin-left:4px"><input type="checkbox" data-cbenc="ciego" ${c.ciego?"checked":""}> Conteo ciego (ocultar la cantidad del sistema)</label>`}</p>
    ${cbProgHTML()}
    <div class="skf"><div class="f"><label for="cbFam">Familia</label><select id="cbFam" data-cbf="fam"><option value="">Todas (${stk.length})</option>${fams.map(f=>`<option value="${esc(f)}" ${f===cbFam?"selected":""}>${esc(f)} (${stk.filter(l=>famDeLinea(l)===f).length})</option>`).join("")}</select></div>
      <div class="f"><label for="cbSub">Subfamilia</label><select id="cbSub" data-cbf="sub"><option value="">Todas</option>${subs.map(f=>`<option value="${esc(f)}" ${f===cbSub?"selected":""}>${esc(f)} (${stk.filter(l=>(!cbFam||famDeLinea(l)===cbFam)&&subDeLinea(l)===f).length})</option>`).join("")}</select></div>
      <div class="f"><label for="cbQ">Buscar producto</label><input id="cbQ" type="search" placeholder="Nombre o código, ej.: sal, guante, 1203" value="${esc(cbQ)}" data-cbq="1"></div></div>
    <div class="filt">${[["pend","Por contar"],["dif","Con diferencia"],["ok","Coinciden"],["all","Todos"]].map(([k,t])=>`<button class="fb" data-a="cbFiltro" data-f="${esc(k)}" aria-pressed="${cbFiltro===k}">${t}${k==="all"?` (${BASE.length})`:` (${cuenta[k]})`}</button>`).join("")}</div>
    ${nuevo}
    ${(()=>{const vis=L.slice(0,cbLim);if(!vis.length)return`<div class="empty">${cbFiltro==="pend"&&!cbFam&&!cbSub&&!q?"No quedan productos por contar.":"Nada que mostrar con este filtro."}</div>`;
      const norm=vis.filter(l=>!l.manual),man=vis.filter(l=>l.manual),tit=cbSub?`${cbFam?cbFam+" · ":""}${cbSub}`:cbFam||"Productos de la A a la Z";
      return (norm.length?`<section class="sec"><h3>${esc(tit)}<span class="cnt">${L.filter(l=>!l.manual).length}</span></h3>${norm.map(cbLineaHTML).join("")}</section>`:"")+(man.length?`<section class="sec"><h3>Agregados en terreno<span class="cnt">${man.length}</span></h3>${man.map(cbLineaHTML).join("")}</section>`:"")})()}
    ${L.length>cbLim?`<div class="btns"><button class="btn" data-a="cbMas">Mostrar más (${L.length-cbLim})</button></div>`:""}
    ${ro?"":`<div class="btns"><button class="btn" data-a="cbNuevoProd">+ Producto que no está en la lista</button></div>`}
    <div class="btns">${ro?`<button class="btn pri" data-a="cbPdf" data-id="${esc(c.id)}" style="flex:1">Informe PDF</button>`:`<button class="btn" data-a="cbPdf" data-id="${esc(c.id)}">Informe (borrador)</button><button class="btn pri" data-a="cbCerrar" style="flex:1">Cerrar conteo</button>`}</div>
    ${ro?"":`<div class="btns" style="margin-top:10px"><button class="btn" data-a="cbDel" data-id="${esc(c.id)}" style="border-color:var(--m-ink);color:var(--m-ink)">Eliminar este conteo</button></div><p class="note">Para salir sin cerrar usa ‹ ${esc(c.bodega)} arriba; el conteo queda en curso.</p>`}
  </main>`;
}
let cbNuevoProd=null;
const CB_OPTS={fams:null,tol:2,part:false,ciego:false};
function cbRefresh(k){sinPerderFoco(()=>{if(view!=="cbv"||!cbv)return;const l=(cbv.lineas||{})[k];const el=$("#cbl-"+CSS.escape(k));try{if(el&&l&&el.isConnected)el.outerHTML=cbLineaHTML(l)}catch(e){}const p=$("#cbprog");try{if(p&&p.isConnected)p.outerHTML=cbProgHTML()}catch(e){}})}

/* ---------- Acciones ---------- */
async function cbClick(A,b){
  if(A==="cb"){await flush();cbv=null;go("cb");return true}
  if(A==="cbBod"){cbBod=b.dataset.d;go("cbb");return true}
  if(A==="cbBodBack"){await flush();cbv=null;go("cbb");return true}
  if(A==="cbNuevo"){const d=b.dataset.d;if(conteoAbierto(d)){toast("Ya hay un conteo en curso en esta bodega.");return true}
    /* 1) stock al día: si hay señal y permiso, se actualiza antes de copiar la lista */
    if(navigator.onLine!==false&&puedeActStock()&&STOCK&&(Date.now()-new Date(STOCK.hora))/3600000>1){toast("Actualizando el stock antes de empezar…");await stockActualizar(true)}
    /* 2) opciones del conteo */
    const F=filas().filter(o=>o.DEPOSITO===d);const fams=[...new Set(F.map(o=>o.FAMILIA||"").filter(Boolean))].sort();const nPart=F.filter(o=>o.PARTIDA).length;
    CB_OPTS.fams=null;CB_OPTS.tol=2;CB_OPTS.part=false;CB_OPTS.ciego=false;
    const extra=`<div class="f"><label>Alcance</label><div class="filt" style="margin:4px 0 0" id="cbFams"><button type="button" class="fb" data-fam="" aria-pressed="true">Toda la bodega (${F.length})</button>${fams.map(f=>`<button type="button" class="fb" data-fam="${esc(f)}" aria-pressed="false">${esc(f)} (${F.filter(o=>(o.FAMILIA||"")===f).length})</button>`).join("")}</div><p class="note" style="margin:6px 0 0">Para un conteo cíclico elige una o más familias; el resto no se informa como "sin contar".</p></div>
      <div class="f" style="margin-top:10px"><label for="cbTol">Tolerancia (%)</label><input id="cbTol" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="2" style="max-width:120px"><p class="note" style="margin:6px 0 0">Diferencias menores a este porcentaje se informan pero no cuentan como discrepancia (mermas normales de pesaje).</p></div>
      ${nPart?`<label class="chk" style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:14px"><input type="checkbox" id="cbPart" style="margin-top:3px"> Contar por partida / lote (${nPart} partidas). Si no, se cuenta por producto y las partidas quedan como detalle.</label>`:""}
      <label class="chk" style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:14px"><input type="checkbox" id="cbCiego" style="margin-top:3px"> Conteo ciego: ocultar la cantidad del sistema mientras se cuenta</label>`;
    let sel=new Set();
    const ok=await ask(`Nuevo conteo · ${d}`,`Stock del sistema al ${fmtFecha(STOCK.hora)}. Conviene que no haya movimientos de bodega mientras se cuenta.`,"Iniciar conteo",false,extra);
    if(!ok)return true;
    const op={familias:CB_OPTS.fams,tol:CB_OPTS.tol,porPartida:CB_OPTS.part,ciego:CB_OPTS.ciego};
    const c=nuevoConteo(d,op);if(!Object.keys(c.lineas).length&&!(await ask("No hay productos en ese alcance","Puedes iniciar el conteo igual y agregar a mano lo que encuentres.","Iniciar")))return true;
    cbv=c;cbBod=d;cbFiltro="pend";cbQ="";cbFam="";cbSub="";cbLim=120;await saveCont(c);go("cbv");return true}
  if(A==="cbAbrir"){await flush();const c=CONT[b.dataset.id];if(!c)return true;cbv=c;cbBod=c.bodega;if(!cbv.items)cbv.items={};cbFiltro=c.estado==="cerrado"?"all":"pend";cbQ="";cbFam="";cbSub="";cbLim=120;go("cbv");return true}
  if(A==="cbFiltro"){cbFiltro=b.dataset.f;cbLim=120;render();return true}
  if(A==="cbRecontar"){if(cbRO())return true;const k=b.dataset.k,r=cbv.items[k]||{};delete r.obs;cbv.items[k]=r;cbTouch();cbRefresh(k);setTimeout(()=>{const e=$("#cbo-"+CSS.escape(k));if(e)e.focus()},30);return true}
  if(A==="cbMas"){cbLim+=200;render();return true}
  if(A==="cbIgual"){if(cbRO())return true;const k=b.dataset.k,l=cbv.lineas[k];const r=cbv.items[k]||{};r.obs=String(l.sis||0).replace(".",",");cbv.items[k]=r;/* v129: con coma decimal, como se escribe a mano (el punto es de miles) */cbTouch();cbRefresh(k);return true}
  if(A==="cbNuevoProd"){cbNuevoProd={};render();setTimeout(()=>{const e=$("[data-cbn=prod]");if(e){e.focus();e.scrollIntoView({block:"center"})}},50);return true}
  if(A==="cbNuevoCancel"){cbNuevoProd=null;render();return true}
  if(A==="cbNuevoAdd"){const n=cbNuevoProd||{};if(!(n.prod||"").trim()){toast("Escribe el nombre del producto.");return true}
    const k="m"+uid();cbv.lineas[k]={k,cod:(n.cod||"").trim(),prod:n.prod.trim(),fam:"",un:(n.un||"").trim(),sis:0,pu:0,manual:true,orden:9999};cbNuevoProd=null;cbFiltro="all";cbQ="";cbTouch();render();
    setTimeout(()=>{const e=$("#cbo-"+CSS.escape(k));if(e){e.scrollIntoView({block:"center"});e.focus()}},60);return true}
  if(A==="cbDelFoto"){if(cbRO())return true;const k=b.dataset.k,ref=b.dataset.ref;if(!(await ask("¿Eliminar esta foto?","","Eliminar",true)))return true;const r=cbv.items[k];if(r&&r.fotos)r.fotos=r.fotos.filter(x=>x!==ref);borrarFotoRef(ref);cbTouch();cbRefresh(k);return true}
  if(A==="cbDel"){const c=CONT[b.dataset.id];if(!c||c.estado==="cerrado")return true;if(!puedeBorrar(c)){toast(NO_BORRAR);return true}
    if(!(await ask("¿Eliminar este conteo?",`Conteo ${esc(c.n)} de ${c.bodega}. Se borran las cantidades, comentarios y fotos. No se puede deshacer.`,"Eliminar",true)))return true;
    clearTimeout(LT[c.id]);delete LT[c.id];delete CONT[c.id];delete LOCAL[c.id];await localDel(c.id);if(DB){colaBorrar("conteos/"+c.id,c);schedSync(200)}
    Object.values(c.items||{}).forEach(r=>(r.fotos||[]).forEach(f=>borrarFotoRef(f)));if(cbv&&cbv.id===c.id){cbv=null;go("cbb")}else{status();render()}toast("Conteo eliminado.");return true}
  if(A==="cbCerrar"){if(cbRO())return true;const R=resumenConteo(cbv);
    if(!R.cont){toast("No se puede cerrar: no hay productos contados.");return true} /* v136 (M-10) */
    const msg=`${R.cont} de ${R.total} productos contados${R.total-R.cont?`; ${R.total-R.cont} quedan sin contar y saldrán así en el informe`:""}. ${R.dif?`${R.dif} con discrepancia (faltante ${fmtP(Math.abs(R.vf))}, sobrante ${fmtP(R.vs)})`:"Sin discrepancias"}${R.tol?`, ${R.tol} dentro de tolerancia`:""}. Al cerrar ya no se podrá modificar.`;
    if(!(await ask("¿Cerrar el conteo?",msg,"Cerrar conteo")))return true;
    cbv.estado="cerrado";cbv.cerrado=today();cbv.actualizado=new Date().toISOString();if(ME)cbv.cerradoPor=yo();await saveCont(cbv);
    const cc=cbv;cbv=null;go("cbb");exito("Conteo cerrado","El informe se guarda en OneDrive.");esperarFotos(cc.id);
    if(DB&&navigator.onLine!==false)setTimeout(()=>cbSubirArchivos(cc),2500);return true}
  if(A==="cbAnular"){const c=CONT[b.dataset.id];if(!c||!esAdmin()||c.estado!=="cerrado")return true;
    const ok=await ask(`¿Anular el conteo ${esc(c.n)} de ${c.bodega}?`,"Quedará tachado, con el motivo y tu nombre. Se puede restaurar.","Anular",true,`<div class="f"><label for="motAn">Motivo</label><input id="motAn" data-obl="3" placeholder="Ej.: conteo de prueba"></div>`);if(!ok)return true;
    const mot=(document.querySelector("#motAn")||{}).value||"";c.anulado={por:yo(),fecha:today(),motivo:mot.trim()};c.actualizado=new Date().toISOString();await saveCont(c);render();toast("Conteo anulado.");return true}
  if(A==="cbRest"){const c=CONT[b.dataset.id];if(!c||!esAdmin())return true;if(!(await ask("¿Restaurar el conteo?","Volverá a contar en el historial.","Restaurar")))return true;delete c.anulado;c.actualizado=new Date().toISOString();await saveCont(c);render();toast("Conteo restaurado.");return true}
  if(A==="cbPdf"){const c=CONT[b.dataset.id];if(!c)return true;if(c.ciego&&c.estado!=="cerrado"){toast("El informe de un conteo ciego se descarga al cerrarlo (muestra las cantidades del sistema).");return true} /* v136 (B-10) */
    await cbPdf(c);return true}
  return false;
}
let cbqT=null;
function cbInput(ev){const t=ev.target;
  /* v108: solo los filtros; "obs" y "com" (campos del producto) se atienden más abajo */
  if(t.dataset.cbf==="fam"||t.dataset.cbf==="sub"){if(t.dataset.cbf==="fam"){if(cbFam===t.value)return true;cbFam=t.value;cbSub=""}else{if(cbSub===t.value)return true;cbSub=t.value}cbLim=120;render();return true}
  if(t.dataset.cbq!==undefined){cbQ=t.value;clearTimeout(cbqT);cbqT=setTimeout(()=>{cbLim=120;render();const i=$("[data-cbq]");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250);return true}
  if(t.dataset.cbn){cbNuevoProd=cbNuevoProd||{};cbNuevoProd[t.dataset.cbn]=t.value;return true}
  if(!cbv||cbRO())return true;
  if(t.dataset.cbenc){if(t.dataset.cbenc==="ciego"){if(cbv.ciego&&!t.checked&&cbv.estado!=="cerrado"){t.checked=true;toast("El conteo ciego no se puede desactivar mientras se cuenta.");return true} /* v136 (B-10) */
      cbv.ciego=t.checked;cbTouch();render();return true}cbv[t.dataset.cbenc]=t.value;cbTouch();return true}
  if(t.dataset.cbf){const k=t.dataset.k,r=cbv.items[k]||{};
    if(t.dataset.cbf==="obs"){const v=t.value.replace(/[^\d,.\-]/g,"");r.obs=v;if(v==="")delete r.obs}else r[t.dataset.cbf]=t.value;
    cbv.items[k]=r;cbTouch();
    if(t.dataset.cbf==="obs"&&ev.type==="change"){cbRefresh(k)}
    else if(t.dataset.cbf==="obs"){const l=cbv.lineas[k],d=difDe(cbv,l),box=$("#cbl-"+CSS.escape(k)+" .cbd");const p=$("#cbprog");if(p)p.outerHTML=cbProgHTML();
      const el=$("#cbl-"+CSS.escape(k));if(el){el.classList.remove("ok","falta","sobra","tol");if(d!==null)el.classList.add(Math.abs(d)<1e-9?"ok":enTol(cbv,l,d)?"tol":d<0?"falta":"sobra")}
      if(!cbv.ciego){const tolz=d!==null&&enTol(cbv,l,d)&&Math.abs(d)>=1e-9;const html=d===null?"":`<div class="cbd ${Math.abs(d)<1e-9?"ok":tolz?"tol":d<0?"falta":"sobra"}">${Math.abs(d)<1e-9?"Coincide con el sistema":tolz?`Diferencia de ${fmtN(Math.abs(d))} ${esc(l.un)}, dentro de la tolerancia`:`${d<0?"Faltan":"Sobran"} ${fmtN(Math.abs(d))} ${esc(l.un)}${l.pu?` · ${fmtP(Math.abs(d*l.pu))}`:""}`}</div>`;
        if(box)box.outerHTML=html||"";else if(html&&el){const g=el.querySelector(".cbrow");if(g)g.insertAdjacentHTML("afterend",html)}}
      if(el&&!el.querySelector('[data-cbf="com"]')&&d!==null){el.insertAdjacentHTML("beforeend",`<input class="obs" data-cbf="com" data-k="${esc(k)}" value="" placeholder="Comentario (estado, ubicación, vencido, dañado…)">`)}}
    return true}
  return false}
function cbChange(ev){const t=ev.target;if(t.dataset.cbfoto){const files=[...t.files];t.value="";cbAddFotos(cbv,t.dataset.cbfoto,files);return true}return cbInput(ev)}
async function cbAddFotos(c,k,files){
  for(const f of files){const r=c.items[k]||(c.items[k]={});r.fotos=r.fotos||[];if(r.fotos.length>=3){toast("Máximo 3 fotos por producto.");break}
    let img;try{img=await compress(f,1600,0.75)}catch(e){toast(msgImg(e,f),7000);continue}
    let ref=null;if(IDB.db){const t="q:"+uid();try{const buf=await img.blob.arrayBuffer();await IDB.put("fotos",t,{data:buf,type:"image/jpeg",actaId:c.id,k,col:"conteos"});QF[t]={actaId:c.id,k,col:"conteos"};ref=t}catch(e){}}
    if(!ref)ref=refSinEspacio();if(!ref)continue; /* v106 (C-04) */
    FOTO[ref]=img.dataURL;r.fotos.push(ref);cbTouch();cbRefresh(k)}
  schedSync(800);
}

/* ---------- OneDrive: carpeta, Excel e informe ---------- */
const CBPATH={};
async function cbCarpeta(segs){let parent=CB.root,path="";
  for(const seg of segs){path+="/"+seg;if(CBPATH[path]){parent=CBPATH[path];continue}
    let id=null;try{const r=await gjson(`/drives/${M365.drive}/items/${parent}:/${encName(seg)}`);id=r.id}catch(e){if(e.code!=="not_found")throw e}
    if(!id){const r=await crearCarpeta(parent,seg);id=r.id}
    CBPATH[path]=id;parent=id}return parent}
const carpetaConteo=c=>[limpiaNombre(c.bodega),`${c.fecha} Conteo ${esc(c.n)}`];
async function cbSubir(segs,name,blob,type){const f=await cbCarpeta(segs);return subirBlob(f,name,blob,type)} /* v137 (A-10) */
function cbXlsx(c){
  const wb=XLSX.utils.book_new();const L=lineasDe(c);const R=resumenConteo(c);
  const rows=[["Código","Producto","Familia","Partida","Unidad","Sistema","Observado","Diferencia","Precio unitario","Valor diferencia","Estado","Comentario","Fotos"]];
  L.forEach(l=>{const r=(c.items||{})[l.k]||{},o=obsDe(c,l.k),d=difDe(c,l);rows.push([l.cod,l.prod,l.fam,l.partida,l.un,l.sis||0,o===null?"":o,d===null?"":d,l.pu||"",d===null?"":Math.round(d*(l.pu||0)),o===null?"Sin contar":Math.abs(d)<1e-9?"Coincide":enTol(c,l,d)?"Dentro de tolerancia":d<0?"Faltante":"Sobrante",(l.manual?"[Agregado en terreno] ":"")+(r.com||""),(r.fotos||[]).map(f=>c.fotoUrl&&c.fotoUrl[f]||"").filter(Boolean).join(" ")])});
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[12,34,16,12,8,10,10,10,12,14,12,40,30].map(w=>({wch:w}));ws["!freeze"]={xSplit:0,ySplit:1};ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:12}})};XLSX.utils.book_append_sheet(wb,ws,"Conteo");
  const res=[["Bodega",c.bodega],["Conteo",c.n],["Fecha",fmtD(c.fecha)],["Responsable",c.responsable||""],["Acompañante",c.acompanante||""],["Stock del sistema al",fmtFecha(c.stockAl)],["Conteo ciego",c.ciego?"Sí":"No"],["Por partida",c.porPartida?"Sí":"No"],["Tolerancia",(c.tol==null?2:c.tol)+" %"],["Alcance",c.familias?c.familias.join(", "):"Toda la bodega"],["Inicio",fmtFecha(c.creado)],["Término",c.cerrado?fmtFecha(c.actualizado):""],[],["Productos en lista",R.total],["Contados",R.cont],["Sin contar",R.total-R.cont],["Coinciden",R.ok],["Dentro de tolerancia",R.tol],["Con faltante",R.falt],["Con sobrante",R.sobr],["Exactitud",R.exact===null?"":R.exact/100],["Valor faltante",Math.round(R.vf)],["Valor sobrante",Math.round(R.vs)],["Diferencia neta",Math.round(R.neto)]];
  const w2=XLSX.utils.aoa_to_sheet(res);w2["!cols"]=[{wch:22},{wch:30}];res.forEach((r,i)=>{if(r[0]==="Exactitud"){const ex=w2["B"+(i+1)];if(ex&&typeof ex.v==="number")ex.z="0%"}});XLSX.utils.book_append_sheet(wb,w2,"Resumen");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
async function cbSubirArchivos(c){
  if(!DB||navigator.onLine===false)return;
  try{if(Object.values(c.items||{}).some(r=>(r.fotos||[]).some(f=>QF[f]))){setTimeout(()=>cbSubirArchivos(c),20000);return}
    await cbSubir(carpetaConteo(c),`Conteo_${esc(c.n)}_${limpiaNombre(c.bodega).replace(/\s+/g,"_")}.xlsx`,new Blob([cbXlsx(c)]),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await cbPdf(c,true)}catch(e){console.warn("archivos conteo",e)}
}
async function cbPdf(c,subir){
  if(!window.jspdf){toast("No se pudo cargar el generador de PDF.");return}
  await flush();if(!subir)toast("Preparando el informe…");
  const L=lineasDe(c),R=resumenConteo(c);
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const X=15,W=180;let y=10;
  const nueva=()=>{d.addPage();y=15};const chk=h=>{if(y+h>282)nueva()};
  d.setFillColor(141,179,226);d.rect(X,y,W,21,"F");try{d.addImage(LOGO,"JPEG",X+2,y+1.5,20,18)}catch(e){}
  d.setFont("helvetica","bold");d.setFontSize(14);d.setTextColor(15,39,64);d.text("Control de bodega · Conteo físico",X+26,y+9);d.setFontSize(10);d.setFont("helvetica","normal");
  d.text(`${c.bodega} · Conteo ${esc(c.n)} · ${fmtD(c.fecha)}${c.anulado?" · ANULADO":c.estado!=="cerrado"?" · BORRADOR":""}`,X+26,y+16);d.setTextColor(0);y+=27;
  d.setFontSize(9.5);d.text(`Responsable: ${c.responsable||"-"}`,X,y);d.text(`Acompañante: ${c.acompanante||"-"}`,X+95,y);y+=5;
  d.text(`Stock del sistema al: ${fmtFecha(c.stockAl)}${c.ciego?" · conteo ciego":""} · ${c.porPartida?"por partida":"por producto"} · tolerancia ${c.tol==null?2:c.tol} %`,X,y);y+=5;
  d.text(`${c.familias?"Alcance: "+c.familias.join(", ")+" · ":"Alcance: toda la bodega · "}Inicio ${fmtFecha(c.creado)}${c.cerrado&&c.actualizado?` · Término ${fmtFecha(c.actualizado)}`:""}`,X,y);y+=8;
  /* resumen */
  const caja=(x,w,t,v,col)=>{d.setFillColor(242,245,248);d.roundedRect(x,y,w,16,1.5,1.5,"F");d.setFontSize(8);d.setTextColor(90);d.text(t,x+3,y+5);d.setFontSize(12);d.setFont("helvetica","bold");d.setTextColor(...(col||[15,39,64]));d.text(String(v),x+3,y+12.5);d.setFont("helvetica","normal");d.setTextColor(0)};
  const cw=(W-9)/4;caja(X,cw,"Contados",`${R.cont} de ${R.total}`);caja(X+cw+3,cw,"Exactitud",R.exact===null?"-":R.exact+" %"+(R.tol?` (${R.tol} en tol.)`:""),R.exact!==null&&R.exact<95?[160,40,40]:[30,110,50]);caja(X+2*(cw+3),cw,"Valor faltante",fmtP(Math.abs(R.vf)),R.vf<0?[160,40,40]:null);caja(X+3*(cw+3),cw,"Valor sobrante",fmtP(R.vs));y+=22;
  /* tabla */
  const cols=[{t:"Código",w:20},{t:"Producto",w:58},{t:"Un.",w:12},{t:"Sistema",w:20,r:1},{t:"Observado",w:20,r:1},{t:"Dif.",w:18,r:1},{t:"Valor dif.",w:32,r:1}];
  const headT=()=>{chk(8);d.setFillColor(221,235,247);d.rect(X,y-4.5,W,6.5,"F");d.setFont("helvetica","bold");d.setFontSize(8.5);let x=X;cols.forEach(cc=>{d.text(cc.t,cc.r?x+cc.w-1.5:x+1.5,y,cc.r?{align:"right"}:undefined);x+=cc.w});d.setFont("helvetica","normal");y+=6};
  const filaT=(l,soloDif)=>{const r=(c.items||{})[l.k]||{},o=obsDe(c,l.k),df=difDe(c,l);
    const prodL=d.splitTextToSize(l.prod+(l.manual?" (agregado)":""),cols[1].w-3);const h=Math.max(5.2,prodL.length*4)+(r.com?4.5:0);chk(h+1);if(y+h>282){nueva();headT()}
    if(df!==null&&Math.abs(df)>=1e-9){d.setFillColor(...(df<0?[250,228,228]:[236,230,206]));d.rect(X,y-3.8,W,h,"F")}
    let x=X;d.setFontSize(8.5);const v=[l.cod||"",null,l.un||"",fmtN(l.sis||0),o===null?"—":fmtN(o),df===null?"":(df>0?"+":"")+fmtN(df),df===null||!l.pu?"":fmtP(df*l.pu)];
    cols.forEach((cc,i)=>{if(i===1)d.text(prodL,x+1.5,y);else d.text(String(v[i]),cc.r?x+cc.w-1.5:x+1.5,y,cc.r?{align:"right"}:undefined);x+=cc.w});
    if(r.com){d.setTextColor(90);d.setFontSize(7.8);d.text(d.splitTextToSize("Comentario: "+r.com,W-24)[0],X+21.5,y+prodL.length*4-0.5);d.setTextColor(0)}
    y+=h};
  const conDif=L.filter(l=>{const df=difDe(c,l);return df!==null&&!enTol(c,l,df)});
  d.setFont("helvetica","bold");d.setFontSize(11);d.text(`Discrepancias (${conDif.length})`,X,y);y+=6;
  if(conDif.length){headT();conDif.forEach(l=>filaT(l))}else{d.setFont("helvetica","normal");d.setFontSize(9.5);d.text("Todas las cantidades contadas coinciden con el sistema.",X,y);y+=7}
  const sin=L.filter(l=>obsDe(c,l.k)===null);
  if(sin.length){y+=4;chk(12);d.setFont("helvetica","bold");d.setFontSize(11);d.text(`Sin contar (${sin.length})`,X,y);y+=6;headT();sin.forEach(l=>filaT(l))}
  y+=4;chk(12);d.setFont("helvetica","bold");d.setFontSize(11);d.text(`Detalle completo (${L.length})`,X,y);y+=6;headT();L.filter(l=>obsDe(c,l.k)!==null).forEach(l=>filaT(l));
  /* firmas */
  chk(30);y+=14;d.setDrawColor(120);d.line(X+5,y,X+75,y);d.line(X+105,y,X+175,y);d.setFontSize(8.5);d.text(c.responsable||"Responsable del conteo",X+40,y+5,{align:"center"});d.text(c.acompanante||"Bodeguero / administrador",X+140,y+5,{align:"center"});
  const n=d.getNumberOfPages();for(let i=1;i<=n;i++){d.setPage(i);d.setFont("helvetica","normal");d.setFontSize(7.5);d.setTextColor(110);d.text(`Página ${i} de ${n}`,195,289,{align:"right"});const a=autoriaTxt(c);if(a)d.text(d.splitTextToSize("Registro en la app: "+a.charAt(0).toLowerCase()+a.slice(1),150)[0],15,289);d.setTextColor(0)}
  const name=`Informe_conteo_${esc(c.n)}_${limpiaNombre(c.bodega).replace(/\s+/g,"_")}_${fmtD(c.fecha)}.pdf`;
  if(subir){try{await cbSubir(carpetaConteo(c),name,d.output("blob"),"application/pdf")}catch(e){console.warn(e)}return}
  await guardarPDF(d,name,"Informe listo.");
}

/* marca de que el módulo cargó completo (la revisa el arranque en index.html) */
window.MOD_BODEGA=true;
window.MODV=window.MODV||{};window.MODV["bodega"]="145"; /* v137 (M-29): versión del módulo (se sube con APP_VER en cada versión) */
