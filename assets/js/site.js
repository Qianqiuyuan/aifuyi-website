/* ==========================================================================
   AIFUYI — page behaviour
   Navigation, scroll reveal, the quality-document carousel, and deep-link
   presets into the inquiry builder. Nothing here is required for the page to
   be readable; every part degrades to plain content if it fails.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── mobile navigation ──────────────────────────────────────────────── */
  var burger = $('#burger');
  var nav = $('#nav');

  function setNav(open) {
    if (!nav || !burger) return;
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      setNav(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !burger.contains(e.target)) {
        setNav(false);
      }
    });
  }

  /* ── reveal on scroll ───────────────────────────────────────────────── */
  var revealables = $$('[data-reveal]');
  if ('IntersectionObserver' in window && revealables.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── header state ───────────────────────────────────────────────────── */
  var hdr = $('#hdr');
  if (hdr) {
    var onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      hdr.classList.toggle('is-scrolled', y > 12);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── the "?" next to the price band ─────────────────────────────────── */
  var bandHelp = $('#bandHelp');
  var sumBand = $('#sumBand');
  if (bandHelp && sumBand) {
    var pop = document.createElement('div');
    pop.className = 'band-pop';
    pop.hidden = true;
    pop.innerHTML =
      'Material and machine time are the cheap half. Tooling amortisation is what makes ' +
      '3,000 pieces cost noticeably more per unit than 30,000. The band is built from our ' +
      'own rate card, not from a published price list — your drawing decides the rest.';
    sumBand.appendChild(pop);

    bandHelp.setAttribute('aria-expanded', 'false');
    bandHelp.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = pop.hidden;
      pop.hidden = !open;
      bandHelp.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !sumBand.contains(e.target)) {
        pop.hidden = true;
        bandHelp.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── quality document carousel ──────────────────────────────────────
     Manual only: no autoplay. An autoplaying certificate carousel on a
     B2B page reads as a banner ad, and it moves the document away while
     somebody is reading it.
     ──────────────────────────────────────────────────────────────────── */
  var track = $('#carTrack');
  if (track) {
    var slides = $$('.car-slide', track);
    var prevBtn = $('.car-arrow.prev');
    var nextBtn = $('.car-arrow.next');
    var dotsBox = $('#carDots');
    var capEl = $('#carCap');
    var nowEl = $('#carNow');
    var totalEl = $('#carTotal');
    var index = 0;

    var caps = slides.map(function (s) { return s.getAttribute('data-cap') || ''; });

    if (totalEl) totalEl.textContent = String(slides.length);
    if (capEl) {
      capEl.setAttribute('aria-live', 'polite');
      capEl.textContent = caps[0] || '';
    }

    /* dots */
    var dots = [];
    if (dotsBox) {
      caps.forEach(function (cap, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'car-dot';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', cap || ('Document ' + (i + 1)));
        b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () { go(i); });
        dotsBox.appendChild(b);
        dots.push(b);
      });
    }

    function go(i) {
      if (!slides.length) return;
      index = ((i % slides.length) + slides.length) % slides.length;
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
      if (nowEl) nowEl.textContent = String(index + 1);
      if (capEl) capEl.textContent = caps[index] || '';
      dots.forEach(function (d, k) {
        d.setAttribute('aria-selected', k === index ? 'true' : 'false');
      });
      slides.forEach(function (s, k) {
        s.setAttribute('aria-hidden', k === index ? 'false' : 'true');
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });

    var car = $('#docCar');
    if (car) {
      car.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      });
    }

    /* swipe — pointer events cover mouse drag, touch and pen in one path */
    var startX = null, startY = null, dragging = false;
    var view = $('.car-view');
    if (view) {
      view.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        startX = e.clientX; startY = e.clientY; dragging = true;
      });
      view.addEventListener('pointerup', function (e) {
        if (!dragging || startX === null) return;
        dragging = false;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        startX = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? index + 1 : index - 1);
      });
      view.addEventListener('pointercancel', function () { dragging = false; startX = null; });
      /* a drag across a slide should not start a native image drag */
      view.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    go(0);
  }

  /* ── presets from the product cards ─────────────────────────────────── */
  var PRESETS = {
    'wheel-bolt': { product: 'Wheel bolt', notes: '' },
    'ujoint': {
      product: 'Other custom fastener',
      notes: 'Universal joint / cross bearing assembly. Drawing and annual volume to follow.'
    },
    'tierod': {
      product: 'Other custom fastener',
      notes: 'Tie rod end / ball joint. Drawing and annual volume to follow.'
    },
    'custom': { product: 'Other custom fastener', notes: '' }
  };

  window.RFQPreset = function (key) {
    var preset = PRESETS[key];
    var target = document.getElementById('rfq');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (!preset || !window.RFQ) return;

    window.RFQ.set('product', preset.product);

    var notes = document.getElementById('rfqNotes');
    if (notes && preset.notes && !notes.value.trim()) {
      notes.value = preset.notes;
      window.RFQ.set('notes', preset.notes);
    }

    /* Draw the eye to the first step that still needs an answer. */
    setTimeout(function () {
      var order = ['size', 'pitch', 'length', 'seat', 'material', 'finish', 'qty'];
      var firstEmpty = null;
      order.some(function (g) {
        if (!window.RFQ.state[g]) { firstEmpty = g; return true; }
        return false;
      });
      var box = firstEmpty && document.querySelector('[data-group="' + firstEmpty + '"]');
      if (box) {
        var step = box.closest('.step') || box;
        step.classList.add('is-nudge');
        var chip = box.querySelector('.chip:not(:disabled)');
        if (chip) chip.focus({ preventScroll: true });
        setTimeout(function () { step.classList.remove('is-nudge'); }, 2400);
      }
    }, 420);
  };

  /* ── anchor offset for the sticky header ────────────────────────────── */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { history.replaceState(null, '', id); } catch (err) { /* file:// and some webviews refuse this */ }
    });
  });
})();
