const axios = require('axios');
const config = require('../config.js');

async function listDirect() {
    const keyID = config.b2.keyId;
    const applicationKey = config.b2.key;
    const authBase64 = Buffer.from(`${keyID}:${applicationKey}`).toString('base64');

    try {
        console.log('--- Auth Test ---');
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${authBase64}` }
        });
        const { apiUrl, authorizationToken, accountId, allowed } = authRes.data;
        
        console.log('Real ID from B2:', accountId);
        console.log('Allowed capabilities:', JSON.stringify(allowed.capabilities));
        console.log('Bucket Restriction:', allowed.bucketName || 'None');

        if (allowed.bucketId) {
            console.log('Key is restricted to Bucket ID:', allowed.bucketId);
            const filesRes = await axios.post(`${apiUrl}/b2api/v2/b2_list_file_names`, {
                bucketId: allowed.bucketId,
                maxFileCount: 10
            }, { headers: { 'Authorization': authorizationToken } });
            console.log('Files in restricted bucket:', filesRes.data.files.length);
            filesRes.data.files.forEach(f => console.log(' - ' + f.fileName));
        }

    } catch (error) {
        console.error('Final Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    }
}

listDirect();
