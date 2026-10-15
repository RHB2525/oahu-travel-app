import { lineTotals, measurementBaseUnit, measurementValue, projectTotals } from "./calc"
import { downloadBlob, safeFilename } from "./format"
import type { PriceItem, Project } from "./types"

const MONEY = '"$"#,##0.00'
const QTY = "#,##0.00"

/** Internal workbook: summary, line-item detail with live formulas, takeoff log, and price list. */
export async function exportEstimateXlsx(project: Project, priceList: PriceItem[], categoryOrder: string[]) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const totals = projectTotals(project, categoryOrder)
  const s = project.settings

  const summary = wb.addWorksheet("Summary")
  const detail = wb.addWorksheet("Detail", { views: [{ state: "frozen", ySplit: 1 }] })
  detail.columns = [
    { header: "Category", key: "category", width: 22 },
    { header: "Code", key: "code", width: 12 },
    { header: "Description", key: "description", width: 44 },
    { header: "Qty", key: "qty", width: 11, style: { numFmt: QTY } },
    { header: "Unit", key: "unit", width: 7 },
    { header: "Waste %", key: "waste", width: 9 },
    { header: "Qty w/ Waste", key: "qtyw", width: 13, style: { numFmt: QTY } },
    { header: "Material / Unit", key: "mat", width: 14, style: { numFmt: MONEY } },
    { header: "Labor / Unit", key: "lab", width: 13, style: { numFmt: MONEY } },
    { header: "Material Total", key: "matT", width: 15, style: { numFmt: MONEY } },
    { header: "Labor Total", key: "labT", width: 14, style: { numFmt: MONEY } },
    { header: "Line Total", key: "total", width: 15, style: { numFmt: MONEY } },
    { header: "Source", key: "source", width: 9 },
    { header: "Basis / Notes", key: "note", width: 60 },
  ]
  const order = (c: string) => (categoryOrder.indexOf(c) + 1 || 999)
  const lines = [...project.lines].sort((a, b) => order(a.category) - order(b.category))
  lines.forEach((line, i) => {
    const r = i + 2
    const t = lineTotals(line, project)
    const item = priceList.find((p) => p.id === line.priceItemId)
    detail.addRow({
      category: line.category,
      code: item?.code ?? "",
      description: line.description,
      qty: Math.round(t.qty * 100) / 100,
      unit: line.unit,
      waste: line.wastePct,
      qtyw: { formula: `D${r}*(1+F${r}/100)`, result: t.qtyWithWaste },
      mat: line.material,
      lab: line.labor,
      matT: { formula: `G${r}*H${r}`, result: t.material },
      labT: { formula: `G${r}*I${r}`, result: t.labor },
      total: { formula: `J${r}+K${r}`, result: t.total },
      source: line.source,
      note: [line.note, t.warning].filter(Boolean).join(" | "),
    })
  })
  const last = lines.length + 1
  detail.getRow(1).font = { bold: true }
  detail.autoFilter = { from: "A1", to: `N${Math.max(last, 1)}` }

  summary.columns = [
    { key: "a", width: 30 },
    { key: "b", width: 16, style: { numFmt: MONEY } },
    { key: "c", width: 16, style: { numFmt: MONEY } },
    { key: "d", width: 16, style: { numFmt: MONEY } },
  ]
  summary.addRow([project.name]).font = { bold: true, size: 14 }
  summary.addRow([`Estimate ${project.number}`, ""])
  summary.addRow([project.client.name, ""])
  summary.addRow([project.siteAddress, ""])
  summary.addRow([])
  summary.addRow(["Category", "Material", "Labor", "Direct Cost"]).font = { bold: true }
  const firstCat = summary.rowCount + 1
  for (const c of totals.categories) {
    const r = summary.rowCount + 1
    summary.addRow([
      c.category,
      { formula: `SUMIF(Detail!$A$2:$A$${last},A${r},Detail!$J$2:$J$${last})`, result: c.material },
      { formula: `SUMIF(Detail!$A$2:$A$${last},A${r},Detail!$K$2:$K$${last})`, result: c.labor },
      { formula: `B${r}+C${r}`, result: c.direct },
    ])
  }
  const lastCat = summary.rowCount
  const directRow = summary.rowCount + 1
  const sumCol = (col: string) => (totals.categories.length ? `SUM(${col}${firstCat}:${col}${lastCat})` : "0")
  summary.addRow([
    "Direct cost",
    { formula: sumCol("B"), result: totals.material },
    { formula: sumCol("C"), result: totals.labor },
    { formula: sumCol("D"), result: totals.direct },
  ]).font = { bold: true }
  summary.addRow([])
  const pctRow = (label: string, pct: number, formula: string, result: number) => {
    summary.addRow([`${label} (${pct}%)`, "", "", { formula, result }])
  }
  const rate = s.taxPct / 100
  let txRow: number
  let ohRow: number
  let prRow: number
  let coRow: number
  if (totals.taxOnMaterials) {
    // Tax on materials is a cost; overhead and profit apply on top of it.
    pctRow("Sales tax on materials", s.taxPct, `B${directRow}*${rate}`, totals.tax)
    txRow = summary.rowCount
    pctRow("Overhead", s.overheadPct, `(D${directRow}+D${txRow})*${s.overheadPct / 100}`, totals.overhead)
    ohRow = summary.rowCount
    pctRow("Profit", s.profitPct, `(D${directRow}+D${txRow}+D${ohRow})*${s.profitPct / 100}`, totals.profit)
    prRow = summary.rowCount
    pctRow("Contingency", s.contingencyPct, `D${directRow}*${s.contingencyPct / 100}`, totals.contingency)
    coRow = summary.rowCount
  } else {
    pctRow("Overhead", s.overheadPct, `D${directRow}*${s.overheadPct / 100}`, totals.overhead)
    ohRow = summary.rowCount
    pctRow("Profit", s.profitPct, `(D${directRow}+D${ohRow})*${s.profitPct / 100}`, totals.profit)
    prRow = summary.rowCount
    pctRow("Contingency", s.contingencyPct, `D${directRow}*${s.contingencyPct / 100}`, totals.contingency)
    coRow = summary.rowCount
    pctRow("Sales tax on total", s.taxPct, `(D${directRow}+D${ohRow}+D${prRow}+D${coRow})*${rate}`, totals.tax)
    txRow = summary.rowCount
  }
  summary.addRow(["TOTAL", "", "", { formula: `D${directRow}+D${ohRow}+D${prRow}+D${coRow}+D${txRow}`, result: totals.total }]).font = {
    bold: true,
    size: 12,
  }
  if (s.conditionedSf > 0) {
    summary.addRow([`Per conditioned SF (${s.conditionedSf} SF)`, "", "", { formula: `D${summary.rowCount}/${s.conditionedSf}`, result: totals.perSf ?? 0 }])
  }

  const takeoff = wb.addWorksheet("Takeoff")
  takeoff.columns = [
    { header: "Page", key: "page", width: 7 },
    { header: "Label", key: "label", width: 32 },
    { header: "Type", key: "type", width: 9 },
    { header: "Quantity", key: "value", width: 12, style: { numFmt: QTY } },
    { header: "Unit", key: "unit", width: 7 },
    { header: "Multiplier", key: "mult", width: 10 },
    { header: "Scale", key: "scale", width: 22 },
  ]
  takeoff.getRow(1).font = { bold: true }
  for (const m of project.measurements) {
    const scale = project.scales[m.page]
    takeoff.addRow({
      page: m.page,
      label: m.label,
      type: m.type,
      value: measurementValue(m, scale) ?? "no scale",
      unit: measurementBaseUnit(m.type),
      mult: m.multiplier,
      scale: scale?.label ?? "",
    })
  }

  const prices = wb.addWorksheet("Price List")
  prices.columns = [
    { header: "Code", key: "code", width: 12 },
    { header: "Description", key: "description", width: 44 },
    { header: "Category", key: "category", width: 22 },
    { header: "Unit", key: "unit", width: 7 },
    { header: "Material", key: "material", width: 12, style: { numFmt: MONEY } },
    { header: "Labor", key: "labor", width: 12, style: { numFmt: MONEY } },
    { header: "Waste %", key: "wastePct", width: 9 },
    { header: "Notes", key: "notes", width: 40 },
  ]
  prices.getRow(1).font = { bold: true }
  priceList.forEach((p) => prices.addRow(p))

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${safeFilename(project.name)}-estimate.xlsx`,
  )
}
