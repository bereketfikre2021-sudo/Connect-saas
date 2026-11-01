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
