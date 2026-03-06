# Skill: Create a REST API Endpoint

## Template (Express / Hono / Fastify pattern)
```typescript
// src/routes/<resource>.routes.ts
import { Router } from 'express'; // or equivalent
import { validateCreateResource } from '../validation/<resource>.validation'; // use the existing project validation layer
import { <Resource>Service } from '../services/<resource>.service';

const router = Router();

router.post('/<resource>', async (req, res, next) => {
  try {
    const body = validateCreateResource(req.body);
    const result = await <Resource>Service.create(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

## Checklist
- [ ] Input validated with the project's existing validation layer. If none exists, ask before adding a new library.
- [ ] Correct HTTP status codes: 201 created, 200 ok, 400 bad input, 404 not found, 409 conflict.
- [ ] Errors forwarded to `next(err)` — not swallowed.
- [ ] Auth middleware applied where required.
- [ ] Response shape consistent with rest of API.
- [ ] List endpoints use pagination/filtering with bounded limits.
- [ ] Mutating endpoints consider idempotency/retry safety when clients or queues can retry.
- [ ] Integration test added for happy path + error cases.
- [ ] Performance: downstream calls are bounded, concurrent where safe, and no sync blocking calls.
