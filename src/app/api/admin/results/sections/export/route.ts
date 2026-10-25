import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/formatDate";
import { resolveCourse } from "@/app/admin/courses/courseData";
import { loadResultsGrid } from "@/app/admin/courses/courseResults";
import { ACCOUNT_STATE_LABELS } from "@/components/admin/courses/accessPlan";
import type { ResultsGridRow } from "@/components/admin/courses/ResultsGrid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Excel only reads the CSV as UTF-8 (Cyrillic!) when this is the very first byte.
const UTF8_BOM = String.fromCharCode(0xfeff);

/*
 * A spreadsheet runs a cell that starts with one of these as a formula, and
 * names are typed by students: `=HYPERLINK(...)` as a name would be a live
 * link in the admin's Excel. A leading apostrophe makes it text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string) {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeRow(cells: string[]) {
  return cells.map(csvCell).join(",");
}

/** The day an access ended, with its year: a file is read long after the screen. */
function formatEndKey(key: string) {
  return formatDate(`${key}T12:00:00+05:00`);
}

/** The words the grid's row shows under a name, in two columns. */
function describeAccess(row: ResultsGridRow) {
  if (row.group === "active") return "Has access";
  if (row.group === "ended") return row.endedKey ? `Access ended ${formatEndKey(row.endedKey)}` : "Access ended";
  return "No access entry";
}

function describeAccount(row: ResultsGridRow) {
  return row.isAdmin ? "Admin" : ACCOUNT_STATE_LABELS[row.account];
}

/** The grid's cell: the latest result ("640", or "7 of 9" under 10 questions), with the attempts when there were more. */
function describeCell(cell: ResultsGridRow["cells"][string] | undefined) {
  if (!cell) return "";
  return cell.attempts > 1 ? `${cell.value} (${cell.attempts} attempts)` : cell.value;
}

/**
 * The course Results tab as a CSV: the grid itself. One row per student in
 * the grid's order and groups - with access, access ended in the last 60
 * days, then everyone else with a result here - and one column per visible
 * test in course order, holding the same cell as the screen. No totals,
 * averages or ranks: a sum of SAT-scale scores of different tests measures
 * nothing, and tests under 10 questions have no score at all.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  // `category` is the name older links used.
  const requested = url.searchParams.get("course") ?? url.searchParams.get("category");
  if (!requested) return new Response("Choose a course", { status: 400 });

  const course = await resolveCourse(requested);
  if (!course) return new Response("Course not found", { status: 404 });

  const grid = await loadResultsGrid(course.value, { allOthers: true });
  const lines = [
    serializeRow(["Name", "Email", "Access", "Account", ...grid.columns.map((column) => column.title)]),
    ...[...grid.rows, ...grid.otherRows].map((row) => serializeRow([
      row.name ?? "",
      row.email,
      describeAccess(row),
      describeAccount(row),
      ...grid.columns.map((column) => describeCell(row.cells[column.id])),
    ])),
  ];

  const coursePart = course.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "course";
  const filename = `mysat-results-${coursePart}-${grid.todayKey}.csv`;

  return new Response(`${UTF8_BOM}${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
