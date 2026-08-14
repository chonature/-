import React, { useState, useMemo } from 'react';
import { Subject, CutoffResult } from '../types';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Layers,
  Search,
  Filter,
  Download,
  Printer,
  ArrowRight,
  TrendingUp,
  Users,
  Award,
  CheckCircle2,
  BarChart3,
  List,
  Sparkles,
} from 'lucide-react';

interface AllSubjectsCutoffsProps {
  subjects: Subject[];
  cutoffsBySubject: Record<string, CutoffResult>;
  onSelectSubject: (subjectId: string) => void;
  onNavigateToDashboard: () => void;
}

export const AllSubjectsCutoffs: React.FC<AllSubjectsCutoffsProps> = ({
  subjects,
  cutoffsBySubject,
  onSelectSubject,
  onNavigateToDashboard,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CHART'>('TABLE');

  // Active subjects filtered by grade, semester, and search term
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subj) => {
      if (subj.isDeleted) return false;
      if (selectedGrade !== 'ALL' && String(subj.grade) !== selectedGrade) return false;
      if (selectedSemester !== 'ALL' && String(subj.semester) !== selectedSemester) return false;
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = subj.name.toLowerCase().includes(query);
        return matchesName;
      }
      return true;
    });
  }, [subjects, selectedGrade, selectedSemester, searchTerm]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    if (filteredSubjects.length === 0) {
      return { count: 0, avgCompletion: 0, avgA: 0, avgB: 0, avgC: 0, avgD: 0 };
    }

    let totalCompletion = 0;
    let totalA = 0;
    let totalB = 0;
    let totalC = 0;
    let totalD = 0;
    let validCutoffCount = 0;

    filteredSubjects.forEach((s) => {
      const c = cutoffsBySubject[s.id];
      if (c) {
        totalCompletion += c.completionRate || 0;
        totalA += c.gradeA || 0;
        totalB += c.gradeB || 0;
        totalC += c.gradeC || 0;
        totalD += c.gradeD || 0;
        validCutoffCount++;
      }
    });

    const count = filteredSubjects.length;
    return {
      count,
      avgCompletion: validCutoffCount > 0 ? (totalCompletion / validCutoffCount).toFixed(1) : '0',
      avgA: validCutoffCount > 0 ? (totalA / validCutoffCount).toFixed(1) : '0',
      avgB: validCutoffCount > 0 ? (totalB / validCutoffCount).toFixed(1) : '0',
      avgC: validCutoffCount > 0 ? (totalC / validCutoffCount).toFixed(1) : '0',
      avgD: validCutoffCount > 0 ? (totalD / validCutoffCount).toFixed(1) : '0',
    };
  }, [filteredSubjects, cutoffsBySubject]);

  // Prepare data for Recharts comparison
  const chartData = useMemo(() => {
    return filteredSubjects.map((s) => {
      const c = cutoffsBySubject[s.id];
      return {
        name: s.name,
        gradeSemester: `${s.grade}학년-${s.semester}학기`,
        'A 분할점수': c?.gradeA ?? 0,
        'B 분할점수': c?.gradeB ?? 0,
        'C 분할점수': c?.gradeC ?? 0,
        'D 분할점수': c?.gradeD ?? 0,
        평균: c?.mean ?? 0,
      };
    });
  }, [filteredSubjects, cutoffsBySubject]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredSubjects.map((s, idx) => {
      const c = cutoffsBySubject[s.id];
      return {
        순번: idx + 1,
        과목명: s.name,
        학년: `${s.grade}학년`,
        학기: `${s.semester}학기`,
        '중간 반영비율(%)': s.midtermWeight,
        '수행 반영비율(%)': s.performanceWeight,
        '기말 반영비율(%)': s.finalWeight,
        '반영 인원': `${c?.completedStudents || 0} / ${c?.totalStudents || 0}명`,
        '입력 진행률(%)': `${c?.completionRate || 0}%`,
        'A 성취도 분할점수': c?.gradeA ? `${c.gradeA}점` : '-',
        'B 성취도 분할점수': c?.gradeB ? `${c.gradeB}점` : '-',
        'C 성취도 분할점수': c?.gradeC ? `${c.gradeC}점` : '-',
        'D 성취도 분할점수': c?.gradeD ? `${c.gradeD}점` : '-',
        '전체 평균': c?.mean ? `${c.mean}점` : '-',
        표준편차: c?.stdDev ? `${c.stdDev}` : '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '전체과목_추정분할점수');
    
    // Auto column width
    const max_width = exportData.reduce((w, r) => Math.max(w, String(r.과목명).length), 10);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: Math.max(max_width * 2, 16) },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.writeFile(
      workbook,
      `NICE_전체과목_추정분할점수_현황_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  const handleRowClick = (subjId: string) => {
    onSelectSubject(subjId);
    onNavigateToDashboard();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Control Row */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                전체 과목 추정 분할점수 현황
              </h2>
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-300">
                실시간 산출
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 pl-1">
              개설된 모든 분석 과목의 100점 만점 기준 추정 분할점수(A·B·C·D) 및 입력 반영률을 한눈에 비교·확인할 수 있습니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Excel 다운로드</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>인쇄 / PDF 저장</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="과목명 검색..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Grade Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <span className="text-xs font-extrabold text-slate-500">학년:</span>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none pr-2 cursor-pointer"
              >
                <option value="ALL">전체 학년</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
              </select>
            </div>

            {/* Semester Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-xl">
              <span className="text-xs font-extrabold text-slate-500 ml-1.5">학기:</span>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none pr-2 cursor-pointer"
              >
                <option value="ALL">전체 학기</option>
                <option value="1">1학기</option>
                <option value="2">2학기</option>
              </select>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>표 목록 보기</span>
            </button>
            <button
              onClick={() => setViewMode('CHART')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'CHART'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>비교 차트 보기</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>조회 과목 수</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{overallStats.count}개 과목</p>
          <p className="text-[11px] font-semibold text-slate-400">분석 대상 과목 기준</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>평균 성적 반영률</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{overallStats.avgCompletion}%</p>
          <p className="text-[11px] font-semibold text-slate-400">전체 학생 성적 연동 진행도</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
            <span>평균 A 성취도 분할점수</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{overallStats.avgA}점</p>
          <p className="text-[11px] font-semibold text-amber-700/80">과목별 A 기준 추정 평균</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-900 text-xs font-bold">
            <span>평균 B 성취도 분할점수</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600">{overallStats.avgB}점</p>
          <p className="text-[11px] font-semibold text-indigo-700/80">과목별 B 기준 추정 평균</p>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'TABLE' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-4">과목명 / 학년</th>
                  <th className="px-4 py-4 text-center">반영비율 (중/수/기)</th>
                  <th className="px-4 py-4 text-center">성적 연동률</th>
                  <th className="px-4 py-4 text-center bg-amber-950/80 text-amber-200 border-x border-slate-800">
                    A 분할점수
                  </th>
                  <th className="px-4 py-4 text-center bg-blue-950/80 text-blue-200 border-r border-slate-800">
                    B 분할점수
                  </th>
                  <th className="px-4 py-4 text-center bg-purple-950/80 text-purple-200 border-r border-slate-800">
                    C 분할점수
                  </th>
                  <th className="px-4 py-4 text-center bg-rose-950/80 text-rose-200 border-r border-slate-800">
                    D 분할점수
                  </th>
                  <th className="px-4 py-4 text-center">평균 / 표준편차</th>
                  <th className="px-5 py-4 text-right">상세 분석</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                      🔍 조건에 일치하는 과목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredSubjects.map((subj) => {
                    const cutoff = cutoffsBySubject[subj.id];
                    return (
                      <tr
                        key={subj.id}
                        onClick={() => handleRowClick(subj.id)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        {/* 과목명 */}
                        <td className="px-5 py-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm group-hover:text-indigo-600 transition-colors">
                              {subj.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-black px-2 py-0.5 rounded-full border border-slate-200">
                              {subj.grade}학년 {subj.semester}학기
                            </span>
                          </div>
                        </td>

                        {/* 반영비율 */}
                        <td className="px-4 py-4 text-center font-bold text-slate-600">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px]">
                            {subj.midtermWeight}% / {subj.performanceWeight}% / {subj.finalWeight}%
                          </span>
                        </td>

                        {/* 성적 연동률 */}
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-slate-900">
                              {cutoff?.completedStudents || 0} / {cutoff?.totalStudents || 0}명
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600">
                              ({cutoff?.completionRate || 0}%)
                            </span>
                          </div>
                        </td>

                        {/* A 분할점수 */}
                        <td className="px-4 py-4 text-center bg-amber-50/30 border-x border-slate-200/80">
                          {cutoff?.gradeA ? (
                            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-black text-sm shadow-2xs">
                              {cutoff.gradeA}점
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>

                        {/* B 분할점수 */}
                        <td className="px-4 py-4 text-center bg-blue-50/20 border-r border-slate-200/80">
                          {cutoff?.gradeB ? (
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 border border-blue-200 rounded-xl font-black text-sm shadow-2xs">
                              {cutoff.gradeB}점
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>

                        {/* C 분할점수 */}
                        <td className="px-4 py-4 text-center bg-purple-50/20 border-r border-slate-200/80">
                          {cutoff?.gradeC ? (
                            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-xl font-black text-sm shadow-2xs">
                              {cutoff.gradeC}점
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>

                        {/* D 분할점수 */}
                        <td className="px-4 py-4 text-center bg-rose-50/20 border-r border-slate-200/80">
                          {cutoff?.gradeD ? (
                            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-900 border border-rose-200 rounded-xl font-black text-sm shadow-2xs">
                              {cutoff.gradeD}점
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>

                        {/* 평균 / 표준편차 */}
                        <td className="px-4 py-4 text-center font-bold text-slate-700">
                          {cutoff?.mean ? (
                            <div>
                              <span className="text-slate-900 font-extrabold">{cutoff.mean}점</span>
                              <span className="block text-[10px] text-slate-400 font-semibold">
                                (±{cutoff.stdDev})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(subj.id);
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>상세보기</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Chart Comparison View */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              과목별 성취도 분할점수 비교 차트
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              * 100점 만점 기준 추정 분할점수
            </span>
          </div>

          <div className="h-96 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '1rem',
                    color: '#FFF',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="A 분할점수" fill="#D97706" radius={[6, 6, 0, 0]} />
                <Bar dataKey="B 분할점수" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="C 분할점수" fill="#9333EA" radius={[6, 6, 0, 0]} />
                <Bar dataKey="D 분할점수" fill="#E11D48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
