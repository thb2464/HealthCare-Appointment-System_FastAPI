import React, { useState, useEffect } from "react";
import DoctorCard from "../../components/DoctorCard";
import { getDoctors, getSpecialties } from "../../api/doctorApi";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display font-bold text-3xl text-slate-100 mb-1">Find a Doctor</h1>
        <p className="text-slate-400 text-sm">
          {loading ? "Searching…" : `${doctors.length} results`}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8 animate-slide-up">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input pl-10"
            placeholder="Search by doctor name…"
            value={query.name}
            onChange={(e) => setQuery((q) => ({ ...q, name: e.target.value }))}
          />
        </div>
        <select
          className="input sm:w-56 bg-navy-900/50"
          value={query.specialty_id}
          onChange={(e) => { setQuery((q) => ({ ...q, specialty_id: e.target.value })); setPage(1); }}
        >
          <option value="">All specialties</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      {/* Results */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-14 w-14 rounded-2xl" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
          <p className="text-slate-400 font-medium">No doctors found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search or specialty filter</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {doctors.map((d) => <DoctorCard key={d.id} doctor={d} />)}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-3 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-4 py-2 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="flex items-center px-4 text-sm text-slate-400">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={doctors.length < 12}
              className="btn-secondary px-4 py-2 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
