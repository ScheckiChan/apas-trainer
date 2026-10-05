/** Prints a fresh VAPID key pair in .env format. */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('# Add these to your .env (keep the private key secret):');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
