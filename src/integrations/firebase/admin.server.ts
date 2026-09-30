import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Firebase server environment variable: ${name}`);
  return value;
}

const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

export const firebaseAdminApp =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env("FIREBASE_PROJECT_ID"),
      clientEmail: env("FIREBASE_CLIENT_EMAIL"),
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

export const firebaseAdminAuth = getAuth(firebaseAdminApp);
export const firestoreAdmin = getFirestore(firebaseAdminApp);
export const firebaseAdminStorage = getStorage(firebaseAdminApp);
