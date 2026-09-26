const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('staff operations are not available to admin accounts', () => {
    const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8');
    const staffPaths = [
        '/registrations',
        '/scores/submit',
        '/staff/pending-registrations',
        '/staff/students',
        '/staff/export/options',
        '/staff/export/preview',
        '/export/registrations.xlsx',
    ];
    for (const routePath of staffPaths) {
        const escaped = routePath.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        assert.match(routes, new RegExp("[\"']" + escaped + "[\"'][^\\n]*requireRole\\('staff'\\)"));
    }
    assert.doesNotMatch(routes, /\/staff\/[^'"]*['"][^\n]*requireRole\([^)]*admin/);
    assert.doesNotMatch(routes, /\/export\/registrations(?:\.xlsx)?['"][^\n]*requireRole\([^)]*admin/);
});

test('admin summary no longer exposes the individual-result list export routes', () => {
    const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8');
    assert.doesNotMatch(routes, /\/reports\/summary-list/);
    assert.doesNotMatch(routes, /\/export\/passed/);
    assert.match(routes, /\/reports\/stats['"][^\n]*requireRole\('admin'\)/);
    assert.match(routes, /\/audit\/admin['"][^\n]*requireRole\('admin'\)/);
});
