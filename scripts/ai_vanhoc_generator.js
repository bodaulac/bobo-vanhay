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

async function generateWithAI(title, originalContent, category) {
    console.log(`🤖 AI đang sáng tác: ${title}...`);
    try {
        const prompt = `
            BẠN LÀ: Nhà văn chuyên nghiệp, chuyên gia văn học Việt Nam
            NHIỆM VỤ: Sáng tác lại câu chuyện dựa trên ý tưởng gốc
            
            THÔNG TIN:
            - Tiêu đề gốc: ${title}
            - Thể loại: ${category}
            - Nội dung tham khảo: ${originalContent.substring(0, 3000)}
            
            YÊU CẦU:
            1. SÁNG TÁC HOÀN TOÀN MỚI, không copy nguyên văn
            2. Văn phong: Truyền cảm, sâu sắc, giàu hình ảnh, mang hồn Việt
            3. Cấu trúc: Mở bài ấn tượng, thân bài chi tiết, kết bài ý nghĩa
            4. Độ dài: 800-1200 từ
            5. Định dạng: HTML (h2, p, strong, em)
            6. Thêm bài học nhân văn cuối bài
            
            TRẢ VỀ JSON:
            {
                "title": "Tiêu đề mới hấp dẫn",
                "content": "Nội dung HTML đã sáng tác",
                "excerpt": "Tóm tắt 150 ký tự",
                "category": "Thể loại phù hợp"
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
        console.error("❌ Lỗi AI:", error.message);
        return null;
    }
}

async function getStoryIdeas() {
    console.log("🔍 Đang tìm ý tưởng truyện...");
    try {
        const response = await axios.get('https://truyencotich.top/', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        
        const links = [];
        $('a[href*="/doc-truyen/"]').each((i, el) => {
            if (i < 3) { // Start with 3 stories for testing
                let href = $(el).attr('href');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href : `https://truyencotich.top${href}`;
                    if (!links.includes(fullUrl)) links.push(fullUrl);
                }
            }
        });
        
        return links;
    } catch (error) {
        console.error("❌ Lỗi lấy ý tưởng:", error.message);
        return [];
    }
}

async function processStory(link) {
    try {
        console.log(`📖 Đang xử lý: ${link}`);
        const page = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(page.data);
        
        const title = $$('.posttitle, h1.entry-title').text().trim();
        const originalContent = $$('.article-post, .entry-content').text().substring(0, 3000);
        
        if (!title || !originalContent) {
            console.log(`⚠️ Bỏ qua: Không có nội dung`);
            return;
        }

        // Generate AI content
        const aiContent = await generateWithAI(title, originalContent, "Truyện cổ tích");
        if (!aiContent) {
            console.log(`⚠️ Bỏ qua: AI không trả về kết quả`);
            return;
        }

        // Create slug from AI-generated title
        const slug = slugify(aiContent.title);
        
        // Check if already exists
        const existing = await Work.findOne({ slug });
        if (existing) {
            console.log(`⚠️ Đã tồn tại: ${aiContent.title}`);
            return;
        }

        // Create new work
        await Work.create({
            title: aiContent.title,
            author: "AI Lạc sáng tác",
            content: aiContent.content,
            excerpt: aiContent.excerpt,
            thumbnail: "https://via.placeholder.com/800x450/431407/ffffff?text=Văn+Hay", // Placeholder
            type: 'story',
            category: aiContent.category || "Truyện cổ tích",
            slug: slug,
            sourceUrl: link
        });

        console.log(`✅ Đã sáng tác: ${aiContent.title}`);
        
    } catch (err) {
        console.error(`❌ Lỗi xử lý ${link}:`, err.message);
    }
}

async function main() {
    console.log("🚀 BẮT ĐẦU SÁNG TÁC VĂN HỌC VỚI AI...");
    try {
        await mongoose.connect(MONGODB_URI);
        
        const links = await getStoryIdeas();
        console.log(`📚 Tìm thấy ${links.length} ý tưởng truyện`);
        
        for (const link of links) {
            await processStory(link);
        }
        
        console.log("🎉 HOÀN TẤT SÁNG TÁC!");
        
    } catch (error) {
        console.error("❌ Lỗi chính:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

main();