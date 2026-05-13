import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';

const ROLE_LABELS: Record<UserRole, string> = {
  requester: 'Requester',
  support_agent: 'Support Agent',
  admin: 'Admin',
};

const STAT_CARDS = [
  { label: 'Total Tickets', value: '—' },
  { label: 'Open Tickets', value: '—' },
  { label: 'Resolved', value: '—' },
  { label: 'Critical', value: '—' },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-navy-400 text-sm mt-1">
            Welcome back,{' '}
            <span className="text-navy-300 font-medium">{user?.name}</span>
            {user && (
              <span className="ml-2 text-xs text-navy-500">
                · {ROLE_LABELS[user.role]}
              </span>
            )}
          </p>
        </div>

        {/* Metric cards — placeholder until dashboard API is wired */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="bg-navy-800 border border-navy-700 rounded-lg p-5"
            >
              <p className="text-sm text-navy-400 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-teal-400">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Coming soon panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-navy-800 border border-navy-700 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-white mb-2">Recent Tickets</h2>
            <p className="text-xs text-navy-500">Ticket module coming soon.</p>
          </div>

          <div className="bg-navy-800 border border-navy-700 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-white mb-2">Knowledge Base</h2>
            <p className="text-xs text-navy-500">Knowledge base module coming soon.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
