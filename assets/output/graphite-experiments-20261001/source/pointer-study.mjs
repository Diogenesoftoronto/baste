import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { call, client, V, root } from './graphite.mjs';
try {
  const doc = JSON.parse(await readFile(join(root,'documents/baste-radial-dye-loop-20261001.graphite'),'utf8'));
  const entries = doc.network_interface.network.nodes;
  const transform = entries.find(([_, n]) => n.inputs.length === 7 && n.inputs[1]?.Value?.tagged_value?.DVec2);
  if (!transform) throw new Error('Expected the radial field placement transform.');
  transform[1].inputs[1] = V.nodeInput(901);
  entries.push([901,V.protoNodeEntry('graphene_core::animation::PointerPositionNode',[])]);
  const path=join(root,'documents/baste-radial-dye-pointer-20261001.graphite');
  await writeFile(path,JSON.stringify(doc,null,2));
  const rendered=await call('graphite_render',{document:doc,output:{format:'png',width:640,height:400,outputName:'baste-radial-pointer-headless-proof'}});
  await writeFile(join(root,'pointer-node-validation.json'),JSON.stringify({node:'graphene_core::animation::PointerPositionNode',boundary:'Headless compilation/render only. Pointer defaults to origin; native editor interaction not exercised.',rendered},null,2));
  await copyFile(path,join(root,'../../../site/public/materials/graphite/radial-dye-pointer.graphite'));
} finally { await client.close(); }
