/*
 * Lantern marketing site: forms, CRM submit, analytics.
 * Shared by / and /pilot/.
 *
 * ===================== CONFIGURE HERE =====================
 * WEBHOOK_URL: GoHighLevel (GHL) inbound webhook URL. While empty, the live site shows the mailto
 *              fallback on submit; on localhost submissions are only logged
 *              to the console (add ?crm=1 to really send).
 * GA_ID:       Google Analytics 4 measurement ID, e.g. 'G-XXXXXXXXXX'.
 *              While empty, no analytics script is loaded at all.
 * ==========================================================
 */
const WEBHOOK_URL = '';
const GA_ID = '';

(function () {
  'use strict';

  var CONTACT_EMAIL = 'hello@lanternbook.org';
  var FIRST_REF_KEY = 'lantern-first-ref';

  /* ---------- Google Analytics loader ----------
   * Only runs when GA_ID is set. Never send email addresses or free text
   * to analytics: trackEvent() is called with fixed labels only.
   */
  if (GA_ID) {
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(gaScript);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function trackEvent(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (e) { /* analytics must never break the page */ }
  }

  /* ---------- First-touch source ---------- */

  function readFirstRef() {
    try {
      var raw = window.localStorage.getItem(FIRST_REF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function currentTouch() {
    var params = new URLSearchParams(window.location.search);
    var referrerHost = '';
    try {
      if (document.referrer) {
        var host = new URL(document.referrer).hostname;
        if (host && host !== window.location.hostname) referrerHost = host;
      }
    } catch (e) { /* ignore bad referrer */ }
    return {
      referrer: referrerHost,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      landingPage: window.location.pathname,
      firstSeenAt: new Date().toISOString()
    };
  }

  var firstRef = readFirstRef();
  if (!firstRef) {
    firstRef = currentTouch();
    try {
      window.localStorage.setItem(FIRST_REF_KEY, JSON.stringify(firstRef));
    } catch (e) { /* storage blocked: keep the in-memory copy for this visit */ }
  }

  /* ---------- CRM submit ---------- */

  function crmForcedOn() {
    try {
      return new URLSearchParams(window.location.search).get('crm') === '1';
    } catch (e) {
      return false;
    }
  }

  function submitToCRM(payload) {
    var host = window.location.hostname;
    var isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal && !crmForcedOn()) {
      console.info('[Lantern] CRM submit skipped (local preview). Payload:', payload);
      return Promise.resolve({ skipped: true });
    }
    // On the live site a missing webhook must fail loudly (mailto fallback),
    // never show a thank-you for a sign-up that went nowhere.
    if (!WEBHOOK_URL) return Promise.reject(new Error('WEBHOOK_URL not set'));
    // Same shape as jointlc.org's GHL inbound webhook, which accepts JSON from the browser.
    return fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function (res) {
      if (!res.ok) throw new Error('CRM responded ' + res.status);
      return { ok: true };
    });
  }

  function basePayload(event, email) {
    return {
      event: event,
      email: email,
      page: window.location.pathname,
      source: firstRef,
      submittedAt: new Date().toISOString()
    };
  }

  /* ---------- Form UI ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setError(form, show) {
    var box = form.querySelector('.form-error');
    if (!box) return;
    box.innerHTML = show
      ? 'Something went wrong sending that. Please try again, or email us at <a href="mailto:' +
        CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>.'
      : '';
  }

  function showThanks(form, title, body) {
    var slot = form.closest('.form-slot');
    var live = slot ? slot.querySelector('.form-thanks') : null;
    form.hidden = true;
    if (live) {
      live.classList.add('form-thanks-card');
      live.setAttribute('tabindex', '-1');
      live.innerHTML = '<strong>' + escapeHtml(title) + '</strong>' + escapeHtml(body);
      try { live.focus({ preventScroll: true }); } catch (e) { live.focus(); }
    }
  }

  function handle(form, buildPayload, onSuccess) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      setError(form, false);
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      var label = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
      submitToCRM(buildPayload())
        .then(function () { onSuccess(); })
        .catch(function (err) {
          console.warn('[Lantern] CRM submit failed', err);
          if (button) {
            button.disabled = false;
            button.textContent = label;
          }
          setError(form, true);
        });
    });
  }

  function value(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  // Waitlist forms (home: hero + footer)
  Array.prototype.forEach.call(document.querySelectorAll('form.js-waitlist'), function (form) {
    var which = form.getAttribute('data-form') === 'footer' ? 'footer' : 'hero';
    handle(form, function () {
      var p = basePayload('waitlist', value(form, 'email'));
      p.form = which;
      return p;
    }, function () {
      trackEvent('sign_up', { method: 'waitlist', form: which });
      showThanks(form, "You're on the list.", ' We will send one email when Lantern is ready for families. Nothing else.');
    });
  });

  // Pilot application form
  Array.prototype.forEach.call(document.querySelectorAll('form.js-pilot'), function (form) {
    handle(form, function () {
      var p = basePayload('pilot_application', value(form, 'email'));
      p.name = value(form, 'name');
      p.organization = value(form, 'organization');
      p.orgType = value(form, 'orgType');
      p.kids = value(form, 'kids');
      return p;
    }, function () {
      // org_type is a fixed select value, never free text.
      trackEvent('generate_lead', { form: 'pilot', org_type: value(form, 'orgType') });
      showThanks(form, 'Thank you. Your application is in.', ' We read every one, and we will reply to you personally.');
    });
  });

  // Exposed for debugging in the console only.
  window.Lantern = { submitToCRM: submitToCRM, trackEvent: trackEvent };
})();
