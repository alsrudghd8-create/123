export interface Student {
  id: string;
  number: number;
  name: string;
  level: '매우잘함' | '잘함' | '보통' | '노력요함' | null;
  notes: string;
  comment: string;
}

export interface ClassInfo {
  grade: number;
  classNumber: number;
}
