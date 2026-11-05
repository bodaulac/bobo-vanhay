// Khu vực quản trị: quản lý truyện dài, soạn thảo chương (novel/Tiptap) và nút AI.
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const Novel = require('../../models/Novel');
const Chapter = require('../../models/Chapter');
const { slugify } = require('../lib/slug');
const { renderContent } = require('../lib/content');
const { countWords } = require('../lib/ainovelImport');

const router = express.Router();
const failures = new Map(); // ip -> { count, until }
const aiHits = new Map(); // ip -> [timestamps]
const MAX_FAILS = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const AI_PER_MINUTE = 20;
const SLUG_RE = /^[a-z0-9-]{1,100}$/;

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Xác thực: HTTP Basic, mật khẩu = ADMIN_TOKEN (tên đăng nhập bỏ qua). Không có token = tắt admin.
router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    if (!config.adminToken) return res.status(503).send('Admin chưa được bật: hãy đặt ADMIN_TOKEN trong .env');

    const rec = failures.get(req.ip);
    if (rec && rec.count >= MAX_FAILS && rec.until > Date.now()) {
        return res.status(429).send('Thử sai quá nhiều lần, vui lòng đợi rồi thử lại.');
    }

    const header = (req.get('authorization') || '').match(/^Basic (.+)$/i);
    let password = '';
    if (header) {
        const decoded = Buffer.from(header[1], 'base64').toString('utf8');
        password = decoded.slice(decoded.indexOf(':') + 1);
    }
    if (!password || !safeEqual(password, config.adminToken)) {
        if (header) {
            const fresh = !rec || rec.until <= Date.now();
            failures.set(req.ip, { count: fresh ? 1 : rec.count + 1, until: fresh ? Date.now() + FAIL_WINDOW_MS : rec.until });
        }
        res.set('WWW-Authenticate', 'Basic realm="Van Hay Admin", charset="UTF-8"');
        return res.status(401).send('Cần đăng nhập');
    }
    failures.delete(req.ip);
    next();
});

// Chống CSRF: yêu cầu ghi phải là JSON và (nếu có Origin) cùng host
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'Cần Content-Type: application/json' });
    const origin = req.get('origin');
    if (origin) {
        let host = '';
        try { host = new URL(origin).host; } catch (err) { /* host rỗng => từ chối */ }
        if (host !== req.get('host')) return res.status(403).json({ error: 'Origin không hợp lệ' });
    }
    next();
});

router.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parseNo = (value) => {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
};
const clean = (value, max) => String(value == null ? '' : value).trim().slice(0, max);

async function loadNovel(req, res) {
    if (!SLUG_RE.test(req.params.slug)) { res.status(404).send('Không tìm thấy'); return null; }
    const novel = await Novel.findOne({ slug: req.params.slug }).lean();
    if (!novel) { res.status(404).send('Không tìm thấy truyện'); return null; }
    return novel;
}

// ---- Trang ----
router.get('/', wrap(async (req, res) => {
    const novels = await Novel.find().sort({ updatedAt: -1 }).lean();
    const counts = await Chapter.aggregate([{ $group: { _id: { novel: '$novel', status: '$status' }, n: { $sum: 1 } } }]);
    const byNovel = {};
    counts.forEach((c) => {
        byNovel[c._id.novel] = byNovel[c._id.novel] || { draft: 0, published: 0 };
        byNovel[c._id.novel][c._id.status] = c.n;
    });
    res.render('admin/index', { novels, byNovel });
}));

router.get('/novels/:slug', wrap(async (req, res) => {
    const novel = await loadNovel(req, res);
    if (!novel) return;
    const chapters = await Chapter.find({ novel: novel.slug }).select('no title status wordCount editedAt updatedAt').sort({ no: 1 }).lean();
    res.render('admin/novel', { novel, chapters });
}));

router.get('/novels/:slug/chapters/:no', wrap(async (req, res) => {
    const novel = await loadNovel(req, res);
    const no = parseNo(req.params.no);
    if (!novel) return;
    const chapter = no && await Chapter.findOne({ novel: novel.slug, no }).lean();
    if (!chapter) return res.status(404).send('Không tìm thấy chương');
    res.render('admin/chapter', {
        novel,
        chapter,
        editorConfig: {
            novel: novel.slug,
            title: chapter.title,
            // Lọc ngay khi đưa vào trình soạn thảo, phòng dữ liệu cũ chứa HTML bẩn
            content: renderContent(chapter.content),
            status: chapter.status,
            saveUrl: `/admin/api/novels/${novel.slug}/chapters/${chapter.no}`,
            backUrl: `/admin/novels/${novel.slug}`
        }
    });
}));

// ---- API ----
router.post('/api/novels', wrap(async (req, res) => {
    const title = clean(req.body.title, 200);
    if (!title) return res.status(400).json({ error: 'Cần nhập tiêu đề' });
    const base = slugify(title) || 'truyen';
    let slug = base;
    for (let i = 2; await Novel.exists({ slug }); i++) slug = `${base}-${i}`;
    const novel = await Novel.create({ title, slug, synopsis: clean(req.body.synopsis, 5000), source: 'manual' });
    res.json({ slug: novel.slug });
}));

router.patch('/api/novels/:slug', wrap(async (req, res) => {
    if (!SLUG_RE.test(req.params.slug)) return res.status(404).json({ error: 'Không tìm thấy' });
    const update = {};
    if (req.body.title !== undefined) {
        update.title = clean(req.body.title, 200);
        if (!update.title) return res.status(400).json({ error: 'Tiêu đề không được trống' });
    }
    if (req.body.synopsis !== undefined) update.synopsis = clean(req.body.synopsis, 5000);
    if (req.body.author !== undefined) update.author = clean(req.body.author, 100) || 'Văn Hay';
    if (req.body.status !== undefined) {
        if (!['draft', 'published'].includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        update.status = req.body.status;
    }
    const novel = await Novel.findOneAndUpdate({ slug: req.params.slug }, { $set: update }, { new: true }).lean();
    if (!novel) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ok: true, status: novel.status });
}));

router.post('/api/novels/:slug/chapters', wrap(async (req, res) => {
    if (!SLUG_RE.test(req.params.slug) || !(await Novel.exists({ slug: req.params.slug }))) {
        return res.status(404).json({ error: 'Không tìm thấy truyện' });
    }
    const last = await Chapter.findOne({ novel: req.params.slug }).sort({ no: -1 }).select('no').lean();
    const no = (last ? last.no : 0) + 1;
    await Chapter.create({ novel: req.params.slug, no, title: clean(req.body.title, 200) || `Chương ${no}`, editedAt: new Date() });
    await Novel.updateOne({ slug: req.params.slug }, { $set: { totalChapters: no } });
    res.json({ no });
}));

router.put('/api/novels/:slug/chapters/:no', wrap(async (req, res) => {
    const no = parseNo(req.params.no);
    if (!SLUG_RE.test(req.params.slug) || !no) return res.status(404).json({ error: 'Không tìm thấy' });
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const content = renderContent(String(req.body.content || '').slice(0, 1500000));
    const chapter = await Chapter.findOneAndUpdate(
        { novel: req.params.slug, no },
        { $set: { title: clean(req.body.title, 200), content, wordCount: countWords(content), status, editedAt: new Date() } },
        { new: true }
    ).lean();
    if (!chapter) return res.status(404).json({ error: 'Không tìm thấy chương' });
    res.json({ ok: true, status: chapter.status, wordCount: chapter.wordCount });
}));

// ---- AI hỗ trợ viết (gọi qua AI proxy) ----
const BASE = 'Bạn là trợ lý viết truyện tiếng Việt. Luôn trả lời bằng tiếng Việt, chỉ trả về phần văn bản được yêu cầu, không giải thích, không dùng ký hiệu markdown. ';
const AI_PROMPTS = {
    continue: BASE + 'Viết tiếp đoạn văn dựa trên mạch truyện đã có, giữ nguyên giọng văn, nhân vật và bối cảnh. Viết khoảng 150–300 từ, không lặp lại phần đã có.',
    improve: BASE + 'Chau chuốt đoạn văn: câu chữ mượt mà, giàu hình ảnh hơn nhưng giữ nguyên ý, nhân vật và diễn biến.',
    shorter: BASE + 'Rút gọn đoạn văn, giữ lại ý chính và giọng văn.',
    longer: BASE + 'Mở rộng đoạn văn bằng chi tiết miêu tả, cảm xúc, đối thoại; giữ nguyên diễn biến.',
    fix: BASE + 'Sửa lỗi chính tả, ngữ pháp, dấu câu; không đổi nội dung và giọng văn.',
    zap: BASE + 'Chỉnh sửa đoạn văn đúng theo yêu cầu của người dùng.'
};

function aiRateLimited(ip) {
    const now = Date.now();
    const hits = (aiHits.get(ip) || []).filter((t) => now - t < 60000);
    hits.push(now);
    aiHits.set(ip, hits);
    return hits.length > AI_PER_MINUTE;
}

router.post('/api/ai', wrap(async (req, res) => {
    const option = String(req.body.option || '');
    const text = clean(req.body.text, 6000);
    const command = clean(req.body.command, 300);
    if (!AI_PROMPTS[option]) return res.status(400).json({ error: 'Chức năng AI không hợp lệ' });
    if (!text) return res.status(400).json({ error: 'Thiếu nội dung' });
    if (option === 'zap' && !command) return res.status(400).json({ error: 'Cần nhập yêu cầu' });
    if (aiRateLimited(req.ip)) return res.status(429).json({ error: 'Gọi AI quá nhanh, vui lòng đợi một chút.' });

    let system = AI_PROMPTS[option];
    if (SLUG_RE.test(String(req.body.novel || ''))) {
        const novel = await Novel.findOne({ slug: req.body.novel }).select('title synopsis').lean();
        if (novel) system += `\nTruyện: "${novel.title}". Tóm tắt: ${novel.synopsis.slice(0, 800)}`;
    }
    const user = option === 'zap' ? `Đoạn văn:\n${text}\n\nYêu cầu: ${command}` : text;

    try {
        const response = await axios.post(config.aiProxy.url, {
            model: config.aiModel,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.8
        }, { headers: { Authorization: config.aiProxy.auth }, timeout: 120000 });
        const out = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message;
        if (!out || !out.content) throw new Error('empty');
        res.json({ text: String(out.content).trim() });
    } catch (err) {
        console.error('AI error:', err.message);
        res.status(502).json({ error: 'Không gọi được AI. Kiểm tra AI proxy và AI_PROXY_KEY.' });
    }
}));

router.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500);
    if (req.path.startsWith('/api/')) return res.json({ error: err.status === 400 ? 'Dữ liệu không hợp lệ' : 'Lỗi máy chủ' });
    res.send('Lỗi máy chủ');
});

module.exports = router;
