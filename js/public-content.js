/*
 * Live content for the public website, from the FPAMAS API:
 *   - the "Latest News" ticker on every page that has #top-ticker
 *   - news.html: the article list, or one article with ?a=<slug>
 *   - gallery.html: projects staff chose to show (name, type, location, photos only)
 * News is written on the dashboard (Website News); assets are added to the
 * gallery from their page on the dashboard ("Public gallery").
 * Everything is inserted with textContent, never as HTML.
 */
(function () {
  'use strict';
  var API = window.API_BASE || 'https://fpambacend.onrender.com/api';

  function getJSON(path) {
    return fetch(API + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) { var i = document.createElement('i'); i.className = 'fa-solid ' + name; return i; }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }
  function newsLink(slug) { return 'news.html?a=' + encodeURIComponent(slug); }

  // ── Ticker ────────────────────────────────────────────────────────────────
  function ticker() {
    var track = document.querySelector('#top-ticker .tt-track');
    if (!track) return;
    function fill(items) {
      track.textContent = '';
      // Twice over, so the scrolling loop is seamless.
      [0, 1].forEach(function () {
        items.forEach(function (it) {
          var span = el('span', 'tt-item');
          var a = el('a', '', it.title);
          a.href = it.slug ? newsLink(it.slug) : 'news.html';
          a.style.color = 'inherit';
          span.appendChild(a);
          var sep = el('span', 'tt-sep', '◆');
          span.appendChild(document.createTextNode(' '));
          span.appendChild(sep);
          track.appendChild(span);
        });
      });
    }
    getJSON('/news/ticker').then(function (d) {
      fill(d.items && d.items.length ? d.items : [{ title: 'Official news and press releases from FPAM', slug: '' }]);
    }).catch(function () {
      fill([{ title: 'Official news and press releases from FPAM', slug: '' }]);
    });
  }

  // ── Article body: blank line = paragraph, "## " = heading, "> " = quote ──
  function renderBody(target, body) {
    String(body || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).forEach(function (block, i) {
      var t = block.trim();
      if (!t) return;
      if (t.indexOf('## ') === 0) { target.appendChild(el('h3', '', t.slice(3).trim())); return; }
      if (t.indexOf('> ') === 0) {
        var q = el('div', 'article-quote');
        q.appendChild(el('p', '', t.split('\n').map(function (l) { return l.replace(/^>\s?/, ''); }).join(' ')));
        target.appendChild(q);
        return;
      }
      var p = el('p', i === 0 ? 'article-lead' : '');
      t.split('\n').forEach(function (line, j) {
        if (j) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(line));
      });
      target.appendChild(p);
    });
  }

  // ── News page ─────────────────────────────────────────────────────────────
  function newsPage() {
    var root = document.getElementById('news-root');
    if (!root) return;
    var stat = document.getElementById('news-static');
    var slug = new URLSearchParams(location.search).get('a');

    function showStatic(msg) {
      root.textContent = '';
      if (msg) root.appendChild(el('p', 'news-msg', msg));
      if (stat) stat.hidden = false;
    }

    if (slug) {
      root.appendChild(el('p', 'news-msg', 'Loading article…'));
      getJSON('/news/' + encodeURIComponent(slug)).then(function (d) {
        var n = d.article;
        document.title = n.title + ' — FPAM News';
        root.textContent = '';
        var back = el('a', 'news-back');
        back.href = 'news.html'; back.appendChild(icon('fa-arrow-left')); back.appendChild(document.createTextNode(' All news'));
        root.appendChild(back);
        var art = el('article', 'news-article');
        art.appendChild(el('div', 'article-tag', n.category));
        art.appendChild(el('h1', 'news-title', n.title));
        var meta = el('div', 'article-meta');
        var m1 = el('div', 'article-meta-item'); m1.appendChild(icon('fa-calendar-days')); m1.appendChild(document.createTextNode(' ' + fmtDate(n.publishedAt))); meta.appendChild(m1);
        if (n.byline) { var m2 = el('div', 'article-meta-item'); m2.appendChild(icon('fa-user')); m2.appendChild(document.createTextNode(' ' + n.byline)); meta.appendChild(m2); }
        art.appendChild(meta);
        if (n.cover) {
          var fig = el('figure', 'news-cover');
          var img = el('img'); img.src = API + n.cover; img.alt = n.coverCaption || n.title; fig.appendChild(img);
          if (n.coverCaption) fig.appendChild(el('figcaption', '', n.coverCaption));
          art.appendChild(fig);
        }
        var body = el('div', 'article-body');
        if (!n.body && n.summary) body.appendChild(el('p', 'article-lead', n.summary));
        renderBody(body, n.body);
        art.appendChild(body);
        root.appendChild(art);
      }).catch(function () {
        root.textContent = '';
        var p = el('p', 'news-msg', 'That article could not be found. ');
        var a = el('a', '', 'See all news'); a.href = 'news.html'; p.appendChild(a);
        root.appendChild(p);
      });
      return;
    }

    root.appendChild(el('p', 'news-msg', 'Loading news…'));
    getJSON('/news?limit=24').then(function (d) {
      if (!d.news || !d.news.length) { showStatic(''); return; }
      root.textContent = '';
      var grid = el('div', 'news-grid');
      d.news.forEach(function (n) {
        var card = el('a', 'news-card');
        card.href = newsLink(n.slug);
        var media = el('div', 'news-card-media');
        if (n.cover) { var img = el('img'); img.src = API + n.cover; img.alt = ''; img.loading = 'lazy'; media.appendChild(img); }
        else { media.classList.add('empty'); media.appendChild(icon('fa-newspaper')); }
        card.appendChild(media);
        var bodyEl = el('div', 'news-card-body');
        var top = el('div', 'news-card-top');
        top.appendChild(el('span', 'article-tag', n.category));
        top.appendChild(el('span', 'news-card-date', fmtDate(n.publishedAt)));
        bodyEl.appendChild(top);
        bodyEl.appendChild(el('h3', 'news-card-title', n.title));
        if (n.summary) bodyEl.appendChild(el('p', 'news-card-sum', n.summary));
        var more = el('span', 'news-card-more', 'Read more '); more.appendChild(icon('fa-arrow-right'));
        bodyEl.appendChild(more);
        card.appendChild(bodyEl);
        grid.appendChild(card);
      });
      root.appendChild(grid);
    }).catch(function () { showStatic(''); });
  }

  // ── Gallery ───────────────────────────────────────────────────────────────
  var GROUPS = [
    ['offices', 'Offices & Secretariats', ['Administrative Office', 'Court']],
    ['housing', 'Housing Estates', ['Residential']],
    ['public', 'Health & Education', ['Hospital', 'School', 'Laboratory']],
    ['infrastructure', 'Infrastructure & Sites', ['Infrastructure', 'Utility', 'Environmental', 'Monument', 'Land / Property', 'Warehouse', 'Equipment']],
  ];
  function groupOf(type) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][2].indexOf(type) >= 0) return GROUPS[i][0];
    return 'other';
  }

  function galleryPage() {
    var grid = document.getElementById('gallery-grid');
    var filters = document.getElementById('gallery-filter');
    if (!grid || !filters) return;
    var lb = { items: [], i: 0, p: 0 };

    function setFilter(key, btn) {
      Array.prototype.forEach.call(filters.children, function (b) { b.classList.toggle('active', b === btn); });
      Array.prototype.forEach.call(grid.children, function (c) { c.style.display = key === 'all' || c.dataset.cat === key ? '' : 'none'; });
    }
    function show() {
      var it = lb.items[lb.i];
      document.getElementById('lb-img').src = API + it.photos[lb.p];
      document.getElementById('lb-img').alt = it.name;
      document.getElementById('lb-title').textContent = it.name;
      var loc = [it.type, [it.lga, it.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
      document.getElementById('lb-loc').textContent = loc + (it.caption ? ' — ' + it.caption : '') + (it.photos.length > 1 ? '  (' + (lb.p + 1) + ' of ' + it.photos.length + ')' : '');
      document.getElementById('lb-prev').hidden = document.getElementById('lb-next').hidden = it.photos.length < 2;
    }
    function open(i) {
      lb.i = i; lb.p = 0; show();
      document.getElementById('lightbox').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function step(d) { var n = lb.items[lb.i].photos.length; lb.p = (lb.p + d + n) % n; show(); }
    window.galleryStep = function (e, d) { e.stopPropagation(); step(d); };
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('lightbox').classList.contains('open')) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });

    getJSON('/public/gallery').then(function (d) {
      var items = (d.items || []).filter(function (x) { return x.photos && x.photos.length; });
      lb.items = items;
      grid.textContent = '';
      if (!items.length) {
        filters.hidden = true;
        grid.appendChild(el('p', 'gallery-empty', 'Project photos will appear here as FPAM adds them.'));
        return;
      }
      items.forEach(function (it, i) {
        var card = el('div', 'gallery-item');
        card.dataset.cat = groupOf(it.type);
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', it.name);
        var img = el('img'); img.src = API + it.photos[0]; img.alt = it.name; img.loading = 'lazy';
        card.appendChild(img);
        var ov = el('div', 'gi-overlay');
        var wrap = el('div');
        wrap.appendChild(el('div', 'gi-label', it.name));
        var loc = el('div', 'gi-loc'); loc.appendChild(icon('fa-location-dot'));
        loc.appendChild(document.createTextNode(' ' + ([it.lga, it.state].filter(Boolean).join(', ') || 'Nigeria')));
        wrap.appendChild(loc);
        if (it.photos.length > 1) { var cnt = el('div', 'gi-count'); cnt.appendChild(icon('fa-images')); cnt.appendChild(document.createTextNode(' ' + it.photos.length)); wrap.appendChild(cnt); }
        ov.appendChild(wrap);
        card.appendChild(ov);
        card.addEventListener('click', function () { open(i); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(i); });
        grid.appendChild(card);
      });
      // Filter buttons only for the groups that have projects.
      filters.textContent = '';
      var present = {};
      items.forEach(function (it) { present[groupOf(it.type)] = true; });
      var all = el('button', 'gf-btn active', 'All');
      all.addEventListener('click', function () { setFilter('all', all); });
      filters.appendChild(all);
      GROUPS.concat([['other', 'Other', []]]).forEach(function (g) {
        if (!present[g[0]]) return;
        var b = el('button', 'gf-btn', g[1]);
        b.addEventListener('click', function () { setFilter(g[0], b); });
        filters.appendChild(b);
      });
      if (filters.children.length < 3) filters.hidden = true;   // just "All" + one group
    }).catch(function () {
      filters.hidden = true;
      grid.textContent = '';
      grid.appendChild(el('p', 'gallery-empty', 'The gallery could not be loaded. Please try again later.'));
    });
  }

  function start() { ticker(); newsPage(); galleryPage(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
