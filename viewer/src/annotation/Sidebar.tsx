import { useState } from "react";
import type { Annotation } from "../lib/types";
import { useReview } from "./AnnotationProvider";

export function Sidebar() {
    const { annotations, resolvedCount, meta, send, remove } = useReview();
    const [note, setNote] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const open = annotations.filter(a => a.status === "open");

    async function doSend(ids: string[]) {
        if (ids.length === 0) return;
        setBusy(true);
        try {
            const result = await send(ids);
            if (result.delivered) {
                setNote(`Sent ${result.sent} → pane`);
            } else if (result.sent > 0) {
                setNote(`Wrote ${result.outbox ?? "outbox"} (no pane: ${result.reason ?? "?"})`);
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <aside className="sidebar" data-no-capture>
            <div className="head">
                <h4>Annotations</h4>
                <div className="meta">
                    {annotations.length} active · {resolvedCount} resolved
                    <span className={`pane-badge ${meta?.callbackLive ? "live" : "dead"}`} style={{ marginLeft: 8 }}>
                        {meta ? meta.callback : "…"}
                    </span>
                </div>
            </div>

            <div className="list">
                {annotations.length === 0 && (
                    <div className="empty">
                        Toggle <b>Annotate</b>, then drag a box over the spec to screenshot it and add a note.
                    </div>
                )}
                {annotations.map((a, i) => (
                    <Card key={a.id} a={a} index={i + 1} onSend={() => doSend([a.id])} onDelete={() => remove(a.id)} busy={busy} />
                ))}
            </div>

            <div className="foot">
                <button
                    className="btn primary send-btn"
                    disabled={busy || open.length === 0}
                    onClick={() => doSend(open.map(a => a.id))}
                >
                    {busy ? "Sending…" : `Send all open (${open.length})`}
                </button>
                {note && <div className="send-note">{note}</div>}
            </div>
        </aside>
    );
}

function Card({
    a,
    index,
    onSend,
    onDelete,
    busy
}: {
    a: Annotation;
    index: number;
    onSend: () => void;
    onDelete: () => void;
    busy: boolean;
}) {
    return (
        <div className="acard">
            <div className="top">
                <span className="idx">{index}</span>
                <span className="where">{a.context || "region"}</span>
                <span className={`st ${a.status}`}>{a.status}</span>
                <span className="x" title="delete" onClick={onDelete}>
                    ✕
                </span>
            </div>
            <img className="acard-thumb" src={`/api/image/${a.id}`} alt="annotation" onError={e => (e.currentTarget.style.display = "none")} />
            <div className="body">{a.body || <span className="muted">(no note)</span>}</div>
            {a.status === "open" && (
                <button className="btn send-one" disabled={busy} onClick={onSend}>
                    Send
                </button>
            )}
        </div>
    );
}
