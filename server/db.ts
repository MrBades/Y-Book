
import { join } from 'path';
import fs from 'fs';

const isVercel = !!process.env.VERCEL;

const BUNDLED_DB_PATH = join(process.cwd(), 'data', 'db.json');
const DB_PATH = isVercel ? join('/tmp', 'db.json') : BUNDLED_DB_PATH;
const LOCK_FILE = isVercel ? join('/tmp', 'db.json.lock') : join(process.cwd(), 'data', 'db.json.lock');

// Ensure database folder exists locally
if (!isVercel && !fs.existsSync(join(process.cwd(), 'data'))) {
    fs.mkdirSync(join(process.cwd(), 'data'), { recursive: true });
}

// Ensure database file exists
const initializeDB = () => {
    if (isVercel) {
        let hasCopied = false;
        if (fs.existsSync(BUNDLED_DB_PATH)) {
            try {
                const content = fs.readFileSync(BUNDLED_DB_PATH, 'utf-8');
                if (content && content.trim().startsWith('{')) {
                    fs.writeFileSync(DB_PATH, content, 'utf-8');
                    hasCopied = true;
                    console.log("Successfully copied bundled DB to Vercel /tmp");
                }
            } catch (err) {
                console.error("Failed to copy bundled DB to Vercel /tmp:", err);
            }
        }
        if (!hasCopied && (!fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({
                anonymousTrialTrackers: [],
                users: [],
                merchantSessions: [],
                staffActivityLogs: [],
                staff: []
            }, null, 2));
        }
    } else {
        if (!fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0) {
            fs.writeFileSync(DB_PATH, JSON.stringify({
                anonymousTrialTrackers: [],
                users: [],
                merchantSessions: [],
                staffActivityLogs: [],
                staff: []
            }, null, 2));
        }
    }
};

initializeDB();

export const readDB = () => {
    try {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        if (!content || !content.trim()) {
            throw new Error("DB file is empty");
        }
        const db = JSON.parse(content);
        
        // Dynamic Self-Healing: Automatically unlock any locked merchant sessions
        if (db && Array.isArray(db.merchantSessions)) {
            db.merchantSessions.forEach((s: any) => {
                if (s.is_suspicious_locked) {
                    s.is_suspicious_locked = false;
                }
            });
        }
        return db;
    } catch (err) {
        console.error("Failed to read JSON DB, resetting to defaults or falling back:", err);
        // Fallback or attempt to restore from BUNDLED_DB_PATH if in Vercel
        if (isVercel && fs.existsSync(BUNDLED_DB_PATH)) {
            try {
                const content = fs.readFileSync(BUNDLED_DB_PATH, 'utf-8');
                fs.writeFileSync(DB_PATH, content, 'utf-8');
                const db = JSON.parse(content);
                return db;
            } catch (fallbackErr) {
                console.error("Fallback restore failed:", fallbackErr);
            }
        }
        
        const defaultDb = {
            anonymousTrialTrackers: [],
            users: [],
            merchantSessions: [],
            staffActivityLogs: [],
            staff: []
        };
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2));
        } catch (writeErr) {
            console.error("Double failure: could not even write fallback default db:", writeErr);
        }
        return defaultDb;
    }
};

export const writeDB = (data: any) => {
    // Basic spin lock
    let lockWaitCounter = 0;
    while (fs.existsSync(LOCK_FILE) && lockWaitCounter < 100) {
        // Wait up to 1 second
        lockWaitCounter++;
        // Blocking sleep or spin (usually fast in Vercel)
    }
    
    try {
        fs.writeFileSync(LOCK_FILE, 'locked');
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to write to JSON db:", err);
    } finally {
        if (fs.existsSync(LOCK_FILE)) {
            try {
                fs.unlinkSync(LOCK_FILE);
            } catch (unlinkErr) {
                // Ignore lock unlink issues
            }
        }
    }
};