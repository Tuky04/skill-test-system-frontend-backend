#!/usr/bin/env node
// สร้างโฟลเดอร์แพ็กเกจพร้อมขึ้นเซิร์ฟเวอร์ (แยกจากระบบที่ใช้พัฒนาในเครื่อง)
//   node deploy/make-package.js                       -> dist/skill-test-system-deploy
//   node deploy/make-package.js --out D:\skilltest    -> เลือกที่ปลายทางเอง
//   --skip-build     ใช้ frontend/build ที่มีอยู่แล้ว
//   --skip-install   ไม่รัน npm ci ใน app/ (ผู้ติดตั้งต้องรัน npm ci --omit=dev เอง และต้องมีอินเทอร์เน็ต)
// ต้องรันบนเครื่องที่มีอินเทอร์เน็ต (เพื่อ build และดาวน์โหลด dependency) แพ็กเกจที่ได้ติดตั้งโดยไม่ใช้อินเทอร์เน็ตได้
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const out = path.resolve(option('--out', path.join(root, 'dist', 'skill-test-system-deploy')));
const MARKER = '.deploy-package';
const run = (command, cwd, env = {}) => execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

function prepareOutput() {
    if (fs.existsSync(out)) {
        const entries = fs.readdirSync(out);
        // กันลบโฟลเดอร์ผิดที่: ลบทับได้เฉพาะโฟลเดอร์ที่เคยถูกสร้างโดยสคริปต์นี้ (มีไฟล์ marker)
        if (entries.length && !entries.includes(MARKER)) {
            console.error(`ปฏิเสธ: ${out} ไม่ว่างและไม่ใช่แพ็กเกจที่สร้างจากสคริปต์นี้ (ไม่มีไฟล์ ${MARKER}) — เลือกโฟลเดอร์อื่นด้วย --out`);
            process.exit(1);
        }
        // เก็บ app/.env และ data/ ของการติดตั้งเดิมไว้ ไม่ให้การสร้างแพ็กเกจใหม่ทับค่าตั้งค่าและเอกสารผู้ใช้
        for (const entry of entries) {
            if (entry === 'data') continue;
            if (entry === 'app') {
                for (const child of fs.readdirSync(path.join(out, 'app'))) {
                    if (child !== '.env') fs.rmSync(path.join(out, 'app', child), { recursive: true, force: true });
                }
                continue;
            }
            fs.rmSync(path.join(out, entry), { recursive: true, force: true });
        }
    }
    fs.mkdirSync(out, { recursive: true });
}

function buildFrontend() {
    const frontend = path.join(root, 'frontend');
    if (flag('--skip-build')) return;
    if (!fs.existsSync(path.join(frontend, 'node_modules'))) run('npm ci', frontend);
    // ค่า build เฉพาะแพ็กเกจนี้ (ไฟล์ .local มีลำดับสูงกว่า .env.production และถูกลบทิ้งหลัง build)
    //  - API อยู่ที่ /api ของโดเมน/พอร์ตเดียวกัน, หน้าเว็บอยู่ที่ราก (/)
    const envFile = path.join(frontend, '.env.production.local');
    fs.writeFileSync(envFile, 'REACT_APP_API_URL=/api\nREACT_APP_ROUTER_BASENAME=/\n');
    try {
        run('npm run build', frontend, { PUBLIC_URL: '/', CI: 'false', GENERATE_SOURCEMAP: 'false' });
    } finally {
        fs.rmSync(envFile, { force: true });
    }
}

function copyBackend() {
    const source = path.join(root, 'backend');
    const skip = new Set(['node_modules', 'test', 'test-support', 'uploads', 'private_uploads', 'models', 'migrations', '.env', '.gitignore']);
    fs.cpSync(source, path.join(out, 'app'), {
        recursive: true,
        filter: (file) => {
            const relative = path.relative(source, file);
            if (!relative) return true;
            return !skip.has(relative.split(path.sep)[0]);
        },
    });
    fs.mkdirSync(path.join(out, 'app', 'node_modules'), { recursive: true });
    if (!flag('--skip-install')) run('npm ci --omit=dev --no-audit --no-fund', path.join(out, 'app'));
}

function copyFrontend() {
    const build = path.join(root, 'frontend', 'build');
    if (!fs.existsSync(path.join(build, 'index.html'))) {
        console.error('ไม่พบ frontend/build/index.html — รันโดยไม่ใส่ --skip-build');
        process.exit(1);
    }
    fs.cpSync(build, path.join(out, 'web'), { recursive: true });
}

function copyDatabase() {
    fs.mkdirSync(path.join(out, 'database'), { recursive: true });
    fs.copyFileSync(path.join(root, 'skill_test_system.sql'), path.join(out, 'database', 'skill_test_system.sql'));
    fs.cpSync(path.join(root, 'backend', 'migrations'), path.join(out, 'database', 'migrations'), { recursive: true });
}

function copyTemplates() {
    const templates = path.join(__dirname, 'templates');
    fs.copyFileSync(path.join(templates, 'env.example'), path.join(out, 'app', '.env.example'));
    for (const name of ['README_TH.md', 'start.sh', 'ecosystem.config.js', 'nginx.conf.example']) {
        fs.copyFileSync(path.join(templates, name), path.join(out, name));
    }
    // .bat ต้องเป็น CRLF เพื่อให้ cmd.exe อ่านถูกต้อง
    const bat = fs.readFileSync(path.join(templates, 'start.bat'), 'utf8').replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(path.join(out, 'start.bat'), bat);
    try { fs.chmodSync(path.join(out, 'start.sh'), 0o755); } catch { /* Windows */ }
    fs.mkdirSync(path.join(out, 'data'), { recursive: true });
    fs.writeFileSync(path.join(out, 'data', 'README.txt'), 'ที่เก็บไฟล์เอกสารที่นักศึกษาอัปโหลด (private_uploads) และไฟล์ log ต้องสำรองข้อมูลโฟลเดอร์นี้ร่วมกับฐานข้อมูลทุกวัน\r\n');
}

function writeVersion() {
    let commit = 'unknown';
    try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* ไม่ได้อยู่ใน git */ }
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(out, 'VERSION.txt'), `skill-test-system backend ${pkg.version}\r\ncommit ${commit}\r\nbuilt ${new Date().toISOString()}\r\n`);
    fs.writeFileSync(path.join(out, MARKER), 'สร้างโดย deploy/make-package.js — สคริปต์สร้างแพ็กเกจใหม่ลบทับโฟลเดอร์นี้ได้ (เว้น app/.env และ data/)\r\n');
}

function folderSize(dir) {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        total += entry.isDirectory() ? folderSize(full) : fs.statSync(full).size;
    }
    return total;
}

console.log(`สร้างแพ็กเกจที่ ${out}`);
prepareOutput();
buildFrontend();
copyBackend();
copyFrontend();
copyDatabase();
copyTemplates();
writeVersion();
console.log(`\nเสร็จแล้ว (${(folderSize(out) / 1048576).toFixed(1)} MB) — อ่าน README_TH.md ในโฟลเดอร์นั้นเพื่อติดตั้ง`);
