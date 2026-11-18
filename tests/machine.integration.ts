import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import manifest from "../contracts/plugin-manifest.json" with {type:"json"};
import {newProject,clone} from "../src/domain/model.ts";
import {config} from "../src/domain/config.ts";
import {scenario,original,sha,base,selection} from "./support/scenario.ts";
import {start} from "./support/machine.ts";
import {importText} from "./support/import.ts";
import {prepareMedia} from "./support/assets.ts";
const slug=manifest.id.replace("org.wordflowlab.","");
const error=(r:any)=>r.error?.code??r.data?.result?.error?.code;
test("正式机器入口全动作、固定成果、恢复与热插拔",{timeout:1200000},async t=>{
 const c=await start();let serial=0;const key=()=>"machine-"+(++serial);const files:any[]=[];
 const artifact=async(action:string,r:any,args:any={})=>{let offset=0,expected:string|undefined,total:number|undefined;const chunks:Buffer[]=[];
 do{const v=await c.invoke(action,{...selection(r),...args,offset,max_bytes:8192});const b=Buffer.from(v.base64,"base64");assert.equal(v.offset,offset);assert.equal(sha(b),v.chunk_sha256);expected??=v.sha256;total??=v.total_bytes;assert.equal(v.sha256,expected);chunks.push(b);if(v.next_offset===null)break;assert.equal(v.next_offset,offset+b.length);offset=v.next_offset;}while(offset<32*1024*1024);
 const bytes=Buffer.concat(chunks);assert.equal(bytes.length,total);assert.equal(sha(bytes),expected);return bytes;};
 try{
 t.diagnostic(c.directory);assert.equal(c.cap.access_mode,"open");
 for(const resource of [undefined,"references/operations.md","references/workflows.md"]){const v=await c.invoke("skills.read",{skill_id:slug,...(resource?{resource}:{})});assert.ok(v.content.length>100);}
 const refs=await importText(c,[original]),p=scenario(c.work);await prepareMedia(c,p,refs,slug);
 let r=await c.invoke("save_project",{content:p,source_refs:refs,expected_revision:0,expected_sha256:"",operation_key:"seed"});const initial=r;


 if(slug==="picturebook"){
  assert.equal((await c.invoke("check_layout",selection(r))).can_export,true);
  const d=await c.invoke("page_digest",{...selection(r),page_id:"page-1"});
  r=await c.invoke("put_note",{...base(r,key()),note:{id:"note",page_id:"page-1",page_sha256:d.page_sha256,comment:"页首留白再多一点",status:"open",resolution:""}});
  assert.equal((await c.invoke("locate_page",{...selection(r),page_id:"page-1"})).source_refs.length,1);
  for(const action of ["render_book","export_pdf"]){const bytes=await artifact(action,r);assert.ok(bytes.length>100);if(action==="export_pdf")assert.equal(bytes.subarray(0,4).toString(),"%PDF");else assert.match(bytes.toString(),/data:image\/png;base64/);files.push({name:action==="export_pdf"?"绘本.pdf":"绘本.html",bytes});}
 }
 if(slug==="murder-mystery"){
  assert.deepEqual((await c.invoke("check_scenario",selection(r))).missing,[]);
  const v=await c.invoke("player_view",{...selection(r),role_id:"lin",act_id:"arrival"});assert.ok(!JSON.stringify(v).includes("主持专有"));assert.ok(!JSON.stringify(v).includes("未来名册"));
  for(const action of ["export_player","export_gm"]){const bytes=await artifact(action,r,action==="export_player"?{role_id:"lin",act_id:"arrival"}:{});files.push({name:action+".html",bytes});}
  r=await c.invoke("start_session",{...base(r,key()),session_id:"trial",label:"固定版本模拟试玩",mode:"agent_simulated",assignments:p.roles.map((v:any)=>({role_id:v.id,participant:v.name+" 模拟"}))});
  assert.ok(error(await c.raw("advance_act",{...base(r,key()),session_id:"trial"})));
  r=await c.invoke("release_clue",{...base(r,key()),session_id:"trial",clue_id:"seal"});
  r=await c.invoke("skip_clue",{...base(r,key()),session_id:"trial",clue_id:"letter",reason:"本轮专门验证缺少角色信时的推测"});
  r=await c.invoke("record_guess",{...base(r,key()),session_id:"trial",role_id:"lin",text:"从邮戳推测寄信人早在旧站。"});
  const player=await c.invoke("session_player_view",{...selection(r),session_id:"trial",role_id:"lin"});assert.equal(player.clues.length,1);
  await artifact("export_session_player",r,{session_id:"trial",role_id:"lin"});
  r=await c.invoke("advance_act",{...base(r,key()),session_id:"trial"});
  r=await c.invoke("release_clue",{...base(r,key()),session_id:"trial",clue_id:"register"});
  r=await c.invoke("close_session",{...base(r,key()),session_id:"trial",text:"模拟复盘：第一幕角色线索缺失降低了依据，下一版保留必发。"});
  assert.equal((await c.invoke("session_view",{...selection(r),session_id:"trial"})).closed,true);
 }
 for(const [item,field] of Object.entries(config.fields))for(const row of r.object.content[field as string])r=await c.invoke("put_"+item,{...base(r,key()),[item]:row});
 assert.equal((await c.invoke("list_projects",{query:"雨港"})).objects.length,1);
 assert.equal((await c.invoke("get_source",{...selection(r),source_index:0})).source.content,original);
 const before=r;const edit={...base(r,key()),content:{...r.object.content,title:"雨港来信 第二版"}};r=await c.invoke("save_project",edit);assert.equal((await c.invoke("save_project",edit)).sha256,r.sha256);
 assert.equal(error(await c.raw("save_project",{...edit,content:{...edit.content,title:"同键异参"}})),"idempotency_conflict");
 assert.equal(error(await c.raw("save_project",{...edit,operation_key:key()})),"revision_conflict");
 assert.equal((await c.invoke("get_operation",{operation_key:edit.operation_key})).sha256,r.sha256);
 r=await c.invoke("save_project",{...base(r,key()),content:{...r.object.content,basis_refs:[{owner_plugin_id:manifest.id,object_id:initial.object.object_id,revision:initial.object.revision,sha256:initial.sha256}]}});
 assert.equal((await c.invoke("get_basis",{...selection(r),basis_index:0})).basis.sha256,initial.sha256);
 const fixed=selection(r),finalSHA=r.sha256;
 await c.invoke("build_context",{...fixed,goal:"沿固定依据继续创作",max_chars:12000});
 assert.equal((await c.invoke("create_handoff",{...fixed,goal:"准备下一阶段候选"})).basis_ref.sha256,finalSHA);
 await c.invoke("compare_versions",{object_id:r.object.object_id,from_revision:before.object.revision,to_revision:r.object.revision});
 for(const format of ["json","markdown","html"]){const v=await c.invoke("export_project",{...fixed,format,max_bytes:48000});assert.ok(v.total_bytes>100);}
 const read=c.cli("hetu.plugins.invoke",{...c.binding,capabilities_sha256:c.cap.capabilities_sha256,action:"get_project",arguments:fixed});assert.equal(read.status,"succeeded");
 const scratch=clone(r.object.content);if(slug==="murder-mystery")scratch.sessions=[];if(slug==="reader-review"){scratch.submissions=[];scratch.decisions=[];}
 let remove=await c.invoke("save_project",{content:{...scratch,title:"独立移除用例"},source_refs:refs,expected_revision:0,expected_sha256:"",operation_key:key()});
 for(const [item,field] of Object.entries(config.fields).reverse())for(const row of [...remove.object.content[field as string]].reverse())if(manifest.contributions.actions.some(a=>a.id==="remove_"+item))remove=await c.invoke("remove_"+item,{...base(remove,key()),[item+"_id"]:row.id});
 assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 await c.apply("disable");assert.ok(error(await c.raw("get_project",fixed)));await c.apply("enable");await c.discover();assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 await c.apply("uninstall");assert.ok(error(await c.raw("get_project",fixed)));await c.apply("install");await c.discover();assert.equal((await c.invoke("get_project",fixed)).sha256,finalSHA);
 assert.deepEqual(manifest.contributions.actions.map(a=>a.id).filter(a=>!c.actions.has(a)),[]);
 const dir=process.env.HETU_RECEIPT_DIRECTORY??"docs/research";await mkdir(dir,{recursive:true});for(const f of files)await writeFile(path.join(dir,f.name),f.bytes);
 await writeFile(path.join(dir,"runtime-acceptance.json"),JSON.stringify({recorded_at:new Date().toISOString(),plugin_id:manifest.id,package_sha256:c.pkg.package_sha256,host_version:c.coreVersion,platform:process.platform,architecture:process.arch,actions:[...c.actions],skill_resources:3,lifecycle:["install","disable","enable","uninstall","install"],fixed_history:true,CAS:true,original_key_recovery:true,artifact_sha256_verified:true,limits:["没有付费模型、作者采纳、定稿或Windows/Linux专业运行验收"]},null,2)+"\n");
 }finally{await c.client.close();}
});
