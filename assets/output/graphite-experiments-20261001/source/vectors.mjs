import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { call, client, root } from './graphite.mjs';
await mkdir(join(root,'../svg'),{recursive:true});
try {
  for(const family of ['radial-dye','interference-weave']) {
    const document=JSON.parse(await readFile(join(root,`documents/baste-${family}-2560x1600-20261001.graphite`),'utf8'));
    const result=await call('graphite_render',{document,output:{format:'svg',width:2560,height:1600,outputName:`baste-${family}-20261001`}});
    await copyFile(result.artifactPath,join(root,`../svg/baste-${family}-20261001.svg`));
    await copyFile(result.artifactPath,join(root,`../../../site/public/materials/graphite/${family}.svg`));
    await writeFile(join(root,`${family}-svg-render.json`),JSON.stringify(result,null,2));
  }
} finally { await client.close(); }
