import type { Spec } from "../lib/types";
import { SliceCard } from "./SliceCard";

function Html({ html, className }: { html: string; className?: string }) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SpecDoc({ spec }: { spec: Spec }) {
    const { meta, excluded, slices } = spec;
    return (
        <div className="wrap">
            <h1 data-context="Title">{meta.title}</h1>
            {meta.subtitle && <p className="sub">{meta.subtitle}</p>}

            {meta.intro && meta.intro.length > 0 && (
                <div className="lede" data-context="Overview">
                    {meta.intro.map((p, i) => (
                        <Html key={i} html={p} />
                    ))}
                </div>
            )}

            {meta.principle && (
                <div className="principle" data-context="Slicing principle">
                    <div className="k">Slicing principle</div>
                    <Html html={meta.principle} />
                </div>
            )}

            {excluded.length > 0 && (
                <div className="excluded" data-context="Excluded — branch-internal churn">
                    <div className="k">Excluded — branch-internal churn (absent from the net diff)</div>
                    <ul>
                        {excluded.map((e, i) => (
                            <li key={i}>
                                <span className="x">{e.title}</span> — <Html html={e.reason} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <h2>Build order</h2>
            <div className="rail" data-context="Build order">
                {slices.map(s => (
                    <a className="node" href={`#${s.id}`} key={s.id}>
                        <div className="n">SLICE {s.number}</div>
                        <div className="t">{s.title}</div>
                        <div className="tag">{s.kind}</div>
                    </a>
                ))}
            </div>

            <h2>The slices</h2>
            {slices.map(s => (
                <SliceCard slice={s} key={s.id} />
            ))}

            <h2>Summary</h2>
            <table data-context="Summary">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Slice</th>
                        <th>Kind</th>
                        <th>Depends</th>
                    </tr>
                </thead>
                <tbody>
                    {slices.map(s => (
                        <tr key={s.id}>
                            <td className="mono">{s.number}</td>
                            <td>{s.title}</td>
                            <td>
                                <span className="pill">{s.kind}</span>
                            </td>
                            <td>{s.dependsOn.length ? s.dependsOn.join(", ") : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p className="foot">
                {meta.repo} · {meta.branch} vs {meta.base.slice(0, 12)} · {meta.stats.files} files, +
                {meta.stats.additions} / −{meta.stats.deletions} · generated {meta.generatedAt}
            </p>
        </div>
    );
}
