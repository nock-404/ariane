import ExcelJS from "exceljs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { capacityOf, slotKey } from "@/lib/capacity";
import { SESSION_COOKIE, roleOf } from "@/lib/auth";
import { loadPlan } from "@/lib/plan";
import { indexSubs, subStatusIndex } from "@/lib/rows";
import { isoWeek, todayWeek } from "@/lib/weeks";

export const dynamic = "force-dynamic";

/**
 * Export als echte Excel-Datei — für die Runde, in der niemand
 * das Werkzeug aufmacht, sondern alle auf eine Folie schauen.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  if (!roleOf(jar.get(SESSION_COOKIE)?.value)) {
    return new NextResponse("Nicht angemeldet", { status: 401 });
  }

  const full = await loadPlan();

  // Optionaler Ausschnitt: die Auswertungsseite exportiert ihren Zeitraum.
  const params = new URL(request.url).searchParams;
  const von = params.get("von");
  const bis = params.get("bis");
  const weeks = full.weeks.filter((w) => (!von || w >= von) && (!bis || w <= bis));
  const data = { ...full, weeks: weeks.length > 0 ? weeks : full.weeks };

  const subStatus = subStatusIndex(data.projects);
  const subs = indexSubs(data.projects);
  const today = todayWeek();

  const book = new ExcelJS.Workbook();
  book.creator = "Ariane";
  book.created = new Date();

  /* ── Blatt 1: Auslastung je Person und Woche ── */
  const sheet = book.addWorksheet("Auslastung", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Person", key: "person", width: 26 },
    { header: "Kapazität h/Woche", key: "cap", width: 17 },
    ...data.weeks.map((w) => ({
      header: `KW ${isoWeek(w).week}`,
      key: w,
      width: 8,
    })),
  ];
  sheet.getRow(1).font = { bold: true };

  for (const person of data.people) {
    const row: Record<string, string | number> = {
      person: person.name,
      cap: capacityOf(person, today, data.holidays).gross,
    };
    for (const week of data.weeks) {
      let hours = 0;
      for (const slot of data.slots) {
        if (slot.personId !== person.id) continue;
        if (subStatus.get(slot.subprojectId) === "offer") continue;
        hours += data.hours[slotKey(person.id, slot.subprojectId)]?.[week] ?? 0;
      }
      const cap = capacityOf(person, week, data.holidays);
      row[week] = cap.available > 0 ? Math.round((hours / cap.available) * 100) / 100 : 0;
    }
    sheet.addRow(row);
  }

  for (let c = 3; c <= sheet.columnCount; c++) {
    sheet.getColumn(c).numFmt = "0 %";
  }
  sheet.addConditionalFormatting({
    ref: `C2:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`,
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: ["1"],
        priority: 1,
        style: { font: { bold: true, color: { argb: "FFB4441F" } } },
      },
    ],
  });

  /* ── Blatt 2: Projekte mit Budget ── */
  const projects = book.addWorksheet("Projekte");
  projects.columns = [
    { header: "Projekt", key: "project", width: 26 },
    { header: "Kunde", key: "client", width: 20 },
    { header: "Teilprojekt", key: "sub", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Budget h", key: "budget", width: 11 },
    { header: "Verbraucht h", key: "actual", width: 13 },
    { header: "Verplant h", key: "planned", width: 12 },
  ];
  projects.getRow(1).font = { bold: true };

  for (const [subId, entry] of subs) {
    let planned = 0;
    for (const slot of data.slots) {
      if (slot.subprojectId !== subId) continue;
      const row = data.hours[slotKey(slot.personId, subId)] ?? {};
      for (const value of Object.values(row)) planned += value;
    }
    projects.addRow({
      project: entry.project.name,
      client: entry.project.client,
      sub: entry.sub.name,
      status: entry.project.status === "offer" ? "Angebot" : "beauftragt",
      budget: entry.sub.budgetHours ?? "",
      actual: entry.sub.actualHours ?? "",
      planned: Math.round(planned * 10) / 10,
    });
  }

  const buffer = await book.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ariane-auslastung-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
