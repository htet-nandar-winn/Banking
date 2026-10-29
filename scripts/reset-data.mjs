/**
 * Resets the demo data in Appwrite.
 *
 *   node scripts/reset-data.mjs banks   -> removes banks + transactions only
 *   node scripts/reset-data.mjs all     -> removes users, banks, transactions
 *                                          and the Appwrite accounts as well
 *
 * The script is deliberately explicit instead of running automatically.
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

const mode = process.argv[2] === 'all' ? 'all' : 'banks';

const headers = {
  'X-Appwrite-Project': env.NEXT_PUBLIC_APPWRITE_PROJECT,
  'X-Appwrite-Key': env.NEXT_APPWRITE_KEY,
  'Content-Type': 'application/json',
};

const request = (path, method = 'GET') =>
  new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'cloud.appwrite.io', path, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => {
        d += c;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = d ? JSON.parse(d) : null;
        } catch {
          parsed = d;
        }
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

const DB = env.APPWRITE_DATABASE_ID;

const collections = {
  banks: env.APPWRITE_BANK_COLLECTION_ID,
  transactions: env.APPWRITE_TRANSACTION_COLLECTION_ID,
  users: env.APPWRITE_USER_COLLECTION_ID,
};

const listAll = async (collectionId) => {
  const all = [];
  let cursor = null;

  for (;;) {
    const query = cursor ? `?queries[]=${encodeURIComponent(`cursorAfter(["${cursor}"])`)}` : '';
    const page = await request(`/v1/databases/${DB}/collections/${collectionId}/documents${query}`);
    const documents = page?.documents ?? [];
    all.push(...documents);

    if (documents.length === 0) break;
    cursor = documents[documents.length - 1].$id;
    if (all.length >= (page.total ?? 0)) break;
  }

  return all;
};

const clearCollection = async (name) => {
  const documents = await listAll(collections[name]);

  for (const document of documents) {
    await request(`/v1/databases/${DB}/collections/${collections[name]}/documents/${document.$id}`, 'DELETE');
  }

  console.log(`${name}: deleted ${documents.length}`);
};

const clearTransactionsFirst = async () => {
  await clearCollection('transactions');
  await clearCollection('banks');
};

const clearUsersAndAccounts = async () => {
  const profiles = await listAll(collections.users);

  for (const profile of profiles) {
    try {
      await request(`/v1/users/${profile.userId}`, 'DELETE');
    } catch (error) {
      console.log(`  account ${profile.userId}: ${error.message}`);
    }
  }

  await clearCollection('users');

  const accounts = await request('/v1/users?limit=100');
  for (const account of accounts?.users ?? []) {
    await request(`/v1/users/${account.$id}`, 'DELETE');
  }
  console.log(`accounts: deleted ${accounts?.users?.length ?? 0}`);
};

await clearTransactionsFirst();

if (mode === 'all') {
  await clearUsersAndAccounts();
}

console.log(`done (${mode})`);
