const MAX_BODY_BYTES=300000;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function userId(request){return request.headers.get("oai-authenticated-user-id")||""}
function finiteCoordinate(value,min,max){const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:null}
function cleanText(value,max=900){return String(value||"").trim().slice(0,max)}
function validGeometry(value){
  if(value==null)return null;
  if(!Array.isArray(value)||value.length<2||value.length>2000)return false;
  const points=value.map(point=>Array.isArray(point)&&point.length===2?[finiteCoordinate(point[0],-90,90),finiteCoordinate(point[1],-180,180)]:[null,null]);
  return points.every(point=>point[0]!==null&&point[1]!==null)?points:false;
}
async function body(request){
  const length=Number(request.headers.get("content-length")||0);
  if(length>MAX_BODY_BYTES)throw new Error("too_large");
  const text=await request.text();
  if(text.length>MAX_BODY_BYTES)throw new Error("too_large");
  return JSON.parse(text||"{}");
}
async function api(request,env,url){
  if(!env.DB)return json({error:"Shared reporting database is unavailable"},503);
  const actor=userId(request);
  if(request.method!=="GET"&&!actor)return json({error:"Sign in is required to submit trail information"},401);
  if(url.pathname==="/api/corrections"&&request.method==="GET"){
    const result=await env.DB.prepare("SELECT id, trail_id AS trailId, kind, activity, notes, point_lat AS pointLat, point_lng AS pointLng, geometry_json AS geometryJson, status, created_at AS createdAt FROM corrections WHERE status IN ('pending','approved') ORDER BY created_at DESC LIMIT 250").all();
    return json({corrections:(result.results||[]).map(row=>({...row,geometry:row.geometryJson?JSON.parse(row.geometryJson):null,geometryJson:undefined}))});
  }
  if(url.pathname==="/api/corrections"&&request.method==="POST"){
    let input;try{input=await body(request)}catch(error){return json({error:error.message==="too_large"?"Report is too large":"Invalid report"},400)}
    const kind=cleanText(input.kind,80),activity=cleanText(input.activity,80),notes=cleanText(input.notes),geometry=validGeometry(input.geometry);
    const pointLat=input.point?.length?finiteCoordinate(input.point[0],-90,90):null,pointLng=input.point?.length?finiteCoordinate(input.point[1],-180,180):null;
    if(!kind||!activity||!notes||geometry===false||(!geometry&&pointLat===null&&pointLng===null&&!input.trailId))return json({error:"Issue, activity, notes and a trail or map location are required"},400);
    const id=crypto.randomUUID(),createdAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO corrections (id,user_id,trail_id,kind,activity,notes,point_lat,point_lng,geometry_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)").bind(id,actor,input.trailId==null?null:String(input.trailId),kind,activity,notes,pointLat,pointLng,geometry?JSON.stringify(geometry):null,createdAt).run();
    return json({correction:{id,trailId:input.trailId==null?null:String(input.trailId),kind,activity,notes,pointLat,pointLng,geometry,status:"pending",createdAt}},201);
  }
  if(url.pathname==="/api/conditions"&&request.method==="GET"){
    const trailId=cleanText(url.searchParams.get("trailId"),80);
    const query=trailId?env.DB.prepare("SELECT id, trail_id AS trailId, condition, notes, latitude, longitude, created_at AS createdAt FROM condition_reports WHERE trail_id=? ORDER BY created_at DESC LIMIT 30").bind(trailId):env.DB.prepare("SELECT id, trail_id AS trailId, condition, notes, latitude, longitude, created_at AS createdAt FROM condition_reports ORDER BY created_at DESC LIMIT 250");
    const result=await query.all();return json({reports:result.results||[]});
  }
  if(url.pathname==="/api/conditions"&&request.method==="POST"){
    let input;try{input=await body(request)}catch(error){return json({error:error.message==="too_large"?"Report is too large":"Invalid report"},400)}
    const trailId=cleanText(input.trailId,80),condition=cleanText(input.condition,80),notes=cleanText(input.notes,600),latitude=finiteCoordinate(input.latitude,-90,90),longitude=finiteCoordinate(input.longitude,-180,180);
    if(!trailId||!condition)return json({error:"Trail and condition are required"},400);
    const id=crypto.randomUUID(),createdAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO condition_reports (id,user_id,trail_id,condition,notes,latitude,longitude,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,actor,trailId,condition,notes,latitude,longitude,createdAt).run();
    return json({report:{id,trailId,condition,notes,latitude,longitude,createdAt}},201);
  }
  if(url.pathname==="/api/health")return json({ok:true,database:true});
  return json({error:"Not found"},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(url.pathname.startsWith("/api/"))return await api(request,env,url);
      if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405});
      const path=url.pathname==="/"?"/index.html":url.pathname;
      const asset=ASSETS[path];
      if(!asset)return new Response("Not found",{status:404});
      const headers={"content-type":asset.type,"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","cache-control":path==="/sw.js"||path==="/index.html"?"no-cache":"public, max-age=3600"};
      return new Response(request.method==="HEAD"?null:asset.body,{headers});
    }catch(error){return url.pathname.startsWith("/api/")?json({error:"The shared trail service could not complete this request"},500):new Response("Server error",{status:500})}
  }
};
