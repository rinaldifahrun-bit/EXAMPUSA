import type { UserProfile, UserRole } from '../types';

/**
 * Authorization Helper Functions
 * 
 * NOTE: Frontend helpers are for UI/UX flow control and conditional rendering only.
 * Core data security MUST be enforced by Firestore Security Rules on the backend.
 */

export function isTeacher(user: UserProfile | null | undefined): boolean {
  return !!user && user.role === 'teacher';
}

export function isAdmin(user: UserProfile | null | undefined): boolean {
  return !!user && user.role === 'admin';
}

export function isStudent(user: UserProfile | null | undefined): boolean {
  return !!user && user.role === 'student';
}

export function canAccessTeacherArea(user: UserProfile | null | undefined): boolean {
  return !!user && (user.role === 'teacher' || user.role === 'admin');
}

export function canAccessAdminArea(user: UserProfile | null | undefined): boolean {
  return !!user && user.role === 'admin';
}

export function canAccessStudentArea(user: UserProfile | null | undefined): boolean {
  return !!user && user.role === 'student';
}

export function hasRole(user: UserProfile | null | undefined, role: UserRole): boolean {
  return !!user && user.role === role;
}
