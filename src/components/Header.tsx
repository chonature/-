import React, { useState } from 'react';
import { User } from '../types';
import {
  Users,
  Radio,
  BarChart3,
  Edit3,
  FileSpreadsheet,
  Sliders,
  History,
  LogOut,
  ShieldCheck,
  UserCheck,
  Layers,
  BookOpen,
  Cloud,
  CloudUpload,
  CloudDownload,
  Flame,
  Check,
  Loader2,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  onLogout?: () => void;
  schoolName?: string;
  onCloudBackup?: () => Promise<void>;
  onCloudRestore?: () => Promise<void>;
  isCloudSyncing?: boolean;
  lastCloudSyncTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSelectUser,
  activeTab,
  setActiveTab,
  isConnected,
  onLogout,
  schoolName = '전주대학교사범대학부설고등학교',
  onCloudBackup,
  onCloudRestore,
  isCloudSyncing = false,
  lastCloudSyncTime = null,
}) => {
  const [showCloudMenu, setShowCloudMenu] = useState(false);
  const [cloudSuccessMsg, setCloudSuccessMsg] = useState<string | null>(null);
  const isAdmin = currentUser.role === 'ADMIN';

  const handleBackup = async () => {
    if (!onCloudBackup) return;
    try {
      await onCloudBackup();
      setCloudSuccessMsg('클라우드 백업이 완료되었습니다.');
      setTimeout(() => setCloudSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('클라우드 백업 실패: ' + err.message);
    }
  };

  const handleRestore = async () => {
    if (!onCloudRestore) return;
    if (confirm('Firestore 클라우드 백업 데이터로 현재 상태를 복원하시겠습니까?')) {
      try {
        await onCloudRestore();
        setCloudSuccessMsg('클라우드 복원이 완료되었습니다.');
        setTimeout(() => setCloudSuccessMsg(null), 3000);
      } catch (err: any) {
        alert('클라우드 복원 실패: ' + err.message);
      }
    }
  };

  const handleRosterClick = () => {
    if (!isAdmin) {
      alert('명렬표 등록은 관리자(ADMIN) 권한 전용 기능입니다.');
      return;
    }
    setActiveTab('roster');
  };

  return (
    <header className="bg-[#F1F3F5] pt-5 pb-3 border-b border-slate-200/80 sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Version Info */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  分
                </span>
                NICE 분할점수 실시간 분석
              </h1>
              <span className="text-blue-600 text-xs font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200/80 shadow-2xs">
                v2.5.0
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              2026학년도 1학기 • <strong className="text-slate-800">{schoolName}</strong> • <strong className="text-slate-700">추정 분할점수 엔진</strong>
            </p>
          </div>

          {/* User Profile, Live Status, Navigation Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Indicator Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-2xs ${
                isConnected
                  ? 'bg-white text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  isConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'
                }`}
              />
              <span className="hidden md:inline">
                {isConnected ? '동기화 연결됨' : '연결 중'}
              </span>
            </div>

            {/* Current Logged In User Pill */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
              ) : (
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <div>
                <span className="text-xs font-extrabold text-slate-900">{currentUser.name}</span>
                <span
                  className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {isAdmin ? '관리자' : '교과교사'}
                </span>
              </div>
            </div>

            {/* Firebase Cloud Sync Button & Status */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCloudMenu(!showCloudMenu)}
                title="Firestore 클라우드 백업 및 복원"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs border flex items-center gap-1.5 cursor-pointer ${
                  isCloudSyncing
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {isCloudSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                ) : (
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                )}
                <span className="hidden sm:inline">Firebase</span>
                <Cloud className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Cloud Sync Dropdown Menu */}
              {showCloudMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                      <span className="text-xs font-black text-slate-900">Firestore Cloud 연동</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      연결됨
                    </span>
                  </div>

                  {cloudSuccessMsg && (
                    <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{cloudSuccessMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={isCloudSyncing}
                      onClick={() => {
                        handleBackup();
                      }}
                      className="w-full text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CloudUpload className="w-4 h-4 text-indigo-600" />
                        <div>
                          <div>클라우드 즉시 백업</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            현재 모든 학사 성적/분할점수 Firestore 저장
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isCloudSyncing}
                      onClick={() => {
                        handleRestore();
                      }}
                      className="w-full text-left p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CloudDownload className="w-4 h-4 text-emerald-600" />
                        <div>
                          <div>클라우드에서 복원</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            Firestore에 보관된 최신 데이터 불러오기
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {lastCloudSyncTime && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium">
                      최근 동기화: {new Date(lastCloudSyncTime).toLocaleTimeString('ko-KR')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                title="로그아웃"
                className="bg-white hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}

            {/* Roster Upload Button */}
            <button
              onClick={handleRosterClick}
              title={isAdmin ? '명렬표 등록' : '명렬표 등록 (관리자 전용)'}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                isAdmin
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              명렬표 등록 {isAdmin ? '' : '(관리자)'}
            </button>

            {/* Excel Quick Upload Button */}
            <button
              onClick={() => setActiveTab('excel')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
              Excel Import
            </button>
          </div>
        </div>

        {/* Bento Pill Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            과목별 추정 분할점수
          </button>

          <button
            onClick={() => setActiveTab('all-cutoffs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all-cutoffs'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            전체 과목 추정 분할점수
          </button>

          <button
            onClick={() => setActiveTab('past-cutoffs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'past-cutoffs'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            이전 년도 분할점수
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'scores' || activeTab === 'predictions' || activeTab === 'performance'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            학생 성적 통합 입력 (수행 & 2차예상)
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'excel'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            Excel 성적 업로드
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'config'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            반영비율 & 계정 관리자
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            실시간 변경 이력
          </button>
        </nav>
      </div>
    </header>
  );
};
