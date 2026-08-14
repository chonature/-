import React, { useState } from 'react';
import { Subject, User } from '../types';
import { AddSubjectModal } from './AddSubjectModal';
import {
  Sliders, Save, AlertCircle, CheckCircle2, ShieldCheck, PlusCircle, Trash2,
  UserPlus, Key, UserCheck, UserX, UserMinus, Lock, Shield, RotateCcw, Archive
} from 'lucide-react';

interface AdminConfigModalProps {
  subjects: Subject[];
  deletedSubjects?: Subject[];
  users: User[];
  onUpdateWeights: (data: {
    subjectId: string;
    midtermWeight: number;
    performanceWeight: number;
    finalWeight: number;
  }) => void;
  currentUser: User;
  onRefreshData?: () => void;
}

export const AdminConfigModal: React.FC<AdminConfigModalProps> = ({
  subjects,
  deletedSubjects = [],
  users,
  onUpdateWeights,
  currentUser,
  onRefreshData,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const [mW, setMW] = useState<number>(currentSubject?.midtermWeight || 30);
  const [pW, setPW] = useState<number>(currentSubject?.performanceWeight || 30);
  const [fW, setFW] = useState<number>(currentSubject?.finalWeight || 40);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);

  // New Account Creation Form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'TEACHER' | 'ADMIN'>('TEACHER');

  // Password Change State
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Custom Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'SUBJECT_DELETE' | 'USER_DELETE' | 'PERMANENT_DELETE_SUBJECT';
    id: string;
    name: string;
  } | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (currentSubject) {
      setMW(currentSubject.midtermWeight);
      setPW(currentSubject.performanceWeight);
      setFW(currentSubject.finalWeight);
    }
  }, [selectedSubjectId, currentSubject]);

  const totalSum = mW + pW + fW;
  const isValidSum = totalSum === 100;

  const showMsg = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveWeights = () => {
    if (!isValidSum || !currentSubject) return;
    onUpdateWeights({
      subjectId: currentSubject.id,
      midtermWeight: mW,
      performanceWeight: pW,
      finalWeight: fW,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Open Delete Confirm Dialog
  const requestDeleteSubject = (subjId: string, subjName: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'SUBJECT_DELETE',
      id: subjId,
      name: subjName,
    });
  };

  const requestDeleteUser = (userId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'USER_DELETE',
      id: userId,
      name: userName,
    });
  };

  const requestPermanentDeleteSubject = (subjId: string, subjName: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'PERMANENT_DELETE_SUBJECT',
      id: subjId,
      name: subjName,
    });
  };

  // Execute Confirmed Delete Action
  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { type, id, name } = confirmModal;
    setConfirmModal(null);

    if (type === 'SUBJECT_DELETE') {
      try {
        const res = await fetch('/api/subjects/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId: id }),
        });
        const data = await res.json();
        if (data.success) {
          showMsg('success', `과목 [${name}]이(가) 삭제되어 [휴지통]으로 이동했습니다.`);
          if (data.subjects && data.subjects.length > 0) {
            setSelectedSubjectId(data.subjects[0].id);
          }
          if (onRefreshData) onRefreshData();
        } else {
          showMsg('error', data.error || '과목 삭제 실패');
        }
      } catch (err) {
        showMsg('error', '서버 통신 오류');
      }
    } else if (type === 'PERMANENT_DELETE_SUBJECT') {
      try {
        const res = await fetch('/api/subjects/permanent-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId: id }),
        });
        const data = await res.json();
        if (data.success) {
          showMsg('success', `과목 [${name}]이(가) 영구 삭제되었습니다.`);
          if (onRefreshData) onRefreshData();
        } else {
          showMsg('error', data.error || '영구 삭제 실패');
        }
      } catch (err) {
        showMsg('error', '서버 통신 오류');
      }
    } else if (type === 'USER_DELETE') {
      try {
        const res = await fetch('/api/users/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id }),
        });
        const data = await res.json();
        if (data.success) {
          showMsg('success', `[${name}] 계정이 삭제되었습니다.`);
          if (onRefreshData) onRefreshData();
        } else {
          showMsg('error', data.error || '계정 삭제 실패');
        }
      } catch (err) {
        showMsg('error', '서버 통신 오류');
      }
    }
  };

  // Restore Subject from Trash
  const handleRestoreSubject = async (subjId: string, subjName: string) => {
    try {
      const res = await fetch('/api/subjects/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subjId }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `과목 [${subjName}]이(가) 성공적으로 복구되었습니다.`);
        setSelectedSubjectId(subjId);
        if (onRefreshData) onRefreshData();
      } else {
        showMsg('error', data.error || '과목 복구 실패');
      }
    } catch (err) {
      showMsg('error', '서버 통신 오류');
    }
  };

  // Create User Account (Admin)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      showMsg('error', '성명, 이메일, 비밀번호를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          assignedSubjectIds: subjects.map((s) => s.id),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `[${newUserName}] 계정이 성공적으로 생성되었습니다.`);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setShowCreateUser(false);
        if (onRefreshData) onRefreshData();
      } else {
        showMsg('error', data.error || '계정 생성 실패');
      }
    } catch (err) {
      showMsg('error', '서버 통신 오류');
    }
  };

  // Approve / Reject User
  const handleApproveUser = async (userId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approve }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', approve ? '계정이 승인되었습니다.' : '가입 요청이 거부/삭제되었습니다.');
        if (onRefreshData) onRefreshData();
      } else {
        showMsg('error', data.error || '처리 실패');
      }
    } catch (err) {
      showMsg('error', '서버 통신 오류');
    }
  };

  // Change Password
  const handleChangePassword = async (userId: string) => {
    if (!newPasswordVal.trim()) {
      showMsg('error', '새 비밀번호를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('/api/users/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword: newPasswordVal.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '비밀번호가 변경되었습니다.');
        setEditingPasswordUserId(null);
        setNewPasswordVal('');
        if (onRefreshData) onRefreshData();
      } else {
        showMsg('error', data.error || '비밀번호 변경 실패');
      }
    } catch (err) {
      showMsg('error', '서버 통신 오류');
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`정말로 [${userName}] 계정을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', `[${userName}] 계정이 삭제되었습니다.`);
        if (onRefreshData) onRefreshData();
      } else {
        showMsg('error', data.error || '계정 삭제 실패');
      }
    } catch (err) {
      showMsg('error', '서버 통신 오류');
    }
  };

  const pendingUsers = users.filter((u) => u.approved === false);
  const activeUsers = users.filter((u) => u.approved !== false);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback Message */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in duration-150 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Pending Account Registration Approval Banner */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
            <UserCheck className="w-5 h-5 text-amber-600 animate-bounce" />
            <span>신규 회원가입 승인 대기 중 ({pendingUsers.length}건)</span>
          </div>
          <div className="divide-y divide-amber-200/60 bg-white/80 rounded-xl border border-amber-200 overflow-hidden">
            {pendingUsers.map((pu) => (
              <div key={pu.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900">{pu.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                      {pu.role === 'ADMIN' ? '관리자 신청' : '교사 신청'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{pu.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveUser(pu.id, true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> 승인하기
                  </button>
                  <button
                    onClick={() => handleApproveUser(pu.id, false)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" /> 거부
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Title Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            과목별 평가 반영비율 설정 & 관리자 시스템
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            과목 생성/삭제, 계정 승인, 임의 계정 생성 및 비밀번호 관리를 수행할 수 있습니다.
          </p>
        </div>

        {/* Subject Select Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {subjects.map((subj) => (
            <div key={subj.id} className="flex items-center">
              <button
                onClick={() => setSelectedSubjectId(subj.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  subj.id === selectedSubjectId
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {subj.name}
              </button>
              {currentUser.role === 'ADMIN' && (
                <button
                  onClick={() => requestDeleteSubject(subj.id, subj.name)}
                  title="과목 삭제"
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            과목 추가
          </button>
        </div>
      </div>

      {/* Weights Config Card */}
      {currentSubject && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              [{currentSubject.name}] 평가 요소별 반영비율 (총합 100% 필수)
              <button
                onClick={() => requestDeleteSubject(currentSubject.id, currentSubject.name)}
                className="text-xs text-rose-600 hover:text-rose-800 font-normal underline ml-2 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> 이 과목 삭제
              </button>
            </h3>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-pulse">
                ✓ 반영비율이 저장되었습니다!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Midterm Weight */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">중간고사 반영비율 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={mW}
                onChange={(e) => setMW(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[11px] text-slate-500 block">100점 만점 기준 환산</span>
            </div>

            {/* Performance Weight */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">수행평가 반영비율 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={pW}
                onChange={(e) => setPW(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[11px] text-slate-500 block">40점 만점 기준 환산</span>
            </div>

            {/* Final Exam Weight */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">2차고사(기말) 반영비율 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={fW}
                onChange={(e) => setFW(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[11px] text-slate-500 block">100점 만점 기준 환산</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-100 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              {!isValidSum ? (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <span className="text-xs font-extrabold text-slate-900">
                  현재 반영비율 합계: {totalSum}%
                </span>
                {!isValidSum && (
                  <p className="text-[11px] text-amber-700 font-medium">
                    반영비율 합계는 반드시 100%이어야 합니다. ({100 - totalSum > 0 ? `+${100 - totalSum}% 부족` : `${totalSum - 100}% 초과`})
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveWeights}
              disabled={!isValidSum}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                isValidSum
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              반영비율 저장
            </button>
          </div>
        </div>
      )}

      {/* Account Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              사용자 계정 권한 및 삭제 관리
            </h3>
            <p className="text-xs text-slate-500">관리자는 직접 계정을 생성, 비밀번호 변경, 삭제 및 승인할 수 있습니다.</p>
          </div>
          <button
            onClick={() => setShowCreateUser(!showCreateUser)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {showCreateUser ? '작성 취소' : '임의 계정 직접 생성'}
          </button>
        </div>

        {/* Admin Direct Create User Form */}
        {showCreateUser && (
          <form onSubmit={handleCreateUser} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-indigo-600" /> 신규 교사/관리자 계정 등록
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">성명</label>
                <input
                  type="text"
                  required
                  placeholder="박교사"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">이메일 계정</label>
                <input
                  type="email"
                  required
                  placeholder="park@jjbugo.hs.kr"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  required
                  placeholder="비밀번호"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">권한 구분</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600"
                >
                  <option value="TEACHER">교과 담당 교사</option>
                  <option value="ADMIN">성적관리부 관리자</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer"
            >
              즉시 계정 등록하기
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">교사명</th>
                <th className="px-4 py-2.5">이메일 계정</th>
                <th className="px-4 py-2.5">직책</th>
                <th className="px-4 py-2.5">담당 과목</th>
                <th className="px-4 py-2.5 text-right">계정 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {activeUsers.map((u) => {
                const assignedNames = subjects
                  .filter((s) => u.assignedSubjectIds.includes(s.id))
                  .map((s) => s.name);
                const isEditingThisUserPassword = editingPasswordUserId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.role === 'ADMIN' ? '관리자' : '과목 교사'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700">
                      {assignedNames.length > 0 ? assignedNames.join(', ') : '전체 과목'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditingThisUserPassword ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="password"
                            placeholder="새 비밀번호"
                            value={newPasswordVal}
                            onChange={(e) => setNewPasswordVal(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:border-indigo-600"
                          />
                          <button
                            onClick={() => handleChangePassword(u.id)}
                            className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingPasswordUserId(null)}
                            className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingPasswordUserId(u.id);
                              setNewPasswordVal('');
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Key className="w-3 h-3 text-amber-600" /> 비밀번호 변경
                          </button>
                          {currentUser.role === 'ADMIN' && u.id !== currentUser.id && (
                            <button
                              onClick={() => requestDeleteUser(u.id, u.name)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <UserMinus className="w-3 h-3" /> 계정 삭제
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trash Bin Section for Soft-Deleted Subjects */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-xl">
              <Archive className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                과목 휴지통 (삭제된 과목 관리)
                <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold">
                  {deletedSubjects.length}개
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                삭제된 과목은 성적표 및 분석 메인 화면에서 숨겨지며, 관리자는 이곳에서 언제든지 복구하거나 영구 삭제할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {deletedSubjects.length === 0 ? (
          <div className="text-center py-8 text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            🗑️ 휴지통이 비어 있습니다. 삭제된 과목이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
            {deletedSubjects.map((delSubj) => (
              <div
                key={delSubj.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800">{delSubj.name}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded-full">
                      {delSubj.grade}학년 {delSubj.semester}학기
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3">
                    <span>
                      반영비율: 중간({delSubj.midtermWeight}%) / 수행({delSubj.performanceWeight}%) / 기말({delSubj.finalWeight}%)
                    </span>
                    {delSubj.deletedAt && (
                      <span className="text-slate-400">
                        • 삭제시각: {new Date(delSubj.deletedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestoreSubject(delSubj.id, delSubj.name)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> 복구
                  </button>
                  {currentUser.role === 'ADMIN' && (
                    <button
                      onClick={() => requestPermanentDeleteSubject(delSubj.id, delSubj.name)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 영구 삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddSubjectModal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        onSubjectCreated={(newSubj) => {
          setSelectedSubjectId(newSubj.id);
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Custom Confirmation Popup Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 font-black text-lg">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <span>
                {confirmModal.type === 'USER_DELETE'
                  ? '계정 삭제 확인'
                  : confirmModal.type === 'PERMANENT_DELETE_SUBJECT'
                  ? '과목 영구 삭제 확인'
                  : '과목 삭제 확인'}
              </span>
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-sm font-extrabold text-slate-900">
                정말로 <span className="text-rose-600 font-black">[{confirmModal.name}]</span>{' '}
                {confirmModal.type === 'USER_DELETE' ? '계정을' : '과목을'} 삭제하시겠습니까?
              </p>
              {confirmModal.type === 'SUBJECT_DELETE' && (
                <p className="text-slate-500">
                  • 삭제 시 모든 성적 분석 화면 및 탭에서 해당 과목이 숨겨집니다.
                  <br />
                  • 삭제된 과목 데이터는 <strong className="text-indigo-600">관리자 [과목 휴지통]</strong>에 보관되며 언제든지 복구할 수 있습니다.
                </p>
              )}
              {confirmModal.type === 'PERMANENT_DELETE_SUBJECT' && (
                <p className="text-rose-600 font-extrabold">
                  ⚠️ 주의: 영구 삭제 시 관련 성적 및 예측 데이터가 완전히 제거되며 다시 복구할 수 없습니다.
                </p>
              )}
              {confirmModal.type === 'USER_DELETE' && (
                <p className="text-slate-500">
                  • 해당 사용자의 접속 권한이 삭제되며 목록에서 완전히 제거됩니다.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {confirmModal.type === 'PERMANENT_DELETE_SUBJECT' ? '영구 삭제' : '삭제 진행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
