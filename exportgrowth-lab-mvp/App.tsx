import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useParams, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { 
  registerUser, 
  getCurrentUser, 
  getPointLogs, 
  getRewards, 
  redeemReward, 
  completeTask, 
  getUserRedemptions,
  getAllUsers,
  logout,
  getPosterTemplates,
  savePosterTemplate,
  deletePosterTemplate,
  generateId,
  getLandingPages,
  saveLandingPage,
  deleteLandingPage,
  getLandingPage,
  getTasks,
  saveTask,
  deleteTask,
  addPoints,
  saveReward,
  deleteReward,
  getRedemption
} from './services/mockBackend';
import { User, UserRole, PointLog, Reward, Redemption, POINTS_CONFIG, PosterTemplate, LandingPage, Task, PointType, RewardType, DeliverMethod } from './types';
import { 
  CheckCircle, ExternalLink, Copy, History, Star, ArrowRight, 
  Wallet, Users as UsersIcon, LogOut, ShieldAlert, 
  Download, Share2, Image as ImageIcon, Move, Eye, EyeOff, 
  Plus, Trash2, Edit, ChevronLeft, ChevronRight, Monitor, Smartphone, ListTodo,
  Mail, Phone, Calendar, UserPlus, CheckSquare, Settings, Gift, FileText, Link as LinkIcon, Key, Briefcase
} from 'lucide-react';

// --- Components ---

// 1. Dynamic Landing Page (For End Users)
const DynamicLandingPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [page, setPage] = useState<LandingPage | null>(null);

    useEffect(() => {
        // Fallback for default route or missing ID logic
        const lp = id ? getLandingPage(id) : getLandingPages()[0]; 
        if (lp) setPage(lp);
    }, [id]);

    const handleCTA = () => {
        // Preserve referral code from URL query params
        const searchParams = new URLSearchParams(location.search);
        const ref = searchParams.get('ref');
        navigate(ref ? `/register?ref=${ref}` : '/register');
    };

    if (!page) return <div className="p-10 text-center">Loading or Page Not Found...</div>;

    return (
        <div className="flex flex-col h-full min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 text-white">
            <div className="flex-1 flex flex-col items-center p-6 relative">
                 {/* Hero Image Background Effect */}
                 <div className="absolute inset-0 z-0 opacity-20">
                     <img src={page.heroImageUrl} className="w-full h-full object-cover" alt="Hero" />
                     <div className="absolute inset-0 bg-indigo-900/50 mix-blend-multiply"></div>
                 </div>

                 <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center space-y-6 mt-10">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-2 shadow-xl border border-white/20">
                        <Star className="text-yellow-400 w-8 h-8 fill-current" />
                    </div>
                    
                    <h1 className="text-3xl font-bold tracking-tight leading-tight">{page.headline}</h1>
                    <p className="text-indigo-100 text-lg leading-relaxed">{page.subheadline}</p>

                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-md w-full text-left border border-white/10 shadow-lg">
                        <p className="text-sm text-indigo-50 leading-relaxed whitespace-pre-wrap">{page.bodyContent}</p>
                    </div>
                 </div>
            </div>
            
            <div className="p-6 bg-white/5 backdrop-blur-sm relative z-20">
                 <button 
                    onClick={handleCTA}
                    className="w-full bg-white text-indigo-900 py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-gray-50 transition active:scale-95 flex items-center justify-center gap-2"
                >
                    {page.ctaText} <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
};


// 2. Landing / Login Page (Default Wrapper or Redirect)
const LandingPageWrapper = () => {
    return <DynamicLandingPage />;
};

// 3. Registration Page
const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: UserRole.OWNER,
    phone: '',
    wechatId: '',
    products: '',
    markets: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API delay
    setTimeout(() => {
      // Check for query params for referral
      const params = new URLSearchParams(location.search);
      const refCode = params.get('ref') || undefined;

      registerUser({
        name: formData.name,
        company: formData.company,
        role: formData.role,
        phone: formData.phone,
        wechatId: formData.wechatId,
        mainProducts: formData.products,
        mainMarkets: ['Global'] // Simplified for MVP form
      }, refCode);
      
      setIsSubmitting(false);
      navigate('/home');
    }, 800);
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input required type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Li Ming" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input required type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
            value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="e.g. Shenzhen Tech Co." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <div className="grid grid-cols-2 gap-3">
            {[UserRole.OWNER, UserRole.SALES_MANAGER, UserRole.SALES_REP, UserRole.OTHER].map(r => (
              <button 
                key={r}
                type="button"
                onClick={() => setFormData({...formData, role: r})}
                className={`text-sm py-2 px-3 rounded-lg border ${formData.role === r ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
              +86
            </span>
            <input required type="tel" className="flex-1 min-w-0 block w-full px-3 py-3 rounded-none rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="13800138000" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WeChat ID</label>
          <input required type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
            value={formData.wechatId} onChange={e => setFormData({...formData, wechatId: e.target.value})} placeholder="wxid_12345" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Main Products</label>
          <textarea required rows={2} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
            value={formData.products} onChange={e => setFormData({...formData, products: e.target.value})} placeholder="e.g. Consumer Electronics, LED Lights" />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-70 mt-4"
        >
          {isSubmitting ? 'Creating...' : 'Join & Get Points'}
        </button>
      </form>
    </div>
  );
};

// 4. Home / Points Center
const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const u = getCurrentUser();
    if (u) {
      setUser(u);
      setLogs(getPointLogs(u.id));
      setTasks(getTasks());
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handleOpenTask = (taskId: string, url?: string) => {
    if (url) window.open(url, '_blank');
    setPendingTasks(prev => new Set(prev).add(taskId));
  };

  const handleClaimTask = (taskId: string) => {
    if (!user) return;
    const success = completeTask(user.id, taskId);
    if (success) {
      const updatedUser = getCurrentUser();
      if(updatedUser) {
        setUser(updatedUser);
        setLogs(getPointLogs(updatedUser.id));
      }
    }
  };

  if (!user) return null;

  return (
    <div className="bg-gray-50 min-h-full pb-20">
      {/* Header */}
      <div className="bg-indigo-700 text-white p-6 pb-16 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-indigo-200 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold">{user.name}</h1>
          </div>
          <button onClick={() => { logout(); navigate('/'); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
            <LogOut size={16} />
          </button>
        </div>
        <div className="text-center mt-6">
          <h2 className="text-5xl font-extrabold">{user.totalPoints}</h2>
          <p className="text-indigo-200 text-sm mt-1 uppercase tracking-wider font-medium">Available Points</p>
        </div>
      </div>

      {/* Main Actions Card */}
      <div className="px-5 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-5 flex justify-between items-center">
            <div onClick={() => navigate('/rewards')} className="flex-1 flex flex-col items-center gap-2 cursor-pointer active:opacity-60">
                <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                    <Wallet size={24} />
                </div>
                <span className="text-sm font-semibold text-gray-700">Redeem</span>
            </div>
            <div className="w-px h-10 bg-gray-100 mx-2"></div>
            <div onClick={() => navigate('/invite')} className="flex-1 flex flex-col items-center gap-2 cursor-pointer active:opacity-60">
                <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                    <UsersIcon size={24} />
                </div>
                <span className="text-sm font-semibold text-gray-700">Invite</span>
            </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="px-6 mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Earn Points</h3>
        <div className="space-y-3">
            {tasks.map(task => {
                const isCompleted = user.completedTaskIds?.includes(task.id);
                const isPending = pendingTasks.has(task.id);

                return (
                    <div key={task.id} className={`p-4 rounded-xl border flex flex-col space-y-3 ${isCompleted ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className={`font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>{task.title}</h4>
                                <p className={`text-xs mt-1 ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>{task.description}</p>
                            </div>
                            <div className={`text-xs font-bold px-2 py-1 rounded-md ${isCompleted ? 'bg-white text-green-700 border border-green-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                +{task.points}
                            </div>
                        </div>

                        {!isCompleted ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleOpenTask(task.id, task.ctaLink)} 
                                    className="flex-1 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
                                >
                                    Go to Task
                                </button>
                                {isPending && (
                                    <button 
                                        onClick={() => handleClaimTask(task.id)} 
                                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium animate-pulse hover:bg-indigo-700 transition"
                                    >
                                        I Have Done It
                                    </button>
                                )}
                            </div>
                        ) : (
                             <div className="flex items-center gap-2 mt-1">
                                <CheckCircle className="text-green-600 w-4 h-4" />
                                <span className="text-xs font-medium text-green-800">Completed</span>
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 mt-8">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <History size={18} /> History
        </h3>
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-800 text-sm">{log.remark}</p>
                <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString()}</p>
              </div>
              <div className={`font-bold ${log.pointsDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {log.pointsDelta > 0 ? '+' : ''}{log.pointsDelta}
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No activity yet.</p>}
        </div>
      </div>
    </div>
  );
};

// 5. Redemption Page (Success)
const RedemptionPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [redemption, setRedemption] = useState<Redemption | null>(null);

    useEffect(() => {
        if (id) {
            const r = getRedemption(id);
            if (r) setRedemption(r);
            else navigate('/rewards');
        }
    }, [id, navigate]);

    if (!redemption) return null;

    return (
        <div className="p-6 pb-24 min-h-screen bg-gray-50 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-sm mt-10">
                <CheckCircle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Redemption Success!</h1>
            <p className="text-gray-500 mb-8 px-4">You have successfully used your points for this reward.</p>

            <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-indigo-50 mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-4">{redemption.rewardName}</h2>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 break-all">
                    {/* URL Delivery */}
                    {redemption.deliverMethod === DeliverMethod.URL && (
                        <div className="space-y-4">
                             <p className="text-sm text-gray-500 font-medium">Access your resource here:</p>
                             <a href={redemption.deliverContent} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md">
                                Open Resource <ExternalLink size={18} />
                             </a>
                             <div className="text-xs text-gray-400 mt-2 font-mono break-all bg-white p-2 rounded border">{redemption.deliverContent}</div>
                        </div>
                    )}
                    
                    {/* Code Delivery */}
                    {redemption.deliverMethod === DeliverMethod.CODE && (
                        <div className="space-y-4">
                             <p className="text-sm text-gray-500 font-medium">Here is your code:</p>
                             <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 flex flex-col items-center gap-2">
                                <span className="text-2xl font-mono font-bold text-indigo-700 tracking-wider">{redemption.deliverContent}</span>
                             </div>
                             <button onClick={() => {navigator.clipboard.writeText(redemption.deliverContent); alert('Code Copied!');}} className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black shadow-md">
                                <Copy size={18} /> Copy Code
                             </button>
                        </div>
                    )}

                    {/* Text Delivery */}
                    {redemption.deliverMethod === DeliverMethod.TEXT && (
                        <div className="space-y-2 text-left">
                             <p className="text-sm text-gray-500 font-medium text-center">Instruction / Content:</p>
                             <div className="bg-white p-4 rounded-xl border text-gray-800 text-sm whitespace-pre-wrap">
                                {redemption.deliverContent}
                             </div>
                        </div>
                    )}
                </div>
            </div>

            <button onClick={() => navigate('/home')} className="text-gray-500 font-medium hover:text-indigo-600 transition">Back to Home</button>
        </div>
    );
};

// 6. Rewards Page
const RewardsPage = () => {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    setRewards(getRewards());
    const u = getCurrentUser();
    if (u) {
        setUser(u);
        setRedemptions(getUserRedemptions(u.id));
    }
  }, []);

  const handleRedeem = (reward: Reward) => {
    if (!user) return;
    // Removed window.confirm to reduce friction and potential blocking issues
    const result = redeemReward(user.id, reward.id);
    if (result.success && result.redemptionId) {
       navigate(`/redemption/${result.redemptionId}`);
    } else {
      alert(result.message);
    }
  };

  if (!user) return null;

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* Sticky Points Header */}
      <div className="bg-white p-4 sticky top-0 z-20 shadow-sm flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><Wallet size={20}/></div>
            <span className="font-bold text-gray-800">Rewards Center</span>
        </div>
        <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-mono font-bold text-sm shadow-sm flex items-center gap-2">
             <Star size={14} className="text-yellow-400 fill-current" />
             {user.totalPoints} pts
        </div>
      </div>

      <div className="px-4 mb-8">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">My Redeemed Items</h3>
        {redemptions.length === 0 ? (
            <div className="text-center py-8 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
                No items redeemed yet.
            </div>
        ) : (
            <div className="space-y-4">
                {redemptions.map(r => {
                    const method = r.deliverMethod || DeliverMethod.URL;
                    return (
                        <div key={r.id} onClick={() => navigate(`/redemption/${r.id}`)} className="bg-white border-l-4 border-indigo-500 p-4 rounded-r-xl shadow-sm cursor-pointer hover:bg-gray-50 transition active:scale-[0.99]">
                            <h4 className="font-bold text-gray-800 text-sm">{r.rewardName}</h4>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                <div className="flex items-center gap-1 text-indigo-600 text-xs font-bold bg-indigo-50 px-2 py-1 rounded">
                                    <span>Access</span>
                                    <ArrowRight size={12} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      <div className="px-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">Available Rewards</h3>
        <div className="grid gap-6">
            {rewards.map(reward => {
                const canAfford = user.totalPoints >= reward.pointsRequired;
                const hasLandingPage = !!reward.landingPageId;
                const hasPoster = !!reward.posterId;

                return (
                    <div key={reward.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="h-32 bg-gray-200 relative group">
                             <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                             <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                                {reward.pointsRequired} PTS
                             </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <h4 className="font-bold text-gray-800 text-lg mb-1">{reward.name}</h4>
                            <p className="text-sm text-gray-500 flex-1 mb-5 line-clamp-2 leading-relaxed">{reward.description}</p>
                            
                            <div className="flex flex-col gap-3 mt-auto">
                                {/* Secondary Actions Row */}
                                {(hasLandingPage || hasPoster) && (
                                    <div className="flex gap-2">
                                        {hasLandingPage && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/lp/${reward.landingPageId}`);
                                                }}
                                                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-50 transition active:scale-95"
                                            >
                                                View Details
                                            </button>
                                        )}
                                        {hasPoster && (
                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/invite?posterId=${reward.posterId}`);
                                                }}
                                                className="flex-1 py-2.5 bg-green-50 border border-green-200 text-green-700 font-bold rounded-xl text-xs hover:bg-green-100 transition active:scale-95"
                                            >
                                                Earn Points
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                {/* Primary Action: Redeem */}
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRedeem(reward);
                                    }}
                                    disabled={!canAfford}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition shadow-lg active:scale-95 ${
                                        canAfford 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    {canAfford ? 'Redeem Now' : `Need ${reward.pointsRequired - user.totalPoints} more pts`}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

// 7. Invite Page
const InvitePage = () => {
    const location = useLocation();
    const [user, setUser] = useState<User | null>(null);
    const [templates, setTemplates] = useState<PosterTemplate[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    useEffect(() => {
        const u = getCurrentUser();
        setUser(u);
        const t = getPosterTemplates();
        setTemplates(t);
        
        // Handle deep link to specific poster
        const params = new URLSearchParams(location.search);
        const posterId = params.get('posterId');
        if (posterId && t.length > 0) {
            const idx = t.findIndex(p => p.id === posterId);
            if (idx !== -1) setCurrentIndex(idx);
        }
    }, [location.search]);

    useEffect(() => {
        const template = templates[currentIndex];
        if (!user || !template || !canvasRef.current) return;

        const generatePoster = async () => {
            setIsGenerating(true);
            const ctx = canvasRef.current!.getContext('2d');
            if (!ctx) return;
            const bgImg = new Image();
            bgImg.crossOrigin = "Anonymous";
            bgImg.src = template.backgroundUrl;
            const avatarImg = new Image();
            avatarImg.crossOrigin = "Anonymous";
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`;
            const qrImg = new Image();
            qrImg.crossOrigin = "Anonymous";
            const targetPath = template.landingPageId ? `/lp/${template.landingPageId}` : '/';
            const referralLink = `${window.location.origin}/#${targetPath}?ref=${user.referralCode}`;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${template.qrConfig.size}x${template.qrConfig.size}&data=${encodeURIComponent(referralLink)}`;
            await Promise.all([
                new Promise(r => bgImg.onload = r),
                new Promise(r => avatarImg.onload = r),
                new Promise(r => qrImg.onload = r)
            ]).catch(e => console.error("Image load error", e));
            canvasRef.current!.width = 300; 
            canvasRef.current!.height = 533; 
            const scale = Math.max(canvasRef.current!.width / bgImg.width, canvasRef.current!.height / bgImg.height);
            const x = (canvasRef.current!.width / 2) - (bgImg.width / 2) * scale;
            const y = (canvasRef.current!.height / 2) - (bgImg.height / 2) * scale;
            ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
            if (template.avatarConfig.visible) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(template.avatarConfig.x + template.avatarConfig.size/2, template.avatarConfig.y + template.avatarConfig.size/2, template.avatarConfig.size/2, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImg, template.avatarConfig.x, template.avatarConfig.y, template.avatarConfig.size, template.avatarConfig.size);
                ctx.restore();
            }
            if (template.nameConfig.visible) {
                ctx.fillStyle = template.nameConfig.color || '#000';
                ctx.font = `bold ${template.nameConfig.size}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(user.name, template.nameConfig.x, template.nameConfig.y);
            }
            if (template.qrConfig.visible) {
                ctx.drawImage(qrImg, template.qrConfig.x, template.qrConfig.y, template.qrConfig.size, template.qrConfig.size);
            }
            try { setPosterUrl(canvasRef.current!.toDataURL('image/png')); } catch (e) {}
            setIsGenerating(false);
        };
        generatePoster();
    }, [user, templates, currentIndex]);

    if (!user) return null;
    const handleDownload = () => { if (!posterUrl) return; const link = document.createElement('a'); link.download = `invite-${user.referralCode}.png`; link.href = posterUrl; link.click(); };
    const handleShareMoments = () => { handleDownload(); alert("Poster saved! You can now post it to your WeChat Moments."); };
    const handleShareChat = () => {
        const template = templates[currentIndex];
        const targetPath = template && template.landingPageId ? `/lp/${template.landingPageId}` : '/';
        const referralLink = `${window.location.origin}/#${targetPath}?ref=${user.referralCode}`;
        navigator.clipboard.writeText(referralLink); alert("Referral Link copied! Paste it to your friends on WeChat.");
    };
    const nextTemplate = () => setCurrentIndex(prev => (prev + 1) % templates.length);
    const prevTemplate = () => setCurrentIndex(prev => (prev - 1 + templates.length) % templates.length);

    return (
        <div className="p-6 pb-24 flex flex-col min-h-screen">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite Friends</h2>
            <div className="flex-1 flex flex-col items-center space-y-6">
                <canvas ref={canvasRef} className="hidden" />
                <div className="relative group">
                     {templates.length > 1 && <button onClick={prevTemplate} className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600"><ChevronLeft size={32} /></button>}
                    <div className="relative shadow-2xl rounded-xl overflow-hidden w-[260px] h-[462px] bg-gray-200">
                        {isGenerating ? <div className="absolute inset-0 flex items-center justify-center text-gray-500">Generating...</div> : posterUrl ? <img src={posterUrl} alt="Invite Poster" className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-red-500">Error</div>}
                    </div>
                    {templates.length > 1 && <button onClick={nextTemplate} className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600"><ChevronRight size={32} /></button>}
                </div>
                {templates.length > 1 && <p className="text-xs text-gray-400">Template {currentIndex + 1} of {templates.length}</p>}
                <div className="w-full space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleShareChat} className="flex flex-col items-center justify-center bg-green-500 text-white p-4 rounded-xl shadow-md active:scale-95 transition"><Share2 size={24} className="mb-1" /><span className="text-xs font-bold">Share to Friends</span></button>
                        <button onClick={handleShareMoments} className="flex flex-col items-center justify-center bg-indigo-500 text-white p-4 rounded-xl shadow-md active:scale-95 transition"><ImageIcon size={24} className="mb-1" /><span className="text-xs font-bold">Share to Timeline</span></button>
                    </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 mt-2"><p className="text-xs text-gray-500 uppercase font-semibold mb-2">Rewards</p><ul className="text-sm text-gray-700 space-y-1"><li className="flex justify-between"><span>Successful Invite</span><span className="font-bold text-green-600">+{POINTS_CONFIG.INVITE} Points</span></li></ul></div>
                </div>
            </div>
        </div>
    );
};

// 8. Profile Page
const ProfilePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const u = getCurrentUser();
        if (u) {
            setUser(u);
        } else {
            navigate('/');
        }
    }, [navigate]);

    if (!user) return null;

    return (
        <div className="p-6 pb-24 bg-gray-50 min-h-screen">
             <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                     <div className="w-24 h-24 bg-white p-1 rounded-full mx-auto mb-4 relative z-10 shadow-lg">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt="Profile" className="w-full h-full rounded-full object-cover" />
                     </div>
                     <h3 className="text-white font-bold text-xl relative z-10">{user.name}</h3>
                     <p className="text-indigo-200 text-sm relative z-10">{user.company}</p>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Role</label>
                             <p className="font-semibold text-gray-800 text-sm">{user.role}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Points</label>
                             <p className="font-semibold text-indigo-600 text-sm">{user.totalPoints} PTS</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Phone size={20} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mobile</label>
                                <p className="font-medium text-gray-800">{user.phone}</p>
                            </div>
                        </div>

                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                <Mail size={20} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">WeChat ID</label>
                                <p className="font-medium text-gray-800">{user.wechatId}</p>
                            </div>
                        </div>

                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Main Products</label>
                                <p className="font-medium text-gray-800">{user.mainProducts}</p>
                            </div>
                        </div>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                <Key size={20} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Referral Code</label>
                                <p className="font-mono font-bold text-gray-800 tracking-widest">{user.referralCode}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center justify-center gap-2 py-4 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 hover:text-red-500 transition">
                            <LogOut size={20} /> Sign Out
                        </button>
                    </div>
                </div>
             </div>
        </div>
    );
};

// 9. Admin Dashboard
const AdminPage = () => {
    const [mainTab, setMainTab] = useState<'users' | 'offers' | 'tasks'>('users');
    const [users, setUsers] = useState<User[]>([]);
    
    // Data Loading
    const [posters, setPosters] = useState<PosterTemplate[]>([]);
    const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
    const [tasks, setTasksState] = useState<Task[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);

    // Edit State
    const [viewMode, setViewMode] = useState<'list' | 'edit_offer' | 'edit_lp' | 'edit_poster' | 'edit_task'>('list');
    const [editingOffer, setEditingOffer] = useState<Reward | null>(null);
    const [editingLP, setEditingLP] = useState<LandingPage | null>(null);
    const [editingPoster, setEditingPoster] = useState<PosterTemplate | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Points Adjustment State
    const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
    const [adjustPointsData, setAdjustPointsData] = useState({ amount: 0, remark: '' });

    // Poster Editor local state
    const [selectedElement, setSelectedElement] = useState<'qr' | 'name' | 'avatar'>('qr');

    useEffect(() => {
        setUsers(getAllUsers());
        setPosters(getPosterTemplates());
        setLandingPages(getLandingPages());
        setTasksState(getTasks());
        setRewards(getRewards());
    }, [viewMode, mainTab]); // Reload data when switching views

    const handleAdjustPoints = (userId: string) => {
        if (adjustPointsData.amount === 0) return;
        addPoints(userId, adjustPointsData.amount, PointType.MANUAL_ADJUST, adjustPointsData.remark || 'Admin adjustment');
        setUsers(getAllUsers());
        setAdjustingUserId(null);
        setAdjustPointsData({ amount: 0, remark: '' });
        alert('Points adjusted successfully');
    };

    // --- Helpers to save and return to offer ---

    const handleSaveLP = () => {
        if(editingLP) {
            saveLandingPage(editingLP);
            setLandingPages(getLandingPages()); // Refresh
            if (editingOffer) {
                // If we were editing an offer, ensure it's linked
                setEditingOffer({ ...editingOffer, landingPageId: editingLP.id });
                setViewMode('edit_offer');
            } else {
                setViewMode('list');
            }
            setEditingLP(null);
        }
    };

    const handleSavePoster = () => {
        if(editingPoster) {
            savePosterTemplate(editingPoster);
            setPosters(getPosterTemplates());
            if (editingOffer) {
                setEditingOffer({ ...editingOffer, posterId: editingPoster.id });
                setViewMode('edit_offer');
            } else {
                setViewMode('list');
            }
            setEditingPoster(null);
        }
    };

    const handleSaveTask = () => {
        if(editingTask) {
            saveTask(editingTask);
            setTasksState(getTasks());
            // If we came from the Offer editor, go back there (though currently tasks are just checklist)
            // If we came from Task tab, go back to list
            if (editingOffer) {
                // We shouldn't be here in this flow with the new checklist logic, 
                // but just in case we kept the create button:
                const currentTasks = editingOffer.relatedTaskIds || [];
                if (!currentTasks.includes(editingTask.id)) {
                    setEditingOffer({ ...editingOffer, relatedTaskIds: [...currentTasks, editingTask.id] });
                }
                setViewMode('edit_offer');
            } else {
                setViewMode('list');
            }
            setEditingTask(null);
        }
    };

    const handleDeleteTask = (id: string) => {
        if(confirm("Delete this task?")) {
            deleteTask(id);
            setTasksState(getTasks());
            if(editingTask?.id === id) setEditingTask(null);
            setViewMode('list');
        }
    };

    const handleSaveOffer = () => {
        if (editingOffer) {
            saveReward(editingOffer);
            setRewards(getRewards());
            setEditingOffer(null);
            setViewMode('list');
        }
    };

    // --- Renderers ---

    const renderOfferList = () => (
        <div className="space-y-4">
             <button onClick={() => { 
                 setEditingOffer({
                    id: generateId(),
                    name: 'New Offer',
                    type: RewardType.PAGE,
                    pointsRequired: 100,
                    description: '',
                    deliverMethod: DeliverMethod.URL,
                    deliverContent: '',
                    imageUrl: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?q=80&w=1000&auto=format&fit=crop',
                    relatedTaskIds: []
                 }); 
                 setViewMode('edit_offer'); 
            }} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 text-gray-500 flex items-center justify-center gap-2">
                <Plus size={20} /> <span className="font-bold">Create New Offer</span>
            </button>
            {rewards.map(offer => {
                const hasLP = !!offer.landingPageId;
                const hasPoster = !!offer.posterId;
                const taskCount = offer.relatedTaskIds?.length || 0;

                return (
                    <div key={offer.id} onClick={() => { setEditingOffer(offer); setViewMode('edit_offer'); }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer hover:bg-gray-50 relative">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={offer.imageUrl} alt={offer.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{offer.name}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">{offer.description || 'No description'}</p>
                            
                            <div className="flex items-center gap-3 mt-3">
                                <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${hasLP ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                    <Monitor size={10} /> {hasLP ? 'Page Linked' : 'No Page'}
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${hasPoster ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                    <ImageIcon size={10} /> {hasPoster ? 'Poster' : 'No Poster'}
                                </div>
                                {taskCount > 0 ? (
                                    <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                        <ListTodo size={10} /> {taskCount} Tasks
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                                        <ListTodo size={10} /> No Tasks
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute top-4 right-4">
                             <Edit size={16} className="text-gray-400"/>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderOfferEditor = () => {
        if (!editingOffer) return null;
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                     <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                     <h3 className="font-bold text-lg">Edit Offer</h3>
                </div>

                {/* 1. Details */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Offer Details</h4>
                    <input className="w-full text-sm border p-2 rounded" placeholder="Offer Name" value={editingOffer.name} onChange={e => setEditingOffer({...editingOffer, name: e.target.value})} />
                    <textarea className="w-full text-sm border p-2 rounded" placeholder="Description" rows={2} value={editingOffer.description} onChange={e => setEditingOffer({...editingOffer, description: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="number" className="w-full text-sm border p-2 rounded" placeholder="Points Cost" value={editingOffer.pointsRequired} onChange={e => setEditingOffer({...editingOffer, pointsRequired: parseInt(e.target.value) || 0})} />
                        <input className="w-full text-sm border p-2 rounded" placeholder="Image URL" value={editingOffer.imageUrl || ''} onChange={e => setEditingOffer({...editingOffer, imageUrl: e.target.value})} />
                    </div>
                </div>

                {/* 2. Delivery */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Delivery Option</h4>
                     <div className="flex gap-2 mb-2">
                        {[DeliverMethod.TEXT, DeliverMethod.URL, DeliverMethod.CODE].map(m => (
                            <button key={m} onClick={() => setEditingOffer({...editingOffer, deliverMethod: m})} className={`flex-1 py-2 text-xs font-medium rounded border ${editingOffer.deliverMethod === m ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white text-gray-600'}`}>
                                {m.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <input className="w-full text-sm border p-2 rounded" placeholder={editingOffer.deliverMethod === DeliverMethod.URL ? 'https://...' : 'Content / Code'} value={editingOffer.deliverContent} onChange={e => setEditingOffer({...editingOffer, deliverContent: e.target.value})} />
                    
                    {/* Auto-link Helper */}
                    {editingOffer.deliverMethod === DeliverMethod.URL && (
                         <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">Link to Landing Page:</span>
                            <select className="text-sm border p-1 rounded flex-1" 
                                value={editingOffer.deliverContent.includes('#/lp/') ? editingOffer.deliverContent.split('/lp/')[1] : ''}
                                onChange={e => {
                                    if(e.target.value) setEditingOffer({...editingOffer, deliverContent: window.location.origin + '/#/lp/' + e.target.value});
                                }}
                            >
                                <option value="">-- Custom URL --</option>
                                {landingPages.map(lp => <option key={lp.id} value={lp.id}>{lp.name}</option>)}
                            </select>
                         </div>
                    )}
                </div>

                {/* 3. Assets */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Linked Assets</h4>
                    
                    {/* Landing Page */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${editingOffer.landingPageId ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                                <Monitor size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Landing Page</p>
                                <select 
                                    className="text-xs bg-transparent border-none outline-none text-gray-500 p-0"
                                    value={editingOffer.landingPageId || ''}
                                    onChange={e => setEditingOffer({...editingOffer, landingPageId: e.target.value})}
                                >
                                    <option value="">No Page Linked</option>
                                    {landingPages.map(lp => <option key={lp.id} value={lp.id}>{lp.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {editingOffer.landingPageId && (
                                <button onClick={() => {
                                    const lp = landingPages.find(p => p.id === editingOffer.landingPageId);
                                    if(lp) { setEditingLP(lp); setViewMode('edit_lp'); }
                                }} className="p-2 bg-white border rounded hover:bg-gray-50 text-xs font-medium">Edit</button>
                            )}
                            <button onClick={() => {
                                setEditingLP({
                                    id: generateId(), name: 'New LP for ' + editingOffer.name, headline: 'New Headline', subheadline: 'Subheadline',
                                    heroImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop',
                                    bodyContent: 'Content...', ctaText: 'Sign Up', createdAt: new Date().toISOString()
                                });
                                setViewMode('edit_lp');
                            }} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-medium">Create New</button>
                        </div>
                    </div>

                    {/* Poster */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${editingOffer.posterId ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                                <ImageIcon size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Share Poster</p>
                                <select 
                                    className="text-xs bg-transparent border-none outline-none text-gray-500 p-0"
                                    value={editingOffer.posterId || ''}
                                    onChange={e => setEditingOffer({...editingOffer, posterId: e.target.value})}
                                >
                                    <option value="">No Poster Linked</option>
                                    {posters.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {editingOffer.posterId && (
                                <button onClick={() => {
                                    const p = posters.find(po => po.id === editingOffer.posterId);
                                    if(p) { setEditingPoster(p); setViewMode('edit_poster'); }
                                }} className="p-2 bg-white border rounded hover:bg-gray-50 text-xs font-medium">Edit</button>
                            )}
                            <button onClick={() => {
                                setEditingPoster({
                                    id: generateId(), name: 'Poster for ' + editingOffer.name, landingPageId: editingOffer.landingPageId,
                                    backgroundUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop',
                                    qrConfig: { x: 100, y: 350, size: 100, visible: true }, nameConfig: { x: 150, y: 320, size: 24, color: '#FFFFFF', visible: true },
                                    avatarConfig: { x: 150, y: 240, size: 60, visible: true }
                                });
                                setViewMode('edit_poster');
                            }} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-medium">Create New</button>
                        </div>
                    </div>

                    {/* Tasks Checklist */}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                         <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${(editingOffer.relatedTaskIds?.length || 0) > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                                <ListTodo size={20} />
                            </div>
                            <p className="text-sm font-bold text-gray-800">Assign Tasks to Offer</p>
                        </div>
                        
                        {tasks.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No tasks available. Create tasks in the "Tasks" tab.</p>
                        ) : (
                            <div className="space-y-2 mt-3">
                                {tasks.map(t => {
                                    const isChecked = editingOffer.relatedTaskIds?.includes(t.id);
                                    return (
                                        <label key={t.id} className="flex items-start gap-3 p-2 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                                            <input 
                                                type="checkbox" 
                                                className="mt-1"
                                                checked={isChecked || false} 
                                                onChange={(e) => {
                                                    const current = editingOffer.relatedTaskIds || [];
                                                    if (e.target.checked) {
                                                        setEditingOffer({...editingOffer, relatedTaskIds: [...current, t.id]});
                                                    } else {
                                                        setEditingOffer({...editingOffer, relatedTaskIds: current.filter(id => id !== t.id)});
                                                    }
                                                }}
                                            />
                                            <div>
                                                <p className="text-xs font-bold text-gray-800">{t.title} <span className="text-green-600">+{t.points} pts</span></p>
                                                <p className="text-[10px] text-gray-500">{t.description}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={() => { if(confirm('Delete offer?')) { deleteReward(editingOffer.id); setRewards(getRewards()); setViewMode('list'); } }} className="flex-1 py-3 text-red-500 font-bold bg-white border border-gray-200 rounded-xl">Delete</button>
                    <button onClick={handleSaveOffer} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Save Offer</button>
                </div>
            </div>
        );
    };

    const renderLPEditor = () => {
        if (!editingLP) return null;
        return (
            <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                     <button onClick={() => setViewMode('edit_offer')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                     <h3 className="font-bold text-lg">Edit Landing Page</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <div><label className="text-xs font-bold text-gray-500">Page Name</label><input className="w-full text-sm border p-2 rounded" value={editingLP.name} onChange={e => setEditingLP({...editingLP, name: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Headline</label><input className="w-full text-sm border p-2 rounded" value={editingLP.headline} onChange={e => setEditingLP({...editingLP, headline: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Subheadline</label><textarea rows={2} className="w-full text-sm border p-2 rounded" value={editingLP.subheadline} onChange={e => setEditingLP({...editingLP, subheadline: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Hero Image URL</label><input className="w-full text-sm border p-2 rounded" value={editingLP.heroImageUrl} onChange={e => setEditingLP({...editingLP, heroImageUrl: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Body Content</label><textarea rows={4} className="w-full text-sm border p-2 rounded" value={editingLP.bodyContent} onChange={e => setEditingLP({...editingLP, bodyContent: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">CTA Text</label><input className="w-full text-sm border p-2 rounded" value={editingLP.ctaText} onChange={e => setEditingLP({...editingLP, ctaText: e.target.value})} /></div>
                    <button onClick={handleSaveLP} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4">Save Page</button>
                </div>
            </div>
        );
    };

    const renderPosterEditor = () => {
        if (!editingPoster) return null;
        // Reuse logic from previous implementation
        const handlePosterImageClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const newTemplate = { ...editingPoster };
            if (selectedElement === 'qr') { newTemplate.qrConfig.x = Math.round(x - newTemplate.qrConfig.size/2); newTemplate.qrConfig.y = Math.round(y - newTemplate.qrConfig.size/2); }
            else if (selectedElement === 'name') { newTemplate.nameConfig.x = Math.round(x); newTemplate.nameConfig.y = Math.round(y); }
            else if (selectedElement === 'avatar') { newTemplate.avatarConfig.x = Math.round(x - newTemplate.avatarConfig.size/2); newTemplate.avatarConfig.y = Math.round(y - newTemplate.avatarConfig.size/2); }
            setEditingPoster(newTemplate);
        };

        return (
            <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                     <button onClick={() => setViewMode('edit_offer')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                     <h3 className="font-bold text-lg">Edit Poster</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Name</label><input className="w-full text-sm border p-2 rounded" value={editingPoster.name} onChange={e => setEditingPoster({...editingPoster, name: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Background URL</label><input className="w-full text-sm border p-2 rounded" value={editingPoster.backgroundUrl} onChange={e => setEditingPoster({...editingPoster, backgroundUrl: e.target.value})} /></div>
                    
                    <div className="flex flex-wrap gap-2 my-2">
                        <button onClick={() => setSelectedElement('qr')} className={`px-3 py-1 rounded-full text-xs font-bold ${selectedElement === 'qr' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>QR Code</button>
                        <button onClick={() => setSelectedElement('avatar')} className={`px-3 py-1 rounded-full text-xs font-bold ${selectedElement === 'avatar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Avatar</button>
                        <button onClick={() => setSelectedElement('name')} className={`px-3 py-1 rounded-full text-xs font-bold ${selectedElement === 'name' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Name</button>
                    </div>

                    <div className="border p-2 bg-gray-50 rounded text-center">
                        <div className="relative w-[200px] h-[355px] border-2 border-dashed border-gray-300 mx-auto overflow-hidden cursor-crosshair shadow-sm" onClick={handlePosterImageClick}>
                            <img src={editingPoster.backgroundUrl} className="w-full h-full object-cover pointer-events-none absolute inset-0" alt="bg" />
                            {editingPoster.qrConfig.visible && <div className={`absolute border-2 ${selectedElement === 'qr' ? 'border-blue-500 bg-blue-500/20' : 'border-transparent'}`} style={{ left: editingPoster.qrConfig.x * 0.66, top: editingPoster.qrConfig.y * 0.66, width: editingPoster.qrConfig.size * 0.66, height: editingPoster.qrConfig.size * 0.66 }}><div className="w-full h-full bg-white/80"></div></div>}
                            {editingPoster.avatarConfig.visible && <div className={`absolute rounded-full border-2 ${selectedElement === 'avatar' ? 'border-blue-500 bg-blue-500/20' : 'border-transparent'}`} style={{ left: editingPoster.avatarConfig.x * 0.66, top: editingPoster.avatarConfig.y * 0.66, width: editingPoster.avatarConfig.size * 0.66, height: editingPoster.avatarConfig.size * 0.66 }}><div className="w-full h-full bg-gray-300 rounded-full"></div></div>}
                            {editingPoster.nameConfig.visible && <div className={`absolute whitespace-nowrap border-2 ${selectedElement === 'name' ? 'border-blue-500 bg-blue-500/20' : 'border-transparent'}`} style={{ left: editingPoster.nameConfig.x * 0.66, top: editingPoster.nameConfig.y * 0.66, fontSize: editingPoster.nameConfig.size * 0.66, color: editingPoster.nameConfig.color }}>Name</div>}
                        </div>
                    </div>
                    <button onClick={handleSavePoster} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4">Save Poster</button>
                </div>
            </div>
        );
    };

    const renderTaskEditor = () => {
        if (!editingTask) return null;
        return (
            <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                     <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                     <h3 className="font-bold text-lg">Edit Task</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <div><label className="text-xs font-bold text-gray-500">Task Title</label><input className="w-full text-sm border p-2 rounded" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Description</label><textarea rows={2} className="w-full text-sm border p-2 rounded" value={editingTask.description} onChange={e => setEditingTask({...editingTask, description: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Points Reward</label><input type="number" className="w-full text-sm border p-2 rounded" value={editingTask.points} onChange={e => setEditingTask({...editingTask, points: parseInt(e.target.value) || 0})} /></div>
                    <div><label className="text-xs font-bold text-gray-500">Action Link (Optional)</label><input className="w-full text-sm border p-2 rounded" value={editingTask.ctaLink || ''} onChange={e => setEditingTask({...editingTask, ctaLink: e.target.value})} /></div>
                    <button onClick={handleSaveTask} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4">Save Task</button>
                </div>
            </div>
        );
    };

    const renderTaskList = () => (
        <div className="space-y-4">
            <button onClick={() => {
                 setEditingTask({ id: generateId(), title: 'New Task', description: '', points: 10, createdAt: new Date().toISOString() });
                 setViewMode('edit_task');
            }} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 text-gray-500 flex items-center justify-center gap-2">
                <Plus size={20} /> <span className="font-bold">Create New Task</span>
            </button>
            {tasks.map(t => (
                <div key={t.id} onClick={() => { setEditingTask(t); setViewMode('edit_task'); }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                            <ListTodo size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                {t.title}
                                {t.isSystem && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">System</span>}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-1">{t.description}</p>
                            <p className="text-xs font-bold text-green-600 mt-1">+{t.points} Points</p>
                        </div>
                    </div>
                    {!t.isSystem && (
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                    )}
                </div>
            ))}
        </div>
    );

    // --- Main Admin Render ---

    return (
        <div className="p-6 pb-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ShieldAlert className="text-red-500" /> Admin
            </h2>

            {/* Main Navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
                <button onClick={() => { setMainTab('users'); setViewMode('list'); }} className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${mainTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Users</button>
                <button onClick={() => { setMainTab('offers'); setViewMode('list'); }} className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${mainTab === 'offers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Offers</button>
                <button onClick={() => { setMainTab('tasks'); setViewMode('list'); }} className={`px-4 py-2 text-sm font-bold whitespace-nowrap ${mainTab === 'tasks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Tasks</button>
            </div>
            
            {mainTab === 'users' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700">All Users ({users.length})</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {users.map(u => {
                            const inviterName = u.invitedBy ? users.find(i => i.id === u.invitedBy)?.name || 'Unknown' : 'Direct';
                            return (
                                <div key={u.id} className="p-4 hover:bg-gray-50 transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <div><h4 className="font-bold text-gray-800 text-lg">{u.name}</h4><p className="text-xs text-gray-500">{u.company} • {u.role}</p></div>
                                        <div className="flex flex-col items-end gap-1"><span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded text-xs">{u.totalPoints} pts</span><button onClick={() => { setAdjustingUserId(u.id); setAdjustPointsData({ amount: 0, remark: '' }); }} className="text-[10px] flex items-center gap-1 text-gray-500 hover:text-indigo-600 bg-gray-50 px-2 py-1 rounded"><Settings size={10} /> Adjust</button></div>
                                    </div>
                                    {adjustingUserId === u.id && (
                                        <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                            <p className="text-xs font-bold text-indigo-800 mb-2">Adjust Points</p>
                                            <div className="flex gap-2 mb-2"><input type="number" placeholder="+/-" className="w-20 text-xs border p-2 rounded" value={adjustPointsData.amount} onChange={e => setAdjustPointsData({...adjustPointsData, amount: parseInt(e.target.value) || 0})} /><input type="text" placeholder="Reason" className="flex-1 text-xs border p-2 rounded" value={adjustPointsData.remark} onChange={e => setAdjustPointsData({...adjustPointsData, remark: e.target.value})} /></div>
                                            <div className="flex gap-2"><button onClick={() => handleAdjustPoints(u.id)} className="flex-1 text-xs bg-indigo-600 text-white px-3 py-2 rounded">Confirm</button><button onClick={() => setAdjustingUserId(null)} className="flex-1 text-xs bg-white text-gray-700 border px-3 py-2 rounded">Cancel</button></div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-gray-600">
                                        <div className="flex items-center gap-2"><Phone size={12} className="text-gray-400" /><span>{u.phone}</span></div>
                                        <div className="flex items-center gap-2"><Calendar size={12} className="text-gray-400" /><span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {mainTab === 'offers' && (
                <div>
                    {viewMode === 'list' && renderOfferList()}
                    {viewMode === 'edit_offer' && renderOfferEditor()}
                    {viewMode === 'edit_lp' && renderLPEditor()}
                    {viewMode === 'edit_poster' && renderPosterEditor()}
                    {viewMode === 'edit_task' && renderTaskEditor()}
                </div>
            )}

            {mainTab === 'tasks' && (
                <div>
                    {viewMode === 'list' && renderTaskList()}
                    {viewMode === 'edit_task' && renderTaskEditor()}
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPageWrapper />} />
          <Route path="/lp/:id" element={<DynamicLandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/redemption/:id" element={<RedemptionPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;