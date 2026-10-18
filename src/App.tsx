import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

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

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

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
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
