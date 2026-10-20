import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const cache = path.join(os.homedir(), ".npm/_npx");
const install = fs.readdirSync(cache).map(d => path.join(cache,d,"node_modules/hyperframes/package.json")).find(p => fs.existsSync(p) && JSON.parse(fs.readFileSync(p)).version === "0.8.106");
if (!install) throw new Error("HyperFrames 0.8.106 dependency cache unavailable");
const require = createRequire(install);
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({executablePath:path.join(os.homedir(), ".cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell"),args:["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
 const page = await browser.newPage();
 await page.setViewport({width:1200,height:630,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(() => { window.__timelines = {}; });
 await page.goto(`file://${path.resolve("index.html")}`,{waitUntil:"networkidle0",timeout:60000});
 await page.evaluate(() => document.fonts.ready);
 await page.waitForFunction(() => Object.keys(window.__timelines).length > 0);
 const fonts = await page.evaluate(async () => {
  const expected=[["Bodoni Moda",600,"italic"],["Bodoni Moda",400,"normal"],["IBM Plex Mono",400,"normal"],["Fraunces",700,"normal"],["Source Serif 4",400,"normal"],["Dela Gothic One",400,"normal"],["Instrument Sans",400,"normal"],["VT323",400,"normal"],["IBM Plex Sans",400,"normal"]];
  return await Promise.all(expected.map(async ([family,weight,style]) => {
   const loaded = await document.fonts.load(`${style} ${weight} 34px "${family}"`,"Baste Mycelial network topology Point-of-sale systems Lost media");
   return {family,weight,style,loadedFaces:loaded.length,loaded:loaded.length>0 && loaded.every(f=>f.status==="loaded")};
  }));
 });
 if(fonts.some(f=>!f.loaded)) throw new Error(`Unloaded fonts: ${JSON.stringify(fonts)}`);
 fs.mkdirSync("snapshots/loop",{recursive:true});
 const states=[];
 for(const t of [0,8,0]) {
  await page.evaluate(t=>{const tl=Object.values(window.__timelines)[0];tl.pause();tl.seek(t,false);},t);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path:`snapshots/loop/raw-${t}${states.length===2?"-reseek":""}.png`});
  states.push(await page.evaluate(()=>Array.from(document.querySelectorAll(".pin,.pin-head,.fold,#fitting-0,#cloth-0,#notes-0")).map(el=>({id:el.id,classes:el.className,style:el.getAttribute("style"),computed:{transform:getComputedStyle(el).transform,opacity:getComputedStyle(el).opacity,background:getComputedStyle(el).background,box:JSON.stringify(el.getBoundingClientRect())}}))));
 }
 const report={fonts,allFontsLoaded:true,seam:{times:[0,8],reverseSeekCaptured:true},renderSize:[1200,630]};
 fs.mkdirSync("verification",{recursive:true});
 fs.writeFileSync("verification/fonts-seam.json",JSON.stringify(report,null,2));
 fs.writeFileSync("verification/seam-states.json",JSON.stringify(states,null,2));
 console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
