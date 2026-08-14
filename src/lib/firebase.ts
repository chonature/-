import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Subject,
  Student,
  Score,
  PredictionScore,
  ActualCutoff,
  AuditLog,
  PastCutoffRecord,
  ExcelColumnMapping,
  User,
} from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Target designated Firestore database ID
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== ''
    ? firebaseConfig.firestoreDatabaseId
    : '(default)'
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Restrict Google Account Picker to school domain
googleProvider.setCustomParameters({
  hd: 'jjbugo.hs.kr',
  prompt: 'select_account',
});

// Collection Names
export const COLLECTIONS = {
  METADATA: 'school_metadata',
  SUBJECTS: 'subjects',
  STUDENTS: 'students',
  SCORES: 'scores',
  PREDICTIONS: 'predictions',
  ACTUAL_CUTOFFS: 'actual_cutoffs',
  AUDIT_LOGS: 'audit_logs',
  PAST_CUTOFFS: 'past_cutoffs',
  MAPPINGS: 'mapping_presets',
  ROSTER: 'master_roster',
};

// Allowed School Domain
export const ALLOWED_DOMAIN = 'jjbugo.hs.kr';

export const isAllowedSchoolEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
};

// Authentication Helper
export const signInWithGoogle = async (): Promise<FirebaseUser | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user && user.email && !isAllowedSchoolEmail(user.email)) {
      await signOut(auth);
      throw new Error(
        `전주사대부고(@${ALLOWED_DOMAIN}) 소속 구글 계정만 로그인 가능합니다. (로그인 시도: ${user.email})`
      );
    }
    return user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const logOutFirebase = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Firebase Sign-Out Error:', error);
  }
};

// Save All Current State to Firestore
export const backupStateToFirestore = async (state: {
  schoolName?: string;
  subjects: Subject[];
  students: Student[];
  scores: Score[];
  predictions: PredictionScore[];
  actualCutoffs: ActualCutoff[];
  auditLogs: AuditLog[];
  pastCutoffRecords: PastCutoffRecord[];
  mappingPresets?: ExcelColumnMapping[];
}) => {
  try {
    const batchPromises: Promise<any>[] = [];

    // 1. Save full state document bundle for fast atomic restores
    const snapshotDocRef = doc(db, COLLECTIONS.METADATA, 'active_snapshot');
    batchPromises.push(
      setDoc(snapshotDocRef, {
        lastUpdated: new Date().toISOString(),
        subjectsCount: state.subjects.length,
        studentsCount: state.students.length,
        scoresCount: state.scores.length,
        predictionsCount: state.predictions.length,
        pastCutoffsCount: state.pastCutoffRecords.length,
      })
    );

    // 2. Save individual items
    // Subjects
    for (const sub of state.subjects) {
      batchPromises.push(setDoc(doc(db, COLLECTIONS.SUBJECTS, sub.id), sub, { merge: true }));
    }

    // Past Cutoffs
    for (const past of state.pastCutoffRecords) {
      batchPromises.push(setDoc(doc(db, COLLECTIONS.PAST_CUTOFFS, past.id), past, { merge: true }));
    }

    // Master Snapshot Container
    const fullStateRef = doc(db, COLLECTIONS.METADATA, 'full_academic_state');
    batchPromises.push(
      setDoc(fullStateRef, {
        updatedAt: new Date().toISOString(),
        subjects: state.subjects,
        students: state.students,
        scores: state.scores,
        predictions: state.predictions,
        actualCutoffs: state.actualCutoffs,
        auditLogs: state.auditLogs.slice(0, 100),
        pastCutoffRecords: state.pastCutoffRecords,
        mappingPresets: state.mappingPresets || [],
      })
    );

    await Promise.all(batchPromises);
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error: any) {
    console.error('Firestore Backup Error:', error);
    return { success: false, error: error.message };
  }
};

// Restore Full State from Firestore
export const restoreStateFromFirestore = async () => {
  try {
    const fullStateRef = doc(db, COLLECTIONS.METADATA, 'full_academic_state');
    const snap = await getDoc(fullStateRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() };
    } else {
      return { success: false, error: '클라우드에 저장된 백업 데이터가 아직 없습니다.' };
    }
  } catch (error: any) {
    console.error('Firestore Restore Error:', error);
    return { success: false, error: error.message };
  }
};
