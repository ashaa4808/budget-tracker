/**
 * app.js — Main Application Controller & View Orchestrator
 */

import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView } from './budget.js';
import { renderDashboardView } from './dashboard.js';
import {
  addTransaction,
  clearAllData,
  deleteTransaction,
  getBudgetForMonth,
  getTransactions,
  initStorage,
  resetSampleData,
  saveBudget,
  updateTransaction,
} from './storage.js';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  escapeHtml,
  filterTransactions,
  renderTransactionsView,
  sortTransactions,
  transactionsToCSV,
  validateTransactionInput,
} from './transactions.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget Management',
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const state = {
  activeView: 'dashboard',
  activeMonthKey: getCurrentMonthKey(),
  analyticsScope: 'month',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  modalTxType: 'expense',
  editingTxId: null,
  pendingConfirmAction: null,
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, isError = false) {
  const region = document.getElementById('toastRegion');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' is-error' : ''}`;
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderActiveView() {
  const transactions = getTransactions();
  const monthlyLimit = getBudgetForMonth(state.activeMonthKey);

  if (state.activeView === 'dashboard') {
    renderDashboardView(transactions, state.activeMonthKey, monthlyLimit);
  } else if (state.activeView === 'transactions') {
    renderTransactionsView(transactions, state.txFilters);
  } else if (state.activeView === 'analytics') {
    renderAnalyticsView(transactions, state.analyticsScope, state.activeMonthKey);
  } else if (state.activeView === 'budget') {
    renderBudgetView(transactions, state.activeMonthKey, monthlyLimit);
  }

  refreshIcons();
}

function switchView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  state.activeView = viewName;

  document.querySelectorAll('.view-section').forEach((section) => {
    const isMatch = section.id === `view-${viewName}`;
    section.hidden = !isMatch;
    section.classList.toggle('is-active', isMatch);
  });

  document.querySelectorAll('.nav-item[data-nav]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-nav') === viewName;
    btn.classList.toggle('is-active', isMatch);
    if (isMatch) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  const topbarTitle = document.getElementById('topbarTitle');
  if (topbarTitle) {
    topbarTitle.textContent = VIEW_TITLES[viewName];
  }

  if (window.location.hash !== `#${viewName}`) {
    window.history.replaceState(null, '', `#${viewName}`);
  }

  closeMobileSidebar();
  renderActiveView();
}

/* ==========================================================================
   Mobile Sidebar Controls
   ========================================================================== */

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-open');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
}

/* ==========================================================================
   Add / Edit Transaction Modal
   ========================================================================== */

function populateCategorySelect(type, selectedCategory = '') {
  const select = document.getElementById('txCategoryInput');
  if (!select) return;

  const baseList = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const options = selectedCategory && !baseList.includes(selectedCategory)
    ? [selectedCategory, ...baseList]
    : baseList;

  select.innerHTML = options
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          cat === selectedCategory ? 'selected' : ''
        }>${escapeHtml(cat)}</option>`
    )
    .join('');
}

function setModalTxType(type, preserveCategory = '') {
  state.modalTxType = type === 'income' ? 'income' : 'expense';
  const expBtn = document.getElementById('txTypeExpenseBtn');
  const incBtn = document.getElementById('txTypeIncomeBtn');

  if (expBtn) expBtn.classList.toggle('is-active', state.modalTxType === 'expense');
  if (incBtn) incBtn.classList.toggle('is-active', state.modalTxType === 'income');

  populateCategorySelect(state.modalTxType, preserveCategory);
}

function clearTransactionFormErrors() {
  const fields = [
    ['txTitleInput', 'txTitleError'],
    ['txAmountInput', 'txAmountError'],
    ['txCategoryInput', 'txCategoryError'],
    ['txDateInput', 'txDateError'],
  ];
  for (const [inputId, errorId] of fields) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (input) input.removeAttribute('aria-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }
}

function showTransactionFormErrors(errors) {
  const map = {
    title: ['txTitleInput', 'txTitleError'],
    amount: ['txAmountInput', 'txAmountError'],
    category: ['txCategoryInput', 'txCategoryError'],
    date: ['txDateInput', 'txDateError'],
  };

  for (const [key, [inputId, errorId]] of Object.entries(map)) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (errors[key]) {
      if (input) input.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = errors[key];
        errorEl.hidden = false;
      }
    }
  }
}

function openTransactionModal(txToEdit = null) {
  const modal = document.getElementById('transactionModal');
  const modalTitle = document.getElementById('txModalTitle');
  const saveBtn = document.getElementById('saveTxBtn');
  const idInput = document.getElementById('txIdInput');
  const titleInput = document.getElementById('txTitleInput');
  const amountInput = document.getElementById('txAmountInput');
  const dateInput = document.getElementById('txDateInput');
  const descInput = document.getElementById('txDescriptionInput');

  if (!modal) return;
  clearTransactionFormErrors();

  if (txToEdit) {
    state.editingTxId = txToEdit.id;
    if (modalTitle) modalTitle.textContent = 'Edit Transaction';
    if (saveBtn) saveBtn.textContent = 'Update Transaction';
    if (idInput) idInput.value = txToEdit.id;
    if (titleInput) titleInput.value = txToEdit.title;
    if (amountInput) amountInput.value = String(txToEdit.amount);
    if (dateInput) dateInput.value = txToEdit.date;
    if (descInput) descInput.value = txToEdit.description || '';
    setModalTxType(txToEdit.type, txToEdit.category);
  } else {
    state.editingTxId = null;
    if (modalTitle) modalTitle.textContent = 'Add Transaction';
    if (saveBtn) saveBtn.textContent = 'Save Transaction';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = getTodayIsoDate();
    if (descInput) descInput.value = '';
    setModalTxType('expense');
  }

  modal.hidden = false;
  refreshIcons();
  window.setTimeout(() => {
    titleInput?.focus();
  }, 20);
}

function closeTransactionModal() {
  const modal = document.getElementById('transactionModal');
  if (modal) modal.hidden = true;
  state.editingTxId = null;
  clearTransactionFormErrors();
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  clearTransactionFormErrors();

  const rawInput = {
    type: state.modalTxType,
    title: document.getElementById('txTitleInput')?.value ?? '',
    amount: document.getElementById('txAmountInput')?.value ?? '',
    category: document.getElementById('txCategoryInput')?.value ?? '',
    date: document.getElementById('txDateInput')?.value ?? '',
    description: document.getElementById('txDescriptionInput')?.value ?? '',
  };

  const validation = validateTransactionInput(rawInput);
  if (!validation.isValid) {
    showTransactionFormErrors(validation.errors);
    return;
  }

  if (state.editingTxId) {
    updateTransaction(state.editingTxId, validation.sanitized);
    showToast('Transaction updated.');
  } else {
    addTransaction(validation.sanitized);
    showToast('Transaction added.');
  }

  closeTransactionModal();
  renderActiveView();
}

/* ==========================================================================
   Confirmation Modal (Replaces window.confirm)
   ========================================================================== */

function openConfirmModal({ title, message, confirmLabel = 'Confirm', isDanger = true, onConfirm }) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const acceptBtn = document.getElementById('acceptConfirmBtn');

  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (acceptBtn) {
    acceptBtn.textContent = confirmLabel;
    acceptBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  }

  state.pendingConfirmAction = onConfirm;
  modal.hidden = false;
  refreshIcons();
  window.setTimeout(() => acceptBtn?.focus(), 20);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.hidden = true;
  state.pendingConfirmAction = null;
}

/* ==========================================================================
   Budget Form Handler
   ========================================================================== */

function handleBudgetFormSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('budgetAmountInput');
  const errorEl = document.getElementById('budgetAmountError');
  if (!input || !errorEl) return;

  input.removeAttribute('aria-invalid');
  errorEl.textContent = '';
  errorEl.hidden = true;

  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = 'Enter a valid monthly budget greater than $0.00.';
    errorEl.hidden = false;
    input.focus();
    return;
  }

  if (value > 100000000) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = 'Budget limit exceeds maximum supported amount.';
    errorEl.hidden = false;
    input.focus();
    return;
  }

  saveBudget(state.activeMonthKey, value);
  showToast('Monthly budget saved.');
  renderActiveView();
}

/* ==========================================================================
   CSV Export
   ========================================================================== */

function handleExportCsv() {
  const transactions = getTransactions();
  const filtered = filterTransactions(transactions, {
    search: state.txFilters.search,
    type: state.txFilters.type,
    category: state.txFilters.category,
  });
  const sorted = sortTransactions(filtered, state.txFilters.sortBy);

  if (!sorted.length) {
    showToast('No transactions available to export.', true);
    return;
  }

  const csvContent = transactionsToCSV(sorted);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${getTodayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(`Exported ${sorted.length} transactions to CSV.`);
}

/* ==========================================================================
   Event Binding & Initialization
   ========================================================================== */

function bindEvents() {
  // Navigation buttons (sidebar & inline nav links)
  document.addEventListener('click', (event) => {
    const navTrigger = event.target.closest('[data-nav]');
    if (navTrigger) {
      event.preventDefault();
      const targetView = navTrigger.getAttribute('data-nav');
      if (targetView) switchView(targetView);
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const txId = actionEl.getAttribute('data-id');

    if (action === 'open-add-modal') {
      openTransactionModal(null);
    } else if (action === 'edit-tx' && txId) {
      const tx = getTransactions().find((item) => item.id === txId);
      if (tx) openTransactionModal(tx);
    } else if (action === 'delete-tx' && txId) {
      const tx = getTransactions().find((item) => item.id === txId);
      if (!tx) return;
      openConfirmModal({
        title: 'Delete Transaction',
        message: `Are you sure you want to delete "${tx.title}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        isDanger: true,
        onConfirm: () => {
          deleteTransaction(txId);
          showToast('Transaction deleted.');
          renderActiveView();
        },
      });
    }
  });

  // Mobile sidebar drawer
  document.getElementById('openSidebarBtn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('closeSidebarBtn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeMobileSidebar);

  // Topbar actions
  document.getElementById('addTransactionBtn')?.addEventListener('click', () => {
    openTransactionModal(null);
  });

  const monthInput = document.getElementById('globalMonthInput');
  if (monthInput) {
    monthInput.value = state.activeMonthKey;
    monthInput.addEventListener('change', (event) => {
      if (event.target.value) {
        state.activeMonthKey = event.target.value;
        renderActiveView();
      }
    });
  }

  // Dashboard "View all" button
  document.getElementById('dashViewAllBtn')?.addEventListener('click', () => {
    switchView('transactions');
  });

  // Transaction History filters
  document.getElementById('txSearchInput')?.addEventListener('input', (event) => {
    state.txFilters.search = event.target.value;
    renderActiveView();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-type-filter') || 'all';
      state.txFilters.type = val;
      document.querySelectorAll('[data-type-filter]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderActiveView();
    });
  });

  document.getElementById('txCategoryFilter')?.addEventListener('change', (event) => {
    state.txFilters.category = event.target.value;
    renderActiveView();
  });

  document.getElementById('txSortSelect')?.addEventListener('change', (event) => {
    state.txFilters.sortBy = event.target.value;
    renderActiveView();
  });

  document.getElementById('txResetFiltersBtn')?.addEventListener('click', () => {
    state.txFilters.search = '';
    state.txFilters.type = 'all';
    state.txFilters.category = 'all';

    const searchInput = document.getElementById('txSearchInput');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('[data-type-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-type-filter') === 'all');
    });
    const catSelect = document.getElementById('txCategoryFilter');
    if (catSelect) catSelect.value = 'all';

    renderActiveView();
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', handleExportCsv);

  // Analytics period toggle
  document.querySelectorAll('[data-analytics-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.analyticsScope = btn.getAttribute('data-analytics-scope') || 'month';
      document.querySelectorAll('[data-analytics-scope]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      renderActiveView();
    });
  });

  // Budget form
  document.getElementById('budgetForm')?.addEventListener('submit', handleBudgetFormSubmit);
  document.getElementById('budgetAmountInput')?.addEventListener('input', () => {
    const input = document.getElementById('budgetAmountInput');
    const errorEl = document.getElementById('budgetAmountError');
    input?.removeAttribute('aria-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  });

  // Transaction Modal events
  document.getElementById('txTypeExpenseBtn')?.addEventListener('click', () => {
    setModalTxType('expense');
  });
  document.getElementById('txTypeIncomeBtn')?.addEventListener('click', () => {
    setModalTxType('income');
  });
  document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionSubmit);
  document.getElementById('closeTxModalBtn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('cancelTxModalBtn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transactionModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'transactionModal') {
      closeTransactionModal();
    }
  });

  // Clear field errors while typing
  ['txTitleInput', 'txAmountInput', 'txCategoryInput', 'txDateInput'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      clearTransactionFormErrors();
    });
  });

  // Confirmation Modal events
  document.getElementById('closeConfirmModalBtn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('cancelConfirmBtn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('acceptConfirmBtn')?.addEventListener('click', () => {
    const fn = state.pendingConfirmAction;
    closeConfirmModal();
    if (typeof fn === 'function') fn();
  });
  document.getElementById('confirmModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'confirmModal') {
      closeConfirmModal();
    }
  });

  // Sidebar Data Controls
  document.getElementById('resetDemoBtn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Restore Sample Data',
      message:
        'Replace your current ledger records and budget with the default sample dataset?',
      confirmLabel: 'Restore Sample Data',
      isDanger: false,
      onConfirm: () => {
        resetSampleData();
        state.activeMonthKey = getCurrentMonthKey();
        const mInput = document.getElementById('globalMonthInput');
        if (mInput) mInput.value = state.activeMonthKey;
        showToast('Sample dataset restored.');
        renderActiveView();
      },
    });
  });

  document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Clear All Records',
      message:
        'Remove all transactions and reset your monthly budget to $0.00? You can restore sample data at any time.',
      confirmLabel: 'Clear All Records',
      isDanger: true,
      onConfirm: () => {
        clearAllData();
        showToast('All records cleared.');
        renderActiveView();
      },
    });
  });

  // Escape key closes modals or mobile drawer
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTransactionModal();
      closeConfirmModal();
      closeMobileSidebar();
    }
  });
}

function initApp() {
  initStorage();
  bindEvents();

  const hashView = window.location.hash.replace('#', '').trim();
  const initialView = VIEW_TITLES[hashView] ? hashView : 'dashboard';
  switchView(initialView);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
