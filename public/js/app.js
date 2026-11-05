// Giao diện đọc: cỡ chữ, nền (sáng / giấy / tối), thanh tiến độ, phím tắt, ảnh dự phòng.
// File ngoài để CSP không cần 'unsafe-inline'.
(function () {
    var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#f3e7d2"/>' +
        '<text x="160" y="130" font-size="96" text-anchor="middle" fill="#c9b08a" font-family="serif">V</text></svg>');

    document.addEventListener('error', function (e) {
        var img = e.target;
        if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback') && img.src !== PLACEHOLDER) {
            img.src = PLACEHOLDER;
        }
    }, true);

    function load(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
    function save(key, value) { try { localStorage.setItem(key, value); } catch (err) { /* bỏ qua */ } }

    var THEMES = ['light', 'sepia', 'dark'];
    var theme = load('vh-theme');
    if (THEMES.indexOf(theme) === -1) theme = 'light';
    document.body.setAttribute('data-theme', theme);

    var reader = document.getElementById('reader');
    if (!reader) return;

    var size = parseInt(load('vh-size'), 10);
    if (!(size >= 0 && size <= 3)) size = 1;

    function apply() {
        reader.setAttribute('data-size', String(size));
        document.body.setAttribute('data-theme', theme);
    }
    function bind(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }
    bind('reader-smaller', function () { size = Math.max(0, size - 1); save('vh-size', size); apply(); });
    bind('reader-larger', function () { size = Math.min(3, size + 1); save('vh-size', size); apply(); });
    bind('reader-theme', function () {
        theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        save('vh-theme', theme);
        apply();
    });
    apply();

    // Thanh tiến độ đọc
    var bar = document.getElementById('read-bar');
    if (bar) {
        var ticking = false;
        var update = function () {
            var doc = document.documentElement;
            var max = doc.scrollHeight - window.innerHeight;
            bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
            ticking = false;
        };
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    // Phím ← → chuyển chương
    document.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea/i.test((e.target || {}).tagName || '')) return;
        var rel = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null;
        var link = rel && document.querySelector('a[rel="' + rel + '"][href]');
        if (link && link.closest('.read-dock')) location.href = link.getAttribute('href');
    });
})();
