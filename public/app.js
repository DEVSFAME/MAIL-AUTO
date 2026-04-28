/* ═══════════════════════════════════════════════════════════════════════════════
   MailCandid — App Logic (Auth + Contacts + Documents + Envoi)
   ═══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────────────────
  const API = window.API_BASE_URL || '';
  const DEFAULT_USER_NAME = 'Anika Mohammad';

  // ─── State ──────────────────────────────────────────────────────────────────
  let contacts        = [];
  let currentUser     = null;
  let currentFilter   = 'all';
  let currentContact  = null;
  let editing         = false;
  let documents       = [];

  // ─── DOM refs ───────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const loginSection      = $('loginSection');
  const appSection        = $('appSection');
  const googleLoginBtn    = $('googleLoginBtn');
  const zimbraLoginBtn    = $('zimbraLoginBtn');
  const logoutBtn         = $('logoutBtn');
  const userAvatar        = $('userAvatar');
  const userName          = $('userName');
  const headerStats       = $('headerStats');
  const pendingCount      = $('pendingCount');
  const sentCount         = $('sentCount');
  const totalCount        = $('totalCount');
  const dropZone          = $('dropZone');
  const browseBtn         = $('browseBtn');
  const fileInput         = $('fileInput');
  const uploadProgress    = $('uploadProgress');
  const contactsSection   = $('contactsSection');
  const contactsGrid      = $('contactsGrid');
  const emptyState        = $('emptyState');
  const searchInput       = $('searchInput');
  const sendAllBtn        = $('sendAllBtn');
  const resetBtn          = $('resetBtn');
  const filterTabs        = document.querySelectorAll('.filter-tab');

  // Modal
  const modalOverlay      = $('modalOverlay');
  const modalAvatar       = $('modalAvatar');
  const modalContactName  = $('modalContactName');
  const modalStructure    = $('modalStructure');
  const modalLocation     = $('modalLocation');
  const modalEmailLink    = $('modalEmailLink');
  const modalResearchTag  = $('modalResearchTag');
  const mailSubject       = $('mailSubject');
  const mailBody          = $('mailBody');
  const btnDelete         = $('btnDelete');
  const btnCancel         = $('btnCancel');
  const btnEdit           = $('btnEdit');
  const btnSend           = $('btnSend');
  const modalCloseBtn     = $('modalCloseBtn');

  // Documents
  const documentsList     = $('documentsList');
  const docUploadBtn      = $('docUploadBtn');
  const docFileInput      = $('docFileInput');
  const docCount          = $('docCount');

  // Send All Modal
  const sendAllOverlay    = $('sendAllOverlay');
  const sendAllCloseBtn   = $('sendAllCloseBtn');
  const sendAllText       = $('sendAllText');
  const sendAllProgress   = $('sendAllProgress');
  const sendAllContent    = $('sendAllContent');
  const progressFill      = $('progressFill');
  const progressLabel     = $('progressLabel');
  const sendAllCancelBtn  = $('sendAllCancelBtn');
  const sendAllConfirmBtn = $('sendAllConfirmBtn');

  // Toast
  const toastContainer    = $('toastContainer');

  // ═══════════════════════════════════════════════════════════════════════════
  //  UTILS
  // ═══════════════════════════════════════════════════════════════════════════

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function truncate(str, len = 50) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Aujourd\'hui';
    if (diff < 172800000) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TOASTS
  // ═══════════════════════════════════════════════════════════════════════════

  function showToast(message, type = 'info', duration = 4000) {
    const icons = {
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      info:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <span class="toast-msg">${message}</span>
    `;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  API HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function api(path, options = {}) {
    const url = `${API}${path}`;
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      let err;
      try { err = await res.json(); } catch { err = { error: res.statusText }; }
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  async function checkAuth() {
    try {
      const user = await api('/api/me');
      currentUser = user;
      return true;
    } catch {
      return false;
    }
  }

  function showLoginSection() {
    loginSection.style.display = '';
    appSection.style.display   = 'none';
  }

  function showAppSection(user) {
    loginSection.style.display = 'none';
    appSection.style.display   = '';
    userAvatar.textContent     = getInitials(user.name || user.email);
    userName.textContent       = user.name || user.email || DEFAULT_USER_NAME;
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    currentUser = null;
    contacts    = [];
    documents   = [];
    showLoginSection();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadDocuments() {
    try {
      documents = await api('/api/documents');
      renderDocuments();
    } catch (e) {
      console.error('Erreur chargement documents :', e.message);
    }
  }

  function renderDocuments() {
    docCount.textContent = `(${documents.length}/5)`;

    if (documents.length === 0) {
      documentsList.innerHTML = '<div class="documents-empty">Aucun document uploadé. Ajoutez vos CV et lettres de motivation (PDF).</div>';
      return;
    }

    documentsList.innerHTML = documents.map(doc => `
      <div class="document-item" data-id="${doc.id}">
        <div class="document-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="document-info">
          <div class="document-name">${doc.originalName}</div>
          <div class="document-size">${formatSize(doc.size)}</div>
        </div>
        <button class="document-delete" data-id="${doc.id}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          </svg>
        </button>
      </div>
    `).join('');

    // Event listeners sur les boutons supprimer
    documentsList.querySelectorAll('.document-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const docId = btn.dataset.id;
        try {
          await api(`/api/documents/${docId}`, { method: 'DELETE' });
          showToast('Document supprimé', 'success');
          await loadDocuments();
        } catch (err) {
          showToast('Erreur suppression : ' + err.message, 'error');
        }
      });
    });
  }

  async function uploadDocuments(files) {
    const formData = new FormData();
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        showToast(`${file.name} n'est pas un PDF. Ignoré.`, 'warning');
        continue;
      }
      formData.append('documents', file);
    }

    try {
      const result = await fetch(`${API}/api/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!result.ok) {
        const err = await result.json();
        throw new Error(err.error || `Erreur ${result.status}`);
      }

      const data = await result.json();
      documents = data.documents;
      renderDocuments();
      showToast(`${data.uploaded} document(s) ajouté(s)`, 'success');
    } catch (err) {
      showToast('Erreur upload : ' + err.message, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONTACTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadContacts() {
    try {
      contacts = await api('/api/contacts');
      updateStats();
      renderContacts();
    } catch (e) {
      console.error('Erreur chargement contacts :', e.message);
    }
  }

  function updateStats() {
    const pending = contacts.filter(c => c.status === 'pending').length;
    const sent    = contacts.filter(c => c.status === 'sent').length;
    pendingCount.textContent = pending;
    sentCount.textContent    = sent;
    totalCount.textContent   = contacts.length;
    headerStats.style.display = contacts.length > 0 ? 'flex' : 'none';
  }

  function getFilteredContacts() {
    let filtered = contacts;
    if (currentFilter === 'pending') {
      filtered = contacts.filter(c => c.status !== 'sent' && c.status !== 'deleted');
    } else if (currentFilter === 'sent') {
      filtered = contacts.filter(c => c.status === 'sent');
    }

    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(query) ||
        (c.structure || '').toLowerCase().includes(query) ||
        (c.email || '').toLowerCase().includes(query) ||
        (c.location || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  function renderContacts() {
    const filtered = getFilteredContacts();

    if (filtered.length === 0) {
      contactsGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    contactsGrid.innerHTML = filtered.map(c => {
      const initials = getInitials(c.name);
      const isSent   = c.status === 'sent';
      const isPending = c.status === 'pending';
      const badgeClass = isSent ? 'sent' : 'pending';
      const badgeText  = isSent ? 'Envoyé' : 'En attente';

      return `
        <div class="contact-card ${isSent ? 'sent' : 'pending'}" data-id="${c.id}">
          <div class="card-header">
            <div class="card-avatar">${initials}</div>
            <div class="card-body">
              <div class="card-name">${c.name || 'Sans nom'}</div>
              <div class="card-sublabel">${c.structure || c.location || ''}</div>
            </div>
            <span class="card-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="card-subject">${truncate(c.subject || 'Pas d\'objet', 60)}</div>
          <div class="card-footer">
            <span class="card-email">${c.email}</span>
            <span class="card-sent-date">${c.sentAt ? formatDate(c.sentAt) : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners sur les cartes
    contactsGrid.querySelectorAll('.contact-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id, 10);
        const contact = contacts.find(c => c.id === id);
        if (contact) openModal(contact);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openModal(contact) {
    currentContact = contact;
    editing = false;

    modalAvatar.textContent       = getInitials(contact.name);
    modalContactName.textContent  = contact.name || 'Sans nom';
    modalStructure.textContent    = contact.structure || '';
    modalLocation.textContent     = contact.location || '';
    modalEmailLink.textContent    = contact.email;
    modalEmailLink.href           = `mailto:${contact.email}`;
    modalResearchTag.textContent  = contact.research || 'Recherche';

    mailSubject.value = contact.subject || '';
    mailBody.value    = contact.body || '';
    mailBody.readOnly = true;

    // Si déjà envoyé, désactiver le bouton Envoyer
    const isSent = contact.status === 'sent';
    btnSend.disabled = isSent;
    btnSend.classList.toggle('sent-state', isSent);
    btnSend.innerHTML = isSent
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Envoyé'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer';

    // réinitialiser le bouton edit
    btnEdit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Modifier';

    modalOverlay.classList.add('show');
  }

  function closeModal() {
    modalOverlay.classList.remove('show');
    currentContact = null;
    editing = false;
  }

  async function handleSend(contact) {
    try {
      btnSend.disabled = true;
      btnSend.innerHTML = '<div class="progress-spinner" style="width:14px;height:14px;"></div> Envoi…';
      await api(`/api/send/${contact.id}`, { method: 'POST' });
      showToast(`Mail envoyé à ${contact.email} ✅`, 'success');
      closeModal();
      await loadContacts();
    } catch (err) {
      showToast('Erreur envoi : ' + err.message, 'error');
      btnSend.disabled = false;
      btnSend.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer';
    }
  }

  async function handleEdit(contact) {
    if (!editing) {
      // Passer en mode édition
      editing = true;
      mailBody.readOnly = false;
      mailSubject.disabled = false;
      mailBody.classList.add('editing');
      mailSubject.classList.add('editing');
      btnEdit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Sauvegarder';
      return;
    }

    // Sauvegarder les modifications
    try {
      await api(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          subject: mailSubject.value,
          body: mailBody.value,
        }),
      });

      showToast('Modifications sauvegardées ✅', 'success');
      editing = false;
      mailBody.readOnly = true;
      mailSubject.disabled = true;
      mailBody.classList.remove('editing');
      mailSubject.classList.remove('editing');
      btnEdit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Modifier';

      await loadContacts();
    } catch (err) {
      showToast('Erreur sauvegarde : ' + err.message, 'error');
    }
  }

  async function handleDelete(contact) {
    if (!confirm(`Supprimer le contact ${contact.name || contact.email} ?`)) return;
    try {
      await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      showToast('Contact supprimé', 'info');
      closeModal();
      await loadContacts();
    } catch (err) {
      showToast('Erreur suppression : ' + err.message, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UPLOAD EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    uploadProgress.style.display = 'flex';

    try {
      const res = await fetch(`${API}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Erreur ${res.status}`);
      }

      const data = await res.json();
      contacts = data.contacts;
      await loadDocuments();
      showToast(`${contacts.length} contacts importés ✅`, 'success');

      // Afficher contacts
      contactsSection.style.display = 'block';
      dropZone.classList.add('has-contacts');
      updateStats();
      renderContacts();
    } catch (err) {
      showToast('Erreur import : ' + err.message, 'error');
    } finally {
      uploadProgress.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SEND ALL
  // ═══════════════════════════════════════════════════════════════════════════

  function openSendAllModal() {
    const pending = contacts.filter(c => c.status === 'pending');
    if (pending.length === 0) {
      showToast('Aucun mail en attente', 'warning');
      return;
    }

    sendAllText.textContent = `Envoyer ${pending.length} mail${pending.length > 1 ? 's' : ''} en attente ?`;
    sendAllContent.style.display = 'block';
    sendAllProgress.style.display = 'none';
    sendAllConfirmBtn.disabled = false;
    sendAllConfirmBtn.textContent = 'Confirmer l\'envoi';
    sendAllOverlay.classList.add('show');
  }

  async function handleSendAll() {
    sendAllContent.style.display = 'none';
    sendAllProgress.style.display = 'block';
    sendAllConfirmBtn.disabled = true;
    sendAllCancelBtn.disabled = true;

    try {
      const res = await fetch(`${API}/api/send-all`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Erreur ${res.status}`);
      }

      const data = await res.json();

      // Mettre à jour la barre de progression
      if (data.results) {
        const total = data.results.length;
        const success = data.results.filter(r => r.success).length;
        const failed = total - success;

        progressFill.style.width = '100%';
        progressLabel.textContent = `${success}/${total} envoyés avec succès`;

        setTimeout(() => {
          if (failed > 0) {
            showToast(`${success} mail(s) envoyé(s), ${failed} échec(s)`, failed > 0 ? 'warning' : 'success', 5000);
          } else {
            showToast(`${success} mail(s) envoyé(s) avec succès ✅`, 'success', 4000);
          }
        }, 500);
      }

      await loadContacts();
    } catch (err) {
      showToast('Erreur envoi en masse : ' + err.message, 'error');
    } finally {
      sendAllCancelBtn.disabled = false;
      setTimeout(() => {
        sendAllOverlay.classList.remove('show');
        progressFill.style.width = '0%';
      }, 1500);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    const authenticated = await checkAuth();

    if (authenticated && currentUser) {
      showAppSection(currentUser);

      // Vérifier si config.js a défini une auto-connexion (mode hébergé)
      // Charger les contacts, documents
      await Promise.all([loadContacts(), loadDocuments()]);

      if (contacts.length > 0) {
        contactsSection.style.display = 'block';
        dropZone.classList.add('has-contacts');
      }
    } else {
      showLoginSection();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Google Login
  googleLoginBtn.addEventListener('click', () => {
    window.location.href = `${API}/api/auth/google`;
  });

  // Zimbra Login
  zimbraLoginBtn.addEventListener('click', async () => {
    try {
      const result = await api('/api/auth/zimbra', { method: 'POST' });
      if (result.success) {
        currentUser = result.user;
        showAppSection(currentUser);
        await Promise.all([loadContacts(), loadDocuments()]);
        if (contacts.length > 0) {
          contactsSection.style.display = 'block';
          dropZone.classList.add('has-contacts');
        }
        showToast('Connecté avec Zimbra', 'success');
      }
    } catch (err) {
      showToast('Erreur connexion Zimbra : ' + err.message, 'error');
    }
  });

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Drag & drop
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    fileInput.value = '';
  });

  // Search
  searchInput.addEventListener('input', renderContacts);

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderContacts();
    });
  });

  // Reset / Nouveau fichier
  resetBtn.addEventListener('click', () => {
    contacts = [];
    contactsSection.style.display = 'none';
    dropZone.classList.remove('has-contacts');
    renderContacts();
    headerStats.style.display = 'none';
  });

  // Modal - Send
  btnSend.addEventListener('click', () => {
    if (currentContact && !btnSend.disabled) handleSend(currentContact);
  });

  // Modal - Edit
  btnEdit.addEventListener('click', () => {
    if (currentContact) handleEdit(currentContact);
  });

  // Modal - Delete
  btnDelete.addEventListener('click', () => {
    if (currentContact) handleDelete(currentContact);
  });

  // Modal - Cancel / Close
  btnCancel.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Send All
  sendAllBtn.addEventListener('click', openSendAllModal);
  sendAllConfirmBtn.addEventListener('click', handleSendAll);
  sendAllCloseBtn.addEventListener('click', () => sendAllOverlay.classList.remove('show'));
  sendAllCancelBtn.addEventListener('click', () => sendAllOverlay.classList.remove('show'));
  sendAllOverlay.addEventListener('click', (e) => {
    if (e.target === sendAllOverlay) sendAllOverlay.classList.remove('show');
  });

  // Documents upload
  docUploadBtn.addEventListener('click', () => docFileInput.click());
  docFileInput.addEventListener('change', () => {
    if (docFileInput.files.length > 0) {
      uploadDocuments(docFileInput.files);
      docFileInput.value = '';
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      sendAllOverlay.classList.remove('show');
    }
    // Ctrl+Enter ou Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (modalOverlay.classList.contains('show') && currentContact && !btnSend.disabled) {
        handleSend(currentContact);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEMARRAGE
  // ═══════════════════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', init);

  // Exposer showToast pour debug
  window.showToast = showToast;
})();
