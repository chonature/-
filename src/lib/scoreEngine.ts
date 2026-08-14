import { Student, Score, PredictionScore, Subject, CutoffResult } from '../types';

export function calculateStudentFinalScore(
  studentId: string,
  subject: Subject,
  scores: Score[],
  predictionScores: PredictionScore[]
): {
  midterm: number | null;
  performance: number | null;
  finalExpected: number | null;
  totalExpected: number | null;
  currentWeightedScore: number | null;
  enteredWeightSum: number;
  isComplete: boolean;
} {
  const studentScores = scores.filter(
    (s) => s.studentId === studentId && s.subjectId === subject.id
  );
  const midtermScore = studentScores.find((s) => s.assessmentType === 'MIDTERM');
  const perfScore = studentScores.find((s) => s.assessmentType === 'PERFORMANCE');

  const pred = predictionScores.find(
    (p) => p.studentId === studentId && p.subjectId === subject.id
  );

  const mRaw = midtermScore ? midtermScore.rawScore : null;
  const pRaw = perfScore ? perfScore.rawScore : null;
  const fRaw = pred ? pred.expectedScore : null;

  const mMax = subject.midtermMaxScore || 100;
  const pMax = subject.performanceMaxScore || 40;
  const fMax = subject.finalMaxScore || 100;

  const mWeight = subject.midtermWeight;
  const pWeight = subject.performanceWeight;
  const fWeight = subject.finalWeight;

  const isComplete = mRaw !== null && pRaw !== null && fRaw !== null;

  // Calculate weighted score & entered weight sum
  let currentWeightedScore = 0;
  let enteredWeightSum = 0;

  if (mRaw !== null) {
    currentWeightedScore += (mRaw / mMax) * mWeight;
    enteredWeightSum += mWeight;
  }
  if (pRaw !== null) {
    currentWeightedScore += (pRaw / pMax) * pWeight;
    enteredWeightSum += pWeight;
  }
  if (fRaw !== null) {
    currentWeightedScore += (fRaw / fMax) * fWeight;
    enteredWeightSum += fWeight;
  }

  // Calculate 100-pt scaled expected total based on whatever info is entered
  let totalExpected: number | null = null;
  if (enteredWeightSum > 0) {
    totalExpected = Math.round((currentWeightedScore / enteredWeightSum) * 100 * 10) / 10;
  }

  return {
    midterm: mRaw,
    performance: pRaw,
    finalExpected: fRaw,
    totalExpected,
    currentWeightedScore: enteredWeightSum > 0 ? Math.round(currentWeightedScore * 10) / 10 : null,
    enteredWeightSum,
    isComplete,
  };
}

export function getSubjectStudents(
  subjectId: string,
  students: Student[],
  scores: Score[],
  predictionScores: PredictionScore[]
): Student[] {
  return students.filter((st) => {
    if (st.enrolledSubjectIds && Array.isArray(st.enrolledSubjectIds)) {
      if (st.enrolledSubjectIds.includes(subjectId)) return true;
      const hasScore = scores.some((sc) => sc.studentId === st.id && sc.subjectId === subjectId);
      const hasPred = predictionScores.some((p) => p.studentId === st.id && p.subjectId === subjectId);
      return hasScore || hasPred;
    }
    const hasScore = scores.some((sc) => sc.studentId === st.id && sc.subjectId === subjectId);
    const hasPred = predictionScores.some((p) => p.studentId === st.id && p.subjectId === subjectId);
    return hasScore || hasPred || !st.enrolledSubjectIds;
  });
}

export function calculateCutoffAnalysis(
  subject: Subject,
  students: Student[],
  scores: Score[],
  predictionScores: PredictionScore[]
): CutoffResult {
  const subjectStudents = getSubjectStudents(subject.id, students, scores, predictionScores);

  const studentResults = subjectStudents.map((st) =>
    calculateStudentFinalScore(st.id, subject, scores, predictionScores)
  );

  const hasDataCount = studentResults.filter((r) => r.totalExpected !== null).length;
  const totalStudents = subjectStudents.length;
  const completionRate =
    totalStudents > 0 ? Math.round((hasDataCount / totalStudents) * 1000) / 10 : 0;

  // Collect all calculated total expected scores (scaled to 100pt based on entered scores)
  const validScores: number[] = [];

  studentResults.forEach((res) => {
    if (res.totalExpected !== null) {
      validScores.push(res.totalExpected);
    }
  });

  if (validScores.length === 0) {
    return {
      gradeA: 90,
      gradeB: 80,
      gradeC: 70,
      gradeD: 60,
      rangeA: [89, 91],
      rangeB: [79, 81],
      rangeC: [69, 71],
      rangeD: [59, 61],
      confidence: 'LOW',
      completionRate: 0,
      completedStudents: 0,
      totalStudents,
      mean: 0,
      stdDev: 0,
      median: 0,
      minScore: 0,
      maxScore: 0,
      distributionBins: [],
    };
  }

  // Sort scores ascending
  validScores.sort((a, b) => a - b);

  const n = validScores.length;
  const sum = validScores.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / n) * 10) / 10;

  const variance =
    validScores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  const median =
    n % 2 === 0
      ? Math.round(((validScores[n / 2 - 1] + validScores[n / 2]) / 2) * 10) / 10
      : Math.round(validScores[Math.floor(n / 2)] * 10) / 10;

  const minScore = validScores[0];
  const maxScore = validScores[n - 1];

  // Cutoff calculation:
  // NICE 성취평가제 기준 + 학생 성적 분포 곡선 추정
  // A: 보통 상위 ~20-25% 지점 또는 mu + 0.8 * sigma
  // B: 보통 상위 ~50% 지점 또는 mu + 0.1 * sigma
  // C: 보통 상위 ~75% 지점 또는 mu - 0.8 * sigma
  // D: 보통 상위 ~90% 지점 또는 mu - 1.6 * sigma
  const idxA = Math.max(0, Math.floor(n * 0.78));
  const idxB = Math.max(0, Math.floor(n * 0.52));
  const idxC = Math.max(0, Math.floor(n * 0.25));
  const idxD = Math.max(0, Math.floor(n * 0.10));

  const percentileA = validScores[idxA];
  const percentileB = validScores[idxB];
  const percentileC = validScores[idxC];
  const percentileD = validScores[idxD];

  // Blend norm-referenced distribution with absolute criterion thresholds (85, 75, 65, 50)
  const calcA = Math.min(93, Math.max(82, (percentileA * 0.6 + (mean + 0.82 * stdDev) * 0.4)));
  const calcB = Math.min(84, Math.max(71, (percentileB * 0.6 + (mean - 0.10 * stdDev) * 0.4)));
  const calcC = Math.min(73, Math.max(58, (percentileC * 0.6 + (mean - 0.95 * stdDev) * 0.4)));
  const calcD = Math.min(60, Math.max(45, (percentileD * 0.6 + (mean - 1.80 * stdDev) * 0.4)));

  const gradeA = Math.round(calcA * 10) / 10;
  const gradeB = Math.round(calcB * 10) / 10;
  const gradeC = Math.round(calcC * 10) / 10;
  const gradeD = Math.round(calcD * 10) / 10;

  // Margin of error range calculation
  const marginA = Math.round((1.2 + (100 - completionRate) * 0.03) * 10) / 10;
  const marginB = Math.round((1.0 + (100 - completionRate) * 0.025) * 10) / 10;
  const marginC = Math.round((1.1 + (100 - completionRate) * 0.025) * 10) / 10;
  const marginD = Math.round((1.3 + (100 - completionRate) * 0.03) * 10) / 10;

  const rangeA: [number, number] = [
    Math.round((gradeA - marginA) * 10) / 10,
    Math.round((gradeA + marginA) * 10) / 10,
  ];
  const rangeB: [number, number] = [
    Math.round((gradeB - marginB) * 10) / 10,
    Math.round((gradeB + marginB) * 10) / 10,
  ];
  const rangeC: [number, number] = [
    Math.round((gradeC - marginC) * 10) / 10,
    Math.round((gradeC + marginC) * 10) / 10,
  ];
  const rangeD: [number, number] = [
    Math.round((gradeD - marginD) * 10) / 10,
    Math.round((gradeD + marginD) * 10) / 10,
  ];

  // Confidence assessment
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (completionRate < 70 || n < 20) {
    confidence = 'LOW';
  } else if (completionRate < 90 || n < 50) {
    confidence = 'MEDIUM';
  }

  // Distribution Bins (10 pt increments)
  const bins = [
    { range: '0-10', minVal: 0, maxVal: 10, count: 0 },
    { range: '10-20', minVal: 10, maxVal: 20, count: 0 },
    { range: '20-30', minVal: 20, maxVal: 30, count: 0 },
    { range: '30-40', minVal: 30, maxVal: 40, count: 0 },
    { range: '40-50', minVal: 40, maxVal: 50, count: 0 },
    { range: '50-60', minVal: 50, maxVal: 60, count: 0 },
    { range: '60-70', minVal: 60, maxVal: 70, count: 0 },
    { range: '70-80', minVal: 70, maxVal: 80, count: 0 },
    { range: '80-90', minVal: 80, maxVal: 90, count: 0 },
    { range: '90-100', minVal: 90, maxVal: 100, count: 0 },
  ];

  validScores.forEach((score) => {
    let bIndex = Math.floor(score / 10);
    if (bIndex >= 10) bIndex = 9;
    if (bIndex < 0) bIndex = 0;
    bins[bIndex].count++;
  });

  return {
    gradeA,
    gradeB,
    gradeC,
    gradeD,
    rangeA,
    rangeB,
    rangeC,
    rangeD,
    confidence,
    completionRate,
    completedStudents: hasDataCount,
    totalStudents,
    mean,
    stdDev,
    median,
    minScore,
    maxScore,
    distributionBins: bins,
  };
}
