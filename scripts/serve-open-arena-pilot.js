'use strict';
// Local-only real-provider pilot. Production uses the PostgreSQL guard in index.js.
if (process.env.NODE_ENV === 'production')
    throw new Error('This launcher is local-only.');
require('dotenv').config({
    path: require('node:path').resolve(__dirname, '../.env.arena'),
});
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const rateLimit = require('express-rate-limit');
const { registerOpenArenaRoutes } = require('../server/open-arena/routes');
const root = path.resolve(__dirname, '..');
const lockPath = path.join(root, '.arena-pilot-lock');
const usagePath = path.join(root, '.arena-pilot-usage.json');
async function reserve(config) {
    let lock;
    try {
        lock = await fs.open(lockPath, 'wx');
    } catch {
        throw new Error(
            'The local pilot is busy or its usage lock is unavailable.',
        );
    }
    const release = async () => {
        await lock.close();
        await fs.unlink(lockPath);
    };
    try {
        let counts;
        try {
            counts = JSON.parse(await fs.readFile(usagePath, 'utf8'));
        } catch (e) {
            if (e.code === 'ENOENT') counts = {};
            else throw e;
        }
        if (
            !counts ||
            Array.isArray(counts) ||
            typeof counts !== 'object' ||
            Object.values(counts).some((n) => !Number.isSafeInteger(n) || n < 0)
        )
            throw new Error('Invalid usage file');
        const day = new Date().toISOString().slice(0, 10),
            month = day.slice(0, 7);
        const monthly = Object.entries(counts)
            .filter(([date]) => date.startsWith(month))
            .reduce((sum, [, n]) => sum + n, 0);
        if (
            monthly >= config.monthlyRunLimit ||
            (counts[day] || 0) >= config.dailyRunLimit
        )
            throw new Error('Pilot run allowance is used up.');
        counts[day] = (counts[day] || 0) + 1;
        await fs.writeFile(usagePath, JSON.stringify(counts));
        return release;
    } catch {
        await release();
        throw new Error(
            'Local pilot allowance exhausted or usage storage unavailable. No model calls started.',
        );
    }
}
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (
        origin &&
        origin !== 'http://127.0.0.1:3109' &&
        origin !== 'http://localhost:3109'
    )
        return res.sendStatus(403);
    if (!['localhost', '127.0.0.1'].includes(req.hostname))
        return res.sendStatus(403);
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
            "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    });
    next();
});
app.use(express.json({ limit: '3mb' }));
app.use('/api', rateLimit({ windowMs: 60000, limit: 20 }));
const next = (req, res, done) => done();
registerOpenArenaRoutes(app, {
    requireLicense: next,
    checkPromptLimit: next,
    incrementUsage: async () => {},
    reserve,
});
app.get(['/arena-open', '/'], (req, res) =>
    res.sendFile(path.join(root, 'arena-open-matched.html')),
);
app.get('/arena', (req, res) => res.redirect('https://offgridtoolkit.ai/arena'));
app.use(
    '/assets/arena',
    express.static(path.join(root, 'assets/arena'), { maxAge: 0 }),
);
app.get('/compass-192.png', (req, res) =>
    res.sendFile(path.join(root, 'compass-192.png')),
);
app.listen(3109, '127.0.0.1', () =>
    console.log(
        'Real-provider private pilot: http://127.0.0.1:3109/arena-open',
    ),
);
