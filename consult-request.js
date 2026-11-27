/* Request-a-consult form (names-only pre-engagement capture).
   Default: mailto (opens the visitor's email app; working fallback).
   Option (b) drop-in, NOT ACTIVE: set FORM_MODE = 'gform' and fill GFORM (see FORM-OPTIONS.md). */
(function () {
  'use strict';
  var FORM_MODE = 'mailto'; // 'mailto' (default) | 'gform' (option b; only after approval)
  var MAILTO_TO = 'lawoffice@jhineslaw.com';
  // No public cc (Marketing 6:32 PM CT): recipients other than lawoffice@ must not appear in page source. See FORM-OPTIONS.md.
  var MAILTO_CC = [];
  var MAILTO_MAX = 2000; // conservative mailto URL length budget (chars)
  var GFORM = { action: '', fields: {} }; // e.g. { action: 'https://docs.google.com/forms/d/e/<ID>/formResponse', fields: { first: 'entry.111', ... } }

  var form = document.getElementById('consult-request');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var err = $('cr-error'), done = $('cr-done');

  function val(n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el && el.focus) el.focus(); return false; }
  function sensitive(s) { return /\b\d{3}-?\d{2}-?\d{4}\b/.test(s) || /\bA-?\d{8,9}\b/i.test(s); }

  function sync() {
    var m = val('matter'), i = val('interp');
    $('cr-other-wrap').hidden = m !== 'Other';
    $('cr-interp-lang-wrap').hidden = i !== 'Yes';
  }
  form.addEventListener('change', sync);
  sync();

  function collect() {
    var parties = [1, 2, 3, 4, 5].map(function (n) { return val('party' + n); }).filter(Boolean);
    return {
      first: val('first'), last: val('last'), phone: val('phone'), email: val('email'),
      matter: val('matter'), othertype: val('othertype'), county: val('county'), parties: parties,
      language: val('language'), interp: val('interp'), interplang: val('interplang'),
      time: val('time'), hear: val('hear'), ack: form.elements.ack.checked,
      sms: !!(form.elements.sms && form.elements.sms.checked)
    };
  }
  function validate(d) {
    if (!d.first) return fail('Please enter your first name.', form.elements.first);
    if (!d.last) return fail('Please enter your last name.', form.elements.last);
    if (d.phone.replace(/\D/g, '').length < 10) return fail('Please enter a phone number we can call.', form.elements.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail('Please enter your email address.', form.elements.email);
    if (!d.matter) return fail('Please choose the type of matter.', form.elements.matter);
    if (d.matter === 'Other' && !d.othertype) return fail('Please give the type of matter (type only, not facts).', form.elements.othertype);
    if (!d.county) return fail('Please choose your county.', form.elements.county);
    if (!d.parties.length) return fail('Please list the other people or businesses involved, or write “none” or “I don\'t know.”', form.elements.party1);
    if (!d.language) return fail('Please choose a preferred language.', form.elements.language);
    if (!d.interp) return fail('Please tell us whether you may need an interpreter.', form.querySelector('input[name=interp]'));
    if ([d.time, d.hear, d.parties.join(' '), d.othertype].some(sensitive)) return fail('Please remove any Social Security number or A-number.', form.elements.time);
    if (!d.ack) return fail('Please check the box to confirm you understand.', form.elements.ack);
    return true;
  }
  function matterLabel(d) { return d.matter === 'Other' ? 'Other: ' + d.othertype : d.matter; }
  function bodyLines(d) {
    return [
      'First name: ' + d.first,
      'Last name: ' + d.last,
      'Phone: ' + d.phone,
      'Email: ' + d.email,
      'Type of matter: ' + matterLabel(d),
      'County: ' + d.county,
      'Other people or businesses involved: ' + d.parties.join('; '),
      'Preferred language: ' + d.language,
      'Interpreter needed: ' + d.interp + (d.interp === 'Yes' && d.interplang ? ' (' + d.interplang + ')' : ''),
      'Preferred days or times (request only): ' + (d.time || '-'),
      'How did you hear about us: ' + (d.hear || '-'),
      'Acknowledgment checked: Yes',
      'SMS consent: ' + (d.sms ? 'Yes' : 'No'),
      'Source: jhineslaw.com consult request form'
    ];
  }


  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

  function sanitizeUtm(raw) {
    return String(raw || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
  }

  function utmsFromSearch(search) {
    var out = {}, params, i, k, v;
    try {
      params = new URLSearchParams(search || '');
      for (i = 0; i < UTM_KEYS.length; i++) {
        k = UTM_KEYS[i];
        v = sanitizeUtm(params.get(k));
        if (v) out[k] = v;
      }
    } catch (e) {}
    return out;
  }

  function hasUtms(obj) {
    var i;
    if (!obj) return false;
    for (i = 0; i < UTM_KEYS.length; i++) {
      if (obj[UTM_KEYS[i]]) return true;
    }
    return false;
  }

  function readUtms() {
    var fromUrl, ref, refUrl;
    fromUrl = utmsFromSearch(window.location.search);
    if (hasUtms(fromUrl)) return fromUrl;
    ref = document.referrer;
    if (!ref) return {};
    refUrl = new URL(ref);
    if (refUrl.origin !== window.location.origin) return {};
    return utmsFromSearch(refUrl.search);
  }

  function linkTagsLine() {
    var u, parts, i, k;
    var labels = { utm_source: 'source', utm_medium: 'medium', utm_campaign: 'campaign', utm_content: 'content' };
    u = readUtms();
    if (!hasUtms(u)) return null;
    parts = [];
    for (i = 0; i < UTM_KEYS.length; i++) {
      k = UTM_KEYS[i];
      if (u[k]) parts.push(labels[k] + '=' + u[k]);
    }
    return parts.length ? ('Link tags: ' + parts.join('; ')) : null;
  }

  function formBodyText(d) {
    return bodyLines(d).join('\r\n');
  }

  function buildMailtoHref(subject, body, cc) {
    var q = 'subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return 'mailto:' + MAILTO_TO + '?' + (cc.length ? 'cc=' + cc.map(encodeURIComponent).join(',') + '&' : '') + q;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var d = collect();
    if (validate(d) !== true) return;
    var subject = 'Consultation request — ' + matterLabel(d) + ' \u2014 ' + d.county + ' \u2014 ' + d.first + ' ' + d.last;
    if (FORM_MODE === 'gform' && GFORM.action) {
      var b = new URLSearchParams();
      var flat = { first: d.first, last: d.last, phone: d.phone, email: d.email, matter: d.matter,
               othertype: d.othertype, county: d.county, parties: d.parties.join('; '), language: d.language,
               interp: d.interp, interplang: d.interplang, time: d.time, ack: 'Yes', sms: d.sms ? 'Yes' : 'No' };
      Object.keys(GFORM.fields).forEach(function (k) { if (flat[k] !== undefined) b.append(GFORM.fields[k], flat[k]); });
      fetch(GFORM.action, { method: 'POST', mode: 'no-cors', body: b })
        .then(function () { finish(); })
        .catch(function () { fail('Something went wrong. Please call (865) 590-6079 or email lawoffice@jhineslaw.com.'); });
      return;
    }
    var body, tagLine, cc, href, bodyForHref;
    try {
      body = formBodyText(d);
    } catch (e) {
      body = bodyLines(d).join('\r\n');
    }
    try {
      tagLine = linkTagsLine();
    } catch (e2) {
      tagLine = null;
    }
    cc = MAILTO_CC.slice();
    bodyForHref = tagLine ? (body + '\r\n' + tagLine) : body;
    href = buildMailtoHref(subject, bodyForHref, cc);
    // If the href exceeds the 2,000-character budget, drop the link-tags line first. Never block submit.
    if (href.length > MAILTO_MAX && tagLine) {
      bodyForHref = body;
      href = buildMailtoHref(subject, bodyForHref, cc);
    }
    while (href.length > MAILTO_MAX && cc.length) {
      cc.shift();
      href = buildMailtoHref(subject, bodyForHref, cc);
    }
    window.location.href = href;
    finish();
  });

  function finish() {
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }
})();
