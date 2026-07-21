/**
 * Build the multi-sheet “export everything” materials workbook (export-only).
 */
import ExcelJS from "exceljs";
import { buildExportAoa, safeSheetName, type ExportDomain } from "./io";
import {
  buildCategoryTaxExportAoa,
  buildTaxRefExportAoa,
  CATEGORIES_SHEET,
  TAX_REF_SHEET,
  type ExportCategoryTaxRow,
  type StripeTaxCodeRef,
} from "./category-tax-io";
import {
  buildAssignmentExportAoa,
  ASSIGNMENTS_SHEET,
  type ExportAssignmentRow,
} from "./attribute-assignment-io";
import {
  buildAttributeExportAoa,
  type ExportAttribute,
} from "./attribute-io";
import {
  buildDomainExportAoa,
  DOMAINS_SHEET,
  type ExportDomainRow,
} from "./domain-io";

export type CatalogScopeExport = {
  /** e.g. IS_COM — prefixed onto domain sheet names */
  scopeCode: string;
  domains: ExportDomain[];
};

export async function buildExportEverythingWorkbookBuffer(args: {
  domainsFlat: ExportDomainRow[];
  categoriesTax: ExportCategoryTaxRow[];
  taxRefs: StripeTaxCodeRef[];
  catalogScopes: CatalogScopeExport[];
  attributes: ExportAttribute[];
  assignments: ExportAssignmentRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();

  function addSheet(name: string, aoa: unknown[][]) {
    const ws = wb.addWorksheet(safeSheetName(name, used));
    for (const row of aoa) ws.addRow(row);
  }

  addSheet(DOMAINS_SHEET, buildDomainExportAoa(args.domainsFlat));
  addSheet(CATEGORIES_SHEET, buildCategoryTaxExportAoa(args.categoriesTax));
  addSheet(TAX_REF_SHEET, buildTaxRefExportAoa(args.taxRefs));

  for (const scope of args.catalogScopes) {
    const sheets = buildExportAoa(scope.domains);
    for (const { sheetName, aoa } of sheets) {
      const prefixed = `${scope.scopeCode} ${sheetName}`.trim();
      addSheet(prefixed, aoa);
    }
  }

  for (const { sheetName, aoa } of buildAttributeExportAoa(args.attributes)) {
    addSheet(sheetName, aoa);
  }

  addSheet(ASSIGNMENTS_SHEET, buildAssignmentExportAoa(args.assignments));

  const help = wb.addWorksheet(safeSheetName("Instructions", used));
  help.addRow(["Materials catalog — export everything"]);
  help.addRow([]);
  help.addRow([
    "This workbook is export-only. Import via the scoped tools on each list page or /materials/import-export.",
  ]);
  help.addRow([
    "Categories taxProfile is derived from stripeTaxCodeId on import (not editable).",
  ]);
  help.addRow([
    "Blank tax code cells on category/item import clear overrides — always re-export before importing.",
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
