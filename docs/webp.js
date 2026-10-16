import encoderFactory from './vendor/webp/codec/enc/webp_enc.js';
import decoderFactory from './vendor/webp/codec/dec/webp_dec.js';
import {defaultOptions} from './vendor/webp/meta.js';
import {decodePNG8} from './engine.js';
let encoder,decoder;
export async function toWebP(bytes,effort){
const source=await decodePNG8(bytes);
encoder??=encoderFactory();decoder??=decoderFactory();
const enc=await encoder,dec=await decoder;
const encoded=enc.encode(source.data,source.width,source.height,{...defaultOptions,lossless:1,exact:1,quality:100,method:effort==='maximum'?6:4});
if(!encoded)throw Error('WebP encoding failed.');
const out=new Uint8Array(encoded),check=dec.decode(out);
if(!check||check.width!==source.width||check.height!==source.height||check.data.length!==source.data.length||!check.data.every((v,i)=>v===source.data[i]))throw Error('WebP verification failed. Original file is untouched.');
return {bytes:out,note:'Lossless WebP · pixels verified · metadata not copied',extension:'webp',mime:'image/webp'};
}

// Original-format WebP: lossless files are re-encoded at higher effort and pixel-verified; EXIF, ICC and XMP chunks are carried over.
// Lossy and animated files are preserved, because shrinking them would change pixels or frames.
const tag=(b,p)=>String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]),u32=(b,p)=>b[p]|b[p+1]<<8|b[p+2]<<16|(b[p+3]<<24>>>0);
export function isWebP(b){return b.length>=12&&tag(b,0)==='RIFF'&&tag(b,8)==='WEBP';}
function riffChunks(b){const out=[];let p=12;while(p+8<=b.length){const type=tag(b,p),size=u32(b,p+4);if(p+8+size>b.length)throw Error('Damaged WebP file.');out.push({type,data:b.subarray(p+8,p+8+size)});p+=8+size+(size&1);}return out;}
function riffChunk(type,data){const out=new Uint8Array(8+data.length+(data.length&1)),v=new DataView(out.buffer);for(let i=0;i<4;i++)out[i]=type.charCodeAt(i);v.setUint32(4,data.length,true);out.set(data,8);return out;}
function riff(chunks){const body=chunks.reduce((n,c)=>n+c.length,0),out=new Uint8Array(12+body),v=new DataView(out.buffer);out.set([82,73,70,70]);v.setUint32(4,4+body,true);out.set([87,69,66,80],8);let p=12;for(const c of chunks){out.set(c,p);p+=c.length;}return out;}
export async function optimizeWebP(bytes,effort){
if(!isWebP(bytes))throw Error('This is not a WebP file.');
const chunks=riffChunks(bytes),types=chunks.map(c=>c.type);
if(types.includes('ANIM'))return {bytes,note:'Animated WebP preserved · convert with “Use first frame” for a still image'};
if(!types.includes('VP8L'))return {bytes,note:'Lossy WebP preserved · choose “Convert to WebP · lossy” to shrink further'};
encoder??=encoderFactory();decoder??=decoderFactory();
const enc=await encoder,dec=await decoder,source=dec.decode(bytes);
if(!source)throw Error('This WebP file could not be decoded.');
const encoded=enc.encode(source.data,source.width,source.height,{...defaultOptions,lossless:1,exact:1,quality:100,method:effort==='maximum'?6:5});
if(!encoded)throw Error('WebP encoding failed.');
const bitstream=riffChunks(new Uint8Array(encoded)).find(c=>c.type==='VP8L');
if(!bitstream)throw Error('WebP encoding failed.');
const keep=chunks.filter(c=>['ICCP','EXIF','XMP '].includes(c.type));let out;
if(keep.length){const vp8x=chunks.find(c=>c.type==='VP8X'),head=new Uint8Array(10),v=new DataView(head.buffer);const has=t=>keep.some(c=>c.type===t);head[0]=(has('ICCP')?0x20:0)|((vp8x?vp8x.data[0]:0x10)&0x10)|(has('EXIF')?0x08:0)|(has('XMP ')?0x04:0);v.setUint16(4,(source.width-1)&0xffff,true);head[6]=(source.width-1)>>16;v.setUint16(7,(source.height-1)&0xffff,true);head[9]=(source.height-1)>>16;
  const pick=t=>keep.filter(c=>c.type===t).map(c=>riffChunk(c.type,c.data));out=riff([riffChunk('VP8X',head),...pick('ICCP'),riffChunk('VP8L',bitstream.data),...pick('EXIF'),...pick('XMP ')]);}
else out=riff([riffChunk('VP8L',bitstream.data)]);
const check=dec.decode(out);
if(!check||check.width!==source.width||check.height!==source.height||!check.data.every((v,i)=>v===source.data[i]))throw Error('WebP verification failed. Original file is untouched.');
if(out.length>=bytes.length)return {bytes,note:'Lossless WebP already optimal · original kept'};
return {bytes:out,note:`Lossless WebP · pixels verified${keep.length?' · metadata preserved':''}`};
}
