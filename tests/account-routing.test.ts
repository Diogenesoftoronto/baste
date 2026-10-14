import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
const fetch = (url: string, options: {method?: string; headers?: Record<string,string>; body?: string} = {}) => new Promise<Response>((resolve,reject)=>{
 const req=request(url,{method:options.method,headers:options.headers},res=>{
  const chunks:Buffer[]=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const headers=new Headers();for(const [key,value] of Object.entries(res.headers)){if(value!==undefined)for(const v of Array.isArray(value)?value:[value])headers.append(key,v);}resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});
 });req.on('error',reject);req.end(options.body);
});
import { createAccountAPIServer } from '../deployment/account-api.mjs';

test('account-only runtime serves policies and keeps review login, data and foreign hosts blocked', async () => {
  process.env.NOTORGANIC_ENABLED='true';
  process.env.BASTE_CONSENT_PREVIEW='false';
  const server=createAccountAPIServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=(server.address() as {port:number}).port;
  process.env.BASTE_PUBLIC_ORIGIN=`http://127.0.0.1:${port}`;
  const base=process.env.BASTE_PUBLIC_ORIGIN;
  // The server's allowed-host set was created before the test's random port.
  const headers={Host:'localhost:3456'};
  try {
    const status=await fetch(base+'/api/notorganic/status',{headers});assert.equal(status.status,200);
    const s=await status.json();assert.equal(s.authenticated,false);assert.equal(s.accessGranted,false);assert.equal(s.consent.canAccept,false);assert.equal(s.capabilities.imageGeneration,false);assert.equal(s.capabilities.serverConfigEdit,false);
    const cookie=status.headers.get('set-cookie')!.split(';')[0];assert.match(cookie,/^baste_session=/);
    const policy=await fetch(base+'/api/notorganic/consent/policy',{headers});assert.equal(policy.status,200);
    const p=await policy.json();assert.equal(p.policy.status,'review');assert.equal(p.policy.mode,null);assert.ok(p.copies.terms.fr.sections.length);assert.ok(p.copies.privacy.en.sections.length);
    const login=await fetch(base+'/api/notorganic/login',{method:'POST',headers:{...headers,Origin:base,Cookie:cookie,'X-Baste-CSRF':s.csrfToken,'Content-Type':'application/json'},body:'{}'});
    assert.equal(login.status,503);assert.equal((await login.json()).code,'baste_policy_not_adopted');
    const crossOrigin=await fetch(base+'/api/notorganic/login',{method:'POST',headers:{...headers,Origin:'https://attacker.invalid',Cookie:cookie,'X-Baste-CSRF':s.csrfToken},body:'{}'});assert.equal(crossOrigin.status,403);
    for(const path of ['/api/personas','/api/projects','/api/config','/api/notorganic/wallet','/api/notorganic/models','/api/notorganic/checkout','/gui/','/.env'])assert.equal((await fetch(base+path,{headers})).status,404,path);
    assert.equal((await fetch(base+'/health',{headers})).status,200);
    const health=await fetch(base+'/api/health',{headers});assert.equal(health.status,200);assert.equal((await health.json()).mode,'account-only');
    assert.equal((await fetch(base+'/api/notorganic/status',{headers:{Host:'attacker.invalid'}})).status,403);
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
