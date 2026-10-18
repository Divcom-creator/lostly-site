'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Année du pied de page.
$('#year').textContent = new Date().getFullYear();

// Menu mobile.
const menuToggle = $('#menu-toggle');
const mainNav = $('#main-nav');
menuToggle?.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
});
$$('#main-nav a').forEach(link => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}));

// Diaporama de la grande bannière.
const heroSlides = $$('.hero-slide');
const heroDots = $$('[data-go-slide]');
let currentSlide = 0;
let slideTimer = null;
function showSlide(index) {
  if (!heroSlides.length) return;
  currentSlide = (index + heroSlides.length) % heroSlides.length;
  heroSlides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentSlide));
  heroDots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentSlide);
    dot.setAttribute('aria-pressed', String(i === currentSlide));
  });
}
function restartSlideTimer() {
  window.clearInterval(slideTimer);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slideTimer = window.setInterval(() => showSlide(currentSlide + 1), 6500);
  }
}
$('#hero-prev')?.addEventListener('click', () => { showSlide(currentSlide - 1); restartSlideTimer(); });
$('#hero-next')?.addEventListener('click', () => { showSlide(currentSlide + 1); restartSlideTimer(); });
heroDots.forEach(dot => dot.addEventListener('click', () => { showSlide(Number(dot.dataset.goSlide)); restartSlideTimer(); }));
showSlide(0);
restartSlideTimer();

// Images qui changent dans les cartes (chaque carte possède sa propre liste).
$$('.image-rotator').forEach(rotator => {
  const image = $('img', rotator);
  const imageList = (rotator.dataset.images || '').split('|').filter(Boolean);
  let index = 0;
  if (!image || imageList.length < 2) return;
  function nextImage() {
    index = (index + 1) % imageList.length;
    image.style.opacity = '0.25';
    const next = new Image();
    next.onload = () => {
      image.src = imageList[index];
      image.style.opacity = '1';
    };
    next.onerror = () => { image.style.opacity = '1'; };
    next.src = imageList[index];
  }
  $('.image-next', rotator)?.addEventListener('click', nextImage);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setInterval(nextImage, 7000 + Math.random() * 1800);
  }
});

// Fenêtre de détails réutilisable.
const detailsDialog = $('#details-dialog');
function openDetails(title, description) {
  $('#dialog-title').textContent = title || 'Découvrir';
  $('#dialog-description').textContent = description || 'Cette rubrique sera bientôt enrichie sur Lostly.';
  if (typeof detailsDialog.showModal === 'function') detailsDialog.showModal();
  else window.alert(`${title || 'Découvrir'}\n\n${description || 'Cette rubrique sera bientôt enrichie.'}`);
}
$$('[data-action="details"]').forEach(button => button.addEventListener('click', () => {
  openDetails(button.dataset.title, button.dataset.description);
}));
$('#dialog-close')?.addEventListener('click', () => detailsDialog.close());
$('#dialog-ok')?.addEventListener('click', () => detailsDialog.close());
detailsDialog?.addEventListener('click', event => {
  if (event.target === detailsDialog) detailsDialog.close();
});

// Recherche locale dans les catégories et les cartes.
const searchForm = $('#recherche');
const searchInput = $('#search-input');
const searchStatus = $('#search-status');
const searchableItems = $$('.searchable');
function runSearch(query) {
  const term = query.trim().toLocaleLowerCase('fr');
  let matches = 0;
  searchableItems.forEach(item => {
    const haystack = `${item.textContent} ${item.dataset.search || ''}`.toLocaleLowerCase('fr');
    const matched = !term || haystack.includes(term);
    item.classList.toggle('search-hidden', !matched);
    item.classList.toggle('search-match', Boolean(term && matched));
    if (matched && term) matches++;
  });
  if (searchStatus) {
    searchStatus.textContent = !term ? '' : matches
      ? `${matches} résultat(s) trouvé(s) pour « ${query.trim()} ».`
      : `Aucun résultat pour « ${query.trim()} ». Essaie « musique », « jeux » ou « films ».`;
  }
  if (term && matches) {
    const firstMatch = searchableItems.find(item => !item.classList.contains('search-hidden'));
    firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
searchForm?.addEventListener('submit', event => {
  event.preventDefault();
  runSearch(searchInput.value);
});
searchInput?.addEventListener('search', () => runSearch(searchInput.value));
searchInput?.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    runSearch('');
  }
});

// Notification discrète.
const toast = $('#toast');
let toastTimer;
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3500);
}

// Inscription de démonstration : aucune adresse n'est envoyée ou enregistrée.
$('#newsletter-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const emailInput = $('#newsletter-email');
  if (!emailInput.checkValidity()) { emailInput.reportValidity(); return; }
  $('#newsletter-status').textContent = 'Merci ! Le formulaire est en démo : aucune adresse n’a été envoyée.';
  showToast('Merci pour ton intérêt pour Lostly !');
  event.currentTarget.reset();
});

// Musique d'ambiance synthétique générée par le navigateur avec Web Audio API.
// Pas de fichier audio externe, mais la lecture commence seulement après un clic utilisateur.
let audioContext = null;
let masterGain = null;
let ambienceNodes = [];
let musicIsPlaying = false;
let isMuted = false;
const playButton = $('#music-play');
const musicStatus = $('#music-status');
const volumeSlider = $('#music-volume');
const muteButton = $('#music-mute');
const heroMusicButton = $('#hero-music-button');
function stopAmbience() {
  ambienceNodes.forEach(node => {
    try { node.stop?.(); } catch { /* Un oscillateur déjà arrêté peut lever une erreur. */ }
    try { node.disconnect?.(); } catch { /* Déjà déconnecté. */ }
  });
  ambienceNodes = [];
  musicIsPlaying = false;
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Lancer la musique');
  musicStatus.textContent = 'Ambiance synthétique • en pause';
}
async function startAmbience() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    showToast('La musique synthétique n’est pas prise en charge par ce navigateur.');
    return;
  }
  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Number(volumeSlider.value) / 100;
      masterGain.connect(audioContext.destination);

      // Accord doux et continu de type synthwave / science-fiction.
      const notes = [55, 82.41, 110, 164.81, 220];
      notes.forEach((frequency, i) => {
        const oscillator = audioContext.createOscillator();
        const voiceGain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        oscillator.type = i % 2 ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = (i - 2) * 4;
        filter.type = 'lowpass';
        filter.frequency.value = i < 2 ? 240 : 700;
        voiceGain.gain.value = i === 0 ? 0.18 : 0.055;
        oscillator.connect(filter);
        filter.connect(voiceGain);
        voiceGain.connect(masterGain);
        oscillator.start();
        ambienceNodes.push(oscillator, filter, voiceGain);
      });
      // Pulsation lente pour créer un mouvement sonore discret.
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      lfo.start();
      ambienceNodes.push(lfo, lfoGain);
    }
    await audioContext.resume();
    masterGain.gain.setTargetAtTime(isMuted ? 0 : Number(volumeSlider.value) / 100, audioContext.currentTime, 0.25);
    musicIsPlaying = true;
    playButton.textContent = 'Ⅱ';
    playButton.setAttribute('aria-label', 'Mettre la musique en pause');
    musicStatus.textContent = 'Ambiance synthétique • en lecture';
    heroMusicButton.innerHTML = '<span aria-hidden="true">Ⅱ</span> Mettre en pause';
  } catch (error) {
    console.error('Impossible de lancer la musique :', error);
    showToast('Impossible de démarrer la musique. Essaie à nouveau.');
  }
}
function toggleMusic() {
  if (musicIsPlaying) {
    if (audioContext) audioContext.suspend();
    musicIsPlaying = false;
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Lancer la musique');
    musicStatus.textContent = 'Ambiance synthétique • en pause';
    heroMusicButton.innerHTML = '<span aria-hidden="true">♫</span> Lancer l’ambiance';
  } else {
    startAmbience();
  }
}
playButton?.addEventListener('click', toggleMusic);
heroMusicButton?.addEventListener('click', toggleMusic);
volumeSlider?.addEventListener('input', () => {
  if (masterGain && audioContext) masterGain.gain.setTargetAtTime(isMuted ? 0 : Number(volumeSlider.value) / 100, audioContext.currentTime, 0.08);
});
muteButton?.addEventListener('click', () => {
  isMuted = !isMuted;
  muteButton.textContent = isMuted ? '×' : '♫';
  muteButton.setAttribute('aria-label', isMuted ? 'Rétablir le son' : 'Couper le son');
  if (masterGain && audioContext) masterGain.gain.setTargetAtTime(isMuted ? 0 : Number(volumeSlider.value) / 100, audioContext.currentTime, 0.08);
});

// Si l'utilisateur choisit de réduire les animations, les changements automatiques s'arrêtent.
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.clearInterval(slideTimer);
}

/* Connexion de test au backend Lostly */
async function testLostlyAPI() {
  try {
    const response = await fetch(
      'https://lostly-api.lostly-divcom.workers.dev/api/status'
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP : ${response.status}`);
    }

    const data = await response.json();
    console.log('Connexion au backend Lostly réussie :', data);
  } catch (error) {
    console.error('Connexion au backend Lostly impossible :', error);
  }
}

testLostlyAPI();
