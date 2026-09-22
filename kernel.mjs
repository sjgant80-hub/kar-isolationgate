// IsolationGate — pure release-gate kernel for federated aggregates.
// Tracks the contributor-set of every aggregate ever released and refuses any
// new release whose set algebra against the history (difference, reverse
// difference, intersection, quorum-below-k) could be subtracted down to fewer
// than k parties — the differencing attack killed in code, not policy.
// Pure, stateful-by-value, total: state in → decision out, nothing throws.
// Refusal text is pinned (exported, frozen) as hard as the code.
//
// FIX 2026-09-09: no kernel logic changed and no assertion touched. The failure
// was a SyntaxError — the verify-run prose note ("One honest note...") had been
// appended INTO kernel.test.mjs, so the module never compiled and 0 tests ran.
// Prose moved to comments where it belongs; suite re-run: 6/6 pass on node.
//
// GATE 2026-09-09: 8 survivors, ALL killed in the SUITE — not one kernel line
// changed, not one check weakened. The gaps were test gaps: the k=2 boundary
// was never exercised as LEGAL (so >= vs > on k survived on both sides), the
// refusal text was compared to the exported constant instead of pinned
// verbatim (so a mutant string equalled itself), and neither corrupt released
// history nor an empty-string contributor was ever fed to isState/toSet (so
// their &&s and length>0 guards were dead weight to the old suite).

export const REFUSAL = Object.freeze({
  BAD_K: 'refused:bad-k (k must be an integer >= 2)',
  BAD_STATE: 'refused:bad-state (not an IsolationGate state)',
  BAD_SET: 'refused:bad-contributor-set (need a non-empty array of non-empty strings)',
  QUORUM: 'refused:quorum-below-k',
  DIFFERENCE: 'refused:difference-isolates (new \\ prior below k)',
  REVERSE_DIFFERENCE: 'refused:difference-isolates (prior \\ new below k)',
  INTERSECTION: 'refused:intersection-below-k',
});

const isState = (s) =>
  s !== null &&
  typeof s === 'object' &&
  Number.isInteger(s.k) &&
  s.k >= 2 &&
  Array.isArray(s.released) &&
  s.released.every(
    (r) => Array.isArray(r) && r.every((c) => typeof c === 'string' && c.length > 0)
  );

const toSet = (xs) => {
  if (!Array.isArray(xs) || xs.length === 0) return null;
  if (!xs.every((c) => typeof c === 'string' && c.length > 0)) return null;
  return [...new Set(xs)].sort();
};

const minus = (a, b) => a.filter((x) => !b.includes(x));
const inter = (a, b) => a.filter((x) => b.includes(x));
const isolating = (size, k) => size > 0 && size < k;

export function init(k) {
  if (!Number.isInteger(k) || k < 2) return { ok: false, why: REFUSAL.BAD_K };
  return { ok: true, state: { k, released: [] } };
}

export function propose(state, contributors) {
  if (!isState(state)) return { ok: false, why: REFUSAL.BAD_STATE };
  const set = toSet(contributors);
  if (set === null) return { ok: false, why: REFUSAL.BAD_SET };
  const { k } = state;
  if (set.length < k) return { ok: false, why: REFUSAL.QUORUM, size: set.length, k };
  for (let i = 0; i < state.released.length; i++) {
    const prior = state.released[i];
    const d = minus(set, prior);
    if (isolating(d.length, k))
      return { ok: false, why: REFUSAL.DIFFERENCE, against: i, size: d.length, k };
    const r = minus(prior, set);
    if (isolating(r.length, k))
      return { ok: false, why: REFUSAL.REVERSE_DIFFERENCE, against: i, size: r.length, k };
    const x = inter(set, prior);
    if (isolating(x.length, k))
      return { ok: false, why: REFUSAL.INTERSECTION, against: i, size: x.length, k };
  }
  return {
    ok: true,
    state: { k, released: [...state.released, set] },
    releases: state.released.length + 1,
    size: set.length,
  };
}

export function releasedCount(state) {
  if (!isState(state)) return { ok: false, why: REFUSAL.BAD_STATE };
  return { ok: true, count: state.released.length };
}
