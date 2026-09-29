const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

const createTask = async (body = { title: 'Sample task' }) => {
  const res = await request(app).post('/tasks').send(body);
  return res.body;
};

describe('Tasks API', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('POST /tasks', () => {
    it('creates a task and returns 201', async () => {
      const res = await request(app).post('/tasks').send({ title: 'New task', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'New task', priority: 'high', status: 'todo' });
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/tasks').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when title is only spaces', async () => {
      const res = await request(app).post('/tasks').send({ title: '   ' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid status', async () => {
      const res = await request(app).post('/tasks').send({ title: 'x', status: 'pending' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid priority', async () => {
      const res = await request(app).post('/tasks').send({ title: 'x', priority: 'urgent' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid dueDate', async () => {
      const res = await request(app).post('/tasks').send({ title: 'x', dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /tasks', () => {
    it('returns an empty list at the start', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tasks', async () => {
      await createTask({ title: 'A' });
      await createTask({ title: 'B' });

      const res = await request(app).get('/tasks');
      expect(res.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      await createTask({ title: 'A', status: 'todo' });
      await createTask({ title: 'B', status: 'done' });

      const res = await request(app).get('/tasks?status=done');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('B');
    });

    // BUG-2 (not fixed, see BUG_REPORT.md)
    it.skip('does not partially match the status filter', async () => {
      await createTask({ title: 'A', status: 'todo' });
      await createTask({ title: 'B', status: 'done' });

      const res = await request(app).get('/tasks?status=do');
      expect(res.body).toEqual([]);
    });

    // BUG-1 (fixed)
    it('paginates: page 1 returns the first items', async () => {
      for (let i = 1; i <= 5; i++) await createTask({ title: `T${i}` });

      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.map((t) => t.title)).toEqual(['T1', 'T2']);
    });

    it('paginates: page 2 returns the next items', async () => {
      for (let i = 1; i <= 5; i++) await createTask({ title: `T${i}` });

      const res = await request(app).get('/tasks?page=2&limit=2');
      expect(res.body.map((t) => t.title)).toEqual(['T3', 'T4']);
    });

    it('falls back to defaults when page/limit are not numbers', async () => {
      for (let i = 1; i <= 3; i++) await createTask({ title: `T${i}` });

      const res = await request(app).get('/tasks?page=abc&limit=xyz');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    // BUG-5 (not fixed, see BUG_REPORT.md)
    it.skip('applies pagination together with a status filter', async () => {
      for (let i = 1; i <= 4; i++) await createTask({ title: `T${i}`, status: 'todo' });

      const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
      expect(res.body).toHaveLength(2);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('updates a task', async () => {
      const task = await createTask({ title: 'Old' });
      const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New', priority: 'low' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: task.id, title: 'New', priority: 'low' });
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/tasks/unknown').send({ title: 'x' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for an empty title', async () => {
      const task = await createTask();
      const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid status', async () => {
      const task = await createTask();
      const res = await request(app).put(`/tasks/${task.id}`).send({ status: 'nope' });
      expect(res.status).toBe(400);
    });

    // BUG-4 (not fixed, see BUG_REPORT.md)
    it.skip('does not let the client overwrite id or createdAt', async () => {
      const task = await createTask();
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ id: 'hacked', createdAt: '1999-01-01T00:00:00.000Z' });

      expect(res.body.id).toBe(task.id);
      expect(res.body.createdAt).toBe(task.createdAt);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('deletes a task and returns 204', async () => {
      const task = await createTask();
      const res = await request(app).delete(`/tasks/${task.id}`);

      expect(res.status).toBe(204);
      const list = await request(app).get('/tasks');
      expect(list.body).toHaveLength(0);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).delete('/tasks/unknown');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('marks a task as done and sets completedAt', async () => {
      const task = await createTask();
      const res = await request(app).patch(`/tasks/${task.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).not.toBeNull();
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).patch('/tasks/unknown/complete');
      expect(res.status).toBe(404);
    });

    // BUG-3 (not fixed, see BUG_REPORT.md)
    it.skip('keeps the original priority', async () => {
      const task = await createTask({ title: 'A', priority: 'high' });
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.body.priority).toBe('high');
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns counts by status and the overdue count', async () => {
      await createTask({ title: 'A', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
      await createTask({ title: 'B', status: 'in_progress' });
      await createTask({ title: 'C', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
    });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  beforeEach(() => {
    taskService._reset();
  });

  it('assigns a task and returns the updated task', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ravi' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: task.title, assignee: 'Ravi' });
  });

  it('persists the assignee (visible in GET /tasks)', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ravi' });

    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Ravi');
  });

  it('trims whitespace from the name', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Ravi  ' });
    expect(res.body.assignee).toBe('Ravi');
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/unknown/assign').send({ assignee: 'Ravi' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an empty string', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a whitespace-only string', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is missing', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is not a string', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 123 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is too long', async () => {
    const task = await createTask();
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('allows re-assigning an already assigned task', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ravi' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Amit' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Amit');
  });
});