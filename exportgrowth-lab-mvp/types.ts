// PRD Section 7 Data Models

export enum UserRole {
  OWNER = 'Owner',
  SALES_MANAGER = 'Sales Manager',
  SALES_REP = 'Sales Rep',
  OTHER = 'Other'
}

export interface User {
  id: string;
  name: string;
  company: string;
  role: UserRole;
  phone: string;
  wechatId: string;
  email?: string;
  mainProducts: string;
  mainMarkets: string[]; // JSON/Text in DB, array here
  createdAt: string;
  totalPoints: number;
  referralCode: string; // The "short_code"
  invitedBy?: string; // ID of the inviter
  completedTaskIds: string[]; // Array of IDs of tasks completed
}

export enum PointType {
  REGISTER = 'register',
  TASK_COMPLETE = 'task_complete',
  INVITE = 'invite',
  REDEEM = 'redeem',
  MANUAL_ADJUST = 'manual_adjust'
}

export interface PointLog {
  id: string;
  userId: string;
  type: PointType;
  pointsDelta: number;
  remark: string;
  createdAt: string;
}

export enum RewardType {
  DOCUMENT = 'document',
  PAGE = 'page',
  COURSE = 'course',
  OTHER = 'other'
}

export enum DeliverMethod {
  URL = 'url',
  CODE = 'code',
  TEXT = 'text'
}

export interface Reward {
  id: string;
  name: string;
  type: RewardType;
  pointsRequired: number;
  description: string;
  deliverMethod: DeliverMethod;
  deliverContent: string; // URL or Code or Text
  imageUrl?: string;
  // Linked Assets for "Offer" view
  landingPageId?: string;
  posterId?: string;
  relatedTaskIds?: string[];
}

export interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  deliverMethod: DeliverMethod;
  deliverContent: string;
  createdAt: string;
}

// --- Task System Types ---

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  ctaLink?: string; // URL to perform the task
  isSystem?: boolean; // If true, represents mandatory base tasks
  createdAt: string;
}

// --- Poster Configuration Types ---

export interface ElementConfig {
  x: number;
  y: number;
  size: number; // width for images, fontSize for text
  color?: string; // hex for text
  visible: boolean;
}

export interface PosterTemplate {
  id: string;
  name: string;
  landingPageId?: string; // Link to specific landing page
  backgroundUrl: string;
  qrConfig: ElementConfig;
  nameConfig: ElementConfig;
  avatarConfig: ElementConfig;
}

// --- Landing Page Builder Types ---

export interface LandingPage {
  id: string;
  name: string; // Internal name
  headline: string;
  subheadline: string;
  heroImageUrl: string;
  bodyContent: string;
  ctaText: string;
  createdAt: string;
}

// Initial Mock Data Constants

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task_oa',
    title: 'Follow Service Account',
    description: 'Follow our official service account for daily updates.',
    points: 30,
    ctaLink: 'https://mp.weixin.qq.com/',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_sub',
    title: 'Follow Subscription Account',
    description: 'Get deep-dive industry analysis weekly.',
    points: 30,
    ctaLink: 'https://mp.weixin.qq.com/',
    isSystem: true,
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_LANDING_PAGES: LandingPage[] = [
  {
    id: 'lp1',
    name: 'General Export Growth',
    headline: 'AI Export Growth Lab',
    subheadline: 'Free SOPs, Automation Workflows, and Growth Strategies for Chinese Manufacturers.',
    heroImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop',
    bodyContent: 'Join 500+ Exporters. Get exclusive access to B2B templates, Google Ads strategies for factories, and our referral rewards program.',
    ctaText: 'Get Free Resources',
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_TEMPLATES: PosterTemplate[] = [
  {
    id: 't1',
    name: 'Default Blue',
    landingPageId: 'lp1',
    backgroundUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop',
    qrConfig: { x: 100, y: 350, size: 100, visible: true },
    nameConfig: { x: 150, y: 320, size: 24, color: '#FFFFFF', visible: true },
    avatarConfig: { x: 150, y: 240, size: 60, visible: true }
  },
  {
    id: 't2',
    name: 'Modern Dark',
    landingPageId: 'lp1',
    backgroundUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
    qrConfig: { x: 150, y: 400, size: 120, visible: true },
    nameConfig: { x: 150, y: 100, size: 30, color: '#FFFFFF', visible: true },
    avatarConfig: { x: 150, y: 180, size: 80, visible: true }
  }
];

export const INITIAL_REWARDS: Reward[] = [
  {
    id: 'r1',
    name: '2025 Export Growth SOP (PDF)',
    type: RewardType.DOCUMENT,
    pointsRequired: 50,
    description: 'Standard Operating Procedures for scaling foreign trade teams.',
    deliverMethod: DeliverMethod.URL,
    deliverContent: 'https://example.com/files/sop-2025.pdf',
    imageUrl: 'https://picsum.photos/400/300?random=1',
    landingPageId: 'lp1',
    posterId: 't1',
    relatedTaskIds: []
  },
  {
    id: 'r2',
    name: 'Cold Email Automation Templates',
    type: RewardType.DOCUMENT,
    pointsRequired: 100,
    description: '5 high-conversion email sequences for B2B outreach.',
    deliverMethod: DeliverMethod.URL,
    deliverContent: 'https://docs.google.com/document/d/example-templates',
    imageUrl: 'https://picsum.photos/400/300?random=2'
  },
  {
    id: 'r3',
    name: 'AI Sales Assistant Course',
    type: RewardType.COURSE,
    pointsRequired: 200,
    description: 'Video course: How to use LLMs to reply to RFQs faster.',
    deliverMethod: DeliverMethod.URL,
    deliverContent: 'https://course.example.com/access-code/AI-SALES-2025',
    imageUrl: 'https://picsum.photos/400/300?random=3'
  }
];

export const POINTS_CONFIG = {
  REGISTER: 50,
  INVITE: 50
};