// Vercel serverless entry — wraps the Express app.
// All /api/* requests are rewritten here (see vercel.json).
import { createApp } from '../server/src/app';

export default createApp();
