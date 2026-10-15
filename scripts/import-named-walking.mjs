import fs from "node:fs";
import vm from "node:vm";

const input=process.argv[2],output=process.argv[3],dist=process.argv[4]||"dist";
if(!input||!output)throw new Error("Usage: node import-named-walking.mjs overpass.json output.js [dist]");
const normalize=name=>name.toLowerCase().replace(/[’'´.]/g,"").replace(/\b(walking|hiking|trail|path)\b/g,"").replace(/[^a-z0-9]+/g," ").trim();
const context={};vm.createContext(context);
for(const file of ["trailway-data.js","trails-data.js","gnta-data.js","north-data.js","mapped-data.js","community-atv-data.js","flowers-cove-data.js","enriched-data.js"]){const source=fs.readFileSync(`${dist}/${file}`,"utf8");vm.runInContext(source,context)}
vm.runInContext("globalThis.EXISTING=[...TRAILS,...GNTA_TRAILS,...NORTHERN_TRAILS,...OSM_ROUTE_TRAILS,...COMMUNITY_ATV_TRAILS,...FLOWERS_COVE_TRAILS,...ADDED_TRAILS]",context);
const existing=new Set(context.EXISTING.map(trail=>normalize(trail.name))),data=JSON.parse(fs.readFileSync(input,"utf8"));
const bad=/\b(atv|ohv|quad|snowmobile|ski|mtb|connector|access|closed|new trail|to be named|unmarked|tractor|bridge|track field|detour|route|labrador)\b/i,generic=/^(trail|path|walking trail|boardwalk|lookout trail|loop path|main trail|access trail|coastal trail|lighthouse trail|the loop|falls trail)$/i;
const distance=(a,b)=>{const r=6371,k=Math.PI/180,x=Math.sin((b[0]-a[0])*k/2)**2+Math.cos(a[0]*k)*Math.cos(b[0]*k)*Math.sin((b[1]-a[1])*k/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
const segmentLength=segment=>segment.slice(1).reduce((sum,point,index)=>sum+distance(segment[index],point),0);
const groups=new Map();
for(const way of data.elements.filter(item=>item.type==="way"&&item.geometry?.length>1)){
  const name=way.tags?.name?.trim();if(!name||bad.test(name)||generic.test(name)||!/trail|path|walk|boardwalk|hike/i.test(name))continue;
  const key=normalize(name);if(!key||existing.has(key))continue;
  const group=groups.get(key)||{name,names:new Map(),segments:[]};group.names.set(name,(group.names.get(name)||0)+1);group.segments.push(way.geometry.map(point=>[Number(point.lat.toFixed(6)),Number(point.lon.toFixed(6))]));groups.set(key,group);
}
const close=(a,b)=>Math.min(distance(a[0],b[0]),distance(a[0],b.at(-1)),distance(a.at(-1),b[0]),distance(a.at(-1),b.at(-1)))<.4;
const components=[];
for(const group of groups.values()){
  const parts=[];
  for(const segment of group.segments){const matches=parts.filter(part=>part.some(other=>close(segment,other)));if(!matches.length)parts.push([segment]);else{const target=matches[0];target.push(segment);for(const extra of matches.slice(1)){target.push(...extra);parts.splice(parts.indexOf(extra),1)}}}
  const canonical=[...group.names.entries()].sort((a,b)=>b[1]-a[1])[0][0];for(const segments of parts)components.push({name:canonical,segments});
}
const trails=[];let id=44000;
for(const component of components){
  const km=component.segments.reduce((sum,segment)=>sum+segmentLength(segment),0);if(km<.5)continue;
  const longest=[...component.segments].sort((a,b)=>b.length-a.length)[0],center=longest[Math.floor(longest.length/2)],lon=center[1],lat=center[0],region=lat>50?"Northern Peninsula":lon<-57?"Western Newfoundland":lon>-54.5?"Eastern Newfoundland":"Central Newfoundland";
  const endpoints=[longest[0],longest.at(-1)],loop=distance(...endpoints)<.15,features=["Mapped footpath"];
  if(/coast|shore|beach|cove|cape|head|island/i.test(component.name))features.push("Coastal views");if(/lookout|summit|hill|ridge|mountain/i.test(component.name))features.push("Lookout");if(/pond|river|brook|falls|wetland/i.test(component.name))features.push("Water views");
  trails.push({id:id++,name:component.name,region:`${region} · OpenStreetMap`,type:"walking",badge:"OSM · MAPPED",distance:`${km<10?km.toFixed(1):Math.round(km)} km`,difficulty:"Not rated",time:"Plan locally",condition:"Mapped walking route · verify locally",center,segments:component.segments,description:`A mapped Newfoundland walking route added from current OpenStreetMap trail geometry. Confirm local access, maintenance, and conditions before setting out.`,precision:"mapped",denseNetwork:true,routeType:loop?"Loop":"Mapped path",features,access:"Check current local access and trail conditions",source:`https://www.openstreetmap.org/?mlat=${center[0]}&mlon=${center[1]}#map=15/${center[0]}/${center[1]}`,sourceLabel:"OpenStreetMap contributors"});
}
fs.writeFileSync(output,`// Named Newfoundland walking routes from OpenStreetMap, retrieved 2026-10-15.\nconst EXPANDED_WALKING_TRAILS=${JSON.stringify(trails)};\n`);
console.log(`Wrote ${trails.length} additional mapped walking routes to ${output}`);
