import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PlaceholderPage from './pages/PlaceholderPage';
import RegistryPage from './pages/registry/RegistryPage';
import AssetViewPage from './pages/asset-view/AssetViewPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import ApprovalsPage from './pages/ApprovalsPage';
import InspectionsPage from './pages/inspections/InspectionsPage';
import CapturePage from './pages/capture/CapturePage';
import UsersPage from './pages/users/UsersPage';
import AuditPage from './pages/AuditPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

// Pages not yet ported: [route, title, legacy html file]
const LEGACY: [string, string, string][] = [
  ['analytics', 'Analytics', 'analytics.html'],
  ['form-requests', 'Form Requests', 'form_requests.html'],
  ['ocr', 'OCR Scanner', 'ocr.html'], ['excel', 'Excel Import', 'excel.html'],
  ['filedb', 'File Database', 'filedb.html'],
  ['settings', 'Settings', 'settings.html'], ['guidelines', 'Guidelines', 'guidelines.html'],
];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="inspections" element={<InspectionsPage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="assets" element={<RegistryPage />} />
              <Route path="assets/:id" element={<AssetViewPage />} />
              {LEGACY.map(([path, title, file]) => (
                <Route key={path} path={path} element={<PlaceholderPage title={title} legacyPage={file} />} />
              ))}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
