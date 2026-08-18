import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.config.js';
import app from './app.js';
import { initCronJobs } from './utils/cron.js';
import presenceService from './services/realtime/presence.service.js';
import { startQueueWorker } from './services/email/emailQueue.service.js';

// Connect to Database
connectDB();
initCronJobs();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const allowedOrigins = [
  'https://crm.yauapp.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://youthathleteuniversity.org',
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Initialize real-time presence service on Socket.IO
presenceService.init(io);
startQueueWorker(io);

app.set('io', io);

server.listen(PORT, () => {
  console.log(`YAU CRM backend running on port ${PORT}`);
});
