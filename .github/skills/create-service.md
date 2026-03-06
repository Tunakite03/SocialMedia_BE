# Skill: Create a TypeScript Service

## Template
```typescript
// src/services/<name>.service.ts
import type { <InputType>, <ReturnType> } from '../types';

export interface <Name>ServiceDeps {
  // inject DB, logger, other services here
}

export class <Name>Service {
  constructor(private readonly deps: <Name>ServiceDeps) {}

  async <methodName>(input: <InputType>): Promise<<ReturnType>> {
    // 1. Validate input
    // 2. Execute core logic
    // 3. Return result
  }
}
```

## Checklist
- [ ] All public methods have explicit return types.
- [ ] Input validated at the start of each method.
- [ ] Service owns use-case orchestration; framework or UI concerns stay outside.
- [ ] Dependencies injected via constructor (no global imports).
- [ ] Write methods define transaction or idempotency boundaries explicitly.
- [ ] External I/O is bounded (timeouts/cancellation where available) and safe structured logs do not leak secrets.
- [ ] Unit tests mock all injected dependencies.
- [ ] Errors thrown as typed custom error classes.
