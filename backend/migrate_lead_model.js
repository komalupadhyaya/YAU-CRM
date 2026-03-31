import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const runMigration = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected ✅');

        const db = mongoose.connection.db;

        // 1. Rename 'schools' collection to 'leads'
        const collections = await db.listCollections({ name: 'schools' }).toArray();
        if (collections.length > 0) {
            console.log('Renaming "schools" collection to "leads"...');
            await db.collection('schools').rename('leads');
            console.log('Renamed ✅');
        } else {
            console.log('"schools" collection not found or already renamed.');
        }

        // 2. Rename 'school_id' to 'lead_id' in followups
        console.log('Updating "followups" collection (school_id -> lead_id)...');
        const followupUpdate = await db.collection('followups').updateMany(
            { school_id: { $exists: true } },
            { $rename: { "school_id": "lead_id" } }
        );
        console.log(`Updated ${followupUpdate.modifiedCount} followups ✅`);

        // 3. Rename 'school_id' to 'lead_id' in notes
        console.log('Updating "notes" collection (school_id -> lead_id)...');
        const noteUpdate = await db.collection('notes').updateMany(
            { school_id: { $exists: true } },
            { $rename: { "school_id": "lead_id" } }
        );
        console.log(`Updated ${noteUpdate.modifiedCount} notes ✅`);

        console.log('Migration completed successfully! 🚀');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed ❌');
        console.error(err);
        process.exit(1);
    }
};

runMigration();
