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
// 🌍 ENV + PORT DETECTION
// ============================================

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';
const isProduction = ENV === 'production';

// Railway gives this automatically
const LIVE_URL = process.env.RAILWAY_STATIC_URL
    ? `https://${process.env.RAILWAY_STATIC_URL}`
    : null;

const LOCAL_URL = `${PORT}`;
const API_BASE = isProduction ? LIVE_URL : LOCAL_URL;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';

// ============================================
// 🌍 EXPRESS 5 CORS (PATCH SAFE)
// ============================================

const allowedOrigins = [
    'http://localhost:8080',
    'https://yaucrm.vercel.app/',
    FRONTEND
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS Not Allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

// ============================================
// ROOT STATUS ROUTE
// ============================================

app.get('/', (req, res) => {

    const isDbConnected = mongoose.connection.readyState === 1;

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
                background: var(--bg);
                color: var(--text);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
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
                text-align:center;
            }
            .logo {
                font-weight: 800;
                font-size: 1.5rem;
                margin-bottom: 1rem;
            }
            .logo span { color: var(--primary); }

            .status {
                margin-bottom: 2rem;
            }
            .dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--success);
                display:inline-block;
                margin-right:6px;
                position:relative;
            }
            .dot::after {
                content:'';
                position:absolute;
                inset:-4px;
                border-radius:50%;
                background:inherit;
                opacity:0.4;
                animation:pulse 2s infinite;
            }
            @keyframes pulse {
                0%,100% {transform:scale(1);opacity:0.4;}
                50% {transform:scale(2);opacity:0;}
            }

            .grid {
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:1rem;
                margin:2rem 0;
            }
            .stat {
                background: rgba(255,255,255,0.03);
                padding: 1rem;
                border-radius: 14px;
                border: 1px solid var(--border);
                text-align:left;
            }
            .label {
                font-size:0.7rem;
                color:var(--text-muted);
                text-transform:uppercase;
                margin-bottom:4px;
            }
            .value {
                font-size:0.85rem;
                font-weight:600;
                word-break:break-all;
            }
            .ok { color: var(--success); }
            .bad { color: var(--error); }

            .btn {
                display:block;
                padding:1rem;
                background:var(--primary);
                border-radius:12px;
                text-decoration:none;
                color:white;
                font-weight:600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="bg-glow"></div>
            <div class="card">

                <div class="logo">YAU<span>CRM</span></div>

                <div class="status">
                    <span class="dot"></span>
                    API is Online
                </div>

                <div class="grid">

                    <div class="stat">
                        <div class="label">Database</div>
                        <div class="value ${isDbConnected ? 'ok' : 'bad'}">
                            ${isDbConnected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>

                    <div class="stat">
                        <div class="label">Environment</div>
                        <div class="value">${ENV}</div>
                    </div>

                    <div class="stat">
                        <div class="label">Port</div>
                        <div class="value">${PORT}</div>
                    </div>

                   
                    ${LIVE_URL ? `
                    <div class="stat">
                        <div class="label">Railway Live</div>
                        <div class="value">${LIVE_URL}</div>
                    </div>` : ''}

                    <div class="stat">
                        <div class="label">API Route</div>
                        <div class="value">${API_BASE}/api</div>
                    </div>

                </div>

                <a href="${FRONTEND}" class="btn">
                    Launch Frontend
                </a>

            </div>
        </div>
    </body>
    </html>
    `);
});
// ============================================
// ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
    console.log(`
=================================
YAU CRM API RUNNING 🚀
ENV        : ${ENV}
PORT       : ${PORT}
LOCAL      : ${LOCAL_URL}
LIVE       : ${LIVE_URL || 'Not Live'}
FRONTEND   : ${FRONTEND}
API BASE   : ${API_BASE}/api
=================================
`);
});
