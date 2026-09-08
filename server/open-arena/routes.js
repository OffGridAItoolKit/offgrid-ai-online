'use strict';

const crypto = require('node:crypto');
const {
    ROSTER,
    VERSION,
    RUBRIC_VERSION,
    VALIDATION_VERSION,
    WEIGHTS,
    GRADER_PROMPT,
    validateInput,
    runComparison,
} = require('./core');
const { configuration, readiness, createProviders } = require('./providers');

function accessAllowed(supplied, expected) {
    if (!expected || typeof supplied !== 'string') return false;
    const a = crypto.createHash('sha256').update(supplied).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

async function reserveRun(pool, config) {
    let client;
    try {
        client = await pool.connect();
    } catch {
        throw new Error(
            'The pilot usage guard is unavailable. No model calls were started.',
        );
    }
    let locked = false;
    try {
        // One pilot at a time across all Render processes; counts survive deploys/restarts.
        const lock = await client.query(
            'SELECT pg_try_advisory_lock(70410261) AS acquired',
        );
        if (!lock.rows[0]?.acquired)
            throw new Error(
                'Another pilot run is in progress. Please try again shortly.',
            );
        locked = true;
        await client.query(`CREATE TABLE IF NOT EXISTS open_arena_pilot_usage (
            day DATE PRIMARY KEY, runs INTEGER NOT NULL DEFAULT 0)`);
        const usage =
            await client.query(`SELECT COALESCE(SUM(runs),0)::int AS monthly,
            COALESCE(SUM(runs) FILTER (WHERE day = CURRENT_DATE),0)::int AS daily
            FROM open_arena_pilot_usage WHERE day >= date_trunc('month',CURRENT_DATE)::date`);
        if (
            usage.rows[0].monthly >= config.monthlyRunLimit ||
            usage.rows[0].daily >= config.dailyRunLimit
        ) {
            throw new Error(
                'The pilot run allowance is used up. No model calls were started.',
            );
        }
        await client.query(`INSERT INTO open_arena_pilot_usage(day,runs) VALUES(CURRENT_DATE,1)
            ON CONFLICT(day) DO UPDATE SET runs = open_arena_pilot_usage.runs + 1`);
        return async () => {
            try {
                await client.query('SELECT pg_advisory_unlock(70410261)');
            } catch (error) {
                client.release(true);
                throw error;
            }
            client.release();
        };
    } catch (error) {
        let destroy = false;
        if (locked)
            await client
                .query('SELECT pg_advisory_unlock(70410261)')
                .catch(() => {
                    destroy = true;
                });
        client.release(destroy);
        if (/^Another pilot|^The pilot/.test(error.message)) throw error;
        throw new Error(
            'The pilot usage guard is unavailable. No model calls were started.',
        );
    }
}

function registerOpenArenaRoutes(
    app,
    {
        pool,
        requireLicense,
        checkPromptLimit,
        incrementUsage,
        reserve,
        config = configuration(),
        providers = createProviders(config),
    },
) {
    app.get('/api/open-arena/models', (req, res) => {
        res.json({
            models: ROSTER,
            defaultModel: 'matched',
            rosterVersion: VERSION,
        });
    });
    app.get('/api/open-arena/config', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            roster: ROSTER,
            rosterVersion: VERSION,
            rubricVersion: RUBRIC_VERSION,
            validationVersion: VALIDATION_VERSION,
            weights: WEIGHTS,
            graderPrompt: GRADER_PROMPT,
            ready: readiness(config).length === 0,
            issues: readiness(config),
            privatePilot: !config.publicAccess,
            privacy:
                'Questions and images are sent to Modal and OpenRouter providers. The application stores usage counts, not answer text. Exports contain your question and answers.',
        });
    });
    app.post(
        '/api/open-arena/run',
        (req, res, next) => {
            if (
                !config.publicAccess &&
                !accessAllowed(req.get('X-Arena-Access'), config.accessKey)
            )
                return res
                    .status(403)
                    .json({ error: 'Enter the private pilot access key.' });
            const issues = readiness(config);
            if (issues.length)
                return res.status(503).json({ error: issues.join(' ') });
            next();
        },
        requireLicense,
        checkPromptLimit,
        async (req, res) => {
            let input;
            try {
                input = validateInput(req.body);
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
            let release;
            try {
                release = await (reserve
                    ? reserve(config)
                    : reserveRun(pool, config));
            } catch (error) {
                return res.status(429).json({ error: error.message });
            }
            const controller = new AbortController();
            const deadline = setTimeout(() => controller.abort(), 15 * 60000);
            res.on('close', () => controller.abort());
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-store',
                'X-Accel-Buffering': 'no',
            });
            res.flushHeaders();
            const send = (data) => {
                if (!res.destroyed)
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            const heartbeat = setInterval(() => {
                if (!res.destroyed) res.write(': heartbeat\n\n');
            }, 10000);
            try {
                const run = await runComparison(input, providers, {
                    signal: controller.signal,
                    onProgress: (progress) =>
                        send({ type: 'progress', ...progress }),
                });
                if (run.status === 'complete' && req.license) {
                    await incrementUsage(
                        req.license.licenseKey,
                        'prompt',
                    ).catch(() => {});
                }
                send({ type: 'result', run });
            } catch (error) {
                send({
                    type: 'error',
                    error: controller.signal.aborted
                        ? 'Run cancelled or timed out.'
                        : 'The comparison could not finish.',
                });
            } finally {
                clearTimeout(deadline);
                clearInterval(heartbeat);
                await release().catch(() =>
                    console.warn(
                        '[Open Arena] Usage guard connection closed during cleanup.',
                    ),
                );
                res.end();
            }
        },
    );
}

module.exports = { accessAllowed, reserveRun, registerOpenArenaRoutes };
