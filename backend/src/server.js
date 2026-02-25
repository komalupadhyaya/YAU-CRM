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

// Define allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://yaucrm.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

// Configure CORS middleware
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman or server-to-server)
    if (!origin) return callback(null, true);

    // allow if origin contains one of allowed origins (handles trailing slash)
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }

    console.log('Blocked CORS request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`YAU CRM backend running on port ${PORT} with MongoDB (MERN)`));
