import 'dotenv/config';
import connectDB from './config/db.config.js';
import app from './app.js';
import { initCronJobs } from './utils/cron.js';

// Connect to Database
connectDB();
initCronJobs();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`YAU CRM backend running on port ${PORT}`);
});
