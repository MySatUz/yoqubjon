// Applies a manual migration file statement by statement, each in its own
// implicit transaction — which is what CREATE/DROP INDEX CONCURRENTLY needs.
// Written because the project has no psql, but does have the `postgres` driver.
//
//   node --env-file=.env prisma/manual-migrations/apply.mjs <file.sql> --dry-run
//   node --env-file=.env prisma/manual-migrations/apply.mjs <file.sql>
//
// Reads DATABASE_URL from the environment (--env-file loads .env for you).

import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: node --env-file=.env prisma/manual-migrations/apply.mjs <file.sql> [--dry-run]');
  process.exit(1);
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('DATABASE_URL is not set. Run with: node --env-file=.env ...');
  process.exit(1);
}

// Prisma reads pool settings straight out of the URL, but they are not Postgres
// GUCs. The raw driver forwards unknown query params as startup options, and the
// server answers with FATAL 42704, so they have to come off first.
const PRISMA_ONLY_PARAMS = ['connection_limit', 'pool_timeout', 'pgbouncer', 'socket_timeout', 'schema'];

function stripPrismaParams(value) {
  const parsed = new URL(value);
  const removed = PRISMA_ONLY_PARAMS.filter((p) => parsed.searchParams.has(p));
  for (const p of removed) parsed.searchParams.delete(p);
  if (removed.length > 0) console.log(`Ignoring Prisma-only URL params: ${removed.join(', ')}\n`);
  return parsed.toString();
}

const url = stripPrismaParams(rawUrl);

// Statement splitting: block comments, then line comments, then `;`.
// The rejected-index SQL in this file is commented out, so stripping comments
// is what keeps it from running.
function readStatements(path) {
  // CRLF must go first. `.` does not match `\r` in JavaScript, so on a
  // Windows-checkout file `--.*$` matches nothing and every comment survives
  // into the statement list — including the rejected DDL kept commented out
  // below. Silent, and dangerous on a production database.
  const raw = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  return withoutComments
    .split(';')
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

const statements = readStatements(file);

console.log(`${file}\n${statements.length} statement(s)${dryRun ? ' — DRY RUN, nothing will be executed' : ''}\n`);
statements.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

if (dryRun) {
  console.log('\nDry run complete. Re-run without --dry-run to apply.');
  process.exit(0);
}

// max: 1 keeps every statement on the same session; prepare: false avoids the
// extended protocol, which CONCURRENTLY does not accept.
const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, onnotice: () => {} });

let failed = 0;

for (const [index, statement] of statements.entries()) {
  const label = `${index + 1}/${statements.length}`;
  const started = Date.now();
  try {
    await sql.unsafe(statement);
    console.log(`\n[${label}] OK (${Date.now() - started} ms)  ${statement.slice(0, 70)}...`);
  } catch (error) {
    failed++;
    console.error(`\n[${label}] FAILED  ${statement.slice(0, 70)}...`);
    console.error(`        ${error.message}`);
    break;
  }
}

// CREATE INDEX CONCURRENTLY leaves an INVALID index behind when it fails: it
// still costs writes but is never used for reads, so it must not go unnoticed.
const invalid = await sql`
  SELECT c.relname AS name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE NOT i.indisvalid
`;

if (invalid.length > 0) {
  console.error('\nINVALID indexes present — drop each with DROP INDEX CONCURRENTLY:');
  for (const row of invalid) console.error(`  - ${row.name}`);
} else {
  console.log('\nNo invalid indexes.');
}

await sql.end();
process.exit(failed > 0 ? 1 : 0);
