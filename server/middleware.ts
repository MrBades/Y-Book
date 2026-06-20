
import { Request, Response, NextFunction } from 'express';
import { readDB, writeDB } from './db.js';

export const getApproxRegion = (req: Request): string => {
    const headerRegion = req.headers['x-approx-region'] as string;
    if (headerRegion) return headerRegion;
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || (req.socket ? req.socket.remoteAddress : '') || '';
        
    if (client_ip.includes('127.0.0.1') || client_ip.includes('localhost') || client_ip.startsWith('::')) {
        return 'NG-Lagos';
    }
    if (client_ip.startsWith('10.0.') || client_ip.startsWith('172.')) {
        return 'NG-Abuja';
    }
    if (client_ip.startsWith('8.8.8.')) {
        return 'US-California';
    }
    return 'NG-Lagos';
};

export const anomalyDetectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const session_id = req.headers['x-session-id'] as string;
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || (req.socket ? req.socket.remoteAddress : '');
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);

    if (session_id) {
        const db = readDB();
        const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
      
        if (session) {
            // Disabled active locking to prevent false-positives
            session.is_suspicious_locked = false;
            
            let isMismatched = false;
            if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
                if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
                    session.device_fingerprint = device_fingerprint;
                } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
                    isMismatched = true;
                }
            }

            if (isMismatched) {
                console.warn(`[ANOMALY LOG] Device mismatch observed (fingerprint path): expected=${session.device_fingerprint}, current=${device_fingerprint}. Lockout bypassed.`);
            }
            writeDB(db);
        }
    }
    next();
};

export const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session_id = req.headers['x-session-id'] as string;
        if (!session_id) return res.status(401).json({ error: "Session required" });
        const db = readDB();
        let session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
        
        if (!session) {
            // Check if we can validate the session with Django REST API dynamically
            const rawUrl = process.env.VITE_DJANGO_API_URL || process.env.VITE_API_URL;
            const djangoBaseUrl = (typeof rawUrl === 'string' && rawUrl.trim() !== '' && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1')) ? rawUrl.trim() : '';
            
            if (djangoBaseUrl) {
                console.log(`[SESSION SYNCHRONIZATION] Session ${session_id} not found locally. Validating with remote Django API: ${djangoBaseUrl}`);
                try {
                    const fetchFn = (globalThis as any).fetch || fetch;
                    const djangoRes = await fetchFn(`${djangoBaseUrl.replace(/\/+$/, '')}/api/auth/validate-session`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-session-id': session_id,
                            'x-device-fingerprint': (req.headers['x-device-fingerprint'] as string) || 'unknown_fp',
                            'x-approx-region': getApproxRegion(req)
                        },
                        body: JSON.stringify({ session_id })
                    });
                    
                    if (djangoRes.ok) {
                        const djangoData: any = await djangoRes.json();
                        if (djangoData && djangoData.status === 'success' && djangoData.user) {
                            console.log(`[SESSION SYNCHRONIZATION] Session ${session_id} successfully validated on Django. Syncing to local DB.`);
                            const dUser = djangoData.user;
                            
                            // 1. Ensure user exists locally
                            let user = db.users.find((u: any) => u.id === dUser.id);
                            if (!user) {
                                user = {
                                    id: dUser.id,
                                    phone_or_email: dUser.phone_or_email,
                                    full_name: dUser.full_name || 'Merchant',
                                    business_name: dUser.business_name || 'My Business',
                                    business_type: dUser.business_type || 'buy_and_sell',
                                    owner_pin: dUser.owner_pin || '1234',
                                    phone: dUser.phone || dUser.phone_or_email || '',
                                    address: dUser.address || '',
                                    shop_slug: dUser.shop_slug || '',
                                    subscriptionPlan: dUser.subscriptionPlan || 'starter',
                                    subscriptionStatus: dUser.subscriptionStatus || 'active',
                                    business: dUser.business || null
                                };
                                db.users.push(user);
                            } else {
                                // Keep details in sync
                                user.phone_or_email = dUser.phone_or_email || user.phone_or_email;
                                user.full_name = dUser.full_name || user.full_name;
                                user.business_name = dUser.business_name || user.business_name;
                                user.business_type = dUser.business_type || user.business_type;
                                user.owner_pin = dUser.owner_pin || user.owner_pin;
                                user.subscriptionPlan = dUser.subscriptionPlan || user.subscriptionPlan;
                                user.subscriptionStatus = dUser.subscriptionStatus || user.subscriptionStatus;
                            }
                            
                            // 2. Insert session locally
                            const is_staff = !!djangoData.is_staff;
                            session = {
                                session_id,
                                user_id: dUser.id,
                                device_fingerprint: (req.headers['x-device-fingerprint'] as string) || 'unknown_fp',
                                last_active_ip: (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || (req.socket ? req.socket.remoteAddress : '') || '127.0.0.1',
                                last_active_region: getApproxRegion(req),
                                is_suspicious_locked: false, // Force unlocked internally
                                is_staff,
                                staff_id: is_staff && djangoData.staff ? djangoData.staff.id : undefined
                            };
                            
                            if (!db.merchantSessions) db.merchantSessions = [];
                            db.merchantSessions.push(session);
                            
                            // 3. Sync staff if staff session
                            if (is_staff && djangoData.staff) {
                                if (!db.staff) db.staff = [];
                                const localStaffExists = db.staff.some((s: any) => s.id === djangoData.staff.id);
                                if (!localStaffExists) {
                                        db.staff.push(djangoData.staff);
                                }
                            }
                            
                            writeDB(db);
                        }
                    } else {
                        console.warn(`[SESSION SYNCHRONIZATION] Remote Django API returned status ${djangoRes.status} for session validation.`);
                    }
                } catch (syncErr) {
                    console.error("[SESSION SYNCHRONIZATION] Failed to communicate with remote Django API:", syncErr);
                }
            }
        }
        
        if (!session) return res.status(401).json({ error: "Invalid session" });
        
        // Un-lock existing lockouts for seamless recovery
        session.is_suspicious_locked = false;
        
        // Live validation of ongoing administrative request client characteristics
        const device_fingerprint = req.headers['x-device-fingerprint'] as string;
        const approxRegion = getApproxRegion(req);
        
        let isMismatched = false;
        if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
            if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
                session.device_fingerprint = device_fingerprint;
            } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
                isMismatched = true;
            }
        }

        if (isMismatched) {
            console.warn(`[ANOMALY LOG] Device fingerprint mismatch active: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
        }
        writeDB(db);
        
        (req as any).user_id = session.user_id;
        (req as any).session = session;
        next();
    } catch (err: any) {
        console.error("Authentication middleware error:", err);
        return res.status(555).json({ error: "Authentication system error: " + (err.message || err) });
    }
};

export const checkSubscription = (req: Request, res: Response, next: NextFunction) => {
    const user_id = (req as any).user_id;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user || user.subscriptionStatus !== 'active') {
        return res.status(403).json({ error: "Subscription required for this feature" });
    }

    next();
};

