// Chế độ đọc (cỡ chữ, nền tối) và ảnh dự phòng. File ngoài để CSP không cần 'unsafe-inline'.
(function () {
    var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f5f5f4"/>' +
        '<text x="100" y="125" font-size="90" text-anchor="middle" fill="#d6d3d1" font-family="serif">V</text></svg>');

    document.addEventListener('error', function (e) {
        var img = e.target;
        if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback') && img.src !== PLACEHOLDER) {
            img.src = PLACEHOLDER;
        }
    }, true);

    var reader = document.getElementById('reader');
    if (!reader) return;

    function load(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
    function save(key, value) { try { localStorage.setItem(key, value); } catch (err) { /* bỏ qua */ } }

    var size = parseInt(load('vh-size'), 10);
    if (!(size >= 0 && size <= 3)) size = 1;
    var theme = load('vh-theme') === 'dark' ? 'dark' : 'light';

    function apply() {
        reader.setAttribute('data-size', String(size));
        reader.setAttribute('data-theme', theme);
        var toggle = document.getElementById('reader-theme');
        if (toggle) toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }

    function bind(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    bind('reader-smaller', function () { size = Math.max(0, size - 1); save('vh-size', size); apply(); });
    bind('reader-larger', function () { size = Math.min(3, size + 1); save('vh-size', size); apply(); });
    bind('reader-theme', function () { theme = theme === 'dark' ? 'light' : 'dark'; save('vh-theme', theme); apply(); });
    apply();
})();
