const mappedByName=new Map(OSM_ROUTE_TRAILS.map(trail=>[trail.name,trail]));
const featuredGeometry={1:"Green Gardens Trail",2:"Gros Morne Mountain Trail"};
const routeCards=OSM_ROUTE_TRAILS.filter(trail=>!["Green Gardens Trail","Gros Morne Mountain Trail"].includes(trail.name));
const northernCards=NORTHERN_TRAILS.filter(trail=>trail.id!==20101);
const trails=[...TRAILS,...GNTA_TRAILS,...northernCards,...routeCards,...ADDED_TRAILS].map(trail=>{
  let result=trail;
  if(trail.id===11350)result={...trail,region:"Route 430, south of St. Anthony · GNTA",center:[51.4389,-55.6429],precision:"trailhead",condition:"Verified trailhead area · route pending",description:"A short, unmaintained out-and-back to Triple Falls and a local swimming hole. The trailhead area is just north and opposite Triple Falls RV Park on Route 430. The pin marks the verified roadside access area; a route line will only be added once its geometry is verified."};
  const mapped=GNTA_MAPPED[trail.id];
  if(mapped)result={...result,...mapped,precision:"mapped",condition:"Mapped trail line"};
  const featured=mappedByName.get(featuredGeometry[trail.id]);
  if(featured)result={...result,center:featured.center,segments:featured.segments,precision:"mapped",condition:"Mapped trail line"};
  return {...result,...(TRAIL_INFO[trail.id]||{})};
});

const allTypes=["walking","skidoo","atv"];
const state={activeTypes:new Set(allTypes),activePois:new Set(["shelter"]),experience:"all",focusedTrail:null,query:"",saved:new Set(JSON.parse(localStorage.getItem("nl-trails-saved")||localStorage.getItem("akidoo-saved")||"[]")),selected:1,sort:"Nearby",basemap:"street"};
const list=document.querySelector("#trailList"),count=document.querySelector("#resultCount"),modal=document.querySelector("#detailModal"),toast=document.querySelector("#toast");
const colors={walking:"#ed6f32",skidoo:"#4b8eaa",atv:"#788935",multiuse:"#76518d"};

const map=L.map("trailMap",{zoomControl:false,minZoom:5,maxZoom:17,zoomSnap:.5,preferCanvas:true}).setView([48.72,-56.05],6);
const streetLayer=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
const satelliteLayer=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics'});
const trailLayer=L.layerGroup().addTo(map);
const poiLayer=L.layerGroup().addTo(map);
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
function trailStart(trail){const geometry=trailGeometry(trail);return trail.precision==="trailhead"||!geometry?.length?trail.center:trail.segments?geometry[0][0]:geometry[0]}
function hasVerifiedMapLocation(trail){return ["official","mapped","trailhead"].includes(trail.precision)}
function isOffroadTrail(trail){const uses=new Set(trail.types||[trail.type]);return uses.has("skidoo")||uses.has("atv")}
function trailColor(trail){const uses=new Set(trail.types||[trail.type]);return uses.has("skidoo")&&uses.has("atv")?colors.multiuse:uses.has("skidoo")?colors.skidoo:uses.has("atv")?colors.atv:colors[trail.type]}
function escapeHTML(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
function distanceKm(a,b){const r=6371,rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad,x=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function distanceToTrail(trail,point){const points=trailPoints(trail);return Math.min(...points.map(routePoint=>distanceKm(routePoint,point)))}
function poiKind(poi){return poi.category==="WarmupShelter"?"shelter":"service"}
function poiLabel(category){return({WarmupShelter:"Warm-up shack",Fuel:"Fuel",Caution:"Trail caution",Lookout:"Lookout",Parking:"Parking",Restaurant:"Food",information:"Information",Accomodation:"Accommodation",Shipwreck:"Historic shipwreck"})[category]||"Point of interest"}
function nearbyPois(trail){return TRAIL_POIS.map(poi=>({...poi,distance:distanceToTrail(trail,poi.center)})).filter(poi=>poi.category==="WarmupShelter"?poi.distance<=2:poi.distance<=(trail.type==="walking"?12:30)).sort((a,b)=>a.distance-b.distance).slice(0,8)}
function renderPois(){poiLayer.clearLayers();const focused=state.focusedTrail?trails.find(trail=>trail.id===state.focusedTrail):null;TRAIL_POIS.forEach(poi=>{const kind=poiKind(poi);if(!state.activePois.has(kind)||kind==="shelter"&&(!focused||distanceToTrail(focused,poi.center)>2))return;const symbol=kind==="shelter"?"⌂":poi.category==="Fuel"?"⛽":poi.category==="Caution"?"!":"•";const icon=L.divIcon({className:"poi-div-icon",html:`<span class="poi-pin ${kind} ${poi.category.toLowerCase()}">${symbol}</span>`,iconSize:[26,26],iconAnchor:[13,13]});L.marker(poi.center,{icon,title:poi.name}).bindPopup(`<div class="poi-popup"><small>${poiLabel(poi.category)}</small><b>${escapeHTML(poi.name)}</b>${poi.comment?`<p>${escapeHTML(poi.comment)}</p>`:""}${poi.address?`<span>${escapeHTML(poi.address)}</span>`:""}</div>`).addTo(poiLayer)});document.querySelectorAll("[data-poi]").forEach(button=>{const active=state.activePois.has(button.dataset.poi);button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));if(button.dataset.poi==="shelter"){button.classList.toggle("context-disabled",!focused);button.title=focused?"Show warm-up shacks on this trail":"Select a trail to see its warm-up shacks"}})}

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
  return L.divIcon({className:`akidoo-div-icon${selected?" is-selected":""}`,html:`<span class="map-pin${compact?" compact":""}" style="--pin-color:${trailColor(trail)}"><i></i></span>`,iconSize:compact?[24,24]:[34,34],iconAnchor:compact?[12,24]:[17,34],tooltipAnchor:[14,-14]});
}

function updateLayerButtons(){
  document.querySelectorAll(".mode").forEach(button=>{const mode=button.dataset.mode;const active=mode==="all"?state.activeTypes.size===allTypes.length:state.activeTypes.has(mode);button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  document.querySelector("#filterCount").textContent=state.activeTypes.size;
}

function updateMap(items,fit=false){
  trailLayer.clearLayers();
  const focused=state.focusedTrail?trails.find(t=>t.id===state.focusedTrail):null,offroad=state.experience==="offroad",visible=offroad?[...items.filter(isOffroadTrail)].sort((a,b)=>(a.id===focused?.id)-(b.id===focused?.id)):focused?[focused]:items;
  visible.forEach(t=>{
    const geometry=trailGeometry(t);
    if((offroad||focused)&&geometry?.length&&(offroad||["official","mapped"].includes(t.precision))){
      const selected=focused?.id===t.id,verified=["official","mapped"].includes(t.precision),style={weight:selected?7:verified?4:2.5,opacity:selected?0.98:verified?0.78:0.48,lineCap:"round",dashArray:verified?null:"7 7"};
      if(t.segmentStyles&&t.segments)t.segments.forEach((segment,index)=>L.polyline(segment,{...style,color:t.segmentStyles[index]==="shared"?colors.multiuse:colors.skidoo}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer));
      else L.polyline(geometry,{...style,color:trailColor(t)}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
    }
    if(hasVerifiedMapLocation(t))L.marker(trailStart(t),{icon:pinIcon(t,state.selected===t.id),title:`Start: ${t.name}`,alt:`Open ${t.name}`}).bindTooltip(`${focused?"Start · ":""}${t.name}`,{direction:"right",className:"akidoo-tooltip",offset:[8,-15]}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
  });
  document.querySelector("#clearFocus").hidden=!focused;
  document.querySelector("#mapLegend").innerHTML=offroad?`<span><i class="route-key atv-route"></i> ATV</span><span><i class="route-key snow-route"></i> Skidoo</span><span><i class="route-key shared-route"></i> ATV + skidoo</span><span><i class="route-key planning-route"></i> Planning-scale</span>`:focused?(focused.segmentStyles?`<span><i class="route-key shared-route"></i> ATV + skidoo to 4 Way</span><span><i class="route-key snow-route"></i> Skidoo only beyond</span>`:`<span><i class="route-key" style="--route-color:${trailColor(focused)}"></i>${escapeHTML(focused.name)}</span>`):`<span><i class="walk-dot"></i> Walking</span><span><i class="ski-dot"></i> Skidoo</span><span><i class="atv-dot"></i> ATV</span><span><i class="shared-dot"></i> Multi-use</span>`;
  if(focused){const points=trailPoints(focused);map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});}
  else if(fit&&items.length){const points=items.filter(hasVerifiedMapLocation).map(trailStart);if(points.length)map.fitBounds(L.latLngBounds(points).pad(.18),{animate:true,maxZoom:9});}
}

function render(fitMap=false){
  const items=filtered();count.textContent=`${items.length} route${items.length===1?"":"s"}`;
  list.innerHTML=items.length?items.map(t=>`<article class="trail-card ${state.selected===t.id?"active":""}" data-id="${t.id}" tabindex="0"><div class="card-top"><span class="trail-type ${t.type} ${t.badge?.toLowerCase().replaceAll(" ","-")||""}">${t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase())}</span>${t.rating?`<span class="card-rating">★ ${t.rating}</span>`:""}<button class="save-btn ${state.saved.has(t.id)?"saved":""}" data-save="${t.id}" aria-label="${state.saved.has(t.id)?"Remove from":"Save to"} saved">${state.saved.has(t.id)?"♥":"♡"}</button></div><h3>${t.name}</h3><span class="region">${t.region}</span><div class="card-stats"><span>↔ <b>${t.distance}</b></span><span>◇ <b>${t.difficulty}</b></span>${t.elevation?`<span>↗ <b>${t.elevation}</b></span>`:""}<span class="condition">${t.condition}</span></div></article>`).join(""):`<div class="empty"><b>No trails found</b><p>Turn on a layer or try another search.</p></div>`;
  updateLayerButtons();updateMap(items,fitMap);renderPois();
}

function selectTrail(id,open=false){const t=trails.find(x=>x.id===id);state.selected=id;state.focusedTrail=hasVerifiedMapLocation(t)?id:null;render(false);if(open)openDetail(id)}
function toggleSave(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);localStorage.setItem("nl-trails-saved",JSON.stringify([...state.saved]));render(false);showToast(state.saved.has(id)?"Trail saved for later":"Removed from saved trails")}
function setDetailTab(name){document.querySelectorAll("[data-detail-tab]").forEach(x=>x.classList.toggle("active",x.dataset.detailTab===name));document.querySelectorAll("[data-detail-panel]").forEach(x=>x.classList.toggle("active",x.dataset.detailPanel===name))}
function openDetail(id){const t=trails.find(x=>x.id===id),nearby=nearbyPois(t),rating=document.querySelector("#detailRating"),directions=document.querySelector("#trailDirections");state.selected=id;document.querySelector("#detailVisual").className=`detail-visual ${t.type}`;document.querySelector("#detailType").textContent=t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase());document.querySelector("#detailRegion").textContent=t.region;document.querySelector("#modalTitle").textContent=t.name;document.querySelector("#detailDescription").textContent=t.notes?`${t.description} ${t.notes}`:t.description;document.querySelector("#detailDistance").textContent=t.distance;document.querySelector("#detailDifficulty").textContent=t.difficulty;document.querySelector("#detailTime").textContent=t.time;document.querySelector("#detailElevation").textContent=t.elevation||"Not listed";document.querySelector("#detailRouteType").textContent=t.routeType||((t.types||[]).length?"Multi-use route":"Route details pending");document.querySelector("#detailMapStatus").textContent=t.precision==="mapped"?"Mapped route":t.precision==="trailhead"?"Verified trailhead":"Location awaiting verification";document.querySelector("#detailUse").textContent=t.useLabel||(t.types||[t.type]).map(x=>x==="skidoo"?"Skidoo":x==="atv"?"ATV":"Walking").join(" · ");document.querySelector("#detailAccess").textContent=t.access||"Check locally before travel";document.querySelector("#detailCondition").textContent=t.condition;document.querySelector("#detailFeatures").innerHTML=(t.features||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join("");rating.hidden=!t.rating;rating.innerHTML=t.rating?`<b>★ ${escapeHTML(t.rating)}</b><span>${escapeHTML(t.ratingCount||"")} ${escapeHTML(t.ratingLabel||"")}</span>`:"";const links=[];if(t.allTrailsUrl)links.push(`<a href="${t.allTrailsUrl}" target="_blank" rel="noopener">AllTrails listing ↗</a>`);if(t.source)links.push(`<a href="${t.source}" target="_blank" rel="noopener">Official information ↗</a>`);document.querySelector("#detailLinks").innerHTML=links.join("");document.querySelector("#nearbyCount").textContent=nearby.length;document.querySelector("#nearbyList").innerHTML=nearby.length?nearby.map(p=>`<button data-poi-lat="${p.center[0]}" data-poi-lon="${p.center[1]}"><span class="nearby-icon ${poiKind(p)}">${poiKind(p)==="shelter"?"⌂":"＋"}</span><span><b>${escapeHTML(p.name)}</b><small>${poiLabel(p.category)} · ${p.distance.toFixed(1)} km away</small></span><i>›</i></button>`).join(""):`<div class="nearby-empty">No mapped facilities within ${t.type==="walking"?12:30} km.</div>`;directions.hidden=!hasVerifiedMapLocation(t);if(!directions.hidden){const start=trailStart(t);directions.href=`https://www.google.com/maps/dir/?api=1&destination=${start[0]},${start[1]}`};document.querySelector("#modalSave").textContent=state.saved.has(id)?"♥":"♡";setDetailTab("overview");modal.hidden=false;document.body.style.overflow="hidden";document.querySelector(".close-btn").focus()}
function closeDetail(){modal.hidden=true;document.body.style.overflow=""}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}
function openExperience(mode,updateHash=true){const walking=mode==="walking",offroad=mode==="offroad";state.experience=mode;state.activeTypes=new Set(walking?["walking"]:offroad?["skidoo","atv"]:allTypes);state.focusedTrail=null;state.query="";document.querySelector("#searchInput").value="";document.body.classList.remove("home-active");document.querySelector("#homePage").hidden=true;document.querySelector("#trailPage").hidden=false;document.querySelector("#experienceEyebrow").textContent=walking?"EXPLORE NEWFOUNDLAND ON FOOT":offroad?"RIDE NEWFOUNDLAND":"EXPLORE EVERY TRAIL";document.querySelector("#experienceTitle").innerHTML=walking?"Find a trail.<br><em>Follow the coast.</em>":offroad?"Find your route.<br><em>Ride farther.</em>":"Find your way<br><em>into the wild.</em>";document.querySelector("#experienceIntro").textContent=walking?"Walking trails with mapped routes, elevation, difficulty, and trailhead details.":offroad?"ATV and skidoo routes stay visible by activity: green for ATV, blue for skidoo, and purple for shared use.":"Walking paths, skidoo routes, and ATV trails across Newfoundland—mapped for the way you move.";render(true);setTimeout(()=>map.invalidateSize(),50);if(updateHash)history.pushState(null,"",`#${mode}`)}
function openHome(updateHash=true){closeDetail();document.body.classList.add("home-active");document.querySelector("#trailPage").hidden=true;document.querySelector("#homePage").hidden=false;if(updateHash)history.pushState(null,"","#home");window.scrollTo({top:0,behavior:"smooth"})}

document.querySelectorAll(".mode").forEach(btn=>btn.addEventListener("click",()=>{const mode=btn.dataset.mode;state.focusedTrail=null;if(mode==="all"){state.activeTypes=new Set(allTypes)}else{state.activeTypes.has(mode)?state.activeTypes.delete(mode):state.activeTypes.add(mode)}render(true)}));
document.querySelectorAll("[data-basemap]").forEach(btn=>btn.addEventListener("click",()=>setBasemap(btn.dataset.basemap)));
document.querySelectorAll("[data-poi]").forEach(btn=>btn.addEventListener("click",()=>{state.activePois.has(btn.dataset.poi)?state.activePois.delete(btn.dataset.poi):state.activePois.add(btn.dataset.poi);renderPois()}));
document.querySelectorAll("[data-experience]").forEach(button=>button.addEventListener("click",()=>openExperience(button.dataset.experience)));
document.querySelector("#brandHome").addEventListener("click",event=>{event.preventDefault();openHome()});
document.querySelector("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();state.focusedTrail=null;render(true)});
list.addEventListener("click",e=>{const save=e.target.closest("[data-save]");if(save){e.stopPropagation();toggleSave(Number(save.dataset.save));return}const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)});
list.addEventListener("keydown",e=>{if(e.key==="Enter"){const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)}});
document.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",closeDetail));document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeDetail()});
document.querySelectorAll("[data-detail-tab]").forEach(button=>button.addEventListener("click",()=>setDetailTab(button.dataset.detailTab)));
document.querySelector("#nearbyList").addEventListener("click",event=>{const button=event.target.closest("[data-poi-lat]");if(!button)return;closeDetail();state.activePois.add("shelter");state.activePois.add("service");renderPois();map.flyTo([Number(button.dataset.poiLat),Number(button.dataset.poiLon)],13,{duration:.6})});
document.querySelector("#clearFocus").addEventListener("click",()=>{state.focusedTrail=null;render(true)});
document.querySelector("#modalSave").addEventListener("click",()=>{toggleSave(state.selected);document.querySelector("#modalSave").textContent=state.saved.has(state.selected)?"♥":"♡"});
document.querySelector("#startRoute").addEventListener("click",()=>{const trail=trails.find(t=>t.id===state.selected),points=trailPoints(trail);closeDetail();document.querySelector("#explorer").scrollIntoView();state.focusedTrail=hasVerifiedMapLocation(trail)?trail.id:null;render(false);if(points.length>1)map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});else if(hasVerifiedMapLocation(trail))map.flyTo(trailStart(trail),trail.precision==="trailhead"?14:11);showToast(points.length>1?"Showing only this trail":trail.precision==="trailhead"?"Showing the verified trailhead · route line pending":"Route location is awaiting verification")});
document.querySelector("#filterBtn").addEventListener("click",()=>{state.activeTypes=new Set(allTypes);render(true);showToast("All three trail layers are visible")});
document.querySelector("#sortBtn").addEventListener("click",e=>{const options=["Nearby","Distance","Difficulty"];state.sort=options[(options.indexOf(state.sort)+1)%options.length];e.currentTarget.firstChild.textContent=state.sort+" ";render(false)});
document.querySelector("#zoomIn").addEventListener("click",e=>{e.stopPropagation();map.zoomIn()});document.querySelector("#zoomOut").addEventListener("click",e=>{e.stopPropagation();map.zoomOut()});
document.querySelector("#locateMe").addEventListener("click",e=>{e.stopPropagation();if(!navigator.geolocation){showToast("Location is not available in this browser");return}showToast("Finding your location…");navigator.geolocation.getCurrentPosition(pos=>{const here=[pos.coords.latitude,pos.coords.longitude];if(locationLayer)map.removeLayer(locationLayer);locationLayer=L.marker(here,{icon:L.divIcon({className:"",html:'<span class="location-pulse"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).bindTooltip("You are here").addTo(map);map.flyTo(here,10);showToast("Location found")},()=>showToast("We couldn’t access your location"),{enableHighAccuracy:true,timeout:8000})});
document.querySelectorAll(".nav-link,.mobile-nav button").forEach(btn=>btn.addEventListener("click",()=>{if(document.querySelector("#trailPage").hidden)openExperience("all");document.querySelectorAll(`.nav-link[data-section="${btn.dataset.section}"],.mobile-nav button[data-section="${btn.dataset.section}"]`).forEach(x=>{x.parentElement.querySelectorAll("button").forEach(y=>y.classList.remove("active"));x.classList.add("active")});if(btn.dataset.section==="safety")document.querySelector("#safety").scrollIntoView();else if(btn.dataset.section==="saved"){state.query="";document.querySelector("#searchInput").value="";showToast(`${state.saved.size} saved trail${state.saved.size===1?"":"s"}`);render(false)}else document.querySelector("#explorer").scrollIntoView()}));
document.querySelector("#safetyBtn").addEventListener("click",()=>showToast("Always check official advisories before heading out"));document.querySelector("#profileBtn").addEventListener("click",()=>showToast("Guest explorer · your saves stay on this device"));
renderPois();render(false);if(["#walking","#offroad","#all"].includes(location.hash))openExperience(location.hash.slice(1),false);else openHome(false);window.addEventListener("popstate",()=>{if(["#walking","#offroad","#all"].includes(location.hash))openExperience(location.hash.slice(1),false);else openHome(false)});
