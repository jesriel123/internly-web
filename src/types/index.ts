/**
 * Shared TypeScript type definitions for Internly Web
 */

export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin' | 'student';
  company: string;
  studentId?: string;
  program?: string;
  profilePictureUrl?: string | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  forgotPassword: (email: string, redirectTo?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at?: string;
}

export interface TimeLog {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out?: string | null;
  total_hours?: number | null;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  action_url?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  details: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export type UserRole = 'admin' | 'super_admin' | 'student';
export type TimeLogStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
