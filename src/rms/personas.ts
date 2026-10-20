import { useSyncExternalStore } from 'react';
import type { Actor, StaffRole } from './domain';

// Phase one runs in one browser, so segregation of duties is demonstrated by
// switching between staff personas (stored locally). In the real system these
// come from the user's FPAMAS role.
export interface Persona extends Actor { id: string; title: string }

export const PERSONAS: Persona[] = [
  { id: 'ro',   name: 'Chidi Okeke',     role: 'revenue',   title: 'Revenue Officer' },
  { id: 'val',  name: 'Halima Bello',    role: 'valuer',    title: 'Estate Valuer' },
  { id: 'com1', name: 'Yusuf Danladi',   role: 'committee', title: 'Committee Chair' },
  { id: 'com2', name: 'Grace Effiong',   role: 'committee', title: 'Committee Member' },
  { id: 'fin',  name: 'Tunde Adebayo',   role: 'finance',   title: 'Finance Officer' },
  { id: 'aud',  name: 'Ngozi Umeh',      role: 'auditor',   title: 'Internal Auditor' },
];
export const personaFor = (role: StaffRole) => PERSONAS.find(p => p.role === role)!;

const KEY = 'fpam_rms_persona';
const listeners = new Set<() => void>();
function read(): Persona {
  try { return PERSONAS.find(p => p.id === localStorage.getItem(KEY)) || PERSONAS[0]; } catch { return PERSONAS[0]; }
}
let current = read();

export function setPersona(id: string) {
  current = PERSONAS.find(p => p.id === id) || PERSONAS[0];
  try { localStorage.setItem(KEY, current.id); } catch { /* not critical */ }
  listeners.forEach(l => l());
}

export function usePersona(): Persona {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
}
