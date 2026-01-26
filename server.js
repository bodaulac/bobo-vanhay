const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Database
const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Basic Work Model
const WorkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Sưu tầm' },
    content: String,
    excerpt: String,
    thumbnail: String,
    type: String,
    category: String,
    tags: [String],
    slug: { type: String, unique: true },
    sourceUrl: String,
    views: { type: Number, default: 0 }
}, { timestamps: true });
const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
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

// Routes
app.get('/', async (req, res) => {
    try {
        const latestWorks = await Work.find({ title: { $exists: true } }).sort({ createdAt: -1 }).limit(12);
        res.render('index', { latestWorks, menu: NAV_MENU });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Dynamic Slug Route
app.get('/:slug', async (req, res, next) => {
    const slug = req.params.slug.replace(/["%22]/g, ''); // Clean potential quotes from URL
    
    // 1. Check if it's a category
    const menuItem = NAV_MENU.find(m => m.href === '/' + slug);
    if (menuItem) {
        try {
            const works = await Work.find({ 
                $or: [
                    { category: new RegExp(menuItem.name.replace('Truyện ', ''), 'i') },
                    { category: new RegExp(menuItem.name, 'i') }
                ]
            }).sort({ createdAt: -1 });
            return res.render('category', { title: menuItem.name, works, menu: NAV_MENU });
        } catch (err) {
            return res.status(500).send('Server Error');
        }
    }

    // 2. Check if it's a specific Work
    try {
        const work = await Work.findOne({ slug: slug });
        if (!work) return next();
        
        await Work.updateOne({ _id: work._id }, { $inc: { views: 1 } });
        work.views += 1;

        const related = await Work.find({ category: work.category, _id: { $ne: work._id } }).limit(4);
        res.render('detail', { work, related, menu: NAV_MENU });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Final 404
app.use((req, res) => {
    res.status(404).render('category', { title: '404 - Không tìm thấy', works: [], menu: NAV_MENU });
});

app.listen(PORT, () => {
    console.log(`🚀 Văn Hay is running on http://localhost:${PORT}`);
});
