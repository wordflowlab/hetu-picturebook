import {managed} from "./creative.ts";
import {sha} from "./scenario.ts";
import {readFile} from "node:fs/promises";
import path from "node:path";
export async function importAsset(c:any,bytes:Buffer,filename:string,key:string){const inline={filename,base64:bytes.toString("base64"),sha256:sha(bytes)};
const scan=await c.ok("hetu_managed_assets_inspect",{management_ref:c.management,work_ref:c.work,inline_source:inline});
const v=await managed(c,"assets.import",{work_ref:c.work,inline_source:inline,expected_file:{sha256:scan.sha256,size_bytes:scan.size_bytes},title:filename,source:{source_type:"author_supplied",creator_statement:"本轮隔离验收原创绘画或本机系统语音样本"},rights_status:"unknown",redistribution_allowed:false,rights_statement:"",operation_key:key},key);
return {kind:"asset",work_ref:c.work,asset_id:v.asset.asset_id,revision:v.asset.revision,sha256:v.sha256};}
export async function prepareMedia(c:any,p:any,refs:any[],slug:string){if(slug==="picturebook"){const bytes=await readFile("tests/fixtures/rain-harbour.png");refs.push(await importAsset(c,bytes,"雨港原创绘画.png","picturebook-art"));for(const page of p.pages)page.images=[{id:"art",asset_source_index:refs.length-1,alt:"雨中的旧邮局",rect:{x:10,y:10,width:160,height:115},fit:page.number%2?"contain":"cover"}];}return refs;}
