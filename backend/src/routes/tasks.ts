import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * GET /api/tasks
 * Get all tasks
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Check which tasks user has completed
    const { data: completedTasks } = await supabase
      .from('user_completed_tasks')
      .select('task_id')
      .eq('user_id', req.userId);

    const completedTaskIds = new Set((completedTasks || []).map((t: any) => t.task_id));

    const tasksWithStatus = (tasks || []).map((task: any) => ({
      ...task,
      completed: completedTaskIds.has(task.id),
    }));

    res.json({ data: { tasks: tasksWithStatus } });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tasks' });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Complete a task
 */
router.post('/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;

    // Check if task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if already completed
    const { data: existing } = await supabase
      .from('user_completed_tasks')
      .select('id')
      .eq('user_id', req.userId)
      .eq('task_id', taskId)
      .single();

    if (existing) {
      return res.json({ data: { message: 'Task already completed' } });
    }

    // Record completion
    await supabase.from('user_completed_tasks').insert({
      user_id: req.userId,
      task_id: taskId,
    });

    // Add points (handled by trigger)
    // The trigger will automatically add points to points_accounts

    res.json({ data: { message: 'Task completed', points: task.points } });
  } catch (error: any) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete task' });
  }
});

export default router;
