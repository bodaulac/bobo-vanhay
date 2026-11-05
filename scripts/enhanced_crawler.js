import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import crypto from 'crypto';
import config from '../config.js';
import Work from '../models/Work.js';

// Configuration
const MONGODB_URI = config.mongodbUri;
const AI_PROXY_URL = config.aiProxy.url;

// Backblaze B2 Configuration
const B2_AUTH_BASE64 = config.b2.authBase64;


// Helper Functions
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

// Category Mapping
const CATEGORY_MAP = {
    'truyện cổ tích': 'Truyện cổ tích Việt Nam',
    'truyện ngụ ngôn': 'Truyện ngụ ngôn',
    'thần thoại': 'Thần thoại Việt Nam',
    'truyền thuyết': 'Truyền thuyết địa phương',
    'văn học dân gian': 'Văn học dân gian',
    'ca dao': 'Ca dao, tục ngữ',
    'chuyện kể': 'Chuyện kể dân gian',
    'default': 'Văn học Việt Nam'
};

// Source Websites
const SOURCE_SITES = [
    {
        name: 'truyencotich.top',
        url: 'https://truyencotich.top/',
        linkSelector: 'a[href*="/doc-truyen/"]',
        titleSelector: '.posttitle, h1.entry-title',
        contentSelector: '.article-post, .entry-content',
        category: 'Truyện cổ tích Việt Nam'
    },
    {
        name: 'thuvientruyencotich.vn',
        url: 'https://thuvientruyencotich.vn/',
        linkSelector: 'a[href*="/truyen/"]',
        titleSelector: 'h1.title',
        contentSelector: '.content-detail',
        category: 'Truyện cổ tích Việt Nam'
    },
    {
        name: 'truyencotichhay.com',
        url: 'https://truyencotichhay.com/',
        linkSelector: 'a[href*="/truyen/"]',
        titleSelector: 'h1.entry-title',
        contentSelector: '.entry-content',
        category: 'Truyện cổ tích Việt Nam'
    }
];

// AI Rewrite Function
async function rewriteWithAI(title, originalContent, category) {
    console.log(`🤖 AI đang biên tập: ${title}...`);
    try {
        const prompt = `
            BẠN LÀ: Nhà văn chuyên nghiệp, chuyên gia văn học Việt Nam cổ điển
            NHIỆM VỤ: Biên tập lại câu chuyện với văn phong cổ điển nhưng giữ nguyên cốt truyện
            
            THÔNG TIN:
            - Tiêu đề gốc: ${title}
            - Thể loại: ${category}
            - Nội dung gốc: ${originalContent.substring(0, 2500)}
            
            YÊU CẦU VĂN PHONG CỔ ĐIỂN:
            1. Giữ nguyên cốt truyện, nhân vật, bài học
            2. Văn phong: Cổ điển, trang trọng, giàu hình ảnh
            3. Từ ngữ: Sử dụng từ Hán-Việt phù hợp, thành ngữ, tục ngữ
            4. Cấu trúc: Mở bài hoành tráng, thân bài chi tiết, kết bài sâu sắc
            5. Độ dài: 600-900 từ
            6. Định dạng: HTML (h2, p, strong, em, blockquote)
            7. Thêm bài học đạo đức cuối bài
            
            TRẢ VỀ JSON:
            {
                "title": "Tiêu đề mới (giữ ý chính)",
                "content": "Nội dung HTML đã biên tập",
                "excerpt": "Tóm tắt 120-150 ký tự",
                "category": "Thể loại chính",
                "subcategory": "Thể loại phụ",
                "tags": ["tag1", "tag2", "tag3"]
            }
        `;

        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, {
            headers: { 'Authorization': config.aiProxy.auth },
            timeout: 90000
        });

        const aiResult = JSON.parse(response.data.choices[0].message.content);
        return aiResult;
    } catch (error) {
        console.error("❌ Lỗi AI rewrite:", error.message);
        return null;
    }
}

// AI Image Generation
async function generateImageWithAI(title, category) {
    console.log(`🎨 AI đang tạo ảnh minh họa: ${title}...`);
    try {
        const prompt = `
            Tạo ảnh minh họa cho truyện cổ tích Việt Nam:
            - Tiêu đề: ${title}
            - Thể loại: ${category}
            
            YÊU CẦU:
            1. Phong cách: Tranh dân gian Việt Nam, màu nước
            2. Nội dung: Minh họa cảnh chính trong truyện
            3. Màu sắc: Ấm áp, tự nhiên
            4. Tỷ lệ: 16:9, landscape
            5. Không chữ, không watermark
        `;

        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8
        }, {
            headers: { 'Authorization': config.aiProxy.auth },
            timeout: 60000
        });

        const imageDescription = response.data.choices[0].message.content;
        
        // For now, return placeholder. In production, use DALL-E/Stable Diffusion API
        console.log(`📝 Image prompt: ${imageDescription.substring(0, 100)}...`);
        return "https://via.placeholder.com/800x450/431407/ffffff?text=Văn+Hay+AI";
        
    } catch (error) {
        console.error("❌ Lỗi AI image:", error.message);
        return "https://via.placeholder.com/800x450/431407/ffffff?text=Văn+Hay";
    }
}

// Backblaze B2 Upload
async function uploadToB2(imageUrl, filename) {
    try {
        console.log(`📤 Đang upload ảnh lên Backblaze B2: ${filename}`);
        
        // Get authorization
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${B2_AUTH_BASE64}` }
        });
        
        const { apiUrl, authorizationToken, allowed } = authRes.data;
        const bucketId = allowed.bucketId;

        // Get upload URL
        const uploadUrlRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            bucketId: bucketId
        }, { headers: { 'Authorization': authorizationToken } });
        
        const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlRes.data;

        // Download image
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageRes.data, 'binary');
        const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

        // Upload to B2
        await axios.post(uploadUrl, buffer, {
            headers: {
                'Authorization': uploadAuthToken,
                'X-Bz-File-Name': encodeURIComponent(`vanhoc/${filename}`),
                'Content-Type': 'image/jpeg',
                'X-Bz-Content-Sha1': sha1
            }
        });

        // Construct public URL
        const downloadUrl = authRes.data.downloadUrl;
        const publicUrl = `${downloadUrl}/file/${allowed.bucketName}/vanhoc/${filename}`;
        
        console.log(`✅ Đã upload thành công: ${publicUrl}`);
        return publicUrl;
        
    } catch (error) {
        console.error('❌ Lỗi B2 upload:', error.response?.data || error.message);
        return imageUrl; // Fallback to original URL
    }
}

// Extract Links from Source
async function extractLinksFromSource(source) {
    try {
        console.log(`🔍 Đang crawl: ${source.name}`);
        const response = await axios.get(source.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const links = [];
        
        $(source.linkSelector).each((i, el) => {
            if (i < 5) { // Limit to 5 links per source
                let href = $(el).attr('href');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
                    if (!links.includes(fullUrl)) {
                        links.push({
                            url: fullUrl,
                            source: source.name,
                            category: source.category
                        });
                    }
                }
            }
        });
        
        console.log(`   📚 Tìm thấy ${links.length} links từ ${source.name}`);
        return links;
        
    } catch (error) {
        console.error(`❌ Lỗi crawl ${source.name}:`, error.message);
        return [];
    }
}

// Process Single Story
async function processStory(linkInfo) {
    const { url, source, category } = linkInfo;
    
    try {
        console.log(`\n📖 Đang xử lý: ${url}`);
        
        // Fetch page
        const page = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 30000
        });
        
        const $ = cheerio.load(page.data);
        
        // Extract content
        const sourceConfig = SOURCE_SITES.find(s => s.name === source);
        const title = $(sourceConfig?.titleSelector || 'h1').first().text().trim();
        const originalContent = $(sourceConfig?.contentSelector || 'article').text().trim();
        
        if (!title || originalContent.length < 200) {
            console.log(`   ⚠️ Bỏ qua: Nội dung quá ngắn hoặc không có tiêu đề`);
            return;
        }
        
        // Check if already exists
        const slug = slugify(title);
        const existing = await Work.findOne({ slug });
        if (existing) {
            console.log(`   ⚠️ Đã tồn tại: ${title}`);
            return;
        }
        
        // AI Rewrite
        const aiContent = await rewriteWithAI(title, originalContent, category);
        if (!aiContent) {
            console.log(`   ⚠️ Bỏ qua: AI không trả về kết quả`);
            return;
        }
        
        // Generate Image
        const imageUrl = await generateImageWithAI(aiContent.title, aiContent.category);
        
        // Upload to B2
        const imageFilename = `${slug}-${Date.now()}.jpg`;
        const b2ImageUrl = await uploadToB2(imageUrl, imageFilename);
        
        // Save to Database
        await Work.create({
            title: aiContent.title,
            author: "Biên tập bởi Văn Hay AI",
            content: aiContent.content,
            excerpt: aiContent.excerpt,
            thumbnail: b2ImageUrl,
            type: 'story',
            category: aiContent.category || category,
            subcategory: aiContent.subcategory || '',
            tags: aiContent.tags || [],
            slug: slugify(aiContent.title),
            sourceUrl: url,
            aiGenerated: true,
            b2ImageUrl: b2ImageUrl
        });
        
        console.log(`   ✅ Đã tạo: ${aiContent.title}`);
        console.log(`   🏷️ Category: ${aiContent.category}`);
        console.log(`   🖼️ Image: ${b2ImageUrl}`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Lỗi xử lý ${url}:`, error.message);
        return false;
    }
}

// Main Function
async function main() {
    console.log("🚀 BẮT ĐẦU ENHANCED CRAWLER - VĂN HAY AI");
    console.log("=" .repeat(50));
    
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("📦 Đã kết nối MongoDB");
        
        // Get total count before
        const beforeCount = await Work.countDocuments();
        console.log(`📊 Stories hiện có: ${beforeCount}`);
        
        // Extract links from all sources
        let allLinks = [];
        for (const source of SOURCE_SITES) {
            const links = await extractLinksFromSource(source);
            allLinks = [...allLinks, ...links];
        }
        
        console.log(`\n🔗 Tổng cộng: ${allLinks.length} links từ ${SOURCE_SITES.length} sources`);
        
        // Process stories
        let successCount = 0;
        for (const linkInfo of allLinks) {
            const success = await processStory(linkInfo);
            if (success) successCount++;
            
            // Small delay between processing
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Get total count after
        const afterCount = await Work.countDocuments();
        const newCount = afterCount - beforeCount;
        
        console.log("\n" + "=" .repeat(50));
        console.log("🎉 HOÀN TẤT CRAWLER RUN!");
        console.log("=" .repeat(50));
        console.log(`📈 KẾT QUẢ:`);
        console.log(`   • Links processed: ${allLinks.length}`);
        console.log(`   • Stories created: ${successCount}`);
        console.log(`   • Total in DB: ${afterCount} (+${newCount})`);
        console.log(`   • Failed: ${allLinks.length - successCount}`);
        console.log(`\n⏰ Next run: 1 hour from now`);
        
    } catch (error) {
        console.error("❌ Lỗi chính:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("📦 Đã ngắt kết nối MongoDB");
    }
}

// Run the crawler
main();