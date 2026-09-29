# Submission Note

## Test results

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|--------
All files        |   96.25 |    94.38 |   93.33 |   95.89
 routes/tasks.js |     100 |      100 |     100 |     100
 taskService.js  |     100 |    94.73 |     100 |     100
 validators.js   |   93.93 |    92.85 |     100 |   93.93

Tests: 7 skipped (documented open bugs), 58 passed, 65 total
```

## What I did

- **Tests:** `tests/taskService.test.js` (unit) and `tests/tasks.test.js` (Supertest integration). Each endpoint has a
  happy path plus edge cases (missing / invalid input, unknown id, partial pagination, overdue logic).
- **Bugs:** 5 found through failing tests, see `BUG_REPORT.md`.
- **Fix:** BUG-1, the pagination offset (`page * limit` instead of `(page - 1) * limit`). I chose it because it is the
  most user-visible: the first page of results was unreachable. The fix is one line and its tests now pass.
- **Feature:** `PATCH /tasks/:id/assign`.

## Design decisions for `PATCH /tasks/:id/assign`

- **Validation:** `assignee` must be a string. It is trimmed, so `"  "` counts as empty. Empty, missing or non-string
  values return `400`. I also added a 100 character limit to avoid storing huge values.
- **Unknown task:** `404`, same shape as the other routes (`{ error: 'Task not found' }`).
- **Already assigned:** I allow re-assignment (returns `200` with the new assignee) instead of returning `409`.
  Reassigning is a normal workflow (someone is sick, priorities change), and a `409` would force clients to add an
  "unassign" step first. If the business wants "assign once", it is a small change.
- **Order of checks:** validate the body first, then look up the task. This matches how `PUT` already behaves.
- **Implementation:** logic lives in `taskService.assignTask`, validation in `validators.js`, and the route only
  connects them, the same layering as the rest of the code.

## What I would test next

- Boundary values on pagination (`limit=0`, negative page, very large limit).
- Concurrency and ordering, for example completing and deleting the same task.
- `PUT` and `complete` transitions for `completedAt` (see "Other things I noticed" in the bug report).
- A contract test that `README.md` and the real status values agree.

## What surprised me

- The `README` and the code disagree on the status values.
- `completeTask` resets priority. It looks intentional at first glance, but nothing in the docs asks for it.
- Pagination and status filtering are mutually exclusive in the route, which is easy to miss when reading
  the two branches separately.

## Questions before shipping to production

1. Is the in-memory store meant to be replaced by a database? Data is lost on every restart.
2. Is there any authentication? Anyone can update, delete or assign any task.
3. What should the API do for `status` values it does not know: return `400` or an empty list?
4. Should `assignee` be a free-text name or a reference to a real user id? If assignees need to exist, we need a users source.
5. Should the paginated response include `total` and page metadata?