import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
import './db.js'; // MongoDB connection + admin seeding

import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import schoolRoutes from './routes/schools.js';
import noteRoutes from './routes/notes.js';
import followupRoutes from './routes/followups.js';
import importRoutes from './routes/import.js';

const app = express();

// ----------------------------
// DEMO CORS: allow all origins
// ----------------------------
app.use(cors({
  origin: '*',              // allow any frontend
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json());

// ----------------------------
// Routes
// ----------------------------
app.use('/auth', authRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/schools', schoolRoutes);
app.use('/notes', noteRoutes);
app.use('/followups', followupRoutes);
app.use('/import', importRoutes);

// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`YAU CRM backend running on port ${PORT} with MongoDB (MERN)`);
});
