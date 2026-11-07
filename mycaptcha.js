
/* MyCaptcha v3.0 Realistic - 本物そっくりな画像チャレンジ
 * - SVG illustrations instead of emojis
 * - Google reCAPTCHA v2 exact UI clone
 * - High precision measurement preserved
 */
(function(w){
  'use strict';
  // Real image sets - using generated realistic photos
  const IMAGE_SETS = {
    'バス': {
      correct: ['images/bus_1.svg','images/bus_2.svg'],
      wrong: ['images/traffic_1.svg','images/traffic_2.svg','images/empty_street.svg','images/crosswalk_1.svg'],
      instruction: 'バス'
    },
    '信号機': {
      correct: ['images/traffic_1.svg','images/traffic_2.svg'],
      wrong: ['images/bus_1.svg','images/bus_2.svg','images/empty_street.svg','images/crosswalk_1.svg'],
      instruction: '信号機'
    },
    '横断歩道': {
      correct: ['images/crosswalk_1.svg','images/empty_street.svg'], // empty street has faint crosswalk? use crosswalk as correct
      wrong: ['images/bus_1.svg','images/bus_2.svg','images/traffic_1.svg','images/traffic_2.svg'],
      instruction: '横断歩道'
    }
  };
  const KEYS = Object.keys(IMAGE_SETS);

  function createState(){
    return {
      startPerf: performance.now(),
      startDate: Date.now(),
      mouseMoves:0, positions:[], velocities:[], angles:[], directionChanges:0,
      lastAngle:null, lastX:null, lastY:null, lastT:null,
      distance:0, maxVelocity:0, teleportCount:0, straightStreak:0, maxStraightStreak:0,
      firstMovePerf:null, lastMovePerf:null, idleTime:0, hoverDuration:0, hoverStart:null,
      clickPerf:null, clickOffset:{x:0,y:0}, scrollCount:0, maxScroll:0,
      keyCount:0, keyIntervals:[], lastKeyPerf:null, touchCount:0, focusLost:0, visible:true,
      signals:{}, token:'', verified:false, score:0, breakdown:{}, classification:'', reasons:[]
    };
  }
  let S = createState();

  function collectBrowser(){
    const s={};
    try{
      s.ua=navigator.userAgent; s.platform=navigator.platform; s.lang=navigator.language;
      s.langs=(navigator.languages||[]).length; s.tz=new Date().getTimezoneOffset();
      s.sw=screen.width; s.sh=screen.height; s.ww=window.innerWidth; s.wh=window.innerHeight;
      s.dpr=window.devicePixelRatio||1; s.cores=navigator.hardwareConcurrency||0;
      s.mem=navigator.deviceMemory||0; s.touch=navigator.maxTouchPoints||0;
      s.webdriver=navigator.webdriver?1:0; s.plugins=navigator.plugins?navigator.plugins.length:0;
      s.mimes=navigator.mimeTypes?navigator.mimeTypes.length:0;
      s.isIframe=window.self!==window.top?1:0; s.chrome=window.chrome?1:0;
      s.phantom=window._phantom?1:0; s.nightmare=window.__nightmare?1:0; s.cypress=window.Cypress?1:0;
      try{ const c=document.createElement('canvas'); const gl=c.getContext('webgl')||c.getContext('experimental-webgl');
        if(gl){ const ext=gl.getExtension('WEBGL_debug_renderer_info'); s.glVendor=ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL).slice(0,20):'unknown'; }
      }catch(e){}
    }catch(e){}
    S.signals=s; return s;
  }

  function initTracking(){
    collectBrowser();
    const onMove=(e)=>{
      const now=performance.now();
      if(S.firstMovePerf===null) S.firstMovePerf=now;
      S.lastMovePerf=now; S.mouseMoves++;
      let evs=[e]; if(e.getCoalescedEvents){ try{ const ce=e.getCoalescedEvents(); if(ce&&ce.length) evs=ce; }catch(_){} }
      for(const ev of evs){
        const x=ev.clientX, y=ev.clientY, t=now;
        if(S.lastX!==null){
          const dx=x-S.lastX, dy=y-S.lastY, dt=(t-(S.lastT||t))/1000, dist=Math.hypot(dx,dy);
          S.distance+=dist;
          if(dt>0){ const v=dist/dt; S.velocities.push(v); if(S.velocities.length>60) S.velocities.shift(); if(v>S.maxVelocity) S.maxVelocity=v; if(dist>400&&dt<0.05) S.teleportCount++; }
          const ang=Math.atan2(dy,dx)*180/Math.PI; S.angles.push(ang); if(S.angles.length>60) S.angles.shift();
          if(S.lastAngle!==null){ let diff=Math.abs(ang-S.lastAngle); if(diff>180) diff=360-diff; if(diff>25) S.directionChanges++; if(diff<3){ S.straightStreak++; if(S.straightStreak>S.maxStraightStreak) S.maxStraightStreak=S.straightStreak; } else S.straightStreak=0; }
          S.lastAngle=ang;
        }
        S.lastX=x; S.lastY=y; S.lastT=t; S.positions.push({x,y,t}); if(S.positions.length>80) S.positions.shift();
      }
    };
    window.addEventListener('pointermove',onMove,{passive:true});
    window.addEventListener('mousemove',onMove,{passive:true});
    window.addEventListener('wheel',(e)=>{ S.scrollCount++; S.maxScroll=Math.max(S.maxScroll, Math.abs(e.deltaY)); },{passive:true});
    window.addEventListener('scroll',()=>{ S.scrollCount++; },{passive:true});
    window.addEventListener('keydown',()=>{ const now=performance.now(); S.keyCount++; if(S.lastKeyPerf!==null){ S.keyIntervals.push(now-S.lastKeyPerf); if(S.keyIntervals.length>40) S.keyIntervals.shift(); } S.lastKeyPerf=now; },{passive:true});
    window.addEventListener('touchstart',()=>{ S.touchCount++; },{passive:true});
    window.addEventListener('blur',()=>{ S.focusLost++; },{passive:true});
    document.addEventListener('visibilitychange',()=>{ if(document.hidden){ S.visible=false; S.focusLost++; } else S.visible=true; });
    let lastRAF=performance.now();
    const loop=()=>{ const now=performance.now(); const dt=(now-lastRAF)/1000; lastRAF=now; if(S.lastMovePerf!==null){ const idle=(now-S.lastMovePerf)/1000; if(idle>1) S.idleTime+=dt; } if(w._mcUpdateDebug) w._mcUpdateDebug(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  initTracking();

  function calcMouse(){ let score=0, reasons=[]; if(S.mouseMoves===0){ reasons.push('マウス移動なし'); return {score:0,reasons}; } if(S.distance>80) score+=0.2; else reasons.push(`移動${Math.round(S.distance)}px短い`); if(S.distance>250) score+=0.15; if(S.mouseMoves>12) score+=0.15; else reasons.push(`移動${S.mouseMoves}回少ない`); if(S.directionChanges>4) score+=0.2; else reasons.push('動き直線的'); if(S.maxStraightStreak>12){ score-=0.2; reasons.push(`直線${S.maxStraightStreak}連続`); } if(S.teleportCount>0){ score-=0.3; reasons.push(`テレポート${S.teleportCount}回`); } const avg=S.velocities.length? S.velocities.reduce((a,b)=>a+b,0)/S.velocities.length:0; const std=S.velocities.length>1? Math.sqrt(S.velocities.reduce((a,b)=>a+(b-avg)*(b-avg),0)/S.velocities.length):0; if(avg>30&&avg<2500) score+=0.15; if(std>20) score+=0.1; else if(S.velocities.length>10) reasons.push('速度一定すぎ'); if(S.firstMovePerf!==null){ const ttfm=(S.firstMovePerf-S.startPerf)/1000; if(ttfm>0.1&&ttfm<4) score+=0.1; } return {score:Math.min(1,Math.max(0,score)),reasons}; }
  function calcTime(){ let score=0,reasons=[]; const top=(performance.now()-S.startPerf)/1000; if(top>1) score+=0.3; else reasons.push(`滞在${top.toFixed(2)}s短い`); if(top>2.5) score+=0.25; if(top>5) score+=0.1; if(S.clickPerf!==null){ const ttc=(S.clickPerf-S.startPerf)/1000; if(ttc>0.7) score+=0.25; else reasons.push(`クリック${ttc.toFixed(2)}s速すぎ`); } if(S.hoverDuration>0.12) score+=0.1; return {score:Math.min(1,Math.max(0,score)),reasons}; }
  function calcBrowser(){ let score=0.5,reasons=[],s=S.signals; if(s.webdriver){ score-=0.5; reasons.push('webdriver'); } if(s.phantom||s.nightmare||s.cypress){ score-=0.5; reasons.push('自動化痕跡'); } if(s.plugins===0&&s.mimes===0){ score-=0.2; reasons.push('plugins0'); } if(s.langs===0){ score-=0.15; } if(s.isIframe) score-=0.1; if(!s.webdriver) score+=0.3; if(s.plugins>0) score+=0.1; return {score:Math.min(1,Math.max(0,score)),reasons}; }
  function calcInter(){ let score=0.3,reasons=[]; if(S.scrollCount>0) score+=0.2; else reasons.push('スクロールなし'); if(S.maxScroll>50) score+=0.1; if(S.keyCount>0){ score+=0.1; if(S.keyIntervals.length>2){ const avg=S.keyIntervals.reduce((a,b)=>a+b,0)/S.keyIntervals.length; if(avg>40&&avg<1200) score+=0.2; } } if(S.touchCount>0) score+=0.1; if(S.focusLost>2) reasons.push(`フォーカス外れ${S.focusLost}回`); const off=Math.hypot(S.clickOffset.x,S.clickOffset.y); if(off>2&&off<22) score+=0.1; return {score:Math.min(1,Math.max(0,score)),reasons}; }
  function calcFinal(){ const m=calcMouse(), t=calcTime(), b=calcBrowser(), i=calcInter(); const final=m.score*0.35+t.score*0.2+b.score*0.25+i.score*0.2; let cls=''; if(final>=0.8) cls='人間（高信頼）'; else if(final>=0.6) cls='おそらく人間'; else if(final>=0.3) cls='疑わしい'; else cls='Bot高'; const reasons=[...m.reasons,...t.reasons,...b.reasons,...i.reasons]; return {score:final,breakdown:{mouse:m.score,time:t.score,browser:b.score,interaction:i.score},reasons,classification:cls,raw:{moves:S.mouseMoves,distance:Math.round(S.distance),dirChanges:S.directionChanges,maxStraight:S.maxStraightStreak,teleports:S.teleportCount,avgV:S.velocities.length?Math.round(S.velocities.reduce((a,b)=>a+b,0)/S.velocities.length):0,maxV:Math.round(S.maxVelocity),timeOnPage:((performance.now()-S.startPerf)/1000).toFixed(2),timeToClick:S.clickPerf?((S.clickPerf-S.startPerf)/1000).toFixed(2):'-',scroll:S.scrollCount,keys:S.keyCount,signals:S.signals,positions:S.positions.slice(-30)}}; }
  function genToken(s){ const p={ts:Date.now(),perf:Math.round(performance.now()),score:s,rand:Math.random().toString(36).slice(2,9)}; try{ return 'mycaptcha_'+btoa(unescape(encodeURIComponent(JSON.stringify(p)))) ; }catch(e){ return 'mycaptcha_'+Date.now(); } }

  function createWidget(container, opts){
    const id='mc_'+Math.random().toString(36).slice(2,7);
    container.innerHTML=`
      <div class="mycaptcha-box" id="${id}">
        <div class="mc-left"><div class="mc-checkbox" tabindex="0" role="checkbox"><div class="mc-checkmark"></div><div class="mc-spinner"></div></div><span class="mc-label">私はロボットではありません</span></div>
        <div class="mc-right"><div class="mc-logo"><span>🛡️</span><div>MyCaptcha</div></div><div class="mc-links">プライバシー - 利用規約</div></div>
      </div>
      <div class="mycaptcha-challenge" style="display:none">
        <div class="mc-modal">
          <div class="mc-modal-head"><div class="mc-instruct"></div><button class="mc-reload">↻</button></div>
          <div class="mc-grid"></div>
          <div class="mc-modal-foot"><div class="mc-attempt-info"></div><div style="display:flex;gap:8px"><button class="mc-skip">スキップ</button><button class="mc-verify">確認</button></div></div>
        </div>
      </div>`;
    const box=container.querySelector('.mycaptcha-box');
    const checkbox=container.querySelector('.mc-checkbox');
    const challenge=container.querySelector('.mycaptcha-challenge');
    const grid=container.querySelector('.mc-grid');
    const instruct=container.querySelector('.mc-instruct');
    const attemptInfo=container.querySelector('.mc-attempt-info');
    let currentKey=KEYS[Math.floor(Math.random()*KEYS.length)];
    let correctSet=new Set(), verified=false, required=1, successes=0;

    function buildGrid(){
      correctSet.clear(); grid.innerHTML='';
      const set=IMAGE_SETS[currentKey];
      instruct.innerHTML=`<span style="font-size:18px;font-weight:700">${set.instruction}</span><br>が写っている画像をすべて選択してください。<br>完了したら「確認」を押します。`;
      // decide correct indices
      const cnt=3+Math.floor(Math.random()*2);
      const correctIdx=[]; while(correctIdx.length<cnt){ const r=Math.floor(Math.random()*9); if(!correctIdx.includes(r)) correctIdx.push(r); }
      for(let i=0;i<9;i++){
        const cell=document.createElement('div'); cell.className='mc-cell-real';
        const isCorrect=correctIdx.includes(i);
        let imgSrc='';
        if(isCorrect){
          const pool=set.correct;
          imgSrc=pool[Math.floor(Math.random()*pool.length)];
          correctSet.add(i);
        } else {
          const pool=set.wrong;
          imgSrc=pool[Math.floor(Math.random()*pool.length)];
        }
        cell.innerHTML=`<img src="${imgSrc}" loading="lazy" onerror="this.style.background='#ccc'"><div class="mc-cell-check"></div>`;
        cell.dataset.idx=i;
        cell.addEventListener('click',()=>cell.classList.toggle('selected'));
        grid.appendChild(cell);
      }
      attemptInfo.textContent=required>1?`${successes+1}/${required}回目`:'';
    }
    function doSuccess(info){
      verified=true; S.verified=true; S.token=genToken(info.score); S.score=info.score; S.breakdown=info.breakdown; S.classification=info.classification;
      box.classList.add('mc-success'); checkbox.classList.add('checked');
      if(opts&&typeof opts.callback==='function') opts.callback(S.token,info);
      container.dispatchEvent(new CustomEvent('mycaptcha-success',{detail:{token:S.token,info}}));
    }
    function onCheck(e){
      if(verified) return;
      if(e&&e.clientX){ const r=checkbox.getBoundingClientRect(); S.clickOffset={x:(e.clientX-(r.left+r.width/2)), y:(e.clientY-(r.top+r.height/2))}; }
      S.clickPerf=performance.now();
      checkbox.classList.add('loading'); box.classList.add('mc-loading');
      setTimeout(()=>{
        const info=calcFinal();
        if(info.score>=0.75){ checkbox.classList.remove('loading'); doSuccess(info); }
        else { checkbox.classList.remove('loading'); box.classList.remove('mc-loading'); required=info.score<0.25?2:1; successes=0; currentKey=KEYS[Math.floor(Math.random()*KEYS.length)]; buildGrid(); challenge.style.display='flex'; }
      }, 450+Math.random()*400);
    }
    checkbox.addEventListener('click',onCheck);
    checkbox.addEventListener('keydown',(ev)=>{ if(ev.key===' '||ev.key==='Enter'){ ev.preventDefault(); onCheck(); } });
    checkbox.addEventListener('mouseenter',()=>{ S.hoverStart=performance.now(); });
    checkbox.addEventListener('mouseleave',()=>{ if(S.hoverStart){ S.hoverDuration+=(performance.now()-S.hoverStart)/1000; S.hoverStart=null; } });
    container.querySelector('.mc-verify').addEventListener('click',()=>{
      const sel=Array.from(grid.querySelectorAll('.mc-cell-real.selected')).map(c=>parseInt(c.dataset.idx)); const selSet=new Set(sel);
      let ok=selSet.size===correctSet.size; if(ok){ for(const v of selSet){ if(!correctSet.has(v)){ ok=false; break; } } }
      if(ok){ successes++; if(successes>=required){ challenge.style.display='none'; const info=calcFinal(); info.score=Math.min(1, info.score+0.15); doSuccess(info); } else { currentKey=KEYS[Math.floor(Math.random()*KEYS.length)]; buildGrid(); } }
      else { grid.classList.add('mc-shake'); setTimeout(()=>grid.classList.remove('mc-shake'),400); setTimeout(()=>{ currentKey=KEYS[Math.floor(Math.random()*KEYS.length)]; buildGrid(); },600); }
    });
    container.querySelector('.mc-skip').addEventListener('click',()=>{ currentKey=KEYS[Math.floor(Math.random()*KEYS.length)]; buildGrid(); });
    container.querySelector('.mc-reload').addEventListener('click',()=>{ currentKey=KEYS[Math.floor(Math.random()*KEYS.length)]; buildGrid(); });

    return {
      getResponse:()=> S.verified? S.token : '',
      getScore:()=> ({score:S.score,breakdown:S.breakdown,classification:S.classification}),
      getDetailed:()=> calcFinal(),
      reset:()=>{ verified=false; S=Object.assign(S,createState()); S.startPerf=performance.now(); collectBrowser(); box.classList.remove('mc-success','mc-loading'); checkbox.classList.remove('checked','loading'); challenge.style.display='none'; }
    };
  }

  const api={
    render:(cid,opt)=>{ const el=typeof cid==='string'? document.getElementById(cid):cid; if(!el){ console.error('not found',cid); return null; } const inst=createWidget(el,opt||{}); api._instances=api._instances||{}; api._instances[cid]=inst; api._last=inst; return inst; },
    getResponse:(cid)=>{ if(cid&&api._instances&&api._instances[cid]) return api._instances[cid].getResponse(); return S.token; },
    getScore:(cid)=>{ if(cid&&api._instances&&api._instances[cid]) return api._instances[cid].getScore(); return {score:S.score}; },
    getDetailed:(cid)=>{ if(cid&&api._instances&&api._instances[cid]) return api._instances[cid].getDetailed(); return calcFinal(); },
    reset:(cid)=>{ if(cid&&api._instances&&api._instances[cid]) api._instances[cid].reset(); else if(api._last) api._last.reset(); },
    execute:(cid)=>{ const el=typeof cid==='string'? document.getElementById(cid):cid; if(el){ const cb=el.querySelector('.mc-checkbox'); if(cb) cb.click(); } }
  };
  function auto(){ document.querySelectorAll('.mycaptcha,[data-mycaptcha]').forEach(el=>{ if(el.dataset.rendered) return; el.dataset.rendered='1'; createWidget(el,{sitekey:el.dataset.sitekey||'demo'}); }); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',auto); else auto();
  w.myCaptcha=api;
})(window);
