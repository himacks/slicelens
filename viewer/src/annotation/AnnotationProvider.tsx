import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from "react";
import * as api from "../lib/api";
import type { Annotation, AnnotationRect, Spec } from "../lib/types";

interface ReviewContextValue {
    spec: Spec | null;
    error: string | null;
    annotations: Annotation[]; // active (open + sent)
    resolvedCount: number;
    meta: api.Meta | null;
    mode: boolean;
    setMode: (on: boolean) => void;
    refetch: () => Promise<void>;
    create: (input: {
        rect: AnnotationRect;
        imageDataUrl: string;
        body: string;
        context?: string;
    }) => Promise<void>;
    send: (ids: string[]) => Promise<api.SendResult>;
    remove: (id: string) => Promise<void>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue {
    const ctx = useContext(ReviewContext);
    if (!ctx) throw new Error("useReview must be used within AnnotationProvider");
    return ctx;
}

export function AnnotationProvider({ children }: { children: ReactNode }) {
    const [spec, setSpec] = useState<Spec | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [all, setAll] = useState<Annotation[]>([]);
    const [meta, setMeta] = useState<api.Meta | null>(null);
    const [mode, setMode] = useState(false);

    const refetch = useCallback(async () => {
        try {
            setSpec(await api.fetchSpec());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        try {
            setAll(await api.fetchAnnotations());
        } catch {
            /* annotations are optional */
        }
        try {
            setMeta(await api.fetchMeta());
        } catch {
            /* meta is optional */
        }
    }, []);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    useEffect(() => onServerUpdate(() => void refetch()), [refetch]);

    const create = useCallback<ReviewContextValue["create"]>(
        async input => {
            await api.createAnnotation(input);
            await refetch();
        },
        [refetch]
    );

    const send = useCallback<ReviewContextValue["send"]>(
        async ids => {
            const result = await api.sendAnnotations(ids);
            await refetch();
            return result;
        },
        [refetch]
    );

    const remove = useCallback<ReviewContextValue["remove"]>(
        async id => {
            await api.deleteAnnotation(id);
            await refetch();
        },
        [refetch]
    );

    const annotations = all.filter(a => a.status !== "resolved");
    const resolvedCount = all.length - annotations.length;

    return (
        <ReviewContext.Provider
            value={{ spec, error, annotations, resolvedCount, meta, mode, setMode, refetch, create, send, remove }}
        >
            {children}
        </ReviewContext.Provider>
    );
}

function onServerUpdate(handler: () => void): () => void {
    return api.onServerUpdate(handler);
}
