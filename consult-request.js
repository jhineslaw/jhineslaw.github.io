/* Request-a-consult form. Default: mailto (opens the visitor's email app).
   Drop-in (option b, NOT ACTIVE): set FORM_MODE = 'gform' and fill GFORM below. */
(function () {
  'use strict';
  var FORM_MODE = 'mailto'; // 'mailto' (default) | 'gform' (option b; needs approval first)
  var MAILTO_TO = 'lawoffice@jhineslaw.com';
  var GFORM = { action: '', fields: { name: '', phone: '', email: '', matter: '', county: '', others: '', time: '', message: '' } };

  var form = document.getElementById('consult-request');
  if (!form) return;
  var err = document.getElementById('cr-error');
  var done = document.getElementById('cr-done');
  var doneMailto = document.getElementById('cr-done-mailto');

  function val(n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el) el.focus(); }
  function looksSensitive(s) { return /\b\d{3}-?\d{2}-?\d{4}\b/.test(s) || /\bA-?\d{8,9}\b/i.test(s); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var d = { name: val('name'), phone: val('phone'), email: val('email'), matter: val('matter'),
              county: val('county'), others: val('others'), time: val('time'), message: val('message') };
    if (!d.name) return fail('Please enter your name.', form.elements.name);
    if (!d.phone && !d.email) return fail('Please give a phone number or an email address.', form.elements.phone);
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail('Please check your email address.', form.elements.email);
    if (d.phone && d.phone.replace(/\D/g, '').length < 10) return fail('Please check your phone number.', form.elements.phone);
    if (!d.matter) return fail('Please choose the type of matter.', form.elements.matter);
    if (looksSensitive(d.message) || looksSensitive(d.others)) return fail('Please remove any Social Security number or A-number. We only need names and how to reach you.', form.elements.message);

    if (FORM_MODE === 'gform' && GFORM.action) {
      var body = new URLSearchParams();
      Object.keys(GFORM.fields).forEach(function (k) { if (GFORM.fields[k]) body.append(GFORM.fields[k], d[k]); });
      fetch(GFORM.action, { method: 'POST', mode: 'no-cors', body: body })
        .then(function () { finish(false); })
        .catch(function () { fail('Something went wrong. Please call (865) 590-6079 or email lawoffice@jhineslaw.com.'); });
      return;
    }
    var lines = [
      'Consultation request (sent from jhineslaw.com)', '',
      'Name: ' + d.name,
      'Phone: ' + (d.phone || '-'),
      'Email: ' + (d.email || '-'),
      'Type of matter: ' + d.matter,
      'County: ' + (d.county || '-'),
      'Other people involved: ' + (d.others || '-'),
      'Best time to contact: ' + (d.time || 'No preference'),
      'Message: ' + (d.message || '-')
    ];
    var href = 'mailto:' + MAILTO_TO +
      '?subject=' + encodeURIComponent('Consultation request: ' + d.matter + ' - ' + d.name) +
      '&body=' + encodeURIComponent(lines.join('\r\n'));
    window.location.href = href;
    finish(true);
  });

  function finish(isMailto) {
    form.hidden = true;
    doneMailto.hidden = !isMailto;
    done.hidden = false;
    done.focus();
  }
})();
