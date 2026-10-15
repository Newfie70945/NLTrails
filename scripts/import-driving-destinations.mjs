import fs from "node:fs";

const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw new Error("Usage: node import-driving-destinations.mjs overpass.json output.js");
const data=JSON.parse(fs.readFileSync(input,"utf8")),seen=new Set(),destinations=[];let id=1200000;
const clean=value=>String(value||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const classify=tags=>tags.tourism==="museum"?"Museum":tags.tourism==="viewpoint"?"Viewpoint":tags.man_made==="lighthouse"?"Lighthouse":tags.natural==="waterfall"?"Waterfall":tags.tourism==="gallery"||tags.tourism==="artwork"?"Arts & culture":tags.tourism==="information"?"Visitor information":tags.historic?"Historic site":tags.tourism==="zoo"||tags.tourism==="aquarium"?"Wildlife attraction":"Attraction";
for(const item of data.elements){
  const tags=item.tags||{},name=clean(tags.name),lat=Number(item.lat??item.center?.lat),lon=Number(item.lon??item.center?.lon);if(!name||!/[A-Za-zÀ-ÿ]/.test(name)||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const key=`${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;if(seen.has(key))continue;seen.add(key);
  const category=classify(tags),description=clean(tags.description||tags.inscription||tags["description:en"]||`${name} is a mapped ${category.toLowerCase()} that can be explored while travelling through Newfoundland.`),region=lat>50?"Northern Newfoundland":lon<-57?"Western Newfoundland":lon>-54.5?"Eastern Newfoundland":"Central Newfoundland",website=tags.website||tags["contact:website"]||null;
  destinations.push({id:id++,name,region:`${region} · Road-trip stop`,type:"driving",badge:category.toUpperCase(),distance:"Road-trip stop",difficulty:category,time:"Plan your visit",condition:"Mapped destination",center:[Number(lat.toFixed(6)),Number(lon.toFixed(6))],precision:"mapped",destination:true,destinationCategory:category,description,routeType:"Drive-to destination",features:[category,"Road-trip planning"],access:tags.access&&tags.access!=="yes"?`Access: ${tags.access}`:"Confirm hours, road access, and seasonal availability before visiting",source:`https://www.openstreetmap.org/${item.type}/${item.id}`,sourceLabel:"OpenStreetMap contributors",website});
}
destinations.sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync(output,`// Named Newfoundland tourist destinations from OpenStreetMap, retrieved 2026-10-15.\nconst DRIVING_DESTINATIONS=${JSON.stringify(destinations)};\n`);
console.log(`Wrote ${destinations.length} driving destinations to ${output}`);
