// server.ts
import express from "express";
import path from "path";
import fs2 from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Paystack from "paystack";

// server/db.ts
import { join } from "path";
import fs from "fs";
var isVercel = !!process.env.VERCEL;
var BUNDLED_DB_PATH = join(process.cwd(), "data", "db.json");
var DB_PATH = isVercel ? join("/tmp", "db.json") : BUNDLED_DB_PATH;
var LOCK_FILE = isVercel ? join("/tmp", "db.json.lock") : join(process.cwd(), "data", "db.json.lock");
if (!isVercel && !fs.existsSync(join(process.cwd(), "data"))) {
  fs.mkdirSync(join(process.cwd(), "data"), { recursive: true });
}
var initializeDB = () => {
  if (isVercel) {
    let hasCopied = false;
    if (fs.existsSync(BUNDLED_DB_PATH)) {
      try {
        const content = fs.readFileSync(BUNDLED_DB_PATH, "utf-8");
        if (content && content.trim().startsWith("{")) {
          fs.writeFileSync(DB_PATH, content, "utf-8");
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
var readDB = () => {
  try {
    const content = fs.readFileSync(DB_PATH, "utf-8");
    if (!content || !content.trim()) {
      throw new Error("DB file is empty");
    }
    const db = JSON.parse(content);
    if (db && Array.isArray(db.merchantSessions)) {
      db.merchantSessions.forEach((s) => {
        if (s.is_suspicious_locked) {
          s.is_suspicious_locked = false;
        }
      });
    }
    return db;
  } catch (err) {
    console.error("Failed to read JSON DB, resetting to defaults or falling back:", err);
    if (isVercel && fs.existsSync(BUNDLED_DB_PATH)) {
      try {
        const content = fs.readFileSync(BUNDLED_DB_PATH, "utf-8");
        fs.writeFileSync(DB_PATH, content, "utf-8");
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
var writeDB = (data) => {
  let lockWaitCounter = 0;
  while (fs.existsSync(LOCK_FILE) && lockWaitCounter < 100) {
    lockWaitCounter++;
  }
  try {
    fs.writeFileSync(LOCK_FILE, "locked");
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to JSON db:", err);
  } finally {
    if (fs.existsSync(LOCK_FILE)) {
      try {
        fs.unlinkSync(LOCK_FILE);
      } catch (unlinkErr) {
      }
    }
  }
};

// server/middleware.ts
var getApproxRegion = (req) => {
  const headerRegion = req.headers["x-approx-region"];
  if (headerRegion) return headerRegion;
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || (req.socket ? req.socket.remoteAddress : "") || "";
  if (client_ip.includes("127.0.0.1") || client_ip.includes("localhost") || client_ip.startsWith("::")) {
    return "NG-Lagos";
  }
  if (client_ip.startsWith("10.0.") || client_ip.startsWith("172.")) {
    return "NG-Abuja";
  }
  if (client_ip.startsWith("8.8.8.")) {
    return "US-California";
  }
  return "NG-Lagos";
};
var anomalyDetectionMiddleware = (req, res, next) => {
  const session_id = req.headers["x-session-id"];
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || (req.socket ? req.socket.remoteAddress : "");
  const device_fingerprint = req.headers["x-device-fingerprint"];
  const approxRegion = getApproxRegion(req);
  if (session_id) {
    const db = readDB();
    const session = db.merchantSessions.find((s) => s.session_id === session_id);
    if (session) {
      session.is_suspicious_locked = false;
      let isMismatched = false;
      if (device_fingerprint && device_fingerprint !== "unknown_fp" && device_fingerprint !== "unknown") {
        if (session.device_fingerprint === "fp_default_owner" || !session.device_fingerprint || session.device_fingerprint === "unknown_fp" || session.device_fingerprint === "unknown") {
          session.device_fingerprint = device_fingerprint;
        } else if (device_fingerprint !== "fp_default_owner" && session.device_fingerprint !== device_fingerprint) {
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
var requireSession = async (req, res, next) => {
  try {
    const session_id = req.headers["x-session-id"];
    if (!session_id) return res.status(401).json({ error: "Session required" });
    const db = readDB();
    let session = (db.merchantSessions || []).find((s) => s.session_id === session_id);
    if (!session) {
      const rawUrl = process.env.VITE_DJANGO_API_URL || process.env.VITE_API_URL;
      const djangoBaseUrl = typeof rawUrl === "string" && rawUrl.trim() !== "" && !rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1") ? rawUrl.trim() : "";
      if (djangoBaseUrl) {
        console.log(`[SESSION SYNCHRONIZATION] Session ${session_id} not found locally. Validating with remote Django API: ${djangoBaseUrl}`);
        try {
          const fetchFn = globalThis.fetch || fetch;
          const djangoRes = await fetchFn(`${djangoBaseUrl.replace(/\/+$/, "")}/api/auth/validate-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-session-id": session_id,
              "x-device-fingerprint": req.headers["x-device-fingerprint"] || "unknown_fp",
              "x-approx-region": getApproxRegion(req)
            },
            body: JSON.stringify({ session_id })
          });
          if (djangoRes.ok) {
            const djangoData = await djangoRes.json();
            if (djangoData && djangoData.status === "success" && djangoData.user) {
              console.log(`[SESSION SYNCHRONIZATION] Session ${session_id} successfully validated on Django. Syncing to local DB.`);
              const dUser = djangoData.user;
              let user = db.users.find((u) => u.id === dUser.id);
              if (!user) {
                user = {
                  id: dUser.id,
                  phone_or_email: dUser.phone_or_email,
                  full_name: dUser.full_name || "Merchant",
                  business_name: dUser.business_name || "My Business",
                  business_type: dUser.business_type || "buy_and_sell",
                  owner_pin: dUser.owner_pin || "1234",
                  phone: dUser.phone || dUser.phone_or_email || "",
                  address: dUser.address || "",
                  shop_slug: dUser.shop_slug || "",
                  subscriptionPlan: dUser.subscriptionPlan || "starter",
                  subscriptionStatus: dUser.subscriptionStatus || "active",
                  business: dUser.business || null
                };
                db.users.push(user);
              } else {
                user.phone_or_email = dUser.phone_or_email || user.phone_or_email;
                user.full_name = dUser.full_name || user.full_name;
                user.business_name = dUser.business_name || user.business_name;
                user.business_type = dUser.business_type || user.business_type;
                user.owner_pin = dUser.owner_pin || user.owner_pin;
                user.subscriptionPlan = dUser.subscriptionPlan || user.subscriptionPlan;
                user.subscriptionStatus = dUser.subscriptionStatus || user.subscriptionStatus;
              }
              const is_staff = !!djangoData.is_staff;
              session = {
                session_id,
                user_id: dUser.id,
                device_fingerprint: req.headers["x-device-fingerprint"] || "unknown_fp",
                last_active_ip: (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || (req.socket ? req.socket.remoteAddress : "") || "127.0.0.1",
                last_active_region: getApproxRegion(req),
                is_suspicious_locked: false,
                // Force unlocked internally
                is_staff,
                staff_id: is_staff && djangoData.staff ? djangoData.staff.id : void 0
              };
              if (!db.merchantSessions) db.merchantSessions = [];
              db.merchantSessions.push(session);
              if (is_staff && djangoData.staff) {
                if (!db.staff) db.staff = [];
                const localStaffExists = db.staff.some((s) => s.id === djangoData.staff.id);
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
    session.is_suspicious_locked = false;
    const device_fingerprint = req.headers["x-device-fingerprint"];
    const approxRegion = getApproxRegion(req);
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== "unknown_fp" && device_fingerprint !== "unknown") {
      if (session.device_fingerprint === "fp_default_owner" || !session.device_fingerprint || session.device_fingerprint === "unknown_fp" || session.device_fingerprint === "unknown") {
        session.device_fingerprint = device_fingerprint;
      } else if (device_fingerprint !== "fp_default_owner" && session.device_fingerprint !== device_fingerprint) {
        isMismatched = true;
      }
    }
    if (isMismatched) {
      console.warn(`[ANOMALY LOG] Device fingerprint mismatch active: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
    }
    writeDB(db);
    req.user_id = session.user_id;
    req.session = session;
    next();
  } catch (err) {
    console.error("Authentication middleware error:", err);
    return res.status(555).json({ error: "Authentication system error: " + (err.message || err) });
  }
};

// server.ts
dotenv.config();
var paystackClient = null;
function getPaystack() {
  if (!paystackClient) {
    const rawKey = process.env.PAYSTACK_SECRET_KEY || "";
    const key = rawKey.replace(/^["']|["']$/g, "").trim();
    const PaystackLib = typeof Paystack === "function" ? Paystack : Paystack.default;
    if (typeof PaystackLib !== "function") {
      console.error("Paystack library default export is not a function");
      return {
        transaction: {
          initialize: async () => {
            throw new Error("Paystack could not be initialized");
          },
          verify: async () => {
            throw new Error("Paystack could not be initialized");
          }
        }
      };
    }
    paystackClient = PaystackLib(key);
  }
  return paystackClient;
}
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
var ai = null;
if (process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.use("/api/admin/*", anomalyDetectionMiddleware);
app.post("/api/guest/invoice-generate", (req, res) => {
  const body_hash = req.body.device_fingerprint_hash;
  const header_hash = req.headers["x-device-fingerprint"];
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  const user_agent = req.headers["user-agent"] || "unknown";
  const isInvalidHash = (h) => !h || h === "unknown" || h === "unknown_fp";
  const device_fingerprint_hash = !isInvalidHash(body_hash) ? body_hash : !isInvalidHash(header_hash) ? header_hash : Buffer.from(`${client_ip}:${user_agent}`).toString("base64");
  const db = readDB();
  let tracker = db.anonymousTrialTrackers.find((t) => t.device_fingerprint_hash === device_fingerprint_hash);
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
function normalizeContact(phone_or_email) {
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
function generateOTP() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
app.post("/api/auth/initiate", (req, res) => {
  const { phone_or_email: raw_input } = req.body;
  if (!raw_input || typeof raw_input !== "string" || !raw_input.trim()) {
    return res.status(400).json({ error: "Please enter your email or phone number." });
  }
  const input = raw_input.trim();
  const isEmail = input.includes("@") && input.includes(".");
  const db = readDB();
  if (isEmail) {
    const email = normalizeContact(input);
    const { force_magic_link } = req.body;
    const user = db.users.find((u) => normalizeContact(u.phone_or_email) === email || u.email && normalizeContact(u.email) === email);
    if (user && user.owner_pin && !force_magic_link) {
      return res.json({
        status: "success",
        method: "pin",
        newUser: false,
        hasPin: true
      });
    }
    const token = Math.floor(1e5 + Math.random() * 9e5).toString();
    const isReset = !!force_magic_link;
    db.emailVerifications = db.emailVerifications || [];
    db.emailVerifications = db.emailVerifications.filter((v) => normalizeContact(v.email) !== email);
    db.emailVerifications.push({
      email,
      token,
      isReset,
      expiresAt: Date.now() + 6e5
      // 10 minutes
    });
    writeDB(db);
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
    const callbackUrl = `${protocol}://${host}/api/auth/callback?token=${token}`;
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const subjectField = isReset ? "Reset your Yeedem Books security PIN" : "Verify your Yeedem Books Account";
      const titleField = isReset ? "Reset Your Security PIN" : "Verify Your Email Address";
      const bodyField = isReset ? "We received a request to reset your Yeedem Books account security PIN. Click the button below to complete your PIN reset safely." : "You requested a verification link for your Yeedem Books account. Click the button below to instantly verify your email and complete your setup.";
      const buttonLabelField = isReset ? "Reset Security PIN" : "Confirm Email Address";
      import("resend").then(({ Resend }) => {
        const resend = new Resend(apiKey);
        resend.emails.send({
          from: "Yeedem Books <no-reply@yeedem.com>",
          to: email,
          subject: subjectField,
          html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background-color: #0E1338; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #00A6FF; font-size: 24px; margin: 0; font-weight: 800;">Yeedem Books</h1>
                            </div>
                            <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 20px; color: #ffffff;">${titleField}</h2>
                            <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; text-align: center; margin-bottom: 30px;">
                                ${bodyField}
                            </p>
                            <div style="text-align: center; margin-bottom: 35px;">
                                <a href="${callbackUrl}" style="display: inline-block; background-color: #00A6FF; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: bold; text-decoration: none; box-shadow: 0 4px 12px rgba(0, 166, 255, 0.25);">
                                    ${buttonLabelField}
                                </a>
                            </div>
                            <p style="font-size: 11px; line-height: 1.5; color: #94a3b8; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin: 0;">
                                If the button doesn't work, copy and paste this URL into your browser:<br>
                                <a href="${callbackUrl}" style="color: #00A6FF; text-decoration: none; word-break: break-all;">${callbackUrl}</a>
                            </p>
                        </div>
                    `
        }).then(() => {
          console.log(`[RESEND] Email verification link successfully dispatched to ${email}`);
        }).catch((err) => {
          console.error("[RESEND] API Error dispatching email:", err);
        });
      }).catch((err) => {
        console.error("[ERROR] Failed to load Resend SDK dynamically:", err);
      });
    } else {
      console.warn("[WARNING] RESEND_API_KEY environment variable is not defined.");
    }
    return res.json({
      status: "success",
      method: "email",
      message: "We have sent an email verification link to your email. Click to verify.",
      debugUrl: !apiKey ? callbackUrl : void 0
    });
  } else {
    const phone = normalizeContact(input);
    let user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone);
    if (!user) {
      user = { id: Date.now().toString(), phone_or_email: phone, otp_secret: "1234" };
      db.users.push(user);
    }
    if (!db.whatsappVerifications) db.whatsappVerifications = [];
    const verificationCode = generateOTP();
    const expiresAt = Date.now() + 18e4;
    db.whatsappVerifications = db.whatsappVerifications.filter((v) => v.phone !== phone);
    db.whatsappVerifications.push({ phone, code: verificationCode, status: "pending", expiresAt });
    writeDB(db);
    const isNewUser = !user.full_name;
    const hasPin = !!user.owner_pin;
    return res.json({
      status: "success",
      method: "phone",
      newUser: isNewUser,
      hasPin,
      verificationCode
    });
  }
});
app.post("/api/auth/skip-verification", (req, res) => {
  const { phone_or_email: raw_input } = req.body;
  if (!raw_input || typeof raw_input !== "string" || !raw_input.trim()) {
    return res.status(400).json({ error: "Please enter your email or phone number first." });
  }
  const email_or_phone = normalizeContact(raw_input.trim());
  const db = readDB();
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === email_or_phone || u.email && normalizeContact(u.email) === email_or_phone);
  if (!user) {
    user = {
      id: Date.now().toString(),
      phone_or_email: email_or_phone,
      isVerified: false,
      verification_skipped: true
    };
    db.users.push(user);
  } else {
    user.verification_skipped = true;
  }
  const session_id = "se_skip_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
  db.merchantSessions = db.merchantSessions || [];
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
  const approxRegion = getApproxRegion(req);
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  db.merchantSessions.push({
    session_id,
    user_id: user.id,
    device_fingerprint: "unknown_fp",
    last_active_ip: client_ip,
    last_active_region: approxRegion,
    is_suspicious_locked: false
  });
  writeDB(db);
  res.json({
    status: "success",
    session_id,
    needs_pin: !user.owner_pin,
    user: {
      id: user.id,
      phone_or_email: user.phone_or_email,
      full_name: user.full_name,
      business_name: user.business_name,
      business_type: user.business_type || "buy_and_sell",
      owner_pin: user.owner_pin,
      verification_skipped: user.verification_skipped,
      skippedOnboarding: user.skippedOnboarding,
      isVerified: !!user.isVerified
    }
  });
});
app.get("/api/auth/callback", (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Verification token is missing.");
  }
  const db = readDB();
  if (!db.emailVerifications) db.emailVerifications = [];
  const index = db.emailVerifications.findIndex((v) => v.token === String(token) && v.expiresAt > Date.now());
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
  db.emailVerifications.splice(index, 1);
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === email);
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
  const session_id = "se_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
  db.merchantSessions = db.merchantSessions || [];
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
  const approxRegion = getApproxRegion(req);
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  db.merchantSessions.push({
    session_id,
    user_id: user.id,
    device_fingerprint: "unknown_fp",
    last_active_ip: client_ip,
    last_active_region: approxRegion,
    is_suspicious_locked: false
  });
  writeDB(db);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
  const isReset = !!verification.isReset;
  const redirectUrl = `${protocol}://${host}/?session_id=${session_id}&phone_or_email=${encodeURIComponent(email)}${isReset ? "&is_reset=true" : ""}`;
  res.redirect(redirectUrl);
});
app.get("/api/auth/google", (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
  const targetEmail = "sulemanbades@gmail.com";
  const targetEmailLower = targetEmail.toLowerCase().trim();
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    let oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email")}&state=google_auth_state_yeedem&prompt=select_account`;
    return res.redirect(oauthUrl);
  }
  const accounts = [{
    name: "Suleman bades",
    email: targetEmailLower
  }];
  const accountsHtml = accounts.map((acc, index) => {
    const initial = (acc.name || acc.email || "U")[0].toUpperCase();
    const bgColor = "#1a73e8";
    return `
        <a href="/api/auth/google/mock-verify?email=${encodeURIComponent(acc.email)}" class="account-item">
          <div class="avatar" style="background-color: ${bgColor}; color: #ffffff;">${initial}</div>
          <div class="account-details">
            <p class="account-name">${acc.name}</p>
            <p class="account-email">${acc.email}</p>
          </div>
        </a>
        `;
  }).join("\n");
  res.setHeader("Content-Type", "text/html");
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
  let email = req.query.email;
  if (!email) {
    return res.status(400).send("Email address is required for simulation.");
  }
  email = normalizeContact(email);
  const db = readDB();
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === email || u.email && normalizeContact(u.email) === email);
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
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
  const approxRegion = getApproxRegion(req);
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  db.merchantSessions.push({
    session_id,
    user_id: user.id,
    device_fingerprint: "unknown_fp",
    last_active_ip: client_ip,
    last_active_region: approxRegion,
    is_suspicious_locked: false
  });
  writeDB(db);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
  const redirectUrl = `${protocol}://${host}/?session_id=${session_id}&phone_or_email=${encodeURIComponent(email)}`;
  res.redirect(redirectUrl);
});
app.get("/api/auth/google/callback", async (req, res) => {
  let email = "";
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && req.query.code) {
    try {
      const code = req.query.code;
      const protocol2 = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host2 = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
      const redirectUri = `${protocol2}://${host2}/api/auth/google/callback`;
      const fetchFn = globalThis.fetch || fetch;
      const tokenRes = await fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(code),
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        const userRes = await fetchFn("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();
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
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === email || u.email && normalizeContact(u.email) === email);
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
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
  const approxRegion = getApproxRegion(req);
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  db.merchantSessions.push({
    session_id,
    user_id: user.id,
    device_fingerprint: "unknown_fp",
    last_active_ip: client_ip,
    last_active_region: approxRegion,
    is_suspicious_locked: false
  });
  writeDB(db);
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "yeedem.com";
  const redirectUrl = `${protocol}://${host}/?session_id=${session_id}&phone_or_email=${encodeURIComponent(email)}`;
  res.redirect(redirectUrl);
});
app.post("/api/auth/probe", (req, res) => {
  const raw_phone_or_email = req.body.phone_or_email;
  const phone_or_email = normalizeContact(raw_phone_or_email);
  const db = readDB();
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone_or_email);
  if (!user) {
    user = { id: Date.now().toString(), phone_or_email, otp_secret: "1234" };
    db.users.push(user);
  }
  if (!db.whatsappVerifications) db.whatsappVerifications = [];
  const verificationCode = generateOTP();
  const expiresAt = Date.now() + 18e4;
  db.whatsappVerifications = db.whatsappVerifications.filter((v) => v.phone !== phone_or_email);
  db.whatsappVerifications.push({ phone: phone_or_email, code: verificationCode, status: "pending", expiresAt });
  writeDB(db);
  const isNewUser = !user.full_name;
  const hasPin = !!user.owner_pin;
  res.json({
    newUser: isNewUser,
    hasPin,
    verificationCode
    // Frontend uses this to construct the link
  });
});
app.post("/api/auth/check-verification-status", (req, res) => {
  const { phone_or_email } = req.body;
  const db = readDB();
  const verification = (db.whatsappVerifications || []).find(
    (v) => normalizeContact(v.phone) === normalizeContact(phone_or_email)
  );
  if (verification && verification.status === "verified") {
    const user = db.users.find((u) => normalizeContact(u.phone_or_email) === normalizeContact(phone_or_email));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const session_id = "se_wa_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    db.merchantSessions = db.merchantSessions || [];
    db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
    const approxRegion = getApproxRegion(req);
    const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
    db.merchantSessions.push({
      session_id,
      user_id: user.id,
      device_fingerprint: "unknown_fp",
      last_active_ip: client_ip,
      last_active_region: approxRegion,
      is_suspicious_locked: false
    });
    writeDB(db);
    return res.json({ status: "verified", session_id, user });
  }
  res.json({ status: verification ? verification.status : "not_found" });
});
app.post("/api/auth/verify-whatsapp-sandbox", (req, res) => {
  const { phone_or_email } = req.body;
  if (!phone_or_email || typeof phone_or_email !== "string" || !phone_or_email.trim()) {
    return res.status(400).json({ error: "Phone number is required." });
  }
  const phone = normalizeContact(phone_or_email);
  const db = readDB();
  let user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone);
  if (!user) {
    user = { id: Date.now().toString(), phone_or_email: phone, otp_secret: "1234" };
    db.users.push(user);
  }
  db.whatsappVerifications = db.whatsappVerifications || [];
  db.whatsappVerifications = db.whatsappVerifications.filter((v) => v.phone !== phone);
  db.whatsappVerifications.push({
    phone,
    code: "123456",
    status: "verified",
    expiresAt: Date.now() + 18e4
  });
  writeDB(db);
  res.json({ status: "success", message: "WhatsApp number verified via sandbox." });
});
app.get("/api/auth/whatsapp-webhook", (req, res) => {
  const findParam = (name) => {
    const dottedKey = `hub.${name}`;
    if (typeof req.query[dottedKey] === "string") return req.query[dottedKey];
    if (typeof req.query[name] === "string") return req.query[name];
    if (req.query.hub && typeof req.query.hub === "object") {
      const nested = req.query.hub[name];
      if (typeof nested === "string") return nested;
      if (typeof nested === "number") return String(nested);
    }
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      const lowerKey = key.toLowerCase();
      if (lowerKey === dottedKey.toLowerCase() || lowerKey === name.toLowerCase() || lowerKey.endsWith(`.${name.toLowerCase()}`)) {
        if (typeof val === "string") return val;
        if (typeof val === "number") return String(val);
      }
    }
    return void 0;
  };
  const mode = findParam("mode");
  const token = findParam("verify_token");
  const challenge = findParam("challenge");
  console.log(`[WHATSAPP WEBHOOK GET] Received verification request. Params parsed -> mode: "${mode}", token: "${token}", challenge: "${challenge}"`);
  console.log("[WHATSAPP WEBHOOK GET] Full query details:", JSON.stringify(req.query));
  const envVerifyTokenRaw = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const envVerifyToken = envVerifyTokenRaw.replace(/^["']|["']$/g, "").trim();
  const fallbackVerifyToken = "yeedem_verification_token";
  if (mode && token) {
    const cleanReceivedToken = token.trim().replace(/^["']|["']$/g, "");
    const cleanFallbackToken = fallbackVerifyToken.trim().replace(/^["']|["']$/g, "");
    const cleanEnvToken = envVerifyToken.trim().replace(/^["']|["']$/g, "");
    const isMatch = cleanReceivedToken === cleanFallbackToken || cleanEnvToken && cleanReceivedToken === cleanEnvToken;
    if (mode === "subscribe" && isMatch) {
      console.log("[WHATSAPP WEBHOOK GET] Meta Webhook verified successfully!");
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge ? String(challenge) : "");
    } else {
      console.warn(`[WHATSAPP WEBHOOK GET] Meta Webhook verification failed. Token mismatch. Expected fallback: "${cleanFallbackToken}" or env: "${cleanEnvToken}". Got received token: "${cleanReceivedToken}"`);
      return res.sendStatus(403);
    }
  }
  console.log("[WHATSAPP WEBHOOK GET] Raw direct browser hit or missing query params. Returning friendly HTML setup guide.");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  const callbackUrl = `${protocol}://${host}/api/auth/whatsapp-webhook`;
  res.setHeader("Content-Type", "text/html");
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
app.post("/api/auth/whatsapp-webhook", (req, res) => {
  let from_number = req.body.from_number;
  let message = req.body.message;
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
  const regex = /^Verify my Yeedem account code:\s*(\d{6})/i;
  const match = message.match(regex);
  if (!match) return res.status(200).json({ status: "ignored", message: "Not an auth message format" });
  const token = match[1];
  const db = readDB();
  const verification = (db.whatsappVerifications || []).find(
    (v) => normalizeContact(v.phone) === normalizeContact(from_number) && v.code === token && v.status === "pending" && v.expiresAt > Date.now()
  );
  if (verification) {
    verification.status = "verified";
    const user = db.users.find((u) => normalizeContact(u.phone_or_email) === normalizeContact(verification.phone));
    if (user) {
      user.isVerified = true;
      if (db.merchantSessions) {
        db.merchantSessions.forEach((s) => {
          if (s.user_id === user.id) {
            s.is_suspicious_locked = false;
          }
        });
      }
    }
    if (db.businessProfiles) {
      db.businessProfiles.forEach((bp) => {
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
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
  const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  const db = readDB();
  const user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone_or_email);
  if (user && otp === "1234") {
    const session_id = Date.now().toString();
    db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
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
      user: { id: user.id, phone_or_email: user.phone_or_email, full_name: user.full_name, business_name: user.business_name, business_type: user.business_type || "buy_and_sell" }
    });
  } else {
    res.status(401).json({ error: "Invalid 4-digit OTP" });
  }
});
app.post("/api/auth/register-onboarding", requireSession, (req, res) => {
  const { pin, full_name, business_name, business_type, phone, address, template, email, skippedOnboarding } = req.body;
  const user_id = req.user_id;
  if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
    return res.status(400).json({ error: "A 4-digit security PIN is required to complete onboarding." });
  }
  const db = readDB();
  const user = db.users.find((u) => u.id === user_id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (skippedOnboarding) {
    user.owner_pin = pin;
    user.skippedOnboarding = true;
    user.onboarded = false;
    user.full_name = full_name && full_name.trim() || user.full_name || "Registered Merchant";
    user.business_name = business_name && business_name.trim() || user.business_name || "My Business Ledger";
    user.business_type = business_type || user.business_type || "buy_and_sell";
    user.phone = phone || user.phone || "";
    user.address = address || user.address || "";
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
    user.business_type = business_type || "buy_and_sell";
    user.phone = phone || user.phone;
    user.address = address || user.address;
    if (email && email.trim()) {
      user.email = email.trim().toLowerCase();
    }
    user.skippedOnboarding = false;
    user.onboarded = true;
  }
  user.shop_slug = user.business_name.toLowerCase().replace(/\s+/g, "-");
  user.business = {
    businessName: user.business_name,
    businessType: user.business_type,
    phone: user.phone || "",
    address: user.address || "",
    invoiceTemplatePreference: template || "classic",
    customAccentColor: "#00A6FF",
    customFontSize: "md",
    customFontFamily: "sans",
    customShowLogo: true,
    customHeaderTitle: "TAX INVOICE",
    customFooterNotes: "This document acts as an official trade journal entry. Please verify balances online.",
    customShadowStyle: "md"
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
      phone: user.phone || "",
      address: user.address || "",
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
  const user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone_or_email);
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
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
  const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  const db = readDB();
  const user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone_or_email);
  console.log(`[DEBUG] PIN Login attempt for phone: ${phone_or_email}, User found: ${!!user}`);
  if (!user) {
    return res.status(404).json({ error: "Merchant profile not found on this device." });
  }
  if (user.owner_pin !== pin) {
    return res.status(401).json({ error: "Incorrect 4-digit security PIN." });
  }
  const session_id = Date.now().toString();
  let is_suspicious_locked = false;
  const prevSessions = db.merchantSessions.filter((s) => s.user_id === user.id);
  if (prevSessions.length > 0) {
    const usualDevice = prevSessions[0].device_fingerprint;
    const usualRegion = prevSessions[0].last_active_region;
    if (usualDevice && usualDevice !== deviceFingerprint) {
      console.log(`[PASSIVE ANOMALY] Unrecognized hardware footprint: cur=${deviceFingerprint}, expected=${usualDevice}. Lockout bypassed.`);
    } else if (usualRegion && usualRegion !== "Unknown" && approxRegion !== "Unknown" && usualRegion !== approxRegion) {
      console.log(`[PASSIVE ANOMALY] Geographic shift detected: cur=${approxRegion}, expected=${usualRegion}. Lockout bypassed.`);
    }
  }
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
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
      business_type: user.business_type || "buy_and_sell",
      owner_pin: user.owner_pin,
      phone: user.phone || user.phone_or_email,
      address: user.address || "",
      shop_slug: user.shop_slug || "",
      business: user.business || null
    }
  });
});
app.post("/api/auth/reset-pin-authenticated", requireSession, (req, res) => {
  const { pin } = req.body;
  const user_id = req.user_id;
  if (!pin || pin.length !== 4 || isNaN(Number(pin))) {
    return res.status(400).json({ error: "A 4-digit security PIN is required." });
  }
  const db = readDB();
  const user = db.users.find((u) => u.id === user_id);
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
      business_type: user.business_type || "buy_and_sell",
      owner_pin: user.owner_pin,
      phone: user.phone || user.phone_or_email,
      address: user.address || "",
      shop_slug: user.shop_slug || "",
      business: user.business || null
    }
  });
});
app.post("/api/auth/reset-forgotten-pin", (req, res) => {
  const { phone_or_email: raw_phone_or_email, otp, pin } = req.body;
  const phone_or_email = normalizeContact(raw_phone_or_email);
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
  const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  if (!phone_or_email || !pin) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (otp !== "1234") {
    return res.status(401).json({ error: "Invalid 4-digit OTP" });
  }
  const db = readDB();
  const user = db.users.find((u) => normalizeContact(u.phone_or_email) === phone_or_email);
  if (!user) {
    return res.status(404).json({ error: "Merchant profile not found on this device." });
  }
  user.owner_pin = pin;
  const session_id = Date.now().toString();
  db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user.id || s.is_staff);
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
      business_type: user.business_type || "buy_and_sell",
      owner_pin: user.owner_pin,
      phone: user.phone || user.phone_or_email,
      address: user.address || "",
      shop_slug: user.shop_slug || "",
      business: user.business || null,
      verification_skipped: !!user.verification_skipped,
      skippedOnboarding: !!user.skippedOnboarding
    }
  });
});
app.post("/api/auth/validate-session", requireSession, (req, res) => {
  const session_id = req.headers["x-session-id"];
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
  const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
  const db = readDB();
  const session = db.merchantSessions.find((s) => s.session_id === session_id);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = db.users.find((u) => u.id === session.user_id);
  const is_staff = !!session.is_staff;
  const staffObj = is_staff ? (db.staff || []).find((s) => s.id === session.staff_id) : null;
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
      business_type: user.business_type || "buy_and_sell",
      owner_pin: user.owner_pin,
      phone: user.phone || user.phone_or_email,
      address: user.address || "",
      shop_slug: user.shop_slug || "",
      business: user.business || null,
      subscriptionPlan: user.subscriptionPlan || "SME Basic",
      subscriptionStatus: user.subscriptionStatus || "active",
      verification_skipped: !!user.verification_skipped,
      skippedOnboarding: !!user.skippedOnboarding
    } : null
  });
});
app.post("/api/auth/verify-suspicious-otp", (req, res) => {
  const { session_id, otp } = req.body;
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
  const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
  const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
  const db = readDB();
  const session = db.merchantSessions.find((s) => s.session_id === session_id);
  if (!session) {
    return res.status(401).json({ error: "Invalid security session context." });
  }
  const user = db.users.find((u) => u.id === session.user_id);
  const userPhone = user ? user.phone_or_email : "";
  let isOtpValid = false;
  if (otp === "1234") {
    isOtpValid = true;
  } else if (otp && userPhone) {
    const verification = (db.whatsappVerifications || []).find(
      (v) => normalizeContact(v.phone) === normalizeContact(userPhone) && v.code === otp && v.expiresAt > Date.now()
    );
    if (verification) {
      verification.status = "verified";
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
    let payloadEmail = email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payloadEmail || typeof payloadEmail !== "string" || !emailRegex.test(payloadEmail.trim())) {
      const cleanRaw = typeof payloadEmail === "string" ? payloadEmail.trim().replace(/[^a-zA-Z0-9]/g, "") : "";
      payloadEmail = `${cleanRaw || "customer"}@yeedem.com`;
    } else {
      payloadEmail = payloadEmail.trim();
    }
    const rawKey = process.env.PAYSTACK_SECRET_KEY || "";
    const cleanKey = rawKey.replace(/^["']|["']$/g, "").trim();
    const hasKey = cleanKey && cleanKey !== "MY_PAYSTACK_SECRET_KEY" && cleanKey !== "" && !cleanKey.includes("PLACEholder");
    if (!hasKey) {
      const simRef = `sim_ref_${Math.random().toString(36).substring(2, 10)}`;
      return res.json({
        status: true,
        message: "Simulator Auth URL Created",
        data: {
          authorization_url: "SIMULATOR",
          reference: simRef,
          access_code: `sim_code_${Math.random().toString(36).substring(2, 10)}`
        }
      });
    }
    const reqOrigin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
    const callbackRaw = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" ? process.env.APP_URL : reqOrigin;
    const callbackUrl = `${callbackRaw.replace(/\/$/, "")}/dashboard`;
    const response = await getPaystack().transaction.initialize({
      amount: Math.round(amount * 100),
      // Paystack uses kobo
      email: payloadEmail,
      callback_url: callbackUrl
    });
    if (!response || response.status === false || response instanceof Error) {
      const extError = response && (response.message || response.error) || "Paystack declined setup request";
      console.error("Paystack API Initialization Rejected:", response);
      return res.status(400).json({ error: extError });
    }
    res.json(response);
  } catch (err) {
    console.error("Paystack initialization error:", err);
    const errorMsg = err && (err.message || err.error) ? err.message || err.error : "Failed to initialize payment";
    res.status(500).json({ error: errorMsg });
  }
});
app.post("/api/payment/verify", requireSession, async (req, res) => {
  try {
    const { reference, plan } = req.body;
    if (reference && reference.startsWith("sim_ref_")) {
      const user_id = req.user_id;
      const db = readDB();
      const user = db.users.find((u) => u.id === user_id);
      if (user) {
        user.subscriptionPlan = plan;
        user.subscriptionStatus = "active";
        writeDB(db);
      }
      return res.json({ status: "success", plan, is_simulated: true });
    }
    const rawKey = process.env.PAYSTACK_SECRET_KEY || "";
    const cleanKey = rawKey.replace(/^["']|["']$/g, "").trim();
    const hasKey = cleanKey && cleanKey !== "MY_PAYSTACK_SECRET_KEY" && cleanKey !== "" && !cleanKey.includes("PLACEholder");
    if (!hasKey) {
      return res.status(400).json({ error: "No Paystack key set, and reference is not simulated." });
    }
    const response = await getPaystack().transaction.verify(reference);
    if (!response || response instanceof Error) {
      const extErr = response && response.message || "Failed to connect to gateway";
      return res.status(400).json({ error: extErr });
    }
    const isSuccess = response.data && response.data.status === "success" || response.status === "success";
    if (isSuccess) {
      const user_id = req.user_id;
      const db = readDB();
      const user = db.users.find((u) => u.id === user_id);
      if (user) {
        user.subscriptionPlan = plan;
        user.subscriptionStatus = "active";
        writeDB(db);
      }
      res.json({ status: "success", plan });
    } else {
      console.error("Paystack Verification Failed response:", response);
      const failureReason = response.data && response.data.gateway_response || response.data && response.data.status || "Payment status is not successful";
      res.status(400).json({ error: `Payment verification failed: ${failureReason}` });
    }
  } catch (err) {
    console.error("Paystack verification error:", err);
    const errorMsg = err && (err.message || err.error) ? err.message || err.error : "Failed to verify payment";
    res.status(500).json({ error: errorMsg });
  }
});
app.delete("/api/auth/delete-account", requireSession, (req, res) => {
  try {
    const user_id = req.user_id;
    const db = readDB();
    const user = db.users.find((u) => u.id === user_id);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const email = user.phone_or_email;
    console.log(`[DEBUG] Deleting account for user_id: ${user_id}`);
    db.users = db.users.filter((u) => u.id !== user_id);
    console.log(`[DEBUG] Remaining users: ${db.users.length}`);
    db.merchantSessions = db.merchantSessions.filter((s) => s.user_id !== user_id);
    db.staff = (db.staff || []).filter((s) => s.user_id !== user_id);
    db.staffActivityLogs = (db.staffActivityLogs || []).filter((l) => l.user_id !== user_id);
    writeDB(db);
    if (email) {
      const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
      const backupsDir = process.env.VERCEL ? path.join("/tmp", "backups") : path.join(process.cwd(), "data", "backups");
      if (fs2.existsSync(backupsDir)) {
        const files = fs2.readdirSync(backupsDir);
        let deletedCount = 0;
        files.forEach((f) => {
          if (f.startsWith(`backup_${safeEmail}_`) && f.endsWith(".json")) {
            const filePath = path.join(backupsDir, f);
            if (fs2.existsSync(filePath)) {
              fs2.unlinkSync(filePath);
              deletedCount++;
            }
          }
        });
        console.log(`[PURGE SUCCESS] Purged ${deletedCount} cloud user backup files for ${email}`);
      }
    }
    res.json({ status: "success", message: "Account and associated data deleted successfully." });
  } catch (err) {
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
    let foundInvoice = null;
    let foundBusiness = null;
    let assocUser = null;
    const backupsDir = process.env.VERCEL ? path.join("/tmp", "backups") : path.join(process.cwd(), "data", "backups");
    if (fs2.existsSync(backupsDir)) {
      const files = fs2.readdirSync(backupsDir).filter((f) => f.endsWith(".json")).map((f) => {
        const filePath = path.join(backupsDir, f);
        const stats = fs2.statSync(filePath);
        return { filename: f, mtime: stats.mtime.getTime() };
      }).sort((a, b) => b.mtime - a.mtime);
      for (const fileObj of files) {
        try {
          const content = fs2.readFileSync(path.join(backupsDir, fileObj.filename), "utf-8");
          const backup = JSON.parse(content);
          let customersList = [];
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
                    const fileEmail = backup.email || backup.data && backup.data.email;
                    let user = null;
                    if (fileEmail) {
                      user = db.users.find((u) => (u.phone_or_email || "").toLowerCase().trim() === fileEmail.toLowerCase().trim());
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
                        user = db.users.find((u) => {
                          const cleanUserEmail = (u.phone_or_email || "").replace(/[^a-zA-Z0-9]/g, "_");
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
  } catch (err) {
    console.error("Shared invoice retrieve error:", err);
    res.status(500).json({ error: err.message || "Failed to load shared invoice data" });
  }
});
app.get("/api/admin/unlock-all", (req, res) => {
  const db = readDB();
  db.merchantSessions.forEach((s) => s.is_suspicious_locked = false);
  writeDB(db);
  res.json({ status: "success", message: "All sessions unlocked." });
});
app.post("/api/terminal/:shop_slug/:worker_slug/pin-verify", (req, res) => {
  const { pin } = req.body;
  const { shop_slug, worker_slug } = req.params;
  const db = readDB();
  const staff = (db.staff || []).find((s) => s && s.name_slug === worker_slug && s.is_active);
  if (staff && staff.owner_generated_pin === pin) {
    const session_id = "staff_sess_" + Math.random().toString(36).substring(2, 15);
    const deviceFingerprint = req.headers["x-device-fingerprint"] || "unknown_fp";
    const approxRegion = req.headers["x-approx-region"] || "NG-Lagos";
    const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
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
    db.staffActivityLogs.push({ id: Date.now().toString(), staff_id: staff.id, action_taken: "PIN_LOGIN", timestamp: Date.now(), is_flagged: false });
    writeDB(db);
    const user = db.users.find((u) => u.id === staff.user_id);
    res.json({
      authenticated: true,
      session_id,
      staff,
      user: user ? {
        id: user.id,
        phone_or_email: user.phone_or_email,
        full_name: user.full_name,
        business_name: user.business_name,
        business_type: user.business_type || "buy_and_sell",
        business: user.business || null
      } : null
    });
  } else {
    db.staffActivityLogs.push({ id: Date.now().toString(), action_taken: "FAILED_PIN_LOGIN", timestamp: Date.now(), is_flagged: true });
    writeDB(db);
    res.status(401).json({ error: "Invalid PIN" });
  }
});
app.get("/api/staff", requireSession, (req, res) => {
  try {
    const user_id = req.user_id;
    const session = req.session;
    if (!user_id || session && session.is_staff) return res.status(401).json({ error: "Unauthorized" });
    const db = readDB();
    const users = db.users || [];
    const user = users.find((u) => u && u.id === user_id);
    const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, "-") : "default-shop");
    const matchedStaff = (db.staff || []).filter((s) => s && s.user_id === user_id).map((s) => ({
      ...s,
      shop_slug: s.shop_slug || shop_slug
    }));
    res.json(matchedStaff);
  } catch (err) {
    console.error("API GET /api/staff error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch staff list" });
  }
});
app.post("/api/staff/log", requireSession, (req, res) => {
  try {
    const user_id = req.user_id;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });
    const db = readDB();
    if (!db.staffActivityLogs) db.staffActivityLogs = [];
    const log = {
      id: Date.now().toString(),
      user_id,
      ...req.body,
      timestamp: Date.now(),
      is_flagged: false
    };
    db.staffActivityLogs.push(log);
    writeDB(db);
    res.json({ status: "success" });
  } catch (err) {
    console.error("API POST /api/staff/log error:", err);
    res.status(500).json({ error: err.message || "Failed to add activity log" });
  }
});
app.get("/api/staff/log", requireSession, (req, res) => {
  try {
    const user_id = req.user_id;
    const session = req.session;
    if (!user_id || session && session.is_staff) return res.status(401).json({ error: "Unauthorized" });
    const db = readDB();
    const logs = (db.staffActivityLogs || []).filter((l) => l && l.user_id === user_id);
    res.json(logs);
  } catch (err) {
    console.error("API GET /api/staff/log error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch staff logs" });
  }
});
app.post("/api/staff", requireSession, (req, res) => {
  try {
    const user_id = req.user_id;
    const session = req.session;
    if (!user_id || session && session.is_staff) return res.status(401).json({ error: "Unauthorized" });
    const db = readDB();
    const user = db.users.find((u) => u.id === user_id);
    const plan = (user?.subscriptionPlan || "SME Basic").toLowerCase();
    const staffList = (db.staff || []).filter((s) => s.user_id === user_id);
    let maxStaff = 0;
    if (plan.includes("enterprise")) {
      maxStaff = 999999;
    } else if (plan.includes("pro") || plan.includes("starter pg") || plan.includes("starter")) {
      maxStaff = 3;
    } else {
      maxStaff = 0;
    }
    if (staffList.length >= maxStaff) {
      return res.status(403).json({
        error: `Your subscription plan (${user?.subscriptionPlan || "SME Basic"}) does not support adding staff terminals (Max limit: ${maxStaff}). Please upgrade to the Starter Pro or Enterprise plan in settings.`
      });
    }
    const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, "-") : "default-shop");
    const rawName = req.body.name_slug || "";
    const name_slug = rawName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    const newStaff = {
      id: Date.now().toString(),
      user_id,
      shop_id: req.body.shop_id || "default_shop",
      name_slug: name_slug || rawName,
      owner_generated_pin: req.body.owner_generated_pin,
      is_active: true,
      shop_slug,
      // Toggleable staff permissions
      allow_create_invoices: true,
      allow_view_customers: true,
      allow_view_inventory: true,
      allow_view_costs: false,
      allow_delete_invoices: false,
      allow_manage_products: false
    };
    db.staff = [...db.staff || [], newStaff];
    writeDB(db);
    res.json(newStaff);
  } catch (err) {
    console.error("Error adding staff:", err);
    res.status(500).json({ error: err.message || "Internal server error occurred while creating staff member." });
  }
});
app.put("/api/staff/:id", requireSession, (req, res) => {
  try {
    const db = readDB();
    const user_id = req.user_id;
    const session = req.session;
    if (!user_id || session && session.is_staff) return res.status(401).json({ error: "Unauthorized" });
    if (!db.staff) db.staff = [];
    const index = db.staff.findIndex((s) => s && s.id === req.params.id && s.user_id === user_id);
    if (index !== -1) {
      db.staff[index] = { ...db.staff[index], ...req.body, user_id };
      writeDB(db);
      res.json(db.staff[index]);
    } else {
      res.status(404).json({ error: "Staff member not found" });
    }
  } catch (err) {
    console.error("API PUT /api/staff/:id error:", err);
    res.status(500).json({ error: err.message || "Failed to update staff member" });
  }
});
function runLocalFallbackProductParser(text) {
  const productData = {
    name: "General Commodity",
    sku: "SKU-" + Math.floor(100 + Math.random() * 900),
    stock: 10,
    price: 0
  };
  try {
    const rawText = text.trim();
    const priceMatch = rawText.match(/(?:at|for|price|value.*?of|cost.*?of|₦|N)\s*(\d+(?:\.\d+)?)\s*(k|thousand|million)?/i);
    if (priceMatch) {
      let value = parseFloat(priceMatch[1]);
      const multiplier = priceMatch[2];
      if (multiplier && multiplier.toLowerCase() === "k") {
        value *= 1e3;
      }
      productData.price = value;
    }
    const stockMatch = rawText.match(/(\d+)\s*(?:units|pcs|pieces|bags|items|qty|quantity|stock)/i);
    if (stockMatch) {
      productData.stock = parseInt(stockMatch[1], 10);
    }
    const nameMatch = rawText.match(/(?:add|create|new|item|product)\s+([\w\s&]+?)(?:\s+(?:with|at|for|under|price|sku|\d+))/i);
    if (nameMatch) {
      productData.name = nameMatch[1].trim();
    } else {
      const cleanTokens = rawText.replace(/(?:add|create|new|item|product|with|at|for|under|price|sku|\d+|units|pcs|pieces|bags|items|qty|quantity|stock)/gi, "").trim();
      if (cleanTokens.length > 3) {
        productData.name = cleanTokens;
      }
    }
    const skuMatch = rawText.match(/(?:sku|code|ref)\s*([a-zA-Z0-9\-_]+)/i);
    if (skuMatch) {
      productData.sku = skuMatch[1].toUpperCase();
    } else if (productData.name && productData.name !== "General Commodity") {
      const abbr = productData.name.split(" ").map((w) => w[0]).join("").substring(0, 4).toUpperCase();
      if (abbr.length >= 2) {
        productData.sku = `${abbr}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
  } catch (err) {
    console.error("Local fallback product parse error:", err);
  }
  return productData;
}
function parseAmount(valueStr, multiplierStr) {
  if (!valueStr) return 0;
  const value = parseFloat(valueStr.replace(/,/g, ""));
  if (isNaN(value)) return 0;
  if (multiplierStr) {
    const m = multiplierStr.toLowerCase();
    if (["k", "kilo", "thousand"].includes(m)) return value * 1e3;
    if (["m", "million"].includes(m)) return value * 1e6;
    if (["b", "billion"].includes(m)) return value * 1e9;
  }
  return value;
}
function runLocalFallbackParser(text) {
  const invoiceData = {
    product_name: "General Goods",
    customer_name: "Walk-in Customer",
    items: [],
    total_amount: 0,
    amount_paid: 0,
    debt_balance: 0,
    transaction_type: "sale"
  };
  try {
    const rawText = text.trim();
    const AMOUNT_REGEX = /([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i;
    if (/\b(expense|spent|bought|purchase|cost|paid for|payment for)\b/i.test(rawText)) {
      invoiceData.transaction_type = "expense";
    } else if (/\b(payment on account|deposit on account)\b/i.test(rawText)) {
      invoiceData.transaction_type = "payment_on_account";
    }
    const customerMatch = rawText.match(/(?:to|for|from|buyer|customer|seller)\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|each|deposit|deposited|pay|paid|with|got|received|he|she|on|₦|N|\d+|,|;|\.|\blet\b|$))/i);
    if (customerMatch) {
      const name = customerMatch[1].trim();
      if (name && !/^(bags|units|pieces|kg|items|cash|the)$/i.test(name)) {
        invoiceData.customer_name = name;
      }
    }
    const paidMatch = rawText.match(/(?:deposit(?:ed|s|ing)?|paid|pay(?:ing|s)?|got|received?|payment\s*(?:of)?)\s*(?:cash\s+)?(?:of|cash)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i) || rawText.match(/(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*(?:cash\s+)?(?:deposit|deposited|paid|payment|received|got)/i);
    if (paidMatch) {
      invoiceData.amount_paid = parseAmount(paidMatch[1], paidMatch[2]);
    }
    let qty = 1;
    let prodName = "";
    const qtyItemRegex = /\b(\d+)\s*(?:bags|units|pieces|pcs|kg|cartons|items|shirts|pairs|bottles)?\s*(?:of)?\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i;
    const qtyItemMatch = rawText.match(qtyItemRegex);
    if (qtyItemMatch) {
      qty = parseInt(qtyItemMatch[1], 10);
      prodName = qtyItemMatch[2].trim();
    } else {
      const itemExtract = rawText.match(/(?:sold|bought|sale of|purchase of)\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i);
      if (itemExtract) {
        prodName = itemExtract[1].trim();
      }
    }
    if (!prodName) {
      const startingWordMatch = rawText.match(/^([a-zA-Z]{2,15})(?:\s+(?:₦|N|\d+|for|to|at|each|with|and|he|she|deposited|paid|deposit))/i);
      if (startingWordMatch && !/^(create|record|add|new|sold|bought|sale|expense)$/i.test(startingWordMatch[1])) {
        prodName = startingWordMatch[1].trim();
      }
    }
    if (prodName) {
      prodName = prodName.replace(/\b(bags|units|pieces|cartons|of|kg|items|pcs)\b/gi, "").trim();
      if (prodName.length > 1) {
        invoiceData.product_name = prodName;
      }
    }
    const eachMatch = rawText.match(/(?:for|at|@)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*each/i) || rawText.match(/(?:at|@)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);
    let pricePerUnit = 0;
    let isUnitPriceFound = false;
    if (eachMatch) {
      pricePerUnit = parseAmount(eachMatch[1], eachMatch[2]);
      isUnitPriceFound = true;
    }
    let totalAmount = 0;
    if (isUnitPriceFound) {
      totalAmount = qty * pricePerUnit;
    } else {
      const lumpSumMatch = rawText.match(/(?:for|amounting\s+to|totalling|worth|total\s*(?:of)?)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);
      if (lumpSumMatch) {
        totalAmount = parseAmount(lumpSumMatch[1], lumpSumMatch[2]);
        pricePerUnit = totalAmount / qty;
      } else {
        const numbersMatch = [...rawText.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\b/gi)];
        const candidatePrices = [];
        numbersMatch.forEach((m) => {
          const val = parseAmount(m[1], m[2]);
          if (val !== qty && val !== invoiceData.amount_paid) {
            candidatePrices.push(val);
          }
        });
        if (candidatePrices.length > 0) {
          const candidate = candidatePrices[0];
          if (qty > 1 && candidate < 5e4) {
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
    invoiceData.debt_balance = Math.max(0, totalAmount - invoiceData.amount_paid);
  } catch (err) {
    console.error("Local fallback parse error:", err);
  }
  return invoiceData;
}
app.post("/api/smart-input", async (req, res) => {
  const { text, file } = req.body;
  const session_id = req.headers["x-session-id"];
  let user_id = null;
  if (session_id) {
    const db = readDB();
    const session = (db.merchantSessions || []).find((s) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    session.is_suspicious_locked = false;
    const device_fingerprint = req.headers["x-device-fingerprint"];
    const approxRegion = getApproxRegion(req);
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== "unknown_fp" && device_fingerprint !== "unknown") {
      if (session.device_fingerprint === "fp_default_owner" || !session.device_fingerprint || session.device_fingerprint === "unknown_fp" || session.device_fingerprint === "unknown") {
        session.device_fingerprint = device_fingerprint;
        writeDB(db);
      } else if (device_fingerprint !== "fp_default_owner" && session.device_fingerprint !== device_fingerprint) {
        isMismatched = true;
      }
    }
    if (isMismatched && device_fingerprint && device_fingerprint !== "unknown" && device_fingerprint !== "unknown_fp") {
      console.warn(`[PASSIVE ANOMALY] Smart input device mismatch: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
    }
    user_id = session.user_id;
  } else {
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers["x-device-fingerprint"];
    const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
    const user_agent = req.headers["user-agent"] || "unknown";
    const isInvalidHash = (h) => !h || h === "unknown" || h === "unknown_fp";
    const device_fingerprint_hash = !isInvalidHash(body_hash) ? body_hash : !isInvalidHash(header_hash) ? header_hash : Buffer.from(`${client_ip}:${user_agent}`).toString("base64");
    const db = readDB();
    let tracker = db.anonymousTrialTrackers.find((t) => t.device_fingerprint_hash === device_fingerprint_hash);
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
  if (!text && !file) {
    return res.status(400).json({ status: "error", error: "Please enter text descriptions, record voice, or upload file snapshots." });
  }
  if (ai) {
    try {
      const parts = [];
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
        parts.push({
          inlineData: {
            mimeType: file.mimeType || "image/jpeg",
            data: file.data
          }
        });
      }
      let response;
      let delayMs = 1500;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempt ${attempt}: Calling ai.models.generateContent in /api/smart-input...`);
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
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
        } catch (err) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1e3;
          }
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise((r) => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }
      if (response && response.text) {
        console.log("Gemini API call successful, response text:", response.text);
        const parsed = JSON.parse(response.text.trim());
        if (!parsed.product_name) {
          parsed.product_name = parsed.items && parsed.items[0] ? parsed.items[0].name : "General Goods";
        }
        return res.json({ status: "success", parsed_data: parsed });
      }
    } catch (apiError) {
      console.error("Gemini AI API Call failed, triggering heuristic backup parser. Error:", apiError.message, "Stack:", apiError.stack);
    }
  }
  console.log("Triggered local fallback regex parser");
  const extractedFallback = runLocalFallbackParser(text || "");
  console.log("Local fallback parser result:", extractedFallback);
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic fallback engine."
  });
});
app.post("/api/smart-product", async (req, res) => {
  const { text } = req.body;
  const session_id = req.headers["x-session-id"];
  let user_id = null;
  if (session_id) {
    const db = readDB();
    const session = (db.merchantSessions || []).find((s) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    session.is_suspicious_locked = false;
    const device_fingerprint = req.headers["x-device-fingerprint"];
    const approxRegion = getApproxRegion(req);
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== "unknown_fp" && device_fingerprint !== "unknown") {
      if (session.device_fingerprint === "fp_default_owner" || !session.device_fingerprint || session.device_fingerprint === "unknown_fp" || session.device_fingerprint === "unknown") {
        session.device_fingerprint = device_fingerprint;
        writeDB(db);
      } else if (device_fingerprint !== "fp_default_owner" && session.device_fingerprint !== device_fingerprint) {
        isMismatched = true;
      }
    }
    if (isMismatched && device_fingerprint && device_fingerprint !== "unknown" && device_fingerprint !== "unknown_fp") {
      console.warn(`[PASSIVE ANOMALY] Smart product device mismatch: current=${device_fingerprint}, expected=${session.device_fingerprint}. Lockout bypassed.`);
    }
    user_id = session.user_id;
  } else {
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers["x-device-fingerprint"];
    const client_ip = (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "127.0.0.1";
    const user_agent = req.headers["user-agent"] || "unknown";
    const isInvalidHash = (h) => !h || h === "unknown" || h === "unknown_fp";
    const device_fingerprint_hash = !isInvalidHash(body_hash) ? body_hash : !isInvalidHash(header_hash) ? header_hash : Buffer.from(`${client_ip}:${user_agent}`).toString("base64");
    const db = readDB();
    let tracker = db.anonymousTrialTrackers.find((t) => t.device_fingerprint_hash === device_fingerprint_hash);
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
  if (!text) {
    return res.status(400).json({ status: "error", error: "Please enter product descriptions." });
  }
  if (ai) {
    try {
      const parts = [];
      const prompt = `You are an expert product catalog AI for microlenders and retail SMEs in Nigeria. 
      Analyze the text description of an inventory product and return a structured product Catalog record.
      
      You MUST return values mapping to the expected JSON schema.
      IMPORTANT parameters:
      1. 'name' must be the clean, customer-facing product or item name. (e.g., 'Aso Ebi Teal Fabric' or 'Groundnut Oil 5L')
      2. 'sku' must be an uppercase short alphanumeric SKU code representation (e.g., 'ASE-TL', 'GNO-5L'). If not designated, generate an appropriate abbreviation SKU from the product name.
      3. 'stock' is the initial stock quantity count. Default is 10.
      4. 'price' is the unit cost or price in Nigerian Naira (\u20A6). Default is 0.
      `;
      parts.push({ text: prompt });
      parts.push({ text: `Product Input text: ${text}` });
      let response;
      let delayMs = 1500;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
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
        } catch (err) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1e3;
          }
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise((r) => setTimeout(r, waitTime));
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
  console.log("Triggered local fallback regex product parser");
  const extractedFallback = runLocalFallbackProductParser(text || "");
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic product fallback engine."
  });
});
var BACKUPS_DIR = process.env.VERCEL ? path.join("/tmp", "backups") : path.join(process.cwd(), "data", "backups");
if (!fs2.existsSync(BACKUPS_DIR)) {
  try {
    fs2.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error("Could not create backups directory:", err);
  }
}
function mergeLedgers(incoming, existing) {
  if (!existing || !existing.data) return incoming;
  if (!incoming || !incoming.data) return existing;
  const merged = JSON.parse(JSON.stringify(incoming));
  if (!merged.data) merged.data = {};
  const existingData = existing.data;
  const incomingCustomers = merged.data.customers || [];
  const existingCustomers = existingData.customers || [];
  const customerMap = /* @__PURE__ */ new Map();
  const getCustKey = (c) => {
    return (c.name || "").trim().toLowerCase();
  };
  for (const cust of existingCustomers) {
    const key = getCustKey(cust);
    customerMap.set(key, { ...cust, invoices: [...cust.invoices || []] });
  }
  for (const cust of incomingCustomers) {
    const key = getCustKey(cust);
    const existingCust = customerMap.get(key);
    if (existingCust) {
      const invoiceMap = /* @__PURE__ */ new Map();
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
      const activeDebtBalance = mergedInvoices.reduce((sum, inv) => {
        if (inv.transactionType === "sale") {
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
        createdDate: cust.createdDate && existingCust.createdDate && cust.createdDate < existingCust.createdDate ? cust.createdDate : cust.createdDate || existingCust.createdDate,
        invoices: mergedInvoices
      });
    } else {
      customerMap.set(key, { ...cust });
    }
  }
  merged.data.customers = Array.from(customerMap.values());
  const incomingProducts = merged.data.products || [];
  const existingProducts = existingData.products || [];
  const productMap = /* @__PURE__ */ new Map();
  const getProdKey = (p) => {
    return (p.name || "").trim().toLowerCase();
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
  const incomingLogs = merged.data.restockLogs || [];
  const existingLogs = existingData.restockLogs || [];
  const logMap = /* @__PURE__ */ new Map();
  for (const log of existingLogs) {
    if (log && log.id) logMap.set(log.id, log);
  }
  for (const log of incomingLogs) {
    if (log && log.id) logMap.set(log.id, log);
  }
  merged.data.restockLogs = Array.from(logMap.values());
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
    const session_id = req.headers["x-session-id"];
    if (!session_id) return res.status(401).json({ error: "Session required" });
    const db = readDB();
    const session = (db.merchantSessions || []).find((s) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    const { email, backupData } = req.body;
    const user_id = session.user_id;
    if (!email || !backupData) {
      return res.status(400).json({ error: "Missing email or backupData parameters" });
    }
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    let existingBackupData = null;
    if (fs2.existsSync(BACKUPS_DIR)) {
      const files = fs2.readdirSync(BACKUPS_DIR);
      const userBackupFiles = files.filter((f) => f.startsWith(`backup_${safeEmail}_`) && f.endsWith(".json")).map((f) => {
        const filePath2 = path.join(BACKUPS_DIR, f);
        const stats = fs2.statSync(filePath2);
        return {
          filename: f,
          mtime: stats.mtime.getTime()
        };
      }).sort((a, b) => b.mtime - a.mtime);
      if (userBackupFiles.length > 0) {
        const latestFile = userBackupFiles[0].filename;
        const filePath2 = path.join(BACKUPS_DIR, latestFile);
        try {
          existingBackupData = JSON.parse(fs2.readFileSync(filePath2, "utf-8"));
        } catch (e) {
          console.error("Failed to parse existing backup for auto-merge:", e);
        }
      }
    }
    const mergedBackupData = mergeLedgers(backupData, existingBackupData);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/:/g, "-");
    const fileName = `backup_${safeEmail}_${timestamp}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    fs2.writeFileSync(filePath, JSON.stringify(mergedBackupData, null, 2), "utf-8");
    console.log(`[BACKUP SUCCESS] Bidirectionally merged automated backup file saved: ${fileName} for ${email}`);
    res.json({
      status: "success",
      message: "Ledger backup exported, bidirectionally merged, and written to server disk successfully.",
      filename: fileName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      mergedData: mergedBackupData
    });
  } catch (err) {
    console.error("Backup write error:", err);
    res.status(500).json({ error: err.message || "Failed to write backup JSON file" });
  }
});
app.get("/api/backup/list", requireSession, (req, res) => {
  try {
    const db = readDB();
    const user_id = req.user_id;
    const user = db.users.find((u) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "Merchant profile not found" });
    const email = user.phone_or_email || "anonymous";
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    if (!fs2.existsSync(BACKUPS_DIR)) {
      return res.json([]);
    }
    const files = fs2.readdirSync(BACKUPS_DIR);
    const userBackups = files.filter((f) => f.startsWith(`backup_${safeEmail}_`) && f.endsWith(".json")).map((f) => {
      const filePath = path.join(BACKUPS_DIR, f);
      const stats = fs2.statSync(filePath);
      return {
        filename: f,
        size: stats.size,
        createdAt: stats.mtime.toISOString()
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(userBackups);
  } catch (err) {
    console.error("Error listing backups:", err);
    res.status(500).json({ error: err.message || "Failed to catalog backup list" });
  }
});
app.get("/api/backup/download/:filename", requireSession, (req, res) => {
  try {
    const { filename } = req.params;
    const db = readDB();
    const user_id = req.user_id;
    const user = db.users.find((u) => u.id === user_id);
    if (!user) return res.status(401).json({ error: "Unauthorized access" });
    const email = user.phone_or_email || "anonymous";
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith(".json")) {
      return res.status(400).json({ error: "Forbidden: Unauthorized backup target access file" });
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs2.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file could not be found on server disk" });
    }
    const fileContent = fs2.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.parse(fileContent));
  } catch (err) {
    console.error("Download backup error:", err);
    res.status(500).json({ error: err.message || "Failed to download backup file" });
  }
});
app.delete("/api/backup/:filename", requireSession, (req, res) => {
  try {
    const { filename } = req.params;
    const db = readDB();
    const user_id = req.user_id;
    const user = db.users.find((u) => u.id === user_id);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const email = user.phone_or_email || "anonymous";
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith(".json")) {
      return res.status(400).json({ error: "Forbidden" });
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    if (fs2.existsSync(filePath)) {
      fs2.unlinkSync(filePath);
    }
    res.json({ status: "success", message: "Automated daily backup file pruned successfully." });
  } catch (err) {
    console.error("Delete backup error:", err);
    res.status(500).json({ error: err.message || "Failed to delete backup" });
  }
});
app.post("/api/auth/verify-skipped-account", requireSession, (req, res) => {
  const db = readDB();
  const user_id = req.user_id;
  const user = db.users.find((u) => u.id === user_id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.verification_skipped = false;
  user.isVerified = true;
  writeDB(db);
  res.json({ status: "success", verification_skipped: false, user });
});
app.post("/api/business/settings", requireSession, (req, res) => {
  const db = readDB();
  const user_id = req.user_id;
  const user = db.users.find((u) => u.id === user_id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.business = req.body.business;
  if (req.body.business) {
    user.business_name = req.body.business.businessName || user.business_name;
    user.business_type = req.body.business.businessType || user.business_type;
    user.address = req.body.business.address || user.address;
    user.phone = req.body.business.phone || user.phone;
    user.shop_slug = (user.business_name || "My Business").toString().toLowerCase().replace(/\s+/g, "-");
  }
  writeDB(db);
  res.json({ status: "success" });
});
app.get("/api/images/:shop_slug/logo.png", (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.shop_slug === req.params.shop_slug);
  if (!user || !user.business || !user.business.businessLogo) {
    return res.status(404).send("Logo not found");
  }
  const base64Data = user.business.businessLogo.replace(/^data:image\/\w+;base64,/, "");
  const imgBuffer = Buffer.from(base64Data, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length
  });
  res.end(imgBuffer);
});
async function start() {
  try {
    const logoSrc = path.join(process.cwd(), "src", "assets", "images", "yeedem_books_logo_1779553023368.png");
    const publicDir = path.join(process.cwd(), "public");
    if (fs2.existsSync(logoSrc)) {
      if (!fs2.existsSync(publicDir)) {
        fs2.mkdirSync(publicDir, { recursive: true });
      }
      fs2.copyFileSync(logoSrc, path.join(publicDir, "favicon.png"));
      fs2.copyFileSync(logoSrc, path.join(publicDir, "pwa_icon_logo.png"));
      console.log("\u26A1 Successfully synced public favicons and pwa_icon_logo with user-supplied logo.");
    } else {
      console.warn("\u26A0\uFE0F User og/favicon logo asset not found at:", logoSrc);
    }
  } catch (err) {
    console.error("\u274C Failed to copy custom logo assets to public:", err);
  }
  const getInjectedHtml = async (url, template, db, host) => {
    let ogTitle = "Yeedem Books - Fast Bookkeeping & Invoicing";
    let ogDesc = "Automated ledger tracking and real-time debt bookkeeping parameters for modern Nigerian merchant enterprises.";
    let ogImage = `https://${host}/pwa_icon_logo.png`;
    const terminalMatch = url.match(/^\/terminal\/([^\/]+)\/([^\/]+)/);
    if (terminalMatch) {
      const shopSlug = terminalMatch[1];
      const user = db.users.find((u) => u.shop_slug === shopSlug);
      const shopName = user?.business?.businessName || user?.business_name || "Business";
      ogTitle = `${shopName} - Sales Terminal Managed by Yeedem Books`;
      ogDesc = `Official secure cashier access link for ${shopName}. Enter assigned 4-digit PIN to process secure checkout logs.`;
      if (user?.business?.businessLogo) {
        ogImage = `https://${host}/api/images/${shopSlug}/logo.png`;
      }
    }
    return template.replace(/<meta property="og:title" content="[^"]+" \/>/, `<meta property="og:title" content="${ogTitle}" />`).replace(/<meta property="og:description" content="[^"]+" \/>/, `<meta property="og:description" content="${ogDesc}" />`).replace(/<meta property="og:image" content="[^"]+" \/>/, `<meta property="og:image" content="${ogImage}" />`);
  };
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        if (url.startsWith("/api") || url.startsWith("/@vite") || url.startsWith("/src")) {
          return next();
        }
        const templatePath = path.resolve("index.html");
        let template = fs2.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const db = readDB();
        const host = req.get("host") || `localhost:${PORT}`;
        template = await getInjectedHtml(url, template, db, host);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      if (req.originalUrl.startsWith("/api")) return res.status(404).send("Not found");
      let template = fs2.readFileSync(path.join(distPath, "index.html"), "utf-8");
      const db = readDB();
      const host = req.get("host") || `localhost:${PORT}`;
      template = await getInjectedHtml(req.originalUrl, template, db, host);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Express server running on http://localhost:${PORT}`);
    });
  }
}
start();
var server_default = app;
export {
  server_default as default
};
//# sourceMappingURL=server.js.map
