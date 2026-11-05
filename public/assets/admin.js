// Tương tác cho các trang quản trị (form tạo/sửa truyện, thêm chương). File ngoài để tuân thủ CSP.
(function () {
    function api(url, method, body) {
        return fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body || {})
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.error || 'Lỗi ' + res.status);
                return data;
            });
        });
    }
    function say(form, text) {
        var el = form.querySelector('[data-msg]');
        if (el) el.textContent = text;
    }
    function values(form) {
        var out = {};
        new FormData(form).forEach(function (v, k) { out[k] = v; });
        return out;
    }

    document.addEventListener('submit', function (e) {
        var form = e.target;
        var kind = form.getAttribute('data-form');
        if (!kind) return;
        e.preventDefault();
        say(form, 'Đang lưu...');
        if (kind === 'create-novel') {
            api('/admin/api/novels', 'POST', values(form))
                .then(function (d) { location.href = '/admin/novels/' + d.slug; })
                .catch(function (err) { say(form, err.message); });
        } else if (kind === 'update-novel') {
            api('/admin/api/novels/' + form.getAttribute('data-slug'), 'PATCH', values(form))
                .then(function () { say(form, 'Đã lưu.'); })
                .catch(function (err) { say(form, err.message); });
        }
    });

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="add-chapter"]');
        if (!btn) return;
        var slug = btn.getAttribute('data-slug');
        api('/admin/api/novels/' + slug + '/chapters', 'POST', {})
            .then(function (d) { location.href = '/admin/novels/' + slug + '/chapters/' + d.no; })
            .catch(function (err) { alert(err.message); });
    });
})();
