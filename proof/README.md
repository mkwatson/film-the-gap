# Machine-checked capability policy

This isolated Lean project proves the small public-state policy that controls
the reversible `reserve_current_lot` WebMCP capability.

The browser does not reimplement the policy with an unchecked Boolean. Lean
enumerates the complete 16-case public state table, and
`pnpm proof:generate` commits that generated artifact at
[`src/generated/hold-policy-receipt.json`](../src/generated/hold-policy-receipt.json).
The application reads the table in two load-bearing places:

1. dynamic WebMCP registration, so the hold tool exists only when the lot is
   live, the public evidence outcome is ready, and no hold already exists;
2. the authoritative hold handler, so a direct or stale invocation cannot
   bypass the same policy.

The generated artifact means the web app needs no Lean runtime or proof service.
TypeScript schema validation and tests separately verify the adapter between
application state and the generated table.

## Verify

The project pins stable Lean `4.33.1` in `lean-toolchain` and intentionally has
no mathlib dependency.

```bash
pnpm proof:verify
```

That command:

- builds the isolated Lake project;
- rejects an axiom report containing `sorryAx`;
- replays the compiled theorem environment with `leanchecker --fresh`;
- runs the Lean executable that enumerates all 16 policy states; and
- rejects a stale or modified committed receipt, including its source SHA-256.

Run `pnpm proof:generate` only after deliberately changing the Lean model. The
resulting receipt should be reviewed and committed with the proof source and
runtime adapter.

## Frozen claims

[`CapabilityPolicy.lean`](CapabilityPolicy.lean) proves:

- `reserveToolAvailable_sound`: an exposed hold implies live show, ready public
  evidence, and no existing hold;
- `sellerEnvelope_privateCeiling_noninterference`: changing only the modeled
  private ceiling cannot change the modeled seller payload;
- `acceptedHold_sound`: an accepted modeled hold is capability-eligible,
  revision-fresh, and bound to the exact current quote; and
- `staleRevision_refused`: a stale modeled revision cannot be accepted.

## Trust boundary

This proof is intentionally narrower than the product:

- It proves an abstract capability policy, not that an image is authentic or a
  seller's repair-history statement is true.
- The noninterference theorem covers the modeled projection, not every browser,
  network, framework, or model implementation.
- Lean proves the table; ordinary tests and native-browser acceptance verify
  that the TypeScript application consumes it at the intended decision points.

Those limits are part of the judge-visible receipt. The proof is evidence about
authority, not a decorative claim of end-to-end truth.
