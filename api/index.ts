// Vercel serverless function entry point
// Import from the compiled backend code
// Vercel will build backend first, then use this entry point

// Set Vercel flag BEFORE any imports
process.env.VERCEL = '1';

// Import the Express app from compiled backend
// The build process compiles backend/src/index.ts to backend/dist/index.js
// Use require to avoid TypeScript compilation issues in Vercel
let app: any;
try {
  const backendModule = require('../backend/dist/index');
  app = backendModule.default || backendModule;
  
  // If app is still undefined, try to get it from exports
  if (!app) {
    app = backendModule;
  }
  
  // Verify app is an Express app
  if (!app || typeof app !== 'function') {
    throw new Error('Failed to load Express app from backend/dist/index');
  }
  
  console.log('[Vercel] Express app loaded successfully');
} catch (error: any) {
  console.error('[Vercel] Failed to load backend:', error);
  // Create a minimal error handler
  const express = require('express');
  app = express();
  app.use((req: any, res: any) => {
    res.status(500).json({ 
      error: 'Backend initialization failed',
      message: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  });
}

// Export as default handler for Vercel
// Vercel expects a function that handles (req, res) => void
module.exports = app;
