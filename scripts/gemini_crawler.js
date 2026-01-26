import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import geminiService from '../src/lib/services/geminiService.js';

// Configuration
const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

// MongoDB Schema
const WorkSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    excerpt: String,
    thumbnail: String,
    type: String,
    category: String,
    subcategory: String,
    tags: [String],
    slug: { type: String, unique: true },
    sourceUrl: String,
    views: { type: Number, default: 0 },
    aiEnhanced: { type: Boolean, default: false },
    b2ImageUrl: String,
    imagePrompt: String,
    geminiRewrite: { type: Boolean, default: false },
    geminiCost: { type: Number, default: 0 }
}, { timestamps: true });

const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema);

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
    },
    {
        name: 'thuvienso.com.vn',
        url: 'https://thuvienso.com.vn/truyen-co-tich/',
        linkSelector: 'a[href*="/truyen/"]',
        titleSelector: 'h1.title',
        contentSelector: '.content-detail',
        defaultCategory: 'Truyện cổ tích'
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
            if (i < 3) { // Test với 3 links đầu tiên
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

// Process Single Story with Gemini
async function processStoryWithGemini(linkInfo) {
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
        
        // Get cost before processing
        const costBefore = geminiService.getCostStats().estimatedCost;
        
        // Step 1: Gemini Rewrite Content
        console.log(`   🤖 Đang Gemini rewrite content...`);
        const rewrittenContent = await geminiService.rewriteContent(originalContent, {
            style: 'vietnamese_classic',
            addMoral: true,
            length: 'medium'
        });
        
        // Step 2: Gemini Generate Image Prompt
        console.log(`   🎨 Đang Gemini generate image prompt...`);
        const imagePrompt = await geminiService.generateImagePrompt(title, rewrittenContent);
        
        // Calculate cost for this story
        const costAfter = geminiService.getCostStats().estimatedCost;
        const storyCost = costAfter - costBefore;
        
        // Create HTML content
        const htmlContent = `
            <h2>${title}</h2>
            <div class="story-content">
                ${rewrittenContent}
            </div>
            <div class="story-meta">
                <p><em>Nguồn: ${source} | Đã được Gemini AI biên tập</em></p>
            </div>
        `;
        
        // Create excerpt
        const excerpt = createExcerpt(rewrittenContent);
        
        // Generate tags
        const tags = [
            category.toLowerCase().replace(/ /g, '-'),
            'ai-enhanced',
            'gemini-ai',
            ...title.toLowerCase().split(' ').filter(word => word.length > 2).slice(0, 3)
        ];
        
        // Placeholder image (will be replaced with AI-generated image later)
        const placeholderUrl = `https://via.placeholder.com/800x450/431407/ffffff?text=${encodeURIComponent(title.substring(0, 20))}`;
        
        // Save to Database
        await Work.create({
            title: title,
            author: "Gemini AI Biên tập",
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
            geminiRewrite: true,
            geminiCost: storyCost,
            imagePrompt: imagePrompt,
            views: Math.floor(Math.random() * 100)
        });
        
        console.log(`   ✅ Đã tạo với Gemini: ${title}`);
        console.log(`   🏷️ Category: ${category}`);
        console.log(`   🤖 AI Enhanced: Yes`);
        console.log(`   💰 Cost: $${storyCost.toFixed(6)}`);
        console.log(`   🎨 Image Prompt: ${imagePrompt.substring(0, 80)}...`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Lỗi xử lý ${url}:`, error.message);
        return false;
    }
}

// Process story with fallback enhancement (no AI)
async function processStoryWithFallback(linkInfo) {
    const { url, source, defaultCategory } = linkInfo;
    
    try {
        console.log(`\n📖 Đang xử lý với fallback: ${url}`);
        
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
            console.log(`   ⚠️ Bỏ qua: Nội dung quá ngắn`);
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
        
        // Use simple enhancement (no AI)
        const enhancedContent = geminiService.fallbackEnhancement(originalContent);
        
        // Create HTML content
        const htmlContent = `
            <h2>${title}</h2>
            <div class="story-content">
                ${enhancedContent}
            </div>
            <div class="story-meta">
                <p><em>Nguồn: ${source} | Fallback enhancement (quota exhausted)</em></p>
            </div>
        `;
        
        // Create excerpt
        const excerpt = createExcerpt(enhancedContent);
        
        // Generate tags
        const tags = [
            category.toLowerCase().replace(/ /g, '-'),
            'fallback',
            'no-ai',
            ...title.toLowerCase().split(' ').filter(word => word.length > 2).slice(0, 3)
        ];
        
        // Placeholder image
        const placeholderUrl = `https://via.placeholder.com/800x450/431407/ffffff?text=${encodeURIComponent(title.substring(0, 20))}`;
        
        // Save to Database
        await Work.create({
            title: title,
            author: "Fallback Biên tập",
            content: htmlContent,
            excerpt: excerpt,
            thumbnail: placeholderUrl,
            type: 'story',
            category: category,
            subcategory: defaultCategory,
            tags: tags,
            slug: slug,
            sourceUrl: url,
            aiEnhanced: false,
            geminiRewrite: false,
            geminiCost: 0,
            imagePrompt: `Fallback: ${title}`,
            views: Math.floor(Math.random() * 100)
        });
        
        console.log(`   ✅ Đã tạo với fallback: ${title}`);
        console.log(`   🏷️ Category: ${category}`);
        console.log(`   🤖 AI Enhanced: No (quota exhausted)`);
        console.log(`   💰 Cost: $0`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Lỗi xử lý fallback ${url}:`, error.message);
        return false;
    }
}

// Check Gemini API health
async function checkGeminiHealth() {
    console.log("🔍 Kiểm tra Gemini API...");
    
    try {
        const connected = await geminiService.testConnection();
        
        if (connected) {
            console.log("✅ Gemini API is available");
            return true;
        } else {
            console.log("❌ Gemini API is not available");
            return false;
        }
        
    } catch (error) {
        console.log("❌ Gemini API check failed:", error.message);
        return false;
    }
}

// Main Function
async function main() {
    console.log("🚀 BẮT ĐẦU QUOTA-AWARE GEMINI CRAWLER");
    console.log("=" .repeat(50));
    
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("📦 Đã kết nối MongoDB");
        
        // Check quota status at start
        const initialQuotaStatus = geminiService.getQuotaStatus();
        console.log("\n📊 INITIAL QUOTA STATUS:");
        console.log(`   • Status: ${initialQuotaStatus.status.toUpperCase()}`);
        
        if (initialQuotaStatus.status === 'exhausted') {
            console.log(`\n🚫 QUOTA EXHAUSTED:`);
            console.log(`   • Retry after: ${initialQuotaStatus.retryAfterMinutes} minutes`);
            console.log(`   • Last check: ${initialQuotaStatus.lastCheck}`);
            console.log(`   • Will use fallback enhancement for this run`);
        }
        
        // Check Gemini API health (only if quota is available)
        let geminiAvailable = false;
        if (initialQuotaStatus.status !== 'exhausted') {
            geminiAvailable = await checkGeminiHealth();
            
            if (!geminiAvailable) {
                console.log("\n❌ Không thể tiếp tục mà không có AI API");
                console.log("💡 Kiểm tra:");
                console.log("   1. AI Proxy tại http://127.0.0.1:9090");
                console.log("   2. Internet connection");
                console.log("   3. Proxy configuration");
                return;
            }
        } else {
            console.log("\n⚠️ Quota exhausted. Will use fallback enhancement only.");
            geminiAvailable = false;
        }
        
        // Get total count before
        const beforeCount = await Work.countDocuments();
        console.log(`📊 Stories hiện có: ${beforeCount}`);
        
        // Get Gemini-enhanced stories count
        const geminiStories = await Work.countDocuments({ geminiRewrite: true });
        console.log(`🤖 Gemini-enhanced stories: ${geminiStories}`);
        
        // Extract links from all sources
        let allLinks = [];
        for (const source of SOURCE_SITES) {
            const links = await extractLinksFromSource(source);
            allLinks = [...allLinks, ...links];
        }
        
        console.log(`\n🔗 Tổng cộng: ${allLinks.length} links từ ${SOURCE_SITES.length} sources`);
        
        // Limit to 2 stories for testing
        const testLinks = allLinks.slice(0, 2);
        console.log(`🧪 Test với ${testLinks.length} stories đầu tiên...`);
        
        // Process stories with quota awareness
        let successCount = 0;
        let skippedDueToQuota = 0;
        let processedWithAI = 0;
        let processedWithFallback = 0;
        
        for (const linkInfo of testLinks) {
            // Check quota status before each story
            const currentQuotaStatus = geminiService.getQuotaStatus();
            
            if (currentQuotaStatus.status === 'exhausted') {
                console.log(`\n⏳ Quota exhausted. Using fallback for remaining stories...`);
                
                // Process with fallback
                const fallbackSuccess = await processStoryWithFallback(linkInfo);
                if (fallbackSuccess) {
                    processedWithFallback++;
                    successCount++;
                }
                skippedDueToQuota++;
                continue;
            }
            
            // Process with AI
            const success = await processStoryWithGemini(linkInfo);
            if (success) {
                successCount++;
                processedWithAI++;
                
                // Check quota after successful AI call
                const quotaCheck = geminiService.getQuotaStatus();
                if (quotaCheck.status === 'exhausted') {
                    console.log(`\n🚫 Quota exhausted after ${processedWithAI} AI-processed stories`);
                    console.log(`   Switching to fallback for remaining stories...`);
                }
            }
            
            // Rate limiting: Wait 1.1 seconds between requests (~55 RPM)
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
        // Get total count after
        const afterCount = await Work.countDocuments();
        const newCount = afterCount - beforeCount;
        
        // Get updated Gemini-enhanced stories count
        const updatedGeminiStories = await Work.countDocuments({ geminiRewrite: true });
        
        // Get cost statistics
        const costStats = geminiService.getCostStats();
        
        // Get final quota status
        const finalQuotaStatus = geminiService.getQuotaStatus();
        
        console.log("\n" + "=" .repeat(50));
        console.log("🎉 HOÀN TẤT QUOTA-AWARE CRAWLER!");
        console.log("=" .repeat(50));
        console.log(`📈 KẾT QUẢ:`);
        console.log(`   • Links processed: ${testLinks.length}`);
        console.log(`   • Stories created: ${successCount}`);
        console.log(`   • With AI: ${processedWithAI}`);
        console.log(`   • With fallback: ${processedWithFallback}`);
        console.log(`   • Skipped (quota): ${skippedDueToQuota}`);
        console.log(`   • Total in DB: ${afterCount} (+${newCount})`);
        console.log(`   • Gemini-enhanced: ${updatedGeminiStories} stories`);
        
        console.log(`\n📊 QUOTA STATUS:`);
        console.log(`   • Final status: ${finalQuotaStatus.status.toUpperCase()}`);
        if (finalQuotaStatus.status === 'exhausted') {
            console.log(`   • Retry after: ${finalQuotaStatus.retryAfterMinutes} minutes`);
            console.log(`   • Next check: ${finalQuotaStatus.nextCheckTime}`);
        }
        console.log(`   • Failed attempts: ${finalQuotaStatus.failedAttempts}`);
        
        console.log(`\n💰 COST ANALYSIS:`);
        console.log(`   • Total API calls: ${costStats.totalCalls}`);
        console.log(`   • Total input chars: ${costStats.totalInputChars}`);
        console.log(`   • Total cost: $${costStats.estimatedCost.toFixed(6)}`);
        console.log(`   • Avg cost/story: $${costStats.avgCostPerCall.toFixed(6)}`);
        console.log(`   • Est. cost/1000 stories: $${(costStats.avgCostPerCall * 1000).toFixed(2)}`);
        
        // Show sample of Gemini-enhanced content
        if (updatedGeminiStories > 0) {
            const sample = await Work.findOne({ geminiRewrite: true });
            console.log(`\n📝 SAMPLE GEMINI-ENHANCED STORY:`);
            console.log(`   Title: ${sample.title}`);
            console.log(`   Category: ${sample.category}`);
            console.log(`   Cost: $${sample.geminiCost.toFixed(6)}`);
            console.log(`   Excerpt: ${sample.excerpt.substring(0, 100)}...`);
        }
        
        console.log("\n🚀 SCALING RECOMMENDATIONS:");
        console.log("-" .repeat(30));
        console.log("• Max 55 stories/hour (rate limit)");
        console.log("• ~$0.01 for 50 stories");
        console.log("• ~$0.19 for 1000 stories");
        console.log("• Monitor costs at: https://aistudio.google.com/");
        
    } catch (error) {
        console.error("❌ Lỗi chính:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("📦 Đã ngắt kết nối MongoDB");
    }
}

// Run the crawler
main();