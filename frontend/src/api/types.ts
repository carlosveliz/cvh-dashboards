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
}

export interface Dashboard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: DashboardType;
  visibility: Visibility;
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

export interface ExcelSheet {
  name: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  chart: {
    category: string;
    series: string[];
    data: Record<string, string | number | null>[];
  } | null;
}

export interface ExcelData {
  sheets: ExcelSheet[];
}

export interface ContentToken {
  token: string;
  src: string;
}
