'use strict';
/* Generate a 256x256 RGBA Windows .ico using Node's built-in modules only.
 * Design: navy rounded tile, turquoise ring and geometric N.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const N=256, buf=Buffer.alloc(N*N*4);
function segmentDist(x,y,x1,y1,x2,y2){
  const vx=x2-x1,vy=y2-y1,t=Math.max(0,Math.min(1,((x-x1)*vx+(y-y1)*vy)/(vx*vx+vy*vy)));
  return Math.hypot(x-(x1+t*vx),y-(y1+t*vy));
}
for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const cx=Math.max(Math.abs(x-128)-99,0),cy=Math.max(Math.abs(y-128)-99,0);
  const inside=Math.hypot(cx,cy)<=29;
  let r=0,g=0,b=0,a=0;
  if(inside){
    r=8;g=39;b=76;a=255;
    const rad=Math.hypot(x-128,y-128);
    if(rad>95&&rad<104){r=9;g=187;b=167}
    if(rad>84&&rad<88){r=0;g=91;b=122}
    const d=Math.min(segmentDist(x,y,81,77,81,178),segmentDist(x,y,81,77,174,178),segmentDist(x,y,174,77,174,178));
    if(d<=12){
      const f=Math.max(0,Math.min(1,(y-65)/120));
      r=5;g=Math.round(213-35*f);b=Math.round(186+36*f);
    }
  }
  const i=(y*N+x)*4;buf[i]=r;buf[i+1]=g;buf[i+2]=b;buf[i+3]=a;
}
let table=[];
for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0}
function crc(src){let c=0xffffffff;for(const b of src)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function chunk(name,data){
 const t=Buffer.from(name,'ascii'),out=Buffer.alloc(12+data.length);
 out.writeUInt32BE(data.length,0);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),8+data.length);
 return out;
}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(N,0);ihdr.writeUInt32BE(N,4);ihdr[8]=8;ihdr[9]=6;
const raw=Buffer.alloc((N*4+1)*N);
for(let y=0;y<N;y++){raw[y*(N*4+1)]=0;buf.copy(raw,y*(N*4+1)+1,y*N*4,(y+1)*N*4)}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const entry=Buffer.alloc(22);entry.writeUInt16LE(0,0);entry.writeUInt16LE(1,2);entry.writeUInt16LE(1,4);
entry[6]=0;entry[7]=0;entry[8]=0;entry[9]=0;entry.writeUInt16LE(1,10);entry.writeUInt16LE(32,12);entry.writeUInt32LE(png.length,14);entry.writeUInt32LE(22,18);
fs.writeFileSync(path.join(__dirname,'icon.ico'),Buffer.concat([entry,png]));
process.stdout.write('NineSoft Windows icon generated.\n');
