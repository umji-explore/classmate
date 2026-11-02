'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { maxGrade, SchoolInfo, SchoolSearchResult } from '@/lib/school';

export interface SchoolDraft {
  school: SchoolSearchResult | null;
  grade: number;
  class_nm: string;
}

export const draftFromSchool = (s: SchoolInfo | null): SchoolDraft => ({
  school: s
    ? { office_code: s.office_code, school_code: s.school_code, school_name: s.school_name, school_kind: s.school_kind, address: '' }
    : null,
  grade: s?.grade ?? 1,
  class_nm: s?.class_nm ?? '',
});

// 서버로 보낼 형태 (학교를 고르지 않았으면 null)
export const draftToPayload = (d: SchoolDraft) =>
  d.school
    ? { office_code: d.school.office_code, school_code: d.school.school_code, grade: d.grade, class_nm: d.class_nm.trim() }
    : null;

// 학교 이름으로 나이스에서 검색해 고르고, 학년·반을 입력하는 칸
export default function SchoolPicker({ value, onChange }: { value: SchoolDraft; onChange: (d: SchoolDraft) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return setError('학교 이름을 2글자 이상 입력해 주세요.');
    setSearching(true);
    setError(null);
    try {
      const { schools } = await api<{ schools: SchoolSearchResult[] }>(`/api/school/search?q=${encodeURIComponent(q)}`);
      setResults(schools);
      if (!schools.length) setError('검색 결과가 없어요. 학교 이름을 정확히 입력해 주세요. (예: 서울고등학교)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '학교를 검색하지 못했어요.');
    } finally {
      setSearching(false);
    }
  };

  const pick = (school: SchoolSearchResult) => {
    onChange({ ...value, school, grade: Math.min(value.grade, maxGrade(school.school_kind)) });
    setResults(null);
    setQuery('');
  };

  return (
    <div className="school-picker">
      {value.school ? (
        <div className="school-selected">
          <div>
            <strong>{value.school.school_name}</strong>
            <span>{value.school.school_kind}{value.school.address && ` · ${value.school.address}`}</span>
          </div>
          <button type="button" className="text-btn" onClick={() => onChange({ ...value, school: null })}>
            학교 바꾸기
          </button>
        </div>
      ) : (
        <>
          <div className="school-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // 회원가입 폼 안에서 Enter를 눌러도 가입 대신 학교 검색이 되도록
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="학교 이름 (예: 서울고등학교)"
              aria-label="학교 이름 검색"
              maxLength={30}
            />
            <button type="button" className="btn-secondary" onClick={search} disabled={searching}>
              <Search size={14} /> {searching ? '검색 중…' : '검색'}
            </button>
          </div>
          {results && results.length > 0 && (
            <div className="school-results" role="listbox" aria-label="학교 검색 결과">
              {results.map((s) => (
                <button type="button" key={`${s.office_code}-${s.school_code}`} className="school-result" onClick={() => pick(s)}>
                  <strong>{s.school_name}</strong>
                  <span>{s.school_kind} · {s.address || '주소 정보 없음'}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="school-error">{error}</p>}

      <div className="school-class">
        <label>
          학년
          <select
            value={value.grade}
            onChange={(e) => onChange({ ...value, grade: Number(e.target.value) })}
            aria-label="학년"
          >
            {Array.from({ length: maxGrade(value.school?.school_kind ?? '') }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>{g}학년</option>
            ))}
          </select>
        </label>
        <label>
          반
          <input
            value={value.class_nm}
            onChange={(e) => onChange({ ...value, class_nm: e.target.value })}
            inputMode="numeric"
            maxLength={10}
            placeholder="예: 3"
            aria-label="반"
          />
        </label>
      </div>
    </div>
  );
}
