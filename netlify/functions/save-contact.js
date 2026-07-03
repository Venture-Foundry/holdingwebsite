// netlify/functions/save-contact.js
// POST { token, who, data } → { ok: true, data: <merged record> }
//
// Requires a valid session token from auth.js. Merges the supplied fields
// into whatever is already stored (so a photo-only update from handlePhoto()
// doesn't clobber the rest of the record, and vice versa).

const { getStore, connectLambda } = require('@netlify/blobs');
const { verifyToken, json } = require('./_utils');

const VALID_WHO = ['james', 'kevin'];

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

  const { token, who, data } = body;

  const secret = process.env.SESSION_SECRET;
  if (!secret || !verifyToken(token, secret)) {
    return json(401, { error: 'Session expired — please sign in again.' });
  }

  if (!who || !VALID_WHO.includes(who)) {
    return json(400, { error: 'Field "who" must be "james" or "kevin"' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json(400, { error: 'Field "data" must be an object' });
  }

  const store = getStore('vf-contacts');
  const existing = (await store.get(who, { type: 'json' })) || {};
  const merged = Object.assign({}, existing, data);

  await store.setJSON(who, merged);

  return json(200, { ok: true, data: merged });
};
