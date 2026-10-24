import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Layers,
  Settings2,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Upload,
} from 'lucide-react';
import type { Folder, GenerationRequest, Section, Source, StudyState } from '../shared/models';
import { api, displayDate, send } from './api';
import { Empty, ProgressBar, SourceIcon, useNow } from './components';
import { LearnerFields } from './App';
import type { RunTask } from './StudyView';
import { baselinePolicy, chapterPreparation, sectionPractice } from '../shared/learning';
import { GenerateAction, latestRequest, ModelPicker, PromptLibrary, RequestStatus } from './Generation';
import { sectionNumber } from '../shared/sections';

export type View = 'chapters' | 'sources' | 'plan' | 'progress' | 'settings';
export function Dashboard({
  state,
  folder,
  sections,
  view,
  search,
  openSection,
  onUpload,
  onPlan,
  busy,
  run,
  onMain,
  onAccept,
}: {
  state: StudyState;
  folder: Folder;
  sections: Section[];
  view: View;
  search: string;
  openSection: (id: string) => void;
  onUpload: () => void;
  onPlan: () => void;
  busy: string;
  run: RunTask;
  onMain: (source: Source) => void;
  onAccept: (source: Source) => void;
}) {
  const now = useNow();
  const chapters = state.chapters
    .filter((chapter) => chapter.folderId === folder.id)
    .sort((first, second) => first.order - second.order);
  const sources = state.sources.filter((source) => source.folderId === folder.id);
  const main = sources.find((source) => source.id === folder.mainSourceId);
  const ids = new Set(sections.map((section) => section.id));
  const attempts = state.attempts.filter((attempt) => ids.has(attempt.sectionId));
  const reviews = state.reviews.filter((review) => ids.has(review.sectionId));
  const cards = sections.flatMap((section) => section.content?.cards ?? []);
  const due = cards.filter(
    (card) => card.schedule.reps === 0 || new Date(card.schedule.due).getTime() <= now,
  );
  const completed = chapters.filter(
    (chapter) => chapterPreparation(chapter, sections, state).complete,
  ).length;
  const score = attempts.length
    ? Math.round(
        (attempts.reduce((sum, attempt) => sum + attempt.correct, 0) /
          attempts.reduce((sum, attempt) => sum + attempt.total, 0)) *
          100,
      )
    : null;
  const labels: Record<View, string> = {
    chapters: 'Your chapter roadmap',
    sources: 'Exam source library',
    plan: 'A chapter at a time.',
    progress: 'Your exam progress',
    settings: 'Exam preparation settings',
  };
  const matches = chapters.filter((chapter) =>
    `${chapter.title} ${sections
      .filter((section) => section.chapterId === chapter.id)
      .map((section) => section.title)
      .join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const plan = folder.plan;
  function practiceDue() {
    const next = sections.find((section) =>
      section.content?.cards.some(
        (card) => card.schedule.reps === 0 || new Date(card.schedule.due).getTime() <= now,
      ),
    );
    if (next) openSection(next.id);
  }

  function chapterList(progressOnly = false) {
    return (
      <div className="chapter-list">
        {matches.map((chapter, index) => {
          const lessons = sections.filter((section) => section.chapterId === chapter.id);
          const preparation = chapterPreparation(chapter, sections, state);
          const chapterAttempts = attempts.filter((attempt) =>
            lessons.some((section) => section.id === attempt.sectionId),
          );
          const latestBySection = lessons
            .map((section) =>
              chapterAttempts.filter((attempt) => attempt.sectionId === section.id).at(-1),
            )
            .filter(Boolean);
          const needsAttention = latestBySection.some(
            (attempt) => attempt!.correct / attempt!.total < 0.8,
          );
          const dates = plan?.days
            .filter((day) =>
              day.sectionIds.some(
                (id) => id === chapter.id || lessons.some((section) => section.id === id),
              ),
            )
            .map((day) => day.date);
          return (
            <details className="chapter" key={chapter.id} open={index === 0 && !progressOnly}>
              <summary>
                <span className={`chapter-number ${preparation.complete ? 'done' : ''}`}>
                  {preparation.complete ? (
                    <CheckCircle2 size={19} />
                  ) : (
                    String(chapter.order).padStart(2, '0')
                  )}
                </span>
                <div>
                  <h2>{chapter.title}</h2>
                  <p>
                    {lessons.length ? `${lessons.length} sections` : 'Sections not generated'}
                    {chapter.pageStart ? ` · pp. ${chapter.pageStart}-${chapter.pageEnd}` : ''}
                    {dates?.length
                      ? ` · ${displayDate(dates[0])}${dates.length > 1 ? ` to ${displayDate(dates.at(-1)!)}` : ''}`
                      : ''}
                  </p>
                </div>
                <div className="chapter-status">
                  <span>
                    {preparation.complete
                      ? 'Prepared'
                      : lessons.length
                        ? `${lessons.filter((section) => sectionPractice(section, state).complete).length}/${lessons.length} sections practised`
                        : 'Not started'}
                  </span>
                  {needsAttention && <span className="attention">Needs practice</span>}
                  <ProgressBar
                    value={
                      lessons.length
                        ? (lessons.filter((section) => sectionPractice(section, state).complete)
                            .length /
                            lessons.length) *
                          100
                        : 0
                    }
                    label={`${chapter.title} practice progress`}
                  />
                </div>
                <ChevronDown size={16} />
              </summary>
              <p className="chapter-description">{chapter.description}</p>
              {chapter.examFocus?.length ? (
                <p className="exam-focus">
                  <strong>Exam focus:</strong> {chapter.examFocus.join(' · ')}
                </p>
              ) : null}
              {!lessons.length && (
                <div className="chapter-actions">
                  <GenerateAction
                    state={state}
                    folderId={folder.id}
                    kind="sections"
                    targetId={chapter.id}
                    label="Generate sections"
                    run={run}
                    busy={busy}
                  />
                </div>
              )}
              {lessons.map((section) => {
                const latest = attempts
                  .filter((attempt) => attempt.sectionId === section.id)
                  .at(-1);
                const reviewed =
                  section.content?.cards.filter((card) => card.schedule.reps > 0).length ?? 0;
                const parts = [
                  section.content?.summary ? 'Summary' : null,
                  section.content?.cards.length
                    ? `${section.content.cards.length} cards (${reviewed} reviewed)`
                    : null,
                  section.content?.quiz.length
                    ? `${section.content.quiz.length} quiz questions`
                    : null,
                ].filter(Boolean);
                return (
                  <button
                    className="lesson-row"
                    key={section.id}
                    onClick={() => openSection(section.id)}
                  >
                    {sectionPractice(section, state).complete ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <BookOpen size={17} />
                    )}
                    <div>
                      <strong>
                        {sectionNumber(state, section)} · {section.title}
                      </strong>
                      {section.keyTopics?.length ? (
                        <span className="lesson-topics">{section.keyTopics.join(' · ')}</span>
                      ) : null}
                      <span>
                        {parts.length ? parts.join(' · ') : 'Study materials not generated yet'}
                        {latest ? ` · latest quiz ${latest.correct}/${latest.total}` : ''}
                      </span>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
              {lessons.length > 0 &&
                lessons.some(
                  (section) =>
                    !section.artifacts?.summary ||
                    !section.artifacts?.flashcards ||
                    !section.artifacts?.quiz,
                ) && (
                  <div className="chapter-actions">
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void run(
                          async () => {
                            const queued = await api<GenerationRequest[]>(
                              `/chapters/${chapter.id}/materials`,
                              send({}),
                            );
                            for (const request of queued)
                              await api(`/requests/${request.id}/run`, send({}));
                          },
                          'Study materials requested for this chapter',
                        )
                      }
                    >
                      <Sparkles size={15} /> Generate missing study materials
                    </button>
                    <span className="form-note">
                      Queues one summary, flashcard and quiz request per section.
                    </span>
                  </div>
                )}
            </details>
          );
        })}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-label">
        <span className="dot green" />
        {folder.name}
      </div>
      <div className="page-title">
        <div>
          <h1>{labels[view]}</h1>
          <p className="page-subtitle">
            {view === 'sources'
              ? `${sources.length} files · one exam curriculum`
              : `${chapters.length} chapters · ${sections.length} lessons${main ? ` · ${main.name}` : ''}`}
          </p>
        </div>
        <button className="button primary" onClick={view === 'plan' ? onPlan : onUpload}>
          {view === 'plan' ? <CalendarDays size={16} /> : <Upload size={16} />}
          {view === 'plan' ? (plan ? 'Edit plan' : 'Create plan') : 'Add sources'}
        </button>
      </div>
      {['chapters', 'progress'].includes(view) && (
        <div className="stats">
          <div>
            <span className="stat-label">
              <BookOpen size={16} /> Chapters prepared
            </span>
            <strong>
              {completed}
              <small> / {chapters.length}</small>
            </strong>
            <ProgressBar
              value={chapters.length ? (completed / chapters.length) * 100 : 0}
              label="Preparation progress"
            />
          </div>
          <div>
            <span className="stat-label">
              <Layers size={16} /> Cards due
            </span>
            <strong>
              {due.length}
              <small> / {cards.length}</small>
            </strong>
            <button className="text-button" disabled={!due.length} onClick={practiceDue}>
              Review due cards <ArrowRight size={13} />
            </button>
          </div>
          <div>
            <span className="stat-label">
              <Target size={16} /> Quiz accuracy
            </span>
            <strong>{score === null ? '-' : `${score}%`}</strong>
            <span className="stat-foot">
              {attempts.length} attempts · not an exam-readiness score
            </span>
          </div>
          <div>
            <span className="stat-label">
              <CheckCircle2 size={16} /> Reviews saved
            </span>
            <strong>{reviews.length}</strong>
            <span className="stat-foot">
              {sections.filter((section) => section.read).length} lessons read
            </span>
          </div>
        </div>
      )}
      {view === 'chapters' && (
        <>
          {(() => {
            const outline = latestRequest(state, folder.id, 'outline');
            if (folder.outline || !main) return null;
            return (
              <div className="outline-banner">
                <strong>Roadmap is provisional.</strong>
                <p>
                  The tutor builds the chapter outline from the main source&apos;s own structure
                  (table of contents, dividers). Until then, chapters come from explicit headings
                  only.
                </p>
                {outline && outline.status !== 'done' ? (
                  <RequestStatus request={outline} run={run} busy={busy} />
                ) : (
                  <GenerateAction
                    state={state}
                    folderId={folder.id}
                    kind="outline"
                    label="Generate outline"
                    run={run}
                    busy={busy}
                  />
                )}
              </div>
            );
          })()}
          <div className="exam-brief">
            <Star size={18} />
            <div>
              <strong>Main source</strong>
              <p>{main?.name ?? 'Upload your first source to define the exam.'}</p>
            </div>
            <span className="badge">{baselinePolicy(folder.learner?.familiarity).label}</span>
          </div>
          {folder.curriculumNote && <p className="curriculum-note">{folder.curriculumNote}</p>}
          {chapters.length ? (
            chapterList()
          ) : (
            <Empty
              icon={<BookOpen size={28} />}
              title="Define this exam's learning path"
              action={
                <button
                  className="button primary"
                  disabled={!!busy || !sources.length}
                  onClick={() =>
                    void run(
                      () => api(`/folders/${folder.id}/prepare`, send({})),
                      'Exam curriculum prepared',
                    )
                  }
                >
                  Prepare exam curriculum
                </button>
              }
            >
              Existing source records can be upgraded to an exam-level curriculum without deleting
              their history.
            </Empty>
          )}
        </>
      )}
      {view === 'sources' && (
        <>
          <div className="source-list">
            {sources.map((source) => (
              <div className="exam-source" key={source.id}>
                <div className="source-item">
                  <div className={`file-icon ${source.kind}`}>
                    <SourceIcon kind={source.kind} size={22} />
                  </div>
                  <div>
                    <strong>{source.name}</strong>
                    <span>
                      {source.kind.toUpperCase()}
                      {source.pages ? ` · ${source.pages} pages` : ''} ·{' '}
                      {source.id === folder.mainSourceId
                        ? 'Main source - defines chapters'
                        : source.relevance?.status === 'accepted'
                          ? 'Accepted supplement'
                          : 'Excluded from study context'}
                    </span>
                  </div>
                  {source.id === folder.mainSourceId ? (
                    <span className="badge success">
                      <Star size={12} /> Main source
                    </span>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() => onMain(source)}
                    >
                      Make main source
                    </button>
                  )}
                </div>
                {source.id !== folder.mainSourceId && source.relevance && (
                  <div
                    className={`relevance ${source.relevance.status !== 'accepted' ? 'flagged' : ''}`}
                  >
                    <ShieldAlert size={16} />
                    <div>
                      <strong>
                        {Math.round(source.relevance.score * 100)}% vocabulary overlap · threshold{' '}
                        {Math.round(source.relevance.threshold * 100)}%
                      </strong>
                      <p>{source.relevance.reason}</p>
                      {source.relevance.sharedTerms.length > 0 && (
                        <p className="muted">
                          Shared terms: {source.relevance.sharedTerms.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="source-actions">
                  {source.file && (
                    <a
                      className="text-button"
                      href={`/api/sources/${source.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={14} /> Open original
                    </a>
                  )}
                  {source.id !== folder.mainSourceId &&
                    (source.relevance?.status !== 'accepted' ? (
                      <button
                        className="text-button"
                        disabled={!!busy}
                        onClick={() => onAccept(source)}
                      >
                        Review and accept
                      </button>
                    ) : (
                      <button
                        className="text-button"
                        disabled={!!busy}
                        onClick={() =>
                          void run(
                            () =>
                              api(
                                `/folders/${folder.id}/sources/${source.id}`,
                                send({ status: 'excluded' }, 'PATCH'),
                              ),
                            'Supplement excluded',
                          )
                        }
                      >
                        Exclude supplement
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <p className="form-note source-note">
            The overlap score is a conservative vocabulary heuristic, not a semantic similarity
            probability. A flagged source remains stored for inspection but cannot contribute
            supplementary reading until accepted.
          </p>
        </>
      )}
      {view === 'plan' && (
        <>
          {plan ? (
            <>
              <div className="plan-summary">
                <CalendarDays size={21} />
                <div>
                  <strong>Exam: {displayDate(plan.examDate, true)}</strong>
                  <span>
                    {plan.dailyMinutes} minutes/day · {plan.days.length} days · chapter-ordered
                    lessons and spaced review
                  </span>
                </div>
                <span className="badge">{plan.familiarity ?? 'new'} baseline</span>
              </div>
              {plan.warning && <div className="warning">{plan.warning}</div>}
              {chapterList()}
              <details className="daily-schedule">
                <summary>Daily calendar</summary>
                <div className="plan-list">
                  {plan.days.map((day) => (
                    <div className="plan-day" key={day.date}>
                      <div className="plan-date">
                        <strong>{displayDate(day.date)}</strong>
                      </div>
                      <div className="day-content">
                        {[...new Set(day.sectionIds)].map((id) => {
                          const lesson = sections.find((item) => item.id === id);
                          const placeholder = lesson
                            ? undefined
                            : chapters.find((item) => item.id === id);
                          if (placeholder)
                            return (
                              <span className="day-section estimated" key={id}>
                                <BookOpen size={15} />
                                <span>
                                  {placeholder.order}. {placeholder.title} (sections not generated ·
                                  estimate)
                                </span>
                              </span>
                            );
                          const chapter = chapters.find((item) => item.id === lesson?.chapterId);
                          return (
                            lesson && (
                              <button
                                className="day-section"
                                key={id}
                                onClick={() => openSection(id)}
                              >
                                <BookOpen size={15} />
                                <span>
                                  {chapter?.order}. {chapter?.title} / {lesson.title}
                                </span>
                              </button>
                            )
                          );
                        })}
                        <span className="review-line">
                          <Layers size={14} />
                          {day.reviewMinutes} min spaced review
                        </span>
                      </div>
                      <span className="day-duration">
                        {day.studyMinutes + day.reviewMinutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <Empty
              icon={<CalendarDays size={30} />}
              title="Give your exam a study rhythm"
              action={
                <button className="button primary" onClick={onPlan}>
                  Create study plan
                </button>
              }
            >
              Set your exam date and daily time. The learning path stays grouped by chapter.
            </Empty>
          )}
        </>
      )}
      {view === 'progress' && (
        <>
          <div className="section-heading">
            <h2>Progress by chapter</h2>
            <span className="muted">
              Preparation requires audited coverage, successful recall and correct application.
            </span>
          </div>
          {chapterList(true)}
          <div className="section-heading library-heading">
            <h2>Quiz history</h2>
          </div>
          <div className="attempt-list">
            {[...attempts].reverse().map((attempt) => (
              <div key={attempt.id}>
                <Target size={18} />
                <div>
                  <strong>{sections.find((item) => item.id === attempt.sectionId)?.title}</strong>
                  <span>{displayDate(attempt.date, true)}</span>
                </div>
                <span className="badge">
                  {attempt.correct}/{attempt.total}
                </span>
              </div>
            ))}
            {!attempts.length && (
              <p className="form-note">No active-curriculum quizzes completed yet.</p>
            )}
          </div>
          <details className="daily-schedule">
            <summary>Archived curriculum history</summary>
            <p className="form-note">
              {
                state.sections.filter(
                  (item) => item.folderId === folder.id && item.archived && !item.sourceFragment,
                ).length
              }{' '}
              previous source units or lessons retained. Full archived records and their progress
              remain in your export and exam directory.
            </p>
          </details>
        </>
      )}
      {view === 'settings' && (
        <div className="exam-settings">
          <form
            key={`${folder.id}-${folder.learner?.familiarity}-${folder.prompt}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(
                () =>
                  api(
                    `/folders/${folder.id}`,
                    send(
                      {
                        learner: {
                          familiarity: form.get('familiarity'),
                          role: form.get('role'),
                          goal: form.get('goal'),
                        },
                        prompt: form.get('prompt'),
                      },
                      'PATCH',
                    ),
                  ),
                'Exam settings saved',
              );
            }}
          >
            <h2>Learning baseline</h2>
            <LearnerFields learner={folder.learner} />
            <ModelPicker
              folder={folder}
              busy={busy}
              onSave={(modelId) =>
                void run(
                  () => api(`/folders/${folder.id}`, send({ modelId: modelId || '' }, 'PATCH')),
                  'AI model saved',
                )
              }
            />
            <div className="baseline-impact">
              <strong>Current plan policy</strong>
              <p>{baselinePolicy(folder.learner?.familiarity).label}</p>
              <p>
                {baselinePolicy(folder.learner?.familiarity).lessonMinutes} minutes per lesson ·{' '}
                {Math.round(baselinePolicy(folder.learner?.familiarity).reviewFraction * 100)}%
                daily review reserve
              </p>
              <p>
                Saving a changed familiarity replans the remaining practice automatically. Topics,
                card IDs and quiz difficulty stay unchanged.
              </p>
            </div>
            <label>
              Exam tutor brief
              <textarea
                name="prompt"
                rows={6}
                maxLength={16000}
                defaultValue={folder.prompt ?? ''}
                placeholder="Optional: what should the tutor emphasise for this exam? e.g. weak areas, question style, depth."
              />
            </label>
            <p className="form-note">
              The baseline changes study priority and time estimates, not the required topic
              coverage. The brief is injected into every new generation request; existing materials
              are not rewritten unless you regenerate them.
            </p>
            <div className="modal-actions">
              <button className="button primary" disabled={!!busy}>
                <Settings2 size={16} /> Save exam settings
              </button>
            </div>
          </form>
          <div className="directory-info">
            <h2>Local exam directory</h2>
            <code>data/{folder.directory ?? 'Pending first save'}</code>
            <p>
              Sources, generation requests/responses, chapter packs, plan and progress live
              together.
            </p>
            <PromptLibrary state={state} folderId={folder.id} run={run} busy={busy} />
          </div>
        </div>
      )}
    </div>
  );
}
