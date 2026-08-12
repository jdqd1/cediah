"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenText, Clock, Funnel, GraduationCap, MagnifyingGlass, PlayCircle, SortAscending, Tag } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { AppShell } from "./app-shell";

type CourseStatus = "completed" | "progress" | "not-started";

const courses = [
  {
    title: "Anatomía del cráneo",
    description: "Estructuras óseas del cráneo y suturas. Detalles anatómicos y aplicaciones clínicas.",
    image: "/anatomy/skull-light.png",
    status: "completed" as CourseStatus,
    statusLabel: "Completado",
    modules: "8 módulos",
    hours: "12 h",
    date: "Completado el 15 may 2024",
    percentage: 100,
    color: "green",
  },
  {
    title: "Músculos de la espalda",
    description: "Anatomía, función e inervación de los músculos de la espalda.",
    image: "/anatomy/back-light.png",
    status: "progress" as CourseStatus,
    statusLabel: "En progreso",
    modules: "6 módulos",
    hours: "8 h",
    date: "Último acceso: 12 may 2024",
    percentage: 65,
    color: "gold",
  },
  {
    title: "Anatomía del corazón",
    description: "Estructura, cavidades, válvulas y circulación coronaria.",
    image: "/anatomy/heart-light.png",
    status: "completed" as CourseStatus,
    statusLabel: "Completado",
    modules: "7 módulos",
    hours: "10 h",
    date: "Completado el 2 abr 2024",
    percentage: 100,
    color: "green",
  },
  {
    title: "Sistema respiratorio",
    description: "Componentes anatómicos y fisiología del sistema respiratorio.",
    image: "/anatomy/lungs.png",
    status: "not-started" as CourseStatus,
    statusLabel: "No iniciado",
    modules: "5 módulos",
    hours: "6 h",
    date: "No iniciado",
    percentage: 0,
    color: "gray",
  },
] as const;

const tabs: { key: "all" | CourseStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Completados" },
  { key: "progress", label: "En progreso" },
  { key: "not-started", label: "No iniciados" },
];

function ProgressRing({ percentage, color }: { percentage: number; color: string }) {
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <span className={`course-progress-ring course-progress-${color}`} aria-label={`${percentage}% completado`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="course-progress-track" cx="40" cy="40" r={radius} />
        <circle
          className="course-progress-value"
          cx="40"
          cy="40"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <strong>{percentage}%</strong>
    </span>
  );
}

export function CoursesScreen({ isAdministrator = false }: { isAdministrator?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");
  const [search, setSearch] = useState("");

  const visibleCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesTab = tab === "all" || course.status === tab;
      const matchesSearch = !normalizedSearch || `${course.title} ${course.description}`.toLowerCase().includes(normalizedSearch);
      return matchesTab && matchesSearch;
    });
  }, [search, tab]);

  return (
    <AppShell
      activeKey="courses"
      centeredSearch
      isAdministrator={isAdministrator}
      headerTitle="Mis cursos"
      searchPlaceholder="Buscar cursos por nombre o tema..."
      includeCourses
      mainClassName="courses-main"
    >
      <section className="courses-intro">
        <div className="courses-title-lockup">
          <GraduationCap size={40} weight="regular" />
          <div>
            <h2>Mis cursos</h2>
            <p>Aquí puedes ver todos los cursos a los que has asistido.</p>
          </div>
        </div>
        <button className="outline-action" type="button"><BookOpenText size={19} /> Ver certificados</button>
      </section>

      <section className="course-stats" aria-label="Resumen de cursos">
        <div className="course-stat-card stat-amber"><span className="course-stat-icon"><BookOpenText size={27} /></span><strong>8</strong><span>Cursos completados</span></div>
        <div className="course-stat-card stat-blue"><span className="course-stat-icon"><PlayCircle size={27} /></span><strong>3</strong><span>En progreso</span></div>
        <div className="course-stat-card stat-pink"><span className="course-stat-icon"><Tag size={27} /></span><strong>2</strong><span>No iniciados</span></div>
        <div className="course-stat-card stat-violet"><span className="course-stat-icon"><Clock size={27} /></span><strong>136</strong><span>Horas de aprendizaje</span></div>
      </section>

      <section className="courses-list-section" aria-labelledby="courses-list-title">
        <div className="courses-filter-row">
          <div className="course-tabs" role="tablist" aria-label="Filtrar cursos">
            {tabs.map((item) => (
              <button
                className={tab === item.key ? "is-selected" : ""}
                key={item.key}
                role="tab"
                aria-selected={tab === item.key}
                type="button"
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="courses-filter-actions">
            <label className="inline-search"><MagnifyingGlass size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" aria-label="Buscar en mis cursos" /></label>
            <button className="select-action" type="button"><SortAscending size={19} /> Más recientes <ArrowRight size={16} /></button>
            <button className="select-action" type="button"><Funnel size={18} /> Filtros</button>
          </div>
        </div>

        <div className="course-list" id="courses-list-title">
          {visibleCourses.map((course) => (
            <Link className="course-list-row" href="/clases/reproductor" key={course.title}>
              <span className="course-list-image"><Image src={course.image} alt="" fill sizes="140px" /></span>
              <span className="course-list-copy">
                <strong>{course.title}</strong>
                <span className={`status-pill status-${course.status}`}><span />{course.statusLabel}</span>
                <p>{course.description}</p>
                <small><BookOpenText size={15} /> {course.modules} <Clock size={15} /> {course.hours} <span>•</span> {course.date}</small>
              </span>
              <ProgressRing percentage={course.percentage} color={course.color} />
              <ArrowRight className="course-row-arrow" size={23} />
            </Link>
          ))}
          {visibleCourses.length === 0 && <p className="empty-course-state">No encontramos cursos con esos filtros.</p>}
        </div>
      </section>
    </AppShell>
  );
}
