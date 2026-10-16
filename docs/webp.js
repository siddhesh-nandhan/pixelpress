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
