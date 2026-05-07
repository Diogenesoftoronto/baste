import{j as y,d as Ce,s as Le,e as Re,F as V,g as Ne,c as G,i as E,a as v,b as ve,u as ae,f as Ae,h as ie,_ as k,k as De,l as Te,m as Be,n as B,o as Oe,p as X,q as $,r as Qe,S as Ue,t as Fe,v as ge,w as P,x as ze,y as we,z as Ve,A as me,B as Ge,C as Z}from"./q-Cm5jJe_M.js";const M={manifestHash:"ulj2e2",core:"q-DpTOlN7t.js",preloader:"q-DCiU_-rc.js",qwikLoader:"q-naDMFAHy.js",bundleGraphAsset:"assets/Cah32rul-bundle-graph.json",injections:[{tag:"link",location:"head",attributes:{rel:"stylesheet",href:"/assets/DNM5dT0n-style.css"}}],mapping:{s_Pw4m6VgWlD8:"q-BsxvfIax.js",s_Q9P7Fd4PwiI:"q-C11e6FXH.js",s_JHfbcsWVRck:"q-ltFkrcCj.js",s_AFaIiIzVb0M:"q-D8LTzRXg.js",s_03nl51tFbrk:"q-BsTuktaJ.js",s_2xdJrBVOUSk:"q-BY1VSUJ4.js",s_90VlmDrsW6E:"q-D_VNTojU.js",s_EIhEF4tKqYs:"q-Baq9TTy_.js",s_EMMTklGSEz4:"q-BbsASRA4.js",s_Jde8jNGV0vM:"q-DSQrvIld.js",s_L1VFvI3hLqY:"q-B_V6Rn32.js",s_LjbLpxn7f4k:"q-DN1NeXLG.js",s_M28cfZTLOOU:"q-C11e6FXH.js",s_O7hXAdJjT0A:"q-CCww890k.js",s_ZfPIrCNhF9E:"q-BUI1g1p6.js",s_bSslnliFpIA:"q-BzeacGg9.js",s_kYT0GiI235Q:"q-BsxvfIax.js",s_oed40oxWpiw:"q-BhaKq5er.js",s_qffZf6oUAr0:"q-DsubqBwG.js",s_soog9z0C0u8:"q-BOzlK6tX.js",s_uEJkQz3CRzk:"q-656L9o9m.js",s_z3eY59XRJ9Y:"q-DRJ8Q-ys.js",s_zKH4M0ocrUY:"q-DCvsOHMZ.js",s_9Sq0IO06ZrQ:"q-BsxvfIax.js",s_GnyiDAxo9yY:"q-CEfJlf-k.js",s_MwELpRbXRRg:"q-Dgkdogb1.js",s_Qc8ol2sIlro:"q--n7w2Nek.js",s_eg49EEcj36I:"q-CitxzizL.js",s_5vhkHm1RUJ8:"q-DSQrvIld.js",s_NrTVtTmrGmY:"q-BzeacGg9.js",s_YMVZU7j7zVk:"q-BsxvfIax.js",s_Z9omn2qVQOw:"q-BsxvfIax.js",s_awG9MO00z7I:"q-DN1NeXLG.js",s_b4vmSos2H9U:"q-DN1NeXLG.js",s_jnXq3zZOR0o:"q-BzeacGg9.js",s_vXYn60v3ksc:"q-BzeacGg9.js",s_ylTjP7c7mEA:"q-C11e6FXH.js"}};/**
 * @license
 * @builder.io/qwik/server 1.19.2
 * Copyright Builder.io, Inc. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/QwikDev/qwik/blob/main/LICENSE
 */var He=!1,Ye="",Je=(t,...e)=>{const n=Xe(He,t,...e);debugger;return n},We=t=>t,Xe=(t,e,...n)=>{const o=e instanceof Error?e:new Error(e);return console.error("%cQWIK ERROR",Ye,o.message,...We(n),o.stack),o},Ze=(t,...e)=>`Code(${t}) https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/core/error/error.ts#L${8+t}`,Ke=11,Me=(t,...e)=>{const n=Ze(t,...e);return Je(n,...e)},et="<sync>";function tt(t,e){const n=e==null?void 0:e.mapper,o=t.symbolMapper?t.symbolMapper:(s,i,a)=>{var l;if(n){const f=U(s),c=n[f];if(!c){if(f===et)return[f,""];if((l=globalThis.__qwik_reg_symbols)==null?void 0:l.has(f))return[s,"_"];if(a)return[s,`${a}?qrl=${s}`];console.error("Cannot resolve symbol",s,"in",n,a)}return c}};return{isServer:!0,async importSymbol(s,i,a){var c;const l=U(a),f=(c=globalThis.__qwik_reg_symbols)==null?void 0:c.get(l);if(f)return f;throw Me(Ke,a)},raf:()=>(console.error("server can not rerender"),Promise.resolve()),nextTick:s=>new Promise(i=>{setTimeout(()=>{i(s())})}),chunkForSymbol(s,i,a){return o(s,n,a)}}}async function nt(t,e){const n=tt(t,e);Le(n)}var U=t=>{const e=t.lastIndexOf("_");return e>-1?t.slice(e+1):t},rt="q:instance",ee={$DEBUG$:!1,$invPreloadProbability$:.65},ot=Date.now(),st=/\.[mc]?js$/,_e=0,at=1,it=2,lt=3,te,ne,ct=(t,e)=>({$name$:t,$state$:st.test(t)?_e:lt,$deps$:ke?e==null?void 0:e.map(n=>({...n,$factor$:1})):e,$inverseProbability$:1,$createdTs$:Date.now(),$waitedMs$:0,$loadedMs$:0}),ut=t=>{const e=new Map;let n=0;for(;n<t.length;){const o=t[n++],r=[];let s,i=1;for(;s=t[n],typeof s=="number";)s<0?i=-s/10:r.push({$name$:t[s],$importProbability$:i,$factor$:1}),n++;e.set(o,r)}return e},qe=t=>{let e=re.get(t);if(!e){let n;if(ne){if(n=ne.get(t),!n)return;n.length||(n=void 0)}e=ct(t,n),re.set(t,e)}return e},ft=(t,e)=>{e&&("debug"in e&&(ee.$DEBUG$=!!e.debug),typeof e.preloadProbability=="number"&&(ee.$invPreloadProbability$=1-e.preloadProbability)),!(te!=null||!t)&&(te="",ne=ut(t))},re=new Map,ke,F,Se=0,A=[],mt=(...t)=>{console.log(`Preloader ${Date.now()-ot}ms ${Se}/${A.length} queued>`,...t)},dt=()=>{re.clear(),F=!1,ke=!0,Se=0,A.length=0},ht=()=>{F&&(A.sort((t,e)=>t.$inverseProbability$-e.$inverseProbability$),F=!1)},pt=()=>{ht();let t=.4;const e=[];for(const n of A){const o=Math.round((1-n.$inverseProbability$)*10);o!==t&&(t=o,e.push(t)),e.push(n.$name$)}return e},$e=(t,e,n)=>{if(n!=null&&n.has(t))return;const o=t.$inverseProbability$;if(t.$inverseProbability$=e,!(o-t.$inverseProbability$<.01)&&(te!=null&&t.$state$<it&&(t.$state$===_e&&(t.$state$=at,A.push(t),ee.$DEBUG$&&mt(`queued ${Math.round((1-t.$inverseProbability$)*100)}%`,t.$name$)),F=!0),t.$deps$)){n||(n=new Set),n.add(t);const r=1-t.$inverseProbability$;for(const s of t.$deps$){const i=qe(s.$name$);if(i.$inverseProbability$===0)continue;let a;if(r===1||r>=.99&&oe<100)oe++,a=Math.min(.01,1-s.$importProbability$);else{const l=1-s.$importProbability$*r,f=s.$factor$,c=l/f;a=Math.max(.02,i.$inverseProbability$*c),s.$factor$=c}$e(i,a,n)}}},de=(t,e)=>{const n=qe(t);n&&n.$inverseProbability$>e&&$e(n,e)},oe,bt=(t,e)=>{if(!(t!=null&&t.length))return;oe=0;let n=e?1-e:.4;if(Array.isArray(t))for(let o=t.length-1;o>=0;o--){const r=t[o];typeof r=="number"?n=1-r/10:de(r,n)}else de(t,n)};function yt(t){const e=[],n=o=>{if(o)for(const r of o)e.includes(r.url)||(e.push(r.url),r.imports&&n(r.imports))};return n(t),e}var vt=t=>{var o;const e=Ne(),n=(o=t==null?void 0:t.qrls)==null?void 0:o.map(r=>{var l;const s=r.$refSymbol$||r.$symbol$,i=r.$chunk$,a=e.chunkForSymbol(s,i,(l=r.dev)==null?void 0:l.file);return a?a[1]:i}).filter(Boolean);return[...new Set(n)]};function gt(t,e,n){const o=e.prefetchStrategy;if(o===null)return[];if(!(n!=null&&n.manifest.bundleGraph))return vt(t);if(typeof(o==null?void 0:o.symbolsToPrefetch)=="function")try{const s=o.symbolsToPrefetch({manifest:n.manifest});return yt(s)}catch(s){console.error("getPrefetchUrls, symbolsToPrefetch()",s)}const r=new Set;for(const s of(t==null?void 0:t.qrls)||[]){const i=U(s.$refSymbol$||s.$symbol$);i&&i.length>=10&&r.add(i)}return[...r]}var wt=(t,e)=>{if(!(e!=null&&e.manifest.bundleGraph))return[...new Set(t)];dt();let n=.99;for(const o of t.slice(0,15))bt(o,n),n*=.85;return pt()},se=(t,e)=>{if(e==null)return null;const n=`${t}${e}`.split("/"),o=[];for(const r of n)r===".."&&o.length>0?o.pop():o.push(r);return o.join("/")},_t=(t,e,n,o,r)=>{var l;const s=se(t,(l=e==null?void 0:e.manifest)==null?void 0:l.preloader),i="/"+(e==null?void 0:e.manifest.bundleGraphAsset);if(s&&i&&n!==!1){const f=typeof n=="object"?{debug:n.debug,preloadProbability:n.ssrPreloadProbability}:void 0;ft(e==null?void 0:e.manifest.bundleGraph,f);const c=[];n!=null&&n.debug&&c.push("d:1"),n!=null&&n.maxIdlePreloads&&c.push(`P:${n.maxIdlePreloads}`),n!=null&&n.preloadProbability&&c.push(`Q:${n.preloadProbability}`);const u=c.length?`,{${c.join(",")}}`:"",d=`let b=fetch("${i}");import("${s}").then(({l})=>l(${JSON.stringify(t)},b${u}));`;o.push(y("link",{rel:"modulepreload",href:s,nonce:r,crossorigin:"anonymous"}),y("link",{rel:"preload",href:i,as:"fetch",crossorigin:"anonymous",nonce:r}),y("script",{type:"module",async:!0,dangerouslySetInnerHTML:d,nonce:r}))}const a=se(t,e==null?void 0:e.manifest.core);a&&o.push(y("link",{rel:"modulepreload",href:a,nonce:r}))},qt=(t,e,n,o,r)=>{if(o.length===0||n===!1)return null;const{ssrPreloads:s,ssrPreloadProbability:i}=St(typeof n=="boolean"?void 0:n);let a=s;const l=[],f=[],c=e==null?void 0:e.manifest.manifestHash;if(a){const h=e==null?void 0:e.manifest.preloader,m=e==null?void 0:e.manifest.core,w=wt(o,e);let q=4;const C=i*10;for(const b of w)if(typeof b=="string"){if(q<C)break;if(b===h||b===m)continue;if(f.push(b),--a===0)break}else q=b}const u=se(t,c&&(e==null?void 0:e.manifest.preloader));let g=f.length?`${JSON.stringify(f)}.map((l,e)=>{e=document.createElement('link');e.rel='modulepreload';e.href=${JSON.stringify(t)}+l;document.head.appendChild(e)});`:"";return u&&(g+=`window.addEventListener('load',f=>{f=_=>import("${u}").then(({p})=>p(${JSON.stringify(o)}));try{requestIdleCallback(f,{timeout:2000})}catch(e){setTimeout(f,200)}})`),g&&l.push(y("script",{type:"module","q:type":"preload",async:!0,dangerouslySetInnerHTML:g,nonce:r})),l.length>0?y(V,{children:l}):null},kt=(t,e,n,o,r)=>{var s;if(n.preloader!==!1){const i=gt(e,n,o);if(i.length>0){const a=qt(t,o,n.preloader,i,(s=n.serverData)==null?void 0:s.nonce);a&&r.push(a)}}};function St(t){return{...$t,...t}}var $t={ssrPreloads:7,ssrPreloadProbability:.5,debug:!1,maxIdlePreloads:25,preloadProbability:.35},Et='const t=document,e=window,n=new Set,o=new Set([t]);let r;const s=(t,e)=>Array.from(t.querySelectorAll(e)),a=t=>{const e=[];return o.forEach(n=>e.push(...s(n,t))),e},i=t=>{w(t),s(t,"[q\\\\:shadowroot]").forEach(t=>{const e=t.shadowRoot;e&&i(e)})},c=t=>t&&"function"==typeof t.then,l=(t,e,n=e.type)=>{a("[on"+t+"\\\\:"+n+"]").forEach(o=>{b(o,t,e,n)})},f=e=>{if(void 0===e._qwikjson_){let n=(e===t.documentElement?t.body:e).lastElementChild;for(;n;){if("SCRIPT"===n.tagName&&"qwik/json"===n.getAttribute("type")){e._qwikjson_=JSON.parse(n.textContent.replace(/\\\\x3C(\\/?script)/gi,"<$1"));break}n=n.previousElementSibling}}},p=(t,e)=>new CustomEvent(t,{detail:e}),b=async(e,n,o,r=o.type)=>{const s="on"+n+":"+r;e.hasAttribute("preventdefault:"+r)&&o.preventDefault(),e.hasAttribute("stoppropagation:"+r)&&o.stopPropagation();const a=e._qc_,i=a&&a.li.filter(t=>t[0]===s);if(i&&i.length>0){for(const t of i){const n=t[1].getFn([e,o],()=>e.isConnected)(o,e),r=o.cancelBubble;c(n)&&await n,r&&o.stopPropagation()}return}const l=e.getAttribute(s);if(l){const n=e.closest("[q\\\\:container]"),r=n.getAttribute("q:base"),s=n.getAttribute("q:version")||"unknown",a=n.getAttribute("q:manifest-hash")||"dev",i=new URL(r,t.baseURI);for(const p of l.split("\\n")){const l=new URL(p,i),b=l.href,h=l.hash.replace(/^#?([^?[|]*).*$/,"$1")||"default",q=performance.now();let _,d,y;const w=p.startsWith("#"),g={qBase:r,qManifest:a,qVersion:s,href:b,symbol:h,element:e,reqTime:q};if(w){const e=n.getAttribute("q:instance");_=(t["qFuncs_"+e]||[])[Number.parseInt(h)],_||(d="sync",y=Error("sym:"+h))}else{u("qsymbol",g);const t=l.href.split("#")[0];try{const e=import(t);f(n),_=(await e)[h],_||(d="no-symbol",y=Error(`${h} not in ${t}`))}catch(t){d||(d="async"),y=t}}if(!_){u("qerror",{importError:d,error:y,...g}),console.error(y);break}const m=t.__q_context__;if(e.isConnected)try{t.__q_context__=[e,o,l];const n=_(o,e);c(n)&&await n}catch(t){u("qerror",{error:t,...g})}finally{t.__q_context__=m}}}},u=(e,n)=>{t.dispatchEvent(p(e,n))},h=t=>t.replace(/([A-Z])/g,t=>"-"+t.toLowerCase()),q=async t=>{let e=h(t.type),n=t.target;for(l("-document",t,e);n&&n.getAttribute;){const o=b(n,"",t,e);let r=t.cancelBubble;c(o)&&await o,r||(r=r||t.cancelBubble||n.hasAttribute("stoppropagation:"+t.type)),n=t.bubbles&&!0!==r?n.parentElement:null}},_=t=>{l("-window",t,h(t.type))},d=()=>{const s=t.readyState;if(!r&&("interactive"==s||"complete"==s)&&(o.forEach(i),r=1,u("qinit"),(e.requestIdleCallback??e.setTimeout).bind(e)(()=>u("qidle")),n.has("qvisible"))){const t=a("[on\\\\:qvisible]"),e=new IntersectionObserver(t=>{for(const n of t)n.isIntersecting&&(e.unobserve(n.target),b(n.target,"",p("qvisible",n)))});t.forEach(t=>e.observe(t))}},y=(t,e,n,o=!1)=>{t.addEventListener(e,n,{capture:o,passive:!1})},w=(...t)=>{for(const r of t)"string"==typeof r?n.has(r)||(o.forEach(t=>y(t,r,q,!0)),y(e,r,_,!0),n.add(r)):o.has(r)||(n.forEach(t=>y(r,t,q,!0)),o.add(r))};if(!("__q_context__"in t)){t.__q_context__=0;const r=e.qwikevents;r&&(Array.isArray(r)?w(...r):w("click","input")),e.qwikevents={events:n,roots:o,push:w},y(t,"readystatechange",d),d()}',Pt=`const doc = document;
const win = window;
const events = /* @__PURE__ */ new Set();
const roots = /* @__PURE__ */ new Set([doc]);
let hasInitialized;
const nativeQuerySelectorAll = (root, selector) => Array.from(root.querySelectorAll(selector));
const querySelectorAll = (query) => {
  const elements = [];
  roots.forEach((root) => elements.push(...nativeQuerySelectorAll(root, query)));
  return elements;
};
const findShadowRoots = (fragment) => {
  processEventOrNode(fragment);
  nativeQuerySelectorAll(fragment, "[q\\\\:shadowroot]").forEach((parent) => {
    const shadowRoot = parent.shadowRoot;
    shadowRoot && findShadowRoots(shadowRoot);
  });
};
const isPromise = (promise) => promise && typeof promise.then === "function";
const broadcast = (infix, ev, type = ev.type) => {
  querySelectorAll("[on" + infix + "\\\\:" + type + "]").forEach((el) => {
    dispatch(el, infix, ev, type);
  });
};
const resolveContainer = (containerEl) => {
  if (containerEl._qwikjson_ === void 0) {
    const parentJSON = containerEl === doc.documentElement ? doc.body : containerEl;
    let script = parentJSON.lastElementChild;
    while (script) {
      if (script.tagName === "SCRIPT" && script.getAttribute("type") === "qwik/json") {
        containerEl._qwikjson_ = JSON.parse(
          script.textContent.replace(/\\\\x3C(\\/?script)/gi, "<$1")
        );
        break;
      }
      script = script.previousElementSibling;
    }
  }
};
const createEvent = (eventName, detail) => new CustomEvent(eventName, {
  detail
});
const dispatch = async (element, onPrefix, ev, eventName = ev.type) => {
  const attrName = "on" + onPrefix + ":" + eventName;
  if (element.hasAttribute("preventdefault:" + eventName)) {
    ev.preventDefault();
  }
  if (element.hasAttribute("stoppropagation:" + eventName)) {
    ev.stopPropagation();
  }
  const ctx = element._qc_;
  const relevantListeners = ctx && ctx.li.filter((li) => li[0] === attrName);
  if (relevantListeners && relevantListeners.length > 0) {
    for (const listener of relevantListeners) {
      const results = listener[1].getFn([element, ev], () => element.isConnected)(ev, element);
      const cancelBubble = ev.cancelBubble;
      if (isPromise(results)) {
        await results;
      }
      if (cancelBubble) {
        ev.stopPropagation();
      }
    }
    return;
  }
  const attrValue = element.getAttribute(attrName);
  if (attrValue) {
    const container = element.closest("[q\\\\:container]");
    const qBase = container.getAttribute("q:base");
    const qVersion = container.getAttribute("q:version") || "unknown";
    const qManifest = container.getAttribute("q:manifest-hash") || "dev";
    const base = new URL(qBase, doc.baseURI);
    for (const qrl of attrValue.split("\\n")) {
      const url = new URL(qrl, base);
      const href = url.href;
      const symbol = url.hash.replace(/^#?([^?[|]*).*$/, "$1") || "default";
      const reqTime = performance.now();
      let handler;
      let importError;
      let error;
      const isSync = qrl.startsWith("#");
      const eventData = {
        qBase,
        qManifest,
        qVersion,
        href,
        symbol,
        element,
        reqTime
      };
      if (isSync) {
        const hash = container.getAttribute("q:instance");
        handler = (doc["qFuncs_" + hash] || [])[Number.parseInt(symbol)];
        if (!handler) {
          importError = "sync";
          error = new Error("sym:" + symbol);
        }
      } else {
        emitEvent("qsymbol", eventData);
        const uri = url.href.split("#")[0];
        try {
          const module = import(
                        uri
          );
          resolveContainer(container);
          handler = (await module)[symbol];
          if (!handler) {
            importError = "no-symbol";
            error = new Error(\`\${symbol} not in \${uri}\`);
          }
        } catch (err) {
          importError || (importError = "async");
          error = err;
        }
      }
      if (!handler) {
        emitEvent("qerror", {
          importError,
          error,
          ...eventData
        });
        console.error(error);
        break;
      }
      const previousCtx = doc.__q_context__;
      if (element.isConnected) {
        try {
          doc.__q_context__ = [element, ev, url];
          const results = handler(ev, element);
          if (isPromise(results)) {
            await results;
          }
        } catch (error2) {
          emitEvent("qerror", { error: error2, ...eventData });
        } finally {
          doc.__q_context__ = previousCtx;
        }
      }
    }
  }
};
const emitEvent = (eventName, detail) => {
  doc.dispatchEvent(createEvent(eventName, detail));
};
const camelToKebab = (str) => str.replace(/([A-Z])/g, (a) => "-" + a.toLowerCase());
const processDocumentEvent = async (ev) => {
  let type = camelToKebab(ev.type);
  let element = ev.target;
  broadcast("-document", ev, type);
  while (element && element.getAttribute) {
    const results = dispatch(element, "", ev, type);
    let cancelBubble = ev.cancelBubble;
    if (isPromise(results)) {
      await results;
    }
    cancelBubble || (cancelBubble = cancelBubble || ev.cancelBubble || element.hasAttribute("stoppropagation:" + ev.type));
    element = ev.bubbles && cancelBubble !== true ? element.parentElement : null;
  }
};
const processWindowEvent = (ev) => {
  broadcast("-window", ev, camelToKebab(ev.type));
};
const processReadyStateChange = () => {
  const readyState = doc.readyState;
  if (!hasInitialized && (readyState == "interactive" || readyState == "complete")) {
    roots.forEach(findShadowRoots);
    hasInitialized = 1;
    emitEvent("qinit");
    const riC = win.requestIdleCallback ?? win.setTimeout;
    riC.bind(win)(() => emitEvent("qidle"));
    if (events.has("qvisible")) {
      const results = querySelectorAll("[on\\\\:qvisible]");
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            dispatch(entry.target, "", createEvent("qvisible", entry));
          }
        }
      });
      results.forEach((el) => observer.observe(el));
    }
  }
};
const addEventListener = (el, eventName, handler, capture = false) => {
  el.addEventListener(eventName, handler, { capture, passive: false });
};
const processEventOrNode = (...eventNames) => {
  for (const eventNameOrNode of eventNames) {
    if (typeof eventNameOrNode === "string") {
      if (!events.has(eventNameOrNode)) {
        roots.forEach(
          (root) => addEventListener(root, eventNameOrNode, processDocumentEvent, true)
        );
        addEventListener(win, eventNameOrNode, processWindowEvent, true);
        events.add(eventNameOrNode);
      }
    } else {
      if (!roots.has(eventNameOrNode)) {
        events.forEach(
          (eventName) => addEventListener(eventNameOrNode, eventName, processDocumentEvent, true)
        );
        roots.add(eventNameOrNode);
      }
    }
  }
};
if (!("__q_context__" in doc)) {
  doc.__q_context__ = 0;
  const qwikevents = win.qwikevents;
  if (qwikevents) {
    if (Array.isArray(qwikevents)) {
      processEventOrNode(...qwikevents);
    } else {
      processEventOrNode("click", "input");
    }
  }
  win.qwikevents = {
    events,
    roots,
    push: processEventOrNode
  };
  addEventListener(doc, "readystatechange", processReadyStateChange);
  processReadyStateChange();
}`;function xt(t={}){return t.debug?Pt:Et}function K(){if(typeof performance>"u")return()=>0;const t=performance.now();return()=>(performance.now()-t)/1e6}function It(t){let e=t.base;return typeof t.base=="function"&&(e=t.base(t)),typeof e=="string"?(e.endsWith("/")||(e+="/"),e):"/build/"}var jt="<!DOCTYPE html>";async function Ct(t,e){var le,ce;let n=e.stream,o=0,r=0,s=0,i=0,a="",l;const f=((le=e.streaming)==null?void 0:le.inOrder)??{strategy:"auto",maximunInitialChunk:5e4,maximunChunk:3e4},c=e.containerTagName??"html",u=e.containerAttributes??{},d=n,g=K(),h=It(e),m=Rt(e.manifest),w=(ce=e.serverData)==null?void 0:ce.nonce;function q(){a&&(d.write(a),a="",o=0,s++,s===1&&(i=g()))}function C(p){const _=p.length;o+=_,r+=_,a+=p}switch(f.strategy){case"disabled":n={write:C};break;case"direct":n=d;break;case"auto":let p=0,_=!1;const ue=f.maximunChunk??0,W=f.maximunInitialChunk??0;n={write(L){L==="<!--qkssr-f-->"?_||(_=!0):L==="<!--qkssr-pu-->"?p++:L==="<!--qkssr-po-->"?p--:C(L),p===0&&(_||o>=(s===0?W:ue))&&(_=!1,q())}};break}c==="html"?n.write(jt):n.write("<!--cq-->"),m||console.warn("Missing client manifest, loading symbols in the client might 404. Please ensure the client build has run and generated the manifest for the server build."),await nt(e,m);const b=m==null?void 0:m.manifest.injections,x=b?b.map(p=>y(p.tag,p.attributes??{})):[];let S=e.qwikLoader?typeof e.qwikLoader=="object"?e.qwikLoader.include==="never"?2:0:e.qwikLoader==="inline"?1:e.qwikLoader==="never"?2:0:0;const D=m==null?void 0:m.manifest.qwikLoader;if(S===0&&!D&&(S=1),S===0)x.unshift(y("link",{rel:"modulepreload",href:`${h}${D}`,nonce:w}),y("script",{type:"module",async:!0,src:`${h}${D}`,nonce:w}));else if(S===1){const p=xt({debug:e.debug});x.unshift(y("script",{id:"qwikloader",type:"module",async:!0,nonce:w,dangerouslySetInnerHTML:p}))}_t(h,m,e.preloader,x,w);const H=K(),Y=[];let T=0,I=0;await Ce(t,{stream:n,containerTagName:c,containerAttributes:u,serverData:e.serverData,base:h,beforeContent:x,beforeClose:async(p,_,ue,W)=>{T=H();const L=K();l=await Re(p,_,void 0,W);const R=[];kt(h,l,e,m,R);const je=JSON.stringify(l.state,void 0,void 0);if(R.push(y("script",{type:"qwik/json",dangerouslySetInnerHTML:Nt(je),nonce:w})),l.funcs.length>0){const N=u[rt];R.push(y("script",{"q:func":"qwik/json",dangerouslySetInnerHTML:Tt(N,l.funcs),nonce:w}))}const fe=Array.from(_.$events$,N=>JSON.stringify(N));if(fe.length>0){const N=`(window.qwikevents||(window.qwikevents=[])).push(${fe.join(",")})`;R.push(y("script",{dangerouslySetInnerHTML:N,nonce:w}))}return At(Y,p),I=L(),y(V,{children:R})},manifestHash:(m==null?void 0:m.manifest.manifestHash)||"dev"+Lt()}),c!=="html"&&n.write("<!--/cq-->"),q();const J=l.resources.some(p=>p._cache!==1/0);return{prefetchResources:void 0,snapshotResult:l,flushes:s,manifest:m==null?void 0:m.manifest,size:r,isStatic:!J,timing:{render:T,snapshot:I,firstFlush:i}}}function Lt(){return Math.random().toString(36).slice(2)}function Rt(t){const e=t?{...M,...t}:M;if(!e||"mapper"in e)return e;if(e.mapping){const n={};return Object.entries(e.mapping).forEach(([o,r])=>{n[U(o)]=[o,r]}),{mapper:n,manifest:e,injections:e.injections||[]}}}var Nt=t=>t.replace(/<(\/?script)/gi,"\\x3C$1");function At(t,e){var n;for(const o of e){const r=(n=o.$componentQrl$)==null?void 0:n.getSymbol();r&&!t.includes(r)&&t.push(r)}}var Dt='document["qFuncs_HASH"]=';function Tt(t,e){return Dt.replace("HASH",t)+`[${e.join(`,
`)}]`}const Bt=`
"serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations().then(r=>{for(const e of r){const c='/service-worker.js'.split("/").pop();e.active?.scriptURL.endsWith(c||"service-worker.js")&&e.unregister().catch(console.error)}}),"caches"in window&&caches.keys().then(r=>{const e=r.find(c=>c.startsWith("QwikBuild"));e&&caches.delete(e).catch(console.error)}).catch(console.error)
`,Ot=P("qc-s"),Qt=P("qc-c"),Ee=P("qc-ic"),Pe=P("qc-h"),xe=P("qc-l"),Ut=P("qc-n"),Ft=P("qc-a"),zt=P("qc-p"),Vt=Fe(ze("s_GnyiDAxo9yY")),Gt=()=>{if(!ae("containerAttributes"))throw new Error("PrefetchServiceWorker component must be rendered on the server.");Ae();const e=ie(Ee);if(e.value&&e.value.length>0){const n=e.value.length;let o=null;for(let r=n-1;r>=0;r--)e.value[r].default&&(o=k(e.value[r].default,{children:o},1,"of_0"));return k(V,{children:[o,v("script",{"document:onQCInit$":Vt,"document:onQInit$":De(()=>{((r,s)=>{var i;if(!r._qcs&&s.scrollRestoration==="manual"){r._qcs=!0;const a=(i=s.state)==null?void 0:i._qCityScroll;a&&r.scrollTo(a.x,a.y),document.dispatchEvent(new Event("qcinit"))}})(window,history)},'()=>{((w,h)=>{if(!w._qcs&&h.scrollRestoration==="manual"){w._qcs=true;const s=h.state?._qCityScroll;if(s){w.scrollTo(s.x,s.y);}document.dispatchEvent(new Event("qcinit"));}})(window,history);}')},null,null,2,"of_1")]},1,"of_2")}return Te},Ht=G(E(Gt,"s_oed40oxWpiw")),Yt=(t,e)=>new URL(t,e.href),he=(t,e)=>t.origin===e.origin,pe=t=>t.endsWith("/")?t:t+"/",Jt=({pathname:t},{pathname:e})=>{const n=Math.abs(t.length-e.length);return n===0?t===e:n===1&&pe(t)===pe(e)},Wt=(t,e)=>t.search===e.search,z=(t,e)=>Wt(t,e)&&Jt(t,e),Xt=t=>t&&typeof t.then=="function",Zt=(t,e,n,o)=>{const r=Ie(),i={head:r,withLocale:a=>me(o,a),resolveValue:a=>{const l=a.__id;if(a.__brand==="server_loader"&&!(l in t.loaders))throw new Error("You can not get the returned data of a loader that has not been executed for this request.");const f=t.loaders[l];if(Xt(f))throw new Error("Loaders returning a promise can not be resolved for the head function.");return f},...e};for(let a=n.length-1;a>=0;a--){const l=n[a]&&n[a].head;l&&(typeof l=="function"?be(r,me(o,()=>l(i))):typeof l=="object"&&be(r,l))}return i.head},be=(t,e)=>{typeof e.title=="string"&&(t.title=e.title),O(t.meta,e.meta),O(t.links,e.links),O(t.styles,e.styles),O(t.scripts,e.scripts),Object.assign(t.frontmatter,e.frontmatter)},O=(t,e)=>{if(Array.isArray(e))for(const n of e){if(typeof n.key=="string"){const o=t.findIndex(r=>r.key===n.key);if(o>-1){t[o]=n;continue}}t.push(n)}},Ie=()=>({title:"",meta:[],links:[],styles:[],scripts:[],frontmatter:{}}),Kt=()=>ie(Pe),Mt=()=>ie(xe),en=()=>ge(ae("qwikcity")),ye={},Q={navCount:0},tn=":root{view-transition-name:none}",nn=t=>{},rn=async(t,e)=>{const[n,o,r,s]=we(),{type:i="link",forceReload:a=t===void 0,replaceState:l=!1,scroll:f=!0}=typeof e=="object"?e:{forceReload:e};Q.navCount++;const c=r.value.dest,u=t===void 0?c:typeof t=="number"?t:Yt(t,s.url);if(ye.$cbs$&&(a||typeof u=="number"||!z(u,c)||!he(u,c))){const d=Q.navCount,g=await Promise.all([...ye.$cbs$.values()].map(h=>h(u)));if(d!==Q.navCount||g.some(Boolean)){d===Q.navCount&&i==="popstate"&&history.pushState(null,"",c);return}}if(typeof u!="number"&&he(u,c)){if(!a&&z(u,c)){if(u.href!==s.url.href){const d=new URL(u.href);r.value.dest=d,s.url=d}return}return r.value={type:i,dest:u,forceReload:a,replaceState:l,scroll:f},n.value=void 0,s.isNavigating=!0,new Promise(d=>{o.r=d})}},on=({track:t})=>{const[e,n,o,r,s,i,a,l,f,c,u]=we();async function d(){const h=t(c),m=t(e),w=Ve(""),q=u.url,C=m?"form":h.type;h.replaceState;let b,x,S=null;if(b=new URL(h.dest,u.url),S=s.loadedRoute,x=s.response,S){const[D,H,Y,T]=S,I=Y,J=I[I.length-1];h.dest.search&&z(b,q)&&(b.search=h.dest.search),z(b,q)||(u.prevUrl=q),u.url=b,u.params={...H},c.untrackedValue={type:C,dest:b};const j=Zt(x,u,I,w);n.headings=J.headings,n.menu=T,o.value=ge(I),r.links=j.links,r.meta=j.meta,r.styles=j.styles,r.scripts=j.scripts,r.title=j.title,r.frontmatter=j.frontmatter}}return d()},sn=t=>{Be(E(tn,"s_9Sq0IO06ZrQ"));const e=en();if(!(e!=null&&e.params))throw new Error("Missing Qwik City Env Data for help visit https://github.com/QwikDev/qwik/issues/6237");const n=ae("url");if(!n)throw new Error("Missing Qwik URL Env Data");if(e.ev.originalUrl.pathname!==e.ev.url.pathname)throw new Error('enableRequestRewrite is an experimental feature and is not enabled. Please enable the feature flag by adding `experimental: ["enableRequestRewrite"]` to your qwikVite plugin options.');const o=new URL(n),r=B({url:o,params:e.params,isNavigating:!1,prevUrl:void 0},{deep:!1}),s={},i=Oe(B(e.response.loaders,{deep:!1})),a=X({type:"initial",dest:o,forceReload:!1,replaceState:!1,scroll:!0}),l=B(Ie),f=B({headings:void 0,menu:void 0}),c=X(),u=e.response.action,d=u?e.response.loaders[u]:void 0,g=X(d?{id:u,data:e.response.formData,output:{result:d,status:e.response.status}}:void 0),h=E(nn,"s_Z9omn2qVQOw"),m=E(rn,"s_YMVZU7j7zVk",[g,s,a,r]);return $(Qt,f),$(Ee,c),$(Pe,l),$(xe,r),$(Ut,m),$(Ot,i),$(Ft,g),$(zt,h),Qe(E(on,"s_Pw4m6VgWlD8",[g,f,c,l,e,m,i,s,t,a,r])),k(Ue,null,3,"of_3")},an=G(E(sn,"s_kYT0GiI235Q")),ln=t=>v("script",{nonce:ve(t,"nonce")},{type:"module",dangerouslySetInnerHTML:Bt},null,3,"of_7"),cn=()=>{const t=Kt(),e=Mt();return k(V,{children:[v("title",null,null,t.title,1,null),v("link",null,{rel:"canonical",href:Ge(n=>n.url.href,[e],"p0.url.href")},null,3,null),v("meta",null,{name:"viewport",content:"width=device-width, initial-scale=1.0"},null,3,null),v("link",null,{rel:"icon",type:"image/svg+xml",href:"/favicon.svg"},null,3,null),t.meta.map(n=>Z("meta",{...n},null,0,n.key)),t.links.map(n=>Z("link",{...n},null,0,n.key)),t.styles.map(n=>Z("style",{...n.props,get dangerouslySetInnerHTML(){return n.style},dangerouslySetInnerHTML:ve(n,"style")},null,0,n.key))]},1,"pp_0")},un=G(E(cn,"s_z3eY59XRJ9Y")),fn=()=>k(an,{children:[v("head",null,null,[v("meta",null,{charSet:"utf-8"},null,3,null),v("link",null,{rel:"manifest",href:"/manifest.json"},null,3,null),k(un,null,3,"wg_0"),v("link",null,{rel:"preconnect",href:"https://fonts.googleapis.com"},null,3,null),v("link",null,{rel:"preconnect",href:"https://fonts.gstatic.com",crossOrigin:"anonymous"},null,3,null),v("link",null,{href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap",rel:"stylesheet"},null,3,null)],1,null),v("body",null,{lang:"en"},[k(Ht,null,3,"wg_1"),k(ln,null,3,"wg_2")],1,null)]},1,"wg_3"),mn=G(E(fn,"s_EIhEF4tKqYs"));function hn(t){return Ct(k(mn,null,3,"Fi_0"),{manifest:M,...t,containerAttributes:{lang:"en-us",...t.containerAttributes}})}export{hn as default};
