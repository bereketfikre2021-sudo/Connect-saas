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
