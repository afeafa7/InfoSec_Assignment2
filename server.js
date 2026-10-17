import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import * as q from './db/db.js';
import authRoutes from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(cookieParser());

// ---- Check: is the person signed in? ----
function requireAuth(req, res, next) {
    const token = req.cookies.session;
    const user = token ? q.getSessionUser(token) : null;
    if (!user) return res.status(401).json({ error: 'Please sign in' });
    req.user = user;
    next();
}

// ---- Check: does the person have the right role? ----
function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) return res.status(403).json({ error: 'Access denied' });
        next();
    };
}

// Passkey registration and login routes (Person 2's file)
app.use('/api', authRoutes);

app.post('/api/logout', requireAuth, (req, res) => {
    q.revokeSession(req.cookies.session);
    res.clearCookie('session');
    res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    const course = req.user.role === 'lecturer' ? q.getCourseForLecturer(req.user.id) : null;
    res.json({ ...req.user, courseId: course ? course.id : null });
});

// Student: only their own grades. Lecturer: only students in their own course.
app.get('/api/students/:id/grades', requireAuth, (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'Bad request' });

    if (req.user.role === 'student') {
        if (studentId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
        return res.json(q.getGradesForStudent(studentId));
    }

    const course = q.getCourseForLecturer(req.user.id);
    if (!course || !q.isEnrolled(course.id, studentId)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    res.json(q.getGradesForStudent(studentId));
});

// Lecturer only, and only for their own course.
app.get('/api/courses/:id/roster', requireAuth, requireRole('lecturer'), (req, res) => {
    const courseId = Number(req.params.id);
    const course = q.getCourseForLecturer(req.user.id);
    if (!course || course.id !== courseId) return res.status(403).json({ error: 'Access denied' });
    res.json(q.getRoster(courseId));
});

// Lecturer only, only their own course, only students enrolled in it.
app.put(
    '/api/courses/:courseId/grades/:studentId',
    requireAuth,
    requireRole('lecturer'),
    (req, res) => {
        const courseId = Number(req.params.courseId);
        const studentId = Number(req.params.studentId);
        const score = req.body.score;
        if (
            !Number.isInteger(courseId) ||
            !Number.isInteger(studentId) ||
            typeof score !== 'number' ||
            score < 0 ||
            score > 100
        ) {
            return res.status(400).json({ error: 'Bad request' });
        }
        const course = q.getCourseForLecturer(req.user.id);
        if (!course || course.id !== courseId || !q.isEnrolled(courseId, studentId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        q.updateScore(courseId, studentId, score);
        res.json({ ok: true, score });
    }
);

// Web pages, and the browser half of the passkey library
app.use(
    '/vendor/simplewebauthn',
    express.static(path.join(__dirname, 'node_modules/@simplewebauthn/browser/dist/bundle'))
);
app.use(express.static(path.join(__dirname, 'public')));

app.listen(3000, () => console.log('Running at http://localhost:3000'));