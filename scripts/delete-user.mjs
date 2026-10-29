/**
 * Deletes a single user and everything they own.
 *
 *   node scripts/delete-user.mjs <email>
 */
import https from 'https';
import fs from 'fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/delete-user.mjs <email>');
  process.exit(1);
}

const headers = {
  'X-Appwrite-Project': env.NEXT_PUBLIC_APPWRITE_PROJECT,
  'X-Appwrite-Key': env.NEXT_APPWRITE_KEY,
  'Content-Type': 'application/json',
};

const request = (path, method = 'GET') =>
  new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'cloud.appwrite.io', path, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = d ? JSON.parse(d) : null; } catch { parsed = d; }
        if (res.statusCode >= 400) {
          reject(new Error(`${method} ${path} -> ${res.statusCode} ${JSON.stringify(parsed)}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.end();
  });

const db = env.APPWRITE_DATABASE_ID;
const usersCol = env.APPWRITE_USER_COLLECTION_ID;
const banksCol = env.APPWRITE_BANK_COLLECTION_ID;
const txCol = env.APPWRITE_TRANSACTION_COLLECTION_ID;

const profiles = await request(`/v1/databases/${db}/collections/${usersCol}/documents`);
const profile = (profiles?.documents ?? []).find(
  (document) => document.email?.toLowerCase() === email.toLowerCase()
);

if (!profile) {
  console.error(`No profile found for ${email}`);
  process.exit(1);
}

const banks = await request(`/v1/databases/${db}/collections/${banksCol}/documents`);
const userBanks = (banks?.documents ?? []).filter((bank) => {
  const owner = typeof bank.userId === 'object' ? bank.userId?.$id : bank.userId;
  return owner === profile.$id;
});

const bankIds = new Set(userBanks.map((bank) => bank.$id));

const transactions = await request(`/v1/databases/${db}/collections/${txCol}/documents`);
const userTransactions = (transactions?.documents ?? []).filter(
  (transaction) =>
    bankIds.has(transaction.senderBankId) || bankIds.has(transaction.receiverBankId)
);

for (const transaction of userTransactions) {
  await request(`/v1/databases/${db}/collections/${txCol}/documents/${transaction.$id}`, 'DELETE');
}
for (const bank of userBanks) {
  await request(`/v1/databases/${db}/collections/${banksCol}/documents/${bank.$id}`, 'DELETE');
}

await request(`/v1/databases/${db}/collections/${usersCol}/documents/${profile.$id}`, 'DELETE');

try {
  await request(`/v1/users/${profile.userId}`, 'DELETE');
} catch (error) {
  console.log(`account: ${error.message}`);
}

console.log(
  `Deleted ${email}: ${userBanks.length} banks, ${userTransactions.length} transactions`
);
