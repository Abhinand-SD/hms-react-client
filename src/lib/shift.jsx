import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getActiveShift, openShift, closeShift } from '../api/shifts.api';
import { useAuth } from './auth';

const ShiftContext = createContext(null);

const CASH_HANDLER_ROLES = new Set(['ADMIN', 'RECEPTIONIST']);

export function ShiftProvider({ children }) {
  const { user } = useAuth();
  const [shift, setShift]                       = useState(null);
  const [systemExpectedCash, setExpected]       = useState(0);
  const [cashCollected, setCashCollected]       = useState(0);
  const [loading, setLoading]                   = useState(false);
  const [lastError, setLastError]               = useState('');

  const isCashHandler = !!user && CASH_HANDLER_ROLES.has(user.role);

  const refresh = useCallback(async () => {
    if (!isCashHandler) {
      setShift(null);
      return null;
    }
    setLoading(true);
    setLastError('');
    try {
      const { data } = await getActiveShift();
      const payload  = data.data;
      setShift(payload?.shift ?? null);
      setExpected(Number(payload?.systemExpectedCash ?? 0));
      setCashCollected(Number(payload?.cashCollected ?? 0));
      return payload?.shift ?? null;
    } catch (err) {
      setLastError(err?.response?.data?.error?.message ?? 'Failed to load shift.');
      setShift(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isCashHandler]);

  useEffect(() => { refresh(); }, [refresh]);

  async function open(openingBalance, notes) {
    const { data } = await openShift({ openingBalance, notes });
    await refresh();
    return data.data.shift;
  }

  async function close(declaredActualCash, notes) {
    const { data } = await closeShift({ declaredActualCash, notes });
    await refresh();
    return data.data;
  }

  const value = {
    shift,
    isOpen:        !!shift,
    isCashHandler,
    systemExpectedCash,
    cashCollected,
    loading,
    lastError,
    refresh,
    open,
    close,
  };

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within ShiftProvider');
  return ctx;
}
