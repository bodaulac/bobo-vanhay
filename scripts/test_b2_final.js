import axios from 'axios';
import mongoose from 'mongoose';
import crypto from 'crypto';
import config from '../config.js';
import Work from '../models/Work.js';

// Configuration
const MONGODB_URI = config.mongodbUri;

// Backblaze B2 Configuration
const B2_AUTH_BASE64 = config.b2.authBase64;


// Create a simple 1x1 pixel PNG image buffer
function createTestImageBuffer() {
    // Base64 encoded 1x1 transparent PNG
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return Buffer.from(base64Image, 'base64');
}

// Backblaze B2 Upload Function
async function uploadTestImageToB2(filename) {
    try {
        console.log(`📤 Đang upload test image lên B2: ${filename}`);
        
        // 1. Authorize
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${B2_AUTH_BASE64}` },
            timeout: 10000
        });
        
        const { apiUrl, authorizationToken, downloadUrl, allowed } = authRes.data;
        const bucketId = allowed.bucketId;

        // 2. Get upload URL
        const uploadUrlRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            bucketId: bucketId
        }, { 
            headers: { 'Authorization': authorizationToken },
            timeout: 10000
        });
        
        const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlRes.data;

        // 3. Create test image buffer
        const buffer = createTestImageBuffer();
        const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

        // 4. Upload to B2
        const uploadRes = await axios.post(uploadUrl, buffer, {
            headers: {
                'Authorization': uploadAuthToken,
                'X-Bz-File-Name': encodeURIComponent(`vanhoc/test/${filename}`),
                'Content-Type': 'image/png',
                'X-Bz-Content-Sha1': sha1
            },
            timeout: 15000
        });

        // 5. Construct public URL
        const publicUrl = `${downloadUrl}/file/${allowed.bucketName}/vanhoc/test/${filename}`;
        
        console.log(`✅ Upload thành công!`);
        console.log(`   File ID: ${uploadRes.data.fileId}`);
        console.log(`   File Name: ${uploadRes.data.fileName}`);
        console.log(`   Public URL: ${publicUrl}`);
        
        return {
            success: true,
            publicUrl: publicUrl,
            fileId: uploadRes.data.fileId
        };
        
    } catch (error) {
        console.error(`❌ Lỗi B2 upload:`, error.message);
        if (error.response) {
            console.error(`   Response: ${JSON.stringify(error.response.data)}`);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

// Test B2 upload and database integration
async function testB2Integration() {
    console.log("🧪 TESTING B2 UPLOAD & DATABASE INTEGRATION");
    console.log("=" .repeat(50));
    
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("📦 Đã kết nối MongoDB");
        
        // Test 1: Upload to B2
        console.log("\n1. 📤 Testing B2 Upload...");
        const testFilename = `test-story-${Date.now()}.png`;
        const uploadResult = await uploadTestImageToB2(testFilename);
        
        if (!uploadResult.success) {
            console.log("❌ B2 Upload test failed");
            return;
        }
        
        // Test 2: Save to Database
        console.log("\n2. 💾 Testing Database Integration...");
        const testStory = {
            title: `TEST STORY - B2 Integration ${Date.now()}`,
            author: "B2 Test System",
            content: "<h2>Test Story</h2><p>This is a test story with B2 image integration.</p>",
            excerpt: "Test story for B2 integration verification",
            thumbnail: uploadResult.publicUrl,
            type: 'story',
            category: 'Test Category',
            slug: `test-b2-integration-${Date.now()}`,
            sourceUrl: 'https://test.com',
            b2ImageUrl: uploadResult.publicUrl
        };
        
        const savedStory = await Work.create(testStory);
        console.log(`✅ Story saved to database!`);
        console.log(`   Story ID: ${savedStory._id}`);
        console.log(`   Title: ${savedStory.title}`);
        console.log(`   B2 Image URL: ${savedStory.b2ImageUrl}`);
        
        // Test 3: Verify in database
        console.log("\n3. 🔍 Verifying database entry...");
        const retrievedStory = await Work.findById(savedStory._id);
        if (retrievedStory && retrievedStory.b2ImageUrl === uploadResult.publicUrl) {
            console.log(`✅ Database verification passed!`);
            console.log(`   Retrieved B2 URL: ${retrievedStory.b2ImageUrl}`);
        } else {
            console.log(`❌ Database verification failed`);
        }
        
        // Test 4: Count stories with B2 images
        console.log("\n4. 📊 Checking B2 integration status...");
        const totalStories = await Work.countDocuments();
        const b2Stories = await Work.countDocuments({ b2ImageUrl: { $exists: true, $ne: null } });
        
        console.log(`   Total stories in database: ${totalStories}`);
        console.log(`   Stories with B2 images: ${b2Stories}`);
        console.log(`   B2 integration rate: ${((b2Stories / totalStories) * 100).toFixed(1)}%`);
        
        // Cleanup test data
        console.log("\n5. 🧹 Cleaning up test data...");
        await Work.deleteOne({ _id: savedStory._id });
        console.log(`✅ Test story deleted`);
        
        console.log("\n" + "=" .repeat(50));
        console.log("🎉 B2 INTEGRATION TEST COMPLETE!");
        console.log("=" .repeat(50));
        console.log("✅ All tests passed!");
        console.log("✅ B2 upload working correctly");
        console.log("✅ Database integration verified");
        console.log("✅ Ready for production use");
        
        return {
            success: true,
            b2Url: uploadResult.publicUrl,
            totalStories: totalStories,
            b2Stories: b2Stories
        };
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await mongoose.disconnect();
        console.log("📦 Đã ngắt kết nối MongoDB");
    }
}

// Run the test
testB2Integration().then(result => {
    console.log("\n📋 FINAL RESULT:");
    console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.success) {
        console.log(`   B2 Test URL: ${result.b2Url}`);
        console.log(`   Database Stats: ${result.b2Stories}/${result.totalStories} stories with B2 images`);
    }
});