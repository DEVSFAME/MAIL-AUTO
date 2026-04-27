/* ═══════════════════════════════════════════════════════════════════════════════
   MailCandid — Frontend Logic
   ═══════════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── URL du backend (définie dans config.js, pointe vers ngrok ou localhost) ──
// Supprime le slash final s'il y en a un, pour éviter les doubles slashes
const API = (window.API_BASE_URL || '').replace(/\/$/, '');

// En-têtes communs pour toutes les requêtes fetch (ngrok nécessite ce header)
const FETCH_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
};

// ─── State ────────────────────────────────────────────────────────────────────
let allContacts = [];
let currentFilter = 'all';
let currentContactId = null;
let isEditing = false;

// ─── DOM References ───────────────────────────────────────────────────────────
const uploadSection   = document.getElementById('uploadSection');
const contactsSection = document.getElementById('contactsSection');
const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const browseBtn       = document.getElementById('browseBtn');
const uploadProgress  = document.getElementById('uploadProgress');
const contactsGrid    = document.getElementById('contactsGrid');
const emptyState      = document.getElementById('emptyState');
const searchInput     = document.getElementById('searchInput');
const resetBtn        = document.getElementById('resetBtn');
const sendAllBtn      = document.getElementById('sendAllBtn');
const filterTabs      = document.querySelectorAll('.filter-tab');
const headerStats     = document.getElementById('headerStats');

// Modal elements
const modalOverlay    = document.getElementById('modalOverlay');
const mailSubject     = document.getElementById('mailSubject');
const mailBody        = document.getElementById('mailBody');
const modalAvatar     = document.getElementById('modalAvatar');
const modalContactName = document.getElementById('modalContactName');
const modalStructure  = document.getElementById('modalStructure');
const modalLocation   = document.getElementById('modalLocation');
const modalEmailLink  = document.getElementById('modalEmailLink');
const modalResearchTag = document.getElementById('modalResearchTag');
const modalCloseBtn   = document.getElementById('modalCloseBtn');
const btnSend         = document.getElementById('btnSend');
const btnEdit         = document.getElementById('btnEdit');
const btnCancel       = document.getElementById('btnCancel');
const btnDelete       = document.getElementById('btnDelete');

// Send All Modal
const sendAllOverlay  = document.getElementById('sendAllOverlay');
const sendAllText     = document.getElementById('sendAllText');
const sendAllProgress = document.getElementById('sendAllProgress');
const sendAllContent  = document.getElementById('sendAllContent');
const sendAllFooter   = document.getElementById('sendAllFooter');
const progressFill    = document.getElementById('progressFill');
const progressLabel   = document.getElementById('progressLabel');
const sendAllConfirmBtn = document.getElementById('sendAllConfirmBtn');
const sendAllCancelBtn  = document.getElementById('sendAllCancelBtn');
const sendAllCloseBtn   = document.getElementById('sendAllCloseBtn');

// Toast container
const toastContainer  = document.getElementById('toastContainer');

// ═══════════════════════════════════ UPLOAD ═══════════════════════════════════

// Click sur le bouton "Parcourir"
browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// Click sur la zone de drop
dropZone.addEventListener('click', () => fileInput.click());

// Sélection via input
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
  fileInput.value = '';
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Prévenir drop sur le reste de la page
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

async function handleFile(file) {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('Format invalide. Veuillez utiliser un fichier .xlsx ou .xls', 'error');
    return;
  }

  // Afficher le spinner
  uploadProgress.classList.add('visible');
  browseBtn.disabled = true;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API}/api/upload`, {
      method: 'POST',
      headers: FETCH_HEADERS,
      body: formData,
    });

    // Vérification du type de réponse pour éviter l'erreur "Unexpected token '<'"
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Réponse serveur invalide (HTML au lieu de JSON). Vérifiez que le backend Docker est démarré et que ngrok est actif.');
    }

    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Erreur lors du parsing');

    allContacts = data.contacts;
    showToast(`✅ ${allContacts.length} contacts importés avec succès`, 'success');
    showContactsSection();
  } catch (err) {
    console.error('Erreur handleFile:', err);
    showToast('Erreur : ' + err.message, 'error');
  } finally {
    uploadProgress.classList.remove('visible');
    browseBtn.disabled = false;
  }
}

// ═══════════════════════════════════ SECTIONS ══════════════════════════════════

function showContactsSection() {
  uploadSection.style.display = 'none';
  contactsSection.style.display = 'block';
  headerStats.style.display = 'flex';
  renderContacts();
  updateStats();
}

function showUploadSection() {
  contactsSection.style.display = 'none';
  uploadSection.style.display = 'flex';
  headerStats.style.display = 'none';
  allContacts = [];
  currentFilter = 'all';
  filterTabs.forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
  searchInput.value = '';
}

resetBtn.addEventListener('click', showUploadSection);

// ═══════════════════════════════════ FILTER & SEARCH ══════════════════════════

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderContacts();
  });
});

searchInput.addEventListener('input', renderContacts);

// ═══════════════════════════════════ RENDER CONTACTS ═══════════════════════════

function getFilteredContacts() {
  const query = searchInput.value.toLowerCase().trim();
  return allContacts.filter(c => {
    if (c.status === 'deleted') return false;
    if (currentFilter !== 'all' && c.status !== currentFilter) return false;
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.structure.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.research.toLowerCase().includes(query) ||
      c.location.toLowerCase().includes(query)
    );
  });
}

function renderContacts() {
  const contacts = getFilteredContacts();
  contactsGrid.innerHTML = '';

  if (contacts.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  contacts.forEach(contact => {
    const card = createContactCard(contact);
    contactsGrid.appendChild(card);
  });
}

function createContactCard(contact) {
  const initials = getInitials(contact.name);
  const card = document.createElement('div');
  card.className = `contact-card status-${contact.status}`;
  card.dataset.id = contact.id;

  card.innerHTML = `
    <div class="card-header-row">
      <div class="card-avatar">${initials}</div>
      <div class="card-info">
        <div class="card-name">${escHtml(contact.name)}</div>
        <div class="card-structure">${escHtml(contact.structure)}</div>
      </div>
      <div class="card-status ${contact.status}">
        <div class="card-status-dot"></div>
        ${contact.status === 'sent' ? 'Envoyé' : 'En attente'}
      </div>
    </div>
    <div class="card-research" title="${escHtml(contact.research)}">${escHtml(contact.research)}</div>
    <div class="card-email">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      ${escHtml(contact.email)}
    </div>
    <div class="card-preview-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      Voir / envoyer le mail
    </div>
  `;

  card.addEventListener('click', () => openModal(contact.id));
  return card;
}

// ═══════════════════════════════════ STATS ═════════════════════════════════════

function updateStats() {
  const active = allContacts.filter(c => c.status !== 'deleted');
  const pending = active.filter(c => c.status === 'pending').length;
  const sent = active.filter(c => c.status === 'sent').length;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('sentCount').textContent = sent;
  document.getElementById('totalCount').textContent = active.length;
}

// ═══════════════════════════════════ MODAL ═════════════════════════════════════

function openModal(contactId) {
  const contact = allContacts.find(c => c.id === contactId);
  if (!contact) return;

  currentContactId = contactId;
  isEditing = false;

  // Fill header
  const initials = getInitials(contact.name);
  modalAvatar.textContent = initials;
  modalContactName.textContent = contact.name;
  modalStructure.textContent = contact.structure;
  modalLocation.textContent = contact.location;
  modalEmailLink.textContent = contact.email;
  modalEmailLink.href = `mailto:${contact.email}`;
  modalResearchTag.textContent = contact.research;

  // Fill email
  mailSubject.value = contact.subject;
  mailBody.value = contact.body;

  // Reset to read-only mode
  setEditMode(false);

  // Update send button state
  if (contact.status === 'sent') {
    btnSend.classList.add('sent-state');
    btnSend.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Déjà envoyé
    `;
    btnSend.disabled = true;
  } else {
    btnSend.classList.remove('sent-state');
    btnSend.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
      Envoyer
    `;
    btnSend.disabled = false;
  }

  // Show modal
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  currentContactId = null;
  isEditing = false;
  setEditMode(false);
}

function setEditMode(editing) {
  isEditing = editing;
  mailSubject.readOnly = !editing;
  mailBody.readOnly = !editing;

  if (editing) {
    btnEdit.classList.add('editing');
    btnEdit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Sauvegarder
    `;
    mailBody.focus();
  } else {
    btnEdit.classList.remove('editing');
    btnEdit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      Modifier
    `;
  }
}

// Close on overlay click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalCloseBtn.addEventListener('click', closeModal);

// Échap pour fermer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) closeModal();
    if (sendAllOverlay.classList.contains('active')) closeSendAllModal();
  }
});

// ─── Bouton Annuler ───────────────────────────────────────────────────────────
btnCancel.addEventListener('click', closeModal);

// ─── Bouton Modifier / Sauvegarder ───────────────────────────────────────────
btnEdit.addEventListener('click', async () => {
  if (!isEditing) {
    setEditMode(true);
  } else {
    // Sauvegarder les modifications
    const newSubject = mailSubject.value.trim();
    const newBody = mailBody.value.trim();

    if (!newSubject || !newBody) {
      showToast('L\'objet et le corps du mail ne peuvent pas être vides', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API}/api/contacts/${currentContactId}`, {
        method: 'PUT',
        headers: { ...FETCH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject, body: newBody })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Mettre à jour localement
      const contact = allContacts.find(c => c.id === currentContactId);
      if (contact) {
        contact.subject = newSubject;
        contact.body = newBody;
      }

      setEditMode(false);
      showToast('Modifications sauvegardées', 'success');
    } catch (err) {
      showToast('Erreur lors de la sauvegarde : ' + err.message, 'error');
    }
  }
});

// ─── Bouton Envoyer ───────────────────────────────────────────────────────────
btnSend.addEventListener('click', async () => {
  if (currentContactId === null) return;

  const contact = allContacts.find(c => c.id === currentContactId);
  if (!contact) return;

  // Confirmation visuelle
  btnSend.disabled = true;
  const originalHTML = btnSend.innerHTML;
  btnSend.innerHTML = `
    <div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:white;border-radius:50%;animation:spin 0.7s linear infinite;"></div>
    Envoi en cours…
  `;

  try {
    const res = await fetch(`${API}/api/send/${currentContactId}`, {
      method: 'POST',
      headers: FETCH_HEADERS,
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Erreur d\'envoi');

    // Mettre à jour le statut localement
    contact.status = 'sent';
    renderContacts();
    updateStats();

    showToast(`✅ Mail envoyé à ${contact.email}`, 'success');

    // Mettre à jour le bouton en état "envoyé"
    btnSend.classList.add('sent-state');
    btnSend.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Déjà envoyé
    `;
    btnSend.disabled = true;

    // Fermer le modal après 1.2s
    setTimeout(closeModal, 1200);

  } catch (err) {
    showToast('Erreur d\'envoi : ' + err.message, 'error');
    btnSend.innerHTML = originalHTML;
    btnSend.disabled = false;
  }
});

// ─── Bouton Supprimer ─────────────────────────────────────────────────────────
btnDelete.addEventListener('click', async () => {
  if (currentContactId === null) return;

  const contact = allContacts.find(c => c.id === currentContactId);
  if (!contact) return;

  try {
    const res = await fetch(`${API}/api/contacts/${currentContactId}`, {
      method: 'DELETE',
      headers: FETCH_HEADERS,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // Mettre à jour localement
    contact.status = 'deleted';
    renderContacts();
    updateStats();

    closeModal();
    showToast(`Contact "${contact.name}" supprimé`, 'info');
  } catch (err) {
    showToast('Erreur lors de la suppression : ' + err.message, 'error');
  }
});

// ═══════════════════════════════════ SEND ALL ══════════════════════════════════

sendAllBtn.addEventListener('click', () => {
  const pending = allContacts.filter(c => c.status === 'pending');
  if (pending.length === 0) {
    showToast('Aucun mail en attente à envoyer', 'warning');
    return;
  }

  // Reset state
  sendAllContent.style.display = 'block';
  sendAllProgress.style.display = 'none';
  sendAllFooter.style.display = 'flex';
  sendAllText.innerHTML = `Vous êtes sur le point d'envoyer <strong>${pending.length} mail(s)</strong> de candidature spontanée.<br><br>Chaque mail incluera votre CV et votre lettre de recommandation en pièce jointe. Voulez-vous continuer ?`;

  sendAllOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
});

function closeSendAllModal() {
  sendAllOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

sendAllCloseBtn.addEventListener('click', closeSendAllModal);
sendAllCancelBtn.addEventListener('click', closeSendAllModal);
sendAllOverlay.addEventListener('click', (e) => {
  if (e.target === sendAllOverlay) closeSendAllModal();
});

sendAllConfirmBtn.addEventListener('click', async () => {
  const pending = allContacts.filter(c => c.status === 'pending');

  // Afficher la barre de progression
  sendAllContent.style.display = 'none';
  sendAllProgress.style.display = 'block';
  sendAllFooter.style.display = 'none';
  progressFill.style.width = '0%';
  progressLabel.textContent = `Envoi de 0 / ${pending.length} mails…`;

  let sent = 0;
  let failed = 0;

  // Envoi un par un avec mise à jour en temps réel
  for (let i = 0; i < pending.length; i++) {
    const contact = pending[i];
    progressLabel.textContent = `Envoi à ${contact.name} (${i + 1} / ${pending.length})…`;

    try {
      const res = await fetch(`${API}/api/send/${contact.id}`, {
        method: 'POST',
        headers: FETCH_HEADERS,
      });
      const data = await res.json();

      if (data.success) {
        contact.status = 'sent';
        sent++;
      } else {
        failed++;
        console.error(`Erreur pour ${contact.email}:`, data.error);
      }
    } catch (err) {
      failed++;
    }

    const percent = Math.round(((i + 1) / pending.length) * 100);
    progressFill.style.width = percent + '%';

    // Délai entre chaque envoi
    if (i < pending.length - 1) {
      await new Promise(r => setTimeout(r, 1600));
    }
  }

  renderContacts();
  updateStats();
  closeSendAllModal();

  if (failed === 0) {
    showToast(`✅ ${sent} mail(s) envoyé(s) avec succès !`, 'success');
  } else {
    showToast(`⚠️ ${sent} envoyé(s), ${failed} échoué(s). Vérifiez votre connexion.`, 'warning');
  }
});

// ═══════════════════════════════════ TOASTS ═══════════════════════════════════

const TOAST_ICONS = {
  success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
};

function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
    <span class="toast-msg">${message}</span>
  `;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ═══════════════════════════════════ UTILS ════════════════════════════════════

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
