
import { join } from 'path';
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

const isVercel = !!process.env.VERCEL;

const BUNDLED_DB_PATH = join(process.cwd(), 'data', 'db.json');
const DB_PATH = isVercel ? join('/tmp', 'db.json') : BUNDLED_DB_PATH;
const LOCK_FILE = isVercel ? join('/tmp', 'db.json.lock') : join(process.cwd(), 'data', 'db.json.lock');

// Ensure database folder exists locally
if (!isVercel && !fs.existsSync(join(process.cwd(), 'data'))) {
    fs.mkdirSync(join(process.cwd(), 'data'), { recursive: true });
}

let pool: any = null;

export const getPool = () => {
    if (pool) return pool;

    if (process.env.DATABASE_URL) {
        try {
            let dbUrl = process.env.DATABASE_URL.trim();
            if (dbUrl) {
                if (dbUrl.includes('sslmode=')) {
                    // Explicitly use sslmode=require to avoid insecure fallback warning while allowing rejectUnauthorized: false to work correctly
                    dbUrl = dbUrl.replace(/sslmode=[^&]+/g, 'sslmode=require');
                } else {
                    if (dbUrl.includes('?')) {
                        dbUrl += '&sslmode=require';
                    } else {
                        dbUrl += '?sslmode=require';
                    }
                }
                // Add uselibpqcompat=true to eliminate security warnings about upcoming pg SSL behavior changes
                if (!dbUrl.includes('uselibpqcompat=')) {
                    dbUrl += '&uselibpqcompat=true';
                }
            }

            pool = new Pool({
                connectionString: dbUrl,
                ssl: {
                    rejectUnauthorized: false
                },
                connectionTimeoutMillis: 10000, 
                idleTimeoutMillis: 20000,
                max: 10
            });
            
            // Handle unexpected errors on idle clients to prevent unhandled exception crash
            pool.on('error', (err: any) => {
                console.error('[DATABASE_POOL_ERROR] Unexpected error on idle pg client / pool:', err);
                pool = null; // Mark pool for dynamic recreation on subsequent query
            });

            console.log("Database initialized: Cloud PostgreSQL Connection Pool configured successfully with serverless-optimized settings.");
        } catch (poolErr) {
            console.error("Failed to initialize remote cloud PostgreSQL connection pool:", poolErr);
            pool = null;
        }
    }
    return pool;
};

// Helper to execute cloud queries with automatic socket reconnection and single-retry fallback on connection termination
export const executeCloudQuery = async (text: string, params?: any[]): Promise<any> => {
    const activePool = getPool();
    if (!activePool) {
        throw new Error("No cloud database is configured.");
    }

    try {
        return await activePool.query(text, params);
    } catch (err: any) {
        const errMsg = err.message || '';
        const isConnectionError = 
            errMsg.includes('terminated') || 
            errMsg.includes('timeout') || 
            errMsg.includes('EPIPE') || 
            errMsg.includes('ECONNRESET') || 
            errMsg.includes('socket') || 
            err.code === '08006' || 
            err.code === '08001' || 
            err.code === '08004' || 
            err.code === '08P01';

        if (isConnectionError) {
            console.warn(`[DATABASE_QUERY_RETRY] Connection issue detected: "${errMsg}". Re-creating connection pool and retrying query...`);
            
            // Gracefully end the stale connection pool
            try {
                if (pool) {
                    await pool.end().catch(() => {});
                }
            } catch (endErr) {}
            pool = null;

            const newPool = getPool();
            if (!newPool) {
                throw new Error("Failed to re-initialize cloud database pool during retry.");
            }
            
            // Retry the query exactly once
            return await newPool.query(text, params);
        }

        throw err;
    }
};

let isDbSynced = false;
let isSyncing = false;
let syncPromise: Promise<void> | null = null;
let lastSyncAttemptTime = 0;
const SYNC_RETRY_COOLDOWN = 10000; // 10 seconds cooldown between synchronization retries

// Cloud Database Initialization and Synchronization Loader
export const initAndSyncDatabase = async () => {
    if (isDbSynced) return;

    const now = Date.now();
    // If a sync attempt recently failed, enforce a small cooldown before attempting to sync from the cloud database again, 
    // allowing the system to use local cached state gracefully without blocking the current client request with socket timeouts.
    if (now - lastSyncAttemptTime < SYNC_RETRY_COOLDOWN) {
        console.warn("[DB SYNC] Postponing cloud PostgreSQL synchronization: in retry cooldown. Falling back to local ledger cache.");
        return;
    }

    if (isSyncing && syncPromise) {
        return syncPromise;
    }

    isSyncing = true;
    lastSyncAttemptTime = now;
    syncPromise = (async () => {
        const activePool = getPool();
        if (!activePool) {
            console.log("No cloud DATABASE_URL is configured. Operating purely in local JSON storage file mode.");
            isDbSynced = true;
            isSyncing = false;
            return;
        }

        try {
            console.log("Synchronizing active DB snapshot with remote PostgreSQL cloud storage...");
            // Ensure table exists
            await executeCloudQuery(`
                CREATE TABLE IF NOT EXISTS yeedem_db (
                    key VARCHAR(50) PRIMARY KEY,
                    data JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Check if active_db row exists
            const res = await executeCloudQuery(`SELECT data FROM yeedem_db WHERE key = 'active_db'`);
            if (res.rows.length > 0) {
                const dbData = res.rows[0].data;
                if (dbData && typeof dbData === 'object') {
                    let localData: any = null;
                    if (fs.existsSync(DB_PATH)) {
                        try {
                            const content = fs.readFileSync(DB_PATH, 'utf-8');
                            localData = content ? JSON.parse(content) : null;
                        } catch (e) {}
                    }

                    const localUserCount = (localData && Array.isArray(localData.users)) ? localData.users.length : 0;
                    const cloudUserCount = (dbData && Array.isArray(dbData.users)) ? dbData.users.length : 0;
                    const localSessionCount = (localData && Array.isArray(localData.merchantSessions)) ? localData.merchantSessions.length : 0;
                    const cloudSessionCount = (dbData && Array.isArray(dbData.merchantSessions)) ? dbData.merchantSessions.length : 0;

                    // Merge instead of raw overwrite to protect accounts/sessions from being deleted on sync/refresh
                    if (localUserCount > cloudUserCount || (localUserCount === cloudUserCount && localSessionCount > cloudSessionCount)) {
                        console.log(`[DB SYNC] Local DB has more users/sessions (${localUserCount}/${localSessionCount}) than cloud DB (${cloudUserCount}/${cloudSessionCount}). Saving local to cloud to prevent loss.`);
                        await executeCloudQuery(
                            `INSERT INTO yeedem_db (key, data, updated_at) 
                             VALUES ('active_db', $1, NOW()) 
                             ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
                            [JSON.stringify(localData)]
                        );
                    } else {
                        const mergedData = { ...dbData };
                        if (localData) {
                            // Merge users: keep all unique users by ID
                            const userMap = new Map();
                            (dbData.users || []).forEach((u: any) => userMap.set(u.id, u));
                            (localData.users || []).forEach((u: any) => {
                                if (!userMap.has(u.id)) {
                                    userMap.set(u.id, u);
                                }
                            });
                            mergedData.users = Array.from(userMap.values());

                            // Merge merchantSessions: keep all unique sessions by session_id
                            const sessionMap = new Map();
                            (dbData.merchantSessions || []).forEach((s: any) => sessionMap.set(s.session_id, s));
                            (localData.merchantSessions || []).forEach((s: any) => {
                                if (!sessionMap.has(s.session_id)) {
                                    sessionMap.set(s.session_id, s);
                                }
                            });
                            mergedData.merchantSessions = Array.from(sessionMap.values());

                            // Merge staff
                            const staffMap = new Map();
                            (dbData.staff || []).forEach((s: any) => staffMap.set(s.id, s));
                            (localData.staff || []).forEach((s: any) => {
                                if (!staffMap.has(s.id)) {
                                    staffMap.set(s.id, s);
                                }
                            });
                            mergedData.staff = Array.from(staffMap.values());

                            if (Array.isArray(localData.anonymousTrialTrackers)) {
                                mergedData.anonymousTrialTrackers = [...(dbData.anonymousTrialTrackers || []), ...localData.anonymousTrialTrackers.filter((item: any) => 
                                    !(dbData.anonymousTrialTrackers || []).some((cloudItem: any) => cloudItem.id === item.id)
                                )];
                            }
                        }

                        fs.writeFileSync(DB_PATH, JSON.stringify(mergedData, null, 2), 'utf-8');
                        console.log("Successfully synchronized active DB from remote cloud PostgreSQL (with intelligent merge).");

                        // Upload back if we merged new local data
                        const finalMergedUserCount = mergedData.users.length;
                        const finalMergedSessionCount = mergedData.merchantSessions.length;
                        if (finalMergedUserCount > cloudUserCount || finalMergedSessionCount > cloudSessionCount) {
                            console.log(`[DB SYNC] Uploading merged dataset back to remote cloud PostgreSQL.`);
                            await executeCloudQuery(
                                `INSERT INTO yeedem_db (key, data, updated_at) 
                                 VALUES ('active_db', $1, NOW()) 
                                 ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
                                [JSON.stringify(mergedData)]
                            ).catch((err: any) => console.error("Failed to write back merged DB to cloud:", err));
                        }
                    }
                }
            } else {
                // First run: Seed cloud PostgreSQL from existing local DB
                const content = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '';
                let currentData;
                try {
                    currentData = content ? JSON.parse(content) : null;
                } catch (e) {
                    currentData = null;
                }
                if (!currentData) {
                    currentData = {
                        anonymousTrialTrackers: [],
                        users: [],
                        merchantSessions: [],
                        staffActivityLogs: [],
                        staff: []
                    };
                }
                await executeCloudQuery(
                    `INSERT INTO yeedem_db (key, data) VALUES ('active_db', $1) ON CONFLICT (key) DO UPDATE SET data = $1`,
                    [JSON.stringify(currentData)]
                );
                fs.writeFileSync(DB_PATH, JSON.stringify(currentData, null, 2), 'utf-8');
                console.log("Successfully seeded brand-new remote cloud PostgreSQL records.");
            }
            isDbSynced = true;
        } catch (err) {
            console.error("Failed to sync database from cloud PostgreSQL, using local fallback filesystem state:", err);
            // Crucial: do NOT permanently lock isDbSynced to true if sync fails.
            // This prevents freezing the container in a permanently un-synchronized state which causes users to get logged out.
        } finally {
            isSyncing = false;
        }
    })();

    return syncPromise;
};

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
        
        // Asynchronously backup changes to cloud PostgreSQL storage if configured and initial sync is complete
        const activePool = getPool();
        if (activePool && isDbSynced) {
            executeCloudQuery(
                `INSERT INTO yeedem_db (key, data, updated_at) 
                 VALUES ('active_db', $1, NOW()) 
                 ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
                [JSON.stringify(data)]
            ).catch((err: any) => {
                console.error("Remote cloud PostgreSQL replication update mismatch:", err);
            });
        } else if (activePool && !isDbSynced) {
            console.warn("[DB SYNC] Postponing cloud PostgreSQL replication update: Initial synchronization is still in progress.");
            // Trigger synchronization in case it got stuck or hasn't completed yet
            initAndSyncDatabase().catch((syncErr) => {
                console.error("[DB SYNC] Delayed synchronization attempt failed:", syncErr);
            });
        }
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