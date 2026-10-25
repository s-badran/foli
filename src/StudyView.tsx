import { useState } from 'react';
import Markdown from 'react-markdown';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { needsRegenerate } from '../shared/models';
import type { GenerationRequest, QuizAttempt, Section, Source, StudyState } from '../shared/models';
import { api, displayDate, send } from './api';
import { Empty, SourceIcon, useNow } from './components';
import { sectionPractice } from '../shared/learning';
import { renderSummary } from '../shared/artifacts';
import { sectionNumber } from '../shared/sections';
import { latestRequest, RequestStatus } from './Generation';

export type RunTask = (
  action: () => Promise<unknown>,
  success?: string,
  busyLabel?: string,
) => Promise<void>;
type Tab = 'summary' | 'cards' | 'quiz' | 'source';

export function StudyView({
  section,
  source,
  state,
  busy,
  run,
  onBack,
  onPrev,
  onNext,
  initialTab = 'summary',
}: {
  section: Section;
  source: Source;
  state: StudyState;
  busy: string;
  run: RunTask;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  initialTab?: 'summary' | 'cards' | 'quiz';
}) {
  const now = useNow();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [reviewAll, setReviewAll] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const content = section.content;
  const preparation = sectionPractice(section, state);
  const dueCards =
    content?.cards.filter(
      (card) => card.schedule.reps === 0 || new Date(card.schedule.due).getTime() <= now,
    ) ?? [];
  const cards = reviewAll ? (content?.cards ?? []) : dueCards;
  const card = reviewAll ? cards[reviewIndex] : cards[0];
  const attempts = state.attempts.filter((attempt) => attempt.sectionId === section.id);
  const hasSummary = !!content?.summary;
  const hasCards = !!content?.cards.length;
  const hasQuiz = !!content?.quiz.length;
  const missingKinds = (['summary', 'flashcards', 'quiz'] as const).filter(
    (kind) => !section.artifacts?.[kind],
  );
  const groups = (content?.cards ?? []).reduce<
    Record<string, NonNullable<typeof content>['cards']>
  >(
    (all, item) => ({
      ...all,
      [item.group ?? 'Cards']: [...(all[item.group ?? 'Cards'] ?? []), item],
    }),
    {},
  );
  const folder = state.folders.find((item) => item.id === section.folderId);
  const runRegenerate = (kind: 'summary' | 'flashcards' | 'quiz', label: string) => () =>
    void run(
      async () => {
        const request = await api<GenerationRequest>(
          `/folders/${section.folderId}/requests`,
          send({ kind, targetId: section.id }),
        );
        await api(`/requests/${request.id}/run`, send({}));
      },
      `${label} regenerated`,
      `Generating ${label.toLowerCase()}…`,
    );
  const generate = (kind: 'summary' | 'flashcards' | 'quiz', label: string, hint: string) => {
    const request = latestRequest(state, section.folderId, kind, section.id);
    const failed = request?.status === 'failed';
    const pending = request?.status === 'pending';
    return (
      <Empty
        icon={<Sparkles size={28} />}
        title={`No ${label.toLowerCase()} yet`}
        action={
          <>
            {(pending || failed) && (
              <RequestStatus request={request!} run={run} busy={busy} />
            )}
            {failed && (
              <button className="button primary" onClick={runRegenerate(kind, label)}>
                <RefreshCw size={14} /> Regenerate {label.toLowerCase()}
              </button>
            )}
          </>
        }
      >
        {hint} Use “Generate all study materials” to create it.
      </Empty>
    );
  };
  const regenerate = (kind: 'summary' | 'flashcards' | 'quiz', label: string) => {
    const meta = section.artifacts?.[kind];
    const stale = folder ? needsRegenerate(folder, meta) : false;
    return (
      <div className="artifact-toolbar">
        <span className="form-note">
          {stale
            ? 'Generated with different settings — regenerate to update.'
            : 'Matches your current settings.'}
        </span>
        <button
          className="button secondary"
          disabled={!!busy || !stale}
          title={
            stale
              ? `Regenerate ${label.toLowerCase()}`
              : 'Nothing changed — regeneration not needed'
          }
          onClick={runRegenerate(kind, label)}
        >
          <RefreshCw size={14} /> Regenerate {label.toLowerCase()}
        </button>
      </div>
    );
  };
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'cards', label: 'Flashcards', count: content?.cards.length },
    { id: 'quiz', label: 'Quiz', count: content?.quiz.length },
    { id: 'source', label: 'Source' },
  ];

  return (
    <div className="reader">
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} /> All chapters
      </button>
      <div className="source-caption">
        <SourceIcon kind={source.kind} />
        <span>{source.name}</span>
        {section.pageStart && (
          <span className="badge">
            pp. {section.pageStart}–{section.pageEnd}
          </span>
        )}
      </div>
      <div className="reader-title">
        <span className="eyebrow">Section {sectionNumber(state, section)}</span>
        <h1>{section.title}</h1>
        <button
          disabled={!!busy}
          className={`button ${section.read ? 'soft' : 'secondary'}`}
          onClick={() =>
            void run(
              () => api(`/sections/${section.id}`, send({ read: !section.read }, 'PATCH')),
              section.read
                ? 'Reading marker cleared'
                : 'Reading saved; preparation depends on practice',
            )
          }
        >
          <Check size={16} />
          {section.read ? 'Read' : 'Mark as read'}
        </button>
      </div>
      <div className="reader-meta">
        <span className={`badge ${preparation.complete ? 'success' : ''}`}>
          {preparation.complete ? 'Practice passed' : 'Practice pending'}
        </span>
        <span className={`dot ${content ? 'green' : ''}`} />
        {content ? content.model : 'Source reading · study materials not generated yet'}
        {content && <span>Updated {displayDate(content.generatedAt)}</span>}
      </div>
      {missingKinds.length > 0 && (
        <div className="generate-all">
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() =>
              void run(
                async () => {
                  for (const kind of missingKinds) {
                    const request = await api<GenerationRequest>(
                      `/folders/${section.folderId}/requests`,
                      send({ kind, targetId: section.id }),
                    );
                    await api(`/requests/${request.id}/run`, send({}));
                  }
                },
                'Study materials generated',
                'Generating study materials…',
              )
            }
          >
            <Sparkles size={15} /> Generate all study materials
          </button>
          <span className="form-note">Runs summary first, then flashcards, then quiz.</span>
        </div>
      )}
      {(section.objective || section.keyTopics?.length) && (
        <div className="key-topics">
          {section.objective && <p>{section.objective}</p>}
          {section.keyTopics?.map((topic) => (
            <span className="topic-chip" key={topic}>
              {topic}
            </span>
          ))}
        </div>
      )}
      <div className="tab-row" role="tablist" aria-label="Section views">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'summary' && hasSummary && regenerate('summary', 'Summary')}
      {tab === 'cards' && hasCards && regenerate('flashcards', 'Flashcards')}
      {tab === 'quiz' && hasQuiz && regenerate('quiz', 'Quiz')}

      {tab === 'summary' &&
        !hasSummary &&
        generate('summary', 'Summary', 'An exam-focused study sheet: core concepts, must-remember facts, comparisons, traps.')}
      {tab === 'cards' &&
        !hasCards &&
        generate('flashcards', 'Flashcards', 'Short single-fact cards grouped by concept, covering every key topic.')}
      {tab === 'quiz' &&
        !hasQuiz &&
        generate('quiz', 'Quiz', 'Exam-style multiple-choice questions, mostly scenarios, with explained distractors.')}

      {tab === 'summary' && content && hasSummary && (
        <div className="summary-layout">
          <article className="markdown">
            <Markdown>
              {section.summaryData
                ? renderSummary(section.summaryData, { mustRemember: false })
                : content.summary}
            </Markdown>
            <div className="reader-footer">
              <button className="button primary" onClick={() => setTab('cards')}>
                <Layers size={16} /> Practice flashcards <ArrowRight size={16} />
              </button>
            </div>
            {content.evidence && (
              <div className="evidence-list">
                <h3>Sources and related reading</h3>
                {content.evidence.map((item, index) => {
                  const reference = state.sources.find((entry) => entry.id === item.sourceId);
                  return (
                    reference && (
                      <div key={index}>
                        <a
                          href={`/api/sources/${reference.id}/file#page=${item.pageStart ?? 1}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {reference.name}
                          {item.pageStart ? ` · pp. ${item.pageStart}-${item.pageEnd}` : ''}{' '}
                          <ExternalLink size={12} />
                        </a>
                        <p>{item.note}</p>
                      </div>
                    )
                  );
                })}
              </div>
            )}
          </article>
          <aside className="key-points">
            <span className="eyebrow">Must Remember</span>
            {content.keyPoints.map((point, index) => (
              <div key={index}>
                <span className="point-number">{String(index + 1).padStart(2, '0')}</span>
                <p>{point}</p>
              </div>
            ))}
          </aside>
        </div>
      )}

      {tab === 'cards' && content && hasCards && (
        <div className="practice">
          <div className="practice-top">
            <span className="eyebrow">Active Recall</span>
            <span>
              {reviewAll
                ? `Reviewing ${cards.length} cards`
                : `${dueCards.length} due / ${content.cards.length} cards`}
            </span>
            {reviewAll && (
              <button
                className="text-button"
                onClick={() => {
                  setReviewAll(false);
                  setReviewIndex(0);
                }}
              >
                <RotateCcw size={14} /> Back to due cards
              </button>
            )}
          </div>
          {card ? (
            <>
              <button
                className={`flashcard ${revealed ? 'revealed' : ''}`}
                onClick={() => setRevealed(!revealed)}
                aria-label={revealed ? 'Hide answer' : 'Reveal answer'}
              >
                <span className="eyebrow">{revealed ? 'Answer' : (card.group ?? 'Question')}</span>
                <span className="flashcard-text">{revealed ? card.answer : card.question}</span>
                <span className="flashcard-hint">
                  {revealed ? 'How well did you remember?' : 'Reveal answer'}
                  <RotateCcw size={15} />
                </span>
              </button>
              <div className="grade-row">
                {[
                  { label: 'Again', rating: 1 },
                  { label: 'Hard', rating: 2 },
                  { label: 'Good', rating: 3 },
                  { label: 'Easy', rating: 4 },
                ].map((grade) => (
                  <button
                    key={grade.rating}
                    className={`button grade grade-${grade.rating}`}
                    disabled={!revealed || !!busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/sections/${section.id}/cards/${card.id}/review`,
                          send({ rating: grade.rating }),
                        );
                        setRevealed(false);
                        if (reviewAll)
                          setReviewIndex((index) => (index + 1) % content.cards.length);
                      }, 'Review saved')
                    }
                  >
                    {grade.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Empty
              icon={<CheckCircle2 size={32} />}
              title="You're all caught up"
              action={
                <>
                  <button
                    className="button primary"
                    onClick={() => {
                      setReviewAll(true);
                      setReviewIndex(0);
                    }}
                  >
                    <RotateCcw size={16} /> Review all cards
                  </button>
                  <button className="button secondary" onClick={() => setTab('quiz')}>
                    <Target size={16} /> Take the quiz
                  </button>
                </>
              }
            >
              Your cards will return when they are due.
            </Empty>
          )}
          <details className="all-cards">
            <summary>All cards · {content.cards.length}</summary>
            {Object.entries(groups).map(([group, items]) => (
              <div className="card-group" key={group}>
                <h3>{group}</h3>
                {items.map((item) => (
                  <div className="card-reference" key={item.id}>
                    <strong>{item.question}</strong>
                    <p>{item.answer}</p>
                    <span className="muted">
                      {item.schedule.reps
                        ? `Reviewed ${item.schedule.reps} times · due ${displayDate(item.schedule.due)}`
                        : 'Not reviewed yet'}
                      {item.origin === 'background' ? ' · tutor knowledge' : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </details>
        </div>
      )}

      {tab === 'quiz' && content && hasQuiz && (
        <div className="quiz-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Knowledge Check</span>
              <h2>{content.quiz.length} questions. Make it count.</h2>
            </div>
            {attempts.length > 0 && (
              <span className="badge">
                Best{' '}
                {Math.max(
                  ...attempts.map((attempt) => Math.round((attempt.correct / attempt.total) * 100)),
                )}
                %
              </span>
            )}
          </div>
          {result && (
            <div className="quiz-result" role="status">
              <Target size={26} />
              <div>
                <h2>
                  {result.correct} / {result.total} correct
                </h2>
                <p>
                  {result.correct === result.total
                    ? 'Every answer correct. Time for the next section.'
                    : 'Review the explanations below, then try again.'}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setQuizIndex(0);
                }}
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          )}
          {result ? (
            content.quiz.map((question, index) => (
              <fieldset className="quiz-question" key={index} disabled>
                <legend>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {question.question}
                </legend>
                <div className="quiz-options">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`quiz-option ${answers[index] === optionIndex ? 'selected' : ''} ${optionIndex === question.correctIndex ? 'correct' : ''} ${answers[index] === optionIndex && optionIndex !== question.correctIndex ? 'incorrect' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={optionIndex}
                        checked={answers[index] === optionIndex}
                        onChange={() => setAnswers({ ...answers, [index]: optionIndex })}
                      />
                      <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                      {optionIndex === question.correctIndex && <Check size={16} />}
                    </label>
                  ))}
                </div>
                <p className="explanation">{question.explanation}</p>
              </fieldset>
            ))
          ) : (
            <div className="quiz-card">
              <div className="quiz-progress">
                <span className="eyebrow">
                  Question {quizIndex + 1} of {content.quiz.length}
                </span>
                <span className="muted">
                  {Object.keys(answers).length} of {content.quiz.length} answered
                </span>
              </div>
              <div className="quiz-dots">
                {content.quiz.map((question, index) => (
                  <button
                    key={question.question}
                    className={`quiz-dot ${answers[index] !== undefined ? 'answered' : ''} ${index === quizIndex ? 'current' : ''}`}
                    onClick={() => setQuizIndex(index)}
                    aria-label={`Go to question ${index + 1}`}
                  >
                    {String(index + 1)}
                  </button>
                ))}
              </div>
              <fieldset className="quiz-question" disabled={!!busy}>
                <legend>
                  <span>{String(quizIndex + 1).padStart(2, '0')}</span>
                  {content.quiz[quizIndex].question}
                </legend>
                <div className="quiz-options">
                  {content.quiz[quizIndex].options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`quiz-option ${answers[quizIndex] === optionIndex ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${quizIndex}`}
                        value={optionIndex}
                        checked={answers[quizIndex] === optionIndex}
                        onChange={() => setAnswers({ ...answers, [quizIndex]: optionIndex })}
                      />
                      <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="quiz-nav">
                <button
                  className="button secondary"
                  disabled={quizIndex === 0}
                  onClick={() => setQuizIndex(quizIndex - 1)}
                >
                  <ArrowLeft size={15} /> Previous
                </button>
                {quizIndex < content.quiz.length - 1 ? (
                  <button
                    className="button secondary"
                    onClick={() => setQuizIndex(quizIndex + 1)}
                  >
                    Next <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={!!busy || Object.keys(answers).length !== content.quiz.length}
                    onClick={() =>
                      void run(
                        async () =>
                          setResult(
                            await api<QuizAttempt>(
                              `/sections/${section.id}/quiz`,
                              send({ answers: content.quiz.map((_, index) => answers[index]) }),
                            ),
                          ),
                        'Quiz saved',
                      )
                    }
                  >
                    <Check size={16} /> Submit quiz
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'source' && (
        <div className="source-view">
          <div className="section-heading">
            <span className="eyebrow">
              {source.kind === 'topic' ? 'Provenance' : 'Original Source'}
            </span>
            {source.file && (
              <a
                className="button secondary"
                href={`/api/sources/${source.id}/file${source.kind === 'pdf' ? `#page=${section.pageStart ?? 1}` : ''}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> Open original
              </a>
            )}
          </div>
          {source.kind === 'pdf' && (
            <iframe
              title="Original PDF"
              src={`/api/sources/${source.id}/file#page=${section.pageStart ?? 1}`}
            />
          )}
          <details open={source.kind !== 'pdf'}>
            <summary>
              <BookOpen size={16} /> Extracted section text
            </summary>
            <pre>{section.text}</pre>
          </details>
        </div>
      )}
      {(onPrev || onNext) && (
        <div className="section-nav">
          {onPrev && (
            <button className="prev-section text-button" onClick={onPrev}>
              <ArrowLeft size={16} /> Previous section
            </button>
          )}
          {onNext && (
            <button className="next-section text-button" onClick={onNext}>
              Next section <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
