import { useEffect, useState } from 'react';
import { CircleAlert, Clock3, FileText, RefreshCw, Sparkles, X } from 'lucide-react';
import type { ArtifactKind } from '../shared/artifacts';
import type { Folder, GenerationRequest, StudyState } from '../shared/models';
import { api, displayDate, send } from './api';
import type { RunTask } from './StudyView';

export interface ModelSummary {
  id: string;
  label: string;
  configured: boolean;
  default: boolean;
}

export function ModelPicker({
  folder,
  busy,
  onSave,
}: {
  folder: Folder;
  busy: string;
  onSave: (modelId: string) => void;
}) {
  const [models, setModels] = useState<ModelSummary[]>([]);
  useEffect(() => {
    let active = true;
    void api<{ models: ModelSummary[] }>('/models').then((data) => {
      if (active) setModels(data.models);
    });
    return () => {
      active = false;
    };
  }, []);
  const defaultLabel = models.find((model) => model.default)?.label ?? 'DeepSeek Chat';
  return (
    <label>
      AI model
      <select value={folder.modelId ?? ''} disabled={!!busy} onChange={(event) => onSave(event.target.value)}>
        <option value="">Default ({defaultLabel})</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
            {model.configured ? '' : ' (no key)'}
          </option>
        ))}
      </select>
      <span className="form-note">
        Used for new and regenerated materials. Changing it (or the baseline/sources) enables
        Regenerate on existing content.
      </span>
    </label>
  );
}

export function latestRequest(
  state: StudyState,
  folderId: string,
  kind: ArtifactKind,
  targetId?: string,
) {
  return state.requests
    .filter(
      (request) =>
        request.folderId === folderId &&
        request.kind === kind &&
        request.targetId === targetId &&
        request.status !== 'superseded',
    )
    .at(-1);
}

export function RequestStatus({
  request,
  run,
  busy,
}: {
  request: GenerationRequest;
  run: RunTask;
  busy: string;
}) {
  if (request.status === 'done') return null;
  return (
    <div className={`request-status ${request.status}`} role="status">
      {request.status === 'failed' ? <CircleAlert size={16} /> : <Clock3 size={16} />}
      <div>
        <strong>
          {request.status === 'failed'
            ? 'The tutor response did not pass validation'
            : 'Requested · waiting for the tutor'}
        </strong>
        <span>
          {request.kind} prompt v{request.promptVersion} · {displayDate(request.createdAt)}
        </span>
        {request.problems?.length ? (
          <ul>
            {request.problems.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <a
        className="text-button"
        href={`/api/requests/${request.id}/prompt`}
        target="_blank"
        rel="noreferrer"
      >
        <FileText size={13} /> Prompt
      </a>
      <button
        className="text-button"
        disabled={!!busy}
        onClick={() =>
          void run(
            () => api(`/requests/${request.id}/ingest`, send({})),
            'Checked for a tutor response',
          )
        }
      >
        <RefreshCw size={13} /> Check
      </button>
      <button
        className="icon-button"
        title="Cancel request"
        aria-label="Cancel request"
        disabled={!!busy}
        onClick={() =>
          void run(() => api(`/requests/${request.id}`, { method: 'DELETE' }), 'Request cancelled')
        }
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function GenerateAction({
  state,
  folderId,
  kind,
  targetId,
  label,
  run,
  busy,
  secondary,
}: {
  state: StudyState;
  folderId: string;
  kind: ArtifactKind;
  targetId?: string;
  label: string;
  run: RunTask;
  busy: string;
  secondary?: boolean;
}) {
  const request = latestRequest(state, folderId, kind, targetId);
  if (request && request.status !== 'done') {
    return (
      <div className="generate-action">
        <RequestStatus request={request} run={run} busy={busy} />
        {request.status === 'failed' && (
          <button
            className="button secondary"
            disabled={!!busy}
            onClick={() =>
              void run(
                async () => {
                  const queued = await api<GenerationRequest>(
                    `/folders/${folderId}/requests`,
                    send({ kind, targetId }),
                  );
                  await api(`/requests/${queued.id}/run`, send({}));
                },
                `${label} requested again`,
                `Generating ${label.toLowerCase()}…`,
              )
            }
          >
            <Sparkles size={15} /> Request again
          </button>
        )}
      </div>
    );
  }
  return (
    <button
      className={`button ${secondary ? 'secondary' : 'primary'}`}
      disabled={!!busy}
      onClick={() =>
        void run(
          async () => {
            const request = await api<GenerationRequest>(
              `/folders/${folderId}/requests`,
              send({ kind, targetId }),
            );
            await api(`/requests/${request.id}/run`, send({}));
          },
          `${label} requested`,
          `Generating ${label.toLowerCase()}…`,
        )
      }
    >
      <Sparkles size={15} /> {label}
    </button>
  );
}

export function PromptLibrary({
  state,
  folderId,
  run,
  busy,
}: {
  state: StudyState;
  folderId: string;
  run: RunTask;
  busy: string;
}) {
  const [prompts, setPrompts] = useState<{ id: string; version: number; file: string }[]>([]);
  useEffect(() => {
    let active = true;
    void api<{ id: string; version: number; file: string }[]>('/prompts').then((data) => {
      if (active) setPrompts(data);
    });
    return () => {
      active = false;
    };
  }, []);
  const open = state.requests.filter(
    (request) => request.folderId === folderId && request.status === 'pending',
  );
  return (
    <div className="prompt-library">
      <h2>Prompts</h2>
      <p className="form-note">
        Versioned, exam-neutral prompt files in the repository. Your exam brief above is injected
        into every request.
      </p>
      <ul>
        {prompts.map((prompt) => (
          <li key={prompt.id}>
            <code>{prompt.file}</code> <span className="badge">v{prompt.version}</span>
          </li>
        ))}
      </ul>
      <h2>Generation queue</h2>
      {open.length ? (
        open.map((request) => (
          <RequestStatus key={request.id} request={request} run={run} busy={busy} />
        ))
      ) : (
        <p className="form-note">No open requests.</p>
      )}
    </div>
  );
}
