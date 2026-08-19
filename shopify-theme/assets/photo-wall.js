/*
 * Photo Wall — pannable corkboard of pinned photos with a click-to-open popup.
 * Data is emitted by sections/photo-wall.liquid as two JSON blobs:
 *   #pw-data   — the photos (from the photo_wall metaobject)
 *   #pw-tracks — the music playlist (from Track blocks)
 * Ported from the photo-wall.html wireframe.
 */
(function () {
  'use strict';

  var vp = document.getElementById('pw-viewport');
  var world = document.getElementById('pw-world');
  if (!vp || !world) return;

  function readJSON(id) {
    try { var el = document.getElementById(id); return el ? JSON.parse(el.textContent) : []; }
    catch (e) { return []; }
  }
  var PHOTOS = readJSON('pw-data').filter(function (p) { return p && p.src; });
  var TRACKS = readJSON('pw-tracks').filter(function (t) { return t && t.src; });

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  /* ---------- Deterministic scatter (stable, seeded by index) ---------- */
  function rng(seed){
    return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed);
      t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  }
  var COLS=Math.max(1, Math.ceil(Math.sqrt(Math.max(1,PHOTOS.length)*1.6)));
  var CELL_W=420, CELL_H=380;
  PHOTOS.forEach(function(p,i){
    var r=rng(i*97+13);
    var col=i%COLS, row=Math.floor(i/COLS);
    var w=220+Math.round(r()*120);
    var jx=(r()-.5)*160, jy=(r()-.5)*140;
    var x=col*CELL_W + jx + 120;
    var y=row*CELL_H + jy + 120;
    var rot=(r()-.5)*12;
    var card=document.createElement('div');
    card.className='pw-card';
    card.style.width=w+'px'; card.style.left=x+'px'; card.style.top=y+'px';
    card.style.transform='rotate('+rot.toFixed(2)+'deg)';
    card.dataset.i=i;
    card.innerHTML='<span class="pw-cardpin"></span><span class="pw-pill">'+esc(p.year)+'</span>'
      +'<img loading="lazy" src="'+esc(p.thumb||p.src)+'" alt="'+esc(p.title||'')+'">';
    world.appendChild(card);
  });
  var worldW=COLS*CELL_W+240, worldH=Math.ceil(Math.max(1,PHOTOS.length)/COLS)*CELL_H+240;
  var wm=document.getElementById('pw-watermark');
  if(wm){ wm.style.left=worldW/2+'px'; wm.style.top=worldH/2+'px'; }

  /* ---------- Pan + zoom ---------- */
  var tx=0, ty=0, scale=1, MIN=.35, MAX=2.2;
  function apply(){ world.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'; }
  function centre(){
    var vw=vp.clientWidth, vh=vp.clientHeight;
    scale=Math.min(1, Math.min(vw/worldW, vh/worldH)*1.15);
    tx=(vw-worldW*scale)/2; ty=(vh-worldH*scale)/2; apply();
  }
  centre();

  var down=false, moved=false, sx=0, sy=0, lx=0, ly=0, vX=0, vY=0, lastT=0, raf=0, startCard=null;
  vp.addEventListener('pointerdown',function(e){
    down=true; moved=false; sx=lx=e.clientX; sy=ly=e.clientY; vX=vY=0; lastT=performance.now();
    startCard=e.target.closest('.pw-card');
    cancelAnimationFrame(raf); vp.classList.add('is-panning'); vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove',function(e){
    if(!down) return;
    var dx=e.clientX-lx, dy=e.clientY-ly;
    if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>5) moved=true;
    tx+=dx; ty+=dy;
    var now=performance.now(), dt=Math.max(1,now-lastT); vX=dx/dt*16; vY=dy/dt*16; lastT=now;
    lx=e.clientX; ly=e.clientY; apply();
  });
  function endPan(){
    if(!down) return; down=false; vp.classList.remove('is-panning');
    if(!moved){ if(startCard) openModal(+startCard.dataset.i); }
    else { (function glide(){ vX*=.92; vY*=.92; tx+=vX; ty+=vY; apply();
      if(Math.abs(vX)+Math.abs(vY)>0.4) raf=requestAnimationFrame(glide); })(); }
    hideHint();
  }
  vp.addEventListener('pointerup',endPan);
  vp.addEventListener('pointercancel',endPan);

  vp.addEventListener('wheel',function(e){ e.preventDefault();
    zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*0.0015)); hideHint(); },{passive:false});
  function zoomAt(cx,cy,factor){
    var ns=Math.min(MAX,Math.max(MIN,scale*factor)); factor=ns/scale;
    tx=cx-(cx-tx)*factor; ty=cy-(cy-ty)*factor; scale=ns; apply();
  }
  var pts={};
  vp.addEventListener('pointerdown',function(e){pts[e.pointerId]={x:e.clientX,y:e.clientY};});
  vp.addEventListener('pointermove',function(e){
    if(!pts[e.pointerId]) return; pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pts); if(ids.length===2){
      down=false;
      var a=pts[ids[0]],b=pts[ids[1]]; var dist=Math.hypot(a.x-b.x,a.y-b.y);
      if(this._pd){ zoomAt((a.x+b.x)/2,(a.y+b.y)/2, dist/this._pd); }
      this._pd=dist;
    }
  });
  function clearPt(e){ delete pts[e.pointerId]; vp._pd=null; }
  vp.addEventListener('pointerup',clearPt); vp.addEventListener('pointercancel',clearPt);

  bind('pw-zoom-in',function(){ zoomAt(vp.clientWidth/2,vp.clientHeight/2,1.25); });
  bind('pw-zoom-out',function(){ zoomAt(vp.clientWidth/2,vp.clientHeight/2,0.8); });
  bind('pw-recentre',function(){ centre(); });
  function bind(id,fn){ var el=document.getElementById(id); if(el) el.onclick=fn; }

  var hint=document.getElementById('pw-hint'), hintGone=false;
  function hideHint(){ if(hint && !hintGone){ hintGone=true; hint.style.opacity=0; } }

  /* ---------- Modal ---------- */
  var modal=document.getElementById('pw-modal');
  function openModal(i){
    var p=PHOTOS[i]; if(!p) return;
    document.getElementById('pw-mphoto').src=p.src;
    document.getElementById('pw-mphoto').alt=p.title||'';
    var h='';
    h+='<span class="pw-year">'+esc(p.year)+'</span>';
    if(p.title) h+='<h2 class="pw-title">'+esc(p.title)+'</h2>';
    if(p.desc) h+='<p class="pw-desc">'+esc(p.desc)+'</p>';
    var meta='';
    if(p.people && p.people.length){
      meta += p.people.filter(Boolean).map(function(person,idx){
        return (idx?'<span class="pw-sep">·</span>':'')
          +'<a class="pw-person" href="'+esc(person.url||'#')+'">'+esc(person.name)+'</a>';
      }).join('');
    }
    if(p.location){ meta += (meta?'<span class="pw-sep">·</span>':'')+'<span class="pw-loc">'+esc(p.location)+'</span>'; }
    if(meta) h+='<div class="pw-meta-row">'+meta+'</div>';
    if(p.category) h+='<span class="pw-chip">'+esc(p.category)+'</span><br>';
    if(p.product && p.product.url) h+='<a class="pw-product" href="'+esc(p.product.url)+'" target="_blank" rel="noopener" aria-label="Open product in a new tab">'
      +'<img src="'+esc(p.product.img)+'" alt="">'
      +'<span class="pw-ext"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></span>'
      +'</a>';
    if(p.link) h+='<a class="pw-linkbtn" href="'+esc(p.link)+'">Learn more</a>';
    document.getElementById('pw-minfo').innerHTML=h;
    modal.classList.add('open');
  }
  if(modal){
    modal.addEventListener('click',function(e){ if(e.target.hasAttribute('data-close')) modal.classList.remove('open'); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') modal.classList.remove('open'); });
  }
  // deep-link ?open=N / #N for QA
  (function(){
    var q=new URLSearchParams(location.search).get('open');
    var hh=(location.hash||'').replace(/\D/g,'');
    var i=q!=null&&q!==''?parseInt(q,10):(hh!==''?parseInt(hh,10):NaN);
    if(!isNaN(i)&&PHOTOS[i]) openModal(i);
  })();

  /* ---------- Music player ---------- */
  var player=document.getElementById('pw-player');
  if(player && TRACKS.length){
    var audio=new Audio(), tIdx=0;
    var iPlay=document.getElementById('pw-iplay'), iPause=document.getElementById('pw-ipause');
    function loadT(i,go){ tIdx=(i+TRACKS.length)%TRACKS.length; var t=TRACKS[tIdx];
      audio.src=t.src; if(t.art) document.getElementById('pw-part').src=t.art;
      document.getElementById('pw-ptitle').textContent=t.title||'';
      document.getElementById('pw-partist').textContent=t.artist||'';
      if(go) audio.play().catch(function(){}); }
    document.getElementById('pw-pplay').onclick=function(){ if(audio.paused) audio.play().catch(function(){}); else audio.pause(); };
    document.getElementById('pw-pprev').onclick=function(){ loadT(tIdx-1,true); };
    document.getElementById('pw-pnext').onclick=function(){ loadT(tIdx+1,true); };
    audio.addEventListener('play',function(){ iPlay.style.display='none'; iPause.style.display='block'; });
    audio.addEventListener('pause',function(){ iPlay.style.display='block'; iPause.style.display='none'; });
    audio.addEventListener('ended',function(){ loadT(tIdx+1,true); });
    loadT(0,false);
  } else if(player){ player.style.display='none'; }
})();
