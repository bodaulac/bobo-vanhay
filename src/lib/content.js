const sanitizeHtml = require('sanitize-html');

// Nội dung do crawler/AI/trình soạn thảo lưu dạng HTML: luôn lọc trước khi hiển thị
const OPTIONS = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img', 'figure', 'figcaption', 'u']),
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer', target: '_blank' })
    }
};

function renderContent(html) {
    return sanitizeHtml(html || '', OPTIONS);
}

module.exports = { renderContent };
