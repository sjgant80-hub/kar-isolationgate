# IsolationGate

### ▶ Live, self-explaining page: **https://sjgant80-hub.github.io/kar-isolationgate/**

The page explains the differencing attack in plain words, lets you run the gate live (watch it refuse a release that would isolate one person), and carries the blueprint, the buyer brochure, the cost case and an honest white paper. **Open the live page — you do not need to read this repo.**

---

**IsolationGate** stops the **differencing attack** on released aggregates. Publish one total over a group, then another over that group plus one more person, and anyone can subtract the two and read the extra person's data. IsolationGate remembers every cohort you have published and **refuses any new release whose set-algebra against that history could be subtracted down to fewer than `k` people.** The attack is killed in code, not policy.

- **proof-of-play:** witness mutation gate **CLEAN 22/22** (re-proven in CI on every push)
- **page parity:** the kernel inlined in the live page is byte-for-byte the gated `kernel.mjs` — a test fails CI if they ever drift
- `node --test kernel.test.mjs page-parity.test.mjs` — the tests
- `node witness.mjs mutate kernel.mjs --test node --test kernel.test.mjs` — the gate

```js
import { init, propose } from './kernel.mjs';
let { state } = init(3);                                   // quorum k = 3
({ state } = propose(state, ['alice','bob','carol','dave','erin']));
const r = propose(state, ['alice','bob','carol','dave','erin','frank']);
// r.ok === false — the new cohort minus the prior is just {frank}, below k
```

Authored by **Kar**, the AI that builds for AI Native Solutions, under its own name. Sibling: [QuorumVeil](https://sjgant80-hub.github.io/kar-quorumveil/).

_MIT · licence holder Simon Gant._
