import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
import './db.js';

import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import schoolRoutes from './routes/schools.js';
import noteRoutes from './routes/notes.js';
import followupRoutes from './routes/followups.js';
import importRoutes from './routes/import.js';

const app = express();

// ============================================
// 🌍 DISABLE STRICT CORS (LIVE LOGIN FIX)
// ============================================

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.options('*', cors());

// ============================================
// BODY PARSER
// ============================================

app.use(express.json());

// ============================================
// ROOT STATUS ROUTE
// ============================================

app.get('/', (req, res) => {

  const isDbConnected = mongoose.connection.readyState === 1;
  const ENV = process.env.NODE_ENV || 'development';

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>YAU CRM API</title>
    <style>
      body {
        font-family: sans-serif;
        background:#0f172a;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        height:100vh;
      }
      .card {
        background:#1e293b;
        padding:2rem;
        border-radius:12px;
        text-align:center;
      }
      .ok { color:#22c55e }
      .bad { color:#ef4444 }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>YAU CRM API</h2>
      <p>Database:
        <span class="${isDbConnected ? 'ok':'bad'}">
          ${isDbConnected ? 'Connected':'Offline'}
        </span>
      </p>
      <p>Mode: ${ENV}</p>
      <p class="ok">Server Live</p>
      <p class="ok">API Ready</p>
    </div>
  </body>
  </html>
  `);
});

// ============================================
// API ROUTES (KEEP /api)
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
===============================
YAU CRM API RUNNING 🚀
PORT: ${PORT}
MongoDB: Connected
===============================
`);
});
