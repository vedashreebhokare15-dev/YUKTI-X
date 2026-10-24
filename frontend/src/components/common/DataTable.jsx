import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import EmptyState from './EmptyState';

export default function DataTable({
  columns,
  rows,
  rowKey = (row, index) => row.id || index,
  onRowClick,
  selectedKey,
  emptyTitle = 'No records',
  emptyMessage,
  emptyIcon,
  initialSort = null,
  sort: controlledSort = null,
  onSortChange,
  className = '',
  caption,
}) {
  const [internalSort, setInternalSort] = useState(initialSort);
  const sort = onSortChange ? controlledSort : internalSort;

  const sortedRows = useMemo(() => {
    if (!sort?.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    const getValue = (row) => (column?.sortValue ? column.sortValue(row) : row[sort.key]);
    return [...rows].sort((a, b) => {
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sort.direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      const result = String(valueA).localeCompare(String(valueB), 'en', { numeric: true });
      return sort.direction === 'asc' ? result : -result;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key) => {
    const next = (current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    };
    if (onSortChange) {
      onSortChange(next(sort));
    } else {
      setInternalSort(next);
    }
  };

  return (
    <div className="table-wrap">
      <table className={`data-table ${className}`.trim()}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={{ textAlign: column.align || 'left', width: column.width }}
                  className={`${column.sortable ? 'sortable' : ''} ${column.headerClassName || ''}`.trim()}
                  aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortable ? (
                    <button type="button" className="th-sort-btn" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      {isSorted ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={11} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={11} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={11} aria-hidden="true" style={{ opacity: 0.45 }} />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <div className="table-empty">
                  <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
                </div>
              </td>
            </tr>
          ) : (
            sortedRows.map((row, index) => {
              const key = rowKey(row, index);
              const interactive = Boolean(onRowClick);
              return (
                <tr
                  key={key}
                  className={selectedKey != null && selectedKey === key ? 'selected' : ''}
                  onClick={interactive ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={interactive ? 0 : undefined}
                  style={interactive ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.className || ''}
                      style={{ textAlign: column.align || 'left' }}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
