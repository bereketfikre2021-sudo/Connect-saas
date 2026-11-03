export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  /** Joined relation — populated by queries that include projects */
  projects?: Project[];
}

export type ProjectStatus = 'Pending' | 'In Progress' | 'Completed' | 'On Hold';

export interface Project {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  service: string;
  budget?: number;
  start_date?: string;
  deadline?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  /** Joined relation — populated by queries that include client */
  client?: Client;
}

export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Changes Requested' | 'Rejected';

export type ProposalResponseAction = 'Accepted' | 'Changes Requested' | 'Rejected';

export interface ProposalItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Proposal {
  id: string;
  client_id: string;
  title: string;
  introduction?: string;
  deliverables?: string;
  terms?: string;
  items: ProposalItem[];
  total_amount: number;
  currency: string;
  expiry_date?: string;
  status: ProposalStatus;
  portal_token: string;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface ProposalResponse {
  id: string;
  proposal_id: string;
  action: ProposalResponseAction;
  comment?: string;
  responded_at: string;
}

export interface ContractContent {
  client_name: string;
  client_company: string;
  client_email: string;
  proposal_title: string;
  items: ProposalItem[];
  total_amount: number;
  currency: string;
  deliverables?: string;
  terms?: string;
  issued_at: string;
}

export interface Contract {
  id: string;
  proposal_id: string;
  client_id: string;
  content: ContractContent;
  status: 'Draft' | 'Active';
  created_at: string;
  updated_at: string;
}

// ── Phase 3: Invoices & Payments ─────────────────────────────────────────────

export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Cancelled';
// Overdue is derived, not stored: status IN ('Unpaid','Partially Paid') AND due_date < today AND paid_amount < total_amount

export type PaymentMethod = 'CBE' | 'Telebirr' | 'Bank Transfer' | 'Cash' | 'Other';

export type PaymentSubmissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string;
  title: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined relations */
  agency_clients?: { name: string; company: string } | null;
  agency_projects?: { title: string } | null;
  items?: InvoiceItem[];
}

export interface PaymentSubmission {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_ref: string | null;
  payment_date: string;
  notes: string | null;
  receipt_path: string | null;
  status: PaymentSubmissionStatus;
  reviewed_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_ref: string | null;
  payment_date: string;
  notes: string | null;
  source: 'Submission' | 'Manual';
  submission_id: string | null;
  created_at: string;
}

export interface PortalToken {
  id: string;
  client_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

// ── Phase 3 Addition: Payment Settings ───────────────────────────────────────

export interface PaymentSetting {
  id: string;
  method_name: string;
  bank_name: string | null;
  account_holder: string;
  account_number: string;
  telebirr_phone: string;
  instructions: string | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Phase 4: Operations ───────────────────────────────────────────────────────

export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type MilestoneStatus = 'Upcoming' | 'In Progress' | 'Completed';
export type CreativeStatus = 'Pending' | 'Approved' | 'Revision Requested';

export interface Task {
  id: string;
  project_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  agency_projects?: { title: string } | null;
  agency_clients?: { name: string } | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface Creative {
  id: string;
  project_id: string;
  client_id: string;
  title: string;
  description: string | null;
  version: number;
  file_path: string;
  file_type: string;
  status: CreativeStatus;
  client_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  agency_projects?: { title: string } | null;
  agency_clients?: { name: string } | null;
}

export interface AgencyFile {
  id: string;
  client_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  file_path: string;
  file_type: string;
  file_size: number | null;
  shared_with_client: boolean;
  created_at: string;
  agency_projects?: { title: string } | null;
  agency_clients?: { name: string } | null;
}

// ── Quotations ────────────────────────────────────────────────────────────────

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
export type QuotationResponseAction = 'Accepted' | 'Rejected' | 'Changes Requested';

export interface QuotationItem {
  id: string;
  quotation_id: string;
  service_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export interface Quotation {
  id: string;
  client_id: string;
  quotation_number: string;
  title: string;
  status: QuotationStatus;
  issue_date: string;
  validity_date: string | null;
  estimated_delivery: string | null;
  currency: string;
  discount_type: 'fixed' | 'percentage' | null;
  discount_value: number;
  subtotal: number;
  discount_amount: number;
  total: number;
  scope: string | null;
  deliverables: string | null;
  timeline: string | null;
  terms: string | null;
  payment_terms: string | null;
  notes: string | null;
  access_token: string;
  original_quotation_id: string | null;
  converted_proposal_id: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
  agency_clients?: { name: string; company: string; email: string } | null;
  items?: QuotationItem[];
}

export interface QuotationResponse {
  id: string;
  quotation_id: string;
  action: QuotationResponseAction;
  comment: string | null;
  responded_at: string;
}
