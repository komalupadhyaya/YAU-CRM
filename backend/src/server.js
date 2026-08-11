import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.config.js';
import app from './app.js';
import { initCronJobs } from './utils/cron.js';

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

io.on('connection', (socket) => {
    console.log(`⚡ Client connected to Socket.IO: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected from Socket.IO: ${socket.id}`);
    });
});

app.set('io', io);

server.listen(PORT, () => {
  console.log(`YAU CRM backend running on port ${PORT}`);
});
