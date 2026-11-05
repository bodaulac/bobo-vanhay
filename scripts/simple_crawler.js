import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
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

function enhanceContentClassic(originalContent) {
    // Simple enhancement for classic Vietnamese style
    const enhancements = [
        "Ngày xửa ngày xưa, ",
        "Thuở ấy, ",
        "Từ thuở xa xưa, ",
        "Vào một ngày nọ, ",
        "Chuyện kể rằng, "
    ];
    
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    return randomEnhancement + originalContent;
}

// Source Websites with detailed categories
const SOURCE_SITES = [
    {
        name: 'truyencotich.top',
        url: 'https://truyencotich.top/',
        linkSelector: 'a[href*="/doc-truyen/"]',
        titleSelector: '.posttitle, h1.entry-title',
        contentSelector: '.article-post, .entry-content',
        defaultCategory: 'Truyện cổ tích Việt Nam',
        possibleCategories: [
            'Truyện cổ tích Việt Nam',
            'Truyện ngụ ngôn',
            'Văn học dân gian',
            'Chuyện kể dân gian'
        ]
    }
];

// Category detection from title/content
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
            if (i < 8) { // Get 8 links for variety
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

// Process Single Story
async function processStory(linkInfo) {
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
        let content = $(sourceConfig?.contentSelector || 'article').html() || 
                     $(sourceConfig?.contentSelector || 'article').text();
        
        if (!title || !content || content.length < 300) {
            console.log(`   ⚠️ Bỏ qua: Nội dung quá ngắn (${content?.length || 0} chars)`);
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
        const category = detectCategory(title, content);
        
        // Enhance content with classic style
        const enhancedContent = enhanceContentClassic(content);
        
        // Create HTML content
        const htmlContent = `
            <h2>${title}</h2>
            <div class="story-content">
                ${enhancedContent}
            </div>
            <div class="moral-lesson">
                <p><strong>Bài học:</strong> Câu chuyện dạy chúng ta về những giá trị tốt đẹp trong cuộc sống.</p>
            </div>
        `;
        
        // Create excerpt
        const excerpt = createExcerpt(enhancedContent);
        
        // Generate tags from title and category
        const tags = [
            category.toLowerCase().replace(/ /g, '-'),
            ...title.toLowerCase().split(' ').filter(word => word.length > 2).slice(0, 3)
        ];
        
        // Save to Database
        await Work.create({
            title: title,
            author: "Sưu tầm và biên tập",
            content: htmlContent,
            excerpt: excerpt,
            thumbnail: "https://via.placeholder.com/800x450/431407/ffffff?text=" + encodeURIComponent(title.substring(0, 20)),
            type: 'story',
            category: category,
            subcategory: defaultCategory,
            tags: tags,
            slug: slug,
            sourceUrl: url,
            aiEnhanced: false,
            views: Math.floor(Math.random() * 100) // Random initial views
        });
        
        console.log(`   ✅ Đã tạo: ${title}`);
        console.log(`   🏷️ Category: ${category}`);
        console.log(`   📝 Excerpt: ${excerpt.substring(0, 80)}...`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Lỗi xử lý ${url}:`, error.message);
        return false;
    }
}

// Main Function
async function main() {
    console.log("🚀 BẮT ĐẦU SIMPLE CRAWLER - VĂN HAY");
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
            await new Promise(resolve => setTimeout(resolve, 1000));
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
        
        // Show categories distribution
        const categories = await Work.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        console.log(`\n📚 PHÂN BỐ THỂ LOẠI:`);
        categories.forEach(cat => {
            console.log(`   • ${cat._id}: ${cat.count} stories`);
        });
        
        console.log(`\n⏰ Next run: Có thể setup cron job mỗi giờ`);
        
    } catch (error) {
        console.error("❌ Lỗi chính:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("📦 Đã ngắt kết nối MongoDB");
    }
}

// Run the crawler
main();