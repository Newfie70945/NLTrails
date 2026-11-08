import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const publicRoot=path.join(root,"dist");
const serverRoot=path.join(publicRoot,"server");
const workerSource=fs.readFileSync(path.join(root,"server","worker.js"),"utf8");
const contentTypes={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".svg":"image/svg+xml; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};
const files=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name);if(entry.isDirectory()){if(absolute!==serverRoot)walk(absolute);continue}files.push(absolute)}}
walk(publicRoot);
const assets={};
for(const file of files){const relative="/"+path.relative(publicRoot,file).split(path.sep).join("/");const extension=path.extname(file).toLowerCase();const body=fs.readFileSync(file).toString("utf8");assets[relative]={type:contentTypes[extension]||"application/octet-stream",body}}
fs.mkdirSync(serverRoot,{recursive:true});
fs.writeFileSync(path.join(serverRoot,"index.js"),`const ASSETS=${JSON.stringify(assets)};\n${workerSource}\n`);
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets.`);
