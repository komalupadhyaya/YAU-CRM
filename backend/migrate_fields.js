import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const SchoolSchema = new mongoose.Schema({
    grades: String,
    principal_name: String,
    principal_email: String,
    category_group: String,
    main_contact_name: String,
    main_contact_email: String,
}, { strict: false });

const School = mongoose.model('School', SchoolSchema);

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const schools = await School.find({
            $or: [
                { grades: { $exists: true } },
                { principal_name: { $exists: true } },
                { principal_email: { $exists: true } }
            ]
        });

        console.log(`Found ${schools.length} schools to migrate`);

        for (const school of schools) {
            const schoolObj = school.toObject();
            const update = {
                $set: {
                    category_group: schoolObj.category_group || schoolObj.grades,
                    main_contact_name: schoolObj.main_contact_name || schoolObj.principal_name,
                    main_contact_email: schoolObj.main_contact_email || schoolObj.principal_email
                },
                $unset: {
                    grades: 1,
                    principal_name: 1,
                    principal_email: 1
                }
            };
            await School.updateOne({ _id: school._id }, update);
        }

        console.log('Migration complete.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
