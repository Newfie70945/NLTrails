const trails = [
  {id:1,name:"Green Gardens Coast",region:"Gros Morne · West Coast",type:"walking",distance:"10.2 km",difficulty:"Moderate",time:"3–4 hr",condition:"Good",x:25,y:35,path:"M202 250 Q235 214 265 232 T320 196",description:"A dramatic coastal walk through volcanic tablelands, tuckamore, and sea-cliff meadows."},
  {id:2,name:"Humber Valley Run",region:"Corner Brook · West Coast",type:"skidoo",distance:"74 km",difficulty:"Intermediate",time:"4–6 hr",condition:"Packed",x:33,y:47,path:"M278 320 Q330 350 367 304 T452 300",description:"A long winter route through the Humber Valley with broad views and sheltered forest sections."},
  {id:3,name:"Exploits Ridge Loop",region:"Grand Falls-Windsor · Central",type:"atv",distance:"42 km",difficulty:"Rugged",time:"3–5 hr",condition:"Dry",x:52,y:47,path:"M430 331 Q466 287 512 322 T578 292",description:"Rock, roots, and wide-open ridge country on a varied loop through central Newfoundland."},
  {id:4,name:"Terra Nova Passage",region:"Terra Nova · East Coast",type:"walking",distance:"8.4 km",difficulty:"Easy",time:"2–3 hr",condition:"Good",x:65,y:52,path:"M535 357 Q576 389 614 352 T681 370",description:"A relaxed forest and shoreline path with quiet coves, boardwalks, and frequent bird sightings."},
  {id:5,name:"Avalon Backcountry",region:"Clarenville to Avalon",type:"skidoo",distance:"96 km",difficulty:"Advanced",time:"6–8 hr",condition:"Variable",x:76,y:62,path:"M626 426 Q679 388 713 432 T780 463",description:"A full-day snow route crossing exposed barrens and sheltered woods toward the Avalon Peninsula."},
  {id:6,name:"Cape Shore Track",region:"Placentia · Avalon",type:"atv",distance:"31 km",difficulty:"Moderate",time:"2–4 hr",condition:"Muddy",x:70,y:72,path:"M578 495 Q620 530 665 493 T734 510",description:"An old coastal track with punchy climbs, muddy crossings, and sweeping views of Placentia Bay."}
];

const state={mode:"all",query:"",saved:new Set(JSON.parse(localStorage.getItem("akidoo-saved")||"[]")),selected:1,sort:"Nearby"};
const list=document.querySelector("#trailList"),markers=document.querySelector("#markers"),routes=document.querySelector("#routeLines"),count=document.querySelector("#resultCount"),modal=document.querySelector("#detailModal"),toast=document.querySelector("#toast");

function filtered(){
  let items=trails.filter(t=>(state.mode==="all"||t.type===state.mode)&&(`${t.name} ${t.region}`.toLowerCase().includes(state.query)));
  if(state.sort==="Distance") items=[...items].sort((a,b)=>parseFloat(a.distance)-parseFloat(b.distance));
  if(state.sort==="Difficulty") {const rank={Easy:1,Moderate:2,Intermediate:2,Rugged:3,Advanced:4};items=[...items].sort((a,b)=>rank[a.difficulty]-rank[b.difficulty]);}
  return items;
}

function render(){
  const items=filtered();count.textContent=`${items.length} route${items.length===1?"":"s"}`;
  list.innerHTML=items.length?items.map(t=>`<article class="trail-card ${state.selected===t.id?"active":""}" data-id="${t.id}" tabindex="0"><div class="card-top"><span class="trail-type ${t.type}">${t.type.toUpperCase()}</span><button class="save-btn ${state.saved.has(t.id)?"saved":""}" data-save="${t.id}" aria-label="${state.saved.has(t.id)?"Remove from":"Save to"} saved">${state.saved.has(t.id)?"♥":"♡"}</button></div><h3>${t.name}</h3><span class="region">${t.region}</span><div class="card-stats"><span>↔ <b>${t.distance}</b></span><span>◇ <b>${t.difficulty}</b></span><span class="condition">${t.condition}</span></div></article>`).join(""):`<div class="empty"><b>No trails found</b><p>Try another trail type or search.</p></div>`;
  markers.innerHTML=items.map(t=>`<button class="marker ${t.type} ${state.selected===t.id?"selected":""}" data-id="${t.id}" style="left:${t.x}%;top:${t.y}%" aria-label="Open ${t.name}"><span class="marker-pin"><i></i></span><span class="marker-label">${t.name}</span></button>`).join("");
  routes.innerHTML=items.map(t=>`<path class="route-path ${t.type}" d="${t.path}"/>`).join("");
}

function selectTrail(id,open=false){state.selected=id;render();if(open)openDetail(id)}
function toggleSave(id){state.saved.has(id)?state.saved.delete(id):state.saved.add(id);localStorage.setItem("akidoo-saved",JSON.stringify([...state.saved]));render();showToast(state.saved.has(id)?"Trail saved for later":"Removed from saved trails")}
function openDetail(id){const t=trails.find(x=>x.id===id);state.selected=id;document.querySelector("#detailVisual").className=`detail-visual ${t.type}`;document.querySelector("#detailType").textContent=t.type.toUpperCase();document.querySelector("#detailRegion").textContent=t.region;document.querySelector("#modalTitle").textContent=t.name;document.querySelector("#detailDescription").textContent=t.description;document.querySelector("#detailDistance").textContent=t.distance;document.querySelector("#detailDifficulty").textContent=t.difficulty;document.querySelector("#detailTime").textContent=t.time;document.querySelector("#detailCondition").textContent=`${t.condition} conditions`;document.querySelector("#modalSave").textContent=state.saved.has(id)?"♥":"♡";modal.hidden=false;document.body.style.overflow="hidden";document.querySelector(".close-btn").focus()}
function closeDetail(){modal.hidden=true;document.body.style.overflow=""}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}

document.querySelectorAll(".mode").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".mode").forEach(x=>x.classList.remove("active"));btn.classList.add("active");state.mode=btn.dataset.mode;render()}));
document.querySelector("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();render()});
list.addEventListener("click",e=>{const save=e.target.closest("[data-save]");if(save){e.stopPropagation();toggleSave(Number(save.dataset.save));return}const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)});
list.addEventListener("keydown",e=>{if(e.key==="Enter"){const card=e.target.closest("[data-id]");if(card)selectTrail(Number(card.dataset.id),true)}});
markers.addEventListener("click",e=>{const marker=e.target.closest("[data-id]");if(marker)selectTrail(Number(marker.dataset.id),true)});
document.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",closeDetail));document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeDetail()});
document.querySelector("#modalSave").addEventListener("click",()=>{toggleSave(state.selected);document.querySelector("#modalSave").textContent=state.saved.has(state.selected)?"♥":"♡"});
document.querySelector("#startRoute").addEventListener("click",()=>showToast("Route preview ready — GPS guidance is a future feature"));
document.querySelector("#filterBtn").addEventListener("click",()=>{const modes=["all","walking","skidoo","atv"],next=modes[(modes.indexOf(state.mode)+1)%modes.length];document.querySelector(`[data-mode="${next}"]`).click();document.querySelector("#filterCount").textContent=next==="all"?"0":"1"});
document.querySelector("#sortBtn").addEventListener("click",e=>{const options=["Nearby","Distance","Difficulty"];state.sort=options[(options.indexOf(state.sort)+1)%options.length];e.currentTarget.firstChild.textContent=state.sort+" ";render()});
document.querySelectorAll(".nav-link").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));btn.classList.add("active");if(btn.dataset.section==="safety")document.querySelector("#safety").scrollIntoView();else if(btn.dataset.section==="saved"){state.query="";state.mode="all";document.querySelector("#searchInput").value="";showToast(`${state.saved.size} saved trail${state.saved.size===1?"":"s"}`);render()}else document.querySelector("#explorer").scrollIntoView()}));
document.querySelector("#safetyBtn").addEventListener("click",()=>showToast("Always check official advisories before heading out"));
document.querySelector("#profileBtn").addEventListener("click",()=>showToast("Guest explorer · your saves stay on this device"));
render();
