import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { User } from '../types';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, RefreshCw, Users, ShieldAlert } from 'lucide-react';

interface RosterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRosterUploaded: () => void;
  currentUser?: User;
}

interface ParsedRosterStudent {
  studentNumber: string;
  name: string;
  grade: number;
  classNum: number;
  numberInClass: number;
}

export const RosterUploadModal: React.FC<RosterUploadModalProps> = ({
  isOpen,
  onClose,
  onRosterUploaded,
  currentUser,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<ParsedRosterStudent[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setError('명렬표 등록은 관리자(ADMIN) 권한 전용입니다.');
      return;
    }
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const jsonRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (jsonRows.length < 2) {
          setError('엑셀 파일에 유효한 데이터가 없습니다.');
          return;
        }

        // Find header row containing "학번" or "이름"
        let headerRowIndex = -1;
        let sNumCol = -1;
        let nameCol = -1;
        let gradeCol = -1;
        let classCol = -1;
        let numCol = -1;

        for (let r = 0; r < Math.min(15, jsonRows.length); r++) {
          const row = jsonRows[r] || [];
          row.forEach((cell: any, cIdx: number) => {
            const cellStr = String(cell || '').replace(/\s+/g, '');
            if (/학번|학생번호|studentnumber|stunum/i.test(cellStr)) sNumCol = cIdx;
            if (/성명|이름|학생명|name/i.test(cellStr)) nameCol = cIdx;
            if (/학년|grade/i.test(cellStr)) gradeCol = cIdx;
            if (/반|class/i.test(cellStr)) classCol = cIdx;
            if (/번호|num|number/i.test(cellStr)) numCol = cIdx;
          });

          if (sNumCol !== -1 || (gradeCol !== -1 && classCol !== -1 && numCol !== -1)) {
            headerRowIndex = r;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          sNumCol = 0;
          nameCol = 1;
        }

        const extracted: ParsedRosterStudent[] = [];
        for (let r = headerRowIndex + 1; r < jsonRows.length; r++) {
          const row = jsonRows[r] || [];
          if (!row || row.length === 0) continue;

          let sNumStr = sNumCol !== -1 ? String(row[sNumCol] || '').replace(/\.0$/, '').trim() : '';
          let nameStr = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';

          let g = gradeCol !== -1 ? Number(row[gradeCol]) : 0;
          let c = classCol !== -1 ? Number(row[classCol]) : 0;
          let n = numCol !== -1 ? Number(row[numCol]) : 0;

          // If 학번 is formatted e.g. 20105
          if (sNumStr && sNumStr.length >= 4) {
            if (!g) g = Number(sNumStr.substring(0, sNumStr.length - 4)) || 1;
            if (!c) c = Number(sNumStr.substring(sNumStr.length - 4, sNumStr.length - 2)) || 1;
            if (!n) n = Number(sNumStr.substring(sNumStr.length - 2)) || 1;
          } else if (g && c && n) {
            sNumStr = `${g}${String(c).padStart(2, '0')}${String(n).padStart(2, '0')}`;
          }

          if (sNumStr && /^\d+$/.test(sNumStr)) {
            extracted.push({
              studentNumber: sNumStr,
              name: nameStr,
              grade: g || 1,
              classNum: c || 1,
              numberInClass: n || 1,
            });
          }
        }

        if (extracted.length === 0) {
          setError('학번 또는 학생 정보를 추출하지 못했습니다. 열 구성을 확인해주세요.');
        } else {
          setParsedStudents(extracted);
        }
      } catch (err) {
        console.error('Roster parse error:', err);
        setError('엑셀 파싱 중 오류가 발생했습니다.');
      }
    };

    reader.readAsBinaryString(uploadedFile);
  };

  const handleConfirmRoster = async () => {
    if (parsedStudents.length === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      const res = await fetch('/api/roster/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rosterRows: parsedStudents,
          requesterRole: currentUser?.role,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`총 ${data.count}명의 학생 명렬표가 성공적으로 전면 교체되었습니다!`);
        setTimeout(() => {
          onRosterUploaded();
          onClose();
        }, 1200);
      } else {
        setError(data.error || '명렬표 등록 실패');
      }
    } catch (err) {
      console.error('Upload roster error:', err);
      setError('서버 통신 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl p-6 relative animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">전교생 Master 학생 명렬표 등록</h3>
            <p className="text-xs text-slate-500">학번과 실명을 매핑하는 마스터 명렬표를 등록 및 교체합니다.</p>
          </div>
        </div>

        {/* Warning Badge */}
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1">
          <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            명렬표 등록 안내 (전면 교체/갈아끼움 방식)
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            • 명렬표는 등록 시 기존 명렬표를 <strong>전면 덮어쓰기(갈아끼움)</strong>하며, 성적 파일에서 학번만 추출된 경우 <strong>학번 기준으로 학생 실명을 즉시 자동 연결</strong>합니다.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}

        {/* File Upload Box */}
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-500 transition-all bg-slate-50/50">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
              id="roster-file-input"
            />
            <label htmlFor="roster-file-input" className="cursor-pointer space-y-2 block">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-700">
                {file ? file.name : '클릭하여 명렬표 엑셀 파일(.xlsx) 선택'}
              </div>
              <p className="text-[11px] text-slate-400">
                필수 항목: [학번 / 이름] (또는 학년, 반, 번호, 이름)
              </p>
            </label>
          </div>

          {/* Parsed Preview Table */}
          {parsedStudents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>추출된 학생 목록 ({parsedStudents.length}명)</span>
                <span className="text-[11px] text-slate-500 font-normal">상위 15명 미리보기</span>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-50 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">학번</th>
                      <th className="px-3 py-2">이름</th>
                      <th className="px-3 py-2">학년/반/번호</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedStudents.slice(0, 15).map((st, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-extrabold text-slate-900">{st.studentNumber}</td>
                        <td className="px-3 py-1.5 font-bold text-indigo-700">{st.name || '(이름 공백)'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{st.grade}학년 {st.classNum}반 {st.numberInClass}번</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleConfirmRoster}
              disabled={parsedStudents.length === 0 || isUploading}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 ${
                parsedStudents.length > 0 && !isUploading
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
              {isUploading ? '교체 등록 중...' : '명렬표 전체 교체 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
