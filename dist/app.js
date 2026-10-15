const mappedByName=new Map(OSM_ROUTE_TRAILS.map(trail=>[trail.name,trail]));
const featuredGeometry={1:"Green Gardens Trail",2:"Gros Morne Mountain Trail"};
const routeCards=OSM_ROUTE_TRAILS.filter(trail=>!["Green Gardens Trail","Gros Morne Mountain Trail"].includes(trail.name));
const northernCards=NORTHERN_TRAILS.filter(trail=>trail.id!==20101);
const trails=[...TRAILS,...GNTA_TRAILS,...northernCards,...routeCards,...ADDED_TRAILS,...COMMUNITY_ATV_TRAILS,...FLOWERS_COVE_TRAILS,...EXPANDED_WALKING_TRAILS,...DRIVING_DESTINATIONS].map(trail=>{
  let result=trail;
  if(trail.id===11350)result={...trail,region:"Route 430, south of St. Anthony · GNTA",center:[51.4389,-55.6429],precision:"trailhead",condition:"Verified trailhead area · route pending",description:"A short, unmaintained out-and-back to Triple Falls and a local swimming hole. The trailhead area is just north and opposite Triple Falls RV Park on Route 430. The pin marks the verified roadside access area; a route line will only be added once its geometry is verified."};
  const mapped=GNTA_MAPPED[trail.id];
  if(mapped)result={...result,...mapped,precision:"mapped",condition:"Mapped trail line"};
  const featured=mappedByName.get(featuredGeometry[trail.id]);
  if(featured)result={...result,center:featured.center,segments:featured.segments,precision:"mapped",condition:"Mapped trail line"};
  return {...result,...(TRAIL_INFO[trail.id]||{})};
});
const bigBrookTrail=trails.find(trail=>trail.id===42001);
if(bigBrookTrail)Object.assign(bigBrookTrail,{type:"multiuse",types:["atv","skidoo"],badge:"UNMAINTAINED · ATV + SKIDOO",maintenance:"unmaintained",condition:"Community-reported · unmaintained ATV and Skidoo route",useLabel:"ATV · Skidoo (unmaintained)",features:["Unmaintained route","Gravel road","Major water crossing","Coastal history"],notes:"Community-reported unmaintained route. The main Big Brook crossing near the former community must be assessed on site; never enter fast or deep water. Winter grooming is not reported."});

const allTypes=["walking","skidoo","atv","driving"];
const state={activeTypes:new Set(allTypes),activePois:new Set(["shelter"]),experience:"all",focusedTrail:null,query:"",saved:new Set(JSON.parse(localStorage.getItem("nl-trails-saved")||localStorage.getItem("akidoo-saved")||"[]")),selected:1,sort:"Nearby",basemap:"street",reviews:JSON.parse(localStorage.getItem("nl-trails-reviews")||"{}"),fixes:JSON.parse(localStorage.getItem("nl-trails-fixes")||"[]"),trips:JSON.parse(localStorage.getItem("nl-trails-trips")||"[]")};
const list=document.querySelector("#trailList"),count=document.querySelector("#resultCount"),modal=document.querySelector("#detailModal"),toast=document.querySelector("#toast");
const colors={walking:"#ed6f32",skidoo:"#4b8eaa",atv:"#788935",multiuse:"#76518d",driving:"#bd762f"};
const ALL_POIS=[...TRAIL_POIS,...COMMUNITY_ATV_POIS];
const bigBrookCrossing=ALL_POIS.find(poi=>poi.id===900002);
if(bigBrookCrossing)Object.assign(bigBrookCrossing,{center:[51.52014,-56.15264],address:"Big Brook Road · near the resettled Big Brook community",comment:"Major water crossing on Big Brook Road beside the former Big Brook community. This is the main crossing of concern; depth and current can change, so assess conditions before attempting it."});

const map=L.map("trailMap",{zoomControl:false,minZoom:5,maxZoom:17,zoomSnap:.5,preferCanvas:true}).setView([48.72,-56.05],6);
const streetLayer=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
const satelliteLayer=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics'});
const trailLayer=L.layerGroup().addTo(map);
const poiLayer=L.layerGroup().addTo(map);
const recordingLayer=L.layerGroup().addTo(map);
const pointClusterLayer=L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:52,disableClusteringAtZoom:13,iconCreateFunction:cluster=>L.divIcon({html:`<span>${cluster.getChildCount()}</span>`,className:"nl-marker-cluster",iconSize:[42,42]})}):L.layerGroup();
pointClusterLayer.addTo(map);
let locationLayer=null;
map.attributionControl.addAttribution('Trail geometry &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
map.attributionControl.addAttribution('<a href="https://www.google.com/maps/d/viewer?mid=1UieuRO3cdNkwrAmmxpmh_cMJ4ow" target="_blank" rel="noopener">Community ATV planning map</a>');

function decodePolyline(encoded){
  const value=encoded.slice(1),points=[];let index=0,lat=0,lng=0;
  while(index<value.length){
    let byte,shift=0,result=0;do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5}while(byte>=32);lat+=(result&1)?~(result>>1):(result>>1);
    shift=0;result=0;do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5}while(byte>=32);lng+=(result&1)?~(result>>1):(result>>1);
    points.push([lat/1e5,lng/1e5]);
  }
  return points;
}
const nlsfGroomed=NLSF_SEGMENTS.filter(x=>x.c==="F").map(x=>({name:x.n||"NLSF groomed trail section",points:decodePolyline(x.e)}));
const nlsfUnmaintained=NLSF_SEGMENTS.filter(x=>x.c!=="F").map(x=>({name:x.n||"NLSF unmaintained trail section",points:decodePolyline(x.e)}));

function trailGeometry(trail){return trail.segments||trail.route||null}
function trailPoints(trail){const geometry=trailGeometry(trail);return geometry?(trail.segments?geometry.flat():geometry):[trail.center]}
function trailStart(trail){const geometry=trailGeometry(trail);return trail.precision==="trailhead"||!geometry?.length?trail.center:trail.segments?geometry[0][0]:geometry[0]}
function hasVerifiedMapLocation(trail){return ["official","mapped","trailhead","community"].includes(trail.precision)}
function isOffroadTrail(trail){const uses=new Set(trail.types||[trail.type]);return uses.has("skidoo")||uses.has("atv")}
function trailColor(trail){const uses=new Set(trail.types||[trail.type]);return uses.has("skidoo")&&uses.has("atv")?colors.multiuse:uses.has("skidoo")?colors.skidoo:uses.has("atv")?colors.atv:colors[trail.type]}
function escapeHTML(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
function distanceKm(a,b){const r=6371,rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad,x=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function distanceToTrail(trail,point){const points=trailPoints(trail);return Math.min(...points.map(routePoint=>distanceKm(routePoint,point)))}
function poiKind(poi){return poi.category==="WarmupShelter"?"shelter":"service"}
function poiLabel(category){return({WarmupShelter:"Warm-up shack",Fuel:"Fuel",Caution:"Trail caution",Lookout:"Lookout",Parking:"Parking",Restaurant:"Food",Campground:"Camping",Attraction:"Attraction",information:"Information",Accomodation:"Accommodation",Shipwreck:"Historic shipwreck"})[category]||"Point of interest"}
function nearbyPois(trail){return ALL_POIS.filter(poi=>!poi.sourceScope||trail.type==="atv"||(trail.types||[]).includes("atv")).map(poi=>({...poi,distance:distanceToTrail(trail,poi.center)})).filter(poi=>poi.category==="WarmupShelter"?poi.distance<=2:poi.distance<=(trail.type==="walking"?12:30)).sort((a,b)=>a.distance-b.distance).slice(0,12)}
function renderPois(){poiLayer.clearLayers();const snowEnabled=state.activeTypes.has("skidoo"),atvEnabled=state.activeTypes.has("atv"),focused=state.focusedTrail?trails.find(trail=>trail.id===state.focusedTrail):null,poiRadius=focused?.type==="walking"?12:30;ALL_POIS.forEach(poi=>{const kind=poiKind(poi);if(!state.activePois.has(kind)||kind==="shelter"&&!snowEnabled||kind==="service"&&(!focused||distanceToTrail(focused,poi.center)>poiRadius)||poi.sourceScope==="atv"&&!atvEnabled)return;const symbol=kind==="shelter"?"⌂":poi.category==="Fuel"?"⛽":poi.category==="Caution"?"!":"•",size=kind==="shelter"?20:26;const icon=L.divIcon({className:"poi-div-icon",html:`<span class="poi-pin ${kind} ${poi.category.toLowerCase()}">${symbol}</span>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});L.marker(poi.center,{icon,title:poi.name}).bindPopup(`<div class="poi-popup"><small>${poiLabel(poi.category)}</small><b>${escapeHTML(poi.name)}</b>${poi.comment?`<p>${escapeHTML(poi.comment)}</p>`:""}${poi.address?`<span>${escapeHTML(poi.address)}</span>`:""}</div>`).addTo(poiLayer)});document.querySelectorAll("[data-poi]").forEach(button=>{const active=state.activePois.has(button.dataset.poi);button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));if(button.dataset.poi==="shelter"){button.classList.toggle("context-disabled",!snowEnabled);button.title=snowEnabled?"Show warm-up shacks":"Enable Skidoo to see warm-up shacks"}else{button.classList.toggle("context-disabled",!focused);button.title=focused?"Show POIs near this trail":"Select a trail to see relevant POIs"}})}

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
  pointClusterLayer.clearLayers();
  const focused=state.focusedTrail?trails.find(t=>t.id===state.focusedTrail):null,showOffroadNetwork=state.activeTypes.has("skidoo")||state.activeTypes.has("atv"),visible=focused?[...items.filter(t=>isOffroadTrail(t)||t.id===focused.id)].sort((a,b)=>(a.id===focused.id)-(b.id===focused.id)):items;
  if(state.activeTypes.has("skidoo")){
    nlsfGroomed.forEach(section=>L.polyline(section.points,{color:colors.skidoo,weight:3,opacity:.55,lineCap:"round"}).bindTooltip(escapeHTML(section.name),{sticky:true,className:"akidoo-tooltip"}).bindPopup(`<div class="poi-popup"><small>GROOMED SNOWMOBILE TRAIL</small><b>${escapeHTML(section.name)}</b><p>Static NLSF map section. Check current grooming, access, and trail-pass requirements before riding.</p></div>`).addTo(trailLayer));
    nlsfUnmaintained.forEach(section=>L.polyline(section.points,{color:colors.skidoo,weight:2,opacity:.4,lineCap:"round",dashArray:"6 7"}).bindTooltip(escapeHTML(section.name),{sticky:true,className:"akidoo-tooltip"}).bindPopup(`<div class="poi-popup"><small>UNMAINTAINED SNOWMOBILE TRAIL</small><b>${escapeHTML(section.name)}</b><p>Static mapped section. Conditions and access are not verified; plan and assess locally before riding.</p></div>`).addTo(trailLayer));
  }
  visible.forEach(t=>{
    const geometry=trailGeometry(t);
    const showRoute=isOffroadTrail(t)&&showOffroadNetwork||focused?.id===t.id;
    if(showRoute&&geometry?.length&&(isOffroadTrail(t)||["official","mapped"].includes(t.precision))){
      const selected=focused?.id===t.id,verified=["official","mapped"].includes(t.precision),unmaintained=t.maintenance==="unmaintained",style={weight:selected?7:verified?4:2.5,opacity:selected?0.98:verified?0.78:0.48,lineCap:"round",dashArray:unmaintained||!verified?"7 7":null};
      if(t.segmentStyles&&t.segments)t.segments.forEach((segment,index)=>L.polyline(segment,{...style,color:t.segmentStyles[index]==="shared"?colors.multiuse:colors.skidoo}).bindTooltip(escapeHTML(t.name),{sticky:true,className:"akidoo-tooltip"}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer));
      else L.polyline(geometry,{...style,color:trailColor(t)}).bindTooltip(escapeHTML(t.name),{sticky:true,className:"akidoo-tooltip"}).on("click",()=>selectTrail(t.id,true)).addTo(trailLayer);
    }
    if(hasVerifiedMapLocation(t)&&!isOffroadTrail(t)&&(t.precision!=="community"||focused?.id===t.id)){
      const marker=L.circleMarker(trailStart(t),{radius:focused?.id===t.id?7:5,color:"#fff",weight:focused?.id===t.id?3:2,fillColor:trailColor(t),fillOpacity:.96}).bindTooltip(escapeHTML(t.name),{direction:"top",className:"akidoo-tooltip"}).on("click",()=>selectTrail(t.id,true));
      if(focused?.id===t.id)marker.addTo(trailLayer);else pointClusterLayer.addLayer(marker);
    }
  });
  document.querySelector("#clearFocus").hidden=!focused;
  const drivingOnly=state.activeTypes.size===1&&state.activeTypes.has("driving");
  document.querySelector("#mapLegend").innerHTML=showOffroadNetwork?`<span><i class="route-key atv-route"></i> ATV</span><span><i class="route-key snow-route"></i> Groomed Skidoo</span><span><i class="route-key snow-unmaintained-route"></i> Unmaintained Skidoo</span><span><i class="route-key shared-route"></i> ATV + Skidoo</span><span><i class="route-key planning-route"></i> Hover or tap a section</span>`:drivingOnly?`<span><i class="driving-dot"></i> Tourist destination</span><span>Numbered circles group nearby stops</span>`:focused?(focused.segmentStyles?`<span><i class="route-key shared-route"></i> ATV + skidoo to 4 Way</span><span><i class="route-key snow-route"></i> Skidoo only beyond</span>`:`<span><i class="route-key" style="--route-color:${trailColor(focused)}"></i>${escapeHTML(focused.name)}</span>`):`<span><i class="walk-dot"></i> Walking trail</span><span>Numbered circles group nearby starts</span>`;
  if(focused){const points=trailPoints(focused);map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});}
  else if(fit&&items.length){const points=items.filter(hasVerifiedMapLocation).map(trailStart);if(points.length)map.fitBounds(L.latLngBounds(points).pad(.18),{animate:true,maxZoom:9});}
}

function render(fitMap=false){
  const items=filtered(),noun=state.activeTypes.size===1&&state.activeTypes.has("driving")?"destination":"route";count.textContent=`${items.length} ${noun}${items.length===1?"":"s"}`;
  list.innerHTML=items.length?items.map(t=>`<article class="trail-card ${state.selected===t.id?"active":""}" data-id="${t.id}" tabindex="0"><div class="card-top"><span class="trail-type ${t.type} ${t.badge?.toLowerCase().replaceAll(" ","-")||""}">${t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase())}</span>${t.rating?`<span class="card-rating">★ ${t.rating}</span>`:""}<button class="save-btn ${state.saved.has(t.id)?"saved":""}" data-save="${t.id}" aria-label="${state.saved.has(t.id)?"Remove from":"Save to"} saved">${state.saved.has(t.id)?"♥":"♡"}</button></div><h3>${t.name}</h3><span class="region">${t.region}</span><div class="card-stats"><span>↔ <b>${t.distance}</b></span><span>◇ <b>${t.difficulty}</b></span>${t.elevation?`<span>↗ <b>${t.elevation}</b></span>`:""}<span class="condition">${t.condition}</span></div></article>`).join(""):`<div class="empty"><b>No trails found</b><p>Turn on a layer or try another search.</p></div>`;
  updateLayerButtons();updateMap(items,fitMap);renderPois();
}

function selectTrail(id,open=false){const t=trails.find(x=>x.id===id);state.selected=id;state.focusedTrail=hasVerifiedMapLocation(t)?id:null;if(state.focusedTrail&&t.type!=="driving")state.activePois.add("service");render(false);if(open)openDetail(id)}
function toggleSave(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);localStorage.setItem("nl-trails-saved",JSON.stringify([...state.saved]));render(false);showToast(state.saved.has(id)?"Trail saved for later":"Removed from saved trails")}
function setDetailTab(name){document.querySelectorAll("[data-detail-tab]").forEach(x=>x.classList.toggle("active",x.dataset.detailTab===name));document.querySelectorAll("[data-detail-panel]").forEach(x=>x.classList.toggle("active",x.dataset.detailPanel===name))}
function renderReviews(trailId){const reviews=state.reviews[trailId]||[];document.querySelector("#reviewCount").textContent=reviews.length;document.querySelector("#reviewList").innerHTML=reviews.length?reviews.slice().reverse().map(review=>`<article class="review-card"><span class="stars">${"★".repeat(review.rating)}${"☆".repeat(5-review.rating)}</span><time>${new Date(review.timestamp).toLocaleDateString()}</time><p>${escapeHTML(review.text)}</p>${review.photo?`<img src="${review.photo}" alt="Photo submitted with trail review" />`:""}<small>Community submitted · ${review.status}</small></article>`).join(""):`<div class="review-empty"><b>No local reviews yet.</b><br />Be the first to share current trail knowledge.</div>`}
function openDetail(id){
  const t=trails.find(x=>x.id===id),nearby=t.type==="driving"?[]:nearbyPois(t),rating=document.querySelector("#detailRating"),directions=document.querySelector("#trailDirections"),preview=document.querySelector("#startPreview"),routeButton=document.querySelector("#startRoute");state.selected=id;
  document.querySelector("#detailVisual").className=`detail-visual ${t.type}`;document.querySelector("#detailType").textContent=t.badge||(t.type==="multiuse"?"MULTI-USE":t.type.toUpperCase());document.querySelector("#detailRegion").textContent=t.region;document.querySelector("#modalTitle").textContent=t.name;document.querySelector("#detailDescription").textContent=t.notes?`${t.description} ${t.notes}`:t.description;document.querySelector("#detailDistance").textContent=t.distance;document.querySelector("#detailDifficulty").textContent=t.difficulty;document.querySelector("#detailTime").textContent=t.time;document.querySelector("#detailElevation").textContent=t.elevation||"Not listed";document.querySelector("#detailRouteType").textContent=t.routeType||((t.types||[]).length?"Multi-use route":"Route details pending");document.querySelector("#detailMapStatus").textContent=t.type==="driving"?"Mapped destination":t.maintenance==="unmaintained"?"Mapped · unmaintained":t.precision==="community"?"Community planning line":t.precision==="mapped"?"Mapped route":t.precision==="trailhead"?"Verified trailhead":"Location awaiting verification";document.querySelector("#detailUse").textContent=t.useLabel||(t.types||[t.type]).map(x=>x==="skidoo"?"Skidoo":x==="atv"?"ATV":x==="driving"?"Driving stop":"Walking").join(" · ");document.querySelector("#detailAccess").textContent=t.access||"Check locally before travel";document.querySelector("#detailCondition").textContent=t.condition;document.querySelector("#detailFeatures").innerHTML=(t.features||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join("");
  preview.hidden=t.type==="driving";routeButton.innerHTML=t.type==="driving"?'Show destination on map <span>⌖</span>':'Show trail on map <span>⌖</span>';
  rating.hidden=!t.rating;rating.innerHTML=t.rating?`<b>★ ${escapeHTML(t.rating)}</b><span>${escapeHTML(t.ratingCount||"")} ${escapeHTML(t.ratingLabel||"")}</span>`:"";const links=[];if(t.allTrailsUrl)links.push(`<a href="${t.allTrailsUrl}" target="_blank" rel="noopener">AllTrails listing ↗</a>`);if(t.website)links.push(`<a href="${t.website}" target="_blank" rel="noopener">Destination website ↗</a>`);if(t.source)links.push(`<a href="${t.source}" target="_blank" rel="noopener">${escapeHTML(t.sourceLabel||"Trail information")} ↗</a>`);document.querySelector("#detailLinks").innerHTML=links.join("");
  document.querySelector("#nearbyCount").textContent=nearby.length;document.querySelector("#nearbyList").innerHTML=nearby.length?nearby.map(p=>`<button data-poi-lat="${p.center[0]}" data-poi-lon="${p.center[1]}"><span class="nearby-icon ${poiKind(p)}">${poiKind(p)==="shelter"?"⌂":"＋"}</span><span><b>${escapeHTML(p.name)}</b><small>${poiLabel(p.category)} · ${p.distance.toFixed(1)} km away</small></span><i>›</i></button>`).join(""):`<div class="nearby-empty">No mapped facilities within ${t.type==="walking"?12:30} km.</div>`;
  directions.hidden=!hasVerifiedMapLocation(t);if(!directions.hidden){const start=trailStart(t);directions.href=`https://www.google.com/maps/dir/?api=1&destination=${start[0]},${start[1]}`};document.querySelector("#modalSave").textContent=state.saved.has(id)?"♥":"♡";document.querySelector("#fixForm").hidden=true;document.querySelector("#reviewForm").reset();renderReviews(id);setDetailTab("overview");modal.hidden=false;document.body.style.overflow="hidden";document.querySelector(".close-btn").focus()
}

function readPhoto(file){return new Promise((resolve,reject)=>{if(!file){resolve("");return}if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){reject(new Error("Use a JPG, PNG, WebP, or GIF photo"));return}if(file.size>2500000){reject(new Error("Photo must be under 2.5 MB"));return}const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Photo could not be read"));reader.readAsDataURL(file)})}
async function submitReview(event){event.preventDefault();const rating=Number(document.querySelector("#reviewRating").value),text=document.querySelector("#reviewText").value.trim(),file=document.querySelector("#reviewPhoto").files[0];if(!rating||!text)return;try{const photo=await readPhoto(file),key=String(state.selected);state.reviews[key]=[...(state.reviews[key]||[]),{rating,text,photo,timestamp:new Date().toISOString(),status:"moderation draft"}];localStorage.setItem("nl-trails-reviews",JSON.stringify(state.reviews));event.currentTarget.reset();renderReviews(state.selected);showToast("Review draft saved on this device")}catch(error){showToast(error.message)}}

let trackingWatch=null,trackingTimer=null,trackingStarted=0,trackPoints=[],trackLine=null,trackingTrail=null;
function tripDistance(){return trackPoints.slice(1).reduce((total,point,index)=>total+distanceKm(trackPoints[index],point),0)}
function updateTripStats(){const seconds=Math.floor((Date.now()-trackingStarted)/1000),minutes=Math.floor(seconds/60);document.querySelector("#tripTime").textContent=`${String(minutes).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;document.querySelector("#tripDistance").textContent=`${tripDistance().toFixed(2)} km`}
function startRecording(trailId=null){if(trackingWatch!==null){showToast("A trip is already being recorded");return}if(!navigator.geolocation){showToast("GPS is not available in this browser");return}trackingTrail=trailId;trackPoints=[];trackingStarted=Date.now();recordingLayer.clearLayers();document.querySelector("#tripPanel").hidden=false;document.querySelector("#recordRoute").classList.add("recording");document.querySelector("#recordRoute").innerHTML="<span>●</span> Recording";updateTripStats();trackingTimer=setInterval(updateTripStats,1000);trackingWatch=navigator.geolocation.watchPosition(position=>{const point=[position.coords.latitude,position.coords.longitude];if(trackPoints.length&&distanceKm(trackPoints.at(-1),point)<.005)return;trackPoints.push(point);recordingLayer.clearLayers();trackLine=L.polyline(trackPoints,{color:"#ff5f3d",weight:6,opacity:.95,className:"gps-track"}).addTo(recordingLayer);L.circleMarker(point,{radius:7,color:"#fff",weight:3,fillColor:"#ff5f3d",fillOpacity:1}).addTo(recordingLayer);map.panTo(point);updateTripStats()},()=>{showToast("GPS access is needed to record a trip");stopRecording(false)},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});showToast("Live GPS preview started")}
function stopRecording(save=true){if(trackingWatch!==null)navigator.geolocation.clearWatch(trackingWatch);trackingWatch=null;clearInterval(trackingTimer);trackingTimer=null;document.querySelector("#tripPanel").hidden=true;document.querySelector("#recordRoute").classList.remove("recording");document.querySelector("#recordRoute").innerHTML="<span>●</span> Record trip";if(save&&trackPoints.length>1){state.trips.push({id:Date.now(),trailId:trackingTrail,started:new Date(trackingStarted).toISOString(),distance:tripDistance(),points:trackPoints});localStorage.setItem("nl-trails-trips",JSON.stringify(state.trips));showToast(`Trip saved · ${tripDistance().toFixed(2)} km`)}else if(save)showToast("Trip ended before enough GPS points were recorded");trackingTrail=null}
function closeDetail(){modal.hidden=true;document.body.style.overflow=""}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}
function openExperience(mode,updateHash=true){
  const configs={
    walking:{types:["walking"],eyebrow:"EXPLORE NEWFOUNDLAND ON FOOT",title:"Find a trail.<br><em>Follow the coast.</em>",intro:"Mapped walking trails with route geometry, elevation where available, difficulty, and trailhead details."},
    atv:{types:["atv"],eyebrow:"EXPLORE NEWFOUNDLAND BY ATV",title:"Find an ATV route.<br><em>Ride local.</em>",intro:"ATV routes remain visible as a connected network. Hover or tap any section for its name and details."},
    skidoo:{types:["skidoo"],eyebrow:"EXPLORE NEWFOUNDLAND ON SNOW",title:"Find a snow route.<br><em>Ride farther.</em>",intro:"Groomed and unmaintained skidoo sections remain visible. Hover or tap a line for its section information."},
    driving:{types:["driving"],eyebrow:"ROAD-TRIP NEWFOUNDLAND",title:"Find a stop.<br><em>Take the scenic route.</em>",intro:`Explore ${DRIVING_DESTINATIONS.length} mapped attractions, museums, viewpoints, historic sites, waterfalls, and other island stops.`},
    offroad:{types:["skidoo","atv"],eyebrow:"RIDE NEWFOUNDLAND",title:"Find your route.<br><em>Ride farther.</em>",intro:"ATV and skidoo networks stay visible by activity: green for ATV, blue for skidoo, and purple for shared use."},
    all:{types:allTypes,eyebrow:"EXPLORE NEWFOUNDLAND",title:"Find your way<br><em>into the wild.</em>",intro:"Walking trails, ATV and skidoo networks, plus road-trip destinations across Newfoundland."}
  },config=configs[mode]||configs.all;
  state.experience=mode;state.activeTypes=new Set(config.types);state.focusedTrail=null;state.query="";document.querySelector("#searchInput").value="";document.body.classList.remove("home-active");document.querySelector("#homePage").hidden=true;document.querySelector("#trailPage").hidden=false;document.querySelector("#experienceEyebrow").textContent=config.eyebrow;document.querySelector("#experienceTitle").innerHTML=config.title;document.querySelector("#experienceIntro").textContent=config.intro;render(true);setTimeout(()=>map.invalidateSize(),50);if(updateHash)history.pushState(null,"",`#${mode}`)
}
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
document.querySelector("#reviewForm").addEventListener("submit",submitReview);
document.querySelector("#suggestFix").addEventListener("click",()=>{document.querySelector("#fixForm").hidden=false;document.querySelector("#fixType").focus()});
document.querySelector("#closeFix").addEventListener("click",()=>document.querySelector("#fixForm").hidden=true);
document.querySelector("#fixForm").addEventListener("submit",event=>{event.preventDefault();const type=document.querySelector("#fixType").value,text=document.querySelector("#fixText").value.trim();if(!type||!text)return;state.fixes.push({trailId:state.selected,type,text,timestamp:new Date().toISOString(),status:"moderation draft"});localStorage.setItem("nl-trails-fixes",JSON.stringify(state.fixes));event.currentTarget.reset();event.currentTarget.hidden=true;showToast("Map correction draft saved on this device")});
document.querySelector("#nearbyList").addEventListener("click",event=>{const button=event.target.closest("[data-poi-lat]");if(!button)return;closeDetail();state.activePois.add("shelter");state.activePois.add("service");renderPois();map.flyTo([Number(button.dataset.poiLat),Number(button.dataset.poiLon)],13,{duration:.6})});
document.querySelector("#clearFocus").addEventListener("click",()=>{state.focusedTrail=null;render(true)});
document.querySelector("#modalSave").addEventListener("click",()=>{toggleSave(state.selected);document.querySelector("#modalSave").textContent=state.saved.has(state.selected)?"♥":"♡"});
document.querySelector("#startRoute").addEventListener("click",()=>{const trail=trails.find(t=>t.id===state.selected),points=trailPoints(trail);closeDetail();document.querySelector("#explorer").scrollIntoView();state.focusedTrail=hasVerifiedMapLocation(trail)?trail.id:null;render(false);if(points.length>1)map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});else if(hasVerifiedMapLocation(trail))map.flyTo(trailStart(trail),trail.type==="driving"?14:trail.precision==="trailhead"?14:11);showToast(trail.type==="driving"?"Showing this destination":points.length>1?"Showing only this trail":trail.precision==="trailhead"?"Showing the verified trailhead · route line pending":"Route location is awaiting verification")});
document.querySelector("#startPreview").addEventListener("click",()=>{const trail=trails.find(t=>t.id===state.selected);closeDetail();document.querySelector("#explorer").scrollIntoView();state.focusedTrail=hasVerifiedMapLocation(trail)?trail.id:null;render(false);const points=trailPoints(trail);if(points.length>1)map.fitBounds(L.latLngBounds(points).pad(.16),{animate:true,maxZoom:14});startRecording(trail.id)});
document.querySelector("#recordRoute").addEventListener("click",()=>trackingWatch===null?startRecording():showToast("Trip recording is already running"));
document.querySelector("#stopRoute").addEventListener("click",()=>stopRecording(true));
document.querySelector("#filterBtn").addEventListener("click",()=>{state.activeTypes=new Set(allTypes);render(true);showToast("All four map layers are visible")});
document.querySelector("#sortBtn").addEventListener("click",e=>{const options=["Nearby","Distance","Difficulty"];state.sort=options[(options.indexOf(state.sort)+1)%options.length];e.currentTarget.firstChild.textContent=state.sort+" ";render(false)});
document.querySelector("#zoomIn").addEventListener("click",e=>{e.stopPropagation();map.zoomIn()});document.querySelector("#zoomOut").addEventListener("click",e=>{e.stopPropagation();map.zoomOut()});
document.querySelector("#locateMe").addEventListener("click",e=>{e.stopPropagation();if(!navigator.geolocation){showToast("Location is not available in this browser");return}showToast("Finding your location…");navigator.geolocation.getCurrentPosition(pos=>{const here=[pos.coords.latitude,pos.coords.longitude];if(locationLayer)map.removeLayer(locationLayer);locationLayer=L.marker(here,{icon:L.divIcon({className:"",html:'<span class="location-pulse"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).bindTooltip("You are here").addTo(map);map.flyTo(here,10);showToast("Location found")},()=>showToast("We couldn’t access your location"),{enableHighAccuracy:true,timeout:8000})});
document.querySelectorAll(".nav-link,.mobile-nav button").forEach(btn=>btn.addEventListener("click",()=>{if(document.querySelector("#trailPage").hidden)openExperience("all");document.querySelectorAll(`.nav-link[data-section="${btn.dataset.section}"],.mobile-nav button[data-section="${btn.dataset.section}"]`).forEach(x=>{x.parentElement.querySelectorAll("button").forEach(y=>y.classList.remove("active"));x.classList.add("active")});if(btn.dataset.section==="safety")document.querySelector("#safety").scrollIntoView();else if(btn.dataset.section==="saved"){state.query="";document.querySelector("#searchInput").value="";showToast(`${state.saved.size} saved trail${state.saved.size===1?"":"s"}`);render(false)}else document.querySelector("#explorer").scrollIntoView()}));
document.querySelector("#safetyBtn").addEventListener("click",()=>showToast("Always check official advisories before heading out"));document.querySelector("#profileBtn").addEventListener("click",()=>showToast("Guest explorer · your saves stay on this device"));
const experienceHashes=["#walking","#atv","#skidoo","#driving","#offroad","#all"];
renderPois();render(false);if(experienceHashes.includes(location.hash))openExperience(location.hash.slice(1),false);else openHome(false);window.addEventListener("popstate",()=>{if(experienceHashes.includes(location.hash))openExperience(location.hash.slice(1),false);else openHome(false)});
