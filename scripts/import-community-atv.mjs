import fs from "node:fs";

const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw new Error("Usage: node import-community-atv.mjs input.kml output.js");
const xml=fs.readFileSync(input,"utf8");
const source="https://www.google.com/maps/d/viewer?mid=1UieuRO3cdNkwrAmmxpmh_cMJ4ow";
const clean=value=>String(value||"").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<br\s*\/?\s*>/gi," · ").replace(/<[^>]+>/g,"").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").trim();
const pick=(block,tag)=>clean(block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]);
const coords=block=>[...block.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].flatMap(match=>match[1].trim().split(/\s+/).map(value=>{const [lon,lat]=value.split(",").map(Number);return Number.isFinite(lat)&&Number.isFinite(lon)?[Number(lat.toFixed(5)),Number(lon.toFixed(5))]:null}).filter(Boolean));
const distance=points=>{let total=0;for(let i=1;i<points.length;i++){const [a,b]=[points[i-1],points[i]],r=Math.PI/180,x=Math.sin((b[0]-a[0])*r/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2;total+=6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}return total};
const category=name=>/gas|fuel|esso|irving|north atlantic/i.test(name)?"Fuel":/motel|hotel|inn|cottage|chalet|guest house|bnb|b&b|accommod/i.test(name)?"Accomodation":/restaurant|grill|coffee|cafe|takeout|tim horton|food/i.test(name)?"Restaurant":/camp|rv park/i.test(name)?"Campground":/caution|danger|washout|crossing|bridge out|rough/i.test(name)?"Caution":/parking|staging/i.test(name)?"Parking":/museum|historic|lighthouse|attraction|lookout|photo|waterfall/i.test(name)?"Attraction":"information";
const routes=[],pois=[];let routeId=60000,poiId=960000;
for(const folderMatch of xml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)){
  const folder=folderMatch[1],region=pick(folder,"name")||"Community ATV map";
  for(const markMatch of folder.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)){
    const mark=markMatch[1],name=pick(mark,"name")||"Community mapped route",description=pick(mark,"description");
    if(mark.includes("<LineString>")){
      const route=coords(mark);if(route.length<2||/ferry route/i.test(name))continue;
      const km=distance(route),middle=route[Math.floor(route.length/2)];
      routes.push({id:routeId++,name,region:`${region} · community map`,type:"atv",badge:"COMMUNITY MAP",distance:`${km<10?km.toFixed(1):Math.round(km)} km`,difficulty:"Varied",time:"Plan locally",condition:"Community-mapped · verify access",center:middle,route,description:description||"A community-mapped ATV route or connector. Access, surface, and legal road use can change; confirm locally before riding.",precision:"community",routeType:"Point to point / connector",features:["ATV route","Local planning","Services nearby"],access:"Confirm current access, legal road use, and surface conditions locally",notes:"Planning-scale community data. It has not been independently field-verified by Newfoundland Trails.",source,sourceLabel:"Crossing Newfoundland By ATV community map"});
    }else if(mark.includes("<Point>")){
      const point=coords(mark)[0];if(!point)continue;
      pois.push({id:poiId++,name,category:category(name),comment:description,address:region,center:point,sourceScope:"atv"});
    }
  }
}
const banner=`// Community ATV planning snapshot imported from the public Crossing Newfoundland By ATV map.\n// Generated ${new Date().toISOString().slice(0,10)}; community data must be locally verified.\n`;
fs.writeFileSync(output,`${banner}const COMMUNITY_ATV_TRAILS=${JSON.stringify(routes)};\nconst COMMUNITY_ATV_POIS=${JSON.stringify(pois)};\n`);
console.log(`Wrote ${routes.length} routes and ${pois.length} points to ${output}`);
