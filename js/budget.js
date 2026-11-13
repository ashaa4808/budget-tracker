/**
 * budget.js — Budget Calculations & Budget Management View
 *
 * Pure budget calculations are independent of storage so they work seamlessly
 * with either LocalStorage or future REST API responses.
 */

import {
  calculateTotals,
  escapeHtml,
  filterTransactions,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

/**
 * Computes monthly budget metrics and threshold states (80% warning, >100% exceeded).
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 * @param {number} monthlyLimit
 */
export function calculateBudgetStatus(transactions, monthKey, monthlyLimit) {
  const monthExpenses = filterTransactions(transactions, {
    monthKey,
    type: 'expense',
  });
  const { totalExpenses: spent } = calculateTotals(monthExpenses);
  const limit = Math.max(0, Number(monthlyLimit) || 0);

  if (limit <= 0) {
    return {
      limit: 0,
      spent,
      remaining: 0,
      overage: 0,
      utilizationPct: 0,
      status: 'unset',
      expenses: monthExpenses,
    };
  }

  const remaining = limit - spent;
  const utilizationPct = (spent / limit) * 100;
  const overage = spent > limit ? spent - limit : 0;

  let status = 'nominal';
  if (spent > limit) {
    status = 'exceeded';
  } else if (utilizationPct >= 80) {
    status = 'warning';
  }

  return {
    limit,
    spent,
    remaining,
    overage,
    utilizationPct,
    status,
    expenses: monthExpenses,
  };
}

/**
 * Aggregates monthly expenses by category for budget driver visualization.
 * @param {Array<Object>} monthExpenses
 * @param {number} referenceTotal
 */
export function getBudgetExpenseDrivers(monthExpenses, referenceTotal) {
  const map = new Map();
  for (const tx of monthExpenses) {
    const prev = map.get(tx.category) || { category: tx.category, amount: 0, count: 0 };
    prev.amount += Number(tx.amount) || 0;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  const denominator = referenceTotal > 0 ? referenceTotal : 1;
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      pctOfLimit: (item.amount / denominator) * 100,
    }));
}

/**
 * Generates accessible alert banner HTML for budget threshold states.
 * Uses explicit icons + text labels (never hue-only signaling).
 * @param {Object} statusInfo
 * @param {string} monthKey
 * @param {{ showActionLink?: boolean }} options
 * @returns {string}
 */
export function buildBudgetBannerMarkup(statusInfo, monthKey, options = {}) {
  const { showActionLink = false } = options;
  const monthLabel = formatMonthLabel(monthKey);

  if (statusInfo.status === 'unset') {
    return `
      <div class="alert-banner" role="status">
        <div class="alert-banner-content">
          <i data-lucide="info"></i>
          <div>
            <span class="alert-banner-title">No monthly budget configured for ${escapeHtml(
              monthLabel
            )}.</span>
            <span class="alert-banner-text">Set a spending limit to enable threshold tracking and alerts.</span>
          </div>
        </div>
        ${
          showActionLink
            ? `<button type="button" class="btn btn-secondary btn-sm" data-nav="budget">Set Budget</button>`
            : ''
        }
      </div>
    `;
  }

  if (statusInfo.status === 'exceeded') {
    return `
      <div class="alert-banner is-danger" role="alert">
        <div class="alert-banner-content">
          <i data-lucide="alert-circle"></i>
          <div>
            <span class="alert-banner-title">Budget Exceeded (${statusInfo.utilizationPct.toFixed(
              1
            )}%)</span>
            <span class="alert-banner-text">
              Spending for ${escapeHtml(monthLabel)} is over your ${escapeHtml(
                formatCurrency(statusInfo.limit)
              )} limit by ${escapeHtml(formatCurrency(statusInfo.overage))}.
            </span>
          </div>
        </div>
        ${
          showActionLink
            ? `<button type="button" class="btn btn-secondary btn-sm" data-nav="budget">Review Budget</button>`
            : ''
        }
      </div>
    `;
  }

  if (statusInfo.status === 'warning') {
    return `
      <div class="alert-banner is-warning" role="status">
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle"></i>
          <div>
            <span class="alert-banner-title">Approaching Budget Limit (${statusInfo.utilizationPct.toFixed(
              1
            )}%)</span>
            <span class="alert-banner-text">
              You have used over 80% of your ${escapeHtml(monthLabel)} budget. ${escapeHtml(
                formatCurrency(statusInfo.remaining)
              )} remaining.
            </span>
          </div>
        </div>
        ${
          showActionLink
            ? `<button type="button" class="btn btn-secondary btn-sm" data-nav="budget">Manage Budget</button>`
            : ''
        }
      </div>
    `;
  }

  return `
    <div class="alert-banner is-nominal" role="status">
      <div class="alert-banner-content">
        <i data-lucide="check-circle-2"></i>
        <div>
          <span class="alert-banner-title">On Track (${statusInfo.utilizationPct.toFixed(
            1
          )}% Used)</span>
          <span class="alert-banner-text">
            ${escapeHtml(formatCurrency(statusInfo.remaining))} remaining out of your ${escapeHtml(
              formatCurrency(statusInfo.limit)
            )} budget for ${escapeHtml(monthLabel)}.
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Budget Management view.
 * @param {Array<Object>} transactions
 * @param {string} activeMonthKey
 * @param {number} monthlyLimit
 */
export function renderBudgetView(transactions, activeMonthKey, monthlyLimit) {
  const alertContainer = document.getElementById('budgetAlertContainer');
  const subtitleEl = document.getElementById('budgetMonthSubtitle');
  const amountInput = document.getElementById('budgetAmountInput');
  const utilizationText = document.getElementById('budgetUtilizationText');
  const progressTrack = document.getElementById('budgetProgressTrack');
  const progressFill = document.getElementById('budgetProgressFill');
  const limitValueEl = document.getElementById('budgetLimitValue');
  const spentValueEl = document.getElementById('budgetSpentValue');
  const remainingLabelEl = document.getElementById('budgetRemainingLabel');
  const remainingValueEl = document.getElementById('budgetRemainingValue');
  const driversContainer = document.getElementById('budgetDriversContainer');

  const statusInfo = calculateBudgetStatus(transactions, activeMonthKey, monthlyLimit);
  const monthLabel = formatMonthLabel(activeMonthKey);

  if (subtitleEl) {
    subtitleEl.textContent = `Spending limit and tracking for ${monthLabel}`;
  }

  if (alertContainer) {
    alertContainer.innerHTML = buildBudgetBannerMarkup(statusInfo, activeMonthKey, {
      showActionLink: false,
    });
  }

  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = statusInfo.limit > 0 ? String(statusInfo.limit) : '';
  }

  const clampedWidth = Math.min(100, Math.max(0, statusInfo.utilizationPct));
  if (utilizationText) {
    utilizationText.textContent =
      statusInfo.limit > 0 ? `${statusInfo.utilizationPct.toFixed(1)}%` : '—';
  }

  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', String(Math.round(statusInfo.utilizationPct)));
  }

  if (progressFill) {
    progressFill.style.width = `${clampedWidth}%`;
    progressFill.classList.remove('is-warning', 'is-danger');
    if (statusInfo.status === 'exceeded') {
      progressFill.classList.add('is-danger');
    } else if (statusInfo.status === 'warning') {
      progressFill.classList.add('is-warning');
    }
  }

  if (limitValueEl) {
    limitValueEl.textContent = statusInfo.limit > 0 ? formatCurrency(statusInfo.limit) : 'Not set';
  }

  if (spentValueEl) {
    spentValueEl.textContent = formatCurrency(statusInfo.spent);
  }

  if (remainingLabelEl && remainingValueEl) {
    if (statusInfo.limit <= 0) {
      remainingLabelEl.textContent = 'Remaining Budget';
      remainingValueEl.textContent = '—';
      remainingValueEl.className = 'budget-stat-value tabular-nums';
    } else if (statusInfo.remaining < 0) {
      remainingLabelEl.textContent = 'Over Budget By';
      remainingValueEl.textContent = formatCurrency(Math.abs(statusInfo.remaining));
      remainingValueEl.className = 'budget-stat-value tabular-nums text-danger';
    } else {
      remainingLabelEl.textContent = 'Remaining Budget';
      remainingValueEl.textContent = formatCurrency(statusInfo.remaining);
      remainingValueEl.className =
        statusInfo.status === 'warning'
          ? 'budget-stat-value tabular-nums text-warning'
          : 'budget-stat-value tabular-nums text-income';
    }
  }

  if (driversContainer) {
    const drivers = getBudgetExpenseDrivers(
      statusInfo.expenses,
      statusInfo.limit > 0 ? statusInfo.limit : statusInfo.spent
    );

    if (!drivers.length) {
      driversContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i data-lucide="pie-chart"></i>
          </div>
          <h3 class="empty-state-title">No expenses for ${escapeHtml(monthLabel)}</h3>
          <p class="empty-state-text">
            Recorded expenses in this period will appear here ranked by category impact.
          </p>
        </div>
      `;
    } else {
      driversContainer.innerHTML = `
        <div class="drivers-list">
          ${drivers
            .map((driver) => {
              const barPct = Math.min(100, Math.max(2, driver.pctOfLimit));
              const shareLabel =
                statusInfo.limit > 0
                  ? `${driver.pctOfLimit.toFixed(1)}% of budget`
                  : `${driver.pctOfLimit.toFixed(1)}% of spend`;
              return `
                <div class="driver-item">
                  <div class="driver-row">
                    <span class="driver-name">${escapeHtml(driver.category)}</span>
                    <span class="tabular-nums">${escapeHtml(formatCurrency(driver.amount))}</span>
                  </div>
                  <div class="driver-track">
                    <div class="driver-fill" style="width: ${barPct.toFixed(1)}%"></div>
                  </div>
                  <div class="driver-row">
                    <span class="driver-meta">${driver.count} ${
                      driver.count === 1 ? 'entry' : 'entries'
                    }</span>
                    <span class="driver-meta tabular-nums">${escapeHtml(shareLabel)}</span>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }
}
