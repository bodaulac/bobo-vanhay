const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    novel: { type: String, required: true }, // slug của Novel
    no: { type: Number, required: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' }, // HTML; được lọc (sanitize) khi hiển thị
    wordCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    // sha256 của bản markdown import gần nhất, để import lại không ghi đè khi không đổi
    sourceHash: String,
    // Có giá trị khi người dùng sửa tay; import lại sẽ không ghi đè (trừ khi --force)
    editedAt: Date
}, { timestamps: true });

ChapterSchema.index({ novel: 1, no: 1 }, { unique: true });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);
