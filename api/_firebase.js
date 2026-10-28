/**
 * Firebase Admin SDK – initialisation and helper functions
 * Stores anonymised user data under hashed tokens (never raw phone numbers)
 */
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialise once
if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    // Base64-encoded service account JSON (most reliable for Vercel)
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Plain JSON service account
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fallback: three separate env vars
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
  }
  admin.initializeApp({ credential });
}

const db = admin.firestore();

/**
 * Hash a phone number into an anonymous token
 * We never store the raw number — only this hash
 */
function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone + '_mzansi').digest('hex').slice(0, 16);
}

/**
 * Get or create a user record
 * Returns { isNew: bool, data: object }
 */
async function getOrCreateUser(phone) {
  const token = hashPhone(phone);
  const ref = db.collection('users').doc(token);
  const doc = await ref.get();

  if (doc.exists) {
    return { isNew: false, token, data: doc.data() };
  }

  const newUser = {
    token,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    step: 'welcome',
    agreedTcs: false,
    agreedSafety: false,
    age: null,
    exercise: null,
    exerciseScore: null,
    mobility: null,
    mobilityScore: null,
    group: null,
    sessions: [],
  };
  await ref.set(newUser);
  return { isNew: true, token, data: newUser };
}

/**
 * Update user fields
 */
async function updateUser(token, fields) {
  const ref = db.collection('users').doc(token);
  await ref.update(fields);
}

/**
 * Log a completed session
 */
async function logSession(token, sessionData) {
  const ref = db.collection('users').doc(token);
  await ref.update({
    sessions: admin.firestore.FieldValue.arrayUnion({
      ...sessionData,
      timestamp: new Date().toISOString(),
    }),
  });
}

module.exports = { db, hashPhone, getOrCreateUser, updateUser, logSession };
