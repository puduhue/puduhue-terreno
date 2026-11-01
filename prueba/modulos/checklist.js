/* Puduhue Terreno: módulo Check list de visitas (desde la v103 vive en este archivo, aparte de index.html).
   Se carga como script normal después del código general de index.html y antes del arranque (init()), así que comparte
   las mismas variables y funciones globales. Sus escuchadores globales (document/window.addEventListener) quedaron en
   index.html, en su lugar de siempre. El service worker lo guarda junto con index.html. Ver el mapa en CLAUDE.md. */
/* ===== Catálogo del check list ===== */
const OBS="Observación en terreno", SH="15. Estándar de Servicios Higiénicos", LH="13. Estándar de Limpieza e Higiene", OA="11. Orden y Aseo";
const banos=(s)=>[
 [s+1,1,"Baño limpio: inodoro, lavamanos, piso y paredes sin suciedad ni malos olores",SH,OBS],
 [s+2,0,"Jabón, papel higiénico y toallas de papel disponibles; basurero con tapa",SH,OBS],
 [s+3,0,"Artefactos operativos (descarga, llaves, luz, puerta con seguro) y sin filtraciones",SH,OBS],
 [s+4,0,"Verificación semanal del baño registrada (check-list firmado)",SH,"Check-list semanal"]];
// sheet: cl = hoja «Check List»; oa-xx = hojas «Orden y Aseo»

/* v113: Check list de camionetas. Ítems con los puntos del Acta de entrega de vehículo (modulos/actas-entrega.js: VEH_ACC,
   VEH_DOC y responsabilidades). La clave cm-acc-<k> / cm-doc-<k> une el ítem con lo que dice el acta («Entrega: Sí/No»). */
const CM_ACTA="Acta de entrega de vehículo";
const CM_ITEMS=[
 ["Accesorios",[
  ["cm-acc-rueda",1,"Rueda de repuesto a bordo y en buen estado","ítem 1"],
  ["cm-acc-gata",0,"Gata a bordo","ítem 2"],
  ["cm-acc-llave",0,"Llave de rueda a bordo","ítem 3"],
  ["cm-acc-triangulos",1,"Triángulos de seguridad a bordo","ítem 4"],
  ["cm-acc-chaleco",1,"Chaleco reflectante a bordo","ítem 5"],
  ["cm-acc-extintor",1,"Extintor a bordo, cargado y vigente","ítem 6"],
  ["cm-acc-botiquin",1,"Botiquín a bordo y completo","ítem 7"],
  ["cm-acc-manual",0,"Manual del conductor a bordo","ítem 8"],
  ["cm-acc-tag",0,"TAG instalado","ítem 9"],
  ["cm-acc-llaves",0,"Llaves: la misma cantidad que se entregó","ítem 10"],
  ["cm-acc-permiso",1,"Permiso de circulación vigente a bordo","ítem 11"]]],
 ["Documentación",[
  ["cm-doc-rt",1,"Revisión técnica vigente","ítem 12"],
  ["cm-doc-gases",1,"Revisión de gases vigente","ítem 12"],
  ["cm-doc-soap",1,"SOAP vigente","ítem 12"],
  ["cm-doc-poliza",1,"Póliza de seguro vigente","ítem 12"]]],
 ["Estado general",[
  ["cm-est-carroceria",0,"Carrocería sin daños nuevos (comparar con el estado del acta)","ítem 13"],
  ["cm-est-neumaticos",1,"Neumáticos en buen estado: desgaste parejo y presión correcta","ítem 13 y punto 2.5"],
  ["cm-est-luces",1,"Luces funcionando: altas, bajas, freno, intermitentes y retroceso","ítem 13 y punto 2.5"],
  ["cm-est-parabrisas",0,"Parabrisas y espejos sin trizaduras","ítem 13 y punto 2.5"],
  ["cm-est-interior",0,"Interior limpio y ordenado","ítem 13"]]],
 ["Uso y responsabilidades del conductor",[
  ["cm-uso-mantencion",1,"Mantenciones al día: se presentó en un taller autorizado por Salfa Rent cada 10.000 km (tolerancia de 500 km)","punto 2.6"],
  ["cm-uso-siniestros",1,"Choques o daños avisados de inmediato a la jefatura, con la documentación del siniestro dentro de 24 horas (sin daños: N/A)","puntos 2.9 y 2.13"],
  ["cm-uso-preop",0,"Chequeo diario preoperacional: niveles, neumáticos, luces, frenos, cinturones, parabrisas y alarma de retroceso","punto 2.5"],
  ["cm-uso-interior",0,"Sin señales de fumar o vapear; carga amarrada y bien estibada, sin personas en la pickup","puntos 2.4 y 2.7"]]]];
const CM_EVID={"Accesorios":"Revisión de la camioneta","Documentación":"Documentos en la camioneta (fechas de vencimiento)","Estado general":"Revisión de la camioneta con fotos","Uso y responsabilidades del conductor":"Entrevista al conductor y registros"};
const AREAS=[
{id:"oficina",name:"Oficina",blocks:[
 {sheet:"cl",fam:"Control y gestión",groups:[
  ["Gestión y control",[
   [1,1,"Tabla de rutinas del campo publicada, vigente y con registro de cumplimiento (firmas/visto bueno)","Rutinas del predio (solicitud Gerencia)","Tabla visible + registro firmado"],
   [2,1,"Usuarios del predio usan Finnegans / AgroApp / APP Puduhue con clave personal (no compartida)","21. Confidencialidad e Información Privilegiada","Entrevista + revisión de usuarios"],
   [3,0,"Personal del predio sabe registrar en AgroApp / APP Puduhue lo que le corresponde (sin registros en papel pendientes de traspaso)","Registros de los planes ganaderos (38–55)","Entrevista a 2–3 operarios"],
   [4,1,"Procedimientos del predio en su versión vigente (sin versiones antiguas en uso)","ISO 45001 cl. 7.5 — Información documentada","Carpeta de procedimientos"],
   [5,1,"Plan de acción de hallazgos anteriores con responsable, plazo y avance","ISO 45001 cl. 10.2 (no conformidades)","Plan de acción"],
   [6,1,"Hallazgos de Finanzas, Inventario y Stock y RRHH de esta visita consolidados en un solo plan de acción","Coordinación de la visita (solicitud Gerencia)","Plan de acción consolidado"],
   [7,0,"Reportes del predio a Gerencia enviados en plazo","Gestión interna","Correos / reportes"],
   [8,0,"Protocolo de comunicación interna difundido con listado de firmas","32. Comunicación Interna","Listado de firmas"],
   [9,1,"Registro de control de acceso de contratistas al día","16. Control de Acceso de Contratistas","Registro de ingreso"],
   [10,0,"Nuevos ingresos (propios y contratistas) con inducción SSO / ODI y RIOHS entregado bajo firma","33. Ingreso de Colaborador Nuevo","Registro de inducción"],
   [11,0,"Camionetas con documentación al día (SOAP, permiso de circulación, revisión técnica) en SalfaFree","Siniestros de Camionetas","Consulta SalfaFree por patente"],
   [12,0,"Siniestros de camionetas declarados y gestionados según procedimiento","Siniestros de Camionetas","Registro de siniestros"],
   [13,0,"Robos, extravíos o abigeato reportados con formulario y denuncia","30. Prevención y Gestión de Robos","Anexo 1 + denuncia"]]],
  ["Cumplimiento y probidad",[
   [14,1,"Compromisos de confidencialidad firmados por quienes acceden a información sensible","21. Confidencialidad","Compromisos firmados"],
   [15,0,"Declaraciones de conflicto de interés firmadas por jefaturas y quienes compran","25. Conflicto de Interés (Anexo 1)","Declaraciones firmadas"],
   [16,0,"Canal de reporte de irregularidades conocido por el personal","24. Fraude y Probidad","Entrevista a 3 trabajadores"],
   [17,1,"Manual de Prevención del Delito difundido con registro de firmas","Manual de Prevención del Delito Rev. 06","Lista de difusión"],
   [18,0,"Sin indicios de fraude en seguros (siniestros coherentes con registros)","23. Fraude en Seguros","Revisión de casos"]]],
  ["Seguridad y EPP",[
   [19,1,"Pizarras de prevención actualizadas: fecha, contactos de emergencia, charlas, días sin accidentes","Estándar SSO / RIOHS","Pizarra con fecha de la semana"],
   [20,0,"Procedimientos de Trabajo Seguro vigentes disponibles en terreno y con registro de difusión firmado","Formulario «Difusión PST» (todos los PST)","Carpeta PST + listas de firma"],
   [21,1,"Registro individual de entrega de EPP por trabajador actualizado y firmado","9. Entrega de EPP","Registro de entrega"],
   [22,0,"Extintor vigente, señalizado y accesible; botiquín completo; plano de evacuación visible","Estándar SSO / RIOHS (por confirmar)","Observación en terreno + fecha de carga del extintor"]]]]},
 {sheet:"oa-of",fam:"Orden y aseo",title:"Orden y Aseo - Oficina",groups:[
  ["Orden",[
   [1,1,"Archivadores ordenados y rotulados por tema y año, sin documentos sueltos","11. Orden y Aseo de Oficinas","Archivadores rotulados; índice en el lomo"],
   [2,1,"Escritorios y superficies despejados, sin documentos ni materiales acumulados","11. Orden y Aseo de Oficinas",OBS],
   [3,1,"Pasillos y vías de escape libres, sin materiales ni cajas en el suelo","11. Orden y Aseo de Oficinas",OBS],
   [4,0,"Cables ordenados y sin enchufes sobrecargados (alargadores en cadena)","11. Orden y Aseo de Oficinas",OBS]]],
  ["Aseo y limpieza",[
   [5,0,"Piso, ventanas y basureros limpios; basura retirada diariamente",LH,OBS],
   [6,0,"Comedor / cocina (si aplica) limpio, sin alimentos vencidos ni loza sucia acumulada",LH,OBS]]],
  ["Baños (servicios higiénicos)",banos(6)],
  ["Registros",[[11,1,"Check-list de apertura/cierre y bitácora semanal de limpieza al día",LH,"Check-lists y bitácora"]]]]}]},
{id:"sala",name:"Sala de ordeña",blocks:[
 {sheet:"cl",fam:"Control y gestión",groups:[
  ["Gestión y control",[
   [23,0,"Registros AgroApp al día (sin atraso > 48 h): tratamientos, secados, mastitis, cojas","38, 41, 46, 55","Revisión de fechas en AgroApp"],
   [24,0,"Tratamientos veterinarios registrados con resguardo de leche (período de carencia)","46. Salud Mamaria / 50. Animales Enfermos","Registro de tratamientos"],
   [25,0,"Vacas en tratamiento identificadas (marca/cinta) y ordeñadas al final, con leche descartada","46. Salud Mamaria","Observación de la ordeña"],
   [26,0,"Rutina de ordeña aplicada: despunte, presellado, secado y sellado","46. Salud Mamaria","Observación de la ordeña"],
   [27,0,"Medición de cloro registrada vía código QR según frecuencia","6. Medición de Cloro","Registro digital QR"],
   [28,0,"Temperatura del estanque de leche registrada en cada ordeña","Buena práctica — por confirmar","Registro de temperatura"],
   [29,0,"Mantención del equipo de ordeña registrada (pezoneras, pulsadores, vacío)","Buena práctica — por confirmar","Bitácora de mantención"],
   [30,0,"Farmacia veterinaria ordenada, con lista de chequeo, control de vencimientos y cadena de frío","10. Farmacia Veterinaria","Lista de chequeo farmacia"]]],
  ["Seguridad y EPP",[
   [31,0,"Trabajadores usando el EPP que exige el estándar al momento de la visita","14. Estándar de EPP",OBS],
   [32,0,"Detergentes y químicos de lavado con hoja de seguridad (HDS), rotulados y trasvasijados según procedimiento","48. Trasvase de Productos Químicos","HDS disponibles; envases rotulados"]]]]},
 {sheet:"oa-so",fam:"Orden y aseo",title:"Orden y Aseo - Sala Ordeña",groups:[
  ["Orden",[
   [1,1,"Sala de leche y estanque sin elementos ajenos (herramientas, ropa, químicos fuera de lugar)",OA,OBS],
   [2,0,"Mangueras, utensilios y paños ordenados y colgados, no en el suelo",OA,OBS],
   [3,0,"Químicos de lavado en su lugar asignado, cerrados y rotulados","48. Trasvase de Productos Químicos",OBS]]],
  ["Aseo y limpieza",[
   [4,1,"Sala, fosos y pisos lavados después de cada ordeña, sin acumulación de guano ni leche",LH,OBS],
   [5,1,"Equipo de ordeña lavado (prelavado, lavado alcalino/ácido, enjuague) después de cada ordeña",LH,"Observación + registro de lavado"],
   [6,0,"Estanque de leche limpio por dentro y por fuera después de cada retiro",LH,"Observación + registro de lavado"],
   [7,0,"Patio de espera y pediluvio limpios y operativos",LH,OBS],
   [8,0,"Sin moscas ni roedores en exceso; cebos y trampas en su lugar","64. Control de Vectores","Observación + plano de cebos"]]],
  ["Baños (servicios higiénicos)",[...banos(8),[13,0,"Vestidor / duchas (si aplica) limpios, con ropa de trabajo colgada y sin objetos en el piso",SH,OBS]]],
  ["Registros",[
   [14,1,"Check-list de apertura/cierre y bitácora semanal de limpieza al día",LH,"Check-lists y bitácora"],
   [15,0,"Registro de lavado del equipo de ordeña y del estanque al día",LH,"Registro de lavado"]]]]}]},
{id:"ternerera",name:"Ternerera",blocks:[
 {sheet:"cl",fam:"Control y gestión",groups:[
  ["Gestión y control",[
   [33,1,"Ingreso de partos: hoja de partos coincide con AgroApp (DIIO, fecha, sexo, calostro)","43. Atención de Parto y Recién Nacido","Hoja de partos vs AgroApp (muestra 10)"],
   [34,0,"Calostro registrado: calidad (calostrímetro / Brix), cantidad y hora de entrega","43. Atención de Parto y Recién Nacido","Registro de calostro"],
   [35,0,"Terneros identificados con DIIO y curación de ombligo registrada","43. Atención de Parto y Recién Nacido","Observación + registro"],
   [36,0,"Programa de alimentación de terneros publicado (leche/sustituto, concentrado, agua)","Buena práctica — por confirmar","Programa visible en ternerera"],
   [37,0,"Enfermedades y tratamientos de terneros (diarreas, neumonías) registrados en AgroApp","50. Animales Enfermos","Registro AgroApp"],
   [38,0,"Muertes registradas con DIIO en AgroApp y cadáveres dispuestos según procedimiento","47. Disposición de Cadáveres","Registro AgroApp + registro de disposición"]]],
  ["Seguridad y EPP",[
   [39,0,"Trabajadores usando EPP en ternerera (botas, guantes al manejar animales enfermos)","14. Estándar de EPP",OBS]]]]},
 {sheet:"oa-te",fam:"Orden y aseo",title:"Orden y Aseo - Ternerera",groups:[
  ["Orden",[
   [1,0,"Pasillos despejados, sin herramientas ni insumos en el suelo",OA,OBS],
   [2,0,"Área de preparación de leche / sustituto ordenada y con insumos rotulados",OA,OBS],
   [3,0,"Cadáveres retirados el mismo día, sin acopio en la ternerera","47. Disposición de Cadáveres",OBS]]],
  ["Aseo y limpieza",[
   [4,1,"Cunas / corrales con cama seca y limpia, renovada según frecuencia",LH,OBS],
   [5,1,"Baldes, mamaderas y chupetes lavados y desinfectados después de cada uso",LH,OBS],
   [6,0,"Bebederos limpios y con agua disponible",LH,OBS],
   [7,0,"Cunas desocupadas lavadas y desinfectadas antes de ingresar un ternero nuevo (vacío sanitario)",LH,"Observación + registro"],
   [8,0,"Sin moscas ni roedores en exceso; cebos y trampas en su lugar","64. Control de Vectores","Observación + plano de cebos"]]],
  ["Baños (servicios higiénicos)",[...banos(8),[13,0,"Si la ternerera no tiene baño propio: el personal tiene acceso a uno cercano (indicar cuál en observaciones)",SH,OBS]]],
  ["Registros",[[14,1,"Bitácora semanal de limpieza y desinfección de la ternerera al día",LH,"Bitácora"]]]]}]},
{id:"bodega",name:"Bodega",blocks:[
 {sheet:"cl",fam:"Control y gestión",groups:[
  ["Gestión y control",[
   [40,0,"Inventario de herramientas, radios y equipos menores con responsable asignado y registro de entrega","8. Radiotransmisores (Anexo R5)","Registro de entrega"],
   [41,0,"Residuos peligrosos y sólidos acopiados correctamente, con guías y declaración SIDREP/SINADER","66 / 67. Retiro de Residuos","Guías + comprobantes"]]],
  ["Seguridad y EPP",[
   [42,0,"Productos químicos con hoja de seguridad (HDS), rotulados y trasvasijados según procedimiento","48. Trasvase de Productos Químicos","HDS disponibles; envases rotulados"],
   [43,0,"Combustibles y lubricantes en zona ventilada, con bandeja antiderrame y lejos de fuentes de ignición","Buena práctica — por confirmar",OBS],
   [44,0,"Estanterías estables, carga pesada abajo; extintor vigente y señalizado","Estándar SSO / RIOHS (por confirmar)",OBS]]]]},
 {sheet:"oa-bo",fam:"Orden y aseo",title:"Orden y Aseo - Bodega",groups:[
  ["Orden",[
   [1,1,"Estanterías rotuladas por tipo de insumo, sin productos en el piso",OA,OBS],
   [2,1,"Pasillos y salidas libres, sin materiales que obstruyan",OA,OBS],
   [3,0,"Químicos separados de alimentos, medicamentos y EPP","48. Trasvase de Productos Químicos",OBS],
   [4,0,"Herramientas en su lugar asignado (panel o estante)",OA,OBS],
   [5,0,"Envases vacíos de químicos (con triple lavado) acopiados en zona definida","66 / 67. Retiro de Residuos",OBS]]],
  ["Aseo y limpieza",[
   [6,0,"Piso limpio, sin derrames de aceite, combustible ni químicos",LH,OBS],
   [7,0,"Residuos sólidos y peligrosos separados y rotulados en su punto de acopio","66 / 67. Retiro de Residuos",OBS],
   [8,0,"Sin roedores ni daño por plagas; cebos en su lugar","64. Control de Vectores","Observación + plano de cebos"]]],
  ["Baños (servicios higiénicos)",[...banos(8),[13,0,"Si la bodega no tiene baño propio: el personal tiene acceso a uno cercano (indicar cuál en observaciones)",SH,OBS]]],
  ["Registros",[[14,1,"Bitácora semanal de limpieza de bodega al día",LH,"Bitácora"]]]]}]},
{id:"predio",name:"Predio general",blocks:[
 {sheet:"cl",fam:"Control y gestión",groups:[
  ["Maquinaria y vehículos",[
   [45,1,"Listado de maquinaria y equipos con estado (operativo / en falla / fuera de servicio) y fallas reportadas","7. Permiso Trabajo con Maquinaria / 62. Ingreso Maquinaria","Listado actualizado"],
   [46,0,"Registro de mantenciones e intervalos de servicio de tractores al día","61. Conducción de Tractor Kubota","Bitácora de mantención"],
   [47,0,"Maquinaria de terceros con permiso de trabajo emitido antes de operar","7. Permiso de Trabajo con Maquinaria","Permisos firmados"],
   [48,1,"Registro de ingreso de camiones y maquinaria al predio al día","57. Ingreso de Camiones y Maquinaria","Formulario de ingreso"],
   [49,0,"Grupo electrógeno con bitácora de mantenciones y cargas de combustible","60. Grupo Electrógeno","Bitácora del generador"]]],
  ["Perímetro y control sanitario",[
   [50,0,"Control perimetral: cercos y portones en buen estado, inspección quincenal registrada","4. Control Perimetral","Bitácora quincenal"],
   [51,0,"Control de vectores con calendario de servicio y registros del proveedor","64. Control de Vectores","Calendario + informes"]]],
  ["Ganado",[
   [52,0,"Conteo físico de ganado cuadra con inventario AgroApp","AgroApp / 47. Disposición de Cadáveres","Acta de conteo"],
   [53,0,"Ventas de ganado con planilla de control y guía de despacho, cuadradas con AgroApp","51. Venta de Ganado","Planilla Anexo + guías"]]]]}]},
{id:"camioneta",name:"Camioneta",blocks:[]} /* v113: Check list de camionetas (ítems en CM_ITEMS, por la tanda de CL_NUEVOS) */
];
// índice plano
const CL_ITEMS=[]; const CL_BYKEY={}; const CL_DEFAULT=[];
AREAS.forEach(a=>a.blocks.forEach(b=>b.groups.forEach(([g,list])=>list.forEach(r=>{
  const it={key:b.sheet+"-"+r[0],n:r[0],star:!!r[1],txt:r[2],prot:r[3],evid:r[4],area:a.id,areaName:a.name,sheet:b.sheet,fam:b.fam,group:g};
  it.orden=CL_DEFAULT.length;CL_DEFAULT.push(it);}))));
/* ===== Catálogo del check list: vive en OneDrive (_config/Catalogo_check_list.xlsx); el de arriba es el valor inicial ===== */
const AREA_NAME={};AREAS.forEach(a=>AREA_NAME[a.id]=a.name);
const OA_CODE={oficina:"of",sala:"so",ternerera:"te",bodega:"bo",predio:"pr",camioneta:"cm"};
/* hoja de un ítem de Control y gestión según su área: «cm» en camionetas (códigos CM-NN), «cl» en las demás */
const hojaCG=area=>area==="camioneta"?"cm":"cl";
const CATK="actas-cl-catalogo";let CAT_ETAG="",CAT_ORIGEN="inicial";
/* v71: ítems que se agregan una sola vez al catálogo (también al que está en OneDrive), sin tocar los existentes.
   Si alguno de una tanda ya está en el catálogo (aunque esté retirado), la tanda no se vuelve a agregar. */
const CL_NUEVOS=[{tanda:"v71-camionetas",area:"predio",group:"Camionetas",despues:"cl-49",items:[
 ["cl-cam1",1,"Cada camioneta del predio tiene su Acta de entrega y responsabilidad de vehículo firmada por el conductor (patente, kilometraje de entrega y estado inicial)","Acta de entrega de vehículo — Flota Salfa Rent","Copia del acta firmada; anotar la patente en observaciones"],
 ["cl-cam2",0,"Accesorios de seguridad a bordo: rueda de repuesto, gata, llave de rueda, triángulos, chaleco reflectante, extintor vigente y botiquín","Acta de entrega de vehículo, ítems 1 a 7","Revisión de la camioneta"],
 ["cl-cam3",0,"Manual del conductor, TAG y llaves según lo entregado en el acta","Acta de entrega de vehículo, ítems 8 a 10","Revisión de la camioneta"],
 ["cl-cam4",1,"Documentos a bordo y vigentes: permiso de circulación, revisión técnica, revisión de gases, SOAP y póliza de seguro","Acta de entrega de vehículo, ítems 11 y 12","Documentos en la camioneta (fechas de vencimiento)"],
 ["cl-cam5",1,"Mantenciones al día: la camioneta se presentó en un taller autorizado por Salfa Rent cada 10.000 km (tolerancia máxima de 500 km)","Acta de entrega de vehículo, punto 2.6","Kilometraje actual vs. última mantención (registro Salfa Rent o libro de servicio)"],
 ["cl-cam6",1,"Si la camioneta tiene choques o daños visibles: el administrador avisó de inmediato a su jefatura y entregó la documentación del siniestro dentro de 24 horas (sin daños: marcar N/A)","Acta de entrega de vehículo, puntos 2.9 y 2.13","Observación de la camioneta + preguntar al administrador si avisó"],
 ["cl-cam7",0,"Chequeo diario preoperacional realizado: niveles, neumáticos, luces, frenos, cinturones, parabrisas y alarma de retroceso","Acta de entrega de vehículo, punto 2.5","Entrevista al conductor"],
 ["cl-cam8",0,"Interior sin señales de fumar o vapear; carga amarrada y bien estibada, sin personas en la pickup","Acta de entrega de vehículo, puntos 2.4 y 2.7",OBS]]},
 /* v112: estado de cada camioneta, revisado por quien hace la visita (pedido por Benja el 19-10-2026) */
 {tanda:"v112-estado-camionetas",area:"predio",group:"Camionetas",despues:"cl-cam8",items:[
 ["cl-cam9",0,"Estado general de cada camioneta: carrocería, neumáticos, luces, parabrisas y limpieza interior (marcar las patentes con problemas y anotar el kilometraje en la observación)","Acta de entrega de vehículo, puntos 2.5 y 2.13","Revisión de la camioneta con fotos"]]},
 /* v113: el Check list de camionetas (aparte); al agregarse, retira del check list de visitas el grupo Camionetas */
 {tanda:"v113-check-list-camionetas",area:"camioneta",sheet:"cm",grupos:CM_ITEMS,retira:["cl-cam1","cl-cam2","cl-cam3","cl-cam4","cl-cam5","cl-cam6","cl-cam7","cl-cam8","cl-cam9"]}];
let CAT_AGREGADO=false;
function agregarNuevos(lista){let out=lista.map(i=>Object.assign({},i)),add=false;
  for(const t of CL_NUEVOS){const sh=t.sheet||"cl";
    /* v113: una tanda puede traer grupos ([grupo,[[clave,clave?,texto,punto del acta]]]) en vez de items */
    const filas=t.items||[].concat(...t.grupos.map(([g,L])=>L.map(x=>[x[0],x[1],x[2],`${CM_ACTA}, ${x[3]}`,CM_EVID[g]||OBS,g])));
    if(filas.some(x=>out.some(i=>i.key===x[0])))continue;
    let n=Math.max(0,...out.filter(i=>i.sheet===sh).map(i=>+i.n||0));
    const ord=out.sort((a,b)=>(a.orden||0)-(b.orden||0));
    let pos=ord.findIndex(i=>i.key===t.despues);
    if(pos<0){const ps=ord.map((i,k)=>i.area===t.area?k:-1).filter(k=>k>=0);pos=ps.length?ps[ps.length-1]:ord.length-1}
    ord.splice(pos+1,0,...filas.map(x=>({key:x[0],area:t.area,sheet:sh,fam:"Control y gestión",group:x[5]||t.group,n:++n,txt:x[2],prot:x[3],evid:x[4],star:!!x[1]})));
    (t.retira||[]).forEach(k=>{const i=ord.find(x=>x.key===k);if(i)i.retirado=true});
    ord.forEach((i,k)=>i.orden=k);out=ord;add=true}
  return {lista:out,add}}
function catalogoSet(lista){const ag=agregarNuevos(lista);lista=ag.lista;if(ag.add)CAT_AGREGADO=true;CL_ITEMS.length=0;for(const k of Object.keys(CL_BYKEY))delete CL_BYKEY[k];
  lista.slice().sort((a,b)=>(a.orden||0)-(b.orden||0)).forEach((x,i)=>{const it=Object.assign({},x,{orden:i,areaName:AREA_NAME[x.area]||x.area});CL_ITEMS.push(it);CL_BYKEY[it.key]=it})}
catalogoSet(CL_DEFAULT);
try{const c=JSON.parse(localStorage.getItem(CATK)||"null");if(c&&c.items&&c.items.length){catalogoSet(c.items);CAT_ETAG=c.etag||"";CAT_ORIGEN="onedrive"}}catch(e){}
const catalogoActivo=()=>CL_ITEMS.filter(i=>!i.retirado);
const compactar=i=>[i.key,i.area,i.sheet,i.fam,i.group,i.n,i.txt,i.prot||"",i.evid||"",i.star?1:0];
const expandir=r=>({key:r[0],area:r[1],areaName:AREA_NAME[r[1]]||r[1],sheet:r[2],fam:r[3],group:r[4],n:r[5],txt:r[6],prot:r[7],evid:r[8],star:!!r[9]});
/* Dos check list con el mismo motor (desde la v58): "visitas" (Control y Gestión, todas las áreas menos Bodega) y "bodega" */
const CLK={
  visitas:{tipo:"visitas",act:"cl",titulo:"Check list de visitas",root:"01RAJ2KQCX5EEP6HGCTBA2KO2DSGC4F7LS",carpeta:"Visitas a predios",acomp:"Administrador(a) del campo",acompPh:"Quien acompaña la visita",acompX:"Administrador",pdf:"Check list de visitas · Control y Gestión",archivo:"visita",excel:"Check_list_"},
  bodega:{tipo:"bodega",act:"clb",titulo:"Check list de bodega",root:"01RAJ2KQCDFWQKAL4FGVGIAV7CDLCSWXQW",carpeta:"Bodegas",acomp:"Encargado(a) de bodega",acompPh:"Quien acompaña la revisión",acompX:"Encargado de bodega",pdf:"Check list de bodega · Orden, aseo y seguridad",archivo:"bodega",excel:"Check_list_bodega_"},
  /* v113: la carpeta de OneDrive se busca (o se crea) junto a la de visitas la primera vez (root:null).
     v118: las tres están en «Check list de cumplimiento» y se llaman como en la app (Visitas a predios, Bodegas, Camionetas) */
  camionetas:{tipo:"camionetas",act:"clc",titulo:"Check list de camionetas",root:null,carpeta:"Camionetas",acomp:"Conductor(a)",acompPh:"Quien usa la camioneta",acompX:"Conductor",pdf:"Check list de camioneta · Acta de entrega de vehículo",archivo:"camioneta",excel:"Check_list_camioneta_",
    uni:"camioneta",unis:"camionetas",Unis:"Camionetas"}
};
["visitas","bodega"].forEach(t=>Object.assign(CLK[t],{uni:"predio",unis:"predios",Unis:"Predios"}));
const tipoDe=v=>v&&v.tipo==="bodega"?"bodega":v&&v.tipo==="camionetas"?"camionetas":"visitas";
const enTipo=(tipo,area)=>tipo==="bodega"?area==="bodega":tipo==="camionetas"?area==="camioneta":area!=="bodega"&&area!=="camioneta";
let clTipo="visitas";const KC=()=>CLK[clTipo];
const areasDe=tipo=>AREAS.filter(a=>enTipo(tipo,a.id));
/* Cómo se nombra un ítem en listas: por área en el check list de visitas; por grupo en el de bodega (tiene una sola área) */
const etqIt=(it,tipo)=>(tipo||clTipo)!=="visitas"?it.group:it.areaName;
/* Secciones para resúmenes: las áreas, o los tipos de ítem cuando hay una sola área (bodega) */
function seccionesDe(tipo,items){const as=areasDe(tipo).filter(a=>items.some(i=>i.area===a.id));let S;
  if(as.length>1){S=as.map(a=>({name:a.name,f:i=>i.area===a.id}));S.col="Área"}else{S=[...new Set(items.map(i=>i.fam))].map(f=>({name:f,f:i=>i.fam===f}));S.col="Tipo"}return S}
/* Ítems de una visita: su copia propia (desde la v46) o el catálogo vigente, más los ítems retirados que esa visita sí evaluó; solo los de su check list */
/* v116: los ítems del catálogo guardado en cada visita se arman una vez por visita (se usaban en cada tarjeta y predio) */
const ITEMS_CAT=new WeakMap();
function itemsDe(v){const t=tipoDe(v);if(v&&v.catalogo){let m=ITEMS_CAT.get(v.catalogo);if(!m){m={};ITEMS_CAT.set(v.catalogo,m)}return m[t]||(m[t]=v.catalogo.map(expandir).filter(i=>enTipo(t,i.area)))}return CL_ITEMS.filter(i=>enTipo(t,i.area)&&(!i.retirado||(v&&v.items&&v.items[i.key]&&v.items[i.key].e)))}
function itemDe(v,key){if(v&&v.catalogo){const r=v.catalogo.find(x=>x[0]===key);if(r)return expandir(r)}return CL_BYKEY[key]||null}
function catalogoUnion(vs,tipo){tipo=tipo||"visitas";const m={};CL_ITEMS.forEach(i=>{if(enTipo(tipo,i.area))m[i.key]=i});vs.forEach(v=>itemsDe(v).forEach(i=>{if(!m[i.key])m[i.key]=Object.assign({},i,{retirado:true})}));return Object.values(m).sort((a,b)=>(a.orden??999)-(b.orden??999))}
const CAT_HEAD=["Código","Área","Tipo","Grupo","Nº","Ítem","Referencia","Cómo verificar","Clave","Retirado","Orden"];
function catalogoAExcel(){const wb=XLSX.utils.book_new();const rows=[CAT_HEAD];
  CL_ITEMS.forEach(i=>rows.push([i.key,i.areaName,i.fam,i.group,i.n,i.txt,i.prot||"",i.evid||"",i.star?"Sí":"",i.retirado?"Sí":"",i.orden]));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[10,14,18,26,5,70,34,30,6,8,6].map(w=>({wch:w}));ws["!freeze"]={xSplit:0,ySplit:1};XLSX.utils.book_append_sheet(wb,ws,"Catalogo");
  const ay=XLSX.utils.aoa_to_sheet([["Cómo editar este catálogo"],[""],["Cada fila es un ítem del check list. Puedes cambiar el texto, la referencia, cómo verificar, el grupo, el área, la marca de ítem clave (Sí) y retirar un ítem (Sí en Retirado)."],["Para agregar un ítem, agrega una fila y deja Código en blanco: la app le asigna uno al leer el archivo. No cambies el Código de los ítems existentes, porque es lo que une cada ítem con su historial."],["Áreas válidas: "+AREAS.map(a=>a.name).join(", ")+". Tipos válidos: Control y gestión, Orden y aseo."],["La app toma los cambios en la siguiente sincronización. Cada visita guarda su propia copia del catálogo del día, así que los cambios no alteran visitas cerradas."]]);ay["!cols"]=[{wch:120}];XLSX.utils.book_append_sheet(wb,ay,"Instrucciones");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"})}
function catalogoDesdeExcel(buf){const wb=XLSX.read(buf,{type:"array"});const ws=wb.Sheets["Catalogo"]||wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const head=rows[0].map(x=>String(x).trim().toLowerCase());const col=n=>head.findIndex(h=>h.startsWith(n));
  const C={key:col("c"),area:col("área")>=0?col("área"):col("area"),fam:col("tipo"),group:col("grupo"),n:col("nº")>=0?col("nº"):col("n"),txt:col("ítem")>=0?col("ítem"):col("item"),prot:col("ref"),evid:col("cómo")>=0?col("cómo"):col("como"),star:col("clave"),ret:col("retirado"),orden:col("orden")};
  if(C.txt<0||C.area<0)throw new Error("El archivo del catálogo no tiene las columnas esperadas.");
  const out=[];const usados=new Set();
  rows.slice(1).forEach((r,i)=>{const txt=String(r[C.txt]||"").trim();if(!txt)return;
    const areaName=String(r[C.area]||"").trim();const ar=AREAS.find(a=>a.name.toLowerCase()===areaName.toLowerCase()||a.id===areaName.toLowerCase());if(!ar)return;
    const fam=String(r[C.fam]||"").trim();const esOA=/orden/i.test(fam);const sheet=esOA?"oa-"+OA_CODE[ar.id]:hojaCG(ar.id);
    let key=String(r[C.key]||"").trim();let n=parseInt(r[C.n]);
    if(!n||isNaN(n)){n=1;while(usados.has(sheet+"-"+n)||out.some(x=>x.sheet===sheet&&x.n===n))n++}
    if(!key){key=sheet+"-"+n;let k=2;while(usados.has(key)){key=sheet+"-"+n+"-"+(k++)}}
    if(usados.has(key))return;usados.add(key);
    out.push({key,area:ar.id,sheet,fam:fam||(esOA?"Orden y aseo":"Control y gestión"),group:String(r[C.group]||"").trim()||"General",n,txt,prot:String(r[C.prot]||"").trim(),evid:String(r[C.evid]||"").trim(),star:/^s/i.test(String(r[C.star]||"")),retirado:/^s/i.test(String(r[C.ret]||"")),orden:C.orden>=0&&r[C.orden]!==""?+r[C.orden]:i})});
  if(!out.length)throw new Error("El catálogo está vacío.");return out}
const CAT_PATH=["_config"],CAT_FILE="Catalogo_check_list.xlsx";
async function cargarCatalogo(){
  if(!DB||navigator.onLine===false)return false;
  let meta=null;try{const f=await clCarpeta(CAT_PATH);meta=await gjson(`/drives/${M365.drive}/items/${f}:/${encName(CAT_FILE)}?$select=id,eTag`)}catch(e){if(e.code!=="not_found")throw e}
  if(!meta){if(esAdmin()){await guardarCatalogo(false);return true}return false}
  if(meta.eTag===CAT_ETAG){if(CAT_AGREGADO&&esAdmin()){CAT_AGREGADO=false;await guardarCatalogo(false)}return false}
  const r=await gfetch(`/drives/${M365.drive}/items/${meta.id}/content`);const buf=await r.arrayBuffer();
  const lista=catalogoDesdeExcel(buf);CAT_AGREGADO=false;catalogoSet(lista);CAT_ETAG=meta.eTag;CAT_ORIGEN="onedrive";
  if(CAT_AGREGADO&&esAdmin()){CAT_AGREGADO=false;await guardarCatalogo(false);return true}
  try{localStorage.setItem(CATK,JSON.stringify({etag:CAT_ETAG,items:CL_ITEMS.map(i=>({key:i.key,area:i.area,sheet:i.sheet,fam:i.fam,group:i.group,n:i.n,txt:i.txt,prot:i.prot,evid:i.evid,star:i.star,retirado:i.retirado,orden:i.orden}))}))}catch(e){}
  return true}
async function guardarCatalogo(manual){
  if(!esAdmin()){toast("Solo el administrador puede modificar el catálogo.");return false}
  if(!DB||navigator.onLine===false){toast("Sin señal: el catálogo se guarda en OneDrive cuando haya conexión.");CAT_PEND=true;return false}
  try{const buf=catalogoAExcel();const r=await clSubir(CAT_PATH,CAT_FILE,new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");CAT_ETAG=r.eTag||"";CAT_ORIGEN="onedrive";CAT_PEND=false;
    try{localStorage.setItem(CATK,JSON.stringify({etag:CAT_ETAG,items:CL_ITEMS.map(i=>({key:i.key,area:i.area,sheet:i.sheet,fam:i.fam,group:i.group,n:i.n,txt:i.txt,prot:i.prot,evid:i.evid,star:i.star,retirado:i.retirado,orden:i.orden}))}))}catch(e){}
    if(manual)toast("Catálogo guardado en OneDrive.");return true}
  catch(e){console.error(e);if(excelBloqueado(e))toast("El archivo del catálogo está abierto en Excel por alguien. Ciérralo y vuelve a guardar.");else toast("No se pudo guardar el catálogo: "+errMsg(e));CAT_PEND=true;return false}
}
let CAT_PEND=false;
function itemConHistorial(key){return Object.values(VIS).some(v=>v.items&&v.items[key]&&v.items[key].e)}
const CL_LABEL={C:"Cumple",P:"Parcial",N:"No cumple",NA:"N/A"};
const SCORE={C:1,P:.5,N:0};


/* ============================================================
   MÓDULO: Check list de visitas (Control y Gestión)
   Visitas ilimitadas por predio, hallazgos con seguimiento entre visitas,
   fotos y Excel/PDF en OneDrive.
   ============================================================ */
const CL={root:"01RAJ2KQCX5EEP6HGCTBA2KO2DSGC4F7LS",datos:"_datos"}; /* carpeta "Check list de visitas" en Apps de terreno */
/* v138 (B-15): el administrador lo dice el servidor (rolesSrv, index.html); el código público ya no trae su correo */
const esAdmin=()=>!!(ME&&ME.correo&&rolesSrv().admin);
const RESP=["Administrador del campo","RR.HH.","Prevención de Riesgos","Finanzas","Control y Gestión"];
const respDe=t=>t==="bodega"?["Encargado de bodega"].concat(RESP):RESP;
const codigo=it=>(it.sheet==="cl"?"CG-":it.sheet==="cm"?"CM-":"OA-")+String(it.n).padStart(2,"0");
let VIS={},clv=null,clPredio=null,clArea="oficina",clFiltro="all";
const esHallazgo=e=>e==="P"||e==="N";
/* v112: ítems con patentes (estado de las camionetas): se marcan las que tienen problemas; van en la observación del PDF,
   del Excel y de los hallazgos como «Patentes: …» */
const CL_PAT=["cl-cam9"];
const clObs=r=>[r&&r.pat&&r.pat.length?"Patentes: "+r.pat.join(", "):"",String(r&&r.obs||"").trim()].filter(Boolean).join(". ");
const normPat=x=>String(x||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
/* patentes con acta de entrega de vehículo vigente (sin devolución cerrada) en el predio */
function patentesPredio(pre){try{return [...new Set(Object.values(ACTAS).filter(a=>a.tipo==="vehiculo"&&a.mov!=="devolucion"&&!a.anulada&&predioDe(a)===pre&&!(a.devolucionId&&ACTAS[a.devolucionId]&&ACTAS[a.devolucionId].estado==="cerrada")).map(a=>normPat((a.veh||{}).patente)).filter(Boolean))].sort()}catch(e){return[]}}
function clPatHTML(v,it,r,ro){const L=patentesPredio(v.predio),sel=r.pat||[],T=[...new Set(L.concat(sel))];
  return `<div class="f clpat" style="margin:8px 0 14px"><label>Camionetas con problemas (patente)</label><div class="filt" style="margin:4px 0 0">${T.map(p=>`<button type="button" class="fb" data-a="clPat" data-k="${esc(it.key)}" data-v="${esc(p)}" aria-pressed="${sel.includes(p)}" ${ro?"disabled":""}>${esc(p)}</button>`).join("")}${ro?"":`<button type="button" class="fb" data-a="clPatOtra" data-k="${esc(it.key)}">+ Otra</button>`}</div>${T.length?"":`<span class="hint">No hay actas de vehículo de este predio en la app; agrega la patente con «+ Otra».</span>`}</div>`}

/* ---------- v113: camionetas (patentes) desde las actas de entrega de vehículo ---------- */
/* acta de entrega más reciente de una patente (no anulada) */
function actaPatente(p){try{const L=Object.values(ACTAS).filter(a=>a.tipo==="vehiculo"&&a.mov!=="devolucion"&&!a.anulada&&normPat((a.veh||{}).patente)===p);
  L.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));return L[0]||null}catch(e){return null}}
/* camionetas del check list: las que tienen acta de entrega sin devolución cerrada, más las que ya tienen revisiones */
function patentesCL(){const s=new Set();try{Object.values(ACTAS).forEach(a=>{if(a.tipo==="vehiculo"&&a.mov!=="devolucion"&&!a.anulada&&!(a.devolucionId&&ACTAS[a.devolucionId]&&ACTAS[a.devolucionId].estado==="cerrada")){const p=normPat((a.veh||{}).patente);if(p)s.add(p)}})}catch(e){}
  Object.values(VIS).forEach(v=>{if(v&&!v.anulada&&v.tipo==="camionetas"&&v.predio)s.add(v.predio)});return [...s].sort()}
/* v124: el check list de bodega suma bodegas que no son predios (Corte Alto, pedido por Benja el 27-10-2026) */
const BODEGAS_EXTRA=["Corte Alto"];
const unidadesCL=tipo=>{const t=tipo||clTipo;if(t==="camionetas")return patentesCL();const L=prediosCL(t);
  return t==="bodega"?L.concat(BODEGAS_EXTRA.filter(b=>!L.includes(b))).sort((a,b)=>a.localeCompare(b,"es")):L};
const cmDesc=p=>{const a=actaPatente(p);if(!a)return"Sin acta de entrega en la app";const ve=a.veh||{};return [[ve.marca,ve.modelo,ve.anio].filter(Boolean).join(" "),predioDe(a),a.conductor].filter(Boolean).join(" · ")};
const kmNum=x=>+String(x||"").replace(/[^0-9]/g,"")||0;
/* kilometraje: lo recorrido desde la entrega y la próxima mantención de los 10.000 km (±500) */
function cmKmInfo(v){const a=actaPatente(v.predio),ke=a?kmNum((a.veh||{}).km):0,k=kmNum(v.km);if(!k)return null;
  const m=Math.ceil(k/10000)*10000,falta=m-k,pasado=k%10000,toca=pasado>0&&pasado<=500?Math.floor(k/10000)*10000:0;
  return {k,ke,rec:ke&&k>=ke?k-ke:null,menor:ke&&k<ke,prox:m===k?m+10000:m,falta:m===k?10000:falta,toca}}
function cmKmTxt(i){if(!i)return"";return [i.menor?"El km es menor que el del acta de entrega":i.rec!=null?`Recorrido desde la entrega: ${i.rec.toLocaleString("es-CL")} km`:"",
  i.toca?`Le toca la mantención de los ${i.toca.toLocaleString("es-CL")} km (±500)`:`Próxima mantención: ${i.prox.toLocaleString("es-CL")} km (faltan ${i.falta.toLocaleString("es-CL")} km)`].filter(Boolean).join(" · ")}
/* lo que dice el acta de entrega de un ítem cm-acc-<k> o cm-doc-<k>: "si", "no" o "" */
function cmEntrega(v,key){const m=/^cm-(acc|doc)-(.+)$/.exec(key);if(!m)return null;const a=actaPatente(v.predio);if(!a)return null;return ((m[1]==="acc"?a.acc:a.docs)||{})[m[2]]||""}

/* ---------- Datos ---------- */
function visitasDe(predio,tipo){tipo=tipo||clTipo;return Object.values(VIS).filter(v=>v.predio===predio&&tipoDe(v)===tipo).sort((a,b)=>(a.n-b.n)||String(a.fecha).localeCompare(String(b.fecha)))}
const validas=(predio,tipo)=>visitasDe(predio,tipo).filter(v=>!v.anulada);
function visitaAbierta(predio,tipo){return validas(predio,tipo).find(v=>v.estado!=="cerrada")||null}
function visitaAnterior(v){const L=validas(v.predio,tipoDe(v)).filter(x=>x.estado==="cerrada"&&x.id!==v.id&&(x.n<v.n));return L[L.length-1]||null}
function puntaje(v,filtro){
  let s=0,n=0,rev=0;itemsDe(v).forEach(it=>{if(filtro&&!filtro(it))return;const r=v.items&&v.items[it.key];if(!r||!r.e)return;rev++;if(r.e==="NA")return;s+=SCORE[r.e];n++});
  return{pct:n?Math.round(s/n*100):null,n,rev};
}
/* Hallazgos derivados del historial de visitas cerradas: un ítem está abierto si su última evaluación fue Parcial o No cumple */
function hallazgos(predio,tipo){
  const mk=predio+"|"+(tipo||clTipo);if(RENDER_MEMO&&RENDER_MEMO.has(mk))return RENDER_MEMO.get(mk);const out=hallazgos0(predio,tipo);if(RENDER_MEMO)RENDER_MEMO.set(mk,out);return out}
function hallazgos0(predio,tipo){
  const vs=validas(predio,tipo).filter(v=>v.estado==="cerrada");const out={};
  vs.forEach(v=>itemsDe(v).forEach(it=>{const r=v.items&&v.items[it.key];if(!r||!r.e)return;
    const h=out[it.key]||(out[it.key]={key:it.key,it,estado:"ok",desde:null,visitas:0,ultima:null,plan:{},cerrado:null,hist:[]});h.it=it;
    h.hist.push({v:v.n,fecha:v.fecha,e:r.e,obs:clObs(r)});
    if(esHallazgo(r.e)){if(h.estado!=="abierto"){h.estado="abierto";h.desde={v:v.n,fecha:v.fecha};h.visitas=0;h.cerrado=null}h.visitas++;h.ultima={v:v.n,fecha:v.fecha,e:r.e,obs:clObs(r)};h.plan={acc:r.acc||"",resp:r.resp||"",plazo:r.plazo||""}}
    else if(h.estado==="abierto"&&r.e==="C"){h.estado="cerrado";h.cerrado={v:v.n,fecha:v.fecha,e:r.e}} /* v136 (M-08): solo «Cumple» cierra; «N/A» no */
  }));
  return out;
}
const abiertos=(predio,tipo)=>Object.values(hallazgos(predio,tipo)).filter(h=>h.estado==="abierto");
function nuevaVisita(predio,tipo){tipo=tipo||clTipo;
  const vs=visitasDe(predio,tipo),n=(vs.length?Math.max(...vs.map(v=>v.n||0)):0)+1;
  const v={id:uid(),_col:"visitas",predio,n,fecha:today(),revisor:ME?ME.nombre:"",estado:"abierta",items:{},catalogo:catalogoActivo().filter(i=>enTipo(tipo,i.area)).map(compactar),creadoPor:yo(),creado:new Date().toISOString(),actualizado:new Date().toISOString()};if(tipo==="bodega")v.tipo="bodega";
  if(tipo==="camionetas"){v.tipo="camionetas";const a=actaPatente(predio);if(a){v.administrador=a.conductor||"";v.predioCampo=predioDe(a)||""}}
  /* el plan de acción de los hallazgos abiertos viene prellenado para no reescribirlo */
  Object.values(hallazgos(predio,tipo)).forEach(h=>{if(h.estado==="abierto")v.items[h.key]={acc:h.plan.acc,resp:h.plan.resp,plazo:h.plan.plazo}});
  return v;
}
/* ---------- Traspaso al Check list de bodega (v58) ----------
   Lo revisado de bodega dentro de una visita del check list general pasa a una visita del Check list de bodega
   con la misma fecha, revisor, respuestas, fotos y plan de acción. Una visita cerrada no se modifica; una en curso
   entrega sus respuestas de bodega. Solo se traspasa si hay algo revisado (no si todo quedó en N/A). */
const infoBod=r=>!!r&&((r.e&&r.e!=="NA")||!!(r.obs||"").trim()||(r.fotos||[]).length>0||!!(r.acc||"").trim());
function clavesBodega(v){const cat=v.catalogo?v.catalogo.map(expandir):CL_ITEMS;const ks=new Set(cat.filter(i=>i.area==="bodega").map(i=>i.key));
  Object.keys(v.items||{}).forEach(k=>{const it=CL_BYKEY[k];if(it&&it.area==="bodega")ks.add(k)});return [...ks].filter(k=>v.items&&v.items[k])}
/* v136 (M-12): dos visitas del mismo predio y tipo con el mismo número (abiertas en dos teléfonos sin señal): la abierta más
   nueva creada en este teléfono pasa al número siguiente. Las cerradas no se renumeran (su número está en el nombre de la carpeta). */
function clRenumerar(){
  if(!ME)return 0;let n=0;const G={};
  Object.values(VIS).forEach(v=>{if(!v||v.anulada||!v.predio)return;(G[v.predio+"|"+tipoDe(v)]=G[v.predio+"|"+tipoDe(v)]||[]).push(v)});
  for(const L of Object.values(G)){const porN={};L.forEach(v=>{(porN[v.n]=porN[v.n]||[]).push(v)});
    for(const D of Object.values(porN)){if(D.length<2)continue;
      D.sort((a,b)=>String(a.creado||"").localeCompare(String(b.creado||""))||String(a.id).localeCompare(String(b.id)));
      for(const v of D.slice(1)){if(v.estado==="cerrada"||!v.creadoPor||v.creadoPor.id!==ME.id||clv===v)continue;
        const antes=v.n;v.n=Math.max(...L.map(x=>+x.n||0))+1;v.actualizado=new Date().toISOString();saveVis(v);n++;
        toast(`La visita ${antes} a ${v.predio} ya existía en otro teléfono: la tuya pasó a ser la visita ${v.n}.`,6000)}}}
  return n}
function traspasarBodega(){
  if(!loaded)return 0;let n=0;try{clRenumerar()}catch(e){console.warn("renumerar",e)}
  /* v136 (M-13): solo visitas cerradas o creadas por quien usa la app (no se editan visitas abiertas de otras personas) */
  const fuentes=Object.values(VIS).filter(v=>tipoDe(v)==="visitas"&&(v.estado==="cerrada"||(ME&&v.creadoPor&&v.creadoPor.id===ME.id))&&!VIS["bod-"+v.id]&&!DELQ.has("visitas/bod-"+v.id)&&clavesBodega(v).some(k=>infoBod(v.items[k])))
    .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||(a.n-b.n));
  for(const v of fuentes){
    const ks=clavesBodega(v),abierta=v.estado!=="cerrada";
    if(abierta&&clv&&clv.id===v.id)continue;
    if(abierta&&ks.some(k=>(v.items[k].fotos||[]).some(f=>!/^a:/.test(f))))continue; /* fotos todavía sin subir: se traspasa después */
    const copia=k=>JSON.parse(JSON.stringify(v.items[k]));
    const urls=k=>{const o={};(v.items[k].fotos||[]).forEach(f=>{if(v.fotoUrl&&v.fotoUrl[f])o[f]=v.fotoUrl[f]});return o};
    const ahora=new Date().toISOString();let b=abierta?visitaAbierta(v.predio,"bodega"):null;
    if(b){ks.forEach(k=>{if(!b.items[k]||!b.items[k].e)b.items[k]=copia(k);b.fotoUrl=Object.assign(b.fotoUrl||{},urls(k))});b.actualizado=ahora;saveVis(b)}
    else{const vb=visitasDe(v.predio,"bodega");
      b={id:"bod-"+v.id,_col:"visitas",tipo:"bodega",predio:v.predio,n:(vb.length?Math.max(...vb.map(x=>x.n||0)):0)+1,fecha:v.fecha,revisor:v.revisor||"",administrador:v.administrador||"",
        estado:abierta?"abierta":"cerrada",items:{},catalogo:v.catalogo?v.catalogo.filter(r=>r[1]==="bodega"):CL_ITEMS.filter(i=>i.area==="bodega"&&(!i.retirado||ks.includes(i.key))).map(compactar),
        traspaso:{visita:v.id,n:v.n,fecha:ahora},creado:v.creado||ahora,actualizado:ahora};
      const por=yo();if(por)b.traspaso.por=por;if(v.creadoPor)b.creadoPor=v.creadoPor;if(v.cerrada)b.cerrada=v.cerrada;if(v.cerradoPor)b.cerradoPor=v.cerradoPor;if(v.anulada)b.anulada=Object.assign({},v.anulada);
      ks.forEach(k=>{b.items[k]=copia(k);const u=urls(k);if(Object.keys(u).length)b.fotoUrl=Object.assign(b.fotoUrl||{},u)});
      saveVis(b)}
    if(abierta){ks.forEach(k=>delete v.items[k]);v.actualizado=ahora;saveVis(v)}
    n++}
  if(n&&(view==="cl"||view==="clp"||view==="launch"))render();
  return n}
function saveVis(v,deb){
  v._col="visitas";VIS[v.id]=v;LOCAL[v.id]=v;status();clearTimeout(LT[v.id]);
  const run=()=>{delete LT[v.id];return localPut(v).then(ok=>{if(!ok&&STORE_OK!==false)toast("No queda espacio en el teléfono para guardar.");schedSync(1000);status()})};
  if(deb){LT[v.id]=setTimeout(run,250);return Promise.resolve()}
  return run();
}
function clTouch(){if(!clv)return;clv.actualizado=new Date().toISOString();if(ME)clv.modificadoPor=yo();saveVis(clv,true)}
const clRO=()=>!!clv&&(clv.estado==="cerrada"||!permAgrega("cl")); /* v121: con «Solo ve», como cerrada */

/* ---------- v91: lista de predios con semáforo y orden a elección ----------
   - Cada predio muestra el % de su última visita cerrada en un anillo de color: verde 90 % o más, ámbar 80 a 89 %,
     rojo bajo 80 %. Al lado: plazos vencidos, plazos que vencen en los próximos 7 días y hallazgos abiertos.
   - Arriba, un resumen: acciones con plazo vencido, hallazgos abiertos y predios sin visita.
   - Se ordena por urgencia, por fecha de visita o por campo (A-Z). Cada teléfono recuerda el último orden elegido.
   - La lista tiene siempre una fila por predio: las visitas nuevas se acumulan dentro de cada predio, no aquí.
     Los predios sin visita van juntos en un solo recuadro (en urgencia y fecha) para no alargar la lista. */
const CL_ORD_K="actas-cl-orden";
const CL_ORDENES=[["urg","Urgencia"],["fecha","Fecha de visita"],["campo","Campo"]];
function clOrden(){try{const o=localStorage.getItem(CL_ORD_K);if(CL_ORDENES.some(x=>x[0]===o))return o}catch(e){}return"urg"}
function clOrdenSet(o){if(!CL_ORDENES.some(x=>x[0]===o))return;try{localStorage.setItem(CL_ORD_K,o)}catch(e){}}
const semColor=p=>p===null||p===undefined?"n":p>=90?"v":p>=80?"a":"r";
const SEM_INK={v:"var(--sm-v)",a:"var(--sm-a-ink)",r:"var(--sm-r)",n:"var(--muted)"};
function semAnillo(p){const c=semColor(p),C=119.4;
  return `<svg class="smr ${c}" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="19" class="bg"/>${c==="n"?"":`<circle cx="24" cy="24" r="19" class="fg" stroke-dasharray="${esc(C)}" stroke-dashoffset="${(C*(1-p/100)).toFixed(1)}" transform="rotate(-90 24 24)"/>`}<text x="24" y="28.5" text-anchor="middle"${p===100?' class="cien"':""}>${c==="n"?"–":p+"%"}</text></svg>`}
function sumarDias(iso,n){const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function haceDias(f){if(!f)return"";const d=Math.round((new Date(today()+"T12:00:00Z")-new Date(String(f).slice(0,10)+"T12:00:00Z"))/864e5);
  return d<=0?"hoy":d===1?"ayer":`hace ${d} días`}
function semInfo(p){
  const vs=validas(p),ab=visitaAbierta(p),cer=vs.filter(v=>v.estado==="cerrada"),ult=cer[cer.length-1]||null;
  const H=abiertos(p),hoy=today(),lim=sumarDias(hoy,7),pz=h=>h.plan&&h.plan.plazo||"";
  const fechas=vs.map(v=>v.fecha).filter(Boolean).sort();
  return {p,ab,ult,pct:ult?puntaje(ult).pct:null,ha:H.length,
    venc:H.filter(h=>pz(h)&&pz(h)<hoy).length,prox:H.filter(h=>pz(h)&&pz(h)>=hoy&&pz(h)<=lim).length,
    fecha:fechas[fechas.length-1]||null,sin:!vs.length}
}
function semOrdenar(L,o){
  const nom=(a,b)=>a.p.localeCompare(b.p,"es");
  if(o==="campo")return{lista:L.slice().sort(nom),sin:[]};
  const con=L.filter(x=>!x.sin),sin=L.filter(x=>x.sin).sort(nom);
  if(o==="fecha")con.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||nom(a,b));
  else con.sort((a,b)=>(b.venc-a.venc)||(b.prox-a.prox)||((a.pct===null?101:a.pct)-(b.pct===null?101:b.pct))||nom(a,b));
  return{lista:con,sin};
}
const SEM_CHEV=`<svg class="smv" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
function semFila(x){
  const ch=[];
  if(x.ab)ch.push(`<span class="smc cur">Visita ${esc(x.ab.n)} en curso</span>`);
  if(x.venc)ch.push(`<span class="smc rr">${x.venc} ${x.venc===1?"vencido":"vencidos"}</span>`);
  if(x.prox)ch.push(`<span class="smc aa">${x.prox} ${x.prox===1?"vence":"vencen"} esta semana</span>`);
  if(x.ult)ch.push(x.ha?`<span class="smc nn">${x.ha} ${x.ha===1?"hallazgo abierto":"hallazgos abiertos"}</span>`:`<span class="smc vv">Sin hallazgos</span>`);
  const sub=x.ult?`Visita ${esc(x.ult.n)} · ${fmtD(x.ult.fecha)} · ${haceDias(x.ult.fecha)}`:x.ab?`Primera visita${x.ab.revisor?` · ${esc(x.ab.revisor)}`:""}`:"Todavía no se ha visitado";
  return `<button class="smrow" data-a="clPredio" data-p="${esc(x.p)}">${semAnillo(x.pct)}<span class="smt"><b>${esc(x.p)}</b>${clTipo==="camionetas"?`<span class="sms">${esc(cmDesc(x.p))}</span>`:""}<span class="sms">${sub}</span>${ch.length?`<span class="smch">${ch.join("")}</span>`:""}</span>${SEM_CHEV}</button>`;
}
function semListaHTML(){
  const info=unidadesCL().map(semInfo),o=clOrden(),{lista,sin}=semOrdenar(info,o); /* v105: más los predios antiguos con visitas; v113: patentes en camionetas */
  const tv=info.reduce((n,x)=>n+x.venc,0),th=info.reduce((n,x)=>n+x.ha,0),ts=info.filter(x=>x.sin).length;
  return `<div class="smres"><div${tv?' class="rr"':""}><b>${tv}</b><span>${tv===1?"acción con plazo vencido":"acciones con plazo vencido"}</span></div><div><b>${th}</b><span>${th===1?"hallazgo abierto":"hallazgos abiertos"}</span></div><div><b>${ts}</b><span>${ts===1?KC().uni+" sin visita":KC().unis+" sin visita"}</span></div></div>
    <div class="smol" id="smol">Ordenar por</div>
    <div class="smord" role="group" aria-labelledby="smol">${CL_ORDENES.map(([k,t])=>`<button data-a="clOrden" data-o="${esc(k)}" aria-pressed="${k===o}">${t}</button>`).join("")}</div>
    <div class="smley"><span><i class="v"></i>90 % o más</span><span><i class="a"></i>80 a 89 %</span><span><i class="r"></i>menos de 80 %</span></div>
    <div class="list smlist">${lista.map(semFila).join("")}</div>${sin.length?`<div class="smsep">Sin visita <b>${sin.length}</b></div><div class="smsin">${sin.map(x=>`<button class="smsc" data-a="clPredio" data-p="${esc(x.p)}">${esc(x.p)}</button>`).join("")}</div>`:""}`;
}

/* ---------- Pantalla: predios ---------- */
/* v113: «Check list de cumplimiento»: un solo módulo con los tres check list (pedido por Benja el 19-10-2026) */
const CL_HUB=[["visitas","cl","Visitas a predios","Control y Gestión en cada predio: casas, oficina, seguridad, medio ambiente y más."],
  ["bodega","clb","Bodegas","Orden, aseo y seguridad de la bodega de cada predio."],
  ["camionetas","clc","Camionetas","Revisión de cada camioneta con los puntos del acta de entrega: accesorios, documentos, estado y uso."]];
/* resumen de un check list (t) o de todos (null): visitas, en curso y hallazgos abiertos */
function clHubCnt(t){const T=t?[t]:CL_HUB.map(x=>x[0]);const vs=Object.values(VIS).filter(v=>!v.anulada&&T.includes(tipoDe(v)));const ab=vs.filter(v=>v.estado!=="cerrada").length;
  const ha=T.reduce((n,x)=>n+unidadesCL(x).reduce((m,p)=>m+abiertos(p,x).length,0),0);
  return vs.length?`${vs.length} ${vs.length===1?"visita":"visitas"}${ab?` · ${ab} en curso`:""}${ha?` · ${ha} ${ha===1?"hallazgo":"hallazgos"}`:""}`:t?"Sin visitas todavía":"Abrir"}
function renderCLHub(){
  return band("Check list de cumplimiento")+`<main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>Check list de cumplimiento</h1>
    <p class="lead">Elige qué vas a revisar. Cada visita compara con la anterior, los hallazgos quedan en seguimiento y el informe PDF se guarda en OneDrive.</p>
    <div class="start" style="grid-template-columns:1fr">
      ${CL_HUB.map(([t,a,nom,desc],i)=>`<button class="big ${i===1?"dev":"ent"}" data-a="${esc(a)}"><strong>${nom}</strong><span>${desc}</span><span><b>${clHubCnt(t)}</b></span></button>`).join("")}
    </div>
    <p class="note">Versión ${APP_VER}</p>
  </main>`;
}
function renderCL(){
  const K=KC(),nAct=catalogoActivo().filter(i=>enTipo(clTipo,i.area)).length,nTot=CL_ITEMS.filter(i=>enTipo(clTipo,i.area)).length;
  return `${band(K.titulo,"clHub","Check list")}
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>${K.titulo}</h1>
    ${semListaHTML()}
    <p class="note">${clTipo==="bodega"?`Orden, aseo y seguridad de la bodega de cada predio: ${nAct} ítems.`:clTipo==="camionetas"?`Revisión de cada camioneta con los puntos del acta de entrega: ${nAct} ítems. Aparecen las camionetas con acta de entrega en la app.`:`Control y Gestión: ${nAct} ítems por predio.`} Cada visita compara con la anterior y los hallazgos quedan en seguimiento hasta que se corrigen.</p>
    ${clTipo==="camionetas"?`<div class="btns"><button class="btn" data-a="clcOtra">+ Camioneta sin acta en la app</button></div>`:""}
    ${esAdmin()?`<p class="note">Catálogo: ${nAct} ítems activos${nTot-nAct?` y ${nTot-nAct} retirados`:""} · <button class="lnk" data-a="clCat">Editar catálogo</button></p>`:""}
    <p class="note">Versión ${APP_VER}</p>
  </main>`;
}

/* ---------- Pantalla: un predio (visitas, hallazgos, Excel) ---------- */
/* ---------- v91: pantalla de un predio pensada para muchas visitas ----------
   - Dos pestañas: «Hallazgos» y «Visitas», para no tener que bajar por todos los hallazgos para llegar a las visitas.
   - Hallazgos en tarjetas cortas, primero los vencidos, con filtros: vencidos, vencen esta semana y sin plan de acción.
   - Visitas: gráfico del cumplimiento de las últimas visitas, las 5 más recientes a la vista y el resto con «Ver anteriores»,
     separadas por año. */
let clPTab=null,clHzF="todos",clHzQ="";const clVisTodas={};
const hzNorm=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const hzCoincide=(q,txt)=>!q||hzNorm(q).split(" ").every(w=>txt.includes(w));
/* buscador de hallazgos: filtra en vivo, sin volver a dibujar la pantalla (así no se cierra el teclado) */
function hzBuscar(q){clHzQ=q;let n=0;document.querySelectorAll(".hzr[data-q]").forEach(r=>{const ok=hzCoincide(q,r.dataset.q);r.hidden=!ok;if(ok)n++});
  const z=document.getElementById("hznada");if(z)z.hidden=!!n}
function hzPlazo(h){const pz=h.plan&&h.plan.plazo||"",hoy=today();
  if(!pz)return{k:"sin",t:"Sin plazo"};
  if(pz<hoy)return{k:"venc",t:`Vencido el ${fmtD(pz)}`};
  if(pz<=sumarDias(hoy,7))return{k:"sem",t:`Vence el ${fmtD(pz)}`};
  return{k:"ok",t:`Plazo ${fmtD(pz)}`};
}
const hzSinPlan=h=>!(h.plan&&(h.plan.acc||h.plan.resp||h.plan.plazo));
const HZ_FILTROS=[["todos","Todos",()=>true],["venc","Vencidos",h=>hzPlazo(h).k==="venc"],["sem","Vencen esta semana",h=>hzPlazo(h).k==="sem"],["sinplan","Sin plan de acción",hzSinPlan]];
function hzFilaHTML(h){const pz=hzPlazo(h);
  const q=hzNorm([codigo(h.it),etqIt(h.it),h.it.txt,h.plan&&h.plan.resp,h.plan&&h.plan.acc,h.ultima&&h.ultima.obs,CL_LABEL[h.ultima.e]].join(" "));
  return `<button class="it hz hzb hzr ${h.ultima.e}" data-a="clHall" data-k="${esc(h.key)}" data-q="${esc(q)}"${hzCoincide(clHzQ,q)?"":" hidden"}><div class="nm"><span>${esc(etqIt(h.it))} · ${codigo(h.it)}</span><span class="chip ${h.ultima.e==="N"?"M":"R"}">${CL_LABEL[h.ultima.e]}</span></div>
    <div class="hzt">${esc(h.it.txt)}</div>
    <div class="hzq">${hzSinPlan(h)?`<span class="pz sinplan">Sin plan de acción</span>`:`<span class="pz ${pz.k}">${pz.t}</span>${h.plan.resp?`<span>${esc(h.plan.resp)}</span>`:""}`}${h.visitas>1?`<span>${h.visitas} visitas seguidas</span>`:""}</div></button>`;
}
function evolHTML(vv){
  const c=vv.filter(v=>v.estado==="cerrada").slice(-12);if(c.length<2)return"";
  const alto=p=>p===null?0:Math.min(100,Math.max(4,(p-40)/60*100));
  return `<div class="evo"><div class="evt"><span>Cumplimiento ${c.length<vv.filter(v=>v.estado==="cerrada").length?`de las últimas ${c.length} visitas`:"por visita"}</span><span class="evl">- - meta 90 %</span></div>
    <div class="evb">${c.map(v=>{const p=puntaje(v).pct,k=semColor(p);
      return `<button class="evc" data-a="clAbrir" data-id="${esc(v.id)}" aria-label="Visita ${esc(v.n)}, ${fmtD(v.fecha)}: ${p===null?"sin porcentaje":p+" %"}"><span class="evp ${k}">${p===null?"–":p}</span><span class="evr"><i class="${esc(k)}" style="height:${alto(p)}%"></i></span><span class="evn">V${esc(v.n)}</span></button>`}).join("")}</div></div>`;
}
function visitaFilaHTML(v){const sc=puntaje(v);const c=v.estado==="cerrada",an=!!v.anulada;
  /* fila corta: el estado de sincronización solo aparece si falta subir algo, y «Registrada por» solo si no fue el mismo revisor */
  const sy=chipSync(v),syOk=sy.includes("xp ok"),au=autoriaTxt(v),auOtro=au&&v.creadoPor&&quien(v.creadoPor)!==v.revisor;
  const by=`${syOk?"":sy}${an?` <span class="aut">Anulada el ${fmtD(v.anulada.fecha)} por ${esc(quien(v.anulada.por))}${v.anulada.motivo?`: ${esc(v.anulada.motivo)}`:""}</span>`:auOtro?` <span class="aut">${autoriaHTML(v)}</span>`:""}`.trim();
  return `<div class="card vcard${an?" anulada":""}"><button class="row" data-a="clAbrir" data-id="${esc(v.id)}">
      <span class="tag ${an?"none":c?"cerrada":"borrador"}">${an?"Anulada":c?"Cerrada":"En curso"}</span>
      <span class="who">Visita ${esc(v.n)}</span>
      <span class="where">${fmtD(v.fecha)}${v.revisor?` · ${esc(v.revisor)}`:""}${!c&&sc.rev?` · ${sc.rev} de ${itemsDe(v).length} ítems`:""}</span>
      <span class="st">${!an&&sc.pct!==null?`<b style="color:${SEM_INK[semColor(sc.pct)]}">${sc.pct} %</b>`:""}</span>
      ${by?`<span class="by">${by}</span>`:""}</button>
      <button class="vmenu" data-a="clVMenu" data-id="${esc(v.id)}" aria-label="Opciones de la visita ${esc(v.n)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>`;
}
/* «⋯» de una visita: informe PDF y, según el caso, eliminar, anular o restaurar */
function clVMenu(v){if(!v)return;const c=v.estado==="cerrada",an=!!v.anulada;
  const ops=[["clPdf","Informe PDF"]];if(!c)ops.push(["clDel","Eliminar visita",1]);if(c&&esAdmin())ops.push(an?["clRestaurar","Restaurar visita"]:["clAnular","Anular visita",1]);
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet vmsheet" role="dialog" aria-modal="true" aria-label="Visita ${esc(v.n)}"><h3>Visita ${esc(v.n)} · ${fmtD(v.fecha)}</h3><div class="vmops">${ops.map(o=>`<button class="btn${o[2]?" danger":""}" data-x="${o[0]}">${o[1]}</button>`).join("")}<button class="btn cancel" data-x="no">Cancelar</button></div></div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{e.stopPropagation();const t=e.target.closest&&e.target.closest("[data-x]");
    if(e.target===m||(t&&t.dataset.x==="no")){m.remove();return}
    if(!t)return;m.remove();Promise.resolve(clClick(t.dataset.x,{dataset:{id:v.id}})).catch(err=>{console.error(err);toast("Error: "+((err&&err.message)||err))})});
  const f=m.querySelector("[data-x]");if(f)f.focus();
}
function visitasListaHTML(p,vs){
  const L=vs.slice().reverse(),todas=!!clVisTodas[clTipo+"|"+p],ver=todas?L:L.slice(0,5),resto=L.length-ver.length;
  const anios=new Set(L.map(v=>String(v.fecha||"").slice(0,4)));let a0=null;
  const filas=ver.map(v=>{const a=String(v.fecha||"").slice(0,4);const h=anios.size>1&&a!==a0?`<div class="smsep vya">${a}</div>`:"";a0=a;return h+visitaFilaHTML(v)}).join("");
  return `<div class="list">${filas||`<div class="empty">Todavía no hay visitas.</div>`}</div>${resto?`<button class="btn vmas" data-a="clVisTodas">Ver ${resto===1?"la visita anterior":`las ${resto} visitas anteriores`}</button>`:""}`;
}
function renderCLPredio(){
  const p=clPredio,vs=visitasDe(p),ab=visitaAbierta(p),H=Object.values(hallazgos(p)),ha=H.filter(h=>h.estado==="abierto");const vv=validas(p);
  const tab=clPTab||(ha.length?"hz":"vis");
  const cerr=H.filter(h=>h.estado==="cerrado").length;
  const orden=x=>{const k=hzPlazo(x).k;return({venc:0,sem:1,ok:2,sin:3})[k]};
  ha.sort((a,b)=>(orden(a)-orden(b))||String(a.plan.plazo||"9").localeCompare(String(b.plan.plazo||"9"))||String(codigo(a.it)).localeCompare(String(codigo(b.it))));
  const f=HZ_FILTROS.find(x=>x[0]===clHzF)||HZ_FILTROS[0],cuenta=x=>ha.filter(x[2]).length;
  const hzVis=ha.filter(f[2]);
  const nVis=hzVis.filter(h=>hzCoincide(clHzQ,hzNorm([codigo(h.it),etqIt(h.it),h.it.txt,h.plan&&h.plan.resp,h.plan&&h.plan.acc,h.ultima&&h.ultima.obs,CL_LABEL[h.ultima.e]].join(" ")))).length;
  const panelHz=ha.length?`${ha.length>8?`<div class="hzbus"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="hzbus" type="search" value="${esc(clHzQ)}" placeholder="Buscar: texto, código o responsable" aria-label="Buscar hallazgo" autocomplete="off" enterkeyhint="search"></div>`:""}${ha.length>3?`<div class="hzfs" role="group" aria-label="Filtrar hallazgos">${HZ_FILTROS.filter(x=>x[0]==="todos"||cuenta(x)||x[0]===f[0]).map(x=>`<button class="hzf${x[0]==="venc"?" rr":x[0]==="sem"?" aa":""}" data-a="clHzF" data-f="${x[0]}" aria-pressed="${x[0]===f[0]}">${x[1]} <b>${cuenta(x)}</b></button>`).join("")}</div>`:""}
      ${hzVis.map(hzFilaHTML).join("")}${hzVis.length?`<div class="empty" id="hznada"${nVis?" hidden":""}>Ningún hallazgo coincide con la búsqueda.</div>`:`<div class="empty">No hay hallazgos en este filtro.</div>`}
      <p class="note">Ítems en Parcial o No cumple en la última visita cerrada. Se cierran solos cuando en una visita posterior quedan en Cumple.${cerr?` Ya se han corregido ${cerr}.`:""}</p>`
    :`<div class="empty">${vv.filter(v=>v.estado==="cerrada").length?`No hay hallazgos abiertos.${cerr?` Se han corregido ${cerr}.`:""}`:"Aún no hay visitas cerradas."}</div>`;
  const panelVis=`${evolHTML(vv)}${visitasListaHTML(p,vs)}
    <h2>Archivos en OneDrive</h2>
    <p class="note" style="margin-top:0">Carpeta <b>Check list de cumplimiento / ${KC().carpeta} / ${esc(p)}</b>: un Excel con todas las visitas (una columna por visita, hoja de hallazgos y hoja de fotos con enlaces) y una carpeta por visita con sus fotos y el informe PDF. El Excel se actualiza solo al cerrar una visita.</p>
    <div class="btns" style="margin-top:8px"><button class="btn" data-a="clXlsx" data-p="${esc(p)}" ${vv.some(v=>v.estado==="cerrada")&&DB?"":"disabled"}>Actualizar Excel ahora</button></div>
    ${esAdmin()?`${disTip("mnvis","En el «⋯» de una visita cerrada puedes <b>anularla</b>: deja de contar para los hallazgos y el porcentaje, pero queda registrada. Se puede restaurar.")}`:""}`;
  return `<div class="top"><div class="in"><div class="bar" style="padding-bottom:10px"><button class="back" data-a="${KC().act}">${KC().Unis}</button><div class="ttl">${clTipo==="bodega"?"Bodega · ":clTipo==="camionetas"?"Camioneta · ":""}${esc(p)}</div>${estadoChip()}</div></div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <h1>${esc(p)}</h1>${clTipo==="camionetas"?`<p class="lead" style="margin-top:-6px">${esc(cmDesc(p))}</p>`:""}
    <div class="start" style="grid-template-columns:1fr">
      ${ab?`<button class="big dev" data-a="clAbrir" data-id="${esc(ab.id)}"><strong>Continuar visita ${esc(ab.n)}</strong><span>Iniciada el ${fmtD(ab.fecha)}${ab.revisor?` por ${esc(ab.revisor)}`:""} · ${puntaje(ab).rev} de ${itemsDe(ab).length} ítems</span></button>`
          :`<button class="big ent" data-a="clNueva" data-p="${esc(p)}"><strong>Nueva visita</strong><span>${vs.length?`Será la visita ${esc(Math.max(...vs.map(v=>+v.n||0))+1)}${vv.some(v=>v.estado==="cerrada")?"; compara con la anterior ítem por ítem":""}`:`Primera visita a esta ${clTipo==="camionetas"?"camioneta":"unidad"}`.replace("esta unidad","este predio")}</span></button>`}
    </div>
    <div class="smord dos ptabs" role="tablist"><button role="tab" data-a="clPTab" data-t="hz" aria-pressed="${tab==="hz"}" aria-selected="${tab==="hz"}">Hallazgos <b>${ha.length}</b></button><button role="tab" data-a="clPTab" data-t="vis" aria-pressed="${tab==="vis"}" aria-selected="${tab==="vis"}">Visitas <b>${vs.length}</b></button></div>
    <div class="ppanel">${tab==="hz"?panelHz:panelVis}</div>
  </main>`;
}

/* ---------- Pantalla: la visita ---------- */
function clItemHTML(it){
  if(clColapsado(clv,it.key))return clItemCortoHTML(it);
  const v=clv,r=v.items[it.key]||{},prev=visitaAnterior(v),pr=prev&&prev.items&&prev.items[it.key],ro=clRO();
  const antes=pr&&pr.e?pr:null;
  const mejor=antes&&r.e&&esHallazgo(antes.e)&&r.e==="C",peor=antes&&r.e&&antes.e==="C"&&esHallazgo(r.e),sigue=antes&&r.e&&esHallazgo(antes.e)&&esHallazgo(r.e);
  const prevHTML=antes?`<div class="prev ${antes.e}"><span class="chip ${antes.e==="N"?"M":antes.e==="P"?"R":antes.e==="C"?"B":"none"}">Visita ${esc(prev.n)}: ${CL_LABEL[antes.e]}</span>${antes.obs?`<span class="pobs">${esc(antes.obs)}</span>`:""}${(antes.fotos||[]).length?`<div class="strip">${antes.fotos.map(f=>thumb(f,it.key,false,true)).join("")}</div>`:""}${mejor?`<span class="res ok">Corregido</span>`:peor?`<span class="res bad">Empeoró</span>`:sigue?`<span class="res bad">Sigue sin corregirse</span>`:""}</div>`:"";
  const fotos=(r.fotos||[]);const canAdd=!ro&&fotos.length<MAXF;
  const plan=(esHallazgo(r.e)||(!r.e&&(r.acc||r.resp||r.plazo)))?`<div class="plan">
    <input class="obs" data-clf="acc" data-k="${esc(it.key)}" value="${esc(r.acc)}" placeholder="Acción correctiva" ${ro?"disabled":""}>
    <div class="plan2"><select data-clf="resp" data-k="${esc(it.key)}" ${ro?"disabled":""}><option value="">Responsable</option>${respDe(tipoDe(v)).map(x=>`<option ${r.resp===x?"selected":""}>${x}</option>`).join("")}</select><input type="date" data-clf="plazo" data-k="${esc(it.key)}" value="${esc(r.plazo||"")}" ${ro?"disabled":""}></div></div>`:"";
  const falta=tipoDe(v)==="camionetas"&&cmEntrega(v,it.key)==="si"&&r.e==="N";
  return `<div class="it cli${peor||sigue||falta?" worse":""}${it.key===clFocoDe(v)?" cli-actual":""}" id="cli-${it.key}">
    <div class="nm"><span class="cod">${codigo(it)}${it.star?' <span class="star" title="Ítem clave"><svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/></svg></span>':""}</span>${canAdd?`<span class="addms">${ESCRITORIO()?`<label class="addf addm">${ICO_GAL}<span>Subir foto</span><input class="vh" type="file" accept="image/*" multiple data-clfoto="${esc(it.key)}"></label>`:`<label class="addf addm">${ICO_CAM}<span>Cámara</span><input class="vh" type="file" accept="image/*" capture="environment" data-clfoto="${esc(it.key)}"></label><label class="addf addm gal">${ICO_GAL}<span>Galería</span><input class="vh" type="file" accept="image/*" multiple data-clfoto="${esc(it.key)}"></label>`}</span>`:`<span class="grp">${esc(it.group)}</span>`}</div>
    <div class="txt">${esc(it.txt)}</div>
    <div class="ref">${esc(it.prot)}${it.evid?` · <i>${esc(it.evid)}</i>`:""}</div>
    ${prevHTML}
    ${CL_PAT.includes(it.key)?clPatHTML(v,it,r,ro):""}
    ${(()=>{const en=tipoDe(v)==="camionetas"?cmEntrega(v,it.key):null;if(en===null)return"";return `<div class="cment"><span class="chip ${en==="si"?"B":en==="no"?"M":"none"}">Acta de entrega: ${en==="si"?"Sí":en==="no"?"No":"sin dato"}</span>${en==="no"?`<span class="note" style="margin:0">No se entregó: si sigue sin estar, marca N/A.</span>`:""}</div>`})()}
    <div class="seg seg4" role="group">${["C","P","N","NA"].map(e=>`<button data-a="clRate" data-k="${esc(it.key)}" data-e="${esc(e)}" aria-pressed="${r.e===e}" ${ro?"disabled":""}><span class="sgi" aria-hidden="true">${CL_ICO[e]}</span><span class="sgt">${CL_LABEL[e]}</span></button>`).join("")}</div>
    ${fotos.length?`<div class="fotos"><div class="strip">${fotos.map(f=>ro?thumb(f,it.key,true,false):`<span class="thw">${thumb(f,it.key,true,false)}<button class="thx" data-a="clDelFoto" data-ref="${esc(f)}" data-k="${esc(it.key)}" aria-label="Eliminar foto">✕</button></span>`).join("")}</div></div>`:""}
    ${r.e||r.obs||ro?`<input class="obs" data-clf="obs" data-k="${esc(it.key)}" value="${esc(r.obs)}" placeholder="Observación" ${ro?"disabled":""}>`:""}
    ${plan}
  </div>`;
}
/* v113: datos de la camioneta en la revisión: acta, predio y kilometraje actual */
function cmInfoHTML(v,ro){const a=actaPatente(v.predio),ve=(a&&a.veh)||{},i=cmKmInfo(v);
  return `<div class="info cminfo"><b>${esc(v.predio)}</b>${a?` · ${esc([ve.tipoVeh,ve.marca,ve.modelo,ve.anio].filter(Boolean).join(" "))}<br><span class="note" style="margin:0">Acta de entrega del ${fmtD(a.fecha)}${a.conductor?` a ${esc(a.conductor)}`:""}${ve.km?` · ${kmNum(ve.km).toLocaleString("es-CL")} km`:""}</span> <button class="lnk" data-a="axOpen" data-id="${esc(a.id)}">Ver acta</button>`:`<br><span class="note" style="margin:0">No hay acta de entrega de esta camioneta en la app.</span>`}</div>
  <div class="grid2"><div class="f"><label for="cmkm">Kilometraje actual</label><input id="cmkm" data-clenc="km" inputmode="numeric" value="${esc(v.km||"")}" placeholder="Lo que marca el tablero" ${ro?"disabled":""}></div>
    <div class="f"><label for="cmpre">Predio</label><select id="cmpre" data-clenc="predioCampo" ${ro?"disabled":""}><option value="">Elige</option>${(typeof AX_PREDIOS!=="undefined"?AX_PREDIOS:PREDIOS).map(p=>`<option ${v.predioCampo===p?"selected":""}>${esc(p)}</option>`).join("")}${v.predioCampo&&!(typeof AX_PREDIOS!=="undefined"?AX_PREDIOS:PREDIOS).includes(v.predioCampo)?`<option selected>${esc(v.predioCampo)}</option>`:""}</select></div></div>
  <p class="note" id="cmkmtx" style="margin-top:-4px">${esc(cmKmTxt(i))}</p>`}
function clProgHTML(){const sc=puntaje(clv),T=itemsDe(clv).length;const pct=Math.round(sc.rev/T*100);return `<div class="prog" id="clprog"><span>${sc.rev} de ${T} revisados</span><span class="meter"><i style="width:${pct}%"></i></span><span>${sc.pct!==null?`${sc.pct} % cumpl.`:""}</span></div>`}
function renderCLV(){
  const v=clv,prev=visitaAnterior(v),ro=clRO();const TODOS=itemsDe(v),KV=CLK[tipoDe(v)];
  const AR=areasDe(tipoDe(v)).filter(a=>TODOS.some(i=>i.area===a.id));if(AR.length&&!AR.some(a=>a.id===clArea))clArea=AR[0].id;
  const areaItems=TODOS.filter(i=>i.area===clArea);
  /* v136 (M-09): «Hallazgos anteriores» = hallazgos abiertos de las visitas cerradas (no solo de la visita anterior) */
  const HZ=hallazgos(v.predio,tipoDe(v)),hzAb=k=>!!(HZ[k]&&HZ[k].estado==="abierto");
  const items=areaItems.filter(it=>{const r=v.items[it.key]||{};
    if(clFiltro==="pend")return!r.e;if(clFiltro==="hall")return hzAb(it.key);if(clFiltro==="mal")return esHallazgo(r.e);return true});
  const tabs=AR.map(a=>{const sc=puntaje(v,i=>i.area===a.id);const tot=TODOS.filter(i=>i.area===a.id).length;return `<button class="tab${tot&&sc.rev===tot?" lista":""}" data-a="clArea" data-area="${esc(a.id)}" aria-selected="${a.id===clArea}">${esc(a.name)}<small>${tot&&sc.rev===tot?"✓ ":""}${sc.rev}/${tot}</small></button>`}).join("");
  const nHall=areaItems.filter(it=>hzAb(it.key)).length;
  const groups=[];items.forEach(it=>{const g=groups.find(x=>x.b===it.sheet&&x.g===it.group);if(g)g.items.push(it);else groups.push({b:it.sheet,fam:it.fam,g:it.group,items:[it]})});
  const body=groups.map(g=>`<section class="sec"><h3>${g.b==="cm"?"":esc(g.fam)+" · "}${esc(g.g)}</h3>${g.g==="Camionetas"?camionetasPanel(v):""}${g.items.map(clItemHTML).join("")}</section>`).join("")||`<div class="empty">${clFiltro==="pend"?"Todo revisado en esta área.":clFiltro==="hall"?"No hay hallazgos de la visita anterior en esta área.":"Nada que mostrar."}</div>`;
  return `<div class="top"><div class="in">
    <div class="bar"><button class="back" data-a="clPredioBack">${esc(v.predio)}</button><div class="ttl">Visita ${esc(v.n)}</div>${estadoChip()}</div>
    ${AR.length>1?`<nav class="tabs">${tabs}</nav>`:""}</div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    ${v.anulada?`<div class="info netbox"><b>Visita anulada</b> el ${fmtD(v.anulada.fecha)} por ${esc(quien(v.anulada.por))}${v.anulada.motivo?`: ${esc(v.anulada.motivo)}`:""}. No cuenta para los hallazgos ni el porcentaje.</div>`:ro?`<div class="info lock">Visita cerrada el ${fmtD(v.cerrada)}. Ya no se puede modificar.</div>`:""}
    ${v.traspaso?`<div class="info">Traspasada desde la visita ${esc(v.traspaso.n)} del Check list de visitas, donde se revisó la bodega.</div>`:VIS["bod-"+v.id]?`<div class="info">Lo revisado de bodega en esta visita está ahora en el Check list de bodega (visita ${VIS["bod-"+v.id].n}). <button class="lnk" data-a="clAbrir" data-id="bod-${esc(v.id)}">Abrir</button></div>`:""}
    ${clEncHTML(v,ro,KV)}
    ${tipoDe(v)==="camionetas"?cmInfoHTML(v,ro):""}
    ${prev?`<p class="note" style="margin-top:0">Comparando con la visita ${esc(prev.n)} (${fmtD(prev.fecha)}).</p>`:`<p class="note" style="margin-top:0">Primera visita a ${tipoDe(v)==="camionetas"?"esta camioneta":"este predio"}: no hay comparación anterior.</p>`}
    ${clProgHTML()}
    ${ro?"":disUnoSwitchHTML()}
    <div class="filt"${DIS.uno&&!ro?" hidden":""}>${[["all","Todos"],["pend",`Sin revisar${(()=>{const n=areaItems.filter(i=>!(v.items[i.key]||{}).e).length;return n?` (${n})`:""})()}`],["hall",`Hallazgos anteriores${nHall?` (${nHall})`:""}`],["mal","Parcial / No cumple"]].map(([k,t])=>`<button class="fb" data-a="clFiltro" data-f="${esc(k)}" aria-pressed="${clFiltro===k}">${t}</button>`).join("")}</div>
    <h1 style="font-size:22px">${esc(AREA_NAME[clArea])}</h1>
    ${DIS.uno&&!ro?disUnoHTML(v):body}
    <div class="btns">${ro?`<button class="btn" data-a="clPdf" data-id="${esc(v.id)}">Informe PDF</button><button class="btn pri" data-a="clPredioBack">Volver al predio</button>`:`<button class="btn" data-a="clPdf" data-id="${esc(v.id)}">Informe PDF (borrador)</button><button class="btn pri" data-a="clCerrar">Cerrar visita</button>`}</div>
    ${ro?"":`<div class="btns" style="margin-top:10px"><button class="btn danger" data-a="clDel" data-id="${esc(v.id)}" style="border-color:var(--m-ink);color:var(--m-ink)">Eliminar esta visita</button></div>${disTip("cldel",`Si la abriste por error, elimínala: se borran sus respuestas y fotos. Para salir sin cerrar, usa «${esc(v.predio)}» arriba; la visita queda en curso.`)}`}
  </main>${clBarHTML()}`;
}
function clRefreshItem(v,k){if(clv!==v||view!=="clv")return;const el=$("#cli-"+k);const it=itemDe(v,k);if(el&&it)el.outerHTML=clItemHTML(it);const p=$("#clprog");if(p)p.outerHTML=clProgHTML();const cb=$("#clbar");if(cb)cb.outerHTML=clBarHTML();const fp=document.querySelector('[data-a="clFiltro"][data-f="pend"]');if(fp){const n=itemsDe(v).filter(i=>i.area===clArea&&!(v.items[i.key]||{}).e).length;fp.textContent="Sin revisar"+(n?` (${n})`:"")}}

/* ---------- Detalle de un hallazgo ---------- */
function clHallazgoModal(p,k){
  const H=hallazgos(p)[k];const it=(H&&H.it)||CL_BYKEY[k];if(!it)return;const vs=visitasDe(p).filter(v=>v.estado==="cerrada");const ab=visitaAbierta(p);
  const hist=vs.map(v=>{const r=v.items&&v.items[k];if(!r||!r.e)return"";const fotos=(r.fotos||[]);const cls=r.e==="N"?"M":r.e==="P"?"R":r.e==="C"?"B":"none";
    return `<div class="hh ${r.e}"><div class="hhl"><span class="chip ${cls}">${CL_LABEL[r.e]}</span><b>Visita ${esc(v.n)}</b><span class="hhd">${fmtD(v.fecha)}${v.revisor?` · ${esc(v.revisor)}`:""}</span></div>
      ${clObs(r)?`<div class="hho">${esc(clObs(r))}</div>`:""}
      ${(r.acc||r.resp||r.plazo)&&esHallazgo(r.e)?`<div class="hhp">${r.acc?`<b>Acción:</b> ${esc(r.acc)}. `:""}${r.resp?`<b>Resp.:</b> ${esc(r.resp)}. `:""}${r.plazo?`<b>Plazo:</b> ${fmtD(r.plazo)}`:""}</div>`:""}
      ${fotos.length?`<div class="strip">${fotos.map(f=>thumb(f,k,false,false)).join("")}</div>`:""}
      <div class="hhb"><button class="mini" data-m="visita" data-id="${esc(v.id)}">Abrir visita ${esc(v.n)}</button></div></div>`}).filter(Boolean).reverse().join("");
  const estado=H?(H.estado==="abierto"?`<span class="xp camb">Abierto desde la visita ${H.desde.v} (${fmtD(H.desde.fecha)})${H.visitas>1?` · ${H.visitas} visitas seguidas`:""}</span>`:H.estado==="cerrado"?`<span class="xp ok">Corregido en la visita ${H.cerrado.v} (${fmtD(H.cerrado.fecha)})</span>`:`<span class="xp ok">Sin hallazgo</span>`):"";
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="sheet hzs" role="dialog" aria-modal="true" aria-label="Detalle del hallazgo">
    <div class="nm"><span class="cod">${codigo(it)}${it.star?' <span class="star"><svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/></svg></span>':""} · ${esc(it.areaName)}</span><button class="thx" data-m="close" aria-label="Cerrar" style="position:static">✕</button></div>
    <h3 style="margin:4px 0 6px">${esc(it.txt)}</h3>
    <p class="ref" style="margin:0 0 8px;font-size:13px;color:var(--muted)">${it.sheet==="cm"?"":esc(it.fam)+" · "}${esc(it.group)}<br>${esc(it.prot)}${it.evid?` · <i>${esc(it.evid)}</i>`:""}</p>
    <div style="margin-bottom:10px">${estado}</div>
    ${H&&H.estado==="abierto"&&(H.plan.acc||H.plan.resp||H.plan.plazo)?`<div class="info" style="margin:0 0 12px"><b>Plan de acción vigente</b><br>${H.plan.acc?`${esc(H.plan.acc)}<br>`:""}${H.plan.resp?`Responsable: ${esc(H.plan.resp)}`:""}${H.plan.plazo?` · Plazo: <span class="${H.plan.plazo<today()?"venc":""}">${fmtD(H.plan.plazo)}${H.plan.plazo<today()?" (vencido)":""}</span>`:""}</div>`:""}
    <h4 class="lx-h2" style="margin:0 0 8px">Historial</h4>
    <div class="hhist">${hist||`<div class="empty">Sin evaluaciones en visitas cerradas.</div>`}</div>
    <div class="btns">${ab?`<button class="btn pri" data-m="visita" data-id="${esc(ab.id)}" style="flex:1">Ir a la visita ${esc(ab.n)} en curso</button>`:`<button class="btn pri" data-m="nueva" style="flex:1">Nueva visita para revisarlo</button>`}</div>
  </div>`;
  document.body.appendChild(m);document.body.style.overflow="hidden";
  const close=()=>{m.remove();document.body.style.overflow=""};
  m.addEventListener("click",async e=>{const t=e.target.closest("[data-m],[data-a]");if(e.target===m){close();return}if(!t)return;
    if(t.dataset.a==="foto"){e.stopPropagation();const src=fotoSrc(t.dataset.ref);if(!src){toast("La foto todavía se está descargando.");return}
      const z=document.createElement("div");z.className="modal";z.style.zIndex="60";z.innerHTML=`<div class="sheet"><img src="${esc(src)}" alt="" style="width:100%;border-radius:10px"><div class="btns"><button class="btn pri" data-z="c" style="flex:1">Cerrar</button></div></div>`;document.body.appendChild(z);z.addEventListener("click",ev=>{if(ev.target===z||(ev.target.dataset&&ev.target.dataset.z))z.remove()});return}
    const a=t.dataset.m;if(a==="close")close();
    if(a==="visita"){close();const v=VIS[t.dataset.id];if(!v)return;clTipo=tipoDe(v);clv=v;clPredio=v.predio;if(!clv.items)clv.items={};clArea=it.area;clFiltro="all";go("clv");setTimeout(()=>{const el=$("#cli-"+k);if(el){el.scrollIntoView({block:"center"});el.classList.add("hl");setTimeout(()=>el.classList.remove("hl"),2200)}},80)}
    if(a==="nueva"){close();const v=nuevaVisita(p);clv=v;clPredio=p;clArea=it.area;clFiltro="hall";await saveVis(v);go("clv");setTimeout(()=>{const el=$("#cli-"+k);if(el)el.scrollIntoView({block:"center"})},80)}
  });
}

/* ---------- Administración del catálogo (solo administrador) ---------- */
let catArea="oficina",catQ="",catNuevo=null;
function renderCLCat(){
  const q=catQ.trim().toLowerCase();
  const lista=CL_ITEMS.filter(i=>i.area===catArea&&(!q||[i.txt,i.group,i.prot,codigo(i)].join(" ").toLowerCase().includes(q)));
  const grupos=[];lista.forEach(i=>{const g=grupos.find(x=>x.sheet===i.sheet&&x.g===i.group);if(g)g.items.push(i);else grupos.push({sheet:i.sheet,fam:i.fam,g:i.group,items:[i]})});
  const ARC=areasDe(clTipo);const tabs=ARC.map(a=>`<button class="tab" data-a="clCatArea" data-area="${esc(a.id)}" aria-selected="${a.id===catArea}">${esc(a.name)}<small>${CL_ITEMS.filter(i=>i.area===a.id&&!i.retirado).length}</small></button>`).join("");
  const card=i=>{const hist=itemConHistorial(i.key);return `<div class="it cat${i.retirado?" ret":""}" id="cat-${esc(i.key)}">
    <div class="nm"><span class="cod">${codigo(i)}${i.retirado?' <span class="xp nueva">Retirado</span>':""}</span><label class="chk"><input type="checkbox" data-cat="star" data-k="${esc(i.key)}" ${i.star?"checked":""}> Ítem clave ★</label></div>
    <label class="f"><span>Ítem</span><textarea data-cat="txt" data-k="${esc(i.key)}" rows="2">${esc(i.txt)}</textarea></label>
    <div class="plan2"><label class="f"><span>Referencia</span><input data-cat="prot" data-k="${esc(i.key)}" value="${esc(i.prot||"")}"></label><label class="f"><span>Cómo verificar</span><input data-cat="evid" data-k="${esc(i.key)}" value="${esc(i.evid||"")}"></label></div>
    <div class="plan2"><label class="f"><span>Grupo</span><input data-cat="group" data-k="${esc(i.key)}" value="${esc(i.group)}" list="dl-grupos"></label><label class="f"><span>Área</span><select data-cat="area" data-k="${esc(i.key)}">${AREAS.map(a=>`<option value="${esc(a.id)}" ${a.id===i.area?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label></div>
    <div class="acts">${i.retirado?`<button class="mini" data-a="clCatRest" data-k="${esc(i.key)}">Volver a activar</button>`:hist?`<button class="mini danger" data-a="clCatRet" data-k="${esc(i.key)}">Retirar</button>`:`<button class="mini danger" data-a="clCatDel" data-k="${esc(i.key)}">Eliminar</button>`}${hist?`<span class="note" style="margin:0;align-self:center">Con historial en visitas</span>`:""}</div></div>`};
  const body=grupos.map(g=>`<section class="sec"><h3>${esc(g.fam)} · ${esc(g.g)}</h3>${g.items.map(card).join("")}</section>`).join("")||`<div class="empty">Ningún ítem coincide.</div>`;
  const grupos_dl=[...new Set(CL_ITEMS.map(i=>i.group))].map(g=>`<option value="${esc(g)}">`).join("");
  const nuevo=catNuevo?`<div class="it cat nuevo"><h3 style="margin:0 0 8px">Nuevo ítem en ${esc(AREA_NAME[catArea])}</h3>
    <label class="f"><span>Tipo</span><select data-nuevo="fam"><option value="Control y gestión" ${catNuevo.fam!=="Orden y aseo"?"selected":""}>Control y gestión</option><option value="Orden y aseo" ${catNuevo.fam==="Orden y aseo"?"selected":""}>Orden y aseo</option></select></label>
    <label class="f"><span>Grupo</span><input data-nuevo="group" value="${esc(catNuevo.group||"")}" list="dl-grupos" placeholder="Ej.: Gestión y control"></label>
    <label class="f"><span>Ítem</span><textarea data-nuevo="txt" rows="2" placeholder="Qué se revisa">${esc(catNuevo.txt||"")}</textarea></label>
    <div class="plan2"><label class="f"><span>Referencia</span><input data-nuevo="prot" value="${esc(catNuevo.prot||"")}" placeholder="Procedimiento o norma"></label><label class="f"><span>Cómo verificar</span><input data-nuevo="evid" value="${esc(catNuevo.evid||"")}"></label></div>
    <label class="chk"><input type="checkbox" data-nuevo="star" ${catNuevo.star?"checked":""}> Ítem clave ★</label>
    <div class="btns"><button class="btn" data-a="clCatCancel">Cancelar</button><button class="btn pri" data-a="clCatAdd" style="flex:1">Agregar ítem</button></div></div>`:`<div class="btns"><button class="btn pri" data-a="clCatNuevo">+ Agregar ítem en ${esc(AREA_NAME[catArea])}</button></div>`;
  return `<div class="top"><div class="in"><div class="bar"><button class="back" data-a="clCatSalir">Check list</button><div class="ttl">Catálogo</div><span class="saved">${CAT_PEND?"Sin guardar":"Guardado"}</span></div>${ARC.length>1?`<nav class="tabs">${tabs}</nav>`:""}</div></div>
  <main class="wrap"><div class="pendslot">${slotHTML()}</div>
    <div class="info" style="margin-top:12px">Los cambios se guardan en <b>_config / Catalogo_check_list.xlsx</b> de OneDrive y se aplican a las visitas que se creen desde ahora. Las visitas en curso y las cerradas conservan su propio catálogo. Los demás teléfonos reciben el catálogo nuevo en su siguiente sincronización.</div>
    <input class="search" type="search" placeholder="Buscar ítem, grupo o código" value="${esc(catQ)}" data-catq="1">
    <datalist id="dl-grupos">${grupos_dl}</datalist>
    ${nuevo}
    <h1 style="font-size:22px">${esc(AREA_NAME[catArea])}</h1>
    ${body}
    <div class="btns"><button class="btn pri" data-a="clCatGuardar" style="flex:1">Guardar en OneDrive</button></div>
  </main>`;
}
let catSaveT=null,catqT=null;
function catTocado(){CAT_PEND=true;const s=$(".saved");if(s)s.textContent="Sin guardar";clearTimeout(catSaveT);catSaveT=setTimeout(()=>{guardarCatalogo(false).then(ok=>{const s2=$(".saved");if(s2)s2.textContent=ok?"Guardado":"Sin guardar"})},2500)}
function catInput(ev){const t=ev.target;
  if(t.dataset.catq!==undefined){catQ=t.value;clearTimeout(catqT);catqT=setTimeout(()=>{render();const i=$("[data-catq]");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250);return true}
  if(t.dataset.nuevo){catNuevo=catNuevo||{};catNuevo[t.dataset.nuevo]=t.type==="checkbox"?t.checked:t.value;return true}
  if(t.dataset.cat){const it=CL_BYKEY[t.dataset.k];if(!it)return true;const f=t.dataset.cat;
    if(f==="star")it.star=t.checked;else if(f==="area"){it.area=t.value;it.areaName=AREA_NAME[t.value];if(it.sheet!=="cl")it.sheet="oa-"+OA_CODE[t.value]}else it[f]=t.value;
    catTocado();if(f==="area")render();return true}
  return false}
async function catClick(A,b){
  if(A==="clCat"){if(!esAdmin())return true;catNuevo=null;const AR=areasDe(clTipo);if(!AR.some(a=>a.id===catArea))catArea=AR[0].id;go("clcat");return true}
  if(A==="clCatSalir"){clearTimeout(catSaveT);if(CAT_PEND)await guardarCatalogo(false);go("cl");return true}
  if(A==="clCatArea"){catArea=b.dataset.area;catNuevo=null;render();return true}
  if(A==="clCatNuevo"){catNuevo={fam:"Control y gestión"};render();setTimeout(()=>{const e=$("[data-nuevo=txt]");if(e)e.focus()},50);return true}
  if(A==="clCatCancel"){catNuevo=null;render();return true}
  if(A==="clCatAdd"){const nv=catNuevo||{};if(!(nv.txt||"").trim()){toast("Escribe el texto del ítem.");return true}
    const esOA=nv.fam==="Orden y aseo";const sheet=esOA?"oa-"+OA_CODE[catArea]:hojaCG(catArea);const nums=CL_ITEMS.filter(i=>i.sheet===sheet).map(i=>+i.n||0);const n=(nums.length?Math.max(...nums):0)+1;
    let key=sheet+"-"+n;while(CL_BYKEY[key])key+="-x";
    const group=(nv.group||"").trim()||"General";const mismo=CL_ITEMS.filter(i=>i.area===catArea&&i.sheet===sheet&&i.group===group);const orden=mismo.length?Math.max(...mismo.map(i=>i.orden))+0.5:CL_ITEMS.length;
    const it={key,area:catArea,sheet,fam:esOA?"Orden y aseo":"Control y gestión",group,n,txt:nv.txt.trim(),prot:(nv.prot||"").trim(),evid:(nv.evid||"").trim(),star:!!nv.star,retirado:false,orden};
    catalogoSet(CL_ITEMS.concat([it]));catNuevo=null;catTocado();render();toast(`Ítem ${codigo(it)} agregado.`);setTimeout(()=>{const e=$("#cat-"+CSS.escape(key));if(e)e.scrollIntoView({block:"center"})},60);return true}
  if(A==="clCatRet"){const it=CL_BYKEY[b.dataset.k];if(!it)return true;if(!(await ask(`¿Retirar ${codigo(it)}?`,"Dejará de aparecer en las visitas nuevas. Las visitas que ya lo evaluaron lo conservan, igual que su historial. Se puede volver a activar.","Retirar",true)))return true;it.retirado=true;catTocado();render();return true}
  if(A==="clCatRest"){const it=CL_BYKEY[b.dataset.k];if(it){it.retirado=false;catTocado();render()}return true}
  if(A==="clCatDel"){const it=CL_BYKEY[b.dataset.k];if(!it)return true;if(itemConHistorial(it.key)){toast("Este ítem tiene historial; solo se puede retirar.");return true}
    if(!(await ask(`¿Eliminar ${codigo(it)}?`,"Nunca se ha evaluado, así que se elimina del catálogo. No se puede deshacer.","Eliminar",true)))return true;catalogoSet(CL_ITEMS.filter(i=>i.key!==it.key));catTocado();render();return true}
  if(A==="clCatGuardar"){clearTimeout(catSaveT);await guardarCatalogo(true);render();return true}
  return false}

/* ---------- Acciones ---------- */
async function clClick(A,b){
  if(A.startsWith("clCat")){return catClick(A,b)}
  if(A==="clHall"){clHallazgoModal(clPredio,b.dataset.k);return true}
  if(A==="clHub"){await flush();clv=null;go("clhub");return true}
  if(A==="cl"||A==="clb"||A==="clc"){await flush();clv=null;clTipo=A==="clb"?"bodega":A==="clc"?"camionetas":"visitas";go("cl");return true}
  if(A==="clcOtra"){const o=await askVal("Camioneta sin acta","Escribe la patente. Conviene registrar también su acta de entrega en Actas → Entrega y devolución de vehículos.","Seguir",`<div class="f"><label for="cmPatIn">Patente</label><input id="cmPatIn" data-v="pat" autocapitalize="characters" autocomplete="off" placeholder="Ej.: WBHD30"></div>`);
    const p=normPat(o&&o.pat);if(!p)return true;clPredio=p;clPTab=null;clHzF="todos";clHzQ="";go("clp");window.scrollTo(0,0);return true}
  if(A==="clPredio"){clPredio=b.dataset.p;clPTab=null;clHzF="todos";clHzQ="";go("clp");window.scrollTo(0,0);return true}
  if(A==="clOrden"){clOrdenSet(b.dataset.o);render();return true}
  if(A==="clPTab"){clPTab=b.dataset.t==="vis"?"vis":"hz";render();return true}
  if(A==="clHzF"){clHzF=b.dataset.f||"todos";render();return true}
  if(A==="clVisTodas"){clVisTodas[clTipo+"|"+clPredio]=true;render();return true}
  if(A==="clVMenu"){clVMenu(VIS[b.dataset.id]);return true}
  if(A==="clPredioBack"){await flush();clv=null;go("clp");return true}
  if(A==="clNueva"){const p=b.dataset.p;if(visitaAbierta(p)){toast(clTipo==="camionetas"?"Ya hay una visita en curso de esta camioneta.":"Ya hay una visita en curso en este predio.");return true}
    const v=nuevaVisita(p);clv=v;clPredio=p;clArea=areasDe(clTipo)[0].id;clFiltro=abiertos(p,clTipo).length?"hall":"all";await saveVis(v);go("clv");
    if(clFiltro==="hall")toast("Partimos por los hallazgos que siguen abiertos.");return true}
  if(A==="clAbrir"){await flush();const v=VIS[b.dataset.id];if(!v)return true;clTipo=tipoDe(v);clv=v;clPredio=v.predio;if(!clv.items)clv.items={};clFiltro="all";go("clv");return true}
  if(A==="clArea"){clArea=b.dataset.area;window.scrollTo(0,0);render();return true}
  if(A==="clFiltro"){clFiltro=b.dataset.f;render();return true}
  if(A==="clPat"){if(clRO())return true;const k=b.dataset.k,p=b.dataset.v,r=clv.items[k]||{};const S=new Set(r.pat||[]);S.has(p)?S.delete(p):S.add(p);r.pat=[...S].sort();if(!r.pat.length)delete r.pat;clv.items[k]=r;clTouch();clRefreshItem(clv,k);return true}
  if(A==="clPatOtra"){if(clRO())return true;const k=b.dataset.k;const o=await askVal("Otra patente","Escribe la patente de la camioneta.","Agregar",`<div class="f"><label for="clPatIn">Patente</label><input id="clPatIn" data-v="pat" autocapitalize="characters" autocomplete="off" placeholder="Ej.: WBHD30"></div>`);
    const p=normPat(o&&o.pat);if(!p)return true;const r=clv.items[k]||{};r.pat=[...new Set((r.pat||[]).concat([p]))].sort();clv.items[k]=r;clTouch();clRefreshItem(clv,k);return true}
  if(A==="clRate"){if(clRO())return true;const k=b.dataset.k,e=b.dataset.e;const r=clv.items[k]||{};r.e=r.e===e?undefined:e;if(!r.e)delete r.e;clv.items[k]=r;clTouch();clFocoA(k);clRefreshItem(clv,k);if(DIS.uno&&(r.e==="C"||r.e==="NA"))disUnoAuto(k);return true}
  if(A==="clAbrirIt"){clAbrirIt(b.dataset.k);return true}
  if(A==="clEncEd"){clEncAb[clv.id]=true;render();const f=$("#clfecha");if(f)f.focus();return true}
  if(A==="clEncOk"){clEncAb[clv.id]=false;render();return true}
  if(A==="clDelFoto"){if(clRO())return true;const k=b.dataset.k,ref=b.dataset.ref;if(!(await ask("¿Eliminar esta foto?","","Eliminar",true)))return true;const r=clv.items[k];if(r&&r.fotos){r.fotos=r.fotos.filter(x=>x!==ref)}borrarFotoRef(ref);clTouch();clRefreshItem(clv,k);return true}
  if(A==="clDel"){const v=VIS[b.dataset.id];if(!v||v.estado==="cerrada")return true;if(!puedeBorrar(v)){toast(NO_BORRAR);return true}
    if(!(await ask("¿Eliminar esta visita?",`Visita ${esc(v.n)} a ${v.predio}. Se borran las respuestas y las fotos. No se puede deshacer.`,"Eliminar",true)))return true;
    clearTimeout(LT[v.id]);delete LT[v.id];delete VIS[v.id];delete LOCAL[v.id];await localDel(v.id);if(DB){colaBorrar("visitas/"+v.id,v);schedSync(200)}
    Object.values(v.items||{}).forEach(r=>(r.fotos||[]).forEach(f=>borrarFotoRef(f)));const enVisita=clv&&clv.id===v.id;if(enVisita){clv=null;clPredio=v.predio;go("clp")}else{status();render()}toast("Visita eliminada.");return true}
  if(A==="clCerrar"){if(clRO())return true;const sc=puntaje(clv);
    /* v136 (M-10): no se cierra vacía, sin fecha o sin revisor */
    if(!sc.rev){toast("No se puede cerrar: no hay ítems revisados.");return true}
    if(!clv.fecha){toast("No se puede cerrar: falta la fecha de la visita.");return true}
    if(!String(clv.revisor||"").trim()){toast("No se puede cerrar: falta quién hizo la revisión (revisor).");return true}
    const falt=itemsDe(clv).filter(it=>{const r=clv.items[it.key];return r&&esHallazgo(r.e)&&(!r.acc||!r.resp||!r.plazo)}).length;
    const msg=`${sc.rev} de ${itemsDe(clv).length} ítems revisados${sc.pct!==null?`, ${sc.pct} % de cumplimiento`:""}.${falt?` ${falt} ${falt===1?"hallazgo no tiene":"hallazgos no tienen"} acción, responsable o plazo completos.`:""} Al cerrar, los ítems en Parcial o No cumple quedan como hallazgos abiertos y la visita ya no se puede modificar.`;
    if(!(await ask("¿Cerrar la visita?",msg,"Cerrar visita")))return true;
    clv.estado="cerrada";clv.cerrada=today();clv.actualizado=new Date().toISOString();if(ME)clv.cerradoPor=yo();await saveVis(clv);
    const vv=clv,p=clv.predio;exito("Visita cerrada","Los hallazgos quedaron en seguimiento.");esperarFotos(vv.id);clv=null;clPredio=p;go("clp");
    if(DB&&navigator.onLine!==false)clTrasCierre(p,vv);return true}
  if(A==="clAnular"){const v=VIS[b.dataset.id];if(!v||!esAdmin()||v.estado!=="cerrada")return true;
    const ok=await ask(`¿Anular la visita ${esc(v.n)} a ${v.predio}?`,"Dejará de contar para los hallazgos y el porcentaje. Queda registrada como anulada con el motivo y tu nombre; se puede restaurar.","Anular",true,`<div class="f"><label for="motAn">Motivo</label><input id="motAn" data-obl="3" placeholder="Ej.: visita de prueba"></div>`);
    if(!ok)return true;const mot=(document.querySelector("#motAn")||{}).value||"";
    v.anulada={por:yo(),fecha:today(),motivo:mot.trim()};v.actualizado=new Date().toISOString();await saveVis(v);
    {const bo=VIS["bod-"+v.id];if(bo&&!bo.anulada){bo.anulada=Object.assign({},v.anulada);bo.actualizado=v.actualizado;await saveVis(bo);if(DB&&navigator.onLine!==false)clXlsx(bo.predio,false,"bodega")}} /* v136 (M-11) */
    render();toast(`Visita ${esc(v.n)} anulada.`);if(DB&&navigator.onLine!==false)clXlsx(v.predio,false,tipoDe(v));return true}
  if(A==="clRestaurar"){const v=VIS[b.dataset.id];if(!v||!esAdmin())return true;
    if(!(await ask(`¿Restaurar la visita ${esc(v.n)}?`,"Volverá a contar para los hallazgos y el porcentaje.","Restaurar")))return true;
    delete v.anulada;v.actualizado=new Date().toISOString();await saveVis(v);
    {const bo=VIS["bod-"+v.id];if(bo&&bo.anulada){delete bo.anulada;bo.actualizado=v.actualizado;await saveVis(bo);if(DB&&navigator.onLine!==false)clXlsx(bo.predio,false,"bodega")}} /* v136 (M-11) */
    render();toast(`Visita ${esc(v.n)} restaurada.`);if(DB&&navigator.onLine!==false)clXlsx(v.predio,false,tipoDe(v));return true}
  if(A==="clPdf"){const v=VIS[b.dataset.id];if(v)await clPdf(v);return true}
  if(A==="clXlsx"){await clXlsx(b.dataset.p,true,clTipo);return true}
  return false;
}
function clInput(ev){
  const t=ev.target;if(!clv||clRO())return;
  if(t.dataset.clenc==="km"){clv.km=String(t.value).replace(/[^0-9]/g,"");clTouch();const n=$("#cmkmtx");if(n)n.textContent=cmKmTxt(cmKmInfo(clv));return}
  if(t.dataset.clenc){clv[t.dataset.clenc]=t.value;clTouch();return}
  if(t.dataset.clf){const k=t.dataset.k,r=clv.items[k]||{};r[t.dataset.clf]=t.value;clv.items[k]=r;clTouch();return}
}
function clChange(ev){
  const t=ev.target;if(!clv||clRO())return;
  if(t.dataset.clfoto){const files=[...t.files];t.value="";clAddFotos(clv,t.dataset.clfoto,files);return}
  if(t.dataset.clf==="resp"||t.dataset.clf==="plazo"){const k=t.dataset.k,r=clv.items[k]||{};r[t.dataset.clf]=t.value;clv.items[k]=r;clTouch();return}
  if(t.dataset.clenc==="fecha"){clv.fecha=t.value;clTouch()}
  if(t.dataset.clenc==="predioCampo"){clv.predioCampo=t.value;clTouch()}
  if(t.dataset.clenc==="km"){const k=kmNum(t.value);t.value=k?k.toLocaleString("es-CL"):"";clv.km=k?String(k):"";clTouch()}
}
async function clAddFotos(v,k,files){
  for(const f of files){
    const r=v.items[k]||(v.items[k]={});r.fotos=r.fotos||[];
    if(r.fotos.length>=MAXF){toast(`Máximo ${MAXF} fotos por ítem.`);break}
    let img;try{img=await compress(f,1600,0.75)}catch(e){toast(msgImg(e,f),7000);continue}
    let ref=null;
    if(IDB.db){const t="q:"+uid();try{const buf=await img.blob.arrayBuffer();await IDB.put("fotos",t,{data:buf,type:"image/jpeg",actaId:v.id,k,col:"visitas"});QF[t]={actaId:v.id,k,col:"visitas"};ref=t}catch(e){}}
    if(!ref){ref=refSinEspacio();if(!ref)continue} /* v106 (C-04) */
    FOTO[ref]=img.dataURL;r.fotos.push(ref);
    clTouch();clRefreshItem(v,k);
  }
  schedSync(800);
}
async function clTrasCierre(p,v){try{await new Promise(r=>setTimeout(r,2500));await clXlsx(p,false,tipoDe(v));if(v)await clPdf(v,true)}catch(e){console.warn(e)}}

/* ---------- OneDrive: carpetas y Excel ---------- */
const CLPATH={};
/* v113: carpeta raíz de un check list sin id fijo (camionetas): se busca por nombre en la carpeta que contiene
   la de visitas (desde la v118, «Check list de cumplimiento») y, si no está, se crea; el id queda guardado en el teléfono */
async function clRaiz(tipo){const K=CLK[tipo],LK="actas-cl-raiz-"+tipo;if(K.root)return K.root;
  try{const g=localStorage.getItem(LK);if(g){K.root=g;return g}}catch(e){}
  const pv=await gjson(`/drives/${M365.drive}/items/${CLK.visitas.root}?$select=id,parentReference`);const padre=pv&&pv.parentReference&&pv.parentReference.id;if(!padre)throw new Error("No se encontró la carpeta de los check list.");
  let id=null;try{const r=await gjson(`/drives/${M365.drive}/items/${padre}:/${encName(K.carpeta)}`);id=r.id}catch(e){if(e.code!=="not_found")throw e}
  if(!id){const c=await crearCarpeta(padre,K.carpeta);id=c.id}
  K.root=id;try{localStorage.setItem(LK,id)}catch(e){}return id}
async function clCarpeta(segs,tipo){
  /* asegura Check list de visitas (o de bodega)/{seg1}/{seg2}... y devuelve el id de la última */
  tipo=tipo||"visitas";let parent=CLK[tipo].root||await clRaiz(tipo),path=tipo+":";
  for(const seg of segs){path+="/"+seg;if(CLPATH[path]){parent=CLPATH[path];continue}
    let id=null;try{const r=await gjson(`/drives/${M365.drive}/items/${parent}:/${encName(seg)}`);id=r.id}catch(e){if(e.code!=="not_found")throw e}
    if(!id){const c=await crearCarpeta(parent,seg);id=c.id}
    CLPATH[path]=id;parent=id}
  return parent;
}
const carpetaVisita=v=>[v.predio,`${v.fecha} Visita ${esc(v.n)}`];
async function clSubir(segs,name,blob,type,tipo){const folder=await clCarpeta(segs,tipo);if(blob&&blob.size>4*1048576)return subirBlob(folder,name,blob,type);const r=await gfetch(`/drives/${M365.drive}/items/${folder}:/${encName(name)}:/content`,{method:"PUT",headers:{"Content-Type":type},body:blob});return r.json()}
function clXlsxBuild(p,tipo){tipo=tipo||"visitas";
  const vs=validas(p,tipo).filter(v=>v.estado==="cerrada");const wb=XLSX.utils.book_new();const anul=visitasDe(p,tipo).filter(v=>v.anulada);
  const H=hallazgos(p,tipo);
  const head=["Área","Tipo","Código","Ítem","Referencia","Cómo verificar"].concat(vs.map(v=>`V${esc(v.n)} ${fmtD(v.fecha)}`)).concat(["Estado hallazgo","Abierto desde","Acción","Responsable","Plazo","Última observación"]);
  const rows=[head];const UNION=catalogoUnion(vs,tipo);const SEC=seccionesDe(tipo,UNION);
  UNION.forEach(it=>{const h=H[it.key];rows.push([it.areaName,it.fam,codigo(it)+(it.star?" ★":"")+(it.retirado?" (retirado)":""),it.txt,it.prot,it.evid].concat(vs.map(v=>{const r=v.items&&v.items[it.key];return r&&r.e?CL_LABEL[r.e]:""})).concat([h?(h.estado==="abierto"?"Abierto":h.estado==="cerrado"?`Corregido en V${h.cerrado.v}`:"OK"):"",h&&h.estado==="abierto"?`V${h.desde.v} ${fmtD(h.desde.fecha)}`:"",h&&h.estado==="abierto"?h.plan.acc:"",h&&h.estado==="abierto"?h.plan.resp:"",h&&h.estado==="abierto"?fmtD(h.plan.plazo):"",h&&h.ultima?h.ultima.obs:""]))});
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:14},{wch:16},{wch:9},{wch:60},{wch:32},{wch:30}].concat(vs.map(()=>({wch:14}))).concat([{wch:18},{wch:16},{wch:40},{wch:22},{wch:12},{wch:40}]);ws["!freeze"]={xSplit:4,ySplit:1};
  XLSX.utils.book_append_sheet(wb,ws,"Check list");
  /* Resumen por visita y área */
  const CMX=tipo==="camionetas";
  const res=[["Visita","Fecha","Revisor",CLK[tipo].acompX].concat(SEC.map(a=>a.name)).concat(["Total","Ítems revisados","Hallazgos (P/N)"]).concat(CMX?["Predio","Kilometraje","Recorrido desde la entrega"]:[])];
  vs.forEach(v=>{const t=puntaje(v),ki=CMX?cmKmInfo(v):null;res.push([`V${esc(v.n)}`,fmtD(v.fecha),v.revisor||"",v.administrador||""].concat(SEC.map(a=>{const s=puntaje(v,a.f);return s.pct===null?"":s.pct/100})).concat([t.pct===null?"":t.pct/100,t.rev,itemsDe(v).filter(i=>{const r=v.items&&v.items[i.key];return r&&esHallazgo(r.e)}).length]).concat(CMX?[v.predioCampo||"",ki?ki.k:"",ki&&ki.rec!=null?ki.rec:""]:[]))});
  const wr=XLSX.utils.aoa_to_sheet(res);for(let r=1;r<res.length;r++)for(let c=4;c<4+SEC.length+1;c++){const cell=wr[XLSX.utils.encode_cell({r,c})];if(cell&&typeof cell.v==="number")cell.z="0%"}
  if(anul.length){res.push([]);res.push(["Visitas anuladas (no cuentan)"]);anul.forEach(v=>res.push([`V${esc(v.n)}`,fmtD(v.fecha),v.revisor||"",`Anulada el ${fmtD(v.anulada.fecha)} por ${quien(v.anulada.por)}${v.anulada.motivo?": "+v.anulada.motivo:""}`]))}
  XLSX.utils.book_append_sheet(wb,wr,"Resumen");
  /* Hallazgos abiertos */
  const hz=[["Área","Código","Ítem","Estado","Abierto desde","Visitas seguidas","Última observación","Acción","Responsable","Plazo","Vencido"]];
  Object.values(H).filter(h=>h.estado==="abierto").forEach(h=>hz.push([h.it.areaName,codigo(h.it),h.it.txt,CL_LABEL[h.ultima.e],`V${h.desde.v} ${fmtD(h.desde.fecha)}`,h.visitas,h.ultima.obs,h.plan.acc,h.plan.resp,fmtD(h.plan.plazo),h.plan.plazo&&h.plan.plazo<today()?"Sí":""]));
  const wh=XLSX.utils.aoa_to_sheet(hz);wh["!cols"]=[{wch:14},{wch:9},{wch:60},{wch:12},{wch:18},{wch:9},{wch:40},{wch:40},{wch:22},{wch:12},{wch:8}];
  XLSX.utils.book_append_sheet(wb,wh,"Hallazgos abiertos");
  /* Fotos con enlace */
  const fr=[["Visita","Fecha","Área","Código","Ítem","Resultado","Observación","Foto"]];const links=[];
  vs.forEach(v=>itemsDe(v).forEach(it=>{const r=v.items&&v.items[it.key];if(!r||!(r.fotos||[]).length)return;r.fotos.forEach(f=>{const u=v.fotoUrl&&v.fotoUrl[f];fr.push([`V${esc(v.n)}`,fmtD(v.fecha),it.areaName,codigo(it),it.txt,r.e?CL_LABEL[r.e]:"",r.obs||"",u?"Abrir foto":"(pendiente de subir)"]);if(u)links.push([fr.length-1,u])})}));
  const wf=XLSX.utils.aoa_to_sheet(fr);wf["!cols"]=[{wch:8},{wch:12},{wch:14},{wch:9},{wch:50},{wch:12},{wch:40},{wch:14}];
  links.forEach(([r,u])=>{const c=wf[XLSX.utils.encode_cell({r,c:7})];if(c)c.l={Target:u,Tooltip:"Abrir en OneDrive"}});
  XLSX.utils.book_append_sheet(wb,wf,"Fotos");
  return XLSX.write(wb,{bookType:"xlsx",type:"array"});
}
async function clXlsxUpload(p,tipo){tipo=tipo||"visitas";
  await urlsAlDia(visitasDe(p,tipo),()=>"/Check%20list%20de%20cumplimiento/",saveVis); /* v118 */
  const buf=clXlsxBuild(p,tipo);await clSubir([p],`${CLK[tipo].excel}${p.replace(/\s+/g,"_")}.xlsx`,new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",tipo)}
function clXlsx(p,manual,tipo){tipo=tipo||"visitas";return subirExcel(tipo+":"+p,manual,()=>clXlsxUpload(p,tipo))}

/* ---------- Informe PDF de la visita ---------- */
async function clPdf(v,subir){
  if(!window.jspdf){toast("No se pudo cargar el generador de PDF.");return}
  await flush();if(!subir)toast("Preparando el informe…");
  const TV=tipoDe(v),KV=CLK[TV];const prev=visitaAnterior(v),H=hallazgos(v.predio,TV);
  const ITV=itemsDe(v);
  /* v82: el informe muestra solo los puntos que aplican; los N/A y las áreas donde no aplica ninguno se omiten */
  const esNA=it=>{const r=v.items&&v.items[it.key];return !!(r&&r.e==="NA")};
  const ITA=ITV.filter(it=>!esNA(it)),nNA=ITV.length-ITA.length;
  const conObs=ITA.filter(it=>{const r=v.items&&v.items[it.key];return r&&(clObs(r)||(r.fotos||[]).length||(esHallazgo(r.e)&&(r.acc||r.resp||r.plazo)))});
  const refs=[];conObs.forEach(it=>((v.items[it.key]||{}).fotos||[]).forEach(f=>refs.push(f)));
  const IM={};for(const f of refs)IM[f]=await pdfImg(f);
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"mm",format:"a4"});const L=15,W=180;let y=10;
  const nueva=()=>{d.addPage();y=15};const chk=h=>{if(y+h>282)nueva()};
  const COL={C:[30,110,50],P:[150,110,20],N:[170,40,40],NA:[110,110,110]};const FILL={C:[226,240,224],P:[244,236,206],N:[246,222,222],NA:[236,238,240]};
  const titulo=t=>{chk(14);d.setFont("helvetica","bold");d.setFontSize(12);d.setTextColor(15,39,64);d.text(t,L,y);d.setTextColor(0);y+=6.5};
  /* encabezado */
  d.setFillColor(141,179,226);d.rect(L,y,W,21,"F");try{d.addImage(LOGO,"JPEG",L+2,y+1.5,20,18)}catch(e){}
  d.setFont("helvetica","bold");d.setFontSize(14);d.setTextColor(15,39,64);d.text(KV.pdf,L+26,y+9);d.setFontSize(10);d.setFont("helvetica","normal");d.text(`${v.predio} · Visita ${esc(v.n)} · ${fmtD(v.fecha)}${v.anulada?" · ANULADA":v.estado!=="cerrada"?" · BORRADOR":""}`,L+26,y+16);d.setTextColor(0);y+=27;
  d.setFontSize(9.5);d.text(`Revisor(es): ${v.revisor||"-"}`,L,y);d.text(`${KV.acomp}: ${v.administrador||"-"}`,L+95,y);y+=5;
  if(TV==="camionetas"){const a=actaPatente(v.predio),ve=(a&&a.veh)||{},ki=cmKmInfo(v);
    d.text(`Camioneta: ${[ve.tipoVeh,ve.marca,ve.modelo,ve.anio].filter(Boolean).join(" ")||"-"} · Predio: ${v.predioCampo||"-"}${a?` · Acta de entrega del ${fmtD(a.fecha)}`:" · sin acta de entrega en la app"}`,L,y);y+=5;
    d.text(`Kilometraje: ${ki?ki.k.toLocaleString("es-CL")+" km":"-"}${ki?" · "+cmKmTxt(ki):""}`,L,y);y+=5}
  d.text(`Comparado con: ${prev?`visita ${esc(prev.n)} del ${fmtD(prev.fecha)}`:"sin visita anterior"}`,L,y);y+=8;
  /* 1. resumen por área */
  titulo("Resumen");d.setFontSize(8.5);
  const colsR=[60,24,24,24,24,24];const SECV=seccionesDe(TV,ITV);const headR=[SECV.col,"Cumple","Parcial","No cumple","Evaluados","Cumplimiento"];
  const sinAplicar=SECV.filter(a=>ITV.some(a.f)&&!ITA.some(a.f)).map(a=>a.name);
  const fila=(cells,bold,fill)=>{chk(7);let x=L;if(fill){d.setFillColor(...fill);d.rect(L,y-4.2,W,6.5,"F")}d.setFont("helvetica",bold?"bold":"normal");cells.forEach((c,i)=>{d.text(String(c),x+1.5,y);x+=colsR[i]});y+=6.5};
  fila(headR,true,[221,235,247]);
  const cnt=(f,e)=>ITV.filter(i=>f(i)&&v.items&&v.items[i.key]&&v.items[i.key].e===e).length;
  SECV.forEach(a=>{const f=a.f;if(!ITA.some(f))return;const s=puntaje(v,f);fila([a.name,cnt(f,"C"),cnt(f,"P"),cnt(f,"N"),s.n,s.pct===null?"-":s.pct+" %"],false,null)});
  const T=puntaje(v);fila(["Total",cnt(()=>true,"C"),cnt(()=>true,"P"),cnt(()=>true,"N"),T.n,T.pct===null?"-":T.pct+" %"],true,[242,245,248]);
  y+=5;
  /* 2. check list completo: cada punto con su resultado */
  titulo(`Check list (${ITA.length} ${ITA.length===1?"punto que aplica":"puntos que aplican"})`);
  if(nNA){const q=sinAplicar.length?` ${sinAplicar.length===1?sinAplicar[0]+" no aparece":sinAplicar.slice(0,-1).join(", ")+" y "+sinAplicar[sinAplicar.length-1]+" no aparecen"} porque ningún punto aplicaba.`:"";
    d.setFont("helvetica","italic");d.setFontSize(8.5);d.setTextColor(90);const l=d.splitTextToSize(`No se incluyen ${nNA===1?"el punto marcado":"los "+nNA+" puntos marcados"} como N/A (no aplica).${q}`,W);d.text(l,L,y-1);y+=l.length*3.8+2.5;d.setTextColor(0);d.setFont("helvetica","normal")}
  if(!ITA.length){d.setFontSize(9.5);d.text("Ningún punto aplicaba en esta visita.",L,y+2);y+=8}
  const cmp=!!prev;
  const cols=cmp?[{t:"Código",w:15},{t:"Punto revisado",w:105},{t:`Visita ${esc(prev.n)}`,w:28},{t:"Resultado",w:32}]:[{t:"Código",w:15},{t:"Punto revisado",w:133},{t:"Resultado",w:32}];
  const thead=()=>{chk(8);d.setFillColor(221,235,247);d.rect(L,y-4.5,W,6.5,"F");d.setFont("helvetica","bold");d.setFontSize(8.5);let x=L;cols.forEach(c=>{d.text(c.t,x+1.5,y);x+=c.w});d.setFont("helvetica","normal");y+=4};
  const chip=(e,x,w,yy)=>{const t=e?CL_LABEL[e]:"Sin revisar";const fc=e?FILL[e]:[245,245,245],tc=e?COL[e]:[130,130,130];d.setFillColor(...fc);d.roundedRect(x+1,yy-3.6,w-2,5,1.2,1.2,"F");d.setFont("helvetica","bold");d.setFontSize(7.8);d.setTextColor(...tc);d.text(t,x+w/2,yy,{align:"center"});d.setTextColor(0);d.setFont("helvetica","normal")};
  SECV.forEach(a=>{
    const its=ITA.filter(a.f);if(!its.length)return;
    chk(16);d.setFont("helvetica","bold");d.setFontSize(10);d.setFillColor(242,245,248);d.rect(L,y,W,6.5,"F");d.text(a.name,L+2,y+4.6);y+=10.5;thead();
    let grupo="";
    its.forEach(it=>{
      const r=(v.items||{})[it.key]||{},pr=prev&&prev.items&&prev.items[it.key];
      if(it.group!==grupo){grupo=it.group;chk(10);d.setFont("helvetica","bolditalic");d.setFontSize(8);d.setTextColor(90);d.text(`${it.fam} · ${it.group}`,L+1.5,y+3);d.setTextColor(0);y+=5}
      d.setFontSize(8.3);const tl=d.splitTextToSize((it.star?"(Clave) ":"")+it.txt,cols[1].w-3);
      const ob=clObs(r);const ol=ob?d.splitTextToSize("Obs.: "+ob,cols[1].w-3):[];
      const h=Math.max(6,tl.length*3.6+ol.length*3.3+2.4);
      if(y+h>282){nueva();thead()}
      d.setDrawColor(225);d.line(L,y+h,L+W,y+h);d.setDrawColor(0);
      let x=L;d.setFont("helvetica","normal");d.setFontSize(8);d.setTextColor(31,78,121);d.text(codigo(it),x+1.5,y+3.8);d.setTextColor(0);x+=cols[0].w;
      d.setFontSize(8.3);d.text(tl,x+1.5,y+3.8,{lineHeightFactor:1.25});
      if(ol.length){d.setFont("helvetica","italic");d.setFontSize(7.6);d.setTextColor(90);d.text(ol,x+1.5,y+3.8+tl.length*3.6,{lineHeightFactor:1.2});d.setTextColor(0);d.setFont("helvetica","normal")}
      x+=cols[1].w;
      if(cmp){chip(pr&&pr.e,x,cols[2].w,y+3.9);x+=cols[2].w}
      chip(r.e,x,cols[cols.length-1].w,y+3.9);
      y+=h;
    });
    y+=4;
  });
  /* 3. hallazgos y plan de acción */
  const hall=ITA.filter(it=>{const r=v.items&&v.items[it.key];return r&&esHallazgo(r.e)});
  const corr=prev?ITA.filter(it=>{const r=v.items&&v.items[it.key],pr=prev.items&&prev.items[it.key];return r&&r.e==="C"&&pr&&esHallazgo(pr.e)}):[];
  titulo(`Hallazgos y plan de acción (${hall.length})`);
  if(!hall.length){d.setFont("helvetica","normal");d.setFontSize(9.5);d.text("Sin puntos en Parcial o No cumple.",L,y);y+=7}
  hall.forEach(it=>{const r=v.items[it.key];const pr=prev&&prev.items&&prev.items[it.key];const hh=H[it.key];
    d.setFontSize(8.8);const lines=d.splitTextToSize(it.txt,W-34);
    const meta=[];if(pr&&pr.e)meta.push(`Visita ${esc(prev.n)}: ${CL_LABEL[pr.e]}${esHallazgo(pr.e)?" (sigue abierto)":" (nuevo)"}`);else if(prev)meta.push("Nuevo");if(hh&&hh.estado==="abierto"&&v.estado==="cerrada"&&hh.desde.v<v.n)meta.push(`Abierto desde la visita ${hh.desde.v} (${fmtD(hh.desde.fecha)})`);
    const plan=[r.acc?"Acción: "+r.acc:"",r.resp?"Responsable: "+r.resp:"",r.plazo?"Plazo: "+fmtD(r.plazo):""].filter(Boolean).join("   ");
    const pl=plan?d.splitTextToSize(plan,W-6):[d.splitTextToSize("Sin plan de acción definido.",W-6)[0]];
    const h=5+lines.length*4+(meta.length?4.5:0)+pl.length*4+3;chk(h+2);
    d.setFillColor(...FILL[r.e]);d.roundedRect(L,y-1,W,h,1.5,1.5,"F");
    d.setFont("helvetica","bold");d.setFontSize(8.8);d.text(`${codigo(it)} · ${etqIt(it,TV)}`,L+2,y+3);d.setTextColor(...COL[r.e]);d.text(CL_LABEL[r.e],L+W-2,y+3,{align:"right"});d.setTextColor(0);let yy=y+7.5;
    d.setFont("helvetica","normal");d.text(lines,L+2,yy,{lineHeightFactor:1.25});yy+=lines.length*4;
    if(meta.length){d.setFontSize(8);d.setTextColor(90);d.text(meta.join("   "),L+2,yy);d.setTextColor(0);yy+=4.5}
    d.setFontSize(8.3);d.setFont("helvetica",plan?"bold":"italic");d.text(pl,L+2,yy,{lineHeightFactor:1.2});d.setFont("helvetica","normal");
    y+=h+3});
  if(corr.length){y+=2;titulo(`Corregidos desde la visita anterior (${corr.length})`);d.setFont("helvetica","normal");d.setFontSize(8.8);
    corr.forEach(it=>{const l=d.splitTextToSize(`${codigo(it)} · ${it.txt}`,W-4);chk(l.length*4+1.5);d.text(l,L+2,y);y+=l.length*4+1.5});y+=3}
  /* 4. al final: observaciones con sus fotografías */
  if(conObs.length){
    nueva();titulo(`Observaciones y fotografías (${conObs.length})`);
    conObs.forEach(it=>{const r=v.items[it.key]||{};const ob=clObs(r);const fs=(r.fotos||[]).map(f=>IM[f]).filter(Boolean);
      d.setFontSize(9);const tl=d.splitTextToSize(it.txt,W-36);const ol=ob?d.splitTextToSize(ob,W-4):[];
      const IW=(W-8)/3,MH=50;const filasF=Math.ceil(Math.min(fs.length,6)/3);
      chk(8+tl.length*4.2+ol.length*4+(filasF?MH+4:0));
      d.setDrawColor(200);d.line(L,y-2,L+W,y-2);d.setDrawColor(0);
      d.setFont("helvetica","bold");d.setFontSize(9);d.text(`${codigo(it)} · ${etqIt(it,TV)}`,L,y+2);
      if(r.e){d.setTextColor(...COL[r.e]);d.text(CL_LABEL[r.e],L+W,y+2,{align:"right"});d.setTextColor(0)}
      y+=6.5;d.setFont("helvetica","normal");d.text(tl,L,y,{lineHeightFactor:1.25});y+=tl.length*4.2;
      if(ol.length){d.setFont("helvetica","italic");d.setFontSize(8.8);d.setTextColor(60);d.text(ol,L,y+0.5,{lineHeightFactor:1.25});d.setTextColor(0);d.setFont("helvetica","normal");y+=ol.length*4+1.5}
      if(fs.length){let x=L,n=0;fs.slice(0,6).forEach((im,i)=>{if(i===3){y+=MH+3;chk(MH+4);x=L}let w=IW,hh=w*im.h/im.w;if(hh>MH){hh=MH;w=hh*im.w/im.h}try{d.addImage(im.data,"JPEG",x+(IW-w)/2,y,w,hh)}catch(e){}x+=IW+4;n=i});y+=MH+4;if(fs.length>6){d.setFontSize(7.5);d.setTextColor(110);d.text(`(${fs.length-6} fotos más en la carpeta de OneDrive)`,L,y);d.setTextColor(0);y+=4}}
      else if((r.fotos||[]).length){d.setFontSize(8);d.setTextColor(110);d.text("Las fotos no se pudieron cargar; están en la carpeta de OneDrive.",L,y+1);d.setTextColor(0);y+=5}
      y+=5});
  }
  const n=d.getNumberOfPages();for(let i=1;i<=n;i++){d.setPage(i);d.setFont("helvetica","normal");d.setFontSize(7.5);d.setTextColor(110);d.text(`Página ${i} de ${n}`,195,289,{align:"right"});const a=autoriaTxt(v);if(a)d.text(d.splitTextToSize("Registro en la app: "+a.charAt(0).toLowerCase()+a.slice(1),150)[0],15,289);d.setTextColor(0)}
  const name=`Informe_${KV.archivo}_${esc(v.n)}_${v.predio.replace(/\s+/g,"_")}_${fmtD(v.fecha)}.pdf`;
  if(subir){try{await clSubir(carpetaVisita(v),name,d.output("blob"),"application/pdf",TV)}catch(e){console.warn(e)}return}
  await guardarPDF(d,name,"Informe listo.");
}

/* marca de que el módulo cargó completo (la revisa el arranque en index.html) */
window.MOD_CHECKLIST=true;
window.MODV=window.MODV||{};window.MODV["checklist"]="146"; /* v137 (M-29): versión del módulo (se sube con APP_VER en cada versión) */
