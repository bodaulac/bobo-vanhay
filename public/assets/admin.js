// Tương tác cho các trang quản trị: bottom sheet, form, thêm chương, đăng/gỡ truyện, toast.
// File ngoài để tuân thủ CSP (không inline script).
(function () {
    var toastTimer;
    function toast(text) {
        var el = document.getElementById('toast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
    }
    window.vhToast = toast;

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
    function values(form) {
        var out = {};
        new FormData(form).forEach(function (v, k) { out[k] = v; });
        return out;
    }
    function setMsg(form, text) {
        var el = form.querySelector('[data-msg]');
        if (el) el.textContent = text;
    }

    function openSheet(id) {
        var sheet = document.getElementById(id);
        if (!sheet) return;
        sheet.classList.add('open');
        document.body.classList.add('sheet-open');
        var first = sheet.querySelector('input,textarea');
        if (first) setTimeout(function () { first.focus(); }, 250);
    }
    function closeSheets() {
        document.querySelectorAll('.sheet.open').forEach(function (s) { s.classList.remove('open'); });
        document.body.classList.remove('sheet-open');
    }

    document.addEventListener('click', function (e) {
        var open = e.target.closest('[data-open]');
        if (open) { openSheet(open.getAttribute('data-open')); return; }
        if (e.target.closest('[data-close]')) { closeSheets(); return; }

        var add = e.target.closest('[data-action="add-chapter"]');
        if (add) {
            var slug = add.getAttribute('data-slug');
            add.disabled = true;
            api('/admin/api/novels/' + slug + '/chapters', 'POST', {})
                .then(function (d) { location.href = '/admin/novels/' + slug + '/chapters/' + d.no; })
                .catch(function (err) { add.disabled = false; toast(err.message); });
            return;
        }

        var st = e.target.closest('[data-action="set-status"]');
        if (st) {
            var next = st.getAttribute('data-status');
            st.disabled = true;
            api('/admin/api/novels/' + st.getAttribute('data-slug'), 'PATCH', { status: next })
                .then(function () { toast(next === 'published' ? 'Đã đăng truyện' : 'Đã gỡ xuống'); setTimeout(function () { location.reload(); }, 500); })
                .catch(function (err) { st.disabled = false; toast(err.message); });
        }
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheets(); });

    document.addEventListener('submit', function (e) {
        var form = e.target;
        var kind = form.getAttribute('data-form');
        if (!kind) return;
        e.preventDefault();
        setMsg(form, 'Đang lưu...');
        if (kind === 'create-novel') {
            api('/admin/api/novels', 'POST', values(form))
                .then(function (d) { location.href = '/admin/novels/' + d.slug; })
                .catch(function (err) { setMsg(form, err.message); });
        } else if (kind === 'update-novel') {
            api('/admin/api/novels/' + form.getAttribute('data-slug'), 'PATCH', values(form))
                .then(function () { closeSheets(); toast('Đã lưu thông tin'); setTimeout(function () { location.reload(); }, 500); })
                .catch(function (err) { setMsg(form, err.message); });
        }
    });
})();
