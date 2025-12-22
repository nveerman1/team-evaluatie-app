import { RFIDCard } from "@/services/attendance.service";

export interface StudentRow {
  id: number;
  name: string;
  email: string;
  className: string | null;
  cards: RFIDCard[];
}

export interface StudentWithCards {
  user_id: number;
  user_name: string;
  user_email: string;
  class_name: string | null;
  cards: RFIDCard[];
}

export type SortKey = 'name' | 'className' | 'cardCount';
export type SortDir = 'asc' | 'desc';

/**
 * Build student rows from API data
 */
export function buildStudentRows(students: StudentWithCards[]): StudentRow[] {
  return students.map(student => ({
    id: student.user_id,
    name: student.user_name,
    email: student.user_email,
    className: student.class_name,
    cards: student.cards || [],
  }));
}

/**
 * Filter rows based on search query
 * Searches in: name, email, class name, and card UIDs
 */
export function filterRows(rows: StudentRow[], query: string): StudentRow[] {
  if (!query.trim()) return rows;
  
  const q = query.trim().toLowerCase();
  
  return rows.filter(row => {
    // Search in student fields
    const inStudent = 
      row.name.toLowerCase().includes(q) ||
      row.email.toLowerCase().includes(q) ||
      (row.className?.toLowerCase().includes(q) ?? false);
    
    // Search in card UIDs
    const inCards = row.cards.some(card => 
      card.uid.toLowerCase().includes(q)
    );
    
    return inStudent || inCards;
  });
}

/**
 * Sort rows by specified key and direction
 */
export function sortRows(rows: StudentRow[], sortKey: SortKey, sortDir: SortDir): StudentRow[] {
  const sorted = [...rows].sort((a, b) => {
    let compareResult = 0;
    
    switch (sortKey) {
      case 'name':
        compareResult = a.name.localeCompare(b.name);
        break;
      case 'className':
        const classA = a.className || '';
        const classB = b.className || '';
        compareResult = classA.localeCompare(classB);
        break;
      case 'cardCount':
        compareResult = a.cards.length - b.cards.length;
        break;
    }
    
    return sortDir === 'asc' ? compareResult : -compareResult;
  });
  
  return sorted;
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join("");
}
