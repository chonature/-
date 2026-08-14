import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  initialSchool,
  initialUsers,
  initialSubjects,
  initialStudents,
  initialScores,
  initialPredictions,
  initialActualCutoffs,
  initialAuditLogs,
  initialMappingPresets,
  initialPastCutoffs,
} from './src/lib/demoData';
import { calculateCutoffAnalysis } from './src/lib/scoreEngine';
import {
  User,
  Subject,
  Student,
  Score,
  PredictionScore,
  ActualCutoff,
  AuditLog,
  ExcelColumnMapping,
  PastCutoffRecord,
} from './src/types';

// Initialize In-Memory Data Store
let currentSchool = { ...initialSchool };
let users = [...initialUsers];
let subjects: Subject[] = [...initialSubjects];
let students: Student[] = [...initialStudents];
let scores: Score[] = [...initialScores];
let predictions: PredictionScore[] = [...initialPredictions];
let actualCutoffs: ActualCutoff[] = [...initialActualCutoffs];
let auditLogs: AuditLog[] = [...initialAuditLogs];
let mappingPresets: ExcelColumnMapping[] = [...initialMappingPresets];
let pastCutoffRecords: PastCutoffRecord[] = [...initialPastCutoffs];

// Master Student Roster Store (Uploaded by Admin/Teacher - Overwrites on new upload)
let masterRoster: Array<{
  studentNumber: string;
  name: string;
  grade: number;
  classNum: number;
  numberInClass: number;
}> = students.map((st) => ({
  studentNumber: st.studentNumber,
  name: st.name,
  grade: st.grade,
  classNum: st.classNum,
  numberInClass: st.numberInClass,
}));

// SSE Client Connections for Realtime Updates
const sseClients: express.Response[] = [];

function broadcastRealtimeEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch (err) {
      sseClients.splice(i, 1);
    }
  }
}

// Server-side Gemini Client
let genAI: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get full state
  app.get('/api/state', (req, res) => {
    const activeSubjects = subjects.filter((s) => !s.isDeleted);
    const deletedSubjects = subjects.filter((s) => s.isDeleted === true);

    // Pre-calculate cutoffs for active subjects
    const cutoffsBySubject: Record<string, any> = {};
    activeSubjects.forEach((subj) => {
      cutoffsBySubject[subj.id] = calculateCutoffAnalysis(
        subj,
        students,
        scores,
        predictions
      );
    });

    res.json({
      school: currentSchool,
      users,
      subjects: activeSubjects,
      deletedSubjects,
      students,
      scores,
      predictions,
      cutoffsBySubject,
      actualCutoffs,
      auditLogs,
      mappingPresets,
      pastCutoffRecords,
    });
  });

  // Restore/Sync full state from Firestore Cloud Backup
  app.post('/api/state/sync-all', (req, res) => {
    const cloudState = req.body;
    if (!cloudState) {
      return res.status(400).json({ error: '클라우드 데이터가 비어 있습니다.' });
    }

    if (Array.isArray(cloudState.subjects)) subjects = cloudState.subjects;
    if (Array.isArray(cloudState.students)) students = cloudState.students;
    if (Array.isArray(cloudState.scores)) scores = cloudState.scores;
    if (Array.isArray(cloudState.predictions)) predictions = cloudState.predictions;
    if (Array.isArray(cloudState.actualCutoffs)) actualCutoffs = cloudState.actualCutoffs;
    if (Array.isArray(cloudState.auditLogs)) auditLogs = cloudState.auditLogs;
    if (Array.isArray(cloudState.pastCutoffRecords)) pastCutoffRecords = cloudState.pastCutoffRecords;
    if (Array.isArray(cloudState.mappingPresets)) mappingPresets = cloudState.mappingPresets;

    broadcastRealtimeEvent('state_resynced', { timestamp: new Date().toISOString() });
    res.json({ success: true, message: '클라우드 상태 동기화 완료' });
  });

  // Realtime SSE endpoint
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Send initial ping
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    req.on('close', () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  });

  // Update 2nd Exam Expected Score
  app.post('/api/predictions/update', (req, res) => {
    const { studentId, subjectId, expectedScore, updatedBy } = req.body;

    if (
      !studentId ||
      !subjectId ||
      expectedScore === undefined ||
      expectedScore === null ||
      isNaN(expectedScore)
    ) {
      return res.status(400).json({ error: '유효하지 않은 예상점수입니다.' });
    }

    const numScore = Math.max(0, Math.min(100, Number(expectedScore)));
    const student = students.find((s) => s.id === studentId);
    const subject = subjects.find((s) => s.id === subjectId);

    if (!student || !subject) {
      return res.status(404).json({ error: '학생 또는 과목을 찾을 수 없습니다.' });
    }

    const existingIndex = predictions.findIndex(
      (p) => p.studentId === studentId && p.subjectId === subjectId
    );

    let prevScore: number | null = null;
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      prevScore = predictions[existingIndex].expectedScore;
      predictions[existingIndex] = {
        ...predictions[existingIndex],
        expectedScore: numScore,
        updatedBy: updatedBy || '담당 교사',
        updatedAt: nowIso,
      };
    } else {
      predictions.push({
        id: `pred_${studentId}_${subjectId}_${Date.now()}`,
        studentId,
        subjectId,
        expectedScore: numScore,
        updatedBy: updatedBy || '담당 교사',
        updatedAt: nowIso,
      });
    }

    // Record Audit Log if changed
    if (prevScore !== numScore) {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const newLog: AuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowStr,
        userName: updatedBy || '담당 교사',
        userRole: 'TEACHER',
        subjectName: subject.name,
        studentName: student.name,
        studentNumber: student.studentNumber,
        fieldChanged: '2차고사 예상점수',
        previousValue: prevScore,
        newValue: numScore,
      };
      auditLogs.unshift(newLog);
      if (auditLogs.length > 100) auditLogs = auditLogs.slice(0, 100);
    }

    // Recalculate subject cutoffs
    const updatedCutoff = calculateCutoffAnalysis(
      subject,
      students,
      scores,
      predictions
    );

    const payload = {
      studentId,
      subjectId,
      expectedScore: numScore,
      updatedBy,
      updatedAt: nowIso,
      cutoff: updatedCutoff,
      auditLogs: auditLogs.slice(0, 10),
    };

    broadcastRealtimeEvent('score_updated', payload);

    res.json({
      success: true,
      data: payload,
    });
  });

  // Update Score (Midterm or Performance)
  app.post('/api/scores/update', (req, res) => {
    const { studentId, subjectId, assessmentType, rawScore, updatedBy } = req.body;

    const student = students.find((s) => s.id === studentId);
    const subject = subjects.find((s) => s.id === subjectId);

    if (!student || !subject) {
      return res.status(404).json({ error: '학생 또는 과목을 찾을 수 없습니다.' });
    }

    const maxVal =
      assessmentType === 'MIDTERM'
        ? subject.midtermMaxScore
        : subject.performanceMaxScore;

    const numScore = Math.max(0, Math.min(maxVal, Number(rawScore)));

    const existingIndex = scores.findIndex(
      (s) =>
        s.studentId === studentId &&
        s.subjectId === subjectId &&
        s.assessmentType === assessmentType
    );

    let prevScore: number | null = null;
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      prevScore = scores[existingIndex].rawScore;
      scores[existingIndex].rawScore = numScore;
      scores[existingIndex].updatedBy = updatedBy || '담당 교사';
      scores[existingIndex].updatedAt = nowIso;
    } else {
      scores.push({
        id: `sc_${studentId}_${subjectId}_${assessmentType}`,
        studentId,
        subjectId,
        assessmentType,
        rawScore: numScore,
        maxScore: maxVal,
        updatedBy: updatedBy || '담당 교사',
        updatedAt: nowIso,
      });
    }

    // Audit log
    if (prevScore !== numScore) {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const fieldName =
        assessmentType === 'MIDTERM' ? '중간고사 점수' : '수행평가 점수';
      const newLog: AuditLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowStr,
        userName: updatedBy || '담당 교사',
        userRole: 'TEACHER',
        subjectName: subject.name,
        studentName: student.name,
        studentNumber: student.studentNumber,
        fieldChanged: fieldName,
        previousValue: prevScore,
        newValue: numScore,
      };
      auditLogs.unshift(newLog);
      if (auditLogs.length > 100) auditLogs = auditLogs.slice(0, 100);
    }

    // Recalculate cutoff
    const updatedCutoff = calculateCutoffAnalysis(
      subject,
      students,
      scores,
      predictions
    );

    const payload = {
      studentId,
      subjectId,
      assessmentType,
      rawScore: numScore,
      cutoff: updatedCutoff,
      auditLogs: auditLogs.slice(0, 10),
    };

    broadcastRealtimeEvent('score_updated', payload);

    res.json({ success: true, data: payload });
  });

  // Bulk Score & Prediction Update Endpoint (성적 통합 일괄 저장)
  app.post('/api/scores/bulk-update', (req, res) => {
    const { subjectId, updates, updatedBy } = req.body;

    if (!subjectId || !Array.isArray(updates)) {
      return res.status(400).json({ error: '유효한 과목 및 저장 데이터가 필요합니다.' });
    }

    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) {
      return res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
    }

    let updatedCount = 0;
    const nowIso = new Date().toISOString();
    const updater = updatedBy || '교사';

    updates.forEach((item: { studentId: string; perfRaw?: number | null; finalExpected?: number | null }) => {
      const { studentId, perfRaw, finalExpected } = item;
      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      // Update Performance score if provided
      if (perfRaw !== undefined && perfRaw !== null && !isNaN(Number(perfRaw))) {
        const pNum = Number(perfRaw);
        const existingIdx = scores.findIndex(
          (s) => s.studentId === studentId && s.subjectId === subjectId && s.assessmentType === 'PERFORMANCE'
        );
        if (existingIdx >= 0) {
          scores[existingIdx].rawScore = pNum;
          scores[existingIdx].updatedBy = updater;
          scores[existingIdx].updatedAt = nowIso;
        } else {
          scores.push({
            id: `sc_${studentId}_${subjectId}_PERFORMANCE_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            studentId,
            subjectId,
            assessmentType: 'PERFORMANCE',
            rawScore: pNum,
            maxScore: subject.performanceMaxScore || 40,
            updatedBy: updater,
            updatedAt: nowIso,
          });
        }
        updatedCount++;
      }

      // Update 2nd Final Prediction score if provided
      if (finalExpected !== undefined && finalExpected !== null && !isNaN(Number(finalExpected))) {
        const fNum = Number(finalExpected);
        const existingIdx = predictions.findIndex(
          (p) => p.studentId === studentId && p.subjectId === subjectId
        );
        if (existingIdx >= 0) {
          predictions[existingIdx].expectedScore = fNum;
          predictions[existingIdx].updatedBy = updater;
          predictions[existingIdx].updatedAt = nowIso;
        } else {
          predictions.push({
            id: `pred_${studentId}_${subjectId}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            studentId,
            subjectId,
            expectedScore: fNum,
            updatedBy: updater,
            updatedAt: nowIso,
          });
        }
        updatedCount++;
      }
    });

    const updatedCutoff = calculateCutoffAnalysis(
      subject,
      students,
      scores,
      predictions
    );

    auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: nowIso,
      userName: updater,
      userRole: 'TEACHER',
      subjectName: subject.name,
      studentName: '일괄 입력',
      studentNumber: 'ALL',
      fieldChanged: '수행 및 2차예상 성적 일괄저장',
      previousValue: 0,
      newValue: updatedCount,
    });

    broadcastRealtimeEvent('bulk_imported', {
      subjectId,
      updatedScoreCount: updatedCount,
      cutoff: updatedCutoff,
      auditLogs: auditLogs.slice(0, 10),
    });

    res.json({ success: true, count: updatedCount, cutoff: updatedCutoff });
  });

  // Update Assessment Weights
  app.post('/api/weights/update', (req, res) => {
    const { subjectId, midtermWeight, performanceWeight, finalWeight } = req.body;

    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) {
      return res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
    }

    const mW = Number(midtermWeight);
    const pW = Number(performanceWeight);
    const fW = Number(finalWeight);

    if (mW + pW + fW !== 100) {
      return res.status(400).json({
        error: `반영비율 합계는 100%이어야 합니다. (현재 합계: ${mW + pW + fW}%)`,
      });
    }

    subject.midtermWeight = mW;
    subject.performanceWeight = pW;
    subject.finalWeight = fW;

    const updatedCutoff = calculateCutoffAnalysis(
      subject,
      students,
      scores,
      predictions
    );

    broadcastRealtimeEvent('subject_updated', { subject, cutoff: updatedCutoff });

    res.json({ success: true, subject, cutoff: updatedCutoff });
  });

  // Create New Subject
  app.post('/api/subjects/create', (req, res) => {
    const {
      name,
      grade,
      semester,
      midtermWeight,
      performanceWeight,
      finalWeight,
      midtermMaxScore,
      performanceMaxScore,
      finalMaxScore,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '과목명을 입력해주세요.' });
    }

    const trimmedName = name.trim();
    const existing = subjects.find(
      (s) =>
        s.name.toLowerCase() === trimmedName.toLowerCase() &&
        s.grade === (Number(grade) || 2) &&
        s.semester === (Number(semester) || 1)
    );

    if (existing) {
      return res.json({ success: true, subject: existing, isExisting: true });
    }

    const mW = midtermWeight !== undefined ? Number(midtermWeight) : 30;
    const pW = performanceWeight !== undefined ? Number(performanceWeight) : 30;
    const fW = finalWeight !== undefined ? Number(finalWeight) : 40;

    const newSubject: Subject = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolId: currentSchool.id || 'sch_1',
      name: trimmedName,
      grade: Number(grade) || 2,
      semester: Number(semester) || 1,
      midtermWeight: mW,
      performanceWeight: pW,
      finalWeight: fW,
      midtermMaxScore: Number(midtermMaxScore) || 100,
      performanceMaxScore: Number(performanceMaxScore) || 40,
      finalMaxScore: Number(finalMaxScore) || 100,
    };

    subjects.push(newSubject);

    // Assign to users
    users.forEach((u) => {
      if (!u.assignedSubjectIds.includes(newSubject.id)) {
        u.assignedSubjectIds.push(newSubject.id);
      }
    });

    const cutoff = calculateCutoffAnalysis(newSubject, students, scores, predictions);
    broadcastRealtimeEvent('subject_created', { subject: newSubject, cutoff });

    res.json({ success: true, subject: newSubject, cutoff, isExisting: false });
  });

  // Actual Cutoff Update
  app.post('/api/actual-cutoffs/update', (req, res) => {
    const { subjectId, actualA, actualB, actualC, actualD, updatedBy } = req.body;

    const existingIndex = actualCutoffs.findIndex((a) => a.subjectId === subjectId);
    const nowIso = new Date().toISOString();

    const record: ActualCutoff = {
      id: existingIndex >= 0 ? actualCutoffs[existingIndex].id : `act_${Date.now()}`,
      subjectId,
      actualA: Number(actualA),
      actualB: Number(actualB),
      actualC: Number(actualC),
      actualD: Number(actualD),
      updatedBy: updatedBy || '관리자',
      updatedAt: nowIso,
    };

    if (existingIndex >= 0) {
      actualCutoffs[existingIndex] = record;
    } else {
      actualCutoffs.push(record);
    }

    broadcastRealtimeEvent('actual_cutoff_updated', { record });

    res.json({ success: true, record });
  });

  // Auth: Google Sign-In via Firebase Auth
  app.post('/api/auth/google-login', (req, res) => {
    const { email, name, uid, photoURL } = req.body;
    if (!email) {
      return res.status(400).json({ error: '구글 계정 이메일 정보가 누락되었습니다.' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    
    // Strict Domain Restriction for Jeonju Univ High School
    if (!trimmedEmail.endsWith('@jjbugo.hs.kr')) {
      return res.status(403).json({
        error: '전주대학교사범대학부설고등학교(@jjbugo.hs.kr) 소속 구글 계정만 로그인할 수 있습니다.',
      });
    }

    let user = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!user) {
      const isFirstUserOrAdmin = users.length === 0 || trimmedEmail.includes('admin');
      user = {
        id: uid || `usr_g_${Date.now()}`,
        name: name || email.split('@')[0],
        email: trimmedEmail,
        password: '',
        role: isFirstUserOrAdmin ? 'ADMIN' : 'TEACHER',
        schoolId: currentSchool.id || 'sch_1',
        assignedSubjectIds: subjects.map((s) => s.id),
        approved: true,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      broadcastRealtimeEvent('users_updated', { users });
    }

    res.json({ success: true, user });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }
    if (user.approved === false) {
      return res.status(403).json({ error: '관리자 승인 대기 중인 계정입니다. 승인 후 로그인하실 수 있습니다.' });
    }
    res.json({ success: true, user });
  });

  // Auth: Register Request
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: '성명, 이메일, 비밀번호를 모두 입력해주세요.' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      return res.status(400).json({ error: '이미 가입 신청 또는 등록된 이메일 계정입니다.' });
    }
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: trimmedEmail,
      password,
      role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
      schoolId: currentSchool.id || 'sch_1',
      assignedSubjectIds: subjects.map((s) => s.id),
      approved: false,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    broadcastRealtimeEvent('users_updated', { users });
    res.json({ success: true, message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
  });

  // User Management: Create User directly (Admin)
  app.post('/api/users/create', (req, res) => {
    const { name, email, password, role, assignedSubjectIds } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: '성명, 이메일, 비밀번호는 필수 입력 항목입니다.' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      return res.status(400).json({ error: '이미 등록된 이메일 계정입니다.' });
    }
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: trimmedEmail,
      password,
      role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
      schoolId: currentSchool.id || 'sch_1',
      assignedSubjectIds: Array.isArray(assignedSubjectIds) ? assignedSubjectIds : subjects.map((s) => s.id),
      approved: true,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    broadcastRealtimeEvent('users_updated', { users });
    res.json({ success: true, user: newUser, users });
  });

  // User Management: Approve or reject pending signup (Admin)
  app.post('/api/users/approve', (req, res) => {
    const { userId, approve } = req.body;
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ error: '대상 계정을 찾을 수 없습니다.' });
    }
    if (approve) {
      target.approved = true;
    } else {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx >= 0) users.splice(idx, 1);
    }
    broadcastRealtimeEvent('users_updated', { users });
    res.json({ success: true, users });
  });

  // User Management: Change User Password (Admin)
  app.post('/api/users/update-password', (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: '유효한 계정과 새 비밀번호를 입력해주세요.' });
    }
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ error: '대상 계정을 찾을 수 없습니다.' });
    }
    target.password = newPassword;
    broadcastRealtimeEvent('users_updated', { users });
    res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
  });

  // User Management: Delete Account (Admin)
  app.post('/api/users/delete', (req, res) => {
    const { userId } = req.body;
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return res.status(404).json({ error: '대상 계정을 찾을 수 없습니다.' });
    }
    const adminCount = users.filter((u) => u.role === 'ADMIN').length;
    if (users[idx].role === 'ADMIN' && adminCount <= 1) {
      return res.status(400).json({ error: '최소 1명의 관리자 계정은 삭제할 수 없습니다.' });
    }
    users.splice(idx, 1);
    broadcastRealtimeEvent('users_updated', { users });
    res.json({ success: true, users });
  });

  // Subject Management: Delete Subject (Soft delete - moves to trash bin)
  app.post('/api/subjects/delete', (req, res) => {
    const { subjectId } = req.body;
    const target = subjects.find((s) => s.id === subjectId);
    if (!target) {
      return res.status(404).json({ error: '삭제할 과목을 찾을 수 없습니다.' });
    }
    target.isDeleted = true;
    target.deletedAt = new Date().toISOString();

    const activeSubjects = subjects.filter((s) => !s.isDeleted);
    const deletedSubjects = subjects.filter((s) => s.isDeleted === true);

    broadcastRealtimeEvent('subject_deleted', {
      subjectId,
      subjects: activeSubjects,
      deletedSubjects,
    });
    res.json({ success: true, subjects: activeSubjects, deletedSubjects });
  });

  // Subject Management: Restore Subject from Trash
  app.post('/api/subjects/restore', (req, res) => {
    const { subjectId } = req.body;
    const target = subjects.find((s) => s.id === subjectId);
    if (!target) {
      return res.status(404).json({ error: '복구할 과목을 찾을 수 없습니다.' });
    }
    target.isDeleted = false;
    delete target.deletedAt;

    const activeSubjects = subjects.filter((s) => !s.isDeleted);
    const deletedSubjects = subjects.filter((s) => s.isDeleted === true);

    const cutoff = calculateCutoffAnalysis(target, students, scores, predictions);

    broadcastRealtimeEvent('subject_created', {
      subject: target,
      cutoff,
      subjects: activeSubjects,
      deletedSubjects,
    });
    res.json({ success: true, subjects: activeSubjects, deletedSubjects });
  });

  // Subject Management: Permanent Delete Subject
  app.post('/api/subjects/permanent-delete', (req, res) => {
    const { subjectId } = req.body;
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) {
      return res.status(404).json({ error: '삭제할 과목을 찾을 수 없습니다.' });
    }
    subjects.splice(idx, 1);
    scores = scores.filter((s) => s.subjectId !== subjectId);
    predictions = predictions.filter((p) => p.subjectId !== subjectId);
    actualCutoffs = actualCutoffs.filter((a) => a.subjectId !== subjectId);
    users.forEach((u) => {
      u.assignedSubjectIds = u.assignedSubjectIds.filter((id) => id !== subjectId);
    });

    const activeSubjects = subjects.filter((s) => !s.isDeleted);
    const deletedSubjects = subjects.filter((s) => s.isDeleted === true);

    broadcastRealtimeEvent('subject_deleted', {
      subjectId,
      subjects: activeSubjects,
      deletedSubjects,
    });
    res.json({ success: true, subjects: activeSubjects, deletedSubjects });
  });

  // Past Cutoffs Management APIs
  app.get('/api/past-cutoffs', (req, res) => {
    res.json({ success: true, records: pastCutoffRecords });
  });

  // Create single past cutoff record
  app.post('/api/past-cutoffs/create', (req, res) => {
    const {
      schoolYear,
      semester,
      grade,
      subjectName,
      midtermWeight,
      performanceWeight,
      finalWeight,
      cutoffA,
      cutoffB,
      cutoffC,
      cutoffD,
      cutoffE,
      studentCount,
      meanScore,
      stdDev,
      notes,
      sourceType,
      createdBy,
    } = req.body;

    if (!subjectName || !schoolYear || !semester || !grade) {
      return res.status(400).json({ error: '필수 정보(과목명, 학년도, 학기, 학년)를 입력해주세요.' });
    }

    if (cutoffA === undefined || cutoffB === undefined || cutoffC === undefined || cutoffD === undefined) {
      return res.status(400).json({ error: 'A, B, C, D 분할점수를 모두 입력해주세요.' });
    }

    const newRecord: PastCutoffRecord = {
      id: `past_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      schoolYear: Number(schoolYear),
      semester: Number(semester),
      grade: Number(grade),
      subjectName: String(subjectName).trim(),
      midtermWeight: Number(midtermWeight) || 0,
      performanceWeight: Number(performanceWeight) || 0,
      finalWeight: Number(finalWeight) || 0,
      cutoffA: Number(cutoffA),
      cutoffB: Number(cutoffB),
      cutoffC: Number(cutoffC),
      cutoffD: Number(cutoffD),
      cutoffE: cutoffE !== undefined ? Number(cutoffE) : 0,
      studentCount: studentCount ? Number(studentCount) : undefined,
      meanScore: meanScore !== undefined && meanScore !== null ? Number(meanScore) : undefined,
      stdDev: stdDev !== undefined && stdDev !== null ? Number(stdDev) : undefined,
      notes: notes ? String(notes).trim() : '',
      sourceType: sourceType || 'MANUAL',
      createdBy: createdBy || '교사',
      createdAt: new Date().toISOString(),
    };

    pastCutoffRecords.unshift(newRecord);
    broadcastRealtimeEvent('past_cutoffs_updated', { records: pastCutoffRecords });
    res.json({ success: true, record: newRecord, records: pastCutoffRecords });
  });

  // Archive current active subject calculated cutoffs into past history
  app.post('/api/past-cutoffs/archive-current', (req, res) => {
    const { subjectId, schoolYear, semester, notes, createdBy } = req.body;
    const target = subjects.find((s) => s.id === subjectId);
    if (!target) {
      return res.status(404).json({ error: '아카이브할 대상 과목을 찾을 수 없습니다.' });
    }

    const cutoff = calculateCutoffAnalysis(target, students, scores, predictions);
    if (!cutoff || !cutoff.gradeA) {
      return res.status(400).json({ error: '해당 과목의 산출된 분할점수 데이터가 없습니다.' });
    }

    const newRecord: PastCutoffRecord = {
      id: `past_arch_${Date.now()}_${target.id}`,
      schoolYear: Number(schoolYear) || new Date().getFullYear(),
      semester: Number(semester) || target.semester,
      grade: target.grade,
      subjectName: target.name,
      midtermWeight: target.midtermWeight,
      performanceWeight: target.performanceWeight,
      finalWeight: target.finalWeight,
      cutoffA: cutoff.gradeA,
      cutoffB: cutoff.gradeB,
      cutoffC: cutoff.gradeC,
      cutoffD: cutoff.gradeD,
      cutoffE: 0,
      studentCount: cutoff.completedStudents || cutoff.totalStudents,
      meanScore: cutoff.mean,
      stdDev: cutoff.stdDev,
      notes: notes || `[${target.name}] 실시간 산출 결과 스냅샷 저장 (연동률: ${cutoff.completionRate}%)`,
      sourceType: 'CURRENT_ARCHIVE',
      createdBy: createdBy || '교사',
      createdAt: new Date().toISOString(),
    };

    pastCutoffRecords.unshift(newRecord);
    broadcastRealtimeEvent('past_cutoffs_updated', { records: pastCutoffRecords });
    res.json({ success: true, record: newRecord, records: pastCutoffRecords });
  });

  // Bulk import past cutoffs from Excel
  app.post('/api/past-cutoffs/bulk', (req, res) => {
    const { records: incoming, createdBy } = req.body;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ error: '가져올 분할점수 데이터가 비어있습니다.' });
    }

    const createdList: PastCutoffRecord[] = [];
    incoming.forEach((row: any) => {
      if (!row.subjectName) return;
      const rec: PastCutoffRecord = {
        id: `past_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        schoolYear: Number(row.schoolYear) || new Date().getFullYear() - 1,
        semester: Number(row.semester) || 1,
        grade: Number(row.grade) || 1,
        subjectName: String(row.subjectName).trim(),
        midtermWeight: Number(row.midtermWeight) || 0,
        performanceWeight: Number(row.performanceWeight) || 0,
        finalWeight: Number(row.finalWeight) || 0,
        cutoffA: Number(row.cutoffA) || 90,
        cutoffB: Number(row.cutoffB) || 80,
        cutoffC: Number(row.cutoffC) || 70,
        cutoffD: Number(row.cutoffD) || 60,
        cutoffE: row.cutoffE ? Number(row.cutoffE) : 0,
        studentCount: row.studentCount ? Number(row.studentCount) : undefined,
        meanScore: row.meanScore !== undefined ? Number(row.meanScore) : undefined,
        stdDev: row.stdDev !== undefined ? Number(row.stdDev) : undefined,
        notes: row.notes ? String(row.notes).trim() : '엑셀 일괄 등록',
        sourceType: 'EXCEL_IMPORT',
        createdBy: createdBy || '교사',
        createdAt: new Date().toISOString(),
      };
      createdList.push(rec);
    });

    pastCutoffRecords = [...createdList, ...pastCutoffRecords];
    broadcastRealtimeEvent('past_cutoffs_updated', { records: pastCutoffRecords });
    res.json({ success: true, count: createdList.length, records: pastCutoffRecords });
  });

  // Update past cutoff record
  app.post('/api/past-cutoffs/update', (req, res) => {
    const { id, updates } = req.body;
    const target = pastCutoffRecords.find((r) => r.id === id);
    if (!target) {
      return res.status(404).json({ error: '수정할 분할점수 내역을 찾을 수 없습니다.' });
    }

    Object.assign(target, updates, { updatedAt: new Date().toISOString() });
    broadcastRealtimeEvent('past_cutoffs_updated', { records: pastCutoffRecords });
    res.json({ success: true, record: target, records: pastCutoffRecords });
  });

  // Delete past cutoff record
  app.post('/api/past-cutoffs/delete', (req, res) => {
    const { id } = req.body;
    const idx = pastCutoffRecords.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: '삭제할 분할점수 내역을 찾을 수 없습니다.' });
    }

    pastCutoffRecords.splice(idx, 1);
    broadcastRealtimeEvent('past_cutoffs_updated', { records: pastCutoffRecords });
    res.json({ success: true, records: pastCutoffRecords });
  });

  // Master Roster Upload (Completely replaces existing master roster & updates student names)
  app.post('/api/roster/upload', (req, res) => {
    const { rosterRows, requesterRole } = req.body;

    if (requesterRole && requesterRole !== 'ADMIN') {
      return res.status(403).json({ error: '명렬표 등록은 관리자(ADMIN) 권한 전용 기능입니다.' });
    }

    if (!Array.isArray(rosterRows) || rosterRows.length === 0) {
      return res.status(400).json({ error: '명렬표 데이터가 올바르지 않습니다.' });
    }

    // Completely replace Master Roster (전면 갈아끼움)
    masterRoster = rosterRows.map((r: any) => ({
      studentNumber: String(r.studentNumber).replace(/\.0$/, '').trim(),
      name: String(r.name || '').trim(),
      grade: Number(r.grade) || 1,
      classNum: Number(r.classNum) || 1,
      numberInClass: Number(r.numberInClass) || 1,
    }));

    // Update existing students array with new names from master roster
    masterRoster.forEach((r) => {
      let existing = students.find((s) => s.studentNumber === r.studentNumber);
      if (existing) {
        if (r.name) existing.name = r.name;
        existing.grade = r.grade;
        existing.classNum = r.classNum;
        existing.numberInClass = r.numberInClass;
      } else {
        students.push({
          id: `st_${r.studentNumber}`,
          schoolId: 'sch_1',
          studentNumber: r.studentNumber,
          name: r.name,
          grade: r.grade,
          classNum: r.classNum,
          numberInClass: r.numberInClass,
        });
      }
    });

    broadcastRealtimeEvent('bulk_imported', { masterRosterCount: masterRoster.length });

    res.json({
      success: true,
      count: masterRoster.length,
      masterRoster,
      studentsCount: students.length,
    });
  });

  // Excel Bulk Import
  app.post('/api/excel/import', (req, res) => {
    const { importedStudents, importedScores, importedPredictions, subjectId, uploaderName } = req.body;

    if (!Array.isArray(importedStudents) || importedStudents.length === 0) {
      return res.status(400).json({ error: '가져올 데이터가 존재하지 않습니다.' });
    }

    let addedStudentCount = 0;
    let updatedScoreCount = 0;
    const targetSubjId = subjectId || (subjects[0] ? subjects[0].id : 'sub_math');

    importedStudents.forEach((impSt: any) => {
      const cleanNum = String(impSt.studentNumber).replace(/\.0$/, '').trim();
      if (!cleanNum) return;

      // Check master roster first for student's real name
      const rosterMatch = masterRoster.find((r) => r.studentNumber === cleanNum);

      let resolvedName = '';
      if (rosterMatch && rosterMatch.name) {
        resolvedName = rosterMatch.name;
      } else if (impSt.name && !impSt.name.includes('학년')) {
        resolvedName = String(impSt.name).trim();
      }

      let existingSt = students.find((s) => s.studentNumber === cleanNum);
      if (!existingSt) {
        existingSt = {
          id: `st_${cleanNum}`,
          schoolId: 'sch_1',
          studentNumber: cleanNum,
          name: resolvedName,
          grade: Number(impSt.grade) || (rosterMatch ? rosterMatch.grade : 1),
          classNum: Number(impSt.classNum) || (rosterMatch ? rosterMatch.classNum : 1),
          numberInClass: Number(impSt.numberInClass) || (rosterMatch ? rosterMatch.numberInClass : 1),
          enrolledSubjectIds: targetSubjId ? [targetSubjId] : [],
        };
        students.push(existingSt);
        addedStudentCount++;
      } else {
        if (resolvedName) {
          existingSt.name = resolvedName;
        }
        if (impSt.grade) existingSt.grade = Number(impSt.grade);
        if (impSt.classNum) existingSt.classNum = Number(impSt.classNum);
        if (impSt.numberInClass) existingSt.numberInClass = Number(impSt.numberInClass);

        if (targetSubjId) {
          if (!existingSt.enrolledSubjectIds) existingSt.enrolledSubjectIds = [];
          if (!existingSt.enrolledSubjectIds.includes(targetSubjId)) {
            existingSt.enrolledSubjectIds.push(targetSubjId);
          }
        }
      }
    });

    // Import scores (Default assessmentType is MIDTERM - 1차지필고사)
    if (Array.isArray(importedScores)) {
      importedScores.forEach((sc: any) => {
        const student = students.find((s) => s.studentNumber === sc.studentNumber);
        if (!student) return;

        const subjId = sc.subjectId || targetSubjId;
        const assessmentType = sc.assessmentType || 'MIDTERM';

        if (!student.enrolledSubjectIds) student.enrolledSubjectIds = [];
        if (!student.enrolledSubjectIds.includes(subjId)) {
          student.enrolledSubjectIds.push(subjId);
        }

        const existingIdx = scores.findIndex(
          (s) =>
            s.studentId === student.id &&
            s.subjectId === subjId &&
            s.assessmentType === assessmentType
        );

        if (existingIdx >= 0) {
          scores[existingIdx].rawScore = Number(sc.rawScore);
          scores[existingIdx].updatedBy = uploaderName || 'Excel 가져오기';
          scores[existingIdx].updatedAt = new Date().toISOString();
        } else {
          scores.push({
            id: `sc_${student.id}_${subjId}_${assessmentType}_${Date.now()}`,
            studentId: student.id,
            subjectId: subjId,
            assessmentType: assessmentType,
            rawScore: Number(sc.rawScore),
            maxScore: sc.maxScore || (assessmentType === 'PERFORMANCE' ? 40 : 100),
            updatedBy: uploaderName || 'Excel 가져오기',
            updatedAt: new Date().toISOString(),
          });
        }
        updatedScoreCount++;
      });
    }

    // Import prediction scores
    if (Array.isArray(importedPredictions)) {
      importedPredictions.forEach((pred: any) => {
        const student = students.find((s) => s.studentNumber === pred.studentNumber);
        if (!student) return;

        const subjId = pred.subjectId || targetSubjId;

        if (!student.enrolledSubjectIds) student.enrolledSubjectIds = [];
        if (!student.enrolledSubjectIds.includes(subjId)) {
          student.enrolledSubjectIds.push(subjId);
        }

        const existingIdx = predictions.findIndex(
          (p) => p.studentId === student.id && p.subjectId === subjId
        );

        if (existingIdx >= 0) {
          predictions[existingIdx].expectedScore = Number(pred.expectedScore);
          predictions[existingIdx].updatedBy = uploaderName || 'Excel 가져오기';
          predictions[existingIdx].updatedAt = new Date().toISOString();
        } else {
          predictions.push({
            id: `pred_${student.id}_${subjId}_${Date.now()}`,
            studentId: student.id,
            subjectId: subjId,
            expectedScore: Number(pred.expectedScore),
            updatedBy: uploaderName || 'Excel 가져오기',
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    // Recalculate cutoffs
    const cutoffsBySubject: Record<string, any> = {};
    subjects.forEach((subj) => {
      cutoffsBySubject[subj.id] = calculateCutoffAnalysis(
        subj,
        students,
        scores,
        predictions
      );
    });

    broadcastRealtimeEvent('bulk_imported', {
      addedStudentCount,
      updatedScoreCount,
      cutoffsBySubject,
      subjectId: targetSubjId,
    });

    res.json({
      success: true,
      addedStudentCount,
      updatedScoreCount,
      cutoffsBySubject,
    });
  });

  // AI Column Matcher Endpoint
  app.post('/api/ai/analyze-columns', async (req, res) => {
    const { columns } = req.body; // array of header string names

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: '열 목록이 올바르지 않습니다.' });
    }

    // Default rule-based fallback
    const ruleBasedMatch = (cols: string[]) => {
      const mapping: Record<string, { field: string; confidence: number; reason: string }> = {};

      cols.forEach((col) => {
        const trimmed = String(col).trim();
        const colLower = trimmed.toLowerCase();

        if (/성명|이름|학생명|학생\s*이름|name/i.test(colLower)) {
          mapping[trimmed] = { field: 'studentNameCol', confidence: 98, reason: '학생 성명 규칙 일치' };
        } else if (/학번|학생번호|학번\/번호|std_num|id/i.test(colLower)) {
          mapping[trimmed] = { field: 'studentNumberCol', confidence: 96, reason: '학번 필드 규칙 일치' };
        } else if (/중간|1차|중간고사|1차고사|midterm/i.test(colLower)) {
          mapping[trimmed] = { field: 'midtermScoreCol', confidence: 92, reason: '중간/1차고사 성적 필드' };
        } else if (/수행|수행평가|과제|perf/i.test(colLower)) {
          mapping[trimmed] = { field: 'performanceScoreCol', confidence: 90, reason: '수행평가 점수 필드' };
        } else if (/기말|2차|2차고사|기말고사|2차예상|예상점수|final/i.test(colLower)) {
          mapping[trimmed] = { field: 'finalExpectedScoreCol', confidence: 94, reason: '2차/기말 예상점수 필드' };
        } else if (/과목|과목명|subject/i.test(colLower)) {
          mapping[trimmed] = { field: 'subjectNameCol', confidence: 95, reason: '과목명 필드' };
        } else if (/학년|grade/i.test(colLower)) {
          mapping[trimmed] = { field: 'gradeCol', confidence: 90, reason: '학년 필드' };
        } else if (/반|class/i.test(colLower)) {
          mapping[trimmed] = { field: 'classCol', confidence: 90, reason: '반 필드' };
        } else if (/번호|no/i.test(colLower)) {
          mapping[trimmed] = { field: 'numberCol', confidence: 85, reason: '번호 필드' };
        }
      });

      return mapping;
    };

    if (!genAI) {
      return res.json({ mapping: ruleBasedMatch(columns), aiPowered: false });
    }

    try {
      const prompt = `
당신은 한국 고등학교 NICE 성적 처리 및 Excel 파일 자동 열 인식 AI입니다.
업로드된 Excel의 헤더 목록: ${JSON.stringify(columns)}

각 헤더를 다음 시스템 표준 필드 중 하나로 의미론적 매핑하세요:
- studentNameCol (학생 성명 / 이름)
- studentNumberCol (학번 / 학생번호)
- gradeCol (학년)
- classCol (반)
- numberCol (번호)
- subjectNameCol (과목명)
- midtermScoreCol (중간고사 / 1차고사 점수)
- performanceScoreCol (수행평가 점수)
- finalExpectedScoreCol (2차고사 / 기말고사 예상점수)

응답은 다음 JSON 객체 형식이어야 합니다:
{
  "mappings": [
    {
      "column": "열이름",
      "field": "매핑할_필드명",
      "confidence": 95,
      "reason": "AI 의미 분석 결과 설명"
    }
  ]
}
`;

      const response = await genAI.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mappings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    column: { type: Type.STRING },
                    field: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['column', 'field', 'confidence', 'reason'],
                },
              },
            },
            required: ['mappings'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const aiMapping: Record<string, { field: string; confidence: number; reason: string }> = {};

      if (Array.isArray(parsed.mappings)) {
        parsed.mappings.forEach((m: any) => {
          aiMapping[m.column] = {
            field: m.field,
            confidence: m.confidence || 90,
            reason: m.reason || 'AI 의미 분석 매핑',
          };
        });
      }

      // Merge with rule-based fallback for any missing
      const finalMapping = { ...ruleBasedMatch(columns), ...aiMapping };
      res.json({ mapping: finalMapping, aiPowered: true });
    } catch (err: any) {
      console.error('AI column analysis error:', err);
      res.json({ mapping: ruleBasedMatch(columns), aiPowered: false });
    }
  });

  // Save Mapping Preset
  app.post('/api/mapping-presets/save', (req, res) => {
    const { presetName, mapping } = req.body;
    if (!presetName || !mapping) {
      return res.status(400).json({ error: '양식 이름과 매핑 정보가 필요합니다.' });
    }

    const newPreset: ExcelColumnMapping = {
      presetName,
      ...mapping,
    };

    mappingPresets.unshift(newPreset);
    res.json({ success: true, mappingPresets });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
