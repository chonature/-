import React, { useState, useMemo } from 'react';
import { Subject, Student, Score, PredictionScore, CutoffResult, User } from '../types';
import { calculateStudentFinalScore } from '../lib/scoreEngine';
import { AddSubjectModal } from './AddSubjectModal';
import { RosterUploadModal } from './RosterUploadModal';
import {
  Edit3,
  Search,
  Filter,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  BookOpen,
  PlusCircle,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';

interface CombinedScoresInputProps {
  currentUser: User;
  subjects: Subject[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  students: Student[];
  scores: Score[];
  predictions: PredictionScore[];
  cutoffsBySubject: Record<string, CutoffResult>;
  onUpdateScore: (studentId: string, assessmentType: 'PERFORMANCE' | 'MIDTERM', rawScore: number) => Promise<void>;
  onUpdatePrediction: (studentId: string, expectedScore: number) => Promise<void>;
  onRefreshData?: () => void;
}

export const CombinedScoresInput: React.FC<CombinedScoresInputProps> = ({
  currentUser,
  subjects,
  selectedSubjectId,
  onSelectSubject,
  students,
  scores,
  predictions,
  cutoffsBySubject,
  onUpdateScore,
  onUpdatePrediction,
  onRefreshData,
}) => {
  const currentSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || {
      id: 'sub_math',
      schoolId: 'sch_1',
      name: '수학 I',
      grade: 1,
      semester: 1,
      midtermWeight: 30,
      performanceWeight: 30,
      finalWeight: 40,
      midtermMaxScore: 100,
      performanceMaxScore: 40,
      finalMaxScore: 100,
    };
  }, [subjects, selectedSubjectId]);

  const currentCutoff = cutoffsBySubject[currentSubject.id];

  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUnentered, setOnlyUnentered] = useState(false);

  // Local editing states to avoid jumping inputs
  const [editingPerf, setEditingPerf] = useState<Record<string, string>>({});
  const [editingFinal, setEditingFinal] = useState<Record<string, string>>({});

  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkSaveMsg, setBulkSaveMsg] = useState<string | null>(null);

  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  // Filter students belonging to current subject
  const subjectStudents = useMemo(() => {
    return students.filter((st) => {
      if (st.grade !== currentSubject.grade) return false;

      if (st.enrolledSubjectIds && Array.isArray(st.enrolledSubjectIds)) {
        if (st.enrolledSubjectIds.includes(currentSubject.id)) return true;
        const hasScore = scores.some((sc) => sc.studentId === st.id && sc.subjectId === currentSubject.id);
        const hasPred = predictions.some((p) => p.studentId === st.id && p.subjectId === currentSubject.id);
        return hasScore || hasPred;
      }

      const hasScore = scores.some((sc) => sc.studentId === st.id && sc.subjectId === currentSubject.id);
      const hasPred = predictions.some((p) => p.studentId === st.id && p.subjectId === currentSubject.id);
      return hasScore || hasPred || !st.enrolledSubjectIds;
    });
  }, [students, currentSubject, scores, predictions]);

  // Synchronize editing state from props when subject changes or predictions/scores update
  React.useEffect(() => {
    const perfMap: Record<string, string> = {};
    const finalMap: Record<string, string> = {};

    subjectStudents.forEach((st) => {
      const pScore = scores.find(
        (s) => s.studentId === st.id && s.subjectId === currentSubject.id && s.assessmentType === 'PERFORMANCE'
      );
      if (pScore !== undefined) {
        perfMap[st.id] = String(pScore.rawScore);
      }

      const pred = predictions.find(
        (p) => p.studentId === st.id && p.subjectId === currentSubject.id
      );
      if (pred !== undefined) {
        finalMap[st.id] = String(pred.expectedScore);
      }
    });

    setEditingPerf(perfMap);
    setEditingFinal(finalMap);
  }, [currentSubject.id, subjectStudents, scores, predictions]);

  // Compute calculated values for each student
  const studentRows = useMemo(() => {
    return subjectStudents.map((st) => {
      const calc = calculateStudentFinalScore(st.id, currentSubject, scores, predictions);

      const pVal = editingPerf[st.id] !== undefined ? editingPerf[st.id] : '';
      const fVal = editingFinal[st.id] !== undefined ? editingFinal[st.id] : '';

      // Live estimate calculation
      const mRaw = calc.midterm;
      const pRaw = pVal !== '' && !isNaN(Number(pVal)) ? Number(pVal) : calc.performance;
      const fRaw = fVal !== '' && !isNaN(Number(fVal)) ? Number(fVal) : calc.finalExpected;

      const mMax = currentSubject.midtermMaxScore || 100;
      const pMax = currentSubject.performanceMaxScore || 40;
      const fMax = currentSubject.finalMaxScore || 100;

      const mW = currentSubject.midtermWeight;
      const pW = currentSubject.performanceWeight;
      const fW = currentSubject.finalWeight;

      let liveTotal = 0;
      let enteredW = 0;
      if (mRaw !== null) {
        liveTotal += (mRaw / mMax) * mW;
        enteredW += mW;
      }
      if (pRaw !== null) {
        liveTotal += (pRaw / pMax) * pW;
        enteredW += pW;
      }
      if (fRaw !== null) {
        liveTotal += (fRaw / fMax) * fW;
        enteredW += fW;
      }

      // 100-pt scaled estimated score (calculated instantly even with midterm score only)
      const estimatedTotalScore = enteredW > 0 ? Math.round((liveTotal / enteredW) * 100 * 10) / 10 : null;
      const currentWeightedTotal = enteredW > 0 ? Math.round(liveTotal * 10) / 10 : null;

      // Grade determination based on 100-pt estimatedTotalScore
      let gradeLabel = '-';
      if (estimatedTotalScore !== null && currentCutoff) {
        if (estimatedTotalScore >= currentCutoff.gradeA) gradeLabel = 'A';
        else if (estimatedTotalScore >= currentCutoff.gradeB) gradeLabel = 'B';
        else if (estimatedTotalScore >= currentCutoff.gradeC) gradeLabel = 'C';
        else if (estimatedTotalScore >= currentCutoff.gradeD) gradeLabel = 'D';
        else gradeLabel = 'E';
      }

      return {
        student: st,
        midtermRaw: mRaw,
        midtermWeighted: mRaw !== null ? Math.round(((mRaw / mMax) * mW) * 10) / 10 : null,
        perfVal: pVal,
        perfRaw: pRaw,
        perfWeighted: pRaw !== null ? Math.round(((pRaw / pMax) * pW) * 10) / 10 : null,
        finalVal: fVal,
        finalRaw: fRaw,
        finalWeighted: fRaw !== null ? Math.round(((fRaw / fMax) * fW) * 10) / 10 : null,
        totalScore: estimatedTotalScore,
        currentWeightedTotal,
        enteredW,
        gradeLabel,
        isComplete: mRaw !== null && pRaw !== null && fRaw !== null,
      };
    });
  }, [subjectStudents, currentSubject, scores, predictions, editingPerf, editingFinal, currentCutoff]);

  // Bulk Save All Handler (통합 성적 전체 원클릭 저장)
  const handleBulkSaveAll = async () => {
    setIsBulkSaving(true);
    setBulkSaveMsg(null);

    const updates = subjectStudents
      .map((st) => {
        const pVal = editingPerf[st.id];
        const fVal = editingFinal[st.id];

        return {
          studentId: st.id,
          perfRaw: pVal !== undefined && pVal !== '' && !isNaN(Number(pVal)) ? Number(pVal) : null,
          finalExpected: fVal !== undefined && fVal !== '' && !isNaN(Number(fVal)) ? Number(fVal) : null,
        };
      })
      .filter((u) => u.perfRaw !== null || u.finalExpected !== null);

    try {
      const res = await fetch('/api/scores/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: currentSubject.id,
          updates,
          updatedBy: currentUser.name || '교사',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBulkSaveMsg(`✅ 모든 성적 데이터(${data.count}건)가 단 한 번의 클릭으로 성공적으로 저장되었습니다!`);
        if (onRefreshData) onRefreshData();
        setTimeout(() => setBulkSaveMsg(null), 3500);
      } else {
        alert(data.error || '성적 일괄 저장 실패');
      }
    } catch (err) {
      console.error('Bulk save error:', err);
      alert('성적 저장 처리 중 오류가 발생했습니다.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Copy 1st Exam (Midterm) scores to 2nd Exam Expected scores for all students and AUTO-SAVE
  const handleCopyMidtermToFinalAll = async () => {
    let copiedCount = 0;
    const newFinalMap: Record<string, string> = { ...editingFinal };
    const updates: Array<{ studentId: string; perfRaw?: number | null; finalExpected?: number | null }> = [];

    studentRows.forEach((r) => {
      if (r.midtermRaw !== null && r.midtermRaw !== undefined && !isNaN(Number(r.midtermRaw))) {
        const valStr = String(r.midtermRaw);
        newFinalMap[r.student.id] = valStr;
        copiedCount++;

        const pVal = editingPerf[r.student.id];
        updates.push({
          studentId: r.student.id,
          perfRaw: pVal !== undefined && pVal !== '' && !isNaN(Number(pVal)) ? Number(pVal) : null,
          finalExpected: Number(r.midtermRaw),
        });
      }
    });

    setEditingFinal(newFinalMap);

    if (copiedCount === 0) {
      alert('1차지필고사 성적이 입력된 학생이 없습니다. 엑셀 Import 또는 1차 성적을 먼저 업로드/확인해 주세요.');
      return;
    }

    setIsBulkSaving(true);
    setBulkSaveMsg(`⚡ 전체 학생 (${copiedCount}명)의 1차지필 성적을 2차지필 예상 점수로 반영 및 저장 중...`);

    try {
      const res = await fetch('/api/scores/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: currentSubject.id,
          updates,
          updatedBy: currentUser.name || '교사',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBulkSaveMsg(`⚡ 전체 학생 (${copiedCount}명)의 1차지필 성적이 2차지필 예상 항목에 모두 자동 반영 및 저장되었습니다!`);
        if (onRefreshData) onRefreshData();
        setTimeout(() => setBulkSaveMsg(null), 4000);
      } else {
        alert(data.error || '성적 일괄 저장 실패');
      }
    } catch (err) {
      console.error('Auto save error:', err);
      alert('자동 저장 중 오류가 발생했습니다.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    return studentRows.filter((r) => {
      if (onlyUnentered && r.perfVal !== '' && r.finalVal !== '') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = r.student.name.toLowerCase().includes(q);
        const numMatch = r.student.studentNumber.includes(q);
        if (!nameMatch && !numMatch) return false;
      }
      return true;
    });
  }, [studentRows, onlyUnentered, searchQuery]);

  // Single row save handler
  const handleSaveRow = async (studentId: string) => {
    const pVal = editingPerf[studentId];
    const fVal = editingFinal[studentId];

    setSavingStudentId(studentId);

    try {
      if (pVal !== undefined && pVal !== '') {
        const numP = Number(pVal);
        if (!isNaN(numP)) {
          await onUpdateScore(studentId, 'PERFORMANCE', numP);
        }
      }

      if (fVal !== undefined && fVal !== '') {
        const numF = Number(fVal);
        if (!isNaN(numF)) {
          await onUpdatePrediction(studentId, numF);
        }
      }

      setSavedSuccessId(studentId);
      setTimeout(() => setSavedSuccessId(null), 1500);
    } catch (err) {
      console.error('Save score error:', err);
    } finally {
      setSavingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Subject Selector */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs font-black border border-indigo-200">
                통합 성적 관리
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {currentSubject.name} ({currentSubject.grade}학년 {currentSubject.semester}학기)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              반영비율: 중간고사 <strong className="text-slate-800 font-extrabold">{currentSubject.midtermWeight}%</strong> (100점 만점) • 수행평가 <strong className="text-slate-800 font-extrabold">{currentSubject.performanceWeight}%</strong> ({currentSubject.performanceMaxScore}점 만점) • 2차고사 예상 <strong className="text-slate-800 font-extrabold">{currentSubject.finalWeight}%</strong> (100점 만점)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBulkSaveAll}
              disabled={isBulkSaving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer border border-indigo-500"
            >
              <Save className="w-4 h-4 text-indigo-200" />
              {isBulkSaving ? '전체 성적 저장 중...' : '💾 전체 성적 변경사항 한 번에 저장'}
            </button>

            <button
              onClick={handleCopyMidtermToFinalAll}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="모든 학생의 2차지필 예상점수에 1차지필 성적을 동일하게 채워넣습니다"
            >
              <Zap className="w-4 h-4 text-amber-600 fill-amber-400" />
              ⚡ 전체 2차점수를 1차점수로 채우기
            </button>

            <button
              onClick={() => setIsRosterModalOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-600" />
              명렬표 등록/교체
            </button>

            <button
              onClick={() => setIsAddSubjectModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 rounded-xl text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-slate-600" />
              + 과목 추가
            </button>
          </div>
        </div>

        {bulkSaveMsg && (
          <div className="bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{bulkSaveMsg}</span>
          </div>
        )}

        {/* Subject Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-xs font-extrabold text-slate-400 mr-1 whitespace-nowrap">분석 과목:</span>
          {subjects.map((subj) => (
            <button
              key={subj.id}
              onClick={() => onSelectSubject(subj.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                subj.id === currentSubject.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {subj.name} ({subj.grade}학년)
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Student Count Stats */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-700">
          <span className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl">
            전체 수강생 <strong className="text-indigo-600 font-extrabold">{subjectStudents.length}명</strong>
          </span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl">
            입력 완료 <strong className="text-emerald-700 font-extrabold">{studentRows.filter((r) => r.isComplete).length}명</strong>
          </span>
          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl">
            미입력 <strong className="text-amber-700 font-extrabold">{studentRows.filter((r) => !r.isComplete).length}명</strong>
          </span>
        </div>

        {/* Filter Checkbox & Search */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyUnentered}
              onChange={(e) => setOnlyUnentered(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            미입력 학생만 보기
          </label>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="학번 또는 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* Main Integrated Score Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 font-black text-slate-600 border-b border-slate-200 uppercase">
              <tr>
                <th className="px-4 py-3.5">학번</th>
                <th className="px-4 py-3.5">이름</th>
                <th className="px-4 py-3.5 text-center bg-blue-50/50 text-blue-900 border-x border-slate-200">
                  1차지필 (중간 {currentSubject.midtermWeight}%)
                </th>
                <th className="px-4 py-3.5 text-center bg-purple-50/50 text-purple-900 border-r border-slate-200">
                  수행평가 ({currentSubject.performanceMaxScore}점 만점 / {currentSubject.performanceWeight}%)
                </th>
                <th className="px-4 py-3.5 text-center bg-indigo-50/50 text-indigo-900 border-r border-slate-200">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>2차지필 예상 (100점 / {currentSubject.finalWeight}%)</span>
                    <button
                      onClick={handleCopyMidtermToFinalAll}
                      className="text-[10px] font-black bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-300 transition-all cursor-pointer shadow-2xs"
                      title="모든 학생의 1차 점수를 2차 점수로 일괄 채우기"
                    >
                      ⚡ 1차점수로 채우기
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center bg-indigo-100/60 text-indigo-950 border-x border-slate-200">
                  추정 환산 총점 (100점 만점)
                </th>
                <th className="px-4 py-3.5 text-center">예상 성취도</th>
                <th className="px-4 py-3.5 text-right">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => {
                const isSaving = savingStudentId === r.student.id;
                const isSaved = savedSuccessId === r.student.id;

                return (
                  <tr key={r.student.id} className="hover:bg-slate-50/80 transition-all">
                    {/* 학번 */}
                    <td className="px-4 py-3 font-black text-slate-900">{r.student.studentNumber}</td>

                    {/* 이름 */}
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {r.student.name ? (
                        r.student.name
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">(명렬표 미등록)</span>
                      )}
                    </td>

                    {/* 1차지필 (중간고사) - Read-only Reference */}
                    <td className="px-4 py-3 text-center bg-blue-50/20 border-x border-slate-200">
                      {r.midtermRaw !== null ? (
                        <div>
                          <span className="font-black text-slate-900 text-xs">{r.midtermRaw}점</span>
                          <span className="block text-[10px] font-bold text-blue-600">
                            (환산: {r.midtermWeighted}점)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold text-[11px]">미입력</span>
                      )}
                    </td>

                    {/* 수행평가 - Editable Input */}
                    <td className="px-4 py-3 text-center bg-purple-50/20 border-r border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max={currentSubject.performanceMaxScore}
                          placeholder="0"
                          value={r.perfVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingPerf((prev) => ({ ...prev, [r.student.id]: val }));
                          }}
                          className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-1 text-center text-xs font-black text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"
                        />
                        <span className="text-[10px] font-bold text-purple-700">
                          {r.perfWeighted !== null ? `(${r.perfWeighted}점)` : `/${currentSubject.performanceMaxScore}`}
                        </span>
                      </div>
                    </td>

                    {/* 2차지필 예상 - Editable Input */}
                    <td className="px-4 py-3 text-center bg-indigo-50/20 border-r border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={r.finalVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingFinal((prev) => ({ ...prev, [r.student.id]: val }));
                          }}
                          className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-1 text-center text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs"
                        />
                        <span className="text-[10px] font-bold text-indigo-700">
                          {r.finalWeighted !== null ? `(${r.finalWeighted}점)` : `/100`}
                        </span>
                      </div>
                    </td>

                    {/* 추정 환산 총점 */}
                    <td className="px-4 py-3 text-center bg-indigo-50/20 border-x border-slate-200">
                      {r.totalScore !== null ? (
                        <div>
                          <span className="text-sm font-black text-indigo-950">{r.totalScore}점</span>
                          <span className="block text-[10px] font-bold text-indigo-600">
                            {r.isComplete ? '(완가중치 합산)' : `(누적 ${r.enteredW}% 환산)`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold text-[11px]">-</span>
                      )}
                    </td>

                    {/* 예상 성취도 (A~E) */}
                    <td className="px-4 py-3 text-center">
                      {r.gradeLabel !== '-' ? (
                        <span
                          className={`inline-block px-3 py-0.5 rounded-lg text-xs font-black shadow-2xs ${
                            r.gradeLabel === 'A'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : r.gradeLabel === 'B'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : r.gradeLabel === 'C'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : r.gradeLabel === 'D'
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {r.gradeLabel}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold">-</span>
                      )}
                    </td>

                    {/* 저장 버튼 */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSaveRow(r.student.id)}
                        disabled={isSaving}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ml-auto cursor-pointer ${
                          isSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 완료
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 text-indigo-400" />
                            {isSaving ? '저장...' : '저장'}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    조건에 해당하는 학생 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddSubjectModal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        onSubjectCreated={(newSubj) => {
          onSelectSubject(newSubj.id);
        }}
      />

      <RosterUploadModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        onRosterUploaded={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
