import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import type { Config } from "../types.js";

// Single persistent remote document, unlike the old local workbook.ts (which loaded/saved
// a whole file on disk per call): the Sheets API doc is authenticated once per process and
// reused - postsSheet.ts/trackerSheet.ts still call getRows()/addRow()/save() per
// operation, so every read sees current state without needing an explicit reload.
let cachedDoc: GoogleSpreadsheet | null = null;

async function getDoc(cfg: Config): Promise<GoogleSpreadsheet> {
  if (cachedDoc) return cachedDoc;

  const auth = new JWT({
    email: cfg.sheets.serviceAccountEmail,
    key: cfg.sheets.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(cfg.sheets.spreadsheetId, auth);
  await doc.loadInfo();
  cachedDoc = doc;
  return doc;
}

// Mirrors the old workbook.ts getOrCreateSheet: returns the sheet if it already exists,
// otherwise creates it with the given header row. An existing sheet's own header row is
// left as-is (google-spreadsheet lazily loads it on first getRows()/addRow() call) rather
// than overwritten here.
export async function getOrCreateSheet(
  cfg: Config,
  title: string,
  headers: string[]
): Promise<GoogleSpreadsheetWorksheet> {
  const doc = await getDoc(cfg);
  return doc.sheetsByTitle[title] ?? (await doc.addSheet({ title, headerValues: headers }));
}
