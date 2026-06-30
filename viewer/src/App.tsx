import { useEffect, useRef } from "react";
import { AnnotationLayer } from "./annotation/AnnotationLayer";
import { AnnotationProvider, useReview } from "./annotation/AnnotationProvider";
import { Sidebar } from "./annotation/Sidebar";
import { SpecDoc } from "./components/SpecDoc";

function Topbar() {
    const { mode, setMode, annotations, meta } = useReview();
    return (
        <div className="topbar" data-no-capture>
            <span className="brand">
                slice<span className="dot">·</span>lens
            </span>
            <span className="spacer" />
            <span className={`pane-badge ${meta?.callbackLive ? "live" : "dead"}`}>
                {meta ? (meta.callbackLive ? `→ ${meta.callback}` : `${meta.callback} (unreachable)`) : "…"}
            </span>
            <span className="pane-badge">{annotations.length} active</span>
            <button className={`toggle ${mode ? "on" : ""}`} onClick={() => setMode(!mode)}>
                {mode ? "◉ Annotating — drag a box" : "▢ Annotate"}
            </button>
        </div>
    );
}

function Review() {
    const { spec, error, mode } = useReview();
    const docRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        document.body.classList.toggle("annotate-on", mode);
    }, [mode]);

    return (
        <div className="shell">
            <div className="doc" ref={docRef}>
                <Topbar />
                {error && (
                    <div className="wrap">
                        <div className="excluded">
                            <div className="k">No spec loaded</div>
                            {error} — generate <span className="mono">.slicelens/spec.json</span> (run the slicelens
                            skill), then this view fills in.
                        </div>
                    </div>
                )}
                {spec && <SpecDoc spec={spec} />}
                <AnnotationLayer docRef={docRef} />
            </div>
            <Sidebar />
        </div>
    );
}

export default function App() {
    return (
        <AnnotationProvider>
            <Review />
        </AnnotationProvider>
    );
}
