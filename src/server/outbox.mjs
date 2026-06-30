// Formats a batch of just-sent annotations into a markdown briefing the agent reads.
// Each annotation is a screenshot path + commentary — a "file path + text" attachment.
// The agent reads each PNG (it renders inline), acts on the note, then runs
// `slicelens resolve <ids>` to clear them from the viewer.
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";

function renderItem(a, index) {
    const lines = [];
    lines.push(`### ${index + 1}. [${a.id}]${a.context ? ` — ${a.context}` : ""}`);
    lines.push(`Screenshot: ${a.image}`);
    lines.push("");
    lines.push(a.body || "(no commentary)");
    return lines.join("\n");
}

export function buildPayload(sent) {
    const ts = new Date().toISOString();
    const out = [];
    out.push(`# slicelens — annotation batch`);
    out.push(`Sent ${ts} · ${sent.length} annotation(s).`);
    out.push("");
    out.push(`Read each screenshot path below (they render inline), address the note, then clear them:`);
    out.push("");
    out.push(`    slicelens resolve ${sent.map(a => a.id).join(" ")}`);
    out.push("");
    out.push(sent.map(renderItem).join("\n\n"));
    out.push("");
    return out.join("\n");
}

// One delivered line per annotation if there's just one, else a pointer to the batch
// file. Keeps the tmux send-keys payload to a single line.
export function buildNudge(sent, relLatest) {
    if (sent.length === 1) {
        const a = sent[0];
        return `[slicelens] annotation ${a.id}: ${a.image} — ${a.body || "(no note)"} · then: slicelens resolve ${a.id}`;
    }
    return (
        `[slicelens] ${sent.length} annotations — read ${relLatest} ` +
        `(screenshot path + note each), then: slicelens resolve ${sent.map(a => a.id).join(" ")}`
    );
}

export function writePayload(paths, sent) {
    const body = buildPayload(sent);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(paths.outbox, `${stamp}.md`);
    const latest = join(paths.outbox, "latest.md");
    writeFileSync(file, body);
    writeFileSync(latest, body);
    return { file, latest, relLatest: relative(process.cwd(), latest) };
}
