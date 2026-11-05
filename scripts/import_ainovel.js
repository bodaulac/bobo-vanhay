// Import một cuốn truyện do ainovel-cli viết vào MongoDB (mặc định ở trạng thái nháp).
//   node scripts/import_ainovel.js <thư-mục-làm-việc> [--slug ten-truyen] [--force]
// Import lại an toàn: chương không đổi thì bỏ qua; chương đã sửa tay chỉ bị ghi đè khi có --force.
const mongoose = require('mongoose');
const config = require('../config.js');
const Novel = require('../models/Novel.js');
const Chapter = require('../models/Chapter.js');
const { slugify } = require('../src/lib/slug.js');
const { readWorkspace } = require('../src/lib/ainovelImport.js');

async function run() {
    const args = process.argv.slice(2);
    const dir = args.find((a) => !a.startsWith('--'));
    const slugIdx = args.indexOf('--slug');
    const force = args.includes('--force');
    if (!dir) {
        console.error('Cách dùng: node scripts/import_ainovel.js <thư-mục-làm-việc> [--slug ten-truyen] [--force]');
        process.exit(1);
    }

    const data = readWorkspace(dir);
    const slug = slugIdx >= 0 ? slugify(args[slugIdx + 1]) : slugify(data.book.title);
    if (!slug) throw new Error('Không tạo được slug; hãy truyền --slug');

    await mongoose.connect(config.mongodbUri);
    try {
        const novel = await Novel.findOneAndUpdate(
            { slug },
            {
                $set: { title: data.book.title, synopsis: data.book.synopsis, source: 'ainovel', totalChapters: data.totalChapters },
                $setOnInsert: { slug, status: 'draft' }
            },
            { upsert: true, new: true }
        );
        console.log(`📘 ${novel.title} (/sach/${novel.slug}) – ${data.totalChapters} chương, trạng thái: ${novel.status}`);

        const stat = { created: 0, updated: 0, unchanged: 0, skippedEdited: 0 };
        for (const ch of data.chapters) {
            const existing = await Chapter.findOne({ novel: slug, no: ch.no });
            if (!existing) {
                await Chapter.create({ novel: slug, ...ch, status: 'draft' });
                stat.created++;
            } else if (existing.sourceHash === ch.sourceHash) {
                stat.unchanged++;
            } else if (existing.editedAt && !force) {
                stat.skippedEdited++;
            } else {
                Object.assign(existing, ch, { editedAt: undefined });
                await existing.save();
                stat.updated++;
            }
        }
        console.log(`✅ Mới: ${stat.created} | Cập nhật: ${stat.updated} | Không đổi: ${stat.unchanged} | Bỏ qua (đã sửa tay): ${stat.skippedEdited}`);
        if (stat.skippedEdited) console.log('   Dùng --force để ghi đè các chương đã sửa tay.');
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
