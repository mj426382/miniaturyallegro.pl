/**
 * Environment for integration tests. Runs in every jest worker BEFORE the
 * application (and ConfigModule) is loaded, so these values win over .env.
 *
 * The real .env is never read in test mode (see AppModule) – tests must not
 * touch production storage, AI providers or Stripe.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5437/allgrafika_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-validation-123456';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.FREE_CREDITS_LIMIT = '10';
process.env.SWAGGER_ENABLED = 'false';
process.env.THROTTLE_LIMIT_PER_MINUTE = '1000';
process.env.THROTTLE_DISABLED = 'true';
process.env.BCRYPT_ROUNDS = '4';

// Force local disk storage.
process.env.B2_BUCKET_NAME = '';
process.env.B2_ENDPOINT = '';
process.env.B2_KEY_ID = '';
process.env.B2_APPLICATION_KEY = '';
const uploadDir = path.join(os.tmpdir(), `allgrafika-test-uploads-${process.pid}`);
fs.mkdirSync(uploadDir, { recursive: true });
process.env.LOCAL_UPLOAD_DIR = uploadDir;

// External providers are replaced by fakes in tests – keys only need to be non-empty.
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.STRIPE_SECRET_KEY = 'sk_test_PLACEHOLDER';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_integration_tests';
process.env.SMTP_HOST = '';
