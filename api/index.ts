// Vercel serverless function entry point
// Import from the compiled backend code
// Vercel will build backend first, then use this entry point

// Set Vercel flag
process.env.VERCEL = '1';

// Import the Express app from compiled backend
// The build process compiles backend/src/index.ts to backend/dist/index.js
// Use require to avoid TypeScript compilation issues in Vercel
const backendModule = require('../backend/dist/index');
const app = backendModule.default || backendModule;

// Export as default handler for Vercel
module.exports = app;
