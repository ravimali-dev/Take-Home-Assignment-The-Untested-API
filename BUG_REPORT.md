# Bug Report: Task API

All bugs below were found by writing tests first (`tests/`), not by guessing. Each bug has a test that
failed against the original code. Status values used in this report are the ones in the code
(`todo | in_progress | done`).

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | Pagination skips the first page | High | **Fixed** |
| 2 | Status filter does partial matching | Medium | Open |
| 3 | `complete` silently resets priority to `medium` | Medium | Open |
| 4 | `PUT` lets the client overwrite `id` / `createdAt` / `completedAt` | Medium | Open |
| 5 | `status` filter ignores `page` / `limit` | Low | Open |

---

## BUG-1: Pagination skips the first page (FIXED)

- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `GET /tasks?page=1&limit=2` returns the first 2 tasks. Page 2 returns tasks 3 and 4.
- **Actual:** `page=1&limit=2` returns tasks 3 and 4. The first page is never reachable. A request with only
  `?page=1` (limit defaults to 10) returns an empty list even when tasks exist.
- **Why it happens:** the offset is calculated as `page * limit`, which treats pages as 0-based. The route
  (`routes/tasks.js`) defaults `page` to `1`, so the two layers disagree. It should be `(page - 1) * limit`.
- **How I found it:** tests `paginates: page 1 returns the first items` (route) and
  `getPaginated > page 1 returns the first items` (service) failed. The test
  `falls back to defaults when page/limit are not numbers` failed for the same reason.
- **Fix:** `const offset = (page - 1) * limit;`. All four pagination tests pass now.

## BUG-2: Status filter does partial matching

- **Where:** `src/services/taskService.js`, `getByStatus`
- **Expected:** `?status=do` returns nothing, because `do` is not a valid status.
- **Actual:** it returns every `todo` and every `done` task.
- **Why it happens:** the code uses `t.status.includes(status)`, which is a substring check, not equality.
  `"todo".includes("do")` and `"done".includes("do")` are both true.
- **How I found it:** test `does not partially match the status filter` (skipped, see below).
- **Suggested fix:** `tasks.filter((t) => t.status === status)`. Also consider returning 400 for a status that is not in
  the valid list.

## BUG-3: `complete` silently resets priority to `medium`

- **Where:** `src/services/taskService.js`, `completeTask`
- **Expected:** completing a task changes `status` and `completedAt` only.
- **Actual:** a `high` priority task becomes `medium` after `PATCH /tasks/:id/complete`. Data is lost with no
  warning.
- **Why it happens:** the object built in `completeTask` hard-codes `priority: 'medium'`.
- **How I found it:** tests `keeps the original priority` (service and route).
- **Suggested fix:** remove the `priority: 'medium'` line.

## BUG-4: `PUT` lets the client overwrite protected fields

- **Where:** `src/services/taskService.js`, `update` (and `validateUpdateTask` does not block it)
- **Expected:** `id`, `createdAt` and `completedAt` are set by the server and cannot be changed by the client.
- **Actual:** `PUT /tasks/:id` with `{ "id": "x", "createdAt": "1999-..." }` changes them. Changing `id` can
  make the task unreachable or collide with another task.
- **Why it happens:** `{ ...tasks[index], ...fields }` copies every key of the request body (mass assignment).
- **How I found it:** tests `does not let the client overwrite id or createdAt` and
  `does not allow the id to be overwritten`.
- **Suggested fix:** pick only allowed fields (`title`, `description`, `status`, `priority`, `dueDate`) before merging.

## BUG-5: `status` filter ignores pagination

- **Where:** `src/routes/tasks.js`, `GET /`
- **Expected:** `?status=todo&page=1&limit=2` returns at most 2 `todo` tasks.
- **Actual:** the route returns right after the status filter, so `page` and `limit` are ignored and all matching
  tasks are returned.
- **Why it happens:** `if (status) { return res.json(...) }` comes before the pagination branch, so they are
  mutually exclusive.
- **How I found it:** test `applies pagination together with a status filter`.
- **Suggested fix:** filter first, then paginate the filtered list.

---

## Other things I noticed (not covered by a test, not fixed)

- `README.md` lists statuses as `pending | in-progress | completed`, but the code and `ASSIGNMENT.md` use
  `todo | in_progress | done`. The code is the source of truth here, so the README is wrong.
- `PUT` with `status: "done"` does not set `completedAt`, and moving a task out of `done` does not clear it.
  Creating a task with `status: "done"` also leaves `completedAt` as `null`.
- Calling `complete` on an already completed task overwrites the original `completedAt`.
- `limit=0` silently becomes `10` (because of `parseInt(limit) || 10`), negative `page` values are not rejected, and
  there is no maximum `limit`.
- The paginated response is a bare array with no `total`, so a client cannot know how many pages exist.
- `findById` returns the live object from the store, so a caller can mutate stored data without going through
  `update`.

## About the skipped tests

The tests for BUG-2 to BUG-5 are written and correct, but marked `it.skip` so the suite stays green. Removing
`.skip` will make them fail until the bug is fixed. This is intentional: the task only asked to fix one bug.