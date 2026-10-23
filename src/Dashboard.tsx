import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FolderOpen,
  Layers,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react';
import type { Folder, Section, StudyState } from '../shared/models';
import { displayDate, todayKey } from './api';
import { Empty, ProgressBar, SourceIcon, useNow } from './components';

export type View = 'overview' | 'sources' | 'plan' | 'progress';
export function Dashboard({
  state,
  folder,
  sections,
  view,
  search,
  openSection,
  onUpload,
  onTopic,
  onPlan,
  onImport,
  onCreate,
}: {
  state: StudyState;
  folder?: Folder;
  sections: Section[];
  view: View;
  search: string;
  openSection: (id: string) => void;
  onUpload: () => void;
  onTopic: () => void;
  onPlan: () => void;
  onImport: () => void;
  onCreate: () => void;
}) {
  const now = useNow();
  const sources = state.sources.filter((source) => source.folderId === folder?.id);
  const ids = new Set(sections.map((section) => section.id));
  const attempts = state.attempts.filter((attempt) => ids.has(attempt.sectionId));
  const reviews = state.reviews.filter((review) => ids.has(review.sectionId));
  const cards = sections.flatMap((section) => section.content?.cards ?? []);
  const due = cards.filter(
    (card) => card.schedule.reps === 0 || new Date(card.schedule.due).getTime() <= now,
  ).length;
  const completed = sections.filter((section) => section.read).length;
  const score = attempts.length
    ? Math.round(
        (attempts.reduce((sum, attempt) => sum + attempt.correct, 0) /
          attempts.reduce((sum, attempt) => sum + attempt.total, 0)) *
          100,
      )
    : 0;
  const filtered = sections.filter((section) =>
    `${section.title} ${state.sources.find((source) => source.id === section.sourceId)?.name ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const plan = folder?.plan;
  const today = todayKey();
  const todayIds = new Set(
    plan?.days.filter((day) => day.date <= today).flatMap((day) => day.sectionIds) ?? [],
  );
  const nextSections = sections
    .filter((section) => !section.read && (todayIds.size ? todayIds.has(section.id) : true))
    .slice(0, 3);
  const titles: Record<View, { label: string; subtitle: string }> = {
    overview: {
      label: 'A little progress, every day.',
      subtitle: 'Your next steps, all in one place.',
    },
    sources: {
      label: 'Your learning library',
      subtitle: `${sources.length} sources · ${sections.length} sections`,
    },
    plan: {
      label: 'A clear path to exam day.',
      subtitle: plan
        ? `${displayDate(plan.examDate, true)} · ${plan.dailyMinutes} minutes a day`
        : 'A study rhythm that works for you.',
    },
    progress: {
      label: 'See how far you’ve come.',
      subtitle: 'Reading, recall, and understanding.',
    },
  };

  if (!folder)
    return (
      <div className="dashboard">
        <div className="welcome-label">
          <span className="dot green" /> Your personal study space
        </div>
        <h1>
          Make room for
          <br />
          <span className="heading-accent">what you’ll know next.</span>
        </h1>
        <p className="page-subtitle">Start with your study materials or a topic on your mind.</p>
        <div className="onboarding-actions">
          <button className="import-tile" onClick={onImport}>
            <div className="tile-icon">
              <FolderOpen size={25} />
            </div>
            <h2>Import a study folder</h2>
            <p>PDFs, Markdown, and text files</p>
            <span>
              Browse workspace <ArrowRight size={16} />
            </span>
          </button>
          <button className="import-tile" onClick={onCreate}>
            <div className="tile-icon blue">
              <Plus size={25} />
            </div>
            <h2>Start a new subject</h2>
            <p>A fresh place for your next goal</p>
            <span>
              Create folder <ArrowRight size={16} />
            </span>
          </button>
        </div>
        <div className="welcome-note">
          <BookOpen size={18} />
          <span>Local workspace. Your sources and progress stay on this machine.</span>
        </div>
      </div>
    );

  return (
    <div className="dashboard">
      <div className="welcome-label">
        <span className="dot green" />
        {view === 'overview' ? 'Your study desk' : folder.name}
      </div>
      <div className="page-title">
        <div>
          <h1>{titles[view].label}</h1>
          <p className="page-subtitle">{titles[view].subtitle}</p>
        </div>
        <button className="button primary" onClick={view === 'plan' ? onPlan : onUpload}>
          {view === 'plan' ? <CalendarDays size={16} /> : <Upload size={16} />}
          {view === 'plan' ? 'Edit plan' : 'Add sources'}
        </button>
      </div>

      {(view === 'overview' || view === 'progress') && (
        <div className="stats">
          <div>
            <span className="stat-label">
              <BookOpen size={16} /> Sections completed
            </span>
            <strong>
              {completed}
              <small> / {sections.length}</small>
            </strong>
            <ProgressBar
              value={sections.length ? (completed / sections.length) * 100 : 0}
              label="Reading progress"
            />
          </div>
          <div>
            <span className="stat-label">
              <Layers size={16} /> Cards due
            </span>
            <strong>
              {due}
              <small> / {cards.length}</small>
            </strong>
            <span className="stat-foot">{due ? 'Ready for review' : 'A fresh start'}</span>
          </div>
          <div>
            <span className="stat-label">
              <Target size={16} /> Quiz accuracy
            </span>
            <strong>{attempts.length ? `${score}%` : '—'}</strong>
            <span className="stat-foot">{attempts.length} quiz attempts</span>
          </div>
          <div>
            <span className="stat-label">
              <TrendingUp size={16} /> Total reviews
            </span>
            <strong>{reviews.length}</strong>
            <span className="stat-foot">One stronger memory at a time</span>
          </div>
        </div>
      )}

      {view === 'overview' && (
        <>
          <div className="overview-grid">
            <section className="today-section">
              <div className="section-heading">
                <h2>On your desk today</h2>
                <span className="subtle-tag">
                  <Clock3 size={13} /> {plan?.dailyMinutes ?? 30} min
                </span>
              </div>
              {nextSections.length ? (
                nextSections.map((section, index) => (
                  <button
                    className="today-item"
                    key={section.id}
                    onClick={() => openSection(section.id)}
                  >
                    <span className="today-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{section.title}</strong>
                      <span>
                        {state.sources.find((source) => source.id === section.sourceId)?.name} ·{' '}
                        {section.content ? 'Ready to practice' : 'Not started'}
                      </span>
                    </div>
                    <ArrowRight size={17} />
                  </button>
                ))
              ) : (
                <div className="inline-empty">
                  <CheckCircle2 size={23} />
                  <p>
                    {sections.length
                      ? 'Today’s reading is complete. Review your due cards.'
                      : 'Add your first source to get started.'}
                  </p>
                </div>
              )}
              <div className="section-footer">
                <span>{sections.filter((section) => !section.read).length} sections ahead</span>
                <button className="text-button" onClick={onPlan}>
                  Your study plan <ArrowRight size={14} />
                </button>
              </div>
            </section>
            <aside className="exam-section">
              <div className="exam-icon">
                <CalendarDays size={23} />
              </div>
              <span className="eyebrow">The Bigger Picture</span>
              <h2>
                {plan
                  ? `${Math.max(0, Math.ceil((new Date(`${plan.examDate}T00:00:00Z`).getTime() - now) / 86400000))} days to go`
                  : 'Give your goal a date.'}
              </h2>
              <p>
                {plan
                  ? `Exam day · ${displayDate(plan.examDate, true)}`
                  : 'A steady pace makes a big subject feel smaller.'}
              </p>
              <button className="button secondary" onClick={onPlan}>
                {plan ? 'Adjust study plan' : 'Create study plan'}
                <ArrowRight size={15} />
              </button>
            </aside>
          </div>
          <div className="section-heading library-heading">
            <h2>Continue learning</h2>
            <button className="text-button" onClick={onTopic}>
              <Sparkles size={15} /> Add AI topic
            </button>
          </div>
        </>
      )}

      {(view === 'overview' || view === 'sources') && (
        <>
          {view === 'sources' && (
            <div className="source-list">
              {sources.map((source) => (
                <div className="source-item" key={source.id}>
                  <div className={`file-icon ${source.kind}`}>
                    <SourceIcon kind={source.kind} size={22} />
                  </div>
                  <div>
                    <strong>{source.name}</strong>
                    <span>
                      {source.kind.toUpperCase()} ·{' '}
                      {state.sections.filter((section) => section.sourceId === source.id).length}{' '}
                      sections{source.pages ? ` · ${source.pages} pages` : ''}
                    </span>
                  </div>
                  {source.file && (
                    <a
                      className="text-button"
                      href={`/api/sources/${source.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open <ArrowRight size={15} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {view === 'sources' && (
            <div className="section-heading library-heading">
              <h2>
                All sections <span className="count">{filtered.length}</span>
              </h2>
              <button className="text-button" onClick={onTopic}>
                <Sparkles size={15} /> Add AI topic
              </button>
            </div>
          )}
          {filtered.length ? (
            <div className="section-table">
              <div className="table-header">
                <span>Section</span>
                <span>Practice</span>
                <span>Status</span>
                <span />
              </div>
              {filtered.map((section, index) => {
                const source = sources.find((item) => item.id === section.sourceId)!;
                return (
                  <button
                    className="section-row"
                    key={section.id}
                    onClick={() => openSection(section.id)}
                  >
                    <div className="section-name">
                      <span className={`section-number ${section.read ? 'done' : ''}`}>
                        {section.read ? <Check size={14} /> : String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong>{section.title}</strong>
                        <span>
                          {source?.name}
                          {section.pageStart
                            ? ` · pp. ${section.pageStart}–${section.pageEnd}`
                            : ''}
                        </span>
                      </div>
                    </div>
                    <span className="practice-count">
                      {section.content ? (
                        <>
                          <Layers size={13} />
                          {section.content.cards.length}
                          <span className="divider">/</span>
                          <Target size={13} />
                          {section.content.quiz.length}
                        </>
                      ) : (
                        <span className="muted">Not generated</span>
                      )}
                    </span>
                    <span
                      className={`status ${section.read ? 'complete' : section.content ? 'ready' : ''}`}
                    >
                      {section.read
                        ? 'Completed'
                        : section.content
                          ? 'Ready to study'
                          : 'Not started'}
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              icon={<FilePlus2 size={28} />}
              title={search ? 'No matching sections' : 'A blank page, for now'}
              action={
                !search && (
                  <button className="button secondary" onClick={onUpload}>
                    <Upload size={16} /> Add sources
                  </button>
                )
              }
            />
          )}
        </>
      )}

      {view === 'plan' &&
        (plan ? (
          <>
            <div className="plan-summary">
              <CalendarDays size={21} />
              <div>
                <strong>{plan.days.length} study days</strong>
                <span>15 minutes per new section · daily spaced review</span>
              </div>
              <span className="badge">{plan.dailyMinutes} min / day</span>
            </div>
            {plan.warning && <div className="warning">{plan.warning}</div>}
            <div className="plan-list">
              {plan.days.map((day) => (
                <div className={`plan-day ${day.date === today ? 'is-today' : ''}`} key={day.date}>
                  <div className="plan-date">
                    <strong>{displayDate(day.date)}</strong>
                    <span>
                      {day.date === today
                        ? 'Today'
                        : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                          })}
                    </span>
                  </div>
                  <div className="day-content">
                    {day.sectionIds.map((id) => {
                      const section = sections.find((item) => item.id === id);
                      return section ? (
                        <button className="day-section" key={id} onClick={() => openSection(id)}>
                          {section.read ? <CheckCircle2 size={16} /> : <BookOpen size={16} />}
                          <span>{section.title}</span>
                          <ArrowRight size={14} />
                        </button>
                      ) : null;
                    })}
                    <span className="review-line">
                      <Layers size={14} />
                      {day.reviewMinutes} min spaced review
                    </span>
                  </div>
                  <span className="day-duration">{day.studyMinutes + day.reviewMinutes} min</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty
            icon={<CalendarDays size={32} />}
            title="Put your next milestone on the calendar"
            action={
              <button className="button primary" onClick={onPlan}>
                <Plus size={16} /> Create study plan
              </button>
            }
          >
            Set your exam date and daily study time.
          </Empty>
        ))}

      {view === 'progress' && (
        <>
          <div className="progress-overview">
            <section>
              <div className="section-heading">
                <h2>Study activity</h2>
                <span className="muted">Last 14 days</span>
              </div>
              <div className="activity-chart">
                {Array.from({ length: 14 }, (_, index) => {
                  const date = new Date(now - (13 - index) * 86400000).toISOString().slice(0, 10);
                  const count =
                    reviews.filter((review) => review.date.startsWith(date)).length +
                    attempts.filter((attempt) => attempt.date.startsWith(date)).length;
                  const max = Math.max(
                    1,
                    ...Array.from({ length: 14 }, (_, offset) => {
                      const key = new Date(now - offset * 86400000).toISOString().slice(0, 10);
                      return (
                        reviews.filter((review) => review.date.startsWith(key)).length +
                        attempts.filter((attempt) => attempt.date.startsWith(key)).length
                      );
                    }),
                  );
                  return (
                    <div
                      className="activity-column"
                      key={date}
                      title={`${displayDate(date)}: ${count} study actions`}
                    >
                      <div className="activity-bar-space">
                        <div
                          className={`activity-bar ${count ? 'has-activity' : ''}`}
                          style={{ height: `${Math.max(3, (count / max) * 100)}%` }}
                        />
                      </div>
                      <span>{new Date(`${date}T12:00:00`).getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="mastery">
              <h2>Reading progress</h2>
              <div
                className="mastery-ring"
                style={{
                  background: `conic-gradient(var(--green) ${sections.length ? (completed / sections.length) * 360 : 0}deg, var(--line) 0deg)`,
                }}
              >
                <div>
                  <strong>
                    {sections.length ? Math.round((completed / sections.length) * 100) : 0}%
                  </strong>
                  <span>completed</span>
                </div>
              </div>
              <span className="muted">
                {completed} of {sections.length} sections
              </span>
            </section>
          </div>
          <div className="section-heading library-heading">
            <h2>Quiz history</h2>
          </div>
          {attempts.length ? (
            <div className="attempt-list">
              {[...attempts].reverse().map((attempt) => (
                <div key={attempt.id}>
                  <Target size={19} />
                  <div>
                    <strong>
                      {sections.find((section) => section.id === attempt.sectionId)?.title}
                    </strong>
                    <span>{displayDate(attempt.date, true)}</span>
                  </div>
                  <span
                    className={`badge ${attempt.correct / attempt.total >= 0.8 ? 'success' : ''}`}
                  >
                    {attempt.correct} / {attempt.total} ·{' '}
                    {Math.round((attempt.correct / attempt.total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              <Target size={25} />
              <p>Your first quiz is the starting point.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
