// Annotation persistence. Records live in .slicelens/annotations.json and progress
// open → sent → (removed). Each annotation is a screenshot (PNG on disk) + commentary.
// They persist (stay visible in the viewer) until the agent has RESPONDED, at which
// point `resolve` removes the record and its screenshot entirely — annotations are a
// live worklist, not a log, so a handled one disappears.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const IMAGE_DIR = "/tmp/slicelens";

export function readJson(path, fallback) {
    if (!existsSync(path)) return fallback;
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch {
        return fallback;
    }
}

export function readAnnotations(paths) {
    return readJson(paths.annotations, { annotations: [] });
}

export function writeAnnotations(paths, data) {
    writeFileSync(paths.annotations, JSON.stringify(data, null, 2));
}

let counter = 0;
function newId() {
    counter += 1;
    return `a${Date.now().toString(36)}${counter.toString(36)}`;
}

// Decode a `data:image/png;base64,...` URL to a PNG under /tmp and return its path.
function writeImage(id, dataUrl) {
    mkdirSync(IMAGE_DIR, { recursive: true });
    const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, "");
    const file = join(IMAGE_DIR, `${id}.png`);
    writeFileSync(file, Buffer.from(base64, "base64"));
    return file;
}

export function addAnnotation(paths, input) {
    const data = readAnnotations(paths);
    const id = newId();
    const image = input.imageDataUrl ? writeImage(id, input.imageDataUrl) : "";
    const annotation = {
        id,
        rect: input.rect ?? { x: 0, y: 0, w: 0, h: 0 },
        image,
        body: String(input.body ?? "").trim(),
        context: input.context ?? "",
        status: "open",
        createdAt: new Date().toISOString()
    };
    data.annotations.push(annotation);
    writeAnnotations(paths, data);
    return annotation;
}

// Delete the on-disk screenshot for an annotation (best-effort).
function removeImage(annotation) {
    if (annotation?.image && existsSync(annotation.image)) {
        try {
            rmSync(annotation.image);
        } catch {
            /* best-effort cleanup */
        }
    }
}

export function deleteAnnotation(paths, id) {
    const data = readAnnotations(paths);
    const gone = data.annotations.find(a => a.id === id);
    if (gone) removeImage(gone);
    data.annotations = data.annotations.filter(a => a.id !== id);
    writeAnnotations(paths, data);
}

export function markSent(paths, ids) {
    const data = readAnnotations(paths);
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    for (const a of data.annotations) {
        if (idSet.has(a.id) && a.status === "open") {
            a.status = "sent";
            a.sentAt = now;
        }
    }
    writeAnnotations(paths, data);
    return data.annotations.filter(a => idSet.has(a.id));
}

// Responded → removed. Drop the matching annotations and their screenshots entirely.
export function resolveAnnotations(paths, { ids, allSent }) {
    const data = readAnnotations(paths);
    const idSet = new Set(ids ?? []);
    const removed = data.annotations.filter(a => (allSent ? a.status === "sent" : idSet.has(a.id)));
    for (const a of removed) removeImage(a);
    const removedIds = new Set(removed.map(a => a.id));
    data.annotations = data.annotations.filter(a => !removedIds.has(a.id));
    writeAnnotations(paths, data);
    return removed.length;
}
