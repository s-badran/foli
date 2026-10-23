import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Folder,
  FolderOpen,
  LayoutDashboard,
  Layers2,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  emptyState,
  type Folder as StudyFolder,
  type ProviderConfig,
  type StudyState,
} from '../shared/models';
import { api, defaultConfig, loadState, send } from './api';
import { Modal, ProgressBar, SourceIcon, useNow } from './components';
import { Dashboard, type View } from './Dashboard';
import { StudyView, type RunTask } from './StudyView';

type Dialog = 'create' | 'import' | 'upload' | 'settings' | 'plan' | 'topic' | 'delete' | null;
interface LocalFolder {
  name: string;
  files: string[];
}

export function App() {
  const now = useNow();
  const [state, setState] = useState<StudyState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [view, setView] = useState<View>('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [localFolders, setLocalFolders] = useState<LocalFolder[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [mobile, setMobile] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>(defaultConfig);
  const [apiKey, setApiKey] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const folder = state.folders.find((item) => item.id === folderId) ?? state.folders[0];
  const sections = state.sections.filter((section) => section.folderId === folder?.id);
  const section = sections.find((item) => item.id === sectionId);

  useEffect(() => {
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
          setError(cause instanceof Error ? cause.message : 'Cannot connect to the API.');
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const run: RunTask = async (action, success) => {
    setBusy(
      success?.startsWith('Imported')
        ? 'Importing documents…'
        : success?.startsWith('Generated')
          ? 'Generating study pack…'
          : 'Saving…',
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
    setView(next);
    setSectionId('');
    setMobile(false);
    setSearch('');
  }
  function openSection(id: string) {
    setSectionId(id);
    setMobile(false);
  }
  function selectFolder(id: string) {
    setFolderId(id);
    setSectionId('');
    setSearch('');
    setMobile(false);
  }
  function generate() {
    if (!section) return;
    void run(
      () => api(`/sections/${section.id}/generate`, send(config, 'POST', apiKey)),
      'Generated study pack',
    );
  }
  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'sources' as const, label: 'Sources', icon: BookOpen },
    { id: 'plan' as const, label: 'Study plan', icon: CalendarDays },
    { id: 'progress' as const, label: 'Progress', icon: TrendingUp },
  ];
  const completed = sections.filter((item) => item.read).length;

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
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
        >
          <span className="brand-mark">
            <Layers2 size={24} strokeWidth={2} />
          </span>
          folio<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">
          <div className="workspace-avatar">S</div>
          <div>
            <strong>Study workspace</strong>
            <span>Personal · local</span>
          </div>
          <span className="local-indicator" title="Local workspace" />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id && !section ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === 'sources' && (
                <span>
                  {state.sources.filter((source) => source.folderId === folder?.id).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-heading">
          <span>My Subjects</span>
          <button
            className="icon-button"
            title="Create study folder"
            aria-label="Create study folder"
            onClick={() => setDialog('create')}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="folder-list">
          {state.folders.map((item) => (
            <div key={item.id}>
              <button
                className={`folder-button ${folder?.id === item.id ? 'selected' : ''}`}
                onClick={() => selectFolder(item.id)}
              >
                {folder?.id === item.id ? <FolderOpen size={17} /> : <Folder size={17} />}
                <span>{item.name}</span>
                {folder?.id === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {folder?.id === item.id &&
                state.sources
                  .filter((source) => source.folderId === item.id)
                  .map((source) => (
                    <button
                      className="sidebar-source"
                      key={source.id}
                      title={source.name}
                      onClick={() => {
                        const first = sections.find((entry) => entry.sourceId === source.id);
                        if (first) openSection(first.id);
                      }}
                    >
                      <SourceIcon kind={source.kind} size={14} />
                      <span>{source.name}</span>
                    </button>
                  ))}
            </div>
          ))}
          <button className="sidebar-import" onClick={() => setDialog('import')}>
            <Plus size={15} /> Import workspace folder
          </button>
        </div>
        {folder && (
          <div className="sidebar-progress">
            <div>
              <span>Subject progress</span>
              <strong>
                {sections.length ? Math.round((completed / sections.length) * 100) : 0}%
              </strong>
            </div>
            <ProgressBar
              value={sections.length ? (completed / sections.length) * 100 : 0}
              label="Subject progress"
            />
            <span>
              {completed} of {sections.length} sections completed
            </span>
          </div>
        )}
        <div className="sidebar-bottom">
          <button onClick={() => setDialog('settings')}>
            <Settings2 size={17} /> AI settings
            <span
              className={`provider-indicator ${config.provider !== 'offline' ? 'connected' : ''}`}
            />
          </button>
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
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{folder?.name ?? 'Getting started'}</strong>
            {section && (
              <>
                <ChevronRight size={13} />
                <span className="crumb-section">Section</span>
              </>
            )}
          </div>
          <div className="topbar-tools">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search sections"
                placeholder="Search sections…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSectionId('');
                  setView('sources');
                }}
              />
            </label>
            <button
              className="icon-button"
              title="AI settings"
              aria-label="AI settings"
              onClick={() => setDialog('settings')}
            >
              <Settings2 size={18} />
            </button>
          </div>
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
            <span>{busy}</span>
            <span className="muted">Keep this tab open</span>
          </div>
        )}
        {!loaded ? (
          <div className="loading">
            <LoaderCircle size={24} />
            <span>Opening your workspace…</span>
          </div>
        ) : section ? (
          <StudyView
            key={section.id}
            section={section}
            source={state.sources.find((source) => source.id === section.sourceId)!}
            state={state}
            busy={busy}
            run={run}
            generate={generate}
            onBack={() => {
              setSectionId('');
              setView('sources');
            }}
            onNext={
              sections.indexOf(section) < sections.length - 1
                ? () => openSection(sections[sections.indexOf(section) + 1].id)
                : undefined
            }
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
            onTopic={() => setDialog('topic')}
            onPlan={() => setDialog('plan')}
            onImport={() => setDialog('import')}
            onCreate={() => setDialog('create')}
          />
        )}
        <footer className="app-footer">
          <span>
            <Layers2 size={13} /> Built for a deeper understanding.
          </span>
          <span>
            {config.provider === 'offline'
              ? 'Extractive mode · no AI connected'
              : `${config.provider === 'copilot' ? 'GitHub Copilot' : 'BYOK'} · ${config.model}`}
          </span>
          {folder && (
            <button
              className="text-button"
              onClick={() => setDialog('delete')}
              title="Delete current folder"
            >
              <Trash2 size={13} /> Delete subject
            </button>
          )}
        </footer>
      </main>

      {dialog === 'create' && (
        <Modal title="New study folder" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get('name');
              void run(async () => {
                const created = await api<StudyFolder>('/folders', send({ name }));
                setFolderId(created.id);
                setSectionId('');
                setDialog(null);
              }, 'Folder created');
            }}
          >
            <label>
              Subject name
              <input
                name="name"
                placeholder="e.g. AWS Solutions Architect"
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={!!busy}>
                <Plus size={16} /> Create folder
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'import' && (
        <Modal title="Import workspace folder" onClose={() => setDialog(null)}>
          <div className="import-options">
            {localFolders
              .filter((item) => !state.folders.some((existing) => existing.name === item.name))
              .map((item) => (
                <button
                  className="import-option"
                  disabled={!!busy}
                  key={item.name}
                  onClick={() =>
                    void run(async () => {
                      const result = await api<{ folder: StudyFolder }>(
                        '/import-workspace',
                        send({ name: item.name }),
                      );
                      selectFolder(result.folder.id);
                      setDialog(null);
                    }, 'Imported workspace sources')
                  }
                >
                  <FolderOpen size={24} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.files.length} documents ·{' '}
                      {item.files.map((file) => file.split('.').at(-1)?.toUpperCase()).join(', ')}
                    </span>
                  </div>
                  <ArrowRight size={18} />
                </button>
              ))}
            {localFolders.every((item) =>
              state.folders.some((existing) => existing.name === item.name),
            ) && (
              <p className="muted">
                No new source folders found. Create a subject and upload PDF, MD, or TXT files.
              </p>
            )}
          </div>
        </Modal>
      )}
      {dialog === 'upload' && (
        <Modal title="Add study materials" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!folder || !uploadInput.current?.files?.length) return;
              const form = new FormData();
              for (const file of uploadInput.current.files) form.append('files', file);
              void run(async () => {
                await api(`/folders/${folder.id}/upload`, { method: 'POST', body: form });
                setDialog(null);
              }, 'Imported study materials');
            }}
          >
            <label className="upload-zone">
              <Upload size={28} />
              <strong>Choose your study materials</strong>
              <span>PDF, Markdown or TXT · up to 60 MB each · 12 files</span>
              <input
                ref={uploadInput}
                type="file"
                name="files"
                multiple
                accept=".pdf,.md,.txt"
                required
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={!!busy || !folder}>
                <Upload size={16} /> Import sources
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'plan' && (
        <Modal title="Your study plan" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!folder) return;
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
              Exam or target date
              <input
                type="date"
                name="examDate"
                required
                defaultValue={
                  folder?.plan?.examDate ?? new Date(now + 30 * 86400000).toISOString().slice(0, 10)
                }
                min={new Date(now + 86400000).toISOString().slice(0, 10)}
                max={new Date(now + 730 * 86400000).toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Daily study time (minutes)
              <input
                name="dailyMinutes"
                type="number"
                min={20}
                max={480}
                step={5}
                defaultValue={folder?.plan?.dailyMinutes ?? 45}
                required
              />
            </label>
            <p className="form-note">
              Unread sections are scheduled before your exam, with time reserved for daily review.
              Rebuild the plan after adding new sources.
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
      {dialog === 'topic' && (
        <Modal title="Study a topic with AI" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!folder) return;
              const topic = new FormData(event.currentTarget).get('topic');
              void run(async () => {
                const created = await api<{ id: string }>(
                  `/folders/${folder.id}/topic`,
                  send({ ...config, topic }, 'POST', apiKey),
                );
                setSectionId(created.id);
                setDialog(null);
              }, 'Generated topic study pack');
            }}
          >
            <label>
              What would you like to learn?
              <input
                name="topic"
                placeholder="e.g. AWS VPC routing and private subnets"
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <p className="form-note">
              Generated from model knowledge, not uploaded evidence. Verify important facts against
              current official sources.
            </p>
            {config.provider === 'offline' && (
              <div className="warning">Connect a model in AI settings to generate a topic.</div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog('settings')}
              >
                <Settings2 size={16} /> AI settings
              </button>
              <button className="button primary" disabled={!!busy || config.provider === 'offline'}>
                <Sparkles size={16} /> Generate topic
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'settings' && (
        <Modal title="AI & generation" onClose={() => setDialog(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setDialog(null);
              setNotice('AI settings applied for this session');
            }}
          >
            <label>
              Generation provider
              <select
                value={config.provider}
                onChange={(event) => {
                  const provider = event.target.value as ProviderConfig['provider'];
                  setConfig({
                    ...config,
                    provider,
                    model: provider === 'copilot' ? 'gpt-4.1' : 'gpt-4o-mini',
                  });
                }}
              >
                <option value="offline">Offline · source extracts (not AI)</option>
                <option value="openai">BYOK · OpenAI-compatible API</option>
                <option value="copilot">GitHub Copilot · local SDK</option>
              </select>
            </label>
            {config.provider === 'openai' && (
              <>
                <label>
                  API base URL
                  <input
                    type="url"
                    value={config.baseUrl}
                    onChange={(event) => setConfig({ ...config, baseUrl: event.target.value })}
                    required
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Only held in memory for this session"
                  />
                </label>
                <p className="form-note">
                  Selected source text is sent to this provider. Local compatible servers may leave
                  the key empty. Keys are never saved.
                </p>
              </>
            )}
            {config.provider !== 'offline' && (
              <label>
                Model ID
                <input
                  value={config.model}
                  onChange={(event) => setConfig({ ...config, model: event.target.value })}
                  required
                  maxLength={120}
                />
              </label>
            )}
            {config.provider === 'copilot' && (
              <p className="form-note">
                Uses the official SDK with workspace-local authentication in data/copilot. Login is
                a separate terminal step documented in the README. Subscription access and quota
                apply. No tools or file access are enabled.
              </p>
            )}
            {config.provider === 'offline' ? (
              <p className="form-note">
                Extracts key statements and fill-in-the-blank practice from your sources. No model
                calls, no API key, no extra model knowledge.
              </p>
            ) : (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.supplement}
                  onChange={(event) => setConfig({ ...config, supplement: event.target.checked })}
                />
                <span>Add model-knowledge supplements, separately labelled</span>
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setApiKey('');
                  setConfig(defaultConfig);
                  setDialog(null);
                }}
              >
                Reset to offline
              </button>
              <button className="button primary">
                <Check size={16} /> Apply settings
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'delete' && (
        <Modal title="Delete study folder?" onClose={() => setDialog(null)}>
          <p className="form-note">
            Delete “{folder?.name}” and all its study progress? Original workspace documents are not
            changed. Export your study data first.
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
                  await api(`/folders/${folder?.id}`, { method: 'DELETE' });
                  setDialog(null);
                  setSectionId('');
                  setFolderId('');
                }, 'Study folder deleted')
              }
            >
              <Trash2 size={16} /> Delete folder
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
