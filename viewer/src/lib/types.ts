// The slice model the agent authors into .slicelens/spec.json, plus the annotation
// shape the bridge persists. Section strings may contain inline HTML (e.g. <b>,
// <span class="mono">, <ul>) — the viewer renders them as-is; content is agent-authored
// and local-only.

export type SliceKind =
    | "foundation"
    | "modules"
    | "orchestration"
    | "subtraction"
    | "gate"
    | string;

export interface SliceFile {
    path: string;
    status: "modified" | "added" | "deleted";
    note?: string;
}

export interface SliceSections {
    net?: string;
    design?: string;
    layering?: string;
    verify?: string;
}

export interface Slice {
    id: string;
    number: string;
    title: string;
    kind: SliceKind;
    dependsOn: string[];
    unblocks?: string;
    sections: SliceSections;
    files: SliceFile[];
}

export interface ExcludedItem {
    title: string;
    reason: string;
}

export interface SpecMeta {
    repo: string;
    base: string;
    head?: string;
    branch: string;
    generatedAt: string;
    stats: { files: number; additions: number; deletions: number };
    title: string;
    subtitle?: string;
    intro?: string[];
    principle?: string;
}

export interface Spec {
    meta: SpecMeta;
    excluded: ExcludedItem[];
    slices: Slice[];
}

// An annotation is a screenshot of a dragged box on the spec + a line of commentary.
// `rect` is in document coordinates so the marker can be redrawn over the page; `image`
// is the on-disk PNG path the agent reads.
// open = drafted, not yet delivered · sent = delivered to the agent.
// A handled annotation is removed outright (record + screenshot), never tombstoned.
export type AnnotationStatus = "open" | "sent";

export interface AnnotationRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Annotation {
    id: string;
    rect: AnnotationRect;
    image: string; // filesystem path to the PNG
    body: string;
    context?: string; // best-effort label of what the box overlaps (e.g. "Slice 03")
    status: AnnotationStatus;
    createdAt: string;
    sentAt?: string;
}
