import admin from "firebase-admin";
import serviceAccount from "../../../serviceAccount";


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'tap2deliver-30079.firebasestorage.app',
  });
}

export const db = admin.firestore();        // Firestore
export const auth = admin.auth();           // Auth
export default admin;
