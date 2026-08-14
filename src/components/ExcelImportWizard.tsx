import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ExcelColumnMapping, ExcelImportError, Subject, User } from '../types';
import { generateSampleExcelFile } from '../lib/excelSample';
import { AddSubjectModal } from './AddSubjectModal';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Download,
  Settings2,
  FileCheck2,
  RefreshCw,
  PlusCircle,
  Zap,
} from 'lucide-react';

interface ExcelImportWizardProps {
  subjects: Subject[];
  mappingPresets: ExcelColumnMapping[];
  onImportSuccess: (data: {
    importedStudents: any[];
    importedScores: any[];
    importedPredictions: any[];
    subjectId: string;
  }) => void;
  onSavePreset: (presetName: string, mapping: any) => void;
  currentUser: User;
}

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
  subjects,
  mappingPresets,
  onImportSuccess,
  onSavePreset,
  currentUser,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Selected Subject for Import
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || 'sub_math'
  );

  // Column Mapping state
  const [mapping, setMapping] = useState<{
    studentNameCol: string;
    studentNumberCol: string;
    gradeCol: string;
    classCol: string;
    numberCol: string;
    subjectNameCol: string;
    midtermScoreCol: string;
    performanceScoreCol: string;
    finalExpectedScoreCol: string;
  }>({
    studentNameCol: '',
    studentNumberCol: '',
    gradeCol: '',
    classCol: '',
    numberCol: '',
    subjectNameCol: '',
    midtermScoreCol: '',
    performanceScoreCol: '',
    finalExpectedScoreCol: '',
  });

  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, { field: string; confidence: number; reason: string }>
  >({});
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Validation results
  const [validParsedRows, setValidParsedRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<ExcelImportError[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // NICE Matrix Auto-Parsing State
  const [matrixResult, setMatrixResult] = useState<{
    isMatrix: boolean;
    detectedSubjectName?: string;
    assessmentType?: 'MIDTERM' | 'PERFORMANCE' | 'FINAL';
    detectedGrade?: number;
    parsedStudents?: any[];
  } | null>(null);

  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);

  // Helper function to detect and parse NICE Matrix/Table Format
  const detectAndParseNiceMatrix = (jsonRows: any[][]) => {
    let detectedSubjectName = '';
    let assessmentType: 'MIDTERM' | 'PERFORMANCE' | 'FINAL' = 'MIDTERM';
    let detectedGrade = 2;
    let headerRowIndex = -1;
    const classColsMap: Record<number, number> = {};

    // 1. Scan metadata rows
    for (let r = 0; r < Math.min(20, jsonRows.length); r++) {
      const rowStr = (jsonRows[r] || []).map((cell: any) => String(cell || '')).join(' ');

      if (/1학년/i.test(rowStr)) detectedGrade = 1;
      else if (/2학년/i.test(rowStr)) detectedGrade = 2;
      else if (/3학년/i.test(rowStr)) detectedGrade = 3;

      if (/1지필|1차지필|중간/i.test(rowStr)) assessmentType = 'MIDTERM';
      else if (/수행/i.test(rowStr)) assessmentType = 'PERFORMANCE';
      else if (/2지필|2차지필|기말/i.test(rowStr)) assessmentType = 'FINAL';

      const match =
        rowStr.match(/과목명\s*:\s*([^\s\/,:]+)/i) ||
        rowStr.match(/과목\s*:\s*([^\s\/,:]+)/i);
      if (match && match[1] && !/1지필|2지필|중간|기말|수행/.test(match[1])) {
        detectedSubjectName = match[1].trim();
      }
    }

    // 2. Search for header row containing "연번호" or "번호"
    for (let r = 0; r < Math.min(25, jsonRows.length); r++) {
      const row = jsonRows[r] || [];
      const firstCell = String(row[0] || '').replace(/\s+/g, '');
      if (/연번호|번호|연번|학생번호/i.test(firstCell)) {
        let count = 0;
        row.forEach((cell: any, cIdx: number) => {
          if (cIdx === 0) return;
          const cellVal = String(cell || '').trim();
          const num = Number(cellVal);
          if (!isNaN(num) && num >= 1 && num <= 25) {
            classColsMap[cIdx] = num;
            count++;
          }
        });
        if (count >= 1) {
          headerRowIndex = r;
          break;
        }
      }
    }

    if (headerRowIndex === -1 || Object.keys(classColsMap).length === 0) {
      return { isMatrix: false };
    }

    // 3. Unpack student rows
    const parsedStudents: any[] = [];
    for (let r = headerRowIndex + 1; r < jsonRows.length; r++) {
      const row = jsonRows[r] || [];
      const rowNumCell = String(row[0] || '').trim();
      const studentNumInClass = Number(rowNumCell);

      if (isNaN(studentNumInClass) || studentNumInClass <= 0 || studentNumInClass > 60) {
        if (/신청학생|총점|평균|이수학생/i.test(rowNumCell)) break;
        continue;
      }

      Object.entries(classColsMap).forEach(([colIdxStr, classNum]) => {
        const colIdx = Number(colIdxStr);
        const scoreCell = row[colIdx];
        if (scoreCell !== undefined && scoreCell !== null && scoreCell !== '') {
          const scoreVal = Number(scoreCell);
          if (!isNaN(scoreVal) && scoreVal >= 0 && scoreVal <= 100) {
            const gStr = String(detectedGrade);
            const cStr = String(classNum).padStart(2, '0');
            const nStr = String(studentNumInClass).padStart(2, '0');
            const fullStudentNumber = `${gStr}${cStr}${nStr}`;

            parsedStudents.push({
              studentNumber: fullStudentNumber,
              name: '',
              grade: detectedGrade,
              classNum,
              numberInClass: studentNumInClass,
              score: scoreVal,
              assessmentType,
            });
          }
        }
      });
    }

    return {
      isMatrix: parsedStudents.length > 0,
      detectedSubjectName,
      assessmentType,
      detectedGrade,
      parsedStudents,
    };
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!jsonRows || jsonRows.length === 0) {
          alert('Excel 파일에 데이터가 없습니다.');
          return;
        }

        // Try NICE Matrix Parsing First
        const matrix = detectAndParseNiceMatrix(jsonRows as any[][]);
        if (matrix.isMatrix && matrix.parsedStudents) {
          setMatrixResult(matrix);

          // Try to auto-match subject name
          if (matrix.detectedSubjectName) {
            const foundSubj = subjects.find(
              (s) =>
                s.name.toLowerCase().includes(matrix.detectedSubjectName!.toLowerCase()) ||
                matrix.detectedSubjectName!.toLowerCase().includes(s.name.toLowerCase())
            );
            if (foundSubj) {
              setSelectedSubjectId(foundSubj.id);
            }
          }

          setCurrentStep(2);
          return;
        }

        // Standard Row Format
        setMatrixResult(null);

        // Extract header row (first non-empty row)
        let headerRowIndex = 0;
        for (let i = 0; i < jsonRows.length; i++) {
          const rowArr = jsonRows[i] as any[];
          if (Array.isArray(rowArr) && rowArr.length > 0) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (jsonRows[headerRowIndex] as any[]).map((h) =>
          String(h || '').trim()
        );
        const dataRows = jsonRows.slice(headerRowIndex + 1);

        setRawHeaders(headers);
        setRawRows(dataRows);

        setCurrentStep(2);
        analyzeColumnsWithAI(headers);
      } catch (err) {
        console.error('Excel parse error:', err);
        alert('Excel 파일을 읽는 중 오류가 발생했습니다. 올바른 Excel 파일인지 확인해주세요.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // AI Column Analysis
  const analyzeColumnsWithAI = async (headers: string[]) => {
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: headers }),
      });
      const data = await res.json();
      if (data.mapping) {
        setAiSuggestions(data.mapping);

        // Apply best auto mapping
        const autoMap: any = {
          studentNameCol: '',
          studentNumberCol: '',
          gradeCol: '',
          classCol: '',
          numberCol: '',
          subjectNameCol: '',
          midtermScoreCol: '',
          performanceScoreCol: '',
          finalExpectedScoreCol: '',
        };

        Object.entries(data.mapping).forEach(([colHeader, info]: [string, any]) => {
          if (info.field && autoMap[info.field] !== undefined) {
            autoMap[info.field] = colHeader;
          }
        });

        setMapping(autoMap);
      }
    } catch (err) {
      console.error('AI analyze error:', err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Apply Mapping Preset
  const handleApplyPreset = (preset: ExcelColumnMapping) => {
    setMapping({
      studentNameCol: preset.studentNameCol || '',
      studentNumberCol: preset.studentNumberCol || '',
      gradeCol: preset.gradeCol || '',
      classCol: preset.classCol || '',
      numberCol: preset.numberCol || '',
      subjectNameCol: preset.subjectNameCol || '',
      midtermScoreCol: preset.midtermScoreCol || '',
      performanceScoreCol: preset.performanceScoreCol || '',
      finalExpectedScoreCol: preset.finalExpectedScoreCol || '',
    });
  };

  // Step 3 -> 4: Validate Data
  const handleValidateAndPreview = () => {
    if (!mapping.studentNameCol || !mapping.studentNumberCol) {
      alert('학생 성명 필드와 학번 필드는 필수 매핑 항목입니다.');
      return;
    }

    const nameIdx = rawHeaders.indexOf(mapping.studentNameCol);
    const numIdx = rawHeaders.indexOf(mapping.studentNumberCol);
    const midtermIdx = rawHeaders.indexOf(mapping.midtermScoreCol);
    const perfIdx = rawHeaders.indexOf(mapping.performanceScoreCol);
    const finalIdx = rawHeaders.indexOf(mapping.finalExpectedScoreCol);

    const validList: any[] = [];
    const errorList: ExcelImportError[] = [];
    const seenStudentNumbers = new Set<string>();

    rawRows.forEach((row, rIdx) => {
      if (!Array.isArray(row) || row.length === 0) return;

      const stName = row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';
      const stNum = row[numIdx] !== undefined ? String(row[numIdx]).trim() : '';

      if (!stName) {
        errorList.push({
          row: rIdx + 2,
          field: '학생 성명',
          message: '학생 성명이 누락되었습니다.',
        });
        return;
      }

      if (!stNum) {
        errorList.push({
          row: rIdx + 2,
          studentName: stName,
          field: '학번',
          message: '학번이 누락되었습니다.',
        });
        return;
      }

      if (seenStudentNumbers.has(stNum)) {
        errorList.push({
          row: rIdx + 2,
          studentName: stName,
          studentNumber: stNum,
          field: '학번',
          message: '중복된 학번이 이미 존재합니다.',
        });
        return;
      }
      seenStudentNumbers.add(stNum);

      // Parse score values
      const mScoreStr = midtermIdx >= 0 ? row[midtermIdx] : null;
      const pScoreStr = perfIdx >= 0 ? row[perfIdx] : null;
      const fScoreStr = finalIdx >= 0 ? row[finalIdx] : null;

      let mVal: number | null = null;
      if (mScoreStr !== null && mScoreStr !== '' && mScoreStr !== undefined) {
        const num = Number(mScoreStr);
        if (isNaN(num) || num < 0 || num > 100) {
          errorList.push({
            row: rIdx + 2,
            studentName: stName,
            studentNumber: stNum,
            field: '중간고사 점수',
            message: `올바르지 않은 중간고사 점수: ${mScoreStr}`,
          });
        } else {
          mVal = num;
        }
      }

      let pVal: number | null = null;
      if (pScoreStr !== null && pScoreStr !== '' && pScoreStr !== undefined) {
        const num = Number(pScoreStr);
        if (isNaN(num) || num < 0 || num > 40) {
          errorList.push({
            row: rIdx + 2,
            studentName: stName,
            studentNumber: stNum,
            field: '수행평가 점수',
            message: `올바르지 않은 수행평가 점수: ${pScoreStr}`,
          });
        } else {
          pVal = num;
        }
      }

      let fVal: number | null = null;
      if (fScoreStr !== null && fScoreStr !== '' && fScoreStr !== undefined) {
        const num = Number(fScoreStr);
        if (isNaN(num) || num < 0 || num > 100) {
          errorList.push({
            row: rIdx + 2,
            studentName: stName,
            studentNumber: stNum,
            field: '2차고사 예상점수',
            message: `올바르지 않은 2차고사 예상점수: ${fScoreStr}`,
          });
        } else {
          fVal = num;
        }
      }

      validList.push({
        studentNumber: stNum,
        name: stName,
        grade: stNum.length >= 5 ? Number(stNum[0]) : 1,
        classNum: stNum.length >= 5 ? Number(stNum.slice(1, 3)) : 1,
        numberInClass: stNum.length >= 5 ? Number(stNum.slice(3)) : 1,
        midtermScore: mVal,
        performanceScore: pVal,
        finalExpectedScore: fVal,
      });
    });

    setValidParsedRows(validList);
    setValidationErrors(errorList);
    setCurrentStep(4);
  };

  // Final Matrix Import Confirmation
  const handleConfirmMatrixImport = () => {
    if (!matrixResult || !matrixResult.parsedStudents) return;
    setIsImporting(true);

    const targetSubjId = selectedSubjectId || subjects[0]?.id || 'sub_math';

    const importedStudents = matrixResult.parsedStudents.map((st) => ({
      studentNumber: st.studentNumber,
      name: st.name,
      grade: st.grade,
      classNum: st.classNum,
      numberInClass: st.numberInClass,
    }));

    const importedScores = matrixResult.parsedStudents.map((st) => ({
      studentNumber: st.studentNumber,
      subjectId: targetSubjId,
      assessmentType: st.assessmentType,
      rawScore: st.score,
      maxScore: st.assessmentType === 'PERFORMANCE' ? 40 : 100,
    }));

    onImportSuccess({
      importedStudents,
      importedScores,
      importedPredictions: [],
      subjectId: targetSubjId,
    });

    setTimeout(() => {
      setIsImporting(false);
      alert(`NICE 성적표 매트릭스 가져오기가 성공적으로 완료되었습니다! (${importedStudents.length}명 처리)`);
      setCurrentStep(1);
      setMatrixResult(null);
    }, 500);
  };

  // Final Import Confirmation
  const handleConfirmImport = () => {
    setIsImporting(true);

    const importedStudents = validParsedRows.map((r) => ({
      studentNumber: r.studentNumber,
      name: r.name,
      grade: r.grade,
      classNum: r.classNum,
      numberInClass: r.numberInClass,
    }));

    const importedScores: any[] = [];
    const importedPredictions: any[] = [];

    validParsedRows.forEach((r) => {
      if (r.midtermScore !== null) {
        importedScores.push({
          studentNumber: r.studentNumber,
          subjectId: selectedSubjectId,
          assessmentType: 'MIDTERM',
          rawScore: r.midtermScore,
          maxScore: 100,
        });
      }
      if (r.performanceScore !== null) {
        importedScores.push({
          studentNumber: r.studentNumber,
          subjectId: selectedSubjectId,
          assessmentType: 'PERFORMANCE',
          rawScore: r.performanceScore,
          maxScore: 40,
        });
      }
      if (r.finalExpectedScore !== null) {
        importedPredictions.push({
          studentNumber: r.studentNumber,
          subjectId: selectedSubjectId,
          expectedScore: r.finalExpectedScore,
        });
      }
    });

    onImportSuccess({
      importedStudents,
      importedScores,
      importedPredictions,
      subjectId: selectedSubjectId,
    });

    setTimeout(() => {
      setIsImporting(false);
      alert(`Excel 데이터 가져오기가 성공적으로 완료되었습니다! (${validParsedRows.length}명 처리)`);
      setCurrentStep(1);
    }, 500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Step Progress Tracker */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep >= 1
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              1
            </span>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">
              1. 파일 선택
            </span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-200 mx-2" />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep >= 2
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </span>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">
              2. AI 구조 분석
            </span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-200 mx-2" />

          {/* Step 3 */}
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep >= 3
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </span>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">
              3. 열 매핑 확인
            </span>
          </div>
          <div className="h-0.5 flex-1 bg-slate-200 mx-2" />

          {/* Step 4 */}
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep >= 4
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              4
            </span>
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">
              4. 검증 & 가져오기
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: File Upload & Sample Download */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              NICE 성적 Excel 파일 선택 (1차지필고사 전용)
            </h3>
            <p className="text-xs text-slate-500">
              선택한 과목의 <strong>1차고사(중간고사) 성적</strong>이 자동으로 반영 및 등록됩니다.
            </p>
          </div>

          {/* Target Subject Selector & Notice Banner */}
          <div className="max-w-lg mx-auto bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-left space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
              <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>성적 데이터를 등록할 과목 선택 및 안내</span>
            </div>
            <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
              💡 업로드한 학생 및 성적은 <strong>선택한 과목에만 등록</strong>되며 다른 과목 수강생 목록에는 들어가지 않습니다.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 block">대상 과목 선택</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-extrabold text-indigo-950 focus:outline-none focus:border-indigo-600 shadow-2xs"
              >
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name} ({subj.grade}학년 {subj.semester}학기)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Upload Drop Area */}
          <div className="max-w-lg mx-auto border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 transition-all bg-slate-50/50 cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-3 animate-bounce" />
            <p className="text-xs font-extrabold text-slate-800">
              이곳을 클릭하거나 Excel 파일을 드래그하여 놓으세요
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              지원 파일 형식: .xlsx, .xls, .csv
            </span>
          </div>

          {/* Sample Download Bar */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
              <Download className="w-4 h-4 text-indigo-600" />
              테스트용 성적표 샘플 엑셀 다운로드
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => generateSampleExcelFile('NICE')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm transition-all"
              >
                NICE 표준 성적 양식 (.xlsx)
              </button>
              <button
                onClick={() => generateSampleExcelFile('TEACHER_NOTE')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm transition-all"
              >
                교사 교무수첩 양식 (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Matrix or Standard AI Column Analysis */}
      {currentStep === 2 && matrixResult && matrixResult.isMatrix ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 bg-white/20 px-3 py-0.5 rounded-full text-[11px] font-extrabold text-white backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> NICE 성적 산출표/이탈표 (행:번호 / 열:반) 매트릭스 양식 자동 감지 완료
              </span>
              <h3 className="text-xl font-black tracking-tight">
                {matrixResult.detectedSubjectName || '감지된 과목 데이터'} ({matrixResult.detectedGrade}학년)
              </h3>
              <p className="text-xs text-indigo-100">
                평가 구분: <strong className="text-white font-extrabold">{matrixResult.assessmentType === 'MIDTERM' ? '1차지필고사 (중간고사)' : matrixResult.assessmentType === 'PERFORMANCE' ? '수행평가' : '2차지필고사'}</strong> • 추출된 학생 수: <strong className="text-white font-extrabold">{matrixResult.parsedStudents?.length || 0}명</strong>
              </p>
            </div>

            <button
              onClick={() => setIsAddSubjectModalOpen(true)}
              className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              + 신규 과목 추가
            </button>
          </div>

          {/* Target Subject Selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-extrabold text-slate-800">성적 데이터를 저장할 과목 선택</label>
              <p className="text-[11px] text-slate-500">
                추출된 {matrixResult.parsedStudents?.length}명의 성적 데이터가 아래 과목에 자동 매핑됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
              >
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name} ({subj.grade}학년 {subj.semester}학기)
                  </option>
                ))}
              </select>

              {matrixResult.detectedSubjectName &&
                !subjects.some(
                  (s) => s.name.toLowerCase() === matrixResult.detectedSubjectName!.toLowerCase()
                ) && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/subjects/create', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: matrixResult.detectedSubjectName,
                            grade: matrixResult.detectedGrade || 2,
                            semester: 1,
                            midtermWeight: 30,
                            performanceWeight: 30,
                            finalWeight: 40,
                          }),
                        });
                        const data = await res.json();
                        if (data.success && data.subject) {
                          setSelectedSubjectId(data.subject.id);
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer"
                  >
                    ‘{matrixResult.detectedSubjectName}’ 과목 생성 후 선택
                  </button>
                )}
            </div>
          </div>

          {/* Preview Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>추출된 성적 데이터 미리보기 (상위 20명)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                총 {matrixResult.parsedStudents?.length}건
              </span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5">학번</th>
                    <th className="px-3.5 py-2.5">반 / 번호</th>
                    <th className="px-3.5 py-2.5">평가 항목</th>
                    <th className="px-3.5 py-2.5 text-right">취득 점수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixResult.parsedStudents?.slice(0, 20).map((st, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2 font-extrabold text-slate-900">{st.studentNumber}</td>
                      <td className="px-3.5 py-2 font-medium text-slate-600">{st.classNum}반 {st.numberInClass}번</td>
                      <td className="px-3.5 py-2">
                        <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg font-extrabold text-[11px]">
                          {st.assessmentType === 'MIDTERM'
                            ? '1차지필(중간)'
                            : st.assessmentType === 'PERFORMANCE'
                            ? '수행평가'
                            : '2차지필(기말)'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right font-black text-slate-900">{st.score}점</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setCurrentStep(1);
                setMatrixResult(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              ← 다시 파일 선택
            </button>

            <button
              onClick={handleConfirmMatrixImport}
              disabled={isImporting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isImporting ? '저장 중...' : '매트릭스 성적 데이터 전체 저장 완료'}
            </button>
          </div>
        </div>
      ) : currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm text-center space-y-6">
          {isAiAnalyzing ? (
            <div className="space-y-4 max-w-md mx-auto">
              <Sparkles className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
              <h3 className="text-lg font-extrabold text-slate-900">
                AI가 Excel 파일의 열 구조를 의미론적으로 분석 중입니다...
              </h3>
              <p className="text-xs text-slate-500">
                업로드된 Excel 파일의 헤더({rawHeaders.length}개) 및 행 데이터를 파싱하여 학생 성명, 학번, 중간고사, 수행평가, 2차고사 예상점수를 자동으로 식별합니다.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Excel 분석 및 AI 열 인식 완료!
              </h3>
              <p className="text-xs text-slate-500">
                감지된 헤더 목록: {rawHeaders.join(', ')}
              </p>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto"
              >
                매핑 확인 단계로 이동
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Confirm & Adjust Column Mapping */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                Excel 열 자동 매핑 확인 및 수동 조정
              </h3>
              <p className="text-xs text-slate-500">
                Excel 파일의 헤더와 시스템 표준 필드를 연결합니다. AI가 추정한 매핑을 확인하세요.
              </p>
            </div>

            {/* Load Saved Preset Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">저장된 양식:</span>
              <select
                onChange={(e) => {
                  const preset = mappingPresets.find((p) => p.presetName === e.target.value);
                  if (preset) handleApplyPreset(preset);
                }}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="">양식 선택...</option>
                {mappingPresets.map((p, idx) => (
                  <option key={idx} value={p.presetName}>
                    {p.presetName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>학생 성명 (필수)</span>
                {aiSuggestions[mapping.studentNameCol] && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    AI 인식 {aiSuggestions[mapping.studentNameCol].confidence}%
                  </span>
                )}
              </label>
              <select
                value={mapping.studentNameCol}
                onChange={(e) => setMapping({ ...mapping, studentNameCol: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="">(선택 안함)</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>학번 / 학생번호 (필수)</span>
                {aiSuggestions[mapping.studentNumberCol] && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    AI 인식 {aiSuggestions[mapping.studentNumberCol].confidence}%
                  </span>
                )}
              </label>
              <select
                value={mapping.studentNumberCol}
                onChange={(e) => setMapping({ ...mapping, studentNumberCol: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="">(선택 안함)</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>중간고사 점수 (100점 만점)</span>
                {aiSuggestions[mapping.midtermScoreCol] && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    AI 인식 {aiSuggestions[mapping.midtermScoreCol].confidence}%
                  </span>
                )}
              </label>
              <select
                value={mapping.midtermScoreCol}
                onChange={(e) => setMapping({ ...mapping, midtermScoreCol: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="">(선택 안함)</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>수행평가 점수 (40점 만점)</span>
                {aiSuggestions[mapping.performanceScoreCol] && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    AI 인식 {aiSuggestions[mapping.performanceScoreCol].confidence}%
                  </span>
                )}
              </label>
              <select
                value={mapping.performanceScoreCol}
                onChange={(e) => setMapping({ ...mapping, performanceScoreCol: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="">(선택 안함)</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>2차고사 예상점수 (100점 만점)</span>
                {aiSuggestions[mapping.finalExpectedScoreCol] && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    AI 인식 {aiSuggestions[mapping.finalExpectedScoreCol].confidence}%
                  </span>
                )}
              </label>
              <select
                value={mapping.finalExpectedScoreCol}
                onChange={(e) =>
                  setMapping({ ...mapping, finalExpectedScoreCol: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="">(선택 안함)</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preset Saving Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="현재 양식 이름 저장 (예: 2026_수학과_성적표)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newPresetName.trim()) {
                    onSavePreset(newPresetName.trim(), mapping);
                    setNewPresetName('');
                    alert('파일 양식이 저장되었습니다.');
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold whitespace-nowrap"
              >
                양식 저장
              </button>
            </div>

            <button
              onClick={handleValidateAndPreview}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              미리보기 및 검증 단계
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Validation Inspection & Final Import Confirmation */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                Import 미리보기 및 자동 오류 검증
              </h3>
              <p className="text-xs text-slate-500">
                총 {validParsedRows.length + validationErrors.length}건 분석 | 정상 데이터:{' '}
                <span className="font-bold text-emerald-600">{validParsedRows.length}건</span>{' '}
                | 오류 건수:{' '}
                <span className="font-bold text-amber-600">{validationErrors.length}건</span>
              </p>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={isImporting || validParsedRows.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  가져오는 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {validParsedRows.length}건 데이터 최종 가져오기
                </>
              )}
            </button>
          </div>

          {/* Validation Error Alert if any */}
          {validationErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                수정이 필요한 오류 행 목록 ({validationErrors.length}건)
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-amber-800">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span className="font-bold text-amber-900">
                      행 {err.row} ({err.studentName || '학생명 없음'}):
                    </span>{' '}
                    {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Data Preview Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800">
              정상 데이터 미리보기 ({validParsedRows.length}명)
            </h4>
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-100 font-bold sticky top-0 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-center">학번</th>
                    <th className="px-3 py-2">학생 성명</th>
                    <th className="px-3 py-2 text-center">중간고사</th>
                    <th className="px-3 py-2 text-center">수행평가</th>
                    <th className="px-3 py-2 text-center">2차고사 예상점수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validParsedRows.slice(0, 50).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center font-bold text-slate-600">
                        {r.studentNumber}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-center">
                        {r.midtermScore !== null ? `${r.midtermScore}점` : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.performanceScore !== null ? `${r.performanceScore}점` : '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-indigo-600">
                        {r.finalExpectedScore !== null ? `${r.finalExpectedScore}점` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AddSubjectModal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        onSubjectCreated={(newSubj) => {
          setSelectedSubjectId(newSubj.id);
        }}
      />
    </div>
  );
};
