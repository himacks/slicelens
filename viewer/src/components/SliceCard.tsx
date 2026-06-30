import type { Slice, SliceSections } from "../lib/types";

const SECTION_META: { key: keyof SliceSections; label: string; cls: string }[] = [
    { key: "net", label: "Net change in the end state", cls: "net" },
    { key: "design", label: "Design", cls: "design" },
    { key: "layering", label: "Why it layers here", cls: "layer" },
    { key: "verify", label: "Verify", cls: "verify" }
];

// Section bodies are agent-authored inline HTML (local, trusted) — rendered as-is so
// the spec can use <b>, <span class="mono">, <ul>, etc.
function Html({ html }: { html: string }) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SliceCard({ slice }: { slice: Slice }) {
    return (
        <section className="slice" id={slice.id} data-context={`Slice ${slice.number} — ${slice.title}`}>
            <header>
                <span className="num">{slice.number}</span>
                <h3>{slice.title}</h3>
            </header>
            <div className="deps">
                Depends on: <b>{slice.dependsOn.length ? slice.dependsOn.join(", ") : "nothing"}</b>
                {slice.unblocks ? ` · Unblocks: ${slice.unblocks}` : ""}
            </div>

            {SECTION_META.map(({ key, label, cls }) => {
                const value = slice.sections[key];
                if (!value) return null;
                return (
                    <div className={`block ${cls}`} key={key}>
                        <div className="k">{label}</div>
                        <Html html={value} />
                    </div>
                );
            })}

            {slice.files.length > 0 && (
                <div className="files">
                    {slice.files.map(f => (
                        <span
                            key={f.path}
                            className={`chip ${f.status === "added" ? "add" : f.status === "deleted" ? "del" : ""}`}
                            title={f.note}
                        >
                            {f.path}
                            {f.status === "added" ? " ＋" : f.status === "deleted" ? " ✕" : ""}
                        </span>
                    ))}
                </div>
            )}
        </section>
    );
}
