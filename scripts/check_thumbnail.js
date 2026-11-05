const mongoose = require('mongoose');
const config = require('../config.js');
const Work = require('../models/Work.js');

const MONGODB_URI = config.mongodbUri;

async function checkThumbnail() {
    try {
        await mongoose.connect(MONGODB_URI);
        
        
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
