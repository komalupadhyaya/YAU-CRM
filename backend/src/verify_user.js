import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const test = async () => {
    try {
        console.log('Connecting...');
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('Connected ✅');
        const u = await User.findOne({ username: 'admin' });
        console.log('User admin exists:', !!u);
        if (u) {
            console.log('Username:', u.username);
            console.log('Hashed Password:', u.password);
        }
    } catch (err) {
        console.error('FAILED ❌', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

test();
