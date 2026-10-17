# Student Records Portal (IS451 Assignment 2)

A small prototype with real WebAuthn passkey sign-in, server-side role-based access control (Student and Lecturer) and a separate AES-GCM encryption demo. All names, IDs and grades are fictional.

## 1. Tools and versions

- OS: [Windows 11]
- Node.js [v22.20.0] and npm [10.9.3]
- Browser: [Microsoft Edge]
- Database: SQLite (single file `app.db`) through the `better-sqlite3` package. No separate database install is needed.
- Main packages (exact versions are in `package-lock.json`): express [5.3.0], cookie-parser [1.4.7], better-sqlite3 [13.0.3], @simplewebauthn/server [13.3.3], @simplewebauthn/browser [13.3.0]
- A device that can create a passkey: Windows Hello (PIN or fingerprint), Touch ID, a phone, or a FIDO2 security key.

## 2. How to start

Run these in the project folder, one at a time:

```
npm install
npm run setup
npm start
```

- `npm run setup` builds a fresh `app.db` from `db/schema.sql` and `db/seed.js`, and prints three one-time enrolment codes (S1, S2, L1). Copy them. They are shown only once.
- `npm start` runs the site at http://localhost:3000. Open it as **localhost**, not 127.0.0.1, or passkeys will fail.
- Stop the server with Ctrl+C before running `npm run setup` again.

## 3. Test accounts (all fictional)

| Code | Name | Role | Notes |
| --- | --- | --- | --- |
| S1 | [Edinam Agyeman] | Student | Enrolled in IS451 |
| S2 | [Petra Asima] | Student | Enrolled in IS451 |
| L1 | [Dr Josephine Kekeli] | Lecturer | Teaches IS451 (the only course) |

Roles are set only in `db/seed.js`. No page or endpoint can change a role or create a user.

## 4. Safe passkey enrolment

1. Run `npm run setup` to get fresh one-time codes.
2. Open http://localhost:3000/enrol.html, enter the code for the account, and click Register passkey.
3. Approve the prompt on your device (PIN, fingerprint or security key).
4. Open http://localhost:3000/login.html and click Sign in. Choose the passkey for the account you want if asked.

The user and role come from the code in our database, never from the browser, so nobody can enrol as someone else or choose the Lecturer role. Each code expires after 7 days and works once. The database stores only the code's hash.

These one-time codes are a demonstration shortcut, not real identity proofing. A real university would verify identity first, for example in person or through an existing trusted system, and would have a supervised recovery process.

## 5. If the passkey is on your own device

A passkey is tied to the device and to `localhost`, so a passkey created on the authors' machine will not work on yours. The examiner should run `npm run setup` for fresh codes and register their own passkey on their own device, as in section 4. Do not run `npm run setup` again after enrolling. It rebuilds the database, and the old passkeys then no longer match. If you must, delete the old localhost passkeys in your device settings and enrol again.

## 6. How to repeat tests T1 to T8

For console tests: open a page of the app, press F12, choose the Console tab and paste the line. IDs in the commands assume S1 has id 1, S2 id 2 and L1 id 3, as created by the seed script.

| Test | Steps | Expected |
| --- | --- | --- |
| T1 | Enrol S1 (section 4), then sign in | Registration and verified login succeed |
| T2 | Signed in as S1, view the dashboard | S1's own grade is shown |
| T3 | As S1 click "Try to view another student's grades", or run the first console line below | 403, no S2 data |
| T4 | As S1 click "Try to edit a grade", or run the second console line below | 403, score unchanged |
| T5 | Sign in as L1, change S1's score, click Save, refresh | 200, new score persists |
| T6 | Run the third console line while signed out, then sign in, log out and run it again | 401 both times |
| T7 | Run the fourth console line (a fake passkey) on the login page | 401, no cookie, no new session |
| T8 | `node crypto/aesgcm-demo.js` | Valid text decrypts, tampered ciphertext is rejected |

```
fetch('/api/students/2/grades').then(async r => console.log(r.status, await r.text()))

fetch('/api/courses/1/grades/1',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({score:100})}).then(async r => console.log(r.status, await r.text()))

fetch('/api/me').then(async r => console.log(r.status, await r.text()))

fetch('/api/login/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({response:{id:'fake',rawId:'fake',type:'public-key',response:{clientDataJSON:'e30',authenticatorData:'x',signature:'x'}}})}).then(async r => console.log(r.status, await r.text()))
```

## 7. Encryption demo (AES-GCM)

```
node crypto/aesgcm-demo.js
```

It encrypts the note "Student consultation note – demonstration data only" with a new random key and nonce, decrypts it, then changes one byte of the ciphertext and shows that decryption is rejected. It uses Node's built-in `crypto` library, and the key is printed for demonstration only.

## 8. Project files

- `server.js`: web server, session check, role and ownership checks
- `auth.js`: passkey registration and login (SimpleWebAuthn)
- `db/`: `schema.sql`, `seed.js` and `db.js` (all database access)
- `public/`: the web pages
- `crypto/aesgcm-demo.js`: the AES-GCM demo
- `docs/evidence/`: test evidence

## 9. Do not commit secrets

`app.db`, `node_modules/`, enrolment codes and any keys are never committed (see `.gitignore`). The repository contains only fictional data.