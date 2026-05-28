import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Priority as PriorityEnum } from "./types.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('dist') ? path.join(__dirname, '..') : __dirname;
const DATA_PATH = path.join(rootDir, "data.json");
const publicDir = path.join(rootDir, "public");
import { z } from "zod";
function isPriority(value) {
    return (value === PriorityEnum.Low ||
        value === PriorityEnum.Medium ||
        value === PriorityEnum.High ||
        value === PriorityEnum.Critical);
}
function parseTaskInput(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const obj = raw;
    if (typeof obj.title !== "string" || obj.title.trim().length < 1 || obj.title.length > 200)
        return null;
    if (!isPriority(obj.priority))
        return null;
    return { title: obj.title.trim(), priority: obj.priority };
}
function parsePatchTaskInput(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const obj = raw;
    const out = {};
    if (obj.title !== undefined) {
        if (typeof obj.title !== "string" || obj.title.trim().length < 1 || obj.title.length > 200)
            return null;
        out.title = obj.title.trim();
    }
    if (obj.description !== undefined) {
        if (typeof obj.description !== "string")
            return null;
        out.description = obj.description;
    }
    if (obj.isCompleted !== undefined) {
        if (typeof obj.isCompleted !== "boolean")
            return null;
        out.isCompleted = obj.isCompleted;
    }
    if (obj.priority !== undefined) {
        if (!isPriority(obj.priority))
            return null;
        out.priority = obj.priority;
    }
    if (obj.dueDate !== undefined) {
        if (typeof obj.dueDate !== "string")
            return null;
        const d = new Date(obj.dueDate);
        if (Number.isNaN(d.getTime()))
            return null;
        out.dueDate = obj.dueDate;
    }
    if (obj.reminder !== undefined) {
        if (!obj.reminder || typeof obj.reminder !== "object")
            return null;
        const rem = obj.reminder;
        const remOut = {};
        if (rem.id !== undefined) {
            if (typeof rem.id !== "string")
                return null;
            remOut.id = rem.id;
        }
        if (rem.remindAt !== undefined) {
            if (typeof rem.remindAt !== "string")
                return null;
            const d = new Date(rem.remindAt);
            if (Number.isNaN(d.getTime()))
                return null;
            remOut.remindAt = rem.remindAt;
        }
        if (rem.message !== undefined) {
            if (typeof rem.message !== "string")
                return null;
            remOut.message = rem.message;
        }
        out.reminder = remOut;
    }
    return out;
}
const TaskInputSchema = z.object({
    title: z.string().min(1).max(200),
    priority: z.nativeEnum(PriorityEnum)
});
const PatchTaskSchema = z
    .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    isCompleted: z.boolean().optional(),
    priority: z.nativeEnum(PriorityEnum).optional(),
    dueDate: z.string().datetime().optional(),
    reminder: z
        .object({
        id: z.string().optional(),
        remindAt: z.string().datetime().optional(),
        message: z.string().optional()
    })
        .optional()
})
    .strict();
function readJsonFile() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({ tasks: [] }, null, 2), "utf-8");
    }
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
}
function writeJsonFile(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}
function serializeTask(task) {
    return {
        ...task,
        dueDate: task.dueDate.toISOString(),
        reminder: {
            ...task.reminder,
            remindAt: task.reminder.remindAt.toISOString()
        }
    };
}
function deserializeTask(raw) {
    const reminder = {
        id: String(raw.reminder.id),
        remindAt: new Date(String(raw.reminder.remindAt)),
        message: String(raw.reminder.message ?? "")
    };
    return {
        id: Number(raw.id),
        title: String(raw.title),
        description: String(raw.description ?? ""),
        isCompleted: Boolean(raw.isCompleted),
        priority: raw.priority,
        dueDate: new Date(String(raw.dueDate)),
        reminder
    };
}
function getAllTasksFromStorage() {
    const data = readJsonFile();
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    return tasks.map((t) => deserializeTask(t));
}
function saveAllTasksToStorage(tasks) {
    const serialized = tasks.map((t) => serializeTask(t));
    writeJsonFile({ tasks: serialized });
}
function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}
function sendText(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(payload);
}
const server = http.createServer(async (req, res) => {
    const method = req.method;
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        res.statusCode = 204;
        res.end();
        return;
    }
    const serveStatic = () => {
        const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
        let filePath = path.join(publicDir, pathname);
        if (pathname.endsWith(".js")) {
            const safeJsPath = pathname.replace(/^\/+/, "");
            if (safeJsPath === "main.js") {
                filePath = path.join(rootDir, "dist", "public", "main.js");
            }
            else {
                filePath = path.join(rootDir, "dist", safeJsPath);
            }
        }
        if (!fs.existsSync(filePath)) {
            sendText(res, 404, "Not found");
            return;
        }
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = ext === ".html"
            ? "text/html; charset=utf-8"
            : ext === ".css"
                ? "text/css; charset=utf-8"
                : ext === ".js"
                    ? "text/javascript; charset=utf-8"
                    : "application/octet-stream";
        res.statusCode = 200;
        res.setHeader("Content-Type", contentType);
        res.end(content);
    };
    if (url.pathname === "/api/tasks") {
        if (method === "GET") {
            const tasks = getAllTasksFromStorage();
            sendJson(res, 200, { tasks: tasks.map((t) => serializeTask(t)) });
            return;
        }
        if (method === "POST") {
            const bodyRaw = await new Promise((resolve, reject) => {
                let data = "";
                req.on("data", (chunk) => {
                    data += chunk.toString("utf-8");
                });
                req.on("end", () => resolve(data));
                req.on("error", (err) => reject(err));
            });
            let parsed;
            try {
                parsed = JSON.parse(bodyRaw);
            }
            catch {
                sendText(res, 400, "Invalid JSON");
                return;
            }
            const input = TaskInputSchema.safeParse(parsed);
            if (!input.success) {
                sendText(res, 400, "Validation error");
                return;
            }
            const tasks = getAllTasksFromStorage();
            const now = new Date();
            const maxId = tasks.reduce((acc, t) => Math.max(acc, t.id), 0);
            const newTask = {
                id: maxId + 1,
                title: input.data.title,
                description: "",
                isCompleted: false,
                priority: input.data.priority,
                dueDate: now,
                reminder: {
                    id: crypto.randomUUID(),
                    remindAt: now,
                    message: ""
                }
            };
            tasks.push(newTask);
            saveAllTasksToStorage(tasks);
            sendJson(res, 201, { task: serializeTask(newTask) });
            return;
        }
    }
    if (url.pathname.startsWith("/api/tasks/")) {
        const idStr = url.pathname.split("/").filter(Boolean).pop() ?? "";
        const id = Number(idStr);
        if (!Number.isFinite(id)) {
            sendText(res, 400, "Invalid id");
            return;
        }
        if (method === "PATCH") {
            const bodyRaw = await new Promise((resolve, reject) => {
                let data = "";
                req.on("data", (chunk) => {
                    data += chunk.toString("utf-8");
                });
                req.on("end", () => resolve(data));
                req.on("error", (err) => reject(err));
            });
            let parsed;
            try {
                parsed = JSON.parse(bodyRaw);
            }
            catch {
                sendText(res, 400, "Invalid JSON");
                return;
            }
            const input = PatchTaskSchema.safeParse(parsed);
            if (!input.success) {
                sendText(res, 400, "Validation error");
                return;
            }
            const tasks = getAllTasksFromStorage();
            const idx = tasks.findIndex((t) => t.id === id);
            if (idx < 0) {
                sendText(res, 404, "Task not found");
                return;
            }
            const current = tasks[idx];
            const next = {
                ...current,
                ...(input.data.title !== undefined ? { title: input.data.title } : {}),
                ...(input.data.description !== undefined ? { description: input.data.description } : {}),
                ...(input.data.isCompleted !== undefined ? { isCompleted: input.data.isCompleted } : {}),
                ...(input.data.priority !== undefined ? { priority: input.data.priority } : {}),
                ...(input.data.dueDate !== undefined ? { dueDate: new Date(input.data.dueDate) } : {}),
                ...(input.data.reminder !== undefined
                    ? {
                        reminder: {
                            ...current.reminder,
                            ...(input.data.reminder.id !== undefined ? { id: input.data.reminder.id } : {}),
                            ...(input.data.reminder.remindAt !== undefined
                                ? { remindAt: new Date(input.data.reminder.remindAt) }
                                : {}),
                            ...(input.data.reminder.message !== undefined
                                ? { message: input.data.reminder.message }
                                : {})
                        }
                    }
                    : {})
            };
            tasks[idx] = next;
            saveAllTasksToStorage(tasks);
            sendJson(res, 200, { task: serializeTask(next) });
            return;
        }
        if (method === "DELETE") {
            const tasks = getAllTasksFromStorage();
            const filtered = tasks.filter((t) => t.id !== id);
            if (filtered.length === tasks.length) {
                sendText(res, 404, "Task not found");
                return;
            }
            saveAllTasksToStorage(filtered);
            res.statusCode = 204;
            res.end();
            return;
        }
    }
    if (method && (method === "GET" || method === "HEAD")) {
        serveStatic();
        return;
    }
    sendJson(res, 404, { error: "Not found" });
});
const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`TaskMaster server running on http://localhost:${PORT}`);
});
