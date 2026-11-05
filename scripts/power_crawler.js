import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import imageService from '../src/lib/services/imageService.js';
import config from '../config.js';
import Work from '../models/Work.js';

const MONGODB_URI = config.mongodbUri;
const AI_PROXY_URL = config.aiProxy.url;

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

async function rewriteAndIllustrate(title, originalContent, category, originalImg) {
    console.log(`🤖 AI đang biên tập chuyên sâu: ${title}...`);
    try {
        const prompt = `
            Bạn là một chuyên gia Content SEO và Nhà văn biên tập.
            Hãy viết lại truyện: "${title}" từ nội dung gốc.
            
            YÊU CẦU SEO & NỘI DUNG:
            - Tiêu đề mới phải chứa từ khóa chính, giật tít thu hút.
            - Độ dài: 1000 - 1500 từ.
            - Thêm các thẻ <h2>, <h3> để phân đoạn bài viết chuẩn SEO.
            - Phân bổ từ khóa tự nhiên.
            - Văn phong: Truyền cảm, sâu sắc, mang đậm hồn Việt.
            - Ghi 3-5 thẻ Tags liên quan.
            - TUYỆT ĐỐI KHÔNG ghi nguồn tham khảo, không nhắc đến tên website khác.

            TRẢ VỀ JSON:
            {
                "newTitle": "...",
                "newContent": "...",
                "newExcerpt": "...",
                "tags": ["tag1", "tag2", "tag3"]
            }
        `;

        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': config.aiProxy.auth }, timeout: 240000 });

        let rawContent = response.data.choices[0].message.content;
        rawContent = rawContent.replace(/```json\n?|```/g, '').trim();
        const aiResult = JSON.parse(rawContent);
        
        let finalThumbnail = originalImg;
        if (originalImg) {
            const filename = `${slugify(title)}-thumb.jpg`;
            finalThumbnail = await imageService.uploadFromUrl(originalImg, filename);
        }

        return { ...aiResult, finalThumbnail };
    } catch (error) {
        console.error("❌ Lỗi AI:", error.message);
        return null;
    }
}

async function startPowerCrawler() {
    console.log("🚀 Robot 'Content SEO' đang quét đa nguồn...");
    try {
        await mongoose.connect(MONGODB_URI);
        
        // List of source domains
        const sources = [
            { url: 'https://truyendangian.com/', selector: '.entry-title a' },
            { url: 'https://truyencotich.top/', selector: 'a[href*="/doc-truyen/"]' }
        ];

        for (const source of sources) {
            console.log(`🔍 Đang quét nguồn: ${source.url}`);
            const response = await axios.get(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(response.data);
            
            const links = [];
            $(source.selector).each((i, el) => {
                if (i < 10) {
                    let href = $(el).attr('href');
                    const fullUrl = href.startsWith('http') ? href : source.url + href;
                    links.push(fullUrl);
                }
            });

            for (const link of links) {
                try {
                    const page = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $$ = cheerio.load(page.data);
                    
                    const title = $$('h1').first().text().trim();
                    const originalContent = $$('.entry-content, .article-post, .content-news').html();
                    let originalImg = $$('meta[property="og:image"]').attr('content') || $$('article img').first().attr('src');
                    
                    if (originalImg && !originalImg.startsWith('http')) {
                        const base = new URL(link).origin;
                        originalImg = base + originalImg;
                    }

                    if (!title || !originalContent) continue;

                    const slug = slugify(title);
                    const existing = await Work.findOne({ slug });
                    
                    if (!existing || existing.author !== "Biên tập bởi AI Lạc") {
                        const powerData = await rewriteAndIllustrate(title, originalContent, "Truyện dân gian", originalImg);
                        
                        if (powerData) {
                            await Work.findOneAndUpdate(
                                { slug },
                                {
                                    title: powerData.newTitle,
                                    content: powerData.newContent,
                                    excerpt: powerData.newExcerpt,
                                    thumbnail: powerData.finalThumbnail,
                                    tags: powerData.tags,
                                    author: "Biên tập bởi AI Lạc",
                                    type: 'story',
                                    category: "Truyện dân gian",
                                    sourceUrl: link
                                },
                                { upsert: true }
                            );
                            console.log(`✅ Đã xuất bản: ${powerData.newTitle}`);
                            // Wait between posts to be nice to AI and servers
                            await new Promise(r => setTimeout(r, 10000));
                        }
                    } else {
                        console.log(`⏩ Bỏ qua bài đã có: ${title}`);
                    }
                } catch (err) {
                    console.error(`❌ Lỗi bài ${link}:`, err.message);
                }
            }
        }
    } finally {
        await mongoose.disconnect();
        console.log("🏁 Robot hoàn thành nhiệm vụ.");
    }
}

startPowerCrawler();
