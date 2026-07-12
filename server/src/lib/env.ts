import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // Supabase project API (Project Settings -> API)
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  port: parseInt(process.env.PORT ?? '4000', 10),
  jwtSecret: required('JWT_SECRET', 'assetflow-dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@assetflow.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',
};
