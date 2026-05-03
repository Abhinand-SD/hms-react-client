import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './Button';
import hospitalLogo from '../assets/KHC-logo.svg';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: null, hideForRoles: ['DOCTOR'] },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['ADMIN'] },
  { to: '/patients',      label: 'Patients',     icon: PatientIcon,     roles: null },
  { to: '/appointments',  label: 'Appointments', icon: CalendarIcon,    roles: null },
  // { to: '/queue',         label: 'Live Queue',   icon: QueueIcon,       roles: null },
  { to: '/billing',       label: 'Billing',      icon: BillingIcon,     roles: ['ADMIN', 'RECEPTIONIST'] },
  { to: '/diagnostics',   label: 'Diagnostics',  icon: DiagnosticsIcon, roles: ['ADMIN', 'RECEPTIONIST'] },
  { to: '/reports',       label: 'Reports',      icon: ReportsIcon,     roles: ['ADMIN'] },
  { label: 'Masters', divider: true, hideForRoles: ['DOCTOR'] },
  { to: '/masters/services',      label: 'Services',      icon: ServicesIcon, roles: ['ADMIN'] },
  { to: '/masters/doctors',       label: 'Doctors',       icon: DoctorIcon,   roles: null, hideForRoles: ['DOCTOR'] },
  { to: '/masters/rates',         label: 'Rates',         icon: RatesIcon,    roles: null, hideForRoles: ['DOCTOR'] },
  { to: '/masters/wards',         label: 'Wards',         icon: WardIcon,     roles: null, hideForRoles: ['DOCTOR'] },
  { to: '/masters/payment-modes', label: 'Payment Modes', icon: PayIcon,      roles: null, hideForRoles: ['DOCTOR'] },
];

function formatRole(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    window.location.href = '/login';
  }

  const visibleNav = NAV.filter((item) => {
    if (item.hideForRoles && item.hideForRoles.includes(user?.role)) return false;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <img
            src={hospitalLogo}
            alt="Karunya Hrudayalaya Cardiac Center"
            className="h-10 w-auto max-w-[140px] object-contain"
          />
          {user?.role && (
            <span className="text-sm text-gray-500">
              {formatRole(user.role)}
            </span>
          )}
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

      <main className="flex-1 h-full min-w-0 overflow-y-auto no-scrollbar">
        {children}
      </main>
    </div>
  );
}

function QueueIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="2.5" cy="4" r="1" fill="currentColor" stroke="none" />
      <path d="M5.5 4h9" />
      <circle cx="2.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <path d="M5.5 8h6.5" />
      <circle cx="2.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M5.5 12h4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <path d="M1.5 6.5h13" />
      <path d="M5 1.5v2M11 1.5v2" />
      <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PatientIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="4.5" r="2.5" />
      <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    </svg>
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

function BillingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="1.5" width="9" height="13" rx="1.5" />
      <path d="M5 5h3M5 8h3M5 11h2" />
      <path d="M11 8h3M12.5 6.5v3" />
    </svg>
  );
}

function DiagnosticsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 1.5h5M6 1.5v4.5L3.5 11.5A1 1 0 0 0 4.4 13h7.2a1 1 0 0 0 .9-1.5L10 6V1.5" />
      <path d="M4.5 9.5h7" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M5 11V7M8 11V5M11 11V9" strokeLinecap="round" />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z" />
      <path d="M8 5v3l2 2" strokeLinecap="round" />
    </svg>
  );
}
