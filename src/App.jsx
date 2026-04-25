import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { RequireAuth, RequireRole, RedirectHome } from './components/RouteGuards';
import Login from './pages/Login';
import UsersAdmin from './pages/UsersAdmin';
import Dashboard from './pages/Dashboard';
import Doctors from './pages/masters/Doctors';
import Rates from './pages/masters/Rates';
import Wards from './pages/masters/Wards';
import PaymentModes from './pages/masters/PaymentModes';
import PatientsList from './pages/patients/PatientsList';
import PatientRegistration from './pages/patients/PatientRegistration';
import PatientDetail from './pages/patients/PatientDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/users"
            element={
              <RequireRole roles={['ADMIN']}>
                <UsersAdmin />
              </RequireRole>
            }
          />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

          {/* Patient routes — static before dynamic */}
          <Route path="/patients" element={<RequireAuth><PatientsList /></RequireAuth>} />
          <Route path="/patients/new" element={<RequireAuth><PatientRegistration /></RequireAuth>} />
          <Route path="/patients/:id/edit" element={<RequireAuth><PatientRegistration /></RequireAuth>} />
          <Route path="/patients/:id" element={<RequireAuth><PatientDetail /></RequireAuth>} />

          {/* Masters */}
          <Route path="/masters/doctors" element={<RequireAuth><Doctors /></RequireAuth>} />
          <Route path="/masters/rates" element={<RequireAuth><Rates /></RequireAuth>} />
          <Route path="/masters/wards" element={<RequireAuth><Wards /></RequireAuth>} />
          <Route path="/masters/payment-modes" element={<RequireAuth><PaymentModes /></RequireAuth>} />

          <Route path="/" element={<RedirectHome />} />
          <Route path="*" element={<RedirectHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
