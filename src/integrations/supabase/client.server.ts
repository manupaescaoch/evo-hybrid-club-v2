import { firestoreAdmin, firebaseAdminStorage } from "@/integrations/firebase/admin.server";

type Filter = { field: string; op: string; value: unknown };
type Order = { field: string; ascending: boolean };
type Operation = "select" | "insert" | "update" | "delete" | "upsert";
type Result<T = any> = { data: T | null; error: { message: string } | null; count?: number | null };

const RELATIONS: Record<string, Array<{ nested: string; childTable: string; fk: string }>> = {
  corrida_sessoes: [{ nested: "corrida_sessao_blocos", childTable: "corrida_sessao_blocos", fk: "sessao_id" }],
};

function nowIso() { return new Date().toISOString(); }
function cmp(a: unknown, b: unknown) {
  const an = typeof a === "number" ? a : Number(a);
  const bn = typeof b === "number" ? b : Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
function match(row: any, f: Filter) {
  const v = row?.[f.field];
  switch (f.op) {
    case "eq": return v === f.value;
    case "neq": return v !== f.value;
    case "in": return Array.isArray(f.value) && f.value.includes(v);
    case "gte": return cmp(v, f.value) >= 0;
    case "lte": return cmp(v, f.value) <= 0;
    case "gt": return cmp(v, f.value) > 0;
    case "lt": return cmp(v, f.value) < 0;
    case "is": return f.value === null ? v == null : v === f.value;
    case "not": return f.value === null ? v != null : v !== f.value;
    case "ilike": return String(v ?? "").toLowerCase().includes(String(f.value ?? "").replace(/%/g, "").toLowerCase());
    case "like": return String(v ?? "").includes(String(f.value ?? "").replace(/%/g, ""));
    case "contains": return Array.isArray(v) && Array.isArray(f.value) && f.value.every((x) => v.includes(x));
    default: return true;
  }
}
function pick(row: any, expr: string | null) {
  if (!expr || expr.trim() === "*" || expr.includes("(")) return row;
  const out: any = {};
  for (const key of expr.split(",").map((x) => x.trim()).filter(Boolean)) if (key in row) out[key] = row[key];
  return out;
}
async function all(table: string) {
  const snap = await firestoreAdmin.collection(table).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function attachRelations(table: string, rows: any[], expr: string | null) {
  let out = rows;
  for (const rel of RELATIONS[table] ?? []) {
    if (!expr?.includes(`${rel.nested}(`)) continue;
    const children = await all(rel.childTable);
    out = out.map((row) => ({ ...row, [rel.nested]: children.filter((c: any) => c[rel.fk] === row.id) }));
  }
  return out;
}

class AdminQueryBuilder {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit: number | null = null;
  private expr: string | null = "*";
  private op: Operation = "select";
  private payload: any = null;
  private returnSelection = false;
  constructor(private table: string) {}

  select(expr = "*", options?: { count?: "exact"; head?: boolean }) { this.expr = expr; if (this.op !== "select") this.returnSelection = true; if (options?.head) this.rowLimit = 0; return this; }
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
  order(field: string, options?: { ascending?: boolean }) { this.orders.push({ field, ascending: options?.ascending !== false }); return this; }
  limit(n: number) { this.rowLimit = n; return this; }

  private async rows() {
    let rows = (await all(this.table)).filter((r) => this.filters.every((f) => match(r, f)));
    for (const o of [...this.orders].reverse()) rows.sort((a, b) => (o.ascending ? 1 : -1) * cmp(a[o.field], b[o.field]));
    if (this.rowLimit != null && this.rowLimit > 0) rows = rows.slice(0, this.rowLimit);
    return attachRelations(this.table, rows, this.expr);
  }

  private async execute(): Promise<Result> {
    try {
      if (this.op === "select") {
        const rows = (await this.rows()).map((r) => pick(r, this.expr));
        return { data: rows, error: null, count: rows.length };
      }

      if (this.op === "insert" || this.op === "upsert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved: any[] = [];
        for (const item of items) {
          const id = item?.id || firestoreAdmin.collection(this.table).doc().id;
          const data = { ...(item ?? {}) };
          delete data.id;
          if (!("criado_em" in data)) data.criado_em = nowIso();
          if (!("atualizado_em" in data)) data.atualizado_em = nowIso();
          await firestoreAdmin.collection(this.table).doc(id).set(data, { merge: this.op === "upsert" });
          saved.push({ id, ...data });
        }
        return { data: this.returnSelection ? saved.map((r) => pick(r, this.expr)) : null, error: null };
      }

      const targets = await this.rows();
      if (this.op === "update") {
        const patch = { ...(this.payload ?? {}), atualizado_em: nowIso() };
        await Promise.all(targets.map((r) => firestoreAdmin.collection(this.table).doc(r.id).update(patch)));
        const updated = targets.map((r) => ({ ...r, ...patch }));
        return { data: this.returnSelection ? updated.map((r) => pick(r, this.expr)) : null, error: null };
      }
      if (this.op === "delete") {
        await Promise.all(targets.map((r) => firestoreAdmin.collection(this.table).doc(r.id).delete()));
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
    return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `Expected single row, got ${rows.length}` } };
  }
  async maybeSingle(): Promise<Result<any>> {
    const r = await this.execute();
    if (r.error) return r;
    const rows = Array.isArray(r.data) ? r.data : [];
    return rows.length <= 1 ? { data: rows[0] ?? null, error: null } : { data: null, error: { message: `Expected at most one row, got ${rows.length}` } };
  }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const storageCompat = {
  from(bucketName: string) {
    const bucket = firebaseAdminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
    return {
      async upload(path: string, body: Buffer | Uint8Array | string, options?: any) {
        try {
          const file = bucket.file(`${bucketName}/${path}`);
          const buffer = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
          await file.save(buffer, { contentType: options?.contentType, resumable: false });
          return { data: { path }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
      async remove(paths: string[]) {
        try {
          await Promise.all(paths.map((p) => bucket.file(`${bucketName}/${p}`).delete({ ignoreNotFound: true })));
          return { data: paths, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`${bucketName}/${path}`)}?alt=media` } };
      },
      async createSignedUrl(path: string, expiresInSeconds = 3600) {
        try {
          const [signedUrl] = await bucket.file(`${bucketName}/${path}`).getSignedUrl({ action: "read", expires: Date.now() + expiresInSeconds * 1000 });
          return { data: { signedUrl }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
    };
  },
};

export const supabaseAdmin = {
  from(table: string) { return new AdminQueryBuilder(table); },
  storage: storageCompat,
  async rpc(name: string) {
    return { data: null, error: { message: `RPC ${name} is not available after Firebase migration; replace with application logic.` } };
  },
};
