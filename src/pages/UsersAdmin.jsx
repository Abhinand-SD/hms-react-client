import { useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { RoleBadge, StatusBadge } from '../components/Badge';
import { AppShell } from '../components/AppShell';
import { CreateUserModal } from '../components/CreateUserModal';
import { EditUserModal } from '../components/EditUserModal';
import { ResetPinModal } from '../components/ResetPinModal';
import { DeactivateUserModal } from '../components/DeactivateUserModal';
import { ReactivateUserModal } from '../components/ReactivateUserModal';

const PAGE_SIZE = 10;

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UsersAdmin() {
  const { user: me } = useAuth();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState({ kind: null, user: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (q.trim()) params.q = q.trim();
      if (role) params.role = role;
      if (status) params.status = status;
      const { data } = await api.get('/users', { params });
      setRows(data.data.items);
      setPagination(data.data.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, role, status]);

  function onSearchSubmit(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  function closeModal(refreshed) {
    setModal({ kind: null, user: null });
    if (refreshed) load();
  }

  const activeFilters = useMemo(
    () => [q, role, status].filter(Boolean).length,
    [q, role, status],
  );

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage staff accounts, roles, and access.
            </p>
          </div>
          <Button onClick={() => setModal({ kind: 'create', user: null })}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New user
          </Button>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <form onSubmit={onSearchSubmit} className="flex flex-1 min-w-[220px] items-center gap-2">
              <Input
                placeholder="Search name, username, or employee ID"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="secondary" size="md">
                Search
              </Button>
            </form>
            <Select
              value={role}
              onChange={(e) => { setRole(e.target.value); setPage(1); }}
              className="w-36"
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Doctor</option>
              <option value="RECEPTIONIST">Receptionist</option>
            </Select>
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-36"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LOCKED">Locked</option>
            </Select>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQ(''); setRole(''); setStatus(''); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && err && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-red-600">
                      {err}
                    </td>
                  </tr>
                )}
                {!loading && !err && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No users match your filters.
                    </td>
                  </tr>
                )}
                {!loading && !err && rows.map((u) => {
                  const isSelf = u.id === me?.id;
                  const inactive = u.status === 'INACTIVE';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                        <div className="text-xs text-slate-500">@{u.username}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.employeeId}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(u.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ kind: 'edit', user: u })}
                            disabled={inactive}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ kind: 'reset-pin', user: u })}
                          >
                            Reset PIN
                          </Button>
                          {inactive ? (
                            <Button
                              size="sm"
                              onClick={() => setModal({ kind: 'reactivate', user: u })}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setModal({ kind: 'deactivate', user: u })}
                              disabled={isSelf}
                              className={isSelf ? '' : 'text-red-600 hover:bg-red-50'}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <div>
              {pagination.total > 0
                ? `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.total} user${pagination.total === 1 ? '' : 's'}`
                : '—'}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>

      <CreateUserModal open={modal.kind === 'create'} onClose={closeModal} />
      <EditUserModal open={modal.kind === 'edit'} user={modal.user} onClose={closeModal} />
      <ResetPinModal open={modal.kind === 'reset-pin'} user={modal.user} onClose={closeModal} />
      <DeactivateUserModal open={modal.kind === 'deactivate'} user={modal.user} onClose={closeModal} />
      <ReactivateUserModal open={modal.kind === 'reactivate'} user={modal.user} onClose={closeModal} />
    </AppShell>
  );
}
