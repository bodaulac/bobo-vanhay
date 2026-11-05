const mongoose = require('mongoose');

const WorkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Sưu tầm' },
    content: String,
    excerpt: String,
    thumbnail: String,
    type: String,
    category: String,
    subcategory: String,
    tags: [String],
    slug: { type: String, unique: true },
    sourceUrl: String,
    views: { type: Number, default: 0 },

    // Trường do crawler/AI ghi
    aiEnhanced: { type: Boolean, default: false },
    aiGenerated: Boolean,
    geminiRewrite: { type: Boolean, default: false },
    localAIRewrite: { type: Boolean, default: false },
    geminiCost: { type: Number, default: 0 },
    b2ImageUrl: String,
    imagePrompt: String
}, { timestamps: true });

WorkSchema.index({ createdAt: -1 });
WorkSchema.index({ category: 1, createdAt: -1 });
WorkSchema.index({ views: -1 });
// Tìm kiếm toàn văn; 'none' để không áp dụng stemming tiếng Anh cho tiếng Việt
WorkSchema.index(
    { title: 'text', tags: 'text', excerpt: 'text' },
    { name: 'work_text', weights: { title: 10, tags: 5, excerpt: 2 }, default_language: 'none' }
);

module.exports = mongoose.models.Work || mongoose.model('Work', WorkSchema);
