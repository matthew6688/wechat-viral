import { User, PointLog, Reward, Redemption, UserRole, PointType, INITIAL_REWARDS, POINTS_CONFIG, PosterTemplate, INITIAL_TEMPLATES, LandingPage, INITIAL_LANDING_PAGES, Task, INITIAL_TASKS } from '../types';

// Keys for LocalStorage
const KEY_USERS = 'egl_users';
const KEY_CURRENT_USER = 'egl_current_user_id';
const KEY_POINT_LOGS = 'egl_point_logs';
const KEY_REDEMPTIONS = 'egl_redemptions';
const KEY_REWARDS = 'egl_rewards';
const KEY_TEMPLATES = 'egl_templates';
const KEY_LANDING_PAGES = 'egl_landing_pages';
const KEY_TASKS = 'egl_tasks';

// Helper to generate IDs
export const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Initialization ---
const initStorage = () => {
  if (!localStorage.getItem(KEY_REWARDS)) {
    localStorage.setItem(KEY_REWARDS, JSON.stringify(INITIAL_REWARDS));
  }
  if (!localStorage.getItem(KEY_USERS)) {
    localStorage.setItem(KEY_USERS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEY_TEMPLATES)) {
    localStorage.setItem(KEY_TEMPLATES, JSON.stringify(INITIAL_TEMPLATES));
  }
  if (!localStorage.getItem(KEY_LANDING_PAGES)) {
      localStorage.setItem(KEY_LANDING_PAGES, JSON.stringify(INITIAL_LANDING_PAGES));
  }
  if (!localStorage.getItem(KEY_TASKS)) {
      localStorage.setItem(KEY_TASKS, JSON.stringify(INITIAL_TASKS));
  }
};

initStorage();

// --- Auth / User Services ---

export const getCurrentUser = (): User | null => {
  const id = localStorage.getItem(KEY_CURRENT_USER);
  if (!id) return null;
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  return users.find((u: User) => u.id === id) || null;
};

export const logout = () => {
  localStorage.removeItem(KEY_CURRENT_USER);
};

export const registerUser = (data: Partial<User>, inviterCode?: string): User => {
  const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  
  // Check if phone already exists (Mock "Login/Register" hybrid)
  const existing = users.find(u => u.phone === data.phone);
  if (existing) {
    localStorage.setItem(KEY_CURRENT_USER, existing.id);
    return existing;
  }

  // Handle Invitation
  let inviterId = undefined;
  if (inviterCode) {
    const inviter = users.find(u => u.referralCode === inviterCode);
    if (inviter) {
      inviterId = inviter.id;
      // Award points to inviter
      addPoints(inviter.id, POINTS_CONFIG.INVITE, PointType.INVITE, `Invited new user`);
    }
  }

  const newUser: User = {
    id: generateId(),
    name: data.name!,
    company: data.company!,
    role: data.role || UserRole.OTHER,
    phone: data.phone!,
    wechatId: data.wechatId!,
    mainProducts: data.mainProducts!,
    mainMarkets: data.mainMarkets || [],
    email: data.email,
    createdAt: new Date().toISOString(),
    totalPoints: 0,
    referralCode: generateId().substring(0, 6).toUpperCase(),
    invitedBy: inviterId,
    completedTaskIds: []
  };

  // Save User
  users.push(newUser);
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  localStorage.setItem(KEY_CURRENT_USER, newUser.id);

  // Award Registration Points
  addPoints(newUser.id, POINTS_CONFIG.REGISTER, PointType.REGISTER, 'Welcome bonus');

  return newUser;
};

// --- Points Service ---

export const addPoints = (userId: string, amount: number, type: PointType, remark: string) => {
  const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) return;

  // Update User Total
  users[userIndex].totalPoints += amount;
  localStorage.setItem(KEY_USERS, JSON.stringify(users));

  // Log Transaction
  const logs: PointLog[] = JSON.parse(localStorage.getItem(KEY_POINT_LOGS) || '[]');
  const newLog: PointLog = {
    id: generateId(),
    userId,
    type,
    pointsDelta: amount,
    remark,
    createdAt: new Date().toISOString()
  };
  logs.unshift(newLog); // Newest first
  localStorage.setItem(KEY_POINT_LOGS, JSON.stringify(logs));
};

export const getPointLogs = (userId: string): PointLog[] => {
  const logs: PointLog[] = JSON.parse(localStorage.getItem(KEY_POINT_LOGS) || '[]');
  return logs.filter(l => l.userId === userId);
};

// --- Rewards Service ---

export const getRewards = (): Reward[] => {
  return JSON.parse(localStorage.getItem(KEY_REWARDS) || '[]');
};

export const saveReward = (reward: Reward) => {
    const rewards = getRewards();
    const index = rewards.findIndex(r => r.id === reward.id);
    if (index !== -1) {
        rewards[index] = reward;
    } else {
        rewards.push(reward);
    }
    localStorage.setItem(KEY_REWARDS, JSON.stringify(rewards));
};

export const deleteReward = (id: string) => {
    let rewards = getRewards();
    rewards = rewards.filter(r => r.id !== id);
    localStorage.setItem(KEY_REWARDS, JSON.stringify(rewards));
};

export const redeemReward = (userId: string, rewardId: string): { success: boolean; content?: string; message: string; redemptionId?: string } => {
  const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const rewards: Reward[] = JSON.parse(localStorage.getItem(KEY_REWARDS) || '[]');
  
  const user = users.find(u => u.id === userId);
  const reward = rewards.find(r => r.id === rewardId);

  if (!user || !reward) return { success: false, message: 'Invalid request' };

  if (user.totalPoints < reward.pointsRequired) {
    return { success: false, message: 'Insufficient points' };
  }

  // Deduct Points
  addPoints(userId, -reward.pointsRequired, PointType.REDEEM, `Redeemed: ${reward.name}`);

  // Create Redemption Record
  const redemptions: Redemption[] = JSON.parse(localStorage.getItem(KEY_REDEMPTIONS) || '[]');
  const newRedemption: Redemption = {
    id: generateId(),
    userId,
    rewardId,
    rewardName: reward.name,
    deliverMethod: reward.deliverMethod,
    deliverContent: reward.deliverContent,
    createdAt: new Date().toISOString()
  };
  redemptions.push(newRedemption);
  localStorage.setItem(KEY_REDEMPTIONS, JSON.stringify(redemptions));

  return { success: true, content: reward.deliverContent, message: 'Redemption successful!', redemptionId: newRedemption.id };
};

export const getUserRedemptions = (userId: string): Redemption[] => {
  const redemptions: Redemption[] = JSON.parse(localStorage.getItem(KEY_REDEMPTIONS) || '[]');
  return redemptions.filter(r => r.userId === userId).reverse();
};

export const getRedemption = (id: string): Redemption | undefined => {
  const redemptions: Redemption[] = JSON.parse(localStorage.getItem(KEY_REDEMPTIONS) || '[]');
  return redemptions.find(r => r.id === id);
};

// --- Task Service ---

export const getTasks = (): Task[] => {
    return JSON.parse(localStorage.getItem(KEY_TASKS) || '[]');
};

export const saveTask = (task: Task) => {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
        tasks[index] = task;
    } else {
        tasks.push(task);
    }
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
};

export const deleteTask = (id: string) => {
    let tasks = getTasks();
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
};

export const completeTask = (userId: string, taskId: string): boolean => {
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const tasks: Task[] = getTasks();
    
    const userIndex = users.findIndex(u => u.id === userId);
    const task = tasks.find(t => t.id === taskId);

    if (userIndex === -1 || !task) return false;

    // Check if already completed
    if (users[userIndex].completedTaskIds && users[userIndex].completedTaskIds.includes(taskId)) {
        return false; 
    }

    // Initialize array if undefined (migration safety)
    if (!users[userIndex].completedTaskIds) {
        users[userIndex].completedTaskIds = [];
    }

    users[userIndex].completedTaskIds.push(taskId);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    addPoints(userId, task.points, PointType.TASK_COMPLETE, `Completed: ${task.title}`);
    return true;
};


// --- Admin Service ---

export const getAllUsers = (): User[] => {
  return JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
};

// --- Poster Template Service ---

export const getPosterTemplates = (): PosterTemplate[] => {
  return JSON.parse(localStorage.getItem(KEY_TEMPLATES) || '[]');
};

export const savePosterTemplate = (template: PosterTemplate) => {
  const templates: PosterTemplate[] = JSON.parse(localStorage.getItem(KEY_TEMPLATES) || '[]');
  const index = templates.findIndex(t => t.id === template.id);
  if (index !== -1) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(KEY_TEMPLATES, JSON.stringify(templates));
};

export const deletePosterTemplate = (id: string) => {
    let templates: PosterTemplate[] = JSON.parse(localStorage.getItem(KEY_TEMPLATES) || '[]');
    templates = templates.filter(t => t.id !== id);
    localStorage.setItem(KEY_TEMPLATES, JSON.stringify(templates));
};

// --- Landing Page Service ---

export const getLandingPages = (): LandingPage[] => {
    return JSON.parse(localStorage.getItem(KEY_LANDING_PAGES) || '[]');
};

export const getLandingPage = (id: string): LandingPage | undefined => {
    const pages = getLandingPages();
    return pages.find(p => p.id === id);
};

export const saveLandingPage = (page: LandingPage) => {
    const pages = getLandingPages();
    const index = pages.findIndex(p => p.id === page.id);
    if (index !== -1) {
        pages[index] = page;
    } else {
        pages.push(page);
    }
    localStorage.setItem(KEY_LANDING_PAGES, JSON.stringify(pages));
};

export const deleteLandingPage = (id: string) => {
    let pages = getLandingPages();
    pages = pages.filter(p => p.id !== id);
    localStorage.setItem(KEY_LANDING_PAGES, JSON.stringify(pages));
};