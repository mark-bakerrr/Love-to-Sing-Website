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
  var ALL = PHOTOS; /* unfiltered master list; PHOTOS is the currently visible subset */
  var TRACKS = readJSON('pw-tracks').filter(function (t) { return t && t.src; });

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  /* ---------- Deterministic scatter (stable, seeded by index) ---------- */
  function rng(seed){
    return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed);
      t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  }
  var CELL_W=420, CELL_H=380, COLS=1, worldW=0, worldH=0;
  function buildWall(){
    Array.prototype.slice.call(world.querySelectorAll('.pw-card')).forEach(function(n){ n.parentNode.removeChild(n); });
    COLS=Math.max(1, Math.ceil(Math.sqrt(Math.max(1,PHOTOS.length)*1.6)));
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
    worldW=COLS*CELL_W+240; worldH=Math.ceil(Math.max(1,PHOTOS.length)/COLS)*CELL_H+240;
    var wm=document.getElementById('pw-watermark');
    if(wm){ wm.style.left=worldW/2+'px'; wm.style.top=worldH/2+'px'; }
  }
  buildWall();

  /* ---------- Pan + zoom ---------- */
  var tx=0, ty=0, scale=1, MIN=.35, MAX=2.2;
  function apply(){ world.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'; }
  function centre(){
    var vw=vp.clientWidth, vh=vp.clientHeight;
    scale=Math.min(1, Math.min(vw/worldW, vh/worldH)*1.15);
    tx=(vw-worldW*scale)/2; ty=(vh-worldH*scale)/2; apply();
  }
  centre();

  /* ---------- Filters (Year / Person / Category) — custom dropdowns ---------- */
  var fWrap=document.getElementById('pw-filters');
  var fCount=document.getElementById('pw-f-count');
  var fClear=null, DDS=[];
  function makeDD(allLabel){
    var dd=document.createElement('div'); dd.className='pw-dd';
    dd.innerHTML='<button type="button" class="pw-dd-btn" aria-haspopup="listbox" aria-expanded="false">'
      +'<span class="lbl">'+esc(allLabel)+'</span>'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
      +'</button><div class="pw-dd-menu" role="listbox"></div>';
    var btn=dd.querySelector('.pw-dd-btn'), menu=dd.querySelector('.pw-dd-menu'), lbl=dd.querySelector('.lbl');
    var state={el:dd, value:'', values:[]};
    state.close=function(){ dd.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
    function openMenu(){
      DDS.forEach(function(o){ if(o!==state) o.close(); });
      dd.classList.add('open'); btn.setAttribute('aria-expanded','true');
      var selEl=menu.querySelector('.pw-dd-item.sel');
      if(selEl) selEl.scrollIntoView({block:'nearest'});
      if(typeof window.gsap!=='undefined') gsap.fromTo(menu,{y:8,autoAlpha:0},{y:0,autoAlpha:1,duration:.22,ease:'power2.out'});
    }
    btn.addEventListener('click',function(e){ e.stopPropagation(); if(dd.classList.contains('open')) state.close(); else openMenu(); });
    state.set=function(v){
      state.value=v; lbl.textContent=v||allLabel; dd.classList.toggle('active',!!v);
      Array.prototype.forEach.call(menu.querySelectorAll('.pw-dd-item'),function(it){ it.classList.toggle('sel',it.getAttribute('data-v')===v); });
    };
    state.fill=function(values){
      state.values=values;
      var html='<button type="button" class="pw-dd-item" data-v="">'+esc(allLabel)+'</button>';
      values.forEach(function(v){ html+='<button type="button" class="pw-dd-item" data-v="'+esc(v)+'">'+esc(v)+'</button>'; });
      menu.innerHTML=html;
      Array.prototype.forEach.call(menu.querySelectorAll('.pw-dd-item'),function(it){
        it.addEventListener('click',function(){ state.set(it.getAttribute('data-v')); state.close(); applyFilters(); });
      });
      state.set(values.indexOf(state.value)>=0?state.value:'');
    };
    DDS.push(state);
    return state;
  }
  var ddYear=null, ddPerson=null, ddCat=null;
  if(fWrap){
    ddYear=makeDD('All years'); ddPerson=makeDD('Everyone'); ddCat=makeDD('All categories');
    fClear=document.createElement('button');
    fClear.id='pw-f-clear'; fClear.type='button'; fClear.textContent='Clear'; fClear.hidden=true;
    fWrap.insertBefore(ddYear.el,fCount); fWrap.insertBefore(ddPerson.el,fCount);
    fWrap.insertBefore(ddCat.el,fCount); fWrap.insertBefore(fClear,fCount);
    fClear.addEventListener('click',function(){ ddYear.set(''); ddPerson.set(''); ddCat.set(''); applyFilters(); });
    document.addEventListener('click',function(){ DDS.forEach(function(o){ o.close(); }); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') DDS.forEach(function(o){ o.close(); }); });
  }
  function populateFilters(){
    if(!fWrap) return;
    var years={}, people={}, cats={};
    ALL.forEach(function(p){
      if(p.year) years[p.year]=1;
      if(p.category) cats[p.category]=1;
      (p.people||[]).forEach(function(t){ if(t&&t.name) people[t.name]=1; });
    });
    ddYear.fill(Object.keys(years).sort());
    ddPerson.fill(Object.keys(people).sort());
    ddCat.fill(Object.keys(cats).sort());
    fWrap.hidden=false;
  }
  function applyFilters(){
    var y=ddYear?ddYear.value:'', pe=ddPerson?ddPerson.value:'', c=ddCat?ddCat.value:'';
    PHOTOS=ALL.filter(function(p){
      if(y && String(p.year)!==y) return false;
      if(c && p.category!==c) return false;
      if(pe && !(p.people||[]).some(function(t){ return t&&t.name===pe; })) return false;
      return true;
    });
    buildWall(); centre();
    if(fWrap){
      var active=!!(y||pe||c);
      fClear.hidden=!active;
      fCount.textContent=active?(PHOTOS.length+' of '+ALL.length+' photos'):'';
    }
    if(typeof window.gsap!=='undefined' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
      var cards=world.querySelectorAll('.pw-card');
      if(cards.length) gsap.from(cards,{autoAlpha:0,scale:.85,duration:.5,ease:'power2.out',
        stagger:{each:0.004,from:'random'}});
    }
  }
  if(fWrap) populateFilters();

  /* ---------- Fetch ALL entries via the Storefront API ----------
     Liquid's metaobjects drop returns at most 50 entries, so #pw-data is a
     partial fallback. Paginate the full set client-side and rebuild. */
  (function fetchAll(){
    if(!window.fetch) return;
    var API='https://christmas-songs-carols.myshopify.com/api/2024-10/graphql.json';
    var TOKEN='c8a4184e06fafbe91bb6835a3a4eccca'; // public storefront token (unauthenticated read)
    var QUERY='query($cursor:String){ metaobjects(type:"photo_wall", first:100, after:$cursor){'
      +' pageInfo{hasNextPage endCursor} nodes{'
      +' photo:field(key:"photo"){reference{... on MediaImage{ src:image{url(transform:{maxWidth:1000})} thumb:image{url(transform:{maxWidth:520})} }}}'
      +' year:field(key:"year"){value} title:field(key:"title"){value} desc:field(key:"description"){value}'
      +' location:field(key:"location"){value} category:field(key:"category"){value} link:field(key:"link"){value}'
      +' people:field(key:"people"){references(first:10){nodes{... on Metaobject{ name:field(key:"name"){value} onlineStoreUrl }}}}'
      +' product:field(key:"product"){reference{... on Product{ onlineStoreUrl featuredImage{url(transform:{maxWidth:200})} }}}'
      +' } } }';
    var all=[];
    function page(cursor){
      return fetch(API,{method:'POST',headers:{'X-Shopify-Storefront-Access-Token':TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({query:QUERY,variables:{cursor:cursor}})})
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(!j.data || !j.data.metaobjects) throw new Error('no data');
          var m=j.data.metaobjects; all=all.concat(m.nodes);
          return m.pageInfo.hasNextPage ? page(m.pageInfo.endCursor) : all;
        });
    }
    page(null).then(function(nodes){
      var mapped=nodes.map(function(n){
        var ref=n.photo && n.photo.reference;
        return {
          src: ref && ref.src ? ref.src.url : null,
          thumb: ref && ref.thumb ? ref.thumb.url : null,
          year: n.year ? n.year.value : null,
          title: n.title ? n.title.value : null,
          desc: n.desc ? n.desc.value : null,
          location: n.location ? n.location.value : null,
          category: n.category ? n.category.value : null,
          link: n.link ? n.link.value : null,
          people: n.people && n.people.references ? n.people.references.nodes.filter(Boolean).map(function(t){
            return { name: t.name ? t.name.value : '', url: t.onlineStoreUrl }; }) : [],
          product: n.product && n.product.reference ? {
            img: n.product.reference.featuredImage ? n.product.reference.featuredImage.url : '',
            url: n.product.reference.onlineStoreUrl } : null
        };
      }).filter(function(p){ return p && p.src; });
      mapped.sort(function(a,b){ return String(a.year||'').localeCompare(String(b.year||'')); });
      if(mapped.length >= ALL.length){ ALL=mapped; populateFilters(); applyFilters(); }
    }).catch(function(){ /* keep the Liquid-rendered first-50 fallback */ });
  })();

  var down=false, moved=false, sx=0, sy=0, lx=0, ly=0, vX=0, vY=0, lastT=0, raf=0, startCard=null;
  vp.addEventListener('pointerdown',function(e){
    down=true; moved=false; sx=lx=e.clientX; sy=ly=e.clientY; vX=vY=0; lastT=performance.now();
    startCard=e.target.closest('.pw-card');
    if(startCard) preload(+startCard.dataset.i);
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
  var mphoto=document.getElementById('pw-mphoto');
  var minfo=document.getElementById('pw-minfo');
  var reduceMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var modalTl=null;
  function gsapOn(){ return typeof window.gsap!=='undefined' && !reduceMotion; }
  function modalParts(){
    return { dialog: modal.querySelector('.pw-dialog'), backdrop: modal.querySelector('.pw-backdrop') };
  }
  /* warm the full-size image cache before the modal needs it */
  var preloaded={};
  function preload(i){
    var p=PHOTOS[i];
    if(!p || !p.src || preloaded[p.src]) return;
    preloaded[p.src]=true;
    var im=new Image(); im.decoding='async'; im.src=p.src;
  }
  world.addEventListener('pointerover',function(e){
    var card=e.target.closest && e.target.closest('.pw-card');
    if(card) preload(+card.dataset.i);
  });

  function openModal(i){
    var p=PHOTOS[i]; if(!p) return;
    /* blank the previous photo so it never flashes on the next card */
    mphoto.removeAttribute('src');
    mphoto.style.opacity='0';
    mphoto.alt=p.title||'';
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
    minfo.innerHTML=h;
    modal.classList.add('open');

    /* show the wall thumbnail instantly (already in the browser cache),
       then upgrade to the full-size photo in place once it has decoded */
    mphoto.onload=null; mphoto.onerror=null;
    mphoto.dataset.want=p.src;
    if(p.thumb){
      mphoto.src=p.thumb;
      mphoto.style.opacity='1';
    } else {
      mphoto.onload=function(){
        if(gsapOn()){ gsap.fromTo(mphoto,{autoAlpha:0,scale:.965},{autoAlpha:1,scale:1,duration:.5,ease:'power2.out',overwrite:'auto'}); }
        else { mphoto.style.opacity='1'; }
      };
      mphoto.onerror=function(){ mphoto.style.opacity='1'; };
    }
    var full=new Image();
    full.onload=function(){
      var swap=function(){ if(mphoto.dataset.want===p.src){ mphoto.onload=null; mphoto.src=p.src; mphoto.style.opacity='1'; } };
      if(full.decode){ full.decode().then(swap).catch(swap); } else swap();
    };
    full.src=p.src;
    if(!p.thumb) mphoto.src=p.src;

    /* entrance: backdrop blurs in, the card settles like a photo being pinned,
       then the info column staggers up */
    if(gsapOn()){
      var parts=modalParts();
      var kids=Array.prototype.slice.call(minfo.children);
      modal.classList.add('pw-gsap');
      if(modalTl) modalTl.kill();
      gsap.killTweensOf([parts.dialog,parts.backdrop].concat(kids));
      var tl=modalTl=gsap.timeline({defaults:{ease:'power3.out'}});
      tl.fromTo(parts.backdrop,{opacity:0},{opacity:1,duration:.4,ease:'power1.out'},0)
        .fromTo(parts.dialog,{y:30,scale:.93,rotation:-1.4,autoAlpha:0},
          {y:0,scale:1,rotation:0,autoAlpha:1,duration:.55,ease:'back.out(1.3)'},.05)
        .fromTo(kids,{y:18,autoAlpha:0},{y:0,autoAlpha:1,duration:.45,stagger:.07},.22);
    }
  }
  function closeModal(){
    if(!modal.classList.contains('open')) return;
    if(gsapOn()){
      var parts=modalParts();
      if(modalTl) modalTl.kill();
      gsap.killTweensOf([parts.dialog,parts.backdrop]);
      var tl=modalTl=gsap.timeline({onComplete:function(){
        modal.classList.remove('open');
        gsap.set([parts.dialog,parts.backdrop,mphoto],{clearProps:'all'});
      }});
      tl.to(parts.dialog,{y:16,scale:.96,autoAlpha:0,duration:.25,ease:'power2.in'},0)
        .to(parts.backdrop,{opacity:0,duration:.3,ease:'power1.in'},0);
    } else {
      modal.classList.remove('open');
    }
  }
  if(modal){
    modal.addEventListener('click',function(e){ if(e.target.hasAttribute('data-close')) closeModal(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeModal(); });
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
    var audio=new Audio();
    var PLAYLIST=TRACKS.slice(), queue=[], qPos=0, shuffleOn=true;
    var iPlay=document.getElementById('pw-iplay'), iPause=document.getElementById('pw-ipause');
    var elCur=document.getElementById('pw-pcur'), elDur=document.getElementById('pw-pdur');
    var elSeek=document.getElementById('pw-pseek'), elFill=document.getElementById('pw-pfill');
    var bShuf=document.getElementById('pw-pshuf'), bMute=document.getElementById('pw-pmute');
    var iVol=document.getElementById('pw-ivol'), iMute=document.getElementById('pw-imute');
    function fmt(s){ if(!isFinite(s)) return '0:00'; s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }
    function buildQueue(keepIdx){
      queue=PLAYLIST.map(function(_,i){ return i; });
      if(shuffleOn){ for(var i=queue.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=queue[i]; queue[i]=queue[j]; queue[j]=t; } }
      qPos=0;
      if(keepIdx!=null){ var k=queue.indexOf(keepIdx); if(k>0){ queue.splice(k,1); queue.unshift(keepIdx); } }
    }
    function loadT(step,go){
      if(!PLAYLIST.length) return;
      qPos=(qPos+step+queue.length)%queue.length;
      var t=PLAYLIST[queue[qPos]];
      audio.src=t.src;
      if(t.art) document.getElementById('pw-part').src=t.art;
      document.getElementById('pw-ptitle').textContent=t.title||'';
      document.getElementById('pw-partist').textContent=t.artist||'';
      elFill.style.width='0%'; elCur.textContent='0:00'; elDur.textContent='0:00';
      if(go) audio.play().catch(function(){});
    }
    document.getElementById('pw-pplay').onclick=function(){ if(audio.paused) audio.play().catch(function(){}); else audio.pause(); };
    document.getElementById('pw-pprev').onclick=function(){
      if(audio.currentTime>3){ audio.currentTime=0; } else loadT(-1,true);
    };
    document.getElementById('pw-pnext').onclick=function(){ loadT(1,true); };
    if(bShuf){
      bShuf.classList.toggle('on',shuffleOn);
      bShuf.onclick=function(){
        shuffleOn=!shuffleOn;
        bShuf.classList.toggle('on',shuffleOn);
        bShuf.setAttribute('aria-pressed',String(shuffleOn));
        buildQueue(queue[qPos]);
      };
    }
    if(bMute){
      bMute.onclick=function(){
        audio.muted=!audio.muted;
        iVol.style.display=audio.muted?'none':'block';
        iMute.style.display=audio.muted?'block':'none';
      };
    }
    if(elSeek){
      var seekTo=function(e){
        var r=elSeek.getBoundingClientRect();
        var ratio=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
        if(isFinite(audio.duration) && audio.duration>0) audio.currentTime=ratio*audio.duration;
      };
      var seeking=false;
      elSeek.addEventListener('pointerdown',function(e){ seeking=true; elSeek.classList.add('drag'); elSeek.setPointerCapture(e.pointerId); seekTo(e); });
      elSeek.addEventListener('pointermove',function(e){ if(seeking) seekTo(e); });
      var seekEnd=function(){ seeking=false; elSeek.classList.remove('drag'); };
      elSeek.addEventListener('pointerup',seekEnd);
      elSeek.addEventListener('pointercancel',seekEnd);
      elSeek.addEventListener('keydown',function(e){
        if(e.key==='ArrowRight'){ audio.currentTime=Math.min(audio.duration||0,audio.currentTime+5); }
        if(e.key==='ArrowLeft'){ audio.currentTime=Math.max(0,audio.currentTime-5); }
      });
    }
    audio.addEventListener('play',function(){ iPlay.style.display='none'; iPause.style.display='block'; });
    audio.addEventListener('pause',function(){ iPlay.style.display='block'; iPause.style.display='none'; });
    audio.addEventListener('ended',function(){ loadT(1,true); });
    audio.addEventListener('timeupdate',function(){
      if(isFinite(audio.duration) && audio.duration>0){
        elFill.style.width=(audio.currentTime/audio.duration*100)+'%';
        elSeek.setAttribute('aria-valuenow',String(Math.round(audio.currentTime/audio.duration*100)));
      }
      elCur.textContent=fmt(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata',function(){ elDur.textContent=fmt(audio.duration); });
    buildQueue();
    loadT(0,false);

    /* When the playlist wasn't hand-picked in the theme editor, upgrade the
       built-in default to the full Love to Sing catalogue (all previews). */
    var tracksEl=document.getElementById('pw-tracks');
    var plUrl=player.getAttribute('data-playlist');
    if(plUrl && window.fetch && tracksEl && tracksEl.getAttribute('data-source')!=='blocks'){
      fetch(plUrl).then(function(r){ return r.json(); }).then(function(list){
        list=(list||[]).filter(function(t){ return t && t.src; });
        if(list.length<=PLAYLIST.length) return;
        var current=PLAYLIST[queue[qPos]];
        var playing=!audio.paused || audio.currentTime>0;
        PLAYLIST=list;
        var curIdx=current?PLAYLIST.findIndex(function(t){ return t.src===current.src; }):-1;
        buildQueue(curIdx>=0?curIdx:null);
        if(!playing) loadT(0,false);
      }).catch(function(){ /* keep the built-in playlist */ });
    }
  } else if(player){ player.style.display='none'; }
})();
