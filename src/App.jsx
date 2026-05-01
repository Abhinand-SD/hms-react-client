import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { RequireAuth, RequireRole, RedirectHome } from './components/RouteGuards';
import Login from './pages/Login';
import UsersAdmin from './pages/UsersAdmin';
import DashboardRouter from './pages/dashboards/DashboardRouter';
import Doctors from './pages/masters/Doctors';
import Rates from './pages/masters/Rates';
import Wards from './pages/masters/Wards';
import PaymentModes from './pages/masters/PaymentModes';
import Services from './pages/masters/Services';
import PatientsList from './pages/patients/PatientsList';
import PatientRegistration from './pages/patients/PatientRegistration';
import PatientDetail from './pages/patients/PatientDetail';
import AppointmentsDashboard from './pages/appointments/AppointmentsDashboard';
import LiveQueue from './pages/queue/LiveQueue';
import BillingDashboard from './pages/billing/BillingDashboard';
import FinancialReports from './pages/reports/FinancialReports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"     element={<Login />} />
          <Route path="/users"     element={<RequireRole roles={['ADMIN']}><UsersAdmin /></RequireRole>} />
          <Route path="/dashboard" element={<RequireAuth><DashboardRouter /></RequireAuth>} />

          {/* Patients */}
          <Route path="/patients"          element={<RequireAuth><PatientsList /></RequireAuth>} />
          <Route path="/patients/new"      element={<RequireAuth><PatientRegistration /></RequireAuth>} />
          <Route path="/patients/:id/edit" element={<RequireAuth><PatientRegistration /></RequireAuth>} />
          <Route path="/patients/:id"      element={<RequireAuth><PatientDetail /></RequireAuth>} />

          {/* Appointments */}
          <Route path="/appointments" element={<RequireAuth><AppointmentsDashboard /></RequireAuth>} />

          {/* OPD Live Queue */}
          <Route path="/queue" element={<RequireAuth><LiveQueue /></RequireAuth>} />

          {/* Billing & Checkout */}
          <Route path="/billing" element={<RequireRole roles={['ADMIN', 'RECEPTIONIST']}><BillingDashboard /></RequireRole>} />

          {/* Reports (Admin) */}
          <Route path="/reports" element={<RequireRole roles={['ADMIN']}><FinancialReports /></RequireRole>} />

          {/* Masters */}
          <Route path="/masters/doctors"       element={<RequireAuth><Doctors /></RequireAuth>} />
          <Route path="/masters/rates"         element={<RequireAuth><Rates /></RequireAuth>} />
          <Route path="/masters/wards"         element={<RequireAuth><Wards /></RequireAuth>} />
          <Route path="/masters/payment-modes" element={<RequireAuth><PaymentModes /></RequireAuth>} />
          <Route path="/masters/services"      element={<RequireRole roles={['ADMIN']}><Services /></RequireRole>} />

          <Route path="/" element={<RedirectHome />} />
          <Route path="*" element={<RedirectHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
