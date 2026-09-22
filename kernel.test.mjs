import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';
// IsolationGate suite — all six original tests, all original assertions, none
// deleted or weakened. The prior run's failure was not a failing assertion:
// a prose paragraph from the verify note had been pasted into this file after
// the last test, so Node hit `SyntaxError: Unexpected identifier 'honest'` at
// compile time and reported the whole module as 1 failed test with 0 run.
//
// Verify note, preserved here AS A COMMENT (it is true and worth keeping):
// the first intersection case tried ({c,x,y} vs prior {a,b,c}) was refused by
// the *difference* check before the intersection check ever ran — the checks
// shadow each other in strict order. The shipped intersection test uses a
// prior set large enough (6 members) that both differences are >= k and only
// the intersection {a} isolates, so each refusal path is genuinely its own.
// SumVeil class: the refusal you think fired isn't always the one that did —
// hence self-naming refusals and text pinned verbatim below.
//
// GATE ROUND 2026-09-09 — four tests added to kill 8 survivors; every kill is
// a sharper assertion, never a softer kernel:
//   · line 15 (string '>= 2'→'> 2'): the old suite compared why to K.REFUSAL.*,
//     so a mutated constant equalled itself. Now every refusal string is pinned
//     to its LITERAL text — the constant can no longer vouch for itself.
//   · lines 28+45 (k>=2 / k<2 boundary flips): k=2 was never exercised as
//     legal. Now init(2) must open AND a 2-party quorum must pass through it.
//   · line 31 (&&→|| ×2, >→>=): corrupt released history — [''], [7,'a'],
//     and a non-array entry — must each be BAD_STATE, not re-read by algebra.
//   · line 36 (&&→||, >→>=): an empty-string contributor must be BAD_SET,
//     never silently smuggled into the sorted set.

const open = () => K.init(3).state;

test('init: bad k refused with pinned text, good k opens an empty gate', () => {
  assert.equal(K.init(1).ok, false);
  assert.equal(K.init(1).why, K.REFUSAL.BAD_K);
  const g = K.init(3);
  assert.equal(g.ok, true);
  assert.equal(g.state.k, 3);
  assert.equal(g.state.released.length, 0);
});

test('k=2 boundary is LEGAL: init(2) opens and a 2-party quorum releases', () => {
  // kills init `k < 2`→`k <= 2` (init(2) must succeed) and isState
  // `s.k >= 2`→`s.k > 2` (a k=2 state must be a valid state, not BAD_STATE)
  const g = K.init(2);
  assert.equal(g.ok, true);
  assert.equal(g.state.k, 2);
  const r = K.propose(g.state, ['a', 'b']);
  assert.equal(r.ok, true);
  assert.equal(r.releases, 1);
  assert.equal(r.size, 2);
});

test('quorum-below-k: 2 contributors under k=3 refused, size and k pinned', () => {
  const r = K.propose(open(), ['a', 'b']);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'refused:quorum-below-k');
  assert.equal(r.size, 2);
  assert.equal(r.k, 3);
});

test('differencing attack: {a,b,c,d} after {a,b,c} would isolate d — refused', () => {
  const s1 = K.propose(open(), ['a', 'b', 'c']).state;
  const r = K.propose(s1, ['a', 'b', 'c', 'd']);
  assert.equal(r.ok, false);
  assert.equal(r.why, K.REFUSAL.DIFFERENCE);
  assert.equal(r.against, 0);
  assert.equal(r.size, 1);
});

test('intersection-below-k: overlap of exactly 1 with a prior release refused', () => {
  // both differences are >= k (3 and 5), so only the intersection {a} isolates
  const s1 = K.propose(open(), ['a', 'b', 'c', 'd', 'e', 'f']).state;
  const r = K.propose(s1, ['a', 'x', 'y', 'z']);
  assert.equal(r.ok, false);
  assert.equal(r.why, K.REFUSAL.INTERSECTION);
  assert.equal(r.against, 0);
  assert.equal(r.size, 1);
});

test('legal history compounds; a refusal carries no new state, old state untouched', () => {
  const s1 = K.propose(open(), ['a', 'b', 'c']).state;
  const ok2 = K.propose(s1, ['d', 'e', 'f']); // disjoint, all algebra >= k or 0
  assert.equal(ok2.ok, true);
  assert.equal(ok2.releases, 2);
  const bad = K.propose(ok2.state, ['a', 'b', 'c', 'z']); // z would be isolated
  assert.equal(bad.ok, false);
  assert.equal('state' in bad, false);
  assert.equal(ok2.state.released.length, 2);
  assert.equal(K.releasedCount(ok2.state).count, 2);
});

test('empty-string contributor is BAD_SET, never smuggled into the sorted set', () => {
  // kills toSet `c.length > 0`→`>= 0` and `&&`→`||`: with either mutant the
  // '' rides through, quorum passes (4 >= 3) and the propose WRONGLY succeeds
  const r = K.propose(open(), ['a', 'b', '', 'd']);
  assert.equal(r.ok, false);
  assert.equal(r.why, K.REFUSAL.BAD_SET);
});

test('corrupt released history is BAD_STATE, never re-interpreted by the algebra', () => {
  // each corrupt state is built so a mutant that ACCEPTS it reaches a
  // different refusal (or success) — the why must be BAD_STATE exactly
  const withEmpty = K.propose({ k: 2, released: [['']] }, ['a', 'b']);
  assert.equal(withEmpty.ok, false);
  assert.equal(withEmpty.why, K.REFUSAL.BAD_STATE); // kills length>0→>=0 and inner &&→||
  const withNumber = K.propose({ k: 2, released: [[7, 'a']] }, ['b', 'c']);
  assert.equal(withNumber.ok, false);
  assert.equal(withNumber.why, K.REFUSAL.BAD_STATE); // kills outer &&→|| (isArray short-circuit)
  const notArray = K.propose({ k: 2, released: ['ab'] }, ['b', 'c']);
  assert.equal(notArray.ok, false);
  assert.equal(notArray.why, K.REFUSAL.BAD_STATE);
});

test('total on garbage: nothing throws, EVERY refusal text pinned to its literal', () => {
  assert.equal(K.propose(null, ['a', 'b', 'c']).why, K.REFUSAL.BAD_STATE);
  assert.equal(K.propose(open(), 'abc').why, K.REFUSAL.BAD_SET);
  assert.equal(K.propose(open(), []).why, K.REFUSAL.BAD_SET);
  assert.equal(K.propose(open(), ['a', 7, 'c']).why, K.REFUSAL.BAD_SET);
  // pinned VERBATIM — comparing why to K.REFUSAL.* lets a mutated string vouch
  // for itself; the literal text below is the contract
  assert.equal(K.REFUSAL.BAD_K, 'refused:bad-k (k must be an integer >= 2)');
  assert.equal(K.REFUSAL.BAD_STATE, 'refused:bad-state (not an IsolationGate state)');
  assert.equal(
    K.REFUSAL.BAD_SET,
    'refused:bad-contributor-set (need a non-empty array of non-empty strings)'
  );
  assert.equal(K.REFUSAL.QUORUM, 'refused:quorum-below-k');
  assert.equal(K.REFUSAL.DIFFERENCE, 'refused:difference-isolates (new \\ prior below k)');
  assert.equal(
    K.REFUSAL.REVERSE_DIFFERENCE,
    'refused:difference-isolates (prior \\ new below k)'
  );
  assert.equal(K.REFUSAL.INTERSECTION, 'refused:intersection-below-k');
});
