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

// ----------------------------
// CORS
// ----------------------------
const allowedOrigins = [
  'https://yaucrm-i861qp4qw-komalupadhyayas-projects.vercel.app',
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS Not Allowed'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

// ----------------------------
// ENV + URL DETECTION
// ----------------------------
const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';

const LIVE_URL = process.env.RAILWAY_STATIC_URL
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : null;

const LOCAL_URL = `http://localhost:${PORT}`;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';

// ----------------------------
// ROOT ROUTE
// ----------------------------
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
* { margin:0; padding:0; box-sizing:border-box; }
body {
font-family:'Inter',sans-serif;
background:var(--bg);
color:var(--text);
display:flex;
align-items:center;
justify-content:center;
min-height:100vh;
overflow:hidden;
}
.container {
width:100%;
max-width:480px;
padding:2rem;
position:relative;
}
.bg-glow {
position:absolute;
top:50%;
left:50%;
transform:translate(-50%,-50%);
width:300px;
height:300px;
background:var(--primary);
filter:blur(120px);
opacity:0.15;
z-index:-1;
}
.card {
background:var(--card);
border:1px solid var(--border);
border-radius:24px;
padding:2.5rem;
box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);
text-align:center;
}
.logo {
font-weight:800;
font-size:1.5rem;
margin-bottom:2rem;
display:flex;
align-items:center;
justify-content:center;
gap:0.5rem;
}
.logo span { color:var(--primary); }
.status-indicator {
width:12px;
height:12px;
border-radius:50%;
display:inline-block;
margin-right:8px;
position:relative;
background:var(--success);
}
.status-indicator::after {
content:'';
position:absolute;
inset:-4px;
border-radius:50%;
background:inherit;
opacity:0.4;
animation:pulse 2s infinite;
}
@keyframes pulse {
0%,100%{transform:scale(1);opacity:0.4;}
50%{transform:scale(2);opacity:0;}
}
.grid {
display:grid;
grid-template-columns:1fr 1fr;
gap:1rem;
margin:2rem 0;
}
.stat-item {
background:rgba(255,255,255,0.03);
padding:1rem;
border-radius:16px;
border:1px solid var(--border);
text-align:left;
}
.stat-label {
font-size:0.75rem;
color:var(--text-muted);
text-transform:uppercase;
font-weight:600;
margin-bottom:0.25rem;
}
.stat-value {
font-weight:600;
font-size:0.85rem;
word-break:break-all;
}
.ok {color:var(--success);}
.bad {color:var(--error);}
.btn {
display:block;
width:100%;
padding:1rem;
background:var(--primary);
color:white;
text-decoration:none;
border-radius:12px;
font-weight:600;
}
</style>
</head>
<body>
<div class="bg-glow"></div>
<div class="container">
<div class="card">

<div class="logo">YAU<span>CRM</span></div>

<div style="margin-bottom:1.5rem;">
<div class="status-indicator"></div>
<span style="font-weight:600;">API is Online</span>
</div>

<div class="grid">

<div class="stat-item">
<div class="stat-label">Database</div>
<div class="stat-value ${isDbConnected ? 'ok':'bad'}">
${isDbConnected ? 'Connected':'Disconnected'}
</div>
</div>

<div class="stat-item">
<div class="stat-label">Environment</div>
<div class="stat-value">${ENV}</div>
</div>

<div class="stat-item">
<div class="stat-label">Port</div>
<div class="stat-value">${PORT}</div>
</div>

<div class="stat-item">
<div class="stat-label">Local API</div>
<div class="stat-value">${LOCAL_URL}</div>
</div>

${LIVE_URL ? `
<div class="stat-item">
<div class="stat-label">Railway Live</div>
<div class="stat-value">${LIVE_URL}</div>
</div>` : ''}

</div>

<a href="${FRONTEND}" class="btn">Launch Frontend</a>

</div>
</div>
</body>
</html>
`);
});

// ----------------------------
// ROUTES
// ----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/import', importRoutes);

// ----------------------------
// SERVER START
// ----------------------------
app.listen(PORT, () => {
console.log(`YAU CRM backend running on port ${PORT}`);
});
