import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'app.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const randomId = () => crypto.randomBytes(32).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const addUser = db.prepare(
    'INSERT INTO users (user_code, full_name, role, webauthn_user_id) VALUES (?, ?, ?, ?)'
);
const people = [
    ['S1', 'Edinam Agyeman', 'student'],
    ['S2', 'Petra Asima', 'student'],
    ['L1', 'Dr Josephine Kekeli', 'lecturer'],
];
const ids = {};
for (const [code, name, role] of people) {
    ids[code] = addUser.run(code, name, role, randomId()).lastInsertRowid;
}

const courseId = db
    .prepare('INSERT INTO courses (code, title, lecturer_id) VALUES (?, ?, ?)')
    .run('IS451', 'Information Security', ids.L1).lastInsertRowid;

const enrol = db.prepare(
    'INSERT INTO enrollments (course_id, student_id, score) VALUES (?, ?, ?)'
);
enrol.run(courseId, ids.S1, 72);
enrol.run(courseId, ids.S2, 58);

const addCode = db.prepare(
    'INSERT INTO enrolment_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)'
);
const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
console.log('One-time enrolment codes (copy them now, they are shown once):');
for (const code of Object.keys(ids)) {
    const plain = crypto.randomBytes(4).toString('hex');
    addCode.run(ids[code], sha256(plain), expires);
    console.log(`  ${code}: ${plain}`);
}
console.log('Database created.');

