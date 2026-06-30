// Vite plugin: the slicelens bridge. Adds the /api surface the viewer talks to and
// pushes a live-reload signal whenever the spec or annotations change on disk, so the
// viewer auto-refreshes after the agent edits the spec or resolves annotations.
import { existsSync, readFileSync } from "node:fs";
import {
    addAnnotation,
    deleteAnnotation,
    markSent,
    readAnnotations
} from "./store.mjs";
import { buildNudge, writePayload } from "./outbox.mjs";
import { callbackLabel, callbackLive, dispatch } from "./callback.mjs";

function send(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", chunk => (raw += chunk));
        req.on("end", () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on("error", reject);
    });
}

export function slicelensBridge({ paths, callback }) {
    return {
        name: "slicelens-bridge",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = (req.url ?? "").split("?")[0];
                if (!url.startsWith("/api/")) return next();

                try {
                    if (url === "/api/spec" && req.method === "GET") {
                        if (!existsSync(paths.spec)) {
                            return send(res, 404, { error: "no spec.json — generate it first" });
                        }
                        return send(res, 200, JSON.parse(readFileSync(paths.spec, "utf8")));
                    }

                    if (url === "/api/annotations" && req.method === "GET") {
                        return send(res, 200, readAnnotations(paths));
                    }

                    // GET /api/image/<id> — serve an annotation's PNG thumbnail.
                    if (url.startsWith("/api/image/") && req.method === "GET") {
                        const id = url.split("/").pop();
                        const found = readAnnotations(paths).annotations.find(a => a.id === id);
                        if (!found?.image || !existsSync(found.image)) {
                            return send(res, 404, { error: "no image" });
                        }
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "image/png");
                        res.end(readFileSync(found.image));
                        return;
                    }

                    if (url === "/api/meta" && req.method === "GET") {
                        return send(res, 200, {
                            callback: callbackLabel(callback),
                            callbackLive: callbackLive(callback),
                            hasSpec: existsSync(paths.spec)
                        });
                    }

                    // POST /api/annotations — one annotation: { rect, imageDataUrl, body, context }.
                    // The PNG is decoded to /tmp/slicelens/<id>.png by the store.
                    if (url === "/api/annotations" && req.method === "POST") {
                        const body = await readBody(req);
                        const created = addAnnotation(paths, body);
                        return send(res, 200, { created });
                    }

                    // DELETE /api/annotations/<id>
                    if (url.startsWith("/api/annotations/") && req.method === "DELETE") {
                        deleteAnnotation(paths, url.split("/").pop());
                        return send(res, 200, { ok: true });
                    }

                    // POST /api/send — deliver the given open annotations to the pane.
                    if (url === "/api/send" && req.method === "POST") {
                        const body = await readBody(req);
                        const ids = body.ids ?? [];
                        const sent = markSent(paths, ids).filter(a => a.status === "sent");
                        if (sent.length === 0) {
                            return send(res, 200, { sent: 0, delivered: false });
                        }
                        const payload = writePayload(paths, sent);
                        const delivery = dispatch(callback, {
                            message: buildNudge(sent, payload.relLatest),
                            outbox: payload.relLatest
                        });
                        return send(res, 200, {
                            sent: sent.length,
                            delivered: delivery.ok,
                            reason: delivery.reason,
                            outbox: payload.relLatest
                        });
                    }

                    return send(res, 404, { error: "unknown endpoint" });
                } catch (error) {
                    return send(res, 500, { error: error.message });
                }
            });

            // Live-reload: refetch when the spec or annotations change on disk.
            const watched = [paths.spec, paths.annotations];
            for (const file of watched) server.watcher.add(file);
            const push = file => {
                if (watched.includes(file)) {
                    server.ws.send({ type: "custom", event: "slicelens:update", data: { file } });
                }
            };
            server.watcher.on("change", push);
            server.watcher.on("add", push);
        }
    };
}
