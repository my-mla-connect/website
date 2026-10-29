(function(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* =====================================================================
     Neural network background
     A 3D feed-forward network that slowly turns in space. Data particles
     stream in from the left, fire the input layer, activations propagate
     layer by layer along weighted edges, and outputs stream off to the right.
     ===================================================================== */
  const cv=document.getElementById('net'), hero=document.querySelector('.hero'), ctx=cv.getContext('2d');
  const LAYERS=[6,10,12,10,4];
  let W=0,H=0,dpr=1,S=1,CX=0,CY=0,nodes=[],edges=[],pulses=[],streams=[],col={};
  let mouse={x:0,y:0,tx:0,ty:0},running=true,spawnT=0,dust=[];

  function hexA(h,a){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
  function readColors(){col={v:css('--violet'),v2:css('--violet-2'),m:css('--marigold')};}

  function build(){
    nodes=[];edges=[];
    const span=2.2;
    LAYERS.forEach((n,li)=>{
      const x=-span/2+span*li/(LAYERS.length-1);
      const r=0.18+0.055*n;
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2+li*.6;
        nodes.push({x,y:Math.cos(a)*r,z:Math.sin(a)*r,layer:li,act:0,out:[]});
      }
    });
    const byL=LAYERS.map((_,li)=>nodes.filter(n=>n.layer===li));
    for(let li=0;li<byL.length-1;li++){
      const A=byL[li],B=byL[li+1];
      A.forEach(a=>{ const pick=[...B].sort(()=>Math.random()-.5).slice(0,4);
        pick.forEach(b=>{const e={a,b,w:.3+Math.random()*.7};edges.push(e);a.out.push(e);}); });
      B.forEach(b=>{ if(!edges.some(e=>e.b===b)){const a=A[Math.random()*A.length|0];const e={a,b,w:.6};edges.push(e);a.out.push(e);} });
    }
    // drifting background dust for depth
    dust=Array.from({length:60},()=>({x:(Math.random()-.5)*4,y:(Math.random()-.5)*2.4,z:(Math.random()-.5)*3,s:Math.random()*1.4+.4}));
  }

  function resize(){
    const r=hero.getBoundingClientRect(); dpr=Math.min(devicePixelRatio||1,2);
    W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    S=Math.min(W*.42,560); CX=W/2; CY=Math.min(H*.42,430);
    readColors(); if(reduce) frame(0);
  }

  let rotY=-.5,rotX=.25;
  function project(p){
    const cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);
    let x=p.x*cy+p.z*sy, z=-p.x*sy+p.z*cy;
    let y=p.y*cx-z*sx; z=p.y*sx+z*cx;
    const f=3.2, k=f/(f+z);
    return {X:CX+x*S*k,Y:CY+y*S*k,k,z};
  }

  function fire(node,depth){
    node.act=1;
    if(node.layer===LAYERS.length-1){ streams.push({out:true,node,t:0}); return; }
    node.out.forEach(e=>{ if(Math.random()<(depth===0?.75:.5) && pulses.length<160) pulses.push({e,k:0,sp:.012+Math.random()*.01}); });
  }

  function frame(t){
    ctx.clearRect(0,0,W,H);
    // camera: slow sway + pointer parallax
    mouse.x+=(mouse.tx-mouse.x)*.04; mouse.y+=(mouse.ty-mouse.y)*.04;
    rotY=reduce?-.55:-.45+Math.sin(t/7000)*.45+mouse.x*.35;
    rotX=reduce?.28:.22+Math.sin(t/9000)*.12+mouse.y*.2;

    // dust
    for(const d of dust){ if(!reduce){d.x+=.0009; if(d.x>2)d.x=-2;}
      const p=project(d); ctx.fillStyle=hexA(col.v2,.25*p.k); ctx.beginPath(); ctx.arc(p.X,p.Y,d.s*p.k,0,6.28); ctx.fill(); }

    const P=new Map(); nodes.forEach(n=>P.set(n,project(n)));

    // edges
    ctx.lineWidth=1;
    for(const e of edges){ const a=P.get(e.a),b=P.get(e.b);
      const act=Math.max(e.a.act,e.b.act);
      ctx.strokeStyle=hexA(act>.2?col.v:col.v2,(.10+.10*e.w)*Math.min(a.k,b.k)+act*.25);
      ctx.beginPath(); ctx.moveTo(a.X,a.Y); ctx.lineTo(b.X,b.Y); ctx.stroke(); }

    // inbound / outbound data streams
    if(!reduce && t-spawnT>420){ spawnT=t;
      const inputs=nodes.filter(n=>n.layer===0); streams.push({out:false,node:inputs[Math.random()*inputs.length|0],t:0,y0:(Math.random()-.5)*H*.5}); }
    streams=streams.filter(s=>s.t<=1);
    for(const s of streams){
      const p=P.get(s.node); s.t+=reduce?0:.016;
      const e=1-Math.pow(1-s.t,3);
      let x,y,x0,y0;
      if(!s.out){ x0=-40; y0=p.Y+s.y0; x=x0+(p.X-x0)*e; y=y0+(p.Y-y0)*e; if(s.t>=1) fire(s.node,0); }
      else { x0=p.X; y0=p.Y; x=x0+(W+40-x0)*e; y=y0+(s.node.z*60)*e; }
      const tail=ctx.createLinearGradient(x0,y0,x,y);
      tail.addColorStop(0,hexA(s.out?col.m:col.v2,0)); tail.addColorStop(1,hexA(s.out?col.m:col.v2,.55));
      ctx.strokeStyle=tail; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x0+(x-x0)*.6,y0+(y-y0)*.6); ctx.lineTo(x,y); ctx.stroke();
      ctx.fillStyle=hexA(s.out?col.m:col.v,.9); ctx.beginPath(); ctx.arc(x,y,2.2,0,6.28); ctx.fill();
    }

    // pulses along edges
    pulses=pulses.filter(q=>q.k<=1);
    for(const q of pulses){
      if(!reduce) q.k+=q.sp;
      const a=P.get(q.e.a),b=P.get(q.e.b), k=Math.min(q.k,1);
      const x=a.X+(b.X-a.X)*k, y=a.Y+(b.Y-a.Y)*k, kb=Math.max(0,k-.25);
      const tx=a.X+(b.X-a.X)*kb, ty=a.Y+(b.Y-a.Y)*kb;
      const g=ctx.createLinearGradient(tx,ty,x,y); g.addColorStop(0,hexA(col.v,0)); g.addColorStop(1,hexA(col.v,.9));
      ctx.strokeStyle=g; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(x,y); ctx.stroke();
      const r=6*a.k; const gl=ctx.createRadialGradient(x,y,0,x,y,r); gl.addColorStop(0,hexA(col.v,.9)); gl.addColorStop(1,hexA(col.v,0));
      ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fill();
      if(q.k>=1) fire(q.e.b,1);
    }

    // nodes, back to front
    const order=[...nodes].sort((m,n)=>P.get(n).z-P.get(m).z);
    for(const n of order){
      const p=P.get(n); const last=n.layer===LAYERS.length-1;
      if(!reduce) n.act*=.955;
      const base=(last?4.2:3.2)*p.k, r=base+n.act*3*p.k;
      if(n.act>.04){ const c=last?col.m:col.v; const gl=ctx.createRadialGradient(p.X,p.Y,0,p.X,p.Y,r*4);
        gl.addColorStop(0,hexA(c,.45*n.act)); gl.addColorStop(1,hexA(c,0)); ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(p.X,p.Y,r*4,0,6.28); ctx.fill(); }
      ctx.fillStyle=hexA(last?col.m:(n.act>.3?col.v:col.v2),.55+.45*Math.max(n.act,p.k-.6));
      ctx.beginPath(); ctx.arc(p.X,p.Y,r,0,6.28); ctx.fill();
      ctx.strokeStyle=hexA(col.v,.25*p.k); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.X,p.Y,r+2.5*p.k,0,6.28); ctx.stroke();
    }
  }

  function loop(t){ if(running) frame(t); requestAnimationFrame(loop); }
  hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect(); mouse.tx=(e.clientX-r.left)/r.width-.5; mouse.ty=(e.clientY-r.top)/r.height-.5;});
  hero.addEventListener('pointerleave',()=>{mouse.tx=mouse.ty=0;});
  new IntersectionObserver(es=>{running=es[0].isIntersecting&&!document.hidden;}).observe(hero);
  document.addEventListener('visibilitychange',()=>{running=!document.hidden;});
  const recolor=()=>{readColors(); if(reduce) frame(0);};
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',recolor);
  new MutationObserver(recolor).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let rt; addEventListener('resize',()=>{clearTimeout(rt); rt=setTimeout(resize,150);});
  build(); resize();
  if(reduce){ nodes.forEach(n=>{ if(Math.random()<.3) n.act=.8; }); frame(0); }
  else requestAnimationFrame(loop);

  /* ---------- Live AI triage queue ---------- */
  const IC={
    chat:'<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>',
    call:'<path d="M3 2.5h2.5l1.2 3-1.6 1a7 7 0 0 0 3.4 3.4l1-1.6 3 1.2V12a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 1.5 4 1.5 1.5 0 0 1 3 2.5z"/>',
    web:'<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>',
    mail:'<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2.5 4.5 8 9l5.5-4.5"/>',
    scan:'<rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/>'
  };
  const ITEMS=[
    {i:'chat',t:'Streetlight out on Ward 12 road for 9 days',c:'WhatsApp',d:'Public Works',p:'High',s:.96},
    {i:'web', t:'Pension application, signature page missing',c:'Citizen portal',d:'Social Welfare',p:'Normal',s:.91},
    {i:'call',t:'Water supply irregular since Monday',c:'Phone call',d:'Water Authority',p:'High',s:.94},
    {i:'mail',t:'Status of RTI application filed on 3 October',c:'Email',d:'RTI Cell',p:'Due in 6d',s:.98},
    {i:'scan',t:'Building permit renewal, form and site plan',c:'Scanned form',d:'Town Planning',p:'Normal',s:.89},
    {i:'chat',t:'Garbage not collected in Block C this week',c:'WhatsApp',d:'Sanitation',p:'High',s:.93}
  ];
  const q=document.getElementById('queue'); let idx=0;
  function row(it,enter){
    const li=document.createElement('li'); li.className='q-row'+(enter?' enter':'');
    li.innerHTML=`<span class="q-ico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${IC[it.i]}</svg></span>
      <span class="q-main"><span class="q-title">${it.t}</span><span class="q-sum">${it.c} · <span class="ai">AI routed · confidence ${it.s.toFixed(2)}</span></span></span>
      <span class="q-meta"><span class="tag dept">→ ${it.d}</span><span class="tag${it.p==='High'?' hi':''}">${it.p}</span></span>`;
    return li;
  }
  for(let k=0;k<4;k++) q.appendChild(row(ITEMS[k],false)); idx=4;
  if(!reduce) setInterval(()=>{ if(document.hidden) return;
    q.prepend(row(ITEMS[idx%ITEMS.length],true)); idx++; if(q.children.length>4) q.lastElementChild.remove(); },2800);

  /* ---------- Capability marquee ---------- */
  const CAPS=['Web applications','Android & iOS apps','Citizen portals','WhatsApp services','AI triage & routing','Document AI','MCP integrations','AI training for teams','Data pipelines','Forecasting','Legacy modernisation','SDLC review'];
  const ul=h=>`<ul${h?' aria-hidden="true"':''}>`+CAPS.map(c=>`<li>${c}</li>`).join('')+'</ul>';
  document.getElementById('marquee').innerHTML=ul(false)+ul(true);

  /* ---------- Scroll word reveal ---------- */
  const rv=document.getElementById('reveal'); const HL=new Set(['steady','build.']);
  rv.innerHTML=rv.textContent.split(' ').map(w=>`<span class="w${HL.has(w)?' hl':''}">${w}</span>`).join(' ');
  const words=[...rv.querySelectorAll('.w')];
  function onScroll(){ const r=rv.getBoundingClientRect(),vh=innerHeight;
    const prog=Math.min(1,Math.max(0,(vh*.85-r.top)/(r.height+vh*.35))); const n=Math.round(prog*words.length);
    words.forEach((w,i)=>w.classList.toggle('on',i<n)); }
  if(reduce) words.forEach(w=>w.classList.add('on')); else { addEventListener('scroll',onScroll,{passive:true}); onScroll(); }

  /* ---------- Copy email ---------- */
  const btn=document.getElementById('copy');
  btn.addEventListener('click',()=>{
    const ok=()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1600);};
    const fb=()=>{const r=document.createRange();r.selectNodeContents(document.getElementById('mail-addr'));const s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='Selected';};
    try{navigator.clipboard.writeText('hello@buddhyantra.com').then(ok,fb);}catch(e){fb();}
  });
})();
