import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageWindow(page, totalPages) {
  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, Math.max(page + 2, 5));
  for (let index = start; index <= end; index += 1) {
    pages.push(index);
  }
  return pages;
}

export default function Pagination({ page, pageSize, total, onChange, itemLabel = 'items' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="pagination">
      <span>
        Showing {start}–{end} of {total} {itemLabel}
      </span>
      <div className="pagination-btns">
        <button
          type="button"
          className="page-btn"
          onClick={() => onChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {pageWindow(safePage, totalPages).map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            className={`page-btn ${pageNumber === safePage ? 'active' : ''}`}
            onClick={() => onChange(pageNumber)}
            aria-current={pageNumber === safePage ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          className="page-btn"
          onClick={() => onChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
