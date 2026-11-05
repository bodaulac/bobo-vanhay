// Đọc thư mục output/novel của ainovel-cli và chuyển thành dữ liệu để lưu vào MongoDB.
// Định dạng thư mục: xem README của ainovel-cli (mục "输出结构").
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw new Error(`Không đọc được ${file}: ${err.message}`);
    }
}

// Số từ tiếng Việt: đếm theo khoảng trắng (mỗi âm tiết là một "từ" trong cách đếm phổ biến)
function countWords(text) {
    const t = String(text || '').replace(/<[^>]*>/g, ' ').trim();
    return t ? t.split(/\s+/).length : 0;
}

function chapterTitles(dir) {
    const titles = new Map();
    const flat = readJson(path.join(dir, 'outline.json'));
    if (Array.isArray(flat)) flat.forEach((e) => e && e.chapter && titles.set(e.chapter, e.title));
    const layered = readJson(path.join(dir, 'layered_outline.json'));
    const volumes = Array.isArray(layered) ? layered : (layered && layered.volumes) || [];
    volumes.forEach((v) => (v.arcs || []).forEach((a) => (a.chapters || []).forEach((e) => {
        if (e && e.chapter && !titles.has(e.chapter)) titles.set(e.chapter, e.title);
    })));
    return titles;
}

// Bỏ dòng tiêu đề "# ..." đầu file nếu có (tiêu đề chương lưu riêng)
function splitHeading(markdown) {
    const m = markdown.match(/^\s*#{1,3}\s+(.+?)\s*\n+/);
    return m ? { heading: m[1].trim(), body: markdown.slice(m[0].length) } : { heading: null, body: markdown };
}

function readWorkspace(dir) {
    const root = fs.existsSync(path.join(dir, 'meta', 'book.json')) ? dir : path.join(dir, 'output', 'novel');
    const book = readJson(path.join(root, 'meta', 'book.json'));
    if (!book || !book.title) throw new Error(`Không tìm thấy meta/book.json hợp lệ trong ${root}`);

    const progress = readJson(path.join(root, 'meta', 'progress.json')) || {};
    const titles = chapterTitles(root);
    const chaptersDir = path.join(root, 'chapters');
    const files = fs.existsSync(chaptersDir) ? fs.readdirSync(chaptersDir) : [];

    const chapters = files
        .map((f) => ({ f, m: f.match(/^(\d+)\.md$/) }))
        .filter((x) => x.m)
        .map(({ f, m }) => {
            const no = parseInt(m[1], 10);
            const markdown = fs.readFileSync(path.join(chaptersDir, f), 'utf8');
            const { heading, body } = splitHeading(markdown);
            const html = marked.parse(body, { async: false, breaks: false });
            return {
                no,
                title: titles.get(no) || heading || `Chương ${no}`,
                content: html,
                wordCount: countWords(body),
                sourceHash: crypto.createHash('sha256').update(markdown).digest('hex')
            };
        })
        .sort((a, b) => a.no - b.no);

    return {
        book: { title: book.title.trim(), synopsis: (book.synopsis || '').trim() },
        phase: progress.phase || null,
        totalChapters: chapters.length,
        chapters
    };
}

module.exports = { readWorkspace, countWords };
