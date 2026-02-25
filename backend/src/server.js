import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Root route - Beautiful Status Page
app.get('/', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const uptime = Math.floor(process.uptime());
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>YAU CRM | API Status</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #09090b;
                --card: #18181b;
                --primary: #3b82f6;
                --success: #22c55e;
                --error: #ef4444;
                --text: #fafafa;
                --text-muted: #a1a1aa;
                --border: #27272a;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Inter', sans-serif; 
                background-color: var(--bg); 
                color: var(--text);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                overflow: hidden;
            }
            .container {
                width: 100%;
                max-width: 480px;
                padding: 2rem;
                position: relative;
            }
            .bg-glow {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 300px;
                height: 300px;
                background: var(--primary);
                filter: blur(120px);
                opacity: 0.15;
                z-index: -1;
            }
            .card {
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 24px;
                padding: 2.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
            }
            .logo {
                font-weight: 800;
                font-size: 1.5rem;
                margin-bottom: 2rem;
                letter-spacing: -0.025em;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            }
            .logo span { color: var(--primary); }
            .status-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
                margin-right: 8px;
                position: relative;
            }
            .status-indicator::after {
                content: '';
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                background: inherit;
                opacity: 0.4;
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(2); opacity: 0; } }
            .status-online { background-color: var(--success); }
            .status-offline { background-color: var(--error); }
            
            .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                margin: 2rem 0;
            }
            .stat-item {
                background: rgba(255,255,255,0.03);
                padding: 1rem;
                border-radius: 16px;
                border: 1px solid var(--border);
            }
            .stat-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                font-weight: 600;
                letter-spacing: 0.05em;
                margin-bottom: 0.25rem;
            }
            .stat-value { font-weight: 600; font-size: 0.9rem; }
            
            .btn {
                display: block;
                width: 100%;
                padding: 1rem;
                background: var(--primary);
                color: white;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                transition: transform 0.2s, background 0.2s;
            }
            .btn:hover { transform: translateY(-2px); background: #2563eb; }
        </style>
    </head>
    <body>
        <div class="bg-glow"></div>
        <div class="container">
            <div class="card">
                <div class="logo">YAU<span>CRM</span></div>
                
                <div style="margin-bottom: 1.5rem;">
                    <div class="status-indicator status-online"></div>
                    <span style="font-weight: 600;">API is Online</span>
                </div>

                <div class="grid">
                    <div class="stat-item">
                        <div class="stat-label">Database</div>
                        <div class="stat-value" style="color: ${isDbConnected ? 'var(--success)' : 'var(--error)'}">
                            ${isDbConnected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Environment</div>
                        <div class="stat-value">${process.env.NODE_ENV || 'development'}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Uptime</div>
                        <div class="stat-value">${hours}h ${minutes}m ${seconds}s</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Port</div>
                        <div class="stat-value">${process.env.PORT || 5000}</div>
                    </div>
                </div>

                <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" class="btn">Launch Frontend</a>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`YAU CRM backend running on port ${PORT} with MongoDB (MERN)`);
});
