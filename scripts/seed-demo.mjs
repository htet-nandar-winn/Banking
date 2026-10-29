/**
 * Seeds demo bank accounts for an existing user.
 *
 *   node scripts/seed-demo.mjs <email>
 *
 * Mirrors what "Connect bank" does in the UI, so an account that was just
 * created can immediately show a populated dashboard.
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
  console.error('Usage: node scripts/seed-demo.mjs <email>');
  process.exit(1);
}

const headers = {
  'X-Appwrite-Project': env.NEXT_PUBLIC_APPWRITE_PROJECT,
  'X-Appwrite-Key': env.NEXT_APPWRITE_KEY,
  'Content-Type': 'application/json',
};

const request = (path, method = 'GET', body) =>
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

const db = env.APPWRITE_DATABASE_ID;

const profiles = await request(
  `/v1/databases/${db}/collections/${env.APPWRITE_USER_COLLECTION_ID}/documents`
);

const profile = (profiles?.documents ?? []).find(
  (document) => document.email?.toLowerCase() === email.toLowerCase()
);
if (!profile) {
  console.error(`No user profile found for ${email}`);
  process.exit(1);
}

const rand = () => Math.random().toString(36).slice(2, 10);
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

const seed = [
  { name: 'Payroll deposit', amount: 4200, direction: 'credit', category: 'Transfer', channel: 'online', daysAgo: 26 },
  { name: 'Whole Foods Market', amount: 128.42, direction: 'debit', category: 'Food and Drink', channel: 'in person', daysAgo: 23 },
  { name: 'Blue Bottle Coffee', amount: 6.75, direction: 'debit', category: 'Food and Drink', channel: 'in person', daysAgo: 20 },
  { name: 'Netflix', amount: 15.49, direction: 'debit', category: 'Payment', channel: 'online', daysAgo: 18 },
  { name: 'Shell', amount: 62.1, direction: 'debit', category: 'Travel', channel: 'in person', daysAgo: 14 },
  { name: 'Rent', amount: 1850, direction: 'debit', category: 'Payment', channel: 'online', daysAgo: 11 },
  { name: 'Refund - Amazon', amount: 39.99, direction: 'credit', category: 'Payment', channel: 'online', daysAgo: 7 },
  { name: 'Monthly account fee', amount: 4.95, direction: 'debit', category: 'Bank Fees', channel: 'online', daysAgo: 4 },
  { name: 'Transfer to savings', amount: 250, direction: 'debit', category: 'Transfer', channel: 'online', daysAgo: 2 },
];

const createAccount = async ({ institutionName, accountName, accountType, balance }) => {
  const accountId = `demo-${rand()}${digits(4)}`;
  const shareableId = Buffer.from(accountId, 'binary').toString('base64');

  const bank = await request(
    `/v1/databases/${db}/collections/${env.APPWRITE_BANK_COLLECTION_ID}/documents`,
    'POST',
    {
      documentId: 'unique()',
      data: {
        bankId: 'ins_demo',
        accountId,
        accessToken: `demo_${rand()}`,
        fundingSourceUrl: `demo://${accountId}`,
        shareableId,
        userId: profile.$id,
        balance,
        institutionName,
        accountName,
        accountType,
        mask: digits(4),
        isDemo: true,
      },
    }
  );

  for (const item of seed) {
    await request(
      `/v1/databases/${db}/collections/${env.APPWRITE_TRANSACTION_COLLECTION_ID}/documents`,
      'POST',
      {
        documentId: 'unique()',
        data: {
          name: item.name,
          amount: item.amount,
          senderId: item.direction === 'debit' ? profile.$id : 'demo-external',
          senderBankId: item.direction === 'debit' ? bank.$id : 'demo-external-bank',
          receiverId: item.direction === 'credit' ? profile.$id : 'demo-external',
          receiverBankId: item.direction === 'credit' ? bank.$id : 'demo-external-bank',
          email: profile.email,
          channel: item.channel,
          category: item.category,
          date: new Date(Date.now() - item.daysAgo * 86_400_000).toISOString(),
        },
      }
    );
  }

  console.log(`${accountName}: $${balance}  (shareable id: ${shareableId})`);
};

await createAccount({ institutionName: 'Horizon Demo Bank', accountName: 'Everyday checking', accountType: 'depository', balance: 5000 });
await createAccount({ institutionName: 'Horizon Demo Bank', accountName: 'Rainy day savings', accountType: 'savings', balance: 1200 });

console.log('done');
