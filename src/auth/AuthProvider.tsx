
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
  getIdTokenResult,
  onIdTokenChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth, isAllowedEmail } from "../lib/firebase";

const ACCESS_RESTRICTED_MESSAGE =
  "Access restricted. Please login using your official domain email.";

export type AppRole = "admin" | "user";

type AuthContextType = {
  user: User | null;
  role: AppRole;
  loading: boolean;
  error: string | null;
  loginWithGoogleWeb: () => Promise<void>;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshRole: () => Promise<AppRole>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function roleFromClaims(claims: Record<string, unknown>): AppRole {
  return claims.admin === true ? "admin" : "user";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRole = useCallback(async (): Promise<AppRole> => {
    const currentUser = auth.currentUser;

    if (
      !currentUser ||
      !isAllowedEmail(currentUser.email) ||
      !currentUser.emailVerified
    ) {
      setRole("user");
      return "user";
    }

    try {
      const tokenResult = await getIdTokenResult(currentUser, true);
      const nextRole = roleFromClaims(tokenResult.claims);

      // Do not apply a result belonging to a different session.
      if (auth.currentUser?.uid === currentUser.uid) {
        setRole(nextRole);
      }

      return nextRole;
    } catch {
      // A claim-refresh failure must never grant admin access.
      if (auth.currentUser?.uid === currentUser.uid) {
        setRole("user");
      }

      return "user";
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (signIn: () => Promise<UserCredential>) => {
      setError(null);

      try {
        const result = await signIn();
        const signedInUser = result.user;

        if (
          !isAllowedEmail(signedInUser.email) ||
          !signedInUser.emailVerified
        ) {
          setUser(null);
          setRole("user");

          try {
            await signOut(auth);
          } catch {
            // The rejected account remains blocked in application state.
          }

          throw new Error(ACCESS_RESTRICTED_MESSAGE);
        }

        setUser(signedInUser);
        await refreshRole();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Google sign-in failed. Please try again.";

        setError(message);
        throw err;
      }
    },
    [refreshRole]
  );

  useEffect(() => {
    let eventVersion = 0;
    let mounted = true;

    const unsubscribe = onIdTokenChanged(
      auth,
      async (firebaseUser) => {
        const currentVersion = ++eventVersion;

        if (!mounted) return;

        if (!firebaseUser) {
          setUser(null);
          setRole("user");
          setLoading(false);
          return;
        }

        if (
          !isAllowedEmail(firebaseUser.email) ||
          !firebaseUser.emailVerified
        ) {
          setUser(null);
          setRole("user");
          setError(ACCESS_RESTRICTED_MESSAGE);

          try {
            await signOut(auth);
          } catch {
            // Never grant application access to a rejected account.
          }

          if (mounted && currentVersion === eventVersion) {
            setLoading(false);
          }

          return;
        }

        try {
          const tokenResult = await getIdTokenResult(firebaseUser);
          const nextRole = roleFromClaims(tokenResult.claims);

          if (
            mounted &&
            currentVersion === eventVersion &&
            auth.currentUser?.uid === firebaseUser.uid
          ) {
            setUser(firebaseUser);
            setRole(nextRole);
            setError(null);
            setLoading(false);
          }
        } catch {
          if (
            mounted &&
            currentVersion === eventVersion &&
            auth.currentUser?.uid === firebaseUser.uid
          ) {
            setUser(firebaseUser);
            setRole("user");
            setError(
              "Unable to verify your access role. Admin access is disabled."
            );
            setLoading(false);
          }
        }
      },
      () => {
        ++eventVersion;

        if (!mounted) return;

        setUser(null);
        setRole("user");
        setError("Unable to check your sign-in status. Please try again.");
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      ++eventVersion;
      unsubscribe();
    };
  }, []);

  const loginWithGoogleWeb = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    await signInWithGoogle(() => signInWithPopup(auth, provider));
  }, [signInWithGoogle]);

  const loginWithGoogleToken = useCallback(
    async (idToken: string) => {
      await signInWithGoogle(async () => {
        if (!idToken) {
          throw new Error("Google did not return an ID token.");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        return signInWithCredential(auth, credential);
      });
    },
    [signInWithGoogle]
  );

  const logout = useCallback(async () => {
    setError(null);
    setUser(null);
    setRole("user");

    try {
      await signOut(auth);
    } catch {
      setError("Logout failed. Please try again.");
      throw new Error("Logout failed. Please try again.");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      error,
      loginWithGoogleWeb,
      loginWithGoogleToken,
      logout,
      clearError,
      refreshRole,
    }),
    [
      user,
      role,
      loading,
      error,
      loginWithGoogleWeb,
      loginWithGoogleToken,
      logout,
      clearError,
      refreshRole,
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
