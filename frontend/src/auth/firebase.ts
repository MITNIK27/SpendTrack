import { initializeApp } from "firebase/app"
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth"

// Public by design — same as any Firebase web app's config, not a secret. The real
// access-control boundary is the backend's verified-token + domain check in
// POST /api/auth/google, not anything here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

const googleProvider = new GoogleAuthProvider()
// UX hint only — nudges Google's account chooser toward @infobeans.com accounts.
// Not a security control; the backend enforces the real domain check.
googleProvider.setCustomParameters({ hd: "infobeans.com" })

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function firebaseSignOut() {
  return signOut(auth)
}
