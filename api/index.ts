// Vercel serverless function entry point
// This file is required by Vercel to handle all routes

// Set Vercel flag before importing
process.env.VERCEL = '1';

// Import the Express app
import app from '../backend/src/index';

// Export as default handler for Vercel
export default app;
