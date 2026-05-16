/** Unified-diff strings keyed by PR number, then by file path. */
export const DIFFS: Record<string, Record<string, string>> = {
  "42": {
    "lib/transfers.ts": `--- a/lib/transfers.ts
+++ b/lib/transfers.ts
@@ -38,12 +38,26 @@
 import { db } from '@/db';
 import { events } from '@/queue/notify';
+import { sumToday, DAILY_LIMIT } from '@/lib/limits';
+
+export class LimitExceeded extends Error {
+  constructor(public accountId: string) {
+    super('Daily cap exceeded for ' + accountId);
+  }
+}

 export async function withdraw(accountId: string, amount: number) {
   if (amount <= 0) throw new Error('amount must be positive');
-  const txn = await db.transfers.insert({ accountId, amount });
-  events.emit('withdraw', { accountId, amount });
-  return txn;
+  return db.transaction(async (tx) => {
+    await tx.accounts.lockRow(accountId);
+    const today = await sumToday(tx, accountId);
+    if (today + amount > DAILY_LIMIT) {
+      throw new LimitExceeded(accountId);
+    }
+    const txn = await tx.transfers.insert({ accountId, amount });
+    events.emit('withdraw', { accountId, amount });
+    return txn;
+  });
 }
`,
    "lib/limits.ts": `--- /dev/null
+++ b/lib/limits.ts
@@ -0,0 +1,22 @@
+import type { Transaction } from '@/db';
+
+export const DAILY_LIMIT = 500_000; // cents
+
+export async function sumToday(
+  tx: Transaction,
+  accountId: string,
+): Promise<number> {
+  const start = new Date();
+  start.setHours(0, 0, 0, 0);
+
+  const rows = await tx.transfers
+    .where('accountId', accountId)
+    .where('createdAt', '>=', start)
+    .select('amount');
+
+  return rows.reduce((sum, r) => sum + r.amount, 0);
+}
+
+export function exceededLimit(today: number, amount: number) {
+  return today + amount > DAILY_LIMIT;
+}
`,
    "api/transfers/route.ts": `--- a/api/transfers/route.ts
+++ b/api/transfers/route.ts
@@ -7,15 +7,28 @@
 import { withdraw } from '@/lib/transfers';
+import { LimitExceeded } from '@/lib/transfers';

 export async function POST(req: Request) {
   const body = await req.json();
   const { accountId, amount } = body;

-  try {
-    const txn = await withdraw(accountId, amount);
-    return Response.json({ ok: true, txn });
-  } catch (e) {
-    console.error(e);
-    return new Response('error', { status: 500 });
+  if (typeof accountId !== 'string' || typeof amount !== 'number') {
+    return Response.json({ error: 'invalid request' }, { status: 400 });
+  }
+
+  try {
+    const txn = await withdraw(accountId, amount);
+    return Response.json({ ok: true, txn });
+  } catch (e) {
+    if (e instanceof LimitExceeded) {
+      return Response.json(
+        { error: 'daily withdrawal limit exceeded' },
+        { status: 429 },
+      );
+    }
+    console.error(e);
+    return Response.json({ error: 'internal' }, { status: 500 });
   }
 }
`,
  },
  "41": {
    "middleware.ts": `--- a/middleware.ts
+++ b/middleware.ts
@@ -1,9 +1,28 @@
-import { NextResponse } from 'next/server';
-
-export function middleware(request) {
-  const token = request.headers.get('authorization');
-  if (!token) {
-    return NextResponse.redirect(new URL('/login', request.url));
-  }
-  return NextResponse.next();
-}
+import { NextResponse, type NextRequest } from 'next/server';
+import { getSession } from '@/lib/session';
+
+const PUBLIC_PATHS = ['/login', '/signup', '/health'];
+
+export async function middleware(request: NextRequest) {
+  if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))) {
+    return NextResponse.next();
+  }
+
+  const session = await getSession(request);
+  if (!session) {
+    const url = new URL('/login', request.url);
+    url.searchParams.set('next', request.nextUrl.pathname);
+    return NextResponse.redirect(url);
+  }
+
+  const res = NextResponse.next();
+  res.headers.set('x-account-id', session.accountId);
+  return res;
+}
+
+export const config = {
+  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
+};
`,
    "lib/auth.ts": `--- /dev/null
+++ b/lib/auth.ts
@@ -0,0 +1,19 @@
+import { db } from '@/db';
+
+export type Session = {
+  sid: string;
+  accountId: string;
+  expiresAt: Date;
+};
+
+export async function validateToken(sid: string): Promise<Session | null> {
+  const row = await db.sessions
+    .where('sid', sid)
+    .where('expiresAt', '>', new Date())
+    .first();
+  if (!row) return null;
+  return { sid: row.sid, accountId: row.accountId, expiresAt: row.expiresAt };
+}
`,
    "lib/session.ts": `--- a/lib/session.ts
+++ b/lib/session.ts
@@ -1,15 +1,9 @@
-import { logger } from '@/lib/logger';
+import { validateToken } from '@/lib/auth';
 import type { NextRequest } from 'next/server';

 export async function getSession(req: NextRequest) {
-  const auth = req.headers.get('authorization');
-  const token = auth?.replace(/^Bearer\\s+/, '');
-  if (!token) return null;
-
-  logger.info('request', { headers: req.headers });
-
-  const user = await db.users.where('sessionToken', token).first();
-  return user ?? null;
+  const sid = req.cookies.get('sid')?.value;
+  if (!sid) return null;
+  return validateToken(sid);
 }
`,
    "lib/logger.ts": `--- a/lib/logger.ts
+++ b/lib/logger.ts
@@ -22,12 +22,8 @@
 export function info(message: string, ctx: Record<string, unknown>) {
   const ts = new Date().toISOString();
-  const line = JSON.stringify({
-    ts,
-    message,
-    method: ctx.method,
-    path: ctx.url,
-    headers: ctx.headers,
-  });
+  const safeHeaders = redactAuth(ctx.headers);
+  const line = JSON.stringify({ ts, message, method: ctx.method, path: ctx.url, headers: safeHeaders });
   process.stdout.write(line + '\\n');
 }
@@ -38,4 +34,8 @@
 export function error(message: string, err: unknown) {
   process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), message, err: String(err) }) + '\\n');
 }
+
+function redactAuth(headers: Headers): Record<string, string> {
+  const out: Record<string, string> = {};
+  for (const [k, v] of headers.entries()) out[k] = k.toLowerCase() === 'authorization' ? '<redacted>' : v;
+  return out;
+}
`,
    "api/auth/logout/route.ts": `--- a/api/auth/logout/route.ts
+++ b/api/auth/logout/route.ts
@@ -1,18 +1,16 @@
-import { db } from '@/db';
+import { db } from '@/db';
+import { getSession } from '@/lib/session';

-export async function POST(req: Request) {
-  const cookie = req.headers.get('cookie') ?? '';
-  const match = /token=([^;]+)/.exec(cookie);
-  if (!match) {
-    return new Response('no token', { status: 400 });
-  }
-  const token = match[1];
-  await db.users.where('sessionToken', token).update({ sessionToken: null });
-
-  const res = new Response(null, { status: 204 });
-  res.headers.append('Set-Cookie', 'token=; Path=/; Max-Age=0');
-  return res;
+export async function POST(req: Request) {
+  const session = await getSession(req as never);
+  if (session) {
+    await db.sessions.where('sid', session.sid).delete();
+  }
+  const res = new Response(null, { status: 204 });
+  res.headers.append(
+    'Set-Cookie',
+    'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
+  );
+  return res;
 }
`,
    "db/sessions.ts": `--- a/db/sessions.ts
+++ b/db/sessions.ts
@@ -1,15 +1,10 @@
 import { table } from '@/db/builder';

 export const sessions = table('sessions', {
-  id: 'serial',
-  userId: 'integer',
-  token: 'text',
-  createdAt: 'timestamp',
-  lastSeenAt: 'timestamp',
-  revokedAt: 'timestamp nullable',
-});
-
-// (legacy index removed)
-// CREATE INDEX sessions_token_idx ON sessions (token);
+  sid: 'text primary key',
+  accountId: 'integer not null',
+  expiresAt: 'timestamp not null',
+  createdAt: 'timestamp default now()',
+});
+
+sessions.index('expiresAt');
`,
    "api/auth/login/route.ts": `--- a/api/auth/login/route.ts
+++ b/api/auth/login/route.ts
@@ -8,13 +8,18 @@
   if (!user || !(await verify(password, user.passwordHash))) {
     return new Response('invalid', { status: 401 });
   }

-  const token = randomBytes(32).toString('hex');
-  await db.users.update(user.id, { sessionToken: token });
-
-  const res = Response.json({ ok: true });
-  res.headers.append('Set-Cookie', 'token=' + token + '; Path=/');
+  const session = await db.sessions.insert({
+    accountId: user.id,
+    sid: randomBytes(32).toString('hex'),
+    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
+  });
+
+  const csrf = randomBytes(16).toString('hex');
+  const res = Response.json({ ok: true, csrf });
+  res.headers.append(
+    'Set-Cookie',
+    'sid=' + session.sid + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800',
+  );
   return res;
 }
`,
  },
};
