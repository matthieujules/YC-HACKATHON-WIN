class UIManager {
  constructor() {
    this.verbalConfirmed = false;
    this.handshakeConfirmed = false;
  }

  updateGeminiMessage(message) {
    const el = document.getElementById('geminiMessage');
    if (el) {
      el.textContent = message;
    }
  }

  updateGeminiState(state) {
    const el = document.getElementById('geminiState');
    if (el) {
      el.textContent = state;
      el.className = 'state-badge ' + state.toLowerCase();
    }
  }

  updateVerbalConfirmation(data) {
    const item = document.getElementById('verbalConfirmation');
    const icon = item?.querySelector('.confirmation-icon');
    const text = document.getElementById('verbalText');

    if (!item) return;

    this.verbalConfirmed = data.agreed;

    if (data.agreed) {
      icon.textContent = '✅';
      item.classList.add('confirmed');
      text.textContent = 'Agreement detected: $' + data.amount + ' - "' + data.quote + '"';
      console.log('✅ VERBAL CONFIRMED');
    } else {
      icon.textContent = '❌';
      item.classList.remove('confirmed');
      text.textContent = 'Waiting to hear agreement...';
    }

    this.checkBothConfirmed();
  }

  updateHandshakeConfirmation(data) {
    const item = document.getElementById('handshakeConfirmation');
    const icon = item?.querySelector('.confirmation-icon');
    const text = document.getElementById('handshakeText');

    if (!item) return;

    this.handshakeConfirmed = data.active;

    if (data.active) {
      icon.textContent = '✅';
      item.classList.add('confirmed');
      text.textContent = 'Handshake detected! ' + data.description;
      console.log('✅ HANDSHAKE CONFIRMED');
    } else {
      icon.textContent = '❌';
      item.classList.remove('confirmed');
      text.textContent = 'Waiting for handshake...';
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

    // Show in video overlay
    this.showPersonOverlay(data.name, data.wallet);

    console.log('👤 Person detected: ' + data.name);
  }

  showPersonOverlay(name, wallet) {
    const overlay = document.getElementById('personOverlay');
    const nameEl = document.getElementById('overlayPersonName');
    const walletEl = document.getElementById('overlayPersonWallet');

    if (!overlay) return;

    nameEl.textContent = name;
    walletEl.textContent = wallet;
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

  resetConfirmations() {
    this.verbalConfirmed = false;
    this.handshakeConfirmed = false;

    const verbalItem = document.getElementById('verbalConfirmation');
    const handshakeItem = document.getElementById('handshakeConfirmation');

    if (verbalItem) {
      verbalItem.classList.remove('confirmed');
      verbalItem.querySelector('.confirmation-icon').textContent = '❌';
    }

    if (handshakeItem) {
      handshakeItem.classList.remove('confirmed');
      handshakeItem.querySelector('.confirmation-icon').textContent = '❌';
    }

    document.getElementById('verbalText').textContent = 'Waiting to hear agreement...';
    document.getElementById('handshakeText').textContent = 'Waiting for handshake...';

    const successPanel = document.getElementById('successPanel');
    if (successPanel) {
      successPanel.style.display = 'none';
    }

    this.hidePersonInfo();
    this.hidePersonOverlay();
  }
}

const uiManager = new UIManager();
