// Holds the live page honest: the kernel inlined in index.html is byte-for-byte the gated kernel.mjs.
// The logic running under a visitor's clicks is the logic the mutation gate proves. If they ever drift, CI fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('index.html inlines kernel.mjs byte-for-byte (minus the export keywords)', () => {
  const kernel = readFileSync(new URL('./kernel.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = kernel.indexOf('export const REFUSAL');
  assert.ok(start >= 0, 'found the kernel start marker');
  const body = kernel.slice(start).replace(/\bexport /g, '').trimEnd();
  assert.ok(body.length > 1500, 'kernel body extracted');
  assert.ok(page.includes(body), 'the exact kernel.mjs source (minus export) must appear verbatim in index.html');
});

test('the inlined kernel still catches the differencing attack (a live smoke test)', async () => {
  const K = await import('./kernel.mjs');
  let { state } = K.init(3);
  const a = K.propose(state, ['alice', 'bob', 'carol', 'dave', 'erin']);
  assert.equal(a.ok, true);
  state = a.state;
  // the same five plus one more → the difference {frank} is size 1 < k → refused
  const b = K.propose(state, ['alice', 'bob', 'carol', 'dave', 'erin', 'frank']);
  assert.equal(b.ok, false);
  assert.equal(b.why, K.REFUSAL.DIFFERENCE);
  assert.equal(b.size, 1);
  // a disjoint cohort of 5 → safe
  const c = K.propose(state, ['frank', 'grace', 'heidi', 'ivan', 'judy']);
  assert.equal(c.ok, true);
});
