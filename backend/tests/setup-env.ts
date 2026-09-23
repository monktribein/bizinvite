// Loaded before any test module: config/env.ts validates these at import time.
// All values are test-only placeholders.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bizinvite_db";
process.env.JWT_ACCESS_SECRET = "test-access-secret-0123456789-abcdefghijklmnop";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-0123456789-abcdefghijklmnop";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "30d";
process.env.QR_SIGNING_SECRET = "test-qr-signing-secret-0123456789-abcdefghijkl";
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
process.env.WHATSAPP_APP_SECRET = "test-app-secret";
process.env.CORS_ORIGIN = "http://localhost:3000";
