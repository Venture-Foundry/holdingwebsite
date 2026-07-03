// netlify/functions/change-password.js
// POST { token, currentPassword, newPassword } → { ok: true }
//
// Requires a valid session token (proves you're already logged in) AND
// the current password (proves you're not a hijacked session), then
// overwrites the hashed password record in Netlify Blobs.

const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword, verifyPassword, verifyToken, json } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  connectLambda(event);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Malformed request body' });
  }

  const { token, currentPassword, newPassword } = body;

  const secret = process.env.SESSION_SECRET;
  if (!secret || !verifyToken(token, secret)) {
    return json(401, { error: 'Session expired — please sign in again.' });
  }

  if (!currentPassword || !newPassword) {
    return json(400, { error: 'Current and new password are both required.' });
  }
  if (String(newPassword).length < 8) {
    return json(400, { error: 'New password must be at least 8 characters.' });
  }

  const configStore = getStore('vf-config');
  const record = await configStore.get('admin', { type: 'json' });
  if (!record) {
    return json(500, { error: 'Admin account not initialised yet — sign in once first.' });
  }

  const ok = verifyPassword(currentPassword, record.salt, record.hash);
  if (!ok) {
    return json(401, { error: 'Current password is incorrect.' });
  }

  const { salt, hash } = hashPassword(newPassword);
  await configStore.setJSON('admin', { salt, hash });

  return json(200, { ok: true });
};
