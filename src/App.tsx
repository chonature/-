import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Subject,
  Student,
  Score,
  PredictionScore,
  CutoffResult,
  ActualCutoff,
  AuditLog,
  ExcelColumnMapping,
  PastCutoffRecord,
} from './types';
import { Header } from './components/Header';
import { CutoffDashboard } from './components/CutoffDashboard';
import { AllSubjectsCutoffs } from './components/AllSubjectsCutoffs';
import { PastCutoffsHistory } from './components/PastCutoffsHistory';
import { CombinedScoresInput } from './components/CombinedScoresInput';
import { ExcelImportWizard } from './components/ExcelImportWizard';
import { AdminConfigModal } from './components/AdminConfigModal';
import { AuditLogView } from './components/AuditLogView';
import { RosterUploadModal } from './components/RosterUploadModal';
import { LoginModal } from './components/LoginModal';
import { backupStateToFirestore, restoreStateFromFirestore } from './lib/firebase';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [deletedSubjects, setDeletedSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [predictions, setPredictions] = useState<PredictionScore[]>([]);
  const [cutoffsBySubject, setCutoffsBySubject] = useState<
    Record<string, CutoffResult>
  >({});
  const [actualCutoffs, setActualCutoffs] = useState<ActualCutoff[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [mappingPresets, setMappingPresets] = useState<ExcelColumnMapping[]>([]);
  const [pastCutoffRecords, setPastCutoffRecords] = useState<PastCutoffRecord[]>([]);

  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch state on load and attempt automatic Firestore restore if available
  const initialCloudCheckDone = useRef<boolean>(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data) {
        setUsers(data.users || []);
        setSubjects(data.subjects || []);
        setDeletedSubjects(data.deletedSubjects || []);
        if (data.subjects && data.subjects.length > 0) {
          setSelectedSubjectId((prev) => {
            if (prev && data.subjects.some((s: any) => s.id === prev)) {
              return prev;
            }
            return data.subjects[0].id;
          });
        }
        setStudents(data.students || []);
        setScores(data.scores || []);
        setPredictions(data.predictions || []);
        setCutoffsBySubject(data.cutoffsBySubject || {});
        setActualCutoffs(data.actualCutoffs || []);
        setAuditLogs(data.auditLogs || []);
        setMappingPresets(data.mappingPresets || []);
        if (data.pastCutoffRecords) {
          setPastCutoffRecords(data.pastCutoffRecords);
        }
      }

      // Check cloud on first boot
      if (!initialCloudCheckDone.current) {
        initialCloudCheckDone.current = true;
        try {
          const cloudRes = await restoreStateFromFirestore();
          if (cloudRes.success && cloudRes.data) {
            console.log('Restoring from Firestore cloud snapshot on app launch...');
            await fetch('/api/state/sync-all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cloudRes.data),
            });
            const refreshedRes = await fetch('/api/state');
            const refData = await refreshedRes.json();
            if (refData) {
              setUsers(refData.users || []);
              setSubjects(refData.subjects || []);
              setDeletedSubjects(refData.deletedSubjects || []);
              if (refData.subjects && refData.subjects.length > 0) {
                setSelectedSubjectId(refData.subjects[0].id);
              }
              setStudents(refData.students || []);
              setScores(refData.scores || []);
              setPredictions(refData.predictions || []);
              setCutoffsBySubject(refData.cutoffsBySubject || {});
              setActualCutoffs(refData.actualCutoffs || []);
              setAuditLogs(refData.auditLogs || []);
              setMappingPresets(refData.mappingPresets || []);
              if (refData.pastCutoffRecords) {
                setPastCutoffRecords(refData.pastCutoffRecords);
              }
            }
            setLastCloudSyncTime(cloudRes.data.updatedAt || new Date().toISOString());
          }
        } catch (cloudErr) {
          console.warn('Initial cloud restore check:', cloudErr);
        }
      }
    } catch (err) {
      console.error('Fetch state error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Automatic debounced background persistence to Firebase Firestore
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialCloudCheckDone.current || isLoading) return;
    if (subjects.length === 0 && students.length === 0) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await backupStateToFirestore({
          schoolName: '전주대학교사범대학부설고등학교',
          subjects,
          students,
          scores,
          predictions,
          actualCutoffs,
          auditLogs,
          pastCutoffRecords,
          mappingPresets,
        });
        if (res.success) {
          setLastCloudSyncTime(res.timestamp || new Date().toISOString());
        }
      } catch (err) {
        console.warn('Background auto-save to Firestore warning:', err);
      }
    }, 2500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [subjects, scores, predictions, actualCutoffs, pastCutoffRecords, students]);

  // Set up SSE Event Listener for Realtime Multi-Teacher Sync
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener('connected', () => {
        setIsConnected(true);
      });

      eventSource.addEventListener('score_updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data) {
          if (data.expectedScore !== undefined) {
            setPredictions((prev) => {
              const idx = prev.findIndex(
                (p) =>
                  p.studentId === data.studentId && p.subjectId === data.subjectId
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], expectedScore: data.expectedScore };
                return next;
              } else {
                return [
                  ...prev,
                  {
                    id: `pred_${data.studentId}_${data.subjectId}`,
                    studentId: data.studentId,
                    subjectId: data.subjectId,
                    expectedScore: data.expectedScore,
                    updatedBy: data.updatedBy || '교사',
                    updatedAt: data.updatedAt || new Date().toISOString(),
                  },
                ];
              }
            });
          } else if (data.assessmentType) {
            setScores((prev) => {
              const idx = prev.findIndex(
                (s) =>
                  s.studentId === data.studentId &&
                  s.subjectId === data.subjectId &&
                  s.assessmentType === data.assessmentType
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], rawScore: data.rawScore };
                return next;
              }
              return prev;
            });
          }

          if (data.cutoff && data.subjectId) {
            setCutoffsBySubject((prev) => ({
              ...prev,
              [data.subjectId]: data.cutoff,
            }));
          }

          if (data.auditLogs) {
            setAuditLogs(data.auditLogs);
          }
        }
      });

      eventSource.addEventListener('users_updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.users) {
          setUsers(data.users);
        }
      });

      eventSource.addEventListener('subject_deleted', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.subjects) {
          setSubjects(data.subjects);
          if (data.deletedSubjects) setDeletedSubjects(data.deletedSubjects);
          if (data.subjects.length > 0) {
            setSelectedSubjectId((prev) => {
              if (!data.subjects.some((s: any) => s.id === prev)) {
                return data.subjects[0].id;
              }
              return prev;
            });
          } else {
            setSelectedSubjectId('');
          }
        }
        fetchState();
      });

      eventSource.addEventListener('subject_updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.subject) {
          setSubjects((prev) =>
            prev.map((s) => (s.id === data.subject.id ? data.subject : s))
          );
          if (data.cutoff) {
            setCutoffsBySubject((prev) => ({
              ...prev,
              [data.subject.id]: data.cutoff,
            }));
          }
        }
      });

      eventSource.addEventListener('subject_created', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.subject) {
          setSubjects((prev) => {
            if (prev.some((s) => s.id === data.subject.id)) return prev;
            return [...prev, data.subject];
          });
          if (data.cutoff) {
            setCutoffsBySubject((prev) => ({
              ...prev,
              [data.subject.id]: data.cutoff,
            }));
          }
          setSelectedSubjectId(data.subject.id);
        }
      });

      eventSource.addEventListener('actual_cutoff_updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.record) {
          setActualCutoffs((prev) => {
            const idx = prev.findIndex((a) => a.subjectId === data.record.subjectId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = data.record;
              return next;
            }
            return [...prev, data.record];
          });
        }
      });

      eventSource.addEventListener('bulk_imported', () => {
        fetchState();
      });

      eventSource.addEventListener('past_cutoffs_updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data && data.records) {
          setPastCutoffRecords(data.records);
        }
      });

      eventSource.addEventListener('state_resynced', () => {
        fetchState();
      });

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.error('SSE Error:', err);
      setIsConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Cloud Backup Handler to Firebase Firestore
  const handleCloudBackup = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await backupStateToFirestore({
        schoolName: '전주대학교사범대학부설고등학교',
        subjects,
        students,
        scores,
        predictions,
        actualCutoffs,
        auditLogs,
        pastCutoffRecords,
        mappingPresets,
      });
      if (res.success) {
        setLastCloudSyncTime(res.timestamp || new Date().toISOString());
      } else {
        throw new Error(res.error);
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Cloud Restore Handler from Firebase Firestore
  const handleCloudRestore = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await restoreStateFromFirestore();
      if (res.success && res.data) {
        // Post state to backend server to update in-memory and broadcast
        await fetch('/api/state/sync-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(res.data),
        });
        await fetchState();
        setLastCloudSyncTime(new Date().toISOString());
      } else {
        throw new Error(res.error);
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Update Prediction Score (2차고사 예상)
  const handleUpdatePrediction = async (studentId: string, expectedScore: number) => {
    try {
      const res = await fetch('/api/predictions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          subjectId: selectedSubjectId,
          expectedScore,
          updatedBy: currentUser?.name || '담당 교사',
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Local update handled by SSE or optimism
      }
    } catch (err) {
      console.error('Update prediction error:', err);
    }
  };

  // Update Score (Performance or Midterm)
  const handleUpdateScore = async (
    studentId: string,
    assessmentType: 'PERFORMANCE' | 'MIDTERM',
    rawScore: number
  ) => {
    try {
      const res = await fetch('/api/scores/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          subjectId: selectedSubjectId,
          assessmentType,
          rawScore,
          updatedBy: currentUser?.name || '담당 교사',
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Local state updated via SSE
      }
    } catch (err) {
      console.error('Update score error:', err);
    }
  };

  // Update Evaluation Weights
  const handleUpdateWeights = async (data: {
    subjectId: string;
    midtermWeight: number;
    performanceWeight: number;
    finalWeight: number;
  }) => {
    try {
      const res = await fetch('/api/weights/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === data.subjectId ? result.subject : s))
        );
      }
    } catch (err) {
      console.error('Update weights error:', err);
    }
  };

  // Update Actual Cutoff Scores
  const handleUpdateActualCutoff = async (data: {
    subjectId: string;
    actualA: number;
    actualB: number;
    actualC: number;
    actualD: number;
  }) => {
    try {
      const res = await fetch('/api/actual-cutoffs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          updatedBy: currentUser?.name || '관리자',
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Updated
      }
    } catch (err) {
      console.error('Update actual cutoff error:', err);
    }
  };

  // Bulk Excel Import
  const handleImportSuccess = async (importData: {
    importedStudents: any[];
    importedScores: any[];
    importedPredictions: any[];
    subjectId: string;
  }) => {
    try {
      await fetch('/api/excel/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...importData,
          uploaderName: currentUser?.name || '교사',
        }),
      });
      fetchState();
    } catch (err) {
      console.error('Import error:', err);
    }
  };

  // Save Mapping Preset
  const handleSavePreset = async (presetName: string, mapping: any) => {
    try {
      const res = await fetch('/api/mapping-presets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetName, mapping }),
      });
      const data = await res.json();
      if (data.mappingPresets) {
        setMappingPresets(data.mappingPresets);
      }
    } catch (err) {
      console.error('Save preset error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold tracking-wide">
            전주대학교사범대학부설고등학교 성적 시스템을 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginModal
        schoolName="전주대학교사범대학부설고등학교"
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          fetchState();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F3F5] font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          users={users}
          onSelectUser={(u) => {
            setCurrentUser(u);
            if (u.assignedSubjectIds && u.assignedSubjectIds.length > 0) {
              setSelectedSubjectId(u.assignedSubjectIds[0]);
            }
          }}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isConnected={isConnected}
          onLogout={() => setCurrentUser(null)}
          schoolName="전주대학교사범대학부설고등학교"
          onCloudBackup={handleCloudBackup}
          onCloudRestore={handleCloudRestore}
          isCloudSyncing={isCloudSyncing}
          lastCloudSyncTime={lastCloudSyncTime}
        />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {activeTab === 'dashboard' && (
            <CutoffDashboard
              subjects={subjects}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={setSelectedSubjectId}
              cutoffsBySubject={cutoffsBySubject}
              actualCutoffs={actualCutoffs}
              onUpdateActualCutoff={handleUpdateActualCutoff}
              currentUser={currentUser}
              onNavigateToPredictions={() => setActiveTab('scores')}
              auditLogs={auditLogs}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'all-cutoffs' && (
            <AllSubjectsCutoffs
              subjects={subjects}
              cutoffsBySubject={cutoffsBySubject}
              onSelectSubject={setSelectedSubjectId}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'past-cutoffs' && (
            <PastCutoffsHistory
              pastRecords={pastCutoffRecords}
              subjects={subjects}
              cutoffsBySubject={cutoffsBySubject}
              currentUser={currentUser}
              onRefresh={fetchState}
            />
          )}

          {(activeTab === 'scores' || activeTab === 'predictions' || activeTab === 'performance') && currentUser && (
            <CombinedScoresInput
              currentUser={currentUser}
              subjects={subjects}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={setSelectedSubjectId}
              students={students}
              scores={scores}
              predictions={predictions}
              cutoffsBySubject={cutoffsBySubject}
              onUpdateScore={handleUpdateScore}
              onUpdatePrediction={handleUpdatePrediction}
              onRefreshData={fetchState}
            />
          )}

          {activeTab === 'excel' && currentUser && (
            <ExcelImportWizard
              subjects={subjects}
              mappingPresets={mappingPresets}
              onImportSuccess={handleImportSuccess}
              onSavePreset={handleSavePreset}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'config' && currentUser && (
            <AdminConfigModal
              subjects={subjects}
              deletedSubjects={deletedSubjects}
              users={users}
              onUpdateWeights={handleUpdateWeights}
              currentUser={currentUser}
              onRefreshData={fetchState}
            />
          )}

          {activeTab === 'audit' && <AuditLogView auditLogs={auditLogs} />}
        </main>
      </div>

      <RosterUploadModal
        isOpen={activeTab === 'roster'}
        onClose={() => setActiveTab('scores')}
        onRosterUploaded={fetchState}
        currentUser={currentUser}
      />

      {/* Bento Grid Footer */}
      <footer className="mt-12 border-t border-slate-200/80 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <p>© 2026 NICE Predicted Cutoff Engine • 전주대학교사범대학부설고등학교 성적 분석 서비스</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Database Linked
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              SSE Realtime Broadcaster
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
