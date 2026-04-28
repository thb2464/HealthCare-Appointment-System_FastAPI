// Date / time helpers

export const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const DAY_FULL = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
];

/**
 * Format an ISO datetime string to "15 thg 1, 2026 · 09:00"
 */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) +
    " · " +
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Format time only → "09:00"
 */
export function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format date only → "Thứ Hai, 15 tháng 1"
 */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date to YYYY-MM-DD for API queries
 */
export function toDateParam(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return an array of 7 Date objects starting from Monday of the given week
 */
export function getWeekDays(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

/**
 * "2 giờ trước" / "sau 3 ngày" relative time
 */
export function relativeTime(iso) {
  if (!iso) return "";
  const diff = new Date(iso) - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const past = diff < 0;

  if (mins < 2) return "vừa xong";
  if (mins < 60) return past ? `${mins} phút trước` : `sau ${mins} phút`;
  if (hrs < 24) return past ? `${hrs} giờ trước` : `sau ${hrs} giờ`;
  return past ? `${days} ngày trước` : `sau ${days} ngày`;
}
