import {
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type RefObject
} from "react";
import { captureRect, normalizeRect } from "../lib/capture";
import type { AnnotationRect } from "../lib/types";
import { useReview } from "./AnnotationProvider";

interface Draft {
    rect: AnnotationRect;
    image: string;
    context: string;
}

function boxStyle(rect: AnnotationRect): CSSProperties {
    return { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
}

// Best-effort label of what a dropped box overlaps, for the agent's context line.
function contextAt(clientX: number, clientY: number): string {
    const el = document.elementFromPoint(clientX, clientY);
    const labelled = el?.closest<HTMLElement>("[data-context]");
    return labelled?.dataset.context ?? "";
}

export function AnnotationLayer({ docRef }: { docRef: RefObject<HTMLDivElement | null> }) {
    const { mode, annotations, create } = useReview();
    const [drag, setDrag] = useState<AnnotationRect | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [text, setText] = useState("");
    const start = useRef<{ x: number; y: number } | null>(null);

    function toNode(e: { clientX: number; clientY: number }) {
        const node = docRef.current;
        if (!node) return { x: 0, y: 0 };
        const r = node.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onDown(e: ReactMouseEvent) {
        if (!mode || draft) return;
        const p = toNode(e);
        start.current = p;
        setDrag({ x: p.x, y: p.y, w: 0, h: 0 });
    }

    function onMove(e: ReactMouseEvent) {
        if (!start.current) return;
        setDrag(normalizeRect(start.current, toNode(e)));
    }

    async function onUp(e: ReactMouseEvent) {
        const s = start.current;
        start.current = null;
        if (!s || !docRef.current) {
            setDrag(null);
            return;
        }
        const rect = normalizeRect(s, toNode(e));
        setDrag(null);
        if (rect.w < 8 || rect.h < 8) return; // ignore stray clicks
        const context = contextAt(e.clientX, e.clientY);
        setCapturing(true);
        try {
            const image = await captureRect(docRef.current, rect);
            setDraft({ rect, image, context });
        } finally {
            setCapturing(false);
        }
    }

    async function save() {
        if (!draft) return;
        await create({ rect: draft.rect, imageDataUrl: draft.image, body: text, context: draft.context });
        setDraft(null);
        setText("");
    }

    function cancel() {
        setDraft(null);
        setText("");
    }

    return (
        <div className="anno-overlay" data-no-capture>
            {/* drag surface — only catches events in annotate mode */}
            <div
                className="drag-surface"
                style={{ pointerEvents: mode && !draft ? "auto" : "none" }}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
            />

            {drag && <div className="drag-rect" style={boxStyle(drag)} />}

            {/* persisted markers for active annotations */}
            {annotations.map((a, i) => (
                <div key={a.id} className={`saved-box ${a.status}`} style={boxStyle(a.rect)}>
                    <span className="saved-badge" title={a.body}>
                        {i + 1}
                    </span>
                </div>
            ))}

            {capturing && <div className="capturing">capturing…</div>}

            {draft && (
                <Composer
                    image={draft.image}
                    context={draft.context}
                    text={text}
                    setText={setText}
                    onSave={save}
                    onCancel={cancel}
                />
            )}
        </div>
    );
}

function Composer({
    image,
    context,
    text,
    setText,
    onSave,
    onCancel
}: {
    image: string;
    context: string;
    text: string;
    setText: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="composer" data-no-capture>
            <div className="composer-inner">
                <img className="composer-thumb" src={image} alt="captured region" />
                {context && (
                    <div className="composer-ctx">
                        over <b>{context}</b>
                    </div>
                )}
                <textarea
                    autoFocus
                    placeholder="What about this region? (context / change / question)"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
                        if (e.key === "Escape") onCancel();
                    }}
                />
                <div className="row">
                    <button className="btn" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="btn primary" onClick={onSave} disabled={!text.trim()}>
                        Add annotation
                    </button>
                </div>
            </div>
        </div>
    );
}
