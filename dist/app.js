const trails=[...TRAILS,...GNTA_TRAILS,...NORTHERN_TRAILS,...OSM_ROUTE_TRAILS].map(trail=>{
  const mapped=GNTA_MAPPED[trail.id];
  return mapped?{...trail,...mapped,precision:"mapped",condition:"Mapped trail line"}:trail;
});

const allTypes=["walking","skidoo","atv"];
const state={activeTypes:new Set(allTypes),query:"",saved:new Set(JSON.parse(localStorage.getItem("nl-trails-saved")||localStorage.getItem("akidoo-saved")||"[]")),selected:1,sort:"Nearby",basemap:"street"};
const list=document.querySelector("#trailList"),count=document.querySelector("#resultCount"),modal=document.querySelector("#detailModal"),toast=document.querySelector("#toast");
const colors={walking:"#ed6f32",skidoo:"#4b8eaa",atv:"#788935",multiuse:"#76518d"};

const map=L.map("trailMap",{zoomControl:false,minZoom:5,maxZoom:17,zoomSnap:.5,preferCanvas:true}).setView([48.72,-56.05],6);
const streetLayer=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
const satelliteLayer=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics'});
const trailLayer=L.layerGroup().addTo(map);
let locationLayer=null;
map.attributionControl.addAttribution('Trail geometry &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');

function decodePolyline(encoded){
  const value=encoded.slice(1),points=[];let index=0,lat=0,lng=0;
  while(index<value.length){
    let byte,shift=0,result=0;do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5}while(byte>=32);lat+=(result&1)?~(result>>1):(result>>1);
    shift=0;result=0;do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5}while(byte>=32);lng+=(result&1)?~(result>>1):(result>>1);
    points.push([lat/1e5,lng/1e5]);
  }
  return points;
}
const nlsfGroomed=NLSF_SEGMENTS.filter(x=>x.c==="F").map(x=>decodePolyline(x.e));
const nlsfUnmaintained=NLSF_SEGMENTS.filter(x=>x.c!=="F").map(x=>decodePolyline(x.e));

function trailGeometry(trail){return trail.segments||trail.route||null}
function trailPoints(trail){const geometry=trailGeometry(trail);return geometry?(trail.segments?geometry.flat():geometry):[trail.center]}

function setBasemap(name){
  state.basemap=name;
  document.querySelectorAll("[data-basemap]").forEach(button=>{const active=button.dataset.basemap===name;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
  document.querySelector("#trailMap").classList.toggle("satellite-view",name==="satellite");
  if(name==="satellite"){
    if(map.hasLayer(streetLayer))map.removeLayer(streetLayer);
    if(!map.hasLayer(satelliteLayer))satelliteLayer.addTo(map);
  }else{
    if(map.hasLayer(satelliteLayer))map.removeLayer(satelliteLayer);
    if(!map.hasLayer(streetLayer))streetLayer.addTo(map);
  }
  setTimeout(()=>map.invalidateSize(),0);
}

function filtered(){
  let items=trails.filter(t=>(t.types||[t.type]).some(type=>state.activeTypes.has(type))&&(`${t.name} ${t.region}`.toLowerCase().includes(state.query)));
  if(state.sort==="Distance") items=[...items].sort((a,b)=>Number(a.distance.match(/[\d.]+/)?.[0]||9999)-Number(b.distance.match(/[\d.]+/)?.[0]||9999));
  if(state.sort==="Difficulty"){const rank={Easy:1,"Easy–Moderate":1.5,Moderate:2,Intermediate:2,Varied:2.5,Rugged:3,Difficult:4,Advanced:4};items=[...items].sort((a,b)=>(rank[a.difficulty]||9)-(rank[b.difficulty]||9));}
  return items;
}

function pinIcon(trail,selected){
  const compact=!['official','mapped'].includes(trail.precision);
  return L.divIcon({className:`akidoo-div-icon${selected?" is-selected":""}`,html:`<span class="map-pin${compact?" compact":""}" style="--pin-color:${colors[trail.type]}"><i></i></span>`,iconSize:compact?[24,24]:[34,34],iconAnchor:compact?[12,24]:[17,34],tooltipAnchor:[14,-14]});
}

function updateLayerButtons(){
  document.querySelectorAll(".mode").forEach(button=>{const mode=button.dataset.mode;const active=mode==="all"?state.activeTypes.size===allTypes.length:state.activeTypes.has(mode);button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  document.querySelector("#filterCount").textContent=state.activeTypes.size;
}

function updateMap(items,fit=false){
  trailLayer.clearLayers();
  if(state.activeTypes.has("walking"))L.polyline(OSM_WALKING_SEGMENTS,{color:colors.walking,weight:2,opacity:.42,interactive:false}).addTo(trailLayer);
  if(state.activeTypes.has("skidoo")){
    L.polyline(nlsfGroomed,{color:colors.skidoo,weight:3,opacity:.82,interactive:false}).addTo(trailLayer);
    L.polyline(nlsfUnmaintained,{color:"#43535d",weight:2,opacity:.72,dashArray:"7 7",interactive:false}).addTo(trailLayer);
  }
  if(state.activeTypes.has("atv")&&OSM_ATV_SEGMENTS.length)L.polyline(OSM_ATV_SEGMENTS,{color:colors.atv,weight:3,opacity:.72,dashArray:"5 5",interactive:false}).addTo(trailLayer);
  items.forEach(t=>{
    const geometry=trailGeometry(t);
    if(["official","mapped"].includes(t.precision)&&geometry?.length)L.polyline(geometry,{color:colors[t.type],weight:5,opacity:.92,lineCap:"round"}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
    L.marker(t.center,{icon:pinIcon(t,state.selected===t.id),title:t.name,alt:`Open ${t.name}`}).bindTooltip(t.name,{direction:"right",className:"akidoo-tooltip",offset:[8,-15]}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
  });
  if(fit&&items.length){const points=items.flatMap(trailPoints);map.fitBounds(L.latLngBounds(points).pad(.18),{animate:true,maxZoom:9});}
}

function render(fitMap=false){
  const items=filtered();count.textContent=`${items.length} route${items.length===1?"":"s"}`;
  list.innerHTML=items.length?items.map(t=>`<article class="trail-card ${state.selected===t.id?"active":""}" data-id="${t.id}" tabindex="0"><div class="card-top"><span class="trail-type ${t.type} ${t.badge?.toLowerCase().replaceAll(" ","-")||""}">${t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase())}</span><button class="save-btn ${state.saved.has(t.id)?"saved":""}" data-save="${t.id}" aria-label="${state.saved.has(t.id)?"Remove from":"Save to"} saved">${state.saved.has(t.id)?"♥":"♡"}</button></div><h3>${t.name}</h3><span class="region">${t.region}</span><div class="card-stats"><span>↔ <b>${t.distance}</b></span><span>◇ <b>${t.difficulty}</b></span><span class="condition">${t.condition}</span></div></article>`).join(""):`<div class="empty"><b>No trails found</b><p>Turn on a layer or try another search.</p></div>`;
  updateLayerButtons();updateMap(items,fitMap);
}

function selectTrail(id,open=false){const t=trails.find(x=>x.id===id);state.selected=id;render(false);map.flyTo(t.center,Math.max(map.getZoom(),8),{duration:.65});if(open)openDetail(id)}
function toggleSave(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);localStorage.setItem("nl-trails-saved",JSON.stringify([...state.saved]));render(false);showToast(state.saved.has(id)?"Trail saved for later":"Removed from saved trails")}
function openDetail(id){const t=trails.find(x=>x.id===id);state.selected=id;document.querySelector("#detailVisual").className=`detail-visual ${t.type}`;document.querySelector("#detailType").textContent=t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase());document.querySelector("#detailRegion").textContent=t.region;document.querySelector("#modalTitle").textContent=t.name;document.querySelector("#detailDescription").textContent=t.description;document.querySelector("#detailDistance").textContent=t.distance;document.querySelector("#detailDifficulty").textContent=t.difficulty;document.querySelector("#detailTime").textContent=t.time;document.querySelector("#detailCondition").textContent=t.condition;document.querySelector("#modalSave").textContent=state.saved.has(id)?"♥":"♡";modal.hidden=false;document.body.style.overflow="hidden";document.querySelector(".close-btn").focus()}
function closeDetail(){modal.hidden=true;document.body.style.overflow=""}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}

document.querySelectorAll(".mode").forEach(btn=>btn.addEventListener("click",()=>{const mode=btn.dataset.mode;if(mode==="all"){state.activeTypes=new Set(allTypes)}else{state.activeTypes.has(mode)?state.activeTypes.delete(mode):state.activeTypes.add(mode)}render(true)}));
document.querySelectorAll("[data-basemap]").forEach(btn=>btn.addEventListener("click",()=>setBasemap(btn.dataset.basemap)));
document.querySelector("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();render(true)});
list.addEventListener("click",e=>{const save=e.target.closest("[data-save]");if(save){e.stopPropagation();toggleSave(Number(save.dataset.save));return}const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)});
list.addEventListener("keydown",e=>{if(e.key==="Enter"){const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)}});
document.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",closeDetail));document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeDetail()});
document.querySelector("#modalSave").addEventListener("click",()=>{toggleSave(state.selected);document.querySelector("#modalSave").textContent=state.saved.has(state.selected)?"♥":"♡"});
document.querySelector("#startRoute").addEventListener("click",()=>{const trail=trails.find(t=>t.id===state.selected),points=trailPoints(trail);closeDetail();document.querySelector("#explorer").scrollIntoView();if(points.length>1)map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});else map.flyTo(trail.center,11);showToast(points.length>1?"Showing the full mapped trail":"Showing the trail area")});
document.querySelector("#filterBtn").addEventListener("click",()=>{state.activeTypes=new Set(allTypes);render(true);showToast("All three trail layers are visible")});
document.querySelector("#sortBtn").addEventListener("click",e=>{const options=["Nearby","Distance","Difficulty"];state.sort=options[(options.indexOf(state.sort)+1)%options.length];e.currentTarget.firstChild.textContent=state.sort+" ";render(false)});
document.querySelector("#zoomIn").addEventListener("click",e=>{e.stopPropagation();map.zoomIn()});document.querySelector("#zoomOut").addEventListener("click",e=>{e.stopPropagation();map.zoomOut()});
document.querySelector("#locateMe").addEventListener("click",e=>{e.stopPropagation();if(!navigator.geolocation){showToast("Location is not available in this browser");return}showToast("Finding your location…");navigator.geolocation.getCurrentPosition(pos=>{const here=[pos.coords.latitude,pos.coords.longitude];if(locationLayer)map.removeLayer(locationLayer);locationLayer=L.marker(here,{icon:L.divIcon({className:"",html:'<span class="location-pulse"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).bindTooltip("You are here").addTo(map);map.flyTo(here,10);showToast("Location found")},()=>showToast("We couldn’t access your location"),{enableHighAccuracy:true,timeout:8000})});
document.querySelectorAll(".nav-link").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(btn.dataset.section==="safety")document.querySelector("#safety").scrollIntoView();else if(btn.dataset.section==="saved"){state.query="";document.querySelector("#searchInput").value="";showToast(`${state.saved.size} saved trail${state.saved.size===1?"":"s"}`);render(false)}else document.querySelector("#explorer").scrollIntoView()}));
document.querySelector("#safetyBtn").addEventListener("click",()=>showToast("Always check official advisories before heading out"));document.querySelector("#profileBtn").addEventListener("click",()=>showToast("Guest explorer · your saves stay on this device"));
render(false);
