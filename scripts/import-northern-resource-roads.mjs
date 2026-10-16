import {writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";

const endpoint="https://dnrmaps.gov.nl.ca/arcgis/rest/services/GeoAtlas/Map_Layers/MapServer/14/query";
const params=new URLSearchParams({where:"1=1",geometry:"-57.35,50.70,-56.45,51.38",geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outFields:"OBJECTID,ROAD_NAME,ROAD_ACCESS",returnGeometry:"true",outSR:"4326",maxAllowableOffset:"0.00025",f:"geojson"});
const geojson=JSON.parse(execFileSync("curl",["--retry","4","--retry-all-errors","-fsSL",`${endpoint}?${params}`],{encoding:"utf8",maxBuffer:32*1024*1024}));
const roads=geojson.features.map(feature=>({
  id:feature.properties.OBJECTID,
  name:String(feature.properties.ROAD_NAME||"").trim()||"Unnamed resource road",
  access:String(feature.properties.ROAD_ACCESS||"6_Unknown").replace(/^\d+_/,""),
  segments:feature.geometry.type==="MultiLineString"?feature.geometry.coordinates.map(line=>line.map(([lon,lat])=>[lat,lon])):[feature.geometry.coordinates.map(([lon,lat])=>[lat,lon])]
}));
await writeFile(new URL("../dist/northern-resource-roads.js",import.meta.url),`// Provincial Resource Access Roads around Eddies Cove, Flower's Cove, and the west-side northern corridor.\n// Inventory geometry is not blanket ATV permission. Generated ${new Date().toISOString().slice(0,10)}.\nconst NORTHERN_RESOURCE_ROADS=${JSON.stringify(roads)};\n`);
console.log(`Wrote ${roads.length} resource-road features.`);
