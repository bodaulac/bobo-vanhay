import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import imageService from '../src/lib/services/imageService.js';

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";
const AI_PROXY_URL = "http://127.0.0.1:9090/v1/chat/completions";

const WorkSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    excerpt: String,
    thumbnail: String,
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

async function processStory(link) {
    try {
        const page = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(page.data);
        
        const title = $$('.posttitle, h1.entry-title').text().trim();
        const originalContent = $$('.article-post, .entry-content').html();
        let originalImg = $$('meta[property="og:image"]').attr('content');

        if (!title || !originalContent) return;

        console.log(`🤖 Đang biên tập bài: ${title}`);
        
        const prompt = `
            Bạn là nhà văn biên tập cho Bobo Văn Học. Hãy viết lại truyện: "${title}"
            Văn phong: Truyền cảm, sâu sắc, phong phú từ ngữ, mang đậm hồn Việt.
            Độ dài: Tối thiểu 1000 từ.
            Định dạng: HTML (h2, p, strong).
            Kết bài: Có bài học nhân văn sâu sắc.
            
            QUAN TRỌNG: Trả về TUYỆT ĐỐI định dạng JSON hợp lệ, KHÔNG markdown backticks.
            JSON: { "title": "...", "content": "...", "excerpt": "...", "imageDescription": "..." }
        `;

        const aiResponse = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview", // Use Pro for writing
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer cliproxy-secret' }, timeout: 150000 });

        let rawContent = aiResponse.data.choices[0].message.content;
        rawContent = rawContent.replace(/```json\n?|```/g, '').trim();
        const aiData = JSON.parse(rawContent);
        
        // Use Nano Banana (Flash) for any image-related descriptions or future tasks
        console.log(`🎨 Robot 'Nano Banana' đang lên ý tưởng minh họa cho: ${title}`);

        // Upload to Backblaze
        let finalImg = originalImg;
        if (originalImg) {
            finalImg = await imageService.uploadFromUrl(originalImg, `${slugify(title)}-thumb.jpg`);
        }

        const slug = slugify(aiData.title);
        await Work.findOneAndUpdate(
            { slug },
            {
                title: aiData.title,
                content: aiData.content,
                excerpt: aiData.excerpt,
                thumbnail: finalImg,
                author: "Biên tập bởi AI Lạc",
                type: 'story',
                category: "Truyện cổ tích",
                sourceUrl: link
            },
            { upsert: true, new: true }
        );
        console.log(`✅ Xuất bản thành công: ${aiData.title}`);
    } catch (err) {
        console.error(`❌ Lỗi xử lý ${link}:`, err.message);
    }
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const response = await axios.get('https://truyencotich.top/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        const links = [];
        $('a[href*="/doc-truyen/"]').each((i, el) => {
            if (i < 5) {
                let href = $(el).attr('href');
                const fullUrl = href.startsWith('http') ? href : `https://truyencotich.top${href}`;
                if (!links.includes(fullUrl)) links.push(fullUrl);
            }
        });

        for (const link of links) {
            await processStory(link);
        }
    } finally {
        await mongoose.disconnect();
    }
}

run();
