let privy;
let emailAddress = "";

document.addEventListener("DOMContentLoaded", async () => {
  const emailStep = document.getElementById("email-step");
  const codeStep = document.getElementById("code-step");
  const btnSendCode = document.getElementById("btn-send-code");
  const btnVerifyCode = document.getElementById("btn-verify-code");
  const privyEmailInput = document.getElementById("privy-email");
  const privyCodeInput = document.getElementById("privy-code");
  const statusMsg = document.getElementById("status-msg");

  function showMessage(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.style.color = isError ? "var(--color-pink)" : "var(--color-cyan)";
  }

  try {
    if (typeof PrivySDK === 'undefined' || !PrivySDK.Privy) {
      throw new TypeError("PrivySDK library is not loaded. Please reload the extension tab.");
    }

    // Initialize Privy Client
    privy = new PrivySDK.Privy({
      appId: CONFIG.PRIVY_APP_ID,
      storage: new PrivySDK.LocalStorage()
    });

    try {
      await privy.initialize();
    } catch (initErr) {
      // Ignore expected "no tokens in storage" error for unauthenticated sessions
      if (!initErr.message.toLowerCase().includes("no tokens") && !initErr.message.toLowerCase().includes("token")) {
        throw initErr;
      }
    }
    
    // Check if already authenticated
    const hasSession = await privy.user.get();
    if (hasSession && hasSession.user) {
      handleSuccessLogin(hasSession.user);
      return;
    }
  } catch (err) {
    console.error("Privy Init Error:", err);
    showMessage("Privy initialization warning: " + err.message, true);
  }

  btnSendCode.addEventListener("click", async () => {
    emailAddress = privyEmailInput.value.trim();
    if (!emailAddress) {
      showMessage("Please enter a valid email address.", true);
      return;
    }
    btnSendCode.disabled = true;
    btnSendCode.textContent = "Sending...";
    showMessage("");

    try {
      // Pass the email string directly for the vanilla core SDK
      await privy.auth.email.sendCode(emailAddress);
      showMessage("OTP Code sent to your email!");
      emailStep.classList.add("hidden");
      codeStep.classList.remove("hidden");
    } catch (err) {
      showMessage("Failed to send code: " + err.message, true);
      btnSendCode.disabled = false;
      btnSendCode.textContent = "Send Code";
    }
  });

  btnVerifyCode.addEventListener("click", async () => {
    const code = privyCodeInput.value.trim();
    if (!code || code.length !== 6) {
      showMessage("Please enter the 6-digit code.", true);
      return;
    }
    btnVerifyCode.disabled = true;
    btnVerifyCode.textContent = "Verifying...";
    showMessage("");

    try {
      // Pass the email and code strings directly for the vanilla core SDK
      const { user } = await privy.auth.email.loginWithCode(emailAddress, code);
      showMessage("Authentication successful! Syncing session...", false);
      handleSuccessLogin(user);
    } catch (err) {
      showMessage("Verification failed: " + err.message, true);
      btnVerifyCode.disabled = false;
      btnVerifyCode.textContent = "Verify & Sign In";
    }
  });

  async function handleSuccessLogin(user) {
    // Retrieve session token (JWT) using getAccessToken method
    const token = await privy.getAccessToken();
    
    // Find Solana Embedded Wallet
    let solanaWalletAddress = null;
    if (user.linkedAccounts) {
      const solAccount = user.linkedAccounts.find(acc => acc.type === "wallet" && acc.chainType === "solana");
      if (solAccount) {
        solanaWalletAddress = solAccount.address;
      }
    }
    
    // If not found in linkedAccounts, check user.wallets or similar
    if (!solanaWalletAddress && user.wallets) {
      const solWallet = user.wallets.find(w => w.chainType === "solana");
      if (solWallet) {
        solanaWalletAddress = solWallet.address;
      }
    }

    if (!solanaWalletAddress) {
      try {
        showMessage("Creating embedded Solana wallet...");
        const newWallet = await privy.embeddedWallet.create({ chainType: 'solana' });
        if (newWallet) {
          solanaWalletAddress = newWallet.address;
          console.log("Successfully provisioned embedded Solana wallet on login:", solanaWalletAddress);
        }
      } catch (walletErr) {
        console.error("Failed to provision embedded Solana wallet on login:", walletErr);
        showMessage("Warning: Failed to create embedded Solana wallet: " + walletErr.message, true);
      }
    }

    // Extract email address robustly
    let displayEmail = emailAddress;
    if (!displayEmail && user) {
      if (typeof user.email === 'string') {
        displayEmail = user.email;
      } else if (user.email && typeof user.email === 'object' && user.email.address) {
        displayEmail = user.email.address;
      } else if (user.linkedAccounts) {
        const emailAccount = user.linkedAccounts.find(acc => acc.type === "email");
        if (emailAccount) {
          displayEmail = emailAccount.address || emailAccount.emailAddress;
        }
      }
    }
    if (!displayEmail) {
      displayEmail = "privy-user";
    }

    // Send login result to background script
    chrome.runtime.sendMessage({
      action: "privy_login",
      privyUserId: user.id,
      email: displayEmail,
      walletAddress: solanaWalletAddress,
      token: token
    }, (response) => {
      if (response && response.success) {
        showMessage("Login synced! Closing tab...", false);
        // Close this auth tab and refresh dashboard
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        const errMsg = response ? response.error : "No response from extension background worker.";
        showMessage("Sync failed: " + errMsg, true);
        btnVerifyCode.disabled = false;
        btnVerifyCode.textContent = "Verify & Sign In";
      }
    });
  }
});
