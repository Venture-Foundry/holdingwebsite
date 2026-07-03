// netlify/functions/get-contact.js
// GET ?who=james|kevin → contact JSON
//
// Public, read-only, no auth — this is what james.html / kevin.html call
// on page load to render the card. Falls back to sensible defaults if
// nothing has been saved to Blobs yet.

const { getStore, connectLambda } = require('@netlify/blobs');
const { json } = require('./_utils');

const DEFAULTS = {
  james: {
    first: 'James', last: 'Spearman', name: 'James Spearman',
    role: 'Co-Founder', org: 'Venture Foundry',
    tagline: 'Microsoft Azure Expert · Cloud Migration & Security Strategist',
    email: 'james@venturefoundry.ae', phone: '',
    linkedin: 'https://www.linkedin.com/in/jamesspearman',
    address: 'DIFC Innovation Hub, Gate Avenue, Dubai, UAE',
    photo: 'img/james_square.jpg',
  },
  kevin: {
    first: 'Kevin', last: 'Ashby', name: 'Kevin Ashby',
    role: 'Co-Founder', org: 'Venture Foundry',
    tagline: 'Global Partner & Alliances Leader · 30+ Years in Channel & Cloud',
    email: 'kevin@venturefoundry.ae', phone: '',
    linkedin: 'https://www.linkedin.com/in/kevinpaulashby',
    address: 'DIFC Innovation Hub, Gate Avenue, Dubai, UAE',
    photo: 'img/kevin_square.jpg',
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  connectLambda(event);

  const who = (event.queryStringParameters || {}).who;
  if (!who || !DEFAULTS[who]) {
    return json(400, { error: 'Query param "who" must be "james" or "kevin"' });
  }

  try {
    const store = getStore('vf-contacts');
    const data = await store.get(who, { type: 'json' });
    return json(200, data || DEFAULTS[who]);
  } catch (err) {
    // Blobs not reachable for some reason — degrade gracefully to defaults
    // rather than breaking the public contact card.
    return json(200, DEFAULTS[who]);
  }
};
