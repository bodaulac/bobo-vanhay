import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';

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

async function rewriteWithAI(title, originalContent, category) {
    console.log(`🤖 AI đang biên tập lại: ${title}...`);
    try {
        const prompt = `
            Bạn là một nhà văn, chuyên gia biên tập văn học cổ điển và hiện đại Việt Nam.
            Nhiệm vụ của bạn là viết lại câu chuyện sau đây dựa trên nội dung gốc nhưng với văn phong truyền cảm, lôi cuốn và mang đậm bản sắc văn hóa Việt.
            
            Tiêu đề: ${title}
            Thể loại: ${category}
            Nội dung gốc: ${originalContent.substring(0, 10000)}

            YÊU CẦU:
            1. Giữ nguyên cốt truyện và các tình tiết quan trọng.
            2. Sử dụng ngôn ngữ phong phú, hình ảnh so sánh sinh động.
            3. Trình bày bằng mã HTML (h2, p, strong, em).
            4. Viết lại phần mở đầu thật ấn tượng và kết thúc có ý nghĩa giáo dục sâu sắc hoặc lời nhắn nhủ từ AI Lạc.
            5. Độ dài tối thiểu 800 từ.

            TRẢ VỀ ĐỊNH DẠNG JSON:
            {
                "newTitle": "Tiêu đề mới hấp dẫn hơn",
                "newContent": "Nội dung đã được biên tập lại (HTML)",
                "newExcerpt": "Đoạn tóm tắt ngắn (150 ký tự)"
            }
        `;

        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, {
            headers: { 'Authorization': 'Bearer cliproxy-secret' },
            timeout: 120000
        });

        const aiResult = JSON.parse(response.data.choices[0].message.content);
        return aiResult;
    } catch (error) {
        console.error("❌ Lỗi AI biên tập:", error.message);
        return null;
    }
}

async function scrapeAndRewrite() {
    console.log("🚀 Robot 'Biên tập viên AI' bắt đầu làm việc...");
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

        for (const link of links.slice(0, 5)) { // Demo 5 stories for first batch
            try {
                const page = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $$ = cheerio.load(page.data);
                
                const title = $$('.posttitle, h1.entry-title').text().trim();
                const originalContent = $$('.article-post, .entry-content').html();
                let thumbnail = $$('meta[property="og:image"]').attr('content');
                if (thumbnail && !thumbnail.startsWith('http')) thumbnail = 'https://truyencotich.top' + thumbnail;

                if (!title || !originalContent) continue;

                const slug = slugify(title);
                const existing = await Work.findOne({ slug });
                
                if (existing && existing.content.length < 500) { // If original is short, or not rewritten yet
                    const rewritten = await rewriteWithAI(title, originalContent, "Truyện cổ tích");
                    if (rewritten) {
                        existing.title = rewritten.newTitle;
                        existing.content = rewritten.newContent;
                        existing.excerpt = rewritten.newExcerpt;
                        existing.thumbnail = thumbnail;
                        await existing.save();
                        console.log(`✨ Đã biên tập lại thành công: ${rewritten.newTitle}`);
                    }
                }
            } catch (err) {
                console.error(`❌ Lỗi tại ${link}:`, err.message);
            }
        }
    } catch (error) {
        console.error("❌ Lỗi Robot:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

scrapeAndRewrite();
