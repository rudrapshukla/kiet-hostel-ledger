// Run with: npm run hash-password
// Prompts for a passcode, then prints a JWT_SECRET and ADMIN_PASSWORD_HASH
// to paste into your .env file. The plain passcode is never stored anywhere.

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Choose an admin passcode (won't be shown as you type isn't supported here, just don't screen-share): ", (pw) => {
  if (!pw || pw.trim().length < 8) {
    console.log("\nUse a passcode of at least 8 characters. Run this again.");
    rl.close();
    return;
  }
  const hash = bcrypt.hashSync(pw.trim(), 12);
  const secret = crypto.randomBytes(32).toString("hex");

  console.log("\nPaste these two lines into your .env file:\n");
  console.log(`JWT_SECRET=${secret}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log("\nThe passcode itself is not stored anywhere — only this hash is, and a hash cannot be reversed back into the passcode.");
  rl.close();
});
