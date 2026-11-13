/**
 * analytics.js — Expense Analytics Calculations & Dynamic Charts
 */

import {
  calculateCategoryBreakdown,
  getDailyMonthSeries,
  syncChartEmptyState,
} from './dashboard.js';
import {
  calculateTotals,
  escapeHtml,
  filterTransactions,
  formatCurrency,
  formatMonthLabel,
  getMonthKey,
} from './transactions.js';

let monthlyChartInstance = null;
let analyticsCategoryChartInstance = null;
let distributionChartInstance = null;

/**
 * Generates a 6-month Income vs. Expenses comparison series ending at anchorMonthKey.
 * @param {Array<Object>} transactions
 * @param {string} anchorMonthKey
 * @param {number} monthsCount
 */
export function getMonthlyComparisonSeries(transactions, anchorMonthKey, monthsCount = 6) {
  const [anchorYear, anchorMonth] = anchorMonthKey.split('-').map(Number);
  const buckets = [];

  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(anchorYear, anchorMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    buckets.push({ monthKey: key, label, income: 0, expenses: 0 });
  }

  const bucketMap = new Map(buckets.map((b) => [b.monthKey, b]));
  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    const bucket = bucketMap.get(key);
    if (bucket) {
      if (tx.type === 'income') {
        bucket.income += Number(tx.amount) || 0;
      } else {
        bucket.expenses += Number(tx.amount) || 0;
      }
    }
  }

  return buckets;
}

/**
 * Computes analytics KPIs for the chosen scope ('month' or 'all').
 * @param {Array<Object>} transactions
 * @param {'month'|'all'} scope
 * @param {string} activeMonthKey
 */
export function calculateAnalyticsSummary(transactions, scope, activeMonthKey) {
  const scopedTransactions =
    scope === 'month'
      ? filterTransactions(transactions, { monthKey: activeMonthKey })
      : transactions;

  const totals = calculateTotals(scopedTransactions);
  const totalSavings = totals.totalIncome - totals.totalExpenses;
  const savingsRate = totals.totalIncome > 0 ? (totalSavings / totals.totalIncome) * 100 : 0;
  const categoryBreakdown = calculateCategoryBreakdown(scopedTransactions);
  const highestCategory = categoryBreakdown[0] || null;

  return {
    scopedTransactions,
    ...totals,
    totalSavings,
    savingsRate,
    categoryBreakdown,
    highestCategory,
  };
}

/**
 * Renders the Analytics view: KPIs, 3 Chart.js charts, and ranked category table.
 * @param {Array<Object>} transactions
 * @param {'month'|'all'} scope
 * @param {string} activeMonthKey
 */
export function renderAnalyticsView(transactions, scope, activeMonthKey) {
  const summary = calculateAnalyticsSummary(transactions, scope, activeMonthKey);
  const periodLabel = scope === 'month' ? formatMonthLabel(activeMonthKey) : 'All Recorded Time';

  const subtitleEl = document.getElementById('analyticsSubtitle');
  const savingsEl = document.getElementById('analyticsTotalSavings');
  const savingsRateEl = document.getElementById('analyticsSavingsRate');
  const topCatEl = document.getElementById('analyticsTopCategory');
  const topCatAmountEl = document.getElementById('analyticsTopCategoryAmount');
  const topCatShareEl = document.getElementById('analyticsTopCategoryShare');
  const periodIncomeEl = document.getElementById('analyticsPeriodIncome');
  const periodExpensesEl = document.getElementById('analyticsPeriodExpenses');
  const incomeMetaEl = document.getElementById('analyticsIncomeMeta');
  const expenseMetaEl = document.getElementById('analyticsExpenseMeta');
  const distSubtitleEl = document.getElementById('analyticsDistributionSubtitle');

  if (subtitleEl) {
    subtitleEl.textContent = `Spending and savings performance · ${periodLabel}`;
  }

  if (savingsEl) {
    savingsEl.textContent = formatCurrency(summary.totalSavings);
    savingsEl.className = `kpi-value tabular-nums ${
      summary.totalSavings >= 0 ? 'text-income' : 'text-danger'
    }`;
  }
  if (savingsRateEl) {
    savingsRateEl.textContent =
      summary.totalIncome > 0
        ? `${summary.savingsRate.toFixed(1)}% savings rate`
        : 'No income in period';
  }

  if (topCatEl && topCatAmountEl && topCatShareEl) {
    if (summary.highestCategory) {
      topCatEl.textContent = summary.highestCategory.category;
      topCatAmountEl.textContent = formatCurrency(summary.highestCategory.amount);
      topCatShareEl.textContent = `${summary.highestCategory.percentage.toFixed(
        1
      )}% of total expenses`;
    } else {
      topCatEl.textContent = '—';
      topCatAmountEl.textContent = '$0.00';
      topCatShareEl.textContent = 'No expenses recorded';
    }
  }

  if (periodIncomeEl) periodIncomeEl.textContent = formatCurrency(summary.totalIncome);
  if (periodExpensesEl) periodExpensesEl.textContent = formatCurrency(summary.totalExpenses);
  if (incomeMetaEl) {
    incomeMetaEl.textContent = `${summary.incomeCount} ${
      summary.incomeCount === 1 ? 'entry' : 'entries'
    }`;
  }
  if (expenseMetaEl) {
    expenseMetaEl.textContent = `${summary.expenseCount} ${
      summary.expenseCount === 1 ? 'entry' : 'entries'
    }`;
  }
  if (distSubtitleEl) {
    distSubtitleEl.textContent =
      scope === 'month'
        ? `Daily spending trend across ${formatMonthLabel(activeMonthKey)}`
        : 'Monthly spending trend over the last 6 months';
  }

  renderMonthlyComparisonChart(transactions, activeMonthKey);
  renderAnalyticsCategoryChart(summary.categoryBreakdown);
  renderSpendingDistributionChart(transactions, scope, activeMonthKey);
  renderCategoryRankingTable(summary.categoryBreakdown);
}

function renderMonthlyComparisonChart(transactions, activeMonthKey) {
  const container = document.getElementById('analyticsMonthlyChartBox');
  const canvas = document.getElementById('analyticsMonthlyChart');
  if (!container || !canvas || typeof window.Chart === 'undefined') return;

  const series = getMonthlyComparisonSeries(transactions, activeMonthKey, 6);
  const hasAnyValue = series.some((m) => m.income > 0 || m.expenses > 0);

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
    monthlyChartInstance = null;
  }

  if (!hasAnyValue) {
    syncChartEmptyState(
      container,
      canvas,
      true,
      'No 6-month cashflow data',
      'Add income or expense entries to compare monthly trends.'
    );
    return;
  }

  syncChartEmptyState(container, canvas, false, '', '');

  monthlyChartInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.map((m) => m.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((m) => m.income),
          backgroundColor: '#16A34A',
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: 'Expenses',
          data: series.map((m) => m.expenses),
          backgroundColor: '#0F766E',
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#475569',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
      },
    },
  });
}

function renderAnalyticsCategoryChart(breakdown) {
  const container = document.getElementById('analyticsCategoryChartBox');
  const canvas = document.getElementById('analyticsCategoryChart');
  if (!container || !canvas || typeof window.Chart === 'undefined') return;

  if (analyticsCategoryChartInstance) {
    analyticsCategoryChartInstance.destroy();
    analyticsCategoryChartInstance = null;
  }

  if (!breakdown.length) {
    syncChartEmptyState(
      container,
      canvas,
      true,
      'No expenses to categorize',
      'Expense entries for this period will appear grouped by category.'
    );
    return;
  }

  syncChartEmptyState(container, canvas, false, '', '');

  analyticsCategoryChartInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((item) => item.category),
      datasets: [
        {
          data: breakdown.map((item) => item.amount),
          backgroundColor: breakdown.map((item) => item.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#334155',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(
                1
              )}%)`;
            },
          },
        },
      },
    },
  });
}

function renderSpendingDistributionChart(transactions, scope, activeMonthKey) {
  const container = document.getElementById('analyticsDistributionChartBox');
  const canvas = document.getElementById('analyticsDistributionChart');
  if (!container || !canvas || typeof window.Chart === 'undefined') return;

  if (distributionChartInstance) {
    distributionChartInstance.destroy();
    distributionChartInstance = null;
  }

  let labels = [];
  let values = [];

  if (scope === 'month') {
    const daily = getDailyMonthSeries(transactions, activeMonthKey);
    labels = daily.labels.map((d) => `Day ${d}`);
    values = daily.expenseSeries;
  } else {
    const monthly = getMonthlyComparisonSeries(transactions, activeMonthKey, 6);
    labels = monthly.map((m) => m.label);
    values = monthly.map((m) => m.expenses);
  }

  const hasExpenses = values.some((v) => v > 0);
  if (!hasExpenses) {
    syncChartEmptyState(
      container,
      canvas,
      true,
      'No spending distribution data',
      'Log expenses to visualize your spending curve over time.'
    );
    return;
  }

  syncChartEmptyState(container, canvas, false, '', '');

  distributionChartInstance = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Expenses',
          data: values,
          borderColor: '#0F766E',
          backgroundColor: 'rgba(15, 118, 110, 0.1)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Spent: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            autoSkip: true,
            maxTicksLimit: 10,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
      },
    },
  });
}

function renderCategoryRankingTable(breakdown) {
  const container = document.getElementById('analyticsCategoryTable');
  if (!container) return;

  if (!breakdown.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="list"></i></div>
        <h3 class="empty-state-title">No category breakdown available</h3>
        <p class="empty-state-text">Expenses recorded in this period will be ranked here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th class="col-right">Transactions</th>
            <th class="col-right">Share</th>
            <th class="col-right">Total Spent</th>
          </tr>
        </thead>
        <tbody>
          ${breakdown
            .map(
              (item) => `
            <tr>
              <td>
                <span class="legend-left">
                  <span class="legend-swatch" style="background-color: ${item.color}"></span>
                  <span>${escapeHtml(item.category)}</span>
                </span>
              </td>
              <td class="col-right tabular-nums">${item.count}</td>
              <td class="col-right tabular-nums">${item.percentage.toFixed(1)}%</td>
              <td class="col-right tabular-nums">${escapeHtml(formatCurrency(item.amount))}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
