type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const isProduction = process.env.NODE_ENV === "production";
const minRank = RANK[process.env.LOG_LEVEL as Level] ?? (isProduction ? RANK.info : RANK.debug);
// JSON lines in production so log collectors can parse them; readable output in development.
const asJson = isProduction || process.env.LOG_FORMAT === "json";

// Errors aren't JSON-serializable (message/stack/cause are non-enumerable), and nested ones
// (Mongoose's reason, AggregateError.errors) matter most in incidents, so walk them explicitly.
function serializeError(error: Error, depth: number): Fields {
    const out: Fields = { ...(error as unknown as Fields), name: error.name, message: error.message, stack: error.stack };
    if (error.cause !== undefined) out.cause = toLoggable(error.cause, depth + 1);
    for (const [key, value] of Object.entries(out)) {
        if (value instanceof Error) out[key] = depth < 3 ? serializeError(value, depth + 1) : value.message;
    }
    if (error instanceof AggregateError) out.errors = error.errors.map((e) => toLoggable(e, depth + 1));
    return out;
}

function toLoggable(value: unknown, depth = 0): unknown {
    return value instanceof Error ? serializeError(value, depth) : value;
}

// Never throws: the logger is mostly called from catch blocks, where a throw would mask the original error.
function safeStringify(entry: Fields): string {
    const seen = new WeakSet<object>();
    try {
        return JSON.stringify(entry, (_key, value) => {
            if (typeof value === "bigint") return value.toString();
            if (value instanceof Error) return serializeError(value, 0);
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
            }
            return value;
        });
    } catch (error) {
        return JSON.stringify({ level: entry.level, time: entry.time, msg: entry.msg, logError: String(error) });
    }
}

function write(level: Level, msg: string, fields?: Fields) {
    if (RANK[level] < minRank) return;
    if (asJson) {
        console[level](safeStringify({ level, time: new Date().toISOString(), msg, ...fields }));
    } else {
        // Raw fields in development, so Node prints errors with their own stack and cause formatting.
        console[level](`[${level}] ${msg}`, ...(fields ? [fields] : []));
    }
}

export const logger = {
    debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
    info: (msg: string, fields?: Fields) => write("info", msg, fields),
    warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
    error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
