/* Puduhue Terreno: módulo Rendiciones (desde la v102 vive en este archivo, aparte de index.html).
   Se carga como script normal después del código general de index.html y antes del arranque (init()), así que
   comparte las mismas variables y funciones globales. El service worker lo guarda junto con index.html.
   Incluye: fondo por rendir (v94/v95), botón «Rendir» y tarjeta del documento (v96), lectura de boletas (v98) y el
   MÓDULO: Rendiciones completo (maestros, roles, avisos por correo v78, agenda v84, motor contable, pantallas,
   acciones, PDF y OneDrive). Ver el mapa en CLAUDE.md. */
/* ---------- v94: saldo del fondo por rendir (cuenta 110106) ----------
   - De Finnegans (Libro Mayor de la 110106 por organización) sale lo recibido y lo ya contabilizado; la app le resta lo
     enviado que todavía no se contabiliza. Así cada persona ve cuánto le queda por rendir.
   - «Mis rendiciones»: tarjeta «Tu fondo por rendir» con el saldo, lo que está en revisión, lo más antiguo sin rendir
     (lo rendido descuenta primero lo más antiguo que se entregó) y los movimientos.
   - Contabilidad: pantalla «Fondos por rendir» con todas las personas (orden por saldo, antigüedad o nombre), saldos
     antiguos marcados y aviso de lo que en Finnegans está sin persona (registrado a mano, por reclasificar).
   - Cada persona ve su tarjeta solo cuando Contabilidad lo activa (MAE.fondo.mostrar), después de reclasificar la 110106. */
const FD_K="actas-fondo",FD_TRAMITE=["enviada","revcont","aprobada"],FD_DIAS_A=30,FD_DIAS_R=60;
let FD={p:null,t:null,cargando:0,err:null,errT:null,intento:0},fdOrd="saldo",fdQ="",fdAlDia=false;
const fdConf=()=>(MAE&&MAE.fondo)||{};
const fdVisible=()=>!!fdConf().mostrar;
const FD_MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"],FD_MESL=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fdF=(f,largo)=>{const s=String(f||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return"";const [y,m,d]=s.split("-");return `${+d}${largo?" de ":" "}${(largo?FD_MESL:FD_MES)[+m-1]}${y!==today().slice(0,4)?(largo?" de ":" ")+y:""}`};
const fdHora=h=>{if(!h)return"";const d=new Date(h);if(isNaN(d))return"";const f=new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10),hh=d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false});
  return (f===today()?"hoy":f===sumarDias(today(),-1)?"ayer":fdF(f))+" "+hh};
function fdCacheMio(){try{const x=JSON.parse(localStorage.getItem(FD_K)||"null");return x&&x.correo===meCorreo()?x:null}catch(e){return null}}
/* fuente de datos: el servidor de Puduhue consulta el Libro Mayor de la 110106 en Finnegans (solo lo de quien pide; todo, para Contabilidad) */
async function fdFuente(todos){if(todos)await fdPadron(false);return await workerFetch("/fondo"+(todos?"?todos=1":""))}
/* lista de colaboradores para el servidor (correo → RUT → organización en Finnegans): así cada persona recibe solo lo suyo.
   La publica Contabilidad (o el administrador) al abrir «Fondos por rendir» o al activar el saldo para todos. */
let FD_PADRON_OK=0;
function fdPadronDatos(){return{personas:colabs().filter(c=>c.rut&&c.activo!==false).map(c=>{const o=orgPorRut(c.rut);return{rut:c.rut,nombre:c.nombre,correos:correosDe(c),org:o?{codigo:o[0],nombre:o[1]}:null}}),contab:contabCorreos()}}
async function fdPadron(forzar){
  if(!esContab()||(!forzar&&Date.now()-FD_PADRON_OK<30*60e3))return;
  const d=fdPadronDatos();if(d.personas.length<3)return;
  try{const tok=await getToken();const r=await fetch(WORKER+"/fondo/padron",{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify(d)});if(r.ok)FD_PADRON_OK=Date.now();else console.warn("padrón",r.status)}
  catch(e){console.warn("padrón",e)}
}
/* clave de cada ficha: el RUT, o la organización cuando en Finnegans no es una persona de la lista */
const fdKey=p=>normRut(p&&p.rut)||("o:"+normTxt(p&&(p.org||p.nombre)||""));
async function fdTraer(todos,silencioso){
  if(FD.cargando)return;
  if(navigator.onLine===false){if(!silencioso)toast("Se necesita señal para consultar Finnegans.");return}
  FD.cargando=todos?2:1;if(todos)FD.errT=null;else FD.err=null;if(!silencioso)render();
  try{const j=await fdFuente(todos);
    const x={hora:j.hora||new Date().toISOString(),desde:j.desde||"",personas:Array.isArray(j.personas)?j.personas:[],sinPersona:num(j.sinPersona)||0,aviso:j.aviso||"",correo:meCorreo()};
    if(todos)FD.t=x;else{FD.p=x;try{localStorage.setItem(FD_K,JSON.stringify(x))}catch(e){}}}
  catch(e){const m=(e&&e.error)||"No se pudo consultar Finnegans.";if(todos)FD.errT=m;else FD.err=m}
  FD.cargando=0;render();
}
/* se trae sola al abrir «Mis rendiciones» (una vez por sesión, o si el dato tiene más de 15 minutos) */
function fdAuto(){
  if(!FD.p){const c=fdCacheMio();if(c)FD.p=c}
  const viejo=!FD.p||Date.now()-new Date(FD.p.hora).getTime()>15*60e3;
  if(viejo&&!FD.cargando&&!FD.intento&&DB&&navigator.onLine!==false){FD.intento=1;setTimeout(()=>fdTraer(false,true),0)}
}
const fdRendDe=rut=>{const n=normRut(rut);return n?Object.values(REND).filter(r=>!r.anulada&&normRut(r.persona&&r.persona.rut)===n):[]};
function fdCalc(p){
  const movs=(p.movs||[]).filter(x=>x&&x.f).slice().sort((a,b)=>String(a.f).localeCompare(String(b.f)));
  const saldo=Math.round(movs.reduce((s,x)=>s+(num(x.m)||0),0));
  const R=fdRendDe(p.rut),tram=R.filter(r=>FD_TRAMITE.includes(r.estado)),borr=R.filter(r=>(r.estado==="borrador"||r.estado==="observada")&&docsDe(r).length);
  const enTram=tram.reduce((s,r)=>s+totalRend(r),0),enBorr=borr.reduce((s,r)=>s+totalRend(r),0),porRendir=saldo-enTram;
  /* antigüedad: lo rendido o devuelto descuenta primero lo más antiguo que se entregó */
  const cola=[];const usar=q=>{while(q>0.5&&cola.length){const c=cola[0],u=Math.min(q,c.r);c.r-=u;q-=u;if(c.r<=0.5)cola.shift()}};
  movs.forEach(x=>{const m=num(x.m)||0;if(m>0)cola.push({f:String(x.f).slice(0,10),r:m});else usar(-m)});usar(enTram);
  const viejo=porRendir>0.5&&cola.length?cola[0].f:"";
  const ent=movs.filter(x=>num(x.m)>0&&x.t!=="inicial").pop()||null;
  const ultRend=[...movs.filter(x=>x.t==="rendicion").map(x=>String(x.f).slice(0,10)),...R.filter(r=>r.enviada&&r.estado!=="borrador").map(r=>String(r.enviada).slice(0,10))].sort().pop()||"";
  /* días sin rendir: desde la última rendición (enviada en la app o contabilizada); si nunca rindió, desde que recibió el fondo.
     Con fondo fijo la plata siempre está afuera: lo que importa es cuánto lleva sin rendir. */
  const base=porRendir>0.5?(ultRend||viejo):"";
  const dias=base?Math.max(0,Math.round((new Date(today()+"T12:00:00Z")-new Date(base+"T12:00:00Z"))/864e5)):0;
  return{saldo,enTram,enBorr,porRendir,viejo,dias,ent,ultRend,tram,borr,movs};
}
const fdNivel=c=>c.porRendir<=0.5?"":c.dias>=FD_DIAS_R?"rr":c.dias>=FD_DIAS_A?"aa":"";
const FD_TIPO={entrega:"Fondo entregado",rendicion:"Rendición contabilizada",devolucion:"Devolución",inicial:"Saldo inicial",ajuste:"Ajuste contable",otro:"Movimiento"};
/* ---- «Mis rendiciones»: tarjeta del fondo ---- */
function fdTarjeta(){
  if(!fdVisible()||!ME)return"";
  const cs=colabsDeCuenta().filter(c=>c.rut);if(!cs.length)return"";
  fdAuto();
  const D=FD.p;
  if(!D)return `<section class="fdc" aria-label="Fondo por rendir"><div class="fdh"><b>${cs.length>1?"Fondos por rendir":"Tu fondo por rendir"}</b></div>
    <p class="fdn">${FD.cargando?`Consultando Finnegans<span class="dots"></span>`:FD.err?`${esc(FD.err)} <button class="lnk" data-a="fdActMio">Reintentar</button>`:navigator.onLine===false?"Sin señal: el saldo aparece al volver la conexión.":`<button class="lnk" data-a="fdActMio">Consultar el saldo</button>`}</p></section>`;
  const pie=`<span class="fdhr">${FD.cargando===1?`Actualizando<span class="dots"></span>`:`Finnegans ${esc(fdHora(D.hora))}`}</span>`;
  const per=c=>D.personas.find(x=>normRut(x.rut)===normRut(c.rut))||null;
  if(!cs.some(per))return `<section class="fdc" aria-label="Fondo por rendir"><div class="fdh"><b>${cs.length>1?"Fondos por rendir":"Tu fondo por rendir"}</b></div><p class="fdn">${esc(D.aviso||"Todavía no hay datos de tu fondo en Finnegans.")} Si crees que es un error, avísale a Contabilidad.</p></section>`;
  if(cs.length>1)return `<section class="fdc" aria-label="Fondos por rendir"><div class="fdh"><b>Fondos por rendir</b></div>
    <div class="fdvar">${cs.map(c=>{const k=fdCalc(per(c)||{rut:c.rut,nombre:c.nombre,movs:[]}),n=fdNivel(k);return `<button class="fdvr" data-a="fdMov" data-k="${esc(normRut(c.rut))}"><span>${esc(c.nombre)}${k.dias>=FD_DIAS_A&&k.porRendir>0?`<small class="${n}">${k.dias} días sin rendir</small>`:""}</span><b class="${k.porRendir<-0.5?"fav":""}">${k.porRendir<-0.5?"A favor "+fmtP(-k.porRendir):fmtP(Math.max(0,k.porRendir))}</b>${ICO.arrow}</button>`}).join("")}</div><div class="fdpie">${pie}</div></section>`;
  const c=cs.find(per)||cs[0],p=per(c),k=fdCalc(p),n=fdNivel(k);
  const big=k.porRendir>0.5?`<div class="fdm"><b>${fmtP(k.porRendir)}</b><span>por rendir</span></div>`
    :k.porRendir<-0.5?`<div class="fdm fav"><b>${fmtP(-k.porRendir)}</b><span>a tu favor: rendiste más de lo que recibiste</span></div>`
    :`<div class="fdm ok"><b>Estás al día</b><span>no tienes fondos por rendir</span></div>`;
  return `<section class="fdc" aria-label="Tu fondo por rendir"><div class="fdh"><b>Tu fondo por rendir</b></div>
    ${big}
    ${k.enTram>0.5?`<dl class="fdl"><div><dt>Saldo en Contabilidad</dt><dd>${fmtP(k.saldo)}</dd></div><div><dt>Enviado, en revisión</dt><dd>−${fmtP(k.enTram)}</dd></div></dl>`:""}
    ${k.porRendir>0.5&&(k.ultRend||k.viejo)?`<p class="fdal ${n}">${n?`<b>${k.dias} días sin rendir:</b> `:""}${k.ultRend?`${n?"tu":"Tu"} última rendición fue el ${fdF(k.ultRend,1)}${n?".":` (${haceDias(k.ultRend)}).`}`:`${n?"recibiste":"Recibiste"} el fondo el ${fdF(k.viejo,1)} y todavía no hay rendiciones.`}</p>`:""}
    ${k.enBorr>0.5&&k.porRendir>0.5?`<p class="fdn">En tu rendición sin enviar hay ${fmtP(k.enBorr)}${k.porRendir-k.enBorr>0.5?`; al enviarla te quedarían ${fmtP(k.porRendir-k.enBorr)} por rendir`:k.porRendir-k.enBorr<-0.5?`, ${fmtP(k.enBorr-k.porRendir)} más que tu saldo`:"; con eso quedas al día"}.</p>`:""}
    <div class="fdpie"><span>${k.ent?`Último fondo: <b>${fmtP(num(k.ent.m))}</b> el ${fdF(k.ent.f)}`:"Sin fondos entregados en el período"}${pie}</span><button class="btn" data-a="fdMov" data-k="${esc(normRut(c.rut))}">Movimientos</button></div></section>`;
}
/* ---- Movimientos de una persona (hoja) ---- */
function fdMov(key,deTodos){
  const D=(deTodos&&FD.t)||FD.p||FD.t;if(!D){toast("Todavía no hay datos de Finnegans.");return}
  let p=D.personas.find(x=>fdKey(x)===key)||null;
  if(!p&&deTodos){const L=fdLista(),x=L&&L.find(y=>fdKey(y.p)===key);p=x?x.p:null}
  if(!p){toast("No hay movimientos de esa persona.");return}
  const c=colabPorRut(p.rut),k=fdCalc(p),nom=(c&&c.nombre)||p.nombre||p.rut;
  document.querySelectorAll(".fdsheet").forEach(x=>x.remove());
  let run=0;const conSaldo=k.movs.map(x=>{run+=num(x.m)||0;return Object.assign({},x,{run})}).reverse();
  const porMes={};conSaldo.forEach(x=>{const m=String(x.f).slice(0,7);(porMes[m]=porMes[m]||[]).push(x)});
  const fila=x=>{const m=num(x.m)||0;return `<div class="fdmv"><span class="fdmf">${fdF(x.f)}</span><span class="fdmt"><b>${esc(FD_TIPO[x.t]||FD_TIPO.otro)}</b>${x.ref||x.d?`<small>${esc([x.ref,x.d].filter(Boolean).join(" · "))}</small>`:""}</span><span class="fdmm ${m>0?"pos":"neg"}">${m>0?"+":"−"}${fmtP(Math.abs(m))}<small>saldo ${fmtP(x.run)}</small></span></div>`};
  const tram=k.tram.map(r=>`<button class="fdmv fdtr" data-a="fdIrRend" data-id="${esc(r.id)}"><span class="fdmf">${fdF(r.enviada)}</span><span class="fdmt"><b>${esc(rdTitulo(r))}</b><small>${esc(rdEstadoFrase(r).t)}</small></span><span class="fdmm neg">−${fmtP(totalRend(r))}<small>en revisión</small></span></button>`).join("");
  const m=document.createElement("div");m.className="modal fdsheet";
  m.innerHTML=`<div class="sheet fdhoja" role="dialog" aria-modal="true" aria-label="Movimientos del fondo de ${esc(nom)}"><div class="tbtir" aria-hidden="true"></div>
    <div class="fdsh"><div><h3>${esc(nom)}</h3><p>Fondo por rendir · cuenta 110106</p></div><button class="fdx" data-a="fdCerrar" aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="smres fdsum"><div class="${k.porRendir<-0.5?"fav":fdNivel(k)}"><b>${fmtP(Math.abs(k.porRendir))}</b><span>${k.porRendir<-0.5?"a favor":"por rendir"}</span></div><div><b>${fmtP(k.saldo)}</b><span>saldo en Contabilidad</span></div><div><b>${fmtP(k.enTram)}</b><span>en revisión</span></div></div>
    ${tram?`<h4>Enviado, todavía no en Finnegans</h4><div class="fdmvs">${tram}</div>`:""}
    <h4>Movimientos en Finnegans</h4>
    ${conSaldo.length?Object.keys(porMes).map(mm=>`<div class="fdmes">${esc(periodoTxt(mm))}</div><div class="fdmvs">${porMes[mm].map(fila).join("")}</div>`).join(""):`<p class="fdn">Sin movimientos ${D.desde?`desde el ${fdF(D.desde,1)}`:"en el período"}.</p>`}
    <p class="note">${D.desde?`Desde el ${fdF(D.desde,1)}. `:""}Datos de Finnegans de ${esc(fdHora(D.hora))}. Si algo no calza, avísale a Contabilidad.</p></div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m){m.remove();return}const t=e.target.closest&&e.target.closest("[data-a]");if(t)setTimeout(()=>m.remove(),0)});
}
/* ---- Contabilidad: todas las personas ---- */
function fdLista(){
  const D=FD.t;if(!D)return null;
  const porRut={};D.personas.forEach(p=>{porRut[fdKey(p)]=p});
  /* también quienes tienen rendiciones en revisión aunque no tengan movimientos en Finnegans */
  colabs().filter(c=>c.rut&&c.activo!==false).forEach(c=>{const n=normRut(c.rut);if(!porRut[n]&&fdRendDe(c.rut).some(r=>FD_TRAMITE.includes(r.estado)))porRut[n]={rut:c.rut,nombre:c.nombre,movs:[]}});
  return Object.values(porRut).map(p=>{const c=colabPorRut(p.rut);return Object.assign({p,nom:(c&&c.nombre)||p.nombre||p.rut||"Sin nombre"},fdCalc(p))});
}
function renderFDL(){
  const head=band("Fondos por rendir","fdVolver","Rendiciones");
  if(!esContab())return head+`<main class="wrap"><h1>Fondos por rendir</h1><div class="empty">Solo Contabilidad ve esta pantalla.</div></main>`;
  if(!FD.t&&!FD.cargando&&!FD.errT&&DB&&navigator.onLine!==false)setTimeout(()=>fdTraer(true,true),0);
  const L=fdLista(),D=FD.t;
  const cfg=`<div class="fdcfg"><span><b>Mostrar a cada persona su saldo</b><small>Aparece en «Mis rendiciones». Actívalo cuando en Finnegans la 110106 tenga a la persona en todas sus líneas.</small></span><button class="fdsw" role="switch" aria-checked="${fdVisible()}" data-a="fdMostrar" aria-label="Mostrar a cada persona su saldo"><i></i></button></div>
    ${fdConf().por?`<p class="note">${fdVisible()?"Activado":"Desactivado"} por ${esc(quien(fdConf().por))} el ${fmtD(String(fdConf().hora||"").slice(0,10))}.</p>`:""}`;
  if(!L)return head+`<main class="wrap"><h1>Fondos por rendir</h1><p class="lead">Saldo de la cuenta 110106 por persona.</p>
    <div class="empty">${FD.cargando?`Consultando Finnegans<span class="dots"></span>`:FD.errT?`${esc(FD.errT)}<div class="btns" style="justify-content:center"><button class="btn" data-a="fdActualizar">Reintentar</button></div>`:navigator.onLine===false?"Se necesita señal para consultar Finnegans.":`<button class="btn" data-a="fdActualizar">Consultar Finnegans</button>`}</div>${cfg}</main>`;
  const con=L.filter(x=>x.porRendir>0.5),alDia=L.filter(x=>Math.abs(x.porRendir)<=0.5),favor=L.filter(x=>x.porRendir<-0.5);
  const tot=con.reduce((s,x)=>s+x.porRendir,0),nA=con.filter(x=>x.dias>=FD_DIAS_A).length,tram=L.reduce((s,x)=>s+x.enTram,0);
  const ord={saldo:(a,b)=>b.porRendir-a.porRendir,dias:(a,b)=>b.dias-a.dias||b.porRendir-a.porRendir,nom:(a,b)=>cmpEs(a.nom,b.nom)}[fdOrd]||((a,b)=>b.porRendir-a.porRendir);
  const ini=t=>String(t||"").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const fila=x=>{const n=fdNivel(x),q=hzNorm(x.nom+" "+(x.p.rut||""));
    return `<button class="smrow fdrow" data-a="fdMovT" data-k="${esc(fdKey(x.p))}" data-q="${esc(q)}"${hzCoincide(fdQ,q)?"":" hidden"}><span class="fdav ${n}" aria-hidden="true">${esc(ini(x.nom))}</span>
      <span class="smt"><b>${esc(x.nom)}</b><span class="sms">${x.ent?`Último fondo ${fmtP(num(x.ent.m))} el ${fdF(x.ent.f)}`:"Sin fondos en el período"}${x.ultRend&&!n?` · rindió ${haceDias(x.ultRend)}`:!x.ultRend&&x.porRendir>0.5?" · sin rendiciones":""}</span>
      ${n||x.enTram>0.5?`<span class="smch">${n?`<span class="smc ${n}">${x.dias} días sin rendir</span>`:""}${x.enTram>0.5?`<span class="smc cur">En revisión ${fmtP(x.enTram)}</span>`:""}</span>`:""}</span>
      <span class="fdrm${x.porRendir<-0.5?" fav":""}"><b>${fmtP(Math.abs(x.porRendir))}</b><small>${x.porRendir<-0.5?"a favor":x.porRendir>0.5?"por rendir":"al día"}</small></span></button>`};
  const sp=Math.abs(D.sinPersona)>0.5;
  return head+`<main class="wrap"><h1>Fondos por rendir</h1>
    <p class="lead">Cuenta 110106 por persona: el saldo en Finnegans menos lo enviado que todavía no se contabiliza.</p>
    ${sp?`<div class="info fdwarn"><b>${fmtP(Math.abs(D.sinPersona))} en Finnegans sin persona.</b> Son movimientos de la 110106 que no tienen persona ni en la línea ni en el documento (por ejemplo, el saldo inicial o el asiento de apertura del año). Mientras no se asignen a cada persona, la suma de los saldos de abajo no cuadra con la cuenta.</div>`:""}
    <div class="smres fdres"><div><b>${fmtP(tot)}</b><span>por rendir</span></div><div><b>${con.length}</b><span>${con.length===1?"persona":"personas"} con saldo</span></div><div class="${nA?"rr":""}"><b>${nA}</b><span>sin rendir hace ${FD_DIAS_A}+ días</span></div></div>
    ${tram>0.5?`<p class="note" style="margin-top:6px">Ya descontado: ${fmtP(tram)} enviado y en revisión en la app.</p>`:""}
    <div class="smol">Ordenar por</div><div class="smord" role="group" aria-label="Ordenar">${[["saldo","Saldo"],["dias","Antigüedad"],["nom","Nombre"]].map(o=>`<button data-a="fdOrd" data-o="${o[0]}" aria-pressed="${fdOrd===o[0]}">${o[1]}</button>`).join("")}</div>
    ${L.length>8?`<div class="hzbus" style="margin-top:10px"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="fdbus" type="search" value="${esc(fdQ)}" placeholder="Buscar persona o RUT" aria-label="Buscar persona" autocomplete="off" enterkeyhint="search"></div>`:""}
    <div class="list fdlist" style="margin-top:10px">${con.sort(ord).map(fila).join("")||`<div class="empty">Nadie tiene fondos por rendir.</div>`}</div>
    ${favor.length?`<div class="smsep">Con saldo a favor <b>${favor.length}</b></div><div class="list fdlist">${favor.sort((a,b)=>a.porRendir-b.porRendir).map(fila).join("")}</div>`:""}
    ${alDia.length?`<button class="fdmas" data-a="fdAlDia" aria-expanded="${fdAlDia}">${fdAlDia?"Ocultar":"Ver"} ${alDia.length===1?"la persona al día":`las ${alDia.length} personas al día`}</button>${fdAlDia?`<div class="list fdlist">${alDia.sort((a,b)=>cmpEs(a.nom,b.nom)).map(fila).join("")}</div>`:""}`:""}
    <div class="btns" style="margin-top:16px"><button class="btn" data-a="fdActualizar" ${FD.cargando?"disabled":""}>${FD.cargando===2?"Consultando Finnegans…":"Actualizar desde Finnegans"}</button></div>
    <p class="note">Datos de Finnegans de ${esc(fdHora(D.hora))}${D.desde?`, movimientos desde el ${fdF(D.desde,1)}`:""}. Con saldo y más de ${FD_DIAS_A} días sin rendir en ámbar, más de ${FD_DIAS_R} en rojo, contando desde la última rendición (enviada en la app o contabilizada).</p>
    ${cfg}</main>`;
}
function fdBuscar(q){fdQ=q;document.querySelectorAll(".fdrow[data-q]").forEach(r=>{r.hidden=!hzCoincide(q,r.dataset.q)})}
async function fdClick(A,b){
  if(A==="fdl"){go("fdl");window.scrollTo(0,0);return true}
  if(A==="fdVolver"){rdTab="cont";go("rd");return true}
  if(A==="fdMov"){fdMov(b.dataset.k,false);return true}
  if(A==="fdMovT"){fdMov(b.dataset.k,true);return true}
  if(A==="fdCerrar")return true;
  if(A==="fdIrRend"){const r=REND[b.dataset.id];if(r){rdv=r;rdd=null;go("rdv");window.scrollTo(0,0)}return true}
  if(A==="fdOrd"){fdOrd=b.dataset.o||"saldo";render();return true}
  if(A==="fdAlDia"){fdAlDia=!fdAlDia;render();return true}
  if(A==="fdActualizar"){await fdTraer(true);return true}
  if(A==="fdActMio"){FD.intento=1;await fdTraer(false);return true}
  if(A==="fdMostrar"){if(!esContab())return true;const on=!fdVisible();
    if(on&&FD.t&&Math.abs(FD.t.sinPersona)>0.5&&!await ask("¿Mostrar los saldos?",`Finnegans todavía tiene ${fmtP(Math.abs(FD.t.sinPersona))} de la 110106 sin persona (saldo inicial o apertura), así que algunos saldos pueden no estar completos.`,"Mostrar igual"))return true;
    try{if(on)await fdPadron(true);await rdMaeGuardar(n=>{n.fondo={mostrar:on,por:yo(),hora:new Date().toISOString()}});toast(on?"Cada persona ya ve su saldo en «Mis rendiciones».":"El saldo ya no se muestra a las personas.")}
    catch(e){toast("No se pudo guardar: "+errMsg(e))}render();return true}
  return false;
}

/* ---- «Para hoy»: fondo por rendir con 30 días o más sin rendir ---- */
function fdParaHoy(){
  if(!fdVisible()||!ME)return[];const cs=colabsDeCuenta().filter(c=>c.rut);if(!cs.length)return[];
  fdAuto();const D=FD.p;if(!D)return[];
  const out=[];cs.forEach(c=>{const p=D.personas.find(x=>normRut(x.rut)===normRut(c.rut));if(!p)return;const k=fdCalc(p);
    if(!(k.porRendir>0.5&&k.dias>=FD_DIAS_A))return;
    const quien=cs.length>1?`${esc(c.nombre)} lleva`:"Llevas";
    out.push(phItem(ICO.receipt,`${quien} ${k.dias} días sin rendir`,`${fmtP(k.porRendir)} por rendir · ${k.ultRend?`última rendición el ${fdF(k.ultRend,1)}`:`fondo recibido el ${fdF(k.viejo,1)}`}`,`data-a="rdTabIr" data-t="mias"`,k.dias>=FD_DIAS_R?"urg":"av"))});
  return out;
}

/* ---- 1) botón flotante «Rendir» ---- */
let FAB_AB=false;
function disFabVer(){if(!(loaded&&CUENTA&&ME))return false;return view==="launch"||(view==="rd"&&rdTab==="mias")}
function disFab(){
  let f=document.getElementById("fab");const ver=disFabVer();
  document.body.classList.toggle("confab",ver);
  if(!ver){if(f)f.remove();FAB_AB=false;return}
  const html=ESCRITORIO()
    ?`<label class="fabb" title="Sube la foto o el PDF de una factura o boleta">${ICO_SUBIR}<span class="fabt">Rendir</span><input class="vh" type="file" accept="image/*,application/pdf,.pdf" multiple data-fabrd="1" aria-label="Rendir: subir facturas o boletas"></label>`
    :`<div class="fabm" id="fabm"${FAB_AB?"":" hidden"}>${lecFabAyudaHTML()}<label class="fabo">${ICO_CAM}<span>Cámara</span><input class="vh" type="file" accept="image/*" capture="environment" data-fabrd="1"></label>${lecEscanerBotonHTML()}<label class="fabo">${ICO_GAL}<span>Galería o PDF</span><input class="vh" type="file" accept="image/*,application/pdf,.pdf" multiple data-fabrd="1"></label></div><button type="button" class="fabb" data-a="fabRd" aria-expanded="${FAB_AB}" aria-controls="fabm" aria-label="Rendir una factura o boleta">${ICO_CAM}<span class="fabt">Rendir</span></button>`;
  if(!f){f=document.createElement("div");f.id="fab";f.className="fab";document.body.appendChild(f)}
  if(f._h!==html){f.innerHTML=html;f._h=html}
  f.classList.toggle("ab",FAB_AB);
}
function disFabAbrir(v){FAB_AB=v;disFab();if(v){const o=document.querySelector("#fabm .fabo");if(o)setTimeout(()=>{try{o.focus()}catch(e){}},30)}}
async function disRendirArchivos(files,op){
  const ok=files.filter(f=>esImagen(f)||esPdf(f));
  if(!ok.length){toast("Elige fotos o PDF de facturas y boletas.");return}
  if(ok.length<files.length)toast("Se omiten los archivos que no son fotos ni PDF.");
  const p=periodoActual(),cs=colabsDeCuenta();let c=null;
  if(cs.length>1){const o=await askVal("¿Quién rinde?","Esta cuenta la usan varias personas. El documento va a la rendición del mes de quien elijas.","Seguir",`<div class="f"><label for="rdQuien">Persona</label><select id="rdQuien" data-v="rut">${cs.map(x=>`<option value="${esc(x.rut)}">${esc(x.nombre)}</option>`).join("")}</select></div>`);if(!o)return;c=colabPorRut(o.rut)||cs[0]}
  else if(cs.length===1)c=cs[0];
  await flush();
  let r=rdAbiertaDe(p,c);
  if(!r){const n=rdSiguienteN(p,c);r=nuevaRend(p,c);if(n>1)r.n=n;await saveRend(r);if(n>1)toast(`Rendición N°${n} de ${periodoTxt(p).toLowerCase()} creada.`)}
  if(!r.docs)r.docs={};
  rdTab="mias";rdv=r;rdd=null;RD_COLA=null;DIS_EDK=null;
  const ks=[];for(const f of ok){const k=await rdAgregarDoc(r,f,op);if(k)ks.push(k)}
  if(!ks.length){go("rdv");return}
  if(ks.length>1)RD_COLA={rid:r.id,keys:ks};
  rdd=r.docs[ks[0]];go("rdd");
}

/* ---- 1) documento: tarjeta para confirmar en vez del formulario ---- */
let DIS_EDK=null;
function disModoConf(r,d,editP,P){
  if(!editP||!d||DIS_EDK===d.k)return null;const le=d.lectura||{};
  if(le.estado==="leyendo"&&!(d.timbre&&lecSoloElegir(P)))return"leyendo";
  if(d.foto&&(!P.b.length||(d.timbre&&lecSoloElegir(P)))&&(le.estado!=="pendiente"||d.timbre))return"ok";
  return null;
}
function disConfHTML(r,d,P,modo){
  if(modo==="leyendo")return `<section class="rdok leyendo" aria-busy="true" aria-label="Leyendo el documento"><div class="rdok-sk" aria-hidden="true"><i></i><i></i><i class="g"></i></div><p class="rdok-lee"><span class="spin" aria-hidden="true"></span>Leyendo el documento…</p><button type="button" class="lnk" data-a="disEditar">Escribir los datos a mano</button></section>`;
  const le=d.lectura||{},cat=gastoDe(d),centro=centroDoc(r,d),sugC=d.centroSug&&centro,sugG=(d.gastoIA||d.gastoHist)&&cat,tot=num(d.total);
  const meta=[TIPO_DOC[d.tipo]||"Sin tipo",d.fecha?fdF(d.fecha,true)||fmtD(d.fecha):"sin fecha",d.folio?`N° ${d.folio}`:""].filter(Boolean).map(esc).join(" · ");
  const fila=(attrs,et,val,vacio,extra)=>`<button type="button" class="rdok-r" ${attrs}><span class="rdok-et">${et}</span><span class="rdok-v${vacio?" vacio":""}">${val}${extra||""}</span>${ICO_CHEV}</button>`;
  const dudas=le.estado==="ok"&&(le.confianza!=null&&le.confianza<0.6||(le.problemas&&le.problemas.length));
  return `<section class="rdok" aria-label="Datos del documento">
    <div class="rdok-em">${esc(d.emisor||"Sin emisor")}</div>
    <div class="rdok-meta">${meta}${d.rut?` <span class="rdok-rut">· RUT ${esc(d.rut)}</span>`:""}</div>
    <div class="rdok-tot">${tot?fmtP(tot):"Sin total"}</div>
    ${d.tipo==="factura"&&(num(d.neto)||num(d.iva))?`<div class="rdok-iva">Neto ${fmtP(num(d.neto))} · IVA ${fmtP(num(d.iva))}</div>`:""}
    <div class="rdok-l">
      ${fila(`data-a="rdPick" data-f="centro"`,"Centro de costo",centro?esc(centroNombre(centro)):"Elegir",!centro,sugC?` <i class="xp camb">Sugerido</i>`:"")}
      ${fila(`data-a="rdPick" data-f="gasto"`,"Tipo de gasto",cat?esc(cat.n):"Elegir",!cat,sugG?` <i class="xp camb">Sugerido</i>`:"")}
      ${fila(`data-a="disEditar" data-c="rdGl"`,"Detalle",d.glosa?esc(d.glosa):"Agregar qué se compró",!d.glosa,d.glosaTimbre&&d.glosa?` <i class="xp camb">Sugerido</i>`:"")}
    </div>
    ${lecTarjetaHTML(d,P)}
    ${dudas?`<p class="rdok-av">${ICO_ALERTA}<span>La lectura tiene dudas${le.problemas&&le.problemas.length?`: ${esc(le.problemas.join("; "))}`:""}. Compara con la foto.</span></p>`:le.estado==="ok"&&!d.revisadoManual?`<p class="rdok-ia">Leída automáticamente. Compara con la foto.</p>`:""}
    ${P.a.length?`<p class="rdok-av">${ICO_ALERTA}<span>${P.a.length===1?"Un dato por revisar":`${P.a.length} datos por revisar`}; puedes enviar igual. <button type="button" class="lnk" data-a="disEditar">Completar</button></span></p>`:""}
    <button type="button" class="btn rdok-ed" data-a="disEditar">Editar datos</button>
  </section>`;
}
function disTipoHTML(d,dis){
  const ok=TIPOS_RENDIR.includes(d.tipo);
  return `<div class="f"><label id="rdTdL">Tipo de documento</label><div class="seg segtd" id="rdTd" role="radiogroup" aria-labelledby="rdTdL">${TIPOS_RENDIR.map(k=>`<button type="button" role="radio" data-a="disTipo" data-v="${k}" aria-checked="${d.tipo===k}" aria-pressed="${d.tipo===k}" ${dis}>${k==="boleta_honorarios"?"Honorarios":k==="peaje"?"Peaje":esc(TIPO_DOC[k])}</button>`).join("")}</div>${ok?"":`<span class="hint" style="color:var(--m-ink)">${lecTipoAviso(d)}</span>`}</div>`;
}

/* ---- 4) rendiciones: ícono del estado a la izquierda y monto a la derecha ---- */
const RDC_ICO={
  borrador:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>`,
  enviada:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>`,
  observada:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.2v.3"/></svg>`,
  aprobada:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  contabilizada:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12.5l4.5 4.5 9.5-9.5"/><path d="M12 16.5l.5.5 9.5-9.5"/></svg>`};
function disRdIco(r){const e=r.estado||"borrador",c=e==="aprobada"||e==="contabilizada"?"ok":e==="observada"?"obs":e==="borrador"?"bor":"rev";
  return `<span class="rdc-i ${c}" aria-hidden="true">${RDC_ICO[e]||(c==="rev"?RDC_ICO.enviada:RDC_ICO.borrador)}</span>`}

/* ---------- v98: lectura de boletas y facturas más exacta ----------
   1) Timbre electrónico del SII: el código ancho (PDF417) del pie de las boletas y facturas electrónicas trae el RUT del
      emisor, el tipo de documento, el N°, la fecha y el total exactos. La app lo busca en cada foto o PDF (en el teléfono,
      sin señal) y, si lo encuentra, esos datos quedan tal cual; la IA lee de la foto lo demás (comercio, neto, IVA, detalle,
      tipo de gasto) y además el total impreso, para controlar que el código sea de esa boleta. También se puede escanear
      el código en vivo con la cámara («Escanear código del SII» en el botón «Rendir»). Si después alguien cambia el total,
      el RUT, el N° o la fecha, o si el total impreso no es el del timbre, la app avisa.
   2) La lectura con IA usa un modelo más nuevo y, si queda algo raro, el servidor la revisa con un modelo más capaz (ver
      servidor/boleta.js). Las fotos se guardan con más detalle (2.560 px, lo que el modelo nuevo alcanza a ver).
   3) Antes de guardar una foto sin timbre, la app avisa si se ve muy borrosa u oscura y ofrece tomar otra.
   4) Si un comercio (RUT) ya se rindió antes, se sugiere el mismo tipo de gasto («Lo usaste antes con este comercio»).
   5) Se guarda lo que leyó la app (lectura original) para medir qué datos corrige la gente: Administración › Lectura de
      boletas muestra el porcentaje de corrección por dato, cuántas boletas tenían timbre y cuántas se revisaron. */
const TIMBRE_LIB="lib/zxing-wasm-3.1.4/";
const TD_TIPO98={33:"factura",34:"factura",46:"factura",39:"boleta",41:"boleta",48:"boleta"};
const TD_NOMBRE98={33:"Factura electrónica",34:"Factura exenta electrónica",39:"Boleta electrónica",41:"Boleta exenta electrónica",46:"Factura de compra electrónica",48:"Comprobante de pago electrónico",52:"Guía de despacho electrónica",56:"Nota de débito electrónica",61:"Nota de crédito electrónica",110:"Factura de exportación electrónica",111:"Nota de débito de exportación",112:"Nota de crédito de exportación"};
const ICO_TIMBRE=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2"/><path d="M7 9v6M9.5 9v6M12 9v6M14 9v6M17 9v6"/></svg>`;
let ZX=null,ZX_CARGANDO=null,ZX_PRECARGA=false;
/* el lector se descarga la primera vez que se usa y queda guardado en el equipo (como el lector de PDF) */
function zxCargar(){
  if(ZX)return Promise.resolve(ZX);if(ZX_CARGANDO)return ZX_CARGANDO;
  ZX_CARGANDO=new Promise((res,rej)=>{
    const listo=()=>{try{const base=new URL(TIMBRE_LIB,location.href).href;
      window.ZXingWASM.prepareZXingModule({overrides:{locateFile:(p,pre)=>p.endsWith(".wasm")?(window.__ZX_WASM||base+p):pre+p}});ZX=window.ZXingWASM;res(ZX)}catch(e){rej(e)}};
    if(window.ZXingWASM){listo();return}
    const s=document.createElement("script");s.src=TIMBRE_LIB+"reader.js";s.onload=listo;s.onerror=()=>rej(new Error("No se pudo cargar el lector del timbre."));document.head.appendChild(s);
    setTimeout(()=>rej(new Error("El lector del timbre tardó demasiado.")),15000);
  }).catch(e=>{ZX_CARGANDO=null;throw e});
  return ZX_CARGANDO;
}
/* con señal, se deja descargado para poder leer timbres después sin señal */
function zxPrecargar(){
  if(ZX_PRECARGA||ZX||navigator.onLine===false||!loaded||!CUENTA)return;ZX_PRECARGA=true;
  setTimeout(()=>{try{fetch(TIMBRE_LIB+"reader.js").catch(()=>{});fetch(TIMBRE_LIB+"zxing_reader.wasm").catch(()=>{})}catch(e){}},4000);
}
/* texto del timbre → datos (solo si tiene forma válida) */
function timbreParse(x){
  let s="";try{s=x.bytes&&x.bytes.length?new TextDecoder("windows-1252").decode(x.bytes):""}catch(e){}
  if(!/<DD>/.test(s))s=x.text||"";if(!/<DD>/.test(s))return null;
  const dd=(s.match(/<DD>([\s\S]*?)<\/DD>/)||[])[1]||s,pre=dd.split("<CAF")[0];
  const g=k=>{const m=pre.match(new RegExp("<"+k+">([^<]*)</"+k+">"));return m?m[1].trim():""};
  const t={re:g("RE"),td:+g("TD")||0,f:g("F").replace(/\D/g,""),fe:g("FE"),rr:g("RR"),rsr:g("RSR"),mnt:Math.round(+g("MNT")||0),it1:g("IT1"),rs:((dd.match(/<RS>([^<]*)<\/RS>/)||[])[1]||"").trim()};
  if(!t.re||!rutValido(t.re)||!t.f||!/^\d{4}-\d{2}-\d{2}$/.test(t.fe)||!t.td)return null;
  return t;
}
/* busca el timbre en una foto, un PDF convertido a imagen o un cuadro de la cámara; prueba algunos ángulos por si la boleta quedó chueca */
async function timbreLeer(fuente){
  try{
    const Z=await Promise.race([zxCargar(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("tiempo")),6000))]);
    const bm=fuente instanceof HTMLCanvasElement?fuente:await createImageBitmap(fuente);
    const W0=bm.width,H0=bm.height,k=Math.min(1,2200/Math.max(W0,H0)),W=Math.round(W0*k),H=Math.round(H0*k);
    const c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d",{willReadFrequently:true});const t0=Date.now();
    for(const a of [0,1.5,-1.5,3,-3,4.5,-4.5,6,-6]){
      if(Date.now()-t0>3500)break;
      g.setTransform(1,0,0,1,0,0);g.fillStyle="#fff";g.fillRect(0,0,W,H);g.translate(W/2,H/2);g.rotate(a*Math.PI/180);g.drawImage(bm,-W/2,-H/2,W,H);
      const rs=await Z.readBarcodes(g.getImageData(0,0,W,H),{formats:["PDF417"],tryHarder:true,tryRotate:a===0,maxNumberOfSymbols:2});
      for(const x of rs){if(!x.isValid)continue;const t=timbreParse(x);if(t)return t}
    }
    return null;
  }catch(e){console.warn("timbre",e&&e.message||e);return null}
}
const fmtRut98=r=>{const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase();if(c.length<2)return r||"";const n=c.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,".");return n+"-"+c.slice(-1)};
/* los datos del timbre pasan al documento; el nombre del comercio y la glosa los pone la IA.
   El timbre trae además el primer producto (IT1): si la foto no muestra el detalle, queda como detalle sugerido. */
function lecTextoIt1(x){const t=String(x||"").replace(/\s+/g," ").trim().slice(0,120);return /[a-zñáéíóú]/.test(t)?t:t.charAt(0)+t.slice(1).toLowerCase()}
function timbreAplicar(d,t){
  d.timbre={re:t.re,td:t.td,f:String(t.f),fe:t.fe,rr:t.rr||"",rsr:t.rsr||"",mnt:t.mnt||0,it1:(t.it1||"").slice(0,60),rs:(t.rs||"").slice(0,100),leido:t.leido||new Date().toISOString()};
  d.rut=fmtRut98(t.re);d.folio=String(t.f);d.fecha=t.fe;if(t.mnt>0)d.total=t.mnt;d.tipo=TD_TIPO98[t.td]||"otro";
  if(!d.emisor&&t.rs)d.emisor=t.rs.slice(0,80);
  if(!String(d.glosa||"").trim()&&t.it1){d.glosa=lecTextoIt1(t.it1);d.glosaTimbre=true}
  if(TD_TIPO98[t.td]==="factura"&&t.rr){d.rutReceptor=fmtRut98(t.rr);if(t.rsr)d.receptor=t.rsr.slice(0,80)}
}
/* si después se cambió algo que trae el timbre, se avisa (puede ser un error al escribir o un documento alterado) */
function timbreDiferencias(d){
  const t=d&&d.timbre;if(!t)return[];const m=[];
  if(t.mnt>0&&num(d.total)!==t.mnt)m.push(`El total no coincide con el timbre del SII (${fmtP(t.mnt)}).`);
  if(normRut(d.rut)!==normRut(t.re))m.push(`El RUT no coincide con el timbre del SII (${fmtRut98(t.re)}).`);
  if(String(d.folio||"").replace(/\D/g,"")!==String(t.f))m.push(`El N° no coincide con el timbre del SII (${t.f}).`);
  if(String(d.fecha||"")!==t.fe)m.push(`La fecha no coincide con el timbre del SII (${fmtD(t.fe)}).`);
  if(d.lectura&&d.lectura.totalImpreso)m.push(`La foto muestra un total de ${fmtP(d.lectura.totalImpreso)}, distinto del timbre (${fmtP(t.mnt)}): revisa que el código sea de esta boleta.`);
  return m;
}
function lecTipoAviso(d){
  if(d.timbre&&!TD_TIPO98[d.timbre.td])return `El timbre del SII dice «${esc(TD_NOMBRE98[d.timbre.td]||"otro documento")}», que no sirve para rendir.`;
  return `La lectura dice «${esc(TIPO_DOC[d.tipo]||"sin tipo")}», que no sirve para rendir: elige uno${d.tipo==="vale"||d.tipo==="otro"?" (si es el ticket de un peaje, «Peaje»)":""} o elimina el documento.`;
}
/* factura sin neto ni IVA (p. ej. si se escaneó solo el código: el timbre trae el total, no el desglose). La exenta no lleva IVA. */
const lecFacturaSinNeto=d=>d.tipo==="factura"&&!(d.timbre&&+d.timbre.td===34)&&!(num(d.neto)>0)&&!(num(d.iva)>0);
/* con timbre, la tarjeta se muestra aunque falte elegir el centro o el tipo de gasto (son filas de la misma tarjeta) */
const lecSoloElegir=P=>P.b.every(m=>/^rd(Ce|Ga)$/.test(campoDeMsg(m)||""));
/* línea de la tarjeta para confirmar: de dónde salen los datos y qué falta */
function lecTarjetaHTML(d,P){
  const le=d.lectura||{};let h="";
  if(P&&P.b.length)h+=`<p class="rdok-av">${ICO_ALERTA}<span>Para enviar falta elegir ${P.b.map(m=>campoDeMsg(m)==="rdCe"?"el centro de costo":"el tipo de gasto").filter((x,i,a)=>a.indexOf(x)===i).join(" y ")}.</span></p>`;
  if(d.timbre){const df=timbreDiferencias(d);
    h+=df.length?`<p class="rdok-av">${ICO_ALERTA}<span>${esc(df.join(" "))}</span></p>`:`<p class="rdok-tim">${ICO_OK96}<span>RUT, N°, fecha y total del timbre del SII</span></p>`}
  if(le.estado==="leyendo")h+=`<p class="rdok-ia"><span class="spin" aria-hidden="true"></span><span>Completando el comercio y el detalle…</span></p>`;
  if(d.deEscaneo){
    if(lecFacturaSinNeto(d))h+=`<p class="rdok-av rdok-fac">${ICO_ALERTA}<span>Es una factura: saca también la foto completa para leer el neto y el IVA. <label class="lnk">Sacar foto completa<input class="vh" type="file" accept="image/*" capture="environment" data-rdrefoto="1"></label></span></p>`;
    else h+=`<p class="rdok-ia">La foto es la del escaneo. <label class="lnk">Cambiarla por una foto de la boleta completa<input class="vh" type="file" accept="image/*" capture="environment" data-rdrefoto="1"></label></p>`}
  return h;
}

/* ---- foto borrosa u oscura: se avisa antes de guardarla (solo si no tiene timbre legible) ---- */
async function fotoCalidad(file){
  try{
    const bm=await createImageBitmap(file);const W=720,H=Math.max(1,Math.round(bm.height*W/bm.width));
    const c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(bm,0,0,W,H);
    const px=g.getImageData(0,0,W,H).data,L=new Float32Array(W*H);let sum=0;
    for(let i=0,j=0;i<px.length;i+=4,j++){const y=.299*px[i]+.587*px[i+1]+.114*px[i+2];L[j]=y;sum+=y}
    const media=sum/(W*H),B=24,vs=[];
    for(let by=1;by+B<H-1;by+=B)for(let bx=1;bx+B<W-1;bx+=B){let s=0,s2=0,n=0;for(let y=by;y<by+B;y++)for(let x=bx;x<bx+B;x++){const k=y*W+x,l=4*L[k]-L[k-1]-L[k+1]-L[k-W]-L[k+W];s+=l;s2+=l*l;n++}vs.push(s2/n-(s/n)*(s/n))}
    /* nitidez de las zonas más nítidas (la boleta puede ocupar poco de la foto): promedio de los mejores bloques */
    vs.sort((a,b)=>b-a);const top=vs.slice(0,Math.max(3,Math.round(vs.length*.005)));const nit=top.length?top.reduce((x,y)=>x+y,0)/top.length:9999;
    const oscura=media<35,borrosa=nit<400;return{media:Math.round(media),nitidez:Math.round(nit),oscura,borrosa,mala:oscura||borrosa};
  }catch(e){return{}}
}
/* «Tomar otra» abre la cámara directo (es un botón de archivo); devuelve "usar", "descartar" o la foto nueva */
function fotoPregunta(q){
  return new Promise(res=>{
    const que=q.borrosa&&q.oscura?"borrosa y oscura":q.borrosa?"borrosa":"oscura";
    const m=document.createElement("div");m.className="modal";
    m.innerHTML=`<div class="sheet cfoto" role="alertdialog" aria-modal="true" aria-label="La foto se ve ${que}"><h3>La foto se ve ${que}</h3><p>Así puede que no se lean bien los datos. ${q.oscura?"Busca más luz o usa el flash.":"Mantén el teléfono quieto y enfoca tocando la boleta en la pantalla."}</p>
      <div class="btns cfbtns"><label class="btn pri">${ESCRITORIO()?ICO_GAL:ICO_CAM}<span>${ESCRITORIO()?"Elegir otra":"Tomar otra"}</span><input class="vh" type="file" accept="image/*"${ESCRITORIO()?"":' capture="environment"'} data-retoma="1"></label><button class="btn" data-m="usar">Usar esta foto</button><button class="btn" data-m="no">Cancelar</button></div></div>`;
    document.body.appendChild(m);
    let hecho=false;const fin=v=>{if(hecho)return;hecho=true;m.remove();res(v)};
    m.addEventListener("change",e=>{e.stopPropagation();const f=e.target.files&&e.target.files[0];if(f)fin(f)});
    m.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-m]");if(e.target===m||(t&&t.dataset.m==="no"))fin("descartar");else if(t&&t.dataset.m==="usar")fin("usar")});
  });
}

/* ---- tipo de gasto según lo que ya se usó con el mismo comercio ---- */
function gastoHistorial(rut,excluirK){
  const n=normRut(rut);if(!n)return null;const cnt={};
  Object.values(REND).forEach(r=>{if(!r||r.anulada)return;Object.values(r.docs||{}).forEach(x=>{
    if(!x||x.k===excluirK||!x.gasto||normRut(x.rut)!==n)return;
    const confirmado=(!x.gastoIA&&!x.gastoHist)||["revcont","aprobada","contabilizada"].includes(r.estado);
    if(confirmado)cnt[x.gasto]=(cnt[x.gasto]||0)+1})});
  const L=Object.entries(cnt).filter(([g])=>gastoDe({gasto:g})).sort((a,b)=>b[1]-a[1]);return L.length?L[0][0]:null;
}

/* ---- lectura original, para medir ---- */
function lecturaGuardar(d){
  if(!d.lectura)return;
  d.lectura.leido={tipo:d.tipo||"",emisor:d.emisor||"",rut:d.rut||"",folio:String(d.folio||""),fecha:d.fecha||"",total:num(d.total),neto:num(d.neto),iva:num(d.iva),gasto:d.gasto||"",glosa:d.glosa||""};
  d.lectura.timbre=!!d.timbre;
}
const LEC_CAMPOS=[["total","Total"],["fecha","Fecha"],["rut","RUT"],["folio","N° de documento"],["tipo","Tipo de documento"],["emisor","Comercio"],["gasto","Tipo de gasto"]];
function lecDistinto(k,a,b){
  if(k==="rut")return normRut(a)!==normRut(b);
  if(k==="total")return num(a)!==num(b);
  if(k==="emisor")return normTxt(String(a||"")).replace(/\W/g,"")!==normTxt(String(b||"")).replace(/\W/g,"");
  if(k==="folio")return String(a||"").replace(/\D/g,"")!==String(b||"").replace(/\D/g,"");
  return String(a||"")!==String(b||"");
}
function lecMedir(){
  const R={n:0,tim:0,rev:0,c:{}};LEC_CAMPOS.forEach(([k])=>R.c[k]=0);
  Object.values(REND).forEach(r=>{if(!r||r.anulada||r.estado==="borrador")return;Object.values(r.docs||{}).forEach(d=>{
    const l=d&&d.lectura&&d.lectura.leido;if(!l)return;R.n++;if(d.lectura.timbre)R.tim++;if(d.lectura.revision)R.rev++;
    LEC_CAMPOS.forEach(([k])=>{if(lecDistinto(k,l[k],d[k]))R.c[k]++})})});
  return R;
}
function lecAdminHTML(lect){
  const R=lecMedir(),s=ADM.salud||{},pc=n=>R.n?Math.round(n*100/R.n)+" %":"–";
  const modelos=s.modeloLectura?`<p>Lee con <b>${esc(s.modeloLectura)}</b>${s.modeloRevision&&s.modeloRevision!=="no"?` y revisa las dudosas con <b>${esc(s.modeloRevision)}</b>`:""}.</p>`:"";
  const tabla=R.n?`<table class="lectab"><thead><tr><th>Dato</th><th>Corregido</th></tr></thead><tbody>${LEC_CAMPOS.map(([k,t])=>`<tr><td>${t}</td><td>${pc(R.c[k])}</td></tr>`).join("")}</tbody></table>
    <p class="note">De ${R.n} ${R.n===1?"documento enviado":"documentos enviados"} desde la v98: ${pc(R.tim)} con timbre del SII y ${pc(R.rev)} revisados por el segundo modelo.</p>`
    :`<p class="note">Todavía no hay documentos para medir: se cuentan los que se leen desde la v98 y ya se enviaron.</p>`;
  return `<div class="admit"><b>Lectura de boletas</b>${modelos}<p>Qué tanto corrige la gente lo que leyó la app, por dato.</p>${tabla}<p class="note">Lecturas automáticas este mes desde este teléfono: ${lect}.</p></div>`;
}

/* ---- escanear el timbre en vivo con la cámara ---- */
let ESC=null;
const lecPuedeEscanear=()=>!ESCRITORIO()&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
function lecFabAyudaHTML(){return lecPuedeEscanear()?`<p class="fabh">¿Tiene el código ancho del SII al pie? Boletas: basta con escanear el código. Facturas: mejor la foto completa, que también lee el código.</p>`:""}
function lecEscanerBotonHTML(){return lecPuedeEscanear()?`<button type="button" class="fabo" data-a="lecEscanear">${ICO_TIMBRE}<span>Escanear código del SII</span></button>`:""}
async function escanearTimbre(){
  if(!lecPuedeEscanear()){toast("Este equipo no permite escanear con la cámara. Saca una foto de la boleta.");return}
  if(typeof disFabAbrir==="function")disFabAbrir(false);
  if(ESC)ESC.cerrar();
  const m=document.createElement("div");m.className="modal escan";
  m.innerHTML=`<div class="esc" role="dialog" aria-modal="true" aria-label="Escanear el código del SII"><video class="esc-v" playsinline muted autoplay></video><div class="esc-marco" aria-hidden="true"><i></i></div>
    <div class="esc-pie"><p class="esc-t" aria-live="polite">Apunta al código ancho del pie de la boleta</p><p class="esc-s">Se lee solo. Que quepa completo dentro del recuadro, con buena luz.</p>
    <div class="esc-btns"><label class="btn esc-foto" hidden>${ICO_CAM}<span>Sacar foto</span><input class="vh" type="file" accept="image/*" capture="environment" data-fabrd="1"></label><button class="btn" data-m="no">Cancelar</button></div></div></div>`;
  document.body.appendChild(m);
  const v=m.querySelector("video"),txt=m.querySelector(".esc-t"),sub=m.querySelector(".esc-s"),btnFoto=m.querySelector(".esc-foto");
  let vivo=true,stream=null;
  const cerrar=()=>{vivo=false;try{if(stream)stream.getTracks().forEach(t=>t.stop())}catch(e){}m.remove();if(ESC&&ESC.m===m)ESC=null};
  ESC={m,cerrar};
  m.addEventListener("click",e=>{if(e.target.closest&&e.target.closest('[data-m="no"]'))cerrar()});
  btnFoto.querySelector("input").addEventListener("change",()=>setTimeout(cerrar,0));
  const sinCamara=(t,s)=>{txt.textContent=t;sub.textContent=s;btnFoto.hidden=false};
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false})}
  catch(e){sinCamara("No se pudo abrir la cámara","Revisa el permiso de cámara de la app, o saca una foto de la boleta.");return}
  if(!vivo){stream.getTracks().forEach(t=>t.stop());return}
  v.srcObject=stream;try{await v.play()}catch(e){}
  let Z;try{Z=await zxCargar()}catch(e){sinCamara("El lector no está disponible","Se descarga la primera vez que hay señal. Mientras tanto, saca una foto de la boleta.");return}
  const c=document.createElement("canvas"),g=c.getContext("2d",{willReadFrequently:true}),t0=Date.now();let i=0,ayuda=false;
  while(vivo){
    if(v.readyState>=2&&v.videoWidth){
      const W=v.videoWidth,H=v.videoHeight,a=[0,2,-2][i++%3];if(c.width!==W||c.height!==H){c.width=W;c.height=H}
      g.setTransform(1,0,0,1,0,0);if(a){g.fillStyle="#fff";g.fillRect(0,0,W,H);g.translate(W/2,H/2);g.rotate(a*Math.PI/180);g.drawImage(v,-W/2,-H/2,W,H)}else g.drawImage(v,0,0,W,H);
      try{
        const rs=await Z.readBarcodes(g.getImageData(0,0,W,H),{formats:["PDF417"],tryHarder:true,maxNumberOfSymbols:1});
        const x=rs.find(y=>y.isValid),t=x&&timbreParse(x);
        if(t&&vivo){
          g.setTransform(1,0,0,1,0,0);g.drawImage(v,0,0,W,H);
          const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.88));
          try{if(navigator.vibrate)navigator.vibrate(30)}catch(e){}
          m.classList.add("leido");txt.textContent="Código leído";await new Promise(r=>setTimeout(r,250));cerrar();
          if(blob)await disRendirArchivos([new File([blob],"timbre.jpg",{type:"image/jpeg"})],{timbre:t,escaneo:true});
          return;
        }
      }catch(e){console.warn("escaneo",e)}
      if(!ayuda&&Date.now()-t0>12000){ayuda=true;txt.textContent="¿No lo lee?";sub.textContent="Acércate un poco, evita reflejos o mejora la luz. También puedes sacar una foto de la boleta.";btnFoto.hidden=false}
    }
    await new Promise(r=>setTimeout(r,100));
  }
}

async function lecClick(A,b){
  if(A==="lecEscanear"){escanearTimbre();return true}
  return false;
}

/* ============================================================
   MÓDULO: Rendiciones (boletas y facturas de gastos de las personas)
   Una rendición por persona y mes. Flujo (v62): la persona envía → aprueba su jefatura → revisa Contabilidad → se contabiliza en FinnegansGO.
   La persona elige tipo de gasto y centro de costo; el motor contable traduce eso a cuenta, producto, partida, bien de uso y tercero,
   y arma el Excel de importación de asiento genérico de FinnegansGO (hoja IMPORTADOR, 28 columnas).
   ============================================================ */
const RD={root:"01RAJ2KQBLDIZGFMASZVCIDO2PGKXQW5VY",maeDir:"_maestros",maeFile:"maestros.json"};
const CAPAC_RUT="76459811-3";
const CONTAB_DEF=["emartinez@puduhue.cl","nvidal@puduhue.cl"]; /* revisión contable mientras no se cargue la hoja Aprobadores */
const UMBRAL_AF=500000; /* desde este monto se pregunta si es activo fijo */
const CTA_BLOQ={"410514":"está bloqueada","420501":"ya no se usa (va a 410517)","410101":"es Certificaciones (mano de obra es 410501)"};
const CTA_SIN_PROD=["110106","110105","110203","110111","210202"];
const CTA_CON_TER=["210201","210203","110106","110105","110203","110204"];
/* Centros de costo (reglas contables, sección 4). Coipomo siempre va a LCO-Reposición. El tercer dato sirve para filtrar bienes de uso. */
const CENTROS_DEF=[["9-0-8-90","Indirectos Administración",""],["9-0-2-90","Indirectos Leche",""],["LBV-0002","Bellavista","BELLAVISTA"],["CADENASSO-0002","Cadenasso Lechería","CADENASSO"],["CADENASSO-Reposición","Cadenasso Crianza / Reposición","CADENASSO"],["CIRUELILLO-0002","Ciruelillo","CIRUELILLO"],["LCO-Reposición","Coipomo (Reposición)","COIPOMO"],["LMT-0002","Mi Tierra","MI TIERRA"],["LRD-0002","Radales","RADALES"],["LSM-0002","San Miguel","SAN MIGUEL"],["LSM-Reposición","San Miguel Reposición","SAN MIGUEL"],["ROTATI-0002","Tronador (Rotativa)","TRONADOR|ROTATIVA"],["TRADICIONAL-0002","Tradicional","TRADICIONAL"],["CASA ANITA-0002","Casa Anita","CASA ANITA"],["3-1-3-01","San Francisco","SAN FRANCISCO"],["3-2-3-01","Paillaco","PAILLACO"],["1-1-3-01","Quichitue","QUICHITUE"]];
const CENTRO_ADM="9-0-8-90";
const PREDIO_CENTRO={"Bellavista":"LBV-0002","Cadenasso":"CADENASSO-0002","Casa Anita":"CASA ANITA-0002","Ciruelillo":"CIRUELILLO-0002","Coipomó":"LCO-Reposición","Mi Tierra":"LMT-0002","Radales":"LRD-0002","San Francisco":"3-1-3-01","San Miguel":"LSM-0002","Tradicional":"TRADICIONAL-0002","Tronador":"ROTATI-0002","Administración central":"9-0-8-90"};
const PARTIDAS_DEF={GGP000:"Gastos generales de producción",GGE000:"Gastos generales (Administración)",SIS000:"Sistemas",CCL000:"Combustibles y lubricantes",CRM000:"Reparación y mantención",MOB000:"Mano de obra",CEL000:"Energía eléctrica",SEG000:"Seguros",GBR000:"Bienes raíces",IMP000:"Impuestos",HAD000:"Honorarios de administración",REB000:"Rebaño",ACO000:"Alimentos comprados",LEC000:"Lechería",AVH000:"Arriendo de vehículos"};
/* Catálogo de tipos de gasto: lo que elige la persona. Cada tipo trae la imputación para centro productivo (41) y para Administración (42).
   cp/ca cuenta · pp/pa producto · parp/para partida · bu pide bien de uso · dist se puede repartir con la tabla de distribuciones
   c solo Contabilidad · fija la cuenta no depende del documento · ter "si" exige tercero, "no" lo deja vacío */
const TG=(id,n,cp,ca,pp,pa,parp,para,o)=>Object.assign({id,n,cp,ca,pp,pa:pa||pp,parp,para:para||parp},o||{});
const CATALOGO_DEF=[
 TG("peajes","Peajes / barcaza","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Motivo del viaje"}),
 TG("colacion","Colación / almuerzo en terreno","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Motivo y N° de personas"}),
 TG("estacionamiento","Estacionamiento","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Motivo"}),
 TG("kilometraje","Kilometraje en vehículo propio","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Origen, destino y km"}),
 TG("pasajes","Pasajes","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Pasajero y destino"}),
 TG("alojamiento","Alojamiento","410513","420408","SER026","","GGP000","GGE000",{g:"Viajes y traslados",ph:"Motivo del viaje"}),
 TG("combustible","Combustible (bencina, petróleo, AdBlue)","410504","420408","COM008","","CCL000","CCL000",{g:"Vehículos y máquinas",ph:"Vehículo o máquina"}),
 TG("mant_tractor","Mantención tractor","410606","","SMA020","","CRM000","",{g:"Mantención",bu:1,ph:"Qué se reparó o compró"}),
 TG("mant_moto","Mantención moto","410605","","IMG003","","CRM000","",{g:"Mantención",bu:1,ph:"Qué se reparó o compró"}),
 TG("mant_vehiculo","Mantención camioneta / vehículo","410607","","SMA010","","CRM000","",{g:"Mantención",bu:1,ph:"Vehículo o patente"}),
 TG("mant_maquina","Mantención otras máquinas","410609","","IMG003","","CRM000","",{g:"Mantención",bu:1,ph:"Máquina y qué se hizo"}),
 TG("mant_infra","Mantención infraestructura (casas, salas, portones)","410603","","SMA053","","CRM000","",{g:"Mantención",bu:1,ph:"Casa o instalación"}),
 TG("mant_agua","Mantención redes de agua","410604","","SMA053","","CRM000","",{g:"Mantención",bu:1,ph:"Instalación"}),
 TG("ferreteria","Ferretería / mantención general","410608","","IMG003","","CRM000","",{g:"Mantención",bu:1,ph:"Para qué se usó"}),
 TG("sala","Insumos sala de ordeña","410200","","IMG004","","LEC000","",{g:"Operación",ph:"Qué se compró"}),
 TG("gas_op","Gas operativo (sala, ternerera)","410504","","SER038","","CCL000","",{g:"Operación",ph:"Instalación"}),
 TG("gas_casa","Gas casa huésped / trabajadores","410502","420102","SER038","","MOB000","MOB000",{g:"Personal",ph:"Casa"}),
 TG("celebracion","Celebración / beneficio al personal","410502","420102","GGE003","","MOB000","MOB000",{g:"Personal",ph:"Motivo"}),
 TG("ropa","Ropa de trabajo, EPP, botas, aseo del personal","410502","420102","GGE003","","MOB000","MOB000",{g:"Personal",ph:"Trabajador"}),
 TG("capacitacion","Capacitación / curso / examen","410502","420102","RRH001","","MOB000","MOB000",{g:"Personal",ph:"Participante y curso"}),
 /* G101 y G102 están inactivos en Finnegans: mientras se activan, Contabilidad indicó usar GGE002 (14-10-2026) */
 TG("cafeteria","Insumos de cafetería","410513","420408","GGE002","","GGP000","GGE000",{g:"Oficina"}),
 TG("papeleria","Papelería","410513","420406","GGE002","","GGP000","GGE000",{g:"Oficina"}),
 TG("oficina","Artículos de oficina / equipamiento menor","410513","420406","GGE002","","GGP000","GGE000",{g:"Oficina",ph:"Qué y para dónde"}),
 TG("comunicaciones","Internet, TV, telefonía, Starlink","410512","420401","SER036","SER008","GGP000","GGE000",{g:"Servicios",dist:1,ph:"Dispositivo o lugar"}),
 TG("electricidad","Energía eléctrica","410503","420403","SER011","","CEL000","CEL000",{g:"Servicios",ph:"N° de cliente o lugar"}),
 TG("software","Software y suscripciones (Claude, ChatGPT…)","410512","420402","GGE001","","SIS000","SIS000",{g:"Servicios",dist:1,ph:"Herramienta"}),
 TG("canva","Canva","410512","420401","GGE001","","GGE000","GGE000",{g:"Servicios"}),
 TG("notaria","Notaría / legal","410513","420308","GGE005","","GGE000","GGE000",{g:"Trámites",ph:"Trámite"}),
 TG("tramites","Trámites, TGR, permisos de circulación, multas","","420406","GGE001","","GGE000","GGE000",{g:"Trámites",ph:"Trámite"}),
 TG("estudios","Estudios del personal de Administración","","420406","GGE001","","GGE000","GGE000",{g:"Trámites",ph:"Institución y cuota"}),
 TG("otro","Otro (lo clasifica Contabilidad)","","","","","","",{g:"Otro",otro:1,ph:"Describe qué se compró y para qué"}),
 TG("seguros","Seguros","410608","420601","SEG002","","SEG000","SEG000",{g:"Solo Contabilidad",c:1}),
 TG("contribuciones","Contribuciones","420602","420602","IMP001","","GBR000","GBR000",{g:"Solo Contabilidad",c:1}),
 TG("arriendo_veh","Arriendo de vehículo","410517","410517","ARR004","","AVH000","AVH000",{g:"Solo Contabilidad",c:1}),
 TG("arriendo_casa","Arriendo casa Administración","","420405","ARR003","","GBR000","GBR000",{g:"Solo Contabilidad",c:1}),
 TG("otros_adm","Otros gastos de Administración / diferencias menores","","420610","GGE001","","GGE000","GGE000",{g:"Solo Contabilidad",c:1}),
 TG("finiquito","Finiquito","210202","210202","","","MOB000","MOB000",{g:"Solo Contabilidad",c:1,fija:1,ter:"no"}),
 TG("anticipo_sueldo","Anticipo de sueldo","110203","110203","","","MOB000","MOB000",{g:"Solo Contabilidad",c:1,fija:1,ter:"si"}),
 TG("anticipo_prov","Anticipo a proveedor","110204","110204","","","GGP000","GGE000",{g:"Solo Contabilidad",c:1,fija:1,ter:"si"}),
 TG("fondo_otro","Fondo entregado a otro colaborador","110106","110106","","","GGP000","GGE000",{g:"Solo Contabilidad",c:1,fija:1,ter:"si"})
];
/* tipos de gasto de las versiones anteriores a la v62 */
const GASTO_ANT={"Combustible":"combustible","Peajes y estacionamiento":"peajes","Alimentación":"colacion","Alojamiento":"alojamiento","Repuestos y mantención":"mant_maquina","Insumos veterinarios":"otro","Insumos agrícolas":"otro","Ferretería y materiales":"ferreteria","Oficina":"oficina","Otros":"otro"};
const TIPO_DOC={boleta:"Boleta",factura:"Factura",boleta_honorarios:"Boleta de honorarios",peaje:"Comprobante de peaje",vale:"Ticket / vale / comprobante",otro:"Otro"};
/* v79: para rendir solo sirven facturas y boletas; «vale» y «otro» quedan solo para mostrar documentos antiguos */
const TIPOS_RENDIR=["boleta","factura","boleta_honorarios","peaje"];
/* v110: el comprobante de peaje solo vale con el tipo de gasto «Peajes / barcaza» */
const GASTO_PEAJE="peajes";
const esGastoPeaje=d=>{const c=gastoDe(d);return !!c&&c.id===GASTO_PEAJE};
const pareceePeaje=t=>/peaje|autopista|autov[ií]a|concesionari|barcaza|transbordador|ruta\s*(5|68|78)|tag\b|p[oó]rtico/i.test(String(t||""));
const DOCABR={boleta:["BOLETA","BOLETAS"],factura:["FACT","FACTS"],boleta_honorarios:["BH","BH"],vale:["TICKET","TICKETS"],otro:["DOCUMENTO","DOCUMENTOS"]};
const RD_ESTADO={borrador:"Borrador",enviada:"En revisión de jefatura",revcont:"En revisión contable",aprobada:"Aprobada, por contabilizar",contabilizada:"Contabilizada",observada:"Con observaciones"};
let REND={},rdv=null,rdd=null,rdTab="mias",MAE=null,MAE_ETAG="";
const periodoActual=()=>today().slice(0,7);
const periodoTxt=p=>{try{const [y,m]=p.split("-");return new Date(+y,+m-1,1).toLocaleDateString("es-CL",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}catch(e){return p}};
/* dígito verificador que corresponde a los números del RUT (módulo 11) */
function rutDV(r){const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase();if(c.length<2)return"";const num=c.slice(0,-1);let s=0,m=2;for(let i=num.length-1;i>=0;i--){s+=+num[i]*m;m=m===7?2:m+1}const r11=11-(s%11);return r11===11?"0":r11===10?"K":String(r11)}
const rutConDV=r=>{const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase();return c.length<2?r:rutLimpio(c.slice(0,-1)+rutDV(c))};
function rutValido(r){const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase();if(c.length<8)return false;const num=c.slice(0,-1),dv=c.slice(-1);let s=0,m=2;for(let i=num.length-1;i>=0;i--){s+=+num[i]*m;m=m===7?2:m+1}const r11=11-(s%11),dc=r11===11?"0":r11===10?"K":String(r11);return dc===dv}
const rutLimpio=r=>{const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase();if(c.length<2)return c;const num=c.slice(0,-1),dv=c.slice(-1);return num.replace(/\B(?=(\d{3})+(?!\d))/g,".")+"-"+dv};
const normRut=r=>String(r||"").toUpperCase().replace(/[^0-9K]/g,"").replace(/^0+/,"");
/* texto para Finnegans: mayúsculas, sin tildes ni ñ */
const normTxt=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9 \-\/.,()&+:]/g," ").replace(/\s+/g," ").trim();

/* ---------- Maestros contables (Rendiciones/_maestros/maestros.json) ---------- */
const maeTiene=k=>!!(MAE&&MAE.archivos&&MAE.archivos[k]&&MAE[k]);
const catalogo=()=>(MAE&&Array.isArray(MAE.tipos)&&MAE.tipos.length?MAE.tipos:CATALOGO_DEF);
function gastoDe(d){if(!d||!d.gasto)return null;const C=catalogo();return C.find(t=>t.id===d.gasto)||C.find(t=>t.id===GASTO_ANT[d.gasto])||C.find(t=>t.n===d.gasto)||null}
function centrosSel(){const L=CENTROS_DEF.map(c=>({c:c[0],n:c[1]}));if(maeTiene("centros"))Object.entries(MAE.centros).forEach(([c,x])=>{if(c!=="LCO-0002"&&!L.some(y=>y.c===c))L.push({c,n:(x&&x.n)||c})});return L}
function centroNombre(c){const d=CENTROS_DEF.find(x=>x[0]===c);return d?d[1]:(maeTiene("centros")&&MAE.centros[c]?MAE.centros[c].n:(c||""))}
const centroExiste=c=>!!(CENTROS_DEF.some(x=>x[0]===c)||(maeTiene("centros")&&MAE.centros[c]));
const ctaNombre=c=>(maeTiene("cuentas")&&MAE.cuentas[c])||"";
const prodNombre=p=>(maeTiene("productos")&&MAE.productos[p])||"";
const partNombre=p=>PARTIDAS_DEF[p]||(maeTiene("partidas")&&MAE.partidas[p])||"";
const buNombre=b=>b==="OTROS"?"Otros (sin bien específico)":((maeTiene("bienes")&&MAE.bienes[b])||"");
/* Si un RUT tiene dos fichas en Finnegans (con y sin guion, con cero inicial o con espacios), se usa la de formato más limpio; las dos existen en Finnegans */
const puntajeCod=c=>(c===c.trim()?8:0)+(/-/.test(c)?4:0)+(/^\s*0/.test(c)?0:2)+(/\./.test(c)?0:1);
function orgsAgregar(map,codigo,nombre){const c=String(codigo==null?"":codigo);const n=normRut(c);if(!n||!/\d{6,}/.test(n))return;const prev=map[n];if(!prev||puntajeCod(c)>puntajeCod(prev[0]))map[n]=[c,String(nombre||"").trim()]}
/* RUT en formato Finnegans estándar (sin puntos, con guion) para mostrar lo que falta crear */
const rutFin=r=>{const c=String(r||"").replace(/[^0-9kK]/g,"").toUpperCase().replace(/^0+/,"");return c.length<2?c:c.slice(0,-1)+"-"+c.slice(-1)};
/* busca en Finnegans una organización por el nombre del emisor (para sugerir el RUT correcto) */
const normNom=t=>normTxt(t).replace(/[.,]/g," ").replace(/\b(S A|SA|SPA|LTDA|LIMITADA|EIRL|Y CIA|CIA)\b/g," ").replace(/\s+/g," ").trim();
function orgPorNombre(nombre){if(!maeTiene("orgs"))return null;const q=normNom(nombre);if(q.length<5)return null;
  const L=Object.values(MAE.orgs).map(o=>[o,normNom(o[1])]).filter(x=>x[1].length>=5);
  const r=L.find(x=>x[1]===q)||L.find(x=>x[1].startsWith(q+" ")||q.startsWith(x[1]+" "))||(q.length>=8?L.find(x=>x[1].includes(q)):null);return r?r[0]:null}
function orgPorRut(r){const n=normRut(r);if(!n||!maeTiene("orgs"))return null;return MAE.orgs[n]||null}
const distServicios=()=>Object.keys((MAE&&MAE.dist)||{});
const distTabla=s=>(MAE&&MAE.dist&&MAE.dist[s])||null;
const colabs=()=>(MAE&&Array.isArray(MAE.colab)?MAE.colab:[]);
const aprobadores=()=>(MAE&&Array.isArray(MAE.aprob)?MAE.aprob:[]);
const correosDe=c=>String((c&&c.correo)||"").toLowerCase().split(/[\s,;]+/).filter(x=>/@/.test(x));
const meCorreo=()=>String((ME&&ME.correo)||"").toLowerCase();
const colabsDeCuenta=()=>{const m=meCorreo();return m?colabs().filter(c=>c.activo!==false&&correosDe(c).includes(m)):[]};
const colabPorRut=rut=>{const n=normRut(rut);return n?colabs().find(c=>normRut(c.rut)===n)||null:null};
/* v73: rendiciones creadas antes de cargar la lista de colaboradores quedaron sin RUT; se reconoce a la persona por su correo
   (solo si ese correo es de un único colaborador: las cuentas compartidas de predio siguen eligiendo quién rinde) */
const colabPorCorreo=co=>{co=String(co||"").toLowerCase();if(!/@/.test(co))return null;const L=colabs().filter(c=>c.activo!==false&&correosDe(c).includes(co));return L.length===1?L[0]:null};
const colabDe=r=>!(r&&r.persona)?null:r.persona.rut?colabPorRut(r.persona.rut):colabPorCorreo(r.persona.correo);
/* v74: las rendiciones enviadas sin jefatura (antes pasaban por un paso de «jefatura» que aprobaba Contabilidad) quedan directo en revisión contable */
function rdSinJefaturaADirecto(){if(!ME||!esContab())return;
  Object.values(REND).forEach(r=>{if(!r||r.anulada||r.estado!=="enviada"||!sinJefatura(r)||r.aprobJef)return;r.estado="revcont";rdHist(r,"pasa directo a Contabilidad (sin jefatura)");r.actualizado=new Date().toISOString();saveRend(r)})}
/* deja guardado el RUT en las rendiciones que no lo tienen (lo hace Contabilidad o la misma persona al abrir la app) */
function rdCompletarRut(){if(!colabs().length||!ME)return;
  Object.values(REND).forEach(r=>{if(!r||r.anulada||!r.persona||r.persona.rut)return;if(!(esContab()||esMiaR(r)))return;
    const c=colabPorCorreo(r.persona.correo);if(!c||!c.rut)return;r.persona=Object.assign({},r.persona,{rut:c.rut});rdHist(r,"persona",`RUT ${c.rut} tomado de la lista de colaboradores`);r.actualizado=new Date().toISOString();saveRend(r)})}
function contabCorreos(){const l=aprobadores().filter(a=>a.rol==="cont").map(a=>a.correo).filter(Boolean);return l.length?l:CONTAB_DEF}
function contabNombres(){const l=aprobadores().filter(a=>a.rol==="cont").map(a=>a.nombre).filter(Boolean);return l.length?l.join(" o "):"Contabilidad"}
const esContab=()=>!!(ME&&(contabCorreos().includes(meCorreo())||esAdmin()));
/* Jefatura que aprueba: la columna puede traer un nombre (se busca su correo en Aprobadores o en Colaboradores) o directamente un correo */
function jefaturaDe(c){
  if(!c||!c.jefe)return null;const j=String(c.jefe).trim();
  if(/@/.test(j)){const co=j.toLowerCase();const a=aprobadores().find(x=>x.correo===co)||colabs().find(x=>correosDe(x).includes(co));return{nombre:a?a.nombre:co,correo:co}}
  const n=normTxt(j);const a=aprobadores().find(x=>normTxt(x.nombre)===n&&x.correo);if(a)return{nombre:a.nombre,correo:a.correo};
  const c2=colabs().find(x=>normTxt(x.nombre)===n&&correosDe(x).length);if(c2)return{nombre:c2.nombre,correo:correosDe(c2)[0]};
  return{nombre:j,correo:""};
}
async function rdMaeLocal(){try{if(IDB.db){const d=await IDB.get("remote","rend/maestros");if(d&&d.hora){MAE=d;MAE_ETAG=d.etag||""}}}catch(e){}}
async function rdMaePull(){
  if(!DB||navigator.onLine===false)return false;
  let meta=null;try{meta=await gjson(`/drives/${M365.drive}/items/${RD.root}:/${RD.maeDir}/${RD.maeFile}?$select=id,eTag`)}catch(e){if(e.code!=="not_found")throw e;return false}
  if(meta.eTag===MAE_ETAG&&MAE)return false;
  const r=await gfetch(`/drives/${M365.drive}/items/${meta.id}/content`);const d=await r.json();d.etag=meta.eTag;MAE=d;MAE_ETAG=meta.eTag;
  try{if(IDB.db)await IDB.put("remote","rend/maestros",d)}catch(e){}
  return true;
}

/* ---------- Personas, roles y estados ---------- */
/* propia: la rendición es de quien está usando la app (por su cuenta o por su RUT en la lista de colaboradores) */
function esPropia(r){if(!ME||!r||!r.persona)return false;if(r.persona.id===ME.id)return true;if(r.persona.rut&&colabsDeCuenta().some(c=>normRut(c.rut)===normRut(r.persona.rut)))return true;return !r.persona.rut&&String(r.persona.correo||"").toLowerCase()===meCorreo()}
const esMiaR=r=>!!(ME&&r&&(esPropia(r)||(r.cuenta&&r.cuenta===meCorreo())));
const soyJefeDe=r=>!!(ME&&r&&r.jefatura&&r.jefatura.correo&&r.jefatura.correo===meCorreo());
const sinJefatura=r=>!(r&&r.jefatura&&r.jefatura.correo);
const puedeJefatura=r=>!!(r&&r.estado==="enviada"&&!esPropia(r)&&(soyJefeDe(r)||(sinJefatura(r)&&esContab())));
const puedeContab=r=>!!(r&&r.estado==="revcont"&&esContab()&&!esPropia(r));
const puedeContabilizar=r=>!!(r&&r.estado==="aprobada"&&esContab());
const editaPersona=r=>!!(r&&esMiaR(r)&&(r.estado==="borrador"||r.estado==="observada"));
const rdRO=r=>!(editaPersona(r)||puedeContab(r));
const rdParaMi=()=>Object.values(REND).filter(r=>!r.anulada&&(puedeJefatura(r)||puedeContab(r)));
const misRend=()=>Object.values(REND).filter(r=>!r.anulada&&esMiaR(r)).sort((a,b)=>String(b.periodo).localeCompare(String(a.periodo))||String(a.persona&&a.persona.nombre).localeCompare(String(b.persona&&b.persona.nombre)));
/* v76: varias rendiciones por persona en el mismo mes. Mientras una está en borrador (u observada) se sigue agregando a esa;
   cuando ya se envió, se puede empezar otra (N°2, N°3…) */
const rdEditable=r=>r&&(r.estado==="borrador"||r.estado==="observada");
const rdTitulo=r=>periodoTxt(r.periodo)+((r.n||1)>1?` · N°${r.n}`:"");
const rdMismaPersona=(r,c)=>c?normRut(r.persona&&r.persona.rut)===normRut(c.rut):!(r.persona&&r.persona.rut);
const rendPeriodo=p=>{const L=misRend().filter(r=>r.periodo===p);return L.find(rdEditable)||L.sort((a,b)=>(b.n||1)-(a.n||1))[0]||null};
const rdAbiertaDe=(p,c)=>misRend().find(r=>r.periodo===p&&rdMismaPersona(r,c)&&rdEditable(r))||null;
const rdSiguienteN=(p,c)=>1+Math.max(0,...Object.values(REND).filter(r=>!r.anulada&&r.periodo===p&&(c?normRut(r.persona&&r.persona.rut)===normRut(c.rut):(r.persona&&ME&&r.persona.id===ME.id))).map(r=>r.n||1));
function nuevaRend(p,c){const per=c?{id:"rut:"+normRut(c.rut),nombre:c.nombre,correo:meCorreo(),rut:c.rut}:{id:ME.id,nombre:ME.nombre,correo:ME.correo,rut:""};
  return{id:uid(),_col:"rendiciones",persona:per,cuenta:meCorreo(),periodo:p,estado:"borrador",docs:{},hist:[],creadoPor:yo(),creado:new Date().toISOString(),actualizado:new Date().toISOString()}}
const rdHist=(r,a,nota)=>{(r.hist=r.hist||[]).push({a,por:yo(),fecha:new Date().toISOString(),nota:nota||""})};
/* ---------- Avisos por correo (v78) ----------
   Salen desde la cuenta Microsoft de quien hace la acción (permiso delegado Mail.Send).
   Si no hay señal quedan en cola; si falta el permiso, se ofrece abrir el correo con el mensaje listo. */
const CORREO_K="actas-correos-pend",ABRIR_K="actas-abrir-rd";
const appURL=()=>location.origin+location.pathname.replace(/index\.html$/,"");
const linkRend=r=>appURL()+"?rd="+encodeURIComponent(r.id);
const primerNombre=s=>String(s||"").trim().split(/\s+/)[0]||"";
function correosPersona(r){const s=new Set();[r.cuenta,r.persona&&r.persona.correo].concat(correosDe(colabDe(r))).forEach(x=>{x=String(x||"").toLowerCase().trim();if(/@/.test(x))s.add(x)});return [...s]}
function nombreDeCorreo(c){const a=aprobadores().find(x=>x.correo===c&&x.nombre);if(a)return a.nombre;const k=colabs().find(x=>correosDe(x).includes(c));return k?k.nombre:c}
function listaNombres(L){const n=[...new Set(L)];return n.length<2?(n[0]||""):n.slice(0,-1).join(", ")+" y "+n[n.length-1]}
/* a quién le toca saber: enviada → jefatura (o Contabilidad si no tiene: v74 la manda directo a revisión contable); aprobada por jefatura o reenviada a Contabilidad → Contabilidad; devuelta o aprobada → la persona */
function rdDestinos(r,ev){
  let L=[];
  if(ev==="enviada")L=r.estado==="revcont"||!(r.jefatura&&r.jefatura.correo)?contabCorreos():[r.jefatura.correo];
  else if(ev==="aprobJef"||ev==="reenvCont")L=contabCorreos();
  else if(ev==="devuelta"||ev==="aprobada")L=correosPersona(r);
  const me=meCorreo();return [...new Set(L.map(x=>String(x||"").toLowerCase().trim()))].filter(x=>/@/.test(x)&&x!==me);
}
function rdCorreo(r,ev,op){
  op=op||{};const para=rdDestinos(r,ev);if(!para.length)return null;
  const per=rdTitulo(r),perm=periodoTxt(r.periodo).toLowerCase()+((r.n||1)>1?` (N°${r.n})`:""),nom=(r.persona&&r.persona.nombre)||"",D=docsDe(r),tot=fmtP(totalRend(r)),act=(ME&&(ME.nombre||ME.correo))||"";
  const aPersona=ev==="devuelta"||ev==="aprobada";
  const aCont=ev==="enviada"&&(r.estado==="revcont"||!(r.jefatura&&r.jefatura.correo));
  const nombres=aPersona?nom:ev==="enviada"&&!aCont?(r.jefatura.nombre||nombreDeCorreo(para[0])):listaNombres(para.map(nombreDeCorreo));
  const saludo=aPersona?primerNombre(nom):para.length===1?primerNombre(nombres):"";
  let asunto="",intro="",accion="",detalle=[],queAccion="";
  if(ev==="enviada"&&aCont){asunto=`${op.corregida?"Rendición corregida para revisión contable":"Rendición para revisión contable"}: ${nom} · ${per} · ${tot}`;
    intro=op.corregida?`${nom} corrigió y volvió a enviar su rendición de ${perm} a revisión contable.`:`${nom} envió su rendición de ${perm} directo a revisión contable (no tiene jefatura asignada).`;accion="Revisar la imputación";queAccion="La rendición quedó enviada"}
  else if(ev==="enviada"){asunto=`${op.corregida?"Rendición corregida por aprobar":"Rendición por aprobar"}: ${nom} · ${per} · ${tot}`;
    const tu=para.length>1?"para aprobación":"para tu aprobación";intro=op.corregida?`${nom} corrigió y volvió a enviar su rendición de ${perm} ${tu}.`:`${nom} envió su rendición de ${perm} ${tu}.`;accion="Revisar y aprobar";queAccion="La rendición quedó enviada"}
  else if(ev==="aprobJef"){asunto=`Rendición para revisión contable: ${nom} · ${per} · ${tot}`;intro=`${act} aprobó la rendición de ${nom} de ${perm}. Ahora queda en revisión contable.`;accion="Revisar la imputación";queAccion="La rendición quedó aprobada"}
  else if(ev==="reenvCont"){asunto=`Rendición corregida para revisión contable: ${nom} · ${per} · ${tot}`;intro=`${nom} corrigió su rendición de ${perm} y la volvió a enviar a revisión contable.`;accion="Revisar la imputación";queAccion="La rendición quedó reenviada"}
  else if(ev==="devuelta"){asunto=`Tu rendición de ${perm} fue devuelta con observaciones`;intro=`${act} devolvió tu rendición de ${perm}. Revisa las observaciones, corrige y vuelve a enviarla.`;accion="Ver las observaciones";queAccion="La rendición quedó devuelta";
    if(r.comentario)detalle.push(["Comentario",r.comentario]);
    D.filter(d=>d.estadoRev==="obs").forEach(d=>detalle.push([`${d.emisor||TIPO_DOC[d.tipo]||"Documento"}${d.fecha?" · "+fmtD(d.fecha):""}${num(d.total)?" · "+fmtP(num(d.total)):""}`,d.obsRev||"Revisar este documento."]))}
  else if(ev==="aprobada"){asunto=`Tu rendición de ${perm} fue aprobada`;intro=`${act} aprobó la revisión contable de tu rendición de ${perm}. Ya no tienes que hacer nada más.`;accion="Ver la rendición";queAccion="La imputación quedó aprobada"}
  else return null;
  /* v83: la notificación lleva un título corto y una línea */
  const pTit=ev==="enviada"?(aCont?(op.corregida?"Rendición corregida para revisión contable":"Rendición para revisión contable"):(op.corregida?"Rendición corregida por aprobar":"Rendición por aprobar")):ev==="aprobJef"?"Rendición para revisión contable":ev==="reenvCont"?"Rendición corregida para revisión contable":ev==="devuelta"?"Tu rendición fue devuelta":"Tu rendición fue aprobada";
  const pTxt=ev==="devuelta"?`${act} devolvió tu rendición de ${perm} con observaciones. Corrígela y vuelve a enviarla.`:ev==="aprobada"?`${act} aprobó tu rendición de ${perm}. No tienes que hacer nada más.`:`${nom} · ${per} · ${tot}`;
  const link=linkRend(r);
  const fila=(k,v)=>`<tr><td style="padding:6px 12px 6px 0;color:#5B6F84;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#17324D;font-weight:600">${esc(v)}</td></tr>`;
  const resumen=[["Persona",nom],["Período",per],["Documentos",String(D.length)],["Total",tot]];
  const html=`<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#17324D;max-width:560px">
<p style="margin:0 0 12px">${saludo?`Hola ${esc(saludo)}:`:"Hola:"}</p>
<p style="margin:0 0 16px">${esc(intro)}</p>
<table style="border-collapse:collapse;margin:0 0 16px">${resumen.map(x=>fila(x[0],x[1])).join("")}</table>
${detalle.length?`<div style="margin:0 0 16px;padding:12px 14px;background:#FBF3E4;border-left:4px solid #B7791F;border-radius:6px"><p style="margin:0 0 6px;font-weight:700">Observaciones</p>${detalle.map(x=>`<p style="margin:0 0 6px"><b>${esc(x[0])}:</b> ${esc(x[1])}</p>`).join("")}</div>`:""}
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1F4E79;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${esc(accion)}</a></p>
<p style="margin:0;color:#5B6F84;font-size:13px">Aviso de la app Puduhue Terreno. Si respondes este correo, le llega a ${esc(act)}.</p></div>`;
  const texto=[saludo?`Hola ${saludo}:`:"Hola:","",intro,"",...resumen.map(x=>`${x[0]}: ${x[1]}`),...(detalle.length?["","Observaciones:",...detalle.map(x=>`- ${x[0]}: ${x[1]}`)]:[]),"",`${accion}: ${link}`].join("\n");
  return{id:uid(),cuenta:meCorreo(),ev,rid:r.id,para,nombres,asunto,html,texto,queAccion,push:{titulo:pTit,texto:pTxt},creado:new Date().toISOString()};
}
async function tokenCorreo(){
  if(!MSAL||!CUENTA)throw{code:"auth"};
  try{return (await MSAL.acquireTokenSilent({scopes:["Mail.Send"],account:CUENTA})).accessToken}
  catch(e){const c=String((e&&(e.errorCode||e.message))||"");throw{code:/network|no_network|failed to fetch/i.test(c)?"network":"permiso",detail:c}}
}
async function enviarCorreo(m){
  if(navigator.onLine===false)throw{code:"network"};
  const tk=await tokenCorreo();let res;
  try{res=await fetch(M365.graph+"/me/sendMail",{method:"POST",headers:{Authorization:"Bearer "+tk,"Content-Type":"application/json"},body:JSON.stringify({message:{subject:m.asunto,body:{contentType:"HTML",content:m.html},toRecipients:m.para.map(a=>({emailAddress:{address:a}}))},saveToSentItems:true})})}catch(e){throw{code:"network"}}
  if(res.status===202||res.ok)return true;
  let d="";try{d=(await res.json()).error.code||""}catch(e){}
  throw{code:res.status===401||res.status===403?"permiso":"graph",status:res.status,detail:d};
}
const mailtoDe=m=>`mailto:${m.para.join(",")}?subject=${encodeURIComponent(m.asunto)}&body=${encodeURIComponent(m.texto)}`;
function correosPend(){try{const L=JSON.parse(localStorage.getItem(CORREO_K)||"[]");return Array.isArray(L)?L:[]}catch(e){return[]}}
function guardarCorreosPend(L){try{L.length?localStorage.setItem(CORREO_K,JSON.stringify(L)):localStorage.removeItem(CORREO_K)}catch(e){}}
/* aviso de una acción: msg es el mensaje de la acción, al que se le suma a quién se avisó */
async function rdAvisar(r,ev,msg,op){
  setTimeout(()=>rdAgendaPublicar(true).catch(()=>{}),1500); /* v84: el servidor queda al día para los recordatorios */
  let m=null;try{m=rdCorreo(r,ev,op)}catch(e){console.warn("correo",e)}
  if(!m){if(msg)disAviso(ev,msg);return}
  if(msg)disAviso(ev,msg);
  const pp=pushAviso(m); /* v83: la notificación sale en paralelo al correo */
  try{await enviarCorreo(m);const pr=await Promise.race([pp,new Promise(res=>setTimeout(()=>res(null),4000))]);toast(`${msg?msg+" ":""}Se avisó por correo${pr&&pr.enviadas?" y con una notificación":""} a ${m.nombres}.`)}
  catch(e){
    if(e&&e.code==="network"){await pp;guardarCorreosPend(correosPend().concat([m]));toast(`${msg?msg+" ":""}El aviso por correo a ${m.nombres} sale cuando vuelva la señal.`);return}
    console.warn("correo",e);{const t=$(".toast");if(t)t.remove()}
    if(await ask("No se pudo avisar por correo",`${m.queAccion}, pero la app no pudo mandar el aviso a ${m.nombres}${e&&e.code==="permiso"?" (falta autorizar el permiso de correo en Microsoft)":""}. ¿Abrimos tu correo con el mensaje listo para que lo envíes tú?`,"Abrir mi correo",false,"","Ahora no"))location.href=mailtoDe(m);
  }
}
let ENVIANDO_CORREOS=false;
async function enviarCorreosPend(){
  if(ENVIANDO_CORREOS||navigator.onLine===false||!CUENTA)return;
  const L=correosPend();if(!L.length)return;ENVIANDO_CORREOS=true;const listos=new Set(),notif=new Set();
  try{for(const m of L){
      if(m.cuenta!==meCorreo()){listos.add(m.id);continue}  /* quedó de otra cuenta: no se puede mandar a su nombre */
      if(!m.pushHecho&&await pushAviso(m))notif.add(m.id);
      try{await enviarCorreo(m);listos.add(m.id);toast(`Se avisó por correo a ${m.nombres}.`)}
      catch(e){if(e&&e.code==="network")break;listos.add(m.id);console.warn("correo pendiente",e);toast(`No se pudo mandar el aviso por correo a ${m.nombres}.`)}}}
  finally{guardarCorreosPend(correosPend().filter(x=>!listos.has(x.id)).map(x=>notif.has(x.id)?Object.assign(x,{pushHecho:true}):x));ENVIANDO_CORREOS=false}
}
/* ---------- v84: agenda de pendientes para los recordatorios automáticos ----------
   Cada vez que la app sincroniza (o alguien hace una acción en una rendición), le deja al servidor un resumen de lo
   pendiente: qué rendiciones esperan aprobación y desde cuándo, y cuáles siguen sin enviar. El servidor revisa ese
   resumen los días hábiles a las 9:00 y manda los recordatorios. */
const AGENDA_K="actas-agenda-h",ABRIR_TAB_K="actas-abrir-rdtab";
const ENTRA_ESTADO={enviada:["enviada"],revcont:["aprobada por jefatura","reenviada a Contabilidad","enviada directo a Contabilidad (sin jefatura)","pasa directo a Contabilidad (sin jefatura)","vuelve a revisión contable"],observada:["devuelta"]};
function rdDesde(r){
  const L=ENTRA_ESTADO[r.estado]||[];const h=(r.hist||[]).filter(x=>L.includes(x.a)&&x.fecha).map(x=>x.fecha).sort();
  if(h.length)return h[h.length-1];
  if(r.estado==="revcont"&&r.aprobJef&&r.aprobJef.fecha)return r.aprobJef.fecha+"T12:00:00Z";
  if(r.enviada)return r.enviada+"T12:00:00Z";
  return r.actualizado||"";
}
function rdAgenda(){
  const aprobar=[],enviar=[];
  Object.values(REND).forEach(r=>{
    if(!r||r.anulada)return;const per=r.persona||{},propios=correosPersona(r);
    if(r.estado==="enviada"||r.estado==="revcont"){
      const cont=r.estado==="revcont"||sinJefatura(r);
      const para=(cont?contabCorreos():[r.jefatura.correo]).map(x=>String(x||"").toLowerCase()).filter(x=>/@/.test(x)&&!propios.includes(x)); /* nadie aprueba lo propio */
      if(para.length)aprobar.push({para,rid:r.id,rol:cont?"cont":"jef",persona:per.nombre||"",periodo:r.periodo,total:fmtP(totalRend(r)),desde:rdDesde(r)});
    }else if(rdEditable(r)){
      const n=docsDe(r).length;if(!n&&r.estado!=="observada")return;
      enviar.push({para:propios,rid:r.id,estado:r.estado,persona:per.nombre||"",periodo:r.periodo,docs:n,total:fmtP(totalRend(r)),desde:r.estado==="observada"?rdDesde(r):""});
    }
  });
  return{aprobar,enviar};
}
const hashTxt=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h>>>0)};
let AGENDA_ENVIANDO=false;
async function rdAgendaPublicar(forzar){
  if(AGENDA_ENVIANDO||!CUENTA||!loaded||navigator.onLine===false||!PWA)return false;
  /* solo con datos recién sincronizados, para no pisar la agenda con una copia vieja */
  if(!forzar&&(!SYNC_INFO.ultima||Date.now()-Date.parse(SYNC_INFO.ultima)>15*60e3))return false;
  const ag=rdAgenda(),h=hashTxt(JSON.stringify(ag));let prev=null;try{prev=JSON.parse(localStorage.getItem(AGENDA_K)||"null")}catch(e){}
  if(!forzar&&prev&&prev.h===h&&Date.now()-prev.t<6*3600e3)return false;
  AGENDA_ENVIANDO=true;
  try{await pushFetch("agenda",ag);try{localStorage.setItem(AGENDA_K,JSON.stringify({h,t:Date.now()}))}catch(e){}return true}
  catch(e){console.warn("agenda",e);return false}
  finally{AGENDA_ENVIANDO=false}
}
/* administrador: ver y probar los recordatorios */
async function rdRecVer(){
  if(navigator.onLine===false){toast("Sin señal: inténtalo con conexión.");return}
  toast("Consultando…");await rdAgendaPublicar(true);
  let j;try{j=await pushFetch("recordatorios")}catch(e){toast(e&&e.status===403?"Solo el administrador de la app puede ver los recordatorios.":"No se pudo consultar el servidor.");return}
  {const t=$(".toast");if(t)t.remove()}
  const u=j.estado&&j.estado.ultimo,P=j.proximos||{},N=P.notificaciones||[];
  const ult=u?(u.nota?`${fmtD(u.fecha)}: ${u.nota}`:`${fmtD(u.fecha)}: ${u.notificaciones} ${u.notificaciones===1?"recordatorio":"recordatorios"}, ${u.enviadas} ${u.enviadas===1?"entregado":"entregados"} en teléfonos${u.sinEquipos?` (${u.sinEquipos} sin notificaciones activas)`:""}`):"todavía no hay envíos";
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="Recordatorios"><h3>Recordatorios del ${esc(fmtD(P.fecha||""))} a las 9:00</h3>
    <p class="note" style="margin-top:0">Último envío: ${esc(ult)}.</p>
    ${N.length?`<div class="list">${N.map(n=>`<div class="info" style="margin:0 0 8px"><b>${esc(n.titulo)}</b><br>${esc(n.texto)}<br><span class="hint">Para: ${esc(nombreDeCorreo(n.para))}</span></div>`).join("")}</div>`:`<div class="empty">Con lo pendiente hoy, ese día no sale ningún recordatorio.</div>`}
    <p class="note">Solo les llegan a quienes tienen las notificaciones activas. Los correos de aviso de cada paso siguen igual.</p>
    <div class="btns"><button class="btn pri" data-m="close" style="flex:1">Cerrar</button></div></div>`;
  document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m||(e.target.dataset&&e.target.dataset.m==="close"))m.remove()});
}
async function rdRecProbar(){
  if(navigator.onLine===false){toast("Sin señal: inténtalo con conexión.");return}
  if(PUSH_ST!=="activo"){toast("Primero activa las notificaciones en "+eqTxt()+".");return}
  await rdAgendaPublicar(true);
  try{const j=await pushFetch("recordatorios",{});toast(j.notificaciones?`Te enviamos ${j.enviadas} de prueba (de ${j.notificaciones} que saldrían el ${fmtD(j.fecha)}).`:`El ${fmtD(j.fecha)} no sale ningún recordatorio con lo pendiente hoy.`)}
  catch(e){toast(e&&e.status===403?"Solo el administrador de la app puede probar los recordatorios.":"No se pudo consultar el servidor.")}
}
/* Link de los correos: ?rd=<id> abre esa rendición. Se guarda antes de iniciar sesión para que no se pierda en el camino. */
(()=>{try{const u=new URL(location.href);const id=u.searchParams.get("rd"),tab=u.searchParams.get("rdtab");if(id){sessionStorage.setItem(ABRIR_K,id);u.searchParams.delete("rd")}if(tab){sessionStorage.setItem(ABRIR_TAB_K,tab);u.searchParams.delete("rdtab")}if(id||tab)history.replaceState(history.state,"",u.pathname+u.search+u.hash)}catch(e){}})();
let ABRIR_AVISO=false;
function abrirEnlace(final){
  let tab=null;try{tab=sessionStorage.getItem(ABRIR_TAB_K)}catch(e){}
  if(tab&&loaded&&CUENTA){try{sessionStorage.removeItem(ABRIR_TAB_K)}catch(e){}rdTab=["jef","cont","mias"].includes(tab)?tab:"mias";rdv=null;rdd=null;go("rd");return}
  let id=null;try{id=sessionStorage.getItem(ABRIR_K)}catch(e){}
  if(!id||!loaded)return;
  if(!CUENTA){if(!ABRIR_AVISO){ABRIR_AVISO=true;setTimeout(()=>toast("Inicia sesión para abrir la rendición del correo."),700)}return}
  const r=REND[id];
  if(r&&!r.anulada){try{sessionStorage.removeItem(ABRIR_K)}catch(e){}rdv=r;if(!rdv.docs)rdv.docs={};rdd=null;go("rdv");return}
  if(final||(r&&r.anulada)){try{sessionStorage.removeItem(ABRIR_K)}catch(e){}toast(r?"Esa rendición fue anulada.":"No se encontró la rendición del correo; puede que la hayan eliminado.")}
}
function saveRend(r,deb){
  r._col="rendiciones";REND[r.id]=r;LOCAL[r.id]=r;status();clearTimeout(LT[r.id]);
  const run=()=>{delete LT[r.id];return localPut(r).then(ok=>{if(!ok&&STORE_OK!==false)toast("No queda espacio en el teléfono para guardar.");schedSync(1000);status()})};
  if(deb){LT[r.id]=setTimeout(run,250);return Promise.resolve()}
  return run();
}
function rdTouch(){if(!rdv)return;rdv.actualizado=new Date().toISOString();if(ME)rdv.modificadoPor=yo();saveRend(rdv,true)}
const docsDe=r=>Object.values(r.docs||{}).sort((a,b)=>String(a.fecha||"9")<String(b.fecha||"9")?-1:String(a.fecha||"9")>String(b.fecha||"9")?1:String(a.creado).localeCompare(String(b.creado)));
const totalRend=r=>docsDe(r).reduce((s,d)=>s+(num(d.total)||0),0);
const centroDoc=(r,d)=>d.centro||PREDIO_CENTRO[d.predio]||"";
/* Problemas de un documento: b impide enviar · a advertencia (se envía igual y quien revisa la ve) */
function problemasDoc2(r,d){
  const b=[],a=[];
  if(!d.foto)b.push("Falta la foto del documento.");
  if(!(num(d.total)>0))b.push("Falta el total.");
  if(!TIPOS_RENDIR.includes(d.tipo)&&r.estado!=="aprobada"&&r.estado!=="contabilizada")b.push(`Tipo de documento no válido: «${TIPO_DOC[d.tipo]||"sin tipo"}» no sirve para rendir; solo facturas, boletas y comprobantes de peaje. Cambia el tipo o elimina el documento.`);
  if(d.tipo==="peaje"&&gastoDe(d)&&!esGastoPeaje(d))b.push("Un comprobante de peaje solo se rinde con el tipo de gasto «Peajes / barcaza». Cambia el tipo de gasto o el tipo de documento.");
  /* en facturas y boletas de honorarios el RUT viene impreso y Finnegans lo exige; en boletas es opcional */
  const rutObl=d.tipo==="factura"||d.tipo==="boleta_honorarios";
  if(d.rut&&!rutValido(d.rut)){const c=String(d.rut).replace(/[^0-9kK]/g,"");
    const msg=c.length<8?`El RUT ${d.rut} está incompleto.`:`El RUT ${d.rut} no calza: con esos números el dígito verificador sería -${rutDV(d.rut)}. Revisa la foto; la lectura pudo confundir un número.`;
    if(rutObl)b.push(msg);else a.push(msg+" Mientras no se corrija, no se usa (en boletas el RUT es opcional).")}
  if(rutObl&&!String(d.rut||"").trim())b.push(`Falta el RUT del emisor: en ${d.tipo==="factura"?"facturas":"boletas de honorarios"} es obligatorio (viene impreso en el documento).`);
  if(d.fecha&&d.fecha>today())b.push("La fecha es futura.");
  if(!centroDoc(r,d))b.push("Falta el centro de costo.");
  if(!gastoDe(d))b.push("Falta el tipo de gasto.");
  if(d.rut&&d.folio){const igual=y=>y!==d&&y.rut&&y.folio&&normRut(y.rut)===normRut(d.rut)&&String(y.folio).trim()===String(d.folio).trim();const otra=Object.values(REND).find(x=>x.id!==r.id&&!x.anulada&&Object.values(x.docs||{}).some(igual));
    if(otra){const quien_=otra.persona&&otra.persona.nombre||quien(otra.creadoPor)||"otra persona",mia=esMiaR(otra);
      b.push(`Documento duplicado: esta boleta o factura (mismo RUT y número) ya está en ${mia?"tu rendición":"la rendición de "+quien_} de ${periodoTxt(otra.periodo).toLowerCase()} (${(RD_ESTADO[otra.estado]||otra.estado||"").toLowerCase()}). Debe quedar en una sola rendición: elimínala de una de las dos.`)}
    else if(Object.values(r.docs||{}).some(igual))b.push("Documento duplicado: esta boleta o factura (mismo RUT y número) está dos veces en esta misma rendición. Elimina una.")}
  if(d.lectura&&d.lectura.estado==="pendiente")a.push("La foto todavía no se ha leído (se lee al tener señal).");
  if(d.lectura&&d.lectura.estado==="error")a.push("La lectura automática falló; los datos quedan como los escribas.");
  if(!d.emisor)a.push("Sin nombre del emisor.");
  if(d.tipo!=="vale"&&d.tipo!=="otro"&&d.tipo!=="peaje"){if(!d.rut&&!rutObl)a.push("Sin RUT del emisor.");if(!d.folio)a.push("Sin número de boleta o factura.")}
  if(!d.fecha)a.push("Sin fecha.");else{const per=r.periodo;const f=String(d.fecha).slice(0,7);const [y,m]=per.split("-").map(Number);const ant=new Date(y,m-2,1);const antP=`${ant.getFullYear()}-${String(ant.getMonth()+1).padStart(2,"0")}`;if(f!==per&&f!==antP)a.push(`La fecha ${fmtD(d.fecha)} no corresponde al período (${periodoTxt(per)} o el mes anterior).`)}
  if(num(d.neto)>0&&num(d.iva)>0&&Math.abs(num(d.neto)+num(d.iva)-num(d.total))>2)a.push("Neto más IVA no cuadra con el total.");
  timbreDiferencias(d).forEach(x=>a.push(x));
  if(lecFacturaSinNeto(d)&&!(d.lectura&&/^(leyendo|pendiente)$/.test(d.lectura.estado)))a.push("Falta el neto y el IVA de la factura.");
  if(!String(d.glosa||"").trim())a.push("Sin detalle del gasto.");
  if(d.lectura&&d.lectura.estado==="ok"&&d.lectura.confianza!=null&&d.lectura.confianza<0.6&&!d.revisadoManual)a.push("Lectura automática con baja confianza: conviene revisar los datos.");
  return{b,a};
}
const docCompleto=(r,d)=>problemasDoc2(r,d).b.length===0;
const docAdvertencias=(r,d)=>problemasDoc2(r,d).a;

/* ---------- Motor contable (reglas de CAPAC SpA para FinnegansGO) ---------- */
/* Imputación de un documento: cuenta, producto, partida, centro, bien de uso y tercero, con sus alertas.
   n: "b" bloquea la aprobación contable · "r" revisar */
function imputar(r,d,sinAj){
  const al=[],A=(n,m,x)=>al.push(Object.assign({n,m},x||{}));
  const cat=gastoDe(d),centro=centroDoc(r,d),adm=centro===CENTRO_ADM,aj=sinAj?{}:(d.aj||{});
  let cuenta="",prod="",part="",ter="",bu="",dist=null,terPend="";
  if(!cat)A("b","Falta el tipo de gasto.");else if(cat.otro)A("b","Tipo de gasto «Otro»: Contabilidad debe clasificarlo.");
  if(cat&&!cat.otro){
    prod=adm?(cat.pa||cat.pp||""):(cat.pp||"");part=adm?(cat.para||cat.parp||""):(cat.parp||"");
    if(cat.fija)cuenta=cat.cp||cat.ca||"";
    else if(d.tipo==="factura")cuenta="210201";
    else if(d.tipo==="boleta_honorarios")cuenta="210203";
    else if(adm){cuenta=cat.ca||"";if(!cuenta&&!aj.cuenta)A("b",`«${cat.n}» no tiene cuenta de Administración: cambia el centro de costo o el tipo de gasto.`)}
    else cuenta=cat.cp||cat.ca||"";
  }
  if(aj.cuenta)cuenta=String(aj.cuenta).trim();if(aj.producto)prod=String(aj.producto).trim().toUpperCase();if(aj.partida)part=String(aj.partida).trim().toUpperCase();
  if(CTA_SIN_PROD.includes(cuenta))prod="";
  /* tercero: el código exacto del maestro de organizaciones */
  const sinTer=(cat&&cat.ter==="no")||cuenta==="210202";
  if(aj.tercero){const o=orgPorRut(aj.tercero);ter=o?o[0]:String(aj.tercero).trim();
    if(!o&&maeTiene("orgs")){ter="";if(CTA_CON_TER.includes(cuenta)){terPend=rutFin(aj.tercero);A("p",`Por crear en Finnegans: tercero RUT ${terPend} de la cuenta ${cuenta}.`,{rut:terPend,nombre:"Tercero de la cuenta "+cuenta,tipo:"persona o proveedor"})}else A("r",`El tercero ${aj.tercero} no está en Finnegans; la línea va sin tercero.`)}}
  else if(!sinTer&&d.rut&&rutValido(d.rut)){const o=orgPorRut(d.rut);if(o)ter=o[0]}
  if(sinTer)ter="";
  if(CTA_CON_TER.includes(cuenta)&&!ter&&!terPend){
    if((cuenta==="210201"||cuenta==="210203")&&d.rut&&rutValido(d.rut)&&maeTiene("orgs")){terPend=rutFin(d.rut);A("p",`Proveedor por crear en Finnegans: ${d.emisor||"(sin nombre)"}, RUT ${terPend}.`,{rut:terPend,nombre:d.emisor||"(sin nombre)",tipo:cuenta==="210201"?"proveedor":"prestador de honorarios"})}
    else if(cuenta==="210201"||cuenta==="210203"){} /* sin RUT: ya lo marca la revisión del documento */
    else A("b",`La cuenta ${cuenta} necesita el RUT del tercero (escríbelo en el ajuste contable).`);
  }
  if(/^4106/.test(cuenta))bu=d.bu||"OTROS";
  if(cat&&cat.dist&&d.dist){dist=distTabla(d.dist);if(!dist||!dist.length){A("b",`No está la tabla de distribución «${d.dist}» en los maestros.`);dist=null}}
  /* alertas de criterio */
  const tot=Math.round(num(d.total));
  if(tot>=UMBRAL_AF)A("r",`Monto alto (${fmtP(tot)}): evaluar si es activo fijo en vez de gasto.`);
  if(d.tipo==="factura"&&d.rutReceptor&&normRut(d.rutReceptor)!==normRut(CAPAC_RUT))A("r",`Factura emitida a ${d.receptor||d.rutReceptor}, no a CAPAC: no va a Proveedores; evaluar gasto directo o cuenta por cobrar a la relacionada.`);
  const em=normTxt(d.emisor);
  if(/SAESA/.test(em)&&d.rut&&normRut(d.rut)!==normRut("76073162-5"))A("r","SAESA tiene RUT 76073162-5: revisar el RUT del documento.");
  if(/OSORNO/.test(em)&&/(LUZ|ELECTRICA)/.test(em)&&d.rut&&normRut(d.rut)!==normRut("96531500-4"))A("r","Luz Osorno tiene RUT 96531500-4: revisar el RUT del documento.");
  if(/TRONADOR|PUDUHUE/.test(normTxt(d.receptor)))A("r","Documento a nombre de una empresa relacionada: evaluar cuenta por cobrar.");
  return{cat,centro,adm,cuenta,prod,part,ter,terPend,bu,dist,al};
}
/* reparte un monto según dispositivos; la diferencia de redondeo va a la línea con más dispositivos (como en las importaciones de Contabilidad) */
function repartir(total,rows){const T=rows.reduce((s,x)=>s+(+x.disp||0),0)||1;const ms=rows.map(x=>Math.round(total*(+x.disp||0)/T));const dif=total-ms.reduce((s,m)=>s+m,0);
  if(dif&&ms.length){let k=0;rows.forEach((x,i)=>{if((+x.disp||0)>(+rows[k].disp||0))k=i});ms[k]+=dif}return ms}
const corta=(t,n)=>t.length>n?t.slice(0,n).trim():t;
function glosaUna(d,cat){const obj=normTxt(d.glosa)||normTxt(cat?cat.n:"GASTO");const ab=(DOCABR[d.tipo]||DOCABR.otro)[0];const fol=normTxt(d.folio);return corta([corta(obj,70),ab+(fol?" "+fol:""),normTxt(d.emisor)].filter(Boolean).join(" - "),150)}
function glosaVarias(ds,cat){
  const objs=[...new Set(ds.map(d=>normTxt(d.glosa)).filter(Boolean))];
  let obj=!objs.length?normTxt(cat?cat.n:"GASTOS"):objs.length<=2?objs.join(" Y "):normTxt(cat?cat.n:objs[0]);if(obj.length>70)obj=corta(normTxt(cat?cat.n:obj),70);
  const tipos=[...new Set(ds.map(d=>d.tipo||"otro"))],pl=tipos.length===1?(DOCABR[tipos[0]]||DOCABR.otro)[1]:"DOCUMENTOS";
  const fols=ds.map(d=>normTxt(d.folio));const docs=ds.length<=4&&fols.every(Boolean)?`${pl} ${fols.length===2?fols.join(" Y "):fols.join("/")}`:`${ds.length} ${pl}`;
  const ems=[...new Set(ds.map(d=>normTxt(d.emisor)).filter(Boolean))];
  return corta([obj,docs,ems.length===1?ems[0]:""].filter(Boolean).join(" - "),150)}
function validarLinea(l){
  const o=[],A=(n,m)=>o.push({n,m});
  if(!l.cuenta)A("b","Hay una línea sin cuenta.");
  else{if(CTA_BLOQ[l.cuenta])A("b",`La cuenta ${l.cuenta} ${CTA_BLOQ[l.cuenta]}.`);if(maeTiene("cuentas")&&!MAE.cuentas[l.cuenta])A("b",`La cuenta ${l.cuenta} no está en el plan de cuentas.`)}
  if(!CTA_SIN_PROD.includes(l.cuenta)){if(!l.prod)A("b",`Falta el producto en la línea de la cuenta ${l.cuenta}.`);else if(maeTiene("productos")&&!MAE.productos[l.prod])A("b",`El producto ${l.prod} no está activo en el maestro de productos.`)}
  if(!l.part)A("b",`Falta la partida financiera en la línea de la cuenta ${l.cuenta}.`);else if(maeTiene("partidas")&&!MAE.partidas[l.part])A("b",`La partida ${l.part} no está en el maestro de dimensiones.`);
  if(!l.centro)A("b","Hay una línea sin centro de costo.");else if(!centroExiste(l.centro))A("b",`El centro de costo ${l.centro} no existe.`);
  if(/^4106/.test(l.cuenta)&&!l.bu)A("b",`La cuenta ${l.cuenta} necesita bien de uso.`);
  if(l.bu&&maeTiene("bienes")&&!MAE.bienes[l.bu])A("b",`El bien de uso ${l.bu} no está activo en el maestro.`);
  if(l.bu&&l.cuenta==="210201")A("b","Una factura (210201) no lleva bien de uso.");
  if(CTA_CON_TER.includes(l.cuenta)&&!l.ter&&!l.terPend)A("b",`La cuenta ${l.cuenta} necesita tercero (RUT).`);
  if(/^42/.test(l.cuenta)&&l.centro&&l.centro!==CENTRO_ADM)A("r",`Cuenta ${l.cuenta} (Administración) en el centro productivo ${l.centro}.`);
  if(/^41/.test(l.cuenta)&&l.centro===CENTRO_ADM)A("r",`Cuenta ${l.cuenta} (producción) en el centro de Administración.`);
  return o;
}
/* Asiento completo de una rendición: gastos al DEBE (boletas consolidadas, facturas una por una, gastos compartidos distribuidos)
   y al HABER el fondo por rendir de la persona, una línea por cada combinación de centro + partida */
function rdAsiento(r){
  const D=docsDe(r),al=[],deb=[],grupos={};const add=(n,m,k)=>al.push({n,m,k:k||""});
  const c=colabDe(r),per=String(r.periodo||"").split("-");
  const desc=`RENDICION ${per[1]||""}-${per[0]||""} ${normTxt(r.persona&&r.persona.nombre)}${(r.n||1)>1?" N"+r.n:""}`.trim();
  D.forEach(d=>{
    problemasDoc2(r,d).b.forEach(m=>add("b",m,d.k));
    const im=imputar(r,d);im.al.forEach(a=>al.push(Object.assign({},a,{k:d.k})));
    const tot=Math.round(num(d.total));if(!im.cuenta||!(tot>0))return;
    const fac=im.cuenta==="210201"||im.cuenta==="210203";
    let key;
    if(im.dist)key=fac?"F|"+d.k:["D",d.dist,im.ter,d.bu||""].join("|");
    else key=(fac||(im.cat&&im.cat.fija))?"S|"+d.k:["C",im.cuenta,im.prod,im.centro,im.part,im.ter,im.bu].join("|");
    let g=grupos[key];if(!g){g=grupos[key]={im,docs:[],tot:0,dist:!!im.dist,fac};deb.push(g)}g.docs.push(d);g.tot+=tot});
  const L=[];
  deb.forEach(g=>{const im=g.im,ks=g.docs.map(d=>d.k);
    if(!g.dist){L.push({lado:"D",cuenta:im.cuenta,prod:im.prod,part:im.part,centro:im.centro,ter:im.ter,terPend:im.terPend||"",bu:im.bu,monto:g.tot,glosa:g.docs.length===1?glosaUna(g.docs[0],im.cat):glosaVarias(g.docs,im.cat),docs:ks});return}
    const d0=g.docs[0],rows=im.dist,ms=repartir(g.tot,rows),n=g.docs.length,serv=normTxt(d0.dist);
    const tipos=[...new Set(g.docs.map(d=>d.tipo||"otro"))],pl=tipos.length===1?(DOCABR[tipos[0]]||DOCABR.otro)[1]:"DOCUMENTOS";
    const base=g.fac?`${serv} - ${(DOCABR[d0.tipo]||DOCABR.otro)[0]}${d0.folio?" "+normTxt(d0.folio):""}`:n>1?`${serv} (${n} ${pl})`:serv;
    rows.forEach((x,i)=>{if(!ms[i])return;const cta=g.fac?im.cuenta:(x.cuenta||im.cuenta);
      L.push({lado:"D",cuenta:cta,prod:CTA_SIN_PROD.includes(cta)?"":(x.prod||im.prod),part:x.part||im.part,centro:x.centro,ter:im.ter,terPend:im.terPend||"",bu:/^4106/.test(cta)?(d0.bu||"OTROS"):"",monto:ms[i],glosa:`${base} - DISTRIBUCION DISPOSITIVOS - ${normTxt(x.centro)}`,docs:ks})})});
  const ctaF=String(r.ctaFondo||(c&&c.cuenta)||"110106").trim()||"110106";
  const rutCol=String((r.persona&&r.persona.rut)||(c&&c.rut)||"").trim();const org=orgPorRut(rutCol);let terCol=org?org[0]:rutCol,terColPend="";
  if(!rutCol)add("b","Falta el RUT de la persona que rinde (elígela en «Persona que rinde»).");
  else if(maeTiene("orgs")&&!org){terColPend=rutFin(rutCol);terCol="";al.push({n:"p",m:`Persona por crear en Finnegans: ${r.persona&&r.persona.nombre||"quien rinde"}, RUT ${terColPend}.`,k:"",rut:terColPend,nombre:r.persona&&r.persona.nombre||"",tipo:"persona que rinde"})}
  const H=[],hk={};
  L.forEach(l=>{const k=l.centro+"|"+l.part;let h=hk[k];if(!h){h=hk[k]={lado:"H",cuenta:ctaF,prod:"",part:l.part,centro:l.centro,ter:terCol,terPend:terColPend,bu:"",monto:0,glosa:desc,docs:[]};H.push(h)}h.monto+=l.monto});
  const lineas=L.concat(H);
  lineas.forEach(l=>validarLinea(l).forEach(m=>add(m.n,m.m,"")));
  let f=String(r.fechaAsiento||r.enviada||"");const fd=D.map(d=>d.fecha).filter(Boolean).sort();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f))f=fd[fd.length-1]||today();
  const debe=L.reduce((s,l)=>s+l.monto,0),haber=H.reduce((s,l)=>s+l.monto,0);
  if(debe!==haber)add("b",`El asiento no cuadra: debe ${fmtP(debe)}, haber ${fmtP(haber)}.`);
  if(!al.some(a=>a.n==="b")&&debe!==totalRend(r))add("b",`El asiento (${fmtP(debe)}) no coincide con el total de los documentos (${fmtP(totalRend(r))}).`);
  const vistos=new Set(),A2=al.filter(a=>{const k=a.n+a.m+a.k;if(vistos.has(k))return false;vistos.add(k);return true}).sort((a,b)=>({b:0,p:1}[a.n]??2)-({b:0,p:1}[b.n]??2));
  return{lineas,debe,haber,fecha:f.slice(8,10)+"-"+f.slice(5,7)+"-"+f.slice(0,4),fechaISO:f,desc,al:A2,bloq:A2.filter(a=>a.n==="b").length,pend:A2.filter(a=>a.n==="p").length};
}
/* Excel de importación de asiento genérico (FinnegansGO): una hoja IMPORTADOR, todos los valores como texto y las celdas vacías sin valor */
const IMP_COLS=["EMPRESA","DOCUMENTO","NUMERO","FECHA","DESCRIPCION","CUENTA","CODIGOMONEDAITEM","DEBE","HABER","TERCERO","PRODUCTO","DIMENSION","DIMENSIONVALOR","DESCRIPCIONITEM","FECHAVENCIMIENTO","OPERACIONBANCARIA","CHEQUERA","NUMERO_CHEQUE","BANCOCHEQUE","CUITLIBRADOR","FECHACHEQUE","FECHAVENCIMIENTOCHEQUE","DIMENSION2","DIMENSIONVALOR2","DIMENSION3","DIMENSIONVALOR3","CODIGOMONEDA","COTIZACION"];
function rdImportXlsx(RS){
  const rows=[IMP_COLS.slice()];
  RS.forEach((r,i)=>{const A=rdAsiento(r);A.lineas.forEach(l=>{const w=new Array(28).fill(null);
    w[0]="2";w[1]="AG";w[2]=String(i+1);w[3]=A.fecha;w[4]=A.desc;w[5]=String(l.cuenta);w[6]="PES";
    if(l.lado==="D")w[7]=String(l.monto);else w[8]=String(l.monto);
    if(l.ter)w[9]=String(l.ter);if(l.prod)w[10]=String(l.prod);w[11]="DIMCTC";w[12]=String(l.centro);w[13]=l.glosa;
    if(l.cuenta==="110111")w[15]="TRANSREALIZADAS";
    w[22]="DIMPARFIN";w[23]=String(l.part);if(l.bu){w[24]="DIMBU";w[25]=String(l.bu)}w[26]="PES";w[27]="1";rows.push(w)})});
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=IMP_COLS.map((h,i)=>({wch:i===13||i===4?44:Math.max(8,h.length+2)}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"IMPORTADOR");return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
const MESES3=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const mesArch=p=>{const [y,m]=String(p||"").split("-");return (MESES3[(+m||1)-1]||"")+(y||"")};
const nomArch=t=>normTxt(t).split(" ").filter(Boolean).map(w=>w.charAt(0)+w.slice(1).toLowerCase()).join("");
/* Antes del Excel: si alguna rendición espera proveedores por crear, se revisa Finnegans; las que siguen esperando quedan fuera */
async function rdExportarListas(RS,marcar){
  if(RS.some(r=>rdAsiento(r).pend)&&navigator.onLine!==false)await rdOrgsFinnegans(true);
  const esperan=RS.filter(r=>rdAsiento(r).pend),listas=RS.filter(r=>!rdAsiento(r).pend&&!rdAsiento(r).bloq);
  if(esperan.length){const falt=[...new Set(esperan.flatMap(r=>rdAsiento(r).al.filter(a=>a.n==="p").map(a=>`${a.nombre} (RUT ${a.rut})`)))].join(", ");
    if(!listas.length){await ask("Falta crear en Finnegans",`${esperan.length===1?"Esta rendición espera":"Estas rendiciones esperan"} que se cree en Finnegans: ${falt}. Cuando exista, vuelve a descargar el Excel.`,"Entendido");return}
    if(!(await ask("Algunas rendiciones esperan",`${esperan.length} ${esperan.length===1?"rendición queda":"rendiciones quedan"} fuera porque falta crear en Finnegans: ${falt}. ¿Descargar el Excel con las otras ${listas.length}?`,"Descargar")))return}
  await rdExportar(listas,marcar);
}
async function rdExportar(RS,marcar){
  if(!window.XLSX){toast("No se pudo cargar el generador de Excel.");return}
  if(!RS.length){toast("No hay rendiciones listas para exportar.");return}
  await flush();const buf=rdImportXlsx(RS);
  const per=[...new Set(RS.map(r=>r.periodo))];
  const name=RS.length===1?`Importar_Rendicion_${nomArch(RS[0].persona&&RS[0].persona.nombre)}_${mesArch(RS[0].periodo)}${(RS[0].n||1)>1?"_"+RS[0].n:""}.xlsx`:`Importar_Rendiciones_${per.length===1?mesArch(per[0]):"varios_meses"}_${today()}.xlsx`;
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  if(marcar){const hoy=today();RS.forEach((r,i)=>{if(r.estado!=="aprobada")return;r.exportada={archivo:name,fecha:hoy,por:yo(),numero:i+1};rdHist(r,"exportada",name);r.actualizado=new Date().toISOString();saveRend(r)});
    if(DB&&navigator.onLine!==false)rdSubir(["Importaciones FinnegansGO"],name,blob,blob.type).catch(e=>console.warn("importación",e))}
  await compartirBlob(blob,name,RS.length===1?"Excel para FinnegansGO listo.":`Excel para FinnegansGO listo: ${RS.length} asientos (NUMERO 1 a ${RS.length}).`,["Importaciones FinnegansGO"]);
  render();
}

/* ---------- Lectura con IA (vía servidor) ---------- */
let LEYENDO={};const LEYENDO_ALGUNO=()=>Object.keys(LEYENDO).length>0;
async function leerDoc(r,d){
  if(!d.foto||LEYENDO[d.k])return;if(navigator.onLine===false){d.lectura={estado:"pendiente"};return}
  LEYENDO[d.k]=true;d.lectura={estado:"leyendo"};rdRefreshDoc(d.k);
  try{
    let dataURL=FOTO[d.foto];
    if(!dataURL||!dataURL.startsWith("data:")){let blob=null;if(IDB.db){const rec=await IDB.get("fotos",d.foto).catch(()=>null)||await IDB.get("cache",d.foto).catch(()=>null);blob=await recBlob(rec)}
      if(!blob&&dataURL){const rr=await fetch(dataURL);blob=await rr.blob()}
      if(!blob)throw{error:"No se encontró la foto en el teléfono."};dataURL=await blobToDataURL(blob)}
    const tok=await getToken();
    const tipos=catalogo().filter(t=>!t.c&&!t.otro&&t.activo!==false).map(t=>({id:t.id,n:t.n}));
    const res=await fetch(WORKER+"/boleta",{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({imagen:dataURL,mime:"image/jpeg",tipos,timbre:d.timbre||undefined,escaneo:d.deEscaneo||undefined})});
    const j=await res.json().catch(()=>({error:"Respuesta no válida del servidor."}));if(!res.ok)throw j;
    const x=j.datos||{};
    d.lectura={estado:"ok",confianza:+x.confianza||0,problemas:Array.isArray(x.problemas)?x.problemas:[],legible:x.legible!==false,hora:j.hora,modelo:j.modelo};if(j.revision)d.lectura.revision={modelo:j.revision.modelo,motivos:(j.revision.motivos||[]).slice(0,6),error:j.revision.error||undefined};
    if(!d.revisadoManual){if(x.tipo&&TIPO_DOC[x.tipo])d.tipo=x.tipo;if(x.emisor)d.emisor=String(x.emisor).slice(0,80);if(x.rut_emisor)d.rut=rutLimpio(x.rut_emisor);if(x.folio)d.folio=String(x.folio).trim();if(x.fecha&&/^\d{4}-\d{2}-\d{2}$/.test(x.fecha))d.fecha=x.fecha;if(num(x.total)>0)d.total=Math.round(num(x.total));if(num(x.neto)>0)d.neto=Math.round(num(x.neto));if(num(x.iva)>0)d.iva=Math.round(num(x.iva));if(x.glosa&&(!d.glosa||d.glosaTimbre)){d.glosa=String(x.glosa).slice(0,120);delete d.glosaTimbre}}
    if(x.rut_receptor)d.rutReceptor=rutLimpio(x.rut_receptor);if(x.receptor)d.receptor=String(x.receptor).slice(0,80);
    if(d.timbre){const ti=num(x.total_impreso);if(ti>0&&Math.abs(ti-num(d.timbre.mnt))>1)d.lectura.totalImpreso=ti}
    if(d.timbre&&!d.revisadoManual)timbreAplicar(d,d.timbre);
    if(d.rut&&!d.gasto){const gh=gastoHistorial(d.rut,d.k);if(gh){d.gasto=gh;d.gastoHist=true}}
    if(x.tipo_gasto&&!d.gasto&&tipos.some(t=>t.id===x.tipo_gasto)){d.gasto=x.tipo_gasto;d.gastoIA=true}
    if(!d.revisadoManual&&(d.tipo==="vale"||d.tipo==="otro")&&(esGastoPeaje(d)||pareceePeaje([d.emisor,x.glosa].join(" ")))){d.tipo="peaje";if(!d.gasto&&catalogo().some(t=>t.id===GASTO_PEAJE)){d.gasto=GASTO_PEAJE;d.gastoIA=true}}
    lecturaGuardar(d);
    try{const k="rd-lecturas-"+periodoActual();localStorage.setItem(k,String((+localStorage.getItem(k)||0)+1))}catch(e){}
  }catch(e){d.lectura={estado:"error",msg:(e&&e.error)||"No se pudo leer el documento."};console.warn("lectura",e)}
  finally{delete LEYENDO[d.k];r.actualizado=new Date().toISOString();await saveRend(r);if((view==="rdd"&&rdd&&rdd.k===d.k)||(view==="rdv"&&rdv&&rdv.id===r.id&&!LEYENDO_ALGUNO()))render();else rdRefreshDoc(d.k)}
}
async function leerPendientes(){if(navigator.onLine===false)return;for(const r of Object.values(REND)){if(r.anulada||!esMiaR(r))continue;for(const d of Object.values(r.docs||{})){if(d.foto&&d.lectura&&(d.lectura.estado==="pendiente")&&!QF[d.foto])await leerDoc(r,d)}}}

/* ---------- Pantallas ---------- */
/* ---------- v92: seguimiento por pasos y revisión de documentos uno por uno ----------
   - Cada rendición muestra sus pasos (Envío → Jefatura → Contabilidad → Finnegans) como una línea con círculos:
     verde lo hecho, azul dónde está ahora (con «desde hace N días»), rojo dónde la devolvieron y gris lo que falta.
     En la lista, cada rendición trae la misma línea en chico.
   - Al subir varios documentos juntos se abren uno por uno («Nuevo 1 de 3», con flechas y «Siguiente») para revisar
     lo que leyó la app. En cualquier documento hay flechas para pasar al anterior o al siguiente («2 de 7»). */
let RD_COLA=null;
function rdJefNombre(r){const c=colabDe(r),jefE=r.jefatura||(c?jefaturaDe(c):null);
  return r.aprobJef?quien(r.aprobJef.por):(r.jefatura&&r.jefatura.correo?r.jefatura.nombre:(jefE&&jefE.correo?jefE.nombre:""))}
const rdDesde2=r=>r.estado==="aprobada"&&r.aprobCont&&r.aprobCont.fecha?r.aprobCont.fecha:rdDesde(r);
function rdDesdeTxt(r){const h=haceDias(rdDesde2(r));return h==="hoy"?"desde hoy":h==="ayer"?"desde ayer":h?`desde ${h}`:""}
function rdDiasEspera(r){const f=rdDesde2(r);if(!f)return 0;return Math.max(0,Math.round((new Date(today()+"T12:00:00Z")-new Date(String(f).slice(0,10)+"T12:00:00Z"))/864e5))}
function rdPasos(r){
  const e=r.estado||"borrador",idx={borrador:0,observada:0,enviada:1,revcont:2,aprobada:3,contabilizada:4}[e]||0;
  /* ya pasó por jefatura sin registro de aprobación (envío directo a Contabilidad): no aplica, salvo que tenga jefatura asignada */
  const jn=idx>=2&&!r.aprobJef?(r.jefatura&&r.jefatura.correo?r.jefatura.nombre:""):rdJefNombre(r),sinJ=!r.aprobJef&&!jn;
  const S=[{t:"Envío",st:"pend",s:""},{t:"Jefatura",st:"pend",s:""},{t:"Contabilidad",st:"pend",s:""},{t:"Finnegans",st:"pend",s:""}];
  if(e==="borrador"){S[0].st="act";S[0].s="por enviar"}
  else if(e==="observada"){S[0].st="act";S[0].s="reenviar"}
  else{S[0].st="ok";S[0].s=r.enviada?fmtD(r.enviada):""}
  if(sinJ){S[1].st="na";S[1].s="no aplica"}
  else if(r.aprobJef){S[1].st="ok";S[1].s=fmtD(String(r.aprobJef.fecha).slice(0,10))}
  else if(idx>=2){S[1].st="ok"}
  else{S[1].s=jn;if(e==="enviada")S[1].st="act"}
  if(r.aprobCont){S[2].st="ok";S[2].s=fmtD(String(r.aprobCont.fecha).slice(0,10))}
  else if(idx>=3)S[2].st="ok";
  else if(e==="revcont"||(e==="enviada"&&sinJ))S[2].st="act";
  if(e==="contabilizada"){S[3].st="ok";S[3].s=r.contab&&r.contab.asiento?`N° ${r.contab.asiento}`:fmtD(r.contab&&r.contab.fecha)}
  else if(e==="aprobada"){S[3].st="act";S[3].s=r.exportada?"Excel listo":"por registrar"}
  if(e==="observada"){const i=(r.devueltaEn==="revcont"||sinJ)?2:1;S[i].st="dev";S[i].s="devolvió"}
  return S;
}
function rdEstadoFrase(r){
  const e=r.estado||"borrador",n=docsDe(r).length,dt=rdDesdeTxt(r),tarde=rdDiasEspera(r)>=3;
  if(e==="borrador")return{t:n?`Sin enviar · ${n} ${n===1?"documento":"documentos"}. Cuando estén completos, envíala a aprobación.`:"Sin enviar. Agrega las facturas y boletas del mes."};
  if(e==="observada"){const h=(r.hist||[]).filter(x=>x.a==="devuelta").pop();
    return{t:`Devuelta${h?` por ${quien(h.por)} el ${fmtD(isoLocal(h.fecha))}`:""}: corrige lo observado y reenvíala.`,k:"dev"}}
  if(e==="enviada"){const jn=rdJefNombre(r);return{t:jn?`Esperando la aprobación de ${jn} ${dt}.`:`Esperando la revisión de ${contabNombres()} ${dt}.`,k:tarde?"tarde":"act"}}
  if(e==="revcont")return{t:`En revisión contable (${contabNombres()}) ${dt}.`,k:tarde?"tarde":"act"};
  if(e==="aprobada")return{t:`Aprobada. Falta registrarla en FinnegansGO ${dt}.`,k:"act"};
  if(e==="contabilizada")return{t:`Contabilizada${r.contab&&r.contab.fecha?` el ${fmtD(r.contab.fecha)}`:""}${r.contab&&r.contab.asiento?` · asiento N° ${r.contab.asiento}`:""}.`,k:"ok"};
  return{t:RD_ESTADO[e]||e};
}
const RD_ICO={ok:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg>`,dev:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>`,na:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10"/></svg>`};
function rdPasosHTML(r){
  const S=rdPasos(r),f=rdEstadoFrase(r),txt={ok:"listo",act:"en curso",dev:"devuelta",na:"no aplica",pend:"pendiente"};
  return `<div class="rdst" role="group" aria-label="Seguimiento de la rendición">
    <ol class="rdsteps">${S.map((s,i)=>`<li class="p-${s.st}${i<S.length-1&&S[i+1].st!=="pend"?" p-sig":""}" aria-label="${s.t}: ${txt[s.st]}${s.s?`, ${esc(s.s)}`:""}"><span class="rdsc">${RD_ICO[s.st]||(s.st==="act"?"<i></i>":"")}</span><b>${s.t}</b><small>${esc(s.s||"")}</small></li>`).join("")}</ol>
    <p class="rdsf ${f.k||""}">${esc(f.t)}</p></div>`;
}
const rdMiniHTML=r=>`<span class="rdmini" aria-hidden="true">${rdPasos(r).map(s=>`<i class="p-${s.st}"></i>`).join("")}</span>`;
/* documentos: navegación entre ellos */
function rdNavLista(r,d){
  const enCola=RD_COLA&&RD_COLA.rid===r.id&&RD_COLA.keys.includes(d.k)&&RD_COLA.keys.every(k=>r.docs[k]);
  const keys=enCola?RD_COLA.keys:docsDe(r).map(x=>x.k);const i=keys.indexOf(d.k);
  return{keys,i,cola:enCola,ant:i>0?keys[i-1]:null,sig:i>=0&&i<keys.length-1?keys[i+1]:null};
}
function rdNavHTML(r,d){const N=rdNavLista(r,d);if(N.keys.length<2||N.i<0)return"";
  return `<div class="rdnav"><button class="rdna" data-a="rdIrDoc" data-k="${N.ant?esc(N.ant):""}" ${N.ant?"":"disabled"} aria-label="Documento anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="rdnt"><b>${N.cola?"Nuevo":"Documento"} ${N.i+1} de ${N.keys.length}</b>${N.cola?`<small>Revisa lo que leyó la app y corrige si hace falta</small>`:""}</span>
    <button class="rdna" data-a="rdIrDoc" data-k="${N.sig?esc(N.sig):""}" ${N.sig?"":"disabled"} aria-label="Documento siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
}
async function rdIrDoc(k){if(!rdv||!k||!rdv.docs[k])return;await flush();rdd=rdv.docs[k];go("rdd");window.scrollTo(0,0)}
function rdPieDoc(r,d){const N=rdNavLista(r,d),tot=num(d.total)?fmtP(num(d.total)):"Sin total";
  const res=accRes(N.keys.length>1&&N.i>=0?`${N.cola?"Nuevo":"Documento"} ${N.i+1} de ${N.keys.length}`:"Documento",`${esc(d.emisor||"Sin emisor")} · ${tot}`);
  return accBar("rddbar",res,N.sig?`<button class="btn pri" data-a="rdIrDoc" data-k="${esc(N.sig)}">Siguiente</button>`:`<button class="btn pri" data-a="rdVolver">Listo</button>`)}
/* tras subir varios juntos: abrir el primero en modo revisión */
function rdTrasSubir(r,keys){keys=keys.filter(Boolean);if(keys.length<2||!rdv||rdv.id!==r.id||view!=="rdv")return;
  RD_COLA={rid:r.id,keys};rdd=r.docs[keys[0]];if(rdd)go("rdd");window.scrollTo(0,0)}
function rdEstadoChip(r){const e=r.estado||"borrador";const cls=e==="aprobada"||e==="contabilizada"?"ok":e==="enviada"||e==="revcont"?"camb":e==="observada"?"nueva":"";return `<span class="xp ${cls}" ${cls?"":'style="background:var(--soft);color:var(--muted)"'}>${RD_ESTADO[e]||e}</span>`}
function rdCard(r,ctx){const D=docsDe(r),n=D.length,inc=D.filter(d=>!docCompleto(r,d)).length;const nom=ctx||!esPropia(r)||colabsDeCuenta().length>1;
  let extra="";if(ctx==="cont"&&(r.estado==="revcont"||r.estado==="aprobada")){const A=rdAsiento(r);extra=A.bloq?` · <span style="color:var(--m-ink)">${A.bloq} por corregir</span>`:A.pend?` · ${A.pend} por crear en Finnegans`:A.al.length?` · ${A.al.length} por revisar`:" · asiento cuadrado"}
  return `<button class="bod rdc" data-a="rdAbrir" data-id="${r.id}">${disRdIco(r)}<span class="rdc-x"><span class="bodn">${esc(rdTitulo(r))}${nom?` · ${esc(r.persona?r.persona.nombre:"")}`:""}</span><span class="bodm">${n} ${n===1?"documento":"documentos"}${inc&&(r.estado==="borrador"||r.estado==="observada")?` · ${inc} por completar`:""}${extra}${r.exportada&&r.estado==="aprobada"?" · exportada":""}</span><span class="bodc rdc-e">${rdMiniHTML(r)}${rdEstadoChip(r)}${(x=>x.includes("xp ok")?"":x)(chipSync(r))}</span></span><b class="rdc-v">${fmtP(totalRend(r))}</b>${ICO.arrow}</button>`}
function renderRD(){
  const head=band("Rendiciones");
  const todas=Object.values(REND).filter(r=>!r.anulada);
  const equipo=todas.filter(r=>soyJefeDe(r)),pj=equipo.filter(r=>puedeJefatura(r));
  const verJef=equipo.length>0,verCont=esContab();
  if(rdTab==="jef"&&!verJef)rdTab="mias";if(rdTab==="cont"&&!verCont)rdTab="mias";
  const nCont=verCont?todas.filter(r=>puedeContab(r)||(sinJefatura(r)&&puedeJefatura(r))).length:0;
  const tabs=verJef||verCont?`<div class="filt" style="margin-top:14px"><button class="fb" data-a="rdTab" data-t="mias" aria-pressed="${rdTab==="mias"}">Mis rendiciones</button>${verJef?`<button class="fb" data-a="rdTab" data-t="jef" aria-pressed="${rdTab==="jef"}">Por aprobar${pj.length?` (${pj.length})`:""}</button>`:""}${verCont?`<button class="fb" data-a="rdTab" data-t="cont" aria-pressed="${rdTab==="cont"}">Contabilidad${nCont?` (${nCont})`:""}</button>`:""}</div>`:"";
  const porEnvio=(a,b)=>String(a.enviada||"").localeCompare(String(b.enviada||""));
  let body="";
  if(rdTab==="jef"){
    const otras=equipo.filter(r=>!pj.includes(r)).sort((a,b)=>String(b.periodo).localeCompare(String(a.periodo))).slice(0,30);
    body=`<h2>Esperando tu aprobación<span class="cnt">${pj.length}</span></h2><div class="list">${pj.sort(porEnvio).map(r=>rdCard(r,"jef")).join("")||`<div class="empty">No hay rendiciones esperando tu aprobación.</div>`}</div>${otras.length?`<h2>Tu equipo</h2><div class="list">${otras.map(r=>rdCard(r,"jef")).join("")}</div>`:""}<p class="note">Revisa que cada gasto corresponda al trabajo. Después de tu aprobación, Contabilidad revisa la imputación contable.</p>`;
  }else if(rdTab==="cont"){
    rdOrgsAuto();
    const sinJ=todas.filter(r=>r.estado==="enviada"&&sinJefatura(r)).sort(porEnvio),rev=todas.filter(r=>r.estado==="revcont").sort(porEnvio),apr=todas.filter(r=>r.estado==="aprobada").sort(porEnvio),enJ=todas.filter(r=>r.estado==="enviada"&&!sinJefatura(r)).sort(porEnvio);
    const cont=todas.filter(r=>r.estado==="contabilizada").sort((a,b)=>String(b.contab&&b.contab.fecha||"").localeCompare(String(a.contab&&a.contab.fecha||""))).slice(0,20);
    const listas=apr.filter(r=>!rdAsiento(r).bloq),esperan=listas.filter(r=>rdAsiento(r).pend);
    /* proveedores y personas que faltan en Finnegans, de todas las rendiciones en curso */
    const porCrear={};todas.filter(r=>["enviada","revcont","aprobada"].includes(r.estado)).forEach(r=>rdAsiento(r).al.filter(a=>a.n==="p").forEach(a=>{const k=normRut(a.rut);const x=porCrear[k]=porCrear[k]||{rut:a.rut,nombre:a.nombre,tipo:a.tipo,quien:new Set()};x.quien.add(r.persona&&r.persona.nombre||"")}));
    const PC=Object.values(porCrear).sort((a,b)=>cmpEs(a.nombre,b.nombre));
    body=`${!MAE?`<div class="info netbox"><b>Faltan los maestros contables.</b> Cárgalos en «Maestros contables» para validar cuentas, productos y proveedores, y para que cada persona tenga su jefatura.</div>`:""}
    <div class="btns" style="margin-top:8px"><button class="btn" data-a="rdMae">Maestros contables</button><button class="btn" data-a="rdXlsxMes" data-p="${periodoActual()}">Excel de documentos del mes</button><button class="btn" data-a="fdl">Fondos por rendir</button></div>
    ${PC.length?`<h2>Por crear en Finnegans<span class="cnt">${PC.length}</span></h2><div class="info" style="border-left:5px solid var(--act)">Créalos en Finnegans con este RUT; la app los detecta sola. Mientras tanto se pueden aprobar, pero su Excel espera.<ul>${PC.map(x=>`<li><b>${esc(x.nombre)}</b> · RUT ${esc(x.rut)} · ${esc(x.tipo)} · rendición de ${esc([...x.quien].filter(Boolean).join(", "))}</li>`).join("")}</ul></div><div class="btns"><button class="btn" data-a="rdOrgsFinn" ${ORGS_TRAYENDO?"disabled":""}>${ORGS_TRAYENDO?"Consultando Finnegans…":"Ya los creé: revisar en Finnegans"}</button></div>`:""}
    <h2>Revisión contable<span class="cnt">${rev.length}</span></h2><div class="list">${rev.map(r=>rdCard(r,"cont")).join("")||`<div class="empty">No hay rendiciones esperando revisión contable.</div>`}</div>
    ${sinJ.length?`<h2>Sin jefatura asignada<span class="cnt">${sinJ.length}</span></h2><p class="note">Quien rinde no tiene jefatura en la lista de colaboradores: Contabilidad aprueba ambos pasos.</p><div class="list">${sinJ.map(r=>rdCard(r,"cont")).join("")}</div>`:""}
    <h2>Aprobadas, por contabilizar<span class="cnt">${apr.length}</span></h2>
    ${apr.length?`<div class="btns"><button class="btn pri" data-a="rdImpTodas" ${listas.length?"":"disabled"} style="flex:1">Excel para FinnegansGO (${listas.length} ${listas.length===1?"asiento":"asientos"})</button></div>${esperan.length?`<p class="note">${esperan.length} ${esperan.length===1?"espera":"esperan"} un proveedor o persona por crear en Finnegans; al descargar, la app revisa Finnegans y deja fuera solo ${esperan.length===1?"esa":"esas"} si todavía falta.</p>`:""}${apr.some(r=>r.exportada)?`<div class="btns"><button class="btn" data-a="rdContabTodas">Marcar las exportadas como contabilizadas</button></div>`:""}`:""}
    <div class="list">${apr.map(r=>rdCard(r,"cont")).join("")||`<div class="empty">No hay rendiciones aprobadas pendientes.</div>`}</div>
    ${enJ.length?`<h2>En revisión de jefatura<span class="cnt">${enJ.length}</span></h2><div class="list">${enJ.map(r=>rdCard(r,"cont")).join("")}</div>`:""}
    ${cont.length?`<h2>Contabilizadas recientes</h2><div class="list">${cont.map(r=>rdCard(r,"cont")).join("")}</div>`:""}${rdRevisionHTML()}`;
  }else{
    const p=periodoActual(),cs=colabsDeCuenta(),act=misRend().filter(r=>r.periodo===p),ant=misRend().filter(r=>r.periodo!==p);
    const falta=cs.length>1?cs.some(c=>!act.some(r=>normRut(r.persona&&r.persona.rut)===normRut(c.rut)&&rdEditable(r))):!act.some(rdEditable);
    body=`${rdRecordatoriosHTML()}${fdTarjeta()}<h2>${esc(periodoTxt(p))}</h2>${act.length?`<div class="list">${act.map(r=>rdCard(r)).join("")}</div>`:""}
    ${falta?`<div class="start" style="grid-template-columns:1fr${act.length?";margin-top:10px":""}"><button class="big ent" data-a="rdNueva" data-p="${p}"><strong>${act.length?`Empezar otra rendición de ${esc(periodoTxt(p).toLowerCase())}`:`Empezar la rendición de ${esc(periodoTxt(p).toLowerCase())}`}</strong><span>${act.length&&cs.length<=1?"La que ya enviaste sigue su revisión; los documentos nuevos van en una rendición aparte (N°"+rdSiguienteN(p,cs[0]||null)+").":cs.length>1?"Esta cuenta la usan varias personas: la app te preguntará quién rinde.":"Saca una foto de cada factura o boleta; la app lee los datos y te pide lo que falte."}</span></button></div>`:""}
    ${ant.length?`<h2>Anteriores</h2><div class="list">${ant.map(r=>rdCard(r)).join("")}</div>`:""}
    ${colabs().length&&!cs.length?`<p class="note">Tu cuenta no está en la lista de colaboradores de Contabilidad. Puedes rendir igual: Contabilidad asignará tu RUT y revisará la rendición.</p>`:""}
    ${disTip("rdlee","Las boletas se leen solas cuando hay señal. Sin señal puedes fotografiarlas igual: se leen después.")}`;
  }
  return head+`<main class="wrap"><div class="pendslot">${slotHTML()}</div><h1>Rendiciones</h1>${tabs}${pushInvitaHTML()}${body}</main>`;
}
/* v77: recordatorio de cierre de mes — rendiciones con boletas sin enviar */
function rdRecordatorios(){
  if(!ME)return[];const p=periodoActual(),[y,m]=p.split("-").map(Number),hoy=new Date(),ult=new Date(y,m,0).getDate(),quedan=ult-hoy.getDate();
  const out=[];misRend().filter(r=>rdEditable(r)&&docsDe(r).length).forEach(r=>{const n=docsDe(r).length,tot=fmtP(totalRend(r)),nom=colabsDeCuenta().length>1&&r.persona?` de ${r.persona.nombre}`:"";
    if(r.periodo<p)out.push({n:"b",id:r.id,m:`La rendición de ${rdTitulo(r).toLowerCase()}${nom} sigue sin enviar (${n} ${n===1?"documento":"documentos"}, ${tot}). Envíala para que Contabilidad pueda cerrar ese mes.`});
    else if(r.periodo===p&&quedan<=4)out.push({n:"r",id:r.id,m:quedan<=0?`Hoy cierra ${periodoTxt(p).toLowerCase()}: envía tu rendición${nom} (${n} ${n===1?"documento":"documentos"}, ${tot}).`:`Quedan ${quedan} ${quedan===1?"día":"días"} para cerrar ${periodoTxt(p).toLowerCase()}: envía tu rendición${nom} (${n} ${n===1?"documento":"documentos"}, ${tot}).`})});
  return out;
}
const rdRecordatoriosHTML=()=>rdRecordatorios().map(x=>`<div class="info" style="border-left:5px solid var(${x.n==="b"?"--m-ink":"--r-ink"})"><button class="lnk" data-a="rdAbrir" data-id="${esc(x.id)}" style="text-align:left">${esc(x.m)}</button></div>`).join("");
/* v77: revisión de datos — lo que conviene corregir en la lista de colaboradores, el catálogo y las rendiciones en curso antes de que llegue a Contabilidad */
function rdRevisionDatos(){
  const out=[],A=(g,n,m,id)=>out.push({g,n,m,id});
  /* rendiciones en curso */
  Object.values(REND).filter(r=>r&&!r.anulada&&r.estado!=="contabilizada").forEach(r=>{const nom=(r.persona&&r.persona.nombre)||"Sin nombre",tit=`${nom} · ${rdTitulo(r)}`;
    if(!(r.persona&&r.persona.rut)&&!colabDe(r))A("Rendiciones en curso","b",`${tit}: sin RUT de quien rinde. Elige la persona en la rendición (Persona que rinde).`,r.id);
    if(r.estado==="enviada"&&!(r.jefatura&&r.jefatura.correo))A("Rendiciones en curso","r",`${tit}: enviada sin jefatura; pasa a Contabilidad al sincronizar.`,r.id)});
  /* colaboradores */
  const C=colabs().filter(c=>c.activo!==false);const porCorreo={};
  C.forEach(c=>{const nom=c.nombre||"(sin nombre)";
    if(!c.rut||!rutValido(c.rut))A("Lista de colaboradores","b",`${nom}: ${c.rut?"RUT "+c.rut+" no es válido":"falta el RUT"}.`);
    const cos=correosDe(c);if(!cos.length)A("Lista de colaboradores","b",`${nom}: sin correo Microsoft; no puede entrar a la app con su cuenta.`);cos.forEach(co=>(porCorreo[co]=porCorreo[co]||[]).push(nom));
    if(!c.jefe)A("Lista de colaboradores","r",`${nom}: sin jefatura; sus rendiciones pasan directo a Contabilidad.`);
    else{const j=jefaturaDe(c);if(!j||!j.correo)A("Lista de colaboradores","b",`${nom}: la jefatura «${c.jefe}» no tiene correo en Aprobadores ni en Colaboradores.`)}
    if(c.centro&&!centroExiste(c.centro))A("Lista de colaboradores","b",`${nom}: el centro por defecto ${c.centro} no existe.`);
    if(c.cuenta&&maeTiene("cuentas")&&!MAE.cuentas[c.cuenta])A("Lista de colaboradores","b",`${nom}: la cuenta del fondo ${c.cuenta} no está en el plan de cuentas.`)});
  Object.entries(porCorreo).filter(([,L])=>L.length>1).forEach(([co,L])=>A("Lista de colaboradores","i",`${co} lo usan ${L.length} personas (${L.join(", ")}): la app pregunta quién rinde.`));
  /* catálogo de tipos de gasto contra los maestros */
  catalogo().filter(t=>t.activo!==false&&!t.otro).forEach(t=>{const chk=(tipo,cod,lbl)=>{if(!cod)return;const ok=tipo==="cuentas"?(!maeTiene("cuentas")||MAE.cuentas[cod]):tipo==="productos"?(!maeTiene("productos")||MAE.productos[cod]):(PARTIDAS_DEF[cod]||!maeTiene("partidas")||MAE.partidas[cod]);if(!ok)A("Catálogo de tipos de gasto","b",`«${t.n}»: ${lbl} ${cod} no está en el maestro.`)};
    chk("cuentas",t.cp,"cuenta de producción");if(t.ca!==t.cp)chk("cuentas",t.ca,"cuenta de Administración");chk("productos",t.pp,"producto de producción");if(t.pa!==t.pp)chk("productos",t.pa,"producto de Administración");chk("partidas",t.parp,"partida de producción");if(t.para!==t.parp)chk("partidas",t.para,"partida de Administración")});
  return out;
}
function rdRevisionHTML(){
  if(!esContab())return"";const L=rdRevisionDatos(),nb=L.filter(x=>x.n==="b").length;
  const grupos=[...new Set(L.map(x=>x.g))];
  return `<details class="rvd"${nb?" open":""}><summary><b>Revisión de datos</b> · ${nb?`${nb} por corregir`:"sin problemas"}${L.length-nb?` · ${L.length-nb} ${L.length-nb===1?"aviso":"avisos"}`:""}</summary>
    ${L.length?grupos.map(g=>`<h3>${esc(g)}</h3><ul>${L.filter(x=>x.g===g).sort((a,b)=>({b:0,r:1,i:2}[a.n])-({b:0,r:1,i:2}[b.n])).map(x=>`<li class="rv-${x.n}">${x.id?`<button class="lnk" data-a="rdAbrir" data-id="${esc(x.id)}">${esc(x.m)}</button>`:esc(x.m)}</li>`).join("")}</ul>`).join(""):`<p class="note">Todo en orden: la lista de colaboradores, el catálogo y las rendiciones en curso no tienen problemas.</p>`}
    <p class="note">La lista de colaboradores y el catálogo se corrigen en el Excel y se vuelven a cargar en <b>Maestros contables</b>.</p></details>`;
}
function rdDocCard(r,d){
  const P=problemasDoc2(r,d),probs=P.b;const le=d.lectura||{};const cat=gastoDe(d),centro=centroDoc(r,d);
  const src=d.foto?fotoSrc(d.foto):"";const editable=r.estado==="borrador"||r.estado==="observada";
  /* v96: como mucho dos etiquetas por documento, la más importante primero */
  const ch=[];
  if(le.estado==="leyendo")ch.push(`<span class="xp" style="background:var(--soft);color:var(--muted)">Leyendo…</span>`);else if(le.estado==="pendiente")ch.push(`<span class="xp camb">Pendiente de lectura</span>`);else if(le.estado==="error")ch.push(`<span class="xp nueva">Lectura falló</span>`);
  if(d.estadoRev==="obs")ch.push(`<span class="xp nueva">Observada</span>`);else if(d.estadoRev==="ok")ch.push(`<span class="xp ok">Revisada</span>`);
  if(probs.length&&editable)ch.push(`<span class="xp nueva">${probs.length===1?"1 dato obligatorio":probs.length+" datos obligatorios"}</span>`);
  if(P.a.length&&editable)ch.push(`<span class="xp camb">${P.a.length} ${P.a.length===1?"dato en blanco":"datos en blanco"}</span>`);
  if(d.aj&&Object.keys(d.aj).length)ch.push(`<span class="xp camb">Ajuste contable</span>`);
  {const gs=d.gastoIA||d.gastoHist;if(editable&&(d.centroSug||gs))ch.push(`<span class="xp camb">${d.centroSug&&gs?"Centro y tipo sugeridos":gs?"Tipo sugerido":"Centro sugerido"}</span>`)}
  if(!ch.length&&editable)ch.push(`<span class="xp ok">Completa</span>`);
  const pdfCh=d.pdf||d.pdfPags?`<span class="xp" style="background:var(--soft);color:var(--muted)">PDF</span>`:"";
  return `<div class="rdd" role="button" tabindex="0" data-a="rdDoc" data-k="${esc(d.k)}">
    <span class="rdth"><span class="th${src?"":" miss"}">${src?`<img src="${esc(src)}" alt="">`:d.foto?(navigator.onLine===false?"Sin señal":"Cargando…"):"Sin foto"}</span></span>
    <span class="rdx"><span class="rdt">${esc(d.emisor||"Documento sin emisor")}</span><span class="rdm">${d.fecha?fmtD(d.fecha):"Sin fecha"}${d.folio?` · N° ${esc(d.folio)}`:""}${d.tipo?` · ${TIPO_DOC[d.tipo]||d.tipo}`:""}</span><span class="rdm">${[centro?centroNombre(centro):"",cat?cat.n:""].filter(Boolean).map(esc).join(" · ")||"Sin centro ni tipo de gasto"}${d.dist?` · reparto ${esc(d.dist)}`:""}</span><span class="bodc">${pdfCh}${ch.slice(0,2).join("")}</span></span>
    <span class="rdv"><b>${num(d.total)?fmtP(num(d.total)):"—"}</b>${d.obsRev?`<span class="rdo">Obs.</span>`:""}</span></div>`;
}
function rdAlertasHTML(al,r){
  if(!al.length)return `<div class="info" style="border-left:5px solid var(--b-ink)">Sin alertas: el asiento cumple las reglas contables${MAE?" y los códigos existen en los maestros":""}.</div>`;
  const li=a=>`<li>${a.k&&r.docs&&r.docs[a.k]?`<button class="lnk" data-a="rdDoc" data-k="${esc(a.k)}">${esc(r.docs[a.k].emisor||"Documento")}${num(r.docs[a.k].total)?" "+fmtP(num(r.docs[a.k].total)):""}</button>: `:""}${esc(a.m)}</li>`;
  const b=al.filter(a=>a.n==="b"),p=al.filter(a=>a.n==="p"),v=al.filter(a=>a.n!=="b"&&a.n!=="p");
  return (b.length?`<div class="info netbox"><b>Por corregir antes de aprobar (${b.length})</b><ul>${b.map(li).join("")}</ul></div>`:"")+(p.length?`<div class="info" style="border-left:5px solid var(--act)"><b>Por crear en Finnegans (${p.length})</b> · no impide aprobar; el Excel de esta rendición sale cuando exista en Finnegans<ul>${p.map(li).join("")}</ul></div>`:"")+(v.length?`<div class="info" style="border-left:5px solid var(--r-ink)"><b>Por revisar (${v.length})</b><ul>${v.map(li).join("")}</ul></div>`:"");
}
/* v75: buscador por nombre para cuenta, producto, partida, tercero y centro: Contabilidad elige por nombre y la app guarda el código */
const AJ_TIT={cuenta:"Cuenta contable",producto:"Producto",partida:"Partida financiera",tercero:"Tercero (proveedor o persona)",centro:"Centro de costo"};
const nomAj=(f,v)=>!v?"":f==="cuenta"?ctaNombre(v):f==="producto"?prodNombre(String(v).toUpperCase()):f==="partida"?partNombre(String(v).toUpperCase()):f==="tercero"?((orgPorRut(v)||[])[1]||""):f==="centro"?centroNombre(v):"";
function opcionesAj(f){
  let L=[];
  if(f==="cuenta")L=Object.entries((MAE&&MAE.cuentas)||{}).map(([c,n])=>({v:c,t:n||c,s:c,g:/^1/.test(c)?"Activo":/^2/.test(c)?"Pasivo":/^41/.test(c)?"Gastos de producción":/^42/.test(c)?"Gastos de administración":"Otras cuentas"}));
  else if(f==="producto")L=Object.entries((MAE&&MAE.productos)||{}).map(([c,n])=>({v:c,t:n||c,s:c,g:"Productos"}));
  else if(f==="partida")L=Object.entries(Object.assign({},(MAE&&MAE.partidas)||{},PARTIDAS_DEF)).map(([c,n])=>({v:c,t:n||c,s:c,g:"Partidas financieras"}));
  else if(f==="tercero")L=Object.values((MAE&&MAE.orgs)||{}).map(([c,n])=>({v:c,t:n||c,s:"RUT "+c,g:"Organizaciones"}));
  else if(f==="centro")L=[...new Set(CENTROS_DEF.map(x=>x[0]).concat(maeTiene("centros")?Object.keys(MAE.centros):[]))].map(c=>({v:c,t:centroNombre(c),s:c,g:c===CENTRO_ADM?"Administración":"Campos"}));
  L.forEach(o=>o.q=normTxt(o.t+" "+o.v+" "+(f==="tercero"?String(o.v).replace(/[^0-9kK]/g,""):"")));
  return L.sort((a,b)=>String(a.t).localeCompare(String(b.t),"es"));
}
/* o: {actual, base (lo que corresponde según el tipo de gasto; "" si no aplica), onPick(v) — v "" vuelve a lo del tipo de gasto} */
function pickAj(f,o){
  const ops=opcionesAj(f),grande=ops.length>150,tit=AJ_TIT[f]||f,act=String(o.actual||"");
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet pksheet" role="dialog" aria-modal="true" aria-label="${esc(tit)}"><h3>${esc(tit)}</h3><input class="pksearch" type="search" placeholder="Buscar por nombre o código" autocomplete="off" aria-label="Buscar"><div class="pklist"></div><div class="btns"><button class="btn" data-m="no">Cerrar</button></div></div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";
  const lista=m.querySelector(".pklist"),inp=m.querySelector(".pksearch");
  const item=(v,t,sub,on)=>`<button class="pkit${on?" on":""}" data-v="${esc(v)}"><span class="pkt">${esc(t)}${on?" ✓":""}</span><span class="pks">${esc(sub)}</span></button>`;
  const fijos=()=>{let h="";
    if(act)h+=`<div class="pkg">Actual</div>`+item(act,nomAj(f,act)||act,(f==="tercero"?"RUT ":"")+act+(nomAj(f,act)?"":" · no está en el maestro"),true);
    if(o.base!==undefined&&o.base!==null)h+=`<div class="pkg">Según el tipo de gasto</div>`+item("",o.base?(nomAj(f,o.base)||o.base):"Sin "+tit.toLowerCase(),o.base?`${o.base} · quita el ajuste`:"quita el ajuste",false);
    return h};
  const pintar=()=>{const q=normTxt(inp.value);let h="";
    if(!q){h=fijos();if(!ops.length)h+=`<div class="empty">No está cargado el maestro de ${esc(tit.toLowerCase())}. Escribe el código en la búsqueda para usarlo igual.</div>`;
      else if(grande)h+=`<div class="empty">Escribe parte del nombre o del código para buscar entre ${ops.length.toLocaleString("es-CL")} opciones.</div>`;
      else [...new Set(ops.map(x=>x.g))].forEach(g=>{h+=`<div class="pkg">${esc(g)}</div>`+ops.filter(x=>x.g===g).map(x=>item(x.v,x.t,x.s,x.v===act)).join("")})}
    else{const ws=q.split(" ").filter(Boolean),R=ops.filter(x=>ws.every(w=>x.q.includes(w)));
      h=R.slice(0,80).map(x=>item(x.v,x.t,x.s,x.v===act)).join("");if(R.length>80)h+=`<div class="empty">${R.length-80} más: escribe algo más específico.</div>`;
      const raw=inp.value.trim();if(raw&&!ops.some(x=>normTxt(x.v)===normTxt(raw))&&/^[A-Za-z0-9.\-]+$/.test(raw)&&/\d/.test(raw))h+=`<div class="pkg">Código escrito</div>`+item(f==="producto"||f==="partida"?raw.toUpperCase():raw,`Usar «${raw}» tal cual`,"no está en el maestro",false);
      if(!h)h=`<div class="empty">Sin resultados. Prueba con otra palabra.</div>`}
    lista.innerHTML=h};
  pintar();inp.addEventListener("input",pintar);
  const cerrar=()=>{m.remove();if(!document.querySelector(".modal"))document.body.style.overflow=""};
  m.addEventListener("click",e=>{e.stopPropagation();const b=e.target.closest(".pkit");if(b){cerrar();o.onPick(b.dataset.v);return}if((e.target.dataset&&e.target.dataset.m==="no")||e.target===m)cerrar()});
  if(!matchMedia("(pointer:coarse)").matches)setTimeout(()=>inp.focus(),30);
}
const ajBtn=(f,v,attrs,ph)=>`<button type="button" class="pkbtn" ${attrs}>${v?`<span>${esc(nomAj(f,v)||(f==="tercero"?"No está en Finnegans":"No está en el maestro"))}</span><small>${esc(f==="tercero"?"RUT "+v:v)}</small>`:`<span class="ph">${esc(ph||"Elegir…")}</span>`}</button>`;
/* v74: Contabilidad corrige una línea del asiento; el cambio se guarda como ajuste contable de cada documento de la línea */
function rdAjLinea(r,l){
  const H=l.lado==="H",docs=(l.docs||[]).map(k=>r.docs[k]).filter(Boolean),base=docs.length?imputar(r,docs[0],true):{};
  const campos=H?[["cuenta",l.cuenta]]:[["cuenta",l.cuenta],["producto",l.prod],["partida",l.part],["tercero",l.ter||l.terPend],["centro",l.centro]];
  const sel={};campos.forEach(([f,v])=>sel[f]=String(v||""));
  const baseDe={cuenta:H?"":base.cuenta,producto:base.prod,partida:base.part,tercero:base.ter};
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="Cambiar línea del asiento"><h3>${H?"Cuenta del fondo":"Cambiar línea del asiento"}</h3>
    <p>${H?"Cuenta contra la que se rinde (haber). Por defecto, la de la lista de colaboradores: Fondos por rendir; o fondo fijo.":`Se aplica a ${docs.length} ${docs.length===1?"documento":"documentos"} de esta línea (${esc(fmtP(l.monto))}). Busca por nombre; la app guarda el código.`}</p>
    ${campos.map(([f])=>`<div class="f"><label>${esc(AJ_TIT[f])}</label><span data-ajw="${f}">${ajBtn(f,sel[f],`data-ajf="${f}"`)}</span></div>`).join("")}
    <div class="btns"><button class="btn" data-m="no">Cancelar</button><button class="btn pri" data-m="ok" style="flex:1">Guardar cambio</button></div></div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";const close=()=>{m.remove();if(!document.querySelector(".modal"))document.body.style.overflow=""};
  m.addEventListener("click",e=>{const pb=e.target.closest("[data-ajf]");
    if(pb){const f=pb.dataset.ajf;pickAj(f,{actual:sel[f],base:f==="centro"?undefined:H?(r.ctaFondo?((colabDe(r)||{}).cuenta||"110106"):undefined):baseDe[f],onPick:v=>{sel[f]=v===""?(H?((colabDe(r)||{}).cuenta||"110106"):String(baseDe[f]||"")):v;const w=m.querySelector(`[data-ajw="${f}"]`);if(w)w.innerHTML=ajBtn(f,sel[f],`data-ajf="${f}"`)}});return}
    const a=e.target.dataset&&e.target.dataset.m;if(e.target===m||a==="no"){close();return}if(a!=="ok")return;
    const cambios=[];
    if(H){const c=sel.cuenta,def=(colabDe(r)||{}).cuenta||"110106";if(c!==l.cuenta){if(c===def)delete r.ctaFondo;else r.ctaFondo=c;cambios.push(`cuenta del fondo ${l.cuenta} → ${c}`)}}
    else{const act={cuenta:l.cuenta,producto:l.prod,partida:l.part,tercero:l.ter||l.terPend},ce=sel.centro;
      docs.forEach(d=>{const b0=imputar(r,d,true),bk={cuenta:"cuenta",producto:"prod",partida:"part",tercero:"ter"};const aj=Object.assign({},d.aj||{});
        Object.keys(act).forEach(k=>{const v=sel[k];if(v===String(act[k]||""))return;if(!v||v===String(b0[bk[k]]||""))delete aj[k];else aj[k]=v});
        d.aj=aj;if(!Object.keys(d.aj).length)delete d.aj;
        if(ce&&ce!==l.centro&&centroDoc(r,d)!==ce){const o=d.orig=d.orig||{};if(!("centro" in o))o.centro=centroDoc(r,d)||"";d.centro=ce}});
      Object.keys(act).forEach(k=>{if(sel[k]!==String(act[k]||""))cambios.push(`${k} ${act[k]||"vacío"}${nomAj(k,act[k])?" ("+nomAj(k,act[k])+")":""} → ${sel[k]||"según el tipo de gasto"}${nomAj(k,sel[k])?" ("+nomAj(k,sel[k])+")":""}`)});
      if(ce&&ce!==l.centro)cambios.push(`centro ${centroNombre(l.centro)} → ${centroNombre(ce)}`)}
    close();if(!cambios.length){toast("Sin cambios.");return}
    rdHist(r,"ajuste contable",cambios.join("; "));r.actualizado=new Date().toISOString();saveRend(r);const keep=window.scrollY;render();window.scrollTo(0,keep);toast("Línea actualizada.")});
}
function rdTablaAsiento(lineas,edit){const bu=lineas.some(l=>l.bu);
  return `<div class="asw"><table class="asi"><thead><tr><th>Cuenta</th><th>Centro</th><th>Partida</th><th>Producto</th>${bu?"<th>Bien de uso</th>":""}<th>Glosa</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead><tbody>${lineas.map((l,i)=>`<tr class="${l.lado==="H"?"h":""}"><td>${esc(l.cuenta)}<br><span>${esc(ctaNombre(l.cuenta))}</span>${edit?`<br><button class="lnk" data-a="rdAjLin" data-i="${i}" style="margin-top:4px">✎ Cambiar</button>`:""}</td><td>${esc(centroNombre(l.centro))}<br><span>${esc(l.centro)}</span></td><td>${esc(l.part)}<br><span>${esc(partNombre(l.part))}</span></td><td>${l.prod?`${esc(l.prod)}<br><span>${esc(prodNombre(l.prod))}</span>`:""}</td>${bu?`<td>${l.bu?`${esc(l.bu)}<br><span>${esc(buNombre(l.bu))}</span>`:""}</td>`:""}<td>${esc(l.glosa)}${l.ter?`<br><span>Tercero ${esc(l.ter)}</span>`:l.terPend?`<br><span>Tercero ${esc(l.terPend)} (por crear en Finnegans)</span>`:""}</td><td class="n">${l.lado==="D"?fmtN(l.monto,0):""}</td><td class="n">${l.lado==="H"?fmtN(l.monto,0):""}</td></tr>`).join("")}</tbody></table></div>
  <div class="asc">${lineas.map((l,i)=>{const H=l.lado==="H",fila=(t,a,b)=>a?`<div><dt>${t}</dt><dd>${esc(a)}${b?`<small>${esc(b)}</small>`:""}</dd></div>`:"";
    return `<div class="ascl${H?" h":""}"><div class="asct"><span class="ascc"><b>${esc(ctaNombre(l.cuenta)||l.cuenta)}</b><small>${esc(l.cuenta)}</small></span><span class="ascm"><small>${H?"Haber":"Debe"}</small><b>${fmtP(l.monto)}</b></span></div>
    <dl>${fila("Centro",centroNombre(l.centro),l.centro)}${fila("Partida",partNombre(l.part)||l.part,l.part)}${l.prod?fila("Producto",prodNombre(l.prod)||l.prod,l.prod):""}${l.bu?fila("Bien de uso",buNombre(l.bu)||l.bu,l.bu):""}${l.ter?fila("Tercero",(orgPorRut(l.ter)||[])[1]||l.ter,"RUT "+l.ter):l.terPend?fila("Tercero","Por crear en Finnegans","RUT "+l.terPend):""}</dl>
    ${l.glosa?`<p class="ascg">${esc(l.glosa)}</p>`:""}${edit?`<button class="btn" data-a="rdAjLin" data-i="${i}" style="width:100%;margin-top:8px">✎ Cambiar esta línea</button>`:""}</div>`}).join("")}</div>`}
function renderRDV(){
  const r=rdv,D=docsDe(r),edit=editaPersona(r),jef=puedeJefatura(r),con=puedeContab(r),ctz=puedeContabilizar(r);
  const inc=D.filter(d=>!docCompleto(r,d)).length,obs=D.filter(d=>d.estadoRev==="obs").length,adv=D.reduce((n,d)=>n+docAdvertencias(r,d).length,0);
  const c=colabDe(r),jefE=r.jefatura||(c?jefaturaDe(c):null);
  const verAsi=esContab()&&r.estado!=="borrador"&&!esPropia(r)||con||ctz;const A=verAsi&&D.length?rdAsiento(r):null;
  let acciones="";
  if(edit)acciones=`<div class="btns">${ESCRITORIO()?`<label class="btn pri" style="flex:1;text-align:center"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span> Agregar documentos<input class="vh" type="file" accept="image/*,application/pdf,.pdf" multiple data-rdfoto="1"></label>`:`<label class="btn pri rdcam" style="text-align:center"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span> Agregar documento<input class="vh" type="file" accept="image/*" capture="environment" data-rdfoto="1"></label><label class="btn" style="text-align:center"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span> Galería<input class="vh" type="file" accept="image/*" multiple data-rdfoto="1"></label><label class="btn" style="text-align:center"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 13h5M9.5 16.5h5"/></svg></span> PDF<input class="vh" type="file" accept="application/pdf,.pdf" multiple data-rdfoto="1"></label>`}</div>
      ${disTip("rdsolo",`Solo sirven <b>facturas y boletas</b>, en foto o en PDF.${ESCRITORIO()?" También puedes arrastrar las fotos o los PDF a esta página.":""}`,"rdsolo")}
      ${D.length?`${inc?`<p class="note">Faltan datos obligatorios en ${inc} ${inc===1?"documento":"documentos"} (foto, total, tipo de documento, centro de costo, tipo de gasto o RUT de la factura). <button class="lnk" data-a="rdDoc" data-k="${esc(D.find(d=>!docCompleto(r,d)).k)}">Ir ${inc===1?"al documento":"al primero"}</button></p>`:adv?`<p class="note">${adv} ${adv===1?"dato queda en blanco":"datos quedan en blanco"}; se puede enviar igual y quien revisa los completa.</p>`:""}`:""}`;
  else if(jef)acciones=`<p class="note">${sinJefatura(r)?"Quien rinde no tiene jefatura asignada: apruebas este paso como Contabilidad. ":""}Toca cada documento para marcarlo revisado u observarlo. Para devolver, al menos uno debe tener observación.</p>`;
  else if(con)acciones=`${A&&A.bloq?`<p class="note">Corrige lo que está en «Por corregir» (toca el documento) para poder aprobar.</p>`:""}`;
  else if(ctz)acciones=`<div class="btns"><button class="btn" data-a="rdImpUna">Excel para FinnegansGO</button><button class="btn pri" data-a="rdContabilizar" style="flex:1">Marcar contabilizada</button></div><div class="btns"><button class="btn" data-a="rdReabrir">Volver a revisión contable</button></div>`;
  else if(esContab()&&r.estado==="contabilizada")acciones=`<div class="btns"><button class="btn" data-a="rdImpUna">Excel para FinnegansGO</button></div>`;
  const resR=accRes(fmtP(totalRend(r)),`${D.length} ${D.length===1?"documento":"documentos"}${inc&&edit?` · <em>faltan datos en ${inc}</em>`:obs&&(jef||con)?` · ${obs} con observación`:""}`);
  const barra=edit&&D.length?accBar("rdbar",resR,`<button class="btn pri" data-a="rdEnviar" ${inc?"disabled":""}>${r.estado==="observada"?"Reenviar":"Enviar a aprobación"}</button>`)
    :jef?accBar("rdbar",resR,`<button class="btn" data-a="rdDevolver" ${obs?"":"disabled"}>Devolver${obs?` (${obs})`:""}</button><button class="btn pri" data-a="rdAprobarJef">Aprobar</button>`)
    :con?accBar("rdbar",resR,`<button class="btn" data-a="rdDevolver" ${obs?"":"disabled"}>Devolver${obs?` (${obs})`:""}</button><button class="btn pri" data-a="rdAprobarCont" ${A&&A.bloq?"disabled":""}>Aprobar imputación</button>`):"";
  const perSel=con?`<select id="rdPer" data-rdr="persona"><option value="">${esc(r.persona&&r.persona.nombre||"Elegir…")}${r.persona&&r.persona.rut?"":" (sin RUT)"}</option>${colabs().slice().sort((a,b)=>cmpEs(a.nombre,b.nombre)).map(x=>`<option value="${esc(x.rut)}" ${r.persona&&normRut(r.persona.rut)===normRut(x.rut)?"selected":""}>${esc(x.nombre)} · ${esc(x.rut)}</option>`).join("")}</select>`:"";
  const asi=A?`<h2>Asiento contable</h2>
    <div class="lx-sync sks ${A.bloq?"no":"ok"}"><div class="lx-syncl"><span class="lx-synct">${A.debe===A.haber?`DEBE = HABER = ${fmtP(A.debe)}${A.bloq?"":" ✓"}`:`Descuadre: debe ${fmtP(A.debe)} · haber ${fmtP(A.haber)}`}</span><span class="lx-syncs">Fecha ${esc(A.fecha)} · ${esc(A.desc)}</span></div></div>
    ${con?`<div class="skf dupla"><div class="f"><label for="rdFA">Fecha del asiento</label><input id="rdFA" type="date" data-rdr="fechaAsiento" value="${esc(A.fechaISO)}"></div><div class="f"><label for="rdPer">Persona que rinde</label>${perSel}</div></div>`:""}
    ${rdAlertasHTML(A.al,r)}${(con||ctz)&&alertaOrgs(A.al)?`<div class="btns"><button class="btn" data-a="rdOrgsFinn" ${ORGS_TRAYENDO?"disabled":""}>${ORGS_TRAYENDO?"Consultando Finnegans…":"Buscar proveedores nuevos en Finnegans"}</button></div>`:""}${rdTablaAsiento(A.lineas,con)}${con?`<p class="note">Si una línea quedó mal imputada, toca <b>✎ Cambiar</b>: el cambio se aplica a todos los documentos de esa línea y queda registrado en el historial.</p>`:""}`:"";
  return `<div class="top"><div class="in"><div class="bar" style="padding-bottom:10px"><button class="back" data-a="rd">Rendiciones</button><div class="ttl">${esc(rdTitulo(r))}</div>${estadoChip()}</div></div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>${esc(rdTitulo(r))}</h1>
    <div class="lx-sync sks ${r.estado==="aprobada"||r.estado==="contabilizada"?"ok":r.estado==="observada"?"no":r.estado==="borrador"?"":"camb"}"><div class="lx-syncl"><span class="lx-synct">${RD_ESTADO[r.estado]||r.estado} · ${fmtP(totalRend(r))}</span><span class="lx-syncs">${esc(r.persona?r.persona.nombre:"")}${r.persona&&r.persona.rut?` · ${esc(r.persona.rut)}`:""} · ${D.length} ${D.length===1?"documento":"documentos"}</span></div></div>
    ${rdPasosHTML(r)}
    ${r.comentario?`<div class="info netbox"><b>Comentario de ${r.devueltaEn==="revcont"?"Contabilidad":"revisión"}:</b> ${esc(r.comentario)}</div>`:""}
    ${acciones}
    <h2>Documentos<span class="cnt">${D.length}</span></h2>
    <div class="list">${D.map(d=>rdDocCard(r,d)).join("")||`<div class="empty">Todavía no hay documentos. Toca <b>Agregar documento</b> y saca la foto de la factura o boleta.</div>`}</div>
    ${asi}
    <div class="btns">${r.estado!=="borrador"||esContab()?`<button class="btn" data-a="rdPdf" data-id="${r.id}" ${D.length?"":"disabled"}>Resumen PDF</button>`:""}<button class="btn" data-a="rdXlsx" data-id="${r.id}" ${D.length?"":"disabled"}>Excel de documentos</button></div>
    <p class="note">En OneDrive: <b>Rendiciones / ${esc(r.periodo)} / ${esc(r.persona?r.persona.nombre:"")}</b> con las fotos y el resumen.</p>
  </main>${barra}`;
}
function bienesOpts(centro,sel){
  const kw=(CENTROS_DEF.find(x=>x[0]===centro)||[])[2]||"";const re=kw?new RegExp(kw):null;
  const L=maeTiene("bienes")?Object.entries(MAE.bienes).filter(([c])=>c!=="OTROS").sort((a,b)=>cmpEs(a[1],b[1])):[];
  const del=re?L.filter(([c,n])=>re.test(normTxt(n))):[],resto=L.filter(x=>!del.includes(x));
  const o=([c,n])=>`<option value="${esc(c)}" ${c===sel?"selected":""}>${esc(n)} (${esc(c)})</option>`;
  const extra=sel&&sel!=="OTROS"&&!L.some(([c])=>c===sel)?`<option value="${esc(sel)}" selected>${esc(sel)}</option>`:"";
  return `<option value="OTROS" ${!sel||sel==="OTROS"?"selected":""}>OTROS (sin bien específico)</option>${extra}${del.length?`<optgroup label="${esc(centroNombre(centro))}">${del.map(o).join("")}</optgroup>`:""}${resto.length?`<optgroup label="${del.length?"Otros predios":"Bienes de uso"}">${resto.map(o).join("")}</optgroup>`:""}`;
}
function renderRDD(){
  const r=rdv,d=rdd,editP=editaPersona(r),editC=puedeContab(r),ro=!(editP||editC),jef=puedeJefatura(r),P=problemasDoc2(r,d),probs=P.b,le=d.lectura||{};
  const cat=gastoDe(d),centro=centroDoc(r,d),im=imputar(r,d),base=imputar(r,d,true);
  const dis=ro?"disabled":"";
  const conf=disModoConf(r,d,editP,P);
  const sugC=editP&&d.centroSug&&centro,sugG=editP&&(d.gastoIA||d.gastoHist)&&cat;
  const pideBU=(cat&&cat.bu)||/^4106/.test(im.cuenta),servs=distServicios(),pideDist=cat&&cat.dist&&(servs.length||d.dist);
  const verC=esContab()&&(r.estado==="revcont"||r.estado==="aprobada"||r.estado==="contabilizada"||(r.estado==="enviada"&&sinJefatura(r)))&&!esPropia(r);
  let contHTML="";
  if(verC){const A=rdAsiento(r);const mias=A.lineas.filter(l=>l.lado==="D"&&l.docs.includes(d.k));const al=A.al.filter(a=>a.k===d.k);const aj=d.aj||{};
    const nm=(v,f)=>v?`<span class="hint">${esc(f(v)||"no está en el maestro")}</span>`:"";
    contHTML=`<h2>Imputación contable</h2>${mias.length?rdTablaAsiento(mias):`<div class="empty">Este documento todavía no genera línea en el asiento.</div>`}${mias.some(l=>l.docs.length>1)?`<p class="note">Este documento va consolidado con otros del mismo tipo, centro y partida.</p>`:""}${al.length?rdAlertasHTML(al,{docs:{}}):""}${editC&&alertaOrgs(al)?`<div class="btns"><button class="btn" data-a="rdOrgsFinn" ${ORGS_TRAYENDO?"disabled":""}>${ORGS_TRAYENDO?"Consultando Finnegans…":"Buscar proveedores nuevos en Finnegans"}</button></div>`:""}
      ${editC?`<h2>Ajuste contable</h2><p class="note">Si no eliges nada, se usa lo que indica el tipo de gasto (${esc([base.cuenta,base.prod,base.part].filter(Boolean).join(" · ")||"sin imputación")}). Busca por nombre: lo que elijas reemplaza la imputación de este documento y la app guarda el código.</p>
      <div class="skf dupla">${[["cuenta",base.cuenta],["producto",base.prod],["partida",base.part],["tercero",base.ter]].map(([f,b])=>`<div class="f"><label>${esc(AJ_TIT[f])}</label>${ajBtn(f,aj[f]||"",`data-a="rdPickAj" data-f="${f}"`,b?`Según el tipo de gasto: ${nomAj(f,b)||b}`:"Según el tipo de gasto")}</div>`).join("")}</div>`:""}
      ${d.orig&&Object.keys(d.orig).length?`<p class="note">Cambiado por Contabilidad: ${Object.entries(d.orig).map(([k,v])=>`${esc(k)} (antes: ${esc(String(v||"vacío"))})`).join(" · ")}</p>`:""}`}
  return `<div class="top rddtop"><div class="in"><div class="bar" style="padding-bottom:10px"><button class="back" data-a="rdVolver">${esc(rdTitulo(r))}</button><div class="ttl">Documento</div>${estadoChip()}</div></div></div>
  <main class="wrap rddw${conf?" conf":""}">
    ${rdNavHTML(r,d)}
    <div class="rdfoto" id="rdFotoBox">${d.foto?(fotoSrc(d.foto)?`<img src="${esc(fotoSrc(d.foto))}" alt="Documento" data-a="foto" data-ref="${esc(d.foto)}" data-k="${esc(d.k)}">`:`<div class="empty">La foto se está cargando…</div>`):`<div class="empty">Sin foto</div>`}
      ${rdPdfInfo(d)}${editP?`<div class="btns" style="margin-top:8px">${ESCRITORIO()?`<label class="btn"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span> ${d.foto?"Cambiar documento":"Subir documento"}<input class="vh" type="file" accept="image/*,application/pdf,.pdf" data-rdrefoto="1"></label>`:`<label class="btn"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span> ${d.foto?"Tomar otra foto":"Tomar foto"}<input class="vh" type="file" accept="image/*" capture="environment" data-rdrefoto="1"></label><label class="btn"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span> Galería<input class="vh" type="file" accept="image/*" data-rdrefoto="1"></label><label class="btn"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 13h5M9.5 16.5h5"/></svg></span> PDF<input class="vh" type="file" accept="application/pdf,.pdf" data-rdrefoto="1"></label>`}${d.foto&&navigator.onLine!==false?`<button class="btn" data-a="rdReleer" ${le.estado==="leyendo"?"disabled":""}>${le.estado==="leyendo"?"Leyendo…":"Volver a leer"}</button>`:""}</div>`:""}</div>
    ${conf?disConfHTML(r,d,P,conf):""}<div class="rdform"${conf?" hidden":""}>
    ${le.estado==="leyendo"?`<div class="info">Leyendo el documento…</div>`:le.estado==="pendiente"?`<div class="info netbox">Sin señal: el documento se leerá automáticamente cuando vuelva la conexión. Mientras tanto puedes escribir los datos a mano.</div>`:le.estado==="error"?`<div class="info netbox"><b>La lectura automática no funcionó.</b> ${esc(le.msg||"")} Completa los datos a mano.</div>`:le.estado==="ok"&&editP?`<div class="info" style="border-left:5px solid ${le.confianza>=0.6?"var(--b-ink)":"var(--r-ink)"}"><b>Leída automáticamente</b>${le.confianza!=null?` · confianza ${Math.round(le.confianza*100)}%`:""}. ${le.problemas&&le.problemas.length?`La IA advierte: ${esc(le.problemas.join("; "))}. `:""}Revisa que los datos coincidan con el documento.</div>`:""}
    ${probs.length&&!ro?`<div class="info netbox"><b>Para enviar falta:</b> <span class="hint">(toca cada aviso para ir al dato)</span><ul>${probs.map(liCampo).join("")}</ul></div>`:""}
    ${P.a.length&&!ro?`<div class="info" style="border-left:5px solid var(--r-ink)"><b>Datos en blanco o por revisar</b> (no impiden enviar; quien revisa puede completarlos):<ul>${P.a.map(liCampo).join("")}</ul></div>`:!probs.length&&editP?`<div class="info" style="border-left:5px solid var(--b-ink)">Documento completo.${(d.centroSug||d.gastoIA)?" El centro de costo y el tipo de gasto marcados como «Sugerido» los propuso la app: revisa que correspondan.":""}</div>`:""}
    <div class="enc">
      ${disTipoHTML(d,dis)}
      <div class="f"><label for="rdEm">Emisor (comercio o proveedor)</label><input id="rdEm" data-rdf="emisor" value="${esc(d.emisor||"")}" ${dis}></div>
      <div class="f"><label for="rdRut">RUT del emisor${(d.tipo==="factura"||d.tipo==="boleta_honorarios")?" *":""}</label><input id="rdRut" data-rdf="rut" value="${esc(d.rut||"")}" autocapitalize="characters" autocomplete="off" placeholder="76.123.456-7" ${dis}>${(()=>{if(!d.rut&&!d.emisor)return"";const o=d.rut&&rutValido(d.rut)?orgPorRut(d.rut):null,inv=d.rut&&!rutValido(d.rut)&&String(d.rut).replace(/[^0-9kK]/g,"").length>=8,porNom=!o?orgPorNombre(d.emisor):null;let h="";
        if(o&&esContab())h+=`<span class="hint">${esc(o[1])}</span>`;
        if(inv)h+=`<span class="hint" style="color:var(--m-ink)">El dígito verificador no calza: con esos números sería -${esc(rutDV(d.rut))}.</span>`;
        if(porNom&&normRut(porNom[0])!==normRut(d.rut))h+=`<span class="hint">En Finnegans, «${esc(porNom[1])}» tiene RUT ${esc(rutLimpio(porNom[0]))}.</span>`;
        if(!dis&&(inv||(porNom&&normRut(porNom[0])!==normRut(d.rut)))){h+=`<span class="btns" style="margin-top:4px">${porNom&&normRut(porNom[0])!==normRut(d.rut)?`<button type="button" class="btn" data-a="rdUsarRut" data-v="${esc(rutLimpio(porNom[0]))}">Usar el RUT de Finnegans</button>`:""}${inv&&!(porNom&&normRut(porNom[0])===normRut(rutConDV(d.rut)))?`<button type="button" class="btn" data-a="rdUsarRut" data-v="${esc(rutConDV(d.rut))}">Usar ${esc(rutConDV(d.rut))}</button>`:""}</span>`}
        else if(!o&&d.rut&&rutValido(d.rut)&&esContab()&&maeTiene("orgs"))h+=`<span class="hint">No está en organizaciones de Finnegans.</span>`;
        return h})()}</div>
      <div class="f"><label for="rdFol">N° de boleta / factura</label><input id="rdFol" data-rdf="folio" value="${esc(d.folio||"")}" inputmode="numeric" ${dis}></div>
      <div class="f"><label for="rdFe">Fecha</label><input id="rdFe" type="date" data-rdf="fecha" value="${esc(d.fecha||"")}" ${dis}></div>
      <div class="f"><label for="rdTot">Total ($)</label><input id="rdTot" data-rdf="total" inputmode="numeric" value="${d.total?esc(fmtN(num(d.total),0)):""}" ${dis}></div>
      ${d.tipo==="factura"||num(d.neto)||num(d.iva)?`<div class="f"><label for="rdNe">Neto ($)</label><input id="rdNe" data-rdf="neto" inputmode="numeric" value="${d.neto?esc(fmtN(num(d.neto),0)):""}" ${dis}></div>
      <div class="f"><label for="rdIva">IVA ($)</label><input id="rdIva" data-rdf="iva" inputmode="numeric" value="${d.iva?esc(fmtN(num(d.iva),0)):""}" ${dis}></div>`:""}
      <div class="f"><label>Centro de costo${sugC?` <span class="xp camb">Sugerido</span>`:""}</label><button type="button" class="pkbtn" id="rdCe" data-a="rdPick" data-f="centro" ${dis}>${centro?`<span>${esc(centroNombre(centro))}</span><small>${esc(centro)}</small>`:`<span class="ph">Elegir centro de costo…</span>`}</button>${sugC?`<span class="hint">Es tu centro habitual. Cámbialo si este gasto es de otro predio.</span>`:""}</div>
      <div class="f"><label>Tipo de gasto${sugG?` <span class="xp camb">Sugerido</span>`:""}</label><button type="button" class="pkbtn" id="rdGa" data-a="rdPick" data-f="gasto" ${dis}>${cat?`<span>${esc(cat.n)}</span><small>${esc(cat.g||"")}</small>`:`<span class="ph">Elegir tipo de gasto…</span>`}</button>${sugG?`<span class="hint">${d.gastoHist?"Es el que se usó antes con este comercio. Cámbialo si esta vez es otro gasto.":"Lo sugirió la IA según lo que dice el documento. Revisa que corresponda."}</span>`:""}</div>
      ${pideBU?`<div class="f"><label for="rdBu">Bien de uso (máquina o instalación)</label><select id="rdBu" data-rdf="bu" ${dis}>${bienesOpts(centro,d.bu||"")}</select></div>`:""}
      ${pideDist?`<div class="f"><label for="rdDi">Gasto compartido entre predios</label><select id="rdDi" data-rdf="dist" ${dis}><option value="">No: va al centro elegido</option>${servs.concat(d.dist&&!servs.includes(d.dist)?[d.dist]:[]).map(s=>`<option value="${esc(s)}" ${d.dist===s?"selected":""}>Repartir según la tabla de ${esc(s)}</option>`).join("")}</select></div>`:""}
      <div class="f"><label for="rdGl">Detalle del gasto${editP&&d.glosaTimbre&&d.glosa?` <span class="xp camb">Sugerido</span>`:""}</label><input id="rdGl" data-rdf="glosa" value="${esc(d.glosa||"")}" placeholder="${esc((cat&&cat.ph)||"Qué se compró y para qué")}" maxlength="120" ${dis}></div>
    </div></div>
    ${(jef||editC)?`<h2>Revisión</h2><div class="seg" style="grid-template-columns:1fr 1fr"><button data-a="rdRev" data-v="ok" aria-pressed="${d.estadoRev==="ok"}">Revisado</button><button data-a="rdRev" data-v="obs" aria-pressed="${d.estadoRev==="obs"}">Observar</button></div>${d.estadoRev==="obs"?`<input class="obs" data-rdf="obsRev" value="${esc(d.obsRev||"")}" placeholder="Qué debe corregir la persona">`:""}`:d.obsRev?`<div class="info netbox"><b>Observación de revisión:</b> ${esc(d.obsRev)}</div>`:""}
    ${contHTML}
    ${editP?`<div class="btns" style="margin-top:14px"><button class="btn" data-a="rdDelDoc" data-k="${esc(d.k)}" style="border-color:var(--m-ink);color:var(--m-ink)">Eliminar este documento</button></div>`:""}
  </main>${rdPieDoc(r,d)}`;
}
/* ---------- Selector con buscador para centro de costo y tipo de gasto ---------- */
/* palabras con que la gente busca cada tipo de gasto */
const KW_GASTO={peajes:"peaje autopista tag barcaza transbordador ruta",colacion:"almuerzo comida restaurante cena desayuno once",estacionamiento:"estacionamiento parking",kilometraje:"km kilometros auto propio",pasajes:"pasaje bus avion vuelo micro",alojamiento:"hotel hostal cabana hospedaje",
  combustible:"bencina petroleo diesel adblue blue max gasolina copec shell",mant_tractor:"tractor repuesto taller filtro",mant_moto:"moto",mant_vehiculo:"camioneta auto vehiculo neumatico taller mecanico revision tecnica",mant_maquina:"maquina carro mixer desenvolvedor coloso repuesto",
  mant_infra:"casa sala porton puerta techo pintura cerrajeria llave vidrio",mant_agua:"agua caneria estanque bomba manguera riego",ferreteria:"ferreteria herramienta tornillo clavo cable",sala:"sala ordena aserrin gomas pezoneras",gas_op:"gas ternerera sala",gas_casa:"gas balon casa",
  celebracion:"celebracion cumpleanos fiestas patrias convivencia regalo flores",ropa:"ropa botas epp guantes uniforme aseo",capacitacion:"curso capacitacion examen certificacion",cafeteria:"cafe te azucar galletas vasos",papeleria:"papel resma carpeta tinta archivador",oficina:"oficina enchufe linterna pilas alargador",
  comunicaciones:"internet tv telefono celular starlink entel movistar",electricidad:"luz electricidad saesa",software:"software licencia suscripcion chatgpt claude microsoft",canva:"canva diseno",notaria:"notaria notario legal",tramites:"tgr permiso circulacion multa tramite",estudios:"estudio universidad cuota"};
function opcionesPick(f){
  if(f==="centro")return centrosSel().map(x=>{const d=CENTROS_DEF.find(y=>y[0]===x.c);return{v:x.c,t:x.n,s:x.c,g:x.c===CENTRO_ADM?"Administración":"Campos",q:normTxt([x.n,x.c,d?d[2].replace(/\|/g," "):""].join(" "))}});
  const cat=gastoDe(rdd);
  return catalogo().filter(t=>t.activo!==false&&(!t.c||esContab()||(cat&&cat.id===t.id))).map(t=>({v:t.id,t:t.n,s:t.g||"",g:t.g||"Otros",q:normTxt([t.n,t.g,t.kw||KW_GASTO[t.id]||""].join(" "))}));
}
/* sugeridos: el centro habitual de la persona, lo que propuso la IA y lo que más ha usado antes */
function sugeridosPick(f){
  const r=rdv,d=rdd,out=[];const add=(v,why)=>{if(v&&!out.some(x=>x.v===v))out.push({v,why})};
  if(f==="centro"){const c=colabDe(r);if(c&&c.centro)add(c.centro,"Tu centro habitual")}
  else if(d.gasto&&d.gastoIA)add(d.gasto,"Sugerido por la IA según el documento");
  const misma=x=>x.persona&&r.persona&&(x.persona.id===r.persona.id||(!!x.persona.rut&&normRut(x.persona.rut)===normRut(r.persona.rut)));
  const cnt={};Object.values(REND).filter(x=>!x.anulada&&misma(x)).forEach(x=>Object.values(x.docs||{}).forEach(y=>{if(y===d)return;const v=f==="centro"?centroDoc(x,y):(gastoDe(y)||{}).id;if(v)cnt[v]=(cnt[v]||0)+1}));
  Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([v,n])=>add(v,`Usado antes (${n} ${n===1?"vez":"veces"})`));
  return out;
}
function rdPick(f){
  const ops=opcionesPick(f),sug=sugeridosPick(f).filter(x=>ops.some(o=>o.v===x.v)),actual=f==="centro"?centroDoc(rdv,rdd):(gastoDe(rdd)||{}).id,tit=f==="centro"?"Centro de costo":"Tipo de gasto";
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet pksheet" role="dialog" aria-modal="true" aria-label="${tit}"><h3>${tit}</h3><input class="pksearch" type="search" placeholder="${f==="centro"?"Buscar predio o código":"Buscar: bencina, almuerzo, repuesto…"}" autocomplete="off" aria-label="Buscar"><div class="pklist"></div><div class="btns"><button class="btn" data-m="no">Cerrar</button></div></div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";
  const lista=m.querySelector(".pklist"),inp=m.querySelector(".pksearch");
  const item=(o,why)=>`<button class="pkit${o.v===actual?" on":""}" data-v="${esc(o.v)}"><span class="pkt">${esc(o.t)}${o.v===actual?" ✓":""}</span><span class="pks">${esc(why||o.s)}</span></button>`;
  const pintar=()=>{const q=normTxt(inp.value);let h="";
    if(!q){if(sug.length)h+=`<div class="pkg">Sugeridos</div>`+sug.map(x=>item(ops.find(o=>o.v===x.v),x.why)).join("");
      [...new Set(ops.map(o=>o.g))].forEach(g=>{h+=`<div class="pkg">${esc(g)}</div>`+ops.filter(o=>o.g===g).map(o=>item(o)).join("")})}
    else{const ws=q.split(" ").filter(Boolean);h=ops.filter(o=>ws.every(w=>o.q.includes(w))).map(o=>item(o)).join("")||`<div class="empty">Sin resultados. Prueba con otra palabra${f==="gasto"?" o elige «Otro»":""}.</div>`}
    lista.innerHTML=h};
  pintar();inp.addEventListener("input",pintar);
  const cerrar=()=>{m.remove();document.body.style.overflow=""};
  m.addEventListener("click",e=>{e.stopPropagation();const b=e.target.closest(".pkit");if(b){cerrar();rdSetCampo(f,b.dataset.v);return}if((e.target.dataset&&e.target.dataset.m==="no")||e.target===m)cerrar()});
  if(!matchMedia("(pointer:coarse)").matches)setTimeout(()=>inp.focus(),30);
}
function rdSetCampo(f,v){
  if(!rdv||!rdd||rdRO(rdv))return;const contab=puedeContab(rdv);const antes=f==="centro"?centroDoc(rdv,rdd):rdd[f];
  rdd[f]=v;if(f==="centro"){delete rdd.predio;delete rdd.centroSug}
  if(f==="gasto"){delete rdd.gastoIA;delete rdd.gastoHist;const c=gastoDe(rdd);if(!c||!c.dist)delete rdd.dist;if((rdd.tipo==="vale"||rdd.tipo==="otro")&&esGastoPeaje(rdd))rdd.tipo="peaje"}
  if(contab&&String(antes||"")!==String(v||"")){rdd.orig=rdd.orig||{};if(!(f in rdd.orig))rdd.orig[f]=antes||""}
  rdd.revisadoManual=true;rdTouch();render();
}
/* cada aviso del documento lleva al campo que hay que completar */
function campoDeMsg(m){const t=String(m).toLowerCase();
  if(/tipo de documento/.test(t))return"rdTd";
  if(/duplicado/.test(t))return"rdFol";if(/\brut\b/.test(t))return"rdRut";
  if(/foto|lectura|leído|leer/.test(t))return"rdFotoBox";if(/neto/.test(t))return"rdNe";if(/total/.test(t))return"rdTot";if(/fecha/.test(t))return"rdFe";if(/centro de costo/.test(t))return"rdCe";if(/tipo de gasto/.test(t))return"rdGa";
  if(/duplicado|número de boleta/.test(t))return"rdFol";if(/emisor/.test(t))return"rdEm";if(/detalle/.test(t))return"rdGl";return""}
const liCampo=p=>{const c=campoDeMsg(p);return `<li>${c?`<span role="button" tabindex="0" class="lnkcampo" data-a="rdIrCampo" data-c="${c}">${esc(p)}</span>`:esc(p)}</li>`};
function rdIrCampo(c){const el=document.getElementById(c);if(!el)return;el.scrollIntoView({behavior:"smooth",block:"center"});
  const caja=el.closest(".f")||el;caja.classList.remove("flash");void caja.offsetWidth;caja.classList.add("flash");setTimeout(()=>caja.classList.remove("flash"),1800);
  setTimeout(()=>{if(el.disabled)return;if(el.dataset&&el.dataset.a==="rdPick")rdPick(el.dataset.f);else if(/INPUT|SELECT|TEXTAREA/.test(el.tagName))el.focus({preventScroll:true})},450)}
function rdRefreshDoc(k){if(view!=="rdv"||!rdv)return;const d=rdv.docs[k];const el=document.querySelector(`.rdd[data-k="${CSS.escape(k)}"]`);if(el&&d)el.outerHTML=rdDocCard(rdv,d)}

/* ---------- Maestros contables: pantalla, lectura de los Excel y plantillas ---------- */
const MAE_TIPOS=[["colab","Colaboradores y aprobadores","Colaboradores_y_Aprobaciones.xlsx: hojas Colaboradores, Aprobadores y Distribuciones."],["cuentas","Plan de cuentas","Manual_de_Cuenta.xlsx"],["productos","Productos","Productos.xlsx (exportado de Finnegans)"],["centros","Centros de costo","Importacion_de_BSCentroCosto.xlsx"],["bienes","Bienes de uso","Importacion_de_BSBienDeUso.xlsx"],["orgs","Organizaciones (proveedores y personas)","Se traen directo de Finnegans con el botón de arriba (o desde Importacion_de_BSOrganizacion.xlsx)."],["partidas","Partidas financieras","Dimensiones.xlsx"],["tipos","Catálogo de tipos de gasto (opcional)","Catalogo_Tipos_de_Gasto.xlsx; si no se carga, se usa el catálogo de la app."]];
function rdMaeRevision(){
  const o=[];if(!MAE)return o;
  catalogo().filter(t=>t.activo!==false).forEach(t=>{[t.cp,t.ca].filter(Boolean).forEach(c=>{if(maeTiene("cuentas")&&!MAE.cuentas[c])o.push(`Tipo «${t.n}»: la cuenta ${c} no está en el plan de cuentas.`)});[t.pp,t.pa].filter(Boolean).forEach(p=>{if(maeTiene("productos")&&!MAE.productos[p])o.push(`Tipo «${t.n}»: el producto ${p} no está activo en Productos.`)});[t.parp,t.para].filter(Boolean).forEach(p=>{if(maeTiene("partidas")&&!MAE.partidas[p])o.push(`Tipo «${t.n}»: la partida ${p} no está en Dimensiones.`)})});
  colabs().forEach(c=>{if(!c.rut)o.push(`${c.nombre}: falta el RUT.`);else if(maeTiene("orgs")&&!orgPorRut(c.rut))o.push(`${c.nombre}: su RUT ${c.rut} no está en organizaciones de Finnegans.`);
    if(!correosDe(c).length)o.push(`${c.nombre}: sin correo para entrar a la app.`);const j=jefaturaDe(c);if(!j)o.push(`${c.nombre}: sin jefatura que aprueba (lo aprueba Contabilidad).`);else if(!j.correo)o.push(`${c.nombre}: la jefatura «${j.nombre}» no tiene correo (agrégala en la hoja Aprobadores).`);
    if(c.centro&&!centroExiste(c.centro))o.push(`${c.nombre}: el centro ${c.centro} no existe.`)});
  if(maeTiene("centros"))CENTROS_DEF.forEach(([c,n])=>{if(!MAE.centros[c])o.push(`El centro ${c} (${n}) no viene en el maestro de centros exportado de Finnegans.`)});
  Object.entries(MAE.dist||{}).forEach(([s,rows])=>rows.forEach(x=>{if(!centroExiste(x.centro))o.push(`Distribución ${s}: el centro ${x.centro} no existe.`)}));
  return [...new Set(o)];
}
function renderRDM(){
  const ar=(MAE&&MAE.archivos)||{},rev=rdMaeRevision();
  return `<div class="top"><div class="in"><div class="bar" style="padding-bottom:10px"><button class="back" data-a="rd">Rendiciones</button><div class="ttl">Maestros contables</div>${estadoChip()}</div></div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div><h1>Maestros contables</h1>
    <p class="note" style="margin-top:4px">Con estos archivos la app valida cuentas, productos, partidas, centros, bienes de uso y proveedores, y sabe quién aprueba cada rendición. Se guardan en OneDrive: <b>Rendiciones / _maestros</b>.</p>
    ${esContab()?`<div class="btns"><button class="btn" data-a="rdOrgsFinn" ${ORGS_TRAYENDO?"disabled":""} style="flex:1">${ORGS_TRAYENDO?"Consultando Finnegans…":"Traer organizaciones desde Finnegans"}</button></div><p class="note">Las organizaciones (proveedores y personas) se traen directo de Finnegans; se actualizan solas cada 12 horas cuando Contabilidad abre Rendiciones.</p>`:""}
    ${esContab()?`<div class="btns"><label class="btn pri" style="flex:1;text-align:center">Cargar archivos Excel<input class="vh" type="file" multiple accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-rdmae="1"></label></div><p class="note">Puedes elegir varios a la vez. Cada archivo reemplaza solo su propio maestro.</p>`:""}
    ${MAE_TIPOS.map(([k,t,h])=>{const a=ar[k];return `<div class="rdmf${a?" ok":""}"><b>${esc(t)}</b><span>${a?`${fmtN(a.filas,0)} registros · ${esc(a.nombre)} · ${fmtD(String(a.hora||"").slice(0,10))}${a.por?` · ${esc(a.por)}`:""}`:k==="tipos"?"Se usa el catálogo de la app ("+CATALOGO_DEF.length+" tipos)":"No cargado"}</span><span class="hint">${esc(h)}</span></div>`}).join("")}
    <div class="btns"><button class="btn" data-a="rdMaeColab">Descargar colaboradores y aprobadores</button><button class="btn" data-a="rdMaeCat">Descargar catálogo de tipos de gasto</button></div>
    <h2>Revisión de los maestros<span class="cnt">${rev.length}</span></h2>
    ${MAE?rev.length?`<div class="info" style="border-left:5px solid var(--r-ink)"><ul>${rev.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:`<div class="info" style="border-left:5px solid var(--b-ink)">Todo cuadra: los códigos del catálogo existen y cada persona tiene RUT, correo y jefatura.</div>`:`<div class="empty">Todavía no se han cargado maestros.</div>`}
  </main>`;
}
const hojaFilas=ws=>XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}).map(r=>r.map(x=>String(x==null?"":x).trim()));
function colIdx(h,...names){const H=h.map(x=>normTxt(x));for(const n of names){const i=H.indexOf(normTxt(n));if(i>=0)return i}for(const n of names){const i=H.findIndex(x=>x.startsWith(normTxt(n)));if(i>=0)return i}return -1}
const siNo=v=>/^(SI|S|1|X|TRUE|VERDADERO)$/.test(normTxt(v));
/* Reconoce cada Excel por sus columnas y devuelve los maestros que trae */
function rdMaeParse(wb,nombre){
  const out={};
  for(const sn of wb.SheetNames){
    const F=hojaFilas(wb.Sheets[sn]);if(!F.length)continue;const h=F[0],R=F.slice(1).filter(r=>r.some(Boolean));const H=h.map(normTxt),tiene=n=>H.includes(normTxt(n)),S=normTxt(sn);
    const g=(r,i)=>i>=0?String(r[i]||"").trim():"";
    if(tiene("CODIGO CUENTA")){const ic=colIdx(h,"Codigo cuenta"),in_=colIdx(h,"Cuenta");out.cuentas={};R.forEach(r=>{const c=g(r,ic).replace(/\.0+$/,"");if(c)out.cuentas[c]=g(r,in_)});continue}
    if(tiene("CUENTAIDCOMPRA_CODIGO")){const ic=colIdx(h,"Codigo"),in_=colIdx(h,"Nombre"),ia=colIdx(h,"Activo");out.productos={};R.forEach(r=>{const c=g(r,ic);if(c&&g(r,ia)!=="0")out.productos[c]=g(r,in_)});continue}
    if(tiene("CENTROCOSTOID")){const ic=colIdx(h,"Codigo"),in_=colIdx(h,"Nombre"),ia=colIdx(h,"Activo");out.centros={};R.forEach(r=>{const c=g(r,ic);if(c&&g(r,ia)!=="0")out.centros[c]={n:g(r,in_)}});continue}
    if(tiene("NROSERIE")||(tiene("MARCA")&&tiene("MODELO"))){const ic=colIdx(h,"Codigo"),in_=colIdx(h,"Nombre"),ia=colIdx(h,"Activo");out.bienes={};R.forEach(r=>{const c=g(r,ic);if(c&&g(r,ia)!=="0")out.bienes[c]=g(r,in_)});continue}
    if(tiene("RAZONSOCIAL")&&(tiene("CUIT")||tiene("ESPROVEEDOR"))){const ic=colIdx(h,"Codigo"),in_=colIdx(h,"Nombre"),ia=colIdx(h,"Activo");out.orgs=out.orgs||{};R.forEach(r=>{const c=String(r[ic]==null?"":r[ic]);if(c.trim()&&g(r,ia)!=="0")orgsAgregar(out.orgs,c,g(r,in_))});continue}
    if(S==="COLABORADORES"||(tiene("RUT")&&tiene("NOMBRE")&&H.some(x=>x.startsWith("JEFATURA")))){
      const iR=colIdx(h,"RUT"),iN=colIdx(h,"Nombre"),iC=colIdx(h,"Centro por defecto (codigo)","Centro (codigo)","Centro"),iF=colIdx(h,"Tipo de fondo"),iCu=colIdx(h,"Cuenta fondo"),iJ=colIdx(h,"Jefatura que aprueba","Jefatura"),iM=colIdx(h,"Correo Microsoft","Correo"),iO=colIdx(h,"Observaciones"),iA=colIdx(h,"Activo");
      out.colab=R.filter(r=>g(r,iN)).map(r=>{const rut=g(r,iR);return{rut:rutValido(rut)?rut.replace(/\./g,"").toUpperCase():"",nombre:g(r,iN),centro:g(r,iC),fondo:g(r,iF),cuenta:g(r,iCu).replace(/\.0+$/,"")||"110106",jefe:g(r,iJ),correo:correosDe({correo:g(r,iM)}).join(", "),obs:g(r,iO),activo:iA<0||g(r,iA)===""||siNo(g(r,iA))}});continue}
    if(S==="APROBADORES"||(tiene("NOMBRE")&&tiene("CORREO")&&tiene("ROL"))){const iN=colIdx(h,"Nombre"),iM=colIdx(h,"Correo"),iRo=colIdx(h,"Rol");out.aprob=R.filter(r=>g(r,iN)).map(r=>({nombre:g(r,iN),correo:(correosDe({correo:g(r,iM)})[0]||""),rol:/CONTAB/.test(normTxt(g(r,iRo)))?"cont":"jef"}));continue}
    if(S==="DISTRIBUCIONES"||(tiene("SERVICIO")&&tiene("DISPOSITIVOS"))){const iS=colIdx(h,"Servicio"),iC=colIdx(h,"Centro (codigo)","Centro"),iD=colIdx(h,"Dispositivos"),iCu=colIdx(h,"Cuenta"),iP=colIdx(h,"Producto"),iPa=colIdx(h,"Partida");out.dist={};
      R.forEach(r=>{const s=g(r,iS),c=g(r,iC);if(!s||!c||normTxt(c)==="TOTAL")return;(out.dist[s]=out.dist[s]||[]).push({centro:c,disp:num(g(r,iD)),cuenta:g(r,iCu).replace(/\.0+$/,""),prod:g(r,iP).toUpperCase(),part:g(r,iPa).toUpperCase()})});continue}
    if(tiene("ID")&&tiene("TIPO DE GASTO")){const ix=n=>colIdx(h,n);const I={id:ix("ID"),n:ix("Tipo de gasto"),g:ix("Grupo"),cp:ix("Cuenta produccion"),ca:ix("Cuenta Administracion"),pp:ix("Producto produccion"),pa:ix("Producto Administracion"),parp:ix("Partida produccion"),para:ix("Partida Administracion"),bu:ix("Pide bien de uso"),dist:ix("Se puede distribuir"),c:ix("Solo Contabilidad"),fija:ix("Cuenta fija"),ter:ix("Tercero"),ph:ix("Texto de ayuda"),act:ix("Activo")};
      out.tipos=R.filter(r=>g(r,I.id)&&g(r,I.n)).map(r=>{const t={id:g(r,I.id),n:g(r,I.n),g:g(r,I.g)||"Otros",cp:g(r,I.cp).replace(/\.0+$/,""),ca:g(r,I.ca).replace(/\.0+$/,""),pp:g(r,I.pp).toUpperCase(),pa:g(r,I.pa).toUpperCase()||g(r,I.pp).toUpperCase(),parp:g(r,I.parp).toUpperCase(),para:g(r,I.para).toUpperCase()||g(r,I.parp).toUpperCase(),ph:g(r,I.ph)};
        if(siNo(g(r,I.bu)))t.bu=1;if(siNo(g(r,I.dist)))t.dist=1;if(siNo(g(r,I.c)))t.c=1;if(siNo(g(r,I.fija)))t.fija=1;const te=normTxt(g(r,I.ter));if(/OBLIG/.test(te))t.ter="si";else if(/VACIO/.test(te))t.ter="no";if(t.id==="otro")t.otro=1;if(I.act>=0&&g(r,I.act)!==""&&!siNo(g(r,I.act)))t.activo=false;return t});continue}
    if(H.length<=5&&tiene("CODIGO")&&tiene("NOMBRE")&&(/DIMENS/.test(normTxt(nombre))||R.filter(r=>/^[A-Z]{3}\d{3}$/.test(g(r,colIdx(h,"Codigo")))).length>R.length/2)){const ic=colIdx(h,"Codigo"),in_=colIdx(h,"Nombre"),ia=colIdx(h,"Activo");out.partidas={};R.forEach(r=>{const c=g(r,ic);if(c&&g(r,ia)!=="0")out.partidas[c]=g(r,in_)});continue}
  }
  return Object.keys(out).length?out:null;
}
async function rdMaeCargar(files){
  if(!esContab()){toast("Solo Contabilidad puede cargar los maestros.");return}
  if(!window.XLSX){toast("No se pudo cargar el lector de Excel.");return}
  if(!DB||navigator.onLine===false){toast("Se necesita señal para guardar los maestros en OneDrive.");return}
  toast("Leyendo los archivos…");
  const nuevo=JSON.parse(JSON.stringify(MAE||{}));delete nuevo.etag;nuevo.archivos=nuevo.archivos||{};
  const hora=new Date().toISOString(),ok=[],mal=[],sub=[];let orgs=null,orgsN=[];
  for(const f of files){
    let res=null;try{res=rdMaeParse(XLSX.read(await f.arrayBuffer(),{type:"array"}),f.name)}catch(e){console.warn(e)}
    if(!res){mal.push(f.name);continue}sub.push(f);
    Object.entries(res).forEach(([k,v])=>{
      if(k==="orgs"){orgs=orgs||{};Object.values(v).forEach(([c,nm])=>orgsAgregar(orgs,c,nm));orgsN.push(f.name);return}
      const filas=k==="dist"?Object.values(v).reduce((s,x)=>s+x.length,0):Array.isArray(v)?v.length:Object.keys(v).length;
      nuevo[k]=v;nuevo.archivos[k]={nombre:f.name,filas,hora,por:ME&&ME.nombre};ok.push(k)});
  }
  if(orgs){nuevo.orgs=orgs;nuevo.archivos.orgs={nombre:orgsN.join(" + "),filas:Object.keys(orgs).length,hora,por:ME&&ME.nombre};ok.push("orgs")}
  if(!sub.length){toast(mal.length?`No se reconoció el formato de: ${mal.join(", ")}.`:"No se eligió ningún archivo.");return}
  nuevo.hora=hora;nuevo.por=yo();
  try{
    const dir=await rdCarpeta([RD.maeDir]);
    for(const f of sub){try{await gfetch(`/drives/${M365.drive}/items/${dir}:/${encName(f.name)}:/content`,{method:"PUT",headers:{"Content-Type":f.type||"application/octet-stream"},body:f})}catch(e){console.warn("maestro",f.name,e)}}
    const up=await gfetch(`/drives/${M365.drive}/items/${dir}:/${RD.maeFile}:/content`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(nuevo)});const it=await up.json();
    nuevo.etag=it.eTag;MAE=nuevo;MAE_ETAG=it.eTag;try{if(IDB.db)await IDB.put("remote","rend/maestros",nuevo)}catch(e){}
    const nombres=Object.fromEntries(MAE_TIPOS.map(x=>[x[0],x[1]]));nombres.aprob="Aprobadores";nombres.dist="Distribuciones";
    toast(`Maestros actualizados: ${[...new Set(ok)].map(k=>nombres[k]||k).join(", ")}.${mal.length?` No se reconoció: ${mal.join(", ")}.`:""}`);
  }catch(e){toast("No se pudieron guardar los maestros: "+errMsg(e))}
  render();
}
/* Guarda maestros.json partiendo de la última versión en OneDrive */
async function rdMaeGuardar(fn){
  try{await rdMaePull()}catch(e){}
  const nuevo=JSON.parse(JSON.stringify(MAE||{}));delete nuevo.etag;nuevo.archivos=nuevo.archivos||{};fn(nuevo);nuevo.hora=new Date().toISOString();nuevo.por=yo();
  const dir=await rdCarpeta([RD.maeDir]);
  const up=await gfetch(`/drives/${M365.drive}/items/${dir}:/${RD.maeFile}:/content`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(nuevo)});const it=await up.json();
  nuevo.etag=it.eTag;MAE=nuevo;MAE_ETAG=it.eTag;try{if(IDB.db)await IDB.put("remote","rend/maestros",nuevo)}catch(e){}
  return nuevo;
}
/* Organizaciones (proveedores y personas) directo desde Finnegans, a través del servidor de Puduhue */
let ORGS_TRAYENDO=false,ORGS_AUTO=false;
async function rdOrgsFinnegans(silencioso){
  if(ORGS_TRAYENDO)return false;
  if(!esContab()){if(!silencioso)toast("Solo Contabilidad puede actualizar los maestros.");return false}
  if(!DB||navigator.onLine===false){if(!silencioso)toast("Se necesita señal para consultar Finnegans.");return false}
  ORGS_TRAYENDO=true;if(!silencioso){toast("Consultando las organizaciones en Finnegans…");render()}
  try{
    const j=await workerFetch("/maestro?entidad=organizacion");const L=Array.isArray(j.datos)?j.datos:[];
    if(L.length<100)throw{error:`Finnegans respondió con muy pocas organizaciones (${L.length}); no se reemplazó la lista.`};
    const orgs={};L.forEach(o=>{if(o&&o.activo!==false)orgsAgregar(orgs,o.codigo,o.nombre)});
    const antes=maeTiene("orgs")?MAE.orgs:{},nuevas=Object.keys(orgs).filter(k=>!antes[k]);
    await rdMaeGuardar(n=>{n.orgs=orgs;n.archivos.orgs={nombre:"Finnegans (en línea)",filas:Object.keys(orgs).length,hora:new Date().toISOString(),por:ME&&ME.nombre}});
    if(!silencioso||nuevas.length)toast(`Organizaciones al día desde Finnegans: ${fmtN(Object.keys(orgs).length,0)}${nuevas.length?` (${nuevas.length} ${nuevas.length===1?"nueva":"nuevas"})`:""}.`);
    return true;
  }catch(e){if(!silencioso)toast((e&&e.error)||"No se pudo consultar Finnegans.");else console.warn("organizaciones",e);return false}
  finally{ORGS_TRAYENDO=false;if(/^rd/.test(view))render()}
}
/* Para Contabilidad: si la lista de organizaciones tiene más de 12 horas, se actualiza sola al abrir Rendiciones */
function rdOrgsAuto(){if(ORGS_AUTO||!esContab()||!DB||navigator.onLine===false)return;ORGS_AUTO=true;const a=MAE&&MAE.archivos&&MAE.archivos.orgs;if(a&&Date.now()-new Date(a.hora)<12*3600000)return;setTimeout(()=>rdOrgsFinnegans(true),1500)}
const alertaOrgs=al=>al.some(a=>a.n==="p");
function rdMaeColabXlsx(){
  const wb=XLSX.utils.book_new();
  const c=[["RUT","Nombre","Centro por defecto (código)","Centro por defecto (nombre)","Tipo de fondo","Cuenta fondo","Jefatura que aprueba","Correo Microsoft","Observaciones","Activo"]].concat(colabs().map(x=>[x.rut,x.nombre,x.centro,centroNombre(x.centro),x.fondo||"Fondo por rendir",x.cuenta||"110106",x.jefe||"",x.correo||"",x.obs||"",x.activo===false?"No":"Sí"]));
  const w1=XLSX.utils.aoa_to_sheet(c);w1["!cols"]=[13,24,20,24,16,12,22,30,40,8].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w1,"Colaboradores");
  const ap=aprobadores().length?aprobadores():CONTAB_DEF.map(m=>({nombre:m,correo:m,rol:"cont"}));
  const w2=XLSX.utils.aoa_to_sheet([["Nombre","Correo","Rol"]].concat(ap.map(a=>[a.nombre,a.correo,a.rol==="cont"?"Revisión contable":"Jefatura"])));w2["!cols"]=[{wch:28},{wch:30},{wch:20}];XLSX.utils.book_append_sheet(wb,w2,"Aprobadores");
  const d=[["Servicio","Centro (código)","Centro (nombre)","Dispositivos","Cuenta","Producto","Partida"]];Object.entries((MAE&&MAE.dist)||{}).forEach(([s,rows])=>rows.forEach(x=>d.push([s,x.centro,centroNombre(x.centro),x.disp,x.cuenta,x.prod,x.part])));
  const w3=XLSX.utils.aoa_to_sheet(d);w3["!cols"]=[12,20,24,12,10,10,10].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,w3,"Distribuciones");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
function rdMaeCatXlsx(){
  const sn=v=>v?"Sí":"No";
  const rows=[["ID","Tipo de gasto","Grupo","Cuenta producción","Cuenta Administración","Producto producción","Producto Administración","Partida producción","Partida Administración","Pide bien de uso","Se puede distribuir","Solo Contabilidad","Cuenta fija","Tercero","Texto de ayuda","Activo"]].concat(catalogo().map(t=>[t.id,t.n,t.g||"",t.cp||"",t.ca||"",t.pp||"",t.pa&&t.pa!==t.pp?t.pa:"",t.parp||"",t.para&&t.para!==t.parp?t.para:"",sn(t.bu),sn(t.dist),sn(t.c),sn(t.fija),t.ter==="si"?"Obligatorio":t.ter==="no"?"Vacío":"Según documento",t.ph||"",t.activo===false?"No":"Sí"]));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[14,40,18,12,12,12,12,12,12,10,10,10,10,16,30,8].map(w=>({wch:w}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Tipos de gasto");return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}

/* ---------- Acciones ---------- */
function askVal(title,msg,ok,html){return new Promise(res=>{
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${msg?`<p>${esc(msg)}</p>`:""}${html||""}<div class="btns"><button class="btn" data-m="no">Cancelar</button><button class="btn pri" data-m="yes" style="flex:1">${esc(ok)}</button></div></div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";
  const done=v=>{m.remove();document.body.style.overflow="";res(v)};
  m.addEventListener("click",e=>{e.stopPropagation();const a=e.target.dataset&&e.target.dataset.m;if(a==="yes"){const o={};m.querySelectorAll("[data-v]").forEach(x=>{o[x.dataset.v]=x.value});done(o)}else if(a==="no"||e.target===m)done(null)});
  const f=m.querySelector("[data-v]")||m.querySelector('[data-m="yes"]');if(f)f.focus()})}
async function rdClick(A,b){
  if(A==="rdRecVer"){rdRecVer();return true}
  if(A==="rdRecProbar"){rdRecProbar();return true}
  if(A==="rdVerPdf"){if(rdd&&rdv)await rdAbrirPdf(rdv,rdd);return true}
  if(A==="rd"){await flush();rdv=null;rdd=null;go("rd");return true}
  if(A==="rdTab"){rdTab=b.dataset.t;render();return true}
  if(A==="rdMae"){go("rdm");return true}
  if(A==="rdPick"){if(rdv&&rdd&&!rdRO(rdv))rdPick(b.dataset.f);return true}
  if(A==="rdUsarRut"){if(rdv&&rdd&&!rdRO(rdv))rdSetCampo("rut",b.dataset.v);return true}
  if(A==="rdIrCampo"){rdIrCampo(b.dataset.c);return true}
  if(A==="rdOrgsFinn"){await rdOrgsFinnegans(false);return true}
  if(A==="rdMaeColab"){if(!window.XLSX)return true;await compartirBlob(new Blob([rdMaeColabXlsx()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"Colaboradores_y_Aprobaciones.xlsx","Excel listo.");return true}
  if(A==="rdMaeCat"){if(!window.XLSX)return true;await compartirBlob(new Blob([rdMaeCatXlsx()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"Catalogo_Tipos_de_Gasto.xlsx","Excel listo.");return true}
  if(A==="rdNueva"){const p=b.dataset.p,cs=colabsDeCuenta();let c=null;
    if(cs.length>1){const libres=cs.filter(x=>!rdAbiertaDe(p,x));const o=await askVal("¿Quién rinde?","Esta cuenta la usan varias personas. Cada una tiene su propia rendición del mes.","Empezar",`<div class="f"><label for="rdQuien">Persona</label><select id="rdQuien" data-v="rut">${(libres.length?libres:cs).map(x=>`<option value="${esc(x.rut)}">${esc(x.nombre)}</option>`).join("")}</select></div>`);if(!o)return true;c=colabPorRut(o.rut)||cs[0]}
    else if(cs.length===1)c=cs[0];
    let r=rdAbiertaDe(p,c);if(!r){const n=rdSiguienteN(p,c);r=nuevaRend(p,c);if(n>1)r.n=n;await saveRend(r);if(n>1)toast(`Rendición N°${n} de ${periodoTxt(p).toLowerCase()} creada.`)}rdv=r;go("rdv");return true}
  if(A==="rdAbrir"){await flush();const r=REND[b.dataset.id];if(!r)return true;rdv=r;RD_COLA=null;if(!rdv.docs)rdv.docs={};rdd=null;go("rdv");return true}
  if(A==="rdDoc"){const d=rdv&&rdv.docs[b.dataset.k];if(!d)return true;rdd=d;go("rdd");return true}
  if(A==="rdIrDoc"){await rdIrDoc(b.dataset.k);return true}
  if(A==="rdVolver"){await flush();rdd=null;RD_COLA=null;go("rdv");return true}
  if(A==="rdReleer"){if(!rdd||!editaPersona(rdv))return true;rdd.revisadoManual=false;await leerDoc(rdv,rdd);return true}
  if(A==="rdDelDoc"){if(!editaPersona(rdv))return true;const d=rdv.docs[b.dataset.k];if(!d)return true;if(!(await ask("¿Eliminar este documento?",d.pdf?"Se borran la imagen, el PDF y los datos.":"Se borra la foto y los datos.","Eliminar",true)))return true;if(d.foto)borrarFotoRef(d.foto);rdQuitarPdf(d);delete rdv.docs[d.k];rdd=null;rdTouch();go("rdv");return true}
  if(A==="rdEnviar"){if(!editaPersona(rdv))return true;const D=docsDe(rdv);if(!D.length)return true;const inc=D.filter(d=>!docCompleto(rdv,d)).length;if(inc){toast(`Faltan datos en ${inc} ${inc===1?"documento":"documentos"}.`);return true}
    const c=colabDe(rdv);let j=c?jefaturaDe(c):null;if(j&&j.correo&&(j.correo===meCorreo()||correosDe(c).includes(j.correo)))j=null;
    const vuelveCont=rdv.estado==="observada"&&rdv.devueltaEn==="revcont"&&rdv.aprobJef,eraObs=rdv.estado==="observada";
    const adv=D.reduce((n,d)=>n+docAdvertencias(rdv,d).length,0);
    const quienRev=vuelveCont?"Vuelve a revisión de Contabilidad, que recibirá un aviso por correo.":j&&j.correo?`La aprueba ${j.nombre} (le llegará un aviso por correo) y después la revisa Contabilidad.`:"No tienes jefatura asignada: la revisa Contabilidad, que recibirá un aviso por correo.";
    if(!(await ask(vuelveCont?"¿Reenviar la rendición?":"¿Enviar a aprobación?",`${D.length} ${D.length===1?"documento":"documentos"} por ${fmtP(totalRend(rdv))}. ${quienRev}${adv?` Hay ${adv} ${adv===1?"dato en blanco":"datos en blanco"} que quien revisa podrá completar.`:""} Después de enviar no se puede modificar hasta que la revisen.`,"Enviar")))return true;
    if(!vuelveCont){rdv.jefatura=j;delete rdv.aprobJef}
    /* v74: sin jefatura con correo, la rendición pasa directo a revisión de Contabilidad (un solo paso de aprobación) */
    const directo=!vuelveCont&&!(j&&j.correo);
    delete rdv.aprobCont;rdv.estado=vuelveCont||directo?"revcont":"enviada";rdv.enviada=today();rdv.comentario="";delete rdv.devueltaEn;D.forEach(d=>{d.estadoRev=undefined;d.obsRev=""});rdHist(rdv,vuelveCont?"reenviada a Contabilidad":directo?"enviada directo a Contabilidad (sin jefatura)":"enviada");rdv.actualizado=new Date().toISOString();await saveRend(rdv);render();rdAvisar(rdv,vuelveCont?"reenvCont":"enviada",vuelveCont||directo?"Rendición enviada a Contabilidad.":"Rendición enviada a aprobación.",{corregida:eraObs}).catch(e=>console.warn("correo",e));return true}
  if(A==="rdRev"){if(!rdd||!(puedeJefatura(rdv)||puedeContab(rdv)))return true;rdd.estadoRev=b.dataset.v;if(rdd.estadoRev==="ok")rdd.obsRev="";rdTouch();render();return true}
  if(A==="rdDevolver"){if(!(puedeJefatura(rdv)||puedeContab(rdv)))return true;const D=docsDe(rdv);const obs=D.filter(d=>d.estadoRev==="obs");if(!obs.length)return true;
    const ok=await ask("¿Devolver con observaciones?",`${obs.length} ${obs.length===1?"documento observado":"documentos observados"}. La persona recibirá un aviso por correo, verá los comentarios y podrá corregir y reenviar.`,"Devolver",true,`<div class="f"><label for="motAn">Comentario general (opcional)</label><input id="motAn" placeholder="Ej.: faltan boletas de combustible del viaje del 12"></div>`);if(!ok)return true;
    rdv.devueltaEn=rdv.estado;rdv.estado="observada";rdv.comentario=((document.querySelector("#motAn")||{}).value||"").trim();rdv.revisadaPor=yo();if(rdv.devueltaEn==="enviada")delete rdv.aprobJef;delete rdv.aprobCont;rdHist(rdv,"devuelta",rdv.comentario);rdv.actualizado=new Date().toISOString();await saveRend(rdv);const rr=rdv;go("rd");rdAvisar(rr,"devuelta","Rendición devuelta.").catch(e=>console.warn("correo",e));return true}
  if(A==="rdPickAj"){if(!rdd||!puedeContab(rdv))return true;const f=b.dataset.f,base=imputar(rdv,rdd,true),bk={cuenta:"cuenta",producto:"prod",partida:"part",tercero:"ter"}[f];
    pickAj(f,{actual:(rdd.aj||{})[f]||"",base:base[bk]||"",onPick:v=>{rdd.aj=rdd.aj||{};if(v&&v!==String(base[bk]||""))rdd.aj[f]=v;else delete rdd.aj[f];if(!Object.keys(rdd.aj).length)delete rdd.aj;rdTouch();const keep=window.scrollY;render();window.scrollTo(0,keep)}});return true}
  if(A==="rdAjLin"){if(!puedeContab(rdv))return true;const l=rdAsiento(rdv).lineas[+b.dataset.i];if(l)rdAjLinea(rdv,l);return true}
  if(A==="rdAprobarJef"){if(!puedeJefatura(rdv))return true;const D=docsDe(rdv);if(D.some(d=>d.estadoRev==="obs")){toast("Hay documentos observados: devuélvela o quita la observación.");return true}
    if(!(await ask("¿Aprobar la rendición?",`${D.length} ${D.length===1?"documento":"documentos"} por ${fmtP(totalRend(rdv))} de ${rdv.persona.nombre}. Pasa a revisión de Contabilidad, que recibirá un aviso por correo.`,"Aprobar")))return true;
    D.forEach(d=>{d.estadoRev=undefined});rdv.aprobJef={por:yo(),fecha:today()};rdv.estado="revcont";rdHist(rdv,"aprobada por jefatura");rdv.actualizado=new Date().toISOString();await saveRend(rdv);const rr=rdv;go("rd");rdAvisar(rr,"aprobJef","Rendición aprobada; pasa a Contabilidad.").catch(e=>console.warn("correo",e));return true}
  if(A==="rdAprobarCont"){if(!puedeContab(rdv))return true;const D=docsDe(rdv);if(D.some(d=>d.estadoRev==="obs")){toast("Hay documentos observados: devuélvela o quita la observación.");return true}
    const As=rdAsiento(rdv);if(As.bloq){toast("Hay cosas por corregir en el asiento.");render();return true}
    const nr=As.al.filter(a=>a.n==="r").length;
    if(!(await ask("¿Aprobar la imputación?",`Asiento de ${fmtP(As.debe)} con ${As.lineas.length} líneas${nr?` y ${nr} ${nr===1?"alerta revisada":"alertas revisadas"}`:""}. ${As.pend?`Falta crear en Finnegans: ${As.al.filter(a=>a.n==="p").map(a=>`${a.nombre} (${a.rut})`).join(", ")}; el Excel de esta rendición sale cuando exista.`:"Queda lista para el Excel de FinnegansGO."} ${rdv.persona&&rdv.persona.nombre?primerNombre(rdv.persona.nombre)+" recibirá un aviso por correo.":""}`,"Aprobar")))return true;
    D.forEach(d=>{d.estadoRev="ok"});rdv.aprobCont={por:yo(),fecha:today()};rdv.asiento={lineas:As.lineas.map(l=>({lado:l.lado,cuenta:l.cuenta,prod:l.prod,part:l.part,centro:l.centro,ter:l.ter,bu:l.bu,monto:l.monto,glosa:l.glosa})),fecha:As.fecha,desc:As.desc,debe:As.debe};rdv.estado="aprobada";rdHist(rdv,"aprobada por Contabilidad");rdv.actualizado=new Date().toISOString();await saveRend(rdv);const rr=rdv;go("rd");rdAvisar(rr,"aprobada","Imputación aprobada.").catch(e=>console.warn("correo",e));if(DB&&navigator.onLine!==false)setTimeout(()=>rdArchivos(rr),2500);return true}
  if(A==="rdReabrir"){if(!puedeContabilizar(rdv))return true;if(!(await ask("¿Volver a revisión contable?","Podrás corregir la imputación y aprobarla de nuevo.","Volver a revisión")))return true;rdv.estado="revcont";delete rdv.aprobCont;rdHist(rdv,"vuelve a revisión contable");rdv.actualizado=new Date().toISOString();await saveRend(rdv);render();return true}
  if(A==="rdContabilizar"){if(!puedeContabilizar(rdv))return true;const o=await askVal("¿Marcar como contabilizada?","Hazlo cuando el asiento ya esté cargado en FinnegansGO.","Marcar contabilizada",`<div class="f"><label for="rdAsN">N° de asiento en FinnegansGO (opcional)</label><input id="rdAsN" data-v="asiento" inputmode="numeric"></div>`);if(!o)return true;
    rdv.estado="contabilizada";rdv.contab={asiento:String(o.asiento||"").trim(),fecha:today(),por:yo()};rdHist(rdv,"contabilizada",rdv.contab.asiento);rdv.actualizado=new Date().toISOString();await saveRend(rdv);render();exito("Rendición contabilizada","");return true}
  if(A==="rdContabTodas"){if(!esContab())return true;const L=Object.values(REND).filter(r=>!r.anulada&&r.estado==="aprobada"&&r.exportada);if(!L.length)return true;
    if(!(await ask("¿Marcar como contabilizadas?",`${L.length} ${L.length===1?"rendición exportada":"rendiciones exportadas"} a Excel. Hazlo cuando ya estén cargadas en FinnegansGO.`,"Marcar contabilizadas")))return true;
    for(const r of L){r.estado="contabilizada";r.contab={asiento:"",fecha:today(),por:yo()};rdHist(r,"contabilizada");r.actualizado=new Date().toISOString();await saveRend(r)}render();toast(`${L.length} ${L.length===1?"rendición contabilizada":"rendiciones contabilizadas"}.`);return true}
  if(A==="rdImpUna"){if(!esContab()||!rdv)return true;const As=rdAsiento(rdv);if(As.bloq){toast("El asiento tiene cosas por corregir.");return true}await rdExportarListas([rdv],rdv.estado==="aprobada");return true}
  if(A==="rdImpTodas"){if(!esContab())return true;const L=Object.values(REND).filter(r=>!r.anulada&&r.estado==="aprobada"&&!rdAsiento(r).bloq).sort((a,b)=>String(a.periodo).localeCompare(String(b.periodo))||String(a.persona&&a.persona.nombre).localeCompare(String(b.persona&&b.persona.nombre)));await rdExportarListas(L,true);return true}
  if(A==="rdPdf"){const r=REND[b.dataset.id];if(r)await rdPdf(r);return true}
  if(A==="rdXlsx"){const r=REND[b.dataset.id];if(!r)return true;await flush();const buf=rdXlsxBuild(r.periodo,r.id);await compartirBlob(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),`Rendicion_${r.periodo}_${limpiaNombre(r.persona?r.persona.nombre:"").replace(/\s+/g,"_")}${(r.n||1)>1?"_"+r.n:""}.xlsx`,"Excel listo.",carpetaRend(r));return true}
  if(A==="rdXlsxMes"){const p=b.dataset.p;await flush();const buf=rdXlsxBuild(p);await compartirBlob(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),`Rendiciones_${p}.xlsx`,"Excel listo.",[p]);return true}
  return false;
}
function rdInput(ev){const t=ev.target;if(!rdv||!rdd)return false;const f=t.dataset.rdf;if(!f)return false;
  if(f==="obsRev"){if(puedeJefatura(rdv)||puedeContab(rdv)){rdd.obsRev=t.value;rdTouch()}return true}
  if(rdRO(rdv))return true;const contab=puedeContab(rdv);
  if(f.startsWith("aj.")){if(!contab)return true;const k=f.slice(3),v=t.value.trim();rdd.aj=rdd.aj||{};if(v)rdd.aj[k]=k==="producto"||k==="partida"?v.toUpperCase():v;else delete rdd.aj[k];if(!Object.keys(rdd.aj).length)delete rdd.aj;rdTouch();if(ev.type==="change")render();return true}
  const antes=rdd[f];
  if(["total","neto","iva"].includes(f)){const v=t.value.replace(/[^\d]/g,"");rdd[f]=v?+v:0}else rdd[f]=t.value;if(f==="glosa")delete rdd.glosaTimbre;
  if(f==="centro")delete rdd.predio;
  if(f==="gasto"){delete rdd.gastoIA;delete rdd.gastoHist;const c=gastoDe(rdd);if(!c||!c.dist)delete rdd.dist;if((rdd.tipo==="vale"||rdd.tipo==="otro")&&esGastoPeaje(rdd))rdd.tipo="peaje"}
  if(contab&&String(antes==null?"":antes)!==String(rdd[f]==null?"":rdd[f])){rdd.orig=rdd.orig||{};if(!(f in rdd.orig))rdd.orig[f]=antes==null?"":antes}
  if(f==="tipo"&&rdd.tipo==="peaje"&&!rdd.gasto&&catalogo().some(c=>c.id===GASTO_PEAJE))rdd.gasto=GASTO_PEAJE;
  rdd.revisadoManual=true;rdTouch();
  if(f==="fecha"){rdFechaLuego(t);return true}
  if(ev.type==="change")sinPerderFoco(render);else if(["tipo","centro","gasto","bu","dist"].includes(f))render();return true}
/* v108: la fecha se redibuja al salir del campo. Al escribirla con el teclado (computador), Chrome dispara input/change
   en cuanto el valor es válido y, entre un número y otro, document.activeElement pasa a <body> sin blur: redibujar ahí
   devolvía el cursor al mes y la fecha quedaba mal. Respaldo: si en 3 s ya no está en el campo, se redibuja igual. */
function rdFechaLuego(t){if(t._rdF)return;const fin=()=>{if(!t._rdF)return;clearInterval(t._rdF);t._rdF=0;t.removeEventListener("blur",fin);if(view==="rdd")sinPerderFoco(render)};
  t._rdF=setInterval(()=>{if(!t.isConnected){clearInterval(t._rdF);t._rdF=0;return}if(document.activeElement!==t&&!t.matches(":focus"))fin()},3000);t.addEventListener("blur",fin)}
async function rdChange(ev){const t=ev.target;
  if(t.dataset.rdmae){const files=[...t.files];t.value="";if(files.length)await rdMaeCargar(files);return true}
  if(t.dataset.rdr){if(!puedeContab(rdv))return true;const f=t.dataset.rdr;
    if(f==="fechaAsiento")rdv.fechaAsiento=t.value||"";
    else if(f==="persona"){const c=colabPorRut(t.value);if(!c)return true;rdv.persona=Object.assign({},rdv.persona,{nombre:c.nombre,rut:c.rut});rdHist(rdv,"persona",c.nombre)}
    rdTouch();render();return true}
  if(t.dataset.rdfoto){if(!editaPersona(rdv))return true;const files=[...t.files];t.value="";const ok=files.filter(f=>esImagen(f)||esPdf(f));if(ok.length<files.length)toast(ok.length?"Se omiten los archivos que no son fotos ni PDF.":"Elige fotos o PDF de facturas y boletas.");const R=rdv,ks=[];for(const f of ok)ks.push(await rdAgregarDoc(R,f));rdTrasSubir(R,ks);return true}
  if(t.dataset.rdrefoto){const f=t.files[0];t.value="";if(f&&rdd&&editaPersona(rdv))await rdCambiarDoc(rdv,rdd,f);return true}
  return rdInput(ev)}
async function rdGuardarFoto(r,d,file){
  let img;try{img=file&&file.dataURL&&file.blob?file:await compress(file,2560,0.8)}catch(e){toast("No se pudo leer la imagen.");return null}
  let ref=null;if(IDB.db){const t="q:"+uid();try{const buf=await img.blob.arrayBuffer();await IDB.put("fotos",t,{data:buf,type:"image/jpeg",actaId:r.id,k:d.k,col:"rendiciones"});QF[t]={actaId:r.id,k:d.k,col:"rendiciones"};ref=t}catch(e){}}
  if(!ref)ref=refSinEspacio();if(!ref)return null; /* v106 (C-04) */
  FOTO[ref]=img.dataURL;schedSync(800);return ref;
}
async function rdAgregarDoc(r,file,op){
  op=op||{};
  let img=null;if(esPdf(file)){img=await rdPdfImagen(file);if(!img)return}
  /* v98: el timbre del SII se busca en el teléfono (sirve sin señal); si no hay timbre, se revisa que la foto no esté borrosa ni oscura */
  let tim=op.timbre||null;
  if(!tim){const t0=setTimeout(()=>toast("Revisando la foto…"),700);try{tim=await timbreLeer(img?img.blob:file)}finally{clearTimeout(t0)}}
  if(!tim&&!img&&!op.sinRevisar){const q=await fotoCalidad(file);if(q.mala){const x=await fotoPregunta(q);if(x==="descartar")return;if(x&&x!=="usar")return rdAgregarDoc(r,x,op);op={...op,sinRevisar:true}}}
  const c=colabDe(r);
  const d={k:"d"+uid(),creado:new Date().toISOString(),tipo:"boleta",emisor:"",rut:"",folio:"",fecha:"",total:0,neto:0,iva:0,centro:(c&&centroExiste(c.centro))?c.centro:"",gasto:"",glosa:""};if(d.centro)d.centroSug=true;
  const foto=await rdGuardarFoto(r,d,img||file);if(!foto)return; /* v106 (C-04) */
  r.docs[d.k]=d;d.foto=foto;if(img)await rdPonerPdf(r,d,file,img);
  if(tim)timbreAplicar(d,tim);if(op.escaneo)d.deEscaneo=true;
  if(d.rut&&!d.gasto){const gh=gastoHistorial(d.rut,d.k);if(gh){d.gasto=gh;d.gastoHist=true}}
  d.lectura={estado:navigator.onLine===false?"pendiente":"leyendo"};r.actualizado=new Date().toISOString();await saveRend(r);render();
  leerDoc(r,d);return d.k;
}

/* ---------- v81: facturas y boletas en PDF ----------
   La primera página (y la última, si el PDF tiene varias) se convierte en imagen: con ella se muestra el documento,
   se lee con IA y va al resumen. El PDF original se guarda tal cual y se sube a OneDrive junto a la imagen.
   El lector de PDF (pdf.js) se descarga la primera vez que se usa y queda guardado en el equipo. */
const PDFJS_DIR="lib/pdfjs-6.3.289/",PDF_MAX=15*1024*1024;let PDFJS=null;
const esPdf=f=>!!f&&(f.type==="application/pdf"||/\.pdf$/i.test(f.name||""));
const esImagen=f=>!!f&&(/^image\//.test(f.type||"")||(!f.type&&/\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name||"")));
async function cargarPdfjs(){
  if(PDFJS)return PDFJS;
  const base=new URL(PDFJS_DIR,location.href).href;
  const m=await import(base+"pdf.min.mjs");
  m.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.mjs";
  PDFJS=m;return m}
async function pdfPagina(doc,n,alto){
  const pg=await doc.getPage(n);const v1=pg.getViewport({scale:1});const vp=pg.getViewport({scale:alto/v1.height});
  const c=document.createElement("canvas");c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
  await pg.render({canvasContext:ctx,viewport:vp}).promise;try{pg.cleanup()}catch(e){}return c}
async function pdfAImagen(file){
  let lib;try{lib=await cargarPdfjs()}catch(e){console.warn("pdf.js",e);throw{msg:navigator.onLine===false?"Para abrir un PDF por primera vez en este equipo se necesita conexión. Intenta de nuevo con señal.":"Este navegador no pudo abrir el lector de PDF. Toma una foto o una captura de pantalla de la factura."}}
  let doc;try{doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),wasmUrl:new URL(PDFJS_DIR+"wasm/",location.href).href,enableXfa:false}).promise}
  catch(e){console.warn("pdf",e);throw{msg:e&&e.name==="PasswordException"?"El PDF tiene clave. Ábrelo, guárdalo sin clave o toma una captura de pantalla de la factura.":"No se pudo abrir el PDF. Revisa que sea la factura o boleta y que no esté dañado."}}
  try{
    const n=doc.numPages;
    if(n<=1)return{canvas:await pdfPagina(doc,1,2000),paginas:1};
    /* varias páginas: la primera (emisor y folio) y la última (totales), lado a lado */
    const a=await pdfPagina(doc,1,1600),b=await pdfPagina(doc,n,1600),g=24;
    const c=document.createElement("canvas");c.width=a.width+g+b.width;c.height=Math.max(a.height,b.height);
    const ctx=c.getContext("2d");ctx.fillStyle="#9AA5B1";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(a,0,0);ctx.drawImage(b,a.width+g,0);
    return{canvas:c,paginas:n}}
  catch(e){console.warn("pdf",e);throw{msg:"No se pudo dibujar el PDF. Toma una foto o una captura de pantalla de la factura."}}
  finally{try{doc.destroy()}catch(e){}}
}
/* PDF → imagen lista para guardar como foto del documento; avisa y devuelve null si no se pudo */
async function rdPdfImagen(file){
  const t=setTimeout(()=>toast("Abriendo el PDF…"),400);
  try{const x=await pdfAImagen(file);const c=x.canvas;
    const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",0.85));if(!blob)throw{msg:"No se pudo convertir el PDF en imagen."};
    return{dataURL:c.toDataURL("image/jpeg",0.85),blob,paginas:x.paginas}}
  catch(e){toast((e&&e.msg)||"No se pudo abrir el PDF.");return null}
  finally{clearTimeout(t)}
}
/* el PDF original queda en el teléfono hasta subirse a la carpeta de la rendición */
async function rdGuardarPdf(r,d,file){
  if(file.size>PDF_MAX){toast("El PDF es muy grande para guardarlo (más de 15 MB): queda solo la imagen del documento.");return null}
  if(!IDB.db)return null;const t="q:"+uid();
  try{const buf=await file.arrayBuffer();await IDB.put("fotos",t,{data:buf,type:"application/pdf",actaId:r.id,k:d.k,col:"rendiciones"});QF[t]={actaId:r.id,k:d.k,col:"rendiciones",pdf:1};schedSync(800);return t}catch(e){return null}
}
function rdQuitarPdf(d){if(d.pdf)borrarFotoRef(d.pdf);delete d.pdf;delete d.pdfPags;delete d.pdfNombre}
async function rdPonerPdf(r,d,file,img){d.pdf=await rdGuardarPdf(r,d,file);if(!d.pdf)delete d.pdf;d.pdfPags=img.paginas;d.pdfNombre=String(file.name||"").slice(0,100)}
/* cambiar la foto o el PDF de un documento ya creado */
async function rdCambiarDoc(r,d,f){
  let img=null;
  if(esPdf(f)){img=await rdPdfImagen(f);if(!img)return}
  else if(!esImagen(f)){toast("Elige una foto o un PDF de la factura o boleta.");return}
  const nf=await rdGuardarFoto(r,d,img||f);if(!nf)return; /* v106 (C-04) */
  if(d.foto)borrarFotoRef(d.foto);rdQuitarPdf(d);
  d.foto=nf;if(img)await rdPonerPdf(r,d,f,img);
  const tv=d.deEscaneo?d.timbre:null;delete d.timbre;delete d.deEscaneo;{const t=await timbreLeer(img?img.blob:f);if(t)timbreAplicar(d,t);else if(tv)timbreAplicar(d,tv)}
  d.lectura={estado:navigator.onLine===false?"pendiente":"leyendo"};d.revisadoManual=false;rdTouch();render();leerDoc(r,d)
}
/* enlace del documento para el Excel: el PDF si existe, si no la foto */
function rdLinkDoc(r,d){const U=r.fotoUrl||{};if(d.pdf&&U[d.pdf])return{t:"Abrir PDF",u:U[d.pdf]};if(d.foto&&U[d.foto])return{t:"Abrir foto",u:U[d.foto]};return{t:"",u:""}}
function rdPdfNombre(r,d){return limpiaNombre(`${d.fecha||""}_${d.emisor||"documento"}_${d.folio||""}`).replace(/\s+/g,"_").replace(/^_+|_+$/g,"").slice(0,70)+".pdf"}
async function rdPdfBlob(d){
  const ref=d.pdf;if(!ref)return null;
  if(IDB.db){const rec=await IDB.get("fotos",ref).catch(()=>null)||await IDB.get("cache",ref).catch(()=>null);const b=await recBlob(rec);if(b)return new Blob([b],{type:"application/pdf"})}
  if(ref.startsWith("a:")&&DB&&navigator.onLine!==false&&esItemId(ref.slice(2))){
    try{const x=await gfetch(`/drives/${M365.drive}/items/${ref.slice(2)}/content`);const b=await x.blob();
      if(b&&b.size){try{if(IDB.db)await IDB.put("cache",ref,{data:await b.arrayBuffer(),type:"application/pdf"})}catch(e){}return new Blob([b],{type:"application/pdf"})}}catch(e){console.warn("pdf",e)}}
  return null}
async function rdAbrirPdf(r,d){
  if(!d.pdf){toast("Este documento no tiene PDF.");return}
  const b=await rdPdfBlob(d);const web=r.fotoUrl&&r.fotoUrl[d.pdf];
  if(!b&&!(web&&navigator.onLine!==false)){toast(d.pdf.startsWith("q:")?"El PDF todavía no se envía desde el equipo donde se agregó.":navigator.onLine===false?"Sin señal: el PDF se podrá abrir cuando vuelva la conexión.":"No se encontró el PDF.");return}
  const nombre=rdPdfNombre(r,d),url=b?URL.createObjectURL(b):"",file=b?new File([b],nombre,{type:"application/pdf"}):null;
  const comp=!!(file&&!ESCRITORIO()&&navigator.canShare&&(()=>{try{return navigator.canShare({files:[file]})}catch(e){return false}})());
  const pags=d.pdfPags>1?`El PDF tiene ${d.pdfPags} páginas. `:"";
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet pdfv" role="dialog" aria-modal="true" aria-label="PDF del documento"><h3>${esc(d.emisor||"Documento")} · PDF</h3>
    ${!b?`<p>${pags}El PDF está en la carpeta de la rendición en OneDrive.</p><div class="btns"><button class="btn" data-m="close">Cerrar</button><a class="btn pri" href="${esc(web)}" target="_blank" rel="noopener" style="flex:1">Abrir en OneDrive</a></div>`
    :ESCRITORIO()?`<iframe class="pdfif" src="${url}" title="PDF del documento"></iframe><div class="btns"><button class="btn" data-m="close">Cerrar</button><a class="btn" href="${url}" download="${esc(nombre)}">Descargar</a><a class="btn pri" href="${url}" target="_blank" rel="noopener" style="flex:1">Abrir en otra pestaña</a></div>`
    :`<p>${pags}${comp?"Toca <b>Ver o compartir</b> para abrirlo, guardarlo en Archivos o enviarlo.":"Ábrelo para verlo completo o guardarlo."}</p><div class="btns"><button class="btn" data-m="close">Cerrar</button>${comp?`<button class="btn pri" data-m="share" style="flex:1">Ver o compartir</button>`:`<a class="btn pri" href="${url}" target="_blank" rel="noopener" download="${esc(nombre)}" style="flex:1">Abrir PDF</a>`}</div>`}
  </div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";
  const close=()=>{m.remove();document.body.style.overflow="";if(url)setTimeout(()=>URL.revokeObjectURL(url),60000)};
  m.addEventListener("click",e=>{const a=e.target.dataset&&e.target.dataset.m;if(e.target===m||a==="close")close();
    if(a==="share")navigator.share({files:[file],title:nombre}).catch(err=>{if(!err||err.name!=="AbortError")toast("No se pudo abrir: "+((err&&err.message)||"error"))})});
}
function rdPdfInfo(d){return d.pdf||d.pdfPags?`<div class="rdpdf"><span><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 13h5M9.5 16.5h5"/></svg></span> Documento en PDF${d.pdfPags>1?` · ${d.pdfPags} páginas: se ven la primera y la última`:""}</span>${d.pdf?`<button class="btn" data-a="rdVerPdf">Ver PDF original</button>`:""}</div>`:""}

/* ---------- OneDrive: carpeta, Excel mensual y PDF ---------- */
const RDPATH={};
async function rdCarpeta(segs){let parent=RD.root,path="";
  for(const seg of segs){path+="/"+seg;if(RDPATH[path]){parent=RDPATH[path];continue}
    let id=null;try{const x=await gjson(`/drives/${M365.drive}/items/${parent}:/${encName(seg)}`);id=x.id}catch(e){if(e.code!=="not_found")throw e}
    if(!id){const x=await gjson(`/drives/${M365.drive}/items/${parent}/children`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:seg,folder:{},"@microsoft.graph.conflictBehavior":"fail"})});id=x.id}
    RDPATH[path]=id;parent=id}return parent}
const carpetaRend=r=>[r.periodo,limpiaNombre(r.persona?r.persona.nombre:"Sin nombre")];
async function rdSubir(segs,name,blob,type){const f=await rdCarpeta(segs);const x=await gfetch(`/drives/${M365.drive}/items/${f}:/${encName(name)}:/content`,{method:"PUT",headers:{"Content-Type":type},body:blob});return x.json()}
function rdXlsxBuild(periodo,soloId){
  const RS=Object.values(REND).filter(r=>r.periodo===periodo&&!r.anulada&&(!soloId||r.id===soloId));const wb=XLSX.utils.book_new();
  const h=["Período","Persona","RUT","Estado rendición","Tipo documento","Emisor","RUT emisor","Folio","Fecha","Neto","IVA","Total","Centro de costo","Código centro","Tipo de gasto","Detalle","Cuenta","Producto","Partida","Bien de uso","Tercero","Lectura","Datos en blanco","Revisión","Observación","Jefatura","Aprobación jefatura","Contabilidad","Aprobación contable","Documento"];
  const rows=[h];const links=[];
  RS.forEach(r=>docsDe(r).forEach(d=>{const le=d.lectura||{},cat=gastoDe(d),ce=centroDoc(r,d),im=imputar(r,d);rows.push([r.periodo,r.persona?r.persona.nombre:"",r.persona&&r.persona.rut||"",RD_ESTADO[r.estado]||r.estado,TIPO_DOC[d.tipo]||d.tipo||"",d.emisor||"",d.rut||"",d.folio||"",d.fecha?fmtD(d.fecha):"",num(d.neto)||"",num(d.iva)||"",num(d.total)||0,centroNombre(ce),ce,cat?cat.n:(d.gasto||""),d.glosa||"",im.cuenta,im.prod,im.part,im.bu,im.ter,le.estado==="ok"?(d.revisadoManual?"IA + corrección manual":"IA"):"Manual",docAdvertencias(r,d).join(" · "),d.estadoRev==="ok"?"Revisada":d.estadoRev==="obs"?"Observada":"",d.obsRev||"",r.aprobJef?quien(r.aprobJef.por):(r.jefatura&&r.jefatura.nombre)||"",r.aprobJef?fmtD(r.aprobJef.fecha):"",r.aprobCont?quien(r.aprobCont.por):(r.aprobadaPor?quien(r.aprobadaPor):""),r.aprobCont?fmtD(r.aprobCont.fecha):(r.aprobadaFecha?fmtD(r.aprobadaFecha):""),rdLinkDoc(r,d).t]);{const L=rdLinkDoc(r,d);if(L.u)links.push([rows.length-1,L.u])}}));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[9,24,12,18,16,30,14,10,11,10,10,12,22,16,30,36,9,9,9,11,12,10,30,10,30,20,12,20,12,10].map(w=>({wch:w}));ws["!freeze"]={xSplit:0,ySplit:1};ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:h.length-1}})};
  links.forEach(([rw,u])=>{const c=ws[XLSX.utils.encode_cell({r:rw,c:h.length-1})];if(c)c.l={Target:u,Tooltip:"Abrir en OneDrive"}});XLSX.utils.book_append_sheet(wb,ws,"Documentos");
  const res=[["Persona","Estado","Documentos","Total","Jefatura","Contabilidad"]];RS.sort((a,b)=>String(a.persona&&a.persona.nombre).localeCompare(String(b.persona&&b.persona.nombre))).forEach(r=>res.push([r.persona?r.persona.nombre:"",RD_ESTADO[r.estado]||r.estado,docsDe(r).length,totalRend(r),r.aprobJef?`${quien(r.aprobJef.por)} ${fmtD(r.aprobJef.fecha)}`:"",r.aprobCont?`${quien(r.aprobCont.por)} ${fmtD(r.aprobCont.fecha)}`:""]));
  const porC={},porG={};RS.filter(r=>r.estado==="aprobada"||r.estado==="contabilizada").forEach(r=>docsDe(r).forEach(d=>{const ce=centroNombre(centroDoc(r,d))||"Sin centro",g=(gastoDe(d)||{}).n||"Sin tipo";porC[ce]=(porC[ce]||0)+num(d.total);porG[g]=(porG[g]||0)+num(d.total)}));
  res.push([]);res.push(["Aprobado por centro de costo"]);Object.entries(porC).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>res.push([k,"","",v]));res.push([]);res.push(["Aprobado por tipo de gasto"]);Object.entries(porG).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>res.push([k,"","",v]));
  const w2=XLSX.utils.aoa_to_sheet(res);w2["!cols"]=[{wch:32},{wch:24},{wch:12},{wch:14},{wch:26},{wch:26}];XLSX.utils.book_append_sheet(wb,w2,"Resumen");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
async function rdXlsxUpload(periodo){await rdSubir([periodo],`Rendiciones_${periodo}.xlsx`,new Blob([rdXlsxBuild(periodo)]),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
async function rdArchivos(r){
  try{if(Object.values(r.docs||{}).some(d=>(d.foto&&QF[d.foto])||(d.pdf&&QF[d.pdf]))){setTimeout(()=>rdArchivos(r),20000);return}
    await rdPdf(r,true);
    await subirExcel("rend:"+r.periodo,false,()=>rdXlsxUpload(r.periodo));
  }catch(e){console.warn("archivos rendición",e)}
}
async function rdPdf(r,subir){
  if(!window.jspdf){toast("No se pudo cargar el generador de PDF.");return}
  await flush();if(!subir)toast("Preparando el resumen…");
  const D=docsDe(r);const IM={};for(const d of D)if(d.foto)IM[d.foto]=await pdfImg(d.foto);
  const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:"mm",format:"a4"});const X=15,W=180;let y=10;
  const nueva=()=>{doc.addPage();y=15};const chk=h=>{if(y+h>282)nueva()};
  doc.setFillColor(141,179,226);doc.rect(X,y,W,21,"F");try{doc.addImage(LOGO,"JPEG",X+2,y+1.5,20,18)}catch(e){}
  doc.setFont("helvetica","bold");doc.setFontSize(14);doc.setTextColor(15,39,64);doc.text("Rendición de gastos",X+26,y+9);doc.setFontSize(10);doc.setFont("helvetica","normal");doc.text(`${r.persona?r.persona.nombre:""}${r.persona&&r.persona.rut?" · "+r.persona.rut:""} · ${rdTitulo(r)} · ${RD_ESTADO[r.estado]||r.estado}`,X+26,y+16);doc.setTextColor(0);y+=27;
  doc.setFontSize(9.5);doc.text(`Documentos: ${D.length} · Total: ${fmtP(totalRend(r))}${r.enviada?` · Enviada: ${fmtD(r.enviada)}`:""}`,X,y);y+=5;
  const apr=[r.aprobJef?`Jefatura: ${quien(r.aprobJef.por)} el ${fmtD(r.aprobJef.fecha)}`:"",r.aprobCont?`Contabilidad: ${quien(r.aprobCont.por)} el ${fmtD(r.aprobCont.fecha)}`:"",r.contab&&r.contab.asiento?`Asiento FinnegansGO N° ${r.contab.asiento}`:""].filter(Boolean).join(" · ");
  if(apr){doc.text(doc.splitTextToSize(apr,W)[0],X,y);y+=5}y+=3;
  const cols=[{t:"Fecha",w:18},{t:"Emisor",w:50},{t:"RUT",w:24},{t:"Folio",w:18},{t:"Centro / gasto",w:42},{t:"Total",w:28,r:1}];
  const headT=()=>{chk(8);doc.setFillColor(221,235,247);doc.rect(X,y-4.5,W,6.5,"F");doc.setFont("helvetica","bold");doc.setFontSize(8.5);let x=X;cols.forEach(c=>{doc.text(c.t,c.r?x+c.w-1.5:x+1.5,y,c.r?{align:"right"}:undefined);x+=c.w});doc.setFont("helvetica","normal");y+=6};
  headT();
  D.forEach(d=>{const em=doc.splitTextToSize(d.emisor||"",cols[1].w-3),pg=doc.splitTextToSize([centroNombre(centroDoc(r,d)),(gastoDe(d)||{}).n].filter(Boolean).join(" / "),cols[4].w-3);const h=Math.max(5.2,Math.max(em.length,pg.length)*4)+(d.glosa||d.obsRev?4.5:0);chk(h+1);if(y+h>282){nueva();headT()}
    if(d.estadoRev==="obs"){doc.setFillColor(250,228,228);doc.rect(X,y-3.8,W,h,"F")}
    let x=X;doc.setFontSize(8.5);const v=[d.fecha?fmtD(d.fecha):"",null,d.rut||"",d.folio||"",null,fmtP(num(d.total))];
    cols.forEach((c,i)=>{if(i===1)doc.text(em,x+1.5,y);else if(i===4)doc.text(pg,x+1.5,y);else doc.text(String(v[i]),c.r?x+c.w-1.5:x+1.5,y,c.r?{align:"right"}:undefined);x+=c.w});
    if(d.glosa||d.obsRev){doc.setTextColor(90);doc.setFontSize(7.8);doc.text(doc.splitTextToSize((d.glosa?d.glosa:"")+(d.obsRev?`  · Obs.: ${d.obsRev}`:""),W-22)[0],X+19.5,y+Math.max(em.length,pg.length)*4-0.5);doc.setTextColor(0)}
    y+=h});
  chk(8);doc.setFont("helvetica","bold");doc.setFontSize(10);doc.text(`Total ${fmtP(totalRend(r))}`,X+W-1.5,y+1,{align:"right"});doc.setFont("helvetica","normal");y+=10;
  /* fotos, 2 por fila */
  const fs=D.filter(d=>d.foto&&IM[d.foto]);if(fs.length){chk(12);doc.setFont("helvetica","bold");doc.setFontSize(11);doc.text("Imágenes de los documentos",X,y);y+=6;const IW=(W-6)/2,MH=95;let col=0;
    fs.forEach(d=>{const im=IM[d.foto];if(col===0)chk(MH+10);let w=IW,hh=w*im.h/im.w;if(hh>MH){hh=MH;w=hh*im.w/im.h}const x=X+col*(IW+6)+(IW-w)/2;try{doc.addImage(im.data,"JPEG",x,y,w,hh)}catch(e){}doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(`${d.emisor||""} · ${d.fecha?fmtD(d.fecha):""} · ${fmtP(num(d.total))}`,IW)[0],X+col*(IW+6),y+MH+4);col++;if(col===2){col=0;y+=MH+9}});if(col===1)y+=MH+9}
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(110);doc.text(`Página ${i} de ${n}`,195,289,{align:"right"});const a=autoriaTxt(r);if(a)doc.text(doc.splitTextToSize("Registro en la app: "+a.charAt(0).toLowerCase()+a.slice(1),150)[0],15,289);doc.setTextColor(0)}
  const name=`Rendicion_${r.periodo}_${limpiaNombre(r.persona?r.persona.nombre:"").replace(/\s+/g,"_")}${(r.n||1)>1?"_"+r.n:""}.pdf`;
  if(subir){try{await rdSubir(carpetaRend(r),name,doc.output("blob"),"application/pdf")}catch(e){console.warn(e)}return}
  await guardarPDF(doc,name,"Resumen listo.");
}

/* marca de que el módulo cargó completo (la revisa el arranque en index.html) */
window.MOD_RENDICIONES=true;
