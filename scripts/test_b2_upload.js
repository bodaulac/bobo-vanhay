const axios = require('axios');
const crypto = require('crypto');
const config = require('../config.js');

async function testB2Upload() {
    const keyId = config.b2.keyId;
    const applicationKey = config.b2.key;
    const authBase64 = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');

    console.log('🧪 Testing B2 Authentication...');
    
    try {
        // Step 1: Authorize
        console.log('1. Authorizing with B2...');
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${authBase64}` },
            timeout: 10000
        });
        
        const { apiUrl, authorizationToken, downloadUrl, allowed } = authRes.data;
        console.log('✅ Authorization successful!');
        console.log(`   API URL: ${apiUrl}`);
        console.log(`   Download URL: ${downloadUrl}`);
        console.log(`   Account ID: ${authRes.data.accountId}`);
        console.log(`   Allowed capabilities: ${JSON.stringify(allowed.capabilities)}`);
        console.log(`   Bucket ID: ${allowed.bucketId}`);
        console.log(`   Bucket Name: ${allowed.bucketName || 'Not specified'}`);
        
        // Step 2: Get upload URL
        console.log('\n2. Getting upload URL...');
        const uploadUrlRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            bucketId: allowed.bucketId
        }, { 
            headers: { 'Authorization': authorizationToken },
            timeout: 10000
        });
        
        const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlRes.data;
        console.log('✅ Upload URL obtained!');
        console.log(`   Upload URL: ${uploadUrl.substring(0, 60)}...`);
        
        // Step 3: Create test image buffer
        console.log('\n3. Creating test image...');
        const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        const sha1 = crypto.createHash('sha1').update(testImage).digest('hex');
        
        // Step 4: Upload test file
        console.log('\n4. Uploading test file...');
        const filename = `test-${Date.now()}.png`;
        
        const uploadRes = await axios.post(uploadUrl, testImage, {
            headers: {
                'Authorization': uploadAuthToken,
                'X-Bz-File-Name': `vanhoc/test/${filename}`,
                'Content-Type': 'image/png',
                'X-Bz-Content-Sha1': sha1
            },
            timeout: 15000
        });
        
        console.log('✅ Upload successful!');
        console.log(`   File ID: ${uploadRes.data.fileId}`);
        console.log(`   File Name: ${uploadRes.data.fileName}`);
        console.log(`   Content SHA1: ${uploadRes.data.contentSha1}`);
        console.log(`   Content Type: ${uploadRes.data.contentType}`);
        console.log(`   Content Length: ${uploadRes.data.contentLength}`);
        
        // Step 5: Construct public URL
        const publicUrl = `${downloadUrl}/file/${allowed.bucketName}/vanhoc/test/${filename}`;
        console.log(`\n🔗 Public URL: ${publicUrl}`);
        
        // Step 6: Verify file exists
        console.log('\n5. Verifying file exists...');
        try {
            const verifyRes = await axios.head(publicUrl, { timeout: 10000 });
            console.log(`✅ File verified! Status: ${verifyRes.status}`);
        } catch (verifyError) {
            console.log(`⚠️ Could not verify file: ${verifyError.message}`);
        }
        
        return {
            success: true,
            publicUrl: publicUrl,
            fileId: uploadRes.data.fileId
        };
        
    } catch (error) {
        console.error('❌ B2 Test Failed:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
            console.error(`   Headers: ${JSON.stringify(error.response.headers)}`);
        } else if (error.request) {
            console.error(`   No response received: ${error.message}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
testB2Upload().then(result => {
    console.log('\n' + '='.repeat(50));
    console.log(`🎯 TEST RESULT: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.success) {
        console.log(`📁 File uploaded to: ${result.publicUrl}`);
    }
});