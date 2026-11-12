/*! woot-skins | MIT | https://github.com/airton/woot-skins
 * Skins for the Chatwoot agent dashboard, injected through Super Admin > Settings > Dashboard Scripts.
 * Read-only: it never commits to the store or calls the API. It only reads Vue props and marks
 * elements with data-wsk-* attributes (Vue rewrites className, but leaves unknown attributes alone).
 * Optional config: set window.WOOT_SKINS = { ... } before this script (see README). */
(function () {
  'use strict';
  var html = document.documentElement;

  /* ---------- Config ---------- */
  var DEFAULTS = {
    themes: ['fox', 'cilo'],   // first one is the default
    locale: null,              // 'en' | 'pt-BR'; null follows the Chatwoot UI language
    waitHours: [4, 12],        // customer waiting time that turns the card orange, then red
    labels: {
      critical: null,          // regex (string) for labels shown in red, e.g. '^urgent'
      hidden: null,            // regex (string) for labels hidden on cards, e.g. '^(bot-|csat-sent$)'
      tones: {},               // exact label -> 'red' | 'orange' | 'green' | 'blue' | 'gray'
      stripPrefix: null        // regex (string) removed from the label text, e.g. '^queue-'
    },
    attributeGroups: [],       // [['Billing', '^billing_'], ['Other', '.']] groups conversation attributes
    brandAttribute: null,      // conversation custom attribute shown as a chip under the contact name
    brandNames: {},            // value -> display name for brandAttribute
    caseCard: [],              // [['plan', 'Plan'], ['renewal_date', 'Renewal', 'date']] 2x2 grid in the contact panel (fox)
    placeholder: '\\[[^\\]\\n]{2,40}\\]|\\{\\{[^}\\n]*\\}\\}' // unfilled template variables in a reply
  };
  var USER = window.WOOT_SKINS || {};
  var CONFIG = {};
  Object.keys(DEFAULTS).forEach(function (k) { CONFIG[k] = USER[k] !== undefined ? USER[k] : DEFAULTS[k]; });
  CONFIG.labels = Object.assign({}, DEFAULTS.labels, USER.labels || {});
  function rx(s, flags) { try { return s ? new RegExp(s, flags) : null; } catch (e) { return null; } }

  var THEME_NAMES = { fox: 'Fox', cilo: 'Cilo' };
  var THEMES = CONFIG.themes.filter(function (t) { return THEME_NAMES[t]; });
  if (!THEMES.length) THEMES = DEFAULTS.themes;

  /* ---------- Text (en, pt-BR) ---------- */
  var TEXT = {
    en: {
      waiting: function (n, u) { return 'waiting ' + n + (u === 'd' ? (n === '1' ? ' day' : ' days') : ' h'); },
      showCc: 'Show CC and BCC', hideCc: 'Hide CC and BCC',
      warnPublic: function (p) { return 'Unfilled placeholder (' + p + '). It will be sent as is.'; },
      warnNote: function (p) { return 'Unfilled placeholder (' + p + ').'; },
      warnMention: 'An @mention in a reply to the customer notifies no one and is sent as text. Use a private note to reach a teammate.',
      today: 'Today', yesterday: 'Yesterday', bot: 'Bot', notSet: 'not set', caseCard: 'Case details', skin: 'Skin',
      roles: { customer: 'Customer', agent: 'Agent', bot: 'Automated' },
      css: { note: 'Private note', noteHint: 'Private note, not visible to the customer', replyTab: 'Reply to customer', noteTab: 'Private note', resolved: 'Resolved' }
    },
    pt: {
      waiting: function (n, u) { return 'esperando ' + n + (u === 'd' ? (n === '1' ? ' dia' : ' dias') : ' h'); },
      showCc: 'Mostrar CC e CCO', hideCc: 'Esconder CC e CCO',
      warnPublic: function (p) { return 'Marcador sem preencher (' + p + '). Ele vai assim para o cliente.'; },
      warnNote: function (p) { return 'Marcador sem preencher (' + p + ').'; },
      warnMention: 'Menção com @ em resposta ao cliente não avisa ninguém e vai no texto. Para avisar um colega, use uma nota interna.',
      today: 'Hoje', yesterday: 'Ontem', bot: 'Robô', notSet: 'não informado', caseCard: 'Ficha do caso', skin: 'Skin',
      roles: { customer: 'Cliente', agent: 'Atendimento', bot: 'Automático' },
      css: { note: 'Nota interna', noteHint: 'Nota interna, o cliente não vê', replyTab: 'Responder ao cliente', noteTab: 'Nota interna', resolved: 'Conversa resolvida' }
    }
  };
  var lang = 'en', T = TEXT.en, dateLocale = 'en';
  function setLocale(l) {
    l = String(l || CONFIG.locale || navigator.language || 'en');
    var next = /^pt/i.test(l) ? 'pt' : 'en';
    dateLocale = next === 'pt' ? 'pt-BR' : l;
    if (next === lang && html.hasAttribute('data-wsk-lang')) return;
    lang = next; T = TEXT[lang];
    html.setAttribute('data-wsk-lang', lang);
    // strings drawn by CSS (content: var(--wsk-t-*))
    Object.keys(T.css).forEach(function (k) { html.style.setProperty('--wsk-t-' + k, JSON.stringify(T.css[k])); });
  }

  /* ---------- Guard, kill switch, modes ---------- */
  var ACCOUNT_PATH = /^\/app\/accounts\/\d+(\/|$)/;
  var ONBOARDING = /\/onboarding(\/|$)/;
  function killed() {
    if (/[?&]wsk=off\b/.test(location.search)) return true;
    try { return localStorage.getItem('wsk_off') === '1'; } catch (e) { return false; }
  }
  function eligible(path) { return ACCOUNT_PATH.test(path) && !ONBOARDING.test(path) && !killed(); }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }

  if (killed()) return;
  setLocale(CONFIG.locale);
  // applied before Vue mounts so the original theme does not flash
  if (eligible(location.pathname)) html.classList.add('wsk');
  if (/\/settings(\/|$)/.test(location.pathname)) html.setAttribute('data-wsk-area', 'settings');
  if (store('wsk_focus') === '1') html.classList.add('wsk-focus');

  /* ---------- Themes and picker ---------- */
  var fromUrl = (location.search.match(/[?&]wsk-theme=(\w+)/) || [])[1];
  if (THEMES.indexOf(fromUrl) > -1) store('wsk_theme', fromUrl);
  function applyTheme(t) {
    if (THEMES.indexOf(t) < 0) t = THEMES[0];
    html.setAttribute('data-wsk-theme', t);
    var sel = document.querySelector('#wsk-skin select');
    if (sel && sel.value !== t) sel.value = t;
    return t;
  }
  applyTheme(store('wsk_theme'));

  function mountSkinPicker() {
    if (THEMES.length < 2 || document.getElementById('wsk-skin') || !document.body) return;
    var box = document.createElement('label');
    box.id = 'wsk-skin';
    box.appendChild(document.createTextNode(T.skin));
    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Chatwoot skin');
    THEMES.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t; o.textContent = THEME_NAMES[t];
      sel.appendChild(o);
    });
    sel.value = html.getAttribute('data-wsk-theme');
    sel.addEventListener('change', function () { store('wsk_theme', applyTheme(sel.value)); });
    box.appendChild(sel);
    document.body.appendChild(box); // outside #app: Vue never touches it
  }
  // sits on the right edge of the sidebar footer, next to the profile
  function placeSkinPicker() {
    var box = document.getElementById('wsk-skin');
    var aside = document.querySelector('aside');
    if (!box || !aside) return;
    var left = Math.max(10, Math.round(aside.getBoundingClientRect().right - box.offsetWidth - 10)) + 'px';
    if (box.style.left !== left) box.style.left = left;
  }

  /* ---------- Read-only access to the Vue app ---------- */
  var vueApp = null;
  function getApp() {
    if (vueApp) return vueApp;
    var el = document.getElementById('app');
    vueApp = el && el.__vue_app__;
    return vueApp;
  }
  function getStore() { var app = getApp(); return app && app.config.globalProperties.$store; }
  // production builds have no app._instance; the root vnode lives on the container as _vnode
  function walk(vnode, visit) {
    if (!vnode || typeof vnode !== 'object') return;
    if (vnode.component) {
      if (visit(vnode.component) === false) return;
      walk(vnode.component.subTree, visit);
      return;
    }
    if (vnode.suspense) { walk(vnode.suspense.activeBranch, visit); return; }
    if (Array.isArray(vnode.children)) for (var i = 0; i < vnode.children.length; i++) walk(vnode.children[i], visit);
  }
  function walkApp(visit) {
    var root = document.getElementById('app');
    if (root && root._vnode) walk(root._vnode, visit);
  }
  function eachCard(fn) {
    walkApp(function (inst) {
      var el = inst.vnode && inst.vnode.el;
      if (inst.props && inst.props.chat && el && el.classList && el.classList.contains('conversation')) { fn(inst.props.chat, el); return false; }
      return true;
    });
  }
  function setAttr(el, name, value) {
    if (value == null) { if (el.hasAttribute(name)) el.removeAttribute(name); return; }
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }

  /* ---------- Dates ---------- */
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
  function timeOf(d) { return d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }); }
  function dayLabel(d) {
    var now = new Date();
    if (sameDay(d, now)) return T.today;
    if (sameDay(d, new Date(now.getTime() - 86400000))) return T.yesterday;
    return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).replace('.', '');
  }
  // short time on the card: 12:35 / Yesterday / Monday / 25 Nov
  function cardTime(ts) {
    var d = new Date(ts * 1000), now = new Date();
    if (sameDay(d, now)) return timeOf(d);
    if (sameDay(d, new Date(now.getTime() - 86400000))) return T.yesterday;
    if (now - d < 7 * 86400000) {
      var w = d.toLocaleDateString(dateLocale, { weekday: 'long' }).replace('-feira', '');
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }).replace('.', '');
  }

  /* ---------- Conversation list ---------- */
  var CRITICAL = rx(CONFIG.labels.critical);
  var HIDDEN = rx(CONFIG.labels.hidden);
  var STRIP = rx(CONFIG.labels.stripPrefix);
  function labelTone(title) {
    if (CRITICAL && CRITICAL.test(title)) return 'red';
    if (HIDDEN && HIDDEN.test(title)) return 'noise';
    return CONFIG.labels.tones[title] || 'gray';
  }
  function labelText(title) { return (STRIP ? title.replace(STRIP, '') : title).replace(/[-_]/g, ' '); }
  function waitOf(chat, now) {
    var open = chat.status === 'open' || chat.status === 'pending';
    if (!chat.waiting_since || !open) return null;
    var s = Math.max(0, now - chat.waiting_since);
    var warn = CONFIG.waitHours[0] * 3600, late = CONFIG.waitHours[1] * 3600;
    if (s < warn) return null;
    var days = s >= 86400;
    return { level: s >= late ? 'late' : 'warn', text: T.waiting(String(Math.floor(days ? s / 86400 : s / 3600)), days ? 'd' : 'h') };
  }

  function decorateCards() {
    var now = Date.now() / 1000;
    eachCard(function (chat, el) {
      var w = waitOf(chat, now);
      setAttr(el, 'data-wsk-wait-level', w ? w.level : null);
      setAttr(el, 'data-wsk-wait', w ? w.text : null);
      setAttr(el, 'data-wsk-status', chat.status || null);
      var t = el.querySelector('.border-line > div.absolute > span > div');
      if (t) setAttr(t, 'data-wsk-time', chat.timestamp ? cardTime(chat.timestamp) : null);
      var dots = el.querySelectorAll('.label-color-dot');
      for (var i = 0; i < dots.length; i++) {
        var chip = dots[i].parentElement;
        var title = chip.getAttribute('data-wsk-label-raw') || chip.textContent.trim();
        setAttr(chip, 'data-wsk-label-raw', title);
        setAttr(chip, 'data-wsk-tone', labelTone(title));
        setAttr(chip, 'data-wsk-label-text', labelText(title));
      }
    });
  }

  /* ---------- Conversation attributes: groups, empty rows, date fix ---------- */
  var GROUPS = CONFIG.attributeGroups.map(function (g, i) { return { title: g[0], re: rx(g[1]), i: i }; }).filter(function (g) { return g.re; });
  function eachAttr(fn) {
    if (!document.querySelector('.conversation--details')) return;
    walkApp(function (inst) {
      var p = inst.props;
      if (p && typeof p.attributeKey === 'string' && 'value' in p && inst.vnode.el && inst.vnode.el.parentElement) {
        fn(p.attributeKey, p.value, inst.vnode.el.parentElement);
        return false;
      }
      return true;
    });
  }
  // Chatwoot parses '2026-11-05' as UTC midnight and shows it in local time: west of UTC it becomes
  // the day before. We show the stored date, formatted for the locale, without any timezone math.
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
  function storedDate(value) {
    var m = typeof value === 'string' && value.match(ISO_DATE);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(dateLocale);
  }
  function fixDate(row, value) {
    var d = storedDate(value);
    if (!d) return;
    var shown = Array.prototype.find.call(row.querySelectorAll('p, span, div'), function (e) {
      return e.children.length === 0 && /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(e.textContent.trim());
    });
    if (shown) setAttr(shown, 'data-wsk-date', d);
  }
  function decorateAttributes() {
    var rows = [];
    eachAttr(function (key, value, row) {
      setAttr(row, 'data-wsk-attr-empty', value === '' || value == null ? '' : null);
      fixDate(row, value);
      var g = null;
      for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].re.test(key)) { g = GROUPS[i]; break; }
      setAttr(row, 'data-wsk-attr-group', g ? String(g.i) : null);
      rows.push([g, row]);
    });
    var seen = {}, count = 0;
    rows.sort(function (a, b) { return (a[0] ? a[0].i : 99) - (b[0] ? b[0].i : 99); });
    rows.forEach(function (r) {
      var first = r[0] && !seen[r[0].i];
      if (first) { seen[r[0].i] = true; count++; }
      setAttr(r[1], 'data-wsk-attr-head', first ? r[0].title : null);
    });
    if (count < 2) rows.forEach(function (r) { setAttr(r[1], 'data-wsk-attr-head', null); }); // one group says nothing
  }

  /* ---------- Reply box: CC collapse, placeholder and mention warnings ---------- */
  var PLACEHOLDER = rx(CONFIG.placeholder);
  var PLACEHOLDER_ALL = rx(CONFIG.placeholder, 'g');
  var PUBLIC_MENTION = /(^|\s)@[\wÀ-ú]{2,}/;
  function decorateReplyBox() {
    var box = document.querySelector('.reply-box');
    if (!box) { markPlaceholders(null); return; }
    var wraps = box.querySelectorAll('.input-group-wrap');
    if (wraps.length) {
      var toggle = box.querySelector('[data-wsk-recipients-toggle]');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.setAttribute('data-wsk-recipients-toggle', '');
        toggle.addEventListener('click', function () {
          box.setAttribute('data-wsk-recipients', box.getAttribute('data-wsk-recipients') === 'collapsed' ? 'open' : 'collapsed');
          decorateReplyBox();
        });
        wraps[0].parentNode.insertBefore(toggle, wraps[0]);
        // a filled CC never starts hidden: the agent must see who gets the email
        var filled = Array.prototype.some.call(box.querySelectorAll('.input-group-wrap input'), function (i) { return i.value; });
        box.setAttribute('data-wsk-recipients', filled ? 'open' : 'collapsed');
      }
      var label = box.getAttribute('data-wsk-recipients') === 'collapsed' ? T.showCc : T.hideCc;
      if (toggle.textContent !== label) toggle.textContent = label;
    }
    var editor = box.querySelector('.ProseMirror');
    var text = editor ? editor.innerText : '';
    var isPrivate = box.classList.contains('is-private');
    var warn = null;
    var m = PLACEHOLDER && text.match(PLACEHOLDER);
    if (m) warn = isPrivate ? T.warnNote(m[0]) : T.warnPublic(m[0]);
    else if (!isPrivate && PUBLIC_MENTION.test(text)) warn = T.warnMention;
    setAttr(box, 'data-wsk-warn', warn);
    markPlaceholders(editor);
  }
  // wavy underline on placeholders inside the editor, without touching ProseMirror's DOM (CSS Custom Highlight API)
  function markPlaceholders(editor) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined' || !PLACEHOLDER_ALL) return;
    if (!editor) { CSS.highlights.delete('wsk-placeholder'); return; }
    var ranges = [];
    var tw = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (var node = tw.nextNode(); node; node = tw.nextNode()) {
      PLACEHOLDER_ALL.lastIndex = 0;
      for (var m = PLACEHOLDER_ALL.exec(node.data); m; m = PLACEHOLDER_ALL.exec(node.data)) {
        var r = new Range();
        r.setStart(node, m.index);
        r.setEnd(node, m.index + m[0].length);
        ranges.push(r);
      }
    }
    if (ranges.length) CSS.highlights.set('wsk-placeholder', new Highlight(...ranges));
    else CSS.highlights.delete('wsk-placeholder');
  }

  /* ---------- Fox: Slack-style messages, contact panel ---------- */
  function initials(name) {
    var w = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/);
    if (!w[0]) return '?';
    return (w.length === 1 ? w[0].charAt(0) : w[0].charAt(0) + w[1].charAt(0)).toUpperCase();
  }
  function avatarColor(name) { return String(name ? name.length % 6 : 2); } // same index as Chatwoot's Avatar.vue
  function senderName(p) {
    if (!p.sender) return (p.additionalAttributes || {}).senderName || T.bot;
    return p.sender.available_name || p.sender.name || '';
  }
  function kindOf(p) {
    if (p.private) return 'note';
    if (p.messageType === 0) return 'customer';
    if (p.messageType === 2) return 'activity';
    if (!p.sender || p.sender.type === 'agent_bot' || p.senderType === 'AgentBot') return 'bot';
    return 'agent';
  }
  function decorateMessages() {
    if (!document.querySelector('ul.conversation-panel')) return;
    var prev = null;
    walkApp(function (inst) {
      var p = inst.props;
      if (!p || typeof p.messageType !== 'number' || typeof p.createdAt !== 'number' || !('conversationId' in p)) return true;
      var el = inst.vnode.el;
      if (!el || el.nodeType !== 1) return false; // v-if false: Message rendered a comment
      var d = new Date(p.createdAt * 1000);
      var kind = kindOf(p);
      var newDay = !prev || !sameDay(prev.d, d);
      var first = newDay || !prev.groupWithNext || prev.kind === 'activity';
      setAttr(el, 'data-wsk-day', newDay ? dayLabel(d) : null);
      setAttr(el, 'data-wsk-first', first && kind !== 'activity' ? '' : null);
      var grid = el.querySelector(':scope > div[style*="grid-template-areas"]');
      var bubble = el.querySelector('[data-bubble-name]');
      var name = senderName(p);
      if (grid) {
        setAttr(grid, 'data-wsk-ini', first ? initials(name) : null);
        setAttr(grid, 'data-wsk-color', first ? avatarColor(name) : null);
      }
      if (bubble) {
        var head = first && kind !== 'activity';
        setAttr(bubble, 'data-wsk-kind', kind);
        setAttr(bubble, 'data-wsk-author', head ? name : null);
        setAttr(bubble, 'data-wsk-time', head ? timeOf(d) : null);
        setAttr(bubble, 'data-wsk-role', head ? T.roles[kind] || null : null);
      }
      prev = { d: d, kind: kind, groupWithNext: p.groupWithNext && p.status !== 'failed' };
      return false;
    });
  }
  function decorateContact() {
    var host = document.querySelector('[channel-type]');
    var s = getStore();
    if (!host || !s) return;
    var chat = s.getters.getSelectedChat || {};
    var attrs = chat.custom_attributes || {};
    // contact rows: the title is a ContactInfoRow prop and never reaches the DOM
    walkApp(function (inst) {
      var p = inst.props;
      if (p && 'emoji' in p && 'showCopy' in p && typeof p.title === 'string' && inst.vnode.el && inst.vnode.el.nodeType === 1) {
        setAttr(inst.vnode.el, 'data-wsk-label', p.title);
        setAttr(inst.vnode.el, 'data-wsk-field', p.icon);
        return false;
      }
      return true;
    });
    var info = host.querySelector(':scope > div > div:nth-child(2)');
    var brand = CONFIG.brandAttribute ? String(attrs[CONFIG.brandAttribute] || '') : '';
    if (info) setAttr(info, 'data-wsk-brand', brand ? CONFIG.brandNames[brand] || CONFIG.brandNames[brand.toUpperCase()] || brand : null);
    if (!CONFIG.caseCard.length) return;
    // own element, last child of ContactInfo's root (not inside a v-for, so Vue never reorders it)
    var card = host.querySelector(':scope > [data-wsk-case]');
    if (!card) {
      card = document.createElement('div');
      card.setAttribute('data-wsk-case', '');
      card.setAttribute('aria-label', T.caseCard);
      host.appendChild(card);
    }
    var key = lang + JSON.stringify(CONFIG.caseCard.map(function (f) { return attrs[f[0]]; }));
    if (card.getAttribute('data-wsk-key') === key) return;
    card.setAttribute('data-wsk-key', key);
    card.textContent = '';
    CONFIG.caseCard.slice(0, 4).forEach(function (f) {
      var raw = attrs[f[0]];
      var val = raw === '' || raw == null ? null : f[2] === 'date' ? storedDate(String(raw)) || String(raw) : String(raw);
      var cell = document.createElement('div');
      var l = document.createElement('span');
      var v = document.createElement('strong');
      l.textContent = f[1];
      v.textContent = val || T.notSet;
      if (!val) v.setAttribute('data-empty', '');
      cell.appendChild(l); cell.appendChild(v);
      card.appendChild(cell);
    });
  }

  /* ---------- Unread count in the tab title ---------- */
  var TITLE_PREFIX = /^\(\d+\) /;
  function updateTitle() {
    var s = getStore();
    if (!s) return;
    var unread = (s.getters.getAllConversations || []).filter(function (c) { return c.unread_count > 0; }).length;
    var base = document.title.replace(TITLE_PREFIX, '');
    var next = unread ? '(' + unread + ') ' + base : base;
    if (document.title !== next) document.title = next;
  }

  /* ---------- Shortcuts (Alt+Shift does not clash with Chatwoot's) ---------- */
  document.addEventListener('keydown', function (e) {
    if (!html.classList.contains('wsk') || !e.altKey || !e.shiftKey || e.metaKey || e.ctrlKey) return;
    if (e.code === 'KeyT') {
      e.preventDefault();
      store('wsk_theme', applyTheme(THEMES[(THEMES.indexOf(html.getAttribute('data-wsk-theme')) + 1) % THEMES.length]));
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      store('wsk_focus', html.classList.toggle('wsk-focus') ? '1' : '0');
    }
  });

  /* ---------- Scheduling ---------- */
  var pending = false;
  function run() {
    pending = false;
    if (!html.classList.contains('wsk')) return;
    decorateCards();
    decorateAttributes();
    decorateReplyBox();
    if (html.getAttribute('data-wsk-theme') === 'fox') { decorateMessages(); decorateContact(); }
    updateTitle();
    placeSkinPicker();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(run);
  }
  function boot() {
    var app = getApp();
    if (!app) { setTimeout(boot, 100); return; }
    var i18n = app.config.globalProperties.$i18n;
    if (!CONFIG.locale && i18n && i18n.locale) setLocale(typeof i18n.locale === 'string' ? i18n.locale : i18n.locale.value);
    mountSkinPicker();
    var router = app.config.globalProperties.$router;
    if (router) {
      router.afterEach(function (to) {
        html.classList.toggle('wsk', eligible(to.path));
        setAttr(html, 'data-wsk-area', /\/settings(\/|$)/.test(to.path) ? 'settings' : null);
        schedule();
      });
    }
    new MutationObserver(schedule).observe(document.getElementById('app'), { childList: true, subtree: true });
    document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.reply-box')) schedule(); }, true);
    var titleEl = document.querySelector('title');
    if (titleEl) new MutationObserver(schedule).observe(titleEl, { childList: true });
    setInterval(schedule, 60000); // waiting time ages on its own
    schedule();
  }
  window.wootSkins = { run: run, config: CONFIG, version: '0.1.0' };
  // Chatwoot mounts on window.onload; never overwrite it, listen instead
  window.addEventListener('load', function () { setTimeout(boot, 0); });
})();
