// Trang công khai cho truyện dài: /sach, /sach/:slug, /sach/:slug/chuong-:no
const express = require('express');
const config = require('../../config');
const Novel = require('../../models/Novel');
const Chapter = require('../../models/Chapter');
const seo = require('../lib/seo');
const { renderContent } = require('../lib/content');

const SLUG_RE = /^[a-z0-9-]{1,100}$/;
const CHAPTERS_PER_PAGE = 100;

module.exports = function novelsRouter(menu) {
    const router = express.Router();
    const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
        console.error(err);
        res.status(500).send('Server Error');
    });

    router.get('/', wrap(async (req, res) => {
        const novels = await Novel.find({ status: 'published' }).sort({ updatedAt: -1 }).limit(60).lean();
        res.render('novels', { novels, menu, seo: seo.novelsSeo() });
    }));

    router.get('/:slug', wrap(async (req, res, next) => {
        if (!SLUG_RE.test(req.params.slug)) return next();
        const novel = await Novel.findOne({ slug: req.params.slug, status: 'published' }).lean();
        if (!novel) return next();
        const page = Math.max(1, Math.min(parseInt(req.query.page, 10) || 1, 10000));
        const filter = { novel: novel.slug, status: 'published' };
        const [chapters, total] = await Promise.all([
            Chapter.find(filter).select('no title wordCount').sort({ no: 1 })
                .skip((page - 1) * CHAPTERS_PER_PAGE).limit(CHAPTERS_PER_PAGE).lean(),
            Chapter.countDocuments(filter)
        ]);
        const totalPages = Math.max(1, Math.ceil(total / CHAPTERS_PER_PAGE));
        res.render('novel', {
            novel,
            chapters,
            total,
            menu,
            seo: seo.novelSeo(novel, page, totalPages),
            pagination: { page, totalPages, url: (n) => `/sach/${novel.slug}${n > 1 ? `?page=${n}` : ''}` }
        });
    }));

    router.get('/:slug/chuong-:no', wrap(async (req, res, next) => {
        const no = parseInt(req.params.no, 10);
        if (!SLUG_RE.test(req.params.slug) || !Number.isInteger(no) || no < 1) return next();
        const novel = await Novel.findOne({ slug: req.params.slug, status: 'published' }).lean();
        if (!novel) return next();
        const chapter = await Chapter.findOne({ novel: novel.slug, no, status: 'published' }).lean();
        if (!chapter) return next();
        const [prev, nextCh] = await Promise.all([
            Chapter.findOne({ novel: novel.slug, status: 'published', no: { $lt: no } }).sort({ no: -1 }).select('no title').lean(),
            Chapter.findOne({ novel: novel.slug, status: 'published', no: { $gt: no } }).sort({ no: 1 }).select('no title').lean()
        ]);
        res.render('chapter', {
            novel,
            chapter,
            prev,
            next: nextCh,
            contentHtml: renderContent(chapter.content),
            readMin: Math.max(1, Math.round((chapter.wordCount || 0) / 220)),
            menu,
            seo: seo.chapterSeo(novel, chapter)
        });
    }));

    return router;
};
