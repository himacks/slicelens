import type { Annotation, AnnotationRect, Spec } from "./types";

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
}

export async function fetchSpec(): Promise<Spec> {
    return json<Spec>(await fetch("/api/spec"));
}

export async function fetchAnnotations(): Promise<Annotation[]> {
    const data = await json<{ annotations: Annotation[] }>(await fetch("/api/annotations"));
    return data.annotations;
}

export interface Meta {
    callback: string; // label, e.g. "pane %30", "command", "no callback"
    callbackLive: boolean;
    hasSpec: boolean;
}

export async function fetchMeta(): Promise<Meta> {
    return json<Meta>(await fetch("/api/meta"));
}

// Create one annotation: the dragged box (document coords), the captured PNG as a data
// URL (the bridge writes it to /tmp), the commentary, and a context label.
export async function createAnnotation(input: {
    rect: AnnotationRect;
    imageDataUrl: string;
    body: string;
    context?: string;
}): Promise<Annotation> {
    const data = await json<{ created: Annotation }>(
        await fetch("/api/annotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input)
        })
    );
    return data.created;
}

export async function deleteAnnotation(id: string): Promise<void> {
    await fetch(`/api/annotations/${id}`, { method: "DELETE" });
}

export interface SendResult {
    sent: number;
    delivered: boolean;
    reason?: string;
    outbox?: string;
}

// Send specific annotations (one, or a batch) back to the Claude Code pane.
export async function sendAnnotations(ids: string[]): Promise<SendResult> {
    return json<SendResult>(
        await fetch("/api/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids })
        })
    );
}

// Subscribe to the bridge's live-update signal (spec/annotations changed on disk).
export function onServerUpdate(handler: () => void): () => void {
    const hot = (import.meta as unknown as { hot?: ViteHot }).hot;
    if (!hot) return () => {};
    hot.on("slicelens:update", handler);
    return () => hot.off?.("slicelens:update", handler);
}

interface ViteHot {
    on(event: string, cb: (data: unknown) => void): void;
    off?(event: string, cb: (data: unknown) => void): void;
}
