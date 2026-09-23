# Array and for-each iterations

- [x] Iteration 1 — one-dimensional array fundamentals. Verified with `node --test tests/interpreter.test.js tests/api.test.js` (55 passing). Commit: `aafd600`.
- [x] Iteration 2 — arrays across OOP features. Parameters, returns, typed literals, covariance, and additive array event records are implemented and covered by regression tests. Commit: `63345b5`.
- [x] Iteration 3 — enhanced for-each execution. Binding, scope, control flow, identity, and element metadata are implemented and covered by regression tests. Commit: `dfa1a01`.
- [x] Iteration 4 — array and loop visualization. Array heap cards, references, scrollable element layout, and element highlighting are implemented. Browser-verified with the for-each example in Memory and Story views, including backward stepping and theme switching. Commit: `f306758`.
- [x] Iteration 5 — guided learning examples. Array mutation, for-each summation, aliasing, and polymorphic-array examples are selectable and tested. Commit: `239e6aa`.
- [x] Iteration 6 — integration and diagnostic hardening. Full regression suite and syntax checks pass. Commit: `9b044cc`.
- [ ] Iteration 6 — integration and diagnostic hardening.

Known limitations: multidimensional arrays, collections, generics, `Iterable`, streams, and exception handling are unsupported. Array support currently covers one-dimensional declarations, allocation, literals, indexed access, mutation, aliases, `.length`, and historical array snapshots.
