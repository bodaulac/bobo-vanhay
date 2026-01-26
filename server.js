const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Database
const MONGODB_URI = "mongodb://root:examplepassword@127.0.0.1:27017/bobo-vanhoc?authSource=admin&directConnection=true&replicaSet=rs0";

// Improved MongoDB connection with retry logic
async function connectMongoDB() {
    let retries = 5;
    
    while (retries > 0) {
        try {
            await mongoose.connect(MONGODB_URI, {
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
                console.error('💡 Check:');
                console.error('   1. MongoDB Docker container is running');
                console.error('   2. Password is correct: examplepassword');
                console.error('   3. Network connectivity');
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
    const slug = req.params.slug.replace(/["%22]/g, '').replace(/%20/g, '-'); // Clean potential quotes and convert %20 to hyphen
    
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
