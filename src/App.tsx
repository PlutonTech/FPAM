import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import { BASENAME, LOGIN_URL } from './config';

// Pages load on demand so the first visit stays fast.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const RegistryPage = lazy(() => import('./pages/registry/RegistryPage'));
const AssetViewPage = lazy(() => import('./pages/asset-view/AssetViewPage'));
const CapturePage = lazy(() => import('./pages/capture/CapturePage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const InspectionsPage = lazy(() => import('./pages/inspections/InspectionsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const FormRequestsPage = lazy(() => import('./pages/forms/FormRequestsPage'));
const OcrPage = lazy(() => import('./pages/OcrPage'));
const ExcelImportPage = lazy(() => import('./pages/ExcelImportPage'));
const FileDbPage = lazy(() => import('./pages/FileDbPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const GuidelinesPage = lazy(() => import('./pages/guidelines/GuidelinesPage'));
const MePage = lazy(() => import('./pages/me/MePage'));
const PortalPage = lazy(() => import('./pages/portal/PortalPage'));

// MDA Agents only ever see the compliance portal; staff never see it.
const MDA_AGENT = 'MDA Agent';

function RequireAuth({ children, portal }: { children: ReactNode; portal?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // Embedded in the public site: its own login page handles sign-in.
    if (LOGIN_URL) { window.location.replace(LOGIN_URL); return null; }
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!portal && user.role === MDA_AGENT) return <Navigate to="/portal" replace />;
  if (portal && user.role !== MDA_AGENT) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ExternalLogin() {
  window.location.replace(LOGIN_URL);
  return null;
}

const pageLoading = <div className="page loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>;

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={LOGIN_URL ? <ExternalLogin /> : <LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/portal" element={<RequireAuth portal><Suspense fallback={pageLoading}><PortalPage /></Suspense></RequireAuth>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="assets" element={<RegistryPage />} />
              <Route path="assets/:id" element={<AssetViewPage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="inspections" element={<InspectionsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="form-requests" element={<FormRequestsPage />} />
              <Route path="ocr" element={<OcrPage />} />
              <Route path="excel" element={<ExcelImportPage />} />
              <Route path="filedb" element={<FileDbPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="guidelines" element={<GuidelinesPage />} />
              <Route path="me" element={<MePage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
