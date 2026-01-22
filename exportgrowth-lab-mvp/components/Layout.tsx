import React from 'react';
import { Home, Gift, User, Users, ShieldAlert } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, isActive }: { to: string; icon: any; label: string; isActive: boolean }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center w-full py-2 space-y-1 ${
      isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
    <span className="text-[10px] font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/' || location.pathname === '/register';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col">
        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto no-scrollbar ${!isAuthPage ? 'pb-20' : ''}`}>
          {children}
        </main>

        {/* Bottom Navigation - Hidden on Landing/Register */}
        {!isAuthPage && (
          <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center px-2 pb-safe z-50 h-16">
            <NavItem 
              to="/home" 
              icon={Home} 
              label="Home" 
              isActive={location.pathname === '/home'} 
            />
             <NavItem 
              to="/rewards" 
              icon={Gift} 
              label="Rewards" 
              isActive={location.pathname === '/rewards'} 
            />
            <NavItem 
              to="/invite" 
              icon={Users} 
              label="Invite" 
              isActive={location.pathname === '/invite'} 
            />
            <NavItem 
              to="/profile" 
              icon={User} 
              label="Profile" 
              isActive={location.pathname === '/profile'} 
            />
             <NavItem 
              to="/admin" 
              icon={ShieldAlert} 
              label="Admin" 
              isActive={location.pathname === '/admin'} 
            />
          </nav>
        )}
      </div>
    </div>
  );
};
