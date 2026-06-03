import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Priority as PriorityEnum } from "./types.js";
import crypto from "node:crypto";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('dist') ? path.join(__dirname, '..') : __dirname;
const DATA_PATH = path.join(rootDir, "data.json");
const USERS_PATH = path.join(rootDir, "users.json");
const publicDir = path.join(__dirname, "..", "public");
const sessions = new Map();
function readUsersFile() {
    if (!fs.existsSync(USERS_PATH)) {
        fs.writeFileSync(USERS_PATH, JSON.stringify([], null, 2), "utf-8");
    }
    try {
        const raw = fs.readFileSync(USERS_PATH, "utf-8");
        return JSON.parse(raw);
    }
    catch (e) {
        return [];
    }
}
function writeUsersFile(users) {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}
function generateSalt() {
    return crypto.randomBytes(16).toString("hex");
}
function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}
function getUsernameFromReq(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.substring(7);
    return sessions.get(token) ?? null;
}
function assignOwnerlessTasks(username) {
    const tasks = getAllTasksFromStorage();
    let updated = false;
    for (const t of tasks) {
        if (!t.username) {
            t.username = username;
            updated = true;
        }
    }
    if (updated) {
        saveAllTasksToStorage(tasks);
    }
}
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
    priority: z.nativeEnum(PriorityEnum),
    deadline: z.string().optional()
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
        .optional(),
    subtasks: z
        .array(z.object({
        id: z.string(),
        title: z.string(),
        isCompleted: z.boolean()
    }))
        .optional(),
    deadline: z.string().optional()
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
        subtasks: task.subtasks || [],
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
        reminder,
        subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
        username: raw.username ? String(raw.username) : undefined,
        deadline: raw.deadline ? String(raw.deadline) : undefined
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
    if (url.pathname === "/api/register" && method === "POST") {
        const bodyRaw = await new Promise((resolve, reject) => {
            let data = "";
            req.on("data", (chunk) => { data += chunk.toString("utf-8"); });
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
        const username = parsed.username;
        const password = parsed.password;
        if (typeof username !== "string" || typeof password !== "string" || username.trim().length < 3 || password.length < 4) {
            sendJson(res, 400, { error: "Ім'я користувача має бути від 3 символів, пароль — від 4 символів" });
            return;
        }
        const users = readUsersFile();
        if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
            sendJson(res, 400, { error: "Користувач з таким ім'ям вже існує" });
            return;
        }
        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);
        const newUser = {
            username: username.trim(),
            passwordHash,
            salt
        };
        users.push(newUser);
        writeUsersFile(users);
        assignOwnerlessTasks(newUser.username);
        sendJson(res, 201, { success: true, username: newUser.username });
        return;
    }
    if (url.pathname === "/api/login" && method === "POST") {
        const bodyRaw = await new Promise((resolve, reject) => {
            let data = "";
            req.on("data", (chunk) => { data += chunk.toString("utf-8"); });
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
        const username = parsed.username;
        const password = parsed.password;
        if (typeof username !== "string" || typeof password !== "string") {
            sendJson(res, 400, { error: "Некоректний логін або пароль" });
            return;
        }
        const users = readUsersFile();
        const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!user) {
            sendJson(res, 400, { error: "Неправильний логін або пароль" });
            return;
        }
        const currentHash = hashPassword(password, user.salt);
        if (currentHash !== user.passwordHash) {
            sendJson(res, 400, { error: "Неправильний логін або пароль" });
            return;
        }
        const token = generateToken();
        sessions.set(token, user.username);
        sendJson(res, 200, { token, username: user.username });
        return;
    }
    if (url.pathname === "/api/logout" && method === "POST") {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            sessions.delete(token);
        }
        sendJson(res, 200, { success: true });
        return;
    }
    if (url.pathname.startsWith("/api/tasks")) {
        const username = getUsernameFromReq(req);
        if (!username) {
            sendJson(res, 401, { error: "Неавторизовано" });
            return;
        }
        if (url.pathname === "/api/tasks") {
            if (method === "GET") {
                const tasks = getAllTasksFromStorage();
                const userTasks = tasks.filter(t => t.username === username);
                sendJson(res, 200, { tasks: userTasks.map((t) => serializeTask(t)) });
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
                    },
                    subtasks: [],
                    username: username,
                    deadline: input.data.deadline || undefined
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
                if (current.username !== username) {
                    sendJson(res, 403, { error: "Немає доступу до цього завдання" });
                    return;
                }
                const next = {
                    ...current,
                    ...(input.data.title !== undefined ? { title: input.data.title } : {}),
                    ...(input.data.description !== undefined ? { description: input.data.description } : {}),
                    ...(input.data.isCompleted !== undefined ? { isCompleted: input.data.isCompleted } : {}),
                    ...(input.data.priority !== undefined ? { priority: input.data.priority } : {}),
                    ...(input.data.dueDate !== undefined ? { dueDate: new Date(input.data.dueDate) } : {}),
                    ...(input.data.deadline !== undefined ? { deadline: input.data.deadline || undefined } : {}),
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
                        : {}),
                    ...(input.data.subtasks !== undefined ? { subtasks: input.data.subtasks } : {})
                };
                if (next.isCompleted && next.subtasks && next.subtasks.some((st) => !st.isCompleted)) {
                    sendJson(res, 400, { error: "Неможливо виконати задачу з невиконаними підзадачами" });
                    return;
                }
                tasks[idx] = next;
                saveAllTasksToStorage(tasks);
                sendJson(res, 200, { task: serializeTask(next) });
                return;
            }
            if (method === "DELETE") {
                const tasks = getAllTasksFromStorage();
                const idx = tasks.findIndex((t) => t.id === id);
                if (idx < 0) {
                    sendText(res, 404, "Task not found");
                    return;
                }
                if (tasks[idx].username !== username) {
                    sendJson(res, 403, { error: "Немає доступу до цього завдання" });
                    return;
                }
                const filtered = tasks.filter((t) => t.id !== id);
                saveAllTasksToStorage(filtered);
                res.statusCode = 204;
                res.end();
                return;
            }
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
    console.log(`TaskMaster server running on http://localhost:${PORT}`);
});
