import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'app.db'));
db.pragma('foreign_keys = ON');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
const inMinutes = (m) => new Date(Date.now() + m * 60 * 1000).toISOString();

// ---- users ----
export function getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// ---- enrolment codes ----
export function findValidEnrolmentCode(plain) {
    return db
        .prepare('SELECT * FROM enrolment_codes WHERE code_hash = ? AND used = 0 AND expires_at > ?')
        .get(sha256(plain), now());
}
export function markCodeUsed(id) {
    db.prepare('UPDATE enrolment_codes SET used = 1 WHERE id = ?').run(id);
}

// ---- challenges (one-time random values) ----
export function saveChallenge(userId, challenge, type) {
    db.prepare(
        'INSERT INTO challenges (user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?)'
    ).run(userId, challenge, type, inMinutes(5));
}
export function consumeChallenge(challenge, type) {
    const row = db
        .prepare(
            'SELECT * FROM challenges WHERE challenge = ? AND type = ? AND consumed = 0 AND expires_at > ?'
        )
        .get(challenge, type, now());
    if (!row) return null;
    const result = db
        .prepare('UPDATE challenges SET consumed = 1 WHERE id = ? AND consumed = 0')
        .run(row.id);
    return result.changes === 1 ? row : null;
}

// ---- passkey credentials (public keys only) ----
export function getCredentialsForUser(userId) {
    return db.prepare('SELECT * FROM credentials WHERE user_id = ?').all(userId);
}
export function getCredentialById(id) {
    return db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
}
export function saveCredential({ id, userId, publicKey, counter, transports }) {
    db.prepare(
        'INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, publicKey, counter, transports);
}
export function updateCounter(id, counter) {
    db.prepare('UPDATE credentials SET counter = ? WHERE id = ?').run(counter, id);
}

// ---- sessions ----
export function createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
        sha256(token), userId, inMinutes(30)
    );
    return token; // only the hash is stored in the database
}
export function getSessionUser(token) {
    return db
        .prepare(
            `SELECT u.id, u.user_code AS userCode, u.full_name AS fullName, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.revoked = 0 AND s.expires_at > ?`
        )
        .get(sha256(token), now());
}
export function revokeSession(token) {
    db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(sha256(token));
}

// ---- courses and grades ----
export function getCourseForLecturer(lecturerId) {
    return db.prepare('SELECT * FROM courses WHERE lecturer_id = ?').get(lecturerId);
}
export function isEnrolled(courseId, studentId) {
    return !!db
        .prepare('SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?')
        .get(courseId, studentId);
}
export function getGradesForStudent(studentId) {
    return db
        .prepare(
            `SELECT c.code AS course, c.title, e.score
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ?`
        )
        .all(studentId);
}
export function getRoster(courseId) {
    return db
        .prepare(
            `SELECT u.id AS studentId, u.user_code AS userCode, u.full_name AS fullName, e.score
       FROM enrollments e JOIN users u ON u.id = e.student_id
       WHERE e.course_id = ?`
        )
        .all(courseId);
}
export function updateScore(courseId, studentId, score) {
    db.prepare('UPDATE enrollments SET score = ? WHERE course_id = ? AND student_id = ?').run(
        score, courseId, studentId
    );
}
