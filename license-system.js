/**
 * OffGrid AI ToolKit - License Key & Usage Limit System
 * 
 * This module handles:
 * - Database schema initialization (PostgreSQL)
 * - License key activation and validation
 * - JWT token generation and verification
 * - Monthly usage tracking and enforcement
 * - Optional email binding for multi-device access
 * - Admin endpoints for license management
 * 
 * Privacy: No conversation content is ever stored. Only license keys,
 * activation status, usage counters, and optional email addresses.
 */

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '365d'; // Tokens last 1 year (effectively permanent for the user)

// =============================================================================
// DATABASE SCHEMA INITIALIZATION
// =============================================================================

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS licenses (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(19) UNIQUE NOT NULL,
                tier INTEGER NOT NULL DEFAULT 1,
                is_activated BOOLEAN NOT NULL DEFAULT FALSE,
                activated_at TIMESTAMP,
                email VARCHAR(255),
                email_linked_at TIMESTAMP,
                prompt_count INTEGER NOT NULL DEFAULT 0,
                image_count INTEGER NOT NULL DEFAULT 0,
                custom_prompt_limit INTEGER,
                custom_image_limit INTEGER,
                usage_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                notes TEXT
            );
        `);

        // Add custom limit columns if they don't exist (migration for existing databases)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE licenses ADD COLUMN IF NOT EXISTS custom_prompt_limit INTEGER;
                ALTER TABLE licenses ADD COLUMN IF NOT EXISTS custom_image_limit INTEGER;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        `);
        // Add shopify_order column if it doesn't exist (migration for existing databases)
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS shopify_order VARCHAR(50);
        `);
        // Add is_mobile column if it doesn't exist (migration for existing databases)
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        // Extend license_key column to 20 chars to accommodate mobile key format OGTK-MOB-XXXX-XXXX (18 chars)
        await client.query(`
            ALTER TABLE licenses ALTER COLUMN license_key TYPE VARCHAR(20);
        `);
        // Add is_trial column if it doesn't exist (migration for existing databases)
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        // Add trial_expires_at column if it doesn't exist (set on first activation, 30 days)
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP;
        `);
        // Add is_arena column if it doesn't exist (migration for Arena promo)
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_arena BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        // Add arena_email column for Arena registrations
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS arena_email VARCHAR(255);
        `);
        // Add arena_opt_in column for email opt-in
        await client.query(`
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS arena_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS activation_log (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(19) NOT NULL,
                event VARCHAR(50) NOT NULL,
                details TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // Usage history table: one row per key per month, written on each monthly reset
        // Tracks historical usage for financial analysis without storing any conversation content
        await client.query(`
            CREATE TABLE IF NOT EXISTS usage_history (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(19) NOT NULL,
                tier INTEGER NOT NULL,
                period VARCHAR(7) NOT NULL,
                prompt_count INTEGER NOT NULL DEFAULT 0,
                image_count INTEGER NOT NULL DEFAULT 0,
                recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // Create indexes for fast lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_history_key ON usage_history(license_key);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_history_period ON usage_history(period);
        `);

        console.log('[License System] Database tables initialized');
    } catch (error) {
        console.error('[License System] Database initialization error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_LIMITS = {
    // Tier 1: OffGrid AI ToolKit ($129) - Image Studio access, no Command Center access
    1: {
        name: 'OffGrid AI ToolKit',
        price: 129,
        hasCommandCenter: false,
        hasImageStudio: true,
        monthlyPrompts: 0,
        monthlyImages: 10
    },
    // Tier 2: ToolKit + Command Center ($249)
    2: {
        name: 'ToolKit + Command Center',
        price: 249,
        hasCommandCenter: true,
        hasImageStudio: true,
        monthlyPrompts: 150,
        monthlyImages: 10
    },
    // Tier 3: ToolKit + Command Center Pro ($469)
    3: {
        name: 'ToolKit + Command Center Pro',
        price: 469,
        hasCommandCenter: true,
        hasImageStudio: true,
        monthlyPrompts: 400,
        monthlyImages: 30
    },
    // Mobile: Bonus companion key for Tier 2/3 customers (75 prompts / 5 images)
    'mobile': {
        name: 'Mobile Companion',
        price: 0,
        hasCommandCenter: true,
        hasImageStudio: true,
        monthlyPrompts: 75,
        monthlyImages: 5
    },
    // Trial: One-time trial key for Tier 1 customers (8 prompts / 3 images, no renewal, 30-day expiry)
    'trial': {
        name: 'Command Center Trial',
        price: 0,
        hasCommandCenter: true,
        hasImageStudio: true,
        monthlyPrompts: 8,
        monthlyImages: 3
    },
    // Arena: Free 30-day promotional keys (30 prompts, no images, 30-day expiry)
    'arena': {
        name: 'AI Arena',
        price: 0,
        hasCommandCenter: true,
        hasImageStudio: false,
        monthlyPrompts: 30,
        monthlyImages: 0
    }
};

/**
 * Resolve effective limits for a license.
 * Custom per-key overrides take priority over tier defaults.
 * Returns { monthlyPrompts, monthlyImages }.
 */
function getEffectiveLimits(license) {
    const tierKey = license.is_arena ? 'arena' : license.is_trial ? 'trial' : license.is_mobile ? 'mobile' : license.tier;
    const tierLimits = TIER_LIMITS[tierKey] || TIER_LIMITS[2];
    return {
        monthlyPrompts: license.custom_prompt_limit !== null && license.custom_prompt_limit !== undefined
            ? license.custom_prompt_limit
            : tierLimits.monthlyPrompts,
        monthlyImages: license.custom_image_limit !== null && license.custom_image_limit !== undefined
            ? license.custom_image_limit
            : tierLimits.monthlyImages
    };
}

// =============================================================================
// LICENSE KEY GENERATION
// =============================================================================

/**
 * Generate a unique license key.
 * Standard format:  OGTK-XXXX-XXXX-XXXX  (19 chars)
 * Mobile format:    OGTK-MOB-XXXX-XXXX   (18 chars)
 * Trial format:     OGTK-TRL-XXXX-XXXX   (18 chars)
 * Arena format:     OGTK-ARN-XXXX-XXXX   (18 chars)
 * Uses cryptographically secure random bytes.
 */
function generateLicenseKey(isMobile = false, isTrial = false, isArena = false) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
    if (isMobile || isTrial || isArena) {
        const prefix = isArena ? 'OGTK-ARN-' : isTrial ? 'OGTK-TRL-' : 'OGTK-MOB-';
        let key = prefix;
        for (let block = 0; block < 2; block++) {
            const bytes = crypto.randomBytes(4);
            for (let i = 0; i < 4; i++) {
                key += chars[bytes[i] % chars.length];
            }
            if (block < 1) key += '-';
        }
        return key;
    }
    let key = 'OGTK-';
    for (let block = 0; block < 3; block++) {
        const bytes = crypto.randomBytes(4);
        for (let i = 0; i < 4; i++) {
            key += chars[bytes[i] % chars.length];
        }
        if (block < 2) key += '-';
    }
    return key;
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Check if monthly usage needs to be reset (first of each month).
 * Returns true if counters were reset.
 */
async function checkAndResetMonthlyUsage(licenseKey) {
    const result = await pool.query(
        'SELECT usage_reset_at, is_trial, is_arena FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return false;
    
    // Trial and Arena keys never reset -- their limits are lifetime, not monthly
    if (result.rows[0].is_trial || result.rows[0].is_arena) return false;
    
    const lastReset = new Date(result.rows[0].usage_reset_at);
    const now = new Date();
    
    // Reset if we're in a different month than the last reset
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        const period = lastReset.toISOString().slice(0, 7); // e.g. '2026-02'

        // Fetch current counts and tier before resetting so we can archive them
        const licenseData = await pool.query(
            'SELECT tier, prompt_count, image_count FROM licenses WHERE license_key = $1',
            [licenseKey]
        );

        if (licenseData.rows.length > 0) {
            const { tier, prompt_count, image_count } = licenseData.rows[0];
            // Write historical record (upsert: if a record already exists for this period, update it)
            await pool.query(
                `INSERT INTO usage_history (license_key, tier, period, prompt_count, image_count)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING`,
                [licenseKey, tier, period, prompt_count, image_count]
            );
        }

        await pool.query(
            'UPDATE licenses SET prompt_count = 0, image_count = 0, usage_reset_at = NOW() WHERE license_key = $1',
            [licenseKey]
        );

        await logActivationEvent(licenseKey, 'usage.reset', `Monthly usage reset. Previous period: ${period}`);
        return true;
    }
    
    return false;
}

/**
 * Get current usage and limits for a license.
 */
async function getUsageInfo(licenseKey) {
    await checkAndResetMonthlyUsage(licenseKey);
    
    const result = await pool.query(
        'SELECT tier, is_mobile, is_trial, is_arena, trial_expires_at, prompt_count, image_count, custom_prompt_limit, custom_image_limit, usage_reset_at FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return null;
    
    const license = result.rows[0];
    const tierKey = license.is_arena ? 'arena' : license.is_trial ? 'trial' : license.is_mobile ? 'mobile' : license.tier;
    const tierInfo = TIER_LIMITS[tierKey];
    const effective = getEffectiveLimits(license);
    
    return {
        tier: license.tier,
        isMobile: license.is_mobile,
        isTrial: license.is_trial,
        isArena: license.is_arena,
        trialExpiresAt: license.trial_expires_at,
        tierName: tierInfo.name,
        prompts: {
            used: license.prompt_count,
            limit: effective.monthlyPrompts,
            remaining: Math.max(0, effective.monthlyPrompts - license.prompt_count)
        },
        images: {
            used: license.image_count,
            limit: effective.monthlyImages,
            remaining: Math.max(0, effective.monthlyImages - license.image_count)
        },
        hasCustomLimits: license.custom_prompt_limit !== null || license.custom_image_limit !== null,
        resetDate: license.usage_reset_at,
        nextReset: (license.is_trial || license.is_arena) ? null : getNextResetDate()
    };
}

/**
 * Get the first day of next month (when usage resets).
 */
function getNextResetDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().slice(0, 10);
}

/**
 * Check if usage is within limits WITHOUT incrementing.
 * Used by middleware to gate requests before the API call.
 * Returns { allowed: true } or { allowed: false, ... }.
 */
async function checkUsageLimit(licenseKey, type) {
    await checkAndResetMonthlyUsage(licenseKey);
    
    const result = await pool.query(
        'SELECT tier, is_mobile, is_trial, is_arena, trial_expires_at, prompt_count, image_count, custom_prompt_limit, custom_image_limit FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return { allowed: false, reason: 'License not found' };
    
    const license = result.rows[0];

    // Check trial expiry before checking usage limits
    if (license.is_trial && license.trial_expires_at) {
        const now = new Date();
        const expiry = new Date(license.trial_expires_at);
        if (now > expiry) {
            return {
                allowed: false,
                reason: 'trial_expired',
                trialExpiredAt: license.trial_expires_at
            };
        }
    }

    const effective = getEffectiveLimits(license);
    
    if (type === 'prompt') {
        if (license.prompt_count >= effective.monthlyPrompts) {
            return {
                allowed: false,
                reason: license.is_trial ? 'trial_prompt_limit' : 'monthly_prompt_limit',
                used: license.prompt_count,
                limit: effective.monthlyPrompts,
                nextReset: (license.is_trial || license.is_arena) ? null : getNextResetDate(),
                isTrial: license.is_trial || false
            };
        }
        return { allowed: true, used: license.prompt_count, limit: effective.monthlyPrompts };
    }
    
    if (type === 'image') {
        if (license.image_count >= effective.monthlyImages) {
            return {
                allowed: false,
                reason: license.is_trial ? 'trial_image_limit' : 'monthly_image_limit',
                used: license.image_count,
                limit: effective.monthlyImages,
                nextReset: (license.is_trial || license.is_arena) ? null : getNextResetDate(),
                isTrial: license.is_trial || false
            };
        }
        return { allowed: true, used: license.image_count, limit: effective.monthlyImages };
    }
    
    return { allowed: false, reason: 'Invalid usage type' };
}

/**
 * Increment usage counter. Called AFTER a successful API response.
 * Returns { allowed, remaining } or { allowed: false, ... }.
 */
async function incrementUsage(licenseKey, type) {
    await checkAndResetMonthlyUsage(licenseKey);
    
    const result = await pool.query(
        'SELECT tier, is_mobile, is_trial, is_arena, trial_expires_at, prompt_count, image_count, custom_prompt_limit, custom_image_limit FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return { allowed: false, reason: 'License not found' };
    
    const license = result.rows[0];

    // Check trial expiry before incrementing
    if (license.is_trial && license.trial_expires_at) {
        const now = new Date();
        const expiry = new Date(license.trial_expires_at);
        if (now > expiry) {
            return {
                allowed: false,
                reason: 'trial_expired',
                trialExpiredAt: license.trial_expires_at
            };
        }
    }

    const effective = getEffectiveLimits(license);
    
    if (type === 'prompt') {
        if (license.prompt_count >= effective.monthlyPrompts) {
            return {
                allowed: false,
                reason: 'monthly_prompt_limit',
                used: license.prompt_count,
                limit: effective.monthlyPrompts,
                nextReset: getNextResetDate()
            };
        }
        await pool.query(
            'UPDATE licenses SET prompt_count = prompt_count + 1 WHERE license_key = $1',
            [licenseKey]
        );
        return {
            allowed: true,
            used: license.prompt_count + 1,
            limit: effective.monthlyPrompts,
            remaining: effective.monthlyPrompts - license.prompt_count - 1
        };
    }
    
    if (type === 'image') {
        if (license.image_count >= effective.monthlyImages) {
            return {
                allowed: false,
                reason: 'monthly_image_limit',
                used: license.image_count,
                limit: effective.monthlyImages,
                nextReset: getNextResetDate()
            };
        }
        await pool.query(
            'UPDATE licenses SET image_count = image_count + 1 WHERE license_key = $1',
            [licenseKey]
        );
        return {
            allowed: true,
            used: license.image_count + 1,
            limit: effective.monthlyImages,
            remaining: effective.monthlyImages - license.image_count - 1
        };
    }
    
    return { allowed: false, reason: 'Invalid usage type' };
}

// =============================================================================
// JWT TOKEN MANAGEMENT
// =============================================================================

/**
 * Generate a JWT token for an activated license.
 */
function generateToken(licenseKey, tier) {
    return jwt.sign(
        { licenseKey, tier, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Verify and decode a JWT token.
 * Returns the decoded payload or null if invalid.
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// =============================================================================
// ACTIVATION LOG
// =============================================================================

async function logActivationEvent(licenseKey, event, details = '') {
    try {
        await pool.query(
            'INSERT INTO activation_log (license_key, event, details) VALUES ($1, $2, $3)',
            [licenseKey, event, details]
        );
    } catch (error) {
        console.error('[License System] Log error:', error.message);
    }
}

// =============================================================================
// EXPRESS MIDDLEWARE: Authenticate Command Center requests
// =============================================================================

/**
 * Middleware that checks for a valid license token on Command Center API routes.
 * Extracts the token from the Authorization header: "Bearer <token>"
 * 
 * SOFT AUTH MODE: If no token is provided, the request is allowed through
 * without usage tracking. This supports the free demo pages (cmdcouncil, 
 * imagestudio subdomains) while still enforcing limits for paying customers.
 * 
 * On token present + valid: attaches req.license = { licenseKey, tier } and calls next()
 * On token present + invalid: returns 401
 * On no token: allows through (demo mode, no usage tracking)
 */
function requireLicense(req, res, next) {
    const authHeader = req.headers.authorization;
    
    // No token provided: allow through as demo/unauthenticated user
    // The existing rate limiter still protects against abuse
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.license = null; // Explicitly mark as unauthenticated
        return next();
    }
    
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN',
            message: 'Your session has expired. Please re-activate your license key.'
        });
    }
    
    // Check that the license tier has Command Center access
    // Note: trial keys are stored as tier 1 in DB but have Command Center access via is_trial flag.
    // The requireLicense middleware only has the JWT payload (tier integer), not is_trial.
    // Trial keys are issued with tier=1 in the JWT, so we cannot block tier 1 here.
    // Instead, we allow all valid tokens through and let checkUsageLimit handle trial expiry.
    const limits = TIER_LIMITS[decoded.tier];
    if (!limits) {
        return res.status(403).json({
            error: 'Upgrade required',
            code: 'TIER_NO_ACCESS',
            message: 'Your ToolKit tier does not include Command Center access. Upgrade to unlock this feature.',
            upgradeUrl: 'https://offgridaitoolkit.com/products/offgrid-ai-toolkit-command-center'
        });
    }
    
    // Attach license info to the request for downstream handlers
    req.license = {
        licenseKey: decoded.licenseKey || decoded.key,
        tier: decoded.tier
    };
    // Also attach the full decoded token data for arena detection
    req.licenseData = decoded;
    
    next();
}

/**
 * Middleware that checks prompt usage limits before allowing a request.
 * Only CHECKS the limit - does NOT increment. Incrementing happens after success.
 * Must be used AFTER requireLicense middleware.
 */
function checkPromptLimit(req, res, next) {
    // If no license (demo/unauthenticated user), skip usage tracking
    if (!req.license) {
        return next();
    }
    
    checkUsageLimit(req.license.licenseKey, 'prompt')
        .then(result => {
            if (!result.allowed) {
                return res.status(429).json({
                    error: 'Monthly prompt limit reached',
                    code: 'PROMPT_LIMIT',
                    used: result.used,
                    limit: result.limit,
                    nextReset: result.nextReset,
                    message: `You have used all ${result.limit} prompts for this month. Your prompts reset on ${result.nextReset}. Upgrade to Command Center Pro for 400 monthly prompts.`,
                    upgradeUrl: 'https://offgridaitoolkit.com/products/offgrid-ai-toolkit-command-center-pro'
                });
            }
            next();
        })
        .catch(error => {
            console.error('[License System] Usage check error:', error.message);
            // Fail open: allow the request if usage tracking fails
            next();
        });
}

/**
 * Middleware that checks image usage limits before allowing a request.
 * Only CHECKS the limit - does NOT increment. Incrementing happens after success.
 * Must be used AFTER requireLicense middleware.
 */
function checkImageLimit(req, res, next) {
    // If no license (demo/unauthenticated user), skip usage tracking
    if (!req.license) {
        return next();
    }
    
    checkUsageLimit(req.license.licenseKey, 'image')
        .then(result => {
            if (!result.allowed) {
                return res.status(429).json({
                    error: 'Monthly image limit reached',
                    code: 'IMAGE_LIMIT',
                    used: result.used,
                    limit: result.limit,
                    nextReset: result.nextReset,
                    message: `You have used all ${result.limit} image generations for this month. Your limit resets on ${result.nextReset}.`
                });
            }
            next();
        })
        .catch(error => {
            console.error('[License System] Image usage check error:', error.message);
            next();
        });
}

// =============================================================================
// EXPRESS ROUTE HANDLERS
// =============================================================================

function registerLicenseRoutes(app, logToBetterStack) {

    // -------------------------------------------------------------------------
    // POST /api/license/activate
    // Activate a license key and receive a JWT token
    // -------------------------------------------------------------------------
    app.post('/api/license/activate', async (req, res) => {
        try {
            const licenseKey = req.body.key || req.body.licenseKey;
            
            if (!licenseKey || typeof licenseKey !== 'string') {
                return res.status(400).json({
                    error: 'License key is required',
                    code: 'MISSING_KEY'
                });
            }
            
            // Normalize: uppercase, trim
            const normalizedKey = licenseKey.trim().toUpperCase();
            
            // Look up the key
            const result = await pool.query(
                'SELECT * FROM licenses WHERE license_key = $1',
                [normalizedKey]
            );
            
            if (result.rows.length === 0) {
                await logActivationEvent(normalizedKey, 'activate.invalid', 'Key not found in database');
                return res.status(404).json({
                    error: 'Invalid license key',
                    code: 'KEY_NOT_FOUND',
                    message: 'This license key was not found. Please check your key and try again. Your key is printed on the card included with your OffGrid AI ToolKit.'
                });
            }
            
            const license = result.rows[0];
            
            // Check if already activated
            if (license.is_activated) {
                await logActivationEvent(normalizedKey, 'activate.duplicate', 'Key already activated');
                return res.status(409).json({
                    error: 'License key already activated',
                    code: 'ALREADY_ACTIVATED',
                    message: 'This license key has already been activated on another device. If you linked an email, use "Log in with Email" to access from this device. Otherwise, contact support.',
                    hasEmail: !!license.email
                });
            }
            
            // Activate the license
            // For trial keys: set trial_expires_at to 30 days from now on first activation
            if (license.is_trial) {
                await pool.query(
                    'UPDATE licenses SET is_activated = TRUE, activated_at = NOW(), trial_expires_at = NOW() + INTERVAL \'30 days\' WHERE license_key = $1',
                    [normalizedKey]
                );
            } else {
                await pool.query(
                    'UPDATE licenses SET is_activated = TRUE, activated_at = NOW() WHERE license_key = $1',
                    [normalizedKey]
                );
            }
            
            // Generate JWT token
            const token = generateToken(normalizedKey, license.tier);
            const tierKey = license.is_trial ? 'trial' : license.is_mobile ? 'mobile' : license.tier;
            const tierInfo = TIER_LIMITS[tierKey];
            
            await logActivationEvent(normalizedKey, 'activate.success', `${license.is_trial ? 'Trial' : license.is_mobile ? 'Mobile' : 'Tier ' + license.tier} activated`);
            
            if (logToBetterStack) {
                logToBetterStack('info', 'license.activated', {
                    summary: `License activated: ${tierInfo.name}`,
                    tier: license.tier,
                    isMobile: license.is_mobile,
                    tierName: tierInfo.name
                });
            }
            
            // Calculate trial expiry date for response (30 days from now)
            const trialExpiresAt = license.is_trial
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : null;

            res.json({
                success: true,
                token,
                tier: license.tier,
                isMobile: license.is_mobile,
                isTrial: license.is_trial,
                trialExpiresAt,
                tierName: tierInfo.name,
                limits: {
                    monthlyPrompts: tierInfo.monthlyPrompts,
                    monthlyImages: tierInfo.monthlyImages
                },
                message: license.is_trial
                    ? `Welcome! Your Command Center Trial is now active. You have 8 prompts and 3 image generations to explore. Your trial expires in 30 days.`
                    : `Welcome to the Command Center! Your ${tierInfo.name} is now activated.`
            });
            
        } catch (error) {
            console.error('[License System] Activation error:', error);
            res.status(500).json({
                error: 'Activation failed',
                code: 'SERVER_ERROR',
                message: 'Something went wrong. Please try again.'
            });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/license/verify
    // Verify an existing token and return current usage info
    // -------------------------------------------------------------------------
    app.post('/api/license/verify', async (req, res) => {
        try {
            // Accept token from body (frontend sends it this way) or Authorization header
            let token = req.body?.token;
            if (!token) {
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                }
            }
            if (!token) {
                return res.status(401).json({ valid: false, code: 'NO_TOKEN' });
            }
            const decoded = verifyToken(token);
            
            if (!decoded) {
                return res.status(401).json({ valid: false, code: 'INVALID_TOKEN' });
            }
            
            // Check that the license still exists and is activated
            const result = await pool.query(
                'SELECT * FROM licenses WHERE license_key = $1 AND is_activated = TRUE',
                [decoded.licenseKey]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ valid: false, code: 'LICENSE_REVOKED' });
            }
            
            // Get current usage
            const usage = await getUsageInfo(decoded.licenseKey);
            const licenseRow = result.rows[0];
            const verifyTierKey = licenseRow.is_trial ? 'trial' : licenseRow.is_mobile ? 'mobile' : licenseRow.tier;

            // Check trial expiry
            let trialExpired = false;
            if (licenseRow.is_trial && licenseRow.trial_expires_at) {
                trialExpired = new Date() > new Date(licenseRow.trial_expires_at);
            }
            
            res.json({
                valid: true,
                tier: decoded.tier,
                isMobile: licenseRow.is_mobile,
                isTrial: licenseRow.is_trial,
                trialExpiresAt: licenseRow.trial_expires_at,
                trialExpired,
                tierName: TIER_LIMITS[verifyTierKey]?.name,
                usage,
                hasEmail: !!licenseRow.email
            });
            
        } catch (error) {
            console.error('[License System] Verify error:', error);
            res.status(500).json({ valid: false, code: 'SERVER_ERROR' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/license/usage
    // Get current usage stats (requires valid token)
    // -------------------------------------------------------------------------
    app.get('/api/license/usage', requireLicense, async (req, res) => {
        try {
            const usage = await getUsageInfo(req.license.licenseKey);
            res.json(usage);
        } catch (error) {
            console.error('[License System] Usage query error:', error);
            res.status(500).json({ error: 'Failed to retrieve usage info' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/license/link-email
    // Optionally link an email for multi-device access
    // -------------------------------------------------------------------------
    app.post('/api/license/link-email', requireLicense, async (req, res) => {
        try {
            const { email } = req.body;
            
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({ error: 'Valid email address is required' });
            }
            
            const normalizedEmail = email.trim().toLowerCase();
            
            // Check if this email is already linked to another license
            const existing = await pool.query(
                'SELECT license_key FROM licenses WHERE email = $1 AND license_key != $2',
                [normalizedEmail, req.license.licenseKey]
            );
            
            if (existing.rows.length > 0) {
                return res.status(409).json({
                    error: 'Email already in use',
                    message: 'This email is already linked to another license key.'
                });
            }
            
            await pool.query(
                'UPDATE licenses SET email = $1, email_linked_at = NOW() WHERE license_key = $2',
                [normalizedEmail, req.license.licenseKey]
            );
            
            await logActivationEvent(req.license.licenseKey, 'email.linked', 'Email linked for multi-device access');
            
            res.json({
                success: true,
                message: 'Email linked successfully. You can now log in from other devices using your email.'
            });
            
        } catch (error) {
            console.error('[License System] Email link error:', error);
            res.status(500).json({ error: 'Failed to link email' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/license/email-login
    // Request a magic link login via email
    // -------------------------------------------------------------------------
    app.post('/api/license/email-login', async (req, res) => {
        try {
            const { email } = req.body;
            
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({ error: 'Valid email address is required' });
            }
            
            const normalizedEmail = email.trim().toLowerCase();
            
            const result = await pool.query(
                'SELECT license_key, tier FROM licenses WHERE email = $1 AND is_activated = TRUE',
                [normalizedEmail]
            );
            
            if (result.rows.length === 0) {
                // Don't reveal whether the email exists (privacy)
                return res.json({
                    success: true,
                    message: 'If this email is linked to a license, you will receive a login link shortly.'
                });
            }
            
            const license = result.rows[0];
            
            // Generate a short-lived token for email login (15 minutes)
            const magicToken = jwt.sign(
                { licenseKey: license.license_key, tier: license.tier, type: 'magic_link' },
                JWT_SECRET,
                { expiresIn: '15m' }
            );
            
            // TODO: Send email with magic link
            // For now, log the token (in production, integrate with an email service)
            console.log(`[License System] Magic link token generated for ${normalizedEmail}`);
            
            await logActivationEvent(license.license_key, 'email.magic_link', 'Magic link requested');
            
            // In production, this would send an email. For now, return success message.
            res.json({
                success: true,
                message: 'If this email is linked to a license, you will receive a login link shortly.',
                // TEMPORARY: Include token in response for testing. Remove in production.
                _devToken: process.env.NODE_ENV !== 'production' ? magicToken : undefined
            });
            
        } catch (error) {
            console.error('[License System] Email login error:', error);
            res.status(500).json({ error: 'Login request failed' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/license/magic-verify
    // Verify a magic link token and issue a full session token
    // -------------------------------------------------------------------------
    app.post('/api/license/magic-verify', async (req, res) => {
        try {
            const { token } = req.body;
            
            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }
            
            const decoded = verifyToken(token);
            
            if (!decoded || decoded.type !== 'magic_link') {
                return res.status(401).json({
                    error: 'Invalid or expired link',
                    message: 'This login link has expired. Please request a new one.'
                });
            }
            
            // Issue a full session token
            const sessionToken = generateToken(decoded.licenseKey, decoded.tier);
            const tierInfo = TIER_LIMITS[decoded.tier];
            const usage = await getUsageInfo(decoded.licenseKey);
            
            await logActivationEvent(decoded.licenseKey, 'email.login', 'Logged in via magic link');
            
            res.json({
                success: true,
                token: sessionToken,
                tier: decoded.tier,
                tierName: tierInfo.name,
                usage,
                message: `Welcome back! Logged in as ${tierInfo.name}.`
            });
            
        } catch (error) {
            console.error('[License System] Magic verify error:', error);
            res.status(500).json({ error: 'Verification failed' });
        }
    });

    // =========================================================================
    // ADMIN ENDPOINTS (protected by admin secret)
    // =========================================================================

    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';
    const ADMIN_SECRET_BACKUP = process.env.ADMIN_SECRET_BACKUP || null;

    function requireAdmin(req, res, next) {
        const adminKey = req.headers['x-admin-key'];
        const isPrimary = adminKey && adminKey === ADMIN_SECRET;
        const isBackup = adminKey && ADMIN_SECRET_BACKUP && adminKey === ADMIN_SECRET_BACKUP;
        if (!isPrimary && !isBackup) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        next();
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/generate-keys
    // Generate new license keys in bulk
    // -------------------------------------------------------------------------
    app.post('/api/admin/generate-keys', requireAdmin, async (req, res) => {
        try {
            const { count = 1, tier = 2, notes = '' } = req.body;
            
            if (count < 1 || count > 100) {
                return res.status(400).json({ error: 'Count must be between 1 and 100' });
            }
            
            const validTiers = [1, 2, 3, 'mobile', 'trial'];
            if (!validTiers.includes(tier)) {
                return res.status(400).json({ error: 'Tier must be 1, 2, 3, mobile, or trial' });
            }
            
            const isMobile = tier === 'mobile';
            const isTrial = tier === 'trial';
            // Mobile keys stored as tier 2 with is_mobile=true
            // Trial keys stored as tier 1 with is_trial=true
            const dbTier = isMobile ? 2 : isTrial ? 1 : tier;
            const keys = [];
            for (let i = 0; i < count; i++) {
                const key = generateLicenseKey(isMobile, isTrial);
                await pool.query(
                    'INSERT INTO licenses (license_key, tier, is_mobile, is_trial, notes) VALUES ($1, $2, $3, $4, $5)',
                    [key, dbTier, isMobile, isTrial, notes]
                );
                keys.push(key);
            }
            
            if (logToBetterStack) {
                logToBetterStack('info', 'admin.keys_generated', {
                    summary: `Generated ${count} ${tier} license keys`,
                    count,
                    tier
                });
            }
            
            res.json({
                success: true,
                count: keys.length,
                tier,
                tierName: TIER_LIMITS[tier]?.name || 'Command Center Trial',
                keys
            });
            
        } catch (error) {
            console.error('[License System] Key generation error:', error);
            res.status(500).json({ error: 'Key generation failed' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/licenses
    // List all licenses with usage stats
    // -------------------------------------------------------------------------
    app.get('/api/admin/licenses', requireAdmin, async (req, res) => {
        try {
            const { tier, activated, page = 1, limit = 50, sort = 'created_at', dir = 'desc', search = '' } = req.query;

            // Whitelist sortable columns to prevent SQL injection
            const ALLOWED_SORT = ['license_key','tier','is_activated','shopify_order','activated_at','prompt_count','image_count','created_at'];
            const sortCol = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
            const sortDir = dir === 'asc' ? 'ASC' : 'DESC';

            const conditions = [];
            const params = [];

            if (tier) {
                if (tier === 'mobile') {
                    params.push(true);
                    conditions.push(`is_mobile = $${params.length}`);
                } else if (tier === 'trial') {
                    params.push(true);
                    conditions.push(`is_trial = $${params.length}`);
                } else {
                    params.push(parseInt(tier));
                    conditions.push(`tier = $${params.length} AND is_mobile = FALSE AND is_trial = FALSE`);
                }
            }
            if (activated !== undefined && activated !== '') {
                params.push(activated === 'true');
                conditions.push(`is_activated = $${params.length}`);
            }
            if (search && search.trim()) {
                const s = '%' + search.trim() + '%';
                params.push(s);
                conditions.push(`(license_key ILIKE $${params.length} OR COALESCE(shopify_order,'') ILIKE $${params.length} OR COALESCE(notes,'') ILIKE $${params.length} OR COALESCE(email,'') ILIKE $${params.length})`);
            }

            let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

            const countResult = await pool.query(`SELECT COUNT(*) FROM licenses${whereClause}`, params);
            const total = parseInt(countResult.rows[0].count);

            const offset = (parseInt(page) - 1) * parseInt(limit);
            params.push(parseInt(limit));
            params.push(offset);

            const query = `SELECT * FROM licenses${whereClause} ORDER BY ${sortCol} ${sortDir} NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;
            const result = await pool.query(query, params);

            res.json({
                licenses: result.rows.map(row => ({
                    ...row,
                    tierName: TIER_LIMITS[row.tier]?.name
                })),
                total,
                page: parseInt(page),
                limit: parseInt(limit)
            });

        } catch (error) {
            console.error('[License System] List error:', error);
            res.status(500).json({ error: 'Failed to list licenses' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/stats
    // Dashboard stats: total keys, activated, usage summary
    // -------------------------------------------------------------------------
    app.get('/api/admin/stats', requireAdmin, async (req, res) => {
        try {
            const stats = await pool.query(`
                SELECT 
                    COUNT(*) as total_keys,
                    COUNT(*) FILTER (WHERE is_activated = TRUE) as activated_keys,
                    COUNT(*) FILTER (WHERE tier = 1 AND is_mobile = FALSE AND is_trial = FALSE) as tier1_keys,
                    COUNT(*) FILTER (WHERE tier = 2 AND is_mobile = FALSE AND is_trial = FALSE) as tier2_keys,
                    COUNT(*) FILTER (WHERE tier = 3 AND is_mobile = FALSE AND is_trial = FALSE) as tier3_keys,
                    COUNT(*) FILTER (WHERE is_mobile = TRUE) as mobile_keys,
                    COUNT(*) FILTER (WHERE is_mobile = TRUE AND is_activated = TRUE) as mobile_activated,
                    COUNT(*) FILTER (WHERE is_trial = TRUE) as trial_keys,
                    COUNT(*) FILTER (WHERE is_trial = TRUE AND is_activated = TRUE) as trial_activated,
                    COUNT(*) FILTER (WHERE is_trial = TRUE AND trial_expires_at IS NOT NULL AND trial_expires_at < NOW()) as trial_expired,
                    COUNT(*) FILTER (WHERE email IS NOT NULL) as email_linked,
                    SUM(prompt_count) as total_prompts_used,
                    SUM(image_count) as total_images_used
                FROM licenses
            `);
            
            res.json(stats.rows[0]);
            
        } catch (error) {
            console.error('[License System] Stats error:', error);
            res.status(500).json({ error: 'Failed to get stats' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/admin/credit-back
    // Credit back prompts or images for a license (support tool)
    // -------------------------------------------------------------------------
    app.post('/api/admin/credit-back', requireAdmin, async (req, res) => {
        try {
            const { licenseKey, type, count = 1 } = req.body;
            
            if (!licenseKey) {
                return res.status(400).json({ error: 'License key is required' });
            }
            if (!['prompt', 'image'].includes(type)) {
                return res.status(400).json({ error: 'Type must be "prompt" or "image"' });
            }
            if (count < 1 || count > 100) {
                return res.status(400).json({ error: 'Count must be between 1 and 100' });
            }
            
            const column = type === 'prompt' ? 'prompt_count' : 'image_count';
            const result = await pool.query(
                `UPDATE licenses SET ${column} = GREATEST(0, ${column} - $1) WHERE license_key = $2 RETURNING *`,
                [count, licenseKey.trim().toUpperCase()]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            const license = result.rows[0];
            const tierLimits = TIER_LIMITS[license.tier];
            
            await logActivationEvent(licenseKey, 'admin.credit_back', `Credited back ${count} ${type}(s)`);
            
            if (logToBetterStack) {
                logToBetterStack('info', 'admin.credit_back', {
                    summary: `Credited back ${count} ${type}(s) for ${licenseKey}`,
                    licenseKey,
                    type,
                    count
                });
            }
            
            res.json({
                success: true,
                message: `Credited back ${count} ${type}(s). New count: ${license[column]}/${type === 'prompt' ? tierLimits.monthlyPrompts : tierLimits.monthlyImages}`,
                license_key: license.license_key,
                type,
                new_count: license[column],
                limit: type === 'prompt' ? tierLimits.monthlyPrompts : tierLimits.monthlyImages
            });
            
        } catch (error) {
            console.error('[License System] Credit-back error:', error);
            res.status(500).json({ error: 'Credit-back failed' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/admin/update-limits
    // Set custom per-key limits (overrides tier defaults)
    // -------------------------------------------------------------------------
    app.post('/api/admin/update-limits', requireAdmin, async (req, res) => {
        try {
            const { licenseKey, monthlyPrompts, monthlyImages, resetCounters = false, notes } = req.body;
            
            if (!licenseKey) {
                return res.status(400).json({ error: 'License key is required' });
            }
            if (monthlyPrompts === undefined && monthlyImages === undefined) {
                return res.status(400).json({ error: 'At least one of monthlyPrompts or monthlyImages is required' });
            }
            if (monthlyPrompts !== undefined && (monthlyPrompts < 0 || monthlyPrompts > 10000)) {
                return res.status(400).json({ error: 'monthlyPrompts must be between 0 and 10000' });
            }
            if (monthlyImages !== undefined && (monthlyImages < 0 || monthlyImages > 1000)) {
                return res.status(400).json({ error: 'monthlyImages must be between 0 and 1000' });
            }
            
            const normalizedKey = licenseKey.trim().toUpperCase();
            
            // Build the update query dynamically
            const updates = [];
            const params = [];
            let paramIdx = 1;
            
            if (monthlyPrompts !== undefined) {
                updates.push(`custom_prompt_limit = $${paramIdx++}`);
                params.push(monthlyPrompts);
            }
            if (monthlyImages !== undefined) {
                updates.push(`custom_image_limit = $${paramIdx++}`);
                params.push(monthlyImages);
            }
            if (resetCounters) {
                updates.push('prompt_count = 0');
                updates.push('image_count = 0');
                updates.push('usage_reset_at = NOW()');
            }
            if (notes !== undefined) {
                updates.push(`notes = $${paramIdx++}`);
                params.push(notes);
            }
            
            params.push(normalizedKey);
            const query = `UPDATE licenses SET ${updates.join(', ')} WHERE license_key = $${paramIdx} RETURNING *`;
            
            const result = await pool.query(query, params);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            const license = result.rows[0];
            const effective = getEffectiveLimits(license);
            
            await logActivationEvent(normalizedKey, 'admin.update_limits', 
                `Custom limits set: ${effective.monthlyPrompts} prompts, ${effective.monthlyImages} images${resetCounters ? ' (counters reset)' : ''}`);
            
            if (logToBetterStack) {
                logToBetterStack('info', 'admin.update_limits', {
                    summary: `Custom limits set for ${normalizedKey}: ${effective.monthlyPrompts} prompts, ${effective.monthlyImages} images`,
                    licenseKey: normalizedKey,
                    monthlyPrompts: effective.monthlyPrompts,
                    monthlyImages: effective.monthlyImages,
                    resetCounters
                });
            }
            
            res.json({
                success: true,
                message: `Custom limits updated for ${normalizedKey}`,
                license_key: license.license_key,
                tier: license.tier,
                tierName: TIER_LIMITS[license.tier]?.name,
                effectiveLimits: effective,
                currentUsage: {
                    prompts: license.prompt_count,
                    images: license.image_count
                },
                countersReset: resetCounters
            });
            
        } catch (error) {
            console.error('[License System] Update limits error:', error);
            res.status(500).json({ error: 'Failed to update limits' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/admin/revoke
    // Revoke a license key (deactivate it)
    // -------------------------------------------------------------------------
    app.post('/api/admin/revoke', requireAdmin, async (req, res) => {
        try {
            const { licenseKey } = req.body;
            
            if (!licenseKey) {
                return res.status(400).json({ error: 'License key is required' });
            }
            
            const result = await pool.query(
                'UPDATE licenses SET is_activated = FALSE, activated_at = NULL WHERE license_key = $1 RETURNING *',
                [licenseKey.trim().toUpperCase()]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            await logActivationEvent(licenseKey, 'admin.revoked', 'License revoked by admin');
            
            res.json({
                success: true,
                message: 'License revoked. The user will need to re-activate.',
                license: result.rows[0]
            });
            
        } catch (error) {
            console.error('[License System] Revoke error:', error);
            res.status(500).json({ error: 'Revoke failed' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/admin/delete-key
    // Permanently delete a license key and all associated records
    // -------------------------------------------------------------------------
    app.post('/api/admin/delete-key', requireAdmin, async (req, res) => {
        try {
            const { licenseKey } = req.body;
            
            if (!licenseKey) {
                return res.status(400).json({ error: 'License key is required' });
            }
            
            const key = licenseKey.trim().toUpperCase();
            
            // Delete activation log entries first (foreign key)
            await pool.query('DELETE FROM activation_log WHERE license_key = $1', [key]);
            
            // Delete usage history entries
            await pool.query('DELETE FROM usage_history WHERE license_key = $1', [key]);
            
            // Delete the license itself
            const result = await pool.query(
                'DELETE FROM licenses WHERE license_key = $1 RETURNING license_key',
                [key]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            res.json({
                success: true,
                message: `License key ${key} permanently deleted.`,
                deleted_key: key
            });
            
        } catch (error) {
            console.error('[License System] Delete key error:', error);
            res.status(500).json({ error: 'Delete failed' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/key-details?key=OGTK-XXXX-XXXX-XXXX
    // Single-key lookup: returns license record + activation log + usage history
    // -------------------------------------------------------------------------
    app.get('/api/admin/key-details', requireAdmin, async (req, res) => {
        try {
            const { key } = req.query;
            if (!key) {
                return res.status(400).json({ error: 'key query parameter is required' });
            }
            const normalizedKey = key.trim().toUpperCase();

            // License record
            const licenseResult = await pool.query(
                'SELECT * FROM licenses WHERE license_key = $1',
                [normalizedKey]
            );
            if (licenseResult.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            const license = licenseResult.rows[0];

            // Activation log (most recent 50 events)
            const logResult = await pool.query(
                'SELECT event, details, created_at FROM activation_log WHERE license_key = $1 ORDER BY created_at DESC LIMIT 50',
                [normalizedKey]
            );

            // Usage history (all months, oldest first)
            const historyResult = await pool.query(
                'SELECT period, tier, prompt_count, image_count, recorded_at FROM usage_history WHERE license_key = $1 ORDER BY period ASC',
                [normalizedKey]
            );

            const tierKey = license.is_trial ? 'trial' : license.is_mobile ? 'mobile' : license.tier;
            res.json({
                license: { ...license, tierName: TIER_LIMITS[tierKey]?.name },
                activationLog: logResult.rows,
                usageHistory: historyResult.rows
            });

        } catch (error) {
            console.error('[License System] Key details error:', error);
            res.status(500).json({ error: 'Failed to retrieve key details' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/usage-analytics
    // System-wide usage analytics: per-month totals and per-key breakdown
    // -------------------------------------------------------------------------
    app.get('/api/admin/usage-analytics', requireAdmin, async (req, res) => {
        try {
            // Monthly totals across all keys (from usage_history)
            const monthlyTotals = await pool.query(`
                SELECT
                    period,
                    SUM(prompt_count) AS total_prompts,
                    SUM(image_count) AS total_images,
                    COUNT(DISTINCT license_key) AS active_keys
                FROM usage_history
                GROUP BY period
                ORDER BY period ASC
            `);

            // Current month live stats (from licenses table)
            const currentStats = await pool.query(`
                SELECT
                    SUM(prompt_count) AS total_prompts,
                    SUM(image_count) AS total_images,
                    COUNT(*) FILTER (WHERE prompt_count > 0 OR image_count > 0) AS active_keys,
                    COUNT(*) FILTER (WHERE is_activated = TRUE) AS activated_keys,
                    MAX(prompt_count) AS max_prompts_single_key,
                    ROUND(AVG(prompt_count) FILTER (WHERE is_activated = TRUE), 1) AS avg_prompts_activated,
                    COUNT(*) FILTER (WHERE is_activated = TRUE AND prompt_count::float / NULLIF(
                        CASE WHEN custom_prompt_limit IS NOT NULL THEN custom_prompt_limit
                             WHEN is_trial = TRUE THEN 8
                             WHEN is_mobile = TRUE THEN 75
                             ELSE (CASE tier WHEN 2 THEN 150 WHEN 3 THEN 400 ELSE 0 END)
                        END, 0) >= 0.75) AS keys_at_75pct_or_more
                FROM licenses
            `);

            // Top 10 heaviest users this month
            const topUsers = await pool.query(`
                SELECT license_key, tier, is_mobile, is_trial, prompt_count, image_count, notes,
                    custom_prompt_limit,
                    CASE WHEN custom_prompt_limit IS NOT NULL THEN custom_prompt_limit
                         WHEN is_trial = TRUE THEN 8
                         WHEN is_mobile = TRUE THEN 75
                         ELSE (CASE tier WHEN 2 THEN 150 WHEN 3 THEN 400 ELSE 0 END)
                    END AS prompt_limit
                FROM licenses
                WHERE is_activated = TRUE
                ORDER BY prompt_count DESC
                LIMIT 10
            `);

            // Distribution buckets: 0%, 1-25%, 26-50%, 51-75%, 76-100%, over limit
            const distribution = await pool.query(`
                SELECT
                    CASE
                        WHEN prompt_limit = 0 THEN 'no_limit'
                        WHEN prompt_count = 0 THEN 'unused'
                        WHEN prompt_count::float / prompt_limit < 0.25 THEN '1_to_25pct'
                        WHEN prompt_count::float / prompt_limit < 0.50 THEN '26_to_50pct'
                        WHEN prompt_count::float / prompt_limit < 0.75 THEN '51_to_75pct'
                        WHEN prompt_count::float / prompt_limit < 1.00 THEN '76_to_99pct'
                        ELSE 'at_limit'
                    END AS bucket,
                    COUNT(*) AS key_count
                FROM (
                    SELECT prompt_count,
                        CASE WHEN custom_prompt_limit IS NOT NULL THEN custom_prompt_limit
                             WHEN is_trial = TRUE THEN 8
                             WHEN is_mobile = TRUE THEN 75
                             ELSE (CASE tier WHEN 2 THEN 150 WHEN 3 THEN 400 ELSE 0 END)
                        END AS prompt_limit
                    FROM licenses
                    WHERE is_activated = TRUE
                ) sub
                GROUP BY bucket
                ORDER BY bucket
            `);

            res.json({
                monthlyTotals: monthlyTotals.rows,
                currentMonth: currentStats.rows[0],
                topUsers: topUsers.rows.map(r => ({
                    ...r,
                    tierName: r.is_trial ? 'Command Center Trial'
                             : r.is_mobile ? 'Mobile Companion'
                             : (TIER_LIMITS[r.tier]?.name || `Tier ${r.tier}`)
                })),
                distribution: distribution.rows
            });

        } catch (error) {
            console.error('[License System] Usage analytics error:', error);
            res.status(500).json({ error: 'Failed to retrieve usage analytics' });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/admin/update-row
    // Inline update of notes and/or shopify_order for a single license row
    // -------------------------------------------------------------------------
    app.post('/api/admin/update-row', requireAdmin, async (req, res) => {
        try {
            const { licenseKey, notes, shopifyOrder } = req.body;
            if (!licenseKey) {
                return res.status(400).json({ error: 'licenseKey is required' });
            }
            const normalizedKey = licenseKey.trim().toUpperCase();

            const updates = [];
            const params = [];
            let idx = 1;

            if (notes !== undefined) {
                updates.push(`notes = $${idx++}`);
                params.push(notes);
            }
            if (shopifyOrder !== undefined) {
                updates.push(`shopify_order = $${idx++}`);
                params.push(shopifyOrder || null);
            }
            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nothing to update' });
            }

            params.push(normalizedKey);
            const result = await pool.query(
                `UPDATE licenses SET ${updates.join(', ')} WHERE license_key = $${idx} RETURNING license_key, notes, shopify_order`,
                params
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'License key not found' });
            }
            await logActivationEvent(normalizedKey, 'admin.update_row',
                `Row updated: ${updates.map((u, i) => u.split(' = ')[0] + '=' + JSON.stringify(params[i])).join(', ')}`);
            res.json({ success: true, ...result.rows[0] });
        } catch (error) {
            console.error('[License System] Update-row error:', error);
            res.status(500).json({ error: 'Update failed' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/export-csv
    // Export all licenses as a CSV file download
    // -------------------------------------------------------------------------
    app.get('/api/admin/export-csv', requireAdmin, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT license_key, tier, is_activated, shopify_order, email,
                       prompt_count, image_count, custom_prompt_limit, custom_image_limit,
                       activated_at, created_at, usage_reset_at, notes
                FROM licenses
                ORDER BY created_at DESC
            `);

            const headers = [
                'license_key', 'tier', 'status', 'shopify_order', 'email',
                'prompts_used', 'images_used', 'custom_prompt_limit', 'custom_image_limit',
                'activated_at', 'created_at', 'usage_reset_at', 'notes'
            ];

            const escape = v => {
                if (v === null || v === undefined) return '';
                const s = String(v);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            };

            const rows = result.rows.map(r => [
                r.license_key,
                r.tier,
                r.is_activated ? 'Active' : 'Inactive',
                r.shopify_order || '',
                r.email || '',
                r.prompt_count,
                r.image_count,
                r.custom_prompt_limit || '',
                r.custom_image_limit || '',
                r.activated_at ? new Date(r.activated_at).toISOString().slice(0, 10) : '',
                new Date(r.created_at).toISOString().slice(0, 10),
                new Date(r.usage_reset_at).toISOString().slice(0, 10),
                r.notes || ''
            ].map(escape).join(','));

            const csv = [headers.join(','), ...rows].join('\n');
            const date = new Date().toISOString().slice(0, 10);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="offgrid-licenses-${date}.csv"`);
            res.send(csv);
        } catch (error) {
            console.error('[License System] Export CSV error:', error);
            res.status(500).json({ error: 'Export failed' });
        }
    });

      // =========================================================================
    // ARENA REGISTRATION
    // =========================================================================

    // -------------------------------------------------------------------------
    // POST /api/arena/register
    // Email-based registration for the AI Arena promotional event.
    // Creates an arena license key, binds it to the email, and returns a JWT.
    // If the email already has an arena key, returns the existing token.
    // -------------------------------------------------------------------------
    app.post('/api/arena/register', async (req, res) => {
        try {
            const { email, optIn } = req.body;

            if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
                return res.status(400).json({ error: 'A valid email address is required.', code: 'INVALID_EMAIL' });
            }

            const normalizedEmail = email.trim().toLowerCase();

            // Rate limit: max 5 registrations per IP per hour
            // (Simple in-memory rate limiter; resets on server restart)
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
            if (!global._arenaRateLimit) global._arenaRateLimit = {};
            const now = Date.now();
            const ipEntry = global._arenaRateLimit[clientIP] || { count: 0, resetAt: now + 3600000 };
            if (now > ipEntry.resetAt) {
                ipEntry.count = 0;
                ipEntry.resetAt = now + 3600000;
            }
            ipEntry.count++;
            global._arenaRateLimit[clientIP] = ipEntry;
            if (ipEntry.count > 5) {
                return res.status(429).json({ error: 'Too many registrations. Please try again later.', code: 'RATE_LIMIT' });
            }

            // Check if this email already has an arena key
            const existing = await pool.query(
                'SELECT * FROM licenses WHERE arena_email = $1 AND is_arena = TRUE',
                [normalizedEmail]
            );

            if (existing.rows.length > 0) {
                const license = existing.rows[0];
                const effective = getEffectiveLimits(license);

                // Check if expired (30 days from activation)
                if (license.trial_expires_at && new Date(license.trial_expires_at) < new Date()) {
                    return res.status(403).json({
                        error: 'Your Arena access has expired. Thanks for participating!',
                        code: 'ARENA_EXPIRED'
                    });
                }

                // Generate a fresh token for returning user
                const token = jwt.sign(
                    { key: license.license_key, tier: license.tier, isArena: true },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRY }
                );

                await logActivationEvent(license.license_key, 'arena.return', `Returning arena user: ${normalizedEmail}`);

                return res.json({
                    token,
                    tier: 'arena',
                    tierName: 'AI Arena',
                    returning: true,
                    limits: {
                        monthlyPrompts: effective.monthlyPrompts,
                        monthlyImages: effective.monthlyImages,
                        promptsUsed: license.prompt_count
                    }
                });
            }

            // Create a new arena key
            let arenaKey;
            let attempts = 0;
            while (attempts < 10) {
                arenaKey = generateLicenseKey(false, false, true);
                const dup = await pool.query('SELECT 1 FROM licenses WHERE license_key = $1', [arenaKey]);
                if (dup.rows.length === 0) break;
                attempts++;
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            await pool.query(
                `INSERT INTO licenses (license_key, tier, is_activated, activated_at, is_arena, arena_email, arena_opt_in, trial_expires_at, email)
                 VALUES ($1, 2, TRUE, NOW(), TRUE, $2, $3, $4, $2)`,
                [arenaKey, normalizedEmail, optIn || false, expiresAt.toISOString()]
            );

            const token = jwt.sign(
                { key: arenaKey, tier: 2, isArena: true },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRY }
            );

            await logActivationEvent(arenaKey, 'arena.register', `New arena registration: ${normalizedEmail}, opt-in: ${optIn || false}`);

            if (logToBetterStack) {
                logToBetterStack('arena_registration', {
                    key: arenaKey,
                    email: normalizedEmail,
                    optIn: optIn || false
                });
            }

            const effective = getEffectiveLimits({ tier: 2, is_arena: true, custom_prompt_limit: null, custom_image_limit: null });

            res.json({
                token,
                tier: 'arena',
                tierName: 'AI Arena',
                returning: false,
                key: arenaKey,
                limits: {
                    monthlyPrompts: effective.monthlyPrompts,
                    monthlyImages: effective.monthlyImages,
                    promptsUsed: 0
                }
            });

        } catch (error) {
            console.error('[Arena] Registration error:', error);
            res.status(500).json({ error: 'Registration failed. Please try again.' });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/admin/backup
    // Full database backup (JSON download)for manual backup
    // -------------------------------------------------------------------------
    app.get('/api/admin/backup', requireAdmin, async (req, res) => {
        try {
            const [licenses, log, history] = await Promise.all([
                pool.query('SELECT * FROM licenses ORDER BY created_at DESC'),
                pool.query('SELECT * FROM activation_log ORDER BY created_at DESC'),
                pool.query('SELECT * FROM usage_history ORDER BY period DESC, license_key ASC')
            ]);

            const backup = {
                exported_at: new Date().toISOString(),
                version: '1.0',
                tables: {
                    licenses: { count: licenses.rows.length, rows: licenses.rows },
                    activation_log: { count: log.rows.length, rows: log.rows },
                    usage_history: { count: history.rows.length, rows: history.rows }
                }
            };

            const date = new Date().toISOString().slice(0, 10);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="offgrid-db-backup-${date}.json"`);
            res.json(backup);
        } catch (error) {
            console.error('[License System] Backup error:', error);
            res.status(500).json({ error: 'Backup failed' });
        }
    });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    initializeDatabase,
    registerLicenseRoutes,
    requireLicense,
    checkPromptLimit,
    checkImageLimit,
    incrementUsage,
    generateLicenseKey,
    getEffectiveLimits,
    getUsageInfo,
    verifyToken,
    pool,
    TIER_LIMITS
};
