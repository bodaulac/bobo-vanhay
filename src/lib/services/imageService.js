const axios = require('axios');
const crypto = require('crypto');
const config = require('../../../config.js');

class ImageService {
    constructor() {
        this.keyId = config.b2.keyId;
        this.applicationKey = config.b2.key;
        this.authBase64 = Buffer.from(`${this.keyId}:${this.applicationKey}`).toString('base64');
    }

    async uploadFromUrl(url, filename) {
        try {
            console.log(`📸 Robot đang nạp ảnh: ${filename}`);
            
            const authRes = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
                headers: { 'Authorization': `Basic ${this.authBase64}` }
            });
            const { apiUrl, authorizationToken, downloadUrl, allowed } = authRes.data;
            const bucketId = allowed.bucketId;

            const uploadUrlRes = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
                bucketId: bucketId
            }, { headers: { 'Authorization': authorizationToken } });
            const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlRes.data;

            const imageRes = await axios.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imageRes.data, 'binary');
            const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

            // CRITICAL FIX: Backblaze requires "X-Bz-File-Name", not "X-B2-File-Name"
            await axios.post(uploadUrl, buffer, {
                headers: {
                    'Authorization': uploadAuthToken,
                    'X-Bz-File-Name': encodeURIComponent(`vanhoc/${filename}`),
                    'Content-Type': 'image/jpeg',
                    'X-Bz-Content-Sha1': sha1
                }
            });

            const publicUrl = `${downloadUrl}/file/${allowed.bucketName}/vanhoc/${filename}`;
            console.log(`✅ Đã nạp thành công lên B2: ${publicUrl}`);
            return publicUrl;
        } catch (error) {
            console.error('❌ B2 Fail:', error.response ? JSON.stringify(error.response.data) : error.message);
            return url;
        }
    }
}

module.exports = new ImageService();
