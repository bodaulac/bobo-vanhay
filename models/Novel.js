const mongoose = require('mongoose');

// Truyện dài nhiều chương (viết bằng ainovel-cli hoặc soạn tay trong trình soạn thảo admin)
const NovelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    synopsis: { type: String, default: '' },
    author: { type: String, default: 'Văn Hay' },
    thumbnail: String,
    tags: [String],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    // Nguồn: 'ainovel' khi import từ output/novel của ainovel-cli, 'manual' khi tạo tay
    source: { type: String, enum: ['manual', 'ainovel'], default: 'manual' },
    totalChapters: { type: Number, default: 0 },
    views: { type: Number, default: 0 }
}, { timestamps: true });

NovelSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.models.Novel || mongoose.model('Novel', NovelSchema);
