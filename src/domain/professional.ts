import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {PDFDocument,rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {requireValue as need,canonical} from '../../vendor/project-store.ts';
import {artifact,hash} from './artifact.ts';
import {escapeHTML as esc,htmlPage} from './presentation.ts';
import {readBlob} from './media.ts';
import {imageHeader} from './image.ts';
import {wrapLine} from './typography.ts';

export const pt=(mm:number)=>mm*72/25.4;
const find=(p:any,id:string)=>{const v=p.pages.find((x:any)=>x.id===id);need(v,'绘本页不存在。');return v;};
export const pageDigest=(p:any,id:string)=>hash(canonical({format:p.format,page:find(p,id)}));
export function spreads(p:any){
 const pages=[...p.pages].sort((a,b)=>a.number-b.number),rows:any[][]=[];
 for(const page of pages){const n=page.number===1?0:Math.floor(page.number/2);rows[n]??=[];rows[n].push(page);}
 return rows.filter(Boolean).map(row=>p.format.direction==='rtl'?[...row].reverse():row);
}
export function validateDomain(p:any){
 need(p.format.safe_mm*2<Math.min(p.format.width_mm,p.format.height_mm),'安全区超过页内尺寸。');
 need(p.pages.length<=32,'绘本最多32页。');
 need(new Set(p.pages.map((x:any)=>x.number)).size===p.pages.length,'页码重复。');
 for(const page of p.pages){const ids=[...page.images,...page.texts].map((x:any)=>x.id);need(new Set(ids).size===ids.length,'页内图文框ID重复。');}
 for(const note of p.notes){find(p,note.page_id);need(note.status!=='resolved'||note.resolution.trim(),'解决意见须记录结果。');}
}
export async function checkSources(p:any,s:any[],_request?:any){for(const page of p.pages)for(const im of page.images)need(s[im.asset_source_index]?.source_ref?.kind==='asset','绘本图像须引用固定宿主素材。');}
let fontBytes:Uint8Array|undefined;
async function fontData(){return fontBytes??=gunzipSync(await readFile(new URL('./fonts/HetuExportSansSC-Regular.ttf.gz',import.meta.url)).catch(()=>readFile(new URL('../../dist/fonts/HetuExportSansSC-Regular.ttf.gz',import.meta.url))));}
export async function load(p:any,s:any[],request:any){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const bytes=await fontData(),face=(fontkit as any).create(bytes),font=await doc.embedFont(bytes,{subset:true});
 const text=p.pages.flatMap((v:any)=>v.texts.map((t:any)=>t.text)).join('');
 const missing=[...new Set([...text].filter(c=>!/[\r\n\t]/.test(c)&&!face.hasGlyphForCodePoint(c.codePointAt(0))))];
 const images=new Map<number,any>();let total=0;
 for(const page of p.pages)for(const im of page.images)if(!images.has(im.asset_source_index)){
  const b=await readBlob(s[im.asset_source_index]?.source_ref,request,2*1024*1024);total+=b.length;need(total<=8*1024*1024,'绘本图像合计超过8MiB。','hetu.budget_exceeded');
  const header=imageHeader(b);need(header.width*header.height<=20000000,'单图最多2000万像素。','hetu.budget_exceeded');
  const png=b[0]===137&&b.toString('ascii',1,4)==='PNG';need(png||(b[0]===255&&b[1]===216),'仅支持PNG/JPEG。');
  const image=png?await doc.embedPng(b):await doc.embedJpg(b);need(image.width*image.height<=20000000,'单图最多2000万像素。','hetu.budget_exceeded');
  images.set(im.asset_source_index,{image,bytes:b,type:png?'png':'jpeg'});
 }
 return {doc,font,images,missing};
}
export function lines(t:any,font:any){return t.text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n').flatMap((raw:string)=>wrapLine(raw,pt(t.rect.width),(v:string)=>font.widthOfTextAtSize(v,t.font_size_pt)));}
export function layoutReport(p:any,loaded:any){
 const f=p.format,issues:any[]=[],add=(severity:string,code:string,page:any,block:any,message:string)=>issues.push({severity,code,page_id:page?.id??null,block_id:block?.id??null,message});
 if(!p.pages.length)add('error','empty',null,null,'尚无绘本页。');
 const nums=p.pages.map((x:any)=>x.number).sort((a:number,b:number)=>a-b);
 for(let n=1;n<=Math.max(0,...nums);n++)if(!nums.includes(n))add('error','missing_page',null,null,'缺少第'+n+'页。');
 if(f.binding==='saddle_stitch'&&p.pages.length%4)add('error','binding',null,null,'骑马钉总页数须为4的倍数，封面也计入。');
 if(loaded.missing.length)add('error','missing_glyph',null,null,'固定字体缺少：'+loaded.missing.slice(0,20).join(''));
 const pages:any[]=[];
 for(const page of p.pages){const measurements:any[]=[];
  for(const block of [...page.images,...page.texts]){const r=block.rect;if(r.x < -f.bleed_mm||r.y < -f.bleed_mm||r.x+r.width>f.width_mm+f.bleed_mm||r.y+r.height>f.height_mm+f.bleed_mm)add('error','outside_bleed',page,block,'图文框超出出血范围。');}
  for(const t of page.texts){const r=t.rect;if(r.x<f.safe_mm||r.y<f.safe_mm||r.x+r.width>f.width_mm-f.safe_mm||r.y+r.height>f.height_mm-f.safe_mm)add('warning','unsafe_text',page,t,'文字框进入安全边距，请确认装订和裁切。');
   if(!loaded.missing.length){const rows=lines(t,loaded.font),height=loaded.font.heightAtSize(t.font_size_pt)+(rows.length-1)*t.font_size_pt*t.line_height;
    const overflow=height>pt(r.height)+.001||rows.some((v:string)=>loaded.font.widthOfTextAtSize(v,t.font_size_pt)>pt(r.width)+.001);
    if(overflow)add('error','text_overflow',page,t,'文字实际排版超过文字框。');measurements.push({text_id:t.id,lines:rows.length,height_pt:height,overflow});}
  }
  for(const im of page.images){const image=loaded.images.get(im.asset_source_index).image,r=im.rect,scale=im.fit==='cover'?Math.max(r.width/image.width,r.height/image.height):Math.min(r.width/image.width,r.height/image.height),dpi=25.4/scale;
   if(dpi<f.target_dpi)add('warning','low_dpi',page,im,'图像有效分辨率'+Math.round(dpi)+'DPI低于目标'+f.target_dpi+'DPI。');measurements.push({image_id:im.id,effective_dpi:dpi,fit:im.fit});}
  pages.push({page_id:page.id,number:page.number,measurements});
 }
 return {pages,issues,can_export:!issues.some(v=>v.severity==='error'),stale_note_ids:p.notes.filter((n:any)=>n.page_sha256!==pageDigest(p,n.page_id)).map((n:any)=>n.id),note:'PDF按固定字体度量，HTML使用本机字体；RGB工程检查不等于印厂认证或儿童阅读验证。'};
}
export async function pdf(p:any,s:any[],request:any){
 const loaded=await load(p,s,request),report=layoutReport(p,loaded);need(report.can_export,'请先处理版面错误：'+report.issues.filter(v=>v.severity==='error').map(v=>v.message).join('；'));
 const {doc,font,images}=loaded,f=p.format,b=f.bleed_mm,w=pt(f.width_mm+2*b),h=pt(f.height_mm+2*b);
 doc.setTitle(p.title);doc.setProducer('Hetu Picturebook 0.1.0');doc.setCreationDate(new Date(0));doc.setModificationDate(new Date(0));
 for(const row of [...p.pages].sort((a,b)=>a.number-b.number)){
  const page=doc.addPage([w,h]);page.setTrimBox(pt(b),pt(b),pt(f.width_mm),pt(f.height_mm));page.setBleedBox(0,0,w,h);
  for(const im of row.images){const image=images.get(im.asset_source_index).image,r=im.rect,sw=pt(r.width),sh=pt(r.height),scale=im.fit==='cover'?Math.max(sw/image.width,sh/image.height):Math.min(sw/image.width,sh/image.height),iw=image.width*scale,ih=image.height*scale,x=pt(r.x+b),y=h-pt(r.y+b+r.height);
   page.pushOperators(pushGraphicsState(),rectangle(x,y,sw,sh),clip(),endPath());page.drawImage(image,{x:x+(sw-iw)/2,y:y+(sh-ih)/2,width:iw,height:ih});page.pushOperators(popGraphicsState());}
  for(const t of row.texts){const color=rgb(...([1,3,5].map(n=>parseInt(t.color.slice(n,n+2),16)/255) as [number,number,number])),rows=lines(t,font);let y=h-pt(t.rect.y+b)-font.heightAtSize(t.font_size_pt,{descender:false});
   for(const text of rows){page.drawText(text,{x:pt(t.rect.x+b),y,size:t.font_size_pt,font,color});y-=t.font_size_pt*t.line_height;}}
 }
 return doc.save();
}
export async function renderBook(p:any,s:any[],request:any){
 const loaded=await load(p,s,request),f=p.format;
 const body=spreads(p).map(row=>'<div class="spread">'+row.map(page=>'<article aria-label="第'+page.number+'页" style="aspect-ratio:'+f.width_mm+'/'+f.height_mm+'">'+page.images.map((im:any)=>{const v=loaded.images.get(im.asset_source_index);return '<img alt="'+esc(im.alt)+'" src="data:image/'+v.type+';base64,'+v.bytes.toString('base64')+'" style="'+rectStyle(im.rect,f)+'object-fit:'+im.fit+'">';}).join('')+page.texts.map((t:any)=>'<div class="text" style="'+rectStyle(t.rect,f)+'font-size:'+t.font_size_pt/pt(f.width_mm)*100+'cqw;line-height:'+t.line_height+';color:'+t.color+'">'+esc(t.text)+'</div>').join('')+'</article>').join('')+'</div>').join('');
 return htmlPage(p.title,'<style>body{max-width:1200px;font-size:16px}.spread{display:flex;gap:4px;justify-content:center;margin:24px 0;break-inside:avoid}.spread article{position:relative;container-type:inline-size;flex:0 1 48%;overflow:hidden;background:white;border:.5px solid #aaa}.spread img,.text{position:absolute;box-sizing:border-box;margin:0;max-width:none}.text{white-space:pre-wrap;font-family:system-ui}.spread img{height:auto}@media(max-width:600px){body{padding:8px}.spread{gap:2px}.spread article{flex-basis:49%}}</style><h1>'+esc(p.title)+'</h1>'+body+'<p>固定绘本阅读本。HTML使用本机字体；准确版面以嵌字PDF为准。</p>');
}
function rectStyle(r:any,f:any){return 'left:'+r.x/f.width_mm*100+'%;top:'+r.y/f.height_mm*100+'%;width:'+r.width/f.width_mm*100+'%;height:'+r.height/f.height_mm*100+'%;';}
export async function readProfessional(a:string,p:any,s:any[],i:any,r:any):Promise<any>{
 if(a==='check_layout')return layoutReport(p,await load(p,s,r));
 if(a==='page_digest')return {page_sha256:pageDigest(p,i.page_id)};
 if(a==='locate_page'){const page=find(p,i.page_id);return {page,source_refs:page.images.map((im:any)=>s[im.asset_source_index].source_ref)};}
 if(a==='render_book')return artifact(await renderBook(p,s,r),'绘本阅读本.html','text/html',i);
 if(a==='export_pdf')return artifact(await pdf(p,s,r),'绘本.pdf','application/pdf',i);
}
export async function pureAction(_a:string,_i:any){return undefined;}
export async function writeProfessional(..._args:any[]){need(false,'未知专业写动作。');}
export function validateTransition(_next?:any,_previous?:any,_action?:string){}
export function summaries(p:any){return [{title:'绘本规格',lines:[`${p.format.width_mm} × ${p.format.height_mm}毫米，出血${p.format.bleed_mm}毫米`]},{title:'图文与翻页',lines:[...p.pages].sort((a,b)=>a.number-b.number).map((v:any)=>`${v.number} ${v.title}：${v.texts.map((t:any)=>t.text).join(' ')}\n翻页意图：${v.turn_intent}`)},{title:'局部意见',lines:p.notes.map((n:any)=>n.comment)}];}
