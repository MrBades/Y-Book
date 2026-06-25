import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Paystack from 'paystack';
import { anomalyDetectionMiddleware, requireSession, getApproxRegion } from "./server/middleware.js";
import { readDB, writeDB, initAndSyncDatabase } from "./server/db.js";

dotenv.config();

// Safely log the Vercel-ready reference template block on startup
console.log(`
================================================================================
🚀 VERCEL / PRODUCTION ENVIRONMENT CONFIGURATION SCHEMA REFERENCE 🚀
================================================================================
Copy and paste the configuration block below into your Vercel Environment
Variables settings:

GEMINI_API_KEY="${process.env.GEMINI_API_KEY ? '(already_configured_locally)' : 'MY_GEMINI_API_KEY'}"
AI_API_KEY_OVERRIDE="${process.env.AI_API_KEY_OVERRIDE || ''}"
APP_URL="${process.env.APP_URL || 'https://your-yeedem-app-domain.vercel.app'}"
VITE_DJANGO_API_URL="${process.env.VITE_DJANGO_API_URL || 'https://your-django-backend-url.vercel.app'}"
VITE_API_URL="${process.env.VITE_API_URL || 'https://your-yeedem-app-domain.vercel.app'}"
WHATSAPP_VERIFY_TOKEN="${process.env.WHATSAPP_VERIFY_TOKEN || 'yeedem_verification_token'}"
PAYSTACK_PUBLIC_KEY="${process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_...'}"
PAYSTACK_SECRET_KEY="${process.env.PAYSTACK_SECRET_KEY || 'sk_live_...'}"
RESEND_API_KEY="${process.env.RESEND_API_KEY || 're_...'}"
RESEND_FROM="${process.env.RESEND_FROM || 'Yeedem Books <noreply@yeedem.com>'}"
GOOGLE_CLIENT_ID="${process.env.GOOGLE_CLIENT_ID || ''}"
GOOGLE_CLIENT_SECRET="${process.env.GOOGLE_CLIENT_SECRET || ''}"
================================================================================
`);

// Diagnostic logging of environment keys to troubleshoot Google OAuth credentials
console.log("[Google OAuth Setup Diagnostic] Available environment variables:");
Object.keys(process.env).forEach(key => {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("google") || keyLower.includes("client") || keyLower.includes("oauth") || keyLower.includes("secret")) {
        const value = process.env[key] || "";
        const cleanedValue = value.replace(/^["']|["']$/g, '').trim();
        console.log(`  - ${key}: exists=true, len=${value.length}, cleaned_len=${cleanedValue.length}, preview="${cleanedValue.substring(0, 5)}..."`);
    }
});

let paystackClient: any = null;
function getPaystack() {
  if (!paystackClient) {
    const rawKey = process.env.PAYSTACK_SECRET_KEY || '';
    const key = rawKey.replace(/^["']|["']$/g, '').trim();
    const PaystackLib = typeof Paystack === 'function' ? Paystack : (Paystack as any).default;
    if (typeof PaystackLib !== 'function') {
      console.error('Paystack library default export is not a function');
      return {
        transaction: {
          initialize: async () => { throw new Error('Paystack could not be initialized'); },
          verify: async () => { throw new Error('Paystack could not be initialized'); }
        }
      };
    }
    paystackClient = PaystackLib(key);
  }
  return paystackClient;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function getResendApiKey() {
    return process.env.RESEND_API_KEY || "";
}

// CORS & Preflight handling middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id, x-device-fingerprint, x-approx-region');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Auto-synchronize local cached DB state with external PostgreSQL cloud storage under serverless/Vercel environments
app.use((req, res, next) => {
    // Fire-and-forget sync in the background so we NEVER block HTTP requests (especially on TLS timeouts/cold starts)
    initAndSyncDatabase().catch(err => {
        console.error("Background cloud database synchronization warning:", err);
    });
    next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy check of Gemini AI client
let ai: GoogleGenAI | null = null;
if (process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// All API routes
app.use("/api/admin/*", anomalyDetectionMiddleware);

app.post("/api/guest/invoice-generate", (req, res) => {
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(400).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    
    writeDB(db);
    res.json({ status: "success", count: tracker.invoice_count });
});

function normalizeContact(phone_or_email: any): string {
    if (typeof phone_or_email !== "string") return "";
    let input = phone_or_email.trim();
    const cleanPhoneCheck = input.replace(/[\s\-\(\)]/g, "");
    const isEmail = input.includes("@") && input.includes(".");
    const isPhone = /^\+?[0-9]{8,15}$/.test(cleanPhoneCheck);

    if (isPhone && !isEmail) {
        if (cleanPhoneCheck.startsWith("0") && cleanPhoneCheck.length === 11) {
            return "+234" + cleanPhoneCheck.slice(1);
        } else if (!cleanPhoneCheck.startsWith("+") && !cleanPhoneCheck.startsWith("0") && cleanPhoneCheck.length === 10) {
            return "+234" + cleanPhoneCheck;
        } else {
            return (cleanPhoneCheck.startsWith("+") ? "+" : "") + cleanPhoneCheck.replace(/\D/g, "");
        }
    }
    return input.toLowerCase();
}

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/api/auth/initiate", async (req, res) => {
    const { phone_or_email: raw_input } = req.body;
    if (!raw_input || typeof raw_input !== "string" || !raw_input.trim()) {
        return res.status(400).json({ error: "Please enter your email or phone number." });
    }
    
    const input = raw_input.trim();
    const isEmail = input.includes("@") && input.includes(".");
    const db = readDB();
    
    if (isEmail) {
        // Email Authentication Flow via Resend SDK
        const email = normalizeContact(input);
        const { force_magic_link } = req.body;
        
        const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === email || (u.email && normalizeContact(u.email) === email));
        
        if (user && user.owner_pin && !force_magic_link) {
            return res.json({
                status: "success",
                method: "pin",
                newUser: false,
                hasPin: true
            });
        }

        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const isReset = !!force_magic_link;
        
        db.emailVerifications = db.emailVerifications || [];
        db.emailVerifications = db.emailVerifications.filter((v: any) => normalizeContact(v.email) !== email);
        db.emailVerifications.push({
            email,
            token,
            isReset,
            expiresAt: Date.now() + 600000 // 10 minutes
        });
        
        writeDB(db);
        
        let callbackUrl = "";
        if (process.env.APP_URL) {
            const cleanAppUrl = process.env.APP_URL.replace(/\/$/, "");
            callbackUrl = `${cleanAppUrl}/api/auth/callback?token=${token}`;
        } else if (process.env.VITE_API_URL) {
            const cleanApiUrl = process.env.VITE_API_URL.replace(/\/$/, "");
            callbackUrl = `${cleanApiUrl}/api/auth/callback?token=${token}`;
        } else {
            const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
            const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
            callbackUrl = `${protocol}://${host}/api/auth/callback?token=${token}`;
        }
        
        const apiKey = getResendApiKey();
        if (apiKey) {
            const subjectField = isReset ? 'Reset your Yeedem Books security PIN' : 'Verify your Yeedem Books Account';
            const titleField = isReset ? 'Reset Your Security PIN' : 'Verify Your Email Address';
            const bodyField = isReset 
                ? 'We received a request to reset your Yeedem Books account security PIN. Click the button below to complete your PIN reset safely.'
                : 'You requested a verification link for your Yeedem Books account. Click the button below to instantly verify your email and complete your setup.';
            const buttonLabelField = isReset ? 'Reset Security PIN' : 'Confirm Email Address';

            const emailHtml = isReset 
                ? `
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; color: #333; line-height: 1.6;">
                          <h2 style="color: #0070f3; margin-bottom: 10px;">Yeedem Books PIN Recovery</h2>
                          <p style="font-size: 16px;">Hello,</p>
                          <p>${bodyField}</p>
                          <div style="margin: 30px 0;">
                            <a href="${callbackUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                              ${buttonLabelField}
                            </a>
                          </div>
                          <p style="font-size: 12px; color: #666;">This recovery link is active for 10 minutes. If you did not request a security PIN reset, please ignore this email.</p>
                          <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                          <p style="font-size: 12px; color: #0070f3; word-break: break-all;">${callbackUrl}</p>
                          <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                          <p style="font-size: 11px; color: #999;">Automated security notification email from Yeedem Books. Please do not reply.</p>
                        </div>
                    `
                : `
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; color: #333; line-height: 1.6;">
                          <h2 style="color: #333; margin-bottom: 10px;">Welcome to Yeedem Books!</h2>
                          <p style="font-size: 16px;">Hello,</p>
                          <p>${bodyField}</p>
                          <div style="margin: 30px 0;">
                            <a href="${callbackUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                              ${buttonLabelField}
                            </a>
                          </div>
                          <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                          <p style="font-size: 12px; color: #0070f3; word-break: break-all;">${callbackUrl}</p>
                          <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                          <p style="font-size: 11px; color: #999;">This is an automated system email, please do not reply directly to this message.</p>
                        </div>
                    `;

            try {
                const { Resend } = await import("resend");
                const resend = new Resend(apiKey);
                const fromEmail = process.env.RESEND_FROM || 'Yeedem Books <noreply@yeedem.com>';
                console.log(`[RESEND] Attempting to dispatch verification email to: ${email} from: ${fromEmail}`);
                const response_data = await resend.emails.send({
                    from: fromEmail,
                    to: [email],
                    subject: subjectField,
                    html: emailHtml
                });

                const isProduction = process.env.NODE_ENV === 'production' || (!!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "");

                  if (response_data && response_data.error) {
                    console.log("[Resend Notice] Resend validation or domain checking feedback:", response_data.error.message || response_data.error.name || response_data.error);
                    if (isProduction) {
                        const errMsgText = `Failed to deliver email verification: ${response_data.error.message || response_data.error.name || "Restriction or validation failure."}`;
                        return res.status(400).json({
                            status: "error",
                            error: errMsgText,
                            message: errMsgText
                        });
                    } else {
                        return res.json({
                            status: "success",
                            method: "email",
                            message: `We attempted to send a verification email, but a Resend API notice occurred (${response_data.error.message || response_data.error.name}). In development/sandbox mode, you can use the direct link below.`,
                            debugUrl: callbackUrl
                        });
                    }
                }

                console.log(`[RESEND] Email verification link successfully dispatched to ${email}.`);
            } catch (err: any) {
                console.warn("[WARNING] Failed to send verification email:", err.message || String(err));
                const isProduction = process.env.NODE_ENV === 'production' || (!!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "");
                if (isProduction) {
                    const errMsgText = `Failed to dispatch verification email: ${err.message || "Email gateway error."}`;
                    return res.status(500).json({
                        status: "error",
                        error: errMsgText,
                        message: errMsgText
                    });
                }
                return res.json({
                    status: "success",
                    method: "email",
                    message: "Verification email dispatch failed. You can proceed with the development link below.",
                    debugUrl: callbackUrl
                });
            }
        } else {
            console.warn("[WARNING] RESEND_API_KEY environment variable is not defined.");
        }
        
        const isProduction = process.env.NODE_ENV === 'production' || (!!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "");
        return res.json({
            status: "success",
            method: "email",
            message: "We have sent an email verification link to your email. Click to verify.",
            debugUrl: (isProduction || !!process.env.RESEND_API_KEY) ? undefined : callbackUrl
        });
    } else {
        // Phone Authentication: WhatsApp Flow fallback
        const phone = normalizeContact(input);
        let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone);
        
        if (!user) {
            user = { id: Date.now().toString(), phone_or_email: phone, otp_secret: "1234" };
            db.users.push(user);
        }
        
        if (!db.whatsappVerifications) db.whatsappVerifications = [];
        const verificationCode = generateOTP();
        const expiresAt = Date.now() + 180000; // 3 minutes
        
        db.whatsappVerifications = db.whatsappVerifications.filter((v: any) => v.phone !== phone);
        db.whatsappVerifications.push({ phone, code: verificationCode, status: 'pending', expiresAt });
        
        writeDB(db);
        
        const isNewUser = !user.full_name;
        const hasPin = !!user.owner_pin;
        
        return res.json({
            status: "success",
            method: "phone",
            newUser: isNewUser,
            hasPin: hasPin,
            verificationCode: verificationCode
        });
    }
});

app.post("/api/auth/skip-verification", (req, res) => {
    return res.status(403).json({ error: "Bypassing verification is disabled to prevent unauthorized account access. Please log in securely via Google OAuth, real email verification, or WhatsApp." });
});

app.get("/api/auth/callback", (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send("Verification token is missing.");
    }
    const db = readDB();
    if (!db.emailVerifications) db.emailVerifications = [];
    
    // Validate session token
    const index = db.emailVerifications.findIndex((v: any) => v.token === String(token) && v.expiresAt > Date.now());
    if (index === -1) {
        return res.status(400).send(`
            <html>
                <head>
                    <title>Link Expired - Yeedem Books</title>
                    <style>
                        body { font-family: sans-serif; background: #0E1338; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; text-align: center; }
                        h1 { color: #FF4D4D; }
                        a { color: #00A6FF; text-decoration: none; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Link Expired or used</h1>
                        <p>This verification link has expired or has already been used. Please request a new verification link from the app.</p>
                        <a href="/">Go to App</a>
                    </div>
                </body>
            </html>
        `);
    }
    
    const verification = db.emailVerifications[index];
    const email = normalizeContact(verification.email);
    
    // Enforce single-use validation
    db.emailVerifications.splice(index, 1);
    
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === email);
    if (!user) {
        user = {
            id: Date.now().toString(),
            phone_or_email: email,
            isVerified: true
        };
        db.users.push(user);
    } else {
        user.isVerified = true;
    }
    
    // Issue token/session
    const session_id = "se_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    db.merchantSessions = db.merchantSessions || [];
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    const approxRegion = getApproxRegion(req as any);
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        
    db.merchantSessions.push({
        session_id,
        user_id: user.id,
        device_fingerprint: 'unknown_fp',
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    });
    
    writeDB(db);
    
    const isReset = !!verification.isReset;
    res.redirect(`/?session_id=${session_id}&phone_or_email=${encodeURIComponent(email)}${isReset ? '&is_reset=true' : ''}`);
});

app.get("/api/auth/diagnostic-env", (req, res) => {
    const envKeys: Record<string, { exists: boolean, length: number, preview: string }> = {};
    Object.keys(process.env).forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes("google") || keyLower.includes("client") || keyLower.includes("oauth") || keyLower.includes("secret")) {
            const val = process.env[key] || "";
            const cleaned = val.replace(/^["']|["']$/g, '').trim();
            envKeys[key] = {
                exists: val.length > 0,
                length: cleaned.length,
                preview: cleaned.length > 4 ? `${cleaned.substring(0, 2)}...` : "..."
            };
        }
    });
    res.json({ envKeys });
});

app.get("/api/auth/google", (req, res) => {
    const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") : (() => {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
        return `${protocol}://${host}`;
    })();
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    
    // Support dynamic email query parameter or fallback to the standard email
    const emailParam = req.query.email ? req.query.email.toString().trim() : "";
    const hasEmailParam = emailParam.includes('@');
    const targetEmailLower = hasEmailParam ? emailParam.toLowerCase() : "";
    
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "").trim();
    
    console.log("[Google OAuth] checking credentials present:", {
        has_clientId: !!clientId,
        clientId_len: clientId.length,
        has_clientSecret: !!clientSecret,
        clientSecret_len: clientSecret.length
    });
    
    if (clientId && clientSecret) {
        let oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent("openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email")}` +
            `&state=google_auth_state_yeedem` +
            `&prompt=select_account`;
            
        if (hasEmailParam) {
            oauthUrl += `&login_hint=${encodeURIComponent(targetEmailLower)}`;
        }
        return res.redirect(oauthUrl);
    }
    
    // High-fidelity Mock Google Sign-In Portal for flawless simulation in local and previews
    const db = readDB();
    const registeredEmails = new Set<string>();
    
    if (hasEmailParam) {
        registeredEmails.add(targetEmailLower);
    }
    
    // Include emails from database to populate realistic options
    if (db.users && Array.isArray(db.users)) {
        db.users.forEach((u: any) => {
            if (u.email && u.email.includes('@')) {
                registeredEmails.add(u.email.toLowerCase().trim());
            }
            if (u.phone_or_email && u.phone_or_email.includes('@')) {
                registeredEmails.add(u.phone_or_email.toLowerCase().trim());
            }
        });
    }
    
    // Fallback to provide sulemanbades@gmail.com and clean test options
    registeredEmails.add("sulemanbades@gmail.com");
    
    const accounts = Array.from(registeredEmails).slice(0, 4).map(email => {
        let name = email.split('@')[0];
        name = name.charAt(0).toUpperCase() + name.slice(1);
        if (email === "sulemanbades@gmail.com") {
            name = "Suleman bades";
        }
        return { name, email };
    });

    const accountsHtml = accounts.map((acc, index) => {
        const initial = (acc.name || acc.email || 'U')[0].toUpperCase();
        const bgColor = '#1a73e8'; // Google Blue avatar for clean professional native styling
        
        return `
        <a href="/api/auth/google/mock-verify?email=${encodeURIComponent(acc.email)}" class="account-item">
          <div class="avatar" style="background-color: ${bgColor}; color: #ffffff;">${initial}</div>
          <div class="account-details">
            <p class="account-name">${acc.name}</p>
            <p class="account-email">${acc.email}</p>
          </div>
        </a>
        `;
    }).join('\n');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sign in - Google Accounts</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #131314;
      color: #e3e3e3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .container {
      border: 1px solid #444746;
      background: #1e1f20;
      border-radius: 12px;
      max-width: 450px;
      width: 100%;
      padding: 40px;
      box-sizing: border-box;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .logo {
      height: 28px;
      margin-bottom: 16px;
      font-weight: bold;
      font-size: 24px;
      letter-spacing: -0.5px;
    }
    .logo span:nth-child(1) { color: #4285F4; }
    .logo span:nth-child(2) { color: #EA4335; }
    .logo span:nth-child(3) { color: #FBBC05; }
    .logo span:nth-child(4) { color: #4285F4; }
    .logo span:nth-child(5) { color: #34A853; }
    .logo span:nth-child(6) { color: #EA4335; }
    
    h1 {
      font-size: 24px;
      font-weight: 400;
      margin: 0 0 8px 0;
      color: #e3e3e3;
    }
    .subtitle {
      font-size: 14px;
      margin: 0 0 32px 0;
      color: #c4c7c5;
    }
    .subtitle a {
      color: #a8c7fa;
      text-decoration: none;
      font-weight: 500;
    }
    
    /* Accounts list */
    .accounts-list {
      text-align: left;
      margin-bottom: 16px;
      max-height: 320px;
      overflow-y: auto;
    }
    .account-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid #454746;
      cursor: pointer;
      transition: background-color 0.2s ease;
      text-decoration: none;
      color: inherit;
    }
    .account-item:hover {
      background-color: #2d2e30;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 500;
      margin-right: 14px;
      text-transform: uppercase;
    }
    .account-details {
      flex: 1;
    }
    .account-name {
      font-size: 14px;
      font-weight: 500;
      color: #e3e3e3;
      margin: 0;
    }
    .account-email {
      font-size: 12px;
      color: #c4c7c5;
      margin: 2px 0 0 0;
    }
    
    /* Another account or back */
    .action-row {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-top: 1px solid #454746;
      cursor: pointer;
      color: #a8c7fa;
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      transition: background-color 0.2s ease;
    }
    .action-row:hover {
      background-color: #2d2e30;
    }
    .action-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #454746;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 14px;
      color: #c4c7c5;
    }
    
    /* Manual entry */
    .hidden {
      display: none !important;
    }
    .manual-container {
      text-align: left;
    }
    .input-group {
      position: relative;
      margin-bottom: 24px;
    }
    input {
      width: 100%;
      padding: 16px;
      font-size: 16px;
      border: 1px solid #8e918f;
      background: transparent;
      color: #e3e3e3;
      border-radius: 4px;
      box-sizing: border-box;
      outline: none;
    }
    input:focus {
      border-color: #a8c7fa;
    }
    .btn-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 30px;
    }
    .btn-back {
      color: #a8c7fa;
      background: none;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
    }
    .btn-next {
      background: #a8c7fa;
      color: #001d35;
      border: none;
      border-radius: 100px;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-next:hover {
      background: #c2e7ff;
    }
    
    .footer-text {
      font-size: 11px;
      color: #9aa0a6;
      margin-top: 24px;
      line-height: 1.4;
      text-align: left;
      border-top: 1px solid #454746;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span>
    </div>
    
    <!-- ACCOUNT CHOOSER STEP -->
    <div id="chooser-section">
      <h1>Choose an account</h1>
      <p class="subtitle">to continue to <a href="#">yeedem.com</a></p>
      
      <div class="accounts-list">
        ${accountsHtml}
      </div>
      
      <div class="action-row" onclick="showManualSection()">
        <div class="action-icon">
          <svg style="width: 18px; height: 18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <span>Use another account</span>
      </div>
    </div>
    
    <!-- MANUAL INPUT STEP -->
    <div id="manual-section" class="hidden">
      <h1>Sign in</h1>
      <p class="subtitle">with your Google Account</p>
      <form action="/api/auth/google/mock-verify" method="GET" class="manual-container">
        <div class="input-group">
          <input type="email" name="email" id="manual-email" required placeholder="Enter your Gmail address">
        </div>
        <div class="btn-group">
          <button type="button" class="btn-back" onclick="showChooserSection()">Back</button>
          <button type="submit" class="btn-next">Next</button>
        </div>
      </form>
    </div>
    
    <div class="footer-text">
      To continue, Google will share your name, email address, language preference, and profile picture with Yeedem Books.
    </div>
  </div>

  <script>
    function showManualSection() {
      document.getElementById('chooser-section').classList.add('hidden');
      document.getElementById('manual-section').classList.remove('hidden');
      document.getElementById('manual-email').focus();
    }
    function showChooserSection() {
      document.getElementById('manual-section').classList.add('hidden');
      document.getElementById('chooser-section').classList.remove('hidden');
    }
  </script>
</body>
</html>
    `);
});

app.get("/api/auth/google/mock-verify", (req, res) => {
    let email = req.query.email as string;
    if (!email) {
        return res.status(400).send("Email address is required for simulation.");
    }
    email = normalizeContact(email);
    const db = readDB();
    
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === email || (u.email && normalizeContact(u.email) === email));
    if (!user) {
        user = {
            id: Date.now().toString(),
            phone_or_email: email,
            isVerified: true
        };
        db.users.push(user);
    } else {
        user.isVerified = true;
    }
    
    const session_id = "se_google_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    db.merchantSessions = db.merchantSessions || [];
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    const approxRegion = getApproxRegion(req as any);
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        
    db.merchantSessions.push({
        session_id,
        user_id: user.id,
        device_fingerprint: 'unknown_fp',
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    });
    
    writeDB(db);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Completed</title>
</head>
<body style="background: #161C48; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, -apple-system, sans-serif;">
    <div style="text-align: center; padding: 24px;">
        <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Signing you in...</p>
        <p style="font-size: 14px; color: #94a3b8; margin: 0;">This window should close automatically.</p>
    </div>
    <script>
        const session_id = "${session_id}";
        const email = "${email}";
        
        if (window.opener) {
            window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                session_id: session_id, 
                phone_or_email: email
            }, '*');
            window.close();
        } else {
            window.location.href = "/?session_id=" + session_id + "&phone_or_email=" + encodeURIComponent(email);
        }
    </script>
</body>
</html>
    `);
});

app.post("/api/auth/google/firebase-session", (req, res) => {
    let { email, displayName, uid } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email address is required for session initiation." });
    }
    
    email = normalizeContact(email);
    const db = readDB();
    
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === email || (u.email && normalizeContact(u.email) === email));
    if (!user) {
        user = {
            id: Date.now().toString(),
            phone_or_email: email,
            full_name: displayName || "Merchant",
            isVerified: true
        };
        db.users.push(user);
    } else {
        user.isVerified = true;
        if (displayName && (!user.full_name || user.full_name === "Merchant")) {
            user.full_name = displayName;
        }
    }
    
    const session_id = "se_google_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    db.merchantSessions = db.merchantSessions || [];
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    const approxRegion = getApproxRegion(req as any);
    const fingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        
    db.merchantSessions.push({
        session_id,
        user_id: user.id,
        device_fingerprint: fingerprint,
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    });
    
    writeDB(db);
    return res.json({ session_id, phone_or_email: email, user });
});

app.get("/api/auth/google/callback", async (req, res) => {
    let email = "";
    
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "").trim();
    
    if (clientId && clientSecret && req.query.code) {
        try {
            const code = req.query.code;
            const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") : (() => {
                const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
                const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
                return `${protocol}://${host}`;
            })();
            const redirectUri = `${baseUrl}/api/auth/google/callback`;
            const fetchFn = (globalThis as any).fetch || fetch;
            
            const tokenRes = await fetchFn("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code: String(code),
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code"
                })
            });
            const tokenData: any = await tokenRes.json();
            if (tokenData.access_token) {
                const userRes = await fetchFn("https://www.googleapis.com/oauth2/v2/userinfo", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                });
                const userData: any = await userRes.json();
                if (userData && userData.email) {
                    email = userData.email;
                }
            }
        } catch (err) {
            console.error("Google OAuth token exchange failed:", err);
        }
    } else {
        return res.status(400).send("Google credentials are not configured or code parameter is missing. Mock verification must be completed securely via the preview flow.");
    }
    
    if (!email) {
        return res.status(400).send("Google authentication was unsuccessful.");
    }
    
    email = normalizeContact(email);
    const db = readDB();
    
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === email || (u.email && normalizeContact(u.email) === email));
    if (!user) {
        user = {
            id: Date.now().toString(),
            phone_or_email: email,
            isVerified: true
        };
        db.users.push(user);
    } else {
        user.isVerified = true;
    }
    
    const session_id = "se_google_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    db.merchantSessions = db.merchantSessions || [];
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    const approxRegion = getApproxRegion(req as any);
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        
    db.merchantSessions.push({
        session_id,
        user_id: user.id,
        device_fingerprint: 'unknown_fp',
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    });
    
    writeDB(db);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Completed</title>
</head>
<body style="background: #161C48; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, -apple-system, sans-serif;">
    <div style="text-align: center; padding: 24px;">
        <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Signing you in...</p>
        <p style="font-size: 14px; color: #94a3b8; margin: 0;">This window should close automatically.</p>
    </div>
    <script>
        const session_id = "${session_id}";
        const email = "${email}";
        
        if (window.opener) {
            window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                session_id: session_id, 
                phone_or_email: email
            }, '*');
            window.close();
        } else {
            window.location.href = "/?session_id=" + session_id + "&phone_or_email=" + encodeURIComponent(email);
        }
    </script>
</body>
</html>
    `);
});


app.post("/api/auth/probe", (req, res) => {
    const raw_phone_or_email = req.body.phone_or_email;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const db = readDB();
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    if (!user) {
        user = { id: Date.now().toString(), phone_or_email, otp_secret: "1234" }; // Simulated OTP in demo
        db.users.push(user);
    }
    
    // WhatsApp Authentication flow
    if (!db.whatsappVerifications) db.whatsappVerifications = [];
    const verificationCode = generateOTP();
    const expiresAt = Date.now() + 180000; // 3 minutes
    
    db.whatsappVerifications = db.whatsappVerifications.filter((v: any) => v.phone !== phone_or_email);
    db.whatsappVerifications.push({ phone: phone_or_email, code: verificationCode, status: 'pending', expiresAt });
    
    writeDB(db);

    const isNewUser = !user.full_name;
    const hasPin = !!user.owner_pin;
    
    res.json({ 
        newUser: isNewUser,
        hasPin: hasPin,
        verificationCode: verificationCode // Frontend uses this to construct the link
    });
});



app.post("/api/auth/check-verification-status", (req, res) => {
    const { phone_or_email } = req.body;
    const db = readDB();
    const verification = (db.whatsappVerifications || []).find(
        (v: any) => normalizeContact(v.phone) === normalizeContact(phone_or_email)
    );
    
    if (verification && verification.status === 'verified') {
        const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === normalizeContact(phone_or_email));
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Generate actual login session so they are authenticated
        const session_id = "se_wa_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
        db.merchantSessions = db.merchantSessions || [];
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
        
        const approxRegion = getApproxRegion(req as any);
        const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
            ? req.headers['x-forwarded-for'][0] 
            : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
            
        db.merchantSessions.push({
            session_id,
            user_id: user.id,
            device_fingerprint: 'unknown_fp',
            last_active_ip: client_ip,
            last_active_region: approxRegion,
            is_suspicious_locked: false
        });
        writeDB(db);
        
        return res.json({ status: "verified", session_id, user });
    }
    
    res.json({ status: verification ? verification.status : 'not_found' });
});

app.post("/api/auth/verify-whatsapp-sandbox", (req, res) => {
    return res.status(403).json({ error: "Bypassing verification is disabled to ensure correct database storage and protect accounts." });
});

// Meta Webhook shakehand GET verification
app.get("/api/auth/whatsapp-webhook", (req, res) => {
    // Highly resilient query parameter extractor that works with flat, dotted, nested or case-insensitive structures
    const findParam = (name: string): string | undefined => {
        // Direct dotted-notation keys e.g. "hub.mode"
        const dottedKey = `hub.${name}`;
        if (typeof req.query[dottedKey] === "string") return req.query[dottedKey] as string;
        
        // Plain key e.g. "mode"
        if (typeof req.query[name] === "string") return req.query[name] as string;

        // Nested structure e.g. req.query.hub.mode
        if (req.query.hub && typeof req.query.hub === "object") {
            const nested = (req.query.hub as any)[name];
            if (typeof nested === "string") return nested;
            if (typeof nested === "number") return String(nested);
        }

        // Deep case-insensitive scanning of keys for maximum durability
        for (const key of Object.keys(req.query)) {
            const val = req.query[key];
            const lowerKey = key.toLowerCase();
            if (lowerKey === dottedKey.toLowerCase() || lowerKey === name.toLowerCase() || lowerKey.endsWith(`.${name.toLowerCase()}`)) {
                if (typeof val === "string") return val;
                if (typeof val === "number") return String(val);
            }
        }
        return undefined;
    };

    const mode = findParam("mode");
    const token = findParam("verify_token");
    const challenge = findParam("challenge");

    console.log(`[WHATSAPP WEBHOOK GET] Received verification request. Params parsed -> mode: "${mode}", token: "${token}", challenge: "${challenge}"`);
    console.log("[WHATSAPP WEBHOOK GET] Full query details:", JSON.stringify(req.query));

    // Default or configured verify token
    const envVerifyTokenRaw = process.env.WHATSAPP_VERIFY_TOKEN || "";
    // Clean any surrounding quotes from env variables (common in configuration setups)
    const envVerifyToken = envVerifyTokenRaw.replace(/^["']|["']$/g, '').trim();
    const fallbackVerifyToken = "yeedem_verification_token";

    if (mode && token) {
        const cleanReceivedToken = token.trim().replace(/^["']|["']$/g, '');
        const cleanFallbackToken = fallbackVerifyToken.trim().replace(/^["']|["']$/g, '');
        const cleanEnvToken = envVerifyToken.trim().replace(/^["']|["']$/g, '');

        const isMatch = (cleanReceivedToken === cleanFallbackToken) || (cleanEnvToken && cleanReceivedToken === cleanEnvToken);

        if (mode === "subscribe" && isMatch) {
            console.log("[WHATSAPP WEBHOOK GET] Meta Webhook verified successfully!");
            // Meta expects the raw challenge string back in the body with status 200
            res.setHeader('Content-Type', 'text/plain');
            return res.status(200).send(challenge ? String(challenge) : "");
        } else {
            console.warn(`[WHATSAPP WEBHOOK GET] Meta Webhook verification failed. Token mismatch. Expected fallback: "${cleanFallbackToken}" or env: "${cleanEnvToken}". Got received token: "${cleanReceivedToken}"`);
            return res.sendStatus(403);
        }
    }

    console.log("[WHATSAPP WEBHOOK GET] Raw direct browser hit or missing query params. Returning friendly HTML setup guide.");
    
    // Dynamically calculate the base URL from the current request to support self-hosting, AlwaysData, or different domains automatically!
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
    const callbackUrl = `${protocol}://${host}/api/auth/whatsapp-webhook`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yeedem WhatsApp Webhook Gateway</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0E1338; color: #ffffff; padding: 2rem; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 2.5rem 2rem; max-width: 500px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.4); text-align: left; }
    h1 { color: #00A6FF; font-size: 1.4rem; margin-top: 0; display: flex; align-items: center; gap: 10px; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
    p { font-size: 0.85rem; color: #cbd5e1; line-height: 1.6; }
    .badge { background: rgba(0, 166, 255, 0.1); border: 1px solid rgba(0, 166, 255, 0.3); color: #00A6FF; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-family: monospace; }
    .info-box { background: rgba(0, 0, 0, 0.25); border-radius: 12px; padding: 1.2rem; margin: 1.5rem 0; border: 1px solid rgba(255,255,255,0.05); border-left: 4px solid #00A6FF; }
    .label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; display: block; margin-bottom: 4px; }
    .value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; color: #ffffff; background: rgba(255, 255, 255, 0.05); padding: 6px 10px; border-radius: 6px; word-break: break-all; border: 1px solid rgba(255,255,255,0.05); }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; padding: 4px 10px; border-radius: 9999px; font-weight: 600; margin-bottom: 1rem; }
    .dot { width: 8px; height: 8px; background-color: #10B981; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-pill">
      <span class="dot"></span> Online & Active
    </div>
    <h1>Yeedem WhatsApp Gateway</h1>
    <p>This Callback URL is fully online and ready to receive handshakes or notifications from the Meta/Facebook Developer Platform.</p>
    
    <div class="info-box">
      <div style="margin-bottom: 1rem;">
        <span class="label">Callback URL</span>
        <div class="value">${callbackUrl}</div>
      </div>
      <div>
        <span class="label">Verify Token</span>
        <div class="value">yeedem_verification_token</div>
      </div>
    </div>
    
    <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; line-height: 1.5;">
      <strong>Note:</strong> Direct visits via your browser do not trigger Meta's subscribe handshake. To complete your production setup, copy and paste the precise details above directly into the <strong>Configure Webhooks</strong> fields in your Facebook Developers Console.
    </p>
  </div>
</body>
</html>
    `);
});

// WhatsApp message post reception webhook
app.post("/api/auth/whatsapp-webhook", (req, res) => {
    let from_number = req.body.from_number;
    let message = req.body.message;

    // Direct support for full Meta Cloud API JSON structures
    if (req.body.object === "whatsapp_business_account" && req.body.entry) {
        try {
            const entry = req.body.entry?.[0];
            const change = entry?.changes?.[0];
            const msgObj = change?.value?.messages?.[0];
            if (msgObj) {
                from_number = msgObj.from;
                if (msgObj.type === "text" && msgObj.text) {
                    message = msgObj.text.body;
                }
            }
        } catch (e) {
            console.error("Error parsing incoming Meta WhatsApp payload:", e);
        }
    }

    if (!message) return res.status(200).json({ status: "ignored", message: "No message" });
    if (!from_number) return res.status(200).json({ status: "ignored", message: "No sender phone number" });

    // Extract auth token
    const regex = /^Verify my Yeedem account code:\s*(\d{6})/i;
    const match = message.match(regex);
    if (!match) return res.status(200).json({ status: "ignored", message: "Not an auth message format" });
    
    const token = match[1];
    const db = readDB();
    
    // Find matching pending verification
    const verification = (db.whatsappVerifications || []).find(
        (v: any) => normalizeContact(v.phone) === normalizeContact(from_number) && v.code === token && v.status === 'pending' && v.expiresAt > Date.now()
    );

    if (verification) {
        verification.status = 'verified';
        
        // Mark user as secure/verified
        const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === normalizeContact(verification.phone));
        if (user) {
            user.isVerified = true;
            if (db.merchantSessions) {
                db.merchantSessions.forEach((s: any) => {
                    if (s.user_id === user.id) {
                        s.is_suspicious_locked = false;
                    }
                });
            }
        }

        // Mirror check into businessProfiles
        if (db.businessProfiles) {
            db.businessProfiles.forEach((bp: any) => {
                if (normalizeContact(bp.phone_number) === normalizeContact(from_number)) {
                    bp.is_verified = true;
                    bp.is_suspicious_locked = false;
                }
            });
        }

        writeDB(db);
        return res.json({ status: "success" });
    }
    
    return res.status(400).json({ error: "Invalid verification code or phone number." });
});


app.post("/api/auth/verify-otp", (req, res) => {
    const { phone_or_email: raw_phone_or_email, otp } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    if (user && otp === '1234') {
        const session_id = Date.now().toString();
        
        // Remove old sessions for this user to avoid conflicts (except staff sessions)
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
        
        const session = { 
            session_id, 
            user_id: user.id, 
            device_fingerprint: deviceFingerprint, 
            last_active_ip: client_ip, 
            last_active_region: approxRegion, 
            is_suspicious_locked: false 
        };
        db.merchantSessions.push(session);
        writeDB(db);
        
        res.json({ 
            status: "success", 
            session_id, 
            is_new_user: !user.full_name,
            needs_pin: !user.owner_pin, 
            user: { id: user.id, phone_or_email: user.phone_or_email, full_name: user.full_name, business_name: user.business_name, business_type: user.business_type || 'buy_and_sell' }
        });
    } else {
        res.status(401).json({ error: "Invalid 4-digit OTP" });
    }
});

app.post("/api/auth/register-onboarding", requireSession, (req, res) => {
    const { pin, full_name, business_name, business_type, phone, address, template, email, skippedOnboarding } = req.body;
    const user_id = (req as any).user_id;

    if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
        return res.status(400).json({ error: "A 4-digit security PIN is required to complete onboarding." });
    }

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (skippedOnboarding) {
        user.owner_pin = pin;
        user.skippedOnboarding = true;
        user.onboarded = false;
        user.full_name = (full_name && full_name.trim()) || user.full_name || "Registered Merchant";
        user.business_name = (business_name && business_name.trim()) || user.business_name || "My Business Ledger";
        user.business_type = business_type || user.business_type || 'buy_and_sell';
        user.phone = phone || user.phone || '';
        user.address = address || user.address || '';
        if (email && email.trim()) {
            user.email = email.trim().toLowerCase();
        }
    } else {
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ error: "Your full name handle is required to complete onboarding." });
        }
        if (!business_name || !business_name.trim()) {
            return res.status(400).json({ error: "Your store name is required to complete onboarding." });
        }
        user.owner_pin = pin;
        user.full_name = full_name.trim();
        user.business_name = business_name.trim();
        user.business_type = business_type || 'buy_and_sell';
        user.phone = phone || user.phone;
        user.address = address || user.address;
        if (email && email.trim()) {
            user.email = email.trim().toLowerCase();
        }
        user.skippedOnboarding = false;
        user.onboarded = true;
    }

    user.shop_slug = user.business_name.toLowerCase().replace(/\s+/g, '-');
    
    // Explicitly initialize the user's business config object matching setting profiles
    user.business = {
        businessName: user.business_name,
        businessType: user.business_type,
        phone: user.phone || '',
        address: user.address || '',
        invoiceTemplatePreference: template || 'classic',
        customAccentColor: '#00A6FF',
        customFontSize: 'md',
        customFontFamily: 'sans',
        customShowLogo: true,
        customHeaderTitle: 'TAX INVOICE',
        customFooterNotes: 'This document acts as an official trade journal entry. Please verify balances online.',
        customShadowStyle: 'md'
    };

    writeDB(db);
    res.json({ 
        status: "success", 
        user: { 
            id: user.id,
            phone_or_email: user.phone_or_email,
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type,
            owner_pin: user.owner_pin,
            phone: user.phone || '',
            address: user.address || '',
            shop_slug: user.shop_slug,
            business: user.business,
            verification_skipped: user.verification_skipped,
            skippedOnboarding: user.skippedOnboarding
        } 
    });
});

app.post("/api/auth/set-pin", (req, res) => {
    const { phone_or_email: raw_phone_or_email, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    user.owner_pin = pin;
    writeDB(db);
    res.json({ status: "success", message: "PIN set successfully" });
});

app.post("/api/auth/pin-login", (req, res) => {
    const { phone_or_email: raw_phone_or_email, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    console.log(`[DEBUG] PIN Login attempt for phone: ${phone_or_email}, User found: ${!!user}`);

    if (!user) {
        return res.status(404).json({ error: "Merchant profile not found on this device." });
    }
    
    if (user.subscriptionStatus === "suspended") {
        return res.status(403).json({ error: "Your account has been manually suspended by system administrators. Please contact operations support." });
    }
    
    if (user.owner_pin !== pin) {
        return res.status(401).json({ error: "Incorrect 4-digit security PIN." });
    }
    
    const session_id = Date.now().toString();
    let is_suspicious_locked = false;
    
    // Anomaly checks (Disabled active locking to ensure high availability on AlwaysData)
    const prevSessions = db.merchantSessions.filter((s: any) => s.user_id === user.id);
    if (prevSessions.length > 0) {
        const usualDevice = prevSessions[0].device_fingerprint;
        const usualRegion = prevSessions[0].last_active_region;
        
        if (usualDevice && usualDevice !== deviceFingerprint) {
            console.log(`[PASSIVE ANOMALY] Unrecognized hardware footprint: cur=${deviceFingerprint}, expected=${usualDevice}. Lockout bypassed.`);
        } else if (usualRegion && usualRegion !== 'Unknown' && approxRegion !== 'Unknown' && usualRegion !== approxRegion) {
            console.log(`[PASSIVE ANOMALY] Geographic shift detected: cur=${approxRegion}, expected=${usualRegion}. Lockout bypassed.`);
        }
    }
    
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    const session = {
        session_id,
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked
    };
    db.merchantSessions.push(session);
    writeDB(db);
    
    res.json({
        status: is_suspicious_locked ? "locked" : "success",
        session_id,
        is_suspicious_locked,
        user: { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null
        }
    });
});

app.post("/api/auth/reset-pin-authenticated", requireSession, (req, res) => {
    const { pin } = req.body;
    const user_id = (req as any).user_id;

    if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
        return res.status(400).json({ error: "A 4-digit security PIN is required." });
    }

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }

    user.owner_pin = pin;
    writeDB(db);

    res.json({
        status: "success",
        message: "PIN updated successfully.",
        user: {
            id: user.id,
            phone_or_email: user.phone_or_email,
            full_name: user.full_name,
            business_name: user.business_name,
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null
        }
    });
});

app.post("/api/auth/reset-forgotten-pin", (req, res) => {
    const { phone_or_email: raw_phone_or_email, otp, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    if (!phone_or_email || !pin) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (otp !== '1234') {
        return res.status(401).json({ error: "Invalid 4-digit OTP" });
    }

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    if (!user) {
        return res.status(404).json({ error: "Merchant profile not found on this device." });
    }

    // Set new PIN
    user.owner_pin = pin;

    const session_id = Date.now().toString();

    // Clear old session (except staff sessions)
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    // Create new active session, bypassing suspicious locks as they just verified via OTP reset
    const session = {
        session_id,
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    };
    db.merchantSessions.push(session);
    writeDB(db);

    res.json({
        status: "success",
        session_id,
        user: { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null,
            verification_skipped: !!user.verification_skipped,
            skippedOnboarding: !!user.skippedOnboarding
        }
    });
});

app.post("/api/auth/validate-session", requireSession, (req, res) => {
    const session_id = req.headers['x-session-id'] as string;
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const db = readDB();
    const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
    
    if (!session) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    const user = db.users.find((u: any) => u.id === session.user_id);
    const is_staff = !!session.is_staff;
    const staffObj = is_staff ? (db.staff || []).find((s: any) => s.id === session.staff_id) : null;

    res.json({
        status: "success",
        is_suspicious_locked: session.is_suspicious_locked,
        is_staff,
        staff: staffObj,
        user: user ? { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null,
            subscriptionPlan: user.subscriptionPlan || 'SME Basic',
            subscriptionStatus: user.subscriptionStatus || 'active',
            verification_skipped: !!user.verification_skipped,
            skippedOnboarding: !!user.skippedOnboarding
        } : null
    });
});

app.post("/api/auth/verify-suspicious-otp", (req, res) => {
    const { session_id, otp } = req.body;
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
    
    if (!session) {
        return res.status(401).json({ error: "Invalid security session context." });
    }
    
    const user = db.users.find((u: any) => u.id === session.user_id);
    const userPhone = user ? user.phone_or_email : '';

    let isOtpValid = false;
    if (otp === '1234') {
        isOtpValid = true;
    } else if (otp && userPhone) {
        const verification = (db.whatsappVerifications || []).find(
            (v: any) => normalizeContact(v.phone) === normalizeContact(userPhone) && 
                       v.code === otp && 
                       v.expiresAt > Date.now()
        );
        if (verification) {
            verification.status = 'verified';
            isOtpValid = true;
        }
    }
    
    if (isOtpValid) {
        session.is_suspicious_locked = false;
        session.device_fingerprint = deviceFingerprint;
        session.last_active_region = approxRegion;
        session.last_active_ip = client_ip;
        writeDB(db);
        res.json({ status: "success", message: "OTP Verification complete. Suspicious block cleared." });
    } else {
        res.status(401).json({ error: "Invalid verification code. Use 1234 or dynamic WhatsApp code." });
    }
});

app.post("/api/auth/logout", (req, res) => {
    res.json({ status: "success" });
});

app.post("/api/payment/initialize", requireSession, async (req, res) => {
    try {
        const { plan, amount, email } = req.body;
        
        // Normalize the email so Paystack always receives a valid email address
        let payloadEmail = email;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!payloadEmail || typeof payloadEmail !== "string" || !emailRegex.test(payloadEmail.trim())) {
            const cleanRaw = typeof payloadEmail === 'string' ? payloadEmail.trim().replace(/[^a-zA-Z0-9]/g, '') : '';
            payloadEmail = `${cleanRaw || 'customer'}@yeedem.com`;
        } else {
            payloadEmail = payloadEmail.trim();
        }
        
        const rawKey = process.env.PAYSTACK_SECRET_KEY || '';
        const cleanKey = rawKey.replace(/^["']|["']$/g, '').trim();
        const hasKey = cleanKey && 
                        cleanKey !== 'MY_PAYSTACK_SECRET_KEY' &&
                        cleanKey !== '' &&
                        !cleanKey.includes('PLACEholder');
                        
        if (!hasKey) {
            return res.status(400).json({ error: "Paystack live gateway is not configured. Please define PAYSTACK_SECRET_KEY in environmental configurations." });
        }

        const reqOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        const callbackRaw = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" ? process.env.APP_URL : reqOrigin;
        const callbackUrl = `${callbackRaw.replace(/\/$/, '')}/dashboard`;

        const response = await getPaystack().transaction.initialize({
            amount: Math.round(amount * 100), // Paystack uses kobo
            email: payloadEmail,
            callback_url: callbackUrl
        });

        // Some libraries return error structure on resolve
        if (!response || response.status === false || response instanceof Error) {
            const extError = (response && (response.message || response.error)) || "Paystack declined setup request";
            console.error("Paystack API Initialization Rejected:", response);
            return res.status(400).json({ error: extError });
        }

        res.json(response);
    } catch (err: any) {
        console.error("Paystack initialization error:", err);
        const errorMsg = err && (err.message || err.error) ? (err.message || err.error) : "Failed to initialize payment";
        res.status(500).json({ error: errorMsg });
    }
});

app.post("/api/payment/verify", requireSession, async (req, res) => {
    try {
        const { reference, plan } = req.body;
        
        // Always allow free plan transitions (0 cost) immediately
        if (plan === 'SME Basic' || (reference && reference.startsWith('sim_ref_free_plan_'))) {
            const user_id = (req as any).user_id;
            const db = readDB();
            const user = db.users.find((u: any) => u.id === user_id);
            if (user) {
                user.subscriptionPlan = plan || 'SME Basic';
                user.subscriptionStatus = 'active';
                writeDB(db);
            }
            return res.json({ status: "success", plan: plan || 'SME Basic' });
        }

        const rawKey = process.env.PAYSTACK_SECRET_KEY || '';
        const cleanKey = rawKey.replace(/^["']|["']$/g, '').trim();
        const hasKey = cleanKey && 
                        cleanKey !== 'MY_PAYSTACK_SECRET_KEY' &&
                        cleanKey !== '' &&
                        !cleanKey.includes('PLACEholder');

        if (!hasKey) {
            return res.status(400).json({ error: "Paystack live gateway is not configured. Please define PAYSTACK_SECRET_KEY in environmental configurations." });
        }

        const response = await getPaystack().transaction.verify(reference);
        if (!response || response instanceof Error) {
            const extErr = (response && response.message) || "Failed to connect to gateway";
            return res.status(400).json({ error: extErr });
        }

        const isSuccess = (response.data && response.data.status === 'success') || 
                          (response.status === 'success');

        if (isSuccess) {
            // Update user subscription
            const user_id = (req as any).user_id;
            const db = readDB();
            const user = db.users.find((u: any) => u.id === user_id);
            if (user) {
                user.subscriptionPlan = plan;
                user.subscriptionStatus = 'active';
                writeDB(db);
            }
            res.json({ status: "success", plan });
        } else {
            console.error("Paystack Verification Failed response:", response);
            const failureReason = (response.data && response.data.gateway_response) || 
                                  (response.data && response.data.status) || 
                                  "Payment status is not successful";
            res.status(400).json({ error: `Payment verification failed: ${failureReason}` });
        }
    } catch (err: any) {
        console.error("Paystack verification error:", err);
        const errorMsg = err && (err.message || err.error) ? (err.message || err.error) : "Failed to verify payment";
        res.status(500).json({ error: errorMsg });
    }
});

app.delete("/api/auth/delete-account", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const db = readDB();
        const user = db.users.find((u: any) => u.id === user_id);
        
        if (!user) {
            return res.status(404).json({ error: "User profile not found." });
        }

        const email = user.phone_or_email;
        
        // Remove user
        console.log(`[DEBUG] Deleting account for user_id: ${user_id}`);
        db.users = db.users.filter((u: any) => u.id !== user_id);
        console.log(`[DEBUG] Remaining users: ${db.users.length}`);
        
        // Remove merchant sessions
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user_id);
        
        // Remove staff associated with user
        db.staff = (db.staff || []).filter((s: any) => s.user_id !== user_id);
        
        // Remove staff activity logs associated with user
        db.staffActivityLogs = (db.staffActivityLogs || []).filter((l: any) => l.user_id !== user_id);
        
        writeDB(db);
        
        // Purge automated backups for this user
        if (email) {
            const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
            const backupsDir = process.env.VERCEL ? path.join('/tmp', 'backups') : path.join(process.cwd(), 'data', 'backups');
            if (fs.existsSync(backupsDir)) {
                const files = fs.readdirSync(backupsDir);
                let deletedCount = 0;
                files.forEach(f => {
                    if (f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json')) {
                        const filePath = path.join(backupsDir, f);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                        }
                    }
                });
                console.log(`[PURGE SUCCESS] Purged ${deletedCount} cloud user backup files for ${email}`);
            }
        }
        
        res.json({ status: "success", message: "Account and associated data deleted successfully." });
    } catch (err: any) {
        console.error("Account deletion error:", err);
        res.status(500).json({ error: err.message || "Failed to delete account" });
    }
});

app.get("/api/public/shared-invoice/:token", (req, res) => {
    try {
        const token = req.params.token;
        if (!token) {
            return res.status(400).json({ error: "Token is required." });
        }

        const db = readDB();
        let foundInvoice: any = null;
        let foundBusiness: any = null;
        let assocUser: any = null;

        const backupsDir = process.env.VERCEL ? path.join('/tmp', 'backups') : path.join(process.cwd(), 'data', 'backups');
        if (fs.existsSync(backupsDir)) {
            const files = fs.readdirSync(backupsDir)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(backupsDir, f);
                    const stats = fs.statSync(filePath);
                    return { filename: f, mtime: stats.mtime.getTime() };
                })
                .sort((a, b) => b.mtime - a.mtime); // Newest backups first

            for (const fileObj of files) {
                try {
                    const content = fs.readFileSync(path.join(backupsDir, fileObj.filename), 'utf-8');
                    const backup = JSON.parse(content);
                    let customersList: any[] = [];
                    if (backup) {
                        if (Array.isArray(backup.customers)) {
                            customersList = backup.customers;
                        } else if (backup.data && Array.isArray(backup.data.customers)) {
                            customersList = backup.data.customers;
                        }
                    }

                    if (customersList && customersList.length > 0) {
                        for (const cust of customersList) {
                            if (Array.isArray(cust.invoices)) {
                                for (const inv of cust.invoices) {
                                    const calcToken = "yb_token_" + inv.id.substring(0, 8);
                                    if (calcToken === token) {
                                        foundInvoice = inv;
                                        if (backup.businessProfile) {
                                            foundBusiness = backup.businessProfile;
                                        } else if (backup.business) {
                                            foundBusiness = backup.business;
                                        }
                                        const fileEmail = backup.email || (backup.data && backup.data.email);
                                        let user = null;
                                        if (fileEmail) {
                                            user = db.users.find((u: any) => (u.phone_or_email || "").toLowerCase().trim() === fileEmail.toLowerCase().trim());
                                        }

                                        if (!user) {
                                            let fileEmailToken = "";
                                            const fname = fileObj.filename;
                                            if (fname.startsWith("backup_") && fname.endsWith(".json")) {
                                                const sub = fname.substring("backup_".length, fname.length - ".json".length);
                                                const lastUnderscore = sub.lastIndexOf("_");
                                                if (lastUnderscore !== -1) {
                                                    fileEmailToken = sub.substring(0, lastUnderscore);
                                                }
                                            }

                                            if (fileEmailToken) {
                                                user = db.users.find((u: any) => {
                                                    const cleanUserEmail = (u.phone_or_email || "").replace(/[^a-zA-Z0-9]/g, '_');
                                                    return cleanUserEmail === fileEmailToken;
                                                });
                                            }
                                        }

                                        if (user) {
                                            assocUser = user;
                                            if (!foundBusiness) {
                                                foundBusiness = user.business;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                            if (foundInvoice) break;
                        }
                    }
                } catch (parseErr) {
                    // skip corrupted files
                }
                if (foundInvoice) break;
            }
        }

        if (!foundInvoice) {
            return res.status(404).json({ 
                error: "Invoice not found on the cloud server. The merchant might not have updated their cloud backup recently." 
            });
        }

        res.json({
            invoice: foundInvoice,
            business: foundBusiness || {
                businessName: assocUser?.business_name || "Merchant Hub",
                invoiceTemplatePreference: "modern_blue",
                customAccentColor: "#00A6FF"
            }
        });
    } catch (err: any) {
        console.error("Shared invoice retrieve error:", err);
        res.status(500).json({ error: err.message || "Failed to load shared invoice data" });
    }
});

app.get("/api/admin/unlock-all", (req, res) => {
    const db = readDB();
    db.merchantSessions.forEach((s: any) => s.is_suspicious_locked = false);
    writeDB(db);
    res.json({ status: "success", message: "All sessions unlocked." });
});

// System Admin Middleware
const requireSystemAdmin = (req: any, res: any, next: any) => {
    const adminPassword = req.headers['x-admin-password'] || req.query.admin_password;
    const expectedPassword = process.env.ADMIN_PASSWORD || 'yeedem_admin_cpanel_2026';
    if (!adminPassword || adminPassword !== expectedPassword) {
        return res.status(401).json({ error: "Unauthorized: Invalid System Admin Password" });
    }
    next();
};

app.get("/api/admin/pricing-prices", (req, res) => {
    try {
        const db = readDB();
        const prices = db.pricingPlanPrices || {
            growth_monthly: 4500,
            growth_annually: 45000,
            pro_monthly: 7500,
            pro_annually: 75000,
            enterprise_monthly: 20000,
            enterprise_annually: 200000,
        };
        res.json(prices);
    } catch (err: any) {
        res.status(500).json({ error: "Failed to load pricing prices" });
    }
});

app.post("/api/admin/pricing-prices", requireSystemAdmin, (req, res) => {
    try {
        const { prices } = req.body;
        if (!prices || typeof prices !== "object") {
            return res.status(400).json({ error: "Invalid prices payload" });
        }
        const db = readDB();
        db.pricingPlanPrices = prices;
        writeDB(db);
        res.json({ status: "success", prices });
    } catch (err: any) {
        res.status(500).json({ error: "Failed to persist pricing prices" });
    }
});

// Admin UI Page
app.get(['/admin', '/admin-cpanel'], (req, res) => {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'yeedem_admin_cpanel_2026';
    res.status(200).set({ 'Content-Type': 'text/html' }).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeedem Books | Owner Admin cPanel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #080914;
        }
        .mono {
            font-family: 'JetBrains Mono', monospace;
        }
        /* Custom scroll utilities for responsive cards and tables */
        .scrollbar-none::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-none {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .mini-scrollbar::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .mini-scrollbar::-webkit-scrollbar-track {
            background: #080914;
        }
        .mini-scrollbar::-webkit-scrollbar-thumb {
            background: #1e2142;
            border-radius: 9999px;
        }
        .mini-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #2a2e5c;
        }
    </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col">
    <!-- Login Screen -->
    <div id="login-container" class="flex-1 flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#111329] border border-blue-500/20 rounded-[28px] p-8 shadow-2xl shadow-blue-950/40 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
            <div class="absolute bottom-0 left-0 w-32 h-32 bg-[#00A6FF]/5 rounded-full blur-2xl"></div>
            
            <div class="text-center mb-8 relative">
                <div class="w-16 h-16 bg-[#00A6FF]/10 text-[#00A6FF] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#00A6FF]/20 shadow-lg shadow-[#00A6FF]/10">
                    <i data-lucide="shield-check" class="w-8 h-8"></i>
                </div>
                <h1 class="text-2xl font-black tracking-tight text-white">Yeedem Books</h1>
                <p class="text-sm text-gray-400 mt-1">Owner Administration Console</p>
            </div>
            
            <form id="login-form" class="space-y-5 relative">
                <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Access Token / Password</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                            <i data-lucide="lock" class="w-4 h-4"></i>
                        </span>
                        <input type="password" id="admin-password-input" required placeholder="Enter administrative key"
                            class="w-full pl-10 pr-4 py-3.5 bg-[#0b0c15] border border-gray-800 rounded-xl text-white placeholder-gray-500 hover:border-blue-500/30 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition-all outline-none text-center tracking-widest font-bold">
                    </div>
                    <p class="text-[11px] text-gray-500 mt-2 text-center">
                        Defaults to <code class="bg-[#0b0c15] px-1.5 py-0.5 rounded text-blue-400 font-mono text-[10px]">${defaultPassword}</code> if not overridden in platform secrets.
                    </p>
                </div>
                
                <button type="submit" id="login-btn"
                    class="w-full py-3.5 bg-gradient-to-r from-blue-600 to-[#00A6FF] hover:opacity-90 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                    Authenticate Session
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
                <div id="login-error" class="text-red-400 text-xs text-center hidden font-medium"></div>
            </form>
        </div>
    </div>

    <!-- main Dashboard Application Container -->
    <div id="dashboard-container" class="hidden flex-1 flex flex-col">
        <!-- Navigation Header -->
        <header class="bg-[#111329] border-b border-blue-500/10 px-4 py-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-[#00A6FF]/10 text-[#00A6FF] rounded-xl flex items-center justify-center border border-[#00A6FF]/20 shrink-0">
                    <i data-lucide="database" class="w-5 h-5"></i>
                </div>
                <div>
                    <h1 class="text-base sm:text-lg font-black tracking-tight text-white">Yeedem System Admin</h1>
                    <span class="text-[9px] sm:text-[10px] text-[#00A6FF] font-bold tracking-widest uppercase block">Platform Control Deck</span>
                </div>
            </div>
            
            <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button onclick="triggerUnlockAll()" class="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 whitespace-nowrap">
                    <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                    Bypass Locked Sessions
                </button>
                <button onclick="logoutAdmin()" class="p-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg transition-all flex items-center justify-center shrink-0" title="Logout Panel">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                </button>
            </div>
        </header>

        <!-- Metric Cards -->
        <section class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-[#111329] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden">
                <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Registered Merchants</div>
                <div id="stat-total-users" class="text-3xl font-black mt-2 text-white mono">0</div>
                <div class="absolute right-4 bottom-4 text-blue-500/10">
                    <i data-lucide="users" class="w-12 h-12"></i>
                </div>
            </div>
            <div class="bg-[#111329] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden">
                <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Device Sessions</div>
                <div id="stat-total-sessions" class="text-3xl font-black mt-2 text-emerald-400 mono">0</div>
                <div class="absolute right-4 bottom-4 text-emerald-500/10">
                    <i data-lucide="smartphone" class="w-12 h-12"></i>
                </div>
            </div>
            <div class="bg-[#111329] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden">
                <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Registered Terminal Staff</div>
                <div id="stat-total-staff" class="text-3xl font-black mt-2 text--[#00A6FF] mono">0</div>
                <div class="absolute right-4 bottom-4 text-[#00A6FF]/10">
                    <i data-lucide="user-check" class="w-12 h-12"></i>
                </div>
            </div>
            <div class="bg-[#111329] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden">
                <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Free Trial Trackers</div>
                <div id="stat-total-trials" class="text-3xl font-black mt-2 text-amber-500 mono">0</div>
                <div class="absolute right-4 bottom-4 text-amber-500/10">
                    <i data-lucide="gift" class="w-12 h-12"></i>
                </div>
            </div>
        </section>

        <!-- Main Workspace Tabs -->
        <div class="px-4 sm:px-6 border-b border-blue-500/10 flex gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0" style="-webkit-overflow-scrolling: touch;">
            <button onclick="setTab('merchants')" id="tab-merchants" class="px-4 sm:px-5 py-3 text-xs font-extrabold border-b-2 border-[#00A6FF] text-[#00A6FF] transition-all flex items-center gap-2 inline-flex">
                <i data-lucide="users" class="w-3.5 h-3.5"></i> Merchants Catalog
            </button>
            <button onclick="setTab('sessions')" id="tab-sessions" class="px-4 sm:px-5 py-3 text-xs font-extrabold border-b-2 border-transparent text-gray-400 hover:text-white transition-all flex items-center gap-2 inline-flex">
                <i data-lucide="smartphone" class="w-3.5 h-3.5"></i> Active Sessions
            </button>
            <button onclick="setTab('trials')" id="tab-trials" class="px-4 sm:px-5 py-3 text-xs font-extrabold border-b-2 border-transparent text-gray-400 hover:text-white transition-all flex items-center gap-2 inline-flex">
                <i data-lucide="gift" class="w-3.5 h-3.5"></i> Trial Codes
            </button>
            <button onclick="setTab('rawdb')" id="tab-rawdb" class="px-4 sm:px-5 py-3 text-xs font-extrabold border-b-2 border-transparent text-gray-400 hover:text-white transition-all flex items-center gap-2 inline-flex">
                <i data-lucide="file-json" class="w-3.5 h-3.5"></i> raw db.json
            </button>
            <button onclick="setTab('pricing')" id="tab-pricing" class="px-4 sm:px-5 py-3 text-xs font-extrabold border-b-2 border-transparent text-gray-400 hover:text-white transition-all flex items-center gap-2 inline-flex">
                <i data-lucide="coins" class="w-3.5 h-3.5"></i> SaaS Pricing Plans
            </button>
        </div>

        <!-- Tab Content Viewport -->
        <main class="flex-1 p-4 sm:p-6 relative overflow-hidden">
            <!-- Merchants Tab -->
            <div id="view-merchants" class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111329]/50 p-4 rounded-xl border border-blue-500/10">
                    <div class="relative w-full sm:max-w-md">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                            <i data-lucide="search" class="w-4 h-4"></i>
                        </span>
                        <input type="text" id="merchant-search" oninput="renderMerchants()" placeholder="Search merchants by name, user id, contact details..."
                            class="w-full pl-9 pr-4 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-[#00A6FF] outline-none text-xs">
                    </div>
                    <button onclick="openCreateUserModal()" class="w-full sm:w-auto justify-center px-4 py-2.5 bg-[#00A6FF] hover:bg-[#0070f3] text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-blue-500/10 transition-all">
                        <i data-lucide="user-plus" class="w-4 h-4"></i> Create Manual Merchant
                    </button>
                </div>

                <div class="bg-[#111329] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl">
                    <div class="overflow-x-auto mini-scrollbar">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-[#0b0c15] text-gray-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-blue-500/10 whitespace-nowrap">
                                    <th class="py-4 px-5">ID / Contact Email</th>
                                    <th class="py-4 px-5">Merchant Name</th>
                                    <th class="py-4 px-5">Business Name & Shop Slug</th>
                                    <th class="py-4 px-5">Master PIN</th>
                                    <th class="py-4 px-5">Plan & Service Tier</th>
                                    <th class="py-4 px-5 text-right">Administrative Options</th>
                                </tr>
                            </thead>
                            <tbody id="merchants-table-body" class="divide-y divide-gray-800/50 text-xs">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Sessions Tab -->
            <div id="view-sessions" class="space-y-4 hidden">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111329]/50 p-4 rounded-xl border border-blue-500/10">
                    <h2 class="text-sm font-black text-white flex items-center gap-2">
                        <i data-lucide="smartphone" class="w-4 h-4 text-emerald-400 shrink-0"></i>
                        <span>System Authorized Credentials Table</span>
                    </h2>
                    <span id="sessions-count-badge" class="self-start sm:self-auto px-2.5 py-1 bg-emerald-950 text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-900/30 whitespace-nowrap">0 ACTIVE</span>
                </div>

                <div class="bg-[#111329] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl">
                    <div class="overflow-x-auto mini-scrollbar">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-[#0b0c15] text-gray-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-blue-500/10 whitespace-nowrap">
                                    <th class="py-4 px-5">User ID Target</th>
                                    <th class="py-4 px-5">OAuth / Web Session ID</th>
                                    <th class="py-4 px-5">IP & Active Region</th>
                                    <th class="py-4 px-5">Lock Status</th>
                                    <th class="py-4 px-5 text-right">Revocation</th>
                                </tr>
                            </thead>
                            <tbody id="sessions-table-body" class="divide-y divide-gray-800/50 text-xs">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Trials Tab -->
            <div id="view-trials" class="space-y-4 hidden">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111329]/50 p-4 rounded-xl border border-blue-500/10">
                    <h2 class="text-sm font-black text-white flex items-center gap-2">
                        <i data-lucide="gift" class="w-4 h-4 text-amber-500 shrink-0"></i>
                        <span>Anonymous IP Device Trial Limits</span>
                    </h2>
                    <button onclick="clearAllTrials()" class="w-full sm:w-auto px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-all border border-amber-500/20 text-center">
                        Purge All Trackers
                    </button>
                </div>

                <div class="bg-[#111329] border border-blue-500/10 rounded-2xl overflow-hidden shadow-xl">
                    <div class="overflow-x-auto mini-scrollbar">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-[#0b0c15] text-gray-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-blue-500/10 whitespace-nowrap">
                                    <th class="py-4 px-5">Device Fingerprint Hash</th>
                                    <th class="py-4 px-5">IP Location</th>
                                    <th class="py-4 px-5">Generated Invoices</th>
                                    <th class="py-4 px-5">Last Activity Time</th>
                                    <th class="py-4 px-5 text-right">Admin</th>
                                </tr>
                            </thead>
                            <tbody id="trials-table-body" class="divide-y divide-gray-800/50 text-xs">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- raw db.json Tab -->
            <div id="view-rawdb" class="space-y-4 hidden h-full flex flex-col">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111329]/50 p-4 rounded-xl border border-blue-500/10">
                    <div>
                        <h2 class="text-sm font-black text-white">Direct DB State Manipulation (db.json)</h2>
                        <p class="text-[11px] text-gray-400 mt-0.5">Use with caution. Direct key overrides can trigger session mismatches.</p>
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <button onclick="downloadBackup()" class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                            Export JSON
                        </button>
                        <button onclick="triggerRawSave()" class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap">
                            <i data-lucide="save" class="w-3.5 h-3.5"></i>
                            Save Overlay
                        </button>
                    </div>
                </div>
                
                <div class="flex-1 bg-[#0b0c15] border border-blue-500/10 rounded-2xl overflow-hidden flex flex-col p-3 sm:p-4 shadow-2xl mini-scrollbar font-mono text-xs">
                    <textarea id="raw-db-textarea" class="w-full flex-1 bg-transparent text-emerald-400 border-none outline-none resize-none animate-none h-[400px] sm:h-[500px]" style="min-height: 300px;"></textarea>
                </div>
            </div>

            <!-- Pricing Tab -->
            <div id="view-pricing" class="space-y-4 hidden">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111329]/50 p-4 rounded-xl border border-blue-500/10">
                    <div>
                        <h2 class="text-sm font-black text-white">SaaS Pricing Plans Management</h2>
                        <p class="text-[11px] text-gray-400 mt-0.5">Manage subscription tier prices (₦) updated dynamically across all landing and user billing views.</p>
                    </div>
                    <button onclick="savePricingPrices()" class="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg transition-all">
                        <i data-lucide="save" class="w-4 h-4"></i> Save Pricing Updates
                    </button>
                </div>

                <div class="bg-[#111329] border border-blue-500/10 rounded-2xl p-6 shadow-xl space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Growth Plan -->
                        <div class="bg-[#0b0c15] p-5 rounded-xl border border-blue-500/5 space-y-4">
                            <h3 class="text-xs font-black text-[#00A6FF] uppercase tracking-wider flex items-center gap-2 border-b border-gray-800 pb-2">
                                <i data-lucide="trending-up" class="w-4 h-4"></i> Growth Plan
                            </h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Monthly Fee (₦)</label>
                                    <input type="number" id="price-growth-monthly" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Annual Fee (₦)</label>
                                    <input type="number" id="price-growth-annually" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                            </div>
                        </div>

                        <!-- Pro Plan -->
                        <div class="bg-[#0b0c15] p-5 rounded-xl border border-blue-500/5 space-y-4">
                            <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-gray-800 pb-2">
                                <i data-lucide="zap" class="w-4 h-4"></i> Pro Plan
                            </h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Monthly Fee (₦)</label>
                                    <input type="number" id="price-pro-monthly" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Annual Fee (₦)</label>
                                    <input type="number" id="price-pro-annually" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                            </div>
                        </div>

                        <!-- Enterprise Plan -->
                        <div class="bg-[#0b0c15] p-5 rounded-xl border border-blue-500/5 space-y-4 md:col-span-2">
                            <h3 class="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2 border-b border-gray-800 pb-2">
                                <i data-lucide="building-2" class="w-4 h-4"></i> Enterprise Plan
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Monthly Fee (₦)</label>
                                    <input type="number" id="price-enterprise-monthly" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Annual Fee (₦)</label>
                                    <input type="number" id="price-enterprise-annually" class="w-full px-3.5 py-2.5 bg-[#111329] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Create Manual User Modal -->
    <div id="create-user-modal" class="fixed inset-0 bg-[#040409]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-[#111329] border border-blue-500/20 max-w-md w-full rounded-[24px] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
            <div class="p-6 border-b border-blue-500/10 flex items-center justify-between shrink-0">
                <h3 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="user-plus" class="text-[#00A6FF]"></i> Check-In New Merchant
                </h3>
                <button onclick="closeCreateUserModal()" class="text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            
            <form id="create-user-form" class="p-6 space-y-4 overflow-y-auto flex-1 mini-scrollbar">
                <div>
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Login Email / Phone Number Code</label>
                    <input type="text" id="create-phone-or-email" required placeholder="User identifier (e.g. merchant@mail.com)"
                        class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Merchant Display Name</label>
                    <input type="text" id="create-full-name" placeholder="Full name of merchant"
                        class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Business Title</label>
                        <input type="text" id="create-business-name" placeholder="Brand, Company"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Default PIN Code</label>
                        <input type="text" id="create-owner-pin" placeholder="e.g. 1234" maxLength="4" defaultValue="1234"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none tracking-widest font-bold">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Plan tier</label>
                        <select id="create-sub-plan" class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs focus:border-[#00A6FF] outline-none">
                            <option value="SME Basic">SME Basic</option>
                            <option value="Growth">Growth</option>
                            <option value="Starter Pro">Starter Pro</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="SME Premium">SME Premium</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Plan status</label>
                        <select id="create-sub-status" class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs focus:border-[#00A6FF] outline-none">
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>
                </div>
                
                <button type="submit" class="w-full py-3 bg-gradient-to-r from-blue-600 to-[#00A6FF] text-white rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0">
                    <i data-lucide="check" class="w-4 h-4"></i> Complete Registration
                </button>
            </form>
        </div>
    </div>

    <!-- Edit User Modal -->
    <div id="edit-user-modal" class="fixed inset-0 bg-[#040409]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-[#111329] border border-blue-500/20 max-w-md w-full rounded-[24px] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
            <div class="p-6 border-b border-blue-500/10 flex items-center justify-between shrink-0">
                <h3 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <i data-lucide="edit-3" class="text-[#00A6FF]"></i> Modify Merchant Specifications
                </h3>
                <button onclick="closeEditUserModal()" class="text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            
            <form id="edit-user-form" class="p-6 space-y-4 overflow-y-auto flex-1 mini-scrollbar">
                <input type="hidden" id="edit-user-id">
                <div>
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Login Email / Phone Number Code</label>
                    <input type="text" id="edit-phone-or-email" readonly
                        class="w-full px-3.5 py-2.5 bg-[#0b0c15] text-gray-500 border border-gray-800 rounded-lg text-xs outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Merchant Display Name</label>
                    <input type="text" id="edit-full-name" placeholder="Full name of merchant"
                        class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Business Title</label>
                        <input type="text" id="edit-business-name" placeholder="Brand, Company"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">PIN Authorization Key</label>
                        <input type="text" id="edit-owner-pin" placeholder="PIN" maxLength="6"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none tracking-widest font-bold">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Plan selection</label>
                        <select id="edit-sub-plan" class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs focus:border-[#00A6FF] outline-none">
                            <option value="SME Basic">SME Basic</option>
                            <option value="Growth">Growth</option>
                            <option value="Starter Pro">Starter Pro</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="SME Premium">SME Premium</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Plan status</label>
                        <select id="edit-sub-status" class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs focus:border-[#00A6FF] outline-none">
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                     <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Shop Slug</label>
                        <input type="text" id="edit-shop-slug" placeholder="e.g. bobs-store"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                    </div>
                     <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Trial counts used</label>
                        <input type="number" id="edit-trial-count" min="0" max="10"
                            class="w-full px-3.5 py-2.5 bg-[#0b0c15] border border-gray-800 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#00A6FF] outline-none font-mono">
                    </div>
                </div>
                
                <button type="submit" class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0">
                    <i data-lucide="save" class="w-4 h-4"></i> Apply Specification Updates
                </button>
            </form>
        </div>
    </div>

    <!-- Script Application Logic -->
    <script>
        let adminPassword = localStorage.getItem('system_admin_password_token') || '';
        let systemData = null;
        let activeTab = 'merchants';

        document.addEventListener('DOMContentLoaded', () => {
            if (adminPassword) {
                document.getElementById('admin-password-input').value = adminPassword;
                attemptLogin(adminPassword);
            } else {
                lucide.createIcons();
            }
        });

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = document.getElementById('admin-password-input').value.trim();
            attemptLogin(pass);
        });

        async function attemptLogin(password) {
            const errDiv = document.getElementById('login-error');
            const submitBtn = document.getElementById('login-btn');
            
            errDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Securing Handshake...';

            try {
                const res = await fetch('/api/system-admin/db', {
                    headers: { 'x-admin-password': password }
                });

                if (!res.ok) {
                    throw new Error('Verification link rejected. Access token invalid.');
                }

                systemData = await res.json();
                adminPassword = password;
                localStorage.setItem('system_admin_password_token', adminPassword);
                
                // Transition displays
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('dashboard-container').classList.remove('hidden');
                
                document.body.classList.remove('flex', 'items-center', 'justify-center');
                
                refreshStatCards();
                setTab(activeTab);
            } catch (err) {
                errDiv.textContent = err.message || 'System error. Handshake timed out.';
                errDiv.classList.remove('hidden');
                localStorage.removeItem('system_admin_password_token');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Authenticate Session <i data-lucide="arrow-right" class="w-4 h-4 inline ml-1"></i>';
                lucide.createIcons();
            }
        }

        function logoutAdmin() {
            localStorage.removeItem('system_admin_password_token');
            window.location.reload();
        }

        function refreshStatCards() {
            if (!systemData) return;
            document.getElementById('stat-total-users').textContent = (systemData.users || []).length;
            document.getElementById('stat-total-sessions').textContent = (systemData.merchantSessions || []).length;
            document.getElementById('stat-total-staff').textContent = (systemData.staff || []).length;
            document.getElementById('stat-total-trials').textContent = (systemData.anonymousTrialTrackers || []).length;
            document.getElementById('sessions-count-badge').textContent = \`\${(systemData.merchantSessions || []).length} STABLE CLIENTS\`;
        }

        function setTab(tab) {
            activeTab = tab;
            
            // Toggle highlight tabs
            ['merchants', 'sessions', 'trials', 'rawdb', 'pricing'].forEach(t => {
                const el = document.getElementById(\`tab-\${t}\`);
                const viewEl = document.getElementById(\`view-\${t}\`);
                
                if (t === tab) {
                    el.className = 'px-5 py-3 text-xs font-extrabold border-b-2 border-[#00A6FF] text-[#00A6FF] transition-all flex items-center gap-2';
                    viewEl.classList.remove('hidden');
                } else {
                    el.className = 'px-5 py-3 text-xs font-extrabold border-b-2 border-transparent text-gray-400 hover:text-white transition-all flex items-center gap-2';
                    viewEl.classList.add('hidden');
                }
            });

            if (tab === 'merchants') renderMerchants();
            else if (tab === 'sessions') renderSessions();
            else if (tab === 'trials') renderTrials();
            else if (tab === 'rawdb') loadRawDbEditor();
            else if (tab === 'pricing') loadPricingPricesForm();

            lucide.createIcons();
        }

        async function fetchFreshDB() {
            try {
                const res = await fetch('/api/system-admin/db', {
                    headers: { 'x-admin-password': adminPassword }
                });
                if (res.ok) {
                    systemData = await res.json();
                    refreshStatCards();
                    return true;
                }
            } catch (e) {
                console.error('Failed fetching refreshed system catalog state:', e);
            }
            return false;
        }

        function renderMerchants() {
            const search = document.getElementById('merchant-search').value.toLowerCase().trim();
            const body = document.getElementById('merchants-table-body');
            body.innerHTML = '';

            const filtered = (systemData.users || []).filter(u => {
                const matchId = String(u.id || '').toLowerCase().includes(search);
                const matchEmail = String(u.phone_or_email || '').toLowerCase().includes(search);
                const matchName = String(u.full_name || '').toLowerCase().includes(search);
                const matchBusName = String(u.business_name || '').toLowerCase().includes(search);
                const matchSlug = String(u.shop_slug || '').toLowerCase().includes(search);
                return matchId || matchEmail || matchName || matchBusName || matchSlug;
            });

            if (filtered.length === 0) {
                body.innerHTML = \`
                    <tr>
                        <td colspan="6" class="text-center py-12 text-gray-500 font-medium">
                            <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 text-gray-650 block"></i>
                            No merchant registers matched search parameters
                        </td>
                    </tr>
                \`;
                lucide.createIcons();
                return;
            }

            filtered.forEach(u => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-500/5 transition-colors border-b border-gray-800/20';
                
                const plan = u.subscriptionPlan || 'SME Basic';
                const status = u.subscriptionStatus || 'active';
                const badgeColor = status === 'active' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/30' : 'bg-red-950 text-red-400 border-red-900/30';
                
                let planColor = 'bg-blue-950 text-[#00A6FF] border-blue-900/30';
                const lowerPlan = plan.toLowerCase();
                if (lowerPlan.includes('enterprise')) {
                    planColor = 'bg-rose-950 text-rose-400 border-rose-900/30';
                } else if (lowerPlan.includes('pro') || lowerPlan.includes('starter') || lowerPlan.includes('premium')) {
                    planColor = 'bg-amber-950 text-amber-400 border-amber-900/30';
                } else if (lowerPlan.includes('growth')) {
                    planColor = 'bg-purple-950 text-purple-400 border-purple-900/30';
                }

                tr.innerHTML = \`
                    <td class="py-4 px-5 font-semibold text-white">
                        <div class="font-mono text-xs max-w-[140px] truncate" title="\this.id}">ID: \${u.id}</div>
                        <div class="text-gray-400 font-medium text-[11px] mt-0.5">\${u.phone_or_email}</div>
                    </td>
                    <td class="py-4 px-4 text-gray-300 font-bold">\${u.full_name || '—'}</td>
                    <td class="py-4 px-5">
                        <div class="text-white font-extrabold">\${u.business_name || 'Personal Account'}</div>
                        <div class="text-[10px] text-gray-500 font-mono mt-1">\${u.shop_slug ? \`shop/\${u.shop_slug}\` : 'no-subdomain'}</div>
                    </td>
                    <td class="py-4 px-5 mono font-extrabold tracking-widest text-[#00A6FF]">\${u.owner_pin || '1234'}</td>
                    <td class="py-4 px-5">
                        <div class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border \${planColor}">\${plan}</div>
                        <div class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border \${badgeColor} ml-1.5 capitalize">\${status}</div>
                    </td>
                    <td class="py-4 px-5 text-right space-x-1.5 whitespace-nowrap">
                        <button onclick="openEditUserModal('\${u.id}')" class="p-1 px-2.5 bg-blue-950/40 hover:bg-blue-900/40 text-blue-400 border border-blue-950 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1">
                            <i data-lucide="edit-3" class="w-3 h-3"></i> Modify
                        </button>
                        <button onclick="deleteUser('\${u.id}', '\${u.phone_or_email}')" class="p-1 px-2.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-950 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3 h-3"></i> Purge
                        </button>
                    </td>
                \`;
                body.appendChild(tr);
            });
            lucide.createIcons();
        }

        function renderSessions() {
            const body = document.getElementById('sessions-table-body');
            body.innerHTML = '';
            const list = systemData.merchantSessions || [];

            if (list.length === 0) {
                body.innerHTML = \`
                    <tr>
                        <td colspan="5" class="text-center py-12 text-gray-500 font-medium">
                            <i data-lucide="smartphone" class="w-8 h-8 mx-auto mb-2 text-gray-650 block"></i>
                            No sessions active inside the central router.
                        </td>
                    </tr>
                \`;
                lucide.createIcons();
                return;
            }

            list.forEach(s => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-500/5 transition-colors border-b border-gray-800/20';
                
                const lockedState = s.is_suspicious_locked;
                const statusBadge = lockedState 
                    ? '<span class="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-950 text-rose-400 font-semibold text-[10px] uppercase">🔒 LOCKOUT</span>'
                    : '<span class="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-950 text-emerald-400 font-semibold text-[10px] uppercase">● ACTIVE</span>';

                tr.innerHTML = \`
                    <td class="py-4 px-5 font-semibold text-white">
                        <div class="font-mono text-xs truncate max-w-[140px]" title="\${s.user_id}">\${s.user_id}</div>
                    </td>
                    <td class="py-4 px-5">
                        <div class="font-mono text-gray-400 max-w-[180px] truncate" title="\s.session_id}">\${s.session_id}</div>
                    </td>
                    <td class="py-4 px-5 text-gray-300">
                        <div class="mono text-xs font-bold">\s.last_active_ip || '127.0.0.1'}\${s.last_active_ip || '127.0.0.1'}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">\n                            <i data-lucide="map-pin" class="w-3 h-3 inline mr-0.5"></i>\n                            \${s.last_active_region || 'Unknown'}\n                        </div>
                    </td>
                    <td class="py-4 px-5">\${statusBadge}</td>
                    <td class="py-4 px-5 text-right whitespace-nowrap">
                        \${lockedState ? \`
                            <button onclick="unlockSession('\${s.session_id}')" class="p-1 px-2.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-950 rounded text-[11px] font-bold transition-all mr-2">
                                <i data-lucide="unlock" class="w-3 h-3 inline mr-1"></i> Unlock
                            </button>
                        \` : ''}
                        <button onclick="revokeSession('\${s.session_id}')" class="p-1 px-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-950 rounded text-[11px] font-bold transition-all">
                            <i data-lucide="shield-alert" class="w-3 h-3 inline mr-1"></i> Kill
                        </button>
                    </td>
                \`;
                body.appendChild(tr);
            });
            lucide.createIcons();
        }

        function renderTrials() {
            const body = document.getElementById('trials-table-body');
            body.innerHTML = '';
            const list = systemData.anonymousTrialTrackers || [];

            if (list.length === 0) {
                body.innerHTML = \`
                    <tr>
                        <td colspan="5" class="text-center py-12 text-gray-500 font-medium">
                            <i data-lucide="gift" class="w-8 h-8 mx-auto mb-2 text-gray-650 block"></i>
                            No standalone device trial sessions logged.
                        </td>
                    </tr>
                \`;
                lucide.createIcons();
                return;
            }

            list.forEach(t => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-500/5 transition-colors border-b border-gray-800/20';
                
                const formattedTime = new Date(t.last_request_timestamp || Date.now()).toLocaleTimeString();

                tr.innerHTML = \`
                    <td class="py-4 px-5">
                        <div class="mono text-xs max-w-[200px] truncate" title="\${t.device_fingerprint_hash}">\${t.device_fingerprint_hash}</div>
                    </td>
                    <td class="py-4 px-5 text-gray-300 font-bold">\${t.ip_address || '127.0.0.1'}</td>
                    <td class="py-4 px-5 font-bold">
                        <span class="px-2 py-0.5 rounded bg-blue-950 text-[#00A6FF] mono font-bold">\${t.invoice_count}/2</span>
                    </td>
                    <td class="py-4 px-5 text-gray-400 mono text-[11px]">\${formattedTime}</td>
                    <td class="py-4 px-5 text-right">
                        <button onclick="resetTrial('\${t.device_fingerprint_hash}')" class="p-1 px-2.5 bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 border border-amber-950 rounded text-[11px] font-bold transition-all">
                            <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-1"></i> Reset Limit
                        </button>
                    </td>
                \`;
                body.appendChild(tr);
            });
            lucide.createIcons();
        }

        function loadRawDbEditor() {
            document.getElementById('raw-db-textarea').value = JSON.stringify(systemData, null, 2);
        }

        async function triggerRawSave() {
            if (!window.confirm('⚠️ WARNING: Directly overwriting system db.json could lead to session verification or login failures. Do you wish to override anyway?')) {
                return;
            }

            const rawVal = document.getElementById('raw-db-textarea').value;
            let parsed = null;
            try {
                parsed = JSON.parse(rawVal);
            } catch (err) {
                alert('Parsing failed! Please ensure the JSON is correctly formatted before saving: ' + err.message);
                return;
            }

            try {
                const res = await fetch('/api/system-admin/db', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify(parsed)
                });

                if (res.ok) {
                    alert('🎉 System database state successfully serialized!');
                    await fetchFreshDB();
                    setTab('merchants');
                } else {
                    const data = await res.json();
                    alert('Error: ' + (data.error || 'Serialization aborted.'));
                }
            } catch (e) {
                alert('Network connection error matching system write request.');
            }
        }

        async function loadPricingPricesForm() {
            try {
                const res = await fetch('/api/admin/pricing-prices');
                if (res.ok) {
                    const prices = await res.json();
                    document.getElementById('price-growth-monthly').value = prices.growth_monthly || 4500;
                    document.getElementById('price-growth-annually').value = prices.growth_annually || 45000;
                    document.getElementById('price-pro-monthly').value = prices.pro_monthly || 7500;
                    document.getElementById('price-pro-annually').value = prices.pro_annually || 75000;
                    document.getElementById('price-enterprise-monthly').value = prices.enterprise_monthly || 20000;
                    document.getElementById('price-enterprise-annually').value = prices.enterprise_annually || 200000;
                } else {
                    alert('Failed to retrieve pricing records from endpoint.');
                }
            } catch (err) {
                console.error(err);
                alert('Connection error loading SaaS plans prices.');
            }
        }

        async function savePricingPrices() {
            const prices = {
                growth_monthly: Number(document.getElementById('price-growth-monthly').value) || 0,
                growth_annually: Number(document.getElementById('price-growth-annually').value) || 0,
                pro_monthly: Number(document.getElementById('price-pro-monthly').value) || 0,
                pro_annually: Number(document.getElementById('price-pro-annually').value) || 0,
                enterprise_monthly: Number(document.getElementById('price-enterprise-monthly').value) || 0,
                enterprise_annually: Number(document.getElementById('price-enterprise-annually').value) || 0,
            };

            try {
                const res = await fetch('/api/admin/pricing-prices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ prices })
                });

                if (res.ok) {
                    alert('🎉 Subscription plans pricing updated successfully!');
                    await fetchFreshDB();
                } else {
                    const data = await res.json();
                    alert('Error saving plan pricing changes: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert('Connection failed while writing pricing configurations.');
            }
        }

        function downloadBackup() {
            const blob = new Blob([JSON.stringify(systemData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`yeedem_db_backup_\${Math.floor(Date.now()/1000)}.json\`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        async function triggerUnlockAll() {
            try {
                const res = await fetch('/api/system-admin/unlock-all', {
                    method: 'POST',
                    headers: { 'x-admin-password': adminPassword }
                });
                if (res.ok) {
                    alert('🎉 Bypassed and unlocked all client devices!');
                    await fetchFreshDB();
                    if (activeTab === 'sessions') renderSessions();
                    else refreshStatCards();
                }
            } catch (err) {
                alert('Action failed: Connection to host refused.');
            }
        }

        async function resetTrial(fpHash) {
            try {
                const res = await fetch('/api/system-admin/trial/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ device_fingerprint_hash: fpHash })
                });

                if (res.ok) {
                    await fetchFreshDB();
                    renderTrials();
                }
            } catch (e) {
                alert('API operation timeout.');
            }
        }

        async function clearAllTrials() {
            if (!confirm('Are you sure you want to clear all guest limits?')) return;
            try {
                const res = await fetch('/api/system-admin/trial/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ clear_all: true })
                });

                if (res.ok) {
                    await fetchFreshDB();
                    renderTrials();
                }
            } catch (e) {
                alert('Operation aborted.');
            }
        }

        async function unlockSession(sessId) {
            try {
                const res = await fetch('/api/system-admin/sessions/unlock', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ session_id: sessId })
                });

                if (res.ok) {
                    await fetchFreshDB();
                    renderSessions();
                }
            } catch (e) {
                alert('Communication timeout.');
            }
        }

        async function revokeSession(sessId) {
            if (!confirm('Killing this session will immediately disconnect the user and force them to re-verify. Proceed?')) return;
            try {
                const res = await fetch('/api/system-admin/sessions/delete', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ session_id: sessId })
                });

                if (res.ok) {
                    await fetchFreshDB();
                    renderSessions();
                }
            } catch (e) {
                alert('Action failed.');
            }
        }

        function openCreateUserModal() {
            document.getElementById('create-user-form').reset();
            document.getElementById('create-owner-pin').value = '1234';
            document.getElementById('create-user-modal').classList.remove('hidden');
        }

        function closeCreateUserModal() {
            document.getElementById('create-user-modal').classList.add('hidden');
        }

        document.getElementById('create-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone_or_email = document.getElementById('create-phone-or-email').value.trim();
            const full_name = document.getElementById('create-full-name').value.trim();
            const business_name = document.getElementById('create-business-name').value.trim();
            const owner_pin = document.getElementById('create-owner-pin').value.trim();
            const subscriptionPlan = document.getElementById('create-sub-plan').value;
            const subscriptionStatus = document.getElementById('create-sub-status').value;

            try {
                const res = await fetch('/api/system-admin/users/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({
                        phone_or_email,
                        full_name,
                        business_name,
                        owner_pin,
                        subscriptionPlan,
                        subscriptionStatus
                    })
                });

                if (res.ok) {
                    closeCreateUserModal();
                    await fetchFreshDB();
                    renderMerchants();
                } else {
                    const data = await res.json();
                    alert('Register reject: ' + (data.error || 'Server rejected request.'));
                }
            } catch (err) {
                alert('Submission error.');
            }
        });

        function openEditUserModal(userId) {
            const u = (systemData.users || []).find(x => x.id === userId);
            if (!u) return;

            document.getElementById('edit-user-id').value = u.id;
            document.getElementById('edit-phone-or-email').value = u.phone_or_email || '';
            document.getElementById('edit-full-name').value = u.full_name || '';
            document.getElementById('edit-business-name').value = u.business_name || '';
            document.getElementById('edit-owner-pin').value = u.owner_pin || '';
            document.getElementById('edit-sub-plan').value = u.subscriptionPlan || 'SME Basic';
            document.getElementById('edit-sub-status').value = u.subscriptionStatus || 'active';
            document.getElementById('edit-shop-slug').value = u.shop_slug || '';
            document.getElementById('edit-trial-count').value = u.trialCount || 0;

            document.getElementById('edit-user-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeEditUserModal() {
            document.getElementById('edit-user-modal').classList.add('hidden');
        }

        document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-user-id').value;
            const full_name = document.getElementById('edit-full-name').value.trim();
            const business_name = document.getElementById('edit-business-name').value.trim();
            const owner_pin = document.getElementById('edit-owner-pin').value.trim();
            const subscriptionPlan = document.getElementById('edit-sub-plan').value;
            const subscriptionStatus = document.getElementById('edit-sub-status').value;
            const shop_slug = document.getElementById('edit-shop-slug').value.trim();
            const trialCount = parseInt(document.getElementById('edit-trial-count').value || '0', 10);

            try {
                const res = await fetch('/api/system-admin/users/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({
                        id,
                        full_name,
                        business_name,
                        owner_pin,
                        subscriptionPlan,
                        subscriptionStatus,
                        shop_slug,
                        trialCount
                    })
                });

                if (res.ok) {
                    closeEditUserModal();
                    await fetchFreshDB();
                    renderMerchants();
                } else {
                    const data = await res.json();
                    alert('Failed to update: ' + (data.error || 'Request rejected.'));
                }
            } catch (err) {
                alert('Communication mismatch.');
            }
        });

        async function deleteUser(userId, contact) {
            if (!confirm(\`🚨 EXTREME WARNING: Are you absolutely sure you want to permanently delete merchant "\${contact}"? This will terminate all active merchant sessions and purge their access keys instantly.\`)) {
                return;
            }

            try {
                const res = await fetch('/api/system-admin/users/delete', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify({ id: userId })
                });

                if (res.ok) {
                    await fetchFreshDB();
                    renderMerchants();
                } else {
                    const data = await res.json();
                    alert('Error: ' + data.error);
                }
            } catch (e) {
                alert('Connection mismatch during user eradication.');
            }
        }
    </script>
</body>
</html>
    `);
});

// Admin API endpoints
app.get("/api/system-admin/db", requireSystemAdmin, (req, res) => {
    try {
        const db = readDB();
        res.json(db);
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to load database state" });
    }
});

app.post("/api/system-admin/db", requireSystemAdmin, (req, res) => {
    try {
        const updatedDb = req.body;
        if (!updatedDb || typeof updatedDb !== "object") {
            return res.status(400).json({ error: "Invalid layout data structure" });
        }
        writeDB(updatedDb);
        res.json({ status: "success" });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to persist database state" });
    }
});

app.post("/api/system-admin/users/create", requireSystemAdmin, (req, res) => {
    try {
        const { phone_or_email, full_name, business_name, owner_pin, subscriptionPlan, subscriptionStatus } = req.body;
        if (!phone_or_email) {
            return res.status(400).json({ error: "Email or phone address is required to register a merchant" });
        }

        const normalized = normalizeContact(phone_or_email);
        const db = readDB();

        const existingUser = db.users.find((u: any) => normalizeContact(u.phone_or_email) === normalized);
        if (existingUser) {
            return res.status(400).json({ error: "A merchant with that exact contact info is already registered" });
        }

        const newUser = {
            id: "user_" + Math.random().toString(36).substring(2, 11),
            phone_or_email: normalized,
            otp_secret: "manual_creation_clearance_token_" + Math.floor(Math.random() * 90000),
            full_name: full_name || "Merchant",
            business_name: business_name || "My Retail Business",
            owner_pin: owner_pin || "1234",
            shop_slug: (business_name || "merchant").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
            subscriptionPlan: subscriptionPlan || "SME Basic",
            subscriptionStatus: subscriptionStatus || "active",
            trialCount: 0
        };

        db.users.push(newUser);
        writeDB(db);

        res.json({ status: "success", user: newUser });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Eradication error in user registry" });
    }
});

app.post("/api/system-admin/users/update", requireSystemAdmin, (req, res) => {
    try {
        const { id, full_name, business_name, owner_pin, subscriptionPlan, subscriptionStatus, shop_slug, trialCount } = req.body;
        if (!id) {
            return res.status(400).json({ error: "User specification id required to apply modifications" });
        }

        const db = readDB();
        const userIndex = db.users.findIndex((u: any) => u.id === id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: "Target merchant not detected in live ledger registers" });
        }

        const existBus = db.users[userIndex].business || {};
        db.users[userIndex] = {
            ...db.users[userIndex],
            full_name: full_name ?? db.users[userIndex].full_name,
            business_name: business_name ?? db.users[userIndex].business_name,
            business: {
                ...existBus,
                businessName: business_name ?? existBus.businessName
            },
            owner_pin: owner_pin ?? db.users[userIndex].owner_pin,
            shop_slug: shop_slug !== undefined ? shop_slug : db.users[userIndex].shop_slug,
            subscriptionPlan: subscriptionPlan ?? db.users[userIndex].subscriptionPlan,
            subscriptionStatus: subscriptionStatus ?? db.users[userIndex].subscriptionStatus,
            trialCount: typeof trialCount === 'number' ? trialCount : db.users[userIndex].trialCount
        };

        writeDB(db);
        res.json({ status: "success", user: db.users[userIndex] });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to store merchant modification overlay" });
    }
});

app.delete("/api/system-admin/users/delete", requireSystemAdmin, (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: "Must specify unique merchant ID to clear credentials" });
        }

        const db = readDB();
        
        // Remove the merchant user
        const initialCount = db.users.length;
        db.users = db.users.filter((u: any) => u.id !== id);
        
        if (db.users.length === initialCount) {
            return res.status(404).json({ error: "Merchant registry index reference not discovered" });
        }

        // Kill active user sessions
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== id);

        writeDB(db);
        res.json({ status: "success", id });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Eradication error" });
    }
});

app.post("/api/system-admin/sessions/unlock", requireSystemAdmin, (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) return res.status(400).json({ error: "session_id is required" });

        const db = readDB();
        const sess = db.merchantSessions.find((s: any) => s.session_id === session_id);
        if (sess) {
            sess.is_suspicious_locked = false;
            writeDB(db);
            return res.json({ status: "success" });
        }
        res.status(404).json({ error: "Session identity missing inside core validated session maps" });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Verification lock reset failed." });
    }
});

app.delete("/api/system-admin/sessions/delete", requireSystemAdmin, (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) return res.status(400).json({ error: "session_id is required" });

        const db = readDB();
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.session_id !== session_id);
        writeDB(db);
        res.json({ status: "success" });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Session termination aborted" });
    }
});

app.post("/api/system-admin/trial/reset", requireSystemAdmin, (req, res) => {
    try {
        const { device_fingerprint_hash, clear_all } = req.body;
        const db = readDB();

        if (clear_all) {
            db.anonymousTrialTrackers = [];
            writeDB(db);
            return res.json({ status: "success" });
        }

        if (!device_fingerprint_hash) {
            return res.status(400).json({ error: "Missing identity to clear trial count index" });
        }

        db.anonymousTrialTrackers = db.anonymousTrialTrackers.filter((t: any) => t.device_fingerprint_hash !== device_fingerprint_hash);
        writeDB(db);
        res.json({ status: "success" });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Guest limits reset rejected." });
    }
});

app.post("/api/system-admin/unlock-all", requireSystemAdmin, (req, res) => {
    try {
        const db = readDB();
        db.merchantSessions.forEach((s: any) => s.is_suspicious_locked = false);
        writeDB(db);
        res.json({ status: "success", message: "All sessions successfully cleared of lock triggers." });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Lockout scanner process failed" });
    }
});

app.post("/api/terminal/:shop_slug/:worker_slug/pin-verify", (req, res) => {
    const { pin } = req.body;
    const { shop_slug, worker_slug } = req.params;
    const db = readDB();
    
    const staff = (db.staff || []).find((s: any) => s && s.name_slug === worker_slug && s.is_active);
    
    if (staff && staff.owner_generated_pin === pin) {
        // Create an active session tied to the owner's account with is_staff and staff_id flags
        const session_id = "staff_sess_" + Math.random().toString(36).substring(2, 15);
        const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
        const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
        const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
            ? req.headers['x-forwarded-for'][0] 
            : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

        const session = {
            session_id,
            user_id: staff.user_id,
            device_fingerprint: deviceFingerprint,
            last_active_ip: client_ip,
            last_active_region: approxRegion,
            is_suspicious_locked: false,
            is_staff: true,
            staff_id: staff.id
        };
        db.merchantSessions.push(session);

        // Log successful access
        db.staffActivityLogs.push({ id: Date.now().toString(), staff_id: staff.id, action_taken: 'PIN_LOGIN', timestamp: Date.now(), is_flagged: false });
        writeDB(db);

        // Find associated merchant user
        const user = db.users.find((u: any) => u.id === staff.user_id);

        res.json({ 
            authenticated: true, 
            session_id, 
            staff,
            user: user ? { 
                id: user.id, 
                phone_or_email: user.phone_or_email, 
                full_name: user.full_name, 
                business_name: user.business_name, 
                business_type: user.business_type || 'buy_and_sell',
                business: user.business || null
            } : null
        });
    } else {
        // Log failed access attempt
        db.staffActivityLogs.push({ id: Date.now().toString(), action_taken: 'FAILED_PIN_LOGIN', timestamp: Date.now(), is_flagged: true });
        writeDB(db);
        res.status(401).json({ error: "Invalid PIN" });
    }
});

// --- Module 4/5: Staff Terminal Management API ---
app.get("/api/staff", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const session = (req as any).session;
        if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

        const db = readDB();
        const users = db.users || [];
        const user = users.find((u: any) => u && u.id === user_id);
        const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, '-') : 'default-shop');
        
        const matchedStaff = (db.staff || [])
            .filter((s:any) => s && s.user_id === user_id)
            .map((s: any) => ({
                ...s,
                shop_slug: s.shop_slug || shop_slug
            }));
        res.json(matchedStaff);
    } catch (err: any) {
        console.error("API GET /api/staff error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch staff list" });
    }
});

app.post("/api/staff/log", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        if (!user_id) return res.status(401).json({ error: "Unauthorized" });

        const db = readDB();
        if (!db.staffActivityLogs) db.staffActivityLogs = [];
        const log = {
            id: Date.now().toString(),
            user_id: user_id,
            ...req.body,
            timestamp: Date.now(),
            is_flagged: false
        };
        db.staffActivityLogs.push(log);
        writeDB(db);
        res.json({ status: "success" });
    } catch (err: any) {
        console.error("API POST /api/staff/log error:", err);
        res.status(500).json({ error: err.message || "Failed to add activity log" });
    }
});

app.get("/api/staff/log", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const session = (req as any).session;
        if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

        const db = readDB();
        const logs = (db.staffActivityLogs || []).filter((l:any) => l && l.user_id === user_id);
        res.json(logs);
    } catch (err: any) {
        console.error("API GET /api/staff/log error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch staff logs" });
    }
});

app.post("/api/staff", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const session = (req as any).session;
        if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

        const db = readDB();
        const user = db.users.find((u: any) => u.id === user_id);
        const plan = (user?.subscriptionPlan || 'SME Basic').toLowerCase();

        // Enforce staff limit by plan tier
        const staffList = (db.staff || []).filter((s: any) => s.user_id === user_id);
        let maxStaff = 0;
        if (plan.includes('enterprise')) {
            maxStaff = 999999;
        } else if (plan.includes('pro') || plan.includes('starter pg') || plan.includes('starter')) {
            maxStaff = 3;
        } else {
            maxStaff = 0;
        }

        if (staffList.length >= maxStaff) {
            return res.status(403).json({ 
                error: `Your subscription plan (${user?.subscriptionPlan || 'SME Basic'}) does not support adding staff terminals (Max limit: ${maxStaff}). Please upgrade to the Starter Pro or Enterprise plan in settings.` 
            });
        }

        const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, '-') : 'default-shop');
        
        const rawName = req.body.name_slug || '';
        const name_slug = rawName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

        const newStaff = {
            id: Date.now().toString(),
            user_id,
            shop_id: req.body.shop_id || 'default_shop',
            name_slug: name_slug || rawName,
            owner_generated_pin: req.body.owner_generated_pin,
            is_active: true,
            shop_slug: shop_slug,
            // Toggleable staff permissions
            allow_create_invoices: true,
            allow_view_customers: true,
            allow_view_inventory: true,
            allow_view_costs: false,
            allow_delete_invoices: false,
            allow_manage_products: false
        };
        db.staff = [...(db.staff || []), newStaff];
        writeDB(db);
        res.json(newStaff);
    } catch (err: any) {
        console.error("Error adding staff:", err);
        res.status(500).json({ error: err.message || "Internal server error occurred while creating staff member." });
    }
});

app.put("/api/staff/:id", requireSession, (req, res) => {
    try {
        const db = readDB();
        const user_id = (req as any).user_id;
        const session = (req as any).session;
        if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

        if (!db.staff) db.staff = [];
        const index = db.staff.findIndex((s: any) => s && s.id === req.params.id && s.user_id === user_id);
        if (index !== -1) {
            db.staff[index] = { ...db.staff[index], ...req.body, user_id };
            writeDB(db);
            res.json(db.staff[index]);
        } else {
            res.status(404).json({ error: "Staff member not found" });
        }
    } catch (err: any) {
        console.error("API PUT /api/staff/:id error:", err);
        res.status(500).json({ error: err.message || "Failed to update staff member" });
    }
});

function runLocalFallbackProductParser(text: string): any {
  const productData = {
    name: "General Commodity",
    sku: "SKU-" + Math.floor(100 + Math.random() * 900),
    stock: 10,
    price: 0
  };

  try {
    const rawText = text.trim();

    // 1. Price matching
    const priceMatch = rawText.match(/(?:at|for|price|value.*?of|cost.*?of|₦|N)\s*(\d+(?:\.\d+)?)\s*(k|thousand|million)?/i);
    if (priceMatch) {
      let value = parseFloat(priceMatch[1]);
      const multiplier = priceMatch[2];
      if (multiplier && multiplier.toLowerCase() === 'k') {
        value *= 1000;
      }
      productData.price = value;
    }

    // 2. Stock units matching
    const stockMatch = rawText.match(/(\d+)\s*(?:units|pcs|pieces|bags|items|qty|quantity|stock)/i);
    if (stockMatch) {
      productData.stock = parseInt(stockMatch[1], 10);
    }

    // 3. Name matching
    const nameMatch = rawText.match(/(?:add|create|new|item|product)\s+([\w\s&]+?)(?:\s+(?:with|at|for|under|price|sku|\d+))/i);
    if (nameMatch) {
      productData.name = nameMatch[1].trim();
    } else {
      // Clean up fallback matches
      const cleanTokens = rawText.replace(/(?:add|create|new|item|product|with|at|for|under|price|sku|\d+|units|pcs|pieces|bags|items|qty|quantity|stock)/gi, '').trim();
      if (cleanTokens.length > 3) {
        productData.name = cleanTokens;
      }
    }

    // 4. SKU matching
    const skuMatch = rawText.match(/(?:sku|code|ref)\s*([a-zA-Z0-9\-_]+)/i);
    if (skuMatch) {
      productData.sku = skuMatch[1].toUpperCase();
    } else if (productData.name && productData.name !== "General Commodity") {
      const abbr = productData.name.split(' ').map(w => w[0]).join('').substring(0, 4).toUpperCase();
      if (abbr.length >= 2) {
        productData.sku = `${abbr}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
  } catch (err) {
    console.error("Local fallback product parse error:", err);
  }

  return productData;
}

// Node.js Regex Heuristic Fallback Parser corresponding to python core/utils.py implementation
function parseAmount(valueStr: string, multiplierStr: string | undefined): number {
  if (!valueStr) return 0.0;
  // Strip commas
  const value = parseFloat(valueStr.replace(/,/g, ''));
  if (isNaN(value)) return 0.0;

  if (multiplierStr) {
    const m = multiplierStr.toLowerCase();
    if (['k', 'kilo', 'thousand'].includes(m)) return value * 1000;
    if (['m', 'million'].includes(m)) return value * 1000000;
    if (['b', 'billion'].includes(m)) return value * 1000000000;
  }
  return value;
}

// Node.js Regex Heuristic Fallback Parser corresponding to python core/utils.py implementation
function runLocalFallbackParser(text: string): any {
  const invoiceData = {
    product_name: "General Goods",
    customer_name: "Walk-in Customer",
    items: [] as any[],
    total_amount: 0.0,
    amount_paid: 0.0,
    debt_balance: 0.0,
    transaction_type: "sale"
  };

  try {
    const rawText = text.trim();
    
    // AMOUNT_REGEX for formats like: 100, 100.50, 1,000, 45k, 1.5 million
    const AMOUNT_REGEX = /([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i;

    // 1. Transaction Type
    if (/\b(expense|spent|bought|purchase|cost|paid for|payment for)\b/i.test(rawText)) {
      invoiceData.transaction_type = "expense";
    } else if (/\b(payment on account|deposit on account)\b/i.test(rawText)) {
      invoiceData.transaction_type = "payment_on_account";
    }

    // 2. Extract customer name
    const customerMatch = rawText.match(/(?:to|for|from|buyer|customer|seller)\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|each|deposit|deposited|pay|paid|with|got|received|he|she|on|₦|N|\d+|,|;|\.|\blet\b|$))/i);
    if (customerMatch) {
      const name = customerMatch[1].trim();
      if (name && !/^(bags|units|pieces|kg|items|cash|the)$/i.test(name)) {
        invoiceData.customer_name = name;
      }
    }

    // 3. Extract amount paid / deposit (look for keyword before or after amount)
    const paidMatch = rawText.match(/(?:deposit(?:ed|s|ing)?|paid|pay(?:ing|s)?|got|received?|payment\s*(?:of)?)\s*(?:cash\s+)?(?:of|cash)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i) || 
                      rawText.match(/(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*(?:cash\s+)?(?:deposit|deposited|paid|payment|received|got)/i);
    if (paidMatch) {
      invoiceData.amount_paid = parseAmount(paidMatch[1], paidMatch[2]);
    }

    // 4. Extract quantity, item name
    let qty = 1;
    let prodName = "";

    // Pattern A: "3 bags of Garri" or "3 bags Garri" or "3 Garri"
    const qtyItemRegex = /\b(\d+)\s*(?:bags|units|pieces|pcs|kg|cartons|items|shirts|pairs|bottles)?\s*(?:of)?\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i;
    const qtyItemMatch = rawText.match(qtyItemRegex);
    if (qtyItemMatch) {
      qty = parseInt(qtyItemMatch[1], 10);
      prodName = qtyItemMatch[2].trim();
    } else {
      // Pattern B: No starting number, but item is present
      const itemExtract = rawText.match(/(?:sold|bought|sale of|purchase of)\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i);
      if (itemExtract) {
        prodName = itemExtract[1].trim();
      }
    }

    // Pattern C starting word fallback
    if (!prodName) {
      const startingWordMatch = rawText.match(/^([a-zA-Z]{2,15})(?:\s+(?:₦|N|\d+|for|to|at|each|with|and|he|she|deposited|paid|deposit))/i);
      if (startingWordMatch && !/^(create|record|add|new|sold|bought|sale|expense)$/i.test(startingWordMatch[1])) {
        prodName = startingWordMatch[1].trim();
      }
    }

    if (prodName) {
      prodName = prodName.replace(/\b(bags|units|pieces|cartons|of|kg|items|pcs)\b/gi, '').trim();
      if (prodName.length > 1) {
        invoiceData.product_name = prodName;
      }
    }

    // 5. Extract unit price or total price
    // Search for "each" or "at" pricing
    const eachMatch = rawText.match(/(?:for|at|@)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*each/i) || 
                      rawText.match(/(?:at|@)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);

    let pricePerUnit = 0.0;
    let isUnitPriceFound = false;

    if (eachMatch) {
      pricePerUnit = parseAmount(eachMatch[1], eachMatch[2]);
      isUnitPriceFound = true;
    }

    let totalAmount = 0.0;
    if (isUnitPriceFound) {
      totalAmount = qty * pricePerUnit;
    } else {
      // Look for a lump sum amount like "amounting to 150k", "worth 150k"
      const lumpSumMatch = rawText.match(/(?:for|amounting\s+to|totalling|worth|total\s*(?:of)?)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);
      if (lumpSumMatch) {
        totalAmount = parseAmount(lumpSumMatch[1], lumpSumMatch[2]);
        pricePerUnit = totalAmount / qty;
      } else {
        // Fallback: look for other numbers mapping to price (excluding quantity and paid amount)
        const numbersMatch = [...rawText.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\b/gi)];
        const candidatePrices: number[] = [];
        numbersMatch.forEach(m => {
          const val = parseAmount(m[1], m[2]);
          if (val !== qty && val !== invoiceData.amount_paid) {
            candidatePrices.push(val);
          }
        });

        if (candidatePrices.length > 0) {
          const candidate = candidatePrices[0];
          if (qty > 1 && candidate < 50000) {
            pricePerUnit = candidate;
            totalAmount = qty * pricePerUnit;
          } else {
            totalAmount = candidate;
            pricePerUnit = totalAmount / qty;
          }
        }
      }
    }

    if (totalAmount === 0 && pricePerUnit > 0) {
      totalAmount = qty * pricePerUnit;
    }
    if (pricePerUnit === 0 && totalAmount > 0) {
      pricePerUnit = totalAmount / qty;
    }

    invoiceData.total_amount = totalAmount;
    invoiceData.items = [
      {
        name: invoiceData.product_name,
        quantity: qty,
        price: pricePerUnit,
        total: totalAmount
      }
    ];

    invoiceData.debt_balance = Math.max(0.0, totalAmount - invoiceData.amount_paid);

  } catch (err) {
    console.error("Local fallback parse error:", err);
  }

  return invoiceData;
}

// Full-Stack Smart Input Processor in Express API
app.post("/api/smart-input", async (req, res) => {
  const { text, file } = req.body;
  const session_id = req.headers['x-session-id'] as string;

  let user_id = null;
  if (session_id) {
    // Validate session
    const db = readDB();
    const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    // Auto-heal locks
    session.is_suspicious_locked = false;
    
    // Live validation of ongoing administrative request client characteristics
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);
    
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
        if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
            session.device_fingerprint = device_fingerprint;
            writeDB(db);
        } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
            isMismatched = true;
        }
    }

    if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
        console.warn(`[PASSIVE ANOMALY] Smart input device mismatch: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
    }
    user_id = session.user_id;
  } else {
    // Treat as Guest Trial Mode
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(403).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    writeDB(db);
  }

  console.log("Received smart-input payload: text=", text, "file.mimeType=", file?.mimeType);
  console.log("AI client instantiated:", !!ai);
  if (!ai) {
    console.log("AI client is missing (check GEMINI_API_KEY environment variable). Falling back to local parser.");
  }

  // Fallback checks
  if (!text && !file) {
    return res.status(400).json({ status: "error", error: "Please enter text descriptions, record voice, or upload file snapshots." });
  }

  // 1. If Gemini AI instantiated, attempt structured output using gemini-1.5-flash model
  if (ai) {
    try {
      const parts: any[] = [];
       const prompt = `You are an expert bookkeeping AI for microlenders and retail SMEs in Nigeria. 
       Analyze the input (it could be handwritten notebook snapshots, voices, or general transaction memos) and return a structured bookkeeping ledger invoice.
       
       You MUST return values mapping to the expected JSON schema.
       
       SUPPORT QUICK-ENTRY STRUCTURES NATIVELY:
       - Single Sale entry layout e.g. "5 bags of rice at 75000" should map to:
         items: [{ name: "rice", quantity: 5, price: 75000, total: 375000 }]
         total_amount: 375000
         amount_paid: 0
         debt_balance: 375000
       - Multiple entries layout e.g.:
         "2 bags of rice at 75000
         3 cartons of spaghetti at 9000
         paid 100000"
         should map to:
         items: [
           { name: "rice", quantity: 2, price: 75000, total: 150000 },
           { name: "spaghetti", quantity: 3, price: 9000, total: 27000 }
         ]
         total_amount: 177000
         amount_paid: 100000
         debt_balance: 77000

       IMPORTANT parameters:
       1. 'product_name' must be a flat single string summing the main items (e.g., 'Garri, Sugar' or just 'Cotton Shirts')
       2. 'customer_name' must be the buyer's name. If not designated, use 'Walk-in Customer'
       3. 'transaction_type' must be either 'sale' or 'expense' or 'payment_on_account'
       4. 'amount_paid' is the deposit or cash handed over immediately. Default is 0.
       5. 'total_amount' is the total item value sum.
       6. 'debt_balance' is the outstanding balance (total_amount - amount_paid).
       `;
      parts.push({ text: prompt });

      if (text) {
        parts.push({ text: `Text Ledger Node: ${text}` });
      }

      if (file && file.data) {
        // file.data is a base64 encoded string
        parts.push({
          inlineData: {
            mimeType: file.mimeType || "image/jpeg",
            data: file.data
          }
        });
      }

      let response;
      let delayMs = 1500;
      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const currentModel = modelsToTry[attempt - 1] || "gemini-3.5-flash";
        try {
          console.log(`Attempt ${attempt}: Calling ai.models.generateContent in /api/smart-input with model ${currentModel}...`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  product_name: { type: Type.STRING, description: "Main unified product name string" },
                  customer_name: { type: Type.STRING, description: "Customer name or 'Walk-in Customer'" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.INTEGER },
                        price: { type: Type.NUMBER },
                        total: { type: Type.NUMBER }
                      },
                      required: ["name", "quantity", "price", "total"]
                    }
                  },
                  total_amount: { type: Type.NUMBER },
                  amount_paid: { type: Type.NUMBER },
                  debt_balance: { type: Type.NUMBER },
                  transaction_type: { type: Type.STRING }
                },
                required: ["product_name", "customer_name", "items", "total_amount", "amount_paid", "debt_balance"]
              },
              temperature: 0.1
            }
          });
          break;
        } catch (err: any) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          
          // Try to extract suggested retry delay from error message, default to exponential backoff
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1000;
          }
          
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }

      if (response && response.text) {
        console.log("Gemini API call successful, response text:", response.text);
        const parsed = JSON.parse(response.text.trim());
        // Normalizes to prevent KeyError crash downstream
        if (!parsed.product_name) {
          parsed.product_name = parsed.items && parsed.items[0] ? parsed.items[0].name : "General Goods";
        }
        return res.json({ status: "success", parsed_data: parsed });
      }
    } catch (apiError: any) {
      console.error("Gemini AI API Call failed, triggering heuristic backup parser. Error:", apiError.message, "Stack:", apiError.stack);
    }
  }

  // 2. Local fallback regex parsing triggers when AI client fails, is missing, or is offline!
  console.log("Triggered local fallback regex parser");
  const extractedFallback = runLocalFallbackParser(text || "");
  console.log("Local fallback parser result:", extractedFallback);
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic fallback engine."
  });
});

// Full-Stack Smart Product Processor in Express API
app.post("/api/smart-product", async (req, res) => {
  const { text } = req.body;
  const session_id = req.headers['x-session-id'] as string;

  let user_id = null;
  if (session_id) {
    // Validate session
    const db = readDB();
    const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    // Auto-heal locks
    session.is_suspicious_locked = false;
    
    // Live validation of ongoing administrative request client characteristics
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);
    
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
        if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
            session.device_fingerprint = device_fingerprint;
            writeDB(db);
        } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
            isMismatched = true;
        }
    }

    if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
        console.warn(`[PASSIVE ANOMALY] Smart product device mismatch: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
    }
    user_id = session.user_id;
  } else {
    // Treat as Guest Trial Mode
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(403).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    writeDB(db);
  }

  console.log("Received smart-product payload: text =", text);

  // Fallback checks
  if (!text) {
    return res.status(400).json({ status: "error", error: "Please enter product descriptions." });
  }

  // 1. If Gemini AI instantiated, attempt structured output using gemini-1.5-flash model
  if (ai) {
    try {
      const parts: any[] = [];
      const prompt = `You are an expert product catalog AI for microlenders and retail SMEs in Nigeria. 
      Analyze the text description of an inventory product and return a structured product Catalog record.
      
      You MUST return values mapping to the expected JSON schema.
      IMPORTANT parameters:
      1. 'name' must be the clean, customer-facing product or item name. (e.g., 'Aso Ebi Teal Fabric' or 'Groundnut Oil 5L')
      2. 'sku' must be an uppercase short alphanumeric SKU code representation (e.g., 'ASE-TL', 'GNO-5L'). If not designated, generate an appropriate abbreviation SKU from the product name.
      3. 'stock' is the initial stock quantity count. Default is 10.
      4. 'price' is the unit cost or price in Nigerian Naira (₦). Default is 0.
      `;
      parts.push({ text: prompt });
      parts.push({ text: `Product Input text: ${text}` });

      let response;
      let delayMs = 1500;
      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const currentModel = modelsToTry[attempt - 1] || "gemini-3.5-flash";
        try {
          console.log(`Attempt ${attempt}: Calling ai.models.generateContent in /api/smart-catalog with model ${currentModel}...`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Normalized clean product name" },
                  sku: { type: Type.STRING, description: "Short uppercase SKU code (e.g., OIL-5L)" },
                  stock: { type: Type.INTEGER, description: "Initial quantity in stock" },
                  price: { type: Type.NUMBER, description: "Unit price of the product" }
                },
                required: ["name", "sku", "stock", "price"]
              },
              temperature: 0.1
            }
          });
          break;
        } catch (err: any) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          
          // Try to extract suggested retry delay from error message, default to exponential backoff
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1000;
          }
          
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json({ status: "success", parsed_data: parsed });
      }
    } catch (apiError) {
      console.error("Gemini AI Product API Call failed, triggering heuristic backup product parser:", apiError);
    }
  }

  // 2. Local fallback regex parsing triggers when AI client fails, is missing, or is offline!
  console.log("Triggered local fallback regex product parser");
  const extractedFallback = runLocalFallbackProductParser(text || "");
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic product fallback engine."
  });
});

// --- Module Backup: Local Disk/Storage JSON Backup Automated Exporter ---
const BACKUPS_DIR = process.env.VERCEL ? path.join('/tmp', 'backups') : path.join(process.cwd(), 'data', 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error("Could not create backups directory:", err);
  }
}

function mergeLedgers(incoming: any, existing: any) {
    if (!existing || !existing.data) return incoming;
    if (!incoming || !incoming.data) return existing;
    
    const merged = JSON.parse(JSON.stringify(incoming));
    if (!merged.data) merged.data = {};
    const existingData = existing.data;
    
    // 1. Merge Customers & Invoices
    const incomingCustomers = merged.data.customers || [];
    const existingCustomers = existingData.customers || [];
    const customerMap = new Map<string, any>();
    
    const getCustKey = (c: any) => {
        return (c.name || '').trim().toLowerCase();
    };
    
    for (const cust of existingCustomers) {
        const key = getCustKey(cust);
        customerMap.set(key, { ...cust, invoices: [...(cust.invoices || [])] });
    }
    
    for (const cust of incomingCustomers) {
        const key = getCustKey(cust);
        const existingCust = customerMap.get(key);
        if (existingCust) {
            const invoiceMap = new Map<string, any>();
            for (const inv of existingCust.invoices || []) {
                if (inv && inv.id) {
                    invoiceMap.set(inv.id, inv);
                }
            }
            for (const inv of cust.invoices || []) {
                if (inv && inv.id) {
                    const existingInv = invoiceMap.get(inv.id);
                    if (existingInv) {
                        const existingTime = new Date(existingInv.createdAt || 0).getTime();
                        const incomingTime = new Date(inv.createdAt || 0).getTime();
                        if (incomingTime >= existingTime) {
                            invoiceMap.set(inv.id, inv);
                        }
                    } else {
                        invoiceMap.set(inv.id, inv);
                    }
                }
            }
            
            const mergedInvoices = Array.from(invoiceMap.values());
            
            const activeDebtBalance = mergedInvoices.reduce((sum: number, inv: any) => {
                if (inv.transactionType === 'sale') {
                    return sum + (inv.debtBalance || 0);
                }
                return sum;
            }, 0);
            
            customerMap.set(key, {
                ...existingCust,
                id: cust.id || existingCust.id,
                phone: cust.phone || existingCust.phone,
                email: cust.email || existingCust.email,
                activeDebtBalance,
                createdDate: (cust.createdDate && existingCust.createdDate && cust.createdDate < existingCust.createdDate) ? cust.createdDate : (cust.createdDate || existingCust.createdDate),
                invoices: mergedInvoices
            });
        } else {
            customerMap.set(key, { ...cust });
        }
    }
    merged.data.customers = Array.from(customerMap.values());
    
    // 2. Merge Products & Stocks
    const incomingProducts = merged.data.products || [];
    const existingProducts = existingData.products || [];
    const productMap = new Map<string, any>();
    
    const getProdKey = (p: any) => {
        return (p.name || '').trim().toLowerCase();
    };
    
    for (const prod of existingProducts) {
        productMap.set(getProdKey(prod), { ...prod });
    }
    
    for (const prod of incomingProducts) {
        const key = getProdKey(prod);
        const existingProd = productMap.get(key);
        if (existingProd) {
            productMap.set(key, {
                ...existingProd,
                ...prod
            });
        } else {
            productMap.set(key, { ...prod });
        }
    }
    merged.data.products = Array.from(productMap.values());
    
    // 3. Merge Restock logs
    const incomingLogs = merged.data.restockLogs || [];
    const existingLogs = existingData.restockLogs || [];
    const logMap = new Map<string, any>();
    
    for (const log of existingLogs) {
        if (log && log.id) logMap.set(log.id, log);
    }
    for (const log of incomingLogs) {
        if (log && log.id) logMap.set(log.id, log);
    }
    merged.data.restockLogs = Array.from(logMap.values());
    
    // 4. Merge Business Settings
    if (existing.businessProfile && !merged.businessProfile) {
        merged.businessProfile = existing.businessProfile;
    } else if (merged.businessProfile && existing.businessProfile) {
        merged.businessProfile = {
            ...existing.businessProfile,
            ...merged.businessProfile
        };
    }
    
    return merged;
}

app.post("/api/backup/save", (req, res) => {
    try {
        const session_id = req.headers['x-session-id'] as string;
        if (!session_id) return res.status(401).json({ error: "Session required" });
        const db = readDB();
        const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
        if (!session) return res.status(401).json({ error: "Invalid session" });

        const { email, backupData } = req.body;
        const user_id = session.user_id;
        
        if (!email || !backupData) {
            return res.status(400).json({ error: "Missing email or backupData parameters" });
        }
        
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Fetch existing latest backup file to merge
        let existingBackupData: any = null;
        if (fs.existsSync(BACKUPS_DIR)) {
            const files = fs.readdirSync(BACKUPS_DIR);
            const userBackupFiles = files
                .filter(f => f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(BACKUPS_DIR, f);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: f,
                        mtime: stats.mtime.getTime()
                    };
                })
                .sort((a, b) => b.mtime - a.mtime);
            
            if (userBackupFiles.length > 0) {
                const latestFile = userBackupFiles[0].filename;
                const filePath = path.join(BACKUPS_DIR, latestFile);
                try {
                    existingBackupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                } catch (e) {
                    console.error("Failed to parse existing backup for auto-merge:", e);
                }
            }
        }

        // Run Bidirectional auto-merger logic on server
        const mergedBackupData = mergeLedgers(backupData, existingBackupData);
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `backup_${safeEmail}_${timestamp}.json`;
        const filePath = path.join(BACKUPS_DIR, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(mergedBackupData, null, 2), 'utf-8');
        console.log(`[BACKUP SUCCESS] Bidirectionally merged automated backup file saved: ${fileName} for ${email}`);
        
        res.json({ 
            status: "success", 
            message: "Ledger backup exported, bidirectionally merged, and written to server disk successfully.",
            filename: fileName,
            timestamp: new Date().toISOString(),
            mergedData: mergedBackupData
        });
    } catch (err: any) {
        console.error("Backup write error:", err);
        res.status(500).json({ error: err.message || "Failed to write backup JSON file" });
    }
});

app.get("/api/backup/list", requireSession, (req, res) => {
    try {
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(404).json({ error: "Merchant profile not found" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!fs.existsSync(BACKUPS_DIR)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(BACKUPS_DIR);
        const userBackups = files
            .filter(f => f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json'))
            .map(f => {
                const filePath = path.join(BACKUPS_DIR, f);
                const stats = fs.statSync(filePath);
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
        res.json(userBackups);
    } catch (err: any) {
        console.error("Error listing backups:", err);
        res.status(500).json({ error: err.message || "Failed to catalog backup list" });
    }
});

app.get("/api/backup/download/:filename", requireSession, (req, res) => {
    try {
        const { filename } = req.params;
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(401).json({ error: "Unauthorized access" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith('.json')) {
            return res.status(400).json({ error: "Forbidden: Unauthorized backup target access file" });
        }
        
        const filePath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Backup file could not be found on server disk" });
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.parse(fileContent));
    } catch (err: any) {
        console.error("Download backup error:", err);
        res.status(500).json({ error: err.message || "Failed to download backup file" });
    }
});

app.delete("/api/backup/:filename", requireSession, (req, res) => {
    try {
        const { filename } = req.params;
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(401).json({ error: "Unauthorized" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith('.json')) {
            return res.status(400).json({ error: "Forbidden" });
        }
        
        const filePath = path.join(BACKUPS_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ status: "success", message: "Automated daily backup file pruned successfully." });
    } catch (err: any) {
        console.error("Delete backup error:", err);
        res.status(500).json({ error: err.message || "Failed to delete backup" });
    }
});

app.post("/api/auth/verify-skipped-account", requireSession, (req, res) => {
    const db = readDB();
    const user_id = (req as any).user_id;
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    user.verification_skipped = false;
    user.isVerified = true;
    
    writeDB(db);
    res.json({ status: "success", verification_skipped: false, user });
});

app.post("/api/business/settings", requireSession, (req, res) => {
    const db = readDB();
    const user_id = (req as any).user_id;
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    user.business = req.body.business;
    
    // Align root level configurations of user profile with updated business settings
    if (req.body.business) {
        user.business_name = req.body.business.businessName || user.business_name;
        user.business_type = req.body.business.businessType || user.business_type;
        user.address = req.body.business.address || user.address;
        user.phone = req.body.business.phone || user.phone;
        user.shop_slug = (user.business_name || "My Business").toString().toLowerCase().replace(/\s+/g, '-');
    }
    
    writeDB(db);
    res.json({ status: "success" });
});

app.get("/api/images/:shop_slug/logo.png", (req, res) => {
    const db = readDB();
    const user = db.users.find((u: any) => u.shop_slug === req.params.shop_slug);
    if (!user || !user.business || !user.business.businessLogo) {
        return res.status(404).send("Logo not found");
    }
    
    const base64Data = user.business.businessLogo.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length
    });
    res.end(imgBuffer);
});

// Configure Vite or Static Servers
async function start() {
  // Sync the user-provided logo to public assets for browser titles/favicons/link previews
  try {
    const logoSrc = path.join(process.cwd(), 'src', 'assets', 'images', 'yeedem_books_logo_1779553023368.png');
    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(logoSrc)) {
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.copyFileSync(logoSrc, path.join(publicDir, 'favicon.png'));
      fs.copyFileSync(logoSrc, path.join(publicDir, 'pwa_icon_logo.png'));
      console.log('⚡ Successfully synced public favicons and pwa_icon_logo with user-supplied logo.');
    } else {
      console.warn('⚠️ User og/favicon logo asset not found at:', logoSrc);
    }
  } catch (err) {
    console.error('❌ Failed to copy custom logo assets to public:', err);
  }

  const getInjectedHtml = async (url: string, template: string, db: any, host: string) => {
    let ogTitle = "Yeedem Books - Fast Bookkeeping & Invoicing";
    let ogDesc = "Automated ledger tracking and real-time debt bookkeeping parameters for modern Nigerian merchant enterprises.";
    let ogImage = `https://${host}/pwa_icon_logo.png`;

    const terminalMatch = url.match(/^\/terminal\/([^\/]+)\/([^\/]+)/);
    if (terminalMatch) {
      const shopSlug = terminalMatch[1];
      const user = db.users.find((u: any) => u.shop_slug === shopSlug);
      
      const shopName = user?.business?.businessName || user?.business_name || "Business";
      ogTitle = `${shopName} - Sales Terminal Managed by Yeedem Books`;
      ogDesc = `Official secure cashier access link for ${shopName}. Enter assigned 4-digit PIN to process secure checkout logs.`;
      
      if (user?.business?.businessLogo) {
        ogImage = `https://${host}/api/images/${shopSlug}/logo.png`;
      }
    }

    return template
      .replace(/<meta name="description" content="[^"]*"[^>]*>/, `<meta name="description" content="${ogDesc}" />`)
      .replace(/<meta property="og:title" content="[^"]*"[^>]*>/, `<meta property="og:title" content="${ogTitle}" />`)
      .replace(/<meta property="og:description" content="[^"]*"[^>]*>/, `<meta property="og:description" content="${ogDesc}" />`)
      .replace(/<meta property="og:image" content="[^"]*"[^>]*>/, `<meta property="og:image" content="${ogImage}" />`)
      .replace(/<meta name="twitter:title" content="[^"]*"[^>]*>/, `<meta name="twitter:title" content="${ogTitle}" />`)
      .replace(/<meta name="twitter:description" content="[^"]*"[^>]*>/, `<meta name="twitter:description" content="${ogDesc}" />`)
      .replace(/<meta name="twitter:image" content="[^"]*"[^>]*>/, `<meta name="twitter:image" content="${ogImage}" />`);
  };

  // Helper and APIs for Email Invoice deliveries & Background Retry Scheduler
  function generateInvoiceEmailHtml(invoiceData: any, businessName: string, merchant: any): string {
    const items = invoiceData.items || [
        { name: invoiceData.productName || 'Sale Event', quantity: 1, price: invoiceData.totalAmount || 0, total: invoiceData.totalAmount || 0 }
    ];
    
    let itemRows = '';
    items.forEach((item: any) => {
        itemRows += `
            <tr style="border-b: 1px solid #edf2f7;">
                <td style="padding: 12px 0; font-size: 14px; color: #2d3748;">${item.name || 'Product'}</td>
                <td style="padding: 12px 0; font-size: 14px; color: #4a5568; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 12px 0; font-size: 14px; color: #4a5568; text-align: right;">₦${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #1a202c; text-align: right;">₦${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tax Invoice</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background-color: #0E1338; padding: 32px; color: #ffffff; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; text-transform: uppercase;">Tax Invoice</h1>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #a0aec0;">Delivered digitally by ${businessName}</p>
                </div>
                
                <div style="padding: 32px;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                        <tr>
                            <td style="padding: 0; font-size: 13px; color: #718096; line-height: 1.5;">
                                <strong>Invoice ID:</strong> #${invoiceData.id || 'N/A'}<br>
                                <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}<br>
                                <strong>Merchant:</strong> ${businessName}
                            </td>
                            <td style="padding: 0; text-align: right; font-size: 13px; color: #718096; line-height: 1.5; vertical-align: top;">
                                <strong>Recipient Client:</strong><br>
                                <span style="font-size: 14px; font-weight: 600; color: #2d3748;">${invoiceData.customerName || 'Valued Client'}</span>
                            </td>
                        </tr>
                    </table>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                        <thead>
                            <tr style="border-b: 2px solid #e2e8f0;">
                                <th style="padding: 8px 0; text-align: left; font-size: 11px; font-weight: 750; text-transform: uppercase; color: #a0aec0;">Description</th>
                                <th style="padding: 8px 0; text-align: center; font-size: 11px; font-weight: 750; text-transform: uppercase; color: #a0aec0;">Qty</th>
                                <th style="padding: 8px 0; text-align: right; font-size: 11px; font-weight: 750; text-transform: uppercase; color: #a0aec0;">Unit Price</th>
                                <th style="padding: 8px 0; text-align: right; font-size: 11px; font-weight: 750; text-transform: uppercase; color: #a0aec0;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemRows}
                        </tbody>
                    </table>
                    
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.8;">
                            <tr>
                                <td style="padding: 0; color: #718096;">Subtotal:</td>
                                <td style="padding: 0; text-align: right; font-weight: 500; color: #2d3748;">₦${(invoiceData.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td style="padding: 0; color: #718096;">Amount Paid:</td>
                                <td style="padding: 0; text-align: right; font-weight: 600; color: #38a169;">₦${(invoiceData.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
                                <td style="padding: 8px 0 0 0; font-size: 16px; font-weight: 700; color: #2d3748;">Outstanding Balance:</td>
                                <td style="padding: 8px 0 0 0; text-align: right; font-size: 16px; font-weight: 700; color: #e53e3e;">₦${(invoiceData.debtBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="border-top: 1px solid #edf2f7; padding-top: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #a0aec0; line-height: 1.5;">
                            If you have questions about this statement, please contact the merchant directly.<br>
                            Thank you for your business!
                        </p>
                    </div>
                </div>
                
                <div style="background-color: #f7fafc; padding: 16px; border-top: 1px solid #edf2f7; text-align: center;">
                    <span style="font-size: 11px; font-weight: 500; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.05em;">Powered by Yeedem Books</span>
                </div>
            </div>
        </body>
        </html>
    `;
  }

  app.post("/api/invoices/send-email", requireSession, async (req, res) => {
    const { invoiceId, recipientEmail, customerName, invoiceData } = req.body;
    const user_id = (req as any).user_id;
    
    if (!invoiceId || !recipientEmail || !invoiceData) {
        return res.status(400).json({ error: "Missing required parameters: invoiceId, recipientEmail, or invoiceData." });
    }
    
    const db = readDB();
    db.invoiceEmailQueue = db.invoiceEmailQueue || [];
    
    const taskId = "task_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    const queueItem = {
        id: taskId,
        user_id,
        invoiceId,
        customerName: customerName || invoiceData.customerName || "Valued Customer",
        recipientEmail: recipientEmail.trim().toLowerCase(),
        invoiceData,
        status: 'pending',
        attempts: 0,
        lastAttemptAt: undefined,
        errorMessage: undefined,
        sentAt: undefined
    };
    
    db.invoiceEmailQueue.push(queueItem);
    writeDB(db);
    
    console.log(`[INVOICE EMAIL] Initiating instant dispatch for task ${taskId} (Invoice #${invoiceId})`);
    
    const apiKey = getResendApiKey();
    if (!apiKey) {
        queueItem.status = 'failed';
        queueItem.attempts = 1;
        queueItem.lastAttemptAt = Date.now();
        queueItem.errorMessage = "RESEND_API_KEY environment variable is not defined on the server.";
        const freshDb = readDB();
        freshDb.invoiceEmailQueue = freshDb.invoiceEmailQueue || [];
        const idx = freshDb.invoiceEmailQueue.findIndex((i: any) => i.id === taskId);
        if (idx !== -1) {
            freshDb.invoiceEmailQueue[idx] = queueItem;
            writeDB(freshDb);
        }
        return res.json({
            status: "queued",
            message: "Email queued, but dispatch failed: Resend SDK key is not configured.",
            taskId,
            queueItem
        });
    }
    
    try {
        const { Resend } = await import("resend");
        const resendInstance = new Resend(apiKey);
        const fromEmail = process.env.RESEND_FROM || 'Yeedem Invoices <noreply@yeedem.com>';
        
        const merchant = db.users.find((u: any) => u.id === user_id);
        const businessName = merchant ? (merchant.business_name || merchant.phone_or_email) : 'Yeedem Merchant';
        
        const subject = `Tax Invoice from ${businessName} (Ref: #${invoiceId})`;
        const emailHtml = generateInvoiceEmailHtml(invoiceData, businessName, merchant);
        
        queueItem.attempts = 1;
        queueItem.lastAttemptAt = Date.now();
        
        const response = await resendInstance.emails.send({
            from: fromEmail,
            to: queueItem.recipientEmail,
            subject: subject,
            html: emailHtml
        });
        
        if (response && response.error) {
            throw response.error;
        }
        
        console.log(`[INVOICE EMAIL] Instant dispatch succeeded for task ${taskId}:`, response);
        queueItem.status = 'success';
        queueItem.sentAt = Date.now();
        queueItem.errorMessage = '';
        
        const freshDb = readDB();
        freshDb.invoiceEmailQueue = freshDb.invoiceEmailQueue || [];
        const idx = freshDb.invoiceEmailQueue.findIndex((i: any) => i.id === taskId);
        if (idx !== -1) {
            freshDb.invoiceEmailQueue[idx] = queueItem;
            writeDB(freshDb);
        }
        
        return res.json({
            status: "success",
            message: "Invoice email sent successfully.",
            taskId,
            queueItem
        });
    } catch (err: any) {
        console.warn(`[INVOICE EMAIL] Instant dispatch notice for task ${taskId}:`, err.message || String(err));
        queueItem.status = 'failed';
        queueItem.attempts = 1;
        queueItem.lastAttemptAt = Date.now();
        queueItem.errorMessage = err.message || String(err);
        
        const freshDb = readDB();
        freshDb.invoiceEmailQueue = freshDb.invoiceEmailQueue || [];
        const idx = freshDb.invoiceEmailQueue.findIndex((i: any) => i.id === taskId);
        if (idx !== -1) {
            freshDb.invoiceEmailQueue[idx] = queueItem;
            writeDB(freshDb);
        }
        
        return res.json({
            status: "failed_queued",
            message: `Instant dispatch failed: ${err.message || err}. Task queued for background auto-retry.`,
            taskId,
            queueItem
        });
    }
  });

  app.get("/api/invoices/email-queue", requireSession, (req, res) => {
    const user_id = (req as any).user_id;
    const db = readDB();
    const queue = db.invoiceEmailQueue || [];
    const userQueue = queue.filter((i: any) => i.user_id === user_id);
    res.json({ queue: userQueue });
  });

  // Background automated back-off retry worker for invoice email deliveries
  async function processInvoiceEmailQueue() {
    try {
        const db = readDB();
        if (!db.invoiceEmailQueue || db.invoiceEmailQueue.length === 0) return;
        
        const failedOrPending = db.invoiceEmailQueue.filter(
            (item: any) => (item.status === 'failed' || item.status === 'pending') && item.attempts < 5
        );
        
        if (failedOrPending.length === 0) return;
        
        console.log(`[BACKGROUND INVOICE RETRY] Found ${failedOrPending.length} pending/failed invoice email delivery tasks to process/retry.`);
        
        const { Resend } = await import("resend");
        const apiKey = getResendApiKey();
        if (!apiKey) {
            console.warn("[BACKGROUND INVOICE RETRY] Resend API Key is not defined. Skipping retries.");
            return;
        }
        
        const resendInstance = new Resend(apiKey);
        const fromEmail = process.env.RESEND_FROM || 'Yeedem Invoices <noreply@yeedem.com>';
        
        let changed = false;
        
        for (const task of failedOrPending) {
            const merchant = db.users.find((u: any) => u.id === task.user_id);
            const businessName = merchant ? (merchant.business_name || merchant.phone_or_email) : 'Yeedem Merchant';
            
            task.attempts++;
            task.lastAttemptAt = Date.now();
            
            try {
                const subject = `Tax Invoice from ${businessName} (Ref: #${task.invoiceId})`;
                const emailHtml = generateInvoiceEmailHtml(task.invoiceData, businessName, merchant);
                
                console.log(`[BACKGROUND INVOICE RETRY] Attempt ${task.attempts} to deliver invoice #${task.invoiceId} to ${task.recipientEmail}...`);
                const response = await resendInstance.emails.send({
                    from: fromEmail,
                    to: task.recipientEmail,
                    subject: subject,
                    html: emailHtml
                });
                
                if (response && response.error) {
                    throw response.error;
                }
                
                console.log(`[BACKGROUND INVOICE RETRY] Success for task ${task.id}`);
                task.status = 'success';
                task.sentAt = Date.now();
                task.errorMessage = '';
                changed = true;
            } catch (err: any) {
                console.warn(`[BACKGROUND INVOICE RETRY] Sandbox notice or fail on attempt ${task.attempts} for task ${task.id}:`, err.message || String(err));
                task.status = 'failed';
                task.errorMessage = err.message || String(err);
                changed = true;
            }
        }
        
        if (changed) {
            const freshDb = readDB();
            freshDb.invoiceEmailQueue = freshDb.invoiceEmailQueue || [];
            freshDb.invoiceEmailQueue = freshDb.invoiceEmailQueue.map((item: any) => {
                const updated = db.invoiceEmailQueue.find((u: any) => u.id === item.id);
                return updated ? updated : item;
            });
            writeDB(freshDb);
        }
    } catch (err) {
        console.error("[BACKGROUND INVOICE RETRY] Unhandled error in background job:", err);
    }
  }

  // Run automatically every 30 seconds
  setInterval(processInvoiceEmailQueue, 30000);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.startsWith('/@vite') || url.startsWith('/src')) {
           return next();
        }

        const templatePath = path.resolve('index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        const db = readDB();
        const host = req.get('host') || `localhost:${PORT}`;
        template = await getInjectedHtml(url, template, db, host);
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      if (req.originalUrl.startsWith('/api')) return res.status(404).send('Not found');
      
      let template = fs.readFileSync(path.join(distPath, "index.html"), 'utf-8');
      const db = readDB();
      const host = req.get('host') || `localhost:${PORT}`;
      template = await getInjectedHtml(req.originalUrl, template, db, host);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Express server running on http://localhost:${PORT}`);
    });
  }
}

start();

export default app;
