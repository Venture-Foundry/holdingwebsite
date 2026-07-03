// netlify/functions/_utils.js
// Shared helpers: password hashing (scrypt) and signed session tokens (HMAC).
// No external dependencies — uses Node's built-in crypto module only.

const crypto = require('crypto');

/**
 * Hash a password with a random salt using scrypt.
 * Returns { salt, hash } — both hex strings, safe to store.
 */
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

/**
 * Verify a plaintext password against a stored salt+hash.
 * Uses timing-safe comparison to avoid timing attacks.
 */
function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(String(password), salt, 64);
    const stored = Buffer.from(hash, 'hex');
    if (test.length !== stored.length) return false;
    return crypto.timingSafeEqual(test, stored);
  } catch (e) {
    return false;
  }
}

/**
 * Sign a JSON payload into a compact token: base64url(payload).base64url(hmac)
 */
function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify and decode a token. Returns the payload if valid and unexpired, else null.
 */
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch (e) {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

/** Standard JSON response helper */
function json(statusCode, obj, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign(
      { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      extraHeaders || {}
    ),
    body: JSON.stringify(obj),
  };
}

module.exports = { hashPassword, verifyPassword, sign, verifyToken, json };
