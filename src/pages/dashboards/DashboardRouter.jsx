import { useAuth } from '../../lib/auth';
import AdminDashboard from './AdminDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import GenericDashboard from '../Dashboard';

// Picks the role-specific dashboard. DOCTOR and any future role fall back
// to the generic welcome dashboard so we never render a blank page.
export default function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN')        return <AdminDashboard />;
  if (user?.role === 'RECEPTIONIST') return <ReceptionistDashboard />;
  return <GenericDashboard />;
}
