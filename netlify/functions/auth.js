// netlify/functions/auth.js
// POST { password } → { token }
//
// Password is never stored in HTML/JS. It lives hashed in Netlify Blobs
// (store: "vf-config", key: "admin"). On first-ever call, if no record
// exists yet, it bootstraps itself from the ADMIN_PASSWORD environment
// variable (set once in Netlify's site settings — not in code).
//
// After bootstrap, ADMIN_PASSWORD is no longer read; the password lives
// only as a salted hash in Blobs and can be changed via change-password.js.

const { getStore, connectLambda } = require('@netlify/blobs');
const { hashPassword, verifyPassword, sign, json } = require('./_utils');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hour admin session

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

  const { password } = body;
  if (!password || typeof password !== 'string') {
    return json(400, { error: 'Password is required' });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return json(500, {
      error: 'Server misconfigured: SESSION_SECRET is not set. Add it in Netlify → Site settings → Environment variables.',
    });
  }

  const configStore = getStore('vf-config');
  let record = await configStore.get('admin', { type: 'json' });

  // First run ever: bootstrap the hashed password from the env var.
  if (!record) {
    const bootstrapPw = process.env.ADMIN_PASSWORD;
    if (!bootstrapPw) {
      return json(500, {
        error: 'Admin password not configured yet. Set ADMIN_PASSWORD in Netlify → Site settings → Environment variables, then try again.',
      });
    }
    const { salt, hash } = hashPassword(bootstrapPw);
    record = { salt, hash };
    await configStore.setJSON('admin', record);
  }

  const ok = verifyPassword(password, record.salt, record.hash);
  if (!ok) {
    return json(401, { error: 'Incorrect password' });
  }

  const token = sign({ exp: Date.now() + SESSION_TTL_MS }, secret);
  return json(200, { token });
};
