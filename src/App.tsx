import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProposalsPage from './pages/ProposalsPage';
import ProposalEditorPage from './pages/ProposalEditorPage';
import ProposalDetailPage from './pages/ProposalDetailPage';
import ContractPage from './pages/ContractPage';
import ClientPortalPage from './pages/ClientPortalPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceEditorPage from './pages/InvoiceEditorPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import SettingsPage from './pages/SettingsPage';
import TasksPage from './pages/TasksPage';
import CreativesPage from './pages/CreativesPage';
import FilesPage from './pages/FilesPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Unprotected */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public client portal — no authentication required */}
          <Route path="/portal/:token" element={<ClientPortalPage />} />

          {/* Protected — all admin pages share the Layout shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="proposals" element={<ProposalsPage />} />
              <Route path="proposals/new" element={<ProposalEditorPage />} />
              <Route path="proposals/:id" element={<ProposalDetailPage />} />
              <Route path="proposals/:id/edit" element={<ProposalEditorPage />} />
              <Route path="contracts/:id" element={<ContractPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/new" element={<InvoiceEditorPage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="creatives" element={<CreativesPage />} />
              <Route path="files" element={<FilesPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
