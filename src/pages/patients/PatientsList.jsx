import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Input';

const PAGE_SIZE = 20;

const GENDER_LABEL = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SkeletonRow() {
  return (
    <tr>
      {[48, 64, 80, 32, 48, 56, 72].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3.5 rounded bg-slate-100 animate-pulse`} style={{ width: w }} />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <div className="h-6 w-10 rounded bg-slate-100 animate-pulse" />
          <div className="h-6 w-10 rounded bg-slate-100 animate-pulse" />
        </div>
      </td>
    </tr>
  );
}

export default function PatientsList() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const canWrite = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input
  const debounceRef = useRef(null);
  function handleQChange(val) {
    setQ(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val);
      setPage(1);
    }, 300);
  }

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' };
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      const { data } = await searchPatients(params);
      const result = data.data;
      // Filter by gender client-side (not in API yet)
      const filtered = genderFilter
        ? result.patients.filter((p) => p.gender === genderFilter)
        : result.patients;
      setRows(filtered);
      setPagination(result.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [debouncedQ, page]);

  // Re-filter when gender changes without re-fetching
  useEffect(() => {
    if (!loading) load();
  }, [genderFilter]);

  const hasFilters = debouncedQ || genderFilter;

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
              {!loading && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {pagination.total}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">Search by name, mobile number, or UHID.</p>
          </div>
          {/* Patients are registered via Quick Book or Walk-in — no standalone register button */}
        </div>

        {/* Search + filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Name, mobile, or UHID…"
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {loading && debouncedQ && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <SpinnerIcon />
              </span>
            )}
          </div>

          <Select
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}
            className="w-32"
          >
            <option value="">All genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setQ(''); setDebouncedQ(''); setGenderFilter(''); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">UHID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                {!loading && err && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <p className="text-sm text-red-600">{err}</p>
                        <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !err && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <p className="text-sm font-medium text-slate-600">
                        {hasFilters ? 'No patients match your search.' : 'No patients registered yet.'}
                      </p>
                      {!hasFilters && (
                        <p className="mt-2 text-xs text-slate-400">
                          Patients are created automatically via the Quick Book or Walk-in flows on the Appointments page.
                        </p>
                      )}
                    </td>
                  </tr>
                )}

                {!loading && !err && rows.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        {p.uhid}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{p.mobile}</td>
                    <td className="px-4 py-3 text-slate-700">{p.age ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{GENDER_LABEL[p.gender] || p.gender}</td>
                    <td className="px-4 py-3 text-slate-600">{p.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/patients/${p.id}`)}
                        >
                          View
                        </Button>
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/patients/${p.id}/edit`)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} — {pagination.total} patient{pagination.total === 1 ? '' : 's'}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function SearchIcon({ className }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin text-slate-400" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" />
    </svg>
  );
}
