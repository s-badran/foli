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
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import type { QuizAttempt, Section, Source, StudyState } from '../shared/models';
import { api, displayDate, send } from './api';
import { Empty, SourceIcon, useNow } from './components';
import { sectionPractice } from '../shared/learning';

export type RunTask = (action: () => Promise<unknown>, success?: string) => Promise<void>;
type Tab = 'summary' | 'cards' | 'quiz' | 'source';

export function StudyView({
  section,
  source,
  state,
  busy,
  run,
  onBack,
  onNext,
  initialTab = 'summary',
}: {
  section: Section;
  source: Source;
  state: StudyState;
  busy: string;
  run: RunTask;
  generate: () => void;
  onBack: () => void;
  onNext?: () => void;
  initialTab?: 'summary' | 'cards' | 'quiz';
}) {
  const now = useNow();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const content = section.content;
  const preparation = sectionPractice(section, state);
  const cards =
    content?.cards.filter(
      (card) => card.schedule.reps === 0 || new Date(card.schedule.due).getTime() <= now,
    ) ?? [];
  const card = cards[0];
  const attempts = state.attempts.filter((attempt) => attempt.sectionId === section.id);
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
        {content
          ? `${content.authorship === 'tutor-authored' ? 'Original tutor practice' : content.provider === 'offline' ? 'Legacy source extracts' : 'Source-grounded study material'} · ${content.model}`
          : 'Source reading · tutor practice not yet authored'}
        {content && <span>Generated {displayDate(content.generatedAt)}</span>}
      </div>
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

      {!content && tab !== 'source' ? (
        <Empty
          icon={<Sparkles size={28} />}
          title="Tutor practice is not yet authored for this source"
          action={
            <button className="button secondary" onClick={() => setTab('source')}>
              <BookOpen size={16} /> Read main source
            </button>
          }
        >
          <>AI integration is paused. We will not fill this lesson with generic cloze questions.</>
        </Empty>
      ) : null}

      {tab === 'summary' && content && (
        <div className="summary-layout">
          <article className="markdown">
            <Markdown>{content.summary}</Markdown>
            {content.supplement && (
              <aside className="knowledge-note">
                <span className="eyebrow">
                  <Sparkles size={14} />{' '}
                  {content.authorship === 'tutor-authored'
                    ? 'Tutor knowledge and provenance'
                    : 'Knowledge additions · not source evidence'}
                </span>
                <Markdown>{content.supplement}</Markdown>
              </aside>
            )}
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
            <span className="eyebrow">Key Takeaways</span>
            {content.keyPoints.map((point, index) => (
              <div key={index}>
                <span className="point-number">{String(index + 1).padStart(2, '0')}</span>
                <p>{point}</p>
              </div>
            ))}
          </aside>
        </div>
      )}

      {tab === 'cards' && content && (
        <div className="practice">
          <div className="practice-top">
            <span className="eyebrow">Active Recall</span>
            <span>
              {cards.length} due / {content.cards.length} cards
            </span>
          </div>
          {card ? (
            <>
              <button
                className={`flashcard ${revealed ? 'revealed' : ''}`}
                onClick={() => setRevealed(!revealed)}
                aria-label={revealed ? 'Hide answer' : 'Reveal answer'}
              >
                <span className="eyebrow">{revealed ? 'Answer' : 'Question'}</span>
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
                <button className="button primary" onClick={() => setTab('quiz')}>
                  <Target size={16} /> Take the quiz
                </button>
              }
            >
              Your cards will return when they are due.
            </Empty>
          )}
          <details className="all-cards">
            <summary>All cards · {content.cards.length}</summary>
            {content.cards.map((item) => (
              <div className="card-reference" key={item.id}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
                <span className="muted">
                  {item.schedule.reps
                    ? `Reviewed ${item.schedule.reps} times · due ${displayDate(item.schedule.due)}`
                    : 'Not reviewed yet'}
                </span>
              </div>
            ))}
          </details>
        </div>
      )}

      {tab === 'quiz' && content && (
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
                }}
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          )}
          {content.quiz.map((question, index) => (
            <fieldset className="quiz-question" key={index} disabled={!!result || !!busy}>
              <legend>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {question.question}
              </legend>
              <div className="quiz-options">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={optionIndex}
                    className={`quiz-option ${answers[index] === optionIndex ? 'selected' : ''} ${result && optionIndex === question.correctIndex ? 'correct' : ''} ${result && answers[index] === optionIndex && optionIndex !== question.correctIndex ? 'incorrect' : ''}`}
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
                    {result && optionIndex === question.correctIndex && <Check size={16} />}
                  </label>
                ))}
              </div>
              {result && <p className="explanation">{question.explanation}</p>}
            </fieldset>
          ))}
          {!result && (
            <div className="quiz-submit">
              <span className="muted">
                {Object.keys(answers).length} of {content.quiz.length} answered
              </span>
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
      {onNext && (
        <button className="next-section text-button" onClick={onNext}>
          Next section <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
