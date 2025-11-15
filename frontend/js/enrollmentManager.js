class EnrollmentManager {
  constructor() {
    this.enrolledPeople = [];
    this.enrollStream = null;
    this.enrollVideo = null;
    this.enrollCanvas = null;
    this.capturedPhotos = [];
  }

  async initialize() {
    this.enrollVideo = document.getElementById('enrollVideo');
    this.enrollCanvas = document.getElementById('enrollCanvas');

    const startCameraBtn = document.getElementById('startEnrollCamera');
    const captureBtn = document.getElementById('capturePhoto');
    const saveBtn = document.getElementById('saveEnrollment');
    const resetBtn = document.getElementById('resetEnrollment');

    startCameraBtn?.addEventListener('click', () => this.startEnrollCamera());
    captureBtn?.addEventListener('click', () => this.capturePhoto());
    saveBtn?.addEventListener('click', () => this.saveEnrollment());
    resetBtn?.addEventListener('click', () => this.resetEnrollment());
  }

  async startEnrollCamera() {
    try {
      this.enrollStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      this.enrollVideo.srcObject = this.enrollStream;

      document.getElementById('startEnrollCamera').disabled = true;
      document.getElementById('capturePhoto').disabled = false;

      console.log('Enrollment camera started');
    } catch (error) {
      console.error('Error starting enrollment camera:', error);
      alert('Could not access camera');
    }
  }

  capturePhoto() {
    if (!this.enrollStream || this.capturedPhotos.length >= 5) return;

    this.enrollCanvas.width = this.enrollVideo.videoWidth;
    this.enrollCanvas.height = this.enrollVideo.videoHeight;

    const ctx = this.enrollCanvas.getContext('2d');
    ctx.drawImage(this.enrollVideo, 0, 0);

    const photoData = this.enrollCanvas.toDataURL('image/jpeg', 0.9);
    this.capturedPhotos.push(photoData);

    this.updatePhotoPreview();

    document.getElementById('photoCount').textContent = this.capturedPhotos.length + '/5';

    if (this.capturedPhotos.length >= 3) {
      document.getElementById('saveEnrollment').disabled = false;
    }

    if (this.capturedPhotos.length >= 5) {
      document.getElementById('capturePhoto').disabled = true;
    }

    console.log('Captured photo ' + this.capturedPhotos.length + '/5');
  }

  updatePhotoPreview() {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = this.capturedPhotos.map((photo, i) =>
      '<div class="photo-thumbnail-container">' +
        '<img src="' + photo + '" class="photo-thumbnail" alt="Photo ' + (i + 1) + '">' +
        '<button class="photo-delete" onclick="enrollmentManager.deletePhoto(' + i + ')">×</button>' +
      '</div>'
    ).join('');
  }

  deletePhoto(index) {
    this.capturedPhotos.splice(index, 1);
    this.updatePhotoPreview();

    document.getElementById('photoCount').textContent = this.capturedPhotos.length + '/5';
    document.getElementById('capturePhoto').disabled = false;

    if (this.capturedPhotos.length < 3) {
      document.getElementById('saveEnrollment').disabled = true;
    }
  }

  async saveEnrollment() {
    const name = document.getElementById('personName')?.value.trim();
    const wallet = document.getElementById('walletAddress')?.value.trim();

    if (!name || !wallet) {
      alert('Name and wallet address are required');
      return;
    }

    if (this.capturedPhotos.length < 3) {
      alert('Please capture at least 3 photos');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      alert('Invalid wallet address format');
      return;
    }

    try {
      const response = await fetch(CONFIG.BACKEND_URL + '/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          wallet_address: wallet,
          photos: this.capturedPhotos
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ ' + name + ' enrolled successfully!');
        await this.loadEnrolledPeople();
        this.resetEnrollment();
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error enrolling person:', error);
      alert('Failed to enroll person. Check if backend is running.');
    }
  }

  resetEnrollment() {
    this.capturedPhotos = [];
    this.updatePhotoPreview();

    document.getElementById('personName').value = '';
    document.getElementById('walletAddress').value = '';
    document.getElementById('photoCount').textContent = '0/5';
    document.getElementById('saveEnrollment').disabled = true;
    document.getElementById('capturePhoto').disabled = true;
    document.getElementById('startEnrollCamera').disabled = false;

    if (this.enrollStream) {
      this.enrollStream.getTracks().forEach(track => track.stop());
      this.enrollStream = null;
      this.enrollVideo.srcObject = null;
    }
  }

  async loadEnrolledPeople() {
    try {
      const response = await fetch(CONFIG.BACKEND_URL + '/api/enroll/list');
      const data = await response.json();

      if (data.success) {
        this.enrolledPeople = data.people;
        this.renderEnrolledList();
      }
    } catch (error) {
      console.error('Error loading enrolled people:', error);
    }
  }

  async deletePerson(id, name) {
    if (!confirm('Delete ' + name + '?')) {
      return;
    }

    try {
      const response = await fetch(CONFIG.BACKEND_URL + '/api/enroll/' + id, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Deleted ' + name);
        await this.loadEnrolledPeople();
      }
    } catch (error) {
      console.error('Error deleting person:', error);
      alert('Failed to delete person');
    }
  }

  renderEnrolledList() {
    const listElement = document.getElementById('enrolledList');
    if (!listElement) return;

    if (this.enrolledPeople.length === 0) {
      listElement.innerHTML = '<p class="placeholder">No people enrolled yet</p>';
      return;
    }

    listElement.innerHTML = this.enrolledPeople.map(person =>
      '<div class="person-card">' +
        '<div class="person-info">' +
          '<h4>' + person.name + '</h4>' +
          '<p class="mono small">' + person.wallet + '</p>' +
          '<p class="meta">' + (person.photoCount || person.photos?.length || 0) + ' photos</p>' +
        '</div>' +
        '<button class="btn-delete" onclick="enrollmentManager.deletePerson(\'' + person.id + '\', \'' + person.name + '\')">' +
          '🗑️ Delete' +
        '</button>' +
      '</div>'
    ).join('');
  }
}

const enrollmentManager = new EnrollmentManager();
