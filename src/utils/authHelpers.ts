/**
 * Authentication Helper Utilities
 * Shared authentication logic that can be used across web and mobile
 */

import { supabase } from '../supabaseConfig';
import type { User } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  [key: string]: any;
}

/**
 * Fetches user profile from database with role validation
 * @param authUser - Authenticated user from Supabase Auth
 * @returns User profile or null if not authorized
 */
export async function fetchUserProfile(authUser: AuthUser): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*, profile_picture_url')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    console.error('[AUTH] Error fetching user profile:', error);
    throw error;
  }

  if (!data) {
    console.warn('[AUTH] No user profile found for:', authUser.email);
    return null;
  }

  // Role validation - only allow admin and super_admin for web
  if (data.role !== 'admin' && data.role !== 'super_admin') {
    console.warn('[AUTH] User does not have required role:', data.role);
    return null;
  }

  return {
    uid: data.id,
    email: data.email,
    name: data.name || authUser.email,
    role: data.role,
    company: data.company || '',
    studentId: data.student_id || '',
    program: data.program || '',
    profilePictureUrl: data.profile_picture_url || null,
  };
}

/**
 * Validates user has required role
 * @param user - User object
 * @param requiredRoles - Array of allowed roles
 * @returns true if user has required role
 */
export function hasRole(user: User | null, requiredRoles: string[]): boolean {
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

/**
 * Checks if user is super admin
 * @param user - User object
 * @returns true if user is super admin
 */
export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * Checks if user is admin or super admin
 * @param user - User object
 * @returns true if user is admin or super admin
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, ['admin', 'super_admin']);
}

/**
 * Gets user initials for avatar display
 * @param name - User's full name
 * @param email - User's email (fallback)
 * @returns Two-letter initials
 */
export function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  
  return 'U';
}

/**
 * Formats user display name
 * @param user - User object
 * @returns Formatted display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Guest';
  return user.name || user.email || 'User';
}

/**
 * Validates email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  return { valid: true };
}

/**
 * Sanitizes user input to prevent XSS
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
