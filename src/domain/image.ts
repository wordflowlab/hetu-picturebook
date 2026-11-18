import {requireValue as need} from '../../vendor/project-store.ts';
export function imageHeader(b:Buffer){
 let width=0,height=0,type='';
 if(b.length>=33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){need(b.toString('ascii',12,16)==='IHDR'&&b.subarray(-12,-8).readUInt32BE(0)===0&&b.toString('ascii',b.length-8,b.length-4)==='IEND','PNG结构不完整。');width=b.readUInt32BE(16);height=b.readUInt32BE(20);type='png';}
 else if(b.length>=4&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217){type='jpeg';let at=2;while(at+4<=b.length){need(b[at]===255,'JPEG标记无效。');while(b[at]===255)at++;const marker=b[at++];if(marker===0xda||marker===0xd9)break;const len=b.readUInt16BE(at);need(len>=2&&at+len<=b.length,'JPEG片段截断。');if([0xc0,0xc1,0xc2].includes(marker)){need(len>=8,'JPEG尺寸缺失。');height=b.readUInt16BE(at+3);width=b.readUInt16BE(at+5);}at+=len;}}
 need(type&&width>0&&height>0&&width*height<=80000000,'仅支持结构完整、尺寸有效的PNG/JPEG，最多8000万像素。');return {type,width,height};
}
