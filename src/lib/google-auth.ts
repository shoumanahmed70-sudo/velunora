"use client";

import { api } from "@/lib/api-client";

interface StoreBootstrap {
  googleAuthEnabled: boolean;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  } | null;
}

/**
 * تسجيل الدخول عبر Google (يُفعّل فقط عند إعداد Firebase وOAuth).
 * الجلسة تُدار بكوكي HttpOnly من الخادم؛ ولا يُخزّن أي رمز في المتصفح بعد الدخول.
 */
export async function googleSignIn(): Promise<void> {
  const boot = await api.get<StoreBootstrap>("/api/store");
  if (!boot.googleAuthEnabled || !boot.firebaseConfig?.apiKey) {
    throw new Error("google_not_enabled");
  }

  const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(boot.firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  await api.post("/api/auth/session", { idToken });
  await auth.signOut();
}
