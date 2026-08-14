import React, { useState, useMemo } from 'react';
import { PastCutoffRecord, Subject, CutoffResult, User } from '../types';
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
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
  BookOpen,
  Plus,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  TrendingUp,
  Sparkles,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Archive,
  ArrowRight,
  List,
  BarChart3,
  LayoutGrid,
  FileUp,
  HelpCircle,
  Info,
} from 'lucide-react';

interface PastCutoffsHistoryProps {
  pastRecords: PastCutoffRecord[];
  subjects: Subject[];
  cutoffsBySubject: Record<string, CutoffResult>;
  currentUser: User | null;
  onRefresh: () => void;
}

export const PastCutoffsHistory: React.FC<PastCutoffsHistoryProps> = ({
  pastRecords,
  subjects,
  cutoffsBySubject,
  currentUser,
  onRefresh,
}) => {
  // Filters & State
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'YEAR_DESC' | 'NAME_ASC' | 'A_DESC' | 'MEAN_DESC'>('YEAR_DESC');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CHART' | 'CARDS'>('TABLE');

  // Trend Chart selected subject name
  const [trendSubjectName, setTrendSubjectName] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<PastCutoffRecord | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    schoolYear: number;
    semester: number;
    grade: number;
    subjectName: string;
    midtermWeight: number;
    performanceWeight: number;
    finalWeight: number;
    cutoffA: number | '';
    cutoffB: number | '';
    cutoffC: number | '';
    cutoffD: number | '';
    studentCount: number | '';
    meanScore: number | '';
    stdDev: number | '';
    notes: string;
  }>({
    schoolYear: 2025,
    semester: 1,
    grade: 1,
    subjectName: '',
    midtermWeight: 30,
    performanceWeight: 30,
    finalWeight: 40,
    cutoffA: 87.5,
    cutoffB: 75.0,
    cutoffC: 62.5,
    cutoffD: 50.0,
    studentCount: '',
    meanScore: '',
    stdDev: '',
    notes: '',
  });

  // Archive Current Subject Form State
  const [archiveSubjectId, setArchiveSubjectId] = useState<string>(subjects[0]?.id || '');
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear() - 1);
  const [archiveSemester, setArchiveSemester] = useState<number>(1);
  const [archiveNotes, setArchiveNotes] = useState<string>('');

  // Excel Bulk Import State
  const [excelImportRows, setExcelImportRows] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelError, setExcelError] = useState<string>('');

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Available unique years in records
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(pastRecords.map((r) => r.schoolYear))).sort(
      (a: number, b: number) => b - a
    );
    if (years.length === 0) return [2025, 2024, 2023];
    return years;
  }, [pastRecords]);

  // Available unique subject names in records for trend selection
  const uniqueSubjectNames = useMemo(() => {
    const names = Array.from(new Set(pastRecords.map((r) => r.subjectName))).sort(
      (a: string, b: string) => a.localeCompare(b)
    );
    return names;
  }, [pastRecords]);

  // Default trend subject if empty
  React.useEffect(() => {
    if (!trendSubjectName && uniqueSubjectNames.length > 0) {
      setTrendSubjectName(uniqueSubjectNames[0]);
    }
  }, [uniqueSubjectNames, trendSubjectName]);

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    return pastRecords
      .filter((r) => {
        if (selectedYear !== 'ALL' && String(r.schoolYear) !== selectedYear) return false;
        if (selectedGrade !== 'ALL' && String(r.grade) !== selectedGrade) return false;
        if (selectedSemester !== 'ALL' && String(r.semester) !== selectedSemester) return false;
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchesName = r.subjectName.toLowerCase().includes(query);
          const matchesNotes = r.notes?.toLowerCase().includes(query);
          return matchesName || matchesNotes;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'YEAR_DESC') {
          if (b.schoolYear !== a.schoolYear) return b.schoolYear - a.schoolYear;
          if (b.semester !== a.semester) return b.semester - a.semester;
          return a.subjectName.localeCompare(b.subjectName);
        }
        if (sortBy === 'NAME_ASC') {
          return a.subjectName.localeCompare(b.subjectName);
        }
        if (sortBy === 'A_DESC') {
          return b.cutoffA - a.cutoffA;
        }
        if (sortBy === 'MEAN_DESC') {
          return (b.meanScore || 0) - (a.meanScore || 0);
        }
        return 0;
      });
  }, [pastRecords, selectedYear, selectedGrade, selectedSemester, searchTerm, sortBy]);

  // Key Statistics
  const overallStats = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { count: 0, avgA: 0, avgB: 0, avgC: 0, avgD: 0, avgMean: 0 };
    }

    let sumA = 0;
    let sumB = 0;
    let sumC = 0;
    let sumD = 0;
    let sumMean = 0;
    let validMeanCount = 0;

    filteredRecords.forEach((r) => {
      sumA += r.cutoffA || 0;
      sumB += r.cutoffB || 0;
      sumC += r.cutoffC || 0;
      sumD += r.cutoffD || 0;
      if (r.meanScore !== undefined && r.meanScore !== null) {
        sumMean += r.meanScore;
        validMeanCount++;
      }
    });

    const count = filteredRecords.length;
    return {
      count,
      avgA: (sumA / count).toFixed(1),
      avgB: (sumB / count).toFixed(1),
      avgC: (sumC / count).toFixed(1),
      avgD: (sumD / count).toFixed(1),
      avgMean: validMeanCount > 0 ? (sumMean / validMeanCount).toFixed(1) : '-',
    };
  }, [filteredRecords]);

  // Data for Trend Analysis Chart
  const trendChartData = useMemo(() => {
    if (!trendSubjectName) return [];

    const matched = pastRecords
      .filter((r) => r.subjectName.trim().toLowerCase() === trendSubjectName.trim().toLowerCase())
      .sort((a, b) => {
        if (a.schoolYear !== b.schoolYear) return a.schoolYear - b.schoolYear;
        return a.semester - b.semester;
      });

    return matched.map((r) => ({
      label: `${r.schoolYear}년 ${r.semester}학기 (${r.grade}학년)`,
      'A 분할점수': r.cutoffA,
      'B 분할점수': r.cutoffB,
      'C 분할점수': r.cutoffC,
      'D 분할점수': r.cutoffD,
      '과목 평균': r.meanScore || null,
      notes: r.notes,
    }));
  }, [pastRecords, trendSubjectName]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormData({
      schoolYear: 2025,
      semester: 1,
      grade: 1,
      subjectName: '',
      midtermWeight: 30,
      performanceWeight: 30,
      finalWeight: 40,
      cutoffA: 87.5,
      cutoffB: 75.0,
      cutoffC: 62.5,
      cutoffD: 50.0,
      studentCount: '',
      meanScore: '',
      stdDev: '',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rec: PastCutoffRecord) => {
    setEditingRecord(rec);
    setFormData({
      schoolYear: rec.schoolYear,
      semester: rec.semester,
      grade: rec.grade,
      subjectName: rec.subjectName,
      midtermWeight: rec.midtermWeight,
      performanceWeight: rec.performanceWeight,
      finalWeight: rec.finalWeight,
      cutoffA: rec.cutoffA,
      cutoffB: rec.cutoffB,
      cutoffC: rec.cutoffC,
      cutoffD: rec.cutoffD,
      studentCount: rec.studentCount ?? '',
      meanScore: rec.meanScore ?? '',
      stdDev: rec.stdDev ?? '',
      notes: rec.notes || '',
    });
    setIsAddModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subjectName.trim()) {
      showToast('과목명을 입력해주세요.', 'error');
      return;
    }

    if (
      formData.cutoffA === '' ||
      formData.cutoffB === '' ||
      formData.cutoffC === '' ||
      formData.cutoffD === ''
    ) {
      showToast('A, B, C, D 분할점수를 모두 입력해주세요.', 'error');
      return;
    }

    const payload = {
      schoolYear: Number(formData.schoolYear),
      semester: Number(formData.semester),
      grade: Number(formData.grade),
      subjectName: formData.subjectName.trim(),
      midtermWeight: Number(formData.midtermWeight) || 0,
      performanceWeight: Number(formData.performanceWeight) || 0,
      finalWeight: Number(formData.finalWeight) || 0,
      cutoffA: Number(formData.cutoffA),
      cutoffB: Number(formData.cutoffB),
      cutoffC: Number(formData.cutoffC),
      cutoffD: Number(formData.cutoffD),
      studentCount: formData.studentCount !== '' ? Number(formData.studentCount) : undefined,
      meanScore: formData.meanScore !== '' ? Number(formData.meanScore) : undefined,
      stdDev: formData.stdDev !== '' ? Number(formData.stdDev) : undefined,
      notes: formData.notes.trim(),
      createdBy: currentUser?.name || '교사',
    };

    try {
      if (editingRecord) {
        const res = await fetch('/api/past-cutoffs/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRecord.id, updates: payload }),
        });
        const json = await res.json();
        if (json.success) {
          showToast('분할점수 내역이 성공적으로 수정되었습니다.');
          setIsAddModalOpen(false);
          onRefresh();
        } else {
          showToast(json.error || '수정 실패', 'error');
        }
      } else {
        const res = await fetch('/api/past-cutoffs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showToast('새로운 이전 년도 분할점수가 등록되었습니다.');
          setIsAddModalOpen(false);
          onRefresh();
        } else {
          showToast(json.error || '등록 실패', 'error');
        }
      }
    } catch (err: any) {
      showToast('서버 통신 오류가 발생했습니다.', 'error');
    }
  };

  // Archive Current Subject Form Submit
  const handleArchiveCurrentSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveSubjectId) {
      showToast('아카이브할 과목을 선택해주세요.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/past-cutoffs/archive-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: archiveSubjectId,
          schoolYear: archiveYear,
          semester: archiveSemester,
          notes: archiveNotes,
          createdBy: currentUser?.name || '교사',
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast('현재 과목 산출 결과가 과거 보관 대장에 성공적으로 저장되었습니다!');
        setIsArchiveModalOpen(false);
        setArchiveNotes('');
        onRefresh();
      } else {
        showToast(json.error || '아카이브 저장 실패', 'error');
      }
    } catch (err) {
      showToast('아카이브 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  // Delete Record Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch('/api/past-cutoffs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTargetId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('해당 분할점수 내역이 삭제되었습니다.');
        setDeleteTargetId(null);
        onRefresh();
      } else {
        showToast(json.error || '삭제 실패', 'error');
      }
    } catch (err) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // Excel Template Download
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        '학년도(예:2025)': 2025,
        '학기(1 또는 2)': 1,
        '학년(1, 2, 3)': 1,
        '과목명(필수)': '수학 I',
        '중간반영비율(%)': 30,
        '수행반영비율(%)': 30,
        '기말반영비율(%)': 40,
        'A성취도_분할점수(필수)': 88.5,
        'B성취도_분할점수(필수)': 76.0,
        'C성취도_분할점수(필수)': 63.5,
        'D성취도_분할점수(필수)': 51.0,
        '수강인원(선택)': 195,
        '과목평균(선택)': 64.8,
        '표준편차(선택)': 19.2,
        '비고_특이사항(선택)': '2025학년도 1학기 최종 확정치',
      },
      {
        '학년도(예:2025)': 2025,
        '학기(1 또는 2)': 1,
        '학년(1, 2, 3)': 1,
        '과목명(필수)': '공통국어',
        '중간반영비율(%)': 30,
        '수행반영비율(%)': 40,
        '기말반영비율(%)': 30,
        'A성취도_분할점수(필수)': 89.2,
        'B성취도_분할점수(필수)': 78.0,
        'C성취도_분할점수(필수)': 65.5,
        'D성취도_분할점수(필수)': 53.0,
        '수강인원(선택)': 195,
        '과목평균(선택)': 68.2,
        '표준편차(선택)': 16.8,
        '비고_특이사항(선택)': '수행평가 40% 반영',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '과거_분할점수_등록양식');
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
    ];
    XLSX.writeFile(workbook, 'NICE_이전년도_분할점수_일괄등록_양식.xlsx');
  };

  // Excel File Upload Handler
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setExcelError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setExcelError('엑셀 파일에 데이터 행이 존재하지 않습니다.');
          return;
        }

        // Map column keys flexibly
        const parsedRows = rawJson.map((row: any, idx) => {
          const findVal = (keywords: string[]) => {
            const key = Object.keys(row).find((k) =>
              keywords.some((kw) => k.toLowerCase().includes(kw.toLowerCase()))
            );
            return key ? row[key] : '';
          };

          const schoolYear = Number(findVal(['학년도', '연도', 'year'])) || 2025;
          const semester = Number(findVal(['학기', 'semester'])) || 1;
          const grade = Number(findVal(['학년', 'grade'])) || 1;
          const subjectName = String(findVal(['과목명', '과목', 'subject'])).trim();
          const midtermWeight = Number(findVal(['중간', '1차', 'midterm'])) || 0;
          const performanceWeight = Number(findVal(['수행', 'performance'])) || 0;
          const finalWeight = Number(findVal(['기말', '2차', 'final'])) || 0;
          const cutoffA = Number(findVal(['a성취도', 'a분할', 'cutoff_a', 'gradea', 'a점수', 'a'])) || 90;
          const cutoffB = Number(findVal(['b성취도', 'b분할', 'cutoff_b', 'gradeb', 'b점수', 'b'])) || 80;
          const cutoffC = Number(findVal(['c성취도', 'c분할', 'cutoff_c', 'gradec', 'c점수', 'c'])) || 70;
          const cutoffD = Number(findVal(['d성취도', 'd분할', 'cutoff_d', 'graded', 'd점수', 'd'])) || 60;
          const studentCount = Number(findVal(['인원', '학생수', 'count'])) || undefined;
          const meanScore = Number(findVal(['평균', 'mean'])) || undefined;
          const stdDev = Number(findVal(['표준편차', 'stddev'])) || undefined;
          const notes = String(findVal(['비고', '특이사항', '메모', 'note']) || '').trim();

          return {
            rowIdx: idx + 2,
            schoolYear,
            semester,
            grade,
            subjectName,
            midtermWeight,
            performanceWeight,
            finalWeight,
            cutoffA,
            cutoffB,
            cutoffC,
            cutoffD,
            studentCount,
            meanScore,
            stdDev,
            notes,
          };
        });

        const validRows = parsedRows.filter((r) => r.subjectName);
        if (validRows.length === 0) {
          setExcelError('과목명이 포함된 유효한 데이터 행을 찾을 수 없습니다.');
          return;
        }

        setExcelImportRows(validRows);
      } catch (err: any) {
        setExcelError('엑셀 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit Excel Import to Server
  const handleImportExcelSubmit = async () => {
    if (excelImportRows.length === 0) {
      showToast('가져올 데이터가 없습니다.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/past-cutoffs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: excelImportRows,
          createdBy: currentUser?.name || '교사 (엑셀업로드)',
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(`${json.count || excelImportRows.length}개의 이전 년도 분할점수가 일괄 등록되었습니다!`);
        setIsExcelModalOpen(false);
        setExcelImportRows([]);
        setExcelFileName('');
        onRefresh();
      } else {
        showToast(json.error || '일괄 등록 실패', 'error');
      }
    } catch (err) {
      showToast('서버 통신 오류가 발생했습니다.', 'error');
    }
  };

  // Export Filtered Records to Excel
  const handleExportFilteredExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }

    const exportRows = filteredRecords.map((r, idx) => ({
      순번: idx + 1,
      학년도: `${r.schoolYear}학년도`,
      학기: `${r.semester}학기`,
      학년: `${r.grade}학년`,
      과목명: r.subjectName,
      '중간 반영비율(%)': r.midtermWeight,
      '수행 반영비율(%)': r.performanceWeight,
      '기말 반영비율(%)': r.finalWeight,
      'A 분할점수': `${r.cutoffA}점`,
      'B 분할점수': `${r.cutoffB}점`,
      'C 분할점수': `${r.cutoffC}점`,
      'D 분할점수': `${r.cutoffD}점`,
      '과목 평균': r.meanScore !== undefined ? `${r.meanScore}점` : '-',
      표준편차: r.stdDev !== undefined ? r.stdDev : '-',
      수강인원: r.studentCount ? `${r.studentCount}명` : '-',
      비고: r.notes || '-',
      등록구분:
        r.sourceType === 'CURRENT_ARCHIVE'
          ? '시스템 스냅샷'
          : r.sourceType === 'EXCEL_IMPORT'
          ? '엑셀 업로드'
          : '직접 등록',
      작성자: r.createdBy || '-',
      등록일시: r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '역대_분할점수_보관대장');

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    XLSX.writeFile(
      workbook,
      `NICE_역대_분할점수_보관대장_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold transition-all animate-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Control Area */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl shadow-2xs">
                <BookOpen className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                이전 년도 / 역대 분할점수 보관 대장
              </h2>
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-300">
                영구 보관 아카이브
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 pl-1">
              과거 학년도별 나이스 최종 확정 분할점수 및 추정 이력을 기록·보관하고, 당해 학기 분할점수 산출 시 객관적 기준 지표로 비교 분석할 수 있습니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>분할점수 직접 등록</span>
            </button>

            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>현재 과목 스냅샷 저장</span>
            </button>

            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FileUp className="w-4 h-4 text-indigo-300" />
              <span>Excel 일괄 등록</span>
            </button>

            <button
              onClick={handleExportFilteredExcel}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Excel 추출</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              title="인쇄 / PDF 저장"
            >
              <Printer className="w-4 h-4 text-slate-600" />
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
                placeholder="과목명 또는 비고 검색..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <span className="text-xs font-extrabold text-slate-500">학년도:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none pr-2 cursor-pointer"
              >
                <option value="ALL">전체 학년도</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}학년도
                  </option>
                ))}
              </select>
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

            {/* Sort Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-xl">
              <span className="text-xs font-extrabold text-slate-500 ml-1.5">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none pr-2 cursor-pointer"
              >
                <option value="YEAR_DESC">최신 학년도순</option>
                <option value="NAME_ASC">과목명 가나다순</option>
                <option value="A_DESC">A 분할점수 높은순</option>
                <option value="MEAN_DESC">평균 점수 높은순</option>
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
              <span>표 목록</span>
            </button>
            <button
              onClick={() => setViewMode('CHART')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'CHART'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>연도별 추이 분석</span>
            </button>
            <button
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
              <span>카드형 요약</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>보관된 과목 내역</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{overallStats.count}건</p>
          <p className="text-[11px] font-semibold text-slate-400">필터 기준 보관 레코드</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
            <span>역대 평균 A 분할점수</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{overallStats.avgA}점</p>
          <p className="text-[11px] font-semibold text-amber-700/80">A 성취도 기준점수 평균</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-blue-900 text-xs font-bold">
            <span>역대 평균 B 분할점수</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600">{overallStats.avgB}점</p>
          <p className="text-[11px] font-semibold text-blue-700/80">B 성취도 기준점수 평균</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>역대 과목 평균</span>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800">
            {overallStats.avgMean !== '-' ? `${overallStats.avgMean}점` : '-'}
          </p>
          <p className="text-[11px] font-semibold text-slate-400">총 학생 원점수 가중 평균</p>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-4">학년도 / 학기</th>
                  <th className="px-4 py-4">과목명</th>
                  <th className="px-3 py-4 text-center">반영비율</th>
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
                  <th className="px-3 py-4 text-center">평균 (표준편차)</th>
                  <th className="px-3 py-4 text-center">인원</th>
                  <th className="px-4 py-4">비고 / 특이사항</th>
                  <th className="px-4 py-4 text-center">출처</th>
                  <th className="px-4 py-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-16 text-slate-400 font-bold space-y-2">
                      <p className="text-base font-extrabold text-slate-600">
                        🔍 등록된 이전 년도 분할점수 내역이 없습니다.
                      </p>
                      <p className="text-xs text-slate-400">
                        상단의 <strong>[분할점수 직접 등록]</strong> 또는{' '}
                        <strong>[현재 과목 스냅샷 저장]</strong> 버튼을 눌러 과거 자료를 보관해보세요.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors group">
                      {/* 학년도 / 학기 */}
                      <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                            {r.schoolYear}년
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-extrabold border border-slate-200">
                            {r.semester}학기
                          </span>
                        </div>
                      </td>

                      {/* 과목명 */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-slate-900">{r.subjectName}</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                            {r.grade}학년
                          </span>
                        </div>
                      </td>

                      {/* 반영비율 */}
                      <td className="px-3 py-4 text-center text-slate-500 text-[11px] whitespace-nowrap">
                        {r.midtermWeight}/{r.performanceWeight}/{r.finalWeight}%
                      </td>

                      {/* A 분할점수 */}
                      <td className="px-4 py-4 text-center bg-amber-50/30 border-x border-slate-200/80 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-black text-xs shadow-2xs">
                          {r.cutoffA}점
                        </span>
                      </td>

                      {/* B 분할점수 */}
                      <td className="px-4 py-4 text-center bg-blue-50/20 border-r border-slate-200/80 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 border border-blue-200 rounded-xl font-black text-xs shadow-2xs">
                          {r.cutoffB}점
                        </span>
                      </td>

                      {/* C 분할점수 */}
                      <td className="px-4 py-4 text-center bg-purple-50/20 border-r border-slate-200/80 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-xl font-black text-xs shadow-2xs">
                          {r.cutoffC}점
                        </span>
                      </td>

                      {/* D 분할점수 */}
                      <td className="px-4 py-4 text-center bg-rose-50/20 border-r border-slate-200/80 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 bg-rose-100 text-rose-900 border border-rose-200 rounded-xl font-black text-xs shadow-2xs">
                          {r.cutoffD}점
                        </span>
                      </td>

                      {/* 평균 / 표준편차 */}
                      <td className="px-3 py-4 text-center whitespace-nowrap font-bold text-slate-700">
                        {r.meanScore !== undefined ? (
                          <span>
                            {r.meanScore}점{' '}
                            {r.stdDev !== undefined && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                (±{r.stdDev})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 수강인원 */}
                      <td className="px-3 py-4 text-center whitespace-nowrap text-slate-600">
                        {r.studentCount ? `${r.studentCount}명` : '-'}
                      </td>

                      {/* 비고 */}
                      <td className="px-4 py-4 max-w-xs truncate text-xs text-slate-600" title={r.notes}>
                        {r.notes || <span className="text-slate-300">-</span>}
                      </td>

                      {/* 출처 배지 */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {r.sourceType === 'CURRENT_ARCHIVE' ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                            스냅샷
                          </span>
                        ) : r.sourceType === 'EXCEL_IMPORT' ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold">
                            엑셀등록
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold">
                            직접입력
                          </span>
                        )}
                      </td>

                      {/* 관리 (수정/삭제) */}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title="수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(r.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend Chart View */}
      {viewMode === 'CHART' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                과목별 연도별 분할점수 변동 추이 분석
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                특정 과목의 과거 학년도·학기별 A·B·C·D 분할점수와 과목 평균의 변동 추세를 그래프로 확인합니다.
              </p>
            </div>

            {/* Subject Selector for Trend */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 border border-slate-200 rounded-2xl">
              <span className="text-xs font-black text-slate-600 ml-2">분석 대상 과목:</span>
              <select
                value={trendSubjectName}
                onChange={(e) => setTrendSubjectName(e.target.value)}
                className="bg-white px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-extrabold text-indigo-700 shadow-2xs focus:outline-none cursor-pointer"
              >
                {uniqueSubjectNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {trendChartData.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold">
              선택한 과목의 연도별 데이터가 충분하지 않습니다.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-96 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                    />
                    <YAxis
                      domain={[30, 100]}
                      tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }}
                    />
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
                    <Line
                      type="monotone"
                      dataKey="A 분할점수"
                      stroke="#D97706"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="B 분할점수"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="C 분할점수"
                      stroke="#9333EA"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="D 분할점수"
                      stroke="#E11D48"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="과목 평균"
                      stroke="#64748B"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Trend Summary Note */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900">
                    [{trendSubjectName}] 역대 분석 가이드:{' '}
                  </span>
                  과거 분할점수 추이를 바탕으로 당해 학기 지필고사 및 수행평가 난이도에 따른 기준점수
                  적정성을 검토하세요. A 분할점수와 과목 평균 간의 간격이 일정하게 유지되는지 확인하는
                  것이 바람직합니다.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'CARDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecords.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">
              조건에 일치하는 보관 내역이 없습니다.
            </div>
          ) : (
            filteredRecords.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-all space-y-4 relative"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-md text-xs font-black">
                        {r.schoolYear}년
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-extrabold">
                        {r.semester}학기
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        {r.grade}학년
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900">{r.subjectName}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(r)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(r.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weights & Stats */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>반영비율: {r.midtermWeight}/{r.performanceWeight}/{r.finalWeight}%</span>
                  <span>평균: {r.meanScore !== undefined ? `${r.meanScore}점` : '-'}</span>
                </div>

                {/* Cutoff Score Badges */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
                    <span className="block text-[10px] font-extrabold text-amber-800">A</span>
                    <span className="text-xs font-black text-amber-900">{r.cutoffA}점</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
                    <span className="block text-[10px] font-extrabold text-blue-800">B</span>
                    <span className="text-xs font-black text-blue-900">{r.cutoffB}점</span>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2">
                    <span className="block text-[10px] font-extrabold text-purple-800">C</span>
                    <span className="text-xs font-black text-purple-900">{r.cutoffC}점</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2">
                    <span className="block text-[10px] font-extrabold text-rose-800">D</span>
                    <span className="text-xs font-black text-rose-900">{r.cutoffD}점</span>
                  </div>
                </div>

                {/* Notes */}
                {r.notes && (
                  <p className="text-xs text-slate-500 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/80">
                    💬 {r.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal 1: Add / Edit Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  {editingRecord ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {editingRecord ? '이전 년도 분할점수 수정' : '새 이전 년도 분할점수 직접 등록'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Row 1: Year, Semester, Grade */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">학년도</label>
                  <input
                    type="number"
                    min="2010"
                    max="2035"
                    required
                    value={formData.schoolYear}
                    onChange={(e) => setFormData({ ...formData, schoolYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">학기</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={1}>1학기</option>
                    <option value={2}>2학기</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">학년</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={1}>1학년</option>
                    <option value={2}>2학년</option>
                    <option value={3}>3학년</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Subject Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">과목명 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 수학 I, 공통국어, 영어 I"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Row 3: Assessment Weights */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700">반영비율 설정 (%)</span>
                  <span className="text-[11px] font-bold text-slate-500">
                    합계:{' '}
                    <strong
                      className={
                        formData.midtermWeight + formData.performanceWeight + formData.finalWeight === 100
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }
                    >
                      {formData.midtermWeight + formData.performanceWeight + formData.finalWeight}%
                    </strong>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">중간(1차)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.midtermWeight}
                      onChange={(e) =>
                        setFormData({ ...formData, midtermWeight: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">수행평가</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.performanceWeight}
                      onChange={(e) =>
                        setFormData({ ...formData, performanceWeight: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">기말(2차)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.finalWeight}
                      onChange={(e) => setFormData({ ...formData, finalWeight: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Cutoff Scores (A, B, C, D) */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  100점 만점 기준 성취도별 분할점수 *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="block text-[11px] font-black text-amber-800 mb-1">A 분할점수</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={formData.cutoffA}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cutoffA: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-900"
                    />
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                    <span className="block text-[11px] font-black text-blue-800 mb-1">B 분할점수</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={formData.cutoffB}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cutoffB: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-900"
                    />
                  </div>
                  <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                    <span className="block text-[11px] font-black text-purple-800 mb-1">C 분할점수</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={formData.cutoffC}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cutoffC: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 bg-white border border-purple-300 rounded-lg text-xs font-black text-purple-900"
                    />
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <span className="block text-[11px] font-black text-rose-800 mb-1">D 분할점수</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={formData.cutoffD}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cutoffD: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-900"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Stats (Optional) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">수강인원 (명)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="선택사항"
                    value={formData.studentCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        studentCount: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">과목 평균 (점)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="선택사항"
                    value={formData.meanScore}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        meanScore: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">표준편차</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="선택사항"
                    value={formData.stdDev}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stdDev: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Row 6: Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">비고 / 출제 특이사항</label>
                <textarea
                  rows={2}
                  placeholder="예: 2025학년도 나이스 최종 등록치 (기말고사 난이도 상)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRecord ? '수정 내용 저장' : '등록 완료'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Archive Current Subject Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Archive className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  현재 과목 산출 결과 스냅샷 저장
                </h3>
              </div>
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleArchiveCurrentSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  스냅샷 저장할 현재 분석 과목
                </label>
                <select
                  value={archiveSubjectId}
                  onChange={(e) => setArchiveSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.grade}학년 {s.semester}학기)
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview of current calculated cutoff */}
              {archiveSubjectId && cutoffsBySubject[archiveSubjectId] && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-extrabold text-slate-800">
                    <span>실시간 산출 분할점수</span>
                    <span className="text-emerald-700">
                      연동 인원: {cutoffsBySubject[archiveSubjectId].completedStudents}/
                      {cutoffsBySubject[archiveSubjectId].totalStudents}명 (
                      {cutoffsBySubject[archiveSubjectId].completionRate}%)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-amber-100/70 p-1.5 rounded-lg font-black text-amber-900">
                      A: {cutoffsBySubject[archiveSubjectId].gradeA}점
                    </div>
                    <div className="bg-blue-100/70 p-1.5 rounded-lg font-black text-blue-900">
                      B: {cutoffsBySubject[archiveSubjectId].gradeB}점
                    </div>
                    <div className="bg-purple-100/70 p-1.5 rounded-lg font-black text-purple-900">
                      C: {cutoffsBySubject[archiveSubjectId].gradeC}점
                    </div>
                    <div className="bg-rose-100/70 p-1.5 rounded-lg font-black text-rose-900">
                      D: {cutoffsBySubject[archiveSubjectId].gradeD}점
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold pt-1">
                    평균: {cutoffsBySubject[archiveSubjectId].mean}점 | 표준편차:{' '}
                    {cutoffsBySubject[archiveSubjectId].stdDev}
                  </div>
                </div>
              )}

              {/* Target School Year & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">저장 학년도</label>
                  <input
                    type="number"
                    min="2010"
                    max="2035"
                    value={archiveYear}
                    onChange={(e) => setArchiveYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">저장 학기</label>
                  <select
                    value={archiveSemester}
                    onChange={(e) => setArchiveSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value={1}>1학기</option>
                    <option value={2}>2학기</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  스냅샷 메모 / 비고 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 2026학년도 1차 지필 종료 후 실시간 추정치 보관"
                  value={archiveNotes}
                  onChange={(e) => setArchiveNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>스냅샷 아카이브 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Excel Bulk Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    이전 년도 분할점수 엑셀 일괄 등록
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    엑셀 파일로 여러 학년도/과목의 분할점수 데이터를 한 번에 가져옵니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-extrabold text-indigo-900">
                  표준 엑셀 서식 템플릿
                </p>
                <p className="text-[11px] font-semibold text-indigo-700">
                  사전에 정의된 엑셀 서식을 내려받아 작성 후 업로드하세요.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>양식 템플릿 다운로드</span>
              </button>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-3xl p-6 text-center transition-all bg-slate-50/50 space-y-3">
              <input
                type="file"
                id="excelPastInput"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileUpload}
                className="hidden"
              />
              <label
                htmlFor="excelPastInput"
                className="cursor-pointer block space-y-2 group"
              >
                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto shadow-2xs group-hover:scale-105 transition-all">
                  <FileUp className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-xs font-extrabold text-slate-800">
                  {excelFileName ? (
                    <span className="text-indigo-600">{excelFileName}</span>
                  ) : (
                    '엑셀 파일 (.xlsx, .xls)을 클릭하여 선택하세요'
                  )}
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  과목명, 학년도, 학기, A·B·C·D 분할점수가 포함된 파일
                </p>
              </label>
            </div>

            {/* Error Message */}
            {excelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{excelError}</span>
              </div>
            )}

            {/* Preview Parsed Rows */}
            {excelImportRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                  <span>미리보기 ({excelImportRows.length}건 감지됨)</span>
                  <span className="text-emerald-600">✓ 검증 완료</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-extrabold text-slate-700 text-[11px]">
                        <th className="px-3 py-2">연도</th>
                        <th className="px-2 py-2">학기</th>
                        <th className="px-3 py-2">과목명</th>
                        <th className="px-2 py-2 text-center">A</th>
                        <th className="px-2 py-2 text-center">B</th>
                        <th className="px-2 py-2 text-center">C</th>
                        <th className="px-2 py-2 text-center">D</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                      {excelImportRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5">{r.schoolYear}</td>
                          <td className="px-2 py-1.5">{r.semester}학기</td>
                          <td className="px-3 py-1.5 font-bold text-slate-900">{r.subjectName}</td>
                          <td className="px-2 py-1.5 text-center text-amber-700 font-bold">{r.cutoffA}</td>
                          <td className="px-2 py-1.5 text-center text-blue-700 font-bold">{r.cutoffB}</td>
                          <td className="px-2 py-1.5 text-center text-purple-700 font-bold">{r.cutoffC}</td>
                          <td className="px-2 py-1.5 text-center text-rose-700 font-bold">{r.cutoffD}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {excelImportRows.length > 10 && (
                  <p className="text-[11px] font-semibold text-slate-400 text-right">
                    ...외 {excelImportRows.length - 10}건의 행이 더 있습니다.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={excelImportRows.length === 0}
                onClick={handleImportExcelSubmit}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{excelImportRows.length}건 일괄 등록 완료</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 bg-rose-100 rounded-2xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="text-base font-black text-slate-900">분할점수 보관 내역 삭제</h3>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              해당 과목의 과거 분할점수 기록을 보관 대장에서 삭제하시겠습니까? 삭제된 기록은 복구되지 않습니다.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
