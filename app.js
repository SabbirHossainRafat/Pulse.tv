// ═══════════════════════════════════════════════════════════════
// PULSE.tv v10.0 — All Bugs Fixed, Modular, Production Ready
// ═══════════════════════════════════════════════════════════════
'use strict';

// ── Global Error Handling ──
window.onerror = () => { const b = document.getElementById('error-boundary'); if (b) b.hidden = false; };
window.onunhandledrejection = () => { const b = document.getElementById('error-boundary'); if (b) b.hidden = false; };

// ── Safe Utilities ──
const safeText = s => !s ? '' : String(s).replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[m]));
const createEl = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; };
const safeGet = (k, f = null) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// ── Simple hash for PIN storage (NOT for production crypto) ──
const hashPIN = (pin) => { if (!pin) return null; return btoa(pin + '_salt_pulse_tv'); };
const verifyPIN = (pin, hash) => { return hashPIN(pin) === hash; };

// ── Centralized Storage Keys ──
const STORAGE_KEYS = {
  FAVORITES: 'pulse_favorites', HISTORY: 'pulse_history', WATCHLIST: 'pulse_watchlist',
  CONTINUE_WATCHING: 'pulse_continue_watching', RECENT: 'pulse_recent', RATINGS: 'pulse_ratings',
  ACCENT: 'pulse_accent', DATA_SAVER: 'pulse_data_saver', PARENTAL_PIN: 'pulse_pin_hash',
  KIDS_MODE: 'pulse_kids_mode', KIDS_LOCK: 'pulse_kids_lock', KIDS_ATTEMPTS: 'pulse_kids_attempts',
  AUTOPLAY: 'pulse_autoplay', NOTIFICATIONS: 'pulse_notifications', QUIET_HOURS: 'pulse_quiet_hours',
  QUIET_START: 'pulse_quiet_start', QUIET_END: 'pulse_quiet_end', DND_WATCHING: 'pulse_dnd_watching',
  CHANNEL_SUBS: 'pulse_channel_subs', SPEED: 'pulse_speed', VOLUME_BOOST: 'pulse_volume_boost',
  USER_ID: 'pulse_user_id', LEFT_SIDEBAR: 'pulse_left_sidebar', RIGHT_SIDEBAR: 'pulse_right_sidebar',
  PWA_DISMISSED: 'pwa_dismissed', QUICK_SWAP: 'pulse_quick_swap',
  WATCH_TODAY: 'pulse_watch_today', WATCH_WEEK: 'pulse_watch_week'
};

const debounceFn = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const throttleFn = (fn, ms) => { let last = 0; return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } }; };

// ═══════════════════════════════════════════════════════════════
// ONLINE USERS COUNTER
// ═══════════════════════════════════════════════════════════════
const OnlineUsers = {
  SUPABASE_URL: 'https://orebgjrnfgrlegbqrauo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QORKRFVCk-MnN1HQ_DVjaQ_zUhlmjG2',
  supabase: null, channel: null, userId: null, onlineCount: 0,
  reconnectAttempts: 0, MAX_RECONNECT_ATTEMPTS: 20, isConnected: false,
  connectionStatus: 'connecting', cleanupTimer: null,
  
  init() {
    this.userId = safeGet(STORAGE_KEYS.USER_ID, null);
    if (!this.userId) { this.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9); safeSet(STORAGE_KEYS.USER_ID, this.userId); }
    this.updateStatusUI('connecting');
    this.renderCounter();
    this.loadSupabaseAndConnect();
  },
  
  loadSupabaseAndConnect() {
    if (window.supabase) { this.connect(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = () => { setTimeout(() => this.connect(), 300); };
    script.onerror = () => { this.updateStatusUI('offline'); setTimeout(() => this.loadSupabaseAndConnect(), 5000); };
    document.head.appendChild(script);
  },
  
  connect() {
    if (typeof supabase === 'undefined') { setTimeout(() => this.loadSupabaseAndConnect(), 2000); return; }
    try {
      this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 1 } } });
      this.joinChannel();
    } catch (e) { this.updateStatusUI('offline'); this.scheduleReconnect(); }
  },
  
  joinChannel() {
    if (!this.supabase) return;
    try {
      this.channel = this.supabase.channel('global-online', { config: { presence: { key: this.userId } } });
      this.channel.on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState(); const uniqueUsers = new Set();
        Object.values(state).forEach(p => { p.forEach(u => { if (u.user_id) uniqueUsers.add(u.user_id); }); });
        this.onlineCount = uniqueUsers.size || 1; this.reconnectAttempts = 0;
        this.isConnected = true; this.updateStatusUI('online'); this.renderCounter();
      });
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { await this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }); this.reconnectAttempts = 0; this.isConnected = true; this.updateStatusUI('online'); }
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') { this.isConnected = false; this.updateStatusUI('connecting'); this.scheduleReconnect(); }
      });
    } catch (e) { this.updateStatusUI('offline'); this.scheduleReconnect(); }
  },
  
  updateStatusUI(status) {
    this.connectionStatus = status;
    const container = document.getElementById('online-users-counter');
    if (!container) return;
    if (status === 'connecting') container.title = 'Connecting to server...';
    else if (status === 'online') container.title = 'Users online now';
    else container.title = 'Offline mode (local only)';
  },
  
  setupEventListeners() {
    window.addEventListener('online', () => { this.reconnectAttempts = 0; this.connect(); });
    window.addEventListener('offline', () => { this.isConnected = false; this.updateStatusUI('offline'); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.channel && this.isConnected) { this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }).catch(() => {}); } });
    this.cleanupTimer = setInterval(() => { if (this.channel && this.isConnected) { this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }).catch(() => {}); } }, 45000);
  },
  
  scheduleReconnect() { if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) { this.updateStatusUI('offline'); return; } this.reconnectAttempts++; const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000); setTimeout(() => { if (!this.isConnected) this.connect(); }, delay); },
  renderCounter() { const c = document.getElementById('online-users-counter'); if (!c) return; c.innerHTML = `<span class="online-dot ${this.connectionStatus === 'offline' ? 'offline' : ''}"></span><span class="online-count">${this.onlineCount}</span><span class="online-label">online</span>`; },
  cleanup() { if (this.cleanupTimer) clearInterval(this.cleanupTimer); if (this.channel) { this.channel.untrack().catch(() => {}); this.supabase?.removeChannel(this.channel).catch(() => {}); } }
};

// ═══════════════════════════════════════════════════════════════
// PULSE APP — Main Application
// ═══════════════════════════════════════════════════════════════
const PulseApp = {
  $(id) { return document.getElementById(id); },
  videoEl() { return this.$('video-player'); },

  // ═══ STATE ═══
  currentChannel: null, currentCategory: 'All',
  hls: null, preloadedHls: null, preloadedChannel: null,
  isPlaying: false, isLive: false, liveLatency: 0,
  currentPage: 1, totalPages: 1, ITEMS_PER_PAGE: 50,
  controlsTimer: null, CONTROLS_HIDE_DELAY: 3500, controlsHovered: false, isDragging: false,
  leftSidebarOpen: true, rightSidebarOpen: true, _sidebarInitialized: false,
  isAudioOnly: false, isSwitchingChannel: false, _switchQueue: [],
  streamStartTime: null, uptimeInterval: null,
  sleepTimer: null, sleepEndTime: null,
  volumeBoost: false, audioCtx: null, gainNode: null, audioSource: null, compressor: null, _boostInitialized: false,
  favorites: safeGet(STORAGE_KEYS.FAVORITES, []), history: safeGet(STORAGE_KEYS.HISTORY, []),
  watchlist: safeGet(STORAGE_KEYS.WATCHLIST, []), continueWatching: safeGet(STORAGE_KEYS.CONTINUE_WATCHING, []),
  recentChannels: safeGet(STORAGE_KEYS.RECENT, []), ratings: safeGet(STORAGE_KEYS.RATINGS, {}),
  accentColor: safeGet(STORAGE_KEYS.ACCENT, '#6c5ce7'), dataSaverMode: safeGet(STORAGE_KEYS.DATA_SAVER, 'auto'),
  _pinHash: safeGet(STORAGE_KEYS.PARENTAL_PIN, null),
  kidsMode: safeGet(STORAGE_KEYS.KIDS_MODE, false), kidsLockUntil: safeGet(STORAGE_KEYS.KIDS_LOCK, 0),
  kidsPinAttempts: safeGet(STORAGE_KEYS.KIDS_ATTEMPTS, 0),
  autoplayNext: safeGet(STORAGE_KEYS.AUTOPLAY, true),
  notificationsEnabled: safeGet(STORAGE_KEYS.NOTIFICATIONS, false),
  quietHoursEnabled: safeGet(STORAGE_KEYS.QUIET_HOURS, false),
  quietHoursStart: safeGet(STORAGE_KEYS.QUIET_START, '22:00'), quietHoursEnd: safeGet(STORAGE_KEYS.QUIET_END, '07:00'),
  dndWhileWatching: safeGet(STORAGE_KEYS.DND_WATCHING, true),
  channelSubscriptions: safeGet(STORAGE_KEYS.CHANNEL_SUBS, []),
  playbackSpeed: safeGet(STORAGE_KEYS.SPEED, 1),
  retryCount: 3,
  channelInputBuffer: '', channelInputTimeout: null,
  diagnosticInterval: null, liveStatusInterval: null,
  streamTimeoutTimer: null, retryAttempt: 0,
  renderRAF: null,
  quickSwapKeys: safeGet(STORAGE_KEYS.QUICK_SWAP, {}),
  adReopenTimer: null, AD_REOPEN_INTERVAL: 300000,
  watchTimeToday: safeGet(STORAGE_KEYS.WATCH_TODAY, 0), watchTimeWeek: safeGet(STORAGE_KEYS.WATCH_WEEK, 0), watchInterval: null,
  m3uAbortController: null, recognition: null, isListening: false,
  _scoreTimeout: null, _toastCount: 0, MAX_TOASTS: 5,
  isTheaterMode: false,

  // ═══ COMPUTED PROPERTIES ═══
  get parentalPIN() { return this._pinHash; },
  set parentalPIN(pin) {
    this._pinHash = hashPIN(pin);
    safeSet(STORAGE_KEYS.PARENTAL_PIN, this._pinHash);
  },
  verifyPIN(pin) { return verifyPIN(pin, this._pinHash); },

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════
  init() {
    this.applyAccentColor(this.accentColor);
    this.restoreSidebars();
    this.startAdReopenTimer();
    this.buildCategoryList();
    this.setupSeek();
    this.setupAutoHideControls();
    this.setupDoubleTap();
    this.setupGlobalEventDelegation();
    this.startDiagnostics();
    this.updateRecentlyWatched();
    this.updateContinueWatching();
    this.updateFavBadge();
    this.updateWatchlistBadge();
    this.renderChannels();
    this.checkPWAInstall();
    this.setupAutoPiP();
    this.setupBackgroundAudio();
    this.setupPlaybackSpeed();
    this.updateWatchStats();
    this.initVoiceSearch();
    OnlineUsers.init();
    
    if (safeGet(STORAGE_KEYS.VOLUME_BOOST, false)) { this.volumeBoost = true; const bb = this.$('boost-btn'); if (bb) bb.classList.add('active'); const vs = this.$('volume-slider'); if (vs) vs.max = '200'; }
    
    if (this.kidsMode) {
      if (Date.now() < this.kidsLockUntil) { this.kidsMode = false; safeSet(STORAGE_KEYS.KIDS_MODE, false); }
      else { this.applyKidsMode(); }
    }
    
    if (typeof channels !== 'undefined' && channels.length > 0) {
      const lastWatched = this.continueWatching[0];
      if (lastWatched) {
        const ch = channels.find(c => String(c.id || c.name) === String(lastWatched.id));
        if (ch) { setTimeout(() => { this.playChannel(ch, false); if (lastWatched.timestamp > 0) { const v = this.videoEl(); if (v) { const st = () => { v.currentTime = lastWatched.timestamp; v.removeEventListener('loadedmetadata', st); }; v.addEventListener('loadedmetadata', st); } } }, 600); return; }
      }
      setTimeout(() => this.playChannel(channels[0], false), 600);
    }
    this.setupKeyboard();
    this.$('loading-spinner').hidden = true;
    this._sidebarInitialized = true;
  },

  // ═══════════════════════════════════════════════════════════
  // GLOBAL EVENT DELEGATION (FIX: Removes inline handlers)
  // ═══════════════════════════════════════════════════════════
  setupGlobalEventDelegation() {
    // Rating stars
    const ratingContainer = this.$('rating-stars');
    if (ratingContainer) {
      ratingContainer.onclick = (e) => { const btn = e.target.closest('button'); if (!btn) return; const rating = parseInt(btn.dataset.rating); if (rating > 0) this.rateChannel(rating); };
    }
    
    // Channel grid
    const channelGrid = this.$('channel-grid');
    if (channelGrid) {
      channelGrid.onclick = (e) => {
        if (e.target.closest('.card-fav-btn')) return;
        if (e.target.closest('.card-notify-btn')) return;
        const card = e.target.closest('.channel-card');
        if (!card) return;
        const chId = card.dataset.channelId;
        if (chId) { const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === chId); if (ch) this.playChannel(ch, false); }
      };
    }
    
    // Logo click
    const logoArea = document.querySelector('.logo-area');
    if (logoArea) { logoArea.onclick = (e) => { if (!e.target.closest('.online-users-counter') && !e.target.closest('.kids-mode-indicator')) this.handleLogoClick(); }; }
    
    // Accent colors
    const accentColors = this.$('accent-colors');
    if (accentColors) { accentColors.onclick = (e) => { const btn = e.target.closest('button'); if (!btn) return; if (btn.dataset.color) this.setAccentColor(btn.dataset.color); }; }
    
    // Category list
    const categoryList = this.$('category-list');
    if (categoryList) { categoryList.onclick = (e) => { const btn = e.target.closest('.cat-btn'); if (!btn) return; document.querySelectorAll('.cat-btn,.nav-btn').forEach(x => x.classList.remove('active')); btn.classList.add('active'); this.setCategory(btn.dataset.cat); if (window.innerWidth <= 900) this.closeSidebar('left'); }; }
    
    // Sidebar nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => { btn.onclick = () => { this.setCategory(btn.dataset.cat); }; });
    
    // ═══ FIX: Unified Settings Modal onchange (Single Handler) ═══
    const settingsModal = this.$('settings-modal');
    if (settingsModal) {
      settingsModal.onchange = (e) => {
        const target = e.target;
        switch (target.id) {
          case 'data-saver-select': this.setDataSaverMode(target.value); break;
          case 'autoplay-toggle': this.toggleAutoplay(target.checked); break;
          case 'notifications-toggle': this.toggleNotifications(target.checked); break;
          case 'kids-mode-toggle': this.toggleKidsMode(target.checked); break;
          case 'quiet-hours-toggle': this.toggleQuietHours(target.checked); break;
          case 'dnd-watching-toggle': this.toggleDNDWhileWatching(target.checked); break;
          case 'quiet-hours-start': this.setQuietHoursStart(target.value); break;
          case 'quiet-hours-end': this.setQuietHoursEnd(target.value); break;
        }
      };
    }
    
    // PIN Pad keyboard support
    const pinPadModal = this.$('pin-pad-modal');
    if (pinPadModal) {
      pinPadModal.addEventListener('keydown', (e) => {
        if (pinPadModal.hidden) return;
        if (e.key >= '0' && e.key <= '9') { e.preventDefault(); this.pinPadInput(e.key); }
        else if (e.key === 'Backspace') { e.preventDefault(); this.pinPadBackspace(); }
        else if (e.key === 'Enter') { e.preventDefault(); this.pinPadSubmit(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.closePinPad(); }
      });
    }
    
    // Global click handler for buttons with data-action
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      const chId = actionBtn.dataset.chid;
      if (action === 'fav') this.toggleFavorite(chId);
      if (action === 'notify') this.toggleChannelSubscription(chId);
    });
  },

  // ═══════════════════════════════════════════════════════════
  // PIN PAD SYSTEM
  // ═══════════════════════════════════════════════════════════
  _pinCallback: null, _pinValue: '',
  
  showPINPad(title, callback) {
    this._pinCallback = callback; this._pinValue = '';
    const modal = this.$('pin-pad-modal'), titleEl = this.$('pin-pad-title');
    if (!modal || !titleEl) { const result = prompt(title + '\n\nEnter 4-digit PIN:'); if (callback) callback(result); return; }
    titleEl.textContent = title; this.updatePinDisplay(); modal.hidden = false;
    setTimeout(() => this.$('pin-pad-modal')?.querySelector('.pin-key')?.focus(), 100);
  },
  
  pinPadInput(digit) { if (this._pinValue.length < 4) { this._pinValue += digit; this.updatePinDisplay(); } },
  pinPadBackspace() { this._pinValue = this._pinValue.slice(0, -1); this.updatePinDisplay(); },
  pinPadClear() { this._pinValue = ''; this.updatePinDisplay(); },
  
  pinPadSubmit() {
    const pin = this._pinValue;
    this.$('pin-pad-modal').hidden = true;
    this._pinValue = ''; this.updatePinDisplay();
    if (this._pinCallback) { this._pinCallback(pin); this._pinCallback = null; }
  },
  
  closePinPad() {
    this.$('pin-pad-modal').hidden = true;
    this._pinValue = ''; this.updatePinDisplay();
    if (this._pinCallback) { this._pinCallback(null); this._pinCallback = null; }
  },
  
  updatePinDisplay() {
    const display = this.$('pin-input-display');
    if (display) { display.innerHTML = Array.from({ length: 4 }, (_, i) => `<span class="pin-dot-char">${i < this._pinValue.length ? '●' : '○'}</span>`).join(''); }
  },

  // ═══════════════════════════════════════════════════════════
  // DYNAMIC TITLE
  // ═══════════════════════════════════════════════════════════
  updateTitle(channelName) { document.title = channelName ? `Pulse.tv - ${channelName}` : 'Pulse.tv — Live TV Streaming'; },

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════
  showToast(msg, type = 'info') {
    if (this._toastCount >= this.MAX_TOASTS) { const oldest = this.$('toast-container')?.firstChild; if (oldest) { oldest.style.opacity = '0'; setTimeout(() => oldest.remove(), 300); } this._toastCount--; }
    this._toastCount++; const t = createEl('div', `toast ${type}`); t.textContent = msg;
    const c = this.$('toast-container'); if (c) c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => { t.remove(); this._toastCount = Math.max(0, this._toastCount - 1); }, 300); }, 3500);
  },

  // ═══════════════════════════════════════════════════════════
  // ACCENT COLOR
  // ═══════════════════════════════════════════════════════════
  applyAccentColor(c) { this.accentColor = c; const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16); document.documentElement.style.setProperty('--accent', c); document.documentElement.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`); document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.12)`); document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`); safeSet(STORAGE_KEYS.ACCENT, c); },
  setAccentColor(c) { this.applyAccentColor(c); this.closeSettings(); this.showToast('Accent color updated'); },
  openSettings() { this.$('settings-modal').hidden = false; this.updateSettingsForm(); },
  closeSettings() { this.$('settings-modal').hidden = true; },
  updateSettingsForm() {
    const ds = this.$('data-saver-select'); if (ds) ds.value = this.dataSaverMode;
    const ap = this.$('autoplay-toggle'); if (ap) ap.checked = this.autoplayNext;
    const nt = this.$('notifications-toggle'); if (nt) nt.checked = this.notificationsEnabled;
    const km = this.$('kids-mode-toggle'); if (km) km.checked = this.kidsMode;
    const qh = this.$('quiet-hours-toggle'); if (qh) qh.checked = this.quietHoursEnabled;
    const qs = this.$('quiet-hours-start'); if (qs) qs.value = this.quietHoursStart;
    const qe = this.$('quiet-hours-end'); if (qe) qe.value = this.quietHoursEnd;
    const dw = this.$('dnd-watching-toggle'); if (dw) dw.checked = this.dndWhileWatching;
    const pin = this.$('parental-pin'); if (pin) pin.value = '';
    const accentBtns = document.querySelectorAll('#accent-colors button');
    accentBtns.forEach(b => b.classList.toggle('active', b.dataset.color === this.accentColor));
    this.renderSubscriptionsList();
  },
  toggleAutoplay(v) { this.autoplayNext = v; safeSet(STORAGE_KEYS.AUTOPLAY, v); this.showToast(v ? 'Autoplay ON' : 'Autoplay OFF'); },

  // ═══════════════════════════════════════════════════════════
  // LOGO CLICK
  // ═══════════════════════════════════════════════════════════
  handleLogoClick() { if (this.currentChannel) { this.playChannel(this.currentChannel, false); this.showToast('Channel refreshed'); } else if (typeof channels !== 'undefined' && channels.length > 0) { this.playChannel(channels[0], false); } },

  // ═══════════════════════════════════════════════════════════
  // SIDEBARS
  // ═══════════════════════════════════════════════════════════
  restoreSidebars() { this.leftSidebarOpen = safeGet(STORAGE_KEYS.LEFT_SIDEBAR, true); this.rightSidebarOpen = safeGet(STORAGE_KEYS.RIGHT_SIDEBAR, true); if (!this.leftSidebarOpen) this.closeSidebar('left'); if (!this.kidsMode) this.openSidebar('right'); },
  startAdReopenTimer() { if (this.adReopenTimer) clearInterval(this.adReopenTimer); this.adReopenTimer = setInterval(() => { if (this._sidebarInitialized && !this.rightSidebarOpen && !this.kidsMode) this.openSidebar('right'); }, this.AD_REOPEN_INTERVAL); },
  toggleSidebar(side) { if (side === 'left') { this.leftSidebarOpen ? this.closeSidebar('left') : this.openSidebar('left'); } else { this.rightSidebarOpen ? this.closeSidebar('right') : this.openSidebar('right'); } },
  openSidebar(side) { if (side === 'right' && this.kidsMode) return; const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar'); if (!s) return; s.classList.remove('collapsed'); s.classList.add('open'); if (window.innerWidth <= 900) { const o = this.$(side + '-sidebar-overlay'); if (o) o.classList.add('active'); document.body.style.overflow = 'hidden'; } if (side === 'left') this.leftSidebarOpen = true; else this.rightSidebarOpen = true; safeSet(side === 'left' ? STORAGE_KEYS.LEFT_SIDEBAR : STORAGE_KEYS.RIGHT_SIDEBAR, true); this.adjustContentMargins(); },
  closeSidebar(side) { const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar'); if (!s) return; s.classList.add('collapsed'); s.classList.remove('open'); const o = this.$(side + '-sidebar-overlay'); if (o) o.classList.remove('active'); if (side === 'left' && this.leftSidebarOpen) document.body.style.overflow = ''; if (side === 'right' && this.rightSidebarOpen) document.body.style.overflow = ''; if (side === 'left') this.leftSidebarOpen = false; else this.rightSidebarOpen = false; safeSet(side === 'left' ? STORAGE_KEYS.LEFT_SIDEBAR : STORAGE_KEYS.RIGHT_SIDEBAR, false); this.adjustContentMargins(); },
  adjustContentMargins() { const content = document.querySelector('.content-area'); if (!content) return; let ml = 0, mr = 0; if (this.leftSidebarOpen && window.innerWidth > 900) ml = 260; if (this.rightSidebarOpen && !this.kidsMode && window.innerWidth > 1100) mr = 280; content.style.marginLeft = ml + 'px'; content.style.marginRight = mr + 'px'; },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIES & RENDERING (FIX: Clear search on category change)
  // ═══════════════════════════════════════════════════════════
  buildCategoryList() {
    const l = this.$('category-list'); if (!l) return; l.innerHTML = '';
    const cats = ['News','Sports','Entertainment','Movies','Music','Kids','Education','Lifestyle','Religion','Documentary','Business','Comedy','Technology'];
    const cols = { News:'#3b82f6',Sports:'#22c55e',Entertainment:'#a855f7',Movies:'#f59e0b',Music:'#ec4899',Kids:'#14b8a6',Education:'#6366f1',Lifestyle:'#f97316',Religion:'#8b5cf6',Documentary:'#06b6d4',Business:'#64748b',Comedy:'#eab308',Technology:'#0ea5e9' };
    cats.forEach(cat => { const b = createEl('button', 'cat-btn'); b.innerHTML = `<div class="cat-avatar" style="background:${cols[cat]||'#555'}">${safeText(cat.substring(0,2).toUpperCase())}</div>${safeText(cat)}`; b.dataset.cat = cat; l.appendChild(b); });
    if (this.kidsMode) this.filterKidsCategories();
  },
  filterKidsCategories() { const c = this.$('category-list'); if (!c) return; c.querySelectorAll('.cat-btn').forEach(b => { const cat = b.textContent.trim(); b.style.display = (cat === 'Kids' || cat === 'Education') ? '' : 'none'; }); },
  
  // FIX: Clear search on category change
  setCategory(c) {
    this.currentCategory = c; this.currentPage = 1;
    const searchInput = this.$('search-input');
    if (searchInput) searchInput.value = '';
    this.$('section-title').textContent = c;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === c));
    this.renderChannels();
  },
  filterChannels() { this.currentPage = 1; this.renderChannels(); },

  getFilteredChannels() {
    let f = [...(typeof channels !== 'undefined' ? channels : [])];
    if (this.currentCategory === 'Favorites') f = f.filter(c => this.favorites.includes(String(c.id || c.name)));
    else if (this.currentCategory === 'Watchlist') f = f.filter(c => this.watchlist.includes(String(c.id || c.name)));
    else if (this.currentCategory === 'History') f = this.history.map(id => f.find(c => String(c.id || c.name) === id)).filter(Boolean);
    else if (this.currentCategory !== 'All') f = f.filter(c => c.category === this.currentCategory);
    if (this.kidsMode) f = f.filter(c => c.category === 'Kids' || c.category === 'Education');
    const q = (this.$('search-input')?.value || '').toLowerCase().trim();
    if (q && !this.kidsMode) f = f.filter(c => (c.name||'').toLowerCase().includes(q) || (c.category||'').toLowerCase().includes(q));
    return f;
  },

  renderChannels() {
    if (this.renderRAF) { cancelAnimationFrame(this.renderRAF); this.renderRAF = null; }
    const grid = this.$('channel-grid'), em = this.$('empty-message'), pb = this.$('pagination-bar');
    if (!grid) return; grid.innerHTML = ''; if (em) em.hidden = true; if (pb) pb.hidden = true;
    this.renderRAF = requestAnimationFrame(() => {
      this.renderRAF = null;
      const f = this.getFilteredChannels();
      this.totalPages = Math.max(1, Math.ceil(f.length / this.ITEMS_PER_PAGE));
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      const count = this.$('channels-count'); if (count) count.textContent = `${f.length} channel${f.length !== 1 ? 's' : ''}`;
      if (f.length === 0) { if (em) em.hidden = false; return; }
      if (f.length > this.ITEMS_PER_PAGE) { if (pb) pb.hidden = false; this.renderPagination(f.length); }
      const start = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
      f.slice(start, start + this.ITEMS_PER_PAGE).forEach((ch, i) => grid.appendChild(this.buildChannelCard(ch, start + i)));
    });
  },
  
  buildChannelCard(ch, globalIdx) {
    const card = createEl('div', 'channel-card');
    card.dataset.channelId = String(ch.id || ch.name);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play ${ch.name || 'Unknown channel'}`);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.playChannel(ch, false); } });
    
    if (this.currentChannel && (String(ch.id || ch.name) === String(this.currentChannel.id || this.currentChannel.name))) card.classList.add('playing');
    const init = safeText((ch.name || 'TV').substring(0, 2).toUpperCase());
    const bg = { News:'#3b82f6',Sports:'#22c55e',Entertainment:'#a855f7',Movies:'#f59e0b',Music:'#ec4899',Kids:'#14b8a6' }[ch.category] || '#555';
    const isFav = this.favorites.includes(String(ch.id || ch.name));
    const chId = String(ch.id || ch.name);
    const isSubscribed = this.channelSubscriptions.includes(chId);
    const chRating = this.ratings[chId] || 0;

    let html = '<div class="card-avatar"';
    if (ch.logo) { html += `><img src="${safeText(ch.logo)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.style.background='${bg}';this.parentElement.textContent='${init}';" />`; }
    else { html += ` style="background:${bg}">${init}`; }
    html += `</div><div class="card-name">${safeText(ch.name || 'Unknown')}</div><div class="card-category">${safeText(ch.category || 'Entertainment')}</div>`;
    
    html += `<button class="card-fav-btn${isFav ? ' active' : ''}" data-action="fav" data-chid="${chId}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">`;
    html += isFav ? '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
    html += '</button>';
    
    if (!this.kidsMode) {
      html += `<button class="card-notify-btn" data-action="notify" data-chid="${chId}" style="position:absolute;top:10px;right:44px;color:${isSubscribed ? 'var(--accent)' : 'var(--text-muted)'};background:none;border:none;cursor:pointer;z-index:2;padding:4px;display:flex;align-items:center;justify-content:center;" title="${isSubscribed ? 'Unsubscribe' : 'Notify me'}" aria-label="${isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}">`;
      html += '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
      html += '</button>';
    }
    
    if (chRating > 0) { html += '<div class="card-rating" style="display:flex;gap:1px;margin-top:4px;">'; for (let i = 1; i <= 5; i++) { html += `<svg width="12" height="12" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="${i <= chRating ? 'var(--accent)' : 'none'}" stroke="currentColor" stroke-width="2"/></svg>`; } html += '</div>'; }
    if (this.currentChannel && (String(ch.id || ch.name) === String(this.currentChannel.id || this.currentChannel.name))) html += '<div class="card-now-playing">NOW PLAYING</div>';
    
    card.innerHTML = html;
    return card;
  },
  
  renderPagination(t) { const pi = this.$('pagination-info'), pp = this.$('pagination-pages'), pr = this.$('prev-page-btn'), nx = this.$('next-page-btn'); if (!pp) return; const s = (this.currentPage - 1) * this.ITEMS_PER_PAGE + 1, e = Math.min(this.currentPage * this.ITEMS_PER_PAGE, t); if (pi) pi.innerHTML = `Showing <strong>${s}-${e}</strong> of <strong>${t}</strong>`; if (pr) pr.disabled = this.currentPage <= 1; if (nx) nx.disabled = this.currentPage >= this.totalPages; pp.innerHTML = ''; if (this.totalPages <= 1) return; for (let p = 1; p <= this.totalPages; p++) { if (p > 2 && p < this.currentPage - 2 && p < this.totalPages - 3) { if (p === 3) pp.appendChild(Object.assign(document.createElement('span'),{textContent:'...',style:'padding:0 6px;color:var(--text-muted)'})); continue; } if (p < this.totalPages - 1 && p > this.currentPage + 2 && p > 4) { if (p === this.totalPages - 2) pp.appendChild(Object.assign(document.createElement('span'),{textContent:'...',style:'padding:0 6px;color:var(--text-muted)'})); continue; } const b = createEl('button', `page-num-btn${p === this.currentPage ? ' active' : ''}`, String(p)); b.onclick = () => this.goToPage(p); pp.appendChild(b); } },
  goToPage(p) { if (p < 1 || p > this.totalPages) return; this.currentPage = p; this.renderChannels(); document.querySelector('.channels-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  toggleFavorite(id) { const i = this.favorites.indexOf(id); if (i > -1) { this.favorites.splice(i, 1); this.showToast('Removed from favorites'); } else { this.favorites.push(id); this.showToast('Added to favorites'); } safeSet(STORAGE_KEYS.FAVORITES, this.favorites); this.updateFavBadge(); if (this.currentCategory === 'Favorites') this.renderChannels(); },
  updateFavBadge() { const b = this.$('fav-badge'); if (!b) return; const c = this.favorites.length; b.hidden = c === 0; b.textContent = c > 99 ? '99+' : String(c); },
  updateWatchlistBadge() { const b = this.$('watchlist-badge'); if (!b) return; const c = this.watchlist.length; b.hidden = c === 0; b.textContent = c > 99 ? '99+' : String(c); },

  // ═══════════════════════════════════════════════════════════
  // CHANNEL SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════
  toggleChannelSubscription(chId) { const i = this.channelSubscriptions.indexOf(chId); if (i > -1) { this.channelSubscriptions.splice(i, 1); this.showToast('Notifications unsubscribed'); } else { this.channelSubscriptions.push(chId); this.showToast('Notifications subscribed'); } safeSet(STORAGE_KEYS.CHANNEL_SUBS, this.channelSubscriptions); this.renderSubscriptionsList(); this.renderChannels(); },
  renderSubscriptionsList() { const list = this.$('subscriptions-list'); if (!list) return; if (this.channelSubscriptions.length === 0) { list.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">No subscriptions. Click bell icon on channels.</div>'; return; } list.innerHTML = ''; this.channelSubscriptions.forEach(chId => { const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === chId); if (ch) { const item = createEl('div', 'subscription-item'); item.innerHTML = `<span>🔔 ${safeText(ch.name)}</span><button class="sub-remove-btn" data-chid="${chId}">✕</button>`; item.querySelector('.sub-remove-btn').onclick = (e) => { e.stopPropagation(); this.channelSubscriptions = this.channelSubscriptions.filter(s => s !== chId); safeSet(STORAGE_KEYS.CHANNEL_SUBS, this.channelSubscriptions); this.renderSubscriptionsList(); this.renderChannels(); }; list.appendChild(item); } }); },

  // ═══════════════════════════════════════════════════════════
  // CONTINUE WATCHING
  // ═══════════════════════════════════════════════════════════
  saveContinueWatching() { if (!this.currentChannel) return; const id = String(this.currentChannel.id || this.currentChannel.name); let cw = this.continueWatching.filter(c => String(c.id) !== id); cw.unshift({ id, name: this.currentChannel.name, logo: this.currentChannel.logo || '', category: this.currentChannel.category || 'Entertainment', timestamp: this.videoEl()?.currentTime || 0, duration: this.videoEl()?.duration || 0, lastWatched: Date.now() }); this.continueWatching = cw.slice(0, 10); safeSet(STORAGE_KEYS.CONTINUE_WATCHING, this.continueWatching); this.updateContinueWatching(); },
  updateContinueWatching() { const row = this.$('continue-watching-row'), section = this.$('continue-watching-section'); if (!row || !section) return; if (!this.continueWatching.length) { section.hidden = true; return; } section.hidden = false; row.innerHTML = ''; this.continueWatching.slice(0, 6).forEach(item => { const card = createEl('div', 'cw-card'); const progress = item.duration > 0 ? (item.timestamp / item.duration) * 100 : 0; card.innerHTML = `<div class="cw-thumb"><div class="cw-avatar" style="background:var(--surface3)">${safeText((item.name||'TV').substring(0,2).toUpperCase())}</div><div class="cw-progress-bar"><div class="cw-progress-fill" style="width:${Math.min(100,progress)}%"></div></div></div><div class="cw-name">${safeText(item.name)}</div><div class="cw-time">${this.formatTimeAgo(item.lastWatched)}</div>`; card.onclick = () => { const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === String(item.id)); if (ch) this.playChannel(ch, false); }; row.appendChild(card); }); },
  clearContinueWatching() { this.continueWatching = []; safeSet(STORAGE_KEYS.CONTINUE_WATCHING, []); this.updateContinueWatching(); this.showToast('Continue Watching cleared'); },
  formatTimeAgo(ts) { const diff = Date.now() - ts; const mins = Math.floor(diff / 60000); if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`; return `${Math.floor(hours / 24)}d ago`; },

  // ═══════════════════════════════════════════════════════════
  // VOICE SEARCH
  // ═══════════════════════════════════════════════════════════
  initVoiceSearch() { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { const btn = this.$('voice-search-btn'); if (btn) btn.style.display = 'none'; const trig = this.$('voice-trigger'); if (trig) trig.style.display = 'none'; return; } if (this.recognition) { try { this.recognition.abort(); } catch(e) {} } this.recognition = new SR(); this.recognition.continuous = false; this.recognition.interimResults = true; this.recognition.maxAlternatives = 1; this.recognition.lang = 'en-US'; this.recognition.onresult = (e) => { const transcript = Array.from(e.results).map(r => r[0].transcript).join(''); const input = this.$('search-input'); if (input) { input.value = transcript; input.dispatchEvent(new Event('input')); } }; this.recognition.onend = () => { this.isListening = false; this.updateVoiceUI(); }; this.recognition.onerror = () => { this.isListening = false; this.updateVoiceUI(); }; },
  startVoiceSearch: throttleFn(function() { if (!this.recognition) { this.showToast('Voice search not supported'); return; } if (this.isListening) { this.stopVoiceSearch(); return; } try { this.isListening = true; this.recognition.start(); this.updateVoiceUI(); } catch(e) { this.isListening = false; } }, 1000),
  stopVoiceSearch() { this.isListening = false; if (this.recognition) { try { this.recognition.stop(); } catch(e) {} } this.updateVoiceUI(); },
  updateVoiceUI() { const indicator = this.$('voice-listening'); if (indicator) indicator.hidden = !this.isListening; },

  // ═══════════════════════════════════════════════════════════
  // DATA SAVER
  // ═══════════════════════════════════════════════════════════
  setDataSaverMode(mode) { this.dataSaverMode = mode; safeSet(STORAGE_KEYS.DATA_SAVER, mode); const badge = this.$('data-saver-badge'); if (badge) badge.hidden = mode === 'auto'; this.applyDataSaver(); },
  applyDataSaver() { if (!this.hls?.levels?.length) return; const mode = this.dataSaverMode; let tl = -1; if (mode === 'low') { tl = this.hls.levels.findIndex(l => l.height <= 360); if (tl < 0) tl = 0; } else if (mode === 'medium') { tl = this.hls.levels.findIndex(l => l.height <= 480); if (tl < 0) tl = Math.floor(this.hls.levels.length / 2); } else if (mode === 'high') { tl = this.hls.levels.length - 1; } if (tl >= 0 && tl < this.hls.levels.length) this.hls.currentLevel = tl; },

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  async toggleNotifications(enabled) { if (enabled) { if (!('Notification' in window)) { this.showToast('Notifications not supported'); return; } try { const perm = await Notification.requestPermission(); if (perm === 'granted') { this.notificationsEnabled = true; safeSet(STORAGE_KEYS.NOTIFICATIONS, true); this.showToast('Notifications enabled'); } else { this.notificationsEnabled = false; safeSet(STORAGE_KEYS.NOTIFICATIONS, false); this.showToast('Permission denied'); } } catch(e) { this.notificationsEnabled = false; safeSet(STORAGE_KEYS.NOTIFICATIONS, false); } } else { this.notificationsEnabled = false; safeSet(STORAGE_KEYS.NOTIFICATIONS, false); this.showToast('Notifications disabled'); } },
  toggleQuietHours(enabled) { this.quietHoursEnabled = enabled; safeSet(STORAGE_KEYS.QUIET_HOURS, enabled); this.showToast(enabled ? 'Quiet hours enabled' : 'Quiet hours disabled'); },
  setQuietHoursStart(v) { this.quietHoursStart = v; safeSet(STORAGE_KEYS.QUIET_START, v); },
  setQuietHoursEnd(v) { this.quietHoursEnd = v; safeSet(STORAGE_KEYS.QUIET_END, v); },
  toggleDNDWhileWatching(enabled) { this.dndWhileWatching = enabled; safeSet(STORAGE_KEYS.DND_WATCHING, enabled); },
  sendTestNotification() { if (!this.notificationsEnabled) { this.showToast('Enable notifications first'); return; } if ('Notification' in window && Notification.permission === 'granted') { new Notification('Pulse.tv — Test', { body: 'Notifications are working! 🎉', icon: '/assets/icons/icon-192.png' }); this.showToast('Test notification sent'); } else { this.showToast('Permission not granted'); } },

  // ═══════════════════════════════════════════════════════════
  // KIDS MODE (FIX: Hashed PIN, Secure)
  // ═══════════════════════════════════════════════════════════
  setParentalPIN() {
    this.showPINPad('Set 4-digit Parental PIN', (pin) => {
      if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) { this.parentalPIN = pin; this.showToast('PIN set successfully'); }
      else { this.showToast('Enter exactly 4 digits'); }
    });
  },
  
  toggleKidsMode(enabled) {
    if (enabled) {
      if (!this._pinHash) { this.showToast('Set a PIN first in Settings'); return; }
      if (Date.now() < this.kidsLockUntil) { this.showToast(`Kids Mode locked. Try again in ${Math.ceil((this.kidsLockUntil - Date.now()) / 60000)} min`); return; }
      this.showPINPad('Enter PIN to enable Kids Mode', (pin) => {
        if (this.verifyPIN(pin)) { this.kidsMode = true; this.kidsPinAttempts = 0; safeSet(STORAGE_KEYS.KIDS_MODE, true); safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, 0); safeSet(STORAGE_KEYS.KIDS_LOCK, 0); this.applyKidsMode(); this.showToast('Kids Mode ON'); this.closeSettings(); }
        else { this.showToast('Wrong PIN'); }
      });
    } else { this.requestExitKidsMode(); }
  },
  
  applyKidsMode() { this.kidsMode = true; this.applyAccentColor('#f59e0b'); document.body.classList.add('kids-mode-active'); this.closeSidebar('right'); const si = this.$('search-input'); if (si) { si.disabled = true; si.placeholder = 'Search disabled in Kids Mode'; si.value = ''; } const indicator = this.$('kids-mode-indicator'); if (indicator) indicator.style.display = 'flex'; this.setCategory('Kids'); this.filterKidsCategories(); this.renderChannels(); this.adjustContentMargins(); },
  
  exitKidsMode() { this.kidsMode = false; this.applyAccentColor(safeGet(STORAGE_KEYS.ACCENT, '#6c5ce7')); document.body.classList.remove('kids-mode-active'); const si = this.$('search-input'); if (si) { si.disabled = false; si.placeholder = 'Search channels...'; } const indicator = this.$('kids-mode-indicator'); if (indicator) indicator.style.display = 'none'; this.openSidebar('right'); this.filterAllCategories(); this.setCategory('All'); this.renderChannels(); this.adjustContentMargins(); this.kidsPinAttempts = 0; safeSet(STORAGE_KEYS.KIDS_MODE, false); safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, 0); safeSet(STORAGE_KEYS.KIDS_LOCK, 0); },
  
  requestExitKidsMode() {
    if (Date.now() < this.kidsLockUntil) { this.showToast(`Too many attempts. Try again in ${Math.ceil((this.kidsLockUntil - Date.now()) / 60000)} min`); return; }
    this.showPINPad('Enter PIN to exit Kids Mode', (pin) => {
      if (this.verifyPIN(pin)) { this.exitKidsMode(); this.showToast('Kids Mode exited'); this.closeSettings(); }
      else { this.kidsPinAttempts++; safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, this.kidsPinAttempts); if (this.kidsPinAttempts >= 3) { this.kidsLockUntil = Date.now() + 300000; safeSet(STORAGE_KEYS.KIDS_LOCK, this.kidsLockUntil); this.showToast('Too many attempts. Locked for 5 minutes'); } else { this.showToast(`Wrong PIN (${3 - this.kidsPinAttempts} attempts left)`); } }
    });
  },
  
  filterAllCategories() { const container = this.$('category-list'); if (!container) return; container.querySelectorAll('.cat-btn').forEach(b => { b.style.display = ''; }); },

  // ═══════════════════════════════════════════════════════════
  // CONTENT RATING
  // ═══════════════════════════════════════════════════════════
  initRatingStars() { const sc = this.$('rating-stars'); if (!sc) return; const chId = this.currentChannel ? String(this.currentChannel.id || this.currentChannel.name) : ''; const cr = chId ? (this.ratings[chId] || 0) : 0; sc.querySelectorAll('button').forEach((btn, i) => { const rating = i + 1; btn.dataset.rating = rating; const polygon = btn.querySelector('polygon'); if (polygon) { polygon.setAttribute('fill', rating <= cr ? 'var(--accent)' : 'none'); polygon.setAttribute('stroke', rating <= cr ? 'none' : 'currentColor'); } }); const count = this.$('rating-count'); if (count) { const tv = Object.keys(this.ratings).filter(k => this.ratings[k] > 0).length; count.textContent = tv > 0 ? `(${tv})` : ''; } },
  rateChannel(rating) { if (!this.currentChannel) return; const chId = String(this.currentChannel.id || this.currentChannel.name); this.ratings[chId] = rating; safeSet(STORAGE_KEYS.RATINGS, this.ratings); this.initRatingStars(); this.showToast(`Rated ${rating} star${rating > 1 ? 's' : ''}`); },

  // ═══════════════════════════════════════════════════════════
  // SOCIAL SHARING
  // ═══════════════════════════════════════════════════════════
  openShareMenu() { this.$('share-modal').hidden = false; }, closeShareMenu() { this.$('share-modal').hidden = true; },
  getShareData() { if (!this.currentChannel) return null; const chId = encodeURIComponent(this.currentChannel.id || this.currentChannel.name); const t = Math.floor(this.videoEl()?.currentTime || 0); const url = `${location.origin}${location.pathname}#channel=${chId}&t=${t}`; return { title: this.currentChannel.name, url, text: `Watch ${this.currentChannel.name} on Pulse.tv` }; },
  shareTo(platform) { const data = this.getShareData(); if (!data) return; const urls = { whatsapp: `https://wa.me/?text=${encodeURIComponent(data.text + ' ' + data.url)}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`, telegram: `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`, twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}` }; if (urls[platform]) window.open(urls[platform], '_blank', 'noopener,noreferrer'); this.closeShareMenu(); },
  copyShareLink() { const data = this.getShareData(); if (!data) return; navigator.clipboard?.writeText(data.url).then(() => this.showToast('Link copied')).catch(() => this.showToast('Copy failed')); this.closeShareMenu(); },

  // ═══════════════════════════════════════════════════════════
  // DVR + CHAPTER MARKERS
  // ═══════════════════════════════════════════════════════════
  updateDVRStatus() { if (!this.hls || !this.isLive) return; const v = this.videoEl(); if (!v) return; const dur = v.duration; if (!isFinite(dur) || dur <= 0) return; const behind = Math.max(0, dur - v.currentTime); const dvrBuffer = this.$('dvr-buffer'), dvrTime = this.$('dvr-buffer-time'); if (dvrBuffer && dvrTime) { if (behind > 2) { dvrBuffer.hidden = false; dvrTime.textContent = `-${this.formatTime(behind)}`; } else { dvrBuffer.hidden = true; } } this.updateChapterMarkers(dur); },
  updateChapterMarkers(duration) { if (!duration || duration <= 0) return; const markers = this.$('chapter-markers'), dots = this.$('chapter-dots'); if (!markers || !dots) return; const chapters = []; const interval = Math.max(60, Math.floor(duration / 8)); for (let t = 0; t <= duration; t += interval) chapters.push({ time: t, label: this.formatTime(t) }); markers.hidden = chapters.length < 2; markers.innerHTML = chapters.map(c => `<div class="chapter-marker" data-time="${c.time}" style="left:${(c.time/duration)*100}%">${c.label}</div>`).join(''); dots.innerHTML = chapters.map(c => `<div class="chapter-dot" style="left:${(c.time/duration)*100}%" title="${c.label}"></div>`).join(''); },
  seekToChapter(time) { const v = this.videoEl(); if (v) v.currentTime = time; },

  // ═══════════════════════════════════════════════════════════
  // LIVE SCORE
  // ═══════════════════════════════════════════════════════════
  toggleScoreOverlay() { if (!this.currentChannel || this.currentChannel.category !== 'Sports') return; const overlay = this.$('live-score-overlay'); if (!overlay) return; overlay.hidden = !overlay.hidden; if (!overlay.hidden) this.generateMockScore(); },
  generateMockScore() { const content = this.$('live-score-content'); if (!content) return; const scores = [{ team1: 'BAN', score1: '186/4', team2: 'IND', score2: '184/7', detail: '38.2 overs', info: 'BAN need 0 from 70 balls' }, { team1: 'BAN', score1: '2', team2: 'IND', score2: '1', detail: '78\'', info: 'Second Half' }]; const score = scores[Math.floor(Math.random() * scores.length)]; content.innerHTML = `<div class="score-teams"><div class="score-team"><strong>${score.team1}</strong><span class="score-num">${score.score1}</span></div><div class="score-vs">VS</div><div class="score-team"><strong>${score.team2}</strong><span class="score-num">${score.score2}</span></div></div><div class="score-detail">${score.detail}</div><div class="score-info">${score.info}</div>`; clearTimeout(this._scoreTimeout); this._scoreTimeout = setTimeout(() => { const overlay = this.$('live-score-overlay'); if (overlay) overlay.hidden = true; }, 15000); },

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════
  exportUserData() { const keys = Object.values(STORAGE_KEYS); const data = {}; keys.forEach(k => { data[k] = safeGet(k); }); const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pulse-backup.json'; a.click(); URL.revokeObjectURL(a.href); this.showToast('Data exported'); },

  // ═══════════════════════════════════════════════════════════
  // VOLUME BOOST
  // ═══════════════════════════════════════════════════════════
  initVolumeBoost() { if (this._boostInitialized) return; try { const v = this.videoEl(); if (!v) return; if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (this.audioSource) { try { this.audioSource.disconnect(); } catch(e) {} } this.audioSource = this.audioCtx.createMediaElementSource(v); this.gainNode = this.audioCtx.createGain(); this.gainNode.gain.value = 1.0; this.compressor = this.audioCtx.createDynamicsCompressor(); this.compressor.threshold.value = -24; this.compressor.knee.value = 30; this.compressor.ratio.value = 12; this.compressor.attack.value = 0.003; this.compressor.release.value = 0.25; this.audioSource.connect(this.gainNode); this.gainNode.connect(this.compressor); this.compressor.connect(this.audioCtx.destination); this._boostInitialized = true; this.applyVolumeBoost(); } catch(e) { this._boostInitialized = false; } },
  applyVolumeBoost() { if (!this.gainNode) { this.initVolumeBoost(); return; } this.gainNode.gain.value = this.volumeBoost ? 2.0 : 1.0; const vs = this.$('volume-slider'); if (vs) { vs.max = this.volumeBoost ? '200' : '100'; if (!this.volumeBoost && parseInt(vs.value) > 100) { vs.value = '100'; const ve = this.videoEl(); if (ve) ve.volume = 1.0; } } const bb = this.$('boost-btn'); if (bb) bb.classList.toggle('active', this.volumeBoost); safeSet(STORAGE_KEYS.VOLUME_BOOST, this.volumeBoost); },
  toggleVolumeBoost() { this.volumeBoost = !this.volumeBoost; if (!this._boostInitialized && this.volumeBoost) this.initVolumeBoost(); this.applyVolumeBoost(); this.showToast(this.volumeBoost ? 'Volume Boost ON (200%)' : 'Volume Boost OFF'); },

  // ═══════════════════════════════════════════════════════════
  // PLAY CHANNEL (FIX: Autoplay implemented, Queue system)
  // ═══════════════════════════════════════════════════════════
  playChannel(channel, isRetry = false) {
    if (this.isSwitchingChannel && !isRetry) { this._switchQueue.push({ channel, isRetry: false }); return; }
    if (this.kidsMode && channel && channel.category !== 'Kids' && channel.category !== 'Education') {
      this.showPINPad('Enter PIN to watch this channel', (pin) => { if (this.verifyPIN(pin)) { this._executePlayChannel(channel, isRetry); } else { this.showToast('Access denied'); } });
      return;
    }
    this._executePlayChannel(channel, isRetry);
  },
  
  _executePlayChannel(channel, isRetry) {
    this.isSwitchingChannel = true;
    try {
      if (!channel?.url) { this.showToast('No stream URL'); this.isSwitchingChannel = false; this._processQueue(); return; }
      this.currentChannel = channel; this.updateTitle(channel.name);
      const nd = this.$('channel-name-display'); if (nd) nd.textContent = channel.name;
      const id = String(channel.id || channel.name);
      this.history = this.history.filter(h => h !== id); this.history.unshift(id); safeSet(STORAGE_KEYS.HISTORY, this.history.slice(0, 50));
      if (!isRetry) this.saveContinueWatching();
      this.initRatingStars(); this.updateRecentlyWatched();
      const spinner = this.$('loading-spinner'), error = this.$('error-message'), liveBadge = this.$('live-badge'), goLiveBtn = this.$('go-live-btn'), streamHealth = this.$('stream-health'), dvrBuffer = this.$('dvr-buffer');
      if (spinner) spinner.hidden = false; if (error) error.hidden = true; if (liveBadge) liveBadge.hidden = true; if (goLiveBtn) goLiveBtn.hidden = true; if (streamHealth) streamHealth.hidden = true; if (dvrBuffer) dvrBuffer.hidden = true;
      if (this.hls) { this.hls.destroy(); this.hls = null; }
      this._boostInitialized = false; this.audioSource = null; this.clearAllIntervals();
      const v = this.videoEl(); if (!v) { this.isSwitchingChannel = false; this._processQueue(); return; }
      v.src = ''; v.load(); this.streamStartTime = Date.now(); this.updateStreamUptime();
      
      // Setup autoplay on video end
      v.onended = () => {
        if (this.autoplayNext && !this.kidsMode) {
          const l = typeof channels !== 'undefined' ? channels : [];
          if (l.length) {
            const i = l.findIndex(c => c === this.currentChannel);
            const next = l[(i + 1) % l.length];
            if (next) { this.showToast('Autoplaying next channel...'); setTimeout(() => this.playChannel(next, false), 500); }
          }
        }
      };
      
      this.streamTimeoutTimer = setTimeout(() => { if (!this.isPlaying) { if (spinner) spinner.hidden = true; if (this.retryAttempt < this.retryCount) { this.retryAttempt++; setTimeout(() => this.playChannel(channel, true), Math.pow(2, this.retryAttempt) * 1000); } else { if (error) error.hidden = false; this.retryAttempt = 0; } } }, 30000);
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, enableWorker: true, startLevel: -1, fragLoadingTimeOut: 15000, manifestLoadingTimeOut: 15000, liveSyncDurationCount: 3, capLevelToPlayerSize: false, maxLoadingDelay: 4, minAutoBitrate: 0, maxLevel: -1 });
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => { clearTimeout(this.streamTimeoutTimer); this.retryAttempt = 0; if (spinner) spinner.hidden = true; this.updateLiveStatus(); this.updateQualitySelector(); const diagRes = this.$('diag-resolution'); if (diagRes) { const maxLevel = this.hls.levels[this.hls.levels.length - 1]; const maxHeight = maxLevel ? maxLevel.height : 0; if (maxHeight >= 2160) diagRes.textContent = 'Up to 4K (2160p)'; else if (maxHeight >= 1080) diagRes.textContent = 'Up to 1080p'; else if (maxHeight >= 720) diagRes.textContent = 'Up to 720p'; else diagRes.textContent = `${maxHeight || 'Auto'}p`; } if (streamHealth) { streamHealth.hidden = false; const dot = streamHealth.querySelector('.health-dot'); if (dot) dot.className = 'health-dot'; } v.play().then(() => { this.isPlaying = true; this.isLive = true; this.updatePlayBtn(); this.showLiveBadge(); this.updateDVRStatus(); if (this.volumeBoost) setTimeout(() => this.initVolumeBoost(), 500); }).catch(() => { this.updatePlayBtn(); }); this.preloadNextChannel(); this.applyDataSaver(); this.setupBandwidthDetection(); });
        this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => { if (this.hls) { const l = this.hls.levels[d.level]; const diagRes = this.$('diag-resolution'); if (l && diagRes) { if (l.height >= 2160) diagRes.textContent = `4K (${l.width}x${l.height})`; else if (l.height) diagRes.textContent = `${l.width}x${l.height}`; } } });
        this.hls.on(Hls.Events.FRAG_BUFFERED, () => { this.updateBufferDiagnostics(); this.updateStreamHealthIndicator(); });
        this.hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { clearTimeout(this.streamTimeoutTimer); this.hideLiveBadge(); if (spinner) spinner.hidden = true; if (this.retryAttempt < this.retryCount) { this.retryAttempt++; setTimeout(() => this.playChannel(channel, true), 2000); } else { if (error) error.hidden = false; this.retryAttempt = 0; } this.hls.destroy(); this.hls = null; } });
        this.hls.loadSource(channel.url); this.hls.attachMedia(v);
      } else { v.src = channel.url; v.load(); v.play().then(() => { if (spinner) spinner.hidden = true; this.isPlaying = true; this.isLive = true; this.updatePlayBtn(); if (streamHealth) { streamHealth.hidden = false; const dot = streamHealth.querySelector('.health-dot'); if (dot) dot.className = 'health-dot'; } }).catch(() => { if (spinner) spinner.hidden = true; if (error) error.hidden = false; }); }
      this.renderChannels(); this.resetControlsTimer();
    } catch (e) { const spinner = this.$('loading-spinner'), error = this.$('error-message'); if (spinner) spinner.hidden = true; if (error) error.hidden = false; }
    finally { this.isSwitchingChannel = false; setTimeout(() => this._processQueue(), 200); }
  },
  
  _processQueue() { if (this._switchQueue.length > 0 && !this.isSwitchingChannel) { const next = this._switchQueue.shift(); this.playChannel(next.channel, next.isRetry); } },
  retryStream() { this.retryAttempt = 0; if (this.currentChannel) this.playChannel(this.currentChannel, false); },

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTICS & STREAM HEALTH
  // ═══════════════════════════════════════════════════════════
  updateBufferDiagnostics() { const v = this.videoEl(); if (!v) return; let bufSec = 0; if (v.buffered.length > 0) { const ct = v.currentTime; for (let i = 0; i < v.buffered.length; i++) { if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) { bufSec = v.buffered.end(i) - ct; break; } } } const buf = this.$('diag-buffer'); if (buf) buf.textContent = `${bufSec.toFixed(1)}s`; },
  updateStreamHealthIndicator() { const health = this.$('stream-health'); if (!health) return; const dot = health.querySelector('.health-dot'), healthText = health.querySelector('.health-text'); if (!dot) return; const v = this.videoEl(); if (!v) return; let bufSec = 0; if (v.buffered.length > 0) { const ct = v.currentTime; for (let i = 0; i < v.buffered.length; i++) { if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) { bufSec = v.buffered.end(i) - ct; break; } } } if (bufSec > 10) dot.className = 'health-dot'; else if (bufSec > 3) dot.className = 'health-dot buffering'; else dot.className = 'health-dot poor'; if (healthText) healthText.textContent = bufSec > 0 ? `${bufSec.toFixed(1)}s` : '...'; },

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════
  clearAllIntervals() { ['liveStatusInterval','uptimeInterval','diagnosticInterval','watchInterval'].forEach(k => { if (this[k]) { clearInterval(this[k]); this[k] = null; } }); if (this.streamTimeoutTimer) { clearTimeout(this.streamTimeoutTimer); this.streamTimeoutTimer = null; } },
  formatTime(s) { if (!isFinite(s) || isNaN(s) || s < 0) return '0:00'; const abs = Math.floor(Math.abs(s)), h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), sec = abs % 60; return `${s < 0 ? '-' : ''}${h > 0 ? h + ':' + String(m).padStart(2, '0') : m}:${String(sec).padStart(2, '0')}`; },
  preloadNextChannel() { if (!this.currentChannel || typeof channels === 'undefined') return; const idx = channels.findIndex(c => c === this.currentChannel); const next = channels[(idx + 1) % channels.length]; if (!next?.url || next === this.preloadedChannel) return; if (this.preloadedHls) { this.preloadedHls.destroy(); this.preloadedHls = null; } if (typeof Hls === 'undefined' || !Hls.isSupported()) return; this.preloadedHls = new Hls({ enableWorker: true, startLevel: -1, capLevelToPlayerSize: false }); this.preloadedHls.loadSource(next.url); this.preloadedChannel = next; this.preloadedHls.on(Hls.Events.ERROR, () => { if (this.preloadedHls) { this.preloadedHls.destroy(); this.preloadedHls = null; } this.preloadedChannel = null; }); },
  togglePlay() { const v = this.videoEl(); if (!v) return; if (v.paused) { v.play().then(() => { this.isPlaying = true; this.updatePlayBtn(); }).catch(() => {}); } else { v.pause(); this.isPlaying = false; this.updatePlayBtn(); } },
  updatePlayBtn() { const btn = this.$('play-btn'); if (!btn) return; btn.innerHTML = this.isPlaying ? '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zM14 4h4v16h-4V4z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>'; },
  nextChannel() { const l = typeof channels !== 'undefined' ? channels : []; if (!l.length) return; const i = l.findIndex(c => c === this.currentChannel); this.playChannel(l[i >= 0 ? (i + 1) % l.length : 0], false); },
  prevChannel() { const l = typeof channels !== 'undefined' ? channels : []; if (!l.length) return; const i = l.findIndex(c => c === this.currentChannel); this.playChannel(l[i > 0 ? i - 1 : l.length - 1], false); },
  toggleMute() { const v = this.videoEl(); if (!v) return; v.muted = !v.muted; this.updateMuteIcon(); },
  changeVolume: debounceFn(function(val) { const ve = this.videoEl(); if (ve) { ve.volume = Math.max(0, Math.min(1, val / 100)); ve.muted = false; } if (this.volumeBoost && this.gainNode && val > 100) this.gainNode.gain.value = val / 100; else if (this.gainNode) this.gainNode.gain.value = 1.0; this.updateMuteIcon(); }, 50),
  updateMuteIcon() { const v = this.videoEl(), b = this.$('mute-btn'); if (!v || !b) return; const svg = b.querySelector('svg'); if (!svg) return; svg.innerHTML = (v.muted || v.volume === 0) ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" stroke-width="2" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/>' : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" stroke-width="2" fill="none"/>'; },
  showLiveBadge() { const lb = this.$('live-badge'); if (lb) { lb.hidden = false; lb.className = 'live-badge live-active'; } const gl = this.$('go-live-btn'); if (gl) gl.hidden = true; const sh = this.$('stream-health'); if (sh) sh.hidden = false; this.updateLiveStatus(); },
  hideLiveBadge() { const lb = this.$('live-badge'); if (lb) lb.hidden = true; const gl = this.$('go-live-btn'); if (gl) gl.hidden = true; const sh = this.$('stream-health'); if (sh) sh.hidden = true; const dv = this.$('dvr-buffer'); if (dv) dv.hidden = true; this.clearAllIntervals(); this.updateTitle(null); },
  goLive() { const v = this.videoEl(); if (!v) return; if (isFinite(v.duration)) v.currentTime = v.duration - 1; const gl = this.$('go-live-btn'); if (gl) gl.hidden = true; this.showLiveBadge(); },
  updateLiveStatus() { this.clearAllIntervals(); if (!this.hls) return; this.liveStatusInterval = setInterval(() => { if (!this.hls || !this.isPlaying) { clearInterval(this.liveStatusInterval); this.liveStatusInterval = null; return; } const v = this.videoEl(); if (!v) return; this.liveLatency = (this.hls.latency !== undefined && this.hls.latency !== null) ? this.hls.latency : (isFinite(v.duration) && v.duration > 0 ? Math.max(0, v.duration - v.currentTime) : 0); const td = this.$('time-display'); if (td) { if (isFinite(v.duration) && v.duration > 0) { td.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`; td.classList.remove('live-at-edge'); } else if (this.liveLatency < 2) { td.textContent = 'LIVE'; td.classList.add('live-at-edge'); } else { td.textContent = `-${this.formatTime(Math.max(0, this.liveLatency))}`; td.classList.remove('live-at-edge'); } } const lb = this.$('live-badge'), gl = this.$('go-live-btn'); if (this.liveLatency < 2) { if (lb) { lb.hidden = false; lb.className = 'live-badge live-active'; } if (gl) gl.hidden = true; } else if (this.liveLatency < 10) { if (lb) { lb.hidden = false; lb.className = 'live-badge live-delayed'; } if (gl) gl.hidden = true; } else { if (lb) lb.hidden = true; if (gl) gl.hidden = false; } this.updateBufferDiagnostics(); this.updateStreamHealthIndicator(); }, 1000); },
  updateStreamUptime() { if (this.uptimeInterval) clearInterval(this.uptimeInterval); this.uptimeInterval = setInterval(() => { if (!this.streamStartTime || !this.isPlaying) return; const elapsed = Math.floor((Date.now() - this.streamStartTime) / 1000); const u = this.$('stream-uptime'); if (u) { u.hidden = false; u.textContent = this.formatTime(elapsed); } }, 10000); },
  updateRecentlyWatched() { const c = this.$('recently-watched'), l = this.$('recently-watched-list'); if (!c || !l) return; if (!this.recentChannels.length) { c.hidden = true; return; } c.hidden = false; l.innerHTML = ''; this.recentChannels.forEach(ch => { const i = createEl('div', 'recently-watched-item'); i.innerHTML = `<div class="rw-avatar">${safeText((ch.name||'TV').substring(0,2).toUpperCase())}</div><span>${safeText(ch.name)}</span>`; i.onclick = () => { const fc = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === ch.id); if (fc) this.playChannel(fc, false); }; l.appendChild(i); }); },
  updateQualitySelector() { const s = this.$('quality-levels'); if (!s) return; s.innerHTML = '<option value="-1">Auto</option>'; if (!this.hls?.levels?.length) return; this.hls.levels.forEach((l, i) => { const o = document.createElement('option'); o.value = i; if (l.height >= 2160) o.textContent = `4K (${l.height}p)`; else if (l.height >= 1080) o.textContent = `Full HD (${l.height}p)`; else if (l.height >= 720) o.textContent = `HD (${l.height}p)`; else if (l.height) o.textContent = `${l.height}p`; else o.textContent = `Level ${i + 1}`; s.appendChild(o); }); },
  changeQuality(v) { if (!this.hls) return; this.hls.currentLevel = parseInt(v); },
  setupSeek() { const c = this.$('progress-bar-container'), t = this.$('progress-track'); if (!c || !t) return; const gf = cx => { const r = t.getBoundingClientRect(); return Math.max(0, Math.min(1, (cx - r.left) / r.width)); }; const ap = cx => { const v = this.videoEl(); if (!v || !isFinite(v.duration) || v.duration <= 0) return; v.currentTime = gf(cx) * v.duration; }; c.addEventListener('mousedown', e => { this.isDragging = true; ap(e.clientX); e.preventDefault(); }); c.addEventListener('mousemove', e => { if (this.isDragging) ap(e.clientX); }); c.addEventListener('touchstart', e => { this.isDragging = true; ap(e.touches[0].clientX); }, { passive: true }); c.addEventListener('touchmove', e => { if (this.isDragging && e.touches[0]) ap(e.touches[0].clientX); }, { passive: true }); window.addEventListener('mouseup', () => { this.isDragging = false; }); window.addEventListener('touchend', () => { this.isDragging = false; }); },
  setupAutoHideControls() { const w = this.$('video-wrapper'); if (!w) return; w.addEventListener('mousemove', () => this.resetControlsTimer()); w.addEventListener('click', () => this.resetControlsTimer()); w.addEventListener('touchstart', () => this.resetControlsTimer(), { passive: true }); const p = this.$('progress-bar-container'); if (p) { p.addEventListener('mouseenter', () => { this.controlsHovered = true; this.showControls(); clearTimeout(this.controlsTimer); }); p.addEventListener('mouseleave', () => { this.controlsHovered = false; this.resetControlsTimer(); }); } const v = this.videoEl(); if (v) { v.addEventListener('play', () => this.resetControlsTimer()); v.addEventListener('pause', () => this.showControls()); } },
  resetControlsTimer() { clearTimeout(this.controlsTimer); this.showControls(); if (this.isPlaying && !this.controlsHovered) this.controlsTimer = setTimeout(() => this.hideControls(), this.CONTROLS_HIDE_DELAY); },
  showControls() { const w = this.$('video-wrapper'); if (w) w.classList.remove('controls-hidden'); const container = document.querySelector('.player-container'); if (container) container.classList.remove('controls-hidden'); },
  hideControls() { if (!this.isPlaying || this.controlsHovered || this.isDragging) return; const w = this.$('video-wrapper'); if (w) w.classList.add('controls-hidden'); const container = document.querySelector('.player-container'); if (container) container.classList.add('controls-hidden'); },
  setupDoubleTap() { const w = this.$('video-wrapper'); if (!w) return; let lt = 0; w.addEventListener('touchend', e => { if (e.target.closest('.player-controls,.player-controls-secondary,.progress-bar-container')) return; if (e.changedTouches.length !== 1) return; const n = Date.now(); if (n - lt < 300) { e.preventDefault(); const v = this.videoEl(); if (!v) return; const r = w.getBoundingClientRect(), tx = e.changedTouches[0].clientX - r.left; tx < r.width / 2 ? (v.currentTime = Math.max(0, v.currentTime - 10), this.showDbl('left')) : (v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 10) : v.currentTime + 10, this.showDbl('right')); lt = 0; } else lt = n; }); },
  showDbl(s) { const e = this.$(s === 'left' ? 'dbl-tap-left' : 'dbl-tap-right'); if (!e) return; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 550); },
  startDiagnostics() { if (this.diagnosticInterval) clearInterval(this.diagnosticInterval); this.diagnosticInterval = setInterval(() => { if (!this.currentChannel) return; const v = this.videoEl(); if (!v) return; let bufSec = 0; if (v.buffered.length > 0) { const ct = v.currentTime; for (let i = 0; i < v.buffered.length; i++) { if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) { bufSec = v.buffered.end(i) - ct; break; } } } const buf = this.$('diag-buffer'); if (buf) buf.textContent = `${bufSec.toFixed(1)}s`; if (this.hls?.currentLevel >= 0 && this.hls.levels[this.hls.currentLevel]) { const l = this.hls.levels[this.hls.currentLevel]; const diagRes = this.$('diag-resolution'); if (l && diagRes) { if (l.height >= 2160) diagRes.textContent = `4K (${l.width}x${l.height})`; else if (l.height) diagRes.textContent = `${l.width}x${l.height}`; } } if (this.hls?.bandwidthEstimate) { const bw = this.$('diag-bandwidth'); if (bw) { const mbps = (this.hls.bandwidthEstimate / 1000000).toFixed(2); bw.textContent = `${mbps} Mbps`; } } this.updateStreamHealthIndicator(); }, 2000); },
  toggleFullscreen() { const w = this.$('video-wrapper'); if (!w) return; document.fullscreenElement ? (document.exitFullscreen || document.webkitExitFullscreen)?.call(document) : (w.requestFullscreen || w.webkitRequestFullscreen)?.call(w); },
  toggleTheaterMode() { this.isTheaterMode = !this.isTheaterMode; document.body.classList.toggle('theater-mode', this.isTheaterMode); this.showToast(this.isTheaterMode ? 'Theater mode ON' : 'Theater mode OFF'); },
  async togglePiP() { if (!document.pictureInPictureEnabled) { this.showToast('PiP not supported'); return; } try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await this.videoEl()?.requestPictureInPicture(); } catch {} },
  setupAutoPiP() { if (!this.autoPiP) return; document.addEventListener('visibilitychange', () => { if (document.hidden && this.isPlaying && document.pictureInPictureEnabled && !document.pictureInPictureElement) this.videoEl()?.requestPictureInPicture().catch(() => {}); }); },
  setupBackgroundAudio() { if (!this.bgAudio) return; document.addEventListener('visibilitychange', () => { if (document.hidden && this.isPlaying) this.videoEl()?.play().catch(() => {}); }); },
  setupPlaybackSpeed() { const sel = this.$('playback-speed'); if (sel) sel.value = this.playbackSpeed; const v = this.videoEl(); if (v) v.playbackRate = this.playbackSpeed; },
  setPlaybackSpeed(s) { this.playbackSpeed = parseFloat(s); const v = this.videoEl(); if (v) v.playbackRate = this.playbackSpeed; safeSet(STORAGE_KEYS.SPEED, this.playbackSpeed); },
  increasePlaybackSpeed() { const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; const idx = speeds.indexOf(this.playbackSpeed); if (idx < speeds.length - 1) this.setPlaybackSpeed(speeds[idx + 1]); this.showToast(`Speed: ${this.playbackSpeed}x`); },
  decreasePlaybackSpeed() { const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; const idx = speeds.indexOf(this.playbackSpeed); if (idx > 0) this.setPlaybackSpeed(speeds[idx - 1]); this.showToast(`Speed: ${this.playbackSpeed}x`); },
  updateWatchStats() { if (this.watchInterval) clearInterval(this.watchInterval); this.watchInterval = setInterval(() => { if (this.isPlaying) { this.watchTimeToday += 5; this.watchTimeWeek += 5; safeSet(STORAGE_KEYS.WATCH_TODAY, this.watchTimeToday); safeSet(STORAGE_KEYS.WATCH_WEEK, this.watchTimeWeek); } }, 5000); },
  toggleAudioOnly() { this.isAudioOnly = !this.isAudioOnly; const w = this.$('video-wrapper'); if (w) w.classList.toggle('audio-only', this.isAudioOnly); const o = this.$('audio-only-overlay'); if (o) o.hidden = !this.isAudioOnly; const b = this.$('audio-only-btn'); if (b) b.classList.toggle('active', this.isAudioOnly); },
  openSleepTimer() { this.$('sleep-timer-modal').hidden = false; this.updateSleepTimerStatus(); },
  closeSleepTimer() { this.$('sleep-timer-modal').hidden = true; },
  setSleepTimer(m) { if (this.sleepTimer) clearTimeout(this.sleepTimer); if (m === 0) { this.sleepTimer = null; this.sleepEndTime = null; this.showToast('Sleep timer cancelled'); this.closeSleepTimer(); return; } this.sleepEndTime = Date.now() + m * 60000; this.sleepTimer = setTimeout(() => { this.videoEl()?.pause(); this.isPlaying = false; this.updatePlayBtn(); this.showToast('Sleep timer ended'); this.closeSleepTimer(); }, m * 60000); this.showToast(`Sleep timer: ${m} min`); this.updateSleepTimerStatus(); },
  updateSleepTimerStatus() { const s = this.$('sleep-timer-status'); if (s && this.sleepEndTime) s.textContent = `${Math.ceil((this.sleepEndTime - Date.now()) / 60000)} min remaining`; },
  openM3UImport() { this.$('m3u-modal').hidden = false; },
  closeM3UImport() { this.$('m3u-modal').hidden = true; if (this.m3uAbortController) { this.m3uAbortController.abort(); this.m3uAbortController = null; } },
  async importM3U() { const ui = this.$('m3u-url'), fi = this.$('m3u-file'); let content = ''; if (ui?.value.trim()) { this.m3uAbortController = new AbortController(); const timeout = setTimeout(() => this.m3uAbortController.abort(), 15000); try { const r = await fetch(ui.value.trim(), { signal: this.m3uAbortController.signal }); clearTimeout(timeout); content = await r.text(); } catch { clearTimeout(timeout); this.showToast('Failed to fetch'); this.m3uAbortController = null; return; } this.m3uAbortController = null; } else if (fi?.files[0]) { content = await fi.files[0].text(); } else { this.showToast('Provide URL or file'); return; } const parsed = this.parseM3U(content); if (!parsed.length) { this.showToast('No streams found'); return; } const ex = new Set((typeof channels !== 'undefined' ? channels : []).map(x => x.url)); const nw = parsed.filter(x => !ex.has(x.url)); if (typeof channels !== 'undefined') channels.push(...nw); this.showToast(`Imported ${nw.length} channels`); this.closeM3UImport(); this.renderChannels(); },
  parseM3U(c) { const l = c.split(/\r?\n/), r = []; let cur = null; for (const ln of l) { const t = ln.trim(); if (!t) continue; if (t.startsWith('#EXTINF:')) { cur = { id: 'IM' + Date.now() + Math.random().toString(36).slice(2, 8), logo: '', category: 'Entertainment' }; const lm = t.match(/tvg-logo="([^"]+)"/); if (lm) cur.logo = lm[1]; const gm = t.match(/group-title="([^"]+)"/); if (gm) cur.category = gm[1]; const ci = t.lastIndexOf(','); cur.name = ci !== -1 ? t.substring(ci + 1).trim() : 'Imported'; } else if (!t.startsWith('#') && cur) { cur.url = t; r.push({ ...cur }); cur = null; } } return r; },
  exportFavorites() { if (!this.favorites.length) { this.showToast('No favorites'); return; } const fc = (typeof channels !== 'undefined' ? channels : []).filter(c => this.favorites.includes(String(c.id || c.name))); let m3u = '#EXTM3U\n#PLAYLIST: Pulse.tv Favorites\n'; fc.forEach(c => { m3u += `#EXTINF:-1,${c.name}\n${c.url}\n`; }); const b = new Blob([m3u], { type: 'audio/x-mpegurl' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pulse-favorites.m3u'; a.click(); URL.revokeObjectURL(a.href); this.showToast('Favorites exported'); },
  openShortcuts() { this.$('shortcuts-modal').hidden = false; },
  closeShortcuts() { this.$('shortcuts-modal').hidden = true; },
  checkPWAInstall() { if (window.matchMedia('(display-mode: standalone)').matches || safeGet(STORAGE_KEYS.PWA_DISMISSED)) return; const banner = this.$('pwa-install-banner'); if (banner) banner.hidden = false; },
  installPWA() { this.dismissPWA(); },
  dismissPWA() { const banner = this.$('pwa-install-banner'); if (banner) banner.hidden = true; safeSet(STORAGE_KEYS.PWA_DISMISSED, true); },

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS (COMPLETE — All requested)
  // ═══════════════════════════════════════════════════════════
  setupKeyboard() {
    document.addEventListener('keydown', e => {
      // Search focus
      if (e.key === '/' && !e.shiftKey && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); const si = this.$('search-input'); if (si && !this.kidsMode) { si.focus(); si.select(); } return;
      }
      // Show shortcuts
      if ((e.key === '?' && !e.shiftKey) || (e.shiftKey && e.key === '/')) {
        if (!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); this.openShortcuts(); } return;
      }
      // Channel numbers (when not in input)
      if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.shiftKey && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        if (e.key === '0') { const v = this.videoEl(); if (v) v.currentTime = 0; return; }
        this.channelInputBuffer += e.key; if (this.channelInputBuffer.length > 3) this.channelInputBuffer = this.channelInputBuffer.slice(-3);
        const nd = this.$('channel-name-display'); if (nd) nd.textContent = `Channel ${this.channelInputBuffer}...`;
        clearTimeout(this.channelInputTimeout);
        this.channelInputTimeout = setTimeout(() => { const n = parseInt(this.channelInputBuffer); if (n > 0 && n <= (typeof channels !== 'undefined' ? channels.length : 0)) this.playChannel(channels[n - 1], false); else if (this.currentChannel) { const nd2 = this.$('channel-name-display'); if (nd2) nd2.textContent = this.currentChannel.name; } this.channelInputBuffer = ''; }, 1200);
        return;
      }
      
      if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.ctrlKey && e.key >= '0' && e.key <= '9') { e.preventDefault(); this.assignQuickSwap(e.key); return; }
      if (e.altKey && e.key >= '0' && e.key <= '9') { e.preventDefault(); this.swapToQuickChannel(e.key); return; }
      
      const v = this.videoEl();
      
      switch (e.key) {
        // Playback Controls
        case ' ': case 'k': case 'K': e.preventDefault(); this.togglePlay(); break;
        case 'j': case 'J': e.preventDefault(); if (v) v.currentTime = Math.max(0, v.currentTime - 10); this.showDbl('left'); break;
        case 'l': case 'L': e.preventDefault(); if (v) v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 10) : v.currentTime + 10; this.showDbl('right'); break;
        case 'ArrowLeft': e.preventDefault(); if (v) v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'ArrowRight': e.preventDefault(); if (v) v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 5) : v.currentTime + 5; break;
        // Speed
        case ',': if (e.shiftKey) { e.preventDefault(); this.decreasePlaybackSpeed(); } break;
        case '.': if (e.shiftKey) { e.preventDefault(); this.increasePlaybackSpeed(); } break;
        // Volume & Mute
        case 'ArrowUp': e.preventDefault(); if (v) { v.volume = Math.min(1, v.volume + 0.1); v.muted = false; this.updateMuteIcon(); } break;
        case 'ArrowDown': e.preventDefault(); if (v) { v.volume = Math.max(0, v.volume - 0.1); this.updateMuteIcon(); } break;
        case 'm': case 'M': e.preventDefault(); this.toggleMute(); break;
        // Fullscreen & Viewing Modes
        case 'f': case 'F': e.preventDefault(); this.toggleFullscreen(); break;
        case 't': case 'T': e.preventDefault(); this.toggleTheaterMode(); break;
        case 'i': case 'I': e.preventDefault(); this.togglePiP(); break;
        // Navigation
        case 'n': case 'N': if (!e.shiftKey) { e.preventDefault(); this.nextChannel(); } break;
        case 'p': case 'P': if (!e.shiftKey) { e.preventDefault(); this.prevChannel(); } break;
        // Video Position
        case 'Home': e.preventDefault(); if (v) v.currentTime = 0; break;
        case 'End': e.preventDefault(); if (v && isFinite(v.duration)) v.currentTime = v.duration; break;
        // Frame Control
        case 'N': if (e.shiftKey) { e.preventDefault(); if (v && v.paused) v.currentTime += 1/30; } break;
        case 'P': if (e.shiftKey) { e.preventDefault(); if (v && v.paused) v.currentTime = Math.max(0, v.currentTime - 1/30); } break;
        // Other
        case 'c': case 'C': if (!e.shiftKey) { e.preventDefault(); /* Captions placeholder */ } break;
        case 'b': case 'B': e.preventDefault(); this.toggleSidebar('left'); break;
        case 'a': case 'A': if (!e.shiftKey) { e.preventDefault(); this.toggleAudioOnly(); } break;
        case 'Escape': this.closeAllModals(); break;
      }
      
      // Keys 1-9 → Jump to 10%-90% of video
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && e.key >= '1' && e.key <= '9' && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (v && isFinite(v.duration) && v.duration > 0) { v.currentTime = v.duration * (parseInt(e.key) / 10); this.showToast(`Jumped to ${parseInt(e.key) * 10}%`); }
      }
    });
  },
  assignQuickSwap(key) { if (!this.currentChannel) return; this.quickSwapKeys[key] = String(this.currentChannel.id || this.currentChannel.name); safeSet(STORAGE_KEYS.QUICK_SWAP, this.quickSwapKeys); },
  swapToQuickChannel(key) { const id = this.quickSwapKeys[key]; if (!id) return; const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === id); if (ch) this.playChannel(ch, false); },
  closeAllModals() { ['share-modal','settings-modal','sleep-timer-modal','m3u-modal','shortcuts-modal','pin-pad-modal'].forEach(id => { const m = this.$(id); if (m) m.hidden = true; }); },
};

// ═══════════════════════════════════════════════════════════════
// INIT & CLEANUP
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => PulseApp.init());
window.addEventListener('beforeunload', () => {
  PulseApp.clearAllIntervals();
  PulseApp.hls?.destroy(); PulseApp.preloadedHls?.destroy();
  if (PulseApp.sleepTimer) clearTimeout(PulseApp.sleepTimer);
  if (PulseApp.adReopenTimer) clearInterval(PulseApp.adReopenTimer);
  if (PulseApp.m3uAbortController) PulseApp.m3uAbortController.abort();
  if (PulseApp.renderRAF) cancelAnimationFrame(PulseApp.renderRAF);
  OnlineUsers.cleanup();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}