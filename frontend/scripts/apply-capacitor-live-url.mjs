/**
 * Codemagic: set Capacitor server.url so the iOS app loads the live Vercel UI.
 * Usage: CAPACITOR_LIVE_URL=https://fightforge.vercel.app node scripts/apply-capacitor-live-url.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'capacitor.config.json');

const liveUrl = (process.env.CAPACITOR_LIVE_URL || '').replace(/\/+$/, '');
if (!liveUrl) {
  console.log('CAPACITOR_LIVE_URL not set — using bundled dist/ in the native app');
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
cfg.server = { url: liveUrl, cleartext: false };
fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`Capacitor server.url → ${liveUrl}`);
