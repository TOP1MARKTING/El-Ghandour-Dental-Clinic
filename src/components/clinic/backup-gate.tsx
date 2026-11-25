import { type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDownloadClinicBackup, useLatestBackup, useMonthBackup } from '@/lib/clinic-hooks'
import { errorText } from '@/lib/api-errors'
import { formatArabicDateTime } from '@/lib/format'

/** القفل الإجباري متوقف حاليًا — الدكتور يشتغل عادي والتنزيل اختياري من اللوحة */
export function BackupGate({ children }: { children: ReactNode }) {
  return children
}

export function BackupStatusCard() {
  const { data: latest, isLoading } = useLatestBackup()
  const { data: monthBackup } = useMonthBackup()
  const download = useDownloadClinicBackup()

  const save = async () => {
    try {
      const log = await download.mutateAsync()
      toast.success(`اتنزلت ${log.fileName} ✅`)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء التنزيل'))
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">آخر نسخة نزلت</p>
        <p className="truncate text-sm font-bold">
          {isLoading
            ? '…'
            : latest
              ? `${formatArabicDateTime(new Date(latest.downloadedAt))} · ${latest.byName || 'الدكتور'}`
              : 'لسه مفيش نسخة'}
        </p>
        {latest ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {latest.patientsCount} مريض · {latest.visitsCount} زيارة · {latest.paymentsCount} دفعة
            {monthBackup ? ' · نسخة الشهر ده تمام ✅' : ' · لسه محتاج تنزيل الشهر ده'}
            {' · الملف كامل من أول يوم'}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0 rounded-xl"
        disabled={download.isPending}
        onClick={() => void save()}
      >
        <Download className="size-4" />
        {download.isPending ? 'جاري...' : 'تنزيل نسخة كاملة'}
      </Button>
    </div>
  )
}
