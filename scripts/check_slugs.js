const mongoose = require('mongoose');
const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

async function checkSlugs() {
    try {
        await mongoose.connect(MONGODB_URI);
        const WorkSchema = new mongoose.Schema({}, { strict: false });
        const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema, 'works');
        
        const works = await Work.find({}).limit(50);
        console.log('Current Slugs in DB:');
        works.forEach(w => {
            console.log(`- Title: "${w.title}" | Slug: "${w.slug}"`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSlugs();
