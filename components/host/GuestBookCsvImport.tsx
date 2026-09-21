"use client";

import { useRef, useState, useTransition } from "react";
import {
  prepareGuestBookCsv,
  type ExistingGuestForImport,
  type PreparedGuestBookImport,
} from "@/lib/guest-book-csv";
import { importGuestBookRows } from "@/lib/guest-book-import-actions";

const PREVIEW_LIMIT = 12;

export default function GuestBookCsvImport({
  existing,
}: {
  existing: ExistingGuestForImport[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedGuestBookImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  async function choose(file: File | undefined) {
    setError(null);
    setImported(null);
    setPrepared(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    try {
      const text = await file.text();
      setPrepared(prepareGuestBookCsv(text, existing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t read that CSV.");
    }
  }

  function importRows() {
    if (!prepared?.ready.length || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await importGuestBookRows(prepared.ready);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setImported(result.imported);
      setPrepared(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-sage/25 bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gold-dark">
            Bring your people over
          </p>
          <h2 className="mt-1 font-display text-xl text-forest">Import CSV</h2>
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
            Use columns First Name, Last Name, Email, Phone, Notes. The file is read in your browser; only rows you approve are saved to My Guest Book.
          </p>
        </div>

        <label className="cursor-pointer rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest hover:bg-forest/5">
          Choose CSV
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
      </div>

      {fileName && (
        <p className="mt-3 font-body text-xs text-forest/55">{fileName}</p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 font-body text-sm text-error">
          {error}
        </p>
      )}

      {imported !== null && (
        <p className="mt-4 rounded-xl border border-sage/30 bg-offwhite px-4 py-3 font-body text-sm font-semibold text-forest">
          Imported {imported} {imported === 1 ? "person" : "people"}.
        </p>
      )}

      {prepared && (
        <div className="mt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Rows found" value={prepared.totalRows} />
            <Summary label="Ready to import" value={prepared.ready.length} />
            <Summary label="Skipped" value={prepared.skipped.length} />
          </div>

          {prepared.ready.length > 0 && (
            <div className="mt-5">
              <h3 className="font-body text-sm font-bold text-forest">Ready</h3>
              <ul className="mt-2 divide-y divide-sage/20">
                {prepared.ready.slice(0, PREVIEW_LIMIT).map((row) => (
                  <li key={row.rowNumber} className="py-2.5">
                    <p className="font-body text-sm font-semibold text-forest">
                      {[row.firstName, row.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="font-body text-xs text-forest/55">
                      {[row.email, row.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </li>
                ))}
              </ul>
              {prepared.ready.length > PREVIEW_LIMIT && (
                <p className="mt-2 font-body text-xs text-forest/55">
                  and {prepared.ready.length - PREVIEW_LIMIT} more
                </p>
              )}
            </div>
          )}

          {prepared.skipped.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer font-body text-sm font-semibold text-forest/70">
                Review skipped rows
              </summary>
              <ul className="mt-2 divide-y divide-sage/20">
                {prepared.skipped.slice(0, PREVIEW_LIMIT).map((row) => (
                  <li key={row.rowNumber} className="py-2.5">
                    <p className="font-body text-sm text-forest">
                      Row {row.rowNumber}: {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed"}
                    </p>
                    <p className="font-body text-xs text-forest/55">{row.reason}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            disabled={pending || prepared.ready.length === 0}
            onClick={importRows}
            className="mt-5 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
          >
            {pending
              ? "Importing…"
              : "Import " + prepared.ready.length + " " + (prepared.ready.length === 1 ? "person" : "people")}
          </button>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-sage/25 bg-offwhite px-4 py-3 text-center">
      <p className="font-display text-2xl text-forest">{value}</p>
      <p className="mt-1 font-body text-xs text-forest/55">{label}</p>
    </div>
  );
}
