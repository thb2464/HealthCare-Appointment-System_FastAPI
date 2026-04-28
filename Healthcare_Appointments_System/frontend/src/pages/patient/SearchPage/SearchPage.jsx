import React, { useState, useEffect } from "react";
import DoctorCard from "../../../components/DoctorCard/DoctorCard";
import { getDoctors, getSpecialties } from "../../../api/doctorApi";
import "./SearchPage.css";

export default function SearchPage() {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState({ name: "", specialty_id: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    getSpecialties().then(({ data }) => setSpecialties(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 12 };
    if (query.name) params.name = query.name;
    if (query.specialty_id) params.specialty_id = query.specialty_id;
    getDoctors(params)
      .then(({ data }) => setDoctors(data))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [query, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="search-page">
      {/* Page header */}
      <div className="search-page__header animate-fade-in">
        <h1 className="search-page__title">Tìm bác sĩ</h1>
        <p className="search-page__subtitle">
          {loading ? "Đang tìm kiếm…" : `${doctors.length} kết quả`}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="search-page__bar animate-slide-up">
        <div className="search-page__search-input-wrap">
          <svg
            className="search-page__search-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            className="input"
            placeholder="Tìm theo tên bác sĩ…"
            value={query.name}
            onChange={(e) => setQuery((q) => ({ ...q, name: e.target.value }))}
          />
        </div>

        <select
          className="input search-page__select"
          value={query.specialty_id}
          onChange={(e) => {
            setQuery((q) => ({ ...q, specialty_id: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Tất cả chuyên khoa</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <button type="submit" className="search-page__submit btn-primary">
          Tìm kiếm
        </button>
      </form>

      {/* Results */}
      <div className="search-page__results">
        {loading ? (
          <div className="search-page__grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="search-page__skeleton-card card">
                <div className="skeleton skeleton-avatar" />
                <div className="skeleton skeleton-line--lg" />
                <div className="skeleton skeleton-line--md" />
                <div className="skeleton skeleton-line--sm" />
              </div>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="search-page__empty">
            <div className="search-page__empty-icon">🔍</div>
            <p className="search-page__empty-title">Không tìm thấy bác sĩ</p>
            <p className="search-page__empty-hint">
              Hãy thử điều chỉnh từ khóa hoặc bộ lọc chuyên khoa
            </p>
          </div>
        ) : (
          <>
            <div className="search-page__grid">
              {doctors.map((d) => (
                <DoctorCard key={d.id} doctor={d} />
              ))}
            </div>

            {/* Pagination */}
            <div className="search-page__pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary"
              >
                ← Trước
              </button>
              <span className="search-page__page-label">Trang {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={doctors.length < 12}
                className="btn-secondary"
              >
                Tiếp →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
