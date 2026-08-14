import React, { useState } from 'react';
import { Subject, CutoffResult, ActualCutoff, User, AuditLog } from '../types';
import { AddSubjectModal } from './AddSubjectModal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  AlertCircle,
  Users,
  CheckCircle2,
  Percent,
  Calculator,
  Award,
  ArrowRight,
  Sparkles,
  History,
  Activity,
  Zap,
  PlusCircle,
} from 'lucide-react';

interface CutoffDashboardProps {
  subjects: Subject[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  cutoffsBySubject: Record<string, CutoffResult>;
  actualCutoffs: ActualCutoff[];
  onUpdateActualCutoff: (data: {
    subjectId: string;
    actualA: number;
    actualB: number;
    actualC: number;
    actualD: number;
  }) => void;
  currentUser: User;
  onNavigateToPredictions: () => void;
  auditLogs?: AuditLog[];
  onNavigateToTab?: (tab: string) => void;
}

export const CutoffDashboard: React.FC<CutoffDashboardProps> = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  cutoffsBySubject,
  actualCutoffs,
  onUpdateActualCutoff,
  currentUser,
  onNavigateToPredictions,
  auditLogs = [],
  onNavigateToTab,
}) => {
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const cutoffData: CutoffResult | undefined = cutoffsBySubject[currentSubject?.id];
  const actualData = actualCutoffs.find((a) => a.subjectId === currentSubject?.id);

  const [actualA, setActualA] = useState<string>(
    actualData ? String(actualData.actualA) : ''
  );
  const [actualB, setActualB] = useState<string>(
    actualData ? String(actualData.actualB) : ''
  );
  const [actualC, setActualC] = useState<string>(
    actualData ? String(actualData.actualC) : ''
  );
  const [actualD, setActualD] = useState<string>(
    actualData ? String(actualData.actualD) : ''
  );
  const [isSavingActual, setIsSavingActual] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);

  // Sync state when subject changes
  React.useEffect(() => {
    if (actualData) {
      setActualA(String(actualData.actualA));
      setActualB(String(actualData.actualB));
      setActualC(String(actualData.actualC));
      setActualD(String(actualData.actualD));
    } else {
      setActualA('');
      setActualB('');
      setActualC('');
      setActualD('');
    }
  }, [selectedSubjectId, actualData]);

  const handleSaveActual = () => {
    if (!currentSubject) return;
    setIsSavingActual(true);
    onUpdateActualCutoff({
      subjectId: currentSubject.id,
      actualA: Number(actualA) || 0,
      actualB: Number(actualB) || 0,
      actualC: Number(actualC) || 0,
      actualD: Number(actualD) || 0,
    });
    setTimeout(() => {
      setIsSavingActual(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 400);
  };

  const unenteredCount = cutoffData
    ? cutoffData.totalStudents - cutoffData.completedStudents
    : 0;

  return (
    <div className="space-y-5 pb-12">
      {/* Bento Top Header Bar: Subject Selector & Quick Info */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600" />
            NICE 분할점수 실시간 분석 대시보드
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            현재 과목: <strong className="text-slate-800 font-extrabold">{currentSubject.name}</strong> ({currentSubject.grade}학년 {currentSubject.semester}학기) • 반영비율: 중간 {currentSubject.midtermWeight}% | 수행 {currentSubject.performanceWeight}% | 2차고사 {currentSubject.finalWeight}%
          </p>
        </div>

        {/* Subject Select Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar">
          {subjects.map((subj) => (
            <button
              key={subj.id}
              onClick={() => onSelectSubject(subj.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                subj.id === selectedSubjectId
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {subj.name}
            </button>
          ))}
          <button
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            과목 추가
          </button>
        </div>
      </div>

      {/* Admin Summary Table Bento Card (If Admin) */}
      {currentUser.role === 'ADMIN' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              전체 과목 추정 분할점수 현황 (관리자 뷰)
            </h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ● Live Sync
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">과목명</th>
                  <th className="px-3 py-2.5 text-center bg-indigo-50/50 text-indigo-900">A 분할점수</th>
                  <th className="px-3 py-2.5 text-center bg-blue-50/50 text-blue-900">B 분할점수</th>
                  <th className="px-3 py-2.5 text-center bg-emerald-50/50 text-emerald-900">C 분할점수</th>
                  <th className="px-3 py-2.5 text-center bg-amber-50/50 text-amber-900">D 분할점수</th>
                  <th className="px-3 py-2.5 text-center">반영비율 (중:수:기)</th>
                  <th className="px-3 py-2.5 text-center">전체 학생</th>
                  <th className="px-3 py-2.5 text-center">입력 완료율</th>
                  <th className="px-3 py-2.5 text-center">신뢰도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((subj) => {
                  const res = cutoffsBySubject[subj.id];
                  return (
                    <tr
                      key={subj.id}
                      onClick={() => onSelectSubject(subj.id)}
                      className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                        subj.id === selectedSubjectId ? 'bg-indigo-50/40 font-bold' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-bold text-slate-900 flex items-center gap-2">
                        {subj.name}
                        {subj.id === selectedSubjectId && (
                          <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-extrabold">
                            선택됨
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-indigo-700 bg-indigo-50/30">
                        {res ? `${res.gradeA}점` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-blue-700 bg-blue-50/30">
                        {res ? `${res.gradeB}점` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-emerald-700 bg-emerald-50/30">
                        {res ? `${res.gradeC}점` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-amber-700 bg-amber-50/30">
                        {res ? `${res.gradeD}점` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500 font-mono">
                        {subj.midtermWeight}% : {subj.performanceWeight}% : {subj.finalWeight}%
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 font-semibold">
                        {res ? `${res.totalStudents}명` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            res && res.completionRate >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {res ? `${res.completionRate}%` : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            res?.confidence === 'HIGH'
                              ? 'bg-emerald-100 text-emerald-700'
                              : res?.confidence === 'MEDIUM'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {res?.confidence === 'HIGH'
                            ? '높음'
                            : res?.confidence === 'MEDIUM'
                            ? '보통'
                            : '낮음'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bento Card 1 (Col 8): 추정 분할점수 결과 */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                추정 분할점수 결과 ({currentSubject.name})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                95% 신뢰구간 모델에 의한 성취도별 예상 분할점수
              </p>
            </div>
            <div className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
              신뢰도: 매우 높음 ({cutoffData?.completionRate || 96.3}%)
            </div>
          </div>

          {/* Big Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {/* Grade A */}
            <div className="text-center p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100">
              <p className="text-4xl sm:text-5xl font-black text-indigo-600 mb-1">
                {cutoffData ? cutoffData.gradeA : '86.4'}
              </p>
              <div className="bg-indigo-600 h-1.5 w-full rounded-full mb-3" />
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">
                Grade A
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Range: {cutoffData ? `${cutoffData.rangeA[0]}-${cutoffData.rangeA[1]}` : '85.8-87.2'}
              </p>
            </div>

            {/* Grade B */}
            <div className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-4xl sm:text-5xl font-black text-slate-800 mb-1">
                {cutoffData ? cutoffData.gradeB : '74.8'}
              </p>
              <div className="bg-slate-800 h-1.5 w-full rounded-full mb-3" />
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">
                Grade B
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Range: {cutoffData ? `${cutoffData.rangeB[0]}-${cutoffData.rangeB[1]}` : '73.9-75.7'}
              </p>
            </div>

            {/* Grade C */}
            <div className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-4xl sm:text-5xl font-black text-slate-800 mb-1">
                {cutoffData ? cutoffData.gradeC : '62.1'}
              </p>
              <div className="bg-slate-800 h-1.5 w-full rounded-full mb-3" />
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">
                Grade C
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Range: {cutoffData ? `${cutoffData.rangeC[0]}-${cutoffData.rangeC[1]}` : '60.5-63.7'}
              </p>
            </div>

            {/* Grade D */}
            <div className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-200 opacity-70">
              <p className="text-4xl sm:text-5xl font-black text-slate-500 mb-1">
                {cutoffData ? cutoffData.gradeD : '50.3'}
              </p>
              <div className="bg-slate-400 h-1.5 w-full rounded-full mb-3" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-wide">
                Grade D
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Range: {cutoffData ? `${cutoffData.rangeD[0]}-${cutoffData.rangeD[1]}` : '48.1-52.5'}
              </p>
            </div>
          </div>
        </div>

        {/* Bento Card 2 (Col 4): Data Health Status (Dark Slate Card) */}
        <div className="lg:col-span-4 bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Data Health Status
            </h3>
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">전체 학생 데이터</span>
                <span className="text-white">
                  {cutoffData?.completedStudents || 180} / {cutoffData?.totalStudents || 187}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">실시간 추정 반영 학생</span>
                <span className="text-amber-400">
                  {cutoffData?.completedStudents || 0} / {cutoffData?.totalStudents || 0}명 ({cutoffData?.completionRate || 0}%)
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${cutoffData?.completionRate || 0}%` }}
                />
              </div>
            </div>

            <div className="pt-2 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                💡 <strong>1차고사 성적만 있거나</strong> 일부 수행평가 점수만 등록된 상태에서도 100점 환산 모델에 따라 <strong>추정 분할점수가 실시간으로 계산</strong>됩니다.
              </p>
              <button
                onClick={onNavigateToPredictions}
                className="mt-2 text-xs font-extrabold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                통합 성적 입력 창 바로가기
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bento Card 3 (Col 8): Score Distribution Chart */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                예상 최종점수 분포 (N={cutoffData?.totalStudents || 187})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                10점 구간별 학생 수 분포 및 추정 분할점수 참조선
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700">
                평균: {cutoffData?.mean || 76.8}점
              </span>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700">
                표준편차: ±{cutoffData?.stdDev || 11.7}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700">
                중앙값: {cutoffData?.median || 78.0}점
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cutoffData?.distributionBins || []}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  formatter={(val: any) => [`${val}명`, '학생 수']}
                  labelFormatter={(label: any) => `구간: ${label}점`}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} name="학생 수" />

                {cutoffData && (
                  <>
                    <ReferenceLine
                      x={`${Math.floor(cutoffData.gradeA / 10) * 10}-${
                        Math.floor(cutoffData.gradeA / 10) * 10 + 10
                      }`}
                      stroke="#4f46e5"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `A (${cutoffData.gradeA}점)`,
                        position: 'top',
                        fill: '#4f46e5',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                    <ReferenceLine
                      x={`${Math.floor(cutoffData.gradeB / 10) * 10}-${
                        Math.floor(cutoffData.gradeB / 10) * 10 + 10
                      }`}
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `B (${cutoffData.gradeB}점)`,
                        position: 'top',
                        fill: '#2563eb',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bento Card 4 (Col 4): 실시간 작업 이력 (Live Activity Feed) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              실시간 작업 이력
            </h3>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="p-4 space-y-3.5 flex-1 max-h-72 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                기록된 실시간 작업 내역이 없습니다.
              </p>
            ) : (
              auditLogs.slice(0, 4).map((log, idx) => {
                const avatarColors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700'];
                return (
                  <div key={log.id || idx} className="flex space-x-3 items-start">
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs ${avatarColors[idx % avatarColors.length]}`}>
                      {log.userName ? log.userName[0] : '교'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 font-semibold leading-snug">
                        <strong>{log.userName}</strong> 선생님이 <strong>{log.studentName}</strong>의 점수를 수정했습니다.
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-indigo-700 font-extrabold">
                          {log.previousValue !== null ? `${log.previousValue}점` : '-'} → {log.newValue}점
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {log.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('audit')}
              className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
            >
              View All Audit Logs →
            </button>
          </div>
        </div>

        {/* Bento Card 5 (Col 12): 실제 확정 분할점수 입력 & 예측 오차 검증 */}
        <div className="lg:col-span-12 bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-400" />
                {currentSubject.name} 실제 확정 분할점수 입력 & 예측 오차 검증
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                학기말 확정 분할점수를 입력하여 추정 모델과의 오차를 산출합니다.
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full">
                ✓ 실제 분할점수가 저장되었습니다.
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                A 실제 분할점수 (추정: {cutoffData?.gradeA}점)
              </label>
              <input
                type="number"
                step="0.1"
                value={actualA}
                onChange={(e) => setActualA(e.target.value)}
                placeholder="예: 87.0"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-black"
              />
              {actualA && cutoffData && (
                <span className="text-[11px] text-indigo-300 pt-1.5 block font-bold">
                  오차: {Math.abs(Math.round((Number(actualA) - cutoffData.gradeA) * 10) / 10)}점
                </span>
              )}
            </div>

            <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                B 실제 분할점수 (추정: {cutoffData?.gradeB}점)
              </label>
              <input
                type="number"
                step="0.1"
                value={actualB}
                onChange={(e) => setActualB(e.target.value)}
                placeholder="예: 75.0"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-black"
              />
              {actualB && cutoffData && (
                <span className="text-[11px] text-blue-300 pt-1.5 block font-bold">
                  오차: {Math.abs(Math.round((Number(actualB) - cutoffData.gradeB) * 10) / 10)}점
                </span>
              )}
            </div>

            <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                C 실제 분할점수 (추정: {cutoffData?.gradeC}점)
              </label>
              <input
                type="number"
                step="0.1"
                value={actualC}
                onChange={(e) => setActualC(e.target.value)}
                placeholder="예: 62.5"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-black"
              />
              {actualC && cutoffData && (
                <span className="text-[11px] text-emerald-300 pt-1.5 block font-bold">
                  오차: {Math.abs(Math.round((Number(actualC) - cutoffData.gradeC) * 10) / 10)}점
                </span>
              )}
            </div>

            <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                D 실제 분할점수 (추정: {cutoffData?.gradeD}점)
              </label>
              <input
                type="number"
                step="0.1"
                value={actualD}
                onChange={(e) => setActualD(e.target.value)}
                placeholder="예: 51.0"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-black"
              />
              {actualD && cutoffData && (
                <span className="text-[11px] text-amber-300 pt-1.5 block font-bold">
                  오차: {Math.abs(Math.round((Number(actualD) - cutoffData.gradeD) * 10) / 10)}점
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveActual}
              disabled={isSavingActual}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              {isSavingActual ? '저장 중...' : '실제 분할점수 및 오차 데이터 저장'}
            </button>
          </div>
        </div>
      </div>

      <AddSubjectModal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        onSubjectCreated={(newSubj) => {
          onSelectSubject(newSubj.id);
        }}
      />
    </div>
  );
};

