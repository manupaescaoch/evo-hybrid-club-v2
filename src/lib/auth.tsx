import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, setDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/integrations/firebase/client";

export type Perfil = "admin" | "equipe" | "visualizador";

export interface CrmUser {
  id: string;
  nome: string | null;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
}

export type FirebaseSession = {
  access_token: string;
  user: User;
};

interface AuthCtx {
  loading: boolean;
  session: FirebaseSession | null;
  user: User | null;
  crmUser: CrmUser | null;
  isAdmin: boolean;
  isEquipe: boolean;
  canEdit: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function buildSession(user: User | null): Promise<FirebaseSession | null> {
  if (!user) return null;
  return { access_token: await user.getIdToken(), user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<FirebaseSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [crmUser, setCrmUser] = useState<CrmUser | null>(null);

  const loadCrmUser = async (uid: string | undefined) => {
    if (!uid) {
      setCrmUser(null);
      return;
    }
    const snap = await getDoc(doc(firestore, "usuarios_crm", uid));
    setCrmUser(snap.exists() ? ({ id: snap.id, ...snap.data() } as CrmUser) : null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setSession(await buildSession(nextUser));
      await loadCrmUser(nextUser?.uid);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __serverFnFetchPatched?: boolean };
    if (w.__serverFnFetchPatched) return;
    w.__serverFnFetchPatched = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (url.includes("/_serverFn/")) {
          const current = firebaseAuth.currentUser;
          const token = current ? await current.getIdToken() : null;
          if (token) {
            const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
            if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // fallback para fetch original
      }
      return originalFetch(input, init);
    };
  }, []);

  const value: AuthCtx = {
    loading,
    session,
    user,
    crmUser,
    isAdmin: crmUser?.perfil === "admin",
    isEquipe: crmUser?.perfil === "equipe",
    canEdit: crmUser?.perfil === "admin" || crmUser?.perfil === "equipe",
    signIn: async (email, password) => {
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Falha ao entrar" };
      }
    },
    signUp: async (email, password, nome) => {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (nome.trim()) await updateProfile(cred.user, { displayName: nome.trim() });

        const existing = await getDocs(query(collection(firestore, "usuarios_crm"), limit(1)));
        const perfil: Perfil = existing.empty ? "admin" : "visualizador";
        await setDoc(doc(firestore, "usuarios_crm", cred.user.uid), {
          nome: nome.trim() || null,
          email: cred.user.email,
          perfil,
          ativo: true,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        });

        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Falha ao criar conta" };
      }
    },
    signOut: async () => {
      await firebaseSignOut(firebaseAuth);
    },
    refresh: async () => {
      await loadCrmUser(firebaseAuth.currentUser?.uid);
      setSession(await buildSession(firebaseAuth.currentUser));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
