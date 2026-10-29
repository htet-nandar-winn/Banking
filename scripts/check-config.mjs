/**
 * Checks that everything the app needs is configured.
 *
 * Run with `npm run doctor`. It never prints secret values, it only reports
 * whether they are present.
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('No .env.local found. Copy .env.example to .env.local first.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const isSet = (key) => Boolean(env[key]);

const required = [
  ['NEXT_PUBLIC_APPWRITE_ENDPOINT', 'Appwrite endpoint'],
  ['NEXT_PUBLIC_APPWRITE_PROJECT', 'Appwrite project id'],
  ['APPWRITE_DATABASE_ID', 'Appwrite database id'],
  ['APPWRITE_USER_COLLECTION_ID', 'Appwrite user collection id'],
  ['APPWRITE_BANK_COLLECTION_ID', 'Appwrite bank collection id'],
  ['APPWRITE_TRANSACTION_COLLECTION_ID', 'Appwrite transaction collection id'],
  ['NEXT_APPWRITE_KEY', 'Appwrite server api key'],
];

const optional = [
  ['PLAID_CLIENT_ID', 'Plaid client id (needed to link a bank)'],
  ['PLAID_SECRET', 'Plaid secret (needed to link a bank)'],
  ['DWOLLA_KEY', 'Dwolla key (needed to move money)'],
  ['DWOLLA_SECRET', 'Dwolla secret (needed to move money)'],
];

let missing = 0;

console.log('Required');
for (const [key, label] of required) {
  const ok = isSet(key);
  if (!ok) missing += 1;
  console.log(`  ${ok ? 'ok  ' : 'MISS'}  ${key.padEnd(45)} ${label}`);
}

console.log('\nOptional');
for (const [key, label] of optional) {
  const ok = isSet(key);
  console.log(`  ${ok ? 'ok  ' : '----'}  ${key.padEnd(45)} ${label}`);
}

if (missing > 0) {
  console.log(`\n${missing} required value(s) missing. The app will not work until they are set.`);
  process.exit(1);
}

console.log('\nAll required values are set.');
