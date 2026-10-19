/* Puduhue Terreno: módulo Actas de entrega (vehículos y activos fijos; desde la v109 también el registro de capacitaciones) (desde la v103 vive en este archivo, aparte de index.html).
   Se carga como script normal después del código general de index.html y antes del arranque (init()), así que comparte
   las mismas variables y funciones globales. Sus escuchadores globales (document/window.addEventListener) quedaron en
   index.html, en su lugar de siempre. El service worker lo guarda junto con index.html. Ver el mapa en CLAUDE.md. */
/* ============================================================
   Actas de entrega (v72): vehículos y activos fijos, junto a las de vivienda.
   Se guardan en la misma base de actas (OneDrive: Actas de vivienda/_datos) con tipo "vehiculo" o "activo";
   sus PDF y fotos van en Actas de vivienda/Vehículos/... y Actas de vivienda/Activos fijos/...
   ============================================================ */
const esViv=a=>!!a&&(a.tipo==="entrega"||a.tipo==="devolucion");
const esAx=a=>!!a&&(a.tipo==="vehiculo"||a.tipo==="activo"||a.tipo==="capacitacion");
/* Quien entrega por la empresa: cualquier persona de Administración (colaboradores de Rendiciones con centro Indirectos Administración) */
const ADM_CENTRO="9-0-8-90";
function personasAdm(){try{return colabs().filter(c=>c&&c.activo!==false&&c.centro===ADM_CENTRO&&c.nombre).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),"es"))}catch(e){return[]}}
const AX_PREDIOS=PREDIOS.concat(["Administración"]);
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

/* ---------- Acta de entrega y responsabilidad de vehículo (texto del acta en papel) ---------- */
const VEH_TIT="ACTA DE ENTREGA Y RESPONSABILIDAD DE VEHÍCULO";
const VEH_SUB="CAPAC SPA – RUT 76.459.811-3 Flota Salfa Rent — Uso Interno";
const VEH_ID1=[["tipoVeh","Tipo Vehículo"],["marca","Marca"],["modelo","Modelo"],["anio","Año"]];
const VEH_ID2=[["patente","Patente"],["combustible","Combustible"],["km","Km de entrega"]];
const VEH_ACC=[["rueda","Rueda de repuesto"],["gata","Gata"],["llave","Llave de rueda"],["triangulos","Triángulos"],["chaleco","Chaleco reflectante"],["extintor","Extintor"],["botiquin","Botiquín"],["manual","Manual del conductor"],["tag","TAG"],["llaves","Llaves"],["permiso","Permiso de Circulación"]];
const VEH_DOC=[["rt","Revisión Técnica"],["gases","Revisión de Gases"],["soap","SOAP"],["poliza","Póliza de Seguro vigentes"]];
const VEH_FOTOS=[["v_estado","Estado general y daños visibles"],["v_km","Tablero con el kilometraje"]];
const VEH_R2="El Conductor declara conocer el RIOHS de CAPAC SpA, especialmente sus capítulos sobre uso de vehículos, normas de seguridad, prevención de alcohol y drogas, y protección ante radiación UV, y asume las siguientes obligaciones:";
const VEH_RESP=[
 ["2.1","Aptitud para conducir.","Conducir únicamente con licencia vigente de la clase exigida. Dar aviso inmediato a su jefatura ante suspensión o retiro de licencia; desde ese momento queda impedido de operar el vehículo. Prohibido conducir bajo efectos de alcohol, drogas o fármacos psicotrópicos que alteren el desempeño (Cap. 28 RIOHS). El Conductor acepta someterse a test aleatorios de alcohol y drogas y a test obligatorio ante cualquier accidente."],
 ["2.2","Conducción segura y Ley del Tránsito.","Cumplir estrictamente la Ley 18.290: respetar límites de velocidad, señalización, distancia prudente y uso obligatorio de cinturón de seguridad para conductor y acompañantes. Velocidad máxima al interior de fundos y dependencias: 20 km/h. Conducir siempre a la defensiva y estacionar aculatado en las zonas habilitadas. Prohibido uso de teléfono celular durante la conducción, salvo sistema manos libres."],
 ["2.3","Uso exclusivamente laboral.","El vehículo es para fines laborales de CAPAC SpA. Prohibido transportar personas ajenas a la organización, familiares o pasajeros no autorizados, así como exceder el número de asientos disponibles. Prohibido subarrendar, ceder o sacar el vehículo del territorio nacional sin autorización escrita."],
 ["2.3 bis","Excepciones por emergencia.","En situaciones de emergencia vital que involucren al Conductor o a miembros de su grupo familiar directo, el Conductor podrá hacer uso excepcional del vehículo, debiendo dar aviso a su jefatura directa por el medio más expedito en un plazo máximo de 2 horas desde ocurrida la emergencia, y formalizar el reporte por escrito dentro de las 24 horas siguientes, acompañando documentación que acredite la emergencia (constancia médica, dato de atención, etc.). El uso no reportado oportunamente será considerado uso no autorizado para todos los efectos de la presente acta."],
 ["2.3 ter","– Disponibilidad en períodos de inactividad laboral.","Durante períodos de licencia médica, vacaciones, permisos, días libres programados o cualquier período en que el Conductor no esté en funciones laborales, el vehículo deberá ser devuelto a las dependencias de CAPAC SpA o puesto a disposición de la Empresa para operación por otro personal, en un plazo no mayor a 12 horas desde la comunicación de la ausencia. El Conductor permanece responsable del vehículo hasta su efectiva restitución conforme a lo establecido en la Sección 2.13. Esta obligación aplica independientemente del estado de mantención del vehículo."],
 ["2.4","Prohibiciones expresas.","Queda prohibido: (a) fumar o vapear dentro del vehículo; (b) consumir alimentos o bebidas alcohólicas en su interior; (c) transportar carga o personas en pisaderas, pick-up sin habilitación, o sobre la carga; (d) remolcar otros vehículos sin autorización; (e) participar en carreras, picadas o competencias; (f) transportar explosivos, combustibles o materiales inflamables fuera de su contenedor reglamentario; (g) circular por playas, dunas o cauces de agua; (h) desconectar o manipular el GPS; (i) realizar modificaciones, rotulados o reparaciones no autorizadas."],
 ["2.5","Chequeo diario preoperacional.","Antes de cada jornada: revisar niveles de aceite, agua, líquido de frenos, presión e integridad de neumáticos, luces, frenos, cinturones, limpiaparabrisas, estado del parabrisas y funcionamiento de la alarma de retroceso. Reportar cualquier anomalía a jefatura antes de operar el vehículo."],
 ["2.6","Mantenciones.","Presentar el vehículo en los talleres autorizados por Salfa Rent cada 10.000 km (tolerancia máxima 500 km), según el contrato de leasing operativo. El incumplimiento deja al Conductor y/o a la Empresa responsables de los daños derivados, conforme a lo pactado con Salfa Rent."],
 ["2.7","Cargas y estiba.","No exceder la capacidad del vehículo informada por el fabricante. Toda carga debe ir amarrada, distribuida y asegurada, sin obstruir visibilidad ni espejos. Uso obligatorio de guantes y calzado de seguridad en carga/descarga."],
 ["2.8","Exposición a calor y radiación UV.","En jornadas de verano u olas de calor, hidratarse regularmente, usar gorro tipo legionario y protector solar factor 30 o superior, y respetar pausas a la sombra (Cap. 56–57 RIOHS)."],
 ["2.9","Accidentes, siniestros y robos.","Ante cualquier accidente, colisión, volcamiento, robo o intento de asalto, el Conductor deberá: (i) priorizar su seguridad personal; (ii) dar aviso inmediato a su jefatura directa y al número de emergencias internas; (iii) constatar lesiones en Carabineros o hacer la Declaración Jurada exigida por la Compañía de Seguros; (iv) no asumir responsabilidades ni acuerdos con terceros; (v) entregar toda la documentación requerida dentro de 24 horas para gestionar el siniestro ante Salfa Rent. El incumplimiento de este protocolo hace al Conductor responsable del deducible y daños no cubiertos por la póliza. Todo accidente de trabajo se denunciará al organismo administrador de la Ley 16.744 dentro de 24 horas (Cap. 69 RIOHS)."],
 ["2.10","Multas e infracciones.","Toda multa, parte empadronado o infracción a la Ley del Tránsito imputable al Conductor será de su exclusivo cargo personal y deberá ser pagada directamente por éste ante el organismo correspondiente dentro de los plazos legales. El Conductor se obliga a acreditar el pago ante la Empresa cuando le sea requerido. El no pago oportuno de multas asociadas al vehículo asignado constituirá incumplimiento grave de las obligaciones del contrato de trabajo y facultará a la Empresa para aplicar las medidas disciplinarias contempladas en el RIOHS, incluyendo la causal del artículo 160 N°7 del Código del Trabajo."],
 ["2.11","Uso de TAG y combustible.","El TAG es para trayectos estrictamente laborales; los usos particulares serán reembolsados por el Conductor. El combustible se rinde conforme a la política interna de la Empresa."],
 ["2.12","GPS y monitoreo.","El Conductor declara conocer y aceptar que el vehículo asignado cuenta con sistema de posicionamiento satelital (GPS) monitoreado permanentemente por Salfa Rent y por CAPAC SpA, cuyo objeto es resguardar la seguridad del Conductor, proteger el patrimonio de la Empresa, verificar el cumplimiento de las obligaciones laborales y de las contenidas en el presente acta, y gestionar eficientemente la flota."],
 ["","","El Conductor autoriza expresamente a CAPAC SpA y a Salfa Rent para recolectar, almacenar, tratar y utilizar los datos de geolocalización, rutas, velocidad, horarios y detenciones del vehículo, en conformidad con la Ley N° 19.628 sobre Protección de la Vida Privada y demás normativa aplicable. Dichos datos podrán ser utilizados como medio de prueba en procedimientos disciplinarios internos, así como en sede administrativa o judicial cuando corresponda."],
 ["","","La desconexión, manipulación, interferencia o inutilización del sistema GPS por cualquier medio constituye falta grave de las obligaciones del contrato de trabajo, facultando a la Empresa para aplicar la causal del artículo 160 N° 7 del Código del Trabajo, sin perjuicio de las acciones civiles que procedan por los daños ocasionados."],
 ["2.13","Restitución.","Al término de la asignación o ante requerimiento, devolver el vehículo en las mismas condiciones de entrega —considerando desgaste normal—, con todos sus accesorios, documentos, llaves y TAG. Los daños, faltantes o deducibles derivados de incumplimientos de la presente acta, del RIOHS o de usos no autorizados del vehículo podrán ser cobrados al Conductor por la vía civil correspondiente, sin perjuicio de las medidas disciplinarias aplicables conforme al RIOHS y al artículo 160 del Código del Trabajo."],
 ["2.14","Cobertura de seguro y uso autorizado.","El Conductor declara conocer que la póliza de seguro del vehículo cubre exclusivamente los usos autorizados por la Empresa conforme al presente acta. El uso del vehículo en condiciones no autorizadas (incluyendo, sin limitación, transporte de pasajeros no autorizados, uso fuera de horario laboral sin autorización escrita, o uso para fines personales) puede determinar la exclusión total o parcial de cobertura por parte de la aseguradora. En tal caso, el Conductor será civilmente responsable de la totalidad de los daños propios y a terceros no cubiertos por la póliza, sin perjuicio de las medidas disciplinarias aplicables."]
];
const VEH_R3="El incumplimiento de cualquiera de las obligaciones contenidas en esta acta será sancionado conforme al procedimiento disciplinario del RIOHS, aplicando de manera progresiva y según la gravedad de la falta:";
/* VEH_PEND: el texto del punto 3.4 está incompleto (falta la página siguiente del acta). Mientras sea true, no se puede cerrar un acta de vehículo. */
const VEH_PEND=true;
const VEH_DISC=[
 ["3.1","Amonestación verbal con registro interno, para faltas leves o primeras infracciones no graves (por ejemplo: omisión del chequeo diario preoperacional, atraso menor en mantención, no reportar anomalía menor)."],
 ["3.2","Amonestación escrita con copia a carpeta personal, para faltas reiteradas o de mediana gravedad (por ejemplo: exceso de velocidad no constitutivo de infracción gravísima, estacionamiento indebido reiterado, uso del TAG para fines particulares sin rendición, incumplimiento de mantención dentro del rango de tolerancia)."],
 ["3.3","Amonestación escrita con copia a la Inspección del Trabajo, para faltas graves (por ejemplo: conducir sin licencia vigente, transporte de personas no autorizadas, uso del vehículo fuera del territorio nacional sin autorización, desconexión o manipulación del GPS, no reportar siniestro dentro del plazo, fumar o vapear en el vehículo)."],
 ["3.4","Término del contrato de trabajo por aplicación del artículo 160 del Código del Trabajo, en particular sus numerales 1, 5 y 7, para faltas gravísimas o reiteración de faltas graves (por ejemplo: conducir bajo"+(VEH_PEND?" [texto pendiente: falta la página siguiente del acta]":"")]
];
function vehIntro(a){
  const p=String(a.fecha||"").split("-"),dia=p[2]?String(+p[2]):"____",mes=p[1]?MESES[+p[1]-1]:"__________",anio=p[0]||"____";
  return `En ${a.ciudad||"__________"}, a ${dia} de ${mes} de ${anio}, entre CAPAC SPA (en adelante "la Empresa") y el trabajador que suscribe (en adelante "el Conductor"), se deja constancia de la entrega del vehículo individualizado y de las responsabilidades que asume en materia de seguridad, cuidado y uso, conforme al Reglamento Interno de Orden, Higiene y Seguridad (RIOHS) vigente, al contrato de arrendamiento suscrito con Salfa Rent y a la Ley 16.744.`;
}

/* ---------- Registro de entrega de activos (ficha en papel) ---------- */
const ACT_INTRO="Por medio de la presente, se hace entrega formal del (los) siguiente (s) ACTIVO (S) FIJO (S):";
const ACT_ESTADOS=["Nuevo","Bueno","Regular","Malo"];
function actCompromiso(a){
  return `A: ${a.recibe||"______________________________"}, quien ocupa el cargo de: ${a.cargo||"____________________"}, quien como responsable adquiere el compromiso de informar cualquier tipo de novedad que suceda con dicho (s) activo (s), como daño, necesidad de mantenimiento preventivo, movimiento importante a otro lugar o persona; a quien corresponda del proceso de Activos Fijos.`;
}

/* ---------- Registro de capacitaciones (v109): formato en papel de Control de Gestión ---------- */
const CAP_VER=[["Versión","01","Fecha","01-07-2026"],["Revisión","02","Fecha","01-07-2026"]];
const capPredios=a=>(a.predios||[]).map(p=>p==="Otro"?(String(a.predioOtro||"").trim()||"Otro"):p).filter(Boolean);
const capMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(t||"");return m?(+m[1])*60+(+m[2]):null};
const capMinutos=a=>{const i=capMin(a.inicio),f=capMin(a.fin);return i==null||f==null||f<=i?0:f-i};
const capDur=a=>{const d=capMinutos(a);return !d?"":d<60?d+" min":Math.floor(d/60)+" h"+(d%60?" "+d%60+" min":"")};
const capFirma=(a,p)=>((a.firmas||{})["p_"+p.id]||{});
/* participantes con algún dato (una fila vacía no cuenta) */
const capUsados=a=>(a.participantes||[]).filter(p=>p.nombre||p.rut||p.cargo||capFirma(a,p).img);
/* nombres que se sugieren: colaboradores de Rendiciones y participantes de capacitaciones anteriores, con su RUT y cargo */
function capConocidos(){const M={};try{colabs().forEach(c=>{if(c&&c.nombre&&c.activo!==false)M[c.nombre.trim().toLowerCase()]={nombre:c.nombre.trim(),rut:c.rut||"",cargo:""}})}catch(e){}
  Object.values(ACTAS).filter(a=>a.tipo==="capacitacion"&&!a.anulada&&a!==cur).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).forEach(a=>(a.participantes||[]).forEach(p=>{if(!p.nombre)return;
    const k=p.nombre.trim().toLowerCase(),o=M[k]||{nombre:p.nombre.trim(),rut:"",cargo:""};if(p.rut&&rutOk(p.rut))o.rut=p.rut;if(p.cargo)o.cargo=p.cargo;M[k]=o}));
  return M}

/* v77: en el check list de visitas, las actas de vehículo del predio junto al grupo «Camionetas» */
function camionetasPanel(v){
  const pre=v&&v.predio;if(!pre)return"";
  const L=Object.values(ACTAS).filter(a=>a.tipo==="vehiculo"&&!esDev(a)&&!a.anulada&&predioDe(a)===pre).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const porPat={};L.forEach(a=>{const k=((a.veh||{}).patente||a.id).toUpperCase();if(!porPat[k])porPat[k]=a});
  const V=Object.values(porPat);
  if(!V.length)return `<div class="info" style="border-left:5px solid var(--r-ink)"><b>Actas de vehículo en la app:</b> no hay actas de entrega registradas para ${esc(pre)}. Si el predio tiene camionetas asignadas, falta su acta.</div>`;
  const fila=a=>{const ve=a.veh||{},km=+String(ve.km||"").replace(/[^0-9]/g,""),dev=a.devolucionId&&ACTAS[a.devolucionId],cerr=a.estado==="cerrada";
    const firm=cerr?"Acta cerrada y firmada":((a.firmas||{}).conductor||{}).img?"Firmada, sin cerrar":"Acta en borrador, sin firmar";
    const prox=km?Math.ceil((km+1)/10000)*10000:0;
    return `<li><button class="lnk" data-a="axOpen" data-id="${a.id}" style="text-align:left"><b>${esc(ve.patente||"Sin patente")}</b> ${esc([ve.marca,ve.modelo].filter(Boolean).join(" "))} · ${esc(a.conductor||"sin conductor")}</button><br>
      <span class="note" style="font-size:13.5px">Entregada el ${fmtD(a.fecha)}${km?` con ${km.toLocaleString("es-CL")} km`:""} · ${dev?(dev.estado==="cerrada"?`devuelta el ${fmtD(dev.fecha)}`:"devolución en borrador"):firm}${!dev&&prox?` · mantención Salfa Rent a los ${prox.toLocaleString("es-CL")} km (±500)`:""}</span></li>`};
  return `<div class="info"><b>Actas de vehículo de ${esc(pre)} en la app (${V.length}):</b><ul style="margin:6px 0 0;padding-left:18px">${V.map(fila).join("")}</ul><span class="note" style="font-size:13px">Compara la patente y el kilometraje del tablero con lo registrado en el acta.</span></div>`;
}
/* ---------- Devoluciones (v77): textos propuestos, a confirmar por Administración ---------- */
const esDev=a=>!!a&&a.mov==="devolucion";
function vehDevIntro(a){
  const p=String(a.fecha||"").split("-"),dia=p[2]?String(+p[2]):"____",mes=p[1]?MESES[+p[1]-1]:"__________",anio=p[0]||"____";
  return `En ${a.ciudad||"__________"}, a ${dia} de ${mes} de ${anio}, el Conductor ${a.conductor||"__________"}${a.rut?", RUT "+rutFmt(a.rut):""}, hace devolución a CAPAC SPA del vehículo patente ${(a.veh||{}).patente||"______"}, recibido mediante Acta de Entrega y Responsabilidad de Vehículo de fecha ${fmtD(a.entregaFecha)||"________"}. Conforme al punto 2.13 de dicha acta, se deja constancia del estado en que se recibe el vehículo, sus accesorios, documentos, llaves y TAG.`;
}
const actDevIntro=a=>`Por medio de la presente, se deja constancia de la devolución del (los) siguiente (s) ACTIVO (S) FIJO (S), entregados a ${a.recibe||"__________"} mediante Registro de entrega de activos de fecha ${fmtD(a.entregaFecha)||"________"}:`;
const ACT_DEV_PEND="Los activos marcados como no devueltos quedan pendientes de restitución, bajo la responsabilidad de quien los recibió.";
function nuevaAxDev(e){
  prepAx(e);const base={id:uid(),tipo:e.tipo,mov:"devolucion",entregaId:e.id,entregaFecha:e.fecha,creadoPor:yo(),fecha:today(),predio:e.predio||"",predioOtro:e.predioOtro||"",items:{},firmas:{},estado:"borrador",creado:new Date().toISOString(),actualizado:new Date().toISOString()};
  if(e.tipo==="vehiculo")return Object.assign(base,{ciudad:e.ciudad||"",conductor:e.conductor||"",rut:e.rut||"",veh:Object.assign({},e.veh),kmDev:"",acc:{},llavesN:"",docs:{},estadoDesc:"",observaciones:"",
    antes:{acc:Object.assign({},e.acc),docs:Object.assign({},e.docs),llavesN:e.llavesN||"",estadoDesc:e.estadoDesc||"",km:(e.veh||{}).km||""},firmas:{conductor:{nombre:e.conductor||""}}});
  return Object.assign(base,{recibe:e.recibe||"",rutRecibe:e.rutRecibe||"",cargo:e.cargo||"",activos:(e.activos||[]).filter(x=>x.tipo||x.marca||x.ref).map(x=>Object.assign({},x,{devuelto:"",estadoDev:"",obsDev:""})),obs:"",firmas:{recibe:{nombre:e.recibe||""}}});
}
const axTitulo=a=>a.tipo==="capacitacion"?AX.capacitacion.uno:esDev(a)?(a.tipo==="vehiculo"?"Acta de devolución de vehículo":"Registro de devolución de activos"):AX[a.tipo].uno;

/* ---------- Datos comunes ---------- */
const AX={
  vehiculo:{t:"Vehículos",uno:"Acta de entrega de vehículo",corto:"Vehículo",steps:["Datos","Accesorios","Firmas"],excel:"Actas_de_vehiculos.xlsx",pdf:"Acta de entrega de vehículo.pdf",carpeta:"Vehículos",
    desc:"Acta de entrega y responsabilidad de vehículo de la flota Salfa Rent: identificación, accesorios, documentos, responsabilidades del conductor y firmas."},
  activo:{t:"Activos fijos",uno:"Registro de entrega de activos",corto:"Activo fijo",steps:["Datos","Activos","Firmas"],excel:"Entregas_de_activos.xlsx",pdf:"Registro de entrega de activos.pdf",carpeta:"Activos fijos",
    desc:"Entrega formal de activos fijos (computadores, celulares, herramientas, equipos) a la persona responsable, con firmas de quien entrega y quien recibe."},
  capacitacion:{t:"Capacitaciones",uno:"Registro de capacitación",corto:"Capacitación",steps:["Datos","Participantes","Firma y cierre"],excel:"Registro_de_capacitaciones.xlsx",pdf:"Registro de capacitación.pdf",carpeta:"Capacitaciones",
    desc:"Registro de capacitaciones y charlas: tema, relator, predios, horario y la firma de cada participante en el teléfono."}
};
let axTipo="vehiculo";
function nuevaAx(tipo){
  const base={id:uid(),tipo,creadoPor:yo(),fecha:today(),predio:"",predioOtro:"",items:{},firmas:{},estado:"borrador",creado:new Date().toISOString(),actualizado:new Date().toISOString()};
  if(tipo==="vehiculo")return Object.assign(base,{ciudad:"",conductor:"",rut:"",veh:{tipoVeh:"Camioneta"},acc:{},llavesN:"",docs:{},estadoDesc:"",observaciones:""});
  if(tipo==="capacitacion"){const d=new Date(),hh=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"),yo_=ME?ME.nombre||"":"";
    return Object.assign(base,{realizadaPor:yo_,inicio:hh,fin:"",predios:[],predioOtro:"",tema:"",detalle:"",participantes:[{id:uid().slice(-6)}],firmas:{relator:{nombre:yo_}}})}
  return Object.assign(base,{recibe:"",rutRecibe:"",cargo:"",activos:[{id:uid().slice(-6),estado:""}],obs:""});
}
function prepAx(a){if(!a.items)a.items={};if(!a.firmas)a.firmas={};if(a.tipo==="vehiculo"){a.veh=a.veh||{};a.acc=a.acc||{};a.docs=a.docs||{}}else if(a.tipo==="capacitacion"){a.predios=a.predios||[];a.participantes=a.participantes||[]}else{a.activos=a.activos||[]}return a}
const axQuien=a=>a.tipo==="capacitacion"?(String(a.tema||"").trim()||"Sin tema"):a.tipo==="vehiculo"?(a.conductor||"Sin conductor"):(a.recibe||"Sin nombre");
const axDonde=a=>a.tipo==="capacitacion"?[capPredios(a).join(", "),(n=>n?n+(n===1?" participante":" participantes"):"")(capUsados(a).length)].filter(Boolean).join(" · "):a.tipo==="vehiculo"?[(a.veh||{}).patente,[(a.veh||{}).marca,(a.veh||{}).modelo].filter(Boolean).join(" "),predioDe(a)].filter(Boolean).join(" · "):[(a.activos||[]).filter(x=>x.tipo).map(x=>x.tipo).join(", "),predioDe(a)].filter(Boolean).join(" · ");
const axEntrega=a=>{const f=(a.firmas||{})[a.tipo==="vehiculo"?"empresa":a.tipo==="capacitacion"?"relator":"entrega"]||{};return f.nombre||""};
function axFaltantes(a){
  const m=[];prepAx(a);
  if(a.tipo==="capacitacion"){
    if(!a.fecha)m.push("Fecha");if(!String(a.realizadaPor||"").trim())m.push("Realizada por (relator)");
    if(!a.inicio)m.push("Hora de inicio");if(!a.fin)m.push("Hora de término");else if(a.inicio&&!capMinutos(a))m.push("Hora de término posterior al inicio");
    if(!capPredios(a).length)m.push("Predios");if(!String(a.tema||"").trim())m.push("Tema de la capacitación");
    const P=capUsados(a);if(!P.length)m.push("Al menos un participante");
    P.forEach((p,i)=>{const n=String(p.nombre||"").trim()||`Participante ${i+1}`;if(!String(p.nombre||"").trim())m.push(`Participante ${i+1}: nombre`);
      if(!p.rut||!rutOk(p.rut))m.push(`${n}: RUT válido`);if(!capFirma(a,p).img)m.push(`${n}: firma`)});
    if(!((a.firmas||{}).relator||{}).img)m.push("Firma del relator");
    return m;
  }
  if(esDev(a)){
    if(!a.fecha)m.push("Fecha");
    if(a.tipo==="vehiculo"){if(!a.ciudad)m.push("Lugar (ciudad) de la devolución");const kd=+String(a.kmDev||"").replace(/[^0-9]/g,""),ke=+String((a.antes||{}).km||"").replace(/[^0-9]/g,"");
      if(!kd)m.push("Km de devolución");else if(ke&&kd<ke)m.push("Km de devolución menor que el de entrega");
      const sin=VEH_ACC.concat(VEH_DOC).filter(([k])=>!(a.acc[k]||a.docs[k])).length;if(sin)m.push(`${sin} ${sin===1?"accesorio o documento":"accesorios o documentos"} sin marcar Sí o No`);
      if(a.acc.llaves==="si"&&!String(a.llavesN||"").trim())m.push("Cantidad de llaves");
      if(!String(a.estadoDesc||"").trim())m.push("Descripción del estado general (daños visibles)");
      const fc=a.firmas.conductor||{},fe=a.firmas.empresa||{};if(!fc.img)m.push("Firma del conductor");if(!fe.nombre)m.push("Quién recibe por la empresa (Administración)");if(!fe.img)m.push("Firma de quien recibe por la empresa")}
    else{(a.activos||[]).forEach((x,i)=>{if(!x.devuelto)m.push(`Activo ${i+1}: marcar si se devuelve`);else if(x.devuelto==="si"&&!x.estadoDev)m.push(`Activo ${i+1}: estado al devolver`)});
      const fe=a.firmas.entrega||{},fr=a.firmas.recibe||{};if(!fr.img)m.push("Firma de quien devuelve");if(!fe.nombre)m.push("Quién recibe (Administración)");if(!fe.img)m.push("Firma de quien recibe (Administración)")}
    return m;
  }
  if(a.tipo==="vehiculo"){
    if(!a.fecha)m.push("Fecha");if(!a.ciudad)m.push("Lugar (ciudad) de la entrega");if(!predioDe(a))m.push("Predio o área");
    if(!a.conductor)m.push("Nombre del conductor");if(!a.rut||!rutOk(a.rut))m.push("RUT válido del conductor");
    VEH_ID1.concat(VEH_ID2).forEach(([k,l])=>{if(!String(a.veh[k]||"").trim())m.push(l)});
    const sin=VEH_ACC.concat(VEH_DOC).filter(([k])=>!(a.acc[k]||a.docs[k])).length;if(sin)m.push(`${sin} ${sin===1?"accesorio o documento":"accesorios o documentos"} sin marcar Sí o No`);
    if(a.acc.llaves==="si"&&!String(a.llavesN||"").trim())m.push("Cantidad de llaves");
    if(!String(a.estadoDesc||"").trim())m.push("Descripción del estado general (daños visibles)");
    const fc=a.firmas.conductor||{},fe=a.firmas.empresa||{};
    if(!fc.img)m.push("Firma del conductor");if(!fe.nombre)m.push("Quién entrega por la empresa (Administración)");if(!fe.img)m.push("Firma de quien entrega por la empresa");
    if(VEH_PEND)m.push("Completar el texto del punto 3.4 del acta (falta la página siguiente; lo actualiza TI)");
  }else{
    if(!a.fecha)m.push("Fecha");if(!predioDe(a))m.push("Predio o área");
    if(!a.recibe)m.push("Nombre de quien recibe");if(!a.cargo)m.push("Cargo de quien recibe");if(a.rutRecibe&&!rutOk(a.rutRecibe))m.push("RUT válido de quien recibe");
    const L=(a.activos||[]).filter(x=>x.tipo||x.marca||x.ref);if(!L.length)m.push("Al menos un activo");
    L.forEach((x,i)=>{if(!x.tipo)m.push(`Activo ${i+1}: tipo de activo`);if(!x.estado)m.push(`Activo ${i+1}: estado`)});
    const fe=a.firmas.entrega||{},fr=a.firmas.recibe||{};
    if(!fe.nombre)m.push("Quién entrega (Administración)");if(!fe.img)m.push("Firma de quien entrega");if(!fr.img)m.push("Firma de quien recibe");
  }
  return m;
}
const axGet=(o,p)=>p.split(".").reduce((x,k)=>x==null?x:x[k],o);
function axSet(o,p,v){const ks=p.split(".");let x=o;for(let i=0;i<ks.length-1;i++){x=x[ks[i]]=x[ks[i]]||{}}x[ks[ks.length-1]]=v}

/* ---------- Pantallas ---------- */
function topBar(titulo,back,backTxt,steps,stepAct){
  return `<div class="top"><div class="in">
    <div class="bar"${steps?"":` style="padding-bottom:10px"`}><button class="back" data-a="${back}">${esc(backTxt)}</button><div class="ttl">${esc(titulo)}</div>${estadoChip()}</div>
    ${steps?`<nav class="steps">${steps.map((s,i)=>`<button data-a="axStep" data-s="${i}" ${i===stepAct?'aria-current="step"':""}>${i+1}. ${s}</button>`).join("")}</nav>`:""}
  </div></div>`;
}
function renderAxHub(){
  const todas=Object.values(ACTAS).filter(a=>!a.anulada);
  const n=f=>todas.filter(f).length,nb=f=>todas.filter(a=>f(a)&&a.estado!=="cerrada").length;
  const cnt=(f,uno,varios)=>{const t=n(f),b=nb(f);return t?`${t} ${t===1?uno:varios}${b?` · ${b} en borrador`:""}`:"Sin registros todavía"};
  return band("Actas")+`<main class="wrap">
    <h1>Actas</h1>
    <p class="lead">Elige qué vas a registrar. Cada acta queda con fotos, firmas en el teléfono y su PDF guardado en OneDrive.</p>
    <div class="start" style="grid-template-columns:1fr">
      <button class="big ent" data-a="home"><strong>Viviendas</strong><span>Entrega y devolución de casas: check list por ambiente, fotos y firmas.</span><span><b>${cnt(esViv,"acta","actas")}</b></span></button>
      <button class="big dev" data-a="axList" data-t="vehiculo"><strong>Vehículos</strong><span>${esc(AX.vehiculo.desc)}</span><span><b>${cnt(a=>a.tipo==="vehiculo","acta","actas")}</b></span></button>
      <button class="big dev" data-a="axList" data-t="activo" style="border-left-color:var(--r-ink)"><strong>Activos fijos</strong><span>${esc(AX.activo.desc)}</span><span><b>${cnt(a=>a.tipo==="activo","entrega","entregas")}</b></span></button>
      <button class="big ent" data-a="axList" data-t="capacitacion"><strong>Capacitaciones</strong><span>${esc(AX.capacitacion.desc)}</span><span><b>${cnt(a=>a.tipo==="capacitacion","registro","registros")}</b></span></button>
    </div>
    <div class="pendslot">${slotHTML()}</div>
    <p class="note">Versión ${APP_VER}</p>
  </main>`;
}
let axQ="";
function renderAxList(){
  const T=AX[axTipo],t=axQ.trim().toLowerCase();
  const L=Object.values(ACTAS).filter(a=>a.tipo===axTipo).filter(a=>!t||[axQuien(a),axDonde(a),a.rut,a.rutRecibe,axEntrega(a),a.tipo==="capacitacion"?(a.participantes||[]).map(p=>p.nombre).join(" "):""].join(" ").toLowerCase().includes(t)).sort((a,b)=>String(b.actualizado||"").localeCompare(String(a.actualizado||"")));
  const card=a=>{const c=a.estado==="cerrada",an=!!a.anulada,f=axFaltantes(a).length;
    return `<div class="card mcard${an?" anulada":""}"><button class="row" data-a="axOpen" data-id="${a.id}">
      <span class="tag ${an?"none":c?"cerrada":"borrador"}">${an?"Anulada":c?"Cerrada":"Borrador"}</span>
      <span class="who">${esc(axQuien(a))}</span><span class="when">${fmtD(a.fecha)}</span>
      <span class="where">${esDev(a)?"<b>Devolución</b> · ":""}${esc(axDonde(a)||"Sin datos")}</span><span class="st">${c&&a.tipo==="capacitacion"?(axEntrega(a)?"Relator: "+esc(axEntrega(a)):""):c?(esDev(a)?(axEntrega(a)?"Recibió "+esc(axEntrega(a)):""):a.devolucionId&&ACTAS[a.devolucionId]?(ACTAS[a.devolucionId].estado==="cerrada"?"Devuelto el "+fmtD(ACTAS[a.devolucionId].fecha):"Devolución en borrador"):axEntrega(a)?"Entregó "+esc(axEntrega(a)):""):`${f} ${f===1?"dato pendiente":"datos pendientes"}`}</span>
      <span class="by">${chipSync(a)}${an?` <span class="aut">Anulada el ${fmtD(a.anulada.fecha)} por ${esc(quien(a.anulada.por))}${a.anulada.motivo?`: ${esc(a.anulada.motivo)}`:""}</span>`:autoriaTxt(a)?` <span class="aut">${autoriaHTML(a)}</span>`:""}</span></button>
      ${mnBtn("mnAx",a.id,"Opciones del acta de "+axQuien(a))}</div>`};
  const abiertas=L.filter(a=>a.estado!=="cerrada"),cerradas=L.filter(a=>a.estado==="cerrada");
  const CAP=axTipo==="capacitacion";
  return band(T.t,"axHub","Actas")+`<main class="wrap">
    <h1>${esc(T.t)}</h1>
    <p class="lead">${esc(T.desc)}</p>
    ${CAP?"":`<p class="note" style="margin:0 0 8px">Para registrar una <b>devolución</b>, abre el acta de entrega cerrada y toca «Registrar devolución».</p>`}
    <div class="start" style="grid-template-columns:1fr"><button class="big ent" data-a="axNew"><strong>${CAP?"Nueva capacitación":axTipo==="vehiculo"?"Entregar vehículo":"Entregar activos"}</strong><span>${CAP?"Registra el tema, el relator y los participantes; cada uno firma en el teléfono.":axTipo==="vehiculo"?"Completa el acta junto al conductor y firmen en el teléfono.":"Registra los activos, quién entrega (Administración) y quién recibe."}</span></button></div>
    <div class="pendslot">${slotHTML()}</div>
    ${L.length?`<input class="search" id="axq" type="search" placeholder="${CAP?"Buscar tema, relator o predio":axTipo==="vehiculo"?"Buscar conductor, patente o predio":"Buscar persona, activo o predio"}" value="${esc(axQ)}" style="margin-top:22px">`:""}
    <div id="axlists"><h2>En borrador<span class="cnt">${abiertas.length}</span></h2><div class="list">${abiertas.map(card).join("")||`<div class="empty">No hay borradores.</div>`}</div>
    <h2>Cerradas<span class="cnt">${cerradas.length}</span></h2><div class="list">${cerradas.map(card).join("")||`<div class="empty">${t?"Ninguna coincide con la búsqueda.":CAP?"Todavía no hay registros cerrados.":"Todavía no hay actas cerradas."}</div>`}</div></div>
    ${L.length?`<div class="btns"><button class="btn" data-a="axXlsx">Actualizar Excel en OneDrive</button></div>`:""}
    ${disTip("mnax",`En el «⋯» de cada acta están el PDF${CAP?"":", la devolución"}${esAdmin()?", anular y restaurar":" y eliminar los borradores"}. En el teléfono también puedes deslizar la fila hacia la izquierda.`)}
    <p class="note">Versión ${APP_VER}</p>
  </main>`;
}
const axDis=()=>ro()?"disabled":"";
function axInp(path,label,o){o=o||{};const v=axGet(cur,path);return `<div class="f"${o.style?` style="${o.style}"`:""}><label for="x_${path}">${esc(label)}</label><input id="x_${path}" data-x="${path}" value="${esc(v)}" ${o.type?`type="${o.type}"`:""} ${o.mode?`inputmode="${o.mode}"`:""} placeholder="${esc(o.ph||"")}" autocomplete="off" ${axDis()}>${o.hint?`<span class="hint">${esc(o.hint)}</span>`:""}${o.err||""}</div>`}
function axPredio(){
  const a=cur;return `<div class="f"><label for="x_predio">Predio o área</label><select id="x_predio" data-xs="predio" ${axDis()}><option value="">Elige</option>${AX_PREDIOS.map(p=>`<option ${a.predio===p?"selected":""}>${p}</option>`).join("")}${optPredioAntiguo(a.predio,AX_PREDIOS)}<option ${a.predio==="Otro"?"selected":""}>Otro</option></select></div>
  ${a.predio==="Otro"?axInp("predioOtro","Nombre del predio o área"):""}`;
}
function axFotos(k,titulo){
  const r=cur.items[k]||{},mine=r.fotos||[],canAdd=!ro()&&mine.length<MAXF;
  return `<div class="it" id="axf-${k}"><div class="nm"><span>${esc(titulo)}</span><span class="chip none">${mine.length} ${mine.length===1?"foto":"fotos"}</span></div>
    <div class="fotos"><div class="strip">${mine.map(f=>thumb(f,k,true,false)).join("")}${canAdd?`${ESCRITORIO()?`<label class="addf"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span>Subir foto<input class="vh" type="file" accept="image/*" multiple data-xfoto="${k}"></label>`:`<label class="addf"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>Cámara<input class="vh" type="file" accept="image/*" capture="environment" data-xfoto="${k}"></label><label class="addf"><span class="icw" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg></span>Galería<input class="vh" type="file" accept="image/*" multiple data-xfoto="${k}"></label>`}`:""}</div></div></div>`;
}
/* Persona de Administración que entrega */
function axAdmPick(role){
  const f=cur.firmas[role]||{},P=personasAdm(),sel=f.sel||(f.nombre?(P.some(p=>p.nombre===f.nombre)?f.nombre:"otro"):"");
  return `<div class="f" style="margin-bottom:6px"><label for="x_adm_${role}">Persona de Administración que ${esDev(cur)?"recibe":"entrega"}</label><select id="x_adm_${role}" data-xadm="${role}" ${axDis()}><option value="">Elige quién ${esDev(cur)?"recibe":"entrega"}</option>${P.map(p=>`<option value="${esc(p.nombre)}" ${sel===p.nombre?"selected":""}>${esc(p.nombre)}</option>`).join("")}<option value="otro" ${sel==="otro"?"selected":""}>Otra persona de Administración</option></select>${P.length?"":`<span class="hint">La lista se toma de los colaboradores de Administración cargados en Rendiciones; si no aparece, elige «Otra persona» y escribe el nombre.</span>`}</div>
  ${sel==="otro"?`<input data-xsn="${role}" value="${esc(f.nombre)}" placeholder="Nombre y apellido (Administración)" ${axDis()}>`:""}<input data-xsc="${role}" value="${esc(f.cargo)}" placeholder="Cargo (opcional)" ${axDis()}>`;
}
function axFirmas(){
  return rolesDe(cur).map(([k,l,sub])=>{const f=cur.firmas[k]||{};const adm=k==="empresa"||k==="entrega";
    return `<div class="sig"><div class="lb">${esc(l)}</div><div class="sub">${esc(sub)}</div>
      ${adm?axAdmPick(k):`<input data-xsn="${k}" value="${esc(f.nombre)}" placeholder="Nombre de quien firma" ${axDis()}>`}
      <button class="pad" data-a="sign" data-r="${k}" ${axDis()} aria-label="${f.img?"Cambiar firma":"Firmar"}">${f.img?`<img src="${f.img}" alt="Firma registrada">`:`<span>Tocar para firmar</span>`}</button></div>`}).join("");
}
function axCloseBox(){
  const m=axFaltantes(cur);
  return ro()?"":`<div class="info">Al finalizar, el acta queda cerrada, se guarda su PDF en OneDrive y ya no se puede modificar.${m.length?`<ul class="miss">${m.map(x=>`<li>Falta: ${esc(x)}</li>`).join("")}</ul>`:"<br><b>Todo listo para cerrar.</b>"}</div>
  <div class="btns"><button class="btn pri" data-a="axClose">Finalizar y cerrar acta</button><button class="btn" data-a="axBack">Guardar borrador y volver</button></div>`;
}
let axStep=0;
function renderAxEdit(){
  const a=prepAx(cur),T=AX[a.tipo];
  const body=a.tipo==="capacitacion"?[capDatos,capParticipantes,capFirmas][axStep]():esDev(a)?(a.tipo==="vehiculo"?[vehDevDatos,vehAcc,vehDevFirmas][axStep]():[actDevDatos,actDevActivos,actDevFirmas][axStep]()):a.tipo==="vehiculo"?[vehDatos,vehAcc,vehFirmas][axStep]():[actDatos,actActivos,actFirmas][axStep]();
  const nav=axStep<2?`<button class="btn" data-a="axStep" data-s="${axStep-1}" ${axStep===0?"disabled":""}>Atrás</button><button class="btn pri" data-a="axStep" data-s="${axStep+1}">Siguiente</button>`
    :`<button class="btn" data-a="axStep" data-s="1">Atrás</button>${ro()?`<button class="btn pri" data-a="axBack">Volver</button>`:`<button class="btn pri" data-a="axClose">Finalizar y cerrar acta</button>`}`;
  return topBar(axTitulo(a),"axBack",T.t,esDev(a)?["Datos",a.tipo==="vehiculo"?"Accesorios":"Activos","Firmas"]:T.steps,axStep)+`<main class="wrap"><div class="pendslot">${slotHTML()}</div>${autoriaTxt(a)?`<p class="note autoria">${autoriaHTML(a)}</p>`:""}${a.anulada?`<div class="info netbox"><b>Acta anulada</b> el ${fmtD(a.anulada.fecha)} por ${esc(quien(a.anulada.por))}${a.anulada.motivo?`: ${esc(a.anulada.motivo)}`:""}.</div>`:""}${ro()?`<div class="info lock">Acta cerrada el ${fmtD(a.cerrada)}. Ya no se puede modificar.</div>`:""}
  ${body}
  </main><div class="foot"><div class="in">${nav}</div></div><p class="note" style="text-align:center">Versión ${APP_VER}</p>`;
}
/* Capacitación · paso 1 */
function capDatos(){
  const a=cur,P=AX_PREDIOS.concat(["Otro"]);
  return `<div class="grid2">${axInp("fecha","Fecha",{type:"date"})}${axInp("realizadaPor","Realizada por (relator)",{ph:"Quien dicta la capacitación"})}</div>
  <div class="grid2">${axInp("inicio","Inicio",{type:"time"})}${axInp("fin","Fin",{type:"time"})}</div>
  <p class="note" id="capDur" style="margin-top:-4px">${capDur(a)?`Duración: <b>${capDur(a)}</b>`:""}</p>
  <div class="f"><label>Predios</label><div class="filt" style="margin:4px 0 0">${P.map(p=>`<button type="button" class="fb" data-a="axCapPred" data-v="${esc(p)}" aria-pressed="${(a.predios||[]).includes(p)}" ${axDis()}>${esc(p)}</button>`).join("")}</div><span class="hint">Marca todos los predios de los participantes.</span></div>
  ${(a.predios||[]).includes("Otro")?axInp("predioOtro","Otro predio o área"):""}
  ${axInp("tema","Tema de la capacitación",{ph:"Ej.: Capacitación módulo de rendiciones"})}
  <div class="f"><label for="x_detalle">Contenidos (opcional)</label><textarea id="x_detalle" data-x="detalle" rows="3" placeholder="Puntos que se trataron, material entregado" ${axDis()}>${esc(a.detalle)}</textarea></div>
  ${axFotos("c_fotos","Fotos de la capacitación (opcional)")}
  ${!ro()?`<div class="btns"><button class="btn danger" data-a="axDel">Eliminar borrador</button></div>`:""}`;
}
/* Capacitación · paso 2 */
/* quien ya firmó, con nombre y RUT válido, se muestra en una línea con «Editar» (Benja, 19-10-2026: con muchos participantes la lista queda larga) */
let capEdit=null;
const capListo=(a,p)=>!!(capFirma(a,p).img&&String(p.nombre||"").trim()&&p.rut&&rutOk(p.rut));
function capPart(p,i){
  const a=cur,f=capFirma(a,p),rutE=p.rut&&!rutOk(p.rut);
  if(capListo(a,p)&&(ro()||capEdit!==p.id))return `<div class="it cpc" id="cpp-${p.id}"><img class="cpf" src="${f.img}" alt="Firma de ${esc(p.nombre)}"><div class="cpt"><b>${i+1}. ${esc(p.nombre)}</b><span>${esc([rutFmt(p.rut),p.cargo].filter(Boolean).join(" · "))}</span></div>${ro()?"":`<button class="mini" data-a="axCapEdit" data-r="${p.id}" aria-label="Editar a ${esc(p.nombre)}">Editar</button>`}</div>`;
  return `<div class="it" id="cpp-${p.id}"><div class="nm"><span>${i+1}. <span class="cpn">${esc(p.nombre||"Participante")}</span></span>${f.img?'<span class="chip B">Firmó</span>':""}${!ro()?`${capEdit===p.id?`<button class="mini" data-a="axCapEdit" data-r="">Listo</button>`:""}<button class="mini danger" data-a="axCapQuitar" data-r="${p.id}">Quitar</button>`:""}</div>
    <div class="f"><label for="x_${p.id}_nombre">Nombre</label><input id="x_${p.id}_nombre" data-xp="${p.id}" data-k="nombre" list="capPers" value="${esc(p.nombre)}" placeholder="Nombre y apellido" autocomplete="off" ${axDis()}></div>
    <div class="grid2"><div class="f"><label for="x_${p.id}_rut">RUT</label><input id="x_${p.id}_rut" data-xp="${p.id}" data-k="rut" value="${esc(p.rut)}" placeholder="12.345.678-9" autocomplete="off" ${axDis()}><span class="err" id="cpe-${p.id}">${rutE?"El RUT no es válido. Revisa el dígito verificador.":""}</span></div>
      <div class="f"><label for="x_${p.id}_cargo">Cargo</label><input id="x_${p.id}_cargo" data-xp="${p.id}" data-k="cargo" value="${esc(p.cargo)}" placeholder="Ej.: Ordeñador" autocomplete="off" ${axDis()}></div></div>
    <div class="sig cpsig"><button class="pad" data-a="sign" data-r="p_${p.id}" ${axDis()} aria-label="${f.img?"Cambiar firma":"Firmar"}">${f.img?`<img src="${f.img}" alt="Firma registrada">`:`<span>Tocar para firmar</span>`}</button></div></div>`;
}
function capParticipantes(){
  const a=cur,U=capUsados(a),nf=U.filter(p=>capFirma(a,p).img).length,pct=U.length?Math.round(nf/U.length*100):0;
  const K=Object.values(capConocidos()).sort((x,y)=>x.nombre.localeCompare(y.nombre,"es"));
  return `<h1 style="font-size:22px">Participantes</h1><p class="lead" style="margin-top:0">Cada participante revisa su nombre, RUT y cargo, y firma en el teléfono.</p>
  <div class="prog"><span>${nf} de ${U.length} ${U.length===1?"firmado":"firmados"}</span><span class="meter"><i style="width:${pct}%"></i></span><span>${pct}%</span></div>
  <datalist id="capPers">${K.map(o=>`<option value="${esc(o.nombre)}"></option>`).join("")}</datalist>
  ${(a.participantes||[]).map(capPart).join("")||`<div class="empty">Todavía no hay participantes.</div>`}
  ${ro()?"":`<div class="btns"><button class="btn" data-a="axCapAdd">Agregar participante</button></div>`}`;
}
/* Capacitación · paso 3 */
function capFirmas(){
  const a=cur,f=(a.firmas||{}).relator||{},U=capUsados(a);
  return `<h1 style="font-size:22px">Registro de capacitación</h1>
  <div class="acta"><p><b>${esc(String(a.tema||"").trim()||"Sin tema")}</b>${a.detalle?`<br>${esc(a.detalle)}`:""}</p>
    <p>${fmtD(a.fecha)}${a.inicio?` · de ${esc(a.inicio)}${a.fin?" a "+esc(a.fin):""}`:""}${capDur(a)?` (${capDur(a)})`:""}<br>${esc(capPredios(a).join(", ")||"Sin predios")} · ${U.length} ${U.length===1?"participante":"participantes"}, ${U.filter(p=>capFirma(a,p).img).length} con firma</p></div>
  <div class="dlbox"><b>Descarga</b><br><span style="font-size:14px;color:var(--muted)">El PDF trae el registro con la firma de cada participante y las fotos al final.</span><div class="btns"><button class="btn pri" data-a="axPdf" data-id="${a.id}">Descargar PDF</button></div></div>
  <h2>Firma del relator</h2><div class="sigs"><div class="sig"><div class="lb">Relator(a)</div><div class="sub">${esc(a.realizadaPor||"Escribe quién la realiza en el paso 1")}</div>
    <button class="pad" data-a="sign" data-r="relator" ${axDis()} aria-label="${f.img?"Cambiar firma":"Firmar"}">${f.img?`<img src="${f.img}" alt="Firma registrada">`:`<span>Tocar para firmar</span>`}</button></div></div>
  <div id="closeBox">${axCloseBox()}</div>`;
}
/* Vehículo · paso 1 */
function vehDatos(){
  const a=cur,rutMsg=`<span class="err" id="axRutErr">${a.rut&&!rutOk(a.rut)?"El RUT no es válido. Revisa el dígito verificador.":""}</span>`;
  return `<div class="grid2">${axInp("ciudad","Lugar de la entrega (ciudad)",{ph:"Ej.: Osorno"})}${axInp("fecha","Fecha",{type:"date"})}</div>
  ${axPredio()}
  <div class="grid2">${axInp("conductor","Conductor(a)",{ph:"Nombre completo"})}${axInp("rut","RUT del conductor(a)",{ph:"12.345.678-9",err:rutMsg})}</div>
  <h2>1. Identificación del vehículo</h2>
  <div class="grid2">${VEH_ID1.map(([k,l])=>axInp("veh."+k,l,{ph:k==="tipoVeh"?"Ej.: Camioneta":k==="marca"?"Ej.: GWM":k==="modelo"?"Ej.: Poer":"Ej.: 2027",mode:k==="anio"?"numeric":""})).join("")}</div>
  <div class="grid2">${VEH_ID2.map(([k,l])=>axInp("veh."+k,l,{ph:k==="patente"?"Ej.: WBHD30":k==="combustible"?"Ej.: Petróleo":"Ej.: 28",mode:k==="km"?"numeric":""})).join("")}</div>
  ${!ro()?`<div class="btns"><button class="btn danger" data-a="axDel">Eliminar borrador</button></div>`:""}`;
}
function ynHTML(grp,k,l){
  const v=(cur[grp]||{})[k],dev=esDev(cur),ant=dev?((cur.antes||{})[grp]||{})[k]:null,falta=dev&&ant==="si"&&v==="no";
  return `<div class="it${falta?" worse":""}" id="yn-${grp}-${k}"><div class="nm"><span>${esc(l)}</span>${dev?`<span class="chip ${ant==="si"?"B":ant==="no"?"M":"none"}">Entrega: ${ant==="si"?"Sí":ant==="no"?"No":"sin dato"}${k==="llaves"&&ant==="si"&&(cur.antes||{}).llavesN?" ("+esc(cur.antes.llavesN)+")":""}</span>`:""}</div>
    <div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="${esc(l)}"><button data-a="axYN" data-g="${grp}" data-k="${k}" data-v="si" data-e="C" aria-pressed="${v==="si"}" ${axDis()}>Sí</button><button data-a="axYN" data-g="${grp}" data-k="${k}" data-v="no" data-e="N" aria-pressed="${v==="no"}" ${axDis()}>No</button></div>
    ${k==="llaves"&&v==="si"?`<div class="f" style="margin:8px 0 0"><label for="x_llavesN">Cantidad de llaves</label><input id="x_llavesN" data-x="llavesN" inputmode="numeric" value="${esc(cur.llavesN)}" placeholder="Ej.: 4" ${axDis()}></div>`:""}</div>`;
}
/* Vehículo · paso 2 */
function vehAcc(){
  const a=cur,n=VEH_ACC.concat(VEH_DOC).filter(([k])=>a.acc[k]||a.docs[k]).length,T=VEH_ACC.length+VEH_DOC.length;
  return `<h1 style="font-size:22px">${esDev(a)?"Accesorios y documentación devuelta":"Accesorios y documentación entregada"}</h1>${esDev(a)?`<div class="info">Junto a cada ítem se ve lo que se entregó. Si algo se entregó y no vuelve, queda destacado.${(a.antes||{}).estadoDesc?`<br><b>Estado al entregar:</b> ${esc(a.antes.estadoDesc)}`:""}</div>`:""}
  <div class="prog"><span>${n} de ${T} marcados</span><span class="meter"><i style="width:${Math.round(n/T*100)}%"></i></span><span>${Math.round(n/T*100)}%</span></div>
  <section class="sec"><h3>Accesorios</h3>${VEH_ACC.map(([k,l],i)=>ynHTML("acc",k,`${i+1}. ${l}`)).join("")}</section>
  <section class="sec"><h3>12. Documentación</h3>${VEH_DOC.map(([k,l])=>ynHTML("docs",k,l)).join("")}</section>
  <section class="sec"><h3>13. Estado general (daños visibles)</h3>
    <div class="f"><label for="x_estadoDesc">Descripción</label><textarea id="x_estadoDesc" data-x="estadoDesc" rows="3" placeholder="Ej.: sin daños visibles / rayón en puerta trasera derecha" ${axDis()}>${esc(a.estadoDesc)}</textarea></div>
    ${VEH_FOTOS.map(([k,l])=>axFotos(k,l)).join("")}</section>
  <div class="f"><label for="x_observaciones">Observaciones</label><textarea id="x_observaciones" data-x="observaciones" rows="3" placeholder="Accesorios faltantes, detalles de la entrega" ${axDis()}>${esc(a.observaciones)}</textarea></div>`;
}
/* Vehículo · paso 3 */
function vehFirmas(){
  const a=cur;
  return `<h1 style="font-size:22px">${VEH_TIT.charAt(0)+VEH_TIT.slice(1).toLowerCase()}</h1>
  <div class="acta"><p>${esc(vehIntro(a))}</p>
  <details class="resp"${ro()?"":" open"}><summary><b>2. Responsabilidades de Seguridad del Conductor</b> y 3. Régimen disciplinario (leer junto al conductor)</summary>
    <p>${esc(VEH_R2)}</p>${VEH_RESP.map(([n,t,x])=>`<p>${n?`<b>${esc(n)} ${esc(t)}</b> `:""}${esc(x)}</p>`).join("")}
    <p class="k">3. Régimen disciplinario y medidas aplicables</p><p>${esc(VEH_R3)}</p>${VEH_DISC.map(([n,x])=>`<p><b>${n}</b> ${esc(x)}</p>`).join("")}
  </details></div>
  ${VEH_PEND?`<div class="info" style="background:var(--r-bg);color:var(--r-ink)">El texto del punto 3.4 está incompleto: falta la página siguiente del acta en papel. Hasta completarlo, el acta se puede llenar y firmar como borrador, pero no cerrar.</div>`:""}
  <div class="dlbox"><b>Descarga</b><br><span style="font-size:14px;color:var(--muted)">El PDF trae el acta completa con las fotos al final.</span><div class="btns"><button class="btn pri" data-a="axPdf" data-id="${a.id}">Descargar PDF</button></div></div>
  <h2>Firmas</h2><div class="sigs">${axFirmas()}</div>
  <div id="closeBox">${axCloseBox()}</div>`;
}
/* Activo · paso 1 */
function actDatos(){
  const a=cur,rutMsg=`<span class="err" id="axRutErr">${a.rutRecibe&&!rutOk(a.rutRecibe)?"El RUT no es válido. Revisa el dígito verificador.":""}</span>`;
  return `<div class="grid2">${axInp("fecha","Fecha",{type:"date"})}<div>${axPredio()}</div></div>
  <h2>Recibe</h2>
  <div class="grid2">${axInp("recibe","Nombre de quien recibe",{ph:"Nombre completo"})}${axInp("rutRecibe","RUT (opcional)",{ph:"12.345.678-9",err:rutMsg})}</div>
  ${axInp("cargo","Cargo de quien recibe",{ph:"Ej.: Administrador de campo"})}
  <h2>Entrega</h2>
  <div class="sig" style="padding-bottom:12px">${axAdmPick("entrega")}</div>
  ${!ro()?`<div class="btns"><button class="btn danger" data-a="axDel">Eliminar borrador</button></div>`:""}`;
}
/* Activo · paso 2 */
function actActivos(){
  const a=cur;
  const row=(x,i)=>`<div class="it" id="axa-${x.id}"><div class="nm"><span>Activo ${i+1}</span>${!ro()&&a.activos.length>1?`<button class="mini danger" data-a="axDelAct" data-r="${x.id}">Quitar</button>`:""}</div>
    <div class="grid2">${[["tipo","Tipo de activo","Ej.: Notebook"],["marca","Marca","Ej.: Lenovo"],["ref","Referencia","Modelo o N° de serie"],["factura","Factura","N° de factura"],["valor","Valor referencial","Ej.: 650.000"]].map(([k,l,ph])=>`<div class="f"><label for="x_${x.id}_${k}">${l}</label><input id="x_${x.id}_${k}" data-xa="${x.id}" data-k="${k}" value="${esc(x[k])}" placeholder="${ph}" ${k==="valor"?'inputmode="numeric"':""} autocomplete="off" ${axDis()}></div>`).join("")}
    <div class="f"><label for="x_${x.id}_estado">Estado</label><select id="x_${x.id}_estado" data-xa="${x.id}" data-k="estado" ${axDis()}><option value="">Elige</option>${ACT_ESTADOS.map(e=>`<option ${x.estado===e?"selected":""}>${e}</option>`).join("")}</select></div></div>
    <div class="f"><label for="x_${x.id}_obs">Observación</label><input id="x_${x.id}_obs" data-xa="${x.id}" data-k="obs" value="${esc(x.obs)}" placeholder="Accesorios incluidos, detalles" ${axDis()}></div>
    ${axFotos("a_"+x.id,"Fotos del activo (opcional)").replace('class="it"','class="it" style="border:0;padding:0;margin:0"')}</div>`;
  return `<h1 style="font-size:22px">Activos que se entregan</h1><p class="lead" style="margin-top:0">${esc(ACT_INTRO)}</p>
  ${a.activos.map(row).join("")}
  ${ro()?"":`<div class="btns"><button class="btn" data-a="axAddAct">Agregar otro activo</button></div>`}
  <div class="f"><label for="x_obs">Observaciones generales</label><textarea id="x_obs" data-x="obs" rows="3" ${axDis()}>${esc(a.obs)}</textarea></div>`;
}
/* Activo · paso 3 */
function actFirmas(){
  const a=cur;
  return `<h1 style="font-size:22px">Registro de entrega de activos</h1>
  <div class="acta"><p>${esc(actCompromiso(a))}</p></div>
  <div class="dlbox"><b>Descarga</b><br><span style="font-size:14px;color:var(--muted)">El PDF trae la ficha completa con las fotos al final.</span><div class="btns"><button class="btn pri" data-a="axPdf" data-id="${a.id}">Descargar PDF</button></div></div>
  <h2>Firmas</h2><div class="sigs">${axFirmas()}</div>
  <div id="closeBox">${axCloseBox()}</div>`;
}
/* Devolución de vehículo · paso 1 */
function vehDevDatos(){
  const a=cur,ke=+String((a.antes||{}).km||"").replace(/[^0-9]/g,""),kd=+String(a.kmDev||"").replace(/[^0-9]/g,"");
  return `<div class="info">Devolución del vehículo <b>${esc((a.veh||{}).patente||"")}</b> ${esc([(a.veh||{}).marca,(a.veh||{}).modelo].filter(Boolean).join(" "))}, entregado a <b>${esc(a.conductor||"")}</b> el ${fmtD(a.entregaFecha)}.${ACTAS[a.entregaId]?` <button class="lnk" data-a="axOpen" data-id="${a.entregaId}">Ver acta de entrega</button>`:""}</div>
  <div class="grid2">${axInp("ciudad","Lugar de la devolución (ciudad)",{ph:"Ej.: Osorno"})}${axInp("fecha","Fecha de devolución",{type:"date"})}</div>
  ${axPredio()}
  <div class="grid2"><div class="f"><label>Km de entrega</label><input value="${esc((a.antes||{}).km||"")}" disabled></div>${axInp("kmDev","Km de devolución",{mode:"numeric",ph:"Lo que marca el tablero"})}</div>
  ${ke&&kd?`<p class="note">${kd>=ke?`Recorrido con el conductor: <b>${(kd-ke).toLocaleString("es-CL")} km</b>.`:`<b style="color:var(--m-ink)">El km de devolución es menor que el de entrega.</b>`}</p>`:""}
  ${!ro()?`<div class="btns"><button class="btn danger" data-a="axDel">Eliminar borrador</button></div>`:""}`;
}
function vehDevFirmas(){
  const a=cur,falt=VEH_ACC.concat(VEH_DOC).filter(([k])=>((a.antes||{}).acc||{})[k]==="si"&&a.acc[k]==="no"||((a.antes||{}).docs||{})[k]==="si"&&a.docs[k]==="no").map(([,l])=>l);
  return `<h1 style="font-size:22px">Acta de devolución de vehículo</h1>
  <div class="acta"><p>${esc(vehDevIntro(a))}</p>${falt.length?`<p><b>No se devuelven:</b> ${esc(falt.join(", "))}.</p>`:`<p>Se devuelven todos los accesorios y documentos entregados.</p>`}</div>
  <div class="dlbox"><b>Descarga</b><br><span style="font-size:14px;color:var(--muted)">El PDF compara la devolución con la entrega y trae las fotos al final.</span><div class="btns"><button class="btn pri" data-a="axPdf" data-id="${a.id}">Descargar PDF</button></div></div>
  <h2>Firmas</h2><div class="sigs">${axFirmas()}</div>
  <div id="closeBox">${axCloseBox()}</div>`;
}
/* Devolución de activos */
function actDevDatos(){
  const a=cur;
  return `<div class="info">Devolución de activos entregados a <b>${esc(a.recibe||"")}</b>${a.cargo?` (${esc(a.cargo)})`:""} el ${fmtD(a.entregaFecha)}.${ACTAS[a.entregaId]?` <button class="lnk" data-a="axOpen" data-id="${a.entregaId}">Ver registro de entrega</button>`:""}</div>
  <div class="grid2">${axInp("fecha","Fecha de devolución",{type:"date"})}<div>${axPredio()}</div></div>
  <h2>Recibe</h2><div class="sig" style="padding-bottom:12px">${axAdmPick("entrega")}</div>
  ${!ro()?`<div class="btns"><button class="btn danger" data-a="axDel">Eliminar borrador</button></div>`:""}`;
}
function actDevActivos(){
  const a=cur;
  const row=(x,i)=>`<div class="it${x.devuelto==="no"?" worse":""}" id="axa-${x.id}"><div class="nm"><span>${i+1}. ${esc([x.tipo,x.marca].filter(Boolean).join(" · ")||"Activo")}</span><span class="chip none">Entrega: ${esc(x.estado||"sin estado")}</span></div>
    ${x.ref?`<p class="note" style="margin:0 0 6px">${esc(x.ref)}</p>`:""}
    <div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="¿Se devuelve?"><button data-a="axDevA" data-r="${x.id}" data-v="si" data-e="C" aria-pressed="${x.devuelto==="si"}" ${axDis()}>Se devuelve</button><button data-a="axDevA" data-r="${x.id}" data-v="no" data-e="N" aria-pressed="${x.devuelto==="no"}" ${axDis()}>No se devuelve</button></div>
    ${x.devuelto==="si"?`<div class="f" style="margin-top:8px"><label for="x_${x.id}_estadoDev">Estado al devolver</label><select id="x_${x.id}_estadoDev" data-xa="${x.id}" data-k="estadoDev" ${axDis()}><option value="">Elige</option>${ACT_ESTADOS.filter(e=>e!=="Nuevo").map(e=>`<option ${x.estadoDev===e?"selected":""}>${e}</option>`).join("")}</select></div>`:""}
    ${x.devuelto?`<div class="f"><label for="x_${x.id}_obsDev">Observación</label><input id="x_${x.id}_obsDev" data-xa="${x.id}" data-k="obsDev" value="${esc(x.obsDev)}" placeholder="${x.devuelto==="no"?"Motivo: extravío, robo, queda asignado…":"Daños, accesorios faltantes"}" ${axDis()}></div>`:""}
    ${x.devuelto==="si"?axFotos("a_"+x.id,"Fotos al devolver (opcional)").replace('class="it"','class="it" style="border:0;padding:0;margin:0"'):""}</div>`;
  return `<h1 style="font-size:22px">Activos que se devuelven</h1><p class="lead" style="margin-top:0">${esc(actDevIntro(a))}</p>
  ${(a.activos||[]).map(row).join("")||`<div class="empty">El registro de entrega no tiene activos.</div>`}
  <div class="f"><label for="x_obs">Observaciones generales</label><textarea id="x_obs" data-x="obs" rows="3" ${axDis()}>${esc(a.obs)}</textarea></div>`;
}
function actDevFirmas(){
  const a=cur,no=(a.activos||[]).filter(x=>x.devuelto==="no");
  return `<h1 style="font-size:22px">Registro de devolución de activos</h1>
  <div class="acta"><p>${esc(actDevIntro(a))}</p><p>${(a.activos||[]).filter(x=>x.devuelto==="si").length} de ${(a.activos||[]).length} ${(a.activos||[]).length===1?"activo devuelto":"activos devueltos"}.</p>${no.length?`<p><b>No se devuelven:</b> ${esc(no.map(x=>[x.tipo,x.marca].filter(Boolean).join(" ")).join(", "))}. ${esc(ACT_DEV_PEND)}</p>`:""}</div>
  <div class="dlbox"><b>Descarga</b><br><span style="font-size:14px;color:var(--muted)">El PDF trae la ficha de devolución con las fotos al final.</span><div class="btns"><button class="btn pri" data-a="axPdf" data-id="${a.id}">Descargar PDF</button></div></div>
  <h2>Firmas</h2><div class="sigs">${axFirmas()}</div>
  <div id="closeBox">${axCloseBox()}</div>`;
}
function axUpdClose(){const b=$("#closeBox");if(b&&view==="axe"&&axStep===2)b.innerHTML=axCloseBox()}
function axTouch(){touch();axUpdClose()}

/* ---------- Eventos ---------- */
async function axClick(A,b){
  if(A==="axHub"){await flush();cur=null;go("axhub");return true}
  if(A==="axList"){await flush();cur=null;axTipo=b.dataset.t||axTipo;axQ="";go("axl");return true}
  if(A==="axBack"){await flush();const t=cur?cur.tipo:axTipo;cur=null;axTipo=t;go("axl");return true}
  if(A==="axNew"){cur=nuevaAx(axTipo);axStep=0;await saveActa(cur);go("axe");return true}
  if(A==="axOpen"){await flush();const x=ACTAS[b.dataset.id];if(!x)return true;cur=prepAx(x);axTipo=x.tipo;axStep=0;go("axe");return true}
  if(A==="axStep"){const s=+b.dataset.s;if(s<0||s>2)return true;axStep=s;window.scrollTo(0,0);render();return true}
  if(A==="axDev"){await flush();const e=ACTAS[b.dataset.id];if(!e||e.estado!=="cerrada"||esDev(e))return true;
    if(e.devolucionId&&ACTAS[e.devolucionId]){cur=prepAx(ACTAS[e.devolucionId]);axTipo=cur.tipo;axStep=0;go("axe");return true}
    const d=nuevaAxDev(e);await saveActa(d);e.devolucionId=d.id;e.actualizado=new Date().toISOString();await saveActa(e);cur=d;axTipo=d.tipo;axStep=0;go("axe");return true}
  if(A==="axDevA"){if(ro())return true;const x=(cur.activos||[]).find(y=>y.id===b.dataset.r);if(!x)return true;x.devuelto=x.devuelto===b.dataset.v?"":b.dataset.v;if(x.devuelto!=="si"){x.estadoDev=""}touch();const keep=window.scrollY;render();window.scrollTo(0,keep);return true}
  if(A==="axYN"){if(ro())return true;const g=b.dataset.g,k=b.dataset.k,v=b.dataset.v;cur[g]=cur[g]||{};cur[g][k]=cur[g][k]===v?undefined:v;if(!cur[g][k])delete cur[g][k];touch();const keep=window.scrollY;render();window.scrollTo(0,keep);return true}
  if(A==="axCapPred"){if(ro()||!cur)return true;const v=b.dataset.v,P=cur.predios=cur.predios||[];const i=P.indexOf(v);if(i>=0){P.splice(i,1);if(v==="Otro")cur.predioOtro=""}else P.push(v);
    cur.predio=capPredios(cur).join(", ");touch();const keep=window.scrollY;render();window.scrollTo(0,keep);if(v==="Otro"&&i<0){const el=$("#x_predioOtro");if(el)el.focus({preventScroll:true})}return true}
  if(A==="axCapEdit"){if(ro()||!cur)return true;capEdit=b.dataset.r||null;const keep=window.scrollY;render();window.scrollTo(0,keep);if(capEdit){const el=$("#x_"+capEdit+"_nombre");if(el)el.focus({preventScroll:true})}return true}
  if(A==="axCapAdd"){if(ro()||!cur)return true;capEdit=null;const p={id:uid().slice(-6)};cur.participantes.push(p);touch();render();const el=$("#x_"+p.id+"_nombre");if(el){el.scrollIntoView({block:"center"});el.focus()}return true}
  if(A==="axCapQuitar"){if(ro()||!cur)return true;const r=b.dataset.r,p=cur.participantes.find(y=>y.id===r);if(!p)return true;
    if((p.nombre||p.rut||p.cargo||capFirma(cur,p).img)&&!(await ask("¿Quitar este participante?",[p.nombre,p.rut?rutFmt(p.rut):""].filter(Boolean).join(" · ")+(capFirma(cur,p).img?". Se borra también su firma.":""),"Quitar",true)))return true;
    cur.participantes=cur.participantes.filter(y=>y.id!==r);delete cur.firmas["p_"+r];touch();const keep=window.scrollY;render();window.scrollTo(0,keep);return true}
  if(A==="axAddAct"){if(ro())return true;cur.activos.push({id:uid().slice(-6),estado:""});touch();render();const l=cur.activos[cur.activos.length-1];const el=$("#x_"+l.id+"_tipo");if(el){el.scrollIntoView({block:"center"});el.focus()}return true}
  if(A==="axDelAct"){if(ro())return true;const r=b.dataset.r,x=cur.activos.find(y=>y.id===r);if(!x)return true;
    if((x.tipo||x.marca||x.ref)&&!(await ask("¿Quitar este activo?",[x.tipo,x.marca,x.ref].filter(Boolean).join(" · "),"Quitar",true)))return true;
    cur.activos=cur.activos.filter(y=>y.id!==r);const it=cur.items["a_"+r];if(it){(it.fotos||[]).forEach(f=>borrarFotoRef(f));delete cur.items["a_"+r]}touch();const keep=window.scrollY;render();window.scrollTo(0,keep);return true}
  if(A==="axDel"){const a=b.dataset.id?ACTAS[b.dataset.id]:cur;if(!a||a.estado==="cerrada")return true;
    if(!(await ask("¿Eliminar este borrador?",`${axTitulo(a)} · ${axQuien(a)}. Se borran el acta y sus fotos. No se puede deshacer.`,"Eliminar",true)))return true;
    await removeActa(a.id);Object.values(a.items||{}).forEach(r=>(r.fotos||[]).forEach(f=>borrarFotoRef(f)));
    if(esDev(a)&&a.entregaId&&ACTAS[a.entregaId]&&ACTAS[a.entregaId].devolucionId===a.id){const e=ACTAS[a.entregaId];delete e.devolucionId;e.actualizado=new Date().toISOString();await saveActa(e)}
    if(cur&&cur.id===a.id)cur=null;axTipo=a.tipo;go("axl");toast("Borrador eliminado.");return true}
  if(A==="axDelFoto"){if(!cur||ro())return true;const k=b.dataset.k,ref=b.dataset.ref;if(!(await ask("¿Eliminar esta foto?","","Eliminar",true)))return true;
    const r=cur.items[k]||{};r.fotos=(r.fotos||[]).filter(x=>x!==ref);delete LOST[ref];borrarFotoRef(ref);touch();const keep=window.scrollY;render();window.scrollTo(0,keep);toast("Foto eliminada.");return true}
  if(A==="axPdf"){const a=b.dataset.id?ACTAS[b.dataset.id]:cur;if(a)await axDescargar(a);return true}
  if(A==="axXlsx"){await axXlsx(axTipo,true);return true}
  if(A==="axClose"){if(!cur||ro())return true;const m=axFaltantes(cur);
    if(m.length){const g=await ask("Faltan datos para cerrar el acta","Completa lo siguiente. Mientras tanto queda guardada como borrador.","Ir a completar",false,`<ul class="miss" style="margin:0 0 12px">${m.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`);
      if(g&&cur.tipo==="capacitacion"){axStep=m.some(x=>/^(Fecha|Realizada|Hora|Predios|Tema)/.test(x))?0:m.some(x=>/participante|: RUT|: firma/i.test(x))?1:2;window.scrollTo(0,0);render();return true}
      if(g){const datos=/^(Fecha|Lugar|Predio|Nombre|RUT|Cargo|Quién entrega \(Admin|Tipo Vehículo|Marca|Modelo|Año|Patente|Combustible|Km)/;axStep=m.some(x=>datos.test(x)&&!/firma/i.test(x))?0:m.some(x=>/accesorio|llaves|Descripción|activo/i.test(x))?1:2;window.scrollTo(0,0);render()}return true}
    if(!(await ask("¿Finalizar y cerrar el acta?","Quedará cerrada, su PDF se guardará en OneDrive y ya no se podrá modificar.","Cerrar acta")))return true;
    cur.estado="cerrada";cur.cerrada=today();cur.actualizado=new Date().toISOString();if(ME)cur.cerradoPor=yo();await saveActa(cur);
    const t=cur.tipo;cur=null;axTipo=t;go("axl");exito("Acta cerrada","");if(DB&&navigator.onLine!==false)setTimeout(()=>{axXlsx(t,false);pdfsPendientes()},3000);return true}
  if(A==="axAnular"){const a=ACTAS[b.dataset.id];if(!a||!esAdmin()||a.estado!=="cerrada")return true;
    if(!(await ask(`¿Anular el acta de ${axQuien(a)}?`,"Quedará tachada, con el motivo y tu nombre. Se puede restaurar.","Anular",true,`<div class="f"><label for="motAn">Motivo</label><input id="motAn" placeholder="Ej.: acta de prueba"></div>`)))return true;
    const mot=(document.querySelector("#motAn")||{}).value||"";a.anulada={por:yo(),fecha:today(),motivo:mot.trim()};a.actualizado=new Date().toISOString();await saveActa(a);render();toast("Acta anulada.");if(DB&&navigator.onLine!==false)axXlsx(a.tipo,false);return true}
  if(A==="axRest"){const a=ACTAS[b.dataset.id];if(!a||!esAdmin())return true;if(!(await ask("¿Restaurar el acta?","Volverá a contar en los registros.","Restaurar")))return true;
    delete a.anulada;a.actualizado=new Date().toISOString();await saveActa(a);render();toast("Acta restaurada.");if(DB&&navigator.onLine!==false)axXlsx(a.tipo,false);return true}
  return false;
}
function axInput(ev){
  const t=ev.target;
  if(t.id==="axq"){axQ=t.value;const L=$("#axlists");if(L){const tmp=document.createElement("div");tmp.innerHTML=renderAxList();L.innerHTML=tmp.querySelector("#axlists").innerHTML}return}
  if(view!=="axe"||!cur||ro())return;
  if(t.dataset.x){axSet(cur,t.dataset.x,t.value);
    if(t.dataset.x==="conductor"||t.dataset.x==="recibe"){const role=t.dataset.x==="conductor"?"conductor":"recibe";const f=cur.firmas[role]||{};if(!f.nombre||f.nombre===cur._lastN){cur.firmas[role]=Object.assign(f,{nombre:t.value})}cur._lastN=t.value}
    if(t.dataset.x==="rut"||t.dataset.x==="rutRecibe"){const e=$("#axRutErr");if(e)e.textContent=""}
    if(t.dataset.x==="realizadaPor")cur.firmas.relator=Object.assign(cur.firmas.relator||{},{nombre:t.value});
    if(t.dataset.x==="predioOtro"&&cur.tipo==="capacitacion")cur.predio=capPredios(cur).join(", ");
    if(t.dataset.x==="inicio"||t.dataset.x==="fin"){const n=$("#capDur");if(n)n.innerHTML=capDur(cur)?`Duración: <b>${capDur(cur)}</b>`:""}
    axTouch();return}
  if(t.dataset.xp){const p=(cur.participantes||[]).find(y=>y.id===t.dataset.xp);if(!p)return;const k=t.dataset.k;p[k]=t.value;
    if(k==="nombre"){cur.firmas["p_"+p.id]=Object.assign(cur.firmas["p_"+p.id]||{},{nombre:t.value});const h=$("#cpp-"+p.id+" .cpn");if(h)h.textContent=t.value||"Participante"}
    if(k==="rut"){const e=$("#cpe-"+p.id);if(e)e.textContent=""}
    axTouch();return}
  if(t.dataset.xa){const x=cur.activos.find(y=>y.id===t.dataset.xa);if(x){x[t.dataset.k]=t.value;axTouch()}return}
  if(t.dataset.xsn){cur.firmas[t.dataset.xsn]=Object.assign(cur.firmas[t.dataset.xsn]||{},{nombre:t.value});axTouch();return}
  if(t.dataset.xsc){cur.firmas[t.dataset.xsc]=Object.assign(cur.firmas[t.dataset.xsc]||{},{cargo:t.value});axTouch();return}
}
function axChange(ev){
  const t=ev.target;if(view!=="axe"||!cur||ro())return;
  if(t.dataset.xfoto){const files=[...t.files];t.value="";const k=t.dataset.xfoto;addFotos(cur,k,files).then(()=>{if(view==="axe"){const keep=window.scrollY;render();window.scrollTo(0,keep)}});return}
  if(t.dataset.xs){cur[t.dataset.xs]=t.value;touch();const keep=window.scrollY;render();window.scrollTo(0,keep);return}
  if(t.dataset.xa){const x=cur.activos.find(y=>y.id===t.dataset.xa);if(x){x[t.dataset.k]=t.value;axTouch()}return}
  if(t.dataset.xp){const p=(cur.participantes||[]).find(y=>y.id===t.dataset.xp);if(!p)return;const k=t.dataset.k;
    if(k==="rut"){p.rut=rutFmt(t.value);t.value=p.rut;const e=$("#cpe-"+p.id);if(e)e.textContent=p.rut&&!rutOk(p.rut)?"El RUT no es válido. Revisa el dígito verificador.":""}
    if(k==="nombre"){p.nombre=String(t.value).replace(/\s+/g," ").trim();t.value=p.nombre;const o=capConocidos()[p.nombre.toLowerCase()];
      if(o){if(o.nombre!==p.nombre){p.nombre=o.nombre;t.value=o.nombre}if(!p.rut&&o.rut){p.rut=rutFmt(o.rut);const i=$("#x_"+p.id+"_rut");if(i)i.value=p.rut}if(!p.cargo&&o.cargo){p.cargo=o.cargo;const i=$("#x_"+p.id+"_cargo");if(i)i.value=p.cargo}}
      cur.firmas["p_"+p.id]=Object.assign(cur.firmas["p_"+p.id]||{},{nombre:p.nombre});const h=$("#cpp-"+p.id+" .cpn");if(h)h.textContent=p.nombre||"Participante"}
    if(k==="cargo"){p.cargo=String(t.value).trim();t.value=p.cargo}
    touch();axUpdClose();return}
  if(t.dataset.xadm){const role=t.dataset.xadm,v=t.value,f=cur.firmas[role]||{};const prev=f.sel||f.nombre||"";
    if(f.img&&prev&&prev!==v){delete f.img;delete f.fechaFirma;toast("Cambió la persona de Administración: la firma anterior se borró.")}
    f.sel=v;if(v==="otro"){if(personasAdm().some(p=>p.nombre===f.nombre))f.nombre=""}else{f.nombre=v;if(!f.cargo)f.cargo="Administración"}
    cur.firmas[role]=f;touch();const keep=window.scrollY;render();window.scrollTo(0,keep);
    if(v==="otro"){const i=document.querySelector(`[data-xsn="${role}"]`);if(i)i.focus({preventScroll:true})}return}
  if(t.dataset.x==="rut"||t.dataset.x==="rutRecibe"){const k=t.dataset.x;cur[k]=rutFmt(t.value);t.value=cur[k];const e=$("#axRutErr");if(e)e.textContent=cur[k]&&!rutOk(cur[k])?"El RUT no es válido. Revisa el dígito verificador.":"";touch()}
  if(t.dataset.x&&t.dataset.x.startsWith("veh.patente")){cur.veh.patente=String(t.value).toUpperCase().replace(/[^A-Z0-9]/g,"");t.value=cur.veh.patente;touch()}
  axUpdClose();
}
function axVerFoto(ref,k){
  const src=fotoSrc(ref);if(!src){toast(LOST[ref]?"Esta foto no se pudo recuperar.":"La foto todavía se está descargando.");return}
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet viewer" role="dialog" aria-modal="true" aria-label="Foto"><h3>Foto</h3><img src="${esc(src)}" alt="Foto del acta"><div class="btns">${!ro()?`<button class="btn danger" data-m="del">Eliminar foto</button>`:""}<button class="btn pri" data-m="close" style="flex:1">Cerrar</button></div></div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";const close=()=>{m.remove();document.body.style.overflow=""};
  m.addEventListener("click",e=>{const x=e.target.dataset&&e.target.dataset.m;if(e.target===m||x==="close")close();if(x==="del"){close();axClick("axDelFoto",{dataset:{k,ref}})}});
}

/* ---------- PDF ---------- */
function axHeaderVeh(d,tit){
  const L=15,W=180;d.setDrawColor(0);d.setLineWidth(0.2);d.setTextColor(0);
  try{const lh=20,lw=lh*LOGO_R;d.addImage(LOGO,"JPEG",L,9,lw,lh,"logo")}catch(e){}
  d.setFont("helvetica","bold");d.setFontSize(12.5);d.text(tit||VEH_TIT,L+W,17,{align:"right"});
  d.setFont("helvetica","normal");d.setFontSize(8);d.text(VEH_SUB,L+W,22.5,{align:"right"});
  d.setDrawColor(150);d.line(L,31,L+W,31);d.setDrawColor(0);
}
function axHeaderAct(d,tit){
  const L=15,W=180,y=10,h=21;d.setDrawColor(0);d.setLineWidth(0.2);d.setTextColor(0);
  d.rect(L,y,W,h);d.line(60,y,60,y+h);d.line(165,y,165,y+h);d.line(165,y+h/2,195,y+h/2);
  {const lh=h-4,lw=Math.min(42,lh*LOGO_R);try{d.addImage(LOGO,"JPEG",37.5-lw/2,y+2,lw,lh,"logo")}catch(e){}}
  d.setFont("helvetica","bold");d.setFontSize(10);d.text("Departamento de Administración y Finanzas",112.5,y+8.5,{align:"center"});d.text(tit||"Registro de entrega de activos",112.5,y+14.5,{align:"center"});
  d.setFontSize(7.5);d.text("Versión",180,y+4,{align:"center"});d.text("Revisión",180,y+h/2+4,{align:"center"});
  d.setFont("helvetica","normal");d.text("01",180,y+8.5,{align:"center"});d.text("01",180,y+h/2+8.5,{align:"center"});
}
/* Capacitación: encabezado del formato en papel (logo · título sobre fondo azul · versión y revisión) */
function capHeader(d){
  const L=15,W=180,y=10,h=22,xT=60,xV=147,wV=24;d.setLineWidth(0.2);d.setDrawColor(0);d.setTextColor(0);
  d.setFillColor(49,133,155);d.rect(xT,y,xV-xT,h,"F");d.rect(L,y,W,h);d.line(xT,y,xT,y+h);d.line(xV,y,xV,y+h);d.line(xV+wV,y,xV+wV,y+h);d.line(xV,y+h/2,L+W,y+h/2);
  {const lh=h-6,lw=Math.min(40,lh*LOGO_R);try{d.addImage(LOGO,"JPEG",(L+xT)/2-lw/2,y+3,lw,lh,"logo")}catch(e){}}
  const xc=(xT+xV)/2;d.setTextColor(255);d.setFont("helvetica","bold");d.setFontSize(8.5);d.text("Departamento de Administración y Finanzas",xc,y+6,{align:"center"});
  d.text("Área Control y gestión",xc,y+10.5,{align:"center"});d.setFontSize(11);d.text("Registro de capacitaciones",xc,y+17.5,{align:"center"});d.setTextColor(0);
  CAP_VER.forEach(([t1,v1,t2,v2],i)=>{const yy=y+i*h/2;d.setFont("helvetica","bold");d.setFontSize(7);d.text(t1,xV+wV/2,yy+4,{align:"center"});d.text(t2,xV+wV+wV/2,yy+4,{align:"center"});
    d.setFont("helvetica","normal");d.text(v1,xV+wV/2,yy+8.5,{align:"center"});d.text(v2,xV+wV+wV/2,yy+8.5,{align:"center"})});
}
function buildCap(a,IM){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const K=axPDFkit(d,a);const {L,W}=K;prepAx(a);
  K.header();K.y=K.TOP;
  /* datos (izquierda) y tema (derecha), como en el formato */
  const wl=90,xr=L+wl,wr=W-wl,y0=K.y;d.setFontSize(9);
  const celda=(lab,val,h)=>{d.rect(L,K.y,wl,h);d.setFont("helvetica","bold");d.text(lab,L+1.8,K.y+4.6);const lw=d.getTextWidth(lab)+3;d.setFont("helvetica","normal");
    const ls=d.splitTextToSize(String(val||""),wl-lw-2.5);if(ls.length)d.text(ls.slice(0,Math.max(1,Math.floor((h-1.5)/4))),L+1.8+lw,K.y+4.6,{lineHeightFactor:1.25});K.y+=h};
  d.setFont("helvetica","normal");const lpr=d.splitTextToSize(capPredios(a).join(", "),wl-20).length;
  celda("Realizada por:",a.realizadaPor,11);
  {d.rect(L,K.y,wl,7);d.setFont("helvetica","bold");d.text("Inicio:",L+1.8,K.y+4.6);d.text("Fin:",L+46,K.y+4.6);d.setFont("helvetica","normal");d.text(a.inicio||"",L+13,K.y+4.6);d.text(a.fin||"",L+53,K.y+4.6);
    if(capDur(a)){d.setTextColor(90);d.setFontSize(7.5);d.text("("+capDur(a)+")",L+wl-1.8,K.y+4.6,{align:"right"});d.setFontSize(9);d.setTextColor(0)}K.y+=7}
  celda("Predios:",capPredios(a).join(", "),Math.max(7,lpr*4+3));
  celda("Fecha:",fmtD(a.fecha),7);
  {const h=17,fr=(a.firmas||{}).relator||{};d.rect(L,K.y,wl/2,h);d.rect(L+wl/2,K.y,wl/2,h);d.setFont("helvetica","bold");d.text("Firma relator:",L+1.8,K.y+4.6);
    const fi=IM["firma:relator"]||fr.img;if(fi){try{const p=d.getImageProperties(fi);let iw=wl/2-4,ih=iw*p.height/p.width;if(ih>h-3){ih=h-3;iw=ih*p.width/p.height}d.addImage(fi,"PNG",L+wl*0.75-iw/2,K.y+h/2-ih/2,iw,ih,undefined,"FAST")}catch(e){}}K.y+=h}
  {const h=K.y-y0;d.rect(xr,y0,wr,h);let yy=y0+5;d.setFont("helvetica","bold");d.setFontSize(7.5);d.setTextColor(90);d.text("TEMA DE LA CAPACITACIÓN",xr+2,yy);d.setTextColor(0);yy+=5.5;
    d.setFontSize(10.5);const lt=d.splitTextToSize(String(a.tema||"").trim(),wr-4);d.text(lt.slice(0,4),xr+2,yy,{lineHeightFactor:1.2});yy+=Math.min(lt.length,4)*4.6+2;
    if(a.detalle){d.setFont("helvetica","normal");d.setFontSize(8.5);const ld=d.splitTextToSize(String(a.detalle),wr-4);const n=Math.max(0,Math.floor((y0+h-yy-1)/3.6));if(n)d.text(ld.slice(0,n),xr+2,yy,{lineHeightFactor:1.2})}}
  K.y+=6;
  /* participantes */
  const cols=[["NOMBRE",80],["RUT",30],["CARGO",40],["FIRMA",30]],xs=[];let xx=L;cols.forEach(c=>{xs.push(xx);xx+=c[1]});
  const head=()=>{d.setFont("helvetica","normal");d.setFontSize(8.5);cols.forEach((c,i)=>{d.setFillColor(180,198,231);d.rect(xs[i],K.y,c[1],7,"FD");d.text(c[0],xs[i]+c[1]/2,K.y+4.7,{align:"center"})});K.y+=7};
  head();
  const P=capUsados(a),rh=11;
  P.forEach(p=>{if(K.y+rh>K.BOT){d.addPage();K.header();K.y=K.TOP;head()}
    cols.forEach((c,j)=>d.rect(xs[j],K.y,c[1],rh));d.setFont("helvetica","normal");d.setFontSize(8.5);
    const ln=d.splitTextToSize(String(p.nombre||""),cols[0][1]-3).slice(0,2);d.text(ln,xs[0]+1.8,K.y+(ln.length>1?4.3:6.6),{lineHeightFactor:1.2});
    d.text(p.rut?rutFmt(p.rut):"",xs[1]+cols[1][1]/2,K.y+6.6,{align:"center"});
    const lc=d.splitTextToSize(String(p.cargo||""),cols[2][1]-3).slice(0,2);d.text(lc,xs[2]+1.8,K.y+(lc.length>1?4.3:6.6),{lineHeightFactor:1.2});
    const fi=IM["firma:p_"+p.id]||capFirma(a,p).img;if(fi){try{const q=d.getImageProperties(fi);let iw=cols[3][1]-3,ih=iw*q.height/q.width;if(ih>rh-1.5){ih=rh-1.5;iw=ih*q.width/q.height}d.addImage(fi,"PNG",xs[3]+cols[3][1]/2-iw/2,K.y+rh/2-ih/2,iw,ih,undefined,"FAST")}catch(e){}}
    K.y+=rh});
  K.y+=4;K.para(`${P.length} ${P.length===1?"participante":"participantes"}.`,{s:8.5,c:[90,90,90]});
  anexoFotos(d,a,IM,K,[["c_fotos","Fotos de la capacitación"]]);
  return finPDF(d,axPie(d,a));
}
function axPDFkit(d,a){
  const L=15,W=180,TOP=38,BOT=280;const header=()=>a.tipo==="vehiculo"?axHeaderVeh(d):a.tipo==="capacitacion"?capHeader(d):axHeaderAct(d);
  const K={L,W,TOP,BOT,y:TOP,header,
    nb(h){if(K.y+h>BOT){d.addPage();header();K.y=TOP}},
    para(t,o){o=o||{};d.setFont("helvetica",o.f||"normal");d.setFontSize(o.s||9);const lh=(o.s||9)*0.42*1.3;const ls=d.splitTextToSize(t,o.w||W-(o.ind||0));
      for(const l of ls){K.nb(lh);if(o.c)d.setTextColor(...o.c);d.text(l,L+(o.ind||0),K.y+lh*0.8);d.setTextColor(0);K.y+=lh}K.y+=o.gap==null?1.6:o.gap},
    /* párrafo con un comienzo en negrita */
    paraB(b,t,o){o=o||{};const s=o.s||9,lh=s*0.42*1.3,ind=o.ind||0,w=W-ind;d.setFontSize(s);
      d.setFont("helvetica","bold");const bw=b?d.getTextWidth(b)+1.6:0;
      d.setFont("helvetica","normal");const first=d.splitTextToSize(t,w-bw);const rest=first.length>1?d.splitTextToSize(first.slice(1).join(" "),w):[];
      K.nb(lh);if(b){d.setFont("helvetica","bold");d.text(b,L+ind,K.y+lh*0.8)}d.setFont("helvetica","normal");d.text(first[0]||"",L+ind+bw,K.y+lh*0.8);K.y+=lh;
      for(const l of rest){K.nb(lh);d.text(l,L+ind,K.y+lh*0.8);K.y+=lh}K.y+=o.gap==null?1.8:o.gap}
  };
  return K;
}
function caja(d,x,y,marcada){d.rect(x,y-2.7,3,3);if(marcada){d.setLineWidth(0.35);d.line(x+0.5,y-2.2,x+2.5,y-0.2);d.line(x+2.5,y-2.2,x+0.5,y-0.2);d.setLineWidth(0.2)}}
function firmasPDF(d,a,K){
  const R=rolesDe(a);K.nb(46);K.y+=4;const w=80,gap=20;
  R.forEach(([k,l,sub],i)=>{const f=(a.firmas||{})[k]||{},x=K.L+i*(w+gap),lineY=K.y+24;
    if(f.img){try{const p=d.getImageProperties(f.img);let iw=56,ih=iw*p.height/p.width;if(ih>20){ih=20;iw=ih*p.width/p.height}d.addImage(f.img,"PNG",x+w/2-iw/2,lineY-ih+0.5,iw,ih)}catch(e){}}
    d.setLineWidth(0.25);d.line(x,lineY+1,x+w,lineY+1);d.setLineWidth(0.2);
    d.setFont("helvetica","bold");d.setFontSize(8.5);d.text("FIRMA · "+l.toUpperCase(),x+w/2,lineY+5,{align:"center"});
    d.setFont("helvetica","normal");d.setFontSize(8);let yy=lineY+9;
    if(f.nombre){d.text(f.nombre,x+w/2,yy,{align:"center"});yy+=3.8}
    const ex=k==="conductor"&&a.rut?"RUT "+rutFmt(a.rut):k==="recibe"?[a.rutRecibe?"RUT "+rutFmt(a.rutRecibe):"",a.cargo].filter(Boolean).join(" · "):(f.cargo||sub);
    if(ex){d.setTextColor(90);d.setFontSize(7.5);d.text(ex,x+w/2,yy,{align:"center"});d.setTextColor(0)}
  });
  K.y+=40;
}
function anexoFotos(d,a,IM,K,secs){
  const hay=secs.filter(([k])=>((a.items[k]||{}).fotos||[]).length);if(!hay.length)return;
  d.addPage();K.header();K.y=K.TOP;
  d.setFont("helvetica","bold");d.setFontSize(11);d.text("ANEXO · FOTOGRAFÍAS",105,K.y+3,{align:"center"});K.y+=10;
  hay.forEach(([k,titulo])=>{K.nb(14);d.setFillColor(221,235,247);d.rect(K.L,K.y,K.W,6.5,"FD");d.setFont("helvetica","bold");d.setFontSize(9.5);d.text(titulo,K.L+2,K.y+4.6);K.y+=9.5;
    const fs=(a.items[k].fotos||[]).filter(f=>!String(f).startsWith("p:"));const IW=86,MH=64;let col=0,rowH=0;
    fs.forEach(ref=>{const im=IM[ref];let w=IW,h=im?w*im.h/im.w:20;if(h>MH){h=MH;w=h*im.w/im.h}
      if(col===0)K.nb(h+4);const x=K.L+col*(IW+8);
      if(im){d.addImage(im.data,"JPEG",x,K.y,w,h);d.setDrawColor(190);d.rect(x,K.y,w,h);d.setDrawColor(0)}else{d.rect(x,K.y,IW,20);d.setFontSize(8);d.setTextColor(120);d.text("Foto no disponible",x+IW/2,K.y+11,{align:"center"});d.setTextColor(0)}
      rowH=Math.max(rowH,h);col++;if(col===2){col=0;K.y+=rowH+4;rowH=0}});
    if(col)K.y+=rowH+4;K.y+=2});
}
function buildVeh(a,IM){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const K=axPDFkit(d,a);const {L,W}=K;prepAx(a);
  K.header();K.y=K.TOP;
  K.para(vehIntro(a),{s:9.5,gap:3});
  if(a.conductor||a.rut)K.para(`Conductor: ${a.conductor||"-"}${a.rut?"  ·  RUT "+rutFmt(a.rut):""}${predioDe(a)?"  ·  Predio o área: "+predioDe(a):""}`,{s:9,f:"bold",gap:2.5});
  d.setFont("helvetica","bold");d.setFontSize(10.5);d.text("1.  Identificación del vehículo",L+4,K.y+4);K.y+=7;
  const tabla=(x,w,rows,y0)=>{let y=y0;const c1=w*0.45;d.setFontSize(8.5);
    d.setFillColor(233,238,244);d.rect(x,y,w,5.6,"FD");d.line(x+c1,y,x+c1,y+5.6);d.setFont("helvetica","bold");d.text("Item",x+1.5,y+4);d.text("Detalle",x+c1+1.5,y+4);y+=5.6;
    rows.forEach(([k,l])=>{d.rect(x,y,w,6.4);d.line(x+c1,y,x+c1,y+6.4);d.setFont("helvetica","normal");d.text(l,x+1.5,y+4.4);d.setFont("helvetica","bold");d.text(d.splitTextToSize(String((a.veh||{})[k]||""),w-c1-3)[0]||"",x+c1+1.5,y+4.4);y+=6.4});return y};
  const y1=tabla(L,86,VEH_ID1,K.y),y2=tabla(L+94,86,VEH_ID2.concat([["",""]]),K.y);K.y=Math.max(y1,y2)+6;
  d.setFont("helvetica","normal");d.setFontSize(9.5);d.text("Accesorios y documentación entregada:",L,K.y);K.y+=2;
  /* tabla de accesorios: N°, detalle, entrega Sí/No; la columna Observaciones es un solo recuadro */
  const xN=L,wN=10,xD=L+10,wD=64,xE=L+74,wE=28,xO=L+102,wO=78,rh=5.8;d.setFontSize(8.5);
  d.setFillColor(233,238,244);d.rect(xN,K.y,wN+wD+wE,5.6,"FD");d.rect(xO,K.y,wO,5.6,"FD");d.line(xD,K.y,xD,K.y+5.6);d.line(xE,K.y,xE,K.y+5.6);
  d.setFont("helvetica","bold");d.text("N°",xN+1.5,K.y+4);d.text("Detalle",xD+1.5,K.y+4);d.text("Entrega",xE+wE/2,K.y+4,{align:"center"});d.text("Observaciones:",xO+1.5,K.y+4);K.y+=5.6;
  const yIni=K.y;
  const fila=(n,l,v,yy)=>{d.rect(xN,yy,wN,rh);d.rect(xD,yy,wD,rh);d.rect(xE,yy,wE,rh);d.setFont("helvetica","normal");if(n)d.text(String(n),xN+1.5,yy+4);d.text(l,xD+1.5,yy+4);
    d.text("Sí",xE+3,yy+4);caja(d,xE+7.5,yy+4.2,v==="si");d.text("- No",xE+11.5,yy+4);caja(d,xE+19.5,yy+4.2,v==="no")};
  VEH_ACC.forEach(([k,l],i)=>{fila(i+1,k==="llaves"?`Llaves (${a.llavesN||"   "})`:l,a.acc[k],K.y);K.y+=rh});
  d.rect(xN,K.y,wN,rh*(VEH_DOC.length+1));d.rect(xD,K.y,wD,rh);d.rect(xE,K.y,wE,rh);d.text("12",xN+1.5,K.y+4);d.text("Documentación",xD+1.5,K.y+4);K.y+=rh;
  VEH_DOC.forEach(([k,l])=>{d.rect(xD,K.y,wD,rh);d.rect(xE,K.y,wE,rh);d.text("•  "+l,xD+3,K.y+4);d.text("Sí",xE+3,K.y+4);caja(d,xE+7.5,K.y+4.2,a.docs[k]==="si");d.text("- No",xE+11.5,K.y+4);caja(d,xE+19.5,K.y+4.2,a.docs[k]==="no");K.y+=rh});
  d.rect(xO,yIni,wO,K.y-yIni);
  {const ob=String(a.observaciones||"").trim();if(ob){d.setFontSize(8);d.text(d.splitTextToSize(ob,wO-3).slice(0,Math.floor((K.y-yIni-2)/3.4)),xO+1.5,yIni+4,{lineHeightFactor:1.25})}}
  /* 13. Estado general */
  d.setFontSize(8.5);const desc=d.splitTextToSize(String(a.estadoDesc||""),wE+wO-14);const h13=Math.max(10,desc.length*3.6+7);
  d.rect(xN,K.y,wN,h13);d.rect(xD,K.y,wD,h13);d.rect(xE,K.y,wE+wO,h13);d.text("13",xN+1.5,K.y+4);d.setFont("helvetica","normal");d.text("Estado general",xD+1.5,K.y+4);d.setFontSize(7.5);d.text("(daños visibles)",xD+1.5,K.y+7.5);
  d.setFontSize(8.5);d.text("Descripción:",xE+1.5,K.y+4);if(desc.length)d.text(desc,xE+1.5,K.y+8,{lineHeightFactor:1.25});K.y+=h13+6;
  /* 2 y 3 */
  d.addPage();K.header();K.y=K.TOP;
  K.para("2.  Responsabilidades de Seguridad del Conductor",{f:"bold",s:10.5,gap:2});
  K.para(VEH_R2,{s:9,gap:2.5});
  VEH_RESP.forEach(([n,t,x])=>K.paraB(n?`${n} ${t}`:"",x,{s:9,gap:2.2}));
  K.y+=2;K.para("3.  Régimen disciplinario y medidas aplicables",{f:"bold",s:10.5,gap:2});
  K.para(VEH_R3,{s:9,gap:2.5});
  VEH_DISC.forEach(([n,x])=>K.paraB(n,x,{s:9,gap:2.2,ind:4}));
  K.y+=4;firmasPDF(d,a,K);
  K.para("Fecha: "+(fmtD(a.fecha)||"________________"),{s:9});
  anexoFotos(d,a,IM,K,VEH_FOTOS);
  return finPDF(d,{footer:(p,n)=>{d.setFont("helvetica","normal");d.setFontSize(7.5);d.setTextColor(110);d.text(`Página ${p} de ${n}`,195,289,{align:"right"});const pie=pieAutoria(a);if(pie)d.text(d.splitTextToSize(pie,150)[0],15,289);d.setTextColor(0)}});
}
function buildAct(a,IM){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const K=axPDFkit(d,a);const {L,W}=K;prepAx(a);
  K.header();K.y=K.TOP+2;
  const fe=(a.firmas||{}).entrega||{};
  [["FECHA:",fmtD(a.fecha)],["ENTREGA:",[fe.nombre,fe.cargo||(fe.nombre?"Administración":"")].filter(Boolean).join(" · ")],["RECIBE:",[a.recibe,a.cargo].filter(Boolean).join(" · ")]].forEach(([l,v])=>{
    d.rect(L,K.y,30,7);d.rect(L+30,K.y,W-30,7);d.setFont("helvetica","bold");d.setFontSize(9);d.text(l,L+2,K.y+4.8);d.setFont("helvetica","normal");d.text(String(v||""),L+32,K.y+4.8);K.y+=7});
  K.y+=6;K.para(ACT_INTRO,{s:9.5,gap:3});
  const cols=[["Tipo de activo",28],["Marca",22],["Referencia",30],["Estado",17],["Factura",19],["Valor referencial",22],["Observación",42]];
  const xs=[];let xx=L;cols.forEach(c=>{xs.push(xx);xx+=c[1]});
  const head=()=>{d.setFont("helvetica","bold");d.setFontSize(7.5);cols.forEach((c,i)=>{d.setFillColor(233,238,244);d.rect(xs[i],K.y,c[1],8,"FD");d.text(d.splitTextToSize(c[0].toUpperCase(),c[1]-2),xs[i]+c[1]/2,K.y+3.3,{align:"center",lineHeightFactor:1.1})});K.y+=8};
  head();
  const filas=(a.activos||[]).filter(x=>x.tipo||x.marca||x.ref);const n=Math.max(filas.length,6);
  for(let i=0;i<n;i++){const x=filas[i]||{};const vals=[x.tipo,x.marca,x.ref,x.estado,x.factura,x.valor?("$ "+String(x.valor).replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,".")):"",x.obs||(filas[i]?"-":"")];
    d.setFont("helvetica","normal");d.setFontSize(7.5);const ls=vals.map((v,j)=>d.splitTextToSize(String(v||""),cols[j][1]-2));const h=Math.max(6.5,Math.max(...ls.map(l=>l.length))*3.2+2.5);
    if(K.y+h>K.BOT){d.addPage();K.header();K.y=K.TOP;head()}
    cols.forEach((c,j)=>{d.rect(xs[j],K.y,c[1],h);if(ls[j].length)d.text(ls[j],xs[j]+1,K.y+3.8,{lineHeightFactor:1.2})});K.y+=h}
  K.y+=7;K.para(actCompromiso(a),{s:9.5,gap:5});
  K.para("OBSERVACIONES GENERALES:",{f:"bold",s:9.5,gap:2});
  {const ob=String(a.obs||"").trim();d.setFontSize(9);const ls=ob?d.splitTextToSize(ob,W-4):[];const h=Math.max(14,ls.length*4.4+5);K.nb(h);d.rect(L,K.y,W,h);if(ls.length)d.text(ls,L+2,K.y+5,{lineHeightFactor:1.3});K.y+=h+6}
  firmasPDF(d,a,K);
  anexoFotos(d,a,IM,K,(a.activos||[]).map((x,i)=>["a_"+x.id,`Activo ${i+1}: ${[x.tipo,x.marca,x.ref].filter(Boolean).join(" · ")||"sin datos"}`]));
  return finPDF(d,{footer:(p,n)=>{d.setFont("helvetica","normal");d.setFontSize(7.5);d.setTextColor(110);d.text(`Página ${p} de ${n}`,195,289,{align:"right"});const pie=pieAutoria(a);if(pie)d.text(d.splitTextToSize(pie,150)[0],15,289);d.setTextColor(0)}});
}
const buildAx=(a,IM)=>a.tipo==="capacitacion"?buildCap(a,IM):esDev(a)?(a.tipo==="vehiculo"?buildVehDev(a,IM):buildActDev(a,IM)):a.tipo==="vehiculo"?buildVeh(a,IM):buildAct(a,IM);
const axPie=(d,a)=>({footer:(p,n)=>{d.setFont("helvetica","normal");d.setFontSize(7.5);d.setTextColor(110);d.text(`Página ${p} de ${n}`,195,289,{align:"right"});const pie=pieAutoria(a);if(pie)d.text(d.splitTextToSize(pie,150)[0],15,289);d.setTextColor(0)}});
function buildVehDev(a,IM){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const K=axPDFkit(d,a);const {L,W}=K;prepAx(a);const ant=a.antes||{};
  K.header=()=>axHeaderVeh(d,"ACTA DE DEVOLUCIÓN DE VEHÍCULO");
  K.header();K.y=K.TOP;
  K.para(vehDevIntro(a),{s:9.5,gap:3});
  d.setFont("helvetica","bold");d.setFontSize(10.5);d.text("1.  Identificación del vehículo",L+4,K.y+4);K.y+=7;
  const ke=+String(ant.km||"").replace(/[^0-9]/g,""),kd=+String(a.kmDev||"").replace(/[^0-9]/g,"");
  const rows1=VEH_ID1.map(([k,l])=>[l,(a.veh||{})[k]]),rows2=[["Patente",(a.veh||{}).patente],["Km de entrega",ant.km],["Km de devolución",a.kmDev],["Km recorridos",ke&&kd&&kd>=ke?(kd-ke).toLocaleString("es-CL"):""]];
  const tabla=(x,w,rows,y0)=>{let y=y0;const c1=w*0.45;d.setFontSize(8.5);d.setFillColor(233,238,244);d.rect(x,y,w,5.6,"FD");d.line(x+c1,y,x+c1,y+5.6);d.setFont("helvetica","bold");d.text("Item",x+1.5,y+4);d.text("Detalle",x+c1+1.5,y+4);y+=5.6;
    rows.forEach(([l,v])=>{d.rect(x,y,w,6.4);d.line(x+c1,y,x+c1,y+6.4);d.setFont("helvetica","normal");d.text(l,x+1.5,y+4.4);d.setFont("helvetica","bold");d.text(String(v||""),x+c1+1.5,y+4.4);y+=6.4});return y};
  K.y=Math.max(tabla(L,86,rows1,K.y),tabla(L+94,86,rows2,K.y))+6;
  d.setFont("helvetica","normal");d.setFontSize(9.5);d.text("Accesorios y documentación: entrega y devolución",L,K.y);K.y+=2;
  const xN=L,wN=10,xD=L+10,wD=62,xE=L+72,wE=20,xV=L+92,wV=28,xO=L+120,wO=60,rh=5.8;d.setFontSize(8.5);
  d.setFillColor(233,238,244);[[xN,wN,"N°"],[xD,wD,"Detalle"],[xE,wE,"Entrega"],[xV,wV,"Devolución"],[xO,wO,"Observaciones:"]].forEach(([x,w,t])=>{d.setFillColor(233,238,244);d.rect(x,K.y,w,5.6,"FD");d.setFont("helvetica","bold");d.text(t,t==="Observaciones:"||t==="Detalle"||t==="N°"?x+1.5:x+w/2,K.y+4,t==="Entrega"||t==="Devolución"?{align:"center"}:{})});K.y+=5.6;
  const yIni=K.y;const sn=v=>v==="si"?"Sí":v==="no"?"No":"-";
  const fila=(n,l,vA,vD,yy)=>{const falta=vA==="si"&&vD==="no";if(falta){d.setFillColor(253,238,238);d.rect(xN,yy,wN+wD+wE+wV,rh,"F")}d.rect(xN,yy,wN,rh);d.rect(xD,yy,wD,rh);d.rect(xE,yy,wE,rh);d.rect(xV,yy,wV,rh);d.setFont("helvetica","normal");if(n)d.text(String(n),xN+1.5,yy+4);d.text(l,xD+1.5,yy+4);d.text(sn(vA),xE+wE/2,yy+4,{align:"center"});
    d.text("Sí",xV+3,yy+4);caja(d,xV+7.5,yy+4.2,vD==="si");d.text("- No",xV+11.5,yy+4);caja(d,xV+19.5,yy+4.2,vD==="no")};
  VEH_ACC.forEach(([k,l],i)=>{fila(i+1,k==="llaves"?`Llaves (${ant.llavesN||"-"} / ${a.llavesN||"-"})`:l,(ant.acc||{})[k],a.acc[k],K.y);K.y+=rh});
  d.rect(xN,K.y,wN,rh*(VEH_DOC.length+1));d.rect(xD,K.y,wD,rh);d.rect(xE,K.y,wE,rh);d.rect(xV,K.y,wV,rh);d.text("12",xN+1.5,K.y+4);d.text("Documentación",xD+1.5,K.y+4);K.y+=rh;
  VEH_DOC.forEach(([k,l])=>{const vA=(ant.docs||{})[k],vD=a.docs[k];if(vA==="si"&&vD==="no"){d.setFillColor(253,238,238);d.rect(xD,K.y,wD+wE+wV,rh,"F")}d.rect(xD,K.y,wD,rh);d.rect(xE,K.y,wE,rh);d.rect(xV,K.y,wV,rh);d.text("•  "+l,xD+3,K.y+4);d.text(sn(vA),xE+wE/2,K.y+4,{align:"center"});d.text("Sí",xV+3,K.y+4);caja(d,xV+7.5,K.y+4.2,vD==="si");d.text("- No",xV+11.5,K.y+4);caja(d,xV+19.5,K.y+4.2,vD==="no");K.y+=rh});
  d.rect(xO,yIni,wO,K.y-yIni);{const ob=String(a.observaciones||"").trim();if(ob){d.setFontSize(8);d.text(d.splitTextToSize(ob,wO-3).slice(0,Math.floor((K.y-yIni-2)/3.4)),xO+1.5,yIni+4,{lineHeightFactor:1.25})}}
  d.setFontSize(8.5);const dA=d.splitTextToSize("Entrega: "+(ant.estadoDesc||"-"),wE+wV+wO-4),dD=d.splitTextToSize("Devolución: "+(a.estadoDesc||""),wE+wV+wO-4);const h13=Math.max(12,(dA.length+dD.length)*3.6+5);
  d.rect(xN,K.y,wN,h13);d.rect(xD,K.y,wD,h13);d.rect(xE,K.y,wE+wV+wO,h13);d.text("13",xN+1.5,K.y+4);d.text("Estado general",xD+1.5,K.y+4);d.setFontSize(7.5);d.text("(daños visibles)",xD+1.5,K.y+7.5);
  d.setFontSize(8.5);d.setTextColor(90);d.text(dA,xE+1.5,K.y+4,{lineHeightFactor:1.25});d.setTextColor(0);d.text(dD,xE+1.5,K.y+4+dA.length*3.6,{lineHeightFactor:1.25});K.y+=h13+4;
  d.setFontSize(7.5);d.setTextColor(110);d.text("Fila destacada: se entregó y no se devuelve.",L,K.y);d.setTextColor(0);K.y+=6;
  firmasPDF(d,a,K);K.para("Fecha: "+(fmtD(a.fecha)||"________________"),{s:9});
  anexoFotos(d,a,IM,K,VEH_FOTOS);
  return finPDF(d,axPie(d,a));
}
function buildActDev(a,IM){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const K=axPDFkit(d,a);const {L,W}=K;prepAx(a);
  K.header=()=>axHeaderAct(d,"Registro de devolución de activos");
  K.header();K.y=K.TOP+2;const fe=(a.firmas||{}).entrega||{};
  [["FECHA:",fmtD(a.fecha)],["DEVUELVE:",[a.recibe,a.cargo].filter(Boolean).join(" · ")],["RECIBE:",[fe.nombre,fe.cargo||(fe.nombre?"Administración":"")].filter(Boolean).join(" · ")]].forEach(([l,v])=>{d.rect(L,K.y,30,7);d.rect(L+30,K.y,W-30,7);d.setFont("helvetica","bold");d.setFontSize(9);d.text(l,L+2,K.y+4.8);d.setFont("helvetica","normal");d.text(String(v||""),L+32,K.y+4.8);K.y+=7});
  K.y+=6;K.para(actDevIntro(a),{s:9.5,gap:3});
  const cols=[["Tipo de activo",28],["Marca",20],["Referencia",30],["Estado entrega",18],["Devuelto",19],["Estado devolución",20],["Observación",45]];const xs=[];let xx=L;cols.forEach(c=>{xs.push(xx);xx+=c[1]});
  const head=()=>{d.setFont("helvetica","bold");d.setFontSize(7.5);cols.forEach((c,i)=>{d.setFillColor(233,238,244);d.rect(xs[i],K.y,c[1],8,"FD");d.text(d.splitTextToSize(c[0].toUpperCase(),c[1]-2),xs[i]+c[1]/2,K.y+3.3,{align:"center",lineHeightFactor:1.1})});K.y+=8};head();
  (a.activos||[]).forEach(x=>{const vals=[x.tipo,x.marca,x.ref,x.estado,x.devuelto==="si"?"Sí":x.devuelto==="no"?"No":"-",x.devuelto==="si"?x.estadoDev:"",x.obsDev||"-"];d.setFont("helvetica","normal");d.setFontSize(7.5);const ls=vals.map((v,j)=>d.splitTextToSize(String(v||""),cols[j][1]-2));const h=Math.max(6.5,Math.max(...ls.map(l=>l.length))*3.2+2.5);
    if(K.y+h>K.BOT){d.addPage();K.header();K.y=K.TOP;head()}if(x.devuelto==="no"){d.setFillColor(253,238,238);d.rect(L,K.y,W,h,"F")}cols.forEach((c,j)=>{d.rect(xs[j],K.y,c[1],h);if(ls[j].length)d.text(ls[j],xs[j]+1,K.y+3.8,{lineHeightFactor:1.2})});K.y+=h});
  K.y+=6;const no=(a.activos||[]).filter(x=>x.devuelto==="no");if(no.length)K.para(ACT_DEV_PEND,{s:9.5,f:"bold",gap:4});
  K.para("OBSERVACIONES GENERALES:",{f:"bold",s:9.5,gap:2});
  {const ob=String(a.obs||"").trim();d.setFontSize(9);const ls=ob?d.splitTextToSize(ob,W-4):[];const h=Math.max(14,ls.length*4.4+5);K.nb(h);d.rect(L,K.y,W,h);if(ls.length)d.text(ls,L+2,K.y+5,{lineHeightFactor:1.3});K.y+=h+6}
  firmasPDF(d,a,K);
  anexoFotos(d,a,IM,K,(a.activos||[]).map((x,i)=>["a_"+x.id,`Activo ${i+1}: ${[x.tipo,x.marca,x.ref].filter(Boolean).join(" · ")||"sin datos"}`]));
  return finPDF(d,axPie(d,a));
}
function axNombre(a){
  const s=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"");
  if(a.tipo==="capacitacion")return ["Capacitacion",s(a.tema).slice(0,60),fmtD(a.fecha)].filter(Boolean).join("_")+".pdf";
  return (a.tipo==="vehiculo"?[esDev(a)?"Acta_Devolucion_Vehiculo":"Acta_Vehiculo",s((a.veh||{}).patente),s(a.conductor)]:["Entrega_Activos",s(a.recibe),s(((a.activos||[])[0]||{}).tipo)].map((x,i)=>i===0&&esDev(a)?"Devolucion_Activos":x)).concat([fmtD(a.fecha)]).filter(Boolean).join("_")+".pdf";
}
async function axImgs(a){const IM={};for(const r of Object.values(a.items||{}))for(const f of (r.fotos||[]))if(!String(f).startsWith("p:"))IM[f]=await pdfImg(f);
  if(a.tipo==="capacitacion")for(const [k,f] of Object.entries(a.firmas||{}))if(f&&f.img)IM["firma:"+k]=await capFirmaChica(f.img);return IM}
/* v109: en el registro de capacitaciones van muchas firmas; para el PDF se recortan los márgenes vacíos (la firma se ve más
   grande en su celda) y se achican a 360 × 120 px como máximo: 30 firmas a 600 px pesaban más de 20 MB */
async function capFirmaChica(src){try{const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src});
  const c=document.createElement("canvas");c.width=im.width;c.height=im.height;const x=c.getContext("2d");x.drawImage(im,0,0);const D=x.getImageData(0,0,c.width,c.height).data;
  let x0=c.width,y0=c.height,x1=-1,y1=-1;for(let y=0;y<c.height;y+=2)for(let i=0;i<c.width;i+=2){const o=(y*c.width+i)*4;if(D[o+3]>20&&D[o]+D[o+1]+D[o+2]<720){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(x1<0)return src;x0=Math.max(0,x0-8);y0=Math.max(0,y0-8);x1=Math.min(c.width-1,x1+8);y1=Math.min(c.height-1,y1+8);
  const w=x1-x0+1,h=y1-y0+1,s=Math.min(1,360/w,120/h),o=document.createElement("canvas");o.width=Math.max(1,Math.round(w*s));o.height=Math.max(1,Math.round(h*s));
  o.getContext("2d").drawImage(c,x0,y0,w,h,0,0,o.width,o.height);return o.toDataURL("image/png")}catch(e){return src}}
async function axDescargar(a){
  if(!window.jspdf){toast("No se pudo cargar el generador de PDF.");return}
  prepAx(a);toast("Preparando el PDF…");await flush();
  let doc;try{doc=buildAx(a,await axImgs(a))}catch(e){console.error(e);toast("No se pudo generar el PDF.");return}
  await guardarPDF(doc,axNombre(a),"PDF listo.");
}
/* Al cerrar: el PDF queda en la carpeta del acta en OneDrive */
async function subirPDFsAx(a){
  if(!DB||navigator.onLine===false||!window.jspdf)return;
  try{prepAx(a);if(Object.values(a.items||{}).some(r=>(r.fotos||[]).some(f=>QF[f])))return;
    const d=buildAx(a,await axImgs(a));await actaSubir(a,null,axTitulo(a)+".pdf",d.output("blob"),"application/pdf");
    a.pdfs=new Date().toISOString();LOCAL[a.id]=a;await localPut(a);schedSync(500);
  }catch(e){console.warn("pdf acta",e)}
}

/* ---------- Excel consolidado (uno por tipo, en la carpeta de actas de OneDrive) ---------- */
function axXlsxBuild(tipo){
  const L=Object.values(ACTAS).filter(a=>a.tipo===tipo).map(prepAx).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const wb=XLSX.utils.book_new();const est=a=>a.anulada?"Anulada":a.estado==="cerrada"?"Cerrada":"Borrador";const sn=v=>v==="si"?"Sí":v==="no"?"No":"";
  const nF=a=>Object.values(a.items||{}).reduce((n,r)=>n+((r.fotos||[]).length),0);
  const add=(rows,name,w)=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=w.map(x=>({wch:x}));ws["!freeze"]={xSplit:0,ySplit:1};XLSX.utils.book_append_sheet(wb,ws,name)};
  if(tipo==="vehiculo"){
    const mov=a=>esDev(a)?"Devolución":"Entrega",vinc=a=>{const o=esDev(a)?ACTAS[a.entregaId]:ACTAS[a.devolucionId];return o?`${esDev(o)?"Devolución":"Entrega"} ${fmtD(o.fecha)}`:esDev(a)&&a.entregaFecha?`Entrega ${fmtD(a.entregaFecha)}`:""};
    const h=["Movimiento","Estado","Fecha","Lugar","Predio o área","Conductor(a)","RUT"].concat(VEH_ID1.concat(VEH_ID2).map(x=>x[1])).concat(VEH_ACC.map(x=>x[1])).concat(["N° de llaves"]).concat(VEH_DOC.map(x=>x[1])).concat(["Estado general (daños visibles)","Observaciones","Administración (entregó o recibió)","Km devolución","Acta vinculada","Fotos","Registrada por","Cerrada por","Fecha cierre","Anulada"]);
    const r=[h];L.forEach(a=>{const fe=a.firmas.empresa||{};r.push([mov(a),est(a),fmtD(a.fecha),a.ciudad||"",predioDe(a),a.conductor||"",a.rut?rutFmt(a.rut):""].concat(VEH_ID1.concat(VEH_ID2).map(([k])=>a.veh[k]||"")).concat(VEH_ACC.map(([k])=>sn(a.acc[k]))).concat([a.llavesN||""]).concat(VEH_DOC.map(([k])=>sn(a.docs[k]))).concat([a.estadoDesc||"",a.observaciones||"",fe.nombre||"",a.kmDev||"",vinc(a),nF(a),quien(a.creadoPor),quien(a.cerradoPor),a.cerrada?fmtD(a.cerrada):"",a.anulada?`${fmtD(a.anulada.fecha)} ${quien(a.anulada.por)}${a.anulada.motivo?": "+a.anulada.motivo:""}`:""]))});
    add(r,"Actas",[11,10,11,12,16,26,13].concat(VEH_ID1.concat(VEH_ID2).map(()=>12)).concat(VEH_ACC.map(()=>9)).concat([8]).concat(VEH_DOC.map(()=>9)).concat([40,40,26,10,20,6,22,22,11,30]));
  }else if(tipo==="capacitacion"){
    const anu=a=>a.anulada?`${fmtD(a.anulada.fecha)} ${quien(a.anulada.por)}${a.anulada.motivo?": "+a.anulada.motivo:""}`:"";
    const r=[["Estado","Fecha","Inicio","Fin","Duración (min)","Predios","Tema","Contenidos","Realizada por (relator)","Participantes","Con firma","Fotos","Registrada por","Cerrada por","Fecha cierre","Anulada"]];
    L.forEach(a=>{const U=capUsados(a);r.push([est(a),fmtD(a.fecha),a.inicio||"",a.fin||"",capMinutos(a)||"",capPredios(a).join(", "),a.tema||"",a.detalle||"",a.realizadaPor||"",U.length,U.filter(p=>capFirma(a,p).img).length,nF(a),quien(a.creadoPor),quien(a.cerradoPor),a.cerrada?fmtD(a.cerrada):"",anu(a)])});
    add(r,"Capacitaciones",[10,11,7,7,9,30,40,40,26,11,9,6,22,22,11,30]);
    const r2=[["Estado","Fecha","Tema","Predios","Realizada por (relator)","Nombre","RUT","Cargo","Firmó"]];
    L.filter(a=>!a.anulada).forEach(a=>capUsados(a).forEach(p=>r2.push([est(a),fmtD(a.fecha),a.tema||"",capPredios(a).join(", "),a.realizadaPor||"",p.nombre||"",p.rut?rutFmt(p.rut):"",p.cargo||"",capFirma(a,p).img?"Sí":"No"])));
    add(r2,"Participantes",[10,11,40,30,26,30,13,24,7]);
  }else{
    const mov=a=>esDev(a)?"Devolución":"Entrega";
    const h1=["Movimiento","Estado","Fecha","Predio o área","Responsable del activo","RUT","Cargo","Administración (entregó o recibió)","N° de activos","Valor referencial total","Observaciones generales","Fotos","Registrada por","Cerrada por","Fecha cierre","Anulada"];
    const val=x=>+String(x||"").replace(/[^0-9]/g,"")||0;
    const r1=[h1];L.forEach(a=>{const fe=a.firmas.entrega||{},A=a.activos.filter(x=>x.tipo||x.marca||x.ref);r1.push([mov(a),est(a),fmtD(a.fecha),predioDe(a),a.recibe||"",a.rutRecibe?rutFmt(a.rutRecibe):"",a.cargo||"",fe.nombre||"",A.length,A.reduce((s,x)=>s+val(x.valor),0),a.obs||"",nF(a),quien(a.creadoPor),quien(a.cerradoPor),a.cerrada?fmtD(a.cerrada):"",a.anulada?`${fmtD(a.anulada.fecha)} ${quien(a.anulada.por)}${a.anulada.motivo?": "+a.anulada.motivo:""}`:""])});
    add(r1,"Entregas",[11,10,11,16,26,13,24,24,10,14,40,6,22,22,11,30]);
    const r2=[["Movimiento","Estado","Fecha","Predio o área","Responsable del activo","Cargo","Administración","Tipo de activo","Marca","Referencia","Estado del activo","Factura","Valor referencial","Observación","Devuelto","Estado al devolver","Observación devolución","Fotos"]];
    L.filter(a=>!a.anulada).forEach(a=>{const fe=a.firmas.entrega||{};a.activos.filter(x=>x.tipo||x.marca||x.ref).forEach(x=>r2.push([mov(a),est(a),fmtD(a.fecha),predioDe(a),a.recibe||"",a.cargo||"",fe.nombre||"",x.tipo||"",x.marca||"",x.ref||"",x.estado||"",x.factura||"",val(x.valor)||"",x.obs||"",esDev(a)?(x.devuelto==="si"?"Sí":x.devuelto==="no"?"No":""):"",esDev(a)?x.estadoDev||"":"",esDev(a)?x.obsDev||"":"",((a.items["a_"+x.id]||{}).fotos||[]).length]))});
    add(r2,"Activos",[11,10,11,16,26,22,24,20,14,22,10,12,12,36,9,12,30,6]);
  }
  return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
async function axXlsxUpload(tipo){const buf=axXlsxBuild(tipo);const r=await gfetch(`/drives/${M365.drive}/items/${M365.root}:/${encName(AX[tipo].excel)}:/content`,{method:"PUT",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},body:new Blob([buf])});await r.json()}
function axXlsx(tipo,manual){return subirExcel("ax:"+tipo,manual,()=>axXlsxUpload(tipo))}

/* marca de que el módulo cargó completo (la revisa el arranque en index.html) */
window.MOD_ACTAS_ENTREGA=true;
