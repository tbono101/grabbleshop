import fs from 'fs';
import path from 'path';

const BASE = 'https://api.cloudflare.com/client/v4';

export async function uploadImage(filePath) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const formData = new FormData();
  const blob = new Blob([fs.readFileSync(filePath)]);
  formData.append('file', blob, path.basename(filePath));

  const res = await fetch(`${BASE}/accounts/${accountId}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}` },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || 'Cloudflare upload failed');
  return json.result.variants[0]; // public delivery URL
}
