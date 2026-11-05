// Cấu hình tập trung: mọi bí mật đọc từ biến môi trường (.env), không ghi cứng trong code.
require('dotenv').config();

function required(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`❌ Thiếu biến môi trường ${name}. Xem .env.example`);
        process.exit(1);
    }
    return value;
}

const b2KeyId = process.env.B2_APPLICATION_KEY_ID || '';
const b2Key = process.env.B2_APPLICATION_KEY || '';

module.exports = {
    port: Number(process.env.PORT) || 3004,
    siteUrl: (process.env.SITE_URL || 'https://vanhay.info').replace(/\/+$/, ''),
    siteName: 'Văn Hay',
    get mongodbUri() { return required('MONGODB_URI'); },
    aiProxy: {
        url: process.env.AI_PROXY_URL || 'http://127.0.0.1:9090/v1/chat/completions',
        get auth() { return `Bearer ${required('AI_PROXY_KEY')}`; }
    },
    b2: {
        keyId: b2KeyId,
        key: b2Key,
        bucketName: process.env.B2_BUCKET_NAME || '',
        get authBase64() {
            required('B2_APPLICATION_KEY_ID');
            required('B2_APPLICATION_KEY');
            return Buffer.from(`${b2KeyId}:${b2Key}`).toString('base64');
        }
    },
    pageSize: Number(process.env.PAGE_SIZE) || 12
};
