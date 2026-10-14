const trails = [
  {id:1,name:"Green Gardens Coast",region:"Gros Morne · West Coast",type:"walking",distance:"10.2 km",difficulty:"Moderate",time:"3–4 hr",condition:"Good",center:[49.52,-57.91],route:[[49.558,-57.867],[49.542,-57.884],[49.523,-57.901],[49.503,-57.924],[49.481,-57.949]],description:"A dramatic coastal walk through volcanic tablelands, tuckamore, and sea-cliff meadows."},
  {id:2,name:"Humber Valley Run",region:"Corner Brook · West Coast",type:"skidoo",distance:"74 km",difficulty:"Intermediate",time:"4–6 hr",condition:"Packed",center:[49.18,-57.48],route:[[48.953,-57.949],[49.026,-57.794],[49.108,-57.648],[49.201,-57.501],[49.303,-57.329],[49.411,-57.164]],description:"A long winter route through the Humber Valley with broad views and sheltered forest sections."},
  {id:3,name:"Exploits Ridge Loop",region:"Grand Falls-Windsor · Central",type:"atv",distance:"42 km",difficulty:"Rugged",time:"3–5 hr",condition:"Dry",center:[48.98,-55.32],route:[[48.938,-55.652],[49.002,-55.462],[49.071,-55.271],[49.018,-55.075],[48.902,-55.161],[48.872,-55.413],[48.938,-55.652]],description:"Rock, roots, and wide-open ridge country on a varied loop through central Newfoundland."},
  {id:4,name:"Terra Nova Passage",region:"Terra Nova · East Coast",type:"walking",distance:"8.4 km",difficulty:"Easy",time:"2–3 hr",condition:"Good",center:[48.56,-53.91],route:[[48.523,-53.968],[48.541,-53.944],[48.558,-53.917],[48.577,-53.888],[48.598,-53.861]],description:"A relaxed forest and shoreline path with quiet coves, boardwalks, and frequent bird sightings."},
  {id:5,name:"Avalon Backcountry",region:"Clarenville to Avalon",type:"skidoo",distance:"96 km",difficulty:"Advanced",time:"6–8 hr",condition:"Variable",center:[47.76,-53.52],route:[[48.166,-53.969],[48.052,-53.844],[47.934,-53.711],[47.813,-53.586],[47.681,-53.451],[47.558,-53.317],[47.435,-53.143]],description:"A full-day snow route crossing exposed barrens and sheltered woods toward the Avalon Peninsula."},
  {id:6,name:"Cape Shore Track",region:"Placentia · Avalon",type:"atv",distance:"31 km",difficulty:"Moderate",time:"2–4 hr",condition:"Muddy",center:[47.27,-54.23],route:[[47.247,-53.962],[47.196,-54.074],[47.184,-54.207],[47.236,-54.337],[47.319,-54.448],[47.385,-54.503]],description:"An old coastal track with punchy climbs, muddy crossings, and sweeping views of Placentia Bay."}
];

const allTypes=["walking","skidoo","atv"];
const state={activeTypes:new Set(allTypes),query:"",saved:new Set(JSON.parse(localStorage.getItem("nl-trails-saved")||localStorage.getItem("akidoo-saved")||"[]")),selected:1,sort:"Nearby"};
const list=document.querySelector("#trailList"),count=document.querySelector("#resultCount"),modal=document.querySelector("#detailModal"),toast=document.querySelector("#toast");
const colors={walking:"#ed6f32",skidoo:"#4b8eaa",atv:"#788935"};

const map=L.map("trailMap",{zoomControl:false,minZoom:5,maxZoom:17,zoomSnap:.5}).setView([48.72,-56.05],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
const trailLayer=L.layerGroup().addTo(map);
let locationLayer=null;

function filtered(){
  let items=trails.filter(t=>state.activeTypes.has(t.type)&&(`${t.name} ${t.region}`.toLowerCase().includes(state.query)));
  if(state.sort==="Distance") items=[...items].sort((a,b)=>parseFloat(a.distance)-parseFloat(b.distance));
  if(state.sort==="Difficulty"){const rank={Easy:1,Moderate:2,Intermediate:2,Rugged:3,Advanced:4};items=[...items].sort((a,b)=>rank[a.difficulty]-rank[b.difficulty]);}
  return items;
}

function pinIcon(type,selected){
  return L.divIcon({className:`akidoo-div-icon${selected?" is-selected":""}`,html:`<span class="map-pin" style="--pin-color:${colors[type]}"><i></i></span>`,iconSize:[34,34],iconAnchor:[17,34],tooltipAnchor:[18,-18]});
}

function updateLayerButtons(){
  document.querySelectorAll(".mode").forEach(button=>{const mode=button.dataset.mode;const active=mode==="all"?state.activeTypes.size===allTypes.length:state.activeTypes.has(mode);button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  document.querySelector("#filterCount").textContent=state.activeTypes.size;
}

function updateMap(items,fit=false){
  trailLayer.clearLayers();
  items.forEach(t=>{
    L.polyline(t.route,{color:colors[t.type],weight:5,opacity:.86,dashArray:"8 10",lineCap:"round"}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
    L.marker(t.center,{icon:pinIcon(t.type,state.selected===t.id),title:t.name,alt:`Open ${t.name}`}).bindTooltip(t.name,{direction:"right",className:"akidoo-tooltip",offset:[8,-15]}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
  });
  if(fit&&items.length){const bounds=L.latLngBounds(items.flatMap(t=>t.route));map.fitBounds(bounds.pad(.18),{animate:true,maxZoom:9});}
}

function render(fitMap=false){
  const items=filtered();count.textContent=`${items.length} route${items.length===1?"":"s"}`;
  list.innerHTML=items.length?items.map(t=>`<article class="trail-card ${state.selected===t.id?"active":""}" data-id="${t.id}" tabindex="0"><div class="card-top"><span class="trail-type ${t.type}">${t.type.toUpperCase()}</span><button class="save-btn ${state.saved.has(t.id)?"saved":""}" data-save="${t.id}" aria-label="${state.saved.has(t.id)?"Remove from":"Save to"} saved">${state.saved.has(t.id)?"♥":"♡"}</button></div><h3>${t.name}</h3><span class="region">${t.region}</span><div class="card-stats"><span>↔ <b>${t.distance}</b></span><span>◇ <b>${t.difficulty}</b></span><span class="condition">${t.condition}</span></div></article>`).join(""):`<div class="empty"><b>No trail layers selected</b><p>Turn on Walking, Skidoo, or ATV above.</p></div>`;
  updateLayerButtons();updateMap(items,fitMap);
}

function selectTrail(id,open=false){const t=trails.find(x=>x.id===id);state.selected=id;render(false);map.flyTo(t.center,Math.max(map.getZoom(),8),{duration:.65});if(open)openDetail(id)}
function toggleSave(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);localStorage.setItem("nl-trails-saved",JSON.stringify([...state.saved]));render(false);showToast(state.saved.has(id)?"Trail saved for later":"Removed from saved trails")}
function openDetail(id){const t=trails.find(x=>x.id===id);state.selected=id;document.querySelector("#detailVisual").className=`detail-visual ${t.type}`;document.querySelector("#detailType").textContent=t.type.toUpperCase();document.querySelector("#detailRegion").textContent=t.region;document.querySelector("#modalTitle").textContent=t.name;document.querySelector("#detailDescription").textContent=t.description;document.querySelector("#detailDistance").textContent=t.distance;document.querySelector("#detailDifficulty").textContent=t.difficulty;document.querySelector("#detailTime").textContent=t.time;document.querySelector("#detailCondition").textContent=`${t.condition} conditions`;document.querySelector("#modalSave").textContent=state.saved.has(id)?"♥":"♡";modal.hidden=false;document.body.style.overflow="hidden";document.querySelector(".close-btn").focus()}
function closeDetail(){modal.hidden=true;document.body.style.overflow=""}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}

document.querySelectorAll(".mode").forEach(btn=>btn.addEventListener("click",()=>{const mode=btn.dataset.mode;if(mode==="all"){state.activeTypes=new Set(allTypes)}else{state.activeTypes.has(mode)?state.activeTypes.delete(mode):state.activeTypes.add(mode)}render(true)}));
document.querySelector("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();render(true)});
list.addEventListener("click",e=>{const save=e.target.closest("[data-save]");if(save){e.stopPropagation();toggleSave(Number(save.dataset.save));return}const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)});
list.addEventListener("keydown",e=>{if(e.key==="Enter"){const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)}});
document.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",closeDetail));document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeDetail()});
document.querySelector("#modalSave").addEventListener("click",()=>{toggleSave(state.selected);document.querySelector("#modalSave").textContent=state.saved.has(state.selected)?"♥":"♡"});
document.querySelector("#startRoute").addEventListener("click",()=>showToast("Route preview only — confirm official trail status before travelling"));
document.querySelector("#filterBtn").addEventListener("click",()=>{state.activeTypes=new Set(allTypes);render(true);showToast("All three trail layers are visible")});
document.querySelector("#sortBtn").addEventListener("click",e=>{const options=["Nearby","Distance","Difficulty"];state.sort=options[(options.indexOf(state.sort)+1)%options.length];e.currentTarget.firstChild.textContent=state.sort+" ";render(false)});
document.querySelector("#zoomIn").addEventListener("click",e=>{e.stopPropagation();map.zoomIn()});document.querySelector("#zoomOut").addEventListener("click",e=>{e.stopPropagation();map.zoomOut()});
document.querySelector("#locateMe").addEventListener("click",e=>{e.stopPropagation();if(!navigator.geolocation){showToast("Location is not available in this browser");return}showToast("Finding your location…");navigator.geolocation.getCurrentPosition(pos=>{const here=[pos.coords.latitude,pos.coords.longitude];if(locationLayer)map.removeLayer(locationLayer);locationLayer=L.marker(here,{icon:L.divIcon({className:"",html:'<span class="location-pulse"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).bindTooltip("You are here").addTo(map);map.flyTo(here,10);showToast("Location found")},()=>showToast("We couldn’t access your location"),{enableHighAccuracy:true,timeout:8000})});
document.querySelectorAll(".nav-link").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(btn.dataset.section==="safety")document.querySelector("#safety").scrollIntoView();else if(btn.dataset.section==="saved"){state.query="";document.querySelector("#searchInput").value="";showToast(`${state.saved.size} saved trail${state.saved.size===1?"":"s"}`);render(false)}else document.querySelector("#explorer").scrollIntoView()}));
document.querySelector("#safetyBtn").addEventListener("click",()=>showToast("Always check official advisories before heading out"));document.querySelector("#profileBtn").addEventListener("click",()=>showToast("Guest explorer · your saves stay on this device"));
render(false);
