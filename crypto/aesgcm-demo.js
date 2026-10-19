import crypto from 'crypto';

const note = 'Student consultation note – demonstration data only';

const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);

// Encrypt
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(note, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

function decrypt(data) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

console.log('Original note :', note);
console.log('Key (hex)     :', key.toString('hex'));
console.log('IV (hex)      :', iv.toString('hex'));
console.log('Ciphertext    :', ciphertext.toString('hex'));

// 1. Decrypt the untouched ciphertext
console.log('\n1) Decrypting valid ciphertext...');
console.log('SUCCESS:', decrypt(ciphertext));

// 2. Change one byte and try again
const tampered = Buffer.from(ciphertext);
tampered[0] = tampered[0] ^ 0x01;
console.log('\n2) Changing one byte of the ciphertext and decrypting...');
console.log('Tampered      :', tampered.toString('hex'));
try {
    console.log('Result:', decrypt(tampered));
} catch (e) {
    console.log('TAMPER DETECTED: decryption rejected (' + e.message + ')');
}