/**
 * walletSetup.js — simplified, no Solana RPC connection needed
 * Just generates a keypair and saves it to .env
 * Usage: node src/utils/walletSetup.js
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

async function setup() {
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║   ⚡  PHASE 3 — WALLET SETUP               ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  const envPath = path.resolve(".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  // Check if already has a valid key
  const existingKey = process.env.WALLET_PRIVATE_KEY;
  if (existingKey && existingKey.length > 10) {
    try {
      const kp = Keypair.fromSecretKey(bs58.decode(existingKey));
      console.log("✅ Existing wallet found:");
      console.log(`   Public Key : ${kp.publicKey.toBase58()}`);
      console.log("\nWallet already configured in .env\n");
      console.log("📋 NEXT STEPS:");
      console.log("   1. Send SOL to the public key above");
      console.log("   2. Add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to .env");
      console.log("   3. Run: npm run dev\n");
      return;
    } catch {
      console.log("⚠️  Existing key invalid — generating new wallet.\n");
    }
  }

  // Generate new keypair
  const keypair        = Keypair.generate();
  const privateKeyB58  = bs58.encode(keypair.secretKey);
  const publicKey      = keypair.publicKey.toBase58();

  console.log("🔑 NEW WALLET GENERATED");
  console.log("━".repeat(56));
  console.log(`Public Key  : ${publicKey}`);
  console.log(`Private Key : ${privateKeyB58}`);
  console.log("━".repeat(56));

  // Save to .env
  if (envContent.includes("WALLET_PRIVATE_KEY=")) {
    envContent = envContent.replace(/^WALLET_PRIVATE_KEY=.*$/m, `WALLET_PRIVATE_KEY=${privateKeyB58}`);
  } else {
    envContent += `\nWALLET_PRIVATE_KEY=${privateKeyB58}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log("\n✅ Private key saved to .env automatically.");

  console.log("\n📋 NEXT STEPS:");
  console.log("━".repeat(56));
  console.log(`1. Send SOL to this address (start with $50 worth):`);
  console.log(`   ${publicKey}`);
  console.log(`\n2. Setup Telegram alerts:`);
  console.log(`   • Message @BotFather → /newbot → copy token`);
  console.log(`   • Message your bot, visit /getUpdates, copy chat.id`);
  console.log(`   • Add both to backend/.env`);
  console.log(`\n3. Run: npm run dev`);
  console.log(`\n⚠️  SECURITY:`);
  console.log(`   • NEVER share your private key`);
  console.log(`   • NEVER commit .env to git`);
  console.log(`   • Only keep trading capital in this wallet\n`);
}

setup().catch(console.error);
