import { toCanvas } from "html-to-image";
import type { AnnotationRect } from "./types";

// Rasterize `node`, then crop to `rect` (coordinates relative to node's top-left).
// Elements marked data-no-capture (the annotation overlay, composer, drag box) are
// filtered out so the screenshot shows only the spec, never the tooling on top of it.
export async function captureRect(node: HTMLElement, rect: AnnotationRect): Promise<string> {
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = await toCanvas(node, {
        pixelRatio,
        cacheBust: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (el: HTMLElement) => !(el.dataset && el.dataset.noCapture !== undefined)
    });

    const scaleX = canvas.width / node.offsetWidth;
    const scaleY = canvas.height / node.offsetHeight;

    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(rect.w * scaleX));
    crop.height = Math.max(1, Math.round(rect.h * scaleY));
    const ctx = crop.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/png");
    ctx.drawImage(
        canvas,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.w * scaleX,
        rect.h * scaleY,
        0,
        0,
        crop.width,
        crop.height
    );
    return crop.toDataURL("image/png");
}

export function normalizeRect(
    a: { x: number; y: number },
    b: { x: number; y: number }
): AnnotationRect {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y)
    };
}
