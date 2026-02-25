import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Must be called before anything that reads env vars

import './db.js'; // Initialize MongoDB database (seeding admin)

import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import schoolRoutes from './routes/schools.js';
import noteRoutes from './routes/notes.js';
import followupRoutes from './routes/followups.js';
import importRoutes from './routes/import.js';

const app = express();

app.use(cors({ origin: [process.env.FRONTEND_URL || 'https://yaucrm.vercel.app/', 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`YAU CRM backend running on port ${PORT} with MongoDB (MERN)`));
