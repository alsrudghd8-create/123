import React, { useState, useEffect } from 'react';
import { fourthGradeCurriculum, SubjectCurriculum, AchievementStandard } from './curriculumData';
import { Student } from './types';
import RosterManager from './components/RosterManager';
import { 
  BookOpen, 
  Users, 
  Award, 
  Copy, 
  Download, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ChevronRight, 
  FileSpreadsheet, 
  RefreshCw, 
  Edit3, 
  Check, 
  Zap, 
  Eye,
  Info
} from 'lucide-react';

export default function App() {
  // Current active step: 'roster' | 'grade' | 'result'
  const [activeStep, setActiveStep] = useState<'roster' | 'grade' | 'result'>('roster');
  
  // Students state
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('neis_4th_students');
    return saved ? JSON.parse(saved) : [];
  });

  // Selected subject and achievement standard
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState<number>(0);
  const [selectedStandardIdx, setSelectedStandardIdx] = useState<number>(0);

  // AI Generation parameters & state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Save students to localStorage on change
  useEffect(() => {
    localStorage.setItem('neis_4th_students', JSON.stringify(students));
  }, [students]);

  const currentSubject = fourthGradeCurriculum[selectedSubjectIdx];
  const currentStandard = currentSubject?.standards[selectedStandardIdx];

  // Quick allocation of grade level
  const handleAssignLevelToAll = (level: '매우잘함' | '잘함' | '보통' | '노력요함') => {
    if (students.length === 0) return;
    setStudents(prev => prev.map(s => ({ ...s, level })));
    setSuccessMessage(`모든 학생의 성취도를 '${level}'로 일괄 설정했습니다.`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleAssignLevelToSelected = (ids: string[], level: '매우잘함' | '잘함' | '보통' | '노력요함') => {
    setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, level } : s));
  };

  const handleUpdateStudentLevel = (id: string, level: '매우잘함' | '잘함' | '보통' | '노력요함' | null) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, level } : s));
  };

  const handleUpdateStudentComment = (id: string, comment: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, comment } : s));
  };

  // Local rule-based offline smart generator (backup & fast option)
  const generateCommentsLocally = () => {
    if (!currentStandard) return;
    
    // Variation endings for 생기부 평어 (Avoid duplicate warning in NEIS)
    const variations = {
      매우잘함: [
        " 뛰어난 참여도와 창의적 발상을 주도함.",
        " 과업 해결력이 남다르며 모범을 보임.",
        " 이해가 매우 정교하며 응용력이 돋보임.",
        " 적극적인 태도로 동료들과 협력을 이끎.",
        " 탐구 태도가 모범적이며 깊이 있는 성장을 이룸."
      ],
      잘함: [
        " 성실하고 정성스러운 노력을 아끼지 않음.",
        " 깊이 있는 지적 호기심과 집중력을 보여줌.",
        " 적극적으로 협동하며 과제를 스스로 해결함.",
        " 높은 배움 성과를 거두며 모범을 보임.",
        " 배운 내용을 능동적으로 적용하는 우수한 능력을 지님."
      ],
      보통: [
        " 과업을 능동적으로 완수하며 성실히 동참함.",
        " 기본 원리를 조리 있게 이해하고 참여함.",
        " 협력 학습에 우호적으로 동참하는 태도를 지님.",
        " 핵심 내용을 바르게 파악하며 꾸준히 학습함.",
        " 스스로 문제를 파악하고 해결해내는 성실함을 보임."
      ],
      노력요함: [
        " 긍정적인 마음가짐으로 성실히 노력하고 있음.",
        " 이해를 위해 적극적으로 교사의 설명에 귀 기울임.",
        " 모둠 활동 시 역할을 소화하려 한 걸음씩 나아감.",
        " 기초 요소를 흥미를 갖고 다지려 지속적으로 집중함.",
        " 꾸준한 배움 연습을 통해 실력 향상을 적극 꾀함."
      ]
    };

    const updated = students.map((student, idx) => {
      const level = student.level || '보통'; // Default to '보통' if unassigned
      const defaultText = currentStandard.defaults[level];
      
      // Select variation based on student index to maintain determinism but variety
      const levelVarList = variations[level];
      const varIdx = (idx + student.name.charCodeAt(0)) % levelVarList.length;
      const variationText = levelVarList[varIdx];

      // Add individual notes if present
      let comment = defaultText;
      if (student.notes.trim()) {
        // Natural merging
        const notesText = student.notes.trim();
        comment = `평소 ${notesText} 특징을 가진 아동으로, ${defaultText.replace(/함\.$|임\.$|음\.$/, '하며')}${variationText}`;
      } else {
        // Just add variety to default text
        if (idx % 2 === 0) {
          comment = defaultText.replace(/함\.$/, '하는 훌륭한 모습을 보임.').replace(/임\.$/, '하는 자세를 갖춤.').replace(/있음\.$/, '하여 돋보임.');
        } else {
          comment = defaultText;
        }
      }

      return {
        ...student,
        level,
        comment: comment.trim()
      };
    });

    setStudents(updated);
    setSuccessMessage('로컬 다채로운 평어 규칙을 기반으로 전체 평어를 생성 완료했습니다!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // AI-powered high-quality comment generator via Server API
  const generateCommentsWithAI = async () => {
    if (students.length === 0) {
      setGenerationError('등록된 학생 명단이 없습니다. 1단계에서 명단을 등록해 주세요.');
      return;
    }

    const unassignedCount = students.filter(s => !s.level).length;
    if (unassignedCount > 0) {
      if (!confirm(`성취도가 부여되지 않은 학생이 ${unassignedCount}명 있습니다. 이 학생들은 자동으로 '보통'으로 할당되어 AI 평어가 생성됩니다. 계속하시겠습니까?`)) {
        return;
      }
    }

    setIsGenerating(true);
    setGenerationError('');
    setSuccessMessage('');

    try {
      // Prepare students payload, mapping unassigned to '보통'
      const payloadStudents = students.map(s => ({
        id: s.id,
        name: s.name,
        level: s.level || '보통',
        notes: s.notes
      }));

      // Group students by level to call API efficiently or handle them together
      const levels: ('매우잘함' | '잘함' | '보통' | '노력요함')[] = ['매우잘함', '잘함', '보통', '노력요함'];
      const updatedStudents = [...students];

      for (const level of levels) {
        const levelStudents = payloadStudents.filter(s => s.level === level);
        if (levelStudents.length === 0) continue;

        const response = await fetch('/api/generate-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: currentSubject.subject,
            standard: currentStandard.statement,
            level: level,
            students: levelStudents
          })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `${level} 수준 평어 생성 중 오류 발생`);
        }

        // Map AI comments back to actual students
        result.data.forEach((aiItem: { name: string; comment: string }) => {
          const matchedIdx = updatedStudents.findIndex(s => s.name === aiItem.name && (s.level === level || (!s.level && level === '보통')));
          if (matchedIdx !== -1) {
            updatedStudents[matchedIdx] = {
              ...updatedStudents[matchedIdx],
              level: level,
              comment: aiItem.comment
            };
          }
        });
      }

      setStudents(updatedStudents);
      setSuccessMessage('Gemini AI가 중복 검사를 피해 다채롭게 개별 맞춤 생기부 평어를 작성 완료했습니다!');
      setActiveStep('result');
    } catch (err: any) {
      console.error(err);
      setGenerationError(`AI 생성 실패: ${err.message || '알 수 없는 오류가 발생했습니다.'} (로컬 빠른 생성을 이용하실 수 있습니다.)`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy individual text
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('클립보드에 평어가 복사되었습니다.');
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  // Copy all results combined (Name: Comment format)
  const handleCopyAllCombined = () => {
    const text = students.map(s => `${s.number}번 ${s.name}: ${s.comment}`).join('\n');
    navigator.clipboard.writeText(text);
    setSuccessMessage('전체 학생의 평어 목록이 "번호 이름: 평어" 형태로 복사되었습니다.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Copy only comments (one line per student, for quick excel paste)
  const handleCopyCommentsOnly = () => {
    const text = students.map(s => s.comment).join('\n');
    navigator.clipboard.writeText(text);
    setSuccessMessage('평어 텍스트만 한 줄씩 연속으로 복사되었습니다. 엑셀 업로드 시 유용합니다.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Export to CSV matching NEIS standard bulk upload style
  const handleExportCSV = () => {
    if (students.length === 0) return;

    // BOM for Excel Korean support
    const bom = '\uFEFF';
    const headers = ['번호', '이름', '과목', '성취도', '종합평어(세부능력 및 특기사항)'];
    const rows = students.map(s => [
      s.number,
      s.name,
      currentSubject.subject,
      s.level || '미지정',
      `"${s.comment.replace(/"/g, '""')}"` // Escape quotes for CSV
    ]);

    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentSubject.subject}_나이스성적평어_4학년_${currentStandard.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="main-layout" className="min-h-screen bg-[#fafaf8] text-gray-800 flex flex-col antialiased">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-gray-900 text-lg tracking-tight">초등 4학년 나이스 성적 평어 생성기</h1>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">초등 4학년 1학기 교육과정 채점기준안 연계 시스템</p>
            </div>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200/50">
            <button
              onClick={() => setActiveStep('roster')}
              className={`px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition ${
                activeStep === 'roster' 
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-100' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="mr-1 text-[10px] inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200/70 text-gray-700">1</span>
              명단 등록 ({students.length}명)
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-1" />
            <button
              onClick={() => {
                if (students.length === 0) {
                  alert('학생 명단을 먼저 등록해 주세요.');
                  return;
                }
                setActiveStep('grade');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition ${
                activeStep === 'grade' 
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-100' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="mr-1 text-[10px] inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200/70 text-gray-700">2</span>
              성취도 분류 & 생성
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-1" />
            <button
              onClick={() => {
                if (students.length === 0) {
                  alert('학생 명단을 먼저 등록해 주세요.');
                  return;
                }
                setActiveStep('result');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-sans font-semibold transition ${
                activeStep === 'result' 
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-100' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="mr-1 text-[10px] inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200/70 text-gray-700">3</span>
              결과 및 내보내기
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        
        {/* Floating Toast Message */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-xs font-sans py-3 px-5 rounded-xl shadow-xl flex items-center gap-2.5 z-50 border border-gray-800 animate-slide-up">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Global Curriculum Selector (Static/Sticky across setup stages) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs mb-8">
          <div className="flex items-center gap-2 text-emerald-700 mb-4">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">평가 교육과정 및 성취기준 선택</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-sans font-semibold text-gray-400 mb-2">1. 평가 교과</label>
              <div className="flex flex-wrap gap-2">
                {fourthGradeCurriculum.map((subjectData, idx) => (
                  <button
                    key={subjectData.subject}
                    onClick={() => {
                      setSelectedSubjectIdx(idx);
                      setSelectedStandardIdx(0);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer border ${
                      selectedSubjectIdx === idx 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold' 
                        : 'bg-gray-50 text-gray-600 border-gray-200/70 hover:bg-gray-100/70'
                    }`}
                  >
                    {subjectData.subject}
                  </button>
                ))}
              </div>
            </div>

            {/* Achievement Standard Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-sans font-semibold text-gray-400 mb-2">2. 성취기준 및 평가요소</label>
              <select
                className="w-full text-sm p-2.5 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 bg-white cursor-pointer"
                value={selectedStandardIdx}
                onChange={(e) => setSelectedStandardIdx(Number(e.target.value))}
              >
                {currentSubject.standards.map((std, idx) => (
                  <option key={std.code} value={idx}>
                    [{std.code}] {std.statement}
                  </option>
                ))}
              </select>

              {/* Standard details visualizer */}
              {currentStandard && (
                <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-xs text-gray-600">
                  <div className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600" />
                    성취도별 표준 채점 기준문구 맛보기
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mt-2">
                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <span className="font-bold text-emerald-600 block mb-1">매우잘함</span>
                      <p className="text-gray-500 leading-relaxed text-[11px] line-clamp-3" title={currentStandard.defaults.매우잘함}>
                        {currentStandard.defaults.매우잘함}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <span className="font-bold text-teal-600 block mb-1">잘함</span>
                      <p className="text-gray-500 leading-relaxed text-[11px] line-clamp-3" title={currentStandard.defaults.잘함}>
                        {currentStandard.defaults.잘함}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <span className="font-bold text-amber-600 block mb-1">보통</span>
                      <p className="text-gray-500 leading-relaxed text-[11px] line-clamp-3" title={currentStandard.defaults.보통}>
                        {currentStandard.defaults.보통}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <span className="font-bold text-gray-500 block mb-1">노력요함</span>
                      <p className="text-gray-500 leading-relaxed text-[11px] line-clamp-3" title={currentStandard.defaults.노력요함}>
                        {currentStandard.defaults.노력요함}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step Content Switcher */}
        {activeStep === 'roster' && (
          <div className="space-y-6">
            <RosterManager students={students} setStudents={setStudents} />
            {students.length > 0 && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setActiveStep('grade')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-sm font-semibold py-3 px-6 rounded-xl shadow-md transition duration-200 flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
                >
                  명단 확정 및 성취도 평가하러 가기
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {activeStep === 'grade' && (
          <div className="space-y-8">
            {/* Quick Actions Panel */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h3 className="font-sans font-bold text-gray-900 text-base">성취도(매우잘함·잘함·보통·노력요함) 배분 및 맞춤 생기부 평가 생성</h3>
                  <p className="text-xs text-gray-500 mt-0.5">각 학생별로 수행평가 결과를 분류하면, 중복 및 필터링 회피 생기부 서술문을 자동 디자인합니다.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAssignLevelToAll('매우잘함')}
                    className="text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 px-3 py-1.5 rounded-lg transition border border-emerald-100 cursor-pointer"
                  >
                    전체 '매우잘함' 부여
                  </button>
                  <button
                    onClick={() => handleAssignLevelToAll('잘함')}
                    className="text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100/80 px-3 py-1.5 rounded-lg transition border border-teal-100 cursor-pointer"
                  >
                    전체 '잘함' 부여
                  </button>
                  <button
                    onClick={() => handleAssignLevelToAll('보통')}
                    className="text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100/80 px-3 py-1.5 rounded-lg transition border border-amber-100 cursor-pointer"
                  >
                    전체 '보통' 부여
                  </button>
                  <button
                    onClick={() => handleAssignLevelToAll('노력요함')}
                    className="text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200/80 px-3 py-1.5 rounded-lg transition border border-gray-200 cursor-pointer"
                  >
                    전체 '노력요함' 부여
                  </button>
                </div>
              </div>

              {/* Grid / List for Assigning Grades */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-16">번호</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-24">이름</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-48 text-center">성취수준 지정</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500">개별 특징 관찰기록 (반영)</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-44">미리보기 (체점기준안 매칭)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition">
                        <td className="py-3.5 px-4 text-sm font-mono text-gray-500">{student.number}번</td>
                        <td className="py-3.5 px-4 text-sm font-sans font-semibold text-gray-800">{student.name}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex rounded-lg p-0.5 bg-gray-100/80 border border-gray-200/50">
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentLevel(student.id, '매우잘함')}
                              className={`px-3 py-1 text-xs rounded-md transition font-semibold cursor-pointer ${
                                student.level === '매우잘함' 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-800'
                              }`}
                            >
                              매우잘함
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentLevel(student.id, '잘함')}
                              className={`px-3 py-1 text-xs rounded-md transition font-semibold cursor-pointer ${
                                student.level === '잘함' 
                                  ? 'bg-teal-600 text-white shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-800'
                              }`}
                            >
                              잘함
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentLevel(student.id, '보통')}
                              className={`px-3 py-1 text-xs rounded-md transition font-semibold cursor-pointer ${
                                student.level === '보통' 
                                  ? 'bg-amber-500 text-white shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-800'
                              }`}
                            >
                              보통
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentLevel(student.id, '노력요함')}
                              className={`px-3 py-1 text-xs rounded-md transition font-semibold cursor-pointer ${
                                student.level === '노력요함' 
                                  ? 'bg-gray-500 text-white shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-800'
                              }`}
                            >
                              노력요함
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            className="w-full text-xs p-2 border border-gray-200 hover:border-gray-300 focus:border-emerald-500 focus:bg-white focus:outline-hidden rounded-xl bg-gray-50/50 transition"
                            placeholder="개별 관찰 키워드를 기입해 특색 있는 평어를 작성하세요"
                            value={student.notes}
                            onChange={(e) => {
                              const notes = e.target.value;
                              setStudents(prev => prev.map(s => s.id === student.id ? { ...s, notes } : s));
                            }}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-400 font-sans italic truncate max-w-[150px]" title={student.level ? currentStandard?.defaults[student.level] : '성취수준 미선택'}>
                          {student.level ? currentStandard?.defaults[student.level] : '선택 대기 중...'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 평어 생성 실행 패널 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option A: Fast Local Rule Generation */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h4 className="font-sans font-bold text-gray-900 text-sm">옵션 A: 오프라인 초고속 문장 조립기</h4>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    네트워크나 서버 대기 없이 즉각적으로 다채로운 형태의 나이스용 평어를 생성합니다. 
                    성취기준별 기본 평어를 기반으로, 중복 입력 방지 회피를 위해 접미어 및 조사 등을 
                    자동으로 다변화 믹싱하여 1초 만에 조립해 줍니다.
                  </p>
                </div>
                <button
                  onClick={generateCommentsLocally}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-sans text-xs font-semibold py-3 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  로컬 다변화 평어 일괄 생성 (즉시 완료)
                </button>
              </div>

              {/* Option B: AI Smart Creative Generation */}
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between border border-emerald-800">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <h4 className="font-sans font-bold text-sm">옵션 B: Gemini AI 개별 맞춤 평어 생성</h4>
                    </div>
                    <span className="bg-emerald-800 text-emerald-300 text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">추천</span>
                  </div>
                  <p className="text-xs text-emerald-100/80 leading-relaxed mb-4">
                    구글의 고성능 Gemini AI 모델을 구동하여 생기부의 어조 규칙에 100% 부합하는 
                    다양하고 풍부한 개별 평가 문장을 일괄 창작합니다. 각 아동의 개별 관찰 특징이 
                    선택하신 성취기준 채점표 문장과 매우 유려하고 입체적으로 융합됩니다.
                  </p>
                </div>

                <div className="space-y-3">
                  {generationError && (
                    <div className="bg-red-950/60 border border-red-900 rounded-xl p-3 flex items-start gap-2 text-xs text-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{generationError}</span>
                    </div>
                  )}

                  <button
                    onClick={generateCommentsWithAI}
                    disabled={isGenerating}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-emerald-950 font-sans text-xs font-bold py-3 rounded-xl shadow-md transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-950" />
                        AI 작문가 가동 중 (약 5-15초 소요)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-950" />
                        Gemini AI로 다채로운 맞춤 평어 자동 생성 시작
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center border-t border-gray-100 pt-6">
              <button
                onClick={() => setActiveStep('roster')}
                className="text-xs text-gray-500 hover:text-gray-800 font-sans font-semibold py-2 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition cursor-pointer"
              >
                이전: 학생 명단 수정
              </button>
              <button
                onClick={() => {
                  const anyMissing = students.some(s => !s.comment);
                  if (anyMissing && !confirm('평어가 아직 생성되지 않은 학생이 있습니다. 그대로 결과 화면으로 이동하시겠습니까?')) {
                    return;
                  }
                  setActiveStep('result');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-semibold py-2.5 px-5 rounded-xl shadow-xs transition cursor-pointer"
              >
                결과 보러 가기
              </button>
            </div>
          </div>
        )}

        {activeStep === 'result' && (
          <div className="space-y-8">
            {/* Download and Share Utility Bar */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-sans font-bold text-gray-900 text-base">3단계: 최종 나이스 입력 평어 내보내기</h3>
                <p className="text-xs text-gray-500 mt-0.5">완성된 문구들을 검토한 후 엑셀 다운로드나 클립보드 복사를 사용하여 나이스에 일괄 업로드하세요.</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleCopyCommentsOnly}
                  className="text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer border border-gray-200/60"
                  title="엑셀 세부능력 셀에 그대로 연속으로 붙여넣을 때 최적입니다."
                >
                  <Copy className="w-3.5 h-3.5" />
                  평어만 한 줄씩 연속 복사
                </button>
                <button
                  onClick={handleCopyAllCombined}
                  className="text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer border border-gray-200/60"
                >
                  <Users className="w-3.5 h-3.5" />
                  전체 명단결합 복사
                </button>
                <button
                  onClick={handleExportCSV}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  나이스 일괄업로드용 CSV 다운로드
                </button>
              </div>
            </div>

            {/* Results Review Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h4 className="font-sans font-semibold text-gray-900 text-sm">성적 및 평어 세부 검토 및 개별 보정</h4>
                <p className="text-xs text-gray-400 mt-0.5">평어 내용 칸을 클릭하여 학교 특징이나 마음에 드는 단어로 즉석에서 수정할 수 있습니다.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-16">번호</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-24">이름</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-20 text-center">성취도</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500">최종 생성 평어 (더블클릭 또는 클릭하여 수정 가능)</th>
                      <th className="py-3 px-4 text-xs font-sans font-medium text-gray-500 w-24 text-center">개별 복사</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4 text-sm font-mono text-gray-500">{student.number}번</td>
                        <td className="py-3.5 px-4 text-sm font-sans font-bold text-gray-800">{student.name}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block text-[11px] font-sans font-bold px-2 py-0.5 rounded-full ${
                            student.level === '매우잘함' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : student.level === '잘함'
                                ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                : student.level === '보통'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {student.level || '미지정'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <textarea
                            rows={2}
                            className="w-full text-xs p-2 border border-transparent hover:border-gray-200 focus:border-emerald-500 focus:bg-white focus:outline-hidden rounded-lg bg-transparent transition leading-relaxed text-gray-700 font-sans"
                            value={student.comment}
                            onChange={(e) => handleUpdateStudentComment(student.id, e.target.value)}
                            placeholder="생성된 평어 평가내용이 여기에 표시되며, 자유롭게 직관적인 편집이 가능합니다."
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleCopyText(student.comment, student.id)}
                            className="text-xs font-sans font-medium bg-gray-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 py-1.5 px-2.5 rounded-lg border border-gray-200 hover:border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            복사
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Back button */}
            <div className="flex justify-start">
              <button
                onClick={() => setActiveStep('grade')}
                className="text-xs text-gray-500 hover:text-gray-800 font-sans font-semibold py-2 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition cursor-pointer"
              >
                이전: 성취도 분류 수정
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 mt-12 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-6 space-y-2">
          <p className="font-medium">초등학교 4학년 1학기 교육과정 및 나이스 생활기록부 기재요령 연동 시스템</p>
          <p>© 2026 초등 교과평가 업무 효율화 솔루션. Designed beautifully with pure slate colors.</p>
        </div>
      </footer>
    </div>
  );
}
