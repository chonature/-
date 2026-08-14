import React, { useState, useMemo } from 'react';
import { Student, Subject, Score, PredictionScore, User, AuditLog } from '../types';
import { calculateStudentFinalScore } from '../lib/scoreEngine';
import { Search, Filter, AlertCircle, Save, CheckCircle2, Zap, ArrowUpDown } from 'lucide-react';

interface ExpectedScoresInputProps {
  subjects: Subject[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  students: Student[];
  scores: Score[];
  predictions: PredictionScore[];
  onUpdatePrediction: (studentId: string, expectedScore: number) => void;
  currentUser: User;
  auditLogs: AuditLog[];
}

export const ExpectedScoresInput: React.FC<ExpectedScoresInputProps> = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  students,
  scores,
  predictions,
  onUpdatePrediction,
  currentUser,
  auditLogs,
}) => {
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const [selectedClass, setSelectedClass] = useState<number | 'ALL'>('ALL');
  const [onlyUnentered, setOnlyUnentered] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Initialize input state values from predictions
  React.useEffect(() => {
    const map: Record<string, string> = {};
    predictions.forEach((p) => {
      if (p.subjectId === currentSubject.id) {
        map[p.studentId] = String(p.expectedScore);
      }
    });
    setEditingValues(map);
  }, [selectedSubjectId, predictions, currentSubject.id]);

  // Compute student list with calculated scores
  const studentDataList = useMemo(() => {
    return students.map((st) => {
      const calc = calculateStudentFinalScore(st.id, currentSubject, scores, predictions);
      const currentInputVal = editingValues[st.id] !== undefined ? editingValues[st.id] : '';
      return {
        student: st,
        midterm: calc.midterm,
        performance: calc.performance,
        finalExpected: calc.finalExpected,
        totalExpected: calc.totalExpected,
        isComplete: calc.isComplete,
        currentInputVal,
      };
    });
  }, [students, currentSubject, scores, predictions, editingValues]);

  // Filter student list (Subject-only, no class filter tabs)
  const filteredStudents = useMemo(() => {
    return studentDataList.filter((item) => {
      // Unentered filter
      if (onlyUnentered && item.finalExpected !== null && item.currentInputVal !== '') {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = item.student.name.toLowerCase().includes(q);
        const matchNum = item.student.studentNumber.includes(q);
        if (!matchName && !matchNum) return false;
      }
      return true;
    });
  }, [studentDataList, onlyUnentered, searchQuery]);

  // Unentered count for this subject
  const unenteredTotalCount = useMemo(() => {
    return studentDataList.filter((item) => item.finalExpected === null).length;
  }, [studentDataList]);

  // Auto-save handler on input change or blur
  const handleScoreChange = (studentId: string, val: string) => {
    setEditingValues((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleScoreBlur = (studentId: string) => {
    const rawVal = editingValues[studentId];
    if (rawVal === undefined || rawVal === '') return;

    const num = Number(rawVal);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onUpdatePrediction(studentId, num);
      setLastSavedId(studentId);
      setTimeout(() => setLastSavedId(null), 1500);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* View Title & Subject Switcher Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600" />
            2차고사 예상점수 초고속 입력 (실시간 자동 저장)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            점수를 입력하거나 수정한 후 포커스를 이동하면 즉시 서버에 저장되고 전체 분할점수가 재계산됩니다.
          </p>
        </div>

        {/* Subject Pills */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {subjects.map((subj) => (
            <button
              key={subj.id}
              onClick={() => onSelectSubject(subj.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                subj.id === selectedSubjectId
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {subj.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Subject-only Student Count Indicator */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200">
            [{currentSubject.name}] 과목 전체 학생 ({studentDataList.length}명)
          </span>
        </div>

        {/* Filter Toggle & Search */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Unentered Toggle Button */}
          <button
            onClick={() => setOnlyUnentered(!onlyUnentered)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
              onlyUnentered
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            미입력 학생만 보기 ({unenteredTotalCount}명)
          </button>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="학생명 또는 학번 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Student Scores Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">
            총 {filteredStudents.length}명 표시 중 (전체 {students.length}명)
          </span>
          <span className="text-slate-500">
            반영비율: 중간 {currentSubject.midtermWeight}% | 수행 {currentSubject.performanceWeight}% | 2차고사 {currentSubject.finalWeight}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100/80 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">학번</th>
                <th className="px-4 py-3">학생 성명</th>
                <th className="px-4 py-3 text-center">중간고사 (100점)</th>
                <th className="px-4 py-3 text-center">수행평가 (40점)</th>
                <th className="px-4 py-3 text-center bg-indigo-50 text-indigo-900 font-extrabold border-x border-indigo-100">
                  2차고사 예상점수 (입력)
                </th>
                <th className="px-4 py-3 text-center">예상 최종점수 (100점)</th>
                <th className="px-4 py-3 text-center">저장 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    조건에 해당하는 학생 성적 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((item) => {
                  const isSavedJustNow = lastSavedId === item.student.id;
                  const isMissing = item.finalExpected === null;

                  return (
                    <tr
                      key={item.student.id}
                      className={`hover:bg-indigo-50/20 transition-colors ${
                        isMissing ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-bold text-slate-600">
                        {item.student.studentNumber}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.student.name}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {item.midterm !== null ? `${item.midterm}점` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {item.performance !== null ? `${item.performance}점` : '-'}
                      </td>

                      {/* Interactive Editable Input Field */}
                      <td className="px-4 py-2 text-center bg-indigo-50/20 border-x border-indigo-100">
                        <div className="relative inline-block w-28">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.currentInputVal}
                            onChange={(e) =>
                              handleScoreChange(item.student.id, e.target.value)
                            }
                            onBlur={() => handleScoreBlur(item.student.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            placeholder="예: 85"
                            className={`w-full text-center font-extrabold text-sm py-1.5 rounded-lg border focus:outline-none transition-all ${
                              item.currentInputVal === ''
                                ? 'bg-amber-100/60 border-amber-300 text-amber-900 placeholder-amber-400'
                                : 'bg-white border-indigo-300 text-indigo-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-black text-sm ${
                            item.totalExpected !== null
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.totalExpected !== null ? `${item.totalExpected}점` : '-'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isSavedJustNow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-bounce">
                            <CheckCircle2 className="w-3 h-3" />
                            저장됨
                          </span>
                        ) : isMissing ? (
                          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            미입력
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">
                            완료
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
