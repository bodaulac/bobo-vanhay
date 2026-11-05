#!/usr/bin/env node

import axios from 'axios';
import config from '../config.js';

async function testProxyConnection() {
    console.log("🧪 TESTING AI PROXY CONNECTION");
    console.log("=" .repeat(50));
    
    const AI_PROXY_URL = config.aiProxy.url;
    const AI_PROXY_AUTH = config.aiProxy.auth;
    
    // Test 1: Check proxy is running
    console.log("\n1. 🔍 Checking proxy availability...");
    try {
        const modelsRes = await axios.get(`${AI_PROXY_URL.replace('/chat/completions', '')}/models`, {
            headers: { 'Authorization': AI_PROXY_AUTH },
            timeout: 5000
        });
        
        console.log("✅ Proxy is running!");
        console.log("   Available models:");
        modelsRes.data.data.forEach(model => {
            console.log(`   • ${model.id} (${model.owned_by})`);
        });
        
    } catch (error) {
        console.error("❌ Proxy not available:", error.message);
        return;
    }
    
    // Test 2: Test with DeepSeek
    console.log("\n2. 🤖 Testing DeepSeek model...");
    try {
        const response = await axios.post(AI_PROXY_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: "Viết một câu ngắn về tình bạn." }],
            temperature: 0.7,
            max_tokens: 50
        }, {
            headers: { 'Authorization': AI_PROXY_AUTH },
            timeout: 10000
        });
        
        const text = response.data.choices[0].message.content;
        console.log("✅ DeepSeek working!");
        console.log(`   Response: ${text}`);
        
    } catch (error) {
        console.error("❌ DeepSeek test failed:", error.message);
    }
    
    // Test 3: Test with Gemini
    console.log("\n3. 🤖 Testing Gemini model...");
    try {
        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: "Viết một câu ngắn về tình bạn." }],
            temperature: 0.7,
            max_tokens: 50
        }, {
            headers: { 'Authorization': AI_PROXY_AUTH },
            timeout: 10000
        });
        
        const text = response.data.choices[0].message.content;
        console.log("✅ Gemini working!");
        console.log(`   Response: ${text}`);
        
    } catch (error) {
        console.error("❌ Gemini test failed:", error.message);
        console.error("   Error details:", error.response?.data || error.message);
    }
    
    // Test 4: Test with longer content (story rewrite)
    console.log("\n4. 📝 Testing story rewrite...");
    const testStory = `
Con gà trống kiêu ngạo
Một con gà trống rất kiêu ngạo, luôn khoe khoang về tiếng gáy của mình.
Một ngày nọ, nó thách thức cả làng về khả năng gáy của mình.
Nhưng khi gặp con chó sói, nó không dám gáy nữa.
`;
    
    try {
        const prompt = `
HÃY VIẾT LẠI NỘI DUNG SAU THEO PHONG CÁCH VĂN HỌC VIỆT NAM CỔ ĐIỂN:

${testStory}

YÊU CẦU:
1. MỞ ĐẦU: "Ngày xửa ngày xưa..." hoặc cụm từ cổ điển tương tự
2. NGÔN NGỮ: Văn học, giàu hình ảnh
3. ĐỘ DÀI: 100-150 từ
4. THÊM bài học đạo đức cuối truyện
`;
        
        const response = await axios.post(AI_PROXY_URL, {
            model: "gemini-3-pro-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 300
        }, {
            headers: { 'Authorization': AI_PROXY_AUTH },
            timeout: 15000
        });
        
        const text = response.data.choices[0].message.content;
        console.log("✅ Story rewrite working!");
        console.log(`   Response length: ${text.length} chars`);
        console.log(`   Preview: ${text.substring(0, 100)}...`);
        
    } catch (error) {
        console.error("❌ Story rewrite test failed:", error.message);
    }
    
    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("🎉 AI PROXY CONNECTION TEST COMPLETE!");
    console.log("=" .repeat(50));
    
    console.log("\n📋 RECOMMENDATIONS:");
    console.log("-" .repeat(30));
    console.log("• Use model: gemini-3-pro-preview");
    console.log("• Auth: Bearer <AI_PROXY_KEY>");
    console.log("• URL: http://127.0.0.1:9090/v1/chat/completions");
    console.log("• Timeout: 30 seconds");
    console.log("• Rate limit: Check proxy logs");
    
    console.log("\n🚀 READY FOR CRAWLER INTEGRATION!");
}

// Run test
testProxyConnection().catch(console.error);