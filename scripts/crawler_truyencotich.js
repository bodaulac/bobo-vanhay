import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

const WorkSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    excerpt: String,
    thumbnail: String, // New field for thumbnail
    type: String,
    category: String,
    slug: { type: String, unique: true },
    sourceUrl: String,
    views: { type: Number, default: 0 }
}, { timestamps: true });

const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema);

function slugify(text) {
    if (!text) return 'no-title-' + Date.now();
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function classifyCategory(title, url) {
    const text = (title + ' ' + url).toLowerCase();
    if (text.includes('viet-nam') || text.includes('co-tich-viet-nam')) return 'Truyện cổ tích Việt Nam';
    if (text.includes('the-gioi') || text.includes('co-tich-the-gioi')) return 'Truyện cổ tích Thế Giới';
    if (text.includes('ngu-ngon')) return 'Truyện ngụ ngôn';
    if (text.includes('cuoi')) return 'Truyện cười';
    if (text.includes('be-nghe')) return 'Chuyện kể bé nghe';
    if (text.includes('than-thoai')) return 'Thần thoại';
    if (text.includes('thieu-nhi')) return 'Văn học thiếu nhi';
    return 'Truyện cổ tích';
}

async function scrapeTruyenCoTich() {
    console.log("🚀 Robot đang nạp dữ liệu chuyên sâu từ truyencotich.top...");
    try {
        await mongoose.connect(MONGODB_URI);
        
        const response = await axios.get('https://truyencotich.top/', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        
        const links = [];
        $('a[href*="/doc-truyen/"]').each((i, el) => {
            let href = $(el).attr('href');
            if (href) {
                const fullUrl = href.startsWith('http') ? href : `https://truyencotich.top${href}`;
                if (!links.includes(fullUrl)) links.push(fullUrl);
            }
        });

        console.log(`🔍 Tìm thấy ${links.length} link truyện.`);

        for (const link of links) {
            try {
                const page = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $$ = cheerio.load(page.data);
                
                const title = $$('.posttitle, h1.entry-title').text().trim();
                const content = $$('.article-post, .entry-content').html();
                
                // Extract thumbnail from og:image meta tag
                let thumbnail = $$('meta[property="og:image"]').attr('content');
                if (!thumbnail) {
                    // Fallback to first image in content
                    thumbnail = $$('.article-post img').first().attr('src');
                }
                if (thumbnail && !thumbnail.startsWith('http')) {
                    thumbnail = 'https://truyencotich.top' + thumbnail;
                }

                if (!title || !content) continue;

                const category = classifyCategory(title, link);
                const slug = slugify(title);
                const existing = await Work.findOne({ slug });
                
                if (!existing) {
                    let excerpt = $$('.article-post p').first().text().trim();
                    if (!excerpt) excerpt = title;
                    excerpt = excerpt.substring(0, 200) + "...";

                    await Work.create({
                        title,
                        author: "Sưu tầm",
                        content,
                        excerpt,
                        thumbnail,
                        type: 'story',
                        category: category,
                        slug,
                        sourceUrl: link
                    });
                    console.log(`✅ Đã nạp chuẩn: ${title} [${category}]`);
                } else {
                    // Update existing with thumbnail and category if missing
                    existing.thumbnail = thumbnail;
                    existing.category = category;
                    await existing.save();
                    console.log(`🆙 Đã cập nhật: ${title}`);
                }
            } catch (err) {
                console.error(`❌ Lỗi: ${link} - ${err.message}`);
            }
        }
    } catch (error) {
        console.error("❌ Lỗi Robot:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("🏁 Hoàn tất.");
    }
}

scrapeTruyenCoTich();
