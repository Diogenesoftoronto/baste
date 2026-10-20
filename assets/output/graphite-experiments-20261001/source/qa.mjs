import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/home/diogenes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('../qa/',import.meta.url).pathname; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/diogenes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('[fabric]'))errors.push(m.text())});
const results=[];const record=(value)=>{results.push(value);console.log(value.check,value.pass);};
const preview=page.locator('.material-preview canvas');
const snap=async()=>createHash('sha256').update(await preview.evaluate(c=>c.toDataURL())).digest('hex');
const pause=async()=>{await page.waitForTimeout(250);const b=page.getByRole('button',{name:'Pause motion',exact:true});if(await b.count())await b.click();await page.waitForFunction(()=>document.querySelector('.material-toolbar button')?.textContent==='Resume motion');await page.getByRole('checkbox',{name:'Follow pointer & touch'}).uncheck();await page.waitForTimeout(700)};
try {
 await page.goto('http://127.0.0.1:5211/materials/',{waitUntil:'networkidle'});await preview.waitFor();await page.waitForFunction(()=>document.querySelector('.material-preview canvas')?.dataset.ready==='true');console.log('preview ready');
 assert.equal(await page.getByLabel('Technique',{exact:true}).inputValue(),'flow');record({check:'Initial technique matches displayed material',pass:true});
 await pause(); await page.mouse.move(1400,20); await page.waitForTimeout(500);
 const stillA=await snap();await page.waitForTimeout(700);assert.equal(await snap(),stillA);record({check:'Paused material holds its frame',pass:true});
 const seeds={};
 for(const [name,mode] of [['Thread current','flow'],['Shot silk','cloth'],['Interference','moire'],['Chalk islands','contour'],['Oxide bath','marble'],['Radial pleat','radial']]) {
  await page.getByRole('button',{name:new RegExp(name)}).click(); await pause();
  assert.equal(await page.getByLabel('Technique',{exact:true}).inputValue(),mode);
  const hash=await snap();assert(!Object.values(seeds).includes(hash));seeds[mode]=hash;
  await page.getByRole('checkbox',{name:'Show type'}).uncheck();await page.screenshot({path:out+mode+'.png',fullPage:false});
 }
 record({check:'Six shader techniques produce distinct frames',pass:true,hashes:seeds});
 await page.getByRole('button',{name:/Thread current/}).click();await pause();await page.getByLabel('Seed',{exact:true}).fill('123');await page.waitForTimeout(500);const seed123=await snap();
 await page.getByLabel('Seed',{exact:true}).fill('124');await page.waitForTimeout(500);assert.notEqual(await snap(),seed123);
 await page.getByLabel('Seed',{exact:true}).fill('123');await page.waitForTimeout(500);assert.equal(await snap(),seed123);record({check:'Seeds vary the field and reproduce it exactly while still',pass:true});
 await page.getByRole('button',{name:'Use After hours palette'}).click();await page.waitForTimeout(500);const changed=await snap();assert.notEqual(changed,seed123);
 await page.getByLabel('Colour blending',{exact:true}).selectOption('hue');await page.waitForTimeout(500);assert.notEqual(await snap(),changed);record({check:'Palette and hue interpolation visibly change colour',pass:true});
 const hueRange=page.getByRole('slider',{name:'Hue rotation',exact:true});await hueRange.fill('180');await hueRange.dispatchEvent('input');await page.waitForTimeout(300);assert.notEqual(await snap(),changed);
 await page.getByRole('button',{name:'Resume motion'}).click();await page.getByRole('checkbox',{name:'Let the dyes cycle'}).check();await page.waitForTimeout(600);const moving=await snap();await page.waitForTimeout(800);assert.notEqual(await snap(),moving);record({check:'Motion and cycling advance visible material',pass:true});
 await pause();await page.getByRole('checkbox',{name:'Follow pointer & touch'}).check();const box=await preview.boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.4);await page.waitForTimeout(1500);const bent=await snap();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2);await page.waitForTimeout(1500);assert.notEqual(await snap(),bent);record({check:'Pointer bends the field while ambient motion is paused',pass:true});
 await page.mouse.click(box.x+box.width*.65,box.y+box.height*.5);const pulse=await snap();await page.waitForTimeout(400);assert.notEqual(await snap(),pulse);record({check:'Tap produces an evolving ripple',pass:true});
 await page.getByRole('checkbox',{name:'Follow pointer & touch'}).uncheck();
 const pngPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const png=await pngPromise;await png.saveAs(out+'export.png');record({check:'PNG export downloads successfully',pass:true,file:png.suggestedFilename()});
 const recipePromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save recipe'}).click();const recipe=await recipePromise;await recipe.saveAs(out+'recipe.json');
 const original=await page.getByLabel('Seed',{exact:true}).inputValue();await page.getByLabel('Seed',{exact:true}).fill('888');await page.locator('input[type=file]').setInputFiles(out+'recipe.json');await page.waitForTimeout(500);assert.equal(await page.getByLabel('Seed',{exact:true}).inputValue(),original);record({check:'Recipe export/import restores material',pass:true});
 await page.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":55}')});assert.match(await page.getByRole('status').innerText(),/version 1/);assert.equal(await page.getByLabel('Seed',{exact:true}).inputValue(),original);
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(800);assert.equal(await page.getByLabel('Seed',{exact:true}).inputValue(),original);record({check:'Settings survive reload and malformed import leaves settings intact',pass:true});
 await page.getByRole('button',{name:'Use behind Baste'}).click();await page.waitForFunction(()=>!!localStorage.getItem('baste:backdrop:v1'));await page.waitForFunction(()=>{const g=document.querySelector('canvas').getContext('webgl');return g.getUniform(g.getParameter(g.CURRENT_PROGRAM),g.getUniformLocation(g.getParameter(g.CURRENT_PROGRAM),'uPattern'))===1;});assert(await page.evaluate(()=>localStorage.getItem('baste:backdrop:v1')));await page.getByRole('button',{name:'Restore original linen'}).click();await page.waitForFunction(()=>localStorage.getItem('baste:backdrop:v1')===null);await page.waitForFunction(()=>{const g=document.querySelector('canvas').getContext('webgl');return g.getUniform(g.getParameter(g.CURRENT_PROGRAM),g.getUniformLocation(g.getParameter(g.CURRENT_PROGRAM),'uPattern'))===0;});assert.equal(await page.evaluate(()=>localStorage.getItem('baste:backdrop:v1')),null);record({check:'Apply and restore background persist correctly',pass:true});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);assert(await page.getByRole('checkbox',{name:'Follow pointer & touch'}).isDisabled());assert(await page.getByRole('slider',{name:'Motion speed',exact:true}).isDisabled());const reducedA=await snap();await page.waitForTimeout(700);assert.equal(await snap(),reducedA);record({check:'Reduced motion freezes animation and disables movement controls',pass:true});
 const noGl=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await noGl.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:original.call(this,kind,...args)}});const fallback=await noGl.newPage();await fallback.goto('http://127.0.0.1:5211/materials/',{waitUntil:'networkidle'});assert(await fallback.getByRole('button',{name:'Export PNG',exact:true}).isDisabled());assert.equal(await fallback.evaluate(()=>document.documentElement.scrollWidth),390);record({check:'No-WebGL fallback and mobile have no overflow',pass:true});await noGl.close();
 await preview.evaluate(c=>c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>document.querySelector('.material-actions button').disabled);assert.match(await page.getByRole('status').innerText(),/interrupted/);record({check:'Context loss explains recovery and disables image export',pass:true});
 assert.deepEqual(errors,[]);
 record({check:'No browser or shader errors',pass:true});
} catch(error){record({check:'Browser verification',pass:false,error:error.stack});process.exitCode=1;}
finally{await writeFile(out+'interaction-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();}
