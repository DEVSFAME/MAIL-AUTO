/* ═══════════════════════════════════════════════════════════════════════════════
   MailCandid — App Logic (Auth + Contacts + Documents + Envoi + Batch Selection)
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

  // Batch selection state
  let selectMode      = false;
  let selectedIds     = new Set();
  let batchSending    = false;
  let batchCancelled  = false;

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

  // Batch Selection UI
  const selectModeBtn     = $('selectModeBtn');
  const batchBar          = $('batchBar');
  const batchCount        = $('batchCount');
  const batchSelectAllBtn = $('batchSelectAllBtn');
  const batchSendBtn      = $('batchSendBtn');
  const batchPendingBtn   = $('batchPendingBtn');
  const batchDeleteBtn    = $('batchDeleteBtn');
  const batchCancelBtn    = $('batchCancelBtn');

  // Batch Modal
  const batchModalOverlay   = $('batchModalOverlay');
  const batchModalCloseBtn  = $('batchModalCloseBtn');
  const batchModalIcon      = $('batchModalIcon');
  const batchModalTitle     = $('batchModalTitle');
  const batchModalDesc      = $('batchModalDesc');
  const batchModalList      = $('batchModalList');
  const batchModalConfirm   = $('batchModalConfirm');
  const batchModalProgress  = $('batchModalProgress');
  const batchProgressStatus = $('batchProgressStatus');
  const batchProgressFill   = $('batchProgressFill');
  const batchProgressCount  = $('batchProgressCount');
  const batchProgressPct    = $('batchProgressPct');
  const batchProgressLog    = $('batchProgressLog');
  const batchModalFooter    = $('batchModalFooter');
  const batchModalCancelBtn = $('batchModalCancelBtn');
  const batchModalConfirmBtn= $('batchModalConfirmBtn');

  // Toast
  const toastContainer    = $('toastContainer');

  // =====================================================================
  //  UTILS
  // =====================================================================

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function truncate(str, len = 50) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '\u2026' : str;
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

  // =====================================================================
  //  TOASTS
  // =====================================================================

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

  // =====================================================================
  //  API HELPERS
  // =====================================================================

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

  // =====================================================================
  //  AUTH
  // =====================================================================

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
    exitSelectMode();
    showLoginSection();
  }

  // =====================================================================
  //  DOCUMENTS
  // =====================================================================

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
      documentsList.innerHTML = '<div class="documents-empty">Aucun document upload\u00e9. Ajoutez vos CV et lettres de motivation (PDF).</div>';
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

    documentsList.querySelectorAll('.document-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const docId = btn.dataset.id;
        try {
          await api(`/api/documents/${docId}`, { method: 'DELETE' });
          showToast('Document supprim\u00e9', 'success');
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
        showToast(`${file.name} n'est pas un PDF. Ignor\u00e9.`, 'warning');
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
      showToast(`${data.uploaded} document(s) ajout\u00e9(s)`, 'success');
    } catch (err) {
      showToast('Erreur upload : ' + err.message, 'error');
    }
  }

  // =====================================================================
  //  CONTACTS
  // =====================================================================

  async function loadContacts() {
    try {
      contacts = await api('/api/contacts');
      // Nettoyer les IDs sélectionnés qui n'existent plus
      if (selectMode) {
        const validIds = new Set(contacts.map(c => c.id));
        for (const id of selectedIds) {
          if (!validIds.has(id)) selectedIds.delete(id);
        }
      }
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
      const badgeText  = isSent ? 'Envoy\u00e9' : 'En attente';
      const isSelected = selectMode && selectedIds.has(c.id);

      return `
        <div class="contact-card ${isSent ? 'sent' : 'pending'} ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${c.id}">
          <div class="card-header">
            ${selectMode ? `
            <div class="card-checkbox">
              <input type="checkbox" ${isSelected ? 'checked' : ''} data-contact-id="${c.id}" />
              <div class="checkbox-custom"></div>
            </div>
            ` : ''}
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

    // Event listeners
    contactsGrid.querySelectorAll('.contact-card').forEach(card => {
      const id = parseInt(card.dataset.id, 10);

      card.addEventListener('click', (e) => {
        // Si on a cliqué sur la checkbox ou son label, ne rien faire (le change event gère)
        if (e.target.closest('.card-checkbox')) return;

        if (selectMode) {
          // En mode sélection : toggle la sélection
          toggleSelectContact(id);
        } else {
          // Hors mode sélection : ouvrir le modal de détail
          const contact = contacts.find(c => c.id === id);
          if (contact) openModal(contact);
        }
      });

      // Gestion de la checkbox
      const checkbox = card.querySelector('.card-checkbox input');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          if (e.target.checked) {
            selectedIds.add(id);
          } else {
            selectedIds.delete(id);
          }
          updateBatchUI();
          renderContactSelection();
        });
      }
    });
  }

  // Met à jour uniquement la classe 'selected' sans re-render toutes les cards
  function renderContactSelection() {
    contactsGrid.querySelectorAll('.contact-card').forEach(card => {
      const id = parseInt(card.dataset.id, 10);
      const cb = card.querySelector('.card-checkbox input');
      if (cb) {
        cb.checked = selectedIds.has(id);
      }
      card.classList.toggle('selected', selectedIds.has(id));
    });
  }

  // =====================================================================
  //  BATCH SELECTION LOGIC
  // =====================================================================

  function toggleSelectMode() {
    selectMode = !selectMode;
    if (!selectMode) {
      exitSelectMode();
      return;
    }
    selectedIds.clear();
    selectModeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      Annuler
    `;
    selectModeBtn.classList.add('btn-batch-cancel');
    selectModeBtn.style.border = '1px solid rgba(148,163,184,0.3)';
    batchBar.style.display = 'flex';
    const contactsGridEl = document.querySelector('.contacts-grid');
    if (contactsGridEl) contactsGridEl.classList.add('select-mode');
    updateBatchUI();
    renderContacts();
  }

  function exitSelectMode() {
    selectMode = false;
    selectedIds.clear();
    selectModeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      S\u00e9lectionner
    `;
    selectModeBtn.classList.remove('btn-batch-cancel');
    selectModeBtn.style.border = '';
    batchBar.style.display = 'none';
    const contactsGridEl = document.querySelector('.contacts-grid');
    if (contactsGridEl) contactsGridEl.classList.remove('select-mode');
    renderContacts();
  }

  function toggleSelectContact(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    updateBatchUI();
    renderContactSelection();
  }

  function selectAllContacts() {
    const filtered = getFilteredContacts();
    // Si tous sont déjà sélectionnés, tout désélectionner
    const allSelected = filtered.every(c => selectedIds.has(c.id));
    if (allSelected) {
      filtered.forEach(c => selectedIds.delete(c.id));
    } else {
      filtered.forEach(c => selectedIds.add(c.id));
    }
    updateBatchUI();
    renderContactSelection();
  }

  function updateBatchUI() {
    const count = selectedIds.size;
    batchCount.textContent = count === 0 ? '0 s\u00e9lectionn\u00e9' : `${count} s\u00e9lectionn\u00e9${count > 1 ? 's' : ''}`;

    // Désactiver les actions si rien n'est sélectionné
    batchSendBtn.style.opacity = count === 0 ? '0.4' : '1';
    batchPendingBtn.style.opacity = count === 0 ? '0.4' : '1';
    batchDeleteBtn.style.opacity = count === 0 ? '0.4' : '1';
    batchSendBtn.style.pointerEvents = count === 0 ? 'none' : 'auto';
    batchPendingBtn.style.pointerEvents = count === 0 ? 'none' : 'auto';
    batchDeleteBtn.style.pointerEvents = count === 0 ? 'none' : 'auto';

    // Texte du bouton Tout
    const filtered = getFilteredContacts();
    const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
    batchSelectAllBtn.innerHTML = allSelected
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="12" x2="15" y2="12"></line></svg> Aucun'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Tout';
  }

  // =====================================================================
  //  BATCH ACTIONS MODAL
  // =====================================================================

  function openBatchModal(action) {
    if (selectedIds.size === 0) {
      showToast('Aucun contact s\u00e9lectionn\u00e9', 'warning');
      return;
    }

    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));

    // Configurer l'icône et le titre selon l'action
    const config = {
      send: {
        icon: 'send',
        title: 'Envoyer les mails s\u00e9lectionn\u00e9s',
        desc: `Vous allez envoyer un mail \u00e0 <strong>${selectedIds.size} contact(s)</strong>`,
        confirmText: 'Envoyer',
        confirmClass: 'btn-success',
      },
      delete: {
        icon: 'delete',
        title: 'Supprimer les contacts s\u00e9lectionn\u00e9s',
        desc: `Vous allez supprimer <strong>${selectedIds.size} contact(s)</strong>`,
        confirmText: 'Supprimer',
        confirmClass: 'btn-danger',
      },
      pending: {
        icon: 'pending',
        title: 'Mettre en attente',
        desc: `Vous allez marquer <strong>${selectedIds.size} contact(s)</strong> comme "En attente"`,
        confirmText: 'Confirmer',
        confirmClass: 'btn-warning',
      },
    };

    const cfg = config[action] || config.send;

    // Icône
    batchModalIcon.className = `batch-modal-icon ${cfg.icon}`;
    const icons = {
      send: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
      delete: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>',
      pending: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    };
    batchModalIcon.innerHTML = icons[cfg.icon] || icons.send;

    batchModalTitle.textContent = cfg.title;
    batchModalDesc.innerHTML = cfg.desc;
    batchModalConfirmBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> ${cfg.confirmText}`;
    batchModalConfirmBtn.className = cfg.confirmClass;

    // Liste des contacts
    batchModalList.innerHTML = selectedContacts.map(c => `
      <div class="batch-list-item">
        <span class="initials">${getInitials(c.name)}</span>
        <span>${c.name || 'Sans nom'}</span>
        <span class="list-email">${c.email}</span>
      </div>
    `).join('');

    // Cacher la progression, montrer la confirmation
    batchModalConfirm.style.display = 'block';
    batchModalProgress.style.display = 'none';
    batchModalFooter.style.display = 'flex';

    // Stocker l'action en cours sur le bouton confirmer
    batchModalConfirmBtn.dataset.action = action;

    batchModalOverlay.classList.add('show');
  }

  function closeBatchModal() {
    batchModalOverlay.classList.remove('show');
    batchCancelled = false;
    batchModalConfirmBtn.disabled = false;
    batchModalConfirmBtn.innerHTML = '';
  }

  async function handleBatchConfirm() {
    const action = batchModalConfirmBtn.dataset.action;
    if (!action) return;

    if (action === 'send') {
      await handleBatchSend();
    } else if (action === 'delete') {
      await handleBatchDelete();
    } else if (action === 'pending') {
      await handleBatchPending();
    }
  }

  // ── BATCH SEND ──────────────────────────────────────────────────────────────

  async function handleBatchSend() {
    const selectedContacts = contacts.filter(c => selectedIds.has(c.id) && c.status !== 'sent');
    if (selectedContacts.length === 0) {
      showToast('Aucun contact non-envoy\u00e9 dans la s\u00e9lection', 'warning');
      closeBatchModal();
      return;
    }

    // Passer en mode progression
    batchModalConfirm.style.display = 'none';
    batchModalProgress.style.display = 'block';
    batchModalFooter.style.display = 'none';

    batchSending = true;
    batchCancelled = false;
    batchProgressLog.innerHTML = '';

    const total = selectedContacts.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      if (batchCancelled) {
        addBatchLog('pending', '⏸️ Envoi annul\u00e9 par l\'utilisateur');
        break;
      }

      const contact = selectedContacts[i];
      batchProgressStatus.textContent = `Envoi ${i + 1}/${total}...`;
      batchProgressFill.style.width = `${((i) / total) * 100}%`;
      batchProgressCount.textContent = `${i}/${total}`;
      batchProgressPct.textContent = `${Math.round((i / total) * 100)}%`;

      addBatchLog('pending', `📤 Envoi \u00e0 ${contact.email}...`);

      try {
        await api(`/api/send/${contact.id}`, { method: 'POST' });
        successCount++;
        addBatchLog('success', `✅ ${contact.email} — Envoy\u00e9`);
        // Mettre à jour localement le statut
        const idx = contacts.findIndex(c => c.id === contact.id);
        if (idx !== -1) contacts[idx].status = 'sent';
      } catch (err) {
        failCount++;
        addBatchLog('error', `❌ ${contact.email} — ${err.message}`);
      }

      // Mise à jour barre
      const done = i + 1;
      batchProgressFill.style.width = `${(done / total) * 100}%`;
      batchProgressCount.textContent = `${done}/${total}`;
      batchProgressPct.textContent = `${Math.round((done / total) * 100)}%`;

      // Délai de 1.5s entre chaque envoi (sauf dernier)
      if (i < total - 1 && !batchCancelled) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    batchSending = false;

    // Résumé final
    batchProgressStatus.textContent = '✅ Envoi termin\u00e9';
    batchProgressFill.style.width = '100%';
    batchProgressPct.textContent = '100%';

    const msg = `${successCount}/${total} envoy\u00e9(s) avec succ\u00e8s`;
    if (failCount > 0) {
      showToast(`${msg}, ${failCount} \u00e9chec(s)`, 'warning', 5000);
    } else {
      showToast(msg + ' ✅', 'success', 4000);
    }

    // Revenir à l'état confirmation après 2 secondes, puis fermer le modal
    setTimeout(() => {
      if (!batchModalOverlay.classList.contains('show')) return;
      batchModalProgress.style.display = 'none';
      batchModalConfirm.style.display = 'block';
      batchModalFooter.style.display = 'flex';
      // Fermer automatiquement après 1 seconde supplémentaire
      setTimeout(closeBatchModal, 1000);
    }, 2000);

    // Quitter le mode sélection et rafraîchir
    exitSelectMode();
    updateStats();
    renderContacts();
  }

  function addBatchLog(type, text) {
    const el = document.createElement('div');
    el.className = `log-item ${type}`;
    el.textContent = text;
    batchProgressLog.appendChild(el);
    batchProgressLog.scrollTop = batchProgressLog.scrollHeight;
  }

  // ── BATCH DELETE ────────────────────────────────────────────────────────────

  async function handleBatchDelete() {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    batchModalConfirmBtn.disabled = true;
    batchModalConfirmBtn.innerHTML = '<div class="progress-spinner" style="width:14px;height:14px;"></div> Suppression...';

    for (const id of ids) {
      try {
        await api(`/api/contacts/${id}`, { method: 'DELETE' });
        successCount++;
      } catch (err) {
        failCount++;
        console.error('Erreur suppression contact', id, err.message);
      }
    }

    const msg = `${successCount} contact(s) supprim\u00e9(s)`;
    if (failCount > 0) {
      showToast(`${msg}, ${failCount} \u00e9chec(s)`, 'warning');
    } else {
      showToast(msg, 'info');
    }

    closeBatchModal();
    exitSelectMode();
    await loadContacts();
  }

  // ── BATCH PENDING ───────────────────────────────────────────────────────────

  async function handleBatchPending() {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    batchModalConfirmBtn.disabled = true;
    batchModalConfirmBtn.innerHTML = '<div class="progress-spinner" style="width:14px;height:14px;"></div> Mise \u00e0 jour...';

    for (const id of ids) {
      try {
        await api(`/api/contacts/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'pending' }),
        });
        successCount++;
      } catch (err) {
        console.error('Erreur mise en attente contact', id, err.message);
      }
    }

    showToast(`${successCount} contact(s) mis en attente`, 'success');
    closeBatchModal();
    exitSelectMode();
    await loadContacts();

    // Basculer sur l'onglet "En attente"
    filterTabs.forEach(t => t.classList.remove('active'));
    document.querySelector('.filter-tab[data-filter="pending"]').classList.add('active');
    currentFilter = 'pending';
    renderContacts();
  }

  // =====================================================================
  //  MODAL (détail contact)
  // =====================================================================

  function openModal(contact) {
    currentContact = contact;
    editing = false;

    modalAvatar.textContent       = getInitials(contact.name);
    modalContactName.textContent  = contact.name || 'Sans nom';
    modalStructure.textContent    = contact.structure || '';
    modalLocation.textContent     = contact.location || '';

    const displayEmail = contact.email || '';
    modalEmailLink.textContent    = displayEmail;
    modalEmailLink.href           = `mailto:${displayEmail}`;
    modalResearchTag.textContent  = contact.researchAxis || contact.research_axis || 'Recherche';
    mailSubject.value             = contact.subject || '';
    mailBody.value                = contact.body || contact.generatedBody || '';

    const isSent = contact.status === 'sent';
    btnSend.textContent = isSent ? 'D\u00e9j\u00e0 envoy\u00e9' : 'Envoyer';
    btnSend.disabled = isSent;
    if (isSent) btnSend.classList.add('sent-state');
    else btnSend.classList.remove('sent-state');

    mailSubject.readOnly = true;
    mailSubject.classList.remove('editing');
    mailBody.readOnly = true;
    mailBody.classList.remove('editing');

    modalOverlay.classList.add('show');
  }

  function closeModal() {
    modalOverlay.classList.remove('show');
    currentContact = null;
  }

  async function handleDelete() {
    if (!currentContact) return;
    try {
      await api(`/api/contacts/${currentContact.id}`, { method: 'DELETE' });
      showToast('Contact supprim\u00e9', 'success');
      closeModal();
      await loadContacts();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  }

  function handleEdit() {
    editing = !editing;
    mailSubject.readOnly = !editing;
    mailBody.readOnly = !editing;
    mailSubject.classList.toggle('editing', editing);
    mailBody.classList.toggle('editing', editing);
    btnEdit.textContent = editing ? 'Sauvegarder' : 'Modifier';
  }

  async function handleSendOne() {
    if (!currentContact) return;
    if (currentContact.status === 'sent') {
      showToast('D\u00e9j\u00e0 envoy\u00e9', 'warning');
      return;
    }

    btnSend.disabled = true;
    btnSend.textContent = 'Envoi en cours...';

    try {
      await api(`/api/send/${currentContact.id}`, { method: 'POST' });
      showToast('Mail envoy\u00e9 \u00e0 ' + currentContact.email, 'success');
      closeModal();
      await loadContacts();
    } catch (err) {
      showToast('Erreur envoi : ' + err.message, 'error');
      btnSend.disabled = false;
      btnSend.textContent = 'Envoyer';
    }
  }

  // =====================================================================
  //  SEND ALL (Send-all modal legacy)
  // =====================================================================

  function openSendAllModal() {
    const unsent = contacts.filter(c => c.status !== 'sent');
    if (unsent.length === 0) {
      showToast('Tous les contacts ont d\u00e9j\u00e0 \u00e9t\u00e9 envoy\u00e9s', 'info');
      return;
    }

    sendAllText.innerHTML = `Vous allez envoyer un mail \u00e0 <strong>${unsent.length} contact(s)</strong>`;
    sendAllContent.style.display = 'block';
    sendAllProgress.style.display = 'none';
    sendAllFooter.style.display = 'flex';
    sendAllOverlay.classList.add('show');
  }

  async function handleSendAllConfirm() {
    const unsent = contacts.filter(c => c.status !== 'sent');
    if (unsent.length === 0) {
      showToast('Tous les contacts ont d\u00e9j\u00e0 \u00e9t\u00e9 envoy\u00e9s', 'info');
      sendAllOverlay.classList.remove('show');
      return;
    }

    sendAllContent.style.display = 'none';
    sendAllProgress.style.display = 'block';
    sendAllFooter.style.display = 'none';

    const total = unsent.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const contact = unsent[i];
      progressFill.style.width = `${(i / total) * 100}%`;
      progressLabel.textContent = `${i + 1}/${total} — ${contact.email}`;

      try {
        await api(`/api/send/${contact.id}`, { method: 'POST' });
        successCount++;
        const idx = contacts.findIndex(c => c.id === contact.id);
        if (idx !== -1) contacts[idx].status = 'sent';
      } catch (err) {
        console.error('Erreur envoi', contact.email, err.message);
      }

      progressFill.style.width = `${((i + 1) / total) * 100}%`;

      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    progressLabel.textContent = `✅ ${successCount}/${total} envoy\u00e9(s)`;
    showToast(`${successCount}/${total} envoy\u00e9(s) avec succ\u00e8s`, successCount === total ? 'success' : 'warning', 5000);

    setTimeout(() => {
      sendAllOverlay.classList.remove('show');
    }, 2000);

    updateStats();
    renderContacts();
  }

  // =====================================================================
  //  EVENT BINDING
  // =====================================================================

  // ── Auth ──
  googleLoginBtn.addEventListener('click', () => {
    window.location.href = `${API}/api/auth/google`;
  });

  zimbraLoginBtn.addEventListener('click', () => {
    window.location.href = `${API}/api/auth/zimbra`;
  });

  logoutBtn.addEventListener('click', handleLogout);

  // ── Upload ──
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadProgress.style.display = 'flex';
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await fetch(`${API}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!result.ok) {
        const err = await result.json();
        throw new Error(err.error || 'Erreur upload');
      }
      showToast('Fichier import\u00e9 avec succ\u00e8s', 'success');
      await loadContacts();
      contactsSection.style.display = 'block';
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      uploadProgress.style.display = 'none';
      fileInput.value = '';
    }
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    uploadProgress.style.display = 'flex';
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await fetch(`${API}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!result.ok) {
        const err = await result.json();
        throw new Error(err.error || 'Erreur upload');
      }
      showToast('Fichier import\u00e9 avec succ\u00e8s', 'success');
      await loadContacts();
      contactsSection.style.display = 'block';
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      uploadProgress.style.display = 'none';
    }
  });

  // ── Filters & Search ──
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      if (selectMode) exitSelectMode();
      renderContacts();
    });
  });

  searchInput.addEventListener('input', () => {
    renderContacts();
  });

  // ── Reset ──
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Voulez-vous vraiment importer un nouveau fichier ? Les contacts actuels seront conserv\u00e9s.')) return;
    dropZone.classList.remove('has-contacts');
    contactsSection.style.display = 'none';
    document.querySelectorAll('.upload-card .upload-title, .upload-card .upload-subtitle, .upload-card .btn-browse, .upload-card .upload-hint').forEach(el => el.style.display = '');
    if (selectMode) exitSelectMode();
  });

  // ── Send All ──
  sendAllBtn.addEventListener('click', openSendAllModal);
  sendAllCloseBtn.addEventListener('click', () => sendAllOverlay.classList.remove('show'));
  sendAllCancelBtn.addEventListener('click', () => sendAllOverlay.classList.remove('show'));
  sendAllConfirmBtn.addEventListener('click', handleSendAllConfirm);

  // ── Detail Modal ──
  modalCloseBtn.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  btnDelete.addEventListener('click', handleDelete);
  btnEdit.addEventListener('click', handleEdit);
  btnSend.addEventListener('click', handleSendOne);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  sendAllOverlay.addEventListener('click', (e) => {
    if (e.target === sendAllOverlay) sendAllOverlay.classList.remove('show');
  });

  // ── Documents ──
  docUploadBtn.addEventListener('click', () => docFileInput.click());
  docFileInput.addEventListener('change', async (e) => {
    await uploadDocuments(e.target.files);
    docFileInput.value = '';
  });

  // ── Batch Selection ──
  selectModeBtn.addEventListener('click', toggleSelectMode);
  batchSelectAllBtn.addEventListener('click', selectAllContacts);
  batchCancelBtn.addEventListener('click', exitSelectMode);

  batchSendBtn.addEventListener('click', () => openBatchModal('send'));
  batchPendingBtn.addEventListener('click', () => openBatchModal('pending'));
  batchDeleteBtn.addEventListener('click', () => openBatchModal('delete'));

  // Batch Modal events
  batchModalCloseBtn.addEventListener('click', closeBatchModal);
  batchModalCancelBtn.addEventListener('click', closeBatchModal);
  batchModalConfirmBtn.addEventListener('click', handleBatchConfirm);
  batchModalOverlay.addEventListener('click', (e) => {
    if (e.target === batchModalOverlay && !batchSending) closeBatchModal();
  });

  // Annulation en cours d'envoi via Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (batchSending) {
        batchCancelled = true;
        showToast('Annulation en cours...', 'warning');
      } else if (batchModalOverlay.classList.contains('show')) {
        closeBatchModal();
      } else if (modalOverlay.classList.contains('show')) {
        closeModal();
      } else if (sendAllOverlay.classList.contains('show')) {
        sendAllOverlay.classList.remove('show');
      }
    }
  });

  // =====================================================================
  //  INIT
  // =====================================================================

  async function init() {
    const isLoggedIn = await checkAuth();
    if (isLoggedIn && currentUser) {
      showAppSection(currentUser);
      await loadDocuments();
      await loadContacts();
      if (contacts.length > 0) {
        contactsSection.style.display = 'block';
      }
    } else {
      showLoginSection();
    }
  }

  init();

})();

