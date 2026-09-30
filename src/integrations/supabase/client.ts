import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { firebaseAuth, firebaseStorage, firestore } from "@/integrations/firebase/client";

type Filter = { field: string; op: string; value: unknown };
type Order = { field: string; ascending: boolean };
type Operation = "select" | "insert" | "update" | "delete" | "upsert";

type Result<T = any> = { data: T | null; error: { message: string } | null; count?: number | null };

const RELATIONS: Record<string, Array<{ nested: string; childTable: string; fk: string }>> = {
  corrida_sessoes: [{ nested: "corrida_sessao_blocos", childTable: "corrida_sessao_blocos", fk: "sessao_id" }],
};

function nowIso() {
  return new Date().toISOString();
}

function isIsoDateLike(v: unknown) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function cmp(a: unknown, b: unknown) {
  if (isIsoDateLike(a) && isIsoDateLike(b)) return String(a).localeCompare(String(b));
  const an = typeof a === "number" ? a : Number(a);
  const bn = typeof b === "number" ? b : Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function matchFilter(row: any, f: Filter) {
  const value = row?.[f.field];
  switch (f.op) {
    case "eq": return value === f.value;
    case "neq": return value !== f.value;
    case "in": return Array.isArray(f.value) && f.value.includes(value);
    case "gte": return cmp(value, f.value) >= 0;
    case "lte": return cmp(value, f.value) <= 0;
    case "gt": return cmp(value, f.value) > 0;
    case "lt": return cmp(value, f.value) < 0;
    case "is": return f.value === null ? value == null : value === f.value;
    case "not":
      if (f.value === null) return value != null;
      return value !== f.value;
    case "ilike": {
      const pattern = String(f.value ?? "").replace(/%/g, "").toLowerCase();
      return String(value ?? "").toLowerCase().includes(pattern);
    }
    case "like": {
      const pattern = String(f.value ?? "").replace(/%/g, "");
      return String(value ?? "").includes(pattern);
    }
    case "contains":
      if (Array.isArray(value) && Array.isArray(f.value)) return f.value.every((x) => value.includes(x));
      return false;
    default: return true;
  }
}

function pickFields(row: any, selectExpr: string | null) {
  if (!selectExpr || selectExpr.trim() === "*" || selectExpr.includes("(")) return row;
  const fields = selectExpr.split(",").map((x) => x.trim()).filter(Boolean);
  const out: any = {};
  for (const field of fields) {
    if (field in row) out[field] = row[field];
  }
  return out;
}

async function loadCollection(table: string) {
  const snap = await getDocs(collection(firestore, table));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function attachRelations(table: string, rows: any[], selectExpr: string | null) {
  const relations = RELATIONS[table] ?? [];
  if (!selectExpr || relations.length === 0) return rows;
  let out = rows;
  for (const rel of relations) {
    if (!selectExpr.includes(`${rel.nested}(`)) continue;
    const children = await loadCollection(rel.childTable);
    out = out.map((row) => ({
      ...row,
      [rel.nested]: children.filter((c) => c[rel.fk] === row.id),
    }));
  }
  return out;
}

class FirebaseQueryBuilder {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit: number | null = null;
  private selectExpr: string | null = "*";
  private op: Operation = "select";
  private payload: any = null;
  private returnSelection = false;

  constructor(private table: string) {}

  select(expr = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selectExpr = expr;
    if (this.op !== "select") this.returnSelection = true;
    if (options?.head) this.rowLimit = 0;
    return this;
  }

  insert(payload: any) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(payload: any) { this.op = "upsert"; this.payload = payload; return this; }

  eq(field: string, value: unknown) { this.filters.push({ field, op: "eq", value }); return this; }
  neq(field: string, value: unknown) { this.filters.push({ field, op: "neq", value }); return this; }
  in(field: string, value: unknown[]) { this.filters.push({ field, op: "in", value }); return this; }
  gte(field: string, value: unknown) { this.filters.push({ field, op: "gte", value }); return this; }
  lte(field: string, value: unknown) { this.filters.push({ field, op: "lte", value }); return this; }
  gt(field: string, value: unknown) { this.filters.push({ field, op: "gt", value }); return this; }
  lt(field: string, value: unknown) { this.filters.push({ field, op: "lt", value }); return this; }
  is(field: string, value: unknown) { this.filters.push({ field, op: "is", value }); return this; }
  not(field: string, _operator: string, value: unknown) { this.filters.push({ field, op: "not", value }); return this; }
  ilike(field: string, value: unknown) { this.filters.push({ field, op: "ilike", value }); return this; }
  like(field: string, value: unknown) { this.filters.push({ field, op: "like", value }); return this; }
  contains(field: string, value: unknown) { this.filters.push({ field, op: "contains", value }); return this; }

  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) { this.rowLimit = value; return this; }

  private async filteredRows() {
    let rows = await loadCollection(this.table);
    rows = rows.filter((row) => this.filters.every((f) => matchFilter(row, f)));
    for (const order of [...this.orders].reverse()) {
      rows.sort((a, b) => (order.ascending ? 1 : -1) * cmp(a?.[order.field], b?.[order.field]));
    }
    if (this.rowLimit != null && this.rowLimit > 0) rows = rows.slice(0, this.rowLimit);
    rows = await attachRelations(this.table, rows, this.selectExpr);
    return rows;
  }

  private normalizePayload(row: any) {
    const id = row?.id || crypto.randomUUID();
    const payload = { ...row };
    delete payload.id;
    if (!("criado_em" in payload)) payload.criado_em = nowIso();
    if (!("atualizado_em" in payload)) payload.atualizado_em = nowIso();
    return { id, payload };
  }

  private async execute(): Promise<Result> {
    try {
      if (this.op === "select") {
        const rows = (await this.filteredRows()).map((r) => pickFields(r, this.selectExpr));
        return { data: rows, error: null, count: rows.length };
      }

      if (this.op === "insert" || this.op === "upsert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved: any[] = [];
        for (const item of items) {
          const { id, payload } = this.normalizePayload(item ?? {});
          await setDoc(doc(firestore, this.table, id), payload, { merge: this.op === "upsert" });
          saved.push({ id, ...payload });
        }
        const data = this.returnSelection ? saved.map((r) => pickFields(r, this.selectExpr)) : null;
        return { data, error: null };
      }

      const targets = await this.filteredRows();
      if (this.op === "update") {
        const patch = { ...(this.payload ?? {}), atualizado_em: nowIso() };
        for (const row of targets) await updateDoc(doc(firestore, this.table, row.id), patch);
        const updated = targets.map((row) => ({ ...row, ...patch }));
        return { data: this.returnSelection ? updated.map((r) => pickFields(r, this.selectExpr)) : null, error: null };
      }

      if (this.op === "delete") {
        for (const row of targets) await deleteDoc(doc(firestore, this.table, row.id));
        return { data: this.returnSelection ? targets : null, error: null };
      }

      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }

  async single(): Promise<Result<any>> {
    const r = await this.execute();
    if (r.error) return r;
    const rows = Array.isArray(r.data) ? r.data : [];
    if (rows.length !== 1) return { data: null, error: { message: `Expected single row, got ${rows.length}` } };
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<Result<any>> {
    const r = await this.execute();
    if (r.error) return r;
    const rows = Array.isArray(r.data) ? r.data : [];
    if (rows.length > 1) return { data: null, error: { message: `Expected at most one row, got ${rows.length}` } };
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class RealtimeChannel {
  private unsubscribe: (() => void) | null = null;
  private table: string | null = null;
  private filter: string | undefined;
  private callback: ((payload: any) => void) | null = null;

  on(_event: string, config: any, callback: (payload: any) => void) {
    this.table = config?.table ?? null;
    this.filter = config?.filter;
    this.callback = callback;
    return this;
  }

  subscribe() {
    if (!this.table || !this.callback) return this;
    const cb = this.callback;
    const [field, raw] = this.filter?.split("=eq.") ?? [];
    this.unsubscribe = onSnapshot(collection(firestore, this.table), (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const next = { id: change.doc.id, ...change.doc.data() };
        if (field && raw && String((next as any)[field]) !== raw) continue;
        cb({
          eventType: change.type === "added" ? "INSERT" : change.type === "removed" ? "DELETE" : "UPDATE",
          new: next,
          old: null,
        });
      }
    });
    return this;
  }

  close() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const authCompat = {
  onAuthStateChange(callback: (event: string, session: any) => void) {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { access_token: await user.getIdToken(), user: { ...user, id: user.uid } } : null);
    });
    return { data: { subscription: { unsubscribe } } };
  },
  async getSession() {
    const user = firebaseAuth.currentUser;
    return { data: { session: user ? { access_token: await user.getIdToken(), user: { ...user, id: user.uid } } : null }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      return { data: { user: { ...cred.user, id: cred.user.uid } }, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  },
  async signUp({ email, password }: { email: string; password: string; options?: any }) {
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      return { data: { user: { ...cred.user, id: cred.user.uid } }, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  },
  async signOut() {
    try { await signOut(firebaseAuth); return { error: null }; }
    catch (e) { return { error: { message: e instanceof Error ? e.message : String(e) } }; }
  },
};

const storageCompat = {
  from(bucket: string) {
    return {
      async upload(path: string, file: Blob | Uint8Array | ArrayBuffer, options?: { upsert?: boolean; contentType?: string }) {
        try {
          const ref = storageRef(firebaseStorage, `${bucket}/${path}`);
          await uploadBytes(ref, file as any, options?.contentType ? { contentType: options.contentType } : undefined);
          return { data: { path }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
      async remove(paths: string[]) {
        try {
          await Promise.all(paths.map((path) => deleteObject(storageRef(firebaseStorage, `${bucket}/${path}`))));
          return { data: paths, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
      getPublicUrl(path: string) {
        const fullPath = `${bucket}/${path}`;
        return {
          data: {
            publicUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseStorage.app.options.storageBucket}/o/${encodeURIComponent(fullPath)}?alt=media`,
          },
        };
      },
      async createSignedUrl(path: string) {
        try {
          const signedUrl = await getDownloadURL(storageRef(firebaseStorage, `${bucket}/${path}`));
          return { data: { signedUrl }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
    };
  },
};

export const supabase = {
  from(table: string) { return new FirebaseQueryBuilder(table); },
  auth: authCompat,
  storage: storageCompat,
  channel(_name: string) { return new RealtimeChannel(); },
  async removeChannel(channel: RealtimeChannel) { channel.close(); return "ok"; },
};
