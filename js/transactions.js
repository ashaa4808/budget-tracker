/**
 * transactions.js — Pure Financial Calculations, Validation & Transaction History View
 *
 * All calculation helpers accept arrays of transactions directly and remain
 * completely decoupled from LocalStorage.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Travel',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Gift',
  'Refund',
  'Other',
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric value as USD currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return currencyFormatter.format(safe);
}

/**
 * Extracts YYYY-MM from a YYYY-MM-DD date string.
 * @param {string} dateStr
 * @returns {string}
 */
export function getMonthKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.slice(0, 7);
}

/**
 * Formats YYYY-MM into a human-readable label (e.g., "November 2026").
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Selected Month';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Formats YYYY-MM-DD into a compact display date (e.g., "Nov 13, 2026").
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Escapes HTML special characters to prevent XSS in template literals.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes dynamic totals across a list of transactions.
 * Total Balance = Total Income - Total Expenses.
 * @param {Array<Object>} transactions
 */
export function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amount;
      incomeCount += 1;
    } else {
      totalExpenses += amount;
      expenseCount += 1;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    incomeCount,
    expenseCount,
  };
}

/**
 * Filters transactions by search text, type, category, and optional monthKey.
 * @param {Array<Object>} transactions
 * @param {Object} filters
 */
export function filterTransactions(transactions, filters = {}) {
  const query = (filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const category = filters.category || 'all';
  const monthKey = filters.monthKey || 'all';

  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (monthKey !== 'all' && getMonthKey(tx.date) !== monthKey) return false;

    if (query) {
      const haystack = `${tx.title} ${tx.category} ${tx.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/**
 * Sorts transactions by date or amount without mutating the source array.
 * @param {Array<Object>} transactions
 * @param {string} sortBy
 * @returns {Array<Object>}
 */
export function sortTransactions(transactions, sortBy = 'date-desc') {
  const copy = [...transactions];
  copy.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });
  return copy;
}

/**
 * Validates form input for creating or updating a transaction.
 * @param {Object} input
 */
export function validateTransactionInput(input) {
  const errors = {};
  const title = String(input.title || '').trim();
  const amount = Number(input.amount);
  const category = String(input.category || '').trim();
  const type = input.type === 'income' ? 'income' : 'expense';
  const date = String(input.date || '').trim();
  const description = String(input.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum supported limit.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      title,
      amount: Number(amount.toFixed(2)),
      category,
      type,
      date,
      description,
    },
  };
}

/**
 * Serializes transactions into RFC-4180 CSV string.
 * @param {Array<Object>} transactions
 * @returns {string}
 */
export function transactionsToCSV(transactions) {
  const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const escapeCsv = (val) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = transactions.map((tx) =>
    [tx.id, tx.date, tx.title, tx.type, tx.category, tx.amount.toFixed(2), tx.description]
      .map(escapeCsv)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Builds the HTML for a reusable transaction table (used on Dashboard & Transactions views).
 * @param {Array<Object>} transactions
 * @param {{ showActions?: boolean, emptyTitle?: string, emptyMessage?: string, showEmptyCta?: boolean }} options
 * @returns {string}
 */
export function renderTransactionTableMarkup(transactions, options = {}) {
  const {
    showActions = true,
    emptyTitle = 'No transactions found',
    emptyMessage = 'Add an income or expense entry to start tracking your ledger.',
    showEmptyCta = true,
  } = options;

  if (!transactions.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="receipt"></i>
        </div>
        <h3 class="empty-state-title">${escapeHtml(emptyTitle)}</h3>
        <p class="empty-state-text">${escapeHtml(emptyMessage)}</p>
        ${
          showEmptyCta
            ? `<button type="button" class="btn btn-primary btn-sm" data-action="open-add-modal">
                 <i data-lucide="plus"></i>
                 <span>Add Transaction</span>
               </button>`
            : ''
        }
      </div>
    `;
  }

  const rowsHtml = transactions
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const typeClass = isIncome ? 'is-income' : 'is-expense';

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td>
            <div class="tx-title-cell">
              <span class="tx-title-text">${escapeHtml(tx.title)}</span>
              ${
                tx.description
                  ? `<span class="tx-desc-text" title="${escapeHtml(tx.description)}">${escapeHtml(
                      tx.description
                    )}</span>`
                  : ''
              }
            </div>
          </td>
          <td>${escapeHtml(tx.category)}</td>
          <td><span class="tx-type-text ${typeClass}">${typeLabel}</span></td>
          <td class="tabular-nums">${escapeHtml(formatDateDisplay(tx.date))}</td>
          <td class="col-right tabular-nums tx-amount-cell ${amountClass}">
            ${sign}${escapeHtml(formatCurrency(tx.amount))}
          </td>
          ${
            showActions
              ? `
            <td class="col-right">
              <div class="tx-actions-cell">
                <button
                  type="button"
                  class="icon-btn"
                  data-action="edit-tx"
                  data-id="${escapeHtml(tx.id)}"
                  aria-label="Edit ${escapeHtml(tx.title)}"
                  title="Edit transaction"
                >
                  <i data-lucide="pencil"></i>
                </button>
                <button
                  type="button"
                  class="icon-btn is-danger"
                  data-action="delete-tx"
                  data-id="${escapeHtml(tx.id)}"
                  aria-label="Delete ${escapeHtml(tx.title)}"
                  title="Delete transaction"
                >
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          `
              : ''
          }
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th>Date</th>
            <th class="col-right">Amount</th>
            ${showActions ? '<th class="col-right">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renders the Transaction History view with live filters, search, and sorting.
 * @param {Array<Object>} allTransactions
 * @param {Object} filterState
 */
export function renderTransactionsView(allTransactions, filterState) {
  const categorySelect = document.getElementById('txCategoryFilter');
  const summaryEl = document.getElementById('txFilterSummary');
  const resetBtn = document.getElementById('txResetFiltersBtn');
  const listContainer = document.getElementById('txListContainer');

  if (!listContainer) return;

  // Populate category dropdown dynamically while preserving current selection
  if (categorySelect) {
    const categoriesSet = new Set([
      ...EXPENSE_CATEGORIES,
      ...INCOME_CATEGORIES,
      ...allTransactions.map((tx) => tx.category),
    ]);
    const sortedCats = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
    const currentCat = filterState.category || 'all';

    categorySelect.innerHTML = [
      '<option value="all">All Categories</option>',
      ...sortedCats.map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${
            cat === currentCat ? 'selected' : ''
          }>${escapeHtml(cat)}</option>`
      ),
    ].join('');
  }

  const filtered = filterTransactions(allTransactions, {
    search: filterState.search,
    type: filterState.type,
    category: filterState.category,
  });
  const sorted = sortTransactions(filtered, filterState.sortBy);
  const totals = calculateTotals(sorted);

  const hasActiveFilters =
    Boolean(filterState.search?.trim()) ||
    filterState.type !== 'all' ||
    filterState.category !== 'all';

  if (summaryEl) {
    const countLabel = sorted.length === 1 ? '1 transaction' : `${sorted.length} transactions`;
    const netSign = totals.totalBalance >= 0 ? '+' : '-';
    summaryEl.textContent = `${countLabel} · Net ${netSign}${formatCurrency(
      Math.abs(totals.totalBalance)
    )}`;
  }

  if (resetBtn) {
    resetBtn.hidden = !hasActiveFilters;
  }

  if (!allTransactions.length) {
    listContainer.innerHTML = renderTransactionTableMarkup([], {
      emptyTitle: 'No transactions recorded yet',
      emptyMessage: 'Add your first income or expense record to build your financial ledger.',
      showEmptyCta: true,
    });
  } else if (!sorted.length) {
    listContainer.innerHTML = renderTransactionTableMarkup([], {
      emptyTitle: 'No matching transactions',
      emptyMessage: 'Try adjusting your search keywords, transaction type, or category filter.',
      showEmptyCta: false,
    });
  } else {
    listContainer.innerHTML = renderTransactionTableMarkup(sorted, { showActions: true });
  }
}
