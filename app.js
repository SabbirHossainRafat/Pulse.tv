// ═══════════════════════════════════════════════════════════════
// PULSE.tv v5.0 — Real Diagnostics, Auto-open Ad Sidebar
// WhatsApp: +880 1755-772612
// ═══════════════════════════════════════════════════════════════
'use strict';

window.onerror = (msg, url, line) => { console.error('Error:', msg); const b = document.getElementById('error-boundary'); if (b) b.style.display = 'block'; return true; };
window.onunhandledrejection = (e) => { console.error('Rejection:', e.reason); const b = document.getElementById('error-boundary'); if (b) b.style.display = 'block'; };

const safeText = s => !s ? '' : String(s).replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[m]));
const createEl = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; };
const safeGet = (k, f = null) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const PulseApp = {
  currentChannel: null, currentCategory: 'All', hls: null, preloadedHls: null, preloadedChannel: null,
  isPlaying: false, isLive: false, liveLatency: 0, currentPage: 1, totalPages: 1,
  ITEMS_PER_PAGE: 24, controlsTimer: null, CONTROLS_HIDE_DELAY: 3500, controlsHovered: false, isDragging: false,
  leftSidebarOpen: true, rightSidebarOpen: true, isAudioOnly: false, isMiniPlayer: false, isSwitchingChannel: false,
  streamStartTime: null, uptimeInterval: null, sleepTimer: null, sleepEndTime: null,
  volumeBoost: false, audioCtx: null, gainNode: null, audioSource: null,
  favorites: safeGet('pulse_favorites', []), history: safeGet('pulse_history', []),
  recentChannels: safeGet('pulse_recent', []), accentColor: safeGet('pulse_accent', '#6c5ce7'),
  channelInputBuffer: '', channelInputTimeout: null, diagnosticInterval: null, liveStatusInterval: null,
  streamTimeoutTimer: null, observer: null,
  quickSwapKeys: safeGet('pulse_quick_swap', {}),
  adReopenTimer: null, AD_REOPEN_INTERVAL: 300000, // 5 minutes

  $(id) { return document.getElementById(id); },
  videoEl() { return this.$('video-player'); },
  miniVideoEl() { return this.$('mini-video-player'); },

  init() {
    console.log('⚡ Pulse.tv v5.0 | WhatsApp: +880 1755-772612');
    this.applyAccentColor(this.accentColor);
    this.restoreSidebars();
    this.startAdReopenTimer();
    this.buildCategoryList();
    this.setupSeek();
    this.setupAutoHideControls();
    this.setupDoubleTap();
    this.setupMiniPlayerDrag();
    this.startDiagnostics();
    this.updateRecentlyWatched();
    this.renderChannels();
    this.checkPWAInstall();
    if (typeof channels !== 'undefined' && channels.length > 0) setTimeout(() => this.playChannel(channels[0]), 600);
    this.setupKeyboard();
    console.log('✅ Ready');
  },

  showToast(msg, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const t = createEl('div', `toast ${type}`);
    t.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${safeText(msg)}`;
    const c = this.$('toast-container'); if (c) c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
  },

  // ── Accent ──
  applyAccentColor(c) {
    this.accentColor = c;
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`);
    document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.12)`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
    safeSet('pulse_accent', c);
  },
  setAccentColor(c) { this.applyAccentColor(c); this.closeSettings(); this.showToast('Accent updated!', 'success'); },
  openSettings() { this.$('settings-modal').style.display = 'flex'; this.updateAccentPicker(); },
  closeSettings() { this.$('settings-modal').style.display = 'none'; },
  updateAccentPicker() {
    document.querySelectorAll('#accent-colors button').forEach(b => b.classList.toggle('active', b.dataset.color === this.accentColor));
    const ci = this.$('custom-accent'); if (ci) ci.value = this.accentColor;
  },

  // ── Sidebars ──
  restoreSidebars() {
    this.leftSidebarOpen = safeGet('pulse_left_sidebar', true);
    this.rightSidebarOpen = safeGet('pulse_right_sidebar', true);
    if (!this.leftSidebarOpen) this.closeSidebar('left');
    if (!this.rightSidebarOpen) this.openSidebar('right'); // Open right sidebar by default
  },
  startAdReopenTimer() {
    if (this.adReopenTimer) clearInterval(this.adReopenTimer);
    this.adReopenTimer = setInterval(() => {
      if (!this.rightSidebarOpen) {
        this.openSidebar('right');
        this.showToast('Ad panel reopened', 'info');
      }
    }, this.AD_REOPEN_INTERVAL);
  },
  toggleSidebar(side) {
    if (side === 'left') this.leftSidebarOpen ? this.closeSidebar('left') : this.openSidebar('left');
    else this.rightSidebarOpen ? this.closeSidebar('right') : this.openSidebar('right');
  },
  openSidebar(side) {
    const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar');
    if (!s) return;
    s.classList.remove('collapsed'); s.classList.add('open');
    if (window.innerWidth <= 900) {
      const o = this.$(side + '-sidebar-overlay'); if (o) o.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    if (side === 'left') this.leftSidebarOpen = true; else this.rightSidebarOpen = true;
    safeSet('pulse_' + side + '_sidebar', true);
  },
  closeSidebar(side) {
    const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar');
    if (!s) return;
    s.classList.add('collapsed'); s.classList.remove('open');
    const o = this.$(side + '-sidebar-overlay'); if (o) o.classList.remove('active');
    document.body.style.overflow = '';
    if (side === 'left') this.leftSidebarOpen = false; else this.rightSidebarOpen = false;
    safeSet('pulse_' + side + '_sidebar', false);
  },

  // ── Categories, Filter, Render, Pagination (same as before) ──
  buildCategoryList() {
    const l = this.$('category-list'); if (!l) return; l.innerHTML = '';
    ['News','Sports','Entertainment','Movies','Music','Kids','Education','Lifestyle','Religion','Documentary','Business','Comedy','Technology'].forEach(cat => {
      const cols = { News:'#3b82f6',Sports:'#22c55e',Entertainment:'#a855f7',Movies:'#f59e0b',Music:'#ec4899',Kids:'#14b8a6',Education:'#6366f1',Lifestyle:'#f97316',Religion:'#8b5cf6',Documentary:'#06b6d4',Business:'#64748b',Comedy:'#eab308',Technology:'#0ea5e9' };
      const b = createEl('button', 'cat-btn');
      b.innerHTML = `<div class="cat-avatar" style="background:${cols[cat]||'#555'}">${cat.substring(0,2).toUpperCase()}</div>${cat}`;
      b.onclick = () => { document.querySelectorAll('.cat-btn,.nav-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); this.setCategory(cat); if (window.innerWidth <= 900) this.closeSidebar('left'); };
      l.appendChild(b);
    });
  },
  setCategory(c) { this.currentCategory = c; this.currentPage = 1; this.$('section-title').textContent = c; document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === c)); this.renderChannels(); },
  filterChannels() { this.currentPage = 1; this.renderChannels(); },
  renderChannels() {
    const grid = this.$('channel-grid'), sk = this.$('skeleton-grid'), em = this.$('empty-message'), pb = this.$('pagination-bar');
    if (!grid) return;
    if (sk) { sk.style.display = 'grid'; this.renderSkeletons(); }
    grid.innerHTML = ''; if (em) em.style.display = 'none'; if (pb) pb.style.display = 'none';
    requestAnimationFrame(() => {
      if (sk) sk.style.display = 'none';
      let f = [...(typeof channels !== 'undefined' ? channels : [])];
      if (this.currentCategory === 'Favorites') f = f.filter(c => this.favorites.includes(String(c.id || c.name)));
      else if (this.currentCategory === 'History') f = this.history.map(id => f.find(c => String(c.id || c.name) === id)).filter(Boolean);
      else if (this.currentCategory !== 'All') f = f.filter(c => c.category === this.currentCategory);
      const q = (this.$('search-input')?.value || '').toLowerCase().trim();
      if (q) f = f.filter(c => (c.name||'').toLowerCase().includes(q) || (c.category||'').toLowerCase().includes(q));
      this.totalPages = Math.max(1, Math.ceil(f.length / this.ITEMS_PER_PAGE));
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      this.$('channels-count').textContent = `${f.length} channel${f.length!==1?'s':''}`;
      if (f.length === 0) { if (em) em.style.display = 'block'; return; }
      if (f.length > this.ITEMS_PER_PAGE) { if (pb) pb.style.display = 'flex'; this.renderPagination(f.length); }
      const start = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
      f.slice(start, start + this.ITEMS_PER_PAGE).forEach((ch, i) => grid.appendChild(this.buildChannelCard(ch, i)));
    });
  },
  renderSkeletons() { const g = this.$('skeleton-grid'); if (!g) return; g.innerHTML = ''; for (let i=0;i<8;i++) g.innerHTML += '<div class="skeleton-card"><div class="skel-avatar"></div><div class="skel-line skel-line--title"></div><div class="skel-line skel-line--cat"></div></div>'; },
  buildChannelCard(ch, idx) {
    const card = createEl('div', 'channel-card'); card.style.animationDelay = `${Math.min(idx*15,150)}ms`;
    if (this.currentChannel && (ch.id === this.currentChannel.id || ch.name === this.currentChannel.name)) card.classList.add('playing');
    const init = safeText((ch.name||'TV').substring(0,2).toUpperCase());
    const bg = { News:'#3b82f6',Sports:'#22c55e',Entertainment:'#a855f7',Movies:'#f59e0b',Music:'#ec4899',Kids:'#14b8a6' }[ch.category] || '#555';
    const isFav = this.favorites.includes(String(ch.id || ch.name));
    const av = createEl('div', 'card-avatar'); av.style.background = ch.logo ? 'transparent' : bg;
    if (ch.logo) { const img = document.createElement('img'); img.src = ch.logo; img.alt = ''; img.loading = 'lazy'; img.className = 'card-avatar-img'; img.onerror = () => { img.style.display='none'; av.style.background=bg; av.textContent=init; }; av.appendChild(img); } else av.textContent = init;
    const nm = createEl('div', 'card-name', ch.name || 'Unknown');
    const ct = createEl('div', 'card-category', ch.category || 'Entertainment');
    const fb = createEl('button', `card-fav-btn${isFav?' active':''}`); fb.innerHTML = `<i class="fa-${isFav?'solid':'regular'} fa-heart"></i>`;
    fb.onclick = (e) => { e.stopPropagation(); this.toggleFavorite(String(ch.id||ch.name), fb); };
    if (this.currentChannel && (ch.id === this.currentChannel.id || ch.name === this.currentChannel.name)) card.appendChild(createEl('div', 'card-now-playing', 'NOW PLAYING'));
    card.append(av, nm, ct, fb);
    card.onclick = () => this.playChannel(ch);
    return card;
  },
  renderPagination(t) {
    const pi = this.$('pagination-info'), pp = this.$('pagination-pages'), pr = this.$('prev-page-btn'), nx = this.$('next-page-btn');
    if (!pp) return;
    const s = (this.currentPage-1)*this.ITEMS_PER_PAGE+1, e = Math.min(this.currentPage*this.ITEMS_PER_PAGE, t);
    if (pi) pi.innerHTML = `Showing <strong>${s}–${e}</strong> of <strong>${t}</strong>`;
    if (pr) pr.disabled = this.currentPage <= 1; if (nx) nx.disabled = this.currentPage >= this.totalPages;
    pp.innerHTML = ''; if (this.totalPages <= 1) return;
    for (let p=1; p<=this.totalPages; p++) {
      if (p>2 && p<this.currentPage-2 && p<this.totalPages-3) { if (p===3) pp.appendChild(Object.assign(document.createElement('span'),{textContent:'…',style:'padding:0 6px;color:var(--text-muted)'})); continue; }
      if (p<this.totalPages-1 && p>this.currentPage+2 && p>4) { if (p===this.totalPages-2) pp.appendChild(Object.assign(document.createElement('span'),{textContent:'…',style:'padding:0 6px;color:var(--text-muted)'})); continue; }
      const b = createEl('button', `page-num-btn${p===this.currentPage?' active':''}`, String(p)); b.onclick = () => this.goToPage(p); pp.appendChild(b);
    }
  },
  goToPage(p) { if (p<1||p>this.totalPages) return; this.currentPage = p; this.renderChannels(); document.querySelector('.channels-section')?.scrollIntoView({behavior:'smooth',block:'start'}); },
  toggleFavorite(id, btn) {
    const i = this.favorites.indexOf(id);
    if (i>-1) { this.favorites.splice(i,1); btn.classList.remove('active'); btn.innerHTML='<i class="fa-regular fa-heart"></i>'; this.showToast('Removed'); }
    else { this.favorites.push(id); btn.classList.add('active'); btn.innerHTML='<i class="fa-solid fa-heart"></i>'; this.showToast('Added!','success'); }
    safeSet('pulse_favorites', this.favorites);
  },

  // ── Stream Preloading ──
  preloadNextChannel() {
    if (!this.currentChannel || typeof channels === 'undefined') return;
    const idx = channels.findIndex(c => c === this.currentChannel);
    const next = channels[(idx + 1) % channels.length];
    if (!next || !next.url || next === this.preloadedChannel) return;
    if (this.preloadedHls) { this.preloadedHls.destroy(); this.preloadedHls = null; }
    if (typeof Hls === 'undefined' || !Hls.isSupported()) return;
    this.preloadedHls = new Hls({ enableWorker: true, startLevel: -1 });
    this.preloadedHls.loadSource(next.url);
    this.preloadedChannel = next;
    this.preloadedHls.on(Hls.Events.MANIFEST_PARSED, () => { console.log('⏭️ Preloaded:', next.name); });
    this.preloadedHls.on(Hls.Events.ERROR, () => { this.preloadedHls?.destroy(); this.preloadedHls = null; this.preloadedChannel = null; });
  },

  // ── Play Channel ──
  playChannel(channel) {
    if (this.isSwitchingChannel) return;
    this.isSwitchingChannel = true;
    try {
      if (!channel?.url) { this.showToast('No URL','error'); this.isSwitchingChannel=false; return; }
      console.log('▶️', channel.name);
      this.currentChannel = channel;
      this.$('channel-name-display').textContent = channel.name;
      this.$('mini-player-title').textContent = channel.name;
      const id = String(channel.id || channel.name);
      this.history = this.history.filter(h => h !== id); this.history.unshift(id);
      safeSet('pulse_history', this.history.slice(0,50));
      this.recentChannels = this.recentChannels.filter(r => r.id !== id);
      this.recentChannels.unshift({id,name:channel.name,logo:channel.logo,category:channel.category});
      this.recentChannels = this.recentChannels.slice(0,5);
      safeSet('pulse_recent', this.recentChannels);
      this.updateRecentlyWatched();
      this.showLoading(true); this.hideError();
      this.$('live-badge').style.display = 'none'; this.$('go-live-btn').style.display = 'none';
      if (this.hls) { this.hls.destroy(); this.hls = null; }
      this.clearAllIntervals();
      const v = this.videoEl(); if (v) { v.src = ''; v.load(); }
      this.streamStartTime = Date.now(); this.updateStreamUptime();
      this.streamTimeoutTimer = setTimeout(() => { if (this.$('loading-spinner')?.style.display !== 'none') { this.showLoading(false); this.showError('Stream timed out'); this.hls?.destroy(); this.hls = null; } }, 30000);

      if (this.preloadedChannel && (this.preloadedChannel.id === channel.id || this.preloadedChannel.url === channel.url) && this.preloadedHls) {
        console.log('⚡ Using preloaded stream');
        this.hls = this.preloadedHls; this.preloadedHls = null; this.preloadedChannel = null;
        this.hls.attachMedia(v);
        this.showLoading(false); this.updateLiveStatus(); this.updateQualitySelector();
        this.$('diag-resolution').textContent = 'Auto (ABR)';
        v.play().then(() => { this.isPlaying = true; this.isLive = true; this.updatePlayBtn(); this.showLiveBadge(); }).catch(() => this.updatePlayBtn());
      } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hls = new Hls({ maxBufferLength:30, maxMaxBufferLength:60, enableWorker:true, startLevel:-1, fragLoadingTimeOut:15000, manifestLoadingTimeOut:15000, liveSyncDurationCount:3 });
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => { clearTimeout(this.streamTimeoutTimer); this.showLoading(false); this.updateLiveStatus(); this.updateQualitySelector(); this.$('diag-resolution').textContent='Auto (ABR)'; v.play().then(()=>{this.isPlaying=true;this.isLive=true;this.updatePlayBtn();this.showLiveBadge();}).catch(()=>this.updatePlayBtn()); this.preloadNextChannel(); });
        this.hls.on(Hls.Events.LEVEL_SWITCHED, (_,d) => { const l=this.hls.levels[d.level]; if(l) this.$('diag-resolution').textContent = l.height?`${l.width}×${l.height}`:`Level ${d.level+1}`; });
        this.hls.on(Hls.Events.FRAG_BUFFERED, () => { this.updateDiagnosticsRealTime(); });
        this.hls.on(Hls.Events.ERROR, (_,d) => { if(d.fatal){ clearTimeout(this.streamTimeoutTimer); this.hideLiveBadge(); this.showLoading(false); this.showError('Stream error'); this.hls.destroy(); this.hls=null; } });
        this.updateStreamHealth('buffering');
        this.hls.loadSource(channel.url); this.hls.attachMedia(v);
      } else { v.src = channel.url; v.load(); v.play().then(()=>{this.showLoading(false);this.showLiveBadge();this.isPlaying=true;this.isLive=true;this.updatePlayBtn();}).catch(()=>{this.showLoading(false);this.showError('Failed');}); }
      if (this.isMiniPlayer) { const mv = this.miniVideoEl(); if (mv) { mv.src = v.src; mv.play().catch(()=>{}); } }
      this.renderChannels(); this.resetControlsTimer();
    } catch(e) { console.error(e); this.showLoading(false); this.showError('Error'); }
    finally { setTimeout(() => { this.isSwitchingChannel = false; }, 500); }
  },
  retryStream() { if (this.currentChannel) this.playChannel(this.currentChannel); },

  // ── Volume Boost ──
  initAudioContext() {
    if (this.audioCtx) return;
    try { this.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); this.gainNode = this.audioCtx.createGain(); this.audioSource = this.audioCtx.createMediaElementSource(this.videoEl()); this.audioSource.connect(this.gainNode); this.gainNode.connect(this.audioCtx.destination); this.gainNode.gain.value = 1; } catch(e) { console.warn('Audio:', e); }
  },
  toggleVolumeBoost() { this.initAudioContext(); if(!this.gainNode)return; this.volumeBoost=!this.volumeBoost; this.gainNode.gain.value=this.volumeBoost?2.0:1.0; this.$('boost-btn').classList.toggle('active',this.volumeBoost); this.$('volume-slider').max=this.volumeBoost?'200':'100'; this.showToast(this.volumeBoost?'Volume Boost ON (200%)':'Volume Boost OFF'); },
  changeVolume(val) { this.initAudioContext(); const v=Math.max(0,Math.min(1,val/100)); if(this.videoEl()){this.videoEl().volume=v;this.videoEl().muted=false;} if(this.gainNode&&!this.volumeBoost)this.gainNode.gain.value=1; this.updateMuteIcon(); },
  toggleMute() { const v=this.videoEl(); if(v)v.muted=!v.muted; this.updateMuteIcon(); },
  updateMuteIcon() { const v=this.videoEl(),b=this.$('mute-btn'); if(!v||!b)return; b.innerHTML=(v.muted||v.volume===0)?'<i class="fa-solid fa-volume-xmark"></i>':v.volume<0.5?'<i class="fa-solid fa-volume-low"></i>':'<i class="fa-solid fa-volume-high"></i>'; },

  // ── Mini Player ──
  toggleMiniPlayer() { this.isMiniPlayer=!this.isMiniPlayer; this.$('mini-player').style.display=this.isMiniPlayer?'block':'none'; if(this.isMiniPlayer&&this.videoEl()){const mv=this.miniVideoEl();if(mv){mv.src=this.videoEl().src;mv.play().catch(()=>{});}} this.showToast(this.isMiniPlayer?'Mini player active':'Mini player closed'); },
  closeMiniPlayer() { this.isMiniPlayer=false; this.$('mini-player').style.display='none'; },
  setupMiniPlayerDrag() { const mp=this.$('mini-player'); if(!mp)return; let sx,sy,sl,st; mp.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY;const r=mp.getBoundingClientRect();sl=r.left;st=r.top;mp.setPointerCapture(e.pointerId);const move=ev=>{mp.style.left=`${sl+ev.clientX-sx}px`;mp.style.top=`${st+ev.clientY-sy}px`;mp.style.right='auto';mp.style.bottom='auto';};const up=()=>{mp.removeEventListener('pointermove',move);mp.removeEventListener('pointerup',up);};mp.addEventListener('pointermove',move);mp.addEventListener('pointerup',up);}); },

  // ── Live Status ──
  updateLiveStatus() {
    this.clearAllIntervals();
    if (!this.hls) return;
    this.liveStatusInterval = setInterval(() => {
      if (!this.hls || !this.isPlaying) { clearInterval(this.liveStatusInterval); return; }
      const v = this.videoEl(); if (!v) return;
      this.liveLatency = this.hls.latency ?? (isFinite(v.duration) && v.duration > 0 ? v.duration - v.currentTime : 0);
      const td = this.$('time-display');
      if (td) {
        if (isFinite(v.duration) && v.duration > 0) { td.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`; td.classList.remove('live-at-edge'); }
        else if (this.liveLatency < 2) { td.textContent = 'LIVE'; td.classList.add('live-at-edge'); }
        else { td.textContent = `-${this.formatTime(this.liveLatency)}`; td.classList.remove('live-at-edge'); }
      }
      const lb = this.$('live-badge'), gl = this.$('go-live-btn');
      if (this.liveLatency < 2) { if (lb) { lb.style.display='flex'; lb.className='live-badge live-active'; } if (gl) gl.style.display='none'; this.updateStreamHealth('healthy'); }
      else if (this.liveLatency < 10) { if (lb) { lb.style.display='flex'; lb.className='live-badge live-delayed'; } if (gl) gl.style.display='none'; }
      else { if (lb) lb.style.display='none'; if (gl) gl.style.display='flex'; }
    }, 1000);
  },
  goLive() { const v=this.videoEl(); if(!v)return; if(isFinite(v.duration))v.currentTime=v.duration; if(this.hls?.liveSyncPosition)v.currentTime=this.hls.liveSyncPosition; this.$('go-live-btn').style.display='none'; this.showLiveBadge(); },
  showLiveBadge() { this.$('live-badge').style.display='flex'; this.$('live-badge').className='live-badge live-active'; this.$('go-live-btn').style.display='none'; this.updateLiveStatus(); },
  hideLiveBadge() { this.$('live-badge').style.display='none'; this.$('go-live-btn').style.display='none'; this.clearAllIntervals(); },
  clearAllIntervals() { ['liveStatusInterval','uptimeInterval','diagnosticInterval'].forEach(k => { if(this[k]){clearInterval(this[k]);this[k]=null;} }); if(this.streamTimeoutTimer){clearTimeout(this.streamTimeoutTimer);this.streamTimeoutTimer=null;} },
  updateStreamHealth(s) { const h=this.$('stream-health'),d=h?.querySelector('.health-dot'); if(!h||!d)return; h.style.display='flex'; d.classList.remove('buffering','poor'); if(s==='healthy')d.style.background='var(--health-green)'; else if(s==='buffering'){d.style.background='var(--health-yellow)';d.classList.add('buffering');}else{d.style.background='var(--health-red)';d.classList.add('poor');} },
  updateStreamUptime() { if(this.uptimeInterval)clearInterval(this.uptimeInterval); this.uptimeInterval=setInterval(()=>{if(!this.streamStartTime||!this.isPlaying)return;const e=Math.floor((Date.now()-this.streamStartTime)/1000);const u=this.$('stream-uptime');if(u){u.style.display='inline';const m=Math.floor(e/60);u.textContent=m<60?`📺 ${m}m`:`📺 ${Math.floor(m/60)}h ${m%60}m`;}},10000); },
  updateRecentlyWatched() { const c=this.$('recently-watched'),l=this.$('recently-watched-list'); if(!c||!l)return; if(!this.recentChannels.length){c.style.display='none';return;} c.style.display='block';l.innerHTML=''; this.recentChannels.forEach(ch=>{const i=createEl('div','recently-watched-item');i.innerHTML=`<div class="rw-avatar" style="background:var(--surface3)">${safeText((ch.name||'TV').substring(0,2).toUpperCase())}</div><span>${safeText(ch.name)}</span>`;i.onclick=()=>{const fc=(typeof channels!=='undefined'?channels:[]).find(c=>String(c.id||c.name)===ch.id);if(fc)this.playChannel(fc);};l.appendChild(i);}); },

  // ── Real Diagnostics ──
  updateDiagnosticsRealTime() {
    const v = this.videoEl(); if (!v) return;
    let bufSec = 0;
    if (v.buffered.length > 0) { const ct = v.currentTime; for (let i = 0; i < v.buffered.length; i++) { if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) { bufSec = v.buffered.end(i) - ct; break; } } }
    this.$('diag-buffer').textContent = `${bufSec.toFixed(1)}s`;
    if (this.hls?.latency !== undefined && this.hls.latency !== null) this.$('diag-latency').textContent = `${Math.round(this.hls.latency * 1000)}ms`;
    if (this.hls?.bandwidthEstimate) this.$('diag-bandwidth').textContent = `${(this.hls.bandwidthEstimate / 1000).toFixed(0)} kbps`;
  },
  startDiagnostics() {
    if (this.diagnosticInterval) clearInterval(this.diagnosticInterval);
    this.diagnosticInterval = setInterval(() => {
      if (!this.currentChannel) return;
      this.updateDiagnosticsRealTime();
    }, 1000);
  },

  // ── EPG ──
  openEPG() { if(!this.currentChannel){this.showToast('Select a channel first','warning');return;} this.$('epg-channel-name').textContent=this.currentChannel.name; this.generateEPG(); this.$('epg-modal').style.display='flex'; },
  closeEPG() { this.$('epg-modal').style.display='none'; },
  generateEPG() { const now=new Date(),seed=this.currentChannel?.name?.length||5; const programs=['Morning News','Live Sports Coverage','Talk Show','Documentary Hour','Evening Debate','Prime Time Movie','Music Countdown','World Report','Late Night Show']; const tl=this.$('epg-timeline'); tl.innerHTML=''; let bs=new Date(now); bs.setMinutes(0,0,0); bs.setHours(bs.getHours()-1); for(let i=0;i<7;i++){const dur=30+((seed+i*7)%3)*30;const be=new Date(bs.getTime()+dur*60000);const prog=programs[(seed+i*3)%programs.length];const isNow=now>=bs&&now<be;if(isNow){const el=now-bs,tot=be-bs;this.$('epg-now-title').textContent=prog;this.$('epg-now-time').textContent=`${this.fmt(bs)} – ${this.fmt(be)}`;this.$('epg-now-progress').style.width=`${Math.min(100,(el/tot)*100)}%`;}const it=createEl('div',`epg-item${isNow?' epg-item--now':''}`);it.innerHTML=`<span class="epg-item-time">${this.fmt(bs)}</span><span class="epg-item-title">${prog}</span>${isNow?'<span class="epg-now-badge">NOW</span>':''}`;tl.appendChild(it);bs=be;} },
  fmt(d) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; },

  // ── Export ──
  exportFavorites() { if(!this.favorites.length){this.showToast('No favorites','warning');return;} const fc=(typeof channels!=='undefined'?channels:[]).filter(c=>this.favorites.includes(String(c.id||c.name))); let m3u='#EXTM3U\n#PLAYLIST: Pulse.tv Favorites\n'; fc.forEach(c=>{m3u+=`#EXTINF:-1 tvg-id="${c.id||''}" tvg-logo="${c.logo||''}" group-title="${c.category||'Entertainment'}",${c.name}\n${c.url}\n`;}); const b=new Blob([m3u],{type:'audio/x-mpegurl'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='pulse-favorites.m3u'; a.click(); URL.revokeObjectURL(a.href); this.showToast('Favorites exported!','success'); },

  // ── Quick Swap ──
  assignQuickSwap(key) { if(!this.currentChannel)return; this.quickSwapKeys[key]=String(this.currentChannel.id||this.currentChannel.name); safeSet('pulse_quick_swap',this.quickSwapKeys); this.showToast(`Assigned to Ctrl+${key.toUpperCase()}`,'success'); },
  swapToQuickChannel(key) { const id=this.quickSwapKeys[key]; if(!id)return; const ch=(typeof channels!=='undefined'?channels:[]).find(c=>String(c.id||c.name)===id); if(ch)this.playChannel(ch); },

  // ── Controls ──
  togglePlay() { const v=this.videoEl(); if(!v)return; if(!v.src&&this.currentChannel){this.playChannel(this.currentChannel);return;} v.paused?v.play().then(()=>{this.isPlaying=true;this.updatePlayBtn();}):(v.pause(),this.isPlaying=false,this.updatePlayBtn()); },
  updatePlayBtn() { const b=this.$('play-btn'); if(b)b.innerHTML=this.isPlaying?'<i class="fa-solid fa-pause"></i>':'<i class="fa-solid fa-play"></i>'; },
  nextChannel() { const l=typeof channels!=='undefined'?channels:[]; if(!l.length)return; const i=l.findIndex(c=>c===this.currentChannel); this.playChannel(l[i>=0?(i+1)%l.length:0]); },
  prevChannel() { const l=typeof channels!=='undefined'?channels:[]; if(!l.length)return; const i=l.findIndex(c=>c===this.currentChannel); this.playChannel(l[i>0?i-1:l.length-1]); },
  formatTime(s) { if(!isFinite(s)||isNaN(s)||s<0)return'0:00';const abs=Math.floor(Math.abs(s)),h=Math.floor(abs/3600),m=Math.floor((abs%3600)/60),sec=abs%60;return`${s<0?'-':''}${h>0?h+':'+String(m).padStart(2,'0'):m}:${String(sec).padStart(2,'0')}`; },
  toggleAudioOnly() { this.isAudioOnly=!this.isAudioOnly; this.$('video-wrapper').classList.toggle('audio-only',this.isAudioOnly); this.$('audio-only-overlay').style.display=this.isAudioOnly?'flex':'none'; this.$('audio-only-btn').classList.toggle('active',this.isAudioOnly); },
  setupSeek() { const c=this.$('progress-bar-container'),t=this.$('progress-track'); if(!c||!t)return; const gf=cx=>{const r=t.getBoundingClientRect();return Math.max(0,Math.min(1,(cx-r.left)/r.width));}; const ap=cx=>{const v=this.videoEl();if(!v||!isFinite(v.duration)||v.duration<=0)return;v.currentTime=gf(cx)*v.duration;}; c.addEventListener('mousedown',e=>{this.isDragging=true;ap(e.clientX);e.preventDefault();}); c.addEventListener('mousemove',e=>{if(this.isDragging)ap(e.clientX);}); c.addEventListener('touchstart',e=>{this.isDragging=true;ap(e.touches[0].clientX);},{passive:true}); c.addEventListener('touchmove',e=>{if(this.isDragging)ap(e.touches[0].clientX);},{passive:true}); window.addEventListener('mouseup',()=>{this.isDragging=false;}); window.addEventListener('touchend',()=>{this.isDragging=false;}); },
  resetControlsTimer() { clearTimeout(this.controlsTimer); this.showControls(); if(this.isPlaying&&!this.controlsHovered)this.controlsTimer=setTimeout(()=>this.hideControls(),this.CONTROLS_HIDE_DELAY); },
  showControls() { this.$('video-wrapper')?.classList.remove('controls-hidden'); },
  hideControls() { if(!this.isPlaying||this.controlsHovered||this.isDragging)return; this.$('video-wrapper')?.classList.add('controls-hidden'); },
  setupAutoHideControls() { const w=this.$('video-wrapper'); if(!w)return; w.addEventListener('mousemove',()=>this.resetControlsTimer()); w.addEventListener('click',()=>this.resetControlsTimer()); w.addEventListener('touchstart',()=>this.resetControlsTimer(),{passive:true}); const p=this.$('progress-bar-container'); if(p){p.addEventListener('mouseenter',()=>{this.controlsHovered=true;this.showControls();clearTimeout(this.controlsTimer);});p.addEventListener('mouseleave',()=>{this.controlsHovered=false;this.resetControlsTimer();});} this.videoEl()?.addEventListener('play',()=>this.resetControlsTimer()); this.videoEl()?.addEventListener('pause',()=>this.showControls()); },
  setupDoubleTap() { const w=this.$('video-wrapper'); if(!w)return; let lt=0; w.addEventListener('touchend',e=>{if(e.target.closest('.player-controls,.player-controls-secondary,.progress-bar-container'))return;if(e.changedTouches.length!==1)return;const n=Date.now();if(n-lt<300){e.preventDefault();const v=this.videoEl();if(!v)return;const r=w.getBoundingClientRect(),tx=e.changedTouches[0].clientX-r.left;tx<r.width/2?(v.currentTime=Math.max(0,v.currentTime-10),this.showDbl('left')):(v.currentTime=isFinite(v.duration)?Math.min(v.duration,v.currentTime+10):v.currentTime+10,this.showDbl('right'));lt=0;}else lt=n;}); },
  showDbl(s) { const e=this.$(s==='left'?'dbl-tap-left':'dbl-tap-right'); if(!e)return; e.classList.add('show'); clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('show'),550); },
  updateQualitySelector() { const s=this.$('quality-levels'); if(!s)return; s.innerHTML='<option value="-1">Auto</option>'; if(!this.hls?.levels?.length)return; this.hls.levels.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=l.height?`${l.height}p`:`Level ${i+1}`;s.appendChild(o);}); },
  changeQuality(v) { if(!this.hls)return; const i=parseInt(v); this.hls.currentLevel=i; this.showToast(`Quality: ${i===-1?'Auto':(this.hls.levels[i]?.height?`${this.hls.levels[i].height}p`:`Level ${i+1}`)}`,'success'); },
  toggleFullscreen() { const w=this.$('video-wrapper'); if(!w)return; document.fullscreenElement?(document.exitFullscreen||document.webkitExitFullscreen)?.call(document):(w.requestFullscreen||w.webkitRequestFullscreen)?.call(w); },
  async togglePiP() { if(!document.pictureInPictureEnabled){this.showToast('PiP not supported','warning');return;} try{document.pictureInPictureElement?await document.exitPictureInPicture():await this.videoEl()?.requestPictureInPicture();}catch{} },
  checkPWAInstall() { if(window.matchMedia('(display-mode:standalone)').matches||safeGet('pwa_dismissed'))return; this.$('pwa-install-banner').style.display='block'; },
  installPWA() { this.showToast('Open browser menu → "Add to Home Screen"','info'); this.dismissPWA(); },
  dismissPWA() { this.$('pwa-install-banner').style.display='none'; safeSet('pwa_dismissed',true); },
  openSleepTimer() { this.$('sleep-timer-modal').style.display='flex'; this.updateSleepTimerStatus(); },
  closeSleepTimer() { this.$('sleep-timer-modal').style.display='none'; },
  setSleepTimer(m) { if(this.sleepTimer)clearTimeout(this.sleepTimer); if(m===0){this.sleepTimer=null;this.sleepEndTime=null;this.showToast('Cancelled');this.closeSleepTimer();return;} this.sleepEndTime=Date.now()+m*60000; this.sleepTimer=setTimeout(()=>{this.videoEl()?.pause();this.isPlaying=false;this.updatePlayBtn();this.showToast('Sleep timer ended','success');this.closeSleepTimer();},m*60000); this.showToast(`Set for ${m} min`,'success'); this.updateSleepTimerStatus(); },
  updateSleepTimerStatus() { const s=this.$('sleep-timer-status'); if(s)s.textContent=this.sleepEndTime?`⏰ ${Math.ceil((this.sleepEndTime-Date.now())/60000)} min remaining`:''; },
  openM3UImport() { this.$('m3u-modal').style.display='flex'; },
  closeM3UImport() { this.$('m3u-modal').style.display='none'; },
  async importM3U() { const ui=this.$('m3u-url'),fi=this.$('m3u-file');let c='';if(ui?.value.trim()){try{const r=await fetch(ui.value.trim());c=await r.text();}catch{this.showToast('Failed','error');return;}}else if(fi?.files[0]){c=await fi.files[0].text();}else{this.showToast('Provide URL or file','warning');return;}const p=this.parseM3U(c);if(!p.length){this.showToast('No streams','warning');return;}const ex=new Set((typeof channels!=='undefined'?channels:[]).map(x=>x.url));const nw=p.filter(x=>!ex.has(x.url));if(typeof channels!=='undefined')channels.push(...nw);this.showToast(`Imported ${nw.length} channels!`,'success');this.closeM3UImport();this.renderChannels(); },
  parseM3U(c) { const l=c.split(/\r?\n/),r=[];let cur=null;for(const ln of l){const t=ln.trim();if(!t)continue;if(t.startsWith('#EXTINF:')){cur={id:'IM'+Date.now()+Math.random(),logo:'',category:'Entertainment'};const lm=t.match(/tvg-logo="([^"]+)"/);if(lm)cur.logo=lm[1];const gm=t.match(/group-title="([^"]+)"/);if(gm)cur.category=gm[1];const ci=t.lastIndexOf(',');cur.name=ci!==-1?t.substring(ci+1).trim():'Imported';}else if(!t.startsWith('#')&&cur){cur.url=t;r.push({...cur});cur=null;}}return r; },

  // ── Keyboard ──
  setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key>='0'&&e.key<='9') { e.preventDefault(); this.channelInputBuffer+=e.key; if(this.channelInputBuffer.length>3)this.channelInputBuffer=this.channelInputBuffer.slice(-3); this.$('channel-name-display').textContent=`Channel ${this.channelInputBuffer}...`; clearTimeout(this.channelInputTimeout); this.channelInputTimeout=setTimeout(()=>{const n=parseInt(this.channelInputBuffer); if(n>0&&n<=(typeof channels!=='undefined'?channels.length:0))this.playChannel(channels[n-1]); else if(this.currentChannel)this.$('channel-name-display').textContent=this.currentChannel.name; this.channelInputBuffer='';},1200); return; }
      if (e.ctrlKey && e.key>='0'&&e.key<='9') { e.preventDefault(); this.assignQuickSwap(e.key); return; }
      if (e.altKey && e.key>='0'&&e.key<='9') { e.preventDefault(); this.swapToQuickChannel(e.key); return; }
      switch(e.key) {
        case ' ':e.preventDefault();this.togglePlay();break;
        case 'ArrowLeft':e.preventDefault();this.videoEl().currentTime-=5;break;
        case 'ArrowRight':e.preventDefault();const d=this.videoEl()?.duration;this.videoEl().currentTime=isFinite(d)?Math.min(d,this.videoEl().currentTime+5):this.videoEl().currentTime+5;break;
        case 'ArrowUp':e.preventDefault();this.videoEl().volume=Math.min(1,this.videoEl().volume+0.1);this.updateMuteIcon();break;
        case 'ArrowDown':e.preventDefault();this.videoEl().volume=Math.max(0,this.videoEl().volume-0.1);this.updateMuteIcon();break;
        case 'm':case'M':this.toggleMute();break;
        case 'f':case'F':this.toggleFullscreen();break;
        case 'p':case'P':this.togglePiP();break;
        case 'j':case'J':this.prevChannel();break;
        case 'l':case'L':this.nextChannel();break;
        case 'b':case'B':this.toggleSidebar('left');break;
        case 'a':case'A':this.toggleAudioOnly();break;
        case 'i':case'I':this.toggleMiniPlayer();break;
        case 'g':case'G':this.openEPG();break;
        case 'Escape':this.closeAllModals();break;
      }
    });
  },
  closeAllModals() { ['epg-modal','settings-modal','sleep-timer-modal','m3u-modal'].forEach(id=>{const m=this.$(id);if(m)m.style.display='none';}); },
  showLoading(s) { this.$('loading-spinner').style.display = s?'flex':'none'; },
  showError(msg) { this.$('error-message').style.display='flex'; this.$('error-message-text').textContent = msg||'Stream unavailable'; },
  hideError() { this.$('error-message').style.display='none'; }
};

document.addEventListener('DOMContentLoaded', () => PulseApp.init());
window.addEventListener('beforeunload', () => { PulseApp.clearAllIntervals(); PulseApp.hls?.destroy(); PulseApp.preloadedHls?.destroy(); if(PulseApp.sleepTimer)clearTimeout(PulseApp.sleepTimer); if(PulseApp.adReopenTimer)clearInterval(PulseApp.adReopenTimer); });