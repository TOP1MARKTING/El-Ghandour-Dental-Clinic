import ExcelJS from 'exceljs'
import { monthKey } from '@/lib/format'
import type { Expense, Patient, Payment, Visit } from '@/types'

/** backup-11-2026.xlsx */
export function backupFileName(key = monthKey()) {
  const [y, m] = key.split('-')
  return `backup-${m}-${y}.xlsx`
}

function sheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: Array<Array<string | number>>) {
  const ws = wb.addWorksheet(name)
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  for (const row of rows) ws.addRow(row)
  ws.columns.forEach((col) => {
    let width = 12
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? '').length
      if (len + 2 > width) width = Math.min(40, len + 2)
    })
    col.width = width
  })
}

export async function buildClinicWorkbook(input: {
  patients: Patient[]
  visits: Visit[]
  payments: Payment[]
  expenses: Expense[]
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'عيادة الغندور'
  wb.created = new Date()

  sheet(
    wb,
    'المرضى',
    ['الاسم', 'الموبايل', 'السن', 'العنوان', 'الدكتور', 'المشكلة', 'الإجمالي', 'المدفوع', 'الباقي', 'آخر زيارة', 'اتسجل', 'بواسطة'],
    input.patients.map((p) => [
      p.name,
      p.phone,
      p.age || '',
      p.address,
      p.doctor,
      p.problem,
      p.total,
      p.paid,
      Math.max(0, p.total - p.paid),
      p.lastVisit,
      p.registeredAt,
      p.by ?? '',
    ]),
  )

  sheet(
    wb,
    'الزيارات والكشوفات',
    ['المريض', 'العلاج', 'السعر', 'المدفوع', 'خصم %', 'تاريخ', 'حساب قديم', 'ملاحظات', 'بواسطة'],
    input.visits.map((v) => [
      v.patientId,
      v.treatment,
      v.price,
      v.paidToday ?? 0,
      v.discountPercent ?? '',
      v.date,
      v.oldBalance ? 'نعم' : '',
      v.notes,
      v.by ?? '',
    ]),
  )

  sheet(
    wb,
    'المدفوعات',
    ['المريض', 'المبلغ', 'النوع', 'الطريقة', 'ملاحظة', 'التاريخ', 'بواسطة'],
    input.payments.map((p) => [p.patient, p.amount, p.kind, p.method, p.note ?? '', p.date, p.by ?? '']),
  )

  sheet(
    wb,
    'المصروفات',
    ['النوع', 'المبلغ', 'ملاحظة', 'التاريخ'],
    input.expenses.map((x) => [x.category, x.amount, x.note, x.date]),
  )

  return wb.xlsx.writeBuffer()
}

export function triggerXlsxDownload(buffer: ArrayBuffer | ExcelJS.Buffer, fileName: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
