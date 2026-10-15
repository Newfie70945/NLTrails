import {readFile,writeFile} from "node:fs/promises";

const endpoint="https://overpass-api.de/api/interpreter";
const bbox="46.5,-59.6,52.1,-52.4";
const query=`[out:json][timeout:180];(
  nwr[amenity~"^(parking|toilets|drinking_water|shelter)$"](${bbox});
  nwr[tourism~"^(camp_site|picnic_site|viewpoint|information)$"](${bbox});
  nwr[information~"^(guidepost|map|board|office)$"](${bbox});
  nwr[emergency~"^(phone|defibrillator)$"](${bbox});
);out center tags;`;

let elements;
if(process.argv[2])({elements}=JSON.parse(await readFile(process.argv[2],"utf8")));
else{
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","user-agent":"NL-Trails-POI-Importer/1.0"},body:new URLSearchParams({data:query})});
  if(!response.ok)throw new Error(`Overpass ${response.status}: ${await response.text()}`);
  ({elements}=await response.json());
}
const labels={parking:"Trail parking",toilets:"Public toilets",drinking_water:"Drinking water",shelter:"Shelter",camp_site:"Campground",picnic_site:"Picnic area",viewpoint:"Viewpoint",information:"Visitor information",guidepost:"Trail guidepost",map:"Trail map",board:"Information board",office:"Visitor information",phone:"Emergency phone",defibrillator:"Defibrillator"};
const categories={parking:"Parking",toilets:"Toilets",drinking_water:"DrinkingWater",shelter:"Shelter",camp_site:"Campground",picnic_site:"Picnic",viewpoint:"Lookout",information:"information",guidepost:"Guidepost",map:"information",board:"information",office:"information",phone:"Emergency",defibrillator:"Emergency"};
const caps={Parking:160,Toilets:100,DrinkingWater:80,Shelter:100,Campground:100,Picnic:100,Lookout:180,information:120,Guidepost:140,Emergency:80};
const used=new Map(),pois=[];
for(const item of elements){
  const tags=item.tags||{},lat=item.lat??item.center?.lat,lon=item.lon??item.center?.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const kind=tags.amenity||tags.tourism||tags.information||tags.emergency;
  const category=categories[kind];if(!category)continue;
  const count=used.get(category)||0;if(count>=caps[category])continue;
  // Unnamed guideposts and information boards are too noisy at island scale.
  if(!tags.name&&["Guidepost","information"].includes(category))continue;
  used.set(category,count+1);
  const osmType=item.type==="node"?"node":item.type==="way"?"way":"relation";
  const access=[tags.access&&`Access: ${tags.access}`,tags.fee==="yes"&&"Fee may apply",tags.wheelchair&&`Wheelchair: ${tags.wheelchair}`,tags.opening_hours&&`Hours: ${tags.opening_hours}`].filter(Boolean).join(" · ");
  pois.push({id:2000000+pois.length,name:tags.name||labels[kind]||"Trail service",category,comment:access,address:tags["addr:street"]||tags.operator||"",center:[Number(lat.toFixed(6)),Number(lon.toFixed(6))],source:`https://www.openstreetmap.org/${osmType}/${item.id}`,sourceLabel:"OpenStreetMap contributors",osmUpdated:"2026-10-15"});
}
const header=`// Trail-useful Newfoundland and Labrador POIs from OpenStreetMap via Overpass.\n// Retrieved 2026-10-15; confirm access, services, water safety, and seasonal operation.\n`;
await writeFile(new URL("../dist/osm-poi-data.js",import.meta.url),`${header}const OSM_TRAIL_POIS=${JSON.stringify(pois)};\n`);
console.log(JSON.stringify({total:pois.length,categories:Object.fromEntries([...used].sort())},null,2));
