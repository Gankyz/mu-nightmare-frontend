(function(){
    const cv = document.getElementById('particle-canvas'), ctx = cv.getContext('2d');
    function resize(){ cv.width=innerWidth; cv.height=innerHeight; }
    resize(); addEventListener('resize', resize);
    const P = Array.from({length:35},()=>({
        x:Math.random()*innerWidth, y:Math.random()*innerHeight,
        vx:(Math.random()-.5)*.3, vy:-(Math.random()*.4+.08),
        r:Math.random()*1.4+.4, life:Math.random(), ml:.3+Math.random()*.6
    }));
    (function draw(){
        ctx.clearRect(0,0,cv.width,cv.height);
        for(const p of P){
            p.x+=p.vx; p.y+=p.vy; p.life-=.0022;
            if(p.life<=0||p.y<-10){p.x=Math.random()*cv.width;p.y=cv.height+5;p.life=p.ml;}
            const a=(p.life/p.ml)*0.38;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle=`rgba(210,40,20,${a})`; ctx.fill();
        }
        requestAnimationFrame(draw);
    })();
})();

function setLanguage(lang){
    const t = window.muTranslations[lang];
    const c = window.muContent[lang];
    localStorage.setItem('preferred-lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el=>{
        const k=el.getAttribute('data-i18n');
        if(t[k]) el.innerText=t[k];
    });

    document.getElementById('en-btn').className = lang==='en'?'active':'';
    document.getElementById('pt-btn').className = lang==='pt'?'active':'';

    document.getElementById('downloadBtn').href = c.downloadUrl;
    document.getElementById('downloadSub').innerText = [c.clientLabel, c.clientSize].filter(Boolean).join(' · ');
    document.getElementById('serverName').innerText = c.serverName || 'Mu Nightmare';
    document.getElementById('serverDesc').innerText = c.serverDesc || '';
    const navDl = document.getElementById('downloadNavBtn');
    if (navDl) navDl.href = c.downloadUrl;

    const strip = document.getElementById('ratesStrip');
    strip.innerHTML = c.rows.flatMap(row=>row).filter(d=>!d.url).map(d=>`
        <div class="rate-chip">
            <span class="rate-chip-label">${d.label}</span>
            <span class="rate-chip-value">${d.value}</span>
        </div>
    `).join('');

    renderNews(lang);
}

setLanguage(localStorage.getItem('preferred-lang')||'en');

async function checkStatus(){
    // The dot is rewritten as part of txt's markup below, so it is never
    // looked up separately — the placeholder in the HTML only survives
    // until the first poll.
    const txt=document.getElementById('indexStatusText');
    const lang=localStorage.getItem('preferred-lang')||'en';
    const t=window.muTranslations[lang];
    try{
        const d=await(await fetch('/api/public/server-status')).json();
        const on=d.online;
        txt.className='sr-status '+(on?'online':'offline');
        txt.innerHTML=`<span class="sdot ${on?'online':'offline'}"></span>${on?(t.online||'Online'):(t.offline||'Offline')}`;
    }catch{
        txt.className='sr-status offline';
        txt.innerHTML=`<span class="sdot offline"></span>${t.offline||'Offline'}`;
    }
}

async function checkPlayers(){
    const el=document.getElementById('indexPlayersText');
    const bar=document.getElementById('playersBar');
    try{
        const d=await(await fetch('/api/public/online-players')).json();
        const n=d.playerCount??d.count??null;
        el.innerText=n!==null?n:'—';
        // Bar fills against the capacity set in content.js
        const c=window.muContent[localStorage.getItem('preferred-lang')||'en']||{};
        const max=c.maxPlayers||500;
        bar.style.width=n!==null?Math.min(100,(n/max)*100)+'%':'0';
    }catch{ el.innerText='—'; bar.style.width='0'; }
}

checkStatus(); checkPlayers();
setInterval(checkStatus,30000); setInterval(checkPlayers,30000);

// ── Top hunters preview ─────────────────────────────────────
// Reuses the ranking endpoint behind /stats. The section starts hidden
// and only reveals itself once there is something worth showing, so a
// cold or unreachable server leaves no empty shell behind.
let topHuntersData = null;

function renderTopHunters(){
    const section = document.getElementById('topHunters');
    const list    = document.getElementById('topList');
    if(!section || !list || !topHuntersData || !topHuntersData.length) return;

    list.innerHTML = topHuntersData.map((c,i)=>`
        <div class="top-row${i===0?' top-row-first':''}">
            <span class="top-rank">${i+1}</span>
            <span class="top-name">${c.name}</span>
            <span class="top-class">${c.className ?? ''}</span>
            <span class="top-level">
                <span class="top-level-val">${c.level}</span>
                <span class="reset-badge">${c.resets} RR</span>
            </span>
        </div>
    `).join('');
    section.hidden = false;
}

async function loadTopHunters(){
    try{
        const res = await fetch('/api/public/ranking');
        if(!res.ok) return;
        const data = await res.json();
        if(!Array.isArray(data) || !data.length) return;
        topHuntersData = data.slice(0,5);
        renderTopHunters();
    }catch{ /* leave the section hidden */ }
}

loadTopHunters();

// ── News: slider (items with an image) + latest list ────────
// Data lives in /shared/news.js. Declared with var/function so the
// first setLanguage() call above can render before this block runs.
var newsSlideIdx;
var newsTimer = null;

function newsEsc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function newsText(field, lang){
    if(!field) return '';
    return typeof field === 'string' ? field : (field[lang] ?? field.en ?? '');
}

function newsDate(iso, lang){
    const d = new Date(iso + 'T12:00:00');
    if(isNaN(d)) return iso;
    return lang === 'pt'
        ? d.toLocaleDateString('pt-BR')
        : d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function newsSlides(){
    return (window.muNews || []).filter(n => n.image);
}

function renderNews(lang){
    const area   = document.getElementById('newsArea');
    const slides = document.getElementById('newsSlides');
    const dots   = document.getElementById('newsDots');
    const list   = document.getElementById('newsList');
    const items  = window.muNews || [];
    if(!area || !items.length) return;

    const t = (window.muTranslations && window.muTranslations[lang]) || {};
    const featured = newsSlides();
    // Still undefined on the first call (setLanguage runs before the var line)
    if(!(newsSlideIdx < featured.length)) newsSlideIdx = 0;

    area.hidden = false;
    area.classList.toggle('news-list-only', !featured.length);

    slides.innerHTML = featured.map((n,i) => `
        <article class="news-slide${i===newsSlideIdx?' active':''}">
            <img src="${newsEsc(n.image)}" alt="" loading="${i===0?'eager':'lazy'}">
            <div class="news-slide-shade"></div>
            <h3 class="news-slide-title">${newsEsc(newsText(n.title, lang))}</h3>
            <div class="news-slide-bottom">
                <p class="news-slide-summary">${newsEsc(newsText(n.summary, lang))}</p>
                ${n.url ? `<a class="news-slide-more" href="${newsEsc(n.url)}">${newsEsc(t.newsMore || 'Read more')}</a>` : ''}
            </div>
        </article>
    `).join('');

    dots.innerHTML = featured.length > 1
        ? featured.map((_,i) => `<button type="button" class="news-dot${i===newsSlideIdx?' active':''}" data-slide="${i}" aria-label="${i+1}"></button>`).join('')
        : '';
    document.getElementById('newsSlider').classList.toggle('single', featured.length < 2);

    list.innerHTML = items.map(n => {
        const slide = featured.indexOf(n);
        const tag   = `<span class="news-tag">[${newsEsc(newsText(n.tag, lang))}]</span>`;
        const body  = `${tag}<span class="news-title">${newsEsc(newsText(n.title, lang))}</span>` +
                      `<span class="news-date">${newsEsc(newsDate(n.date, lang))}</span>`;
        const attrs = `class="news-row${slide===newsSlideIdx && slide>-1?' active':''}"` +
                      (slide > -1 ? ` data-slide="${slide}"` : '');
        return n.url ? `<a href="${newsEsc(n.url)}" ${attrs}>${body}</a>` : `<div ${attrs}>${body}</div>`;
    }).join('');
}

function showNewsSlide(i){
    const featured = newsSlides();
    if(!featured.length) return;
    newsSlideIdx = (i + featured.length) % featured.length;
    document.querySelectorAll('#newsSlides .news-slide').forEach((el,k) => el.classList.toggle('active', k===newsSlideIdx));
    document.querySelectorAll('#newsDots .news-dot').forEach((el,k) => el.classList.toggle('active', k===newsSlideIdx));
    document.querySelectorAll('#newsList .news-row').forEach(el =>
        el.classList.toggle('active', el.dataset.slide !== undefined && +el.dataset.slide === newsSlideIdx));
}

function startNewsTimer(){
    clearInterval(newsTimer);
    if(newsSlides().length > 1) newsTimer = setInterval(() => showNewsSlide(newsSlideIdx + 1), 6000);
}

(function(){
    const area = document.getElementById('newsArea');
    if(!area) return;

    document.getElementById('newsPrev').addEventListener('click', () => { showNewsSlide(newsSlideIdx - 1); startNewsTimer(); });
    document.getElementById('newsNext').addEventListener('click', () => { showNewsSlide(newsSlideIdx + 1); startNewsTimer(); });

    document.getElementById('newsDots').addEventListener('click', e => {
        const dot = e.target.closest('[data-slide]');
        if(dot){ showNewsSlide(+dot.dataset.slide); startNewsTimer(); }
    });

    // Hovering a headline previews its slide, like a news ticker
    document.getElementById('newsList').addEventListener('mouseover', e => {
        const row = e.target.closest('[data-slide]');
        if(row && +row.dataset.slide !== newsSlideIdx) showNewsSlide(+row.dataset.slide);
    });

    // Swipe on touch screens
    const slider = document.getElementById('newsSlider');
    let touchX = null;
    slider.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', e => {
        if(touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if(Math.abs(dx) > 40){ showNewsSlide(newsSlideIdx + (dx < 0 ? 1 : -1)); startNewsTimer(); }
    });

    area.addEventListener('mouseenter', () => clearInterval(newsTimer));
    area.addEventListener('mouseleave', startNewsTimer);

    startNewsTimer();
})();

// ── Discord CTA — points at the invite layout.js owns ──
(function(){
    const btn = document.getElementById('joinDiscordBtn');
    if(btn && typeof MU_DISCORD_URL === 'string') btn.href = MU_DISCORD_URL;
})();
