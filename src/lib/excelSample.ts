import * as XLSX from 'xlsx';

export function generateSampleExcelFile(formatType: 'NICE' | 'TEACHER_NOTE' | 'SIMPLE') {
  let data: any[] = [];

  if (formatType === 'NICE') {
    data = [
      {
        학번: '10101',
        성명: '김민수',
        학년: 1,
        반: 1,
        번호: 1,
        과목명: '수학 I',
        중간고사: 82,
        수행평가: 38,
        '2차고사예상': 85,
      },
      {
        학번: '10102',
        성명: '이지민',
        학년: 1,
        반: 1,
        번호: 2,
        과목명: '수학 I',
        중간고사: 95,
        수행평가: 40,
        '2차고사예상': 92,
      },
      {
        학번: '10103',
        성명: '박준호',
        학년: 1,
        반: 1,
        번호: 3,
        과목명: '수학 I',
        중간고사: 72,
        수행평가: 35,
        '2차고사예상': 78,
      },
      {
        학번: '10104',
        성명: '최서연',
        학년: 1,
        반: 1,
        번호: 4,
        과목명: '수학 I',
        중간고사: 88,
        수행평가: 39,
        '2차고사예상': 89,
      },
      {
        학번: '10105',
        성명: '정도윤',
        학년: 1,
        반: 1,
        번호: 5,
        과목명: '수학 I',
        중간고사: 64,
        수행평가: 31,
        '2차고사예상': '', // 미입력 테스트용
      },
    ];
  } else if (formatType === 'TEACHER_NOTE') {
    data = [
      {
        번호: '10101',
        이름: '김민수',
        '1차고사': 82,
        수행: 38,
        '2차예상': 85,
      },
      {
        번호: '10102',
        이름: '이지민',
        '1차고사': 95,
        수행: 40,
        '2차예상': 92,
      },
      {
        번호: '10103',
        이름: '박준호',
        '1차고사': 72,
        수행: 35,
        '2차예상': 78,
      },
    ];
  } else {
    data = [
      {
        학생ID: '10101',
        학생명: '김민수',
        중간: 82,
        수행: 38,
        기말: 85,
      },
      {
        학생ID: '10102',
        학생명: '이지민',
        중간: 95,
        수행: 40,
        기말: 92,
      },
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '성적표');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `성적표_샘플_${formatType}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
