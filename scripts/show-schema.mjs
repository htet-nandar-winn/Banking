import https from 'https';
import fs from 'fs';

const env = {};
const s = fs.readFileSync('.env.local', 'utf8');
s.split(/\r?\n/).forEach((l) => {
  const i = l.indexOf('=');
  if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
});

const h = { 'X-Appwrite-Project': env.NEXT_PUBLIC_APPWRITE_PROJECT, 'X-Appwrite-Key': env.NEXT_APPWRITE_KEY };

const get = (path) =>
  new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'cloud.appwrite.io', path, method: 'GET', headers: h }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });

const cols = [
  ['users', env.APPWRITE_USER_COLLECTION_ID],
  ['banks', env.APPWRITE_BANK_COLLECTION_ID],
  ['transactions', env.APPWRITE_TRANSACTION_COLLECTION_ID],
];

for (const [name, id] of cols) {
  const r = await get(`/v1/databases/${env.APPWRITE_DATABASE_ID}/collections/${id}/attributes`);
  const attrs = (r.attributes ?? []).map((a) => `${a.key}:${a.type}${a.required ? '*' : ''}${a.array ? '[]' : ''}${a.relatedCollectionId ? '(->' + a.relatedCollectionId + ')' : ''}`);
  console.log(name, '=>', attrs.join(', ') || '(none)');
}
