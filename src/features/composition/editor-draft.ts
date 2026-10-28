import type { MidiNoteDto } from "@/lib/api/composition";

export type DraftContent = { startTick: number; durationTick: number; midiNotes: MidiNoteDto[] };
export type DraftContext = { userId: number; projectId: number; trackId: number; targetClipId: number | null };
export type DraftSaveRequest = {
  expectedRevision: number; mutationId: string; targetClipId: number | null;
  content: DraftContent; baseClip: DraftContent | null;
};
export type ServerDraft = {
  draftId: string; ownerId: number; projectId: number; trackId: number; targetClipId: number | null;
  content: DraftContent; baseClip: DraftContent | null; revision: number; mutationId: string;
  updatedAt: string; status: "ACTIVE" | "COMMITTED" | "DISCARDED"; committedClipId: number | null;
};
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type LocalDraft = DraftContext & {
  schemaVersion: 1; draftId: string; content: DraftContent; baseClip: DraftContent | null;
  serverRevision: number; dirty: boolean; pending: DraftSaveRequest | null; writerId: string; updatedAt: string;
};
export type DraftStatus = "idle" | "dirty" | "saving" | "saved" | "local" | "error" | "conflict";
export type DraftState = {
  content: DraftContent; status: DraftStatus; localProtected: boolean; error: string | null;
  serverRevision: number; draftId: string; hasUnsavedChanges: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function draftStorageKey(context: DraftContext) {
  return `glitched.editor-draft.v1:${context.userId}:${context.projectId}:${context.trackId}:${context.targetClipId ?? "new"}`;
}

function validContent(value: unknown): value is DraftContent {
  if (!value || typeof value !== "object") return false;
  const c = value as DraftContent;
  return Number.isSafeInteger(c.startTick) && c.startTick >= 0
    && Number.isSafeInteger(c.durationTick) && c.durationTick > 0
    && Array.isArray(c.midiNotes) && c.midiNotes.length <= 10_000
    && c.midiNotes.every(n => n && Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127
      && Number.isSafeInteger(n.startTick) && n.startTick >= 0
      && Number.isSafeInteger(n.durationTick) && n.durationTick > 0
      && n.startTick + n.durationTick <= c.durationTick
      && Number.isInteger(n.velocity) && n.velocity >= 0 && n.velocity <= 127
      && (n.effectType === null || typeof n.effectType === "string")
      && n.effectParams !== null && typeof n.effectParams === "object" && !Array.isArray(n.effectParams));
}

export function readLocalDraft(storage: DraftStorage | null, context: DraftContext): LocalDraft | null {
  try {
    const raw = storage?.getItem(draftStorageKey(context));
    if (!raw) return null;
    const value = JSON.parse(raw) as LocalDraft;
    if (value.schemaVersion !== 1 || value.userId !== context.userId || value.projectId !== context.projectId
      || value.trackId !== context.trackId || value.targetClipId !== context.targetClipId
      || !uuid.test(value.draftId) || !Number.isSafeInteger(value.serverRevision) || value.serverRevision < 0
      || typeof value.dirty !== "boolean" || !validContent(value.content)
      || (value.baseClip !== null && !validContent(value.baseClip))) return null;
    if (value.pending && (!uuid.test(value.pending.mutationId) || !validContent(value.pending.content)
      || value.pending.targetClipId !== context.targetClipId
      || !same(value.pending.baseClip, value.baseClip)
      || !Number.isSafeInteger(value.pending.expectedRevision) || value.pending.expectedRevision < 0)) return null;
    return value;
  } catch { return null; }
}

export function removeLocalDraft(storage: DraftStorage | null, context: DraftContext, draftId: string) {
  try {
    if (readLocalDraft(storage, context)?.draftId === draftId) storage?.removeItem(draftStorageKey(context));
  } catch { /* Retain a harmless recovery copy when storage is unavailable. */ }
}

type SessionOptions = {
  context: DraftContext; content: DraftContent; baseClip: DraftContent | null; storage: DraftStorage | null;
  server?: ServerDraft | null; local?: LocalDraft | null;
  save: (request: DraftSaveRequest, draftId: string) => Promise<ServerDraft>;
};

/** One serialized save queue per editor; pending mutations are persisted before sending. */
export class DraftSession {
  storage: DraftStorage | null;
  private record: LocalDraft;
  private writerId = crypto.randomUUID();
  private state: DraftState;
  private listeners = new Set<() => void>();
  private inFlight: Promise<ServerDraft | null> | null = null;
  private server: ServerDraft | null;
  private saveRequest: SessionOptions["save"];
  private disposed = false;
  private frozen = false;

  constructor(options: SessionOptions) {
    this.storage = options.storage;
    this.server = options.server ?? null;
    this.saveRequest = options.save;
    const local = options.local;
    const server = this.server;
    this.record = local ? { ...local, writerId: this.writerId } : {
      ...options.context, schemaVersion: 1, draftId: server?.draftId ?? crypto.randomUUID(),
      content: server?.content ?? options.content, baseClip: server?.baseClip ?? options.baseClip,
      serverRevision: server?.revision ?? 0, dirty: false, pending: null,
      writerId: this.writerId, updatedAt: new Date().toISOString(),
    };
    let conflict = false;
    if (local && server) {
      if (server.status !== "ACTIVE" || local.draftId !== server.draftId) conflict = true;
      else if (local.pending?.mutationId === server.mutationId) {
        this.record.serverRevision = server.revision;
        this.record.pending = null;
        this.record.dirty = !same(local.content, server.content);
      } else if (local.serverRevision !== server.revision) conflict = true;
    }
    this.state = { content: this.record.content, status: conflict ? "conflict" : this.record.dirty || this.record.pending ? "dirty"
      : this.record.serverRevision ? "saved" : "idle", localProtected: false,
      error: conflict ? "다른 탭이나 기기에서 작업이 변경되었습니다. 복구본을 확인해 주세요." : null,
      serverRevision: this.record.serverRevision, draftId: this.record.draftId,
      hasUnsavedChanges: this.record.dirty || this.record.pending !== null };
    // Claim the local record. An unmounted editor's late response cannot overwrite this session.
    this.persist(true);
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getLocalRecord = () => structuredClone(this.record);
  getServerDraft = () => this.server;
  freeze = (value: boolean) => { this.frozen = value; };
  dispose = () => { this.disposed = true; this.listeners.clear(); };

  private emit(changes: Partial<DraftState>) {
    this.state = { ...this.state, ...changes, content: this.record.content,
      serverRevision: this.record.serverRevision, draftId: this.record.draftId,
      hasUnsavedChanges: this.record.dirty || this.record.pending !== null };
    if (!this.disposed) this.listeners.forEach(listener => listener());
  }

  private persist(claim = false) {
    let protectedLocally = false;
    try {
      if (this.storage) {
        const existing = readLocalDraft(this.storage, this.record);
        if (!claim && existing && existing.writerId !== this.writerId) {
          this.suspend("다른 탭에서 작업을 열었습니다. 복구본을 확인해 주세요.");
          return false;
        }
        this.storage.setItem(draftStorageKey(this.record), JSON.stringify(this.record));
        protectedLocally = true;
      }
    } catch { /* A server save can still protect the edit if local storage fails. */ }
    this.emit({ localProtected: protectedLocally });
    return protectedLocally;
  }

  edit(content: DraftContent) {
    if (this.frozen || this.disposed || same(content, this.record.content)) return;
    this.record = { ...this.record, content: structuredClone(content), dirty: true, updatedAt: new Date().toISOString() };
    this.persist();
    this.emit({ status: this.state.status === "conflict" ? "conflict" : "dirty", error: this.state.status === "conflict" ? this.state.error : null });
  }

  suspend(message: string) { this.emit({ status: "conflict", error: message }); }

  flush(): Promise<ServerDraft | null> {
    if (this.state.status === "conflict") return Promise.reject(new Error(this.state.error ?? "작업 충돌"));
    if (this.inFlight) return this.inFlight;
    const run = async () => {
      while (this.record.dirty || this.record.pending) {
        if (this.state.status === "conflict") throw new Error(this.state.error ?? "작업 충돌");
        const request = this.record.pending ?? {
          expectedRevision: this.record.serverRevision, mutationId: crypto.randomUUID(),
          targetClipId: this.record.targetClipId, baseClip: this.record.baseClip,
          content: structuredClone(this.record.content),
        };
        this.record.pending = request;
        this.persist();
        if (this.state.status === "conflict") throw new Error(this.state.error ?? "작업 충돌");
        this.emit({ status: "saving", error: null });
        try {
          const result = await this.saveRequest(request, this.record.draftId);
          this.server = result;
          this.record = { ...this.record, serverRevision: result.revision, pending: null,
            dirty: !same(this.record.content, request.content) };
          this.persist();
          if (this.state.status === "conflict") throw new Error(this.state.error ?? "작업 충돌");
        } catch (error) {
          const conflict = this.state.status === "conflict" || (error as { status?: number }).status === 409;
          this.emit({ status: conflict ? "conflict" : this.state.localProtected ? "local" : "error",
            error: error instanceof Error ? error.message : "임시 저장에 실패했습니다." });
          throw error;
        }
      }
      this.emit({ status: this.record.serverRevision ? "saved" : "idle", error: null });
      return this.server;
    };
    this.inFlight = run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  /** Called only after an explicit choice to replace the server draft with this recovery copy. */
  keepLocal(server: ServerDraft | null) {
    if (server && server.status !== "ACTIVE") throw new Error("이미 반영하거나 버린 작업입니다. 서버 작업을 다시 불러와 주세요.");
    this.server = server;
    this.record = { ...this.record, draftId: server?.draftId ?? crypto.randomUUID(),
      serverRevision: server?.revision ?? 0, baseClip: server?.baseClip ?? this.record.baseClip,
      pending: null, dirty: true, writerId: this.writerId };
    this.persist(true);
    this.emit({ status: "dirty", error: null });
  }
}
