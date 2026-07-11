const urlInput = document.getElementById('url');
const videoBtn = document.getElementById('videoBtn');
const audioBtn = document.getElementById('audioBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const result = document.getElementById('result');
const errorBox = document.getElementById('error');

let type = 'video';
let photos = [];
let video = '';
let audio = '';
let currentPhoto = 0;

videoBtn.addEventListener('click', () => {
    dlDirect('video');
});

audioBtn.addEventListener('click', () => {
    dlDirect('audio');
});

urlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        dlDirect('video');
    }
});

document.addEventListener('keydown', (event) => {
    if (type !== 'photo') return;
    if (event.key === 'ArrowLeft') changePhoto(-1);
    if (event.key === 'ArrowRight') changePhoto(1);
});

urlInput.focus();

function setLoading(isLoading, text = 'Sedang memproses...') {
    loading.classList.toggle('hidden', !isLoading);
    loadingText.textContent = text;
    videoBtn.disabled = isLoading;
    audioBtn.disabled = isLoading;
}

function resetMessages() {
    result.classList.add('hidden');
    result.innerHTML = '';
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
}

function showError(message) {
    errorBox.textContent = `❌ ${message}`;
    errorBox.classList.remove('hidden');
}

async function dlDirect(mode) {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Masukkan link TikTok dulu.');
        return;
    }

    resetMessages();
    setLoading(true, mode === 'video' ? 'Mengambil link video...' : 'Mengambil link audio MP3...');

    try {
        const response = await fetchTikTokData(url);

        if (response.code !== 0 || !response.data) {
            throw new Error('Link tidak valid atau data tidak ditemukan.');
        }

        type = response.data.images?.length > 0 ? 'photo' : 'video';

        if (type === 'video') {
            video = response.data.hdplay || response.data.play || '';
            audio = response.data.music || '';

            if (mode === 'video') {
                if (!video) throw new Error('Link video tidak ditemukan.');
                await triggerDownload(video, makeFilename('video', 'mp4'));
            } else {
                if (!audio) throw new Error('Link audio tidak ditemukan.');
                await triggerDownload(audio, makeFilename('audio', 'mp3'));
            }

            showVideoResult();
            return;
        }

        photos = (response.data.images || []).map((item) => item.display || item).filter(Boolean);

        if (mode === 'audio') {
            throw new Error('Post ini berupa foto, tidak punya file MP3.');
        }

        if (!photos.length) {
            throw new Error('Foto tidak ditemukan.');
        }

        await triggerDownload(photos[0], makeFilename('photo-1', 'jpg'));
        showPhotoResult();
    } catch (error) {
        showError(error.message || 'Gagal memproses link.');
    } finally {
        setLoading(false);
    }
}

async function fetchTikTokData(url) {
    const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error('Gagal menghubungi server download.');
    }
    return response.json();
}

function makeFilename(kind, extension) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `tiktok-${kind}-${stamp}.${extension}`;
}

async function triggerDownload(fileUrl, filename) {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Fetch download gagal.');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        createDownloadLink(blobUrl, filename, false);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (_) {
        createDownloadLink(fileUrl, filename, true);
    }
}

function createDownloadLink(url, filename, openNewTab) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    if (openNewTab) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function showVideoResult() {
    result.innerHTML = `
        <div class="type-badge video-type">Download siap dan sudah dipicu otomatis</div>
        <video class="video-player" controls src="${video}" preload="metadata"></video>
        <div class="dl-grid">
            <button class="dl-btn dl-direct-video" type="button" id="repeatVideoBtn">
                <i class="fa-solid fa-video"></i> Download Video Lagi
            </button>
            <button class="dl-btn dl-direct-audio" type="button" id="repeatAudioBtn">
                <i class="fa-solid fa-music"></i> Download MP3 Lagi
            </button>
        </div>
    `;

    result.classList.remove('hidden');

    document.getElementById('repeatVideoBtn').addEventListener('click', () => {
        triggerDownload(video, makeFilename('video', 'mp4'));
    });

    document.getElementById('repeatAudioBtn').addEventListener('click', () => {
        triggerDownload(audio, makeFilename('audio', 'mp3'));
    });
}

function showPhotoResult() {
    currentPhoto = 0;
    result.innerHTML = `
        <div class="type-badge photo-type">Post foto terdeteksi</div>
        <div class="photo-carousel">
            ${photos.map((photo, index) => `
                <div class="photo-slide ${index === 0 ? 'active' : ''}">
                    <img src="${photo}" alt="Photo ${index + 1}">
                </div>
            `).join('')}
            <button class="nav-btn prev" type="button" id="prevBtn">‹</button>
            <button class="nav-btn next" type="button" id="nextBtn">›</button>
        </div>
        <div class="indicators" id="indicators"></div>
        <div class="dl-grid">
            <button class="dl-btn dl-photo" type="button" id="currentPhotoBtn">
                <i class="fa-solid fa-image"></i> Download Foto 1
            </button>
            <button class="dl-btn dl-all" type="button" id="allPhotoBtn">
                <i class="fa-solid fa-box-archive"></i> Download Semua Foto
            </button>
        </div>
    `;

    result.classList.remove('hidden');
    renderIndicators();

    document.getElementById('prevBtn').addEventListener('click', () => changePhoto(-1));
    document.getElementById('nextBtn').addEventListener('click', () => changePhoto(1));
    document.getElementById('currentPhotoBtn').addEventListener('click', () => {
        triggerDownload(photos[currentPhoto], makeFilename(`photo-${currentPhoto + 1}`, 'jpg'));
    });
    document.getElementById('allPhotoBtn').addEventListener('click', downloadAllPhotos);
}

function renderIndicators() {
    const indicators = document.getElementById('indicators');
    indicators.innerHTML = photos.map((_, index) => `
        <button class="indicator ${index === currentPhoto ? 'active' : ''}" type="button" data-index="${index}" aria-label="Foto ${index + 1}"></button>
    `).join('');

    indicators.querySelectorAll('.indicator').forEach((indicator) => {
        indicator.addEventListener('click', () => {
            const index = Number(indicator.dataset.index);
            goToPhoto(index);
        });
    });
}

function changePhoto(step) {
    currentPhoto = (currentPhoto + step + photos.length) % photos.length;
    updatePhotoUI();
}

function goToPhoto(index) {
    currentPhoto = index;
    updatePhotoUI();
}

function updatePhotoUI() {
    document.querySelectorAll('.photo-slide').forEach((slide, index) => {
        slide.classList.toggle('active', index === currentPhoto);
    });

    document.querySelectorAll('.indicator').forEach((indicator, index) => {
        indicator.classList.toggle('active', index === currentPhoto);
    });

    const currentPhotoBtn = document.getElementById('currentPhotoBtn');
    if (currentPhotoBtn) {
        currentPhotoBtn.innerHTML = `<i class="fa-solid fa-image"></i> Download Foto ${currentPhoto + 1}`;
    }
}

function downloadAllPhotos() {
    photos.forEach((photo, index) => {
        setTimeout(() => {
            triggerDownload(photo, makeFilename(`photo-${index + 1}`, 'jpg'));
        }, index * 350);
    });
}
