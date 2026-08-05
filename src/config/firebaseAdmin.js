const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let serviceAccount;

// Production (Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  // Fix escaped newlines in private key
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
} else {
  // Local development
  serviceAccount = require("../../firebase-service-account.json");
}

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApps()[0];

module.exports = {
  auth: () => getAuth(app),
};