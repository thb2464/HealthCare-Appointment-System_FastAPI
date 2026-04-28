import { useState, useEffect, useCallback } from "react";
import { getAppointments, cancelAppointment, updateAppointment, rescheduleAppointment } from "../api/appointmentApi";

export function useAppointments(params = {}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getAppointments(params);
      const arr = Array.isArray(data) ? data : (data.items ?? data);
      setAppointments(arr);
      const pageSize = params.page_size || 20;
      setHasMore(arr.length === pageSize);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load appointments");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  const cancel = async (id, cancellationReason) => {
    await cancelAppointment(id, cancellationReason);
    await fetch();
  };

  const confirm = async (id) => {
    await updateAppointment(id, { status: "confirmed" });
    await fetch();
  };

  const complete = async (id, notes) => {
    await updateAppointment(id, { status: "completed", notes: notes || undefined });
    await fetch();
  };

  const reschedule = async (id, scheduledAt) => {
    await rescheduleAppointment(id, scheduledAt);
    await fetch();
  };

  return { appointments, loading, error, hasMore, refetch: fetch, cancel, confirm, complete, reschedule };
}
