import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Shared
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Investigator Pages
import AlertsPage from './pages/AlertsPage';
import InvestigationPage from './pages/InvestigationPage';
import FundFlowPage from './pages/FundFlowPage';
import TransactionsPage from './pages/TransactionsPage';
import ReportsPage from './pages/ReportsPage';
import FraudNetworksPage from './pages/FraudNetworksPage';

// Admin Pages
import SimulationPage from './pages/SimulationPage';
import SystemHealthPage from './pages/SystemHealthPage';
import UserManagementPage from './pages/UserManagementPage';
import RuleConfigurationPage from './pages/RuleConfigurationPage';
import MLMonitoringPage from './pages/MLMonitoringPage';
import AuditLogsPage from './pages/AuditLogsPage';
import APISecurityPage from './pages/APISecurityPage';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner w-10 h-10" />
          <p className="text-slate-400 text-sm">Loading BFI...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-slate-500">
          You do not have permission to view this page.
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Shared Overview */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

      {/* Investigator Routes */}
      <Route path="/alerts" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><AlertsPage /></ProtectedRoute>} />
      <Route path="/investigation" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><InvestigationPage /></ProtectedRoute>} />
      <Route path="/fund-flow" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><FundFlowPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><TransactionsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><ReportsPage /></ProtectedRoute>} />
      <Route path="/fraud-networks" element={<ProtectedRoute allowedRoles={['fraud_analyst']}><FraudNetworksPage /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagementPage /></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute allowedRoles={['admin']}><RuleConfigurationPage /></ProtectedRoute>} />
      <Route path="/ml-monitor" element={<ProtectedRoute allowedRoles={['admin']}><MLMonitoringPage /></ProtectedRoute>} />
      <Route path="/simulation" element={<ProtectedRoute allowedRoles={['admin']}><SimulationPage /></ProtectedRoute>} />
      <Route path="/system-health" element={<ProtectedRoute allowedRoles={['admin']}><SystemHealthPage /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
      <Route path="/api-security" element={<ProtectedRoute allowedRoles={['admin']}><APISecurityPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d2244',
              color: '#e2e8f0',
              border: '1px solid rgba(45,212,191,0.2)',
              borderRadius: '10px',
              fontSize: '13px',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
