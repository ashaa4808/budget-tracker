/**
 * dashboard.js — Dashboard Calculations, Charts & Overview View
 */

import { buildBudgetBannerMarkup, calculateBudgetStatus } from './budget.js';
import {
  calculateTotals,
  escapeHtml,
  filterTransactions,
  formatCurrency,
  formatMonthLabel,
  renderTransactionTableMarkup,
  sortTransactions,
} from './transactions.js';

const CHART_COLORS = [
  '#0F766E',
  '#0284C7',
  '#D97706',
  '#7C3AED',
  '#DC2626',
  '#059669',
  '#475569',
  '#DB2777',
];

let overviewChartInstance = null;
let categoryChartInstance = null;

/**
 * Computes expense breakdown grouped by category, sorted descending by amount.
 * @param {Array<Object>} transactions
 */
export function calculateCategoryBreakdown(transactions) {
  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const map = new Map();
  let grandTotal = 0;

  for (const tx of expenses) {
    const amt = Number(tx.amount) || 0;
    grandTotal += amt;
    const prev = map.get(tx.category) || { category: tx.category, amount: 0, count: 0 };
    prev.amount += amt;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item, index) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

/**
 * Builds daily cashflow buckets for a given YYYY-MM month.
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 */
export function getDailyMonthSeries(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = [];
  const incomeSeries = new Array(daysInMonth).fill(0);
  const expenseSeries = new Array(daysInMonth).fill(0);

  for (let d = 1; d <= daysInMonth; d += 1) {
    labels.push(String(d));
  }

  const monthTxs = filterTransactions(transactions, { monthKey });
  for (const tx of monthTxs) {
    const day = Number(tx.date.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) {
      if (tx.type === 'income') {
        incomeSeries[day - 1] += Number(tx.amount) || 0;
      } else {
        expenseSeries[day - 1] += Number(tx.amount) || 0;
      }
    }
  }

  return {
    labels,
    incomeSeries,
    expenseSeries,
    hasData: monthTxs.length > 0,
  };
}

/**
 * Toggles an empty-state placeholder inside a chart container while preserving the canvas.
 * @param {HTMLElement|null} container
 * @param {HTMLCanvasElement|null} canvas
 * @param {boolean} isEmpty
 * @param {string} title
 * @param {string} message
 */
export function syncChartEmptyState(container, canvas, isEmpty, title, message) {
  if (!container || !canvas) return;
  const existingEmpty = container.querySelector('.chart-empty-state');

  if (isEmpty) {
    canvas.hidden = true;
    if (!existingEmpty) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state chart-empty-state';
      emptyEl.innerHTML = `
        <div class="empty-state-icon"><i data-lucide="bar-chart-2"></i></div>
        <h3 class="empty-state-title">${escapeHtml(title)}</h3>
        <p class="empty-state-text">${escapeHtml(message)}</p>
      `;
      container.appendChild(emptyEl);
    }
  } else {
    canvas.hidden = false;
    if (existingEmpty) {
      existingEmpty.remove();
    }
  }
}

/**
 * Renders all Dashboard KPIs, Budget alert banner, Charts, and Recent Transactions.
 * @param {Array<Object>} transactions
 * @param {string} activeMonthKey
 * @param {number} monthlyLimit
 */
export function renderDashboardView(transactions, activeMonthKey, monthlyLimit) {
  const totals = calculateTotals(transactions);
  const monthLabel = formatMonthLabel(activeMonthKey);
  const monthExpenses = filterTransactions(transactions, {
    monthKey: activeMonthKey,
    type: 'expense',
  });
  const { totalExpenses: monthlySpending } = calculateTotals(monthExpenses);

  // 1. Update KPI summary cards
  const balanceEl = document.getElementById('dashTotalBalance');
  const incomeEl = document.getElementById('dashTotalIncome');
  const expensesEl = document.getElementById('dashTotalExpenses');
  const monthlyEl = document.getElementById('dashMonthlySpending');
  const incomeCountEl = document.getElementById('dashIncomeCount');
  const expenseCountEl = document.getElementById('dashExpenseCount');
  const monthLabelEl = document.getElementById('dashMonthLabel');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(totals.totalBalance);
    balanceEl.classList.toggle('text-danger', totals.totalBalance < 0);
  }
  if (incomeEl) incomeEl.textContent = formatCurrency(totals.totalIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(totals.totalExpenses);
  if (monthlyEl) monthlyEl.textContent = formatCurrency(monthlySpending);
  if (incomeCountEl) {
    incomeCountEl.textContent = `${totals.incomeCount} ${
      totals.incomeCount === 1 ? 'entry' : 'entries'
    }`;
  }
  if (expenseCountEl) {
    expenseCountEl.textContent = `${totals.expenseCount} ${
      totals.expenseCount === 1 ? 'entry' : 'entries'
    }`;
  }
  if (monthLabelEl) monthLabelEl.textContent = monthLabel;

  // 2. Conditional Budget Alert Banner on Dashboard (only shown at 80%+ or exceeded)
  const bannerContainer = document.getElementById('dashboardBudgetBanner');
  if (bannerContainer) {
    const budgetStatus = calculateBudgetStatus(transactions, activeMonthKey, monthlyLimit);
    if (budgetStatus.status === 'warning' || budgetStatus.status === 'exceeded') {
      bannerContainer.innerHTML = buildBudgetBannerMarkup(budgetStatus, activeMonthKey, {
        showActionLink: true,
      });
    } else {
      bannerContainer.innerHTML = '';
    }
  }

  // 3. Monthly Spending Overview Chart
  const overviewSubtitle = document.getElementById('dashOverviewSubtitle');
  if (overviewSubtitle) {
    overviewSubtitle.textContent = `Daily income and expenses for ${monthLabel}`;
  }
  renderOverviewChart(transactions, activeMonthKey);

  // 4. Expense Category Breakdown Chart & Legend
  const categorySubtitle = document.getElementById('dashCategorySubtitle');
  if (categorySubtitle) {
    categorySubtitle.textContent = `Expense distribution for ${monthLabel}`;
  }
  renderCategoryDoughnut(monthExpenses, monthLabel);

  // 5. Recent Transactions (top 6 sorted newest first)
  const recentContainer = document.getElementById('dashRecentTransactions');
  if (recentContainer) {
    const recent = sortTransactions(transactions, 'date-desc').slice(0, 6);
    recentContainer.innerHTML = renderTransactionTableMarkup(recent, {
      showActions: true,
      emptyTitle: 'No transactions yet',
      emptyMessage: 'Add your first income or expense to populate your dashboard.',
      showEmptyCta: true,
    });
  }
}

function renderOverviewChart(transactions, activeMonthKey) {
  const container = document.getElementById('dashOverviewChartBox');
  const canvas = document.getElementById('dashOverviewChart');
  if (!container || !canvas || typeof window.Chart === 'undefined') return;

  const series = getDailyMonthSeries(transactions, activeMonthKey);

  if (overviewChartInstance) {
    overviewChartInstance.destroy();
    overviewChartInstance = null;
  }

  if (!series.hasData) {
    syncChartEmptyState(
      container,
      canvas,
      true,
      'No activity this month',
      'Transactions dated in the selected month will plot daily cashflow here.'
    );
    return;
  }

  syncChartEmptyState(container, canvas, false, '', '');

  overviewChartInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#16A34A',
          borderRadius: 3,
          maxBarThickness: 12,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#0F766E',
          borderRadius: 3,
          maxBarThickness: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: true,
            borderRadius: 2,
            color: '#475569',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `Day ${items[0]?.label || ''}`,
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            maxRotation: 0,
            autoSkip: true,
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

function renderCategoryDoughnut(monthExpenses, monthLabel) {
  const layoutEl = document.getElementById('dashCategoryLayout');
  const canvas = document.getElementById('dashCategoryChart');
  const legendList = document.getElementById('dashCategoryLegend');
  if (!layoutEl || !canvas || !legendList || typeof window.Chart === 'undefined') return;

  const breakdown = calculateCategoryBreakdown(monthExpenses);

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  const canvasWrap = canvas.parentElement;
  const existingEmpty = layoutEl.querySelector('.chart-empty-state');

  if (!breakdown.length) {
    if (canvasWrap) canvasWrap.hidden = true;
    legendList.hidden = true;
    if (!existingEmpty) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state chart-empty-state';
      emptyEl.style.gridColumn = '1 / -1';
      emptyEl.innerHTML = `
        <div class="empty-state-icon"><i data-lucide="pie-chart"></i></div>
        <h3 class="empty-state-title">No expenses in ${escapeHtml(monthLabel)}</h3>
        <p class="empty-state-text">Log an expense to inspect category distribution.</p>
      `;
      layoutEl.appendChild(emptyEl);
    }
    return;
  }

  if (canvasWrap) canvasWrap.hidden = false;
  legendList.hidden = false;
  if (existingEmpty) existingEmpty.remove();

  categoryChartInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.amount),
          backgroundColor: breakdown.map((b) => b.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
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

  legendList.innerHTML = breakdown
    .slice(0, 6)
    .map(
      (item) => `
      <li class="category-legend-item">
        <span class="legend-left">
          <span class="legend-swatch" style="background-color: ${item.color}"></span>
          <span class="legend-name">${escapeHtml(item.category)}</span>
        </span>
        <span class="legend-right tabular-nums">
          <span class="legend-amount">${escapeHtml(formatCurrency(item.amount))}</span>
          <span class="legend-pct">${item.percentage.toFixed(0)}%</span>
        </span>
      </li>
    `
    )
    .join('');
}
