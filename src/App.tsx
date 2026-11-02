import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

// Eagerly load critical pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Lazy load all other pages — reduces initial bundle size
const ClientsPage         = lazy(() => import('./pages/ClientsPage'));
const QuotationsPage      = lazy(() => import('./pages/QuotationsPage'));
const QuotationEditorPage = lazy(() => import('./pages/QuotationEditorPage'));
const QuotationDetailPage = lazy(() => import('./pages/QuotationDetailPage'));
const QuotationPortalPage = lazy(() => import('./pages/QuotationPortalPage'));
const ProjectsPage       = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage  = lazy(() => import('./pages/ProjectDetailPage'));
const ProposalsPage      = lazy(() => import('./pages/ProposalsPage'));
const ProposalEditorPage = lazy(() => import('./pages/ProposalEditorPage'));
const ProposalDetailPage = lazy(() => import('./pages/ProposalDetailPage'));
const ContractPage       = lazy(() => import('./pages/ContractPage'));
const ClientPortalPage   = lazy(() => import('./pages/ClientPortalPage'));
const InvoicesPage       = lazy(() => import('./pages/InvoicesPage'));
const InvoiceEditorPage  = lazy(() => import('./pages/InvoiceEditorPage'));
const InvoiceDetailPage  = lazy(() => import('./pages/InvoiceDetailPage'));
const PaymentsPage       = lazy(() => import('./pages/PaymentsPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const TasksPage          = lazy(() => import('./pages/TasksPage'));
const CreativesPage      = lazy(() => import('./pages/CreativesPage'));
const FilesPage          = lazy(() => import('./pages/FilesPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-navy" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Unprotected */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public portals */}
          <Route path="/portal/:token" element={<Suspense fallback={<PageLoader />}><ClientPortalPage /></Suspense>} />
          <Route path="/quotation-portal/:token" element={<Suspense fallback={<PageLoader />}><QuotationPortalPage /></Suspense>} />

          {/* Protected admin routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
              <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
              <Route path="projects/:id" element={<Suspense fallback={<PageLoader />}><ProjectDetailPage /></Suspense>} />
              <Route path="proposals" element={<Suspense fallback={<PageLoader />}><ProposalsPage /></Suspense>} />
              <Route path="quotations" element={<Suspense fallback={<PageLoader />}><QuotationsPage /></Suspense>} />
              <Route path="quotations/new" element={<Suspense fallback={<PageLoader />}><QuotationEditorPage /></Suspense>} />
              <Route path="quotations/:id" element={<Suspense fallback={<PageLoader />}><QuotationDetailPage /></Suspense>} />
              <Route path="quotations/:id/edit" element={<Suspense fallback={<PageLoader />}><QuotationEditorPage /></Suspense>} />
              <Route path="proposals/new" element={<Suspense fallback={<PageLoader />}><ProposalEditorPage /></Suspense>} />
              <Route path="proposals/:id" element={<Suspense fallback={<PageLoader />}><ProposalDetailPage /></Suspense>} />
              <Route path="proposals/:id/edit" element={<Suspense fallback={<PageLoader />}><ProposalEditorPage /></Suspense>} />
              <Route path="contracts/:id" element={<Suspense fallback={<PageLoader />}><ContractPage /></Suspense>} />
              <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
              <Route path="invoices/new" element={<Suspense fallback={<PageLoader />}><InvoiceEditorPage /></Suspense>} />
              <Route path="invoices/:id" element={<Suspense fallback={<PageLoader />}><InvoiceDetailPage /></Suspense>} />
              <Route path="invoices/:id/edit" element={<Suspense fallback={<PageLoader />}><InvoiceEditorPage /></Suspense>} />
              <Route path="payments" element={<Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TasksPage /></Suspense>} />
              <Route path="creatives" element={<Suspense fallback={<PageLoader />}><CreativesPage /></Suspense>} />
              <Route path="files" element={<Suspense fallback={<PageLoader />}><FilesPage /></Suspense>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
