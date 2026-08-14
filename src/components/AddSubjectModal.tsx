import React, { useState } from 'react';
import { Subject } from '../types';
import { PlusCircle, X, Check, BookOpen } from 'lucide-react';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubjectCreated: (newSubject: Subject) => void;
}

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({
  isOpen,
  onClose,
  onSubjectCreated,
}) => {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(2);
  const [semester, setSemester] = useState(1);
  const [midtermWeight, setMidtermWeight] = useState(30);
  const [performanceWeight, setPerformanceWeight] = useState(30);
  const [finalWeight, setFinalWeight] = useState(40);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalWeight = midtermWeight + performanceWeight + finalWeight;
  const isValidWeight = totalWeight === 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('과목명을 입력해주세요.');
      return;
    }
    if (!isValidWeight) {
      setError(`반영비율의 합이 100%이어야 합니다. (현재: ${totalWeight}%)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/subjects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          grade,
          semester,
          midtermWeight,
          performanceWeight,
          finalWeight,
        }),
      });

      const data = await res.json();
      if (data.success && data.subject) {
        onSubjectCreated(data.subject);
        setName('');
        onClose();
      } else {
        setError(data.error || '과목 생성 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Create subject error:', err);
      setError('서버 통신 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">신규 과목 추가</h3>
            <p className="text-xs text-slate-500">새로운 분석 대상 과목을 등록합니다.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1">과목명 *</label>
            <input
              type="text"
              placeholder="예: 물리학I, 화학I, 생활과 과학"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">대상 학년</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value={1}>1학년</option>
                <option value={2}>2학년</option>
                <option value={3}>3학년</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">학기</label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-xs font-extrabold text-slate-800">
              평가 요소별 반영비율 (합계 100% 필수)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[11px] font-bold text-slate-600 mb-0.5">중간고사</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={midtermWeight}
                  onChange={(e) => setMidtermWeight(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-slate-900"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-600 mb-0.5">수행평가</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={performanceWeight}
                  onChange={(e) => setPerformanceWeight(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-slate-900"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-600 mb-0.5">2차고사</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={finalWeight}
                  onChange={(e) => setFinalWeight(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold pt-1">
              <span className={isValidWeight ? 'text-emerald-600' : 'text-amber-600'}>
                합계: {totalWeight}% {isValidWeight ? '✓' : `(${100 - totalWeight}% 필요)`}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidWeight}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 ${
                isValidWeight && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              {isSubmitting ? '생성 중...' : '과목 추가 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
