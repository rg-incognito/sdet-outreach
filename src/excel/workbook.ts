import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import ExcelJS from "exceljs";

// Single local workbook backing both the Posts and Tracker sheets - see postsSheet.ts and
// trackerSheet.ts. Unlike JobMailer's Google Sheets API client, there's no persistent
// remote document to hold open across calls: each exported function here loads the file,
// mutates it, and saves it back in one shot, so the file on disk is always the source of
// truth between runs.
const WORKBOOK_PATH = "data/tracker.xlsx";

export async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (existsSync(WORKBOOK_PATH)) {
    await workbook.xlsx.readFile(WORKBOOK_PATH);
  }
  return workbook;
}

export async function saveWorkbook(workbook: ExcelJS.Workbook): Promise<void> {
  mkdirSync(dirname(WORKBOOK_PATH), { recursive: true });
  await workbook.xlsx.writeFile(WORKBOOK_PATH);
}

export function getOrCreateSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  headers: string[]
): ExcelJS.Worksheet {
  let sheet = workbook.getWorksheet(title);
  if (!sheet) {
    sheet = workbook.addWorksheet(title);
    sheet.addRow(headers);
  }
  return sheet;
}
