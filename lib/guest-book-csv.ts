export type GuestBookImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
};

export type GuestBookSkippedRow = GuestBookImportRow & { reason: string };

export type PreparedGuestBookImport = {
  totalRows: number;
  ready: GuestBookImportRow[];
  skipped: GuestBookSkippedRow[];
};

export type ExistingGuestForImport = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

const REQUIRED_COLUMNS = ["firstName", "lastName", "email", "phone", "notes"] as const;
type ColumnKey = (typeof REQUIRED_COLUMNS)[number];

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  firstName: ["firstname", "givenname", "first"],
  lastName: ["lastname", "surname", "familyname", "last"],
  email: ["email", "emailaddress", "email1"],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "telephone"],
  notes: ["notes", "note", "comments", "comment"],
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeEmail(value: string) {
  return clean(value).toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = clean(value);
  if (!trimmed) return "";
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return prefix + trimmed.replace(/\D/g, "");
}

function normalizeName(firstName: string, lastName: string) {
  return `${clean(firstName).toLowerCase()}|${clean(lastName).toLowerCase()}`;
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function resolveColumns(headers: string[]): Record<ColumnKey, number> {
  const normalized = headers.map(normalizeHeader);
  const resolved = {} as Record<ColumnKey, number>;
  const missing: string[] = [];

  for (const key of REQUIRED_COLUMNS) {
    const index = normalized.findIndex((header) => HEADER_ALIASES[key].includes(header));
    if (index === -1) {
      missing.push(
        key === "firstName"
          ? "First Name"
          : key === "lastName"
            ? "Last Name"
            : key === "email"
              ? "Email"
              : key === "phone"
                ? "Phone"
                : "Notes"
      );
    } else {
      resolved[key] = index;
    }
  }

  if (missing.length) {
    throw new Error(
      `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Use First Name, Last Name, Email, Phone, Notes.`
    );
  }

  return resolved;
}

export function prepareGuestBookCsv(
  text: string,
  existingPeople: ExistingGuestForImport[]
): PreparedGuestBookImport {
  const parsed = parseCsv(text);
  if (!parsed.length) throw new Error("This CSV is empty.");

  const columns = resolveColumns(parsed[0]);
  const dataRows = parsed.slice(1);
  const ready: GuestBookImportRow[] = [];
  const skipped: GuestBookSkippedRow[] = [];

  const existingEmails = new Set(existingPeople.map((p) => normalizeEmail(p.email ?? "")).filter(Boolean));
  const existingPhones = new Set(existingPeople.map((p) => normalizePhone(p.phone ?? "")).filter(Boolean));
  const existingNamesWithoutContact = new Set(
    existingPeople
      .filter((p) => !normalizeEmail(p.email ?? "") && !normalizePhone(p.phone ?? ""))
      .map((p) => normalizeName(p.firstName, p.lastName ?? ""))
      .filter((name) => name !== "|")
  );

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenNamesWithoutContact = new Set<string>();

  dataRows.forEach((cells, index) => {
    const row: GuestBookImportRow = {
      rowNumber: index + 2,
      firstName: clean(cells[columns.firstName]),
      lastName: clean(cells[columns.lastName]),
      email: normalizeEmail(cells[columns.email] ?? ""),
      phone: clean(cells[columns.phone]),
      notes: clean(cells[columns.notes]),
    };

    if (!row.firstName) {
      skipped.push({ ...row, reason: "First Name is required." });
      return;
    }
    if (row.email && !EMAIL_RE.test(row.email)) {
      skipped.push({ ...row, reason: "Email address is not valid." });
      return;
    }

    const emailKey = normalizeEmail(row.email);
    const phoneKey = normalizePhone(row.phone);
    const nameKey = normalizeName(row.firstName, row.lastName);

    if (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) {
      skipped.push({ ...row, reason: "Duplicate email address." });
      return;
    }
    if (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey))) {
      skipped.push({ ...row, reason: "Duplicate phone number." });
      return;
    }
    if (!emailKey && !phoneKey && (existingNamesWithoutContact.has(nameKey) || seenNamesWithoutContact.has(nameKey))) {
      skipped.push({ ...row, reason: "Duplicate name with no contact information." });
      return;
    }

    ready.push(row);
    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);
    if (!emailKey && !phoneKey) seenNamesWithoutContact.add(nameKey);
  });

  return { totalRows: dataRows.length, ready, skipped };
}
