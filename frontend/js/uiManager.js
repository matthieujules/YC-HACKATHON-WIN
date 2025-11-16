class UIManager {
  constructor() {
    this.verbalConfirmed = false;
    this.handshakeConfirmed = false;
  }

  updateGeminiMessage(message) {
    const el = document.getElementById('geminiMessage');
    if (el) {
      // Create a new message element
      const msgEl = document.createElement('div');
      msgEl.className = 'gemini-thought';
      msgEl.textContent = message;

      // Append to message container
      el.appendChild(msgEl);

      // Auto-scroll to bottom
      el.scrollTop = el.scrollHeight;

      // Keep only last 50 messages to prevent memory issues
      while (el.children.length > 50) {
        el.removeChild(el.firstChild);
      }
    }
  }

  updateGeminiState(state) {
    const el = document.getElementById('geminiState');
    if (el) {
      el.textContent = state;
      el.className = 'state-badge ' + state.toLowerCase();
    }
  }

  updateStatusObservations(data) {
    // Display real-time observations from Gemini's updateStatus() calls
    const el = document.getElementById('geminiMessage');
    if (!el) return;

    // Format the status update nicely
    const statusMsg = document.createElement('div');
    statusMsg.className = 'gemini-thought status-update';
    statusMsg.innerHTML = `
      <div style="opacity: 0.7; font-size: 0.85em; margin-bottom: 4px;">
        👁️ <strong>Visual:</strong> ${data.visual || 'N/A'}
      </div>
      ${data.audio ? `<div style="opacity: 0.7; font-size: 0.85em; margin-bottom: 4px;">
        🎤 <strong>Audio:</strong> ${data.audio}
      </div>` : ''}
      ${data.person ? `<div style="opacity: 0.7; font-size: 0.85em;">
        👤 <strong>Person:</strong> ${data.person}
      </div>` : ''}
    `;

    // Append
    el.appendChild(statusMsg);

    // Auto-scroll
    el.scrollTop = el.scrollHeight;

    // Keep only last 20 messages
    while (el.children.length > 20) {
      el.removeChild(el.firstChild);
    }
  }

  updateVerbalConfirmation(data) {
    this.verbalConfirmed = data.agreed;

    const overlay = document.getElementById('verbalConfirmationOverlay');
    const text = document.getElementById('verbalOverlayText');

    if (!overlay) return;

    if (data.agreed) {
      // Show overlay with details
      text.textContent = `$${data.amount} - "${data.quote}"`;
      overlay.style.display = 'block';
      console.log('✅ VERBAL CONFIRMED - Overlay shown');
    } else {
      // Hide overlay
      overlay.style.display = 'none';
    }

    this.checkBothConfirmed();
  }

  updateHandshakeConfirmation(data) {
    this.handshakeConfirmed = data.active;

    const overlay = document.getElementById('handshakeConfirmationOverlay');
    const text = document.getElementById('handshakeOverlayText');

    if (!overlay) return;

    if (data.active) {
      // Show overlay with details
      text.textContent = data.description || 'Handshake confirmed!';
      overlay.style.display = 'block';
      console.log('✅ HANDSHAKE CONFIRMED - Overlay shown');
    } else {
      // Hide overlay
      overlay.style.display = 'none';
    }

    this.checkBothConfirmed();
  }

  checkBothConfirmed() {
    const successPanel = document.getElementById('successPanel');

    if (this.verbalConfirmed && this.handshakeConfirmed) {
      console.log('🎉 BOTH CONFIRMATIONS MET!');
      if (successPanel) {
        successPanel.style.display = 'block';
        successPanel.scrollIntoView({ behavior: 'smooth' });
      }
      this.updateStatus('🎉 Both confirmations met!');
    } else {
      if (successPanel) {
        successPanel.style.display = 'none';
      }
    }
  }

  showPersonInfo(data) {
    // Show in old panel (if exists)
    const panel = document.getElementById('personInfo');
    if (panel) {
      document.getElementById('detectedPersonName').textContent = data.name;
      document.getElementById('detectedPersonWallet').textContent = data.wallet;
      panel.style.display = 'block';
    }

    // Show in video overlay with enrolled photo
    this.showPersonOverlay(data.name, data.wallet, data.enrolledPhoto);

    console.log('👤 Person detected: ' + data.name);
  }

  showPersonOverlay(name, wallet, enrolledPhoto) {
    const overlay = document.getElementById('personOverlay');
    const nameEl = document.getElementById('overlayPersonName');
    const walletEl = document.getElementById('overlayPersonWallet');

    if (!overlay) return;

    nameEl.textContent = name;
    walletEl.textContent = wallet;

    // Show enrolled photo if available
    let photoHtml = enrolledPhoto ?
      `<img src="${enrolledPhoto}" class="enrolled-photo" alt="${name}'s enrolled photo" style="max-width: 80px; max-height: 80px; border-radius: 8px; margin-top: 8px; border: 2px solid #4CAF50;">` :
      '';

    // Add photo to overlay if not already there
    const existingPhoto = overlay.querySelector('.enrolled-photo');
    if (existingPhoto) {
      existingPhoto.remove();
    }
    if (enrolledPhoto) {
      const photoDiv = document.createElement('div');
      photoDiv.innerHTML = photoHtml;
      overlay.appendChild(photoDiv.firstChild);
    }

    overlay.style.display = 'block';
  }

  hidePersonOverlay() {
    const overlay = document.getElementById('personOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  hidePersonInfo() {
    const panel = document.getElementById('personInfo');
    if (panel) {
      panel.style.display = 'none';
    }
    this.hidePersonOverlay();
  }

  updateStatus(message) {
    const el = document.getElementById('status');
    if (el) {
      el.textContent = message;
    }
  }

  updateStreamStatus(streaming) {
    const el = document.getElementById('streamStatus');
    if (!el) return;

    if (streaming) {
      el.innerHTML = '<span class="status-dot online"></span><span class="status-text">Streaming</span>';
    } else {
      el.innerHTML = '<span class="status-dot offline"></span><span class="status-text">Offline</span>';
    }
  }

  clearGeminiMessages() {
    const el = document.getElementById('geminiMessage');
    if (el) {
      el.innerHTML = '';
    }
  }

  resetConfirmations() {
    this.verbalConfirmed = false;
    this.handshakeConfirmed = false;

    // Hide overlays
    const verbalOverlay = document.getElementById('verbalConfirmationOverlay');
    const handshakeOverlay = document.getElementById('handshakeConfirmationOverlay');

    if (verbalOverlay) {
      verbalOverlay.style.display = 'none';
    }

    if (handshakeOverlay) {
      handshakeOverlay.style.display = 'none';
    }

    const successPanel = document.getElementById('successPanel');
    if (successPanel) {
      successPanel.style.display = 'none';
    }

    this.hidePersonInfo();
    this.hidePersonOverlay();
  }

  showTransactionSuccess(result) {
    // Update success panel with transaction details
    const successPanel = document.getElementById('successPanel');
    if (!successPanel) return;

    // Add transaction details to success panel
    const existingDetails = successPanel.querySelector('.transaction-details');
    if (existingDetails) {
      existingDetails.remove();
    }

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'transaction-details';
    detailsDiv.style.cssText = 'margin-top: 16px; padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; font-size: 0.9em;';
    detailsDiv.innerHTML = `
      <div style="margin-bottom: 8px;"><strong>💰 Amount:</strong> ${result.transaction.amount} USDC</div>
      <div style="margin-bottom: 8px;"><strong>👤 Recipient:</strong> ${result.transaction.recipient}</div>
      <div style="margin-bottom: 8px;"><strong>💳 Wallet:</strong> ${result.transaction.wallet.substring(0, 10)}...${result.transaction.wallet.slice(-8)}</div>
      <div style="margin-bottom: 8px;"><strong>🔗 Method:</strong> ${result.paymentMethod === 'locus' ? 'Locus MCP (USDC on Base)' : result.paymentMethod.toUpperCase()}</div>
      <div style="margin-bottom: 8px;"><strong>🆔 Transaction ID:</strong> ${result.transaction.id}</div>
      <div style="margin-bottom: 8px;"><strong>📅 Status:</strong> ${result.transaction.status}</div>
    `;

    successPanel.appendChild(detailsDiv);
    successPanel.style.display = 'block';
    // Removed scrollIntoView to keep focus on video screen

    // Show payment confirmation popup
    this.showPaymentPopup(result);
  }

  showPaymentPopup(result) {
    const overlay = document.getElementById('paymentSuccessOverlay');
    if (!overlay) return;

    // Populate overlay with transaction details
    document.getElementById('overlayAmount').textContent = `$${result.transaction.amount} USDC`;
    document.getElementById('overlayRecipient').textContent = result.transaction.recipient;
    document.getElementById('overlayStatus').textContent = result.transaction.status.charAt(0).toUpperCase() + result.transaction.status.slice(1);

    // Show overlay on video
    overlay.style.display = 'block';

    // Play success sound (optional - browser may require user interaction first)
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzaM0fPTgjMGHm7A7+OZUQ0PU6Po8bJiHAY+ldv0xnEoBSuByO7cjTsKGmO58OScTxELTqPm771fGgU2jdXyzHwrBS1+xvHaj0EMFWO79OihUhMNTqPn8bVgGgY8k9r1xW4qBS+Dyu3bjzkMGWa+7+OaTQ4PWKXo8rhkGwc9lNn0xm8rBjCFy+7djz0LG2vA8OScTw0OUaro8bNfGQQ7k9jyyXkrBTCFyu3bkD0LGmq/8OWdTw0PU6Xo77NkGgQ8lNnzw3AqBDGEyuzckTwKGWq/8OSdUA0PU6Pn77FjGwQ6k9r0wm8qBTGEyu/clD0MGWm98OOdUA0PU6Tn77FlGwQ7k9r0wW8qBDCEyu/clD4MGGu/7+SdUQ0MVajm8LBiGgU6lNj0wXEpBC+Dye7alD4MGGi88OSdTw4MU6Xm77FjHAU5lNjywXEpBS+EyvDal0UNGGW87uGdUA4MU6Xm8LFiHAQ6lNj0wnAqBDCEyO7alD4MGWm98OOdUQ0NVajm8LBiGgU7k9r0w3ArBC+Dye7cl0cNFma77uGdUQ0NVKXm8LFjHAU8ldjyw3ErBS+Dye3bl0cOF2u+7eGdUA4NVKXl8LJiGgU8lNn0wnArBS+Dye7cl0cOFmm97uCdUA4NVKXl8LJiGgY8lNn0wm8rBTCEyO7dlEUOFmm+7eGdUQ0NVKXl8LNiGwY8lNnzwnApBi+Dye/clEQPGGu+7uOdUA4MU6bl8LNjGwU8lNn0wXAqBDCEyO7dlUUOFmm/7uOdUA0MUqfm77NiHAU6k9r0wXEoBDCDye/dlEQOGGm+7uKdUA0MVKXm77NjGgU7lNjzwXEqBTCEyO3dlUUOFmm/7uOdUA0MUqfm8LJiGwU8lNn0wnAqBTCEyO7dlEUOFmm/7uOdUA4NU6Xo8LNiGwU8lNjzwnAqBTCEyO/dl0UOGGW+7+OdUA4MU6Xm77NjGgU8lNr0wnArBTCEye7dl0YOF2m/7uOdUA0NU6Xm8LNjGwU8lNnzwnArBTCEyO7dlUUOF2m/7uOdUA4MU6Xn8LNjGgU8lNnzwnEqBTCEye7dl0YOGGa+7+KdUA0NU6Xm8LNjGwU7lNnzwnArBTCEyO7clUUOGGm/7+OdUA0NVKXm8LNiGgU8lNr0wnArBTCEyO7clkYOF2m+7+KdUA0NU6Xn8LNjGgU7lNnzw3AqBi+EyO7dlUUOF2m/7+OdUA4NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOF2m+7+OdUA0MU6Xn8LNjGwU8lNnzwnArBTCEyO7clkYOF2m/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7dlkYOGGm/7+OdUA0NVKXm8LJjGgU8lNr0wnArBTCEyO7d');
      audio.volume = 0.3;
      audio.play().catch(() => {/* Ignore if autoplay blocked */});
    } catch (e) {
      // Ignore audio errors
    }
  }

  hidePaymentPopup() {
    const overlay = document.getElementById('paymentSuccessOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}

const uiManager = new UIManager();
