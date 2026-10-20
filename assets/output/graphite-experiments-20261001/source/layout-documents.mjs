import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { call, client, root } from './graphite.mjs';
const cache=new Map(); const validations=[];
try {
 for(const file of (await readdir(join(root,'documents'))).filter(f=>f.endsWith('.graphite'))) {
  const path=join(root,'documents',file); const doc=JSON.parse(await readFile(path,'utf8'));
  const nodes=doc.network_interface.network.nodes;
  const metadata=[];
  for(let i=0;i<nodes.length;i++) {
   const [id,n]=nodes[i];const identifier=n.implementation.ProtoNode?.name;
   let descriptor;
   if(identifier) {
    if(!cache.has(identifier))cache.set(identifier,await call('graphite_describe_node',{identifier}));
    descriptor=cache.get(identifier);
   }
   const name=descriptor?.displayName??(n.inputs.length===7?'Transform':n.inputs.length===6?'Artboard':'Graphic');
   metadata.push([id,{persistent_metadata:{display_name:name,input_metadata:n.inputs.map((_,index)=>({persistent_metadata:{input_data:{},widget_override:null,input_name:descriptor?.fields[index]?.name??`Input ${index+1}`,input_description:descriptor?.fields[index]?.description??''}})),output_names:['Output'],locked:false,pinned:false,node_type_metadata:{Node:{position:{Absolute:[(i%4)*16,Math.floor(i/4)*14]}}},network_metadata:null}}]);
  }
  doc.network_interface.network_metadata.persistent_metadata.node_metadata=metadata;
  await writeFile(path,JSON.stringify(doc,null,2));
  const validation=await call('graphite_validate_doc',{document:doc});validations.push({file,...validation});
  for(const family of ['chromatic-bath','chalk-strata','radial-dye','interference-weave']) {
   if(file===`baste-${family}-2560x1600-20261001.graphite`)await copyFile(path,join(root,'../../../site/public/materials/graphite',family+'.graphite'));
   if(file===`baste-${family}-loop-20261001.graphite`)await copyFile(path,join(root,'../../../site/public/materials/graphite',family+'-loop.graphite'));
  }
 }
 await writeFile(join(root,'document-layout-validation.json'),JSON.stringify(validations,null,2));
 console.log(`${validations.length} node documents laid out and validated.`);
}finally{await client.close()}
