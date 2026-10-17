import express from 'express';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import * as q from './db/db.js';

const RP_NAME = 'IS451 Records Portal';
const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:3000';

const router = express.Router();

// The browser's reply contains the challenge inside clientDataJSON. Read it out.
function challengeFromResponse(response) {
    try {
        const json = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
        return JSON.parse(json).challenge;
    } catch {
        return null;
    }
}

// ---------- REGISTRATION ----------
router.post('/register/options', async (req, res) => {
    try {
        const code = String(req.body.code || '').trim();
        const codeRow = q.findValidEnrolmentCode(code);
        if (!codeRow) return res.status(400).json({ error: 'Invalid or expired enrolment code' });

        // The user comes from the code in OUR database, never from the browser.
        const user = q.getUserById(codeRow.user_id);
        const existing = q.getCredentialsForUser(user.id);

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: user.user_code,
            userID: new TextEncoder().encode(user.webauthn_user_id),
            attestationType: 'none',
            excludeCredentials: existing.map((c) => ({ id: c.id })),
            authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        });

        q.saveChallenge(user.id, options.challenge, 'registration');
        res.json(options);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/register/verify', async (req, res) => {
    const fail = () => res.status(400).json({ error: 'Registration failed' });
    try {
        const code = String(req.body.code || '').trim();
        const response = req.body.response;
        const codeRow = q.findValidEnrolmentCode(code);
        if (!codeRow || !response) return fail();

        // The challenge can be used only once, and must belong to this user.
        const challenge = challengeFromResponse(response);
        const row = challenge && q.consumeChallenge(challenge, 'registration');
        if (!row || row.user_id !== codeRow.user_id) return fail();

        const result = await verifyRegistrationResponse({
            response,
            expectedChallenge: row.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
        if (!result.verified) return fail();

        const { credential } = result.registrationInfo;
        q.saveCredential({
            id: credential.id,
            userId: codeRow.user_id,
            publicKey: Buffer.from(credential.publicKey),
            counter: credential.counter,
            transports: JSON.stringify(credential.transports || []),
        });
        q.markCodeUsed(codeRow.id);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        fail();
    }
});

// ---------- LOGIN ----------
router.post('/login/options', async (req, res) => {
    try {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'required',
        });
        q.saveChallenge(null, options.challenge, 'authentication');
        res.json(options);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login/verify', async (req, res) => {
    const deny = () => res.status(401).json({ error: 'Sign-in failed' });
    try {
        const response = req.body.response;
        if (!response) return deny();

        const challenge = challengeFromResponse(response);
        const row = challenge && q.consumeChallenge(challenge, 'authentication');
        if (!row) return deny();

        const cred = q.getCredentialById(response.id);
        if (!cred) return deny(); // unknown passkey: no session

        const result = await verifyAuthenticationResponse({
            response,
            expectedChallenge: row.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: cred.id,
                publicKey: new Uint8Array(cred.public_key),
                counter: cred.counter,
                transports: JSON.parse(cred.transports || '[]'),
            },
        });
        if (!result.verified) return deny();

        q.updateCounter(cred.id, result.authenticationInfo.newCounter);

        // A session is created ONLY after the server has verified the passkey.
        const token = q.createSession(cred.user_id);
        res.cookie('session', token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 30 * 60 * 1000,
            path: '/',
        });
        const user = q.getUserById(cred.user_id);
        res.json({ ok: true, role: user.role, userCode: user.user_code });
    } catch (e) {
        console.error(e);
        deny();
    }
});

export default router;