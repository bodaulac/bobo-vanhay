const axios = require('axios');

async function verifyB2Content() {
    const keyID = '005a2c220d9db480000000003';
    const applicationKey = 'K005XqKlkjAY9kIG/w8AmrUotVwSTkE';
    const targetBucketName = 'BoboData';
    const authBase64 = Buffer.from(`${keyID}:${applicationKey}`).toString('base64');

    try {
        console.log('--- B2 Verification Started ---');
        // 1. Authorize
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${authBase64}` }
        });
        const { apiUrl, authorizationToken, accountId: realAccountId } = authRes.data;
        console.log('Real Account ID:', realAccountId);

        // 2. List Buckets
        const bucketsRes = await axios.post(`${apiUrl}/b2api/v2/b2_list_buckets`, {
            accountId: realAccountId
        }, { headers: { 'Authorization': authorizationToken } });
        
        console.log('All Buckets in this account:');
        bucketsRes.data.buckets.forEach(b => {
            console.log(`- ${b.bucketName} (ID: ${b.bucketId}, Type: ${b.bucketType})`);
        });

        const targetBucket = bucketsRes.data.buckets.find(b => b.bucketName === targetBucketName);
        
        if (!targetBucket) {
            console.error(`❌ Target bucket '${targetBucketName}' NOT FOUND.`);
            return;
        }

        // 3. List Files in target bucket
        console.log(`Listing files in '${targetBucketName}'...`);
        const filesRes = await axios.post(`${apiUrl}/b2api/v2/b2_list_file_names`, {
            bucketId: targetBucket.bucketId,
            maxFileCount: 50
        }, { headers: { 'Authorization': authorizationToken } });

        if (filesRes.data.files.length === 0) {
            console.log('⚠️ No files found in this bucket.');
        } else {
            console.log(`✅ Found ${filesRes.data.files.length} files:`);
            filesRes.data.files.forEach(f => console.log(`  - ${f.fileName} (${f.contentLength} bytes)`));
        }

    } catch (error) {
        console.error('❌ B2 Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

verifyB2Content();
