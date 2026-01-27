// IMPORTANT: Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory
// In Vercel, environment variables are set via dashboard, but we still try to load .env for local dev
if (process.env.VERCEL !== '1') {
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
  console.log('Loading .env from:', envPath);
} else {
  console.log('Running on Vercel - using environment variables from dashboard');
}

// Debug: Log env vars to verify they're loaded
console.log('ENV Check - SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('ENV Check - SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET');

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import sceneRoutes from './routes/scene';
import referralRoutes from './routes/referrals';
import pointsRoutes from './routes/points';
import tasksRoutes from './routes/tasks';
import rewardsRoutes from './routes/rewards';
import oaRoutes from './routes/oa';
import adminRoutes from './routes/admin';
import campaignRoutes from './routes/campaigns';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add Cloudflare tunnel URL detection middleware
app.use((req, res, next) => {
  // Store request for later use in validation endpoints
  (req as any).cloudflareInfo = req.headers['x-forwarded-host'] || req.headers['host'];
  next();
});

// Serve admin pages
// In Vercel, use process.cwd() to get the project root
const adminPath = process.env.VERCEL === '1' 
  ? path.join(process.cwd(), 'admin')
  : path.join(__dirname, '../../admin');
console.log('Admin static path:', adminPath);
app.use('/admin', express.static(adminPath));

// Redirect root to admin dashboard
app.get('/', (req, res) => {
  res.redirect('/admin/dashboard.html');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scene', sceneRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/oa', oaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaigns', campaignRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server (only in non-serverless environments)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
