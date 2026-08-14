export type UserRole = 'ADMIN' | 'TEACHER';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  schoolId: string;
  assignedSubjectIds: string[];
  approved?: boolean;
  createdAt?: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  grade: number; // e.g. 1
  semester: number; // e.g. 1
  midtermWeight: number; // e.g. 30 (%)
  performanceWeight: number; // e.g. 30 (%)
  finalWeight: number; // e.g. 40 (%)
  midtermMaxScore: number; // e.g. 100
  performanceMaxScore: number; // e.g. 40
  finalMaxScore: number; // e.g. 100
  isDeleted?: boolean;
  deletedAt?: string;
}

export type AssessmentType = 'MIDTERM' | 'PERFORMANCE' | 'FINAL';

export interface Student {
  id: string;
  schoolId: string;
  studentNumber: string; // e.g. "10101"
  name: string;
  grade: number; // e.g. 1
  classNum: number; // e.g. 1
  numberInClass: number; // e.g. 1
  enrolledSubjectIds?: string[]; // 과목 수강 정보
}

export interface Score {
  id: string;
  studentId: string;
  subjectId: string;
  assessmentType: AssessmentType;
  rawScore: number;
  maxScore: number;
  updatedBy: string; // Teacher name/ID
  updatedAt: string; // ISO string
}

export interface PredictionScore {
  id: string;
  studentId: string;
  subjectId: string;
  expectedScore: number; // 2nd Exam / Final exam expected score (0-100)
  updatedBy: string;
  updatedAt: string;
}

export interface CutoffResult {
  gradeA: number; // e.g. 86.4
  gradeB: number; // e.g. 74.8
  gradeC: number; // e.g. 62.1
  gradeD: number; // e.g. 50.3
  rangeA: [number, number]; // [85.8, 87.2]
  rangeB: [number, number];
  rangeC: [number, number];
  rangeD: [number, number];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  completionRate: number; // 0 - 100 (%)
  completedStudents: number;
  totalStudents: number;
  mean: number;
  stdDev: number;
  median: number;
  minScore: number;
  maxScore: number;
  distributionBins: { range: string; count: number; minVal: number; maxVal: number }[];
}

export interface ActualCutoff {
  id: string;
  subjectId: string;
  actualA: number;
  actualB: number;
  actualC: number;
  actualD: number;
  updatedBy: string;
  updatedAt: string;
}

export interface ExcelColumnMapping {
  presetName?: string;
  studentNameCol: string;
  studentNumberCol: string;
  gradeCol?: string;
  classCol?: string;
  numberCol?: string;
  subjectNameCol?: string;
  midtermScoreCol?: string;
  performanceScoreCol?: string;
  finalExpectedScoreCol?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  subjectName: string;
  studentName: string;
  studentNumber: string;
  fieldChanged: string;
  previousValue: string | number | null;
  newValue: string | number;
}

export interface ExcelImportError {
  row: number;
  studentName?: string;
  studentNumber?: string;
  field: string;
  message: string;
}

export interface PastCutoffRecord {
  id: string;
  schoolYear: number; // e.g. 2025, 2024, 2023
  semester: number; // 1 or 2
  grade: number; // 1, 2, 3
  subjectName: string; // e.g. '수학 I', '공통국어'
  midtermWeight: number; // e.g. 30 (%)
  performanceWeight: number; // e.g. 30 (%)
  finalWeight: number; // e.g. 40 (%)
  cutoffA: number; // e.g. 87.5
  cutoffB: number; // e.g. 75.0
  cutoffC: number; // e.g. 62.5
  cutoffD: number; // e.g. 50.0
  cutoffE?: number; // e.g. 0
  studentCount?: number; // 수강 학생수
  meanScore?: number; // 과목 평균점수
  stdDev?: number; // 표준편차
  sourceType?: 'MANUAL' | 'EXCEL_IMPORT' | 'CURRENT_ARCHIVE';
  notes?: string; // 비고 / 난이도 및 출제 특이사항
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}
