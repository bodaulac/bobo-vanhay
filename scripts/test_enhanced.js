import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';

// Configuration
const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";
const AI_PROXY_URL = "http://127.0.0.1:9090/v1/chat/completions";

// MongoDB Schema
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

async function testAI() {
    console.log("🧪 Testing AI Proxy...");
    try {
        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: "Viết một đoạn văn ngắn 100 từ về tình bạn theo phong cách cổ điển Việt Nam" }],
            temperature: 0.7
        }, {
            headers: { 'Authorization': 'Bearer cliproxy-secret' },
            timeout: 30000
        });

        const content = response.data.choices[0].message.content;
        console.log("✅ AI Test Successful!");
        console.log("Sample output:", content.substring(0, 150) + "...");
        return true;
    } catch (error) {
        console.error("❌ AI Test Failed:", error.message);
        return false;
    }
}

async function testCrawl() {
    console.log("\n🔍 Testing Website Crawl...");
    try {
        const response = await axios.get('https://truyencotich.top/', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const links = [];
        
        $('a[href*="/doc-truyen/"]').each((i, el) => {
            if (i < 2) {
                let href = $(el).attr('href');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href : `https://truyencotich.top${href}`;
                    links.push(fullUrl);
                }
            }
        });
        
        console.log(`✅ Crawl Test Successful! Found ${links.length} links`);
        console.log("Sample links:", links);
        return links;
    } catch (error) {
        console.error("❌ Crawl Test Failed:", error.message);
        return [];
    }
}

async function testDatabase() {
    console.log("\n📦 Testing Database Connection...");
    try {
        await mongoose.connect(MONGODB_URI);
        const count = await Work.countDocuments();
        console.log(`✅ Database Connected! Total stories: ${count}`);
        
        // Test insert
        const testDoc = {
            title: "TEST - " + Date.now(),
            author: "Test Author",
            content: "Test content",
            excerpt: "Test excerpt",
            thumbnail: "https://via.placeholder.com/800x450",
            type: 'story',
            category: 'Test',
            slug: 'test-' + Date.now(),
            sourceUrl: 'https://test.com'
        };
        
        await Work.create(testDoc);
        console.log("✅ Test document inserted successfully");
        
        // Clean up
        await Work.deleteOne({ slug: testDoc.slug });
        console.log("✅ Test document cleaned up");
        
        await mongoose.disconnect();
        return true;
    } catch (error) {
        console.error("❌ Database Test Failed:", error.message);
        return false;
    }
}

async function main() {
    console.log("🧪 BẮT ĐẦU TEST ENHANCED CRAWLER COMPONENTS");
    console.log("=" .repeat(50));
    
    const results = {
        ai: await testAI(),
        crawl: await testCrawl(),
        db: await testDatabase()
    };
    
    console.log("\n" + "=" .repeat(50));
    console.log("📊 TEST RESULTS:");
    console.log("=" .repeat(50));
    console.log(`🤖 AI Proxy: ${results.ai ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔍 Web Crawl: ${results.crawl.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📦 Database: ${results.db ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPass = results.ai && results.crawl.length > 0 && results.db;
    console.log(`\n🎯 OVERALL: ${allPass ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
    
    if (allPass) {
        console.log("\n🚀 READY TO RUN ENHANCED CRAWLER!");
        console.log("Next: Run `node scripts/enhanced_crawler.js`");
    } else {
        console.log("\n🔧 NEED TO FIX ISSUES BEFORE PROCEEDING");
    }
}

main();