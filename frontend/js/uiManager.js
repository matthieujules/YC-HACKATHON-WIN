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
}

const uiManager = new UIManager();
