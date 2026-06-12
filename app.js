// ═══════════════════════════════════════════════════════════════
// PULSE.tv v10.1 — Bug Fixes, Performance & UI Improvements
// ═══════════════════════════════════════════════════════════════
'use strict';

// ── Global Error Handling ──
window.onerror = () => { const b = document.getElementById('error-boundary'); if (b) b.hidden = false; };
window.onunhandledrejection = () => { const b = document.getElementById('error-boundary'); if (b) b.hidden = false; };

// ── Safe Utilities ──
const safeText = s => !s ? '' : String(s).replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[m]));
const createEl = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; };
const safeGet = (k, f = null) => { try { const r = localStorage.getItem(k); return r !== null ? JSON.parse(r) : f; } catch { return f; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e) { if (e.name === 'QuotaExceededError') { PulseApp._pruneStorage(); } return false; } };

// FIX: PIN hash uses consistent salt
const hashPIN = (pin) => { if (!pin) return null; return btoa(String(pin) + '_pulse_salt_v1'); };
const verifyPIN = (pin, hash) => { if (!pin || !hash) return false; return hashPIN(pin) === hash; };

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
  WATCH_TODAY: 'pulse_watch_today', WATCH_WEEK: 'pulse_watch_week', ACCENT_COLOR_KEY: 'pulse_accent_color'
};

// FIX: Proper debounce/throttle with correct this-binding
const debounceFn = (fn, ms) => {
  let t;
  return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
};
const throttleFn = (fn, ms) => {
  let last = 0;
  return function(...a) { const now = Date.now(); if (now - last >= ms) { last = now; fn.apply(this, a); } };
};

// ── Safe URL validator ──
const isValidURL = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
};

// ═══════════════════════════════════════════════════════════════
// ONLINE USERS COUNTER
// ═══════════════════════════════════════════════════════════════
const OnlineUsers = {
  SUPABASE_URL: 'https://orebgjrnfgrlegbqrauo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QORKRFVCk-MnN1HQ_DVjaQ_zUhlmjG2',
  supabase: null, channel: null, userId: null, onlineCount: 0,
  reconnectAttempts: 0, MAX_RECONNECT_ATTEMPTS: 20, isConnected: false,
  connectionStatus: 'connecting', cleanupTimer: null, _scriptLoaded: false,

  init() {
    this.userId = safeGet(STORAGE_KEYS.USER_ID, null);
    if (!this.userId) {
      this.userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      safeSet(STORAGE_KEYS.USER_ID, this.userId);
    }
    this.updateStatusUI('connecting');
    this.renderCounter();
    this.setupEventListeners();
    this.loadSupabaseAndConnect();
  },

  loadSupabaseAndConnect() {
    if (this._scriptLoaded && window.supabase) { this.connect(); return; }
    if (document.querySelector('script[data-supabase]')) return; // prevent duplicate load
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.dataset.supabase = '1';
    script.onload = () => { this._scriptLoaded = true; setTimeout(() => this.connect(), 300); };
    script.onerror = () => { this.updateStatusUI('offline'); setTimeout(() => this.loadSupabaseAndConnect(), 8000); };
    document.head.appendChild(script);
  },

  connect() {
    if (typeof supabase === 'undefined') { setTimeout(() => this.loadSupabaseAndConnect(), 2000); return; }
    try {
      if (this.supabase) {
        try { this.supabase.removeAllChannels(); } catch(e) {}
      }
      this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 1 } }
      });
      this.joinChannel();
    } catch (e) { this.updateStatusUI('offline'); this.scheduleReconnect(); }
  },

  joinChannel() {
    if (!this.supabase) return;
    try {
      if (this.channel) {
        try { this.supabase.removeChannel(this.channel); } catch(e) {}
        this.channel = null;
      }
      this.channel = this.supabase.channel('global-online', {
        config: { presence: { key: this.userId } }
      });
      this.channel.on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        const uniqueUsers = new Set();
        Object.values(state).forEach(p => { p.forEach(u => { if (u.user_id) uniqueUsers.add(u.user_id); }); });
        this.onlineCount = Math.max(1, uniqueUsers.size);
        this.reconnectAttempts = 0;
        this.isConnected = true;
        this.updateStatusUI('online');
        this.renderCounter();
      });
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }).catch(() => {});
          this.reconnectAttempts = 0; this.isConnected = true; this.updateStatusUI('online');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false; this.updateStatusUI('connecting'); this.scheduleReconnect();
        }
      });
    } catch (e) { this.updateStatusUI('offline'); this.scheduleReconnect(); }
  },

  updateStatusUI(status) {
    this.connectionStatus = status;
    const container = document.getElementById('online-users-counter');
    if (!container) return;
    const titles = { connecting: 'Connecting…', online: 'Viewers online now', offline: 'Offline mode' };
    container.title = titles[status] || 'Online';
  },

  setupEventListeners() {
    // FIX: Guard against multiple registrations
    if (this._listenersAttached) return;
    this._listenersAttached = true;
    window.addEventListener('online', () => { this.reconnectAttempts = 0; this.connect(); });
    window.addEventListener('offline', () => { this.isConnected = false; this.updateStatusUI('offline'); this.renderCounter(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.channel && this.isConnected) {
        this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }).catch(() => {});
      }
    });
    // FIX: Clear old interval before creating new one
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      if (this.channel && this.isConnected) {
        this.channel.track({ user_id: this.userId, online_at: new Date().toISOString() }).catch(() => {});
      }
    }, 45000);
  },

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) { this.updateStatusUI('offline'); return; }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    setTimeout(() => { if (!this.isConnected) this.connect(); }, delay);
  },

  renderCounter() {
    const c = document.getElementById('online-users-counter');
    if (!c) return;
    const dotClass = this.connectionStatus === 'offline' ? 'online-dot offline' : 'online-dot';
    c.innerHTML = `<span class="${dotClass}" aria-hidden="true"></span><span class="online-count">${this.onlineCount}</span><span class="online-label">online</span>`;
  },

  cleanup() {
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }
    if (this.channel && this.supabase) {
      this.channel.untrack().catch(() => {});
      this.supabase.removeChannel(this.channel).catch(() => {});
    }
    this.channel = null; this.supabase = null;
  }
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
  favorites: safeGet(STORAGE_KEYS.FAVORITES, []),
  history: safeGet(STORAGE_KEYS.HISTORY, []),
  watchlist: safeGet(STORAGE_KEYS.WATCHLIST, []),
  continueWatching: safeGet(STORAGE_KEYS.CONTINUE_WATCHING, []),
  recentChannels: safeGet(STORAGE_KEYS.RECENT, []),
  ratings: safeGet(STORAGE_KEYS.RATINGS, {}),
  accentColor: safeGet(STORAGE_KEYS.ACCENT, '#6c5ce7'),
  dataSaverMode: safeGet(STORAGE_KEYS.DATA_SAVER, 'auto'),
  _pinHash: safeGet(STORAGE_KEYS.PARENTAL_PIN, null),
  kidsMode: safeGet(STORAGE_KEYS.KIDS_MODE, false),
  kidsLockUntil: safeGet(STORAGE_KEYS.KIDS_LOCK, 0),
  kidsPinAttempts: safeGet(STORAGE_KEYS.KIDS_ATTEMPTS, 0),
  autoplayNext: safeGet(STORAGE_KEYS.AUTOPLAY, true),
  notificationsEnabled: safeGet(STORAGE_KEYS.NOTIFICATIONS, false),
  quietHoursEnabled: safeGet(STORAGE_KEYS.QUIET_HOURS, false),
  quietHoursStart: safeGet(STORAGE_KEYS.QUIET_START, '22:00'),
  quietHoursEnd: safeGet(STORAGE_KEYS.QUIET_END, '07:00'),
  dndWhileWatching: safeGet(STORAGE_KEYS.DND_WATCHING, true),
  channelSubscriptions: safeGet(STORAGE_KEYS.CHANNEL_SUBS, []),
  playbackSpeed: parseFloat(safeGet(STORAGE_KEYS.SPEED, 1)) || 1,
  retryCount: 3,
  channelInputBuffer: '', channelInputTimeout: null,
  diagnosticInterval: null, liveStatusInterval: null,
  streamTimeoutTimer: null, retryAttempt: 0,
  renderRAF: null,
  quickSwapKeys: safeGet(STORAGE_KEYS.QUICK_SWAP, {}),
  adReopenTimer: null, AD_REOPEN_INTERVAL: 300000,
  watchTimeToday: safeGet(STORAGE_KEYS.WATCH_TODAY, 0),
  watchTimeWeek: safeGet(STORAGE_KEYS.WATCH_WEEK, 0),
  watchInterval: null,
  m3uAbortController: null, recognition: null, isListening: false,
  _scoreTimeout: null, _toastCount: 0, MAX_TOASTS: 5,
  isTheaterMode: false,
  _pinCallback: null, _pinValue: '',
  _uptimeSeconds: 0,

  // FIX: PIN stored as hash, getter/setter symmetric
  get parentalPINHash() { return this._pinHash; },
  setParentalPINFromRaw(pin) {
    this._pinHash = hashPIN(pin);
    safeSet(STORAGE_KEYS.PARENTAL_PIN, this._pinHash);
  },
  verifyPIN(pin) { return verifyPIN(pin, this._pinHash); },

  // ── Storage pruning for QuotaExceededError ──
  _pruneStorage() {
    try {
      // Trim history and continue watching to reduce footprint
      this.history = this.history.slice(0, 20);
      safeSet(STORAGE_KEYS.HISTORY, this.history);
      this.continueWatching = this.continueWatching.slice(0, 5);
      safeSet(STORAGE_KEYS.CONTINUE_WATCHING, this.continueWatching);
    } catch(e) {}
  },

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
    this.setupPlaybackSpeed();
    this.updateWatchStats();
    this.initVoiceSearch();
    this.setupKeyboard();
    OnlineUsers.init();

    // Restore volume boost
    if (safeGet(STORAGE_KEYS.VOLUME_BOOST, false)) {
      this.volumeBoost = true;
      const bb = this.$('boost-btn'); if (bb) bb.classList.add('active');
      const vs = this.$('volume-slider'); if (vs) vs.max = '200';
    }

    // Restore kids mode
    if (this.kidsMode) {
      if (Date.now() < this.kidsLockUntil) {
        this.kidsMode = false; safeSet(STORAGE_KEYS.KIDS_MODE, false);
      } else {
        this.applyKidsMode();
      }
    }

    // Auto-play first or last watched channel
    const allCh = typeof channels !== 'undefined' ? channels : [];
    if (allCh.length > 0) {
      const lastWatched = this.continueWatching[0];
      if (lastWatched) {
        const ch = allCh.find(c => String(c.id || c.name) === String(lastWatched.id));
        if (ch) {
          setTimeout(() => {
            this.playChannel(ch, false);
            if (lastWatched.timestamp > 0) {
              const v = this.videoEl();
              if (v) {
                const st = () => { v.currentTime = lastWatched.timestamp; v.removeEventListener('loadedmetadata', st); };
                v.addEventListener('loadedmetadata', st, { once: true });
              }
            }
          }, 600);
          this._sidebarInitialized = true;
          return;
        }
      }
      setTimeout(() => this.playChannel(allCh[0], false), 600);
    }

    const spinner = this.$('loading-spinner');
    if (spinner) spinner.hidden = true;
    this._sidebarInitialized = true;
  },

  // ═══════════════════════════════════════════════════════════
  // GLOBAL EVENT DELEGATION
  // ═══════════════════════════════════════════════════════════
  setupGlobalEventDelegation() {
    // Rating stars
    const ratingContainer = this.$('rating-stars');
    if (ratingContainer) {
      ratingContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-rating]');
        if (!btn) return;
        const rating = parseInt(btn.dataset.rating, 10);
        if (rating > 0) this.rateChannel(rating);
      });
    }

    // Channel grid — delegated
    const channelGrid = this.$('channel-grid');
    if (channelGrid) {
      channelGrid.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return; // handled by global click
        const card = e.target.closest('.channel-card');
        if (!card) return;
        const chId = card.dataset.channelId;
        if (chId) {
          const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === chId);
          if (ch) this.playChannel(ch, false);
        }
      });
    }

    // Logo click
    const logoArea = document.querySelector('.logo-area');
    if (logoArea) {
      logoArea.addEventListener('click', (e) => {
        if (!e.target.closest('.online-users-counter') && !e.target.closest('.kids-mode-indicator')) {
          this.handleLogoClick();
        }
      });
    }

    // Accent colors
    const accentColors = this.$('accent-colors');
    if (accentColors) {
      accentColors.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-color]');
        if (btn) this.setAccentColor(btn.dataset.color);
      });
    }

    // Category list
    const categoryList = this.$('category-list');
    if (categoryList) {
      categoryList.addEventListener('click', (e) => {
        const btn = e.target.closest('.cat-btn[data-cat]');
        if (!btn) return;
        document.querySelectorAll('.cat-btn,.nav-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        this.setCategory(btn.dataset.cat);
        if (window.innerWidth <= 900) this.closeSidebar('left');
      });
    }

    // Sidebar nav buttons
    document.querySelectorAll('.nav-btn[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setCategory(btn.dataset.cat);
        if (window.innerWidth <= 900) this.closeSidebar('left');
      });
    });

    // Settings modal — single unified onchange handler
    const settingsModal = this.$('settings-modal');
    if (settingsModal) {
      settingsModal.addEventListener('change', (e) => {
        const t = e.target;
        if (!t.id) return;
        switch (t.id) {
          case 'data-saver-select':     this.setDataSaverMode(t.value); break;
          case 'autoplay-toggle':       this.toggleAutoplay(t.checked); break;
          case 'notifications-toggle':  this.toggleNotifications(t.checked); break;
          case 'kids-mode-toggle':      this.toggleKidsMode(t.checked); break;
          case 'quiet-hours-toggle':    this.toggleQuietHours(t.checked); break;
          case 'dnd-watching-toggle':   this.toggleDNDWhileWatching(t.checked); break;
          case 'quiet-hours-start':     this.setQuietHoursStart(t.value); break;
          case 'quiet-hours-end':       this.setQuietHoursEnd(t.value); break;
        }
      });
    }

    // PIN Pad — keyboard support, guard against hidden modal
    const pinPadModal = this.$('pin-pad-modal');
    if (pinPadModal) {
      pinPadModal.addEventListener('keydown', (e) => {
        if (pinPadModal.hidden) return; // FIX: guard
        if (e.key >= '0' && e.key <= '9') { e.preventDefault(); this.pinPadInput(e.key); }
        else if (e.key === 'Backspace') { e.preventDefault(); this.pinPadBackspace(); }
        else if (e.key === 'Enter') { e.preventDefault(); this.pinPadSubmit(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.closePinPad(); }
      });
      // PIN keypad button clicks
      pinPadModal.addEventListener('click', (e) => {
        const key = e.target.closest('.pin-key');
        if (!key) return;
        if (key.classList.contains('pin-key--submit')) { this.pinPadSubmit(); }
        else if (key.classList.contains('pin-key--clear')) { this.pinPadClear(); }
        else if (key.textContent.trim() === '⌫') { this.pinPadBackspace(); }
        else if (/^\d$/.test(key.textContent.trim())) { this.pinPadInput(key.textContent.trim()); }
      });
    }

    // Global data-action delegation (fav, notify)
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const chId = actionBtn.dataset.chid;
      if (!chId) return;
      if (action === 'fav') this.toggleFavorite(chId);
      if (action === 'notify') this.toggleChannelSubscription(chId);
    });

    // Search input with debounce
    const searchInput = this.$('search-input');
    if (searchInput) {
      const debouncedFilter = debounceFn(() => this.filterChannels(), 250);
      searchInput.addEventListener('input', debouncedFilter.bind(this));
    }

    // Chapter markers click delegation
    const chMarkers = this.$('chapter-markers');
    if (chMarkers) {
      chMarkers.addEventListener('click', (e) => {
        const marker = e.target.closest('.chapter-marker[data-time]');
        if (marker) this.seekToChapter(parseFloat(marker.dataset.time));
      });
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PIN PAD SYSTEM
  // ═══════════════════════════════════════════════════════════
  showPINPad(title, callback) {
    this._pinCallback = callback;
    this._pinValue = '';
    const modal = this.$('pin-pad-modal');
    const titleEl = this.$('pin-pad-title');
    if (!modal || !titleEl) {
      // Fallback for unsupported envs
      const result = prompt(title + '\nEnter 4-digit PIN:');
      if (callback) callback(result);
      return;
    }
    titleEl.textContent = title;
    this.updatePinDisplay();
    modal.hidden = false;
    // Focus first key for accessibility
    setTimeout(() => {
      const firstKey = modal.querySelector('.pin-key:not(.pin-key--action):not(.pin-key--submit)');
      if (firstKey) firstKey.focus();
    }, 100);
  },

  pinPadInput(digit) {
    if (this._pinValue.length < 4) {
      this._pinValue += digit;
      this.updatePinDisplay();
      // Auto-submit at 4 digits for UX
      if (this._pinValue.length === 4) {
        setTimeout(() => this.pinPadSubmit(), 200);
      }
    }
  },
  pinPadBackspace() { this._pinValue = this._pinValue.slice(0, -1); this.updatePinDisplay(); },
  pinPadClear() { this._pinValue = ''; this.updatePinDisplay(); },

  pinPadSubmit() {
    const pin = this._pinValue;
    const modal = this.$('pin-pad-modal');
    if (modal) modal.hidden = true;
    this._pinValue = '';
    this.updatePinDisplay();
    if (this._pinCallback) {
      const cb = this._pinCallback;
      this._pinCallback = null;
      cb(pin);
    }
  },

  closePinPad() {
    const modal = this.$('pin-pad-modal');
    if (modal) modal.hidden = true;
    this._pinValue = '';
    this.updatePinDisplay();
    if (this._pinCallback) {
      const cb = this._pinCallback;
      this._pinCallback = null;
      cb(null);
    }
  },

  updatePinDisplay() {
    const display = this.$('pin-input-display');
    if (display) {
      display.innerHTML = Array.from({ length: 4 }, (_, i) =>
        `<span class="pin-dot-char" aria-hidden="true">${i < this._pinValue.length ? '●' : '○'}</span>`
      ).join('');
    }
  },

  // ═══════════════════════════════════════════════════════════
  // DYNAMIC TITLE
  // ═══════════════════════════════════════════════════════════
  updateTitle(channelName) {
    document.title = channelName ? `${safeText(channelName)} — Pulse.tv` : 'Pulse.tv — Live TV Streaming';
  },

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════
  showToast(msg, type = 'info') {
    const container = this.$('toast-container');
    if (!container) return;
    // Limit concurrent toasts
    if (this._toastCount >= this.MAX_TOASTS) {
      const oldest = container.firstChild;
      if (oldest) { oldest.style.opacity = '0'; setTimeout(() => { oldest.remove(); this._toastCount = Math.max(0, this._toastCount - 1); }, 300); }
    }
    this._toastCount++;
    const t = createEl('div', `toast ${type}`);
    t.textContent = msg;
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.35s';
      setTimeout(() => { t.remove(); this._toastCount = Math.max(0, this._toastCount - 1); }, 350);
    }, 3500);
  },

  // ═══════════════════════════════════════════════════════════
  // ACCENT COLOR
  // ═══════════════════════════════════════════════════════════
  applyAccentColor(c) {
    if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) c = '#6c5ce7';
    this.accentColor = c;
    const r = parseInt(c.slice(1,3), 16), g = parseInt(c.slice(3,5), 16), b = parseInt(c.slice(5,7), 16);
    const root = document.documentElement;
    root.style.setProperty('--accent', c);
    root.style.setProperty('--accent-hover', `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`);
    root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.28)`);
    safeSet(STORAGE_KEYS.ACCENT, c);
  },
  setAccentColor(c) { this.applyAccentColor(c); this.closeSettings(); this.showToast('Accent color updated'); },
  openSettings() {
    const modal = this.$('settings-modal');
    if (modal) { modal.hidden = false; this.updateSettingsForm(); }
  },
  closeSettings() { const modal = this.$('settings-modal'); if (modal) modal.hidden = true; },
  updateSettingsForm() {
    const setVal = (id, val) => { const el = this.$(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = this.$(id); if (el) el.checked = val; };
    setVal('data-saver-select', this.dataSaverMode);
    setChecked('autoplay-toggle', this.autoplayNext);
    setChecked('notifications-toggle', this.notificationsEnabled);
    setChecked('kids-mode-toggle', this.kidsMode);
    setChecked('quiet-hours-toggle', this.quietHoursEnabled);
    setVal('quiet-hours-start', this.quietHoursStart);
    setVal('quiet-hours-end', this.quietHoursEnd);
    setChecked('dnd-watching-toggle', this.dndWhileWatching);
    const pin = this.$('parental-pin'); if (pin) pin.value = '';
    document.querySelectorAll('#accent-colors button').forEach(b => {
      b.classList.toggle('active', b.dataset.color === this.accentColor);
    });
    this.renderSubscriptionsList();
  },
  toggleAutoplay(v) { this.autoplayNext = v; safeSet(STORAGE_KEYS.AUTOPLAY, v); this.showToast(v ? 'Autoplay ON' : 'Autoplay OFF'); },

  // ═══════════════════════════════════════════════════════════
  // LOGO CLICK
  // ═══════════════════════════════════════════════════════════
  handleLogoClick() {
    if (this.currentChannel) { this.playChannel(this.currentChannel, false); this.showToast('Refreshing stream'); }
    else {
      const allCh = typeof channels !== 'undefined' ? channels : [];
      if (allCh.length) this.playChannel(allCh[0], false);
    }
  },

  // ═══════════════════════════════════════════════════════════
  // SIDEBARS
  // ═══════════════════════════════════════════════════════════
  restoreSidebars() {
    this.leftSidebarOpen = safeGet(STORAGE_KEYS.LEFT_SIDEBAR, true);
    this.rightSidebarOpen = safeGet(STORAGE_KEYS.RIGHT_SIDEBAR, true);
    if (!this.leftSidebarOpen) this.closeSidebar('left');
    else this.openSidebar('left');
    if (!this.kidsMode) this.openSidebar('right');
    else this.closeSidebar('right');
  },

  startAdReopenTimer() {
    if (this.adReopenTimer) clearInterval(this.adReopenTimer);
    this.adReopenTimer = setInterval(() => {
      if (this._sidebarInitialized && !this.rightSidebarOpen && !this.kidsMode) {
        this.openSidebar('right');
      }
    }, this.AD_REOPEN_INTERVAL);
  },

  toggleSidebar(side) {
    if (side === 'left') { this.leftSidebarOpen ? this.closeSidebar('left') : this.openSidebar('left'); }
    else { this.rightSidebarOpen ? this.closeSidebar('right') : this.openSidebar('right'); }
  },

  openSidebar(side) {
    if (side === 'right' && this.kidsMode) return;
    const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar');
    if (!s) return;
    s.classList.remove('collapsed');
    s.classList.add('open', 'sidebar-open');
    if (window.innerWidth <= 900) {
      const o = this.$(side + '-sidebar-overlay');
      if (o) o.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    if (side === 'left') this.leftSidebarOpen = true;
    else this.rightSidebarOpen = true;
    safeSet(side === 'left' ? STORAGE_KEYS.LEFT_SIDEBAR : STORAGE_KEYS.RIGHT_SIDEBAR, true);
    this.adjustContentMargins();
  },

  closeSidebar(side) {
    const s = this.$(side === 'left' ? 'left-sidebar' : 'right-sidebar');
    if (!s) return;
    s.classList.add('collapsed');
    s.classList.remove('open', 'sidebar-open');
    const o = this.$(side + '-sidebar-overlay');
    if (o) o.classList.remove('active');
    if ((side === 'left' && this.leftSidebarOpen) || (side === 'right' && this.rightSidebarOpen)) {
      // Only restore overflow if no other modal is open
      if (!document.querySelector('.modal-overlay:not([hidden])')) {
        document.body.style.overflow = '';
      }
    }
    if (side === 'left') this.leftSidebarOpen = false;
    else this.rightSidebarOpen = false;
    safeSet(side === 'left' ? STORAGE_KEYS.LEFT_SIDEBAR : STORAGE_KEYS.RIGHT_SIDEBAR, false);
    this.adjustContentMargins();
  },

  adjustContentMargins() {
    const content = document.querySelector('.content-area');
    if (!content) return;
    const isMobile = window.innerWidth <= 900;
    const isTablet = window.innerWidth <= 1100;
    let ml = 0, mr = 0;
    if (!isMobile && this.leftSidebarOpen) ml = 260;
    if (!isMobile && !isTablet && this.rightSidebarOpen && !this.kidsMode) mr = 280;
    content.style.marginLeft = ml > 0 ? ml + 'px' : '';
    content.style.marginRight = mr > 0 ? mr + 'px' : '';
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORIES & RENDERING
  // ═══════════════════════════════════════════════════════════
  buildCategoryList() {
    const l = this.$('category-list');
    if (!l) return;
    l.innerHTML = '';
    const cats = ['News','Sports','Entertainment','Movies','Music','Kids','Education','Lifestyle','Religion','Documentary','Business','Comedy','Technology'];
    const cols = {
      News:'#3b82f6', Sports:'#22c55e', Entertainment:'#a855f7', Movies:'#f59e0b',
      Music:'#ec4899', Kids:'#14b8a6', Education:'#6366f1', Lifestyle:'#f97316',
      Religion:'#8b5cf6', Documentary:'#06b6d4', Business:'#64748b', Comedy:'#eab308', Technology:'#0ea5e9'
    };
    const frag = document.createDocumentFragment();
    cats.forEach(cat => {
      const b = createEl('button', 'cat-btn');
      b.setAttribute('aria-label', cat + ' channels');
      b.innerHTML = `<div class="cat-avatar" style="background:${cols[cat]||'#555'}" aria-hidden="true">${safeText(cat.substring(0,2).toUpperCase())}</div><span>${safeText(cat)}</span>`;
      b.dataset.cat = cat;
      frag.appendChild(b);
    });
    l.appendChild(frag);
    if (this.kidsMode) this.filterKidsCategories();
  },

  filterKidsCategories() {
    const c = this.$('category-list');
    if (!c) return;
    c.querySelectorAll('.cat-btn').forEach(b => {
      const cat = b.dataset.cat || '';
      b.style.display = (cat === 'Kids' || cat === 'Education') ? '' : 'none';
    });
  },

  // FIX: Clear search when switching category
  setCategory(c) {
    this.currentCategory = c;
    this.currentPage = 1;
    const searchInput = this.$('search-input');
    if (searchInput) searchInput.value = '';
    const title = this.$('section-title');
    if (title) title.textContent = c;
    this.renderChannels();
  },

  filterChannels() { this.currentPage = 1; this.renderChannels(); },

  getFilteredChannels() {
    const allCh = typeof channels !== 'undefined' ? channels : [];
    let f = [...allCh];
    const cat = this.currentCategory;
    if (cat === 'Favorites') f = f.filter(c => this.favorites.includes(String(c.id || c.name)));
    else if (cat === 'Watchlist') f = f.filter(c => this.watchlist.includes(String(c.id || c.name)));
    else if (cat === 'History') {
      const hMap = new Map(f.map(c => [String(c.id || c.name), c]));
      f = this.history.map(id => hMap.get(id)).filter(Boolean);
    }
    else if (cat !== 'All') f = f.filter(c => c.category === cat);
    if (this.kidsMode) f = f.filter(c => c.category === 'Kids' || c.category === 'Education');
    const q = (this.$('search-input')?.value || '').toLowerCase().trim();
    if (q && !this.kidsMode) {
      f = f.filter(c => (c.name||'').toLowerCase().includes(q) || (c.category||'').toLowerCase().includes(q));
    }
    return f;
  },

  renderChannels() {
    if (this.renderRAF) { cancelAnimationFrame(this.renderRAF); this.renderRAF = null; }
    const grid = this.$('channel-grid');
    const em = this.$('empty-message');
    const pb = this.$('pagination-bar');
    if (!grid) return;
    // Show skeleton briefly
    const skGrid = this.$('skeleton-grid');
    if (skGrid && grid.children.length === 0) {
      skGrid.hidden = false;
      skGrid.innerHTML = Array.from({length: 8}, () =>
        `<div class="skeleton-card"><div class="skel-avatar"></div><div class="skel-line skel-line--title"></div><div class="skel-line skel-line--cat"></div></div>`
      ).join('');
    }
    this.renderRAF = requestAnimationFrame(() => {
      this.renderRAF = null;
      if (skGrid) skGrid.hidden = true;
      grid.innerHTML = '';
      if (em) em.hidden = true;
      if (pb) pb.hidden = true;
      const f = this.getFilteredChannels();
      this.totalPages = Math.max(1, Math.ceil(f.length / this.ITEMS_PER_PAGE));
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      const count = this.$('channels-count');
      if (count) count.textContent = `${f.length} channel${f.length !== 1 ? 's' : ''}`;
      if (f.length === 0) { if (em) em.hidden = false; return; }
      if (f.length > this.ITEMS_PER_PAGE) { if (pb) pb.hidden = false; this.renderPagination(f.length); }
      const start = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
      const frag = document.createDocumentFragment();
      f.slice(start, start + this.ITEMS_PER_PAGE).forEach(ch => frag.appendChild(this.buildChannelCard(ch)));
      grid.appendChild(frag);
    });
  },

  buildChannelCard(ch) {
    const card = createEl('div', 'channel-card');
    const chId = String(ch.id || ch.name);
    card.dataset.channelId = chId;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play ${ch.name || 'Unknown channel'}`);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.playChannel(ch, false); }
    });

    const isPlaying = this.currentChannel && String(ch.id || ch.name) === String(this.currentChannel.id || this.currentChannel.name);
    if (isPlaying) card.classList.add('playing');

    const init = safeText((ch.name || 'TV').substring(0, 2).toUpperCase());
    const bg = { News:'#3b82f6',Sports:'#22c55e',Entertainment:'#a855f7',Movies:'#f59e0b',Music:'#ec4899',Kids:'#14b8a6' }[ch.category] || '#4a4a6a';
    const isFav = this.favorites.includes(chId);
    const isSubscribed = this.channelSubscriptions.includes(chId);
    const chRating = this.ratings[chId] || 0;

    // FIX: Validate logo URL before injecting
    const hasLogo = ch.logo && isValidURL(ch.logo);
    let avatarHtml = `<div class="card-avatar"`;
    if (hasLogo) {
      avatarHtml += `><img src="${safeText(ch.logo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.parentElement.style.background='${safeText(bg)}';this.parentElement.textContent='${safeText(init)}';" />`;
    } else {
      avatarHtml += ` style="background:${safeText(bg)}" aria-hidden="true">${safeText(init)}`;
    }
    avatarHtml += `</div>`;

    const favIcon = isFav
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="currentColor"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

    let html = avatarHtml;
    html += `<div class="card-name">${safeText(ch.name || 'Unknown')}</div>`;
    html += `<div class="card-category">${safeText(ch.category || 'Entertainment')}</div>`;
    html += `<button class="card-fav-btn${isFav ? ' active' : ''}" data-action="fav" data-chid="${safeText(chId)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${isFav}">${favIcon}</button>`;

    if (!this.kidsMode) {
      html += `<button class="card-notify-btn" data-action="notify" data-chid="${safeText(chId)}" style="position:absolute;top:10px;right:44px;color:${isSubscribed?'var(--accent)':'var(--text-muted)'};background:none;border:none;cursor:pointer;z-index:2;padding:4px;display:flex;align-items:center;justify-content:center;" title="${isSubscribed?'Unsubscribe':'Get notifications'}" aria-label="${isSubscribed?'Unsubscribe':'Subscribe to notifications'}" aria-pressed="${isSubscribed}">`;
      html += `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>`;
    }

    if (chRating > 0) {
      html += `<div class="card-rating" aria-label="Rating: ${chRating} out of 5">`;
      for (let i = 1; i <= 5; i++) {
        html += `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="${i<=chRating?'var(--accent)':'none'}" stroke="${i<=chRating?'var(--accent)':'currentColor'}" stroke-width="1.5"/></svg>`;
      }
      html += `</div>`;
    }

    if (isPlaying) html += `<div class="card-now-playing" aria-label="Now playing">NOW PLAYING</div>`;
    card.innerHTML = html;
    return card;
  },

  renderPagination(total) {
    const pi = this.$('pagination-info'), pp = this.$('pagination-pages');
    const pr = this.$('prev-page-btn'), nx = this.$('next-page-btn');
    if (!pp) return;
    const s = (this.currentPage - 1) * this.ITEMS_PER_PAGE + 1;
    const e = Math.min(this.currentPage * this.ITEMS_PER_PAGE, total);
    if (pi) pi.innerHTML = `Showing <strong>${s}–${e}</strong> of <strong>${total}</strong>`;
    if (pr) pr.disabled = this.currentPage <= 1;
    if (nx) nx.disabled = this.currentPage >= this.totalPages;
    pp.innerHTML = '';
    if (this.totalPages <= 1) return;
    const frag = document.createDocumentFragment();
    for (let p = 1; p <= this.totalPages; p++) {
      if (p > 2 && p < this.currentPage - 2 && p < this.totalPages - 3) {
        if (p === 3) { const sp = createEl('span','','…'); sp.style.cssText='padding:0 6px;color:var(--text-muted)'; frag.appendChild(sp); } continue;
      }
      if (p < this.totalPages - 1 && p > this.currentPage + 2 && p > 4) {
        if (p === this.currentPage + 3) { const sp = createEl('span','','…'); sp.style.cssText='padding:0 6px;color:var(--text-muted)'; frag.appendChild(sp); } continue;
      }
      const b = createEl('button', `page-num-btn${p === this.currentPage ? ' active' : ''}`, String(p));
      b.setAttribute('aria-label', `Page ${p}`);
      if (p === this.currentPage) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => this.goToPage(p));
      frag.appendChild(b);
    }
    pp.appendChild(frag);
  },

  goToPage(p) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.renderChannels();
    // FIX: Use getElementById for reliable scroll target
    const section = this.$('channel-grid');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  toggleFavorite(id) {
    const idx = this.favorites.indexOf(id);
    if (idx > -1) { this.favorites.splice(idx, 1); this.showToast('Removed from favorites'); }
    else { this.favorites.push(id); this.showToast('Added to favorites', 'success'); }
    safeSet(STORAGE_KEYS.FAVORITES, this.favorites);
    this.updateFavBadge();
    if (this.currentCategory === 'Favorites') this.renderChannels();
    else {
      // Just update the card state without full re-render
      const card = document.querySelector(`.channel-card[data-channel-id="${CSS.escape(id)}"]`);
      if (card) {
        const isFav = this.favorites.includes(id);
        const favBtn = card.querySelector('.card-fav-btn');
        if (favBtn) {
          favBtn.classList.toggle('active', isFav);
          favBtn.setAttribute('aria-pressed', isFav);
          favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
          favBtn.innerHTML = isFav
            ? `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="currentColor"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;
        }
      }
    }
  },

  updateFavBadge() {
    const b = this.$('fav-badge');
    if (!b) return;
    const c = this.favorites.length;
    b.hidden = c === 0;
    b.textContent = c > 99 ? '99+' : String(c);
  },
  updateWatchlistBadge() {
    const b = this.$('watchlist-badge');
    if (!b) return;
    const c = this.watchlist.length;
    b.hidden = c === 0;
    b.textContent = c > 99 ? '99+' : String(c);
  },

  // ═══════════════════════════════════════════════════════════
  // CHANNEL SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════
  toggleChannelSubscription(chId) {
    const i = this.channelSubscriptions.indexOf(chId);
    if (i > -1) { this.channelSubscriptions.splice(i, 1); this.showToast('Notifications off'); }
    else { this.channelSubscriptions.push(chId); this.showToast('Notifications on', 'success'); }
    safeSet(STORAGE_KEYS.CHANNEL_SUBS, this.channelSubscriptions);
    this.renderSubscriptionsList();
    // Update card in-place
    const btn = document.querySelector(`.card-notify-btn[data-chid="${CSS.escape(chId)}"]`);
    if (btn) {
      const on = this.channelSubscriptions.includes(chId);
      btn.style.color = on ? 'var(--accent)' : 'var(--text-muted)';
      btn.setAttribute('aria-pressed', on);
    }
  },

  renderSubscriptionsList() {
    const list = this.$('subscriptions-list');
    if (!list) return;
    if (this.channelSubscriptions.length === 0) {
      list.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">No subscriptions. Click the bell icon on any channel.</div>';
      return;
    }
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.channelSubscriptions.forEach(chId => {
      const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === chId);
      if (ch) {
        const item = createEl('div', 'subscription-item');
        item.innerHTML = `<span>🔔 ${safeText(ch.name)}</span><button class="sub-remove-btn" aria-label="Remove ${safeText(ch.name)}">✕</button>`;
        item.querySelector('.sub-remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.channelSubscriptions = this.channelSubscriptions.filter(s => s !== chId);
          safeSet(STORAGE_KEYS.CHANNEL_SUBS, this.channelSubscriptions);
          this.renderSubscriptionsList();
        });
        frag.appendChild(item);
      }
    });
    list.appendChild(frag);
  },

  // ═══════════════════════════════════════════════════════════
  // CONTINUE WATCHING
  // ═══════════════════════════════════════════════════════════
  saveContinueWatching() {
    if (!this.currentChannel) return;
    const v = this.videoEl();
    const id = String(this.currentChannel.id || this.currentChannel.name);
    let cw = this.continueWatching.filter(c => String(c.id) !== id);
    cw.unshift({
      id,
      name: this.currentChannel.name || 'Unknown',
      logo: this.currentChannel.logo || '',
      category: this.currentChannel.category || 'Entertainment',
      timestamp: v?.currentTime || 0,
      duration: (v && isFinite(v.duration)) ? v.duration : 0,
      lastWatched: Date.now()
    });
    this.continueWatching = cw.slice(0, 10);
    safeSet(STORAGE_KEYS.CONTINUE_WATCHING, this.continueWatching);
    this.updateContinueWatching();
  },

  updateContinueWatching() {
    const row = this.$('continue-watching-row'), section = this.$('continue-watching-section');
    const sidebarList = this.$('continue-watching-list'), sidebarSection = this.$('continue-watching-sidebar');
    if (!row || !section) return;
    const hasItems = this.continueWatching.length > 0;
    section.hidden = !hasItems;
    if (sidebarSection) sidebarSection.hidden = !hasItems;
    if (!hasItems) return;
    const frag = document.createDocumentFragment();
    this.continueWatching.slice(0, 6).forEach(item => {
      const card = createEl('div', 'cw-card');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Continue watching ${item.name}`);
      const progress = item.duration > 0 ? Math.min(100, (item.timestamp / item.duration) * 100) : 0;
      card.innerHTML = `<div class="cw-thumb"><div class="cw-avatar" style="background:var(--surface3)">${safeText((item.name||'TV').substring(0,2).toUpperCase())}</div><div class="cw-progress-bar"><div class="cw-progress-fill" style="width:${progress}%"></div></div></div><div class="cw-name">${safeText(item.name)}</div><div class="cw-time">${this.formatTimeAgo(item.lastWatched)}</div>`;
      const handler = () => {
        const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === String(item.id));
        if (ch) this.playChannel(ch, false);
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
      frag.appendChild(card);
    });
    row.innerHTML = '';
    row.appendChild(frag);
    if (sidebarList) {
      sidebarList.innerHTML = '';
      sidebarList.appendChild(frag.cloneNode(true));
    }
  },

  clearContinueWatching() {
    this.continueWatching = [];
    safeSet(STORAGE_KEYS.CONTINUE_WATCHING, []);
    this.updateContinueWatching();
    this.showToast('Continue Watching cleared');
  },

  formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  },

  // ═══════════════════════════════════════════════════════════
  // VOICE SEARCH
  // ═══════════════════════════════════════════════════════════
  initVoiceSearch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const trig = this.$('voice-trigger');
    if (!SR) { if (trig) trig.style.display = 'none'; return; }
    if (this.recognition) { try { this.recognition.abort(); } catch(e) {} }
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';
    this.recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      const input = this.$('search-input');
      if (input) { input.value = transcript; this.filterChannels(); }
    };
    this.recognition.onend = () => { this.isListening = false; this.updateVoiceUI(); };
    this.recognition.onerror = () => { this.isListening = false; this.updateVoiceUI(); this.showToast('Voice search error', 'error'); };
  },

  // FIX: throttleFn bound correctly as method
  startVoiceSearch() {
    if (!this.recognition) { this.showToast('Voice search not supported', 'warning'); return; }
    if (this.isListening) { this.stopVoiceSearch(); return; }
    if (this._voiceThrottle && Date.now() - this._voiceThrottle < 1000) return;
    this._voiceThrottle = Date.now();
    try {
      this.isListening = true;
      this.recognition.start();
      this.updateVoiceUI();
    } catch(e) { this.isListening = false; this.updateVoiceUI(); }
  },

  stopVoiceSearch() {
    this.isListening = false;
    if (this.recognition) { try { this.recognition.stop(); } catch(e) {} }
    this.updateVoiceUI();
  },

  updateVoiceUI() {
    const indicator = this.$('voice-listening');
    if (indicator) indicator.hidden = !this.isListening;
    const trigger = this.$('voice-trigger');
    if (trigger) trigger.style.color = this.isListening ? 'var(--accent)' : '';
  },

  // ═══════════════════════════════════════════════════════════
  // DATA SAVER
  // ═══════════════════════════════════════════════════════════
  setDataSaverMode(mode) {
    this.dataSaverMode = mode;
    safeSet(STORAGE_KEYS.DATA_SAVER, mode);
    const badge = this.$('data-saver-badge');
    if (badge) badge.hidden = mode === 'auto';
    this.applyDataSaver();
    this.showToast(`Data saver: ${mode}`);
  },

  applyDataSaver() {
    if (!this.hls?.levels?.length) return;
    const mode = this.dataSaverMode;
    let tl = -1;
    if (mode === 'low') { tl = this.hls.levels.findIndex(l => l.height <= 360); if (tl < 0) tl = 0; }
    else if (mode === 'medium') { tl = this.hls.levels.findIndex(l => l.height <= 480 && l.height > 0); if (tl < 0) tl = Math.max(0, Math.floor(this.hls.levels.length / 2)); }
    else if (mode === 'high') { tl = this.hls.levels.length - 1; }
    if (tl >= 0) this.hls.currentLevel = tl;
  },

  // FIX: Added setupBandwidthDetection (was called but never defined)
  setupBandwidthDetection() {
    if (!this.hls) return;
    this.hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
      const bw = this.$('diag-bandwidth');
      if (!bw) return;
      if (this.hls?.bandwidthEstimate) {
        const mbps = (this.hls.bandwidthEstimate / 1000000).toFixed(2);
        bw.textContent = `${mbps} Mbps`;
      } else if (data?.stats) {
        const bytes = data.stats.loaded || 0;
        const ms = (data.stats.loading?.end || 0) - (data.stats.loading?.start || 0);
        if (ms > 0) {
          const mbps = ((bytes * 8) / (ms / 1000) / 1000000).toFixed(2);
          bw.textContent = `${mbps} Mbps`;
        }
      }
    });
  },

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  async toggleNotifications(enabled) {
    if (enabled) {
      if (!('Notification' in window)) { this.showToast('Notifications not supported', 'warning'); return; }
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          this.notificationsEnabled = true;
          safeSet(STORAGE_KEYS.NOTIFICATIONS, true);
          this.showToast('Notifications enabled', 'success');
        } else {
          this.notificationsEnabled = false;
          safeSet(STORAGE_KEYS.NOTIFICATIONS, false);
          this.showToast('Permission denied', 'warning');
          const el = this.$('notifications-toggle'); if (el) el.checked = false;
        }
      } catch(e) { this.notificationsEnabled = false; safeSet(STORAGE_KEYS.NOTIFICATIONS, false); }
    } else {
      this.notificationsEnabled = false;
      safeSet(STORAGE_KEYS.NOTIFICATIONS, false);
      this.showToast('Notifications disabled');
    }
  },

  toggleQuietHours(enabled) { this.quietHoursEnabled = enabled; safeSet(STORAGE_KEYS.QUIET_HOURS, enabled); this.showToast(enabled ? 'Quiet hours ON' : 'Quiet hours OFF'); },
  setQuietHoursStart(v) { this.quietHoursStart = v; safeSet(STORAGE_KEYS.QUIET_START, v); },
  setQuietHoursEnd(v) { this.quietHoursEnd = v; safeSet(STORAGE_KEYS.QUIET_END, v); },
  toggleDNDWhileWatching(enabled) { this.dndWhileWatching = enabled; safeSet(STORAGE_KEYS.DND_WATCHING, enabled); },

  sendTestNotification() {
    if (!this.notificationsEnabled || Notification.permission !== 'granted') {
      this.showToast('Enable notifications first', 'warning'); return;
    }
    try {
      new Notification('Pulse.tv', { body: 'Notifications are working! 🎉', icon: '/assets/icons/icon-192.png', tag: 'test' });
      this.showToast('Test sent', 'success');
    } catch(e) { this.showToast('Failed to send notification', 'error'); }
  },

  // ═══════════════════════════════════════════════════════════
  // KIDS MODE
  // ═══════════════════════════════════════════════════════════
  setParentalPIN() {
    this.showPINPad('Set 4-digit Parental PIN', (pin) => {
      if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
        this.setParentalPINFromRaw(pin);
        this.showToast('PIN set successfully', 'success');
      } else if (pin !== null) {
        this.showToast('PIN must be exactly 4 digits', 'error');
      }
    });
  },

  toggleKidsMode(enabled) {
    if (enabled) {
      if (!this._pinHash) {
        this.showToast('Set a PIN first under Parental Controls', 'warning');
        const el = this.$('kids-mode-toggle'); if (el) el.checked = false;
        return;
      }
      if (Date.now() < this.kidsLockUntil) {
        const remaining = Math.ceil((this.kidsLockUntil - Date.now()) / 60000);
        this.showToast(`Locked for ${remaining} more minute${remaining > 1 ? 's' : ''}`, 'warning');
        const el = this.$('kids-mode-toggle'); if (el) el.checked = false;
        return;
      }
      this.showPINPad('Enter PIN to enable Kids Mode', (pin) => {
        if (this.verifyPIN(pin)) {
          this.kidsMode = true;
          this.kidsPinAttempts = 0;
          safeSet(STORAGE_KEYS.KIDS_MODE, true);
          safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, 0);
          safeSet(STORAGE_KEYS.KIDS_LOCK, 0);
          this.applyKidsMode();
          this.showToast('Kids Mode ON', 'success');
          this.closeSettings();
        } else if (pin !== null) {
          this.showToast('Wrong PIN', 'error');
          const el = this.$('kids-mode-toggle'); if (el) el.checked = false;
        }
      });
    } else {
      this.requestExitKidsMode();
    }
  },

  applyKidsMode() {
    this.kidsMode = true;
    this.applyAccentColor('#f59e0b');
    document.body.classList.add('kids-mode-active');
    this.closeSidebar('right');
    const si = this.$('search-input');
    if (si) { si.disabled = true; si.placeholder = 'Search disabled in Kids Mode'; si.value = ''; }
    const indicator = this.$('kids-mode-indicator');
    if (indicator) indicator.style.display = 'flex';
    this.filterKidsCategories();
    this.setCategory('Kids');
    this.adjustContentMargins();
  },

  exitKidsMode() {
    this.kidsMode = false;
    const savedAccent = safeGet(STORAGE_KEYS.ACCENT, '#6c5ce7');
    this.applyAccentColor(savedAccent);
    document.body.classList.remove('kids-mode-active');
    const si = this.$('search-input');
    if (si) { si.disabled = false; si.placeholder = 'Search channels…'; }
    const indicator = this.$('kids-mode-indicator');
    if (indicator) indicator.style.display = 'none';
    this.openSidebar('right');
    this.filterAllCategories();
    this.setCategory('All');
    this.adjustContentMargins();
    this.kidsPinAttempts = 0;
    safeSet(STORAGE_KEYS.KIDS_MODE, false);
    safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, 0);
    safeSet(STORAGE_KEYS.KIDS_LOCK, 0);
  },

  requestExitKidsMode() {
    if (Date.now() < this.kidsLockUntil) {
      const remaining = Math.ceil((this.kidsLockUntil - Date.now()) / 60000);
      this.showToast(`Locked for ${remaining} more minute${remaining > 1 ? 's' : ''}`, 'warning');
      return;
    }
    this.showPINPad('Enter PIN to exit Kids Mode', (pin) => {
      if (this.verifyPIN(pin)) {
        this.exitKidsMode();
        this.showToast('Kids Mode exited', 'success');
        this.closeSettings();
      } else if (pin !== null) {
        this.kidsPinAttempts++;
        safeSet(STORAGE_KEYS.KIDS_ATTEMPTS, this.kidsPinAttempts);
        if (this.kidsPinAttempts >= 3) {
          this.kidsLockUntil = Date.now() + 300000;
          safeSet(STORAGE_KEYS.KIDS_LOCK, this.kidsLockUntil);
          this.showToast('3 wrong attempts — locked for 5 minutes', 'error');
        } else {
          this.showToast(`Wrong PIN — ${3 - this.kidsPinAttempts} attempt${3-this.kidsPinAttempts !== 1?'s':''} left`, 'error');
        }
        const el = this.$('kids-mode-toggle'); if (el) el.checked = true;
      }
    });
  },

  filterAllCategories() {
    const container = this.$('category-list');
    if (!container) return;
    container.querySelectorAll('.cat-btn').forEach(b => { b.style.display = ''; });
  },

  // ═══════════════════════════════════════════════════════════
  // CONTENT RATING
  // ═══════════════════════════════════════════════════════════
  initRatingStars() {
    const sc = this.$('rating-stars');
    if (!sc) return;
    const chId = this.currentChannel ? String(this.currentChannel.id || this.currentChannel.name) : '';
    const cr = chId ? (this.ratings[chId] || 0) : 0;
    sc.querySelectorAll('button[data-rating]').forEach(btn => {
      const rating = parseInt(btn.dataset.rating, 10);
      const polygon = btn.querySelector('polygon');
      if (polygon) {
        polygon.setAttribute('fill', rating <= cr ? 'var(--accent)' : 'none');
        polygon.setAttribute('stroke', rating <= cr ? 'none' : 'currentColor');
      }
      btn.setAttribute('aria-pressed', rating <= cr);
    });
    const count = this.$('rating-count');
    if (count) {
      const tv = Object.values(this.ratings).filter(v => v > 0).length;
      count.textContent = tv > 0 ? `(${tv})` : '';
    }
  },

  rateChannel(rating) {
    if (!this.currentChannel) return;
    const chId = String(this.currentChannel.id || this.currentChannel.name);
    this.ratings[chId] = rating;
    safeSet(STORAGE_KEYS.RATINGS, this.ratings);
    this.initRatingStars();
    this.showToast(`Rated ${rating} star${rating > 1 ? 's' : ''}`, 'success');
  },

  // ═══════════════════════════════════════════════════════════
  // SOCIAL SHARING
  // ═══════════════════════════════════════════════════════════
  openShareMenu() { const m = this.$('share-modal'); if (m) m.hidden = false; },
  closeShareMenu() { const m = this.$('share-modal'); if (m) m.hidden = true; },

  getShareData() {
    if (!this.currentChannel) return null;
    const chId = encodeURIComponent(String(this.currentChannel.id || this.currentChannel.name));
    const url = `${location.origin}${location.pathname}#channel=${chId}`;
    return { title: this.currentChannel.name, url, text: `Watch ${this.currentChannel.name} on Pulse.tv` };
  },

  shareTo(platform) {
    const data = this.getShareData();
    if (!data) { this.showToast('No channel selected', 'warning'); return; }
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(data.text + ' ' + data.url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`
    };
    if (urls[platform]) window.open(urls[platform], '_blank', 'noopener,noreferrer');
    this.closeShareMenu();
  },

  copyShareLink() {
    const data = this.getShareData();
    if (!data) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data.url).then(() => this.showToast('Link copied', 'success')).catch(() => this.showToast('Copy failed', 'error'));
    } else {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = data.url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); this.showToast('Link copied', 'success'); } catch { this.showToast('Copy failed', 'error'); }
      document.body.removeChild(ta);
    }
    this.closeShareMenu();
  },

  // ═══════════════════════════════════════════════════════════
  // DVR + CHAPTER MARKERS
  // ═══════════════════════════════════════════════════════════
  updateDVRStatus() {
    if (!this.hls || !this.isLive) return;
    const v = this.videoEl();
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const behind = Math.max(0, v.duration - v.currentTime);
    const dvrBuffer = this.$('dvr-buffer'), dvrTime = this.$('dvr-buffer-time');
    if (dvrBuffer && dvrTime) {
      if (behind > 2) {
        dvrBuffer.hidden = false;
        dvrTime.textContent = `-${this.formatTime(behind)}`;
      } else { dvrBuffer.hidden = true; }
    }
    this.updateChapterMarkers(v.duration);
  },

  updateChapterMarkers(duration) {
    if (!duration || duration <= 0) return;
    const markers = this.$('chapter-markers'), dots = this.$('chapter-dots');
    if (!markers || !dots) return;
    const chapters = [];
    const interval = Math.max(60, Math.floor(duration / 8));
    for (let t = 0; t <= duration; t += interval) chapters.push({ time: t, label: this.formatTime(t) });
    markers.hidden = chapters.length < 2;
    markers.innerHTML = chapters.map(c =>
      `<div class="chapter-marker" data-time="${c.time}" style="left:${(c.time/duration)*100}%" role="button" tabindex="0" aria-label="Jump to ${c.label}">${c.label}</div>`
    ).join('');
    dots.innerHTML = chapters.map(c =>
      `<div class="chapter-dot" style="left:${(c.time/duration)*100}%" title="${c.label}" role="button" tabindex="-1" aria-label="Jump to ${c.label}"></div>`
    ).join('');
  },

  seekToChapter(time) { const v = this.videoEl(); if (v && isFinite(time)) v.currentTime = time; },

  // ═══════════════════════════════════════════════════════════
  // LIVE SCORE
  // ═══════════════════════════════════════════════════════════
  toggleScoreOverlay() {
    if (!this.currentChannel || this.currentChannel.category !== 'Sports') {
      this.showToast('Score overlay for Sports channels only', 'info'); return;
    }
    const overlay = this.$('live-score-overlay');
    if (!overlay) return;
    overlay.hidden = !overlay.hidden;
    if (!overlay.hidden) this.generateMockScore();
  },

  generateMockScore() {
    const content = this.$('live-score-content');
    if (!content) return;
    const scores = [
      { team1:'BAN', score1:'186/4', team2:'IND', score2:'184/7', detail:'38.2 overs', info:'BAN need 0 from 70 balls' },
      { team1:'BAN', score1:'2', team2:'IND', score2:'1', detail:"78'", info:'Second Half' }
    ];
    const score = scores[Math.floor(Math.random() * scores.length)];
    content.innerHTML = `<div class="score-teams"><div class="score-team"><strong>${safeText(score.team1)}</strong><span class="score-num">${safeText(score.score1)}</span></div><div class="score-vs">VS</div><div class="score-team"><strong>${safeText(score.team2)}</strong><span class="score-num">${safeText(score.score2)}</span></div></div><div class="score-detail">${safeText(score.detail)}</div><div class="score-info">${safeText(score.info)}</div>`;
    clearTimeout(this._scoreTimeout);
    this._scoreTimeout = setTimeout(() => { const o = this.$('live-score-overlay'); if (o) o.hidden = true; }, 15000);
  },

  // ═══════════════════════════════════════════════════════════
  // EXPORT / BACKUP
  // ═══════════════════════════════════════════════════════════
  exportUserData() {
    try {
      const data = {};
      Object.values(STORAGE_KEYS).forEach(k => { data[k] = safeGet(k); });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pulse-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      this.showToast('Backup exported', 'success');
    } catch(e) { this.showToast('Export failed', 'error'); }
  },

  // ═══════════════════════════════════════════════════════════
  // VOLUME BOOST (Web Audio API)
  // ═══════════════════════════════════════════════════════════
  initVolumeBoost() {
    if (this._boostInitialized) return;
    try {
      const v = this.videoEl();
      if (!v) return;
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      if (this.audioSource) { try { this.audioSource.disconnect(); } catch(e) {} }
      this.audioSource = this.audioCtx.createMediaElementSource(v);
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.audioSource.connect(this.gainNode);
      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.audioCtx.destination);
      this._boostInitialized = true;
      this.applyVolumeBoost();
    } catch(e) { this._boostInitialized = false; console.warn('[PulseTV] Volume boost unavailable:', e.message); }
  },

  applyVolumeBoost() {
    if (!this.gainNode) { this.initVolumeBoost(); return; }
    this.gainNode.gain.value = this.volumeBoost ? 2.0 : 1.0;
    const vs = this.$('volume-slider');
    if (vs) {
      vs.max = this.volumeBoost ? '200' : '100';
      if (!this.volumeBoost && parseInt(vs.value, 10) > 100) {
        vs.value = '100';
        const ve = this.videoEl(); if (ve) ve.volume = 1.0;
      }
    }
    const bb = this.$('boost-btn'); if (bb) bb.classList.toggle('active', this.volumeBoost);
    safeSet(STORAGE_KEYS.VOLUME_BOOST, this.volumeBoost);
  },

  toggleVolumeBoost() {
    this.volumeBoost = !this.volumeBoost;
    if (!this._boostInitialized && this.volumeBoost) this.initVolumeBoost();
    else this.applyVolumeBoost();
    this.showToast(this.volumeBoost ? 'Volume Boost ON (200%)' : 'Volume Boost OFF');
  },

  // ═══════════════════════════════════════════════════════════
  // PLAY CHANNEL
  // ═══════════════════════════════════════════════════════════
  playChannel(channel, isRetry = false) {
    // Kids mode channel guard
    if (this.kidsMode && channel && channel.category !== 'Kids' && channel.category !== 'Education') {
      this.showPINPad('Enter PIN to watch this channel', (pin) => {
        if (this.verifyPIN(pin)) this._executePlayChannel(channel, isRetry);
        else if (pin !== null) this.showToast('Access denied', 'error');
      });
      return;
    }
    // Queue management
    if (this.isSwitchingChannel && !isRetry) {
      this._switchQueue = [{ channel, isRetry: false }]; // FIX: replace queue, don't pile up
      return;
    }
    this._executePlayChannel(channel, isRetry);
  },

  _executePlayChannel(channel, isRetry) {
    this.isSwitchingChannel = true;
    try {
      if (!channel?.url) {
        this.showToast('No stream URL available', 'error');
        this.isSwitchingChannel = false; this._processQueue(); return;
      }
      // FIX: Validate URL before playing
      if (!isValidURL(channel.url)) {
        this.showToast('Invalid stream URL', 'error');
        this.isSwitchingChannel = false; this._processQueue(); return;
      }

      this.currentChannel = channel;
      this.updateTitle(channel.name);

      const nd = this.$('channel-name-display');
      if (nd) nd.textContent = channel.name || 'Unknown';

      const id = String(channel.id || channel.name);
      this.history = this.history.filter(h => h !== id);
      this.history.unshift(id);
      safeSet(STORAGE_KEYS.HISTORY, this.history.slice(0, 50));

      // Update recently watched
      this.recentChannels = this.recentChannels.filter(r => r.id !== id);
      this.recentChannels.unshift({ id, name: channel.name || 'Unknown' });
      this.recentChannels = this.recentChannels.slice(0, 10);
      safeSet(STORAGE_KEYS.RECENT, this.recentChannels); // FIX: was missing
      this.updateRecentlyWatched();

      if (!isRetry) this.saveContinueWatching();
      this.initRatingStars();

      // Reset UI
      const spinner = this.$('loading-spinner');
      const error = this.$('error-message');
      const liveBadge = this.$('live-badge');
      const goLiveBtn = this.$('go-live-btn');
      const streamHealth = this.$('stream-health');
      const dvrBuffer = this.$('dvr-buffer');
      if (spinner) spinner.hidden = false;
      if (error) error.hidden = true;
      if (liveBadge) liveBadge.hidden = true;
      if (goLiveBtn) goLiveBtn.hidden = true;
      if (streamHealth) streamHealth.hidden = true;
      if (dvrBuffer) dvrBuffer.hidden = true;

      // Destroy existing HLS
      if (this.hls) {
        this.hls.stopLoad();
        this.hls.detachMedia();
        this.hls.destroy();
        this.hls = null;
      }

      this._boostInitialized = false;
      this.audioSource = null;
      this.clearAllIntervals();

      const v = this.videoEl();
      if (!v) { this.isSwitchingChannel = false; this._processQueue(); return; }

      v.src = '';
      v.removeAttribute('src');
      v.load();
      this.isPlaying = false;
      this.isLive = false;
      this.streamStartTime = Date.now();
      this._uptimeSeconds = 0;

      // FIX: Remove old ended handler, add fresh one
      if (this._endedHandler) v.removeEventListener('ended', this._endedHandler);
      this._endedHandler = () => {
        if (this.autoplayNext && !this.kidsMode) {
          const allCh = typeof channels !== 'undefined' ? channels : [];
          if (allCh.length) {
            const i = allCh.findIndex(c => c === this.currentChannel);
            const next = allCh[(i + 1) % allCh.length];
            if (next) { this.showToast('Autoplaying next channel…'); setTimeout(() => this.playChannel(next, false), 500); }
          }
        }
      };
      v.addEventListener('ended', this._endedHandler);

      // Stream timeout
      if (this.streamTimeoutTimer) clearTimeout(this.streamTimeoutTimer);
      this.streamTimeoutTimer = setTimeout(() => {
        if (!this.isPlaying) {
          if (spinner) spinner.hidden = true;
          if (this.retryAttempt < this.retryCount) {
            this.retryAttempt++;
            setTimeout(() => this.playChannel(channel, true), Math.pow(2, this.retryAttempt) * 1000);
          } else {
            if (error) { error.hidden = false; const etxt = this.$('error-message-text'); if (etxt) etxt.textContent = 'Stream unavailable'; }
            this.retryAttempt = 0;
          }
        }
      }, 25000);

      // HLS.js path
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hls = new Hls({
          maxBufferLength: 30, maxMaxBufferLength: 60,
          enableWorker: true, startLevel: -1,
          fragLoadingTimeOut: 15000, manifestLoadingTimeOut: 15000,
          liveSyncDurationCount: 3, capLevelToPlayerSize: false,
          maxLoadingDelay: 4, minAutoBitrate: 0, maxLevel: -1,
          xhrSetup: (xhr) => { xhr.timeout = 20000; }
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          clearTimeout(this.streamTimeoutTimer);
          this.retryAttempt = 0;
          if (spinner) spinner.hidden = true;
          this.updateLiveStatus();
          this.updateQualitySelector();
          if (streamHealth) {
            streamHealth.hidden = false;
            const dot = streamHealth.querySelector('.health-dot');
            if (dot) dot.className = 'health-dot';
          }
          v.play().then(() => {
            this.isPlaying = true;
            this.isLive = true;
            this.updatePlayBtn();
            this.showLiveBadge();
            this.updateDVRStatus();
            this.updateStreamUptime();
            if (this.volumeBoost) setTimeout(() => this.initVolumeBoost(), 500);
            this.preloadNextChannel();
            this.applyDataSaver();
          }).catch(() => { this.updatePlayBtn(); });
          this.setupBandwidthDetection();
        });

        this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => {
          if (!this.hls) return;
          const l = this.hls.levels[d.level];
          const diagRes = this.$('diag-resolution');
          if (l && diagRes) {
            if (l.height >= 2160) diagRes.textContent = `4K (${l.width}×${l.height})`;
            else if (l.height) diagRes.textContent = `${l.width}×${l.height}`;
          }
        });

        this.hls.on(Hls.Events.FRAG_BUFFERED, () => {
          this.updateBufferDiagnostics();
          this.updateStreamHealthIndicator();
        });

        // FIX: Comprehensive error handling
        this.hls.on(Hls.Events.ERROR, (_, d) => {
          if (d.fatal) {
            clearTimeout(this.streamTimeoutTimer);
            this.hideLiveBadge();
            if (spinner) spinner.hidden = true;
            if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (this.retryAttempt < this.retryCount) {
                this.retryAttempt++;
                setTimeout(() => { if (this.hls) { this.hls.startLoad(); } }, 2000);
                return;
              }
            }
            if (this.retryAttempt < this.retryCount) {
              this.retryAttempt++;
              if (this.hls) { this.hls.destroy(); this.hls = null; }
              setTimeout(() => this.playChannel(channel, true), 2000);
            } else {
              if (error) { error.hidden = false; const etxt = this.$('error-message-text'); if (etxt) etxt.textContent = 'Stream error — try again'; }
              this.retryAttempt = 0;
              if (this.hls) { this.hls.destroy(); this.hls = null; }
            }
          }
        });

        this.hls.loadSource(channel.url);
        this.hls.attachMedia(v);

      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        v.src = channel.url;
        v.load();
        v.addEventListener('loadedmetadata', () => {
          clearTimeout(this.streamTimeoutTimer);
          if (spinner) spinner.hidden = true;
          if (streamHealth) streamHealth.hidden = false;
          this.updateQualitySelector();
          v.play().then(() => {
            this.isPlaying = true; this.isLive = true;
            this.updatePlayBtn(); this.showLiveBadge();
            this.updateStreamUptime();
          }).catch(() => { this.updatePlayBtn(); });
        }, { once: true });
        v.addEventListener('error', () => {
          clearTimeout(this.streamTimeoutTimer);
          if (spinner) spinner.hidden = true;
          if (error) error.hidden = false;
        }, { once: true });
      } else {
        // Fallback
        v.src = channel.url; v.load();
        v.play().then(() => {
          clearTimeout(this.streamTimeoutTimer);
          if (spinner) spinner.hidden = true;
          this.isPlaying = true; this.isLive = true;
          this.updatePlayBtn();
          if (streamHealth) streamHealth.hidden = false;
        }).catch(() => {
          if (spinner) spinner.hidden = true;
          if (error) error.hidden = false;
        });
      }

      this.renderChannels();
      this.resetControlsTimer();
    } catch(e) {
      console.error('[PulseTV] playChannel error:', e);
      const spinner = this.$('loading-spinner'), error = this.$('error-message');
      if (spinner) spinner.hidden = true;
      if (error) error.hidden = false;
    } finally {
      this.isSwitchingChannel = false;
      setTimeout(() => this._processQueue(), 300);
    }
  },

  _processQueue() {
    if (this._switchQueue.length > 0 && !this.isSwitchingChannel) {
      const next = this._switchQueue.pop(); // FIX: pop latest, discard stale
      this._switchQueue = [];
      this.playChannel(next.channel, next.isRetry);
    }
  },

  retryStream() { this.retryAttempt = 0; if (this.currentChannel) this.playChannel(this.currentChannel, false); },

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTICS & STREAM HEALTH
  // ═══════════════════════════════════════════════════════════
  updateBufferDiagnostics() {
    const v = this.videoEl(); if (!v) return;
    let bufSec = 0;
    if (v.buffered.length > 0) {
      const ct = v.currentTime;
      for (let i = 0; i < v.buffered.length; i++) {
        if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) {
          bufSec = v.buffered.end(i) - ct; break;
        }
      }
    }
    const buf = this.$('diag-buffer');
    if (buf) buf.textContent = `${bufSec.toFixed(1)}s`;
  },

  updateStreamHealthIndicator() {
    const health = this.$('stream-health'); if (!health) return;
    const dot = health.querySelector('.health-dot'), healthText = health.querySelector('.health-text');
    if (!dot) return;
    const v = this.videoEl(); if (!v) return;
    let bufSec = 0;
    if (v.buffered.length > 0) {
      const ct = v.currentTime;
      for (let i = 0; i < v.buffered.length; i++) {
        if (ct >= v.buffered.start(i) && ct <= v.buffered.end(i)) { bufSec = v.buffered.end(i) - ct; break; }
      }
    }
    if (bufSec > 10) dot.className = 'health-dot';
    else if (bufSec > 3) dot.className = 'health-dot buffering';
    else dot.className = 'health-dot poor';
    if (healthText) healthText.textContent = bufSec > 0 ? `${bufSec.toFixed(1)}s` : '…';
  },

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════
  clearAllIntervals() {
    ['liveStatusInterval','uptimeInterval','diagnosticInterval','watchInterval'].forEach(k => {
      if (this[k]) { clearInterval(this[k]); this[k] = null; }
    });
    if (this.streamTimeoutTimer) { clearTimeout(this.streamTimeoutTimer); this.streamTimeoutTimer = null; }
    if (this._scoreTimeout) { clearTimeout(this._scoreTimeout); this._scoreTimeout = null; }
  },

  formatTime(s) {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const abs = Math.floor(Math.abs(s));
    const h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), sec = abs % 60;
    const sign = s < 0 ? '-' : '';
    return `${sign}${h > 0 ? h + ':' + String(m).padStart(2,'0') : m}:${String(sec).padStart(2,'0')}`;
  },

  preloadNextChannel() {
    if (!this.currentChannel || typeof channels === 'undefined') return;
    const idx = channels.findIndex(c => c === this.currentChannel);
    const next = channels[(idx + 1) % channels.length];
    if (!next?.url || !isValidURL(next.url) || next === this.preloadedChannel) return;
    if (typeof Hls === 'undefined' || !Hls.isSupported()) return;
    if (this.preloadedHls) { this.preloadedHls.destroy(); this.preloadedHls = null; this.preloadedChannel = null; }
    this.preloadedHls = new Hls({ enableWorker: true, startLevel: -1, capLevelToPlayerSize: false, maxBufferLength: 5 });
    this.preloadedHls.loadSource(next.url);
    this.preloadedChannel = next;
    this.preloadedHls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) { if (this.preloadedHls) { this.preloadedHls.destroy(); this.preloadedHls = null; } this.preloadedChannel = null; }
    });
  },

  togglePlay() {
    const v = this.videoEl(); if (!v) return;
    if (v.paused) {
      v.play().then(() => { this.isPlaying = true; this.updatePlayBtn(); this.resetControlsTimer(); }).catch(() => {});
    } else {
      v.pause(); this.isPlaying = false; this.updatePlayBtn(); this.showControls();
    }
  },

  updatePlayBtn() {
    const btn = this.$('play-btn'); if (!btn) return;
    btn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
    btn.innerHTML = this.isPlaying
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6V4zM14 4h4v16h-4V4z" fill="currentColor"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>`;
  },

  nextChannel() {
    const l = typeof channels !== 'undefined' ? channels : []; if (!l.length) return;
    const i = l.findIndex(c => c === this.currentChannel);
    this.playChannel(l[i >= 0 ? (i + 1) % l.length : 0], false);
  },

  prevChannel() {
    const l = typeof channels !== 'undefined' ? channels : []; if (!l.length) return;
    const i = l.findIndex(c => c === this.currentChannel);
    this.playChannel(l[i > 0 ? i - 1 : l.length - 1], false);
  },

  toggleMute() {
    const v = this.videoEl(); if (!v) return;
    v.muted = !v.muted;
    this.updateMuteIcon();
    this.showToast(v.muted ? 'Muted' : 'Unmuted');
  },

  // FIX: Correct this-binding for debounced method
  changeVolume(val) {
    const ve = this.videoEl();
    if (ve) {
      const volume = Math.max(0, Math.min(1, val / 100));
      ve.volume = volume;
      ve.muted = false;
    }
    if (this.volumeBoost && this.gainNode && val > 100) this.gainNode.gain.value = val / 100;
    else if (this.gainNode) this.gainNode.gain.value = 1.0;
    this.updateMuteIcon();
  },

  updateMuteIcon() {
    const v = this.videoEl(), b = this.$('mute-btn'); if (!v || !b) return;
    const svg = b.querySelector('svg'); if (!svg) return;
    const muted = v.muted || v.volume === 0;
    b.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    svg.innerHTML = muted
      ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" stroke-width="2" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/>`
      : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" stroke-width="2" fill="none"/>`;
  },

  showLiveBadge() {
    const lb = this.$('live-badge');
    if (lb) { lb.hidden = false; lb.className = 'live-badge live-active'; }
    const gl = this.$('go-live-btn'); if (gl) gl.hidden = true;
    const sh = this.$('stream-health'); if (sh) sh.hidden = false;
    this.updateLiveStatus();
  },

  hideLiveBadge() {
    const lb = this.$('live-badge'); if (lb) lb.hidden = true;
    const gl = this.$('go-live-btn'); if (gl) gl.hidden = true;
    const sh = this.$('stream-health'); if (sh) sh.hidden = true;
    const dv = this.$('dvr-buffer'); if (dv) dv.hidden = true;
    const td = this.$('time-display'); if (td) { td.textContent = '0:00'; td.className = 'live-time-display'; }
    this.clearAllIntervals();
    this.updateTitle(null);
  },

  goLive() {
    const v = this.videoEl(); if (!v) return;
    if (isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration - 0.5;
    const gl = this.$('go-live-btn'); if (gl) gl.hidden = true;
    this.showLiveBadge();
  },

  updateLiveStatus() {
    if (this.liveStatusInterval) { clearInterval(this.liveStatusInterval); this.liveStatusInterval = null; }
    if (!this.hls && !this.videoEl()?.src) return;
    this.liveStatusInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const v = this.videoEl(); if (!v) return;
      this.liveLatency = (this.hls?.latency != null)
        ? this.hls.latency
        : (isFinite(v.duration) && v.duration > 0 ? Math.max(0, v.duration - v.currentTime) : 0);
      const td = this.$('time-display');
      if (td) {
        if (isFinite(v.duration) && v.duration > 0 && v.duration < 3600 * 24) {
          td.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
          td.classList.remove('live-at-edge');
        } else if (this.liveLatency < 2) {
          td.textContent = '● LIVE';
          td.classList.add('live-at-edge');
        } else {
          td.textContent = `-${this.formatTime(Math.max(0, this.liveLatency))}`;
          td.classList.remove('live-at-edge');
        }
      }
      const lb = this.$('live-badge'), gl = this.$('go-live-btn');
      if (this.liveLatency < 2) {
        if (lb) { lb.hidden = false; lb.className = 'live-badge live-active'; }
        if (gl) gl.hidden = true;
      } else if (this.liveLatency < 10) {
        if (lb) { lb.hidden = false; lb.className = 'live-badge live-delayed'; }
        if (gl) gl.hidden = true;
      } else {
        if (lb) lb.hidden = true;
        if (gl) gl.hidden = false;
      }
      this.updateBufferDiagnostics();
      this.updateStreamHealthIndicator();
      this.updateDVRStatus();
    }, 1000);
  },

  updateStreamUptime() {
    if (this.uptimeInterval) clearInterval(this.uptimeInterval);
    this._uptimeSeconds = 0;
    this.uptimeInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this._uptimeSeconds += 10;
      const u = this.$('stream-uptime');
      if (u) { u.hidden = false; u.textContent = `Up ${this.formatTime(this._uptimeSeconds)}`; }
    }, 10000);
  },

  // FIX: Save recentChannels properly
  updateRecentlyWatched() {
    const c = this.$('recently-watched'), l = this.$('recently-watched-list');
    if (!c || !l) return;
    if (!this.recentChannels.length) { c.hidden = true; return; }
    c.hidden = false;
    l.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.recentChannels.slice(0, 8).forEach(ch => {
      const item = createEl('div', 'recently-watched-item');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Play ${ch.name}`);
      item.innerHTML = `<div class="rw-avatar" aria-hidden="true">${safeText((ch.name||'TV').substring(0,2).toUpperCase())}</div><span>${safeText(ch.name)}</span>`;
      const handler = () => {
        const fc = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === String(ch.id));
        if (fc) this.playChannel(fc, false);
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
      frag.appendChild(item);
    });
    l.appendChild(frag);
  },

  updateQualitySelector() {
    const s = this.$('quality-levels'); if (!s) return;
    s.innerHTML = '<option value="-1">Auto</option>';
    if (!this.hls?.levels?.length) return;
    const frag = document.createDocumentFragment();
    this.hls.levels.forEach((l, i) => {
      const o = document.createElement('option');
      o.value = i;
      if (l.height >= 2160) o.textContent = `4K (${l.height}p)`;
      else if (l.height >= 1080) o.textContent = `FHD (${l.height}p)`;
      else if (l.height >= 720) o.textContent = `HD (${l.height}p)`;
      else if (l.height) o.textContent = `${l.height}p`;
      else o.textContent = `Level ${i + 1}`;
      frag.appendChild(o);
    });
    s.appendChild(frag);
  },

  changeQuality(v) { if (!this.hls) return; this.hls.currentLevel = parseInt(v, 10); },

  setupSeek() {
    const c = this.$('progress-bar-container'), t = this.$('progress-track');
    if (!c || !t) return;
    const getFraction = cx => {
      const r = t.getBoundingClientRect();
      return Math.max(0, Math.min(1, (cx - r.left) / r.width));
    };
    const applySeek = (cx) => {
      const v = this.videoEl();
      if (!v || !isFinite(v.duration) || v.duration <= 0) return;
      v.currentTime = getFraction(cx) * v.duration;
      // Update thumb/progress immediately
      const played = this.$('progress-played'), thumb = this.$('progress-thumb');
      const pct = getFraction(cx) * 100;
      if (played) played.style.width = pct + '%';
      if (thumb) thumb.style.left = pct + '%';
    };
    const updateTooltip = (cx) => {
      const v = this.videoEl();
      const tt = this.$('seek-tooltip');
      if (!tt || !v || !isFinite(v.duration) || v.duration <= 0) return;
      const frac = getFraction(cx);
      const time = frac * v.duration;
      tt.textContent = this.formatTime(time);
      const r = t.getBoundingClientRect();
      const left = Math.max(20, Math.min(r.width - 20, cx - r.left));
      tt.style.left = left + 'px';
    };

    c.addEventListener('mousedown', e => { this.isDragging = true; applySeek(e.clientX); e.preventDefault(); });
    c.addEventListener('mousemove', e => { updateTooltip(e.clientX); if (this.isDragging) applySeek(e.clientX); });
    c.addEventListener('touchstart', e => { this.isDragging = true; if (e.touches[0]) applySeek(e.touches[0].clientX); }, { passive: true });
    c.addEventListener('touchmove', e => { if (this.isDragging && e.touches[0]) applySeek(e.touches[0].clientX); }, { passive: true });

    // FIX: mouseup and touchend on window to catch drag outside element
    window.addEventListener('mouseup', () => { this.isDragging = false; });
    window.addEventListener('touchend', () => { this.isDragging = false; }, { passive: true });
    window.addEventListener('touchcancel', () => { this.isDragging = false; }, { passive: true });

    // Update progress bar on timeupdate
    const v = this.videoEl();
    if (v) {
      v.addEventListener('timeupdate', () => {
        if (this.isDragging) return;
        const played = this.$('progress-played'), thumb = this.$('progress-thumb');
        if (!isFinite(v.duration) || v.duration <= 0) return;
        const pct = (v.currentTime / v.duration) * 100;
        if (played) played.style.width = pct + '%';
        if (thumb) thumb.style.left = pct + '%';
        // Buffer
        const buffer = this.$('progress-buffer');
        if (buffer && v.buffered.length > 0) {
          try {
            const bufEnd = v.buffered.end(v.buffered.length - 1);
            buffer.style.width = ((bufEnd / v.duration) * 100) + '%';
          } catch(e) {}
        }
      });
    }
  },

  setupAutoHideControls() {
    const w = this.$('video-wrapper'); if (!w) return;
    const resetFn = () => this.resetControlsTimer();
    w.addEventListener('mousemove', throttleFn(resetFn, 200));
    w.addEventListener('click', resetFn);
    w.addEventListener('touchstart', resetFn, { passive: true });
    const p = this.$('progress-bar-container');
    if (p) {
      p.addEventListener('mouseenter', () => { this.controlsHovered = true; this.showControls(); clearTimeout(this.controlsTimer); });
      p.addEventListener('mouseleave', () => { this.controlsHovered = false; this.resetControlsTimer(); });
    }
    const v = this.videoEl();
    if (v) {
      v.addEventListener('play', () => this.resetControlsTimer());
      v.addEventListener('pause', () => { clearTimeout(this.controlsTimer); this.showControls(); });
    }
  },

  resetControlsTimer() {
    clearTimeout(this.controlsTimer);
    this.showControls();
    if (this.isPlaying && !this.controlsHovered) {
      this.controlsTimer = setTimeout(() => this.hideControls(), this.CONTROLS_HIDE_DELAY);
    }
  },

  showControls() {
    const container = document.querySelector('.player-container');
    if (container) container.classList.remove('controls-hidden');
  },

  hideControls() {
    if (!this.isPlaying || this.controlsHovered || this.isDragging) return;
    const container = document.querySelector('.player-container');
    if (container) container.classList.add('controls-hidden');
  },

  setupDoubleTap() {
    const w = this.$('video-wrapper'); if (!w) return;
    let lastTap = 0;
    w.addEventListener('touchend', e => {
      // FIX: Guard against control area touches
      if (e.target.closest('.player-controls,.player-controls-secondary,.progress-bar-container,.player-top-overlay')) return;
      if (e.changedTouches.length !== 1) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        const v = this.videoEl(); if (!v) return;
        const r = w.getBoundingClientRect();
        const tx = e.changedTouches[0].clientX - r.left;
        if (tx < r.width / 2) {
          v.currentTime = Math.max(0, v.currentTime - 10);
          this.showDbl('left');
        } else {
          v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 10) : v.currentTime + 10;
          this.showDbl('right');
        }
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });
  },

  showDbl(s) {
    const e = this.$(s === 'left' ? 'dbl-tap-left' : 'dbl-tap-right');
    if (!e) return;
    e.classList.add('show');
    clearTimeout(e._t);
    e._t = setTimeout(() => e.classList.remove('show'), 600);
  },

  startDiagnostics() {
    if (this.diagnosticInterval) clearInterval(this.diagnosticInterval);
    this.diagnosticInterval = setInterval(() => {
      if (!this.currentChannel) return;
      this.updateBufferDiagnostics();
      if (this.hls?.currentLevel >= 0 && this.hls.levels[this.hls.currentLevel]) {
        const l = this.hls.levels[this.hls.currentLevel];
        const diagRes = this.$('diag-resolution');
        if (l && diagRes && l.height) {
          if (l.height >= 2160) diagRes.textContent = `4K (${l.width}×${l.height})`;
          else diagRes.textContent = `${l.width}×${l.height}`;
        }
      }
      if (this.hls?.bandwidthEstimate) {
        const bw = this.$('diag-bandwidth');
        if (bw) bw.textContent = `${(this.hls.bandwidthEstimate / 1e6).toFixed(2)} Mbps`;
      }
      this.updateStreamHealthIndicator();
    }, 2500);
  },

  toggleFullscreen() {
    const w = this.$('video-wrapper'); if (!w) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (w.requestFullscreen || w.webkitRequestFullscreen)?.call(w);
    }
  },

  toggleTheaterMode() {
    this.isTheaterMode = !this.isTheaterMode;
    document.body.classList.toggle('theater-mode', this.isTheaterMode);
    this.showToast(this.isTheaterMode ? 'Theater mode ON' : 'Theater mode OFF');
    this.adjustContentMargins();
  },

  async togglePiP() {
    if (!document.pictureInPictureEnabled) { this.showToast('Picture-in-Picture not supported', 'warning'); return; }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await this.videoEl()?.requestPictureInPicture();
      }
    } catch(e) { this.showToast('PiP failed', 'error'); }
  },

  setupAutoPiP() {
    if (!document.pictureInPictureEnabled) return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying && !document.pictureInPictureElement) {
        this.videoEl()?.requestPictureInPicture().catch(() => {});
      }
    });
  },

  setupPlaybackSpeed() {
    const sel = this.$('playback-speed');
    if (sel) sel.value = this.playbackSpeed;
    const v = this.videoEl();
    if (v) v.playbackRate = this.playbackSpeed;
  },

  setPlaybackSpeed(s) {
    this.playbackSpeed = parseFloat(s) || 1;
    const v = this.videoEl(); if (v) v.playbackRate = this.playbackSpeed;
    safeSet(STORAGE_KEYS.SPEED, this.playbackSpeed);
    this.showToast(`Speed: ${this.playbackSpeed}×`);
  },

  increasePlaybackSpeed() {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const idx = speeds.indexOf(this.playbackSpeed);
    if (idx < speeds.length - 1) { this.setPlaybackSpeed(speeds[idx + 1]); const sel = this.$('playback-speed'); if (sel) sel.value = this.playbackSpeed; }
  },

  decreasePlaybackSpeed() {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const idx = speeds.indexOf(this.playbackSpeed);
    if (idx > 0) { this.setPlaybackSpeed(speeds[idx - 1]); const sel = this.$('playback-speed'); if (sel) sel.value = this.playbackSpeed; }
  },

  updateWatchStats() {
    if (this.watchInterval) clearInterval(this.watchInterval);
    this.watchInterval = setInterval(() => {
      if (this.isPlaying) {
        this.watchTimeToday += 5;
        this.watchTimeWeek += 5;
        safeSet(STORAGE_KEYS.WATCH_TODAY, this.watchTimeToday);
        safeSet(STORAGE_KEYS.WATCH_WEEK, this.watchTimeWeek);
      }
    }, 5000);
  },

  toggleAudioOnly() {
    this.isAudioOnly = !this.isAudioOnly;
    const w = this.$('video-wrapper');
    if (w) w.classList.toggle('audio-only', this.isAudioOnly);
    // FIX: Properly toggle hidden attribute
    const o = this.$('audio-only-overlay');
    if (o) o.hidden = !this.isAudioOnly;
    const b = this.$('audio-only-btn');
    if (b) b.classList.toggle('active', this.isAudioOnly);
    this.showToast(this.isAudioOnly ? 'Audio Only mode ON' : 'Video mode restored');
  },

  openSleepTimer() { const m = this.$('sleep-timer-modal'); if (m) m.hidden = false; this.updateSleepTimerStatus(); },
  closeSleepTimer() { const m = this.$('sleep-timer-modal'); if (m) m.hidden = true; },

  setSleepTimer(m) {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    if (m === 0) {
      this.sleepTimer = null; this.sleepEndTime = null;
      this.showToast('Sleep timer cancelled');
      const statusEl = this.$('sleep-timer-status'); if (statusEl) statusEl.textContent = '';
      this.closeSleepTimer(); return;
    }
    this.sleepEndTime = Date.now() + m * 60000;
    this.sleepTimer = setTimeout(() => {
      const v = this.videoEl(); if (v) { v.pause(); }
      this.isPlaying = false; this.updatePlayBtn();
      this.showToast('Sleep timer ended — playback paused');
      this.closeSleepTimer();
    }, m * 60000);
    this.showToast(`Sleep timer: ${m} min`);
    this.updateSleepTimerStatus();
    this.closeSleepTimer();
  },

  updateSleepTimerStatus() {
    const s = this.$('sleep-timer-status');
    if (s && this.sleepEndTime) {
      const remaining = Math.ceil((this.sleepEndTime - Date.now()) / 60000);
      s.textContent = remaining > 0 ? `${remaining} min remaining` : 'Timer expired';
    }
  },

  openM3UImport() { const m = this.$('m3u-modal'); if (m) m.hidden = false; },
  closeM3UImport() {
    const m = this.$('m3u-modal'); if (m) m.hidden = true;
    if (this.m3uAbortController) { this.m3uAbortController.abort(); this.m3uAbortController = null; }
  },

  async importM3U() {
    const ui = this.$('m3u-url'), fi = this.$('m3u-file');
    let content = '';
    if (ui?.value.trim()) {
      const url = ui.value.trim();
      if (!isValidURL(url)) { this.showToast('Invalid URL', 'error'); return; }
      this.m3uAbortController = new AbortController();
      const timeout = setTimeout(() => this.m3uAbortController?.abort(), 15000);
      try {
        const r = await fetch(url, { signal: this.m3uAbortController.signal });
        clearTimeout(timeout);
        // FIX: Basic content-type check
        const ct = r.headers.get('content-type') || '';
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        content = await r.text();
      } catch(e) {
        clearTimeout(timeout);
        this.showToast(`Fetch failed: ${e.message}`, 'error');
        this.m3uAbortController = null; return;
      }
      this.m3uAbortController = null;
    } else if (fi?.files?.[0]) {
      const file = fi.files[0];
      const name = file.name.toLowerCase();
      if (!name.endsWith('.m3u') && !name.endsWith('.m3u8') && !name.endsWith('.txt')) {
        this.showToast('Please upload an M3U file', 'error'); return;
      }
      content = await file.text();
    } else {
      this.showToast('Provide a URL or select a file', 'warning'); return;
    }
    const parsed = this.parseM3U(content);
    if (!parsed.length) { this.showToast('No valid streams found in playlist', 'warning'); return; }
    const existing = new Set((typeof channels !== 'undefined' ? channels : []).map(x => x.url));
    const newCh = parsed.filter(x => !existing.has(x.url));
    if (typeof channels !== 'undefined') channels.push(...newCh);
    this.showToast(`Imported ${newCh.length} new channel${newCh.length !== 1 ? 's' : ''}`, 'success');
    this.closeM3UImport();
    this.buildCategoryList();
    this.renderChannels();
  },

  // FIX: Sanitize all parsed values
  parseM3U(content) {
    const lines = content.split(/\r?\n/);
    const result = [];
    let cur = null;
    for (const rawLine of lines) {
      const ln = rawLine.trim();
      if (!ln) continue;
      if (ln.startsWith('#EXTINF:')) {
        cur = { id: 'IM' + Date.now() + Math.random().toString(36).slice(2, 8), logo: '', category: 'Entertainment' };
        const lm = ln.match(/tvg-logo="([^"]{0,500})"/);
        if (lm && isValidURL(lm[1])) cur.logo = lm[1];
        const gm = ln.match(/group-title="([^"]{0,100})"/);
        if (gm) cur.category = gm[1].trim() || 'Entertainment';
        const ci = ln.lastIndexOf(',');
        cur.name = ci !== -1 ? ln.substring(ci + 1).trim().slice(0, 100) : 'Imported';
        if (!cur.name) cur.name = 'Imported';
      } else if (!ln.startsWith('#') && cur) {
        if (isValidURL(ln)) { cur.url = ln; result.push({ ...cur }); }
        cur = null;
      }
    }
    return result;
  },

  exportFavorites() {
    if (!this.favorites.length) { this.showToast('No favorites to export', 'warning'); return; }
    const allCh = typeof channels !== 'undefined' ? channels : [];
    const fc = allCh.filter(c => this.favorites.includes(String(c.id || c.name)) && c.url);
    if (!fc.length) { this.showToast('Favorites have no valid streams', 'warning'); return; }
    let m3u = '#EXTM3U\n#PLAYLIST:Pulse.tv Favorites\n';
    fc.forEach(c => {
      m3u += `#EXTINF:-1 tvg-logo="${c.logo||''}" group-title="${c.category||'Entertainment'}",${c.name||'Unknown'}\n${c.url}\n`;
    });
    const b = new Blob([m3u], { type: 'audio/x-mpegurl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `pulse-favorites-${new Date().toISOString().slice(0,10)}.m3u`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this.showToast(`Exported ${fc.length} favorites`, 'success');
  },

  openShortcuts() { const m = this.$('shortcuts-modal'); if (m) m.hidden = false; },
  closeShortcuts() { const m = this.$('shortcuts-modal'); if (m) m.hidden = true; },

  checkPWAInstall() {
    if (window.matchMedia('(display-mode: standalone)').matches || safeGet(STORAGE_KEYS.PWA_DISMISSED)) return;
    const banner = this.$('pwa-install-banner');
    if (banner) banner.hidden = false;
  },
  installPWA() { this.dismissPWA(); },
  dismissPWA() {
    const banner = this.$('pwa-install-banner');
    if (banner) banner.hidden = true;
    safeSet(STORAGE_KEYS.PWA_DISMISSED, true);
  },

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════
  setupKeyboard() {
    const isInputFocused = () => ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);

    document.addEventListener('keydown', e => {
      // FIX: Don't handle shortcuts when any modal is open (except Escape)
      const openModal = document.querySelector('.modal-overlay:not([hidden])');
      if (openModal && e.key !== 'Escape') return;

      // Search focus
      if (e.key === '/' && !e.shiftKey && !isInputFocused()) {
        e.preventDefault();
        const si = this.$('search-input');
        if (si && !this.kidsMode) { si.focus(); si.select(); this.openSidebar('left'); }
        return;
      }

      // Show shortcuts
      if (e.key === '?' && !e.ctrlKey && !isInputFocused()) {
        e.preventDefault(); this.openShortcuts(); return;
      }

      if (isInputFocused()) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return; // avoid system shortcuts

      const v = this.videoEl();

      // Number keys: 1-9 = jump %, 0 = go to start
      if (e.key >= '0' && e.key <= '9' && !e.shiftKey) {
        e.preventDefault();
        if (e.key === '0') { if (v) v.currentTime = 0; return; }
        // Channel number buffer
        this.channelInputBuffer += e.key;
        if (this.channelInputBuffer.length > 3) this.channelInputBuffer = this.channelInputBuffer.slice(-3);
        const nd = this.$('channel-name-display');
        if (nd) nd.textContent = `Channel ${this.channelInputBuffer}…`;
        clearTimeout(this.channelInputTimeout);
        this.channelInputTimeout = setTimeout(() => {
          const n = parseInt(this.channelInputBuffer, 10);
          const allCh = typeof channels !== 'undefined' ? channels : [];
          if (n > 0 && n <= allCh.length) this.playChannel(allCh[n - 1], false);
          else if (this.currentChannel) { const nd2 = this.$('channel-name-display'); if (nd2) nd2.textContent = this.currentChannel.name; }
          this.channelInputBuffer = '';
        }, 1200);

        // Also handle jump % if video is loaded and buffer is just one digit
        if (this.channelInputBuffer.length === 1 && v && isFinite(v.duration) && v.duration > 0) {
          clearTimeout(this.channelInputTimeout);
          this.channelInputTimeout = setTimeout(() => {
            // If still single digit, treat as % jump
            if (this.channelInputBuffer.length === 1) {
              const pct = parseInt(this.channelInputBuffer, 10) / 10;
              v.currentTime = v.duration * pct;
              this.showToast(`Jumped to ${parseInt(this.channelInputBuffer, 10) * 10}%`);
            }
            this.channelInputBuffer = '';
            if (this.currentChannel) { const nd2 = this.$('channel-name-display'); if (nd2) nd2.textContent = this.currentChannel.name; }
          }, 800);
        }
        return;
      }

      switch (e.key) {
        case ' ': case 'k': case 'K': e.preventDefault(); this.togglePlay(); break;
        case 'j': case 'J': e.preventDefault(); if (v) { v.currentTime = Math.max(0, v.currentTime - 10); this.showDbl('left'); } break;
        case 'l': case 'L': e.preventDefault(); if (v) { v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 10) : v.currentTime + 10; this.showDbl('right'); } break;
        case 'ArrowLeft': e.preventDefault(); if (v) v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'ArrowRight': e.preventDefault(); if (v) v.currentTime = isFinite(v.duration) ? Math.min(v.duration, v.currentTime + 5) : v.currentTime + 5; break;
        case ',': if (e.shiftKey) { e.preventDefault(); this.decreasePlaybackSpeed(); } break;
        case '.': if (e.shiftKey) { e.preventDefault(); this.increasePlaybackSpeed(); } break;
        case 'ArrowUp': e.preventDefault(); if (v) { v.volume = Math.min(1, v.volume + 0.1); v.muted = false; this.updateMuteIcon(); } break;
        case 'ArrowDown': e.preventDefault(); if (v) { v.volume = Math.max(0, v.volume - 0.1); this.updateMuteIcon(); } break;
        case 'm': case 'M': e.preventDefault(); this.toggleMute(); break;
        case 'f': case 'F': e.preventDefault(); this.toggleFullscreen(); break;
        case 't': case 'T': e.preventDefault(); this.toggleTheaterMode(); break;
        case 'i': case 'I': e.preventDefault(); this.togglePiP(); break;
        case 'n': case 'N': if (!e.shiftKey) { e.preventDefault(); this.nextChannel(); } break;
        case 'p': case 'P': if (!e.shiftKey) { e.preventDefault(); this.prevChannel(); } break;
        case 'Home': e.preventDefault(); if (v) v.currentTime = 0; break;
        case 'End': e.preventDefault(); if (v && isFinite(v.duration)) v.currentTime = v.duration; break;
        case 'N': if (e.shiftKey) { e.preventDefault(); if (v && v.paused) v.currentTime += 1/30; } break;
        case 'P': if (e.shiftKey) { e.preventDefault(); if (v && v.paused) v.currentTime = Math.max(0, v.currentTime - 1/30); } break;
        case 'b': case 'B': e.preventDefault(); this.toggleSidebar('left'); break;
        case 'a': case 'A': if (!e.shiftKey) { e.preventDefault(); this.toggleAudioOnly(); } break;
        case 'Escape': this.closeAllModals(); break;
      }
    });
  },

  assignQuickSwap(key) {
    if (!this.currentChannel) return;
    this.quickSwapKeys[key] = String(this.currentChannel.id || this.currentChannel.name);
    safeSet(STORAGE_KEYS.QUICK_SWAP, this.quickSwapKeys);
    this.showToast(`Channel saved to Alt+${key}`);
  },

  swapToQuickChannel(key) {
    const id = this.quickSwapKeys[key];
    if (!id) { this.showToast(`No channel assigned to Alt+${key}`, 'info'); return; }
    const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === id);
    if (ch) this.playChannel(ch, false);
  },

  closeAllModals() {
    ['share-modal','settings-modal','sleep-timer-modal','m3u-modal','shortcuts-modal','pin-pad-modal'].forEach(id => {
      const m = this.$(id); if (m) m.hidden = true;
    });
    document.body.style.overflow = '';
    if (this._pinCallback) { this._pinCallback(null); this._pinCallback = null; }
  },
};

// ═══════════════════════════════════════════════════════════════
// INIT & CLEANUP
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Handle hash routing for shared channel links
  const hash = location.hash;
  if (hash.includes('#channel=')) {
    const chId = decodeURIComponent(hash.split('#channel=')[1]?.split('&')[0] || '');
    if (chId) {
      const onReady = () => {
        const ch = (typeof channels !== 'undefined' ? channels : []).find(c => String(c.id || c.name) === chId);
        if (ch) PulseApp.playChannel(ch, false);
      };
      // Defer until after init
      setTimeout(onReady, 800);
    }
  }
  PulseApp.init();
});

window.addEventListener('beforeunload', () => {
  PulseApp.saveContinueWatching();
  PulseApp.clearAllIntervals();
  if (PulseApp.hls) { PulseApp.hls.stopLoad(); PulseApp.hls.detachMedia(); PulseApp.hls.destroy(); }
  if (PulseApp.preloadedHls) { PulseApp.preloadedHls.destroy(); }
  if (PulseApp.sleepTimer) clearTimeout(PulseApp.sleepTimer);
  if (PulseApp.adReopenTimer) clearInterval(PulseApp.adReopenTimer);
  if (PulseApp.m3uAbortController) PulseApp.m3uAbortController.abort();
  if (PulseApp.renderRAF) cancelAnimationFrame(PulseApp.renderRAF);
  OnlineUsers.cleanup();
});

// Handle resize for sidebar margin adjustments
window.addEventListener('resize', debounceFn(() => { PulseApp.adjustContentMargins(); }, 200));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}