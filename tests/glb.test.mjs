import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// The bundled Draco decoder (emscripten) calls require('fs') when it detects Node; browsers never take that path.
globalThis.require??=createRequire(import.meta.url);
const {compressGLB}=await import('../docs/vendor/glb/glb.bundle.js');

// Builds a dense, uncompressed indexed grid as a minimal binary glTF.
function gridGLB(n=120){
  const pos=[],idx=[];
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)pos.push(x/n,Math.sin(x/9)*Math.cos(y/9)*.1,y/n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+n+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const p=new Uint8Array(new Float32Array(pos).buffer),i=new Uint8Array(new Uint32Array(idx).buffer),bin=new Uint8Array(p.length+i.length);bin.set(p);bin.set(i,p.length);
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],
    accessors:[{bufferView:0,componentType:5126,count:pos.length/3,type:'VEC3',min:[0,-.1,0],max:[1,.1,1]},{bufferView:1,componentType:5125,count:idx.length,type:'SCALAR'}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:p.length,target:34962},{buffer:0,byteOffset:p.length,byteLength:i.length,target:34963}],buffers:[{byteLength:bin.length}]};
  let js=new TextEncoder().encode(JSON.stringify(json));js=Uint8Array.from([...js,...new Array((4-js.length%4)%4).fill(32)]);
  const total=12+8+js.length+8+bin.length,out=new Uint8Array(total),v=new DataView(out.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,total,true);v.setUint32(12,js.length,true);v.setUint32(16,0x4e4f534a,true);out.set(js,20);
  const o=20+js.length;v.setUint32(o,bin.length,true);v.setUint32(o+4,0x004e4942,true);out.set(bin,o+8);return out;
}
test('GLB mesh compression shrinks geometry and stays a valid GLB',async()=>{
  const input=gridGLB(),out=await compressGLB(input,{textureSize:0,meshQuality:'balanced'});
  assert.ok(out.bytes.length<input.length*0.6,`expected a clear reduction, got ${input.length} -> ${out.bytes.length}`);
  assert.equal(new TextDecoder().decode(out.bytes.subarray(0,4)),'glTF');
  const jsonLen=new DataView(out.bytes.buffer,out.bytes.byteOffset).getUint32(12,true),json=JSON.parse(new TextDecoder().decode(out.bytes.subarray(20,20+jsonLen)));
  assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'));
});
