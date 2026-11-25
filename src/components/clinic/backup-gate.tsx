import { type ReactNode } from 'react'
import { Download, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDownloadClinicBackup, useIsAdmin, useLatestBackup, useMonthBackup } from '@/lib/clinic-hooks'
import { errorText } from '@/lib/api-errors'
import { backupFileName } from '@/lib/clinic-backup'
import { formatArabicDateTime } from '@/lib/format'
import { ToothIcon } from '@/components/clinic/dental-icons'

/** للدكتور بس: من غير نسخة الشهر ده مفيش شغل */
export function BackupGate({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  const { data: monthBackup, isLoading, isError, refetch, monthKey } = useMonthBackup()
  const download = useDownloadClinicBackup()

  if (!isAdmin) return children
  if (isLoading) {
    return (
      <div dir="rtl" className="grid min-h-dvh place-items-center bg-scene">
        <div className="animate-rise text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-clinic">
            <ToothIcon className="size-8" strokeWidth={1.6} />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">جاري التأكد من النسخة الاحتياطية...</p>
        </div>
      </div>
    )
  }

  if (monthBackup) return children

  const save = async () => {
    try {
      const log = await download.mutateAsync()
      toast.success(
        `اتنزلت ${log.fileName} ✅ · ${log.patientsCount} مريض · ${log.visitsCount} زيارة`,
      )
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء تنزيل النسخة'))
    }
  }

  return (
    <div dir="rtl" className="grid min-h-dvh place-items-center bg-scene px-4">
      <div className="w-full max-w-lg rounded-3xl border border-destructive/30 bg-card p-6 shadow-clinic sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="mt-4 text-center text-xl font-bold sm:text-2xl">النسخة الاحتياطية إجبارية</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          لازم تنزل النسخة الاحتياطية بتاعة الشهر ده الأول عشان تقدر تشتغل. الملف فيه المرضى والزيارات
          والكشوفات والمدفوعات والمصروفات — عشان بياناتك تبقى في أمان.
        </p>
        <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
          اسم الملف: <span dir="ltr">{backupFileName(monthKey)}</span>
        </p>
        {isError ? (
          <p className="mt-3 text-center text-sm font-semibold text-destructive">
            تعذر التأكد من النسخ السابقة —{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              حاول تاني
            </button>
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-5 h-12 w-full rounded-xl text-base"
          disabled={download.isPending}
          onClick={() => void save()}
        >
          <Download className="size-5" />
          {download.isPending ? 'جاري تجهيز الملف...' : 'تنزيل النسخة الاحتياطية'}
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          الممرضات شغالين عادي — القفل ده للدكتور بس. أول كل شهر محتاج نسخة جديدة.
        </p>
      </div>
    </div>
  )
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
            {monthBackup ? ' · نسخة الشهر ده تمام ✅' : ''}
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
        {download.isPending ? 'جاري...' : 'تنزيل نسخة'}
      </Button>
    </div>
  )
}
