/* ==========================================================================
   AIFUYI — inquiry builder
   Turns the chip selection into one complete specification, then hands it to
   the buyer's own email client or WhatsApp. No backend, no upload, no cookie.

   ── To customise, edit CONFIG. Everything else follows from it. ──────────
   ========================================================================== */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────
     CONFIG — the only block you need to touch
     ───────────────────────────────────────────────────────────────────── */
  var CONFIG = {
    email: 'wenhui452324@gmail.com',
    whatsapp: '8618777323530',      // international format, digits only

    /* Order window. Anything outside this is refused by the builder and
       handled by a human instead — cheaper than quoting the impossible.   */
    moq: 3000,
    maxQty: 50000,

    /* Price indication.
       true  = show an indicative project band once the spec is complete
       false = hide the band entirely (the summary still works)

       The numbers below are PLACEHOLDERS. They are not derived from your
       cost sheet. Replace them with your own before this page goes public,
       or the first quote you send will contradict the website.            */
    showBand: true,

    /* Optional form endpoint (Formspree, Basin, your own PHP…).
       Leave empty to stay purely client-side. When set, the inquiry is also
       POSTed as JSON in the background so you get a copy even if the buyer
       closes their mail client without sending.                            */
    endpoint: ''
  };

  /* ─────────────────────────────────────────────────────────────────────
     Thread rules — ISO 261
     Not every pitch exists on every diameter. Letting a buyer pick M10 × 2.0
     produces an inquiry nobody can accept, so the impossible pairs are
     disabled in the UI rather than caught later in the inbox.
     ───────────────────────────────────────────────────────────────────── */
  var PITCH_RULE = {
    'M10': { ok: ['1.25', '1.5'],
             note: 'M10 is coarse 1.5 or fine 1.25 only. 1.75 and 2.0 do not exist for M10.' },
    'M12': { ok: ['1.25', '1.5', '1.75'],
             note: 'M12 is coarse 1.75, or fine 1.5 / 1.25. 2.0 does not exist for M12.' },
    'M14': { ok: ['1.25', '1.5', '2.0'],
             note: 'M14 is coarse 2.0, or fine 1.5 / 1.25. 1.75 is not an M14 pitch.' },
    'M16': { ok: ['1.5', '2.0'],
             note: 'M16 is coarse 2.0 or fine 1.5. 1.25 and 1.75 are not M16 pitches.' },
    'Other': { ok: ['1.25', '1.5', '1.75', '2.0'], note: '' }
  };

  /* Price model: USD per piece at the reference size, before multipliers. */
  var MATERIAL = {
    '40Cr, class 10.9':        { lo: 0.52, hi: 0.78, tool: 1.00 },
    'SCM435, class 12.9':      { lo: 0.66, hi: 0.98, tool: 1.08 },
    '35CrMo, class 12.9':      { lo: 0.72, hi: 1.05, tool: 1.12 },
    'AISI 304 stainless':      { lo: 0.92, hi: 1.35, tool: 1.22 },
    'AISI 316 stainless':      { lo: 1.18, hi: 1.72, tool: 1.30 },
    'Titanium Ti-6Al-4V':      { lo: 5.20, hi: 8.60, tool: 1.90 },
    'Other material':          { lo: 0.70, hi: 1.15, tool: 1.10 }
  };
  var PRODUCT   = { 'Wheel bolt': 1.00, 'Wheel nut': 0.94, 'Wheel stud': 1.06, 'Other custom fastener': 1.10 };
  var SEAT      = { 'Ball seat R12': 1.00, 'Ball seat R13': 1.02, 'Ball seat R14': 1.02,
                    'Cone seat 60°': 1.00, 'Flat seat with washer': 1.06, 'Tuner / spline drive': 1.12 };
  var FINISH    = { 'Black oxide': 1.00, 'Zinc flake, silver': 1.10, 'Zinc flake, black': 1.10,
                    'Zinc-nickel': 1.18, 'Bright chrome': 1.16, 'PVD black': 1.22,
                    'Other finish': 1.12 };
  var TOOLING   = { 'Wheel bolt': [420, 780], 'Wheel nut': [380, 700],
                    'Wheel stud': [320, 620], 'Other custom fastener': [500, 950] };

  /* Quantity curve — volume dilutes tooling and setup, not material.
     Anchored to the 3,000–50,000 window this shop actually runs. */
  var QTY_ANCHOR = [[3000, 1.18], [5000, 1.06], [10000, 0.95], [20000, 0.88], [50000, 0.80]];

  /* Local date, not UTC — the buyer's "today" is the one that matters on the ref. */
  var pad = function (n) { return String(n).length < 2 ? '0' + n : String(n); };
  var now = new Date();
  var REF = 'RFQ-' + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) +
            '-' + Math.random().toString(36).slice(2, 5).toUpperCase();

  var state = {
    product: '', size: '', pitch: '', sizeOther: '', pitchOther: '',
    length: '', lenCustom: '', seat: '', material: '', matOther: '',
    finish: '', finOther: '', qty: 0,
    incoterm: '', port: 'Ningbo', notes: '', who: '', where: ''
  };

  /* ─────────────────────────────────────────────────────────────────────
     DOM
     ───────────────────────────────────────────────────────────────────── */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var steps    = $('#rfqSteps');
  var sumSpec  = $('#sumSpec');
  var sumBand  = $('#sumBand');
  var bandVal  = $('#bandVal');
  var bandNote = $('#bandNote');
  var sumLead  = $('#sumLead');
  var sumRefEl = $('#sumRef');
  var sumAddr  = $('#sumAddr');
  var btnEmail = $('#btnEmail');
  var sendMenu = $('#sendMenu');
  var btnWa    = $('#btnWa');
  var btnCopy  = $('#btnCopy');
  var btnPrint = $('#btnPrint');
  var sheet    = $('#printSheet');

  if (!steps || !sumSpec) return;

  var qtyInput    = $('#rfqQty');
  var qtyErr      = $('#qtyErr');
  var lenInput    = $('#rfqLen');
  var incotermSel = $('#rfqIncoterm');
  var portField   = $('#portField');
  var portSel     = $('#rfqPort');
  var notesInput  = $('#rfqNotes');
  var whoInput    = $('#rfqWho');
  var whereInput  = $('#rfqWhere');

  var sizeOtherIn  = $('#rfqSizeOther');
  var pitchOtherIn = $('#rfqPitchOther');
  var matOtherIn   = $('#rfqMatOther');
  var finOtherIn   = $('#rfqFinOther');

  var wrapSizeOther  = $('#wrapSizeOther');
  var wrapPitchOther = $('#wrapPitchOther');
  var wrapMatOther   = $('#wrapMatOther');
  var wrapFinOther   = $('#wrapFinOther');

  var pitchChips = $('#pitchChips');
  var pitchNote  = $('#pitchNote');

  if (sumRefEl) sumRefEl.textContent = REF;
  if (sumAddr)  sumAddr.textContent  = CONFIG.email;

  /* ─────────────────────────────────────────────────────────────────────
     Selection
     ───────────────────────────────────────────────────────────────────── */
  function digits(s) { return parseInt(String(s).replace(/\D/g, ''), 10) || 0; }
  function num(s) {
    var n = parseFloat(String(s).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function chipsOf(group) { return steps.querySelector('.chips[data-group="' + group + '"]'); }

  function paintGroup(group) {
    var box = chipsOf(group);
    if (!box) return;
    $$('.chip', box).forEach(function (c) {
      var v = c.getAttribute('data-v');
      var on = group === 'qty'
        ? digits(v) === state.qty
        : String(state[group]) === v;
      c.setAttribute('aria-pressed', String(on));
    });
  }

  function toggle(group, value) {
    return String(state[group]) === value ? '' : value;
  }

  function selectChip(chip, group) {
    if (chip.disabled) return;
    var v = chip.getAttribute('data-v');

    if (group === 'qty') {
      state.qty = digits(v);
      if (qtyInput) qtyInput.value = '';
    } else {
      state[group] = toggle(group, v);
      if (group === 'size') syncPitch();
      /* a preset length and a typed length are the same field — picking one
         must clear the other, or the summary keeps the stale number */
      if (group === 'length') {
        state.lenCustom = '';
        if (lenInput) lenInput.value = '';
      }
    }

    paintGroup(group);
    if (group === 'size') paintGroup('pitch');
    syncOtherInputs();
    update();
  }

  steps.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('.chip[data-v]') : null;
    if (!chip || !steps.contains(chip)) return;
    var box = chip.closest('.chips[data-group]');
    if (!box) return;
    selectChip(chip, box.getAttribute('data-group'));
  });

  /* ── pitch availability ─────────────────────────────────────────────── */
  function enableChip(c) {
    c.disabled = false;
    c.classList.remove('is-off');
    c.removeAttribute('aria-disabled');
    c.removeAttribute('title');
    var sm = c.querySelector('small');
    if (sm && c.hasAttribute('data-sm')) sm.textContent = c.getAttribute('data-sm');
  }

  function blockChip(c, reason) {
    var sm = c.querySelector('small');
    if (sm && !c.hasAttribute('data-sm')) c.setAttribute('data-sm', sm.textContent);
    c.disabled = true;
    c.classList.add('is-off');
    c.setAttribute('aria-disabled', 'true');
    c.title = reason;
    if (sm) sm.textContent = 'Not for ' + state.size;
  }

  function syncPitch() {
    var rule = PITCH_RULE[state.size];
    var blocked = 0;

    if (pitchChips) {
      $$('.chip', pitchChips).forEach(function (c) {
        var v = c.getAttribute('data-v');
        if (!rule || v === 'Other' || rule.ok.indexOf(v) > -1) {
          enableChip(c);
        } else {
          blockChip(c, rule.note);
          blocked++;
        }
      });
    }

    /* a pitch that was fine for M14 is impossible for M10 — drop it */
    if (rule && state.pitch && state.pitch !== 'Other' && rule.ok.indexOf(state.pitch) === -1) {
      state.pitch = '';
    }

    if (pitchNote) {
      pitchNote.hidden = !rule || !blocked;
      pitchNote.textContent = rule ? rule.note : '';
    }
  }

  function syncOtherInputs() {
    if (wrapSizeOther)  wrapSizeOther.hidden  = state.size !== 'Other';
    if (wrapPitchOther) wrapPitchOther.hidden = state.pitch !== 'Other';
    if (wrapMatOther)   wrapMatOther.hidden   = state.material !== 'Other material';
    if (wrapFinOther)   wrapFinOther.hidden   = state.finish !== 'Other finish';
  }

  /* ─────────────────────────────────────────────────────────────────────
     Inputs
     ───────────────────────────────────────────────────────────────────── */
  if (qtyInput) {
    qtyInput.addEventListener('input', function () {
      state.qty = digits(qtyInput.value);
      paintGroup('qty');
      update();
    });
  }
  if (lenInput) {
    lenInput.addEventListener('input', function () {
      state.lenCustom = lenInput.value.trim();
      /* typing overrides the preset buttons — keep the two in sync */
      if (state.lenCustom && state.length) {
        state.length = '';
        paintGroup('length');
      }
      update();
    });
  }
  if (sizeOtherIn)  sizeOtherIn.addEventListener('input',  function () { state.sizeOther  = sizeOtherIn.value.trim();  update(); });
  if (pitchOtherIn) pitchOtherIn.addEventListener('input', function () { state.pitchOther = pitchOtherIn.value.trim(); update(); });
  if (matOtherIn)   matOtherIn.addEventListener('input',   function () { state.matOther   = matOtherIn.value.trim();   update(); });
  if (finOtherIn)   finOtherIn.addEventListener('input',   function () { state.finOther   = finOtherIn.value.trim();   update(); });
  if (notesInput)   notesInput.addEventListener('input',   function () { state.notes      = notesInput.value.trim();   update(); });
  if (whoInput)     whoInput.addEventListener('input',     function () { state.who        = whoInput.value.trim();     update(); });
  if (whereInput)   whereInput.addEventListener('input',   function () { state.where      = whereInput.value.trim();   update(); });

  if (incotermSel) {
    incotermSel.addEventListener('change', function () {
      state.incoterm = incotermSel.value;
      /* FOB / CIF name a loading port; DDP and EXW do not. */
      var needsPort = state.incoterm === 'FOB' || state.incoterm === 'CIF';
      if (portField) portField.hidden = !needsPort;
      update();
    });
  }
  if (portSel) {
    portSel.addEventListener('change', function () {
      state.port = portSel.value;
      update();
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     Price indication
     ───────────────────────────────────────────────────────────────────── */
  function qtyFactor(q) {
    if (!q) return 1;
    if (q <= QTY_ANCHOR[0][0]) return QTY_ANCHOR[0][1];
    var last = QTY_ANCHOR[QTY_ANCHOR.length - 1];
    if (q >= last[0]) return last[1];
    for (var i = 0; i < QTY_ANCHOR.length - 1; i++) {
      var a = QTY_ANCHOR[i], b = QTY_ANCHOR[i + 1];
      if (q >= a[0] && q <= b[0]) {
        var t = (Math.log(q) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return 1;
  }

  function lengthFactor(l) {
    var mm = num(l);
    if (!mm) return 1;
    if (mm <= 30) return 1.00;
    if (mm <= 40) return 1.06;
    if (mm <= 50) return 1.14;
    if (mm <= 60) return 1.24;
    if (mm <= 70) return 1.34;
    if (mm <= 80) return 1.42;
    return 1.48;
  }

  function money(n) {
    return n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2);
  }
  function round10(n) { return Math.round(n / 10) * 10; }

  function band() {
    var m = MATERIAL[state.material];
    if (!m || !state.qty) return null;

    var k = (PRODUCT[state.product] || 1) * (SEAT[state.seat] || 1) *
            (FINISH[state.finish] || 1) * lengthFactor(lengthValue()) * qtyFactor(state.qty);

    var unitLo = m.lo * k, unitHi = m.hi * k;
    var tool   = TOOLING[state.product] || [420, 780];
    var toolLo = Math.round(tool[0] * m.tool / 10) * 10;
    var toolHi = Math.round(tool[1] * m.tool / 10) * 10;

    return {
      unitLo: unitLo, unitHi: unitHi,
      toolLo: toolLo, toolHi: toolHi,
      totalLo: round10(unitLo * state.qty + toolLo),
      totalHi: round10(unitHi * state.qty + toolHi)
    };
  }

  /* ─────────────────────────────────────────────────────────────────────
     Spec assembly
     ───────────────────────────────────────────────────────────────────── */
  function threadText() {
    var s = state.size, p = state.pitch;
    if (!s && !p) return '';
    if (s === 'Other') s = state.sizeOther || 'Other';
    if (p === 'Other') p = state.pitchOther || 'other pitch';
    if (!s) return 'Pitch ' + p;
    return p ? s + ' \u00d7 ' + p : s;
  }

  function lengthValue() {
    if (state.lenCustom) return state.lenCustom;
    if (state.length === 'Other length') return 'Other — to be confirmed';
    return state.length;
  }

  function materialText() {
    if (state.material === 'Other material') return state.matOther || 'Other material';
    return state.material;
  }

  function finishText() {
    if (state.finish === 'Other finish') return state.finOther || 'Other finish';
    return state.finish;
  }

  function deliveryText() {
    if (!state.incoterm) return '';
    if (state.incoterm === 'FOB' || state.incoterm === 'CIF') {
      return state.incoterm + ' ' + (state.port || 'Ningbo');
    }
    return state.incoterm;
  }

  function qtyProblem() {
    if (!state.qty) return '';
    if (state.qty < CONFIG.moq) return 'Minimum order is ' + CONFIG.moq.toLocaleString('en-US') + ' pcs.';
    if (state.qty > CONFIG.maxQty) return 'Above ' + CONFIG.maxQty.toLocaleString('en-US') +
      ' pcs — write to us and we will quote it as a separate programme.';
    return '';
  }

  function rows() {
    var out = [];
    var add = function (k, v) { if (v) out.push({ k: k, v: v }); };
    add('Product', state.product);
    add('Thread', threadText());
    add('Length under head', lengthValue());
    add('Seat / head', state.seat);
    add('Material', materialText());
    add('Finish', finishText());
    add('Quantity', state.qty ? state.qty.toLocaleString('en-US') + ' pcs' : '');
    add('Delivery', deliveryText());
    add('Notes', state.notes);
    add('Buyer', state.who);
    add('Destination', state.where);
    return out;
  }

  function complete() {
    return !!(state.product && state.size && state.pitch && lengthValue() && state.seat &&
              state.material && state.finish && state.qty && !qtyProblem());
  }

  function leadTime() {
    if (state.qty >= 20000) return '10–12 weeks';
    if (state.qty >= 5000)  return '9–11 weeks';
    return '8–10 weeks';
  }

  /* ─────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────── */
  function update() {
    var r = rows();
    var ok = complete();
    var problem = qtyProblem();

    if (qtyErr) qtyErr.textContent = problem;
    if (qtyInput && qtyInput.parentNode) {
      qtyInput.parentNode.classList.toggle('invalid', !!problem);
    }

    /* summary rows */
    if (!r.length) {
      sumSpec.innerHTML = '<div class="empty">Nothing selected yet — start with the product type.</div>';
    } else {
      sumSpec.innerHTML = r.map(function (x) {
        return '<div><span class="k">' + esc(x.k) + '</span><span class="v">' + esc(x.v) + '</span></div>';
      }).join('');
    }

    /* band */
    var b = CONFIG.showBand ? (ok ? band() : null) : null;
    if (sumBand) {
      sumBand.hidden = !b;
      if (b) {
        bandVal.textContent = 'US$ ' + money(b.totalLo) + ' – ' + money(b.totalHi);
        var caveat = (state.material === 'Other material' || state.finish === 'Other finish')
          ? 'Custom alloy or coating — this band is provisional until we confirm the spec<br>'
          : '';
        bandNote.innerHTML =
          caveat +
          'US$ ' + b.unitLo.toFixed(2) + ' – ' + b.unitHi.toFixed(2) + ' per piece at ' +
          state.qty.toLocaleString('en-US') + ' pcs<br>' +
          'Tooling US$ ' + money(b.toolLo) + ' – ' + money(b.toolHi) + ' one-off, included above<br>' +
          'Indicative only — ±25% until we see your drawing';
      } else if (CONFIG.showBand && !ok) {
        bandVal.textContent = '—';
        bandNote.textContent = problem || 'Complete steps 01–07 to see an indicative band.';
        sumBand.hidden = false;
      }
    }

    if (sumLead) sumLead.textContent = leadTime();

    /* CTA state */
    [btnEmail, btnWa, btnCopy, btnPrint].forEach(function (btn) {
      if (!btn) return;
      btn.disabled = false;
      btn.title = ok ? '' : 'You can send an incomplete spec — we will ask for the rest.';
    });

    buildSheet(r, b, ok);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     Plain-text spec (email body / WhatsApp message / clipboard)
     ───────────────────────────────────────────────────────────────────── */
  function plainSpec() {
    var L = [];
    L.push('INQUIRY ' + REF);
    L.push('');
    rows().forEach(function (x) { L.push(x.k + ': ' + x.v); });
    if (!rows().length) L.push('(no options selected yet)');
    L.push('');
    L.push('Lead time: ' + leadTime() + ', door to door');
    L.push('Reports with every lot: IATF 16949, material, tensile, salt spray, dimensional');
    L.push('');
    L.push('Drawing: attached to this message (' + (rows().length ? 'STEP / PDF / DXF' : 'pending') + ')');
    return L.join('\n');
  }

  function emailBody() {
    return plainSpec() + '\n\n—\nSent from the specification builder at yhaifuyi.com';
  }

  function emailSubject() {
    var bits = [state.product, threadText(), lengthValue(), state.qty ? state.qty + 'pcs' : '']
      .filter(Boolean).join(' · ');
    return 'RFQ ' + REF + (bits ? ' — ' + bits : '');
  }

  function waText() {
    return '*Inquiry ' + REF + '*\n' + plainSpec().replace(/^INQUIRY .*\n\n/, '');
  }

  /* ─────────────────────────────────────────────────────────────────────
     Sending — a mailto: only works if the visitor has a desktop mail client
     configured. Most buyers answering a Facebook or LinkedIn post are in a
     browser-only world, so the menu offers the web composers too.
     ───────────────────────────────────────────────────────────────────── */
  function mailtoHref() {
    return 'mailto:' + CONFIG.email +
      '?subject=' + encodeURIComponent(emailSubject()) +
      '&body=' + encodeURIComponent(emailBody());
  }

  function webCompose(kind) {
    var to = encodeURIComponent(CONFIG.email);
    var su = encodeURIComponent(emailSubject());
    var body = encodeURIComponent(emailBody());
    if (kind === 'gmail')   return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + su + '&body=' + body;
    if (kind === 'outlook') return 'https://outlook.office.com/mail/deeplink/compose?to=' + to + '&subject=' + su + '&body=' + body;
    if (kind === 'yahoo')   return 'https://compose.mail.yahoo.com/?to=' + to + '&subject=' + su + '&body=' + body;
    return '';
  }

  function closeMenu() {
    if (!sendMenu) return;
    sendMenu.hidden = true;
    if (btnEmail) btnEmail.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!sendMenu) return;
    sendMenu.hidden = false;
    if (btnEmail) btnEmail.setAttribute('aria-expanded', 'true');
  }

  function send(kind) {
    if (kind === 'copyaddr') {
      copyText(CONFIG.email, function () { flash(btnEmail, 'Address copied'); });
      closeMenu();
      return;
    }
    if (kind === 'default') {
      window.location.href = mailtoHref();
    } else {
      var url = webCompose(kind);
      if (url) window.open(url, '_blank', 'noopener');
    }
    closeMenu();
    post();
  }

  if (btnEmail) {
    btnEmail.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sendMenu && sendMenu.hidden) openMenu(); else closeMenu();
    });
  }
  if (sendMenu) {
    sendMenu.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-send]') : null;
      if (b) { e.stopPropagation(); send(b.getAttribute('data-send')); }
    });
  }
  document.addEventListener('click', function (e) {
    if (!sendMenu || sendMenu.hidden) return;
    if (sendMenu.contains(e.target) || e.target === btnEmail) return;
    closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  function goWa() {
    var url = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(waText());
    window.open(url, '_blank', 'noopener');
    post();
  }

  function goCopy() {
    copyText(plainSpec(), function () { flash(btnCopy, 'Copied'); });
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* noop */ }
    document.body.removeChild(ta);
  }

  function flash(btn, label) {
    if (!btn) return;
    if (!btn.hasAttribute('data-html')) btn.setAttribute('data-html', btn.innerHTML);
    btn.textContent = label;
    setTimeout(function () {
      btn.innerHTML = btn.getAttribute('data-html') || btn.textContent;
    }, 1600);
  }

  function post() {
    if (!CONFIG.endpoint) return;
    try {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: REF, spec: state, text: plainSpec() })
      }).catch(function () { /* the buyer's own client is the source of truth */ });
    } catch (e) { /* ignore */ }
  }

  /* ─────────────────────────────────────────────────────────────────────
     Printable spec sheet
     ───────────────────────────────────────────────────────────────────── */
  function buildSheet(r, b, ok) {
    if (!sheet) return;
    var cells = r.length ? r.map(function (x) {
      return '<tr><th>' + esc(x.k) + '</th><td>' + esc(x.v) + '</td></tr>';
    }).join('') : '<tr><th>Specification</th><td>Incomplete</td></tr>';

    sheet.innerHTML =
      '<h1>Inquiry ' + esc(REF) + '</h1>' +
      '<p class="psub">Aifuyi — custom wheel bolts &amp; automotive fasteners, Yuhuan, Zhejiang, China' +
        ' · ' + esc(CONFIG.email) + ' · +86 187 7732 3530</p>' +
      '<table><tbody>' + cells + '</tbody></table>' +
      (b ? '<table style="margin-top:12px"><tbody>' +
        '<tr><th>Indicative unit price</th><td>US$ ' + b.unitLo.toFixed(2) + ' – ' + b.unitHi.toFixed(2) + ' per piece</td></tr>' +
        '<tr><th>Tooling (one-off)</th><td>US$ ' + money(b.toolLo) + ' – ' + money(b.toolHi) + '</td></tr>' +
        '<tr><th>Indicative project total</th><td>US$ ' + money(b.totalLo) + ' – ' + money(b.totalHi) + '</td></tr>' +
        '</tbody></table>' : '') +
      '<p class="pfoot">Indicative figures only, ±25%, subject to drawing review. Lead time ' +
        esc(leadTime()) + ' from approved drawing, door to door. Reports supplied with every lot: ' +
        'IATF 16949, material inspection, tensile strength, salt spray, dimensional.</p>';
  }

  function goPrint() {
    document.body.classList.add('printing');
    window.print();
    setTimeout(function () { document.body.classList.remove('printing'); }, 400);
  }

  if (btnWa)    btnWa.addEventListener('click', goWa);
  if (btnCopy)  btnCopy.addEventListener('click', goCopy);
  if (btnPrint) btnPrint.addEventListener('click', goPrint);
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); });

  /* ─────────────────────────────────────────────────────────────────────
     Boot
     ───────────────────────────────────────────────────────────────────── */
  syncPitch();
  syncOtherInputs();
  update();

  /* Test hook — lets you inspect or drive the builder from the console. */
  window.RFQ = {
    config: CONFIG,
    state: state,
    ref: REF,
    band: band,
    text: plainSpec,
    subject: emailSubject,
    body: emailBody,
    mailto: mailtoHref,
    webmail: webCompose,
    pitchRule: PITCH_RULE,
    set: function (group, value) {
      if (group === 'qty') state.qty = digits(value);
      else if (group === 'length') state.length = value;
      else state[group] = value;
      if (group === 'size') syncPitch();
      paintGroup(group);
      if (group === 'size') paintGroup('pitch');
      syncOtherInputs();
      update();
    }
  };
})();
