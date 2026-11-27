import type { SortKey } from '#lib/wordle.ts';

interface GamesFiltersProps {
  search: string;
  attempts: string;
  month: string;
  months: string[];
  exactDate: string;
  fromDate: string;
  toDate: string;
  sortBy: SortKey;
  summaryText: string;
  filterMs: string;
  showTiming: boolean;
  onSearchChange: (value: string) => void;
  onAttemptsChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onExactDateChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onReset: () => void;
}

/**
 * Filter and sort controls bar for the Wordle archive table.
 */
export default function GamesFilters({
  search,
  attempts,
  month,
  months,
  exactDate,
  fromDate,
  toDate,
  sortBy,
  summaryText,
  filterMs,
  showTiming,
  onSearchChange,
  onAttemptsChange,
  onMonthChange,
  onExactDateChange,
  onFromDateChange,
  onToDateChange,
  onSortChange,
  onReset,
}: GamesFiltersProps) {
  return (
    <fieldset class="options-fieldset">
      <legend class="options-legend">Options</legend>
      <div class="filters-grid">
        <div class="filter-field">
          <label for="filter-search">Word Search</label>
          <input
            id="filter-search"
            class="filter-input"
            type="search"
            placeholder="Solution or guess (e.g. SLATE)"
            autocomplete="off"
            value={search}
            onInput={(e) => onSearchChange(e.currentTarget.value)}
          />
        </div>

        <div class="filter-field">
          <label for="filter-attempts">Attempts</label>
          <select
            id="filter-attempts"
            class="filter-select"
            value={attempts}
            onChange={(e) => onAttemptsChange(e.currentTarget.value)}
          >
            <option value="all">All</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="X">Failed (X)</option>
          </select>
        </div>

        <div class="filter-field">
          <label for="filter-month">Month</label>
          <select
            id="filter-month"
            class="filter-select"
            value={month}
            onChange={(e) => onMonthChange(e.currentTarget.value)}
          >
            <option value="all">All Months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div class="filter-field">
          <label for="filter-date">Date</label>
          <input
            id="filter-date"
            class="filter-input"
            type="date"
            value={exactDate}
            onChange={(e) => onExactDateChange(e.currentTarget.value)}
          />
        </div>

        <div class="filter-field">
          <label for="filter-from">From Date</label>
          <input
            id="filter-from"
            class="filter-input"
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.currentTarget.value)}
          />
        </div>

        <div class="filter-field">
          <label for="filter-to">To Date</label>
          <input
            id="filter-to"
            class="filter-input"
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.currentTarget.value)}
          />
        </div>

        <div class="filter-field">
          <label for="filter-sort">Sort</label>
          <select
            id="filter-sort"
            class="filter-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.currentTarget.value as SortKey)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="fastest">Fastest</option>
            <option value="slowest">Slowest</option>
          </select>
        </div>

        <button type="button" id="filter-reset" class="btn-secondary" onClick={onReset}>
          Reset
        </button>
      </div>

      <div class="results-meta" aria-live="polite">
        <span>{summaryText}</span>
        <span>{showTiming ? `${filterMs} ms` : ''}</span>
      </div>
    </fieldset>
  );
}
