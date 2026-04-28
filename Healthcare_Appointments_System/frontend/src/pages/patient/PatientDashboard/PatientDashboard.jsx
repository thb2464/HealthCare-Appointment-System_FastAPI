import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { retryVNPayPayment, acceptReschedule, declineReschedule } from "../../../api/appointmentApi";
import { createReview } from "../../../api/reviewApi";
import AppointmentCard from "../../../components/AppointmentCard/AppointmentCard";
import SlotPicker from "../../../components/Calendar/SlotPicker/SlotPicker";
import Badge from "../../../components/ui/Badge/Badge";
import Button from "../../../components/ui/Button/Button";
import Modal from "../../../components/ui/Modal/Modal";
import { useToast } from "../../../components/ui/Toast/Toast";
import { useAppointments } from "../../../hooks/useAppointments";
import { useAuth } from "../../../hooks/useAuth";
import "./PatientDashboard.css";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "RESCHEDULE_REQUESTED", label: "Yêu cầu đổi lịch" },
  { value: "RESCHEDULED", label: "Đã đổi lịch" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
];

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Show payment result toast when redirected back from VNPay
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast("Thanh toán thành công! Lịch hẹn đã được xác nhận.", "success");
      setSearchParams({}, { replace: true });
    } else if (payment === "failed") {
      toast("Thanh toán chưa hoàn tất. Lịch hẹn vẫn đang chờ xử lý.", "error");
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const params = useMemo(() => {
    const p = { page, page_size: PAGE_SIZE };
    if (statusFilter) p.status = statusFilter;
    return p;
  }, [statusFilter, page]);
  const { appointments: rawAppointments, loading, hasMore, cancel, reschedule, refetch } = useAppointments(params);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [statusFilter]);

  const appointments = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) => {
      const diff = new Date(b.scheduled_at) - new Date(a.scheduled_at);
      return sortOrder === "newest" ? diff : -diff;
    });
    return sorted;
  }, [rawAppointments, sortOrder]);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newSlot, setNewSlot] = useState(null);
  const [rLoading, setRLoading] = useState(false);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [revLoading, setRevLoading] = useState(false);

  // Payment
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Detail modal
  const [detailAppt, setDetailAppt] = useState(null);
  const [detailView, setDetailView] = useState("info"); // "info" | "reschedule"
  const [detailSlot, setDetailSlot] = useState(null);
  const [detailRLoading, setDetailRLoading] = useState(false);

  if (authLoading) return null;
  if (!user || user.role !== "patient") return <Navigate to="/login" replace />;

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await cancel(cancelTarget.id, cancelReason || undefined);
      toast("Đã hủy lịch hẹn", "info");
      setCancelTarget(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Hủy thất bại", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newSlot) { toast("Vui lòng chọn khung giờ mới", "error"); return; }
    setRLoading(true);
    try {
      await reschedule(rescheduleTarget.id, newSlot);
      toast("Đã đổi lịch hẹn!", "success");
      setRescheduleTarget(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Đổi lịch thất bại", "error");
    } finally {
      setRLoading(false);
    }
  };

  const handleDetailReschedule = async () => {
    if (!detailSlot) { toast("Vui lòng chọn khung giờ mới", "error"); return; }
    setDetailRLoading(true);
    try {
      await reschedule(detailAppt.id, detailSlot);
      toast("Đã đổi lịch hẹn!", "success");
      setDetailAppt(null);
      setDetailView("info");
      setDetailSlot(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Đổi lịch thất bại", "error");
    } finally {
      setDetailRLoading(false);
    }
  };

  const handleReview = async () => {
    setRevLoading(true);
    try {
      await createReview({ appointment_id: reviewTarget.id, ...reviewForm });
      toast("Đã gửi đánh giá!", "success");
      setReviewTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Gửi đánh giá thất bại", "error");
    } finally {
      setRevLoading(false);
    }
  };

  const handlePayment = async (appointmentId) => {
    setPaymentLoading(true);
    try {
      const res = await retryVNPayPayment(appointmentId);
      window.location.href = res.data.payment_url;
      // Note: don't set loading to false — page will redirect
    } catch (e) {
      toast(e.response?.data?.detail || "Thanh toán thất bại", "error");
      setPaymentLoading(false);
    }
  };

  const handleAcceptReschedule = async (apptId) => {
    try {
      await acceptReschedule(apptId);
      toast("Đã chấp nhận đổi lịch!", "success");
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Thao tác thất bại", "error");
    }
  };

  const handleDeclineReschedule = async (apptId) => {
    try {
      await declineReschedule(apptId);
      toast("Đã từ chối yêu cầu đổi lịch", "info");
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Thao tác thất bại", "error");
    }
  };

  const actions = (appt) => {
    const btns = [];
    // Doctor requested reschedule → patient decides
    if (appt.status === "RESCHEDULE_REQUESTED" && appt.reschedule_requested_by === "doctor") {
      btns.push(
        <button
          key="accept-reschedule"
          onClick={(e) => { e.stopPropagation(); handleAcceptReschedule(appt.id); }}
          className="patient-dash__action-btn patient-dash__action-btn--payment btn-primary"
        >
          Chấp nhận đổi lịch
        </button>
      );
      btns.push(
        <button
          key="decline-reschedule"
          onClick={(e) => { e.stopPropagation(); handleDeclineReschedule(appt.id); }}
          className="patient-dash__action-btn patient-dash__action-btn--cancel btn-danger"
        >
          Từ chối
        </button>
      );
    }
    // Patient's own pending reschedule request — show waiting state
    if (appt.status === "RESCHEDULE_REQUESTED" && appt.reschedule_requested_by === "patient") {
      btns.push(
        <span key="waiting" className="patient-dash__action-btn patient-dash__action-btn--reschedule btn-secondary" style={{ opacity: 0.7, cursor: "default" }}>
          Đang chờ bác sĩ duyệt…
        </span>
      );
    }
    // Patients can only reschedule PENDING appointments (backend constraint)
    if (appt.status === "PENDING") {
      btns.push(
        <button
          key="reschedule"
          onClick={(e) => { e.stopPropagation(); setRescheduleTarget(appt); setNewSlot(null); }}
          className="patient-dash__action-btn patient-dash__action-btn--reschedule btn-secondary"
        >
          Đổi lịch
        </button>
      );
      btns.push(
        <button
          key="cancel"
          onClick={(e) => { e.stopPropagation(); setCancelTarget(appt); setCancelReason(""); }}
          className="patient-dash__action-btn patient-dash__action-btn--cancel btn-danger"
        >
          Hủy
        </button>
      );
      btns.push(
        <button
          key="payment"
          onClick={(e) => { e.stopPropagation(); handlePayment(appt.id); }}
          disabled={paymentLoading}
          className="patient-dash__action-btn patient-dash__action-btn--payment btn-info"
        >
          {paymentLoading ? "Đang xử lý..." : "Thanh toán"}
        </button>
      );
    }
    if (appt.status === "CONFIRMED") {
      btns.push(
        <button
          key="reschedule-confirmed"
          onClick={(e) => { e.stopPropagation(); setRescheduleTarget(appt); setNewSlot(null); }}
          className="patient-dash__action-btn patient-dash__action-btn--reschedule btn-secondary"
        >
          Yêu cầu đổi lịch
        </button>
      );
    }
    if (appt.status === "COMPLETED") {
      btns.push(
        <button
          key="review"
          onClick={(e) => { e.stopPropagation(); setReviewTarget(appt); setReviewForm({ rating: 5, comment: "" }); }}
          className="patient-dash__action-btn patient-dash__action-btn--review btn-ghost"
        >
          ★ Đánh giá
        </button>
      );
    }
    return btns;
  };

  const upcoming = appointments.filter((a) => ["PENDING", "CONFIRMED", "RESCHEDULED", "RESCHEDULE_REQUESTED"].includes(a.status));
  const filtered = appointments;

  const statRows = [
    { label: "Tổng",       value: appointments.length,                                          modifier: "total"     },
    { label: "Sắp tới",   value: upcoming.length,                                               modifier: "upcoming"  },
    { label: "Hoàn thành", value: appointments.filter((a) => a.status === "COMPLETED").length,   modifier: "completed" },
    { label: "Đã hủy",    value: appointments.filter((a) => a.status === "CANCELLED").length,   modifier: "cancelled" },
  ];

  return (
    <div className="patient-dash">
      {/* Header */}
      <div className="patient-dash__header animate-fade-in">
        <div>
          <h1 className="patient-dash__title">Lịch hẹn của tôi</h1>
          <p className="patient-dash__subtitle">
            Chào mừng trở lại,{" "}
            <span className="patient-dash__subtitle-name">{user.full_name}</span>
          </p>
        </div>
        <Link to="/search" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Đặt lịch mới
        </Link>
      </div>

      {/* Quick stats */}
      {!loading && (
        <div className="patient-dash__stats animate-slide-up">
          {statRows.map((s) => (
            <div key={s.label} className="stat-card">
              <p className={`patient-dash__stat-value patient-dash__stat-value--${s.modifier}`}>
                {s.value}
              </p>
              <p className="patient-dash__stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs + sort */}
      <div className="patient-dash__controls">
        <div className="patient-dash__tabs">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={
                "patient-dash__tab" +
                (statusFilter === t.value ? " patient-dash__tab--active" : "")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="input patient-dash__sort-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="patient-dash__loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="patient-dash__loading-item skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="patient-dash__empty card">
          <span className="patient-dash__empty-icon">📅</span>
          <p className="patient-dash__empty-title">Không tìm thấy lịch hẹn</p>
          <p className="patient-dash__empty-hint">Đặt lịch hẹn đầu tiên với bác sĩ</p>
          <Link to="/search" className="btn-primary inline-flex">Tìm bác sĩ</Link>
        </div>
      ) : (
        <div className="patient-dash__list">
          {filtered.map((a) => (
            <div key={a.id} className="patient-dash__card-wrap" onClick={() => setDetailAppt(a)}>
              <AppointmentCard appointment={a} role="patient" actions={actions} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="patient-dash__pagination">
          <button
            className="btn-secondary patient-dash__page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Trước
          </button>
          <span className="patient-dash__page-label">Trang {page}</span>
          <button
            className="btn-secondary patient-dash__page-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
          >
            Tiếp →
          </button>
        </div>
      )}

      {/* Reschedule modal */}
      <Modal
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Đổi lịch hẹn"
        size="lg"
      >
        <SlotPicker doctorId={rescheduleTarget?.doctor?.id} onSelect={setNewSlot} compact />
        <div className="patient-dash__reschedule-section">
          <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>
            Hủy
          </Button>
          <Button loading={rLoading} disabled={!newSlot} onClick={handleReschedule}>
            Xác nhận đổi lịch
          </Button>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Hủy lịch hẹn">
        <div className="patient-dash__modal-body">
          <p className="patient-dash__modal-warn">
            Bạn có chắc chắn muốn hủy lịch hẹn này?
          </p>
          <div>
            <label className="label">
              Lý do{" "}
              <span className="patient-dash__optional">
                (không bắt buộc)
              </span>
            </label>
            <textarea
              className="patient-dash__modal-reason input"
              rows={3}
              placeholder="Cho chúng tôi biết lý do hủy…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="patient-dash__modal-actions">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Giữ lịch hẹn
            </Button>
            <Button variant="danger" loading={cancelLoading} onClick={handleCancel}>
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Viết đánh giá">
        <div className="patient-dash__modal-body">
          <div>
            <label className="label">Điểm đánh giá</label>
            <div className="patient-dash__review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                  className={
                    "patient-dash__review-star" +
                    (n <= reviewForm.rating ? " patient-dash__review-star--active" : "")
                  }
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              Nhận xét{" "}
              <span className="patient-dash__optional">
                (không bắt buộc)
              </span>
            </label>
            <textarea
              className="patient-dash__review-textarea input"
              rows={4}
              placeholder="Chia sẻ trải nghiệm của bạn…"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              maxLength={1000}
            />
          </div>
          <div className="patient-dash__modal-actions">
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>
              Hủy
            </Button>
            <Button loading={revLoading} onClick={handleReview}>
              Gửi đánh giá
            </Button>
          </div>
        </div>
      </Modal>

      {/* Appointment detail modal */}
      <Modal
        open={!!detailAppt}
        onClose={() => { setDetailAppt(null); setDetailView("info"); setDetailSlot(null); }}
        title={detailView === "reschedule" ? "Chọn ngày & giờ mới" : "Chi tiết lịch hẹn"}
        size="lg"
      >
        {detailAppt && detailView === "info" && (
          <div className="patient-dash__detail-body">
            <div className="patient-dash__detail-grid">
              <div>
                <p className="label">Bác sĩ</p>
                <p className="patient-dash__detail-value">BS. {detailAppt.doctor?.user?.full_name}</p>
                {detailAppt.doctor?.specialty && <p className="patient-dash__detail-sub">{detailAppt.doctor.specialty.name}</p>}
              </div>
              <div>
                <p className="label">Ngày &amp; Giờ</p>
                <p className="patient-dash__detail-value">{new Date(detailAppt.scheduled_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="label">Trạng thái</p>
                <Badge status={detailAppt.status} />
              </div>
              {detailAppt.reason && (
                <div>
                  <p className="label">Lý do</p>
                  <p className="patient-dash__detail-sub">{detailAppt.reason}</p>
                </div>
              )}
              {detailAppt.cancellation_reason && (
                <div>
                  <p className="label">Lý do hủy</p>
                  <p className="patient-dash__detail-sub">{detailAppt.cancellation_reason}</p>
                </div>
              )}
              {detailAppt.reschedule_count > 0 && (
                <div>
                  <p className="label">Số lần đổi lịch</p>
                  <p className="patient-dash__detail-value">×{detailAppt.reschedule_count}</p>
                </div>
              )}
            </div>
            <div className="patient-dash__modal-actions">
              {["PENDING", "CONFIRMED"].includes(detailAppt.status) && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => { setDetailView("reschedule"); setDetailSlot(null); }}
                  >
                    Đổi lịch
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setCancelTarget(detailAppt);
                      setCancelReason("");
                      setDetailAppt(null);
                      setDetailView("info");
                    }}
                  >
                    Hủy
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => { setDetailAppt(null); setDetailView("info"); }}>Đóng</Button>
            </div>
          </div>
        )}

        {detailAppt && detailView === "reschedule" && (
          <div className="patient-dash__detail-reschedule">
            <div className="patient-dash__detail-reschedule-info">
              <p className="patient-dash__detail-sub">
                Hiện tại: <strong>{new Date(detailAppt.scheduled_at).toLocaleString()}</strong> với BS. {detailAppt.doctor?.user?.full_name}
              </p>
            </div>
            <SlotPicker doctorId={detailAppt.doctor?.id} onSelect={setDetailSlot} compact />
            <div className="patient-dash__reschedule-section">
              <Button variant="secondary" onClick={() => { setDetailView("info"); setDetailSlot(null); }}>
                Quay lại
              </Button>
              <Button loading={detailRLoading} disabled={!detailSlot} onClick={handleDetailReschedule}>
                Xác nhận đổi lịch
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
