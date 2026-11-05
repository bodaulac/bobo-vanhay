const axios = require('axios');
const config = require('../config.js');

async function listFiles() {
    // The keyID provided might NOT be the accountId. In B2, the accountId is usually a shorter string.
    // However, the authorize_account call accepts the keyID as accountId for Master Keys.
    // Let's try to authorize and see what accountId it returns.
    const keyID = config.b2.keyId;
    const applicationKey = config.b2.key;
    const authBase64 = Buffer.from(`${keyID}:${applicationKey}`).toString('base64');

    try {
        const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { 'Authorization': `Basic ${authBase64}` }
        });
        const { apiUrl, authorizationToken, accountId: realAccountId } = authRes.data;
        console.log('Real AccountID returned by B2:', realAccountId);

        const bucketsRes = await axios.post(`${apiUrl}/b2api/v2/b2_list_buckets`, {
            accountId: realAccountId
        }, { headers: { 'Authorization': authorizationToken } });
        
        console.log('Buckets found:', bucketsRes.data.buckets.map(b => b.bucketName));
        
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

listFiles();
