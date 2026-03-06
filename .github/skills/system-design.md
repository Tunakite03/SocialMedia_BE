# Skill: Design a Scalable Change

## When to use
- New feature crosses module or service boundaries.
- New API, queue, cache, background job, or data model is introduced.
- Expected traffic, data volume, or operational complexity can grow.
- Failure handling, rollout, or rollback matters.

## 1. Define the shape of the change
- Identify primary actors and entry points.
- Separate read path vs write path.
- Define data ownership and invariants.
- Capture expected volume, latency, and growth constraints.

## 2. Choose boundaries deliberately
- Keep transport thin; business logic in services/use-cases; persistence behind data-access modules.
- Prefer feature-oriented modules and explicit contracts between them.
- Avoid sharing mutable state across unrelated components.
- Introduce queues, caches, or background jobs only for a clear bottleneck or decoupling need.

## 3. Scalability checklist
- [ ] List operations paginate and enforce max limits.
- [ ] Expensive work is batched, streamed, or moved off the request path.
- [ ] Query/index strategy matches the expected access pattern.
- [ ] Concurrency is bounded; queue growth and backpressure are controlled.
- [ ] Cache ownership, TTL, and invalidation strategy are explicit.

## 4. Reliability & observability
- [ ] Timeouts and cancellation defined for external I/O.
- [ ] Retries are safe; idempotency or duplicate-handling is defined for mutating flows.
- [ ] Partial failures, race conditions, and stale reads are considered.
- [ ] Structured logs, metrics, and traces exist at important boundaries.
- [ ] Health checks, alerts, or dashboards are identified for critical paths.

## 5. Rollout & compatibility
- [ ] Changes are additive and backward-compatible first.
- [ ] Schema/API/event migrations support mixed-version rollout.
- [ ] Backfills, feature flags, and rollback steps are defined.
- [ ] Old readers/writers remain supported until migration completes.

## Output format
For non-trivial changes, provide:
1. Problem and constraints
2. Proposed architecture and boundaries
3. Data flow or sequence
4. Scalability and failure-mode analysis
5. Rollout and compatibility plan
