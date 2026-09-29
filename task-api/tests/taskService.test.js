const taskService = require('../src/services/taskService');

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('creates a task with default values', () => {
      const task = taskService.create({ title: 'Write tests' });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Write tests');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('uses the values that are passed in', () => {
      const task = taskService.create({
        title: 'Custom',
        description: 'desc',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2030-01-01T00:00:00.000Z',
      });

      expect(task).toMatchObject({
        description: 'desc',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2030-01-01T00:00:00.000Z',
      });
    });

    it('gives every task a unique id', () => {
      const a = taskService.create({ title: 'A' });
      const b = taskService.create({ title: 'B' });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('getAll / findById', () => {
    it('returns an empty array when there are no tasks', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('returns all created tasks', () => {
      taskService.create({ title: 'A' });
      taskService.create({ title: 'B' });
      expect(taskService.getAll()).toHaveLength(2);
    });

    it('returns a copy, so changing the array does not change the store', () => {
      taskService.create({ title: 'A' });
      const list = taskService.getAll();
      list.pop();
      expect(taskService.getAll()).toHaveLength(1);
    });

    it('findById returns the task when it exists', () => {
      const task = taskService.create({ title: 'A' });
      expect(taskService.findById(task.id)).toEqual(task);
    });

    it('findById returns undefined for an unknown id', () => {
      expect(taskService.findById('nope')).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    it('returns only tasks with the given status', () => {
      taskService.create({ title: 'A', status: 'todo' });
      taskService.create({ title: 'B', status: 'done' });

      const result = taskService.getByStatus('todo');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('A');
    });

    it('returns an empty array when nothing matches', () => {
      taskService.create({ title: 'A', status: 'todo' });
      expect(taskService.getByStatus('in_progress')).toEqual([]);
    });

    // BUG-2 (not fixed, see BUG_REPORT.md)
    it.skip('does NOT do partial matching ("do" must not match "todo" or "done")', () => {
      taskService.create({ title: 'A', status: 'todo' });
      taskService.create({ title: 'B', status: 'done' });
      expect(taskService.getByStatus('do')).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) taskService.create({ title: `T${i}` });
    });

    // BUG-1 (fixed)
    it('page 1 returns the first items', () => {
      const result = taskService.getPaginated(1, 2);
      expect(result.map((t) => t.title)).toEqual(['T1', 'T2']);
    });

    it('page 2 returns the next items', () => {
      const result = taskService.getPaginated(2, 2);
      expect(result.map((t) => t.title)).toEqual(['T3', 'T4']);
    });

    it('last page can be partial', () => {
      const result = taskService.getPaginated(3, 2);
      expect(result.map((t) => t.title)).toEqual(['T5']);
    });

    it('returns an empty array for a page beyond the data', () => {
      expect(taskService.getPaginated(10, 2)).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('returns zeros when there are no tasks', () => {
      expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    });

    it('counts tasks by status', () => {
      taskService.create({ title: 'A', status: 'todo' });
      taskService.create({ title: 'B', status: 'todo' });
      taskService.create({ title: 'C', status: 'in_progress' });
      taskService.create({ title: 'D', status: 'done' });

      expect(taskService.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
    });

    it('counts overdue tasks but ignores done ones and ones with no due date', () => {
      const past = '2000-01-01T00:00:00.000Z';
      const future = '2999-01-01T00:00:00.000Z';
      taskService.create({ title: 'overdue', dueDate: past });
      taskService.create({ title: 'overdue in progress', status: 'in_progress', dueDate: past });
      taskService.create({ title: 'done but past due', status: 'done', dueDate: past });
      taskService.create({ title: 'future', dueDate: future });
      taskService.create({ title: 'no date' });

      expect(taskService.getStats().overdue).toBe(2);
    });
  });

  describe('update', () => {
    it('updates only the given fields', () => {
      const task = taskService.create({ title: 'Old', priority: 'high' });
      const updated = taskService.update(task.id, { title: 'New' });

      expect(updated.title).toBe('New');
      expect(updated.priority).toBe('high');
      expect(taskService.findById(task.id).title).toBe('New');
    });

    it('returns null for an unknown id', () => {
      expect(taskService.update('nope', { title: 'x' })).toBeNull();
    });

    // BUG-4 (not fixed, see BUG_REPORT.md)
    it.skip('does not allow the id to be overwritten', () => {
      const task = taskService.create({ title: 'A' });
      const updated = taskService.update(task.id, { id: 'hacked' });
      expect(updated.id).toBe(task.id);
    });
  });

  describe('remove', () => {
    it('removes an existing task and returns true', () => {
      const task = taskService.create({ title: 'A' });
      expect(taskService.remove(task.id)).toBe(true);
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false for an unknown id', () => {
      expect(taskService.remove('nope')).toBe(false);
    });
  });

  describe('assignTask', () => {
    it('stores the assignee on the task', () => {
      const task = taskService.create({ title: 'A' });
      const updated = taskService.assignTask(task.id, 'Ravi');

      expect(updated.assignee).toBe('Ravi');
      expect(taskService.findById(task.id).assignee).toBe('Ravi');
    });

    it('trims whitespace around the name', () => {
      const task = taskService.create({ title: 'A' });
      expect(taskService.assignTask(task.id, '  Ravi  ').assignee).toBe('Ravi');
    });

    it('allows re-assigning to someone else', () => {
      const task = taskService.create({ title: 'A' });
      taskService.assignTask(task.id, 'Ravi');
      expect(taskService.assignTask(task.id, 'Amit').assignee).toBe('Amit');
    });

    it('returns null for an unknown id', () => {
      expect(taskService.assignTask('nope', 'Ravi')).toBeNull();
    });
  });

  describe('completeTask', () => {
    it('marks the task done and sets completedAt', () => {
      const task = taskService.create({ title: 'A' });
      const done = taskService.completeTask(task.id);

      expect(done.status).toBe('done');
      expect(new Date(done.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('returns null for an unknown id', () => {
      expect(taskService.completeTask('nope')).toBeNull();
    });

    // BUG-3 (not fixed, see BUG_REPORT.md)
    it.skip('keeps the original priority', () => {
      const task = taskService.create({ title: 'A', priority: 'high' });
      expect(taskService.completeTask(task.id).priority).toBe('high');
    });
  });
});