import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  FolderOpen,
  Layers2,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  Search,
  Settings2,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  emptyState,
  type Folder,
  type Learner,
  type Source,
  type StudyState,
} from '../shared/models';
import { api, loadState, send } from './api';
import { Modal, ProgressBar } from './components';
import { Dashboard, type View } from './Dashboard';
import { StudyView, type RunTask } from './StudyView';
import { baselinePolicy, chapterPreparation } from '../shared/learning';

type Dialog = 'new' | 'import' | 'upload' | 'plan' | 'main' | 'accept' | 'delete' | null;
interface LocalFolder {
  name: string;
  files: string[];
}

export function LearnerFields({ learner }: { learner?: Learner }) {
  return (
    <>
      <label>
        How well do you know this content?
        <select name="familiarity" defaultValue={learner?.familiarity ?? 'new'}>
          <option value="new">Haven't learned it yet</option>
          <option value="basic">I have a basic understanding</option>
          <option value="refresh">Know it well and just want to review</option>
        </select>
      </label>
      <label>
        Which best describes you?
        <select name="role" defaultValue={learner?.role ?? 'professional'}>
          <option value="professional">Professional</option>
          <option value="student">Student</option>
          <option value="career-change">Career changer</option>
          <option value="other">Other</option>
        </select>
      </label>
      <p className="form-note">
        Role is context only; it does not estimate prior knowledge or remove exam topics.
      </p>
      <label>
        Exam preparation goal
        <textarea
          name="goal"
          rows={2}
          maxLength={500}
          defaultValue={
            learner?.goal ?? 'Understand design trade-offs and practice exam scenarios.'
          }
        />
      </label>
    </>
  );
}

export function App() {
  const [state, setState] = useState<StudyState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [hash, setHash] = useState(() => window.location.hash);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [localFolders, setLocalFolders] = useState<LocalFolder[]>([]);
  const [pendingSource, setPendingSource] = useState<Source>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [mobile, setMobile] = useState(false);
  const [focus, setFocus] = useState(() => localStorage.getItem('folio-focus') === '1');
  const fileInput = useRef<HTMLInputElement>(null);
  const route = hash.replace(/^#/, '').split('/');
  const folder =
    route[0] === 'exam' ? state.folders.find((item) => item.id === route[1]) : undefined;
  const view: View = ['sources', 'plan', 'progress', 'settings'].includes(route[2])
    ? (route[2] as View)
    : 'chapters';
  const sections = state.sections.filter(
    (section) => section.folderId === folder?.id && !section.archived,
  );
  const section =
    route[2] === 'section' ? sections.find((item) => item.id === route[3]) : undefined;
  const chapters = state.chapters.filter((chapter) => chapter.folderId === folder?.id);
  const completed = chapters.filter(
    (chapter) => chapterPreparation(chapter, sections, state).complete,
  ).length;

  useEffect(() => {
    const changed = () => {
      setHash(window.location.hash);
      setMobile(false);
    };
    window.addEventListener('hashchange', changed);
    let active = true;
    Promise.all([loadState(), api<LocalFolder[]>('/workspace-folders')])
      .then(([data, folders]) => {
        if (active) {
          setState(data);
          setLocalFolders(folders);
          setLoaded(true);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Cannot open workspace.');
          setLoaded(true);
        }
      });
    return () => {
      active = false;
      window.removeEventListener('hashchange', changed);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('focus-mode', focus);
    localStorage.setItem('folio-focus', focus ? '1' : '0');
  }, [focus]);

  const run: RunTask = async (action, success, busyLabel) => {
    if (busy) return;
    setBusy(
      busyLabel ??
        (success?.startsWith('Imported')
          ? 'Importing and checking sources...'
          : 'Saving exam workspace...'),
    );
    setError('');
    setNotice('');
    try {
      await action();
      setState(await loadState());
      if (success) setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };
  function navigate(next: View) {
    if (folder) window.location.assign(`#exam/${folder.id}/${next}`);
  }
  function openExam(id: string) {
    window.location.assign(`#exam/${id}/chapters`);
  }
  function openSection(id: string) {
    if (folder) window.location.assign(`#exam/${folder.id}/section/${id}`);
  }
  function learnerFrom(form: FormData): Learner {
    return {
      familiarity: form.get('familiarity') as Learner['familiarity'],
      role: form.get('role') as Learner['role'],
      goal: String(form.get('goal') ?? ''),
    };
  }
  const nav = [
    { id: 'chapters' as const, label: 'Chapters', icon: BookOpen },
    { id: 'sources' as const, label: 'Sources', icon: FolderOpen },
    { id: 'plan' as const, label: 'Study plan', icon: CalendarDays },
    { id: 'progress' as const, label: 'Progress', icon: TrendingUp },
    { id: 'settings' as const, label: 'Exam settings', icon: Settings2 },
  ];
  const source = state.sources.find((item) => item.id === section?.sourceId);
  const currentChapter = chapters.find((chapter) => chapter.id === section?.chapterId);

  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <a className="brand" href="#workspaces">
          <span className="brand-mark">
            <Layers2 size={24} />
          </span>
          folio<span className="brand-period">.</span>
        </a>
        <a className="workspace-label workspace-index-link" href="#workspaces">
          <div className="workspace-avatar">
            <LayoutGrid size={18} />
          </div>
          <div>
            <strong>Exam workspaces</strong>
            <span>{state.folders.length} available · local</span>
          </div>
          <ChevronRight size={15} />
        </a>
        {folder && (
          <nav className="main-nav" aria-label="Exam navigation">
            {nav.map((item) => (
              <button
                key={item.id}
                className={view === item.id && !section ? 'active' : ''}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                {item.label}
                {item.id === 'chapters' && <span>{chapters.length}</span>}
              </button>
            ))}
          </nav>
        )}
        <div className="sidebar-heading">
          <span>Exams</span>
          <button
            className="icon-button"
            title="New exam workspace"
            aria-label="New exam workspace"
            onClick={() => setDialog('new')}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="folder-list">
          {state.folders.map((item) => (
            <a
              className={`folder-button ${folder?.id === item.id ? 'selected' : ''}`}
              key={item.id}
              href={`#exam/${item.id}/chapters`}
            >
              <FolderOpen size={17} />
              <span>{item.name}</span>
              <ChevronRight size={14} />
            </a>
          ))}
          <button className="sidebar-import" onClick={() => setDialog('import')}>
            <Plus size={15} /> Import existing folder
          </button>
        </div>
        {folder && (
          <div className="sidebar-progress">
            <div>
              <span>Chapters prepared</span>
              <strong>
                {completed} / {chapters.length}
              </strong>
            </div>
            <ProgressBar
              value={chapters.length ? (completed / chapters.length) * 100 : 0}
              label="Chapter preparation"
            />
            <span>Recall + quiz evidence; reading is separate</span>
          </div>
        )}
        <div className="sidebar-bottom">
          <a href="/api/export" download>
            <ArrowDownToLine size={17} /> Export study data
          </a>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              title="Open navigation"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <a className="workspace-crumb" href="#workspaces">
              Workspaces
            </a>
            {folder && (
              <>
                <ChevronRight size={13} />
                <a href={`#exam/${folder.id}/chapters`}>
                  <strong>{folder.name}</strong>
                </a>
              </>
            )}
            {currentChapter && (
              <>
                <ChevronRight size={13} />
                <span className="crumb-section">Chapter {currentChapter.order}</span>
              </>
            )}
          </div>
          {folder && (
            <div className="topbar-tools">
              <label className="search-box">
                <Search size={16} />
                <input
                  aria-label="Search chapters and lessons"
                  placeholder="Search chapters..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    if (view !== 'chapters' || section) navigate('chapters');
                  }}
                />
              </label>
              <button
                className={`focus-toggle ${focus ? 'active' : ''}`}
                title={focus ? 'Exit focus mode' : 'Focus mode'}
                aria-label={focus ? 'Exit focus mode' : 'Enter focus mode'}
                aria-pressed={focus}
                onClick={() => setFocus(!focus)}
              >
                {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                {focus ? 'Exit focus' : 'Focus'}
              </button>
            </div>
          )}
        </header>
        {error && (
          <div className="toast error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast success" role="status">
            <Check size={18} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="busy-banner" role="status">
            <LoaderCircle size={16} />
            {busy}
            <span className="muted">Keep this tab open</span>
          </div>
        )}
        {!loaded ? (
          <div className="loading">
            <LoaderCircle size={24} />
            Opening exam workspaces...
          </div>
        ) : !folder ? (
          <div className="dashboard workspace-index">
            <div className="welcome-label">
              <LayoutGrid size={15} /> Exam preparation
            </div>
            <div className="page-title">
              <div>
                <h1>Your exam workspaces</h1>
                <p className="page-subtitle">One exam, one source library, one learning path.</p>
              </div>
              <button className="button primary" onClick={() => setDialog('new')}>
                <Plus size={16} /> New workspace
              </button>
            </div>
            <div className="workspace-grid">
              {state.folders.map((item) => {
                const groups = state.chapters.filter((chapter) => chapter.folderId === item.id);
                const lessons = state.sections.filter(
                  (entry) => entry.folderId === item.id && !entry.archived,
                );
                const prepared = groups.filter(
                  (chapter) => chapterPreparation(chapter, lessons, state).complete,
                ).length;
                return (
                  <a className="exam-tile" key={item.id} href={`#exam/${item.id}/chapters`}>
                    <div className="tile-icon">
                      <FolderOpen size={25} />
                    </div>
                    <h2>{item.name}</h2>
                    <p>
                      {state.sources.filter((entry) => entry.folderId === item.id).length} sources ·{' '}
                      {groups.length} chapters · {lessons.length} lessons
                    </p>
                    <ProgressBar
                      value={groups.length ? (prepared / groups.length) * 100 : 0}
                      label={`${item.name} preparation`}
                    />
                    <div>
                      <span>
                        {prepared} / {groups.length} chapters prepared
                      </span>
                      <ArrowRight size={17} />
                    </div>
                  </a>
                );
              })}
              <button className="exam-tile add-exam" onClick={() => setDialog('new')}>
                <Plus size={29} />
                <h2>Prepare for another exam</h2>
                <p>Create a workspace or upload its first source.</p>
              </button>
            </div>
            <button className="text-button" onClick={() => setDialog('import')}>
              <FolderOpen size={16} /> Import an existing local study folder
            </button>
          </div>
        ) : section && source ? (
          <StudyView
            key={`${section.id}-${folder.learner?.familiarity}`}
            section={section}
            source={source}
            state={state}
            busy={busy}
            run={run}
            onBack={() => navigate('chapters')}
            onPrev={
              sections.indexOf(section) > 0
                ? () => openSection(sections[sections.indexOf(section) - 1].id)
                : undefined
            }
            onNext={
              sections.indexOf(section) < sections.length - 1
                ? () => openSection(sections[sections.indexOf(section) + 1].id)
                : undefined
            }
            initialTab={baselinePolicy(folder.learner?.familiarity).initialTab}
          />
        ) : (
          <Dashboard
            state={state}
            folder={folder}
            sections={sections}
            view={view}
            search={search}
            openSection={openSection}
            onUpload={() => setDialog('upload')}
            onPlan={() => setDialog('plan')}
            busy={busy}
            run={run}
            onMain={(item) => {
              setPendingSource(item);
              setDialog('main');
            }}
            onAccept={(item) => {
              setPendingSource(item);
              setDialog('accept');
            }}
          />
        )}
        <footer className="app-footer">
          <span>
            <Layers2 size={13} /> Exam-focused learning
          </span>
          <span>Prompt-driven tutor · lazy per-section generation</span>
          {folder && (
            <button className="text-button" onClick={() => setDialog('delete')}>
              <Trash2 size={13} /> Delete workspace
            </button>
          )}
        </footer>
      </main>

      {dialog === 'new' && (
        <Modal title="New exam workspace" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const files = fileInput.current?.files;
              void run(async () => {
                let result: Folder;
                if (files?.length) {
                  for (const file of files) form.append('files', file);
                  result = (
                    await api<{ folder: Folder }>('/workspaces/upload', {
                      method: 'POST',
                      body: form,
                    })
                  ).folder;
                } else
                  result = await api<Folder>(
                    '/folders',
                    send({ name: form.get('name'), learner: learnerFrom(form) }),
                  );
                setDialog(null);
                openExam(result.id);
              }, 'Exam workspace created');
            }}
          >
            <label>
              Exam name
              <input
                name="name"
                placeholder="e.g. AWS Solutions Architect Associate"
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label>
              First study source (optional)
              <input ref={fileInput} type="file" multiple accept=".pdf,.md,.txt" />
            </label>
            <LearnerFields />
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={!!busy}>
                <Plus size={16} /> Create workspace
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'import' && (
        <Modal title="Import existing exam folder" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(async () => {
                const result = await api<{ folder: Folder }>(
                  '/import-workspace',
                  send({ name: form.get('name') }),
                );
                await api(
                  `/folders/${result.folder.id}`,
                  send({ learner: learnerFrom(form) }, 'PATCH'),
                );
                setDialog(null);
                openExam(result.folder.id);
              }, 'Imported exam sources');
            }}
          >
            <label>
              Local source folder
              <select name="name" required>
                {localFolders
                  .filter((item) => !state.folders.some((existing) => existing.name === item.name))
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.files.length} files)
                    </option>
                  ))}
              </select>
            </label>
            <LearnerFields />
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  !!busy ||
                  localFolders.every((item) =>
                    state.folders.some((existing) => existing.name === item.name),
                  )
                }
              >
                <FolderOpen size={16} /> Import exam
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'upload' && folder && (
        <Modal title="Add supplementary sources" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const files = fileInput.current?.files;
              if (!files?.length) return;
              const form = new FormData();
              for (const file of files) form.append('files', file);
              void run(async () => {
                const result = await api<{ warnings: string[] }>(`/folders/${folder.id}/upload`, {
                  method: 'POST',
                  body: form,
                });
                setDialog(null);
                navigate('sources');
                if (result.warnings.length) setError(result.warnings.join(' '));
              }, 'Imported exam sources');
            }}
          >
            <label className="upload-zone">
              <Upload size={28} />
              <strong>{folder.name}</strong>
              <span>PDF, MD or TXT · up to 60 MB each</span>
              <input ref={fileInput} type="file" multiple accept=".pdf,.md,.txt" required />
            </label>
            <p className="form-note">
              Files stay in this exam directory. Supplementary uploads are checked against its main
              source before being used.
            </p>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={!!busy}>
                <Upload size={16} /> Add sources
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'plan' && folder && (
        <Modal title="Plan your exam preparation" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(async () => {
                await api(
                  `/folders/${folder.id}/plan`,
                  send(
                    {
                      examDate: form.get('examDate'),
                      dailyMinutes: Number(form.get('dailyMinutes')),
                    },
                    'PUT',
                  ),
                );
                setDialog(null);
                navigate('plan');
              }, 'Study plan saved');
            }}
          >
            <label>
              Exam date
              <input
                name="examDate"
                type="date"
                required
                defaultValue={folder.plan?.examDate ?? ''}
              />
            </label>
            <label>
              Daily minutes
              <input
                name="dailyMinutes"
                type="number"
                min={20}
                max={480}
                defaultValue={folder.plan?.dailyMinutes ?? 45}
                required
              />
            </label>
            <p className="form-note">
              The plan follows chapter order and reserves review time. New learners get more reading
              time; refreshers get more practice time.
            </p>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={!!busy || !sections.length}>
                <CalendarDays size={16} /> Build study plan
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'main' && folder && pendingSource && (
        <Modal title="Change main source?" onClose={() => setDialog(null)}>
          <p className="form-note">
            “{pendingSource.name}” will define this exam's chapters. Current lessons, cards and
            progress will be archived, not deleted. The dated plan must be rebuilt. Tutor-authored
            AWS lessons are available only for the supplied slide deck; other sources receive an
            honest source outline, not fabricated practice.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void run(async () => {
                  await api(
                    `/folders/${folder.id}/main-source`,
                    send({ sourceId: pendingSource.id, confirmRebuild: true }, 'PUT'),
                  );
                  setDialog(null);
                  navigate('chapters');
                }, 'Main source changed; previous progress archived')
              }
            >
              Change and rebuild
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'accept' && folder && pendingSource && (
        <Modal title="Accept this supplement?" onClose={() => setDialog(null)}>
          <p className="form-note">
            The relevance check did not establish enough shared topic vocabulary for “
            {pendingSource.name}”. Accept it only after reviewing its content. Acceptance is your
            override, not evidence of factual agreement.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Keep excluded
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void run(async () => {
                  await api(
                    `/folders/${folder.id}/sources/${pendingSource.id}`,
                    send({ status: 'accepted' }, 'PATCH'),
                  );
                  setDialog(null);
                }, 'Supplement explicitly accepted')
              }
            >
              Accept after review
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'delete' && folder && (
        <Modal title="Delete exam workspace?" onClose={() => setDialog(null)}>
          <p className="form-note">
            Delete the active workspace “{folder.name}”? Its source directory and original materials
            are retained on disk for recovery. Export a backup before continuing.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={() =>
                void run(async () => {
                  await api(`/folders/${folder.id}`, { method: 'DELETE' });
                  setDialog(null);
                  window.location.hash = 'workspaces';
                }, 'Exam workspace removed from the index')
              }
            >
              <Trash2 size={16} /> Delete workspace
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
