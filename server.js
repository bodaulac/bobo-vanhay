const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const config = require('./config');
const Work = require('./models/Work');
const seo = require('./src/lib/seo');

const app = express();
const PORT = config.port;
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview/i;
const SITEMAP_TTL_MS = 60 * 60 * 1000;
const SITEMAP_MAX_URLS = 50000;

// Improved MongoDB connection with retry logic
async function connectMongoDB() {
    let retries = 5;

    while (retries > 0) {
        try {
            await mongoose.connect(config.mongodbUri, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                retryWrites: true,
                w: 'majority'
            });
            console.log('✅ Connected to MongoDB');
            return;
        } catch (err) {
            console.error(`❌ MongoDB Connection Error (${retries} retries left):`, err.message);
            retries--;

            if (retries === 0) {
                console.error('❌ Failed to connect to MongoDB after multiple attempts');
                console.error('💡 Check MONGODB_URI in .env, that MongoDB is running, and network connectivity');
                // Don't crash the app, continue without DB
                return;
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

connectMongoDB();

// MongoDB connection event listeners
mongoose.connection.on('connected', () => {
    console.log('🔗 MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
});

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use(express.json());

// Consistent Navigation Menu
const NAV_MENU = [
    { name: 'Truyện Cổ Tích', href: '/truyen-co-tich', icon: '✨' },
    { name: 'Truyện Ngụ Ngôn', href: '/truyen-ngu-ngon', icon: '🦊' },
    { name: 'Truyện Truyền Thuyết', href: '/truyen-truyen-thuyet', icon: '🐉' },
    { name: 'Truyện Thần Thoại', href: '/truyen-than-thoai', icon: '🏛️' },
    { name: 'Truyện Cười', href: '/truyen-cuoi', icon: '😆' },
    { name: 'Truyện Thiếu Nhi', href: '/truyen-thieu-nhi', icon: '🎈' },
    { name: 'Quà Tặng Cuộc Sống', href: '/qua-tang-cuoc-song', icon: '🎁' },
    { name: 'Thơ Cho Bé', href: '/tho-cho-be', icon: '📜' }
];

// Chỉ lấy các trường cần cho thẻ danh sách (không tải `content`)
const LIST_FIELDS = 'title slug excerpt thumbnail author category createdAt';

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Nội dung do crawler/AI sinh ra được lưu dạng HTML: lọc trước khi hiển thị
const CONTENT_SANITIZE = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img', 'figure', 'figcaption', 'u']),
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer', target: '_blank' })
    }
};

function menuItemForCategory(category) {
    if (!category) return undefined;
    const c = category.toLowerCase();
    return NAV_MENU.find((m) => {
        const full = m.name.toLowerCase();
        return c.includes(full) || c.includes(full.replace('truyện ', ''));
    });
}

function sourceInfo(sourceUrl) {
    try {
        const u = new URL(sourceUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return { url: u.href, host: u.hostname.replace(/^www\./, '') };
    } catch (err) {
        return null;
    }
}

function parsePage(value) {
    return Math.max(1, Math.min(parseInt(value, 10) || 1, 10000));
}

// Routes
app.get('/', async (req, res) => {
    try {
        const latestWorks = await Work.find({ title: { $exists: true } })
            .select(LIST_FIELDS)
            .sort({ createdAt: -1 })
            .limit(12)
            .lean();
        res.render('index', { latestWorks, menu: NAV_MENU, seo: seo.homeSeo() });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(seo.robotsTxt());
});

let sitemapCache = { xml: null, at: 0 };
app.get('/sitemap.xml', async (req, res) => {
    try {
        if (!sitemapCache.xml || Date.now() - sitemapCache.at > SITEMAP_TTL_MS) {
            const works = await Work.find({ slug: { $exists: true, $ne: '' } })
                .select('slug updatedAt')
                .sort({ createdAt: -1 })
                .limit(SITEMAP_MAX_URLS - NAV_MENU.length - 1)
                .lean();
            const entries = [{ path: '/' }]
                .concat(NAV_MENU.map((m) => ({ path: m.href })))
                .concat(works.map((w) => ({ path: '/' + w.slug, lastmod: w.updatedAt })));
            sitemapCache = { xml: seo.buildSitemap(entries), at: Date.now() };
        }
        res.type('application/xml').send(sitemapCache.xml);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.get('/tim-kiem', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = parsePage(req.query.page);
    const render = (works, total) => {
        const totalPages = Math.max(1, Math.ceil(total / config.pageSize));
        res.render('category', {
            title: q ? `Kết quả cho “${q}”` : 'Tìm kiếm',
            subtitle: q ? `Tìm thấy ${total} truyện phù hợp.` : 'Nhập từ khoá để tìm truyện.',
            emptyMessage: q ? 'Không tìm thấy truyện nào phù hợp. Hãy thử từ khoá khác.' : 'Hãy nhập từ khoá vào ô tìm kiếm.',
            works,
            query: q,
            menu: NAV_MENU,
            seo: seo.searchSeo(q),
            pagination: {
                page,
                totalPages,
                url: (n) => `/tim-kiem?q=${encodeURIComponent(q)}&page=${n}`
            }
        });
    };

    if (!q) return render([], 0);

    try {
        const filter = { $text: { $search: q } };
        const [works, total] = await Promise.all([
            Work.find(filter, { score: { $meta: 'textScore' } })
                .select(LIST_FIELDS)
                .sort({ score: { $meta: 'textScore' } })
                .skip((page - 1) * config.pageSize)
                .limit(config.pageSize)
                .lean(),
            Work.countDocuments(filter)
        ]);
        render(works, total);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Dynamic Slug Route
app.get('/:slug', async (req, res, next) => {
    const slug = req.params.slug.replace(/["%22]/g, '').replace(/%20/g, '-'); // Clean potential quotes and convert %20 to hyphen

    // 1. Check if it's a category
    const menuItem = NAV_MENU.find(m => m.href === '/' + slug);
    if (menuItem) {
        try {
            const page = parsePage(req.query.page);
            const filter = {
                $or: [
                    { category: new RegExp(escapeRegex(menuItem.name.replace('Truyện ', '')), 'i') },
                    { category: new RegExp(escapeRegex(menuItem.name), 'i') }
                ]
            };
            const [works, total] = await Promise.all([
                Work.find(filter)
                    .select(LIST_FIELDS)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * config.pageSize)
                    .limit(config.pageSize)
                    .lean(),
                Work.countDocuments(filter)
            ]);
            const totalPages = Math.max(1, Math.ceil(total / config.pageSize));
            return res.render('category', {
                title: menuItem.name,
                works,
                menu: NAV_MENU,
                seo: seo.categorySeo(menuItem, page, totalPages),
                pagination: {
                    page,
                    totalPages,
                    url: (n) => menuItem.href + (n > 1 ? `?page=${n}` : '')
                }
            });
        } catch (err) {
            console.error(err);
            return res.status(500).send('Server Error');
        }
    }

    // 2. Check if it's a specific Work
    try {
        // Bot không tính lượt xem; người đọc thật tăng views và lấy bài trong một truy vấn
        const isBot = BOT_UA.test(req.get('user-agent') || '');
        const work = isBot
            ? await Work.findOne({ slug }).lean()
            : await Work.findOneAndUpdate({ slug }, { $inc: { views: 1 } }, { new: true }).lean();
        if (!work) return next();

        const related = await Work.find({ category: work.category, _id: { $ne: work._id } })
            .select(LIST_FIELDS)
            .limit(4)
            .lean();
        res.render('detail', {
            work,
            related,
            menu: NAV_MENU,
            contentHtml: sanitizeHtml(work.content || '', CONTENT_SANITIZE),
            source: sourceInfo(work.sourceUrl),
            seo: seo.workSeo(work, menuItemForCategory(work.category))
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Final 404
app.use((req, res) => {
    res.status(404).render('category', {
        title: '404 - Không tìm thấy',
        works: [],
        menu: NAV_MENU,
        seo: seo.notFoundSeo(),
        pagination: null
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Văn Hay is running on http://localhost:${PORT}`);
});
