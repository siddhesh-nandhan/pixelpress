// Audio compression with ffmpeg.wasm, bundled in ./vendor so nothing is fetched from a third party.
// The ~30 MB engine only loads the first time an audio file is processed.
import {FFmpeg} from './vendor/ffmpeg/index.js';

export const PROFILES={
  mp3:{ext:'mp3',mime:'audio/mpeg',name:'MP3',args:b=>['-c:a','libmp3lame','-b:a',`${b}k`]},
  aac:{ext:'m4a',mime:'audio/mp4',name:'AAC',args:b=>['-c:a','aac','-b:a',`${b}k`,'-movflags','+faststart']},
  opus:{ext:'opus',mime:'audio/ogg',name:'Opus',// compression_level above 4 crashes this wasm build's libopus on stereo input
  args:b=>['-c:a','libopus','-b:a',`${b}k`,'-compression_level','4']},
  flac:{ext:'flac',mime:'audio/flac',name:'FLAC',args:()=>['-c:a','flac','-compression_level','8']}
};
let ready;
const asset=name=>new URL(`./vendor/ffmpeg-core/${name}`,import.meta.url).href;
function engine(){
  ready??=(async()=>{const ff=new FFmpeg();await ff.load({coreURL:asset('ffmpeg-core.js'),wasmURL:asset('ffmpeg-core.wasm')});return ff;})().catch(e=>{ready=null;throw Error('The audio engine could not load. Check your connection to this site and try again.');});
  return ready;
}
export async function compressAudio(bytes,fileName,{audioFormat='mp3',bitrate=128,mono=false}={},onStatus=()=>{}){
  const profile=PROFILES[audioFormat];if(!profile)throw Error('Unsupported audio output format.');
  onStatus({stage:'Loading audio engine (first time only)…'});
  const ff=await engine();
  const ext=(fileName.match(/\.([a-z0-9]+)$/i)?.[1]||'bin').toLowerCase(),input=`input.${ext}`,output=`output.${profile.ext}`;
  const logs=[],onLog=({message})=>{logs.push(message);if(logs.length>40)logs.shift();};
  let last=-1;const onProgress=({progress})=>{const pct=Math.max(0,Math.min(99,Math.round(progress*100)));if(pct!==last&&pct%5===0){last=pct;onStatus({stage:`Compressing audio on your device… ${pct}%`});}};
  ff.on('log',onLog);ff.on('progress',onProgress);
  try{
    onStatus({stage:'Compressing audio on your device…'});
    await ff.writeFile(input,bytes);
    const args=['-i',input,'-vn','-map_metadata','0',...(mono?['-ac','1']:[]),...profile.args(bitrate),output];
    const code=await ff.exec(args);
    if(code!==0)throw Error('This audio file could not be processed. It may be damaged or use an unsupported codec.');
    const out=await ff.readFile(output);
    if(!out||!out.length)throw Error('Compression produced an empty file.');
    const detail=audioFormat==='flac'?'FLAC · lossless':`${profile.name} · ${mono?'mono · ':''}${bitrate} kbps`;
    return {bytes:out,extension:profile.ext,mime:profile.mime,note:`${detail} · tags kept, cover art removed`};
  }catch(e){
    // A wasm trap leaves the engine unusable and is thrown as a bare string: reset so the next file starts clean.
    if(typeof e==='string'||e?.name==='RuntimeError'){try{ff.terminate();}catch{}ready=null;throw Error('The audio engine stopped unexpectedly on this file. Try another format or bitrate.');}
    throw e;
  }finally{
    ff.off('log',onLog);ff.off('progress',onProgress);
    for(const f of [input,output])try{await ff.deleteFile(f);}catch{}
  }
}
