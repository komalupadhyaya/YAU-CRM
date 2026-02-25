import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
import './db.js'; // MongoDB connection and admin seeding

import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import schoolRoutes from './routes/schools.js';
import noteRoutes from './routes/notes.js';
import followupRoutes from './routes/followups.js';
import importRoutes from './routes/import.js';

const app = express();

// Allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://yaucrm.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

// ----------------------------
// Global CORS middleware
// ----------------------------
app.use(cors({
  origin: function(origin, callback) {
    // allow server-to-server / Postman requests with no origin
    if (!origin) return callback(null, true);

    // allow if origin matches any in allowedOrigins
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }

    console.log('Blocked CORS request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ----------------------------
// Handle preflight requests globally
// ----------------------------
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parser
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
