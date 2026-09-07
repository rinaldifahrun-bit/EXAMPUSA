import type { UserProfile } from '../types';
import { mockTeachers, mockStudents } from '../data/mockData';

const CURRENT_USER_KEY = 'sp1_puspo_current_user';

export function getInitialUser(): UserProfile {
  try {
    const saved = localStorage.getItem(CURRENT_USER_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse current user from localStorage', e);
  }
  // Default to teacher Bpk. Hendra Pratama
  return mockTeachers[0];
}

export function saveCurrentUser(user: UserProfile) {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save current user', e);
  }
}

export function getAllMockUsers(): UserProfile[] {
  return [...mockTeachers, ...mockStudents];
}
