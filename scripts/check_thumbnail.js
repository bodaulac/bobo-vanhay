const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

async function checkThumbnail() {
    try {
        await mongoose.connect(MONGODB_URI);
        const WorkSchema = new mongoose.Schema({}, { strict: false });
        const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema, 'works');
        
        const works = await Work.find({ thumbnail: { $exists: true, $ne: null } }).limit(5);
        console.log('Works with thumbnails:');
        works.forEach(w => console.log(`- ${w.title}: ${w.thumbnail}`));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkThumbnail();
