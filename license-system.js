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
                usage_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                notes TEXT
            );
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

        // Create indexes for fast lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
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
    // Tier 1: OffGrid AI ToolKit ($129) - no Command Center access
    1: {
        name: 'OffGrid AI ToolKit',
        price: 129,
        hasCommandCenter: false,
        hasImageStudio: false,
        monthlyPrompts: 0,
        monthlyImages: 0
    },
    // Tier 2: ToolKit + Command Center ($199)
    2: {
        name: 'ToolKit + Command Center',
        price: 199,
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
        monthlyImages: 40
    }
};

// =============================================================================
// LICENSE KEY GENERATION
// =============================================================================

/**
 * Generate a unique license key in format: OGTK-XXXX-XXXX-XXXX
 * Uses cryptographically secure random bytes.
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
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
        'SELECT usage_reset_at FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return false;
    
    const lastReset = new Date(result.rows[0].usage_reset_at);
    const now = new Date();
    
    // Reset if we're in a different month than the last reset
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        await pool.query(
            'UPDATE licenses SET prompt_count = 0, image_count = 0, usage_reset_at = NOW() WHERE license_key = $1',
            [licenseKey]
        );
        
        await logActivationEvent(licenseKey, 'usage.reset', `Monthly usage reset. Previous period: ${lastReset.toISOString().slice(0, 7)}`);
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
        'SELECT tier, prompt_count, image_count, usage_reset_at FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return null;
    
    const { tier, prompt_count, image_count, usage_reset_at } = result.rows[0];
    const limits = TIER_LIMITS[tier];
    
    return {
        tier,
        tierName: limits.name,
        prompts: {
            used: prompt_count,
            limit: limits.monthlyPrompts,
            remaining: Math.max(0, limits.monthlyPrompts - prompt_count)
        },
        images: {
            used: image_count,
            limit: limits.monthlyImages,
            remaining: Math.max(0, limits.monthlyImages - image_count)
        },
        resetDate: usage_reset_at,
        nextReset: getNextResetDate()
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
        'SELECT tier, prompt_count, image_count FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return { allowed: false, reason: 'License not found' };
    
    const { tier, prompt_count, image_count } = result.rows[0];
    const limits = TIER_LIMITS[tier];
    
    if (type === 'prompt') {
        if (prompt_count >= limits.monthlyPrompts) {
            return {
                allowed: false,
                reason: 'monthly_prompt_limit',
                used: prompt_count,
                limit: limits.monthlyPrompts,
                nextReset: getNextResetDate()
            };
        }
        return { allowed: true, used: prompt_count, limit: limits.monthlyPrompts };
    }
    
    if (type === 'image') {
        if (image_count >= limits.monthlyImages) {
            return {
                allowed: false,
                reason: 'monthly_image_limit',
                used: image_count,
                limit: limits.monthlyImages,
                nextReset: getNextResetDate()
            };
        }
        return { allowed: true, used: image_count, limit: limits.monthlyImages };
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
        'SELECT tier, prompt_count, image_count FROM licenses WHERE license_key = $1',
        [licenseKey]
    );
    
    if (result.rows.length === 0) return { allowed: false, reason: 'License not found' };
    
    const { tier, prompt_count, image_count } = result.rows[0];
    const limits = TIER_LIMITS[tier];
    
    if (type === 'prompt') {
        if (prompt_count >= limits.monthlyPrompts) {
            return {
                allowed: false,
                reason: 'monthly_prompt_limit',
                used: prompt_count,
                limit: limits.monthlyPrompts,
                nextReset: getNextResetDate()
            };
        }
        await pool.query(
            'UPDATE licenses SET prompt_count = prompt_count + 1 WHERE license_key = $1',
            [licenseKey]
        );
        return {
            allowed: true,
            used: prompt_count + 1,
            limit: limits.monthlyPrompts,
            remaining: limits.monthlyPrompts - prompt_count - 1
        };
    }
    
    if (type === 'image') {
        if (image_count >= limits.monthlyImages) {
            return {
                allowed: false,
                reason: 'monthly_image_limit',
                used: image_count,
                limit: limits.monthlyImages,
                nextReset: getNextResetDate()
            };
        }
        await pool.query(
            'UPDATE licenses SET image_count = image_count + 1 WHERE license_key = $1',
            [licenseKey]
        );
        return {
            allowed: true,
            used: image_count + 1,
            limit: limits.monthlyImages,
            remaining: limits.monthlyImages - image_count - 1
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
    const limits = TIER_LIMITS[decoded.tier];
    if (!limits || !limits.hasCommandCenter) {
        return res.status(403).json({
            error: 'Upgrade required',
            code: 'TIER_NO_ACCESS',
            message: 'Your ToolKit tier does not include Command Center access. Upgrade to unlock this feature.',
            upgradeUrl: 'https://offgridaitoolkit.com/products/offgrid-ai-toolkit-command-center'
        });
    }
    
    // Attach license info to the request for downstream handlers
    req.license = {
        licenseKey: decoded.licenseKey,
        tier: decoded.tier
    };
    
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
                    message: `You have used all ${result.limit} image generations for this month. Your limit resets on ${result.nextReset}. Upgrade to Command Center Pro for 40 monthly images.`,
                    upgradeUrl: 'https://offgridaitoolkit.com/products/offgrid-ai-toolkit-command-center-pro'
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
            await pool.query(
                'UPDATE licenses SET is_activated = TRUE, activated_at = NOW() WHERE license_key = $1',
                [normalizedKey]
            );
            
            // Generate JWT token
            const token = generateToken(normalizedKey, license.tier);
            const tierInfo = TIER_LIMITS[license.tier];
            
            await logActivationEvent(normalizedKey, 'activate.success', `Tier ${license.tier} activated`);
            
            if (logToBetterStack) {
                logToBetterStack('info', 'license.activated', {
                    summary: `License activated: Tier ${license.tier} (${tierInfo.name})`,
                    tier: license.tier,
                    tierName: tierInfo.name
                });
            }
            
            res.json({
                success: true,
                token,
                tier: license.tier,
                tierName: tierInfo.name,
                limits: {
                    monthlyPrompts: tierInfo.monthlyPrompts,
                    monthlyImages: tierInfo.monthlyImages
                },
                message: `Welcome to the Command Center! Your ${tierInfo.name} is now activated.`
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
            
            res.json({
                valid: true,
                tier: decoded.tier,
                tierName: TIER_LIMITS[decoded.tier]?.name,
                usage,
                hasEmail: !!result.rows[0].email
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

    function requireAdmin(req, res, next) {
        const adminKey = req.headers['x-admin-key'];
        if (!adminKey || adminKey !== ADMIN_SECRET) {
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
            
            if (![1, 2, 3].includes(tier)) {
                return res.status(400).json({ error: 'Tier must be 1, 2, or 3' });
            }
            
            const keys = [];
            for (let i = 0; i < count; i++) {
                const key = generateLicenseKey();
                await pool.query(
                    'INSERT INTO licenses (license_key, tier, notes) VALUES ($1, $2, $3)',
                    [key, tier, notes]
                );
                keys.push(key);
            }
            
            if (logToBetterStack) {
                logToBetterStack('info', 'admin.keys_generated', {
                    summary: `Generated ${count} Tier ${tier} license keys`,
                    count,
                    tier
                });
            }
            
            res.json({
                success: true,
                count: keys.length,
                tier,
                tierName: TIER_LIMITS[tier].name,
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
            const { tier, activated, page = 1, limit = 50 } = req.query;
            
            let query = 'SELECT * FROM licenses';
            const conditions = [];
            const params = [];
            
            if (tier) {
                params.push(parseInt(tier));
                conditions.push(`tier = $${params.length}`);
            }
            if (activated !== undefined) {
                params.push(activated === 'true');
                conditions.push(`is_activated = $${params.length}`);
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            query += ' ORDER BY created_at DESC';
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            params.push(parseInt(limit));
            query += ` LIMIT $${params.length}`;
            params.push(offset);
            query += ` OFFSET $${params.length}`;
            
            const result = await pool.query(query, params);
            
            // Get total count
            let countQuery = 'SELECT COUNT(*) FROM licenses';
            if (conditions.length > 0) {
                countQuery += ' WHERE ' + conditions.join(' AND ');
            }
            const countResult = await pool.query(countQuery, params.slice(0, conditions.length));
            
            res.json({
                licenses: result.rows.map(row => ({
                    ...row,
                    tierName: TIER_LIMITS[row.tier]?.name
                })),
                total: parseInt(countResult.rows[0].count),
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
                    COUNT(*) FILTER (WHERE tier = 1) as tier1_keys,
                    COUNT(*) FILTER (WHERE tier = 2) as tier2_keys,
                    COUNT(*) FILTER (WHERE tier = 3) as tier3_keys,
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
    getUsageInfo,
    verifyToken,
    pool,
    TIER_LIMITS
};
