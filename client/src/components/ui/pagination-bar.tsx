import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

export { PAGE_SIZE };

export function paginateItems<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

export function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

export function PaginationBar({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;

  const pages = totalPages(total);
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  // Build visible page numbers with ellipsis
  const nums: (number | "…")[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) nums.push(i);
  } else {
    nums.push(1);
    if (page > 3) nums.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i);
    if (page < pages - 2) nums.push("…");
    nums.push(pages);
  }

  const btn = (label: React.ReactNode, target: number, disabled: boolean, active = false) => (
    <button
      key={String(label)}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        {btn("←", page - 1, page === 1)}
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
          ) : (
            btn(n, n as number, false, n === page)
          )
        )}
        {btn("→", page + 1, page === pages)}
      </div>
    </div>
  );
}
