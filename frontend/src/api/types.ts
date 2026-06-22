export type Role = "admin" | "user";
export type DashboardType = "static_html" | "excel";
export type Visibility = "restricted" | "internal" | "external" | "personal";

export interface Me {
  id: string;
  email: string;
  role: Role;
  display_name: string | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface Dashboard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: DashboardType;
  visibility: Visibility;
  group_name: string | null;
  excel_config: ExcelConfig | null;
  file_name: string | null;
  has_content: boolean;
  uploaded_at: string | null;
  updated_at: string;
}

export interface InvitationResult {
  email: string;
  invite_url: string;
  emailed: boolean;
}

export type ChartType = "bar" | "line" | "area" | "pie" | "none";

export interface ExcelSheet {
  name: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  chart: {
    type?: ChartType;
    category: string;
    series: string[];
    data: Record<string, string | number | null>[];
  } | null;
}

export interface ExcelData {
  sheets: ExcelSheet[];
}

export interface ExcelConfig {
  sheet: string;
  chart_type: ChartType;
  category: string;
  series: string[];
}

export interface ContentToken {
  token: string;
  src: string;
}

export interface DashboardVersion {
  id: string;
  version_no: number;
  file_name: string | null;
  file_size: number | null;
  uploaded_at: string;
  is_current: boolean;
}

export interface AuditEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  actor_email: string | null;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
}

export interface AuditSummary {
  logins_7d: number;
  failed_logins_7d: number;
  active_users_7d: number;
  top_dashboards: { id: string; name: string; views: number }[];
}
