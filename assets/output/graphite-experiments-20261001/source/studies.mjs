import { join } from 'node:path';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { V, TEMPLATES, call, client, root } from './graphite.mjs';
const out = join(root,'..');
const { protoNodeEntry: proto, nodeInput: node, nonePrimaryValue: none, f64Value: f64, boolValue: bool, u32Value: u32, dVec2Value: vec, stringValue: str, genericWrapperNode: graphic, monitorTransformWrapperNode: transform, artboardWrapperNode: artboard, assembleDocument: assemble } = V;
const tag = (key,value) => ({Value:{tagged_value:{[key]:value},exposed:false}});
const color = (hex,alpha=1) => {
 const a=hex.replace('#','').match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return {red:a[0],green:a[1],blue:a[2],alpha,linear:true};
};
function ramp(colors,space='OkLab') {
 return tag('GradientRamp',{stops:{color:colors.map(c=>color(c)),position:colors.map((_,i)=>i/(colors.length-1)),midpoint:colors.map(()=>.5)},gradient_space:space});
}
const palettes = [
 ['#24221D','#D2402A','#F0C534','#F1ECE2'],
 ['#1D3030','#237967','#D99E43','#E3E8DA'],
 ['#242638','#7B65B2','#F07858','#F1DFCC'],
 ['#203657','#2F55A4','#94ADCC','#EEE5DB'],
 ['#30252C','#B4315E','#D0A3BA','#E9DFCB'],
];
function bath(round,width,height,animated=false,strata=false) {
 const colors=palettes[round];
 const doc=TEMPLATES['duotone-image'].build({width,height,seed:417+round*137,scale:145+round*36,dark:color(colors[0]),light:color(colors[3])});
 const entries=doc.network_interface.network.nodes.filter(([id])=>id!==104);
 const noise=entries.find(([id])=>id===101)[1];
 noise.inputs[6]=f64(100+round*70); noise.inputs[7]=tag('FractalType',strata?'FBm':'PingPong'); noise.inputs[8]=u32(4);
 let gradient=ramp(colors,round===3?'OkLCh':'OkLab');
 if (strata) {
   const stripes=[];
   for(let i=0;i<16+round*4;i++)stripes.push(i%3===0?colors[1]:i%3===1?colors[3]:colors[0]);
   gradient=ramp(stripes,'RgbGamma');
 }
 entries.push([110,proto('math_nodes::GradientCyclicNode',[gradient,bool(true)])]);
 entries.push([111,proto('graphene_core::animation::AnimationTimeNode',[none(),f64(animated?.125:0)])]);
 entries.push([112,proto('math_nodes::GradientShiftNode',[node(110),animated?node(111):f64(round*.04)])]);
 entries.find(([id])=>id===102)[1].inputs[1]=node(112);
 if(animated) {
  entries.push([113,proto('math_nodes::MathNode',[node(111),str('sin(A * 6.283185307179586) * 90 + 180'),f64(1)])]);
  noise.inputs[6]=node(113);
 }
 entries.push([104,artboard(103,{x:0,y:0,width,height,background:color(colors[0])})]);
 return assemble(entries,104);
}
function geometry(round,width,height,animated=false,moire=false) {
 const colors=palettes[round]; const entries=[]; let next=101;
 const add=n=>{ const id=next++; entries.push([id,n]);return id; };
 const time=add(proto('graphene_core::animation::AnimationTimeNode',[none(),f64(animated?45:0)]));
 const gr=add(proto('math_nodes::GradientCyclicNode',[ramp(colors),bool(true)]));
 const phase=add(proto('math_nodes::MathNode',[node(time),str('A / 360'),f64(1)]));
 const shift=add(proto('math_nodes::GradientShiftNode',[node(gr),animated?node(phase):f64(round*.06)]));
 const rect=add(proto('vector_nodes::generator_nodes::RectangleNode',[none(),f64(moire?width*2:10+round*3),f64(moire?2.5+round*.5:height*1.7),tag('BoxCorners',[0]),bool(true),bool(false)]));
 const fill=add(proto('graphene_core::vector::FillNode',[node(rect),node(shift),V.colorValue(color(colors[1])),ramp(colors),tag('GradientForm','Linear'),bool(false),V.dAffine2Value([1,0,0,1,0,0])]));
 const g=add(graphic(fill));
 let repeated;
 if(moire){
   repeated=add(proto('repeat_nodes::repeat_nodes::RepeatArrayNode',[node(g),vec(0,height*1.7),f64(0),u32(70+round*15)]));
   const moved=add(transform(repeated,{translation:[width*.5,-height*.35],rotation:round*3}));
   const second=add(transform(repeated,{translation:[width*.5,-height*.35],rotation:8+round*2}));
   if(animated) entries.find(([id])=>id===second)[1].inputs[2]=node(time);
   repeated=add(proto('graphic_nodes::graphic::ExtendNode',[node(moved),node(second)]));
 } else {
   repeated=add(proto('repeat_nodes::repeat_nodes::RepeatRadialNode',[node(g),animated?node(time):f64(round*7),f64(0),u32(24+round*10)]));
   repeated=add(transform(repeated,{translation:[width*(.56+round*.035),height*.5]}));
 }
 const board=add(artboard(repeated,{x:0,y:0,width,height,background:color(colors[3])}));
 return assemble(entries,board);
}
const families=[['chromatic-bath','Multi-stop perceptual gradient, cyclic shift, domain-warped fractal noise',bath],['chalk-strata','Repeated colour stops turn a height field into contour strata',(r,w,h,a)=>bath(r,w,h,a,true)],['radial-dye','Repeated radial geometry and time-driven colour/rotation',geometry],['interference-weave','Two rotated arrays of dyed geometry form interference bands',(r,w,h,a)=>geometry(r,w,h,a,true)]];
const records=[];
await mkdir(join(root,'documents'),{recursive:true}); await mkdir(join(root,'candidates'),{recursive:true});
try {
 if(!process.argv.includes('--final-only')) for(const [family,features,build] of families)for(let round=0;round<5;round++) {
   const id=`baste-${family}-r${round+1}-20261001`;
   const document=build(round,1024,640);
   await writeFile(join(root,'documents',id+'.graphite'),JSON.stringify(document,null,2));
   const validation=await call('graphite_validate_doc',{document});
   const rendered=await call('graphite_render',{document,output:{format:'png',width:1024,height:640,outputName:id}});
   console.log(id,JSON.stringify(rendered).slice(0,700));
   const source=rendered.artifactPath;
   if(!source) { await writeFile(join(root,'render-debug.json'),JSON.stringify(rendered,null,2)); throw new Error('Check render result path'); }
   await copyFile(source,join(root,'candidates',id+'.png'));
   records.push({id,family,round:round+1,features,palette:palettes[round],parameters:{seed:417+round*137},validation,rendered});
   await writeFile(join(root,'candidate-archive.json'),JSON.stringify(records,null,2));
 }
 if(process.argv.includes('--final') || process.argv.includes('--final-only'))for(const [family,features,build] of families) {
   const round=family==='interference-weave'?3:family==='radial-dye'?2:family==='chalk-strata'?3:0;
   const id=`baste-${family}-2560x1600-20261001`;
   const document=build(round,2560,1600);
   await writeFile(join(root,'documents',id+'.graphite'),JSON.stringify(document,null,2));
   const rendered=await call('graphite_render',{document,output:{format:'png',width:2560,height:1600,outputName:id}});
   await copyFile(rendered.artifactPath,join(out,'images',id+'.png'));
   console.log(id,rendered.validation.valid,rendered.exitCode);
   await writeFile(join(root,id+'-render.json'),JSON.stringify(rendered,null,2));
   if(family==='chromatic-bath' || family==='radial-dye') {
    const animated=build(round,640,400,true);
    const animationId=`baste-${family}-loop-20261001`;
    await writeFile(join(root,'documents',animationId+'.graphite'),JSON.stringify(animated,null,2));
    const gif=await call('graphite_render',{document:animated,output:{format:'gif',width:640,height:400,outputName:animationId,gif:{mode:'frames',fps:8,frames:64}}});
    await mkdir(join(out,'videos'),{recursive:true});
    await copyFile(gif.artifactPath,join(out,'videos',animationId+'.gif'));
    await writeFile(join(root,animationId+'-render.json'),JSON.stringify(gif,null,2));
    console.log(animationId,gif.validation.valid,gif.exitCode);
   }
 }
} finally {await client.close();}
