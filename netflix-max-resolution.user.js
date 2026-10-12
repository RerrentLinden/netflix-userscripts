// ==UserScript==
// @name         Netflix Max Resolution
// @name:zh-CN   Netflix 锁定最高分辨率
// @namespace    https://github.com/RerrentLinden/netflix-userscripts
// @version      1.0.0
// @description  Keep Netflix at the highest resolution it offers this browser instead of letting it adapt down.
// @description:zh-CN 让 Netflix 始终使用当前浏览器能拿到的最高分辨率，不再自适应降档。
// @match        https://www.netflix.com/*
// @homepageURL  https://github.com/RerrentLinden/netflix-userscripts
// @supportURL   https://github.com/RerrentLinden/netflix-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-max-resolution.user.js
// @updateURL    https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-max-resolution.user.js
// @license      MIT
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // 分辨率上限（视频高度）。只能在 Netflix 下发给当前浏览器的档位里挑，拿不到的档位无法解锁：
  // Chrome / Firefox 最高 1080p；4K 需要 Edge（Windows）或 Safari（macOS）加高级套餐
  const MAX_HEIGHT = 2160;
  const LOG = '[锁定分辨率]';

  // 播放器拿到的 manifest（MSL 解密后）都会走 JSON.parse；删掉其中较低分辨率的视频流，播放器就只能选剩下的
  const nativeParse = JSON.parse;
  JSON.parse = function () {
    const data = nativeParse.apply(this, arguments);
    try {
      const manifest = data && data.result;
      if (manifest && manifest.movieId && Array.isArray(manifest.videoTracks)) {
        manifest.videoTracks.forEach(lockTrack);
      }
    } catch (e) {
      console.warn(LOG, e);
    }
    return data;
  };

  function lockTrack(track) {
    if (!Array.isArray(track.streams) || !track.streams.length) return;
    const heights = track.streams.map(stream => stream.resH);
    const allowed = heights.filter(height => height <= MAX_HEIGHT);
    // 所有档位都高于上限时退回最低一档，保证至少有流可播
    const target = allowed.length ? Math.max(...allowed) : Math.min(...heights);
    // 同一分辨率通常有多档码率，全部保留，播放器仍可按网速在其中切换
    track.streams = track.streams.filter(stream => stream.resH === target);
    console.info(LOG, `${target}p，保留 ${track.streams.length}/${heights.length} 条视频流`);
  }
})();
