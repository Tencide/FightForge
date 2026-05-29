/**
 * FightForge JWT helper — generate secrets and dev/test tokens.
 *
 * Usage:
 *   node scripts/generate-jwt.js secret
 *   node scripts/generate-jwt.js token --role athlete --id 1 --email athlete@fightforge.test
 *   node scripts/generate-jwt.js verify "<jwt>"
 *
 * Uses JWT_SECRET from the environment or backend/.env (via dotenv) when signing.
 */
require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const args = process.argv.slice(2);
const command = args[0] || 'help';

function readFlag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}

function secret() {
  const bytes = crypto.randomBytes(48);
  const value = bytes.toString('base64url');
  console.log('\nJWT_SECRET (copy into backend/.env and Fly secrets):\n');
  console.log(value);
  console.log('\nLength:', value.length, 'chars\n');
}

function signToken() {
  const key = process.env.JWT_SECRET;
  if (!key || key === 'change-this-to-a-long-random-string') {
    console.error(
      'Set JWT_SECRET in backend/.env first (run: node scripts/generate-jwt.js secret)'
    );
    process.exit(1);
  }

  const payload = {
    id: Number(readFlag('--id', '1')),
    role: readFlag('--role', 'athlete'),
    email: readFlag('--email', 'dev@fightforge.test'),
  };
  const expiresIn = readFlag('--expires', '7d');

  const token = jwt.sign(payload, key, { expiresIn });
  console.log('\nPayload:', JSON.stringify(payload, null, 2));
  console.log('Expires in:', expiresIn);
  console.log('\nBearer token:\n');
  console.log(token);
  console.log('\nAuthorization header:\n');
  console.log(`Authorization: Bearer ${token}\n`);
}

function verifyToken() {
  const key = process.env.JWT_SECRET;
  if (!key) {
    console.error('Set JWT_SECRET in backend/.env to verify tokens.');
    process.exit(1);
  }
  const raw = readFlag('--token', null) || args[1];
  if (!raw) {
    console.error('Usage: node scripts/generate-jwt.js verify "<jwt>"');
    process.exit(1);
  }
  try {
    const decoded = jwt.verify(raw, key);
    console.log('\nValid. Claims:\n');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('');
  } catch (err) {
    console.error('\nInvalid:', err.message, '\n');
    process.exit(1);
  }
}

function help() {
  console.log(`
FightForge JWT generator

  secret
      Print a new random JWT_SECRET for .env / Fly

  token [--id 1] [--role athlete|coach|admin] [--email x@y.com] [--expires 7d]
      Sign a test JWT using JWT_SECRET from backend/.env

  verify <jwt>
      Decode and verify a token with your JWT_SECRET

Examples:
  node scripts/generate-jwt.js secret
  node scripts/generate-jwt.js token --role coach --id 2
  node scripts/generate-jwt.js verify eyJhbGciOiJIUzI1NiIs...
`);
}

switch (command) {
  case 'secret':
  case 'generate-secret':
    secret();
    break;
  case 'token':
  case 'sign':
    signToken();
    break;
  case 'verify':
    verifyToken();
    break;
  case 'help':
  case '-h':
  case '--help':
    help();
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    help();
    process.exit(1);
}
