/* First-party UTM passthrough.
   Copies utm_source, utm_medium, utm_campaign, and utm_content from this
   page's query string onto same-origin links to consult.html.
   No cookies, no storage, no third-party scripts. Failures are silent.
   This file is not a dependency of the consult form handler. */
(function () {
  'use strict';
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

  function sanitizeUtm(raw) {
    return String(raw || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
  }

  function collectPageUtms() {
    var params = new URLSearchParams(window.location.search);
    var kept = [];
    var i, k, v;
    for (i = 0; i < UTM_KEYS.length; i++) {
      k = UTM_KEYS[i];
      v = sanitizeUtm(params.get(k));
      if (v) kept.push([k, v]);
    }
    return kept;
  }

  function isConsultPath(path) {
    var p = String(path || '').replace(/\/+$/, '');
    return /(?:^|\/)consult\.html$/.test(p);
  }

  function rewriteHref(href, utms) {
    var u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin) return href;
    if (!isConsultPath(u.pathname)) return href;
    var i;
    for (i = 0; i < utms.length; i++) {
      if (!u.searchParams.has(utms[i][0])) u.searchParams.set(utms[i][0], utms[i][1]);
    }
    var orig = String(href);
    if (/^[a-z][a-z0-9+.-]*:/i.test(orig)) return u.origin + u.pathname + u.search + u.hash;
    if (orig.charAt(0) === '/') return u.pathname + u.search + u.hash;
    var rel = orig.split('#')[0].split('?')[0];
    return rel + u.search + u.hash;
  }

  try {
    var utms = collectPageUtms();
    if (!utms.length) return;
    var links = document.querySelectorAll('a[href]');
    var i, a, before;
    for (i = 0; i < links.length; i++) {
      try {
        a = links[i];
        before = a.getAttribute('href');
        if (!before) continue;
        a.setAttribute('href', rewriteHref(before, utms));
      } catch (one) {}
    }
  } catch (e) {}
})();
