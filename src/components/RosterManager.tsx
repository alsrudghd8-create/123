import React, { useState } from 'react';
import { Student } from '../types';
import { Plus, Trash2, Upload, AlertCircle, Sparkles, RefreshCw, UserMinus } from 'lucide-react';

interface RosterManagerProps {
  students: Student[];
  setStudents: (students: Student[]) => void;
}

export default function RosterManager({ students, setStudents }: RosterManagerProps) {
  const [bulkText, setBulkText] = useState('');
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState<number | ''>('');
  const [importError, setImportError] = useState('');

  // Auto calculate next roll number
  const getNextNumber = () => {
    if (students.length === 0) return 1;
    const max = Math.max(...students.map(s => s.number));
    return isFinite(max) ? max + 1 : 1;
  };

  // Add individual student
  const handleAddIndividual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const num = newNumber === '' ? getNextNumber() : Number(newNumber);
    
    // Check for duplicate number
    if (students.some(s => s.number === num)) {
      setImportError(`번호 ${num}번은 이미 존재합니다.`);
      return;
    }

    const newStudent: Student = {
      id: crypto.randomUUID(),
      number: num,
      name: newName.trim(),
      level: null,
      notes: '',
      comment: '',
    };

    const updated = [...students, newStudent].sort((a, b) => a.number - b.number);
    setStudents(updated);
    setNewName('');
    setNewNumber('');
    setImportError('');
  };

  // Bulk import from pasted list
  const handleBulkImport = () => {
    if (!bulkText.trim()) {
      setImportError('가져올 학생 명단을 입력해 주세요.');
      return;
    }

    try {
      const lines = bulkText.split('\n');
      const parsedStudents: Student[] = [];
      let currentNum = 1;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Try to parse format: "1 홍길동", "1. 홍길동", "홍길동", "01 홍길동"
        // Match numbers at start of line
        const match = trimmed.match(/^(\d+)[\.\s,-]*(.+)$/);
        let num = currentNum;
        let name = trimmed;

        if (match) {
          num = parseInt(match[1], 10);
          name = match[2].trim();
        }

        parsedStudents.push({
          id: crypto.randomUUID(),
          number: num,
          name: name,
          level: null,
          notes: '',
          comment: '',
        });

        currentNum = num + 1;
      }

      if (parsedStudents.length === 0) {
        setImportError('올바른 학생 형식을 찾지 못했습니다.');
        return;
      }

      // Merge or overwrite option (we overwrite for simplicity or merge by checking numbers)
      // We will sort and set the imported ones
      const sorted = parsedStudents.sort((a, b) => a.number - b.number);
      setStudents(sorted);
      setBulkText('');
      setImportError('');
    } catch (err) {
      setImportError('명단을 파싱하는 도중 에러가 발생했습니다. 한 줄에 한 명씩 입력해 주세요.');
    }
  };

  // Delete student
  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
  };

  // Edit notes/traits for a student
  const handleUpdateNotes = (id: string, notes: string) => {
    setStudents(students.map(s => s.id === id ? { ...s, notes } : s));
  };

  // Clear all
  const handleClearAll = () => {
    if (confirm('정말로 모든 학생 명단을 삭제하시겠습니까? 성취도 및 평어도 모두 삭제됩니다.')) {
      setStudents([]);
    }
  };

  // Quick reset grades & comments only (keep names)
  const handleResetGradesAndComments = () => {
    if (confirm('학생 이름은 유지하고 성취도(매우잘함,잘함,보통,노력요함) 및 작성된 평어만 초기화하시겠습니까?')) {
      setStudents(students.map(s => ({ ...s, level: null, comment: '' })));
    }
  };

  return (
    <div id="roster-manager-container" className="space-y-8">
      {/* Introduction */}
      <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-5 flex items-start gap-4">
        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-sans font-semibold text-amber-900 text-sm">일괄 업로드 준비하기</h4>
          <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
            나이스 성적 입력을 위해 학생 명단을 등록하고 개별 특기사항 키워드를 적어주세요. 
            학생 명단은 한 번에 복사해서 일괄적으로 붙여넣으면 자동으로 번호와 이름을 구분해 파싱합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Adding Students */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bulk Import Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
            <h3 className="font-sans font-medium text-gray-900 text-base flex items-center gap-2 mb-4">
              <Upload className="w-4 h-4 text-emerald-600" />
              명단 일괄 등록 (추천)
            </h3>
            
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              출석부나 엑셀에서 번호와 이름을 한꺼번에 복사해서 아래에 붙여넣어 주세요.<br />
              <span className="text-gray-400">예시: 1 김민수 / 02 이서연 / 3 박준형</span>
            </p>

            <textarea
              id="bulk-import-textarea"
              rows={8}
              className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
              placeholder="1 김철수&#10;2 이영희&#10;3 박민수"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />

            {importError && (
              <div className="flex items-center gap-2 text-xs text-red-600 mt-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <button
              id="bulk-import-btn"
              onClick={handleBulkImport}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-sm font-medium py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              일괄 가져오기 ({students.length > 0 ? '덮어쓰기' : '등록'})
            </button>
          </div>

          {/* Individual Add Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
            <h3 className="font-sans font-medium text-gray-900 text-base flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-gray-700" />
              개별 학생 추가
            </h3>

            <form onSubmit={handleAddIndividual} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">번호</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full text-sm p-2.5 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-gray-500/10 focus:border-gray-500"
                    placeholder={String(getNextNumber())}
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">이름</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm p-2.5 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-gray-500/10 focus:border-gray-500"
                    placeholder="홍길동"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-sans text-sm font-medium py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                학생 추가
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Roster & Notes Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-sans font-semibold text-gray-900 text-base">
                  등록된 학생 명단 ({students.length}명)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  각 학생의 관찰 특징 및 행동 키워드를 자유롭게 기록할 수 있습니다. (AI 평어 생성 시 연동됨)
                </p>
              </div>

              <div className="flex gap-2">
                {students.length > 0 && (
                  <>
                    <button
                      onClick={handleResetGradesAndComments}
                      className="text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 py-1.5 px-3 rounded-lg transition duration-200 flex items-center gap-1.5 cursor-pointer"
                      title="성취도와 최종 평어만 초기화하고 명단은 살려둡니다."
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      성적 초기화
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 py-1.5 px-3 rounded-lg transition duration-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      명단 비우기
                    </button>
                  </>
                )}
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">현재 등록된 학생이 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">좌측 일괄 등록 또는 개별 학생 추가를 통해 명단을 작성해 주세요.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-16">번호</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-28">이름</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500">개별 관찰 키워드 및 관찰 내용 (선택)</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-16 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="py-2.5 px-4 text-sm font-mono text-gray-500">{student.number}번</td>
                        <td className="py-2.5 px-4 text-sm font-sans font-semibold text-gray-800">{student.name}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            className="w-full text-xs p-1.5 border border-transparent hover:border-gray-200 focus:border-emerald-500 focus:bg-white rounded-lg transition focus:outline-hidden"
                            placeholder="예: 연산속도가 빠름, 적극적으로 참여함, 모둠 협력 우수"
                            value={student.notes}
                            onChange={(e) => handleUpdateNotes(student.id, e.target.value)}
                          />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
