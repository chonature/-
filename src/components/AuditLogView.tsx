import React from 'react';
import { AuditLog } from '../types';
import { History, Clock, UserCheck, ArrowRightLeft } from 'lucide-react';

interface AuditLogViewProps {
  auditLogs: AuditLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs }) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            실시간 점수 수정 변경 이력 (Audit Log)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            여러 담당 교사가 동시에 점수를 수정할 때 발생한 모든 데이터 변경 내역을 실시간 추적합니다.
          </p>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
          총 {auditLogs.length}건 기록됨
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">수정 일시</th>
                <th className="px-4 py-3">작성자 (교사)</th>
                <th className="px-4 py-3 text-center">과목</th>
                <th className="px-4 py-3 text-center">학번 / 학생명</th>
                <th className="px-4 py-3 text-center">수정 항목</th>
                <th className="px-4 py-3 text-center">이전 값 → 변경 값</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    아직 기록된 점수 수정 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {log.userName}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-700">
                      {log.subjectName}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-800">
                      {log.studentNumber} {log.studentName}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 font-medium">
                      {log.fieldChanged}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <span className="text-slate-400">
                          {log.previousValue !== null ? `${log.previousValue}점` : '없음'}
                        </span>
                        <ArrowRightLeft className="w-3 h-3 text-slate-400 mx-1" />
                        <span className="text-indigo-600 font-black">{log.newValue}점</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
