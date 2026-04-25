import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './Button';
import hospitalLogo from '../assets/hospital_logo.png';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: null },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['ADMIN'] },
  { label: 'Masters', divider: true },
  { to: '/masters/doctors', label: 'Doctors', icon: DoctorIcon, roles: null },
  { to: '/masters/rates', label: 'Rates', icon: RatesIcon, roles: null },
  { to: '/masters/wards', label: 'Wards', icon: WardIcon, roles: null },
  { to: '/masters/payment-modes', label: 'Payment Modes', icon: PayIcon, roles: null },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    window.location.href = '/login';
  }

  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
          <img src={hospitalLogo} alt="HMS" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-sm font-semibold text-slate-900">HMS</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleNav.map((item, i) => {
            if (item.divider) {
              return (
                <div key={i} className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-3 py-3">
          <div className="mb-2 px-1">
            <div className="text-xs font-medium text-slate-800 truncate">{user?.fullName}</div>
            <div className="text-[10px] text-slate-500">{user?.role} · {user?.employeeId}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={onLogout} className="w-full justify-center">
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6.5L8 2l6 4.5V14H2V6.5z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M11 2.5a2.5 2.5 0 0 1 0 5" />
      <path d="M15 14c0-2.5-1.5-4.5-4-5" />
    </svg>
  );
}

function DoctorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" />
      <path d="M3 15c0-3 2-5 5-5s5 2 5 5" />
      <path d="M11.5 9v3M10 10.5h3" />
    </svg>
  );
}

function RatesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M5 8h6M5 5h3M5 11h4" />
    </svg>
  );
}

function WardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="7" width="6" height="5" rx="1" />
      <rect x="9" y="7" width="6" height="5" rx="1" />
      <path d="M4 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M1 14h14" />
    </svg>
  );
}

function PayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="14" height="9" rx="1.5" />
      <path d="M1 7h14" />
      <circle cx="5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
