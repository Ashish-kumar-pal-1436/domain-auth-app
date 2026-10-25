
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth, isAllowedEmail } from "../lib/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginWithGoogleWeb: () => Promise<void>;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = useCallback(
    async (signIn: () => Promise<UserCredential>) => {
      setError(null);

      try {
        const { user: signedInUser } = await signIn();

        if (!isAllowedEmail(signedInUser.email) || !signedInUser.emailVerified) {
          await signOut(auth);
          throw new Error(
            "Access restricted. Please login using your official domain email."
          );
        }

        setUser(signedInUser);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Google sign-in failed. Please try again.";

        setError(message);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            setUser(null);
            return;
          }

          if (!isAllowedEmail(firebaseUser.email)) {
            await signOut(auth);
            setUser(null);
            setError("Access restricted. Please login using your official domain email.");
            return;
          }

          if (!firebaseUser.emailVerified) {
            await signOut(auth);
            setUser(null);
            setError("Please use a verified Google account.");
            return;
          }

          setUser(firebaseUser);
        } catch {
          setUser(null);
          setError("We couldn't verify your account. Please sign in again.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setUser(null);
        setError("Unable to check your sign-in status. Please try again.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const loginWithGoogleWeb = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    await signInWithGoogle(() => signInWithPopup(auth, provider));
  }, [signInWithGoogle]);

  const loginWithGoogleToken = useCallback(async (idToken: string) => {
    await signInWithGoogle(async () => {
      if (!idToken) {
        throw new Error("Google did not return an ID token.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, credential);
    });
  }, [signInWithGoogle]);

  const logout = useCallback(async () => {
    setError(null);

    try {
      await signOut(auth);
      setUser(null);
    } catch {
      setError("Logout failed. Please try again.");
      throw new Error("Logout failed. Please try again.");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      loginWithGoogleWeb,
      loginWithGoogleToken,
      logout,
      clearError,
    }),
    [
      user,
      loading,
      error,
      loginWithGoogleWeb,
      loginWithGoogleToken,
      logout,
      clearError,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
