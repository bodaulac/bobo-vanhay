const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://root:examplepassword@localhost:27017/bobo-vanhoc?authSource=admin";

async function checkDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        
        const WorkSchema = new mongoose.Schema({}, { strict: false });
        const Work = mongoose.models.Work || mongoose.model('Work', WorkSchema, 'works');
        
        const count = await Work.countDocuments();
        console.log('Total Works in "works" collection:', count);
        
        if (count > 0) {
            const latest = await Work.find().sort({ _id: -1 }).limit(3);
            console.log('Latest 3 works:', latest.map(l => l.title));
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDB();
