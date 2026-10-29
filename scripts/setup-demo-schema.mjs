/**
 * Adds the attributes needed by the demo bank mode.
 *
 * Safe to run more than once: existing attributes are skipped.
 */
import https from 'https';
import fs from 'fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const BASE = 'cloud.appwrite.io';
const headers = {
  'X-Appwrite-Project': env.NEXT_PUBLIC_APPWRITE_PROJECT,
  'X-Appwrite-Key': env.NEXT_APPWRITE_KEY,
  'Content-Type': 'application/json',
};

const request = (path, method, body) =>
  new Promise((resolve) => {
    const req = https.request({ hostname: BASE, path, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = d ? JSON.parse(d) : null; } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

const DB = env.APPWRITE_DATABASE_ID;
const BANKS = env.APPWRITE_BANK_COLLECTION_ID;
const TX = env.APPWRITE_TRANSACTION_COLLECTION_ID;

const listAttributes = async (col) => {
  const r = await request(`/v1/databases/${DB}/collections/${col}/attributes`, 'GET');
  return r.body?.attributes ?? [];
};

const ensureAttribute = async (col, existing, type, payload, label) => {
  if (existing.some((a) => a.key.toLowerCase() === payload.key.toLowerCase())) {
    console.log(`  ${label}.${payload.key}: already exists`);
    return;
  }
  const r = await request(
    `/v1/databases/${DB}/collections/${col}/attributes/${type}`,
    'POST',
    payload
  );
  console.log(`  ${label}.${payload.key}: ${r.status} ${r.body?.type ?? r.body?.message ?? ''}`);
};

const waitForAll = async (col, label) => {
  for (let attempt = 0; attempt < 40; attempt++) {
    const attrs = await listAttributes(col);
    const pending = attrs.filter((a) => a.status === 'processing' || a.status === 'stuck');
    if (pending.length === 0) {
      console.log(`  ${label}: all attributes available`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`  ${label}: timed out waiting for attributes`);
};

// The `sharebleld` attribute is a typo and is required, which makes every bank
// insert fail. Nothing in the code uses it.
const bankAttrs = await listAttributes(BANKS);
const stray = bankAttrs.find((a) => a.key.toLowerCase() === 'sharebleld');
if (stray) {
  const r = await request(`/v1/databases/${DB}/collections/${BANKS}/attributes/sharebleld`, 'DELETE');
  console.log(`banks.sharebleld removed: ${r.status}`);
}

console.log('banks:');
let attrs = await listAttributes(BANKS);
await ensureAttribute(BANKS, attrs, 'float', { key: 'balance', required: false, default: 0, min: 0 }, 'banks');
await ensureAttribute(BANKS, attrs, 'string', { key: 'institutionName', required: false, size: 128, default: '' }, 'banks');
await ensureAttribute(BANKS, attrs, 'string', { key: 'accountName', required: false, size: 128, default: '' }, 'banks');
await ensureAttribute(BANKS, attrs, 'string', { key: 'accountType', required: false, size: 32, default: 'depository' }, 'banks');
await ensureAttribute(BANKS, attrs, 'string', { key: 'mask', required: false, size: 8, default: '' }, 'banks');
await ensureAttribute(BANKS, attrs, 'boolean', { key: 'isDemo', required: false, default: false }, 'banks');

console.log('transactions:');
attrs = await listAttributes(TX);
await ensureAttribute(TX, attrs, 'datetime', { key: 'date', required: false }, 'transactions');

await waitForAll(BANKS, 'banks');
await waitForAll(TX, 'transactions');

const final = await listAttributes(BANKS);
console.log('\nbanks =>', final.map((a) => `${a.key}:${a.type}${a.required ? '*' : ''}`).join(', '));
const finalTx = await listAttributes(TX);
console.log('transactions =>', finalTx.map((a) => `${a.key}:${a.type}${a.required ? '*' : ''}`).join(', '));
