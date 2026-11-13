/**
 * storage.js — Centralized Data Access Layer (LocalStorage)
 *
 * Designed so that all persistence operations are isolated from UI and
 * calculation logic. When migrating to Node.js / Express.js / SQL, replace
 * the implementations in this module with async fetch() calls to REST endpoints
 * (e.g. GET/POST/PUT/DELETE /api/transactions and GET/PUT /api/budget).
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

/**
 * Generates a unique identifier for a transaction.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID()}`;
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns YYYY-MM-DD formatted string for a Date offset by months and days.
 * @param {number} monthOffset
 * @param {number} dayOfMonth
 * @returns {string}
 */
function buildRelativeDate(monthOffset, dayOfMonth) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, dayOfMonth), lastDay);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(clampedDay).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds realistic initial sample transactions anchored around the user's current month.
 * @returns {Array<Object>}
 */
function createSeedTransactions() {
  const todayDay = Math.min(new Date().getDate(), 28);

  return [
    // Current Month (monthOffset = 0)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 184.6,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(0, Math.max(3, todayDay - 6)),
      description: 'Weekly produce and pantry essentials',
    },
    {
      id: generateId(),
      title: 'Electric & Fiber Internet',
      amount: 148.25,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(0, Math.max(4, todayDay - 4)),
      description: 'Monthly utility and broadband bill',
    },
    {
      id: generateId(),
      title: 'UI Audit Consulting',
      amount: 850.0,
      category: 'Freelance',
      type: 'income',
      date: buildRelativeDate(0, Math.max(5, todayDay - 3)),
      description: 'Client design system review',
    },
    {
      id: generateId(),
      title: 'Transit Pass & Fuel',
      amount: 96.4,
      category: 'Transportation',
      type: 'expense',
      date: buildRelativeDate(0, Math.max(5, todayDay - 2)),
      description: 'Monthly commuter pass and fuel top-up',
    },
    {
      id: generateId(),
      title: 'Pharmacy & Dental Checkup',
      amount: 132.0,
      category: 'Healthcare',
      type: 'expense',
      date: buildRelativeDate(0, Math.max(6, todayDay - 1)),
      description: 'Routine checkup copay and prescriptions',
    },
    {
      id: generateId(),
      title: 'Team Dinner & Coffee',
      amount: 74.5,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(0, todayDay),
      description: 'Lunch and coffee meetings',
    },
    {
      id: generateId(),
      title: 'Workspace Desk Lamp',
      amount: 118.0,
      category: 'Shopping',
      type: 'expense',
      date: buildRelativeDate(0, todayDay),
      description: 'Home office lighting upgrade',
    },

    // Previous Month (-1)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery & Market Run',
      amount: 342.15,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-1, 9),
      description: 'Groceries across two weeks',
    },
    {
      id: generateId(),
      title: 'Electric & Water',
      amount: 139.8,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(-1, 14),
      description: 'Monthly utility invoice',
    },
    {
      id: generateId(),
      title: 'Online Course Subscription',
      amount: 89.0,
      category: 'Education',
      type: 'expense',
      date: buildRelativeDate(-1, 18),
      description: 'Annual technical workshop access',
    },
    {
      id: generateId(),
      title: 'Dividend Payout',
      amount: 215.4,
      category: 'Investments',
      type: 'income',
      date: buildRelativeDate(-1, 22),
      description: 'Quarterly index ETF dividend',
    },

    // Two Months Ago (-2)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Weekend Rail Trip',
      amount: 285.0,
      category: 'Travel',
      type: 'expense',
      date: buildRelativeDate(-2, 12),
      description: 'Round-trip train tickets and hotel',
    },
    {
      id: generateId(),
      title: 'Groceries & Dining',
      amount: 410.75,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-2, 19),
      description: 'Monthly food and dining total',
    },

    // Three Months Ago (-3)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Freelance Web Prototype',
      amount: 600.0,
      category: 'Freelance',
      type: 'income',
      date: buildRelativeDate(-3, 15),
      description: 'Landing page build',
    },
    {
      id: generateId(),
      title: 'Utilities & Streaming',
      amount: 192.3,
      category: 'Utilities',
      type: 'expense',
      date: buildRelativeDate(-3, 20),
      description: 'Power, water, and media subscriptions',
    },

    // Four Months Ago (-4)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-4, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-4, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Household',
      amount: 378.4,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-4, 14),
      description: 'Monthly groceries and supplies',
    },
    {
      id: generateId(),
      title: 'Concert & Cinema',
      amount: 112.0,
      category: 'Entertainment',
      type: 'expense',
      date: buildRelativeDate(-4, 23),
      description: 'Weekend event tickets',
    },

    // Five Months Ago (-5)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200.0,
      category: 'Salary',
      type: 'income',
      date: buildRelativeDate(-5, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650.0,
      category: 'Housing',
      type: 'expense',
      date: buildRelativeDate(-5, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Pantry',
      amount: 356.2,
      category: 'Food',
      type: 'expense',
      date: buildRelativeDate(-5, 16),
      description: 'Monthly food shopping',
    },
  ];
}

function createSeedBudget() {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    defaultLimit: 2800,
    monthlyOverrides: {
      [currentMonthKey]: 2800,
    },
  };
}

/**
 * Normalizes a transaction record to guarantee consistent schema.
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeTransaction(raw) {
  return {
    id: String(raw.id || generateId()),
    title: String(raw.title || '').trim(),
    amount: Number(Number(raw.amount || 0).toFixed(2)),
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || ''),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Initializes LocalStorage on first visit with sample data.
 */
export function initStorage() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const seedTransactions = createSeedTransactions();
      const seedBudget = createSeedBudget();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(seedTransactions));
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(seedBudget));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (err) {
    console.error('Failed to initialize storage:', err);
  }
}

/**
 * Retrieves all stored transactions.
 * Future REST equivalent: GET /api/transactions
 * @returns {Array<Object>}
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction);
  } catch (err) {
    console.error('Failed to read transactions from storage:', err);
    return [];
  }
}

/**
 * Persists the entire transactions array to LocalStorage.
 * @param {Array<Object>} transactions
 * @returns {Array<Object>}
 */
export function saveTransactions(transactions) {
  const normalized = Array.isArray(transactions) ? transactions.map(normalizeTransaction) : [];
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
  } catch (err) {
    console.error('Failed to save transactions:', err);
  }
  return normalized;
}

/**
 * Adds a new transaction and returns the created record.
 * Future REST equivalent: POST /api/transactions
 * @param {Object} txData
 * @returns {Object}
 */
export function addTransaction(txData) {
  const existing = getTransactions();
  const created = normalizeTransaction({
    ...txData,
    id: generateId(),
  });
  existing.unshift(created);
  saveTransactions(existing);
  return created;
}

/**
 * Updates an existing transaction by ID.
 * Future REST equivalent: PUT /api/transactions/:id
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateTransaction(id, updates) {
  const existing = getTransactions();
  const idx = existing.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const updated = normalizeTransaction({
    ...existing[idx],
    ...updates,
    id: existing[idx].id,
  });
  existing[idx] = updated;
  saveTransactions(existing);
  return updated;
}

/**
 * Deletes a transaction by ID.
 * Future REST equivalent: DELETE /api/transactions/:id
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTransaction(id) {
  const existing = getTransactions();
  const filtered = existing.filter((item) => item.id !== id);
  if (filtered.length === existing.length) return false;
  saveTransactions(filtered);
  return true;
}

/**
 * Retrieves full budget configuration object.
 * Future REST equivalent: GET /api/budget
 * @returns {{ defaultLimit: number, monthlyOverrides: Record<string, number> }}
 */
export function getBudgetConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { defaultLimit: 0, monthlyOverrides: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      defaultLimit: Number(parsed?.defaultLimit) || 0,
      monthlyOverrides:
        parsed?.monthlyOverrides && typeof parsed.monthlyOverrides === 'object'
          ? parsed.monthlyOverrides
          : {},
    };
  } catch (err) {
    console.error('Failed to read budget config:', err);
    return { defaultLimit: 0, monthlyOverrides: {} };
  }
}

/**
 * Retrieves the monthly budget limit for a specific YYYY-MM key.
 * @param {string} monthKey
 * @returns {number}
 */
export function getBudgetForMonth(monthKey) {
  const config = getBudgetConfig();
  if (
    monthKey &&
    Object.prototype.hasOwnProperty.call(config.monthlyOverrides, monthKey)
  ) {
    return Number(config.monthlyOverrides[monthKey]) || 0;
  }
  return Number(config.defaultLimit) || 0;
}

/**
 * Saves monthly budget limit for a specific month (and updates default if unset).
 * Future REST equivalent: PUT /api/budget
 * @param {string} monthKey
 * @param {number} amount
 */
export function saveBudget(monthKey, amount) {
  const numericAmount = Number(Number(amount).toFixed(2));
  const config = getBudgetConfig();
  const next = {
    defaultLimit: config.defaultLimit > 0 ? config.defaultLimit : numericAmount,
    monthlyOverrides: {
      ...config.monthlyOverrides,
      [monthKey]: numericAmount,
    },
  };
  try {
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save budget:', err);
  }
  return next;
}

/**
 * Clears all transactions and budget settings (keeps initialized flag so demo doesn't auto-reseed).
 */
export function clearAllData() {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(
      STORAGE_KEYS.BUDGET,
      JSON.stringify({ defaultLimit: 0, monthlyOverrides: {} })
    );
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Failed to clear data:', err);
  }
}

/**
 * Restores the curated sample dataset and budget.
 */
export function resetSampleData() {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(createSeedTransactions()));
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(createSeedBudget()));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Failed to reset sample data:', err);
  }
}
