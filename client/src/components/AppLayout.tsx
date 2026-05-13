import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';

const ROLE_LABELS: Record<UserRole, string> = {
  requester: 'Requester',
  support_agent: 'Support Agent',
  admin: 'Admin',
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  requester: 'bg-slate-500/20 text-slate-300',
  support_agent: 'bg-teal-500/20 text-teal-400',
  admin: 'bg-amber-500/20 text-amber-400',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-800 border-r border-navy-700 flex flex-col shrink-0">
        {/* Branding */}
        <div className="px-6 py-5 border-b border-navy-700">
          <span className="text-xl font-bold text-teal-400 tracking-tight">CloudDesk</span>
          <p className="text-xs text-navy-400 mt-0.5">ITSM Platform</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/tickets', label: 'Tickets' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-400'
                    : 'text-navy-300 hover:bg-navy-700 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="px-4 py-4 border-t border-navy-700 shrink-0">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-navy-400 truncate mt-0.5">{user.email}</p>
              <span
                className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                  ROLE_BADGE_CLASSES[user.role]
                }`}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className="text-xs text-navy-400 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-navy-900 overflow-y-auto">{children}</main>
    </div>
  );
}
