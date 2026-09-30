/**
 * consimtamant.js — alegerea vizitatorului despre cookie-uri și datele păstrate
 * în browser.
 *
 * Bannerul e scris în HTML de `build.js`, pe fiecare pagină, ascuns. Textul
 * lui stă acolo și nu aici ca să treacă prin traducerea din `build-limbi.js`,
 * care nu intră în scripturi. Scriptul doar îl arată, citește butoanele și
 * aplică alegerea.
 *
 * O SINGURĂ ALEGERE PENTRU TOT SITE-UL
 * Se păstrează în `localStorage`, care e comun tuturor paginilor de pe același
 * domeniu, inclusiv versiunilor `en/` și `hu/`. Cine alege pe prima pagină nu
 * mai e întrebat pe nicio altă pagină. Cine ajunge DIRECT pe un produs, dintr-o
 * legătură trimisă de cineva, n-a ales încă nimic, deci vede bannerul acolo.
 *
 * CE FACE FIECARE BUTON
 *
 *                      Accept      Doar esențiale   Refuz
 *   coșul + jetonul    permanent   permanent        doar în filă
 *   datele de livrare  permanent   doar în filă     doar în filă
 *   harta Google       da          nu               nu
 *
 * Coșul e strict necesar — clientul l-a cerut apăsând „Adaugă în coș” —, deci
 * legea nu cere acord pentru el și merge cu oricare alegere. Diferența dintre
 * „Doar esențiale” și „Refuz” e cât rămâne pe dispozitiv: la refuz, nimic nu
 * supraviețuiește închiderii filei, în afară de alegerea însăși. Aceea trebuie
 * ținută minte, altfel refuzul ar fi cerut din nou la fiecare pagină.
 *
 * „Doar în filă” înseamnă `sessionStorage`: rămâne cât navighezi în fila
 * respectivă, inclusiv la întoarcerea de la procesatorul de plăți, și se șterge
 * când fila se închide.
 *
 * Până la prima alegere, site-ul se poartă ca la „Doar esențiale”: nimic
 * opțional nu se încarcă fără acord.
 *
 * DESCHIS DE PE DISC (`file://`)
 * Aici `localStorage` nu e garantat comun paginilor: `cos.js` descrie un
 * Firefox în care fiecare fișier avea memorie proprie, deci alegerea n-ar fi
 * trecut de la o pagină la alta. (În Firefox 157 cu setări implicite e comun —
 * verificat pe 30.09.2026 —, dar nu depindem de asta.) Aceeași soluție ca la
 * coș: pe `file://`, alegerea călătorește și în adresă, ca `?k=toate`, pe
 * fiecare legătură internă apăsată. Pe `http://` și `https://` adresele rămân
 * curate.
 *
 * CÂND SE ADAUGĂ UN SERVICIU NOU (statistici, pixel de reclamă, video)
 *   1. se marchează în pagină cu `data-consimtamant="terti"` (vezi mai jos);
 *   2. se completează textul bannerului din `build.js`, care trebuie să spună
 *      adevărul despre ce se încarcă;
 *   3. se crește `VERSIUNE`, ca toți vizitatorii să fie întrebați din nou —
 *      acordul dat pentru hartă nu acoperă un serviciu despre care nu li s-a
 *      spus nimic.
 */

window.UG = window.UG || {};

(function (UG) {
  'use strict';

  var CHEIE = 'ug-consimtamant';
  var VERSIUNE = 1;

  /* Șase luni, apoi vizitatorul e întrebat din nou. E durata recomandată de
     autoritățile europene de protecție a datelor și pentru acord, și pentru
     refuz: un refuz uitat după o zi ar însemna să-l tot ceri până cedează. */
  var VALABIL_ZILE = 182;

  /* Ce permite fiecare alegere. `null` e starea de dinaintea primei alegeri. */
  var ALEGERI = {
    toate:     { functionale: true,  terti: true,  permanent: true  },
    esentiale: { functionale: false, terti: false, permanent: true  },
    refuz:     { functionale: false, terti: false, permanent: false }
  };
  var NEDECIS = ALEGERI.esentiale;

  /* Cheile scrise de celelalte scripturi, pe categorii. Se mută între
     `localStorage` și `sessionStorage` când se schimbă alegerea, ca un coș
     început înainte de refuz să nu rămână pe disc după el. Numele trebuie să
     rămână aceleași cu cele din `cos.js` și `checkout.js`. */
  var CHEI = {
    esentiale:   ['ug-cos', 'ug-cart-token'],
    functionale: ['ug-date-livrare']
  };

  /* Accesul la `localStorage` poate ARUNCA, nu doar lipsi: navigare privată în
     unele browsere, cookie-uri blocate din setări, cadru izolat. */
  function depozit(nume) {
    try { return window[nume] || null; } catch (e) { return null; }
  }

  function citeste() {
    try {
      var d = JSON.parse(depozit('localStorage').getItem(CHEIE) || 'null');
      if (!d || d.v !== VERSIUNE || !ALEGERI[d.alegere]) return null;
      if (!(Date.now() - d.t < VALABIL_ZILE * 864e5)) return null;
      return d.alegere;
    } catch (e) {
      return null;
    }
  }

  function salveaza(noua) {
    var s = JSON.stringify({ v: VERSIUNE, alegere: noua, t: Date.now() });
    try {
      depozit('localStorage').setItem(CHEIE, s);
    } catch (e) {
      /* Fără `localStorage`, alegerea ține măcar cât fila, ca bannerul să nu
         reapară la fiecare pagină. */
      try { depozit('sessionStorage').setItem(CHEIE, s); } catch (err) { /* nimic de făcut */ }
    }
  }

  /* --- Alegerea purtată prin adresă, numai pe `file://` -------------------- */

  var PE_DISC = location.protocol === 'file:';

  function dinAdresa() {
    if (!PE_DISC) return null;
    var m = /[?&]k=([a-z]+)/.exec(location.search);
    return m && ALEGERI[m[1]] ? m[1] : null;
  }

  /** Adresa cu alegerea curentă în coadă (`k=`), păstrând restul cererii. */
  function cuAlegerea(url) {
    if (!PE_DISC || !alegere) return url;
    var i = url.indexOf('#');
    var ancora = i === -1 ? '' : url.slice(i);
    var fara = i === -1 ? url : url.slice(0, i);
    var cerere = (fara.split('?')[1] || '').split('&').filter(function (p) {
      return p && p.split('=')[0] !== 'k';
    });
    cerere.push('k=' + alegere);
    return fara.split('?')[0] + '?' + cerere.join('&') + ancora;
  }

  /* Adresa are întâietate: e alegerea adusă chiar de clicul care a deschis
     pagina, deci cea mai proaspătă. Se scrie și local, ca o reîncărcare a
     paginii să n-o piardă. */
  var alegere = dinAdresa();
  if (alegere) salveaza(alegere);
  else alegere = citeste();

  var reguli = function () { return ALEGERI[alegere] || NEDECIS; };

  /* --- Interfața pentru celelalte scripturi ------------------------------- */

  UG.consimtamant = {
    /** 'toate' | 'esentiale' | 'refuz' | null (încă nu a ales) */
    alegere: function () { return alegere; },
    /** 'esentiale' e mereu permis; 'functionale' și 'terti' doar cu acord. */
    permis: function (categorie) { return categorie === 'esentiale' || !!reguli()[categorie]; },
    /** Pentru navigările din JavaScript (`switcher.js`), care ocolesc legăturile. */
    adresa: cuAlegerea
  };

  /**
   * Unde își păstrează un script datele, după categoria lor.
   * Întoarce `localStorage` sau `sessionStorage`, ori `null` dacă browserul le
   * blochează; apelanții îl folosesc deja în `try`, ca pe `localStorage`.
   */
  UG.depozit = function (categorie) {
    var r = reguli();
    var permanent = categorie === 'esentiale' ? r.permanent : r.functionale;
    return depozit(permanent ? 'localStorage' : 'sessionStorage');
  };

  /* Mută fiecare cheie acolo unde o cere alegerea curentă. Rulează la fiecare
     încărcare, nu doar la schimbare: prinde și alegerea expirată, și pe cea
     făcută între timp în altă filă. Oricând, o cheie stă într-un singur loc. */
  function aliniaza() {
    Object.keys(CHEI).forEach(function (categorie) {
      var tinta = UG.depozit(categorie);
      var cealalta = depozit(tinta === depozit('localStorage') ? 'sessionStorage' : 'localStorage');
      if (!tinta || !cealalta) return;
      CHEI[categorie].forEach(function (k) {
        try {
          var v = cealalta.getItem(k);
          if (v === null) return;
          if (tinta.getItem(k) === null) tinta.setItem(k, v);
          cealalta.removeItem(k);
        } catch (e) { /* depozit plin sau blocat */ }
      });
    });
  }

  /* --- Conținutul care așteaptă acord ------------------------------------- */

  /**
   * Un cadru străin se scrie în pagină fără `src`, cu adresa în `data-src`:
   *
   *   <iframe data-consimtamant="terti" data-src="https://…" hidden></iframe>
   *   <div data-consimtamant-inlocuitor>…ce se vede în loc…</div>
   *
   * Fără acord, browserul nu face nicio cerere către terț, deci terțul nu are
   * cum să pună cookie-uri. La retragerea acordului cadrul se înlocuiește cu o
   * copie goală: doar ștergerea atributului `src` nu descarcă pagina din el.
   */
  function aplicaCadre() {
    [].forEach.call(document.querySelectorAll('iframe[data-consimtamant]'), function (f) {
      var da = UG.consimtamant.permis(f.getAttribute('data-consimtamant')) ||
        f.hasAttribute('data-o-data');
      var inlocuitor = f.parentNode.querySelector('[data-consimtamant-inlocuitor]');

      if (da && !f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-src'));
      if (!da && f.getAttribute('src')) {
        var gol = f.cloneNode(false);
        gol.removeAttribute('src');
        f.parentNode.replaceChild(gol, f);
        f = gol;
      }
      f.hidden = !da;
      if (inlocuitor) inlocuitor.hidden = da;
    });
  }

  /* „Afișează harta” încarcă un singur cadru, o singură dată, fără să schimbe
     alegerea salvată. Omul a citit chiar lângă buton că harta vine de la Google
     și pune cookie-uri — apăsarea e acord pentru ea, nu pentru tot site-ul. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-consimtamant-o-data]');
    if (!b) return;
    var f = b.closest('[data-consimtamant-gazda]');
    f = f && f.querySelector('iframe[data-consimtamant]');
    if (!f) return;
    f.setAttribute('data-o-data', '');
    aplicaCadre();
  });

  /* --- Bannerul ----------------------------------------------------------- */

  var banner = document.getElementById('cookie');
  var radacina = document.documentElement;

  /* Cât ocupă bannerul, ca pagina să poată fi derulată până la capăt pe sub el.
     Altfel, pe telefon, ultimul ecran — subsolul, cu legătura spre politica de
     cookie-uri — ar rămâne acoperit tocmai cât omul încearcă să se hotărască. */
  function masoara() {
    if (banner && !banner.hidden) radacina.style.setProperty('--cookie-h', banner.offsetHeight + 'px');
  }

  function arataAlegerea() {
    var actual = banner.querySelector('[data-cookie-actual]');
    if (actual) actual.hidden = !alegere;
    [].forEach.call(banner.querySelectorAll('[data-alegere]'), function (el) {
      el.hidden = el.getAttribute('data-alegere') !== alegere;
    });
  }

  function deschide(cuFocus) {
    if (!banner) return;
    arataAlegerea();
    banner.hidden = false;
    radacina.classList.add('cookie-deschis');
    masoara();
    /* Focusul se mută doar când omul a cerut bannerul, din subsol. La prima
       vizită nu: i-ar fura locul cititorului de ecran chiar la intrarea în
       pagină. Bannerul stă oricum primul în document, imediat după legătura
       de salt, deci e primul lucru la care ajunge cu Tab. */
    if (cuFocus) {
      var titlu = banner.querySelector('#cookie-titlu');
      if (titlu) titlu.focus();
    }
  }

  function inchide() {
    if (!banner) return;
    /* Focusul nu rămâne pe un buton ascuns. Bannerul stă la începutul
       documentului, deci următorul Tab pornește de sus, de la antet. */
    if (banner.contains(document.activeElement)) document.activeElement.blur();
    banner.hidden = true;
    radacina.classList.remove('cookie-deschis');
    radacina.style.removeProperty('--cookie-h');
  }

  function alege(noua) {
    if (!ALEGERI[noua]) return;
    alegere = noua;
    salveaza(noua);
    /* O hartă deschisă „o singură dată” se închide la o alegere explicită care
       nu o permite: ultima decizie a omului are întâietate. */
    [].forEach.call(document.querySelectorAll('iframe[data-o-data]'), function (f) {
      f.removeAttribute('data-o-data');
    });
    aliniaza();
    aplicaCadre();
    inchide();
  }

  /* Rezerva din `sessionStorage`, pentru browserele care refuză `localStorage`. */
  if (!alegere) {
    try {
      var d = JSON.parse(depozit('sessionStorage').getItem(CHEIE) || 'null');
      if (d && d.v === VERSIUNE && ALEGERI[d.alegere]) alegere = d.alegere;
    } catch (e) { /* nimic păstrat */ }
  }

  aliniaza();
  aplicaCadre();

  if (banner) {
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cookie-alege]');
      if (b) alege(b.getAttribute('data-cookie-alege'));
    });

    /* Esc închide bannerul doar când e redeschis din subsol: atunci există
       deja o alegere care rămâne în vigoare. La prima vizită, a-l închide fără
       răspuns ar însemna o decizie pe care omul n-a luat-o. */
    banner.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && alegere) inchide();
    });

    /* Înălțimea se schimbă și fără redimensionarea ferestrei: la deschiderea
       explicațiilor, la sosirea fonturilor. `toggle` vine de la `<details>` și
       nu urcă prin document, deci se prinde la coborâre (`true`); observatorul
       prinde restul. */
    window.addEventListener('resize', masoara);
    banner.addEventListener('toggle', masoara, true);
    if (window.ResizeObserver) new ResizeObserver(masoara).observe(banner);
    if (!alegere) deschide(false);
  }

  /* „Setări cookie-uri” din subsol. E o legătură adevărată către politica de
     cookie-uri, deci fără JavaScript tot duce undeva util; cu script, deschide
     bannerul pe loc. */
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('[data-cookie-setari]');
    if (!l || !banner) return;
    e.preventDefault();
    deschide(true);
  });

  /* Pe `file://`, alegerea se pune în adresa legăturii chiar în clipa clicului,
     nu la încărcare. Așa prinde și alegerea făcută pe pagina curentă, și
     legăturile rescrise între timp de `cos-ui.js` (care pune coșul în `?c=`),
     și pe cele completate târziu din script, ca „Vezi pagina produsului”.
     `auxclick` e clicul pe rotiță, care deschide pagina în filă nouă. */
  if (PE_DISC) {
    var poarta = function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || !alegere) return;
      var href = a.getAttribute('href') || '';
      if (/^(?:[a-z]+:|#)/i.test(href)) return;
      if (!/\.html$/i.test(href.split('#')[0].split('?')[0])) return;
      a.setAttribute('href', cuAlegerea(href));
    };
    document.addEventListener('click', poarta, true);
    document.addEventListener('auxclick', poarta, true);
  }

  /* Alegerea făcută în altă filă se aplică și aici, fără reîncărcare: bannerul
     dispare din toate filele deschise, nu doar din cea în care s-a apăsat. */
  window.addEventListener('storage', function (e) {
    if (e.key !== CHEIE) return;
    alegere = citeste();
    aliniaza();
    aplicaCadre();
    if (alegere) inchide();
  });
})(window.UG);
