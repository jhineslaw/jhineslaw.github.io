/* Request-a-consult form (names-only pre-engagement capture).
   Default: mailto (opens the visitor's email app; working fallback).
   Option (b) drop-in, NOT ACTIVE: set FORM_MODE = 'gform' and fill GFORM (see FORM-OPTIONS.md). */
(function () {
  'use strict';
  var FORM_MODE = 'mailto'; // 'mailto' (default) | 'gform' (option b; only after approval)
  var MAILTO_TO = 'lawoffice@jhineslaw.com';
  // cc order = drop order if a long request would exceed MAILTO_MAX (grokbot cc dropped first, then Gmail). See FORM-OPTIONS.md.
  var MAILTO_CC = ['zd14c5tj+lawoffice@mail.grokbot.com', 'attyjasonrhines@gmail.com'];
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
    $('cr-imm-notice').hidden = m !== 'Immigration';
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
      time: val('time'), ack: form.elements.ack.checked
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
    if ([d.time, d.parties.join(' '), d.othertype].some(sensitive)) return fail('Please remove any Social Security number or A-number.', form.elements.time);
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
      'Acknowledgment checked: Yes',
      'Source: jhineslaw.com consult request form'
    ];
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var d = collect();
    if (validate(d) !== true) return;
    var subject = '[INTAKE ACTION] ' + matterLabel(d) + ' \u2014 ' + d.county + ' \u2014 ' + d.first + ' ' + d.last;
    if (FORM_MODE === 'gform' && GFORM.action) {
      var b = new URLSearchParams();
      var flat = { first: d.first, last: d.last, phone: d.phone, email: d.email, matter: d.matter,
               othertype: d.othertype, county: d.county, parties: d.parties.join('; '), language: d.language,
               interp: d.interp, interplang: d.interplang, time: d.time, ack: 'Yes' };
      Object.keys(GFORM.fields).forEach(function (k) { if (flat[k] !== undefined) b.append(GFORM.fields[k], flat[k]); });
      fetch(GFORM.action, { method: 'POST', mode: 'no-cors', body: b })
        .then(function () { finish(); })
        .catch(function () { fail('Something went wrong. Please call (865) 590-6079 or email lawoffice@jhineslaw.com.'); });
      return;
    }
    var q = 'subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyLines(d).join('\r\n'));
    var cc = MAILTO_CC.slice(), href;
    do {
      href = 'mailto:' + MAILTO_TO + '?' + (cc.length ? 'cc=' + cc.map(encodeURIComponent).join(',') + '&' : '') + q;
    } while (href.length > MAILTO_MAX && cc.length && cc.shift());
    window.location.href = href;
    finish();
  });

  function finish() {
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }
})();
