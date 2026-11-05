import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import localAIService from '../src/lib/services/localAIService.js';
import config from '../config.js';
import Work from '../models/Work.js';

// Configuration
const MONGODB_URI = config.mongodbUri;


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

function createExcerpt(content, maxLength = 150) {
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.length > maxLength 
        ? plainText.substring(0, maxLength) + '...' 
        : plainText;
}

// Source Websites
const SOURCE_SITES = [
    {
        name: 'truyencotich.top',
        url: 'https://truyencotich.top/',
        linkSelector: 'a[href*="/doc-truyen/"]',
        titleSelector: '.posttitle, h1.entry-title',
        contentSelector: '.article-post, .entry-content',
        defaultCategory: 'Truyện cổ tích Việt Nam'
    }
];

// Category detection
function detectCategory(title, content) {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();
    
    const categoryKeywords = {
        'Truyện cổ tích Việt Nam': ['cổ tích', 'tích chu', 'tấm cám', 'sơn tinh', 'thủy tinh'],
        'Truyện ngụ ngôn': ['ngụ ngôn', 'rùa và thỏ', 'chó sói', 'kiến và chim bồ câu'],
        'Thần thoại Việt Nam': ['thần thoại', 'lạc long quân', 'âu cơ', 'sơn tinh', 'thủy tinh'],
        'Truyền thuyết địa phương': ['truyền thuyết', 'hồ gươm', 'sự tích', 'địa phương'],
        'Ca dao, tục ngữ': ['ca dao', 'tục ngữ', 'thành ngữ'],
        'Văn học dân gian': ['dân gian', 'truyện kể', 'cổ truyện']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'Văn học Việt Nam';
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
            if (i < 2) { // Test với 2 links đầu tiên
                let href = $(el).attr('href');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
                    if (!links.includes(fullUrl)) {
                        links.push({
                            url: fullUrl,
                            source: source.name,
                            defaultCategory: source.defaultCategory
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

// Process Single Story with Local AI
async function processStoryWithLocalAI(linkInfo) {
    const { url, source, defaultCategory } = linkInfo;
    
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
        let originalContent = $(sourceConfig?.contentSelector || 'article').html() || 
                             $(sourceConfig?.contentSelector || 'article').text();
        
        if (!title || !originalContent || originalContent.length < 300) {
            console.log(`   ⚠️ Bỏ qua: Nội dung quá ngắn (${originalContent?.length || 0} chars)`);
            return false;
        }
        
        // Check if already exists
        const slug = slugify(title);
        const existing = await Work.findOne({ slug });
        if (existing) {
            console.log(`   ⚠️ Đã tồn tại: ${title}`);
            return false;
        }
        
        // Detect category
        const category = detectCategory(title, originalContent);
        
        // Step 1: Local AI Rewrite Content
        console.log(`   🤖 Đang Local AI rewrite content...`);
        const rewrittenContent = await localAIService.rewriteContent(originalContent, {
            style: 'vietnamese_classic',
            addMoral: true,
            length: 'medium'
        });
        
        // Step 2: Local AI Generate Image Prompt
        console.log(`   🎨 Đang Local AI generate image prompt...`);
        const imagePrompt = await localAIService.generateImagePrompt(title, rewrittenContent);
        
        // Create HTML content
        const htmlContent = `
            <h2>${title}</h2>
            <div class="story-content">
                ${rewrittenContent}
            </div>
            <div class="story-meta">
                <p><em>Nguồn: ${source} | Đã được AI biên tập</em></p>
            </div>
        `;
        
        // Create excerpt
        const excerpt = createExcerpt(rewrittenContent);
        
        // Generate tags
        const tags = [
            category.toLowerCase().replace(/ /g, '-'),
            'ai-enhanced',
            'local-ai',
            ...title.toLowerCase().split(' ').filter(word => word.length > 2).slice(0, 3)
        ];
        
        // Placeholder image (will be replaced with AI-generated image later)
        const placeholderUrl = `https://via.placeholder.com/800x450/431407/ffffff?text=${encodeURIComponent(title.substring(0, 20))}`;
        
        // Save to Database
        await Work.create({
            title: title,
            author: "Local AI Biên tập",
            content: htmlContent,
            excerpt: excerpt,
            thumbnail: placeholderUrl,
            type: 'story',
            category: category,
            subcategory: defaultCategory,
            tags: tags,
            slug: slug,
            sourceUrl: url,
            aiEnhanced: true,
            localAIRewrite: true,
            imagePrompt: imagePrompt,
            views: Math.floor(Math.random() * 100)
        });
        
        console.log(`   ✅ Đã tạo với Local AI: ${title}`);
        console.log(`   🏷️ Category: ${category}`);
        console.log(`   🤖 AI Enhanced: Yes`);
        console.log(`   🎨 Image Prompt: ${imagePrompt.substring(0, 80)}...`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Lỗi xử lý ${url}:`, error.message);
        return false;
    }
}

// Check Local AI Health
async function checkLocalAIHealth() {
    console.log("🔍 Kiểm tra Local AI service...");
    
    const health = await localAIService.checkHealth();
    
    if (health.available) {
        console.log("✅ Local AI service is available");
        console.log(`   Available models: ${health.models.join(', ')}`);
        console.log(`   Required model (${localAIService.model}): ${health.hasRequiredModel ? '✅ Found' : '⚠️ Not found'}`);
        
        if (!health.hasRequiredModel) {
            console.log("⚠️ Warning: Required model not found. Using fallback enhancement.");
        }
        
        return health.hasRequiredModel;
    } else {
        console.log("❌ Local AI service is not available");
        console.log(`   Error: ${health.error}`);
        console.log("⚠️ Will use fallback enhancement instead");
        return false;
    }
}

// Main Function
async function main() {
    console.log("🚀 BẮT ĐẦU LOCAL AI CRAWLER");
    console.log("=" .repeat(50));
    
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("📦 Đã kết nối MongoDB");
        
        // Check Local AI health
        const aiAvailable = await checkLocalAIHealth();
        
        if (!aiAvailable) {
            console.log("\n⚠️ Local AI không khả dụng. Tiếp tục với fallback mode...");
        }
        
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
        
        // Process stories with Local AI
        let successCount = 0;
        for (const linkInfo of allLinks) {
            const success = await processStoryWithLocalAI(linkInfo);
            if (success) successCount++;
            
            // Delay between processing to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Get total count after
        const afterCount = await Work.countDocuments();
        const newCount = afterCount - beforeCount;
        
        // Get AI-enhanced stories count
        const aiStories = await Work.countDocuments({ localAIRewrite: true });
        
        console.log("\n" + "=" .repeat(50));
        console.log("🎉 HOÀN TẤT LOCAL AI CRAWLER!");
        console.log("=" .repeat(50));
        console.log(`📈 KẾT QUẢ:`);
        console.log(`   • Links processed: ${allLinks.length}`);
        console.log(`   • Stories created: ${successCount}`);
        console.log(`   • Total in DB: ${afterCount} (+${newCount})`);
        console.log(`   • Local AI enhanced: ${aiStories} stories`);
        console.log(`   • AI Availability: ${aiAvailable ? '✅ Available' : '❌ Not available'}`);
        
        // Show sample of AI-enhanced content
        if (aiStories > 0) {
            const sample = await Work.findOne({ localAIRewrite: true });
            console.log(`\n📝 SAMPLE AI-ENHANCED STORY:`);
            console.log(`   Title: ${sample.title}`);
            console.log(`   Category: ${sample.category}`);
            console.log(`   Excerpt: ${sample.excerpt.substring(0, 100)}...`);
        }
        
    } catch (error) {
        console.error("❌ Lỗi chính:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("📦 Đã ngắt kết nối MongoDB");
    }
}

// Run the crawler
main();