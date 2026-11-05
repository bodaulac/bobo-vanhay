const mongoose = require('mongoose');
const config = require('../config.js');
const Work = require('../models/Work.js');
const MONGODB_URI = config.mongodbUri;

async function checkSlugs() {
    try {
        await mongoose.connect(MONGODB_URI);
        
        
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
