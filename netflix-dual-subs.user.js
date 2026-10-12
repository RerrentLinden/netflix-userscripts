// ==UserScript==
// @name         Netflix Dual Subtitles
// @name:zh-CN   Netflix 双语字幕
// @namespace    https://github.com/RerrentLinden/netflix-userscripts
// @version      2.0.0
// @description  Show two subtitle languages at once on Netflix, with a small settings panel for languages and style.
// @description:zh-CN 在 Netflix 播放页同时显示两种语言的字幕，可在面板里选择语言、调整样式。
// @match        https://www.netflix.com/*
// @homepageURL  https://github.com/RerrentLinden/netflix-userscripts
// @supportURL   https://github.com/RerrentLinden/netflix-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-dual-subs.user.js
// @updateURL    https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-dual-subs.user.js
// @license      MIT
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Netflix 的文本字幕格式（都是 TTML）；另有图片格式 nflx-cmisc，无法使用
  const TEXT_FORMATS = ['simplesdh', 'dfxp-ls-sdh', 'imsc1.1'];
  const SETTINGS_KEY = 'nds-settings';
  const LOG = '[双语字幕]';

  const FONTS = {
    default: { label: '默认', family: '"Netflix Sans", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' },
    song: { label: '宋体', family: '"Songti SC", "Noto Serif CJK SC", SimSun, Georgia, serif' },
    kai: { label: '楷体', family: '"Kaiti SC", KaiTi, STKaiti, Georgia, serif' },
    round: { label: '圆体', family: '"Yuanti SC", "Arial Rounded MT Bold", "PingFang SC", sans-serif' },
  };
  const SIZE_RANGE = { min: 1.5, max: 10, step: 0.1 };

  const DEFAULTS = {
    enabled: true,
    // lang 为空表示不显示这一行；size 是相对播放器高度的百分比
    lines: [
      { lang: 'zh-Hans', size: 4, color: '#ffffff' },
      { lang: 'en', size: 3.2, color: '#ffffff' },
    ],
    font: 'default',
    bold: true,
    background: 0, // 背景不透明度 0–1
    bottom: 9, // 距播放器底部的百分比
  };

  const CSS = `
    .nds-root { position: absolute; inset: 0; pointer-events: none; container-type: size; }
    .nds-subs {
      position: absolute; left: 0; right: 0; bottom: var(--nds-bottom);
      display: flex; flex-direction: column; align-items: center; gap: 0.4cqh;
      transition: bottom 0.2s;
    }
    /* 控制栏出现时让开；调样式时不让，否则「位置」滑块看起来不生效 */
    html:not(.nds-panel-open) .watch-video:has(.watch-video--bottom-controls-container) .nds-subs {
      bottom: max(17%, var(--nds-bottom));
    }
    .nds-line {
      max-width: 90%; padding: 0.05em 0.4em; border-radius: 0.15em;
      white-space: pre-line; text-align: center; line-height: 1.3;
      font-family: var(--nds-font); font-weight: var(--nds-weight);
      background: rgb(0 0 0 / var(--nds-background));
      text-shadow: 0 0 0.12em #000, 0 0 0.12em #000, 0 0 0.25em #000, 0.04em 0.04em 0.1em #000;
    }
    .nds-toast {
      position: absolute; top: 12%; left: 50%; transform: translateX(-50%);
      padding: 0.5em 1em; border-radius: 0.4em; background: rgb(0 0 0 / 0.75);
      color: #fff; font: 2.2cqh "Netflix Sans", "PingFang SC", sans-serif;
    }
    .nds-line:empty, .nds-toast:empty { display: none; }
    html.nds-hide-native .player-timedtext { display: none !important; }

    .nds-ui {
      position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      color: #fff; font: 14px/1.4 "Netflix Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
      color-scheme: dark; accent-color: #e50914;
    }
    .nds-button {
      position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
      width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgb(255 255 255 / 0.5);
      background: rgb(0 0 0 / 0.6); color: #fff; font-size: 18px; cursor: pointer;
      opacity: 0; transition: opacity 0.2s;
    }
    .nds-awake .nds-button, .nds-open .nds-button { opacity: 1; pointer-events: auto; }
    .nds-panel {
      position: absolute; right: 68px; top: 50%; transform: translateY(-50%);
      width: 280px; padding: 14px 16px; border-radius: 10px; background: rgb(20 20 20 / 0.94);
      display: grid; gap: 10px; pointer-events: auto; cursor: default;
    }
    .nds-panel[hidden] { display: none; }
    .nds-row { display: grid; grid-template-columns: 3.5em 1fr auto; align-items: center; gap: 8px; }
    .nds-row > :nth-child(2):last-child { grid-column: 2 / -1; }
    .nds-row select, .nds-row input[type="range"] { width: 100%; min-width: 0; margin: 0; }
    .nds-row input[type="checkbox"] { justify-self: start; margin: 0; }
    .nds-row input[type="color"] { width: 32px; height: 24px; padding: 0; border: 0; background: none; }
    .nds-head { grid-template-columns: 1fr auto auto; font-size: 15px; }
    .nds-group { margin-top: 4px; color: rgb(255 255 255 / 0.6); font-size: 12px; }
    .nds-panel button { padding: 4px 10px; border: 1px solid rgb(255 255 255 / 0.3); border-radius: 6px; background: none; color: #fff; cursor: pointer; }
    .nds-panel .nds-close { border: 0; font-size: 18px; line-height: 1; }
  `;

  const nativeParse = JSON.parse;
  const settings = loadSettings();

  function loadSettings() {
    let saved = {};
    try {
      saved = nativeParse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
      // 没存过或内容损坏，用默认值
    }
    return {
      ...DEFAULTS,
      ...saved,
      lines: DEFAULTS.lines.map((line, i) => ({ ...line, ...(saved.lines && saved.lines[i]) })),
    };
  }

  // ---- 字幕轨采集 ----

  // movieId -> Map<trackId, { id, language, label, isCC, rank, urls, requested }>
  const tracksByMovie = new Map();

  // 播放器拿到的 manifest（MSL 解密后）都会走 JSON.parse，里面带着各字幕轨的下载地址
  JSON.parse = function () {
    const data = nativeParse.apply(this, arguments);
    try {
      const manifest = data && data.result;
      if (manifest && manifest.movieId && Array.isArray(manifest.textTracks)) collectTracks(manifest);
    } catch (e) {
      console.warn(LOG, e);
    }
    return data;
  };

  function collectTracks(manifest) {
    let tracks = tracksByMovie.get(manifest.movieId);
    if (!tracks) tracksByMovie.set(manifest.movieId, (tracks = new Map()));
    for (const track of manifest.textTracks) {
      if (track.isNoneTrack || track.isForcedNarrative) continue;
      // manifest 只给 Netflix 推荐的几种语言带下载地址，其余语言 urls 为空，用到时再索取（见 requestUrls）
      const urls = textUrls(track);
      if (!urls.length && tracks.has(track.id)) continue;
      tracks.set(track.id, {
        id: track.id,
        language: track.language,
        label: track.languageDescription,
        isCC: track.rawTrackType === 'closedcaptions',
        rank: track.rank,
        urls,
      });
    }
  }

  function textUrls(track) {
    for (const format of TEXT_FORMATS) {
      const downloadable = track.downloadables && track.downloadables[format];
      if (downloadable && !downloadable.isImage && downloadable.urls && downloadable.urls.length) {
        return downloadable.urls.map(item => item.url);
      }
    }
    return [];
  }

  // 精确匹配优先，其次同一主语言（如选了 zh-Hans 而本片只有 zh-Hant）；同等条件下普通字幕优先于 CC
  function pickTrack(tracks, lang) {
    const base = lang.split('-')[0];
    const distance = track => (track.language === lang ? 0 : track.language.split('-')[0] === base ? 1 : -1);
    return [...tracks.values()]
      .filter(track => distance(track) >= 0)
      .sort((a, b) => distance(a) - distance(b) || a.isCC - b.isCC || a.rank - b.rank)[0];
  }

  // ---- 字幕下载与解析 ----

  async function fetchCues(track) {
    // 同一份字幕有多个 CDN 地址，逐个尝试
    for (const url of track.urls) {
      try {
        const response = await fetch(url);
        if (response.ok) return parseTtml(await response.text());
      } catch (e) {
        console.warn(LOG, e);
      }
    }
    throw new Error(`字幕下载失败：${track.label}`);
  }

  function parseTtml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const tickRate = Number(doc.documentElement.getAttribute('ttp:tickRate'));
    const toMs = ticks => (parseInt(ticks, 10) / tickRate) * 1000;

    // 多行台词在 imsc1.1 / dfxp 里被拆成同一时间的多个 <p>，文件顺序不等于上下顺序，要按 region 的纵坐标排
    const regionTop = new Map();
    for (const region of doc.getElementsByTagNameNS('*', 'region')) {
      const origin = region.getAttribute('tts:origin') || '';
      regionTop.set(region.getAttribute('xml:id'), parseFloat(origin.split(' ')[1]) || 0);
    }

    const cues = [];
    for (const p of doc.getElementsByTagNameNS('*', 'p')) {
      const text = nodeText(p)
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');
      if (!text) continue;
      cues.push({
        start: toMs(p.getAttribute('begin')),
        end: toMs(p.getAttribute('end')),
        top: regionTop.get(p.getAttribute('region')) || 0,
        text,
      });
    }
    return cues.sort((a, b) => a.start - b.start || a.top - b.top);
  }

  function nodeText(node) {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.nodeValue;
      else if (child.localName === 'br') text += '\n';
      else text += nodeText(child);
    }
    return text;
  }

  function textAt(cues, ms) {
    let text = '';
    for (const cue of cues) {
      if (cue.start > ms) break;
      if (ms < cue.end) text += (text ? '\n' : '') + cue.text;
    }
    return text;
  }

  // ---- 字幕层（挂在播放器元素里，随视频区域缩放） ----

  function el(tag, props, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  const style = el('style', { textContent: CSS });
  const toastEl = el('div', { className: 'nds-toast' });
  const lineEls = DEFAULTS.lines.map(() => el('div', { className: 'nds-line' }));
  const root = el('div', { className: 'nds-root' }, toastEl, el('div', { className: 'nds-subs' }, ...lineEls));

  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.textContent = ''), 2500);
  }

  function applyStyle() {
    const font = FONTS[settings.font] || FONTS.default;
    root.style.setProperty('--nds-font', font.family);
    root.style.setProperty('--nds-weight', settings.bold ? 600 : 400);
    root.style.setProperty('--nds-background', settings.background);
    root.style.setProperty('--nds-bottom', `${settings.bottom}%`);
    settings.lines.forEach((line, i) => {
      lineEls[i].style.fontSize = `${line.size}cqh`;
      lineEls[i].style.color = line.color;
    });
  }

  // 设置改动后的统一出口：保存、套用样式、把值写回面板控件
  function commit() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    controlRefreshers.forEach(refresh => refresh());
    applyStyle();
    sync();
  }

  // ---- 设置面板（挂在全屏元素或 body 上，否则会被 Netflix 的控制层挡住点击） ----

  const controlRefreshers = [];

  // 把一个表单控件和 settings 里的一个值双向绑定
  function bind(control, get, set) {
    const key = control.type === 'checkbox' ? 'checked' : 'value';
    controlRefreshers.push(() => (control[key] = get()));
    control.addEventListener('input', () => {
      set(control.type === 'range' ? Number(control[key]) : control[key]);
      commit();
    });
    return control;
  }

  function row(label, ...controls) {
    return el('div', { className: 'nds-row' }, el('span', { textContent: label }), ...controls);
  }

  const langSelects = settings.lines.map((_, i) => {
    const select = el('select');
    select.addEventListener('input', () => {
      settings.lines[i].lang = select.value;
      commit();
    });
    return select;
  });

  const panel = el(
    'div',
    { className: 'nds-panel', hidden: true },
    el(
      'div',
      { className: 'nds-row nds-head' },
      el('strong', { textContent: '双语字幕' }),
      bind(
        el('input', { type: 'checkbox', title: '开关（Alt+D）' }),
        () => settings.enabled,
        value => (settings.enabled = value)
      ),
      el('button', { className: 'nds-close', textContent: '×', onclick: () => togglePanel(false) })
    ),
    ...settings.lines.flatMap((_, i) => [
      el('div', { className: 'nds-group', textContent: i === 0 ? '上行' : '下行' }),
      row(
        '语言',
        langSelects[i],
        bind(
          el('input', { type: 'color', title: '颜色' }),
          () => settings.lines[i].color,
          value => (settings.lines[i].color = value)
        )
      ),
      row(
        '字号',
        bind(
          el('input', { type: 'range', ...SIZE_RANGE }),
          () => settings.lines[i].size,
          value => (settings.lines[i].size = value)
        )
      ),
    ]),
    el('div', { className: 'nds-group', textContent: '整体' }),
    row(
      '字体',
      bind(
        el('select', {}, ...Object.entries(FONTS).map(([value, font]) => el('option', { value, textContent: font.label }))),
        () => settings.font,
        value => (settings.font = value)
      )
    ),
    row(
      '加粗',
      bind(
        el('input', { type: 'checkbox' }),
        () => settings.bold,
        value => (settings.bold = value)
      )
    ),
    row(
      '背景',
      bind(
        el('input', { type: 'range', min: 0, max: 1, step: 0.05 }),
        () => settings.background,
        value => (settings.background = value)
      )
    ),
    row(
      '位置',
      bind(
        el('input', { type: 'range', min: 2, max: 60, step: 1 }),
        () => settings.bottom,
        value => (settings.bottom = value)
      )
    ),
    el('button', {
      textContent: '恢复默认',
      onclick: () => {
        Object.assign(settings, structuredClone(DEFAULTS));
        commit();
      },
    })
  );

  const button = el('button', {
    className: 'nds-button',
    textContent: '字',
    title: '双语字幕设置',
    onclick: () => togglePanel(panel.hidden),
  });
  const ui = el('div', { className: 'nds-ui' }, button, panel);

  // 面板里的操作不能漏给 Netflix，否则点一下会暂停、按方向键会快进
  for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'keypress', 'wheel']) {
    ui.addEventListener(type, event => event.stopPropagation());
  }

  function togglePanel(open) {
    panel.hidden = !open;
    ui.classList.toggle('nds-open', open);
    document.documentElement.classList.toggle('nds-panel-open', open);
    if (open) sync();
  }

  // 语言下拉框只在可选项变化时重建，避免打断正在展开的下拉框
  let shownLanguages = '';
  function refreshLanguages() {
    const tracks = session && tracksByMovie.get(session.movieId);
    const languages = new Map(); // 语言码 -> 显示名
    if (tracks) {
      for (const track of [...tracks.values()].sort((a, b) => a.rank - b.rank)) {
        if (!languages.has(track.language)) languages.set(track.language, track.label);
      }
    }
    const current = settings.lines.map(line => line.lang);
    const signature = [...languages.keys(), '|', ...current].join(',');
    if (signature === shownLanguages) return;
    shownLanguages = signature;

    langSelects.forEach((select, i) => {
      const options = [['', '不显示'], ...languages];
      if (current[i] && !languages.has(current[i])) {
        const fallback = tracks && pickTrack(tracks, current[i]);
        options.push([current[i], fallback ? `${current[i]}（用${fallback.label}代替）` : `${current[i]}（本片没有）`]);
      }
      select.replaceChildren(...options.map(([value, label]) => el('option', { value, textContent: label })));
      select.value = current[i];
    });
  }

  let idleTimer;
  document.addEventListener(
    'mousemove',
    () => {
      ui.classList.add('nds-awake');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => ui.classList.remove('nds-awake'), 3000);
    },
    true
  );

  // ---- 播放会话 ----

  // 当前播放页会话：{ id, player, movieId, warned, requesting, lines: [{ track, cues, shown }] }
  let session = null;

  function findWatchSession() {
    try {
      const videoPlayer = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
      // 首页预告片等也是播放器会话，只有正片的会话 id 以 watch 开头
      const id = videoPlayer.getAllPlayerSessionIds().find(sessionId => sessionId.startsWith('watch'));
      return id ? { id, player: videoPlayer.getVideoPlayerBySessionId(id) } : null;
    } catch (e) {
      return null;
    }
  }

  function sync() {
    const found = findWatchSession();
    const movieId = found && found.player.getMovieId();
    if (!found || !session || session.id !== found.id || session.movieId !== movieId) {
      lineEls.forEach(lineEl => (lineEl.textContent = ''));
      session = found && {
        ...found,
        movieId,
        warned: '',
        lines: settings.lines.map(() => ({ track: null, cues: null, shown: '' })),
      };
    }
    if (!session) {
      root.remove();
      ui.remove();
      if (!panel.hidden) togglePanel(false);
      document.documentElement.classList.remove('nds-hide-native');
      return;
    }

    if (!style.isConnected) document.head.appendChild(style);
    const host = session.player.getElement();
    if (host && root.parentNode !== host) host.appendChild(root);
    // 全屏时只有全屏元素内部可见
    const uiHost = document.fullscreenElement || document.body;
    if (ui.parentNode !== uiHost) uiHost.appendChild(ui);

    const tracks = tracksByMovie.get(session.movieId);
    if (tracks) {
      const missing = [];
      session.lines.forEach((line, i) => {
        const { lang } = settings.lines[i];
        const track = lang && pickTrack(tracks, lang);
        if (track && track.urls.length) {
          if (line.track !== track) loadLine(line, track);
          return;
        }
        line.track = line.cues = null;
        if (track) {
          if (!track.requested && !session.requesting) requestUrls(session, track);
        } else if (lang) {
          missing.push(lang);
        }
      });
      const warning = missing.join('、');
      if (warning && warning !== session.warned) toast(`本片没有这种字幕：${warning}`);
      session.warned = warning;
    }
    if (!panel.hidden) refreshLanguages();

    // 自己的字幕就绪后才隐藏原生字幕，避免两边都没有
    const ready = settings.enabled && session.lines.some(line => line.cues);
    document.documentElement.classList.toggle('nds-hide-native', ready);
  }

  // Netflix 只在某条字幕轨被选为原生字幕时才下发它的下载地址：临时切过去触发下发，再切回用户原来的选择
  async function requestUrls(current, track) {
    const { player } = current;
    const target = player.getTimedTextTrackList().find(item => item.trackId === track.id);
    if (!target) return; // 播放器的轨道列表还没准备好，下一轮再试
    track.requested = true;
    current.requesting = true;
    const original = player.getTimedTextTrack();
    const switchTo = item => Promise.resolve(player.setTimedTextTrack(item)).catch(e => console.warn(LOG, e));
    await switchTo(target);
    await switchTo(original);
    current.requesting = false;
    if (!tracksByMovie.get(current.movieId).get(track.id).urls.length) toast(`没有拿到字幕：${track.label}`);
  }

  async function loadLine(line, track) {
    // 同一条轨道只是换了新地址（manifest 重发）时，保留已有字幕直到新的下载完成
    if (!line.track || line.track.id !== track.id) line.cues = null;
    line.track = track;
    try {
      const cues = await fetchCues(track);
      if (line.track === track) line.cues = cues;
    } catch (e) {
      console.warn(LOG, e);
      toast(e.message);
    }
  }

  function render() {
    requestAnimationFrame(render);
    if (!session) return;
    const ms = session.player.getCurrentTime();
    session.lines.forEach((line, i) => {
      let text = settings.enabled && line.cues ? textAt(line.cues, ms) : '';
      // 调样式时没有台词就看不到效果，用语言名占位
      if (!text && !panel.hidden && settings.enabled && line.cues) text = line.track.label;
      if (text !== line.shown) lineEls[i].textContent = line.shown = text;
    });
  }

  window.addEventListener(
    'keydown',
    event => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.code === 'KeyD') {
        settings.enabled = !settings.enabled;
        toast(`双语字幕：${settings.enabled ? '开' : '关'}`);
      } else if (event.code === 'Equal' || event.code === 'Minus') {
        const step = event.code === 'Equal' ? 0.2 : -0.2;
        for (const line of settings.lines) {
          const size = Math.round((line.size + step) * 10) / 10;
          line.size = Math.min(SIZE_RANGE.max, Math.max(SIZE_RANGE.min, size));
        }
        toast(`字号 ${settings.lines.map(line => line.size).join(' / ')}`);
      } else {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      commit();
    },
    true
  );

  document.addEventListener('fullscreenchange', sync);
  controlRefreshers.forEach(refresh => refresh());
  applyStyle();
  setInterval(sync, 500);
  requestAnimationFrame(render);
})();
