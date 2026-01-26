const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

async function cleanData() {
    try {
        await mongoose.connect(MONGODB_URI);
        const WorkSchema = new mongoose.Schema({}, { strict: false });
        const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema, 'works');
        
        // Count before
        const total = await Work.countDocuments();
        console.log('Total works before cleanup:', total);
        
        // List authors to verify
        const authors = await Work.distinct('author');
        console.log('Authors found in system:', authors);
        
        // Delete works NOT created by AI
        // AI posts have author: "Biên tập bởi AI Lạc" or similar
        const result = await Work.deleteMany({ 
            author: { $ne: "Biên tập bởi AI Lạc" } 
        });
        
        console.log(`🧹 Cleanup complete. Deleted ${result.deletedCount} non-AI posts.`);
        
        // Count after
        const remaining = await Work.countDocuments();
        console.log('Remaining AI works:', remaining);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanData();
