const { ethers } = require("ethers");
const crypto = require("crypto");

async function run() {
  const wallet = ethers.Wallet.createRandom();
  console.log("Wallet address:", wallet.address);
  
  // 1. Get Nonce
  const res = await fetch(`http://localhost:3001/api/auth/nonce?address=${wallet.address}`);
  if (!res.ok) {
    console.error("Failed to get nonce", await res.text());
    return;
  }
  const { nonce } = await res.json();
  console.log("Got nonce:", nonce);
  
  // 2. Sign Message
  const message = `Welcome to SIPARTA.\n\nClick to sign in and accept the SIPARTA Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nNonce: ${nonce}`;
  const signature = await wallet.signMessage(message);
  
  // 3. Verify
  const verifyRes = await fetch("http://localhost:3001/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: wallet.address,
      signature,
      message
    })
  });
  
  if (!verifyRes.ok) {
    console.error("Failed to verify", await verifyRes.text());
    return;
  }
  
  const result = await verifyRes.json();
  console.log("Verify Result:", result);
}

run().catch(console.error);
