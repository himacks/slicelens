// `slicelens diff` — extract the net diff (base..HEAD) into .slicelens/diff.json.
// This is structured INPUT for the slicing agent: the commit range, per-file
// name-status + line counts, and the branch metadata. It deliberately does NOT
// produce slices — slicing is the agent's judgment (see skill/SKILL.md). It also
// never embeds file contents: the spec is code-free by design.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ensureWorkspace } from "../shared/paths.mjs";

function git(args, cwd = process.cwd()) {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export async function cmdDiff({ flags }) {
    const cwd = process.cwd();
    // Default base: the branch's fork point from main (so merged-in main commits
    // don't pollute the net diff). Fall back to main if no merge-base.
    let base = flags.base;
    if (!base) {
        try {
            base = git(["merge-base", "main", "HEAD"], cwd);
        } catch {
            base = "main";
        }
    }
    const head = git(["rev-parse", "HEAD"], cwd);
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);

    const nameStatus = git(["diff", "--name-status", `${base}..HEAD`], cwd);
    const numStat = git(["diff", "--numstat", `${base}..HEAD`], cwd);

    const statusByPath = {};
    for (const line of nameStatus.split("\n").filter(Boolean)) {
        const [status, ...pathParts] = line.split("\t");
        statusByPath[pathParts.join("\t")] = status;
    }

    const files = [];
    let additions = 0;
    let deletions = 0;
    for (const line of numStat.split("\n").filter(Boolean)) {
        const [add, del, path] = line.split("\t");
        const a = add === "-" ? 0 : Number(add);
        const d = del === "-" ? 0 : Number(del);
        additions += a;
        deletions += d;
        files.push({ path, status: statusByPath[path] ?? "M", additions: a, deletions: d });
    }

    const commits = git(["log", "--format=%h %s", `${base}..HEAD`], cwd)
        .split("\n")
        .filter(Boolean)
        .map(line => {
            const space = line.indexOf(" ");
            return { hash: line.slice(0, space), subject: line.slice(space + 1) };
        });

    const diff = {
        generatedAt: new Date().toISOString(),
        repo: cwd.split("/").pop(),
        base,
        head,
        branch,
        stats: { files: files.length, additions, deletions },
        commits,
        files: files.sort((a, b) => a.path.localeCompare(b.path))
    };

    const paths = ensureWorkspace(cwd);
    writeFileSync(paths.diff, JSON.stringify(diff, null, 2));

    console.log(`slicelens diff → ${paths.diff}`);
    console.log(`  ${branch} vs ${base.slice(0, 12)}`);
    console.log(`  ${diff.stats.files} files, +${additions} / -${deletions}, ${commits.length} commits`);
    console.log(`\nNext: author .slicelens/spec.json (see the slicelens skill), then: slicelens serve`);
}
