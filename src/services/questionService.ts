import type { Question, QuestionType, QuestionDifficulty } from '../types';
import { mockQuestions } from '../data/mockData';

const QUESTIONS_STORAGE_KEY = 'sp1_puspo_questions_store';

export function getStoredQuestions(): Question[] {
  try {
    const data = localStorage.getItem(QUESTIONS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading questions', e);
  }
  return [...mockQuestions];
}

export function saveStoredQuestions(questions: Question[]) {
  try {
    localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    console.error('Error saving questions', e);
  }
}

export function addQuestion(question: Omit<Question, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>): Question {
  const all = getStoredQuestions();
  const newQuestion: Question = {
    ...question,
    id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const updated = [newQuestion, ...all];
  saveStoredQuestions(updated);
  return newQuestion;
}

export function addBulkQuestions(newQuestions: Omit<Question, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>[]): Question[] {
  const all = getStoredQuestions();
  const created: Question[] = newQuestions.map((q, idx) => ({
    ...q,
    id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  const updated = [...created, ...all];
  saveStoredQuestions(updated);
  return created;
}

export function updateQuestion(id: string, updates: Partial<Question>): Question | null {
  const all = getStoredQuestions();
  const idx = all.findIndex((q) => q.id === id);
  if (idx === -1) return null;

  const updated: Question = {
    ...all[idx],
    ...updates,
    updated_at: new Date().toISOString()
  };
  all[idx] = updated;
  saveStoredQuestions(all);
  return updated;
}

export function deleteQuestion(id: string): boolean {
  const all = getStoredQuestions();
  const idx = all.findIndex((q) => q.id === id);
  if (idx === -1) return false;

  // Soft delete
  all[idx].is_deleted = true;
  all[idx].updated_at = new Date().toISOString();
  saveStoredQuestions(all);
  return true;
}

export function duplicateQuestion(id: string): Question | null {
  const all = getStoredQuestions();
  const original = all.find((q) => q.id === id);
  if (!original) return null;

  const copy: Question = {
    ...original,
    id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    topic: `${original.topic} (Salinan)`,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const updated = [copy, ...all];
  saveStoredQuestions(updated);
  return copy;
}
