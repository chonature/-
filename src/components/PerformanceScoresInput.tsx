import React, { useState, useMemo } from 'react';
import { Student, Subject, Score, User } from '../types';
import { Search, CheckCircle2, Sliders, AlertCircle } from 'lucide-react';

interface PerformanceScoresInputProps {
  subjects: Subject[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  students: Student[];
  scores: Score[];
  onUpdateScore: (studentId: string, assessmentType: 'PERFORMANCE', score: number) => void;
  currentUser: User;
}

export const PerformanceScoresInput: React.FC<PerformanceScoresInputProps> = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  students,
  scores,
  onUpdateScore,
  currentUser,
}) => {
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const [selectedClass, setSelectedClass] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Sync state values from scores prop
  React.useEffect(() => {
    const map: Record<string, string> = {};
    scores.forEach((s) => {
      if (s.subjectId === currentSubject.id && s.assessmentType === 'PERFORMANCE') {
        map[s.studentId] = String(s.rawScore);
      }
    });
    setEditingValues(map);
  }, [selectedSubjectId, scores, currentSubject.id]);

  const maxScore = currentSubject.performanceMaxScore || 40;

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = st.name.toLowerCase().includes(q);
        const matchNum = st.studentNumber.includes(q);
        if (!matchName && !matchNum) return false;
      }
      return true;
    });
  }, [students, searchQuery]);

  const handleScoreChange = (studentId: string, val: string) => {
    setEditingValues((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleScoreBlur = (studentId: string) => {
    const rawVal = editingValues[studentId];
    if (rawVal === undefined || rawVal === '') return;

    const num = Number(rawVal);
    if (!isNaN(num) && num >= 0 && num <= maxScore) {
      onUpdateScore(studentId, 'PERFORMANCE', num);
      setLastSavedId(studentId);
      setTimeout(() => setLastSavedId(null), 1500);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            수행평가 성적 대량 입력 (만점: {maxScore}점)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            수행평가 반영비율은 현재 <span className="font-bold text-slate-800">{currentSubject.performanceWeight}%</span>입니다. 입력 후 포커스를 이동하면 즉시 저장됩니다.
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

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200">
            [{currentSubject.name}] 과목 전체 학생 ({students.length}명)
          </span>
        </div>

        <div className="relative w-full sm:w-64">
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

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100/80 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">학번</th>
                <th className="px-4 py-3">학생 성명</th>
                <th className="px-4 py-3 text-center">학년 / 반 / 번호</th>
                <th className="px-4 py-3 text-center bg-indigo-50 text-indigo-900 font-extrabold border-x border-indigo-100">
                  수행평가 점수 (만점: {maxScore}점)
                </th>
                <th className="px-4 py-3 text-center">저장 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStudents.map((st) => {
                const currentVal = editingValues[st.id] !== undefined ? editingValues[st.id] : '';
                const isSavedJustNow = lastSavedId === st.id;

                return (
                  <tr key={st.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-600">
                      {st.studentNumber}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{st.name}</td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {st.grade}학년 {st.classNum}반 {st.numberInClass}번
                    </td>
                    <td className="px-4 py-2 text-center bg-indigo-50/20 border-x border-indigo-100">
                      <input
                        type="number"
                        min="0"
                        max={maxScore}
                        value={currentVal}
                        onChange={(e) => handleScoreChange(st.id, e.target.value)}
                        onBlur={() => handleScoreBlur(st.id)}
                        placeholder={`0~${maxScore}`}
                        className="w-28 text-center font-extrabold text-sm py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-indigo-900"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSavedJustNow ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                          ✓ 저장됨
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">완료</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
