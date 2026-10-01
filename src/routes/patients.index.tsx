import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { money } from '@/lib/format'
import { usePatients } from '@/lib/clinic-hooks'
import { PageSurface } from '@/components/clinic/app-shell'
import { EmptyState, LoadingSkeleton, PageHeader, SearchBar } from '@/components/clinic/ui'
import { PatientCard } from '@/components/clinic/cards'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/patients/')({
  head: () => ({
    meta: [
      { title: 'المرضى — عيادة الغندور' },
      { name: 'description', content: 'البحث في ملفات المرضى وإدارتها.' },
      { property: 'og:title', content: 'المرضى — عيادة الغندور' },
      { property: 'og:description', content: 'البحث في ملفات المرضى وإدارتها.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Patients,
})

function Patients() {
  const [q, setQ] = useState('')
  const { data: patients = [], isLoading, isError, error, refetch } = usePatients()
  const list = useMemo(
    () => patients.filter((x) => x.name.includes(q) || x.phone.includes(q)),
    [patients, q],
  )

  const errorHint = (() => {
    const code = (error as { code?: string } | null)?.code ?? ''
    const msg = error instanceof Error ? error.message : ''
    if (code === 'permission-denied' || /permission/i.test(msg)) {
      return 'صلاحيات Firestore مغلقة — انشر القواعد من تبويب Rules في Firebase'
    }
    if (/not.?found|does not exist|404/i.test(msg)) {
      return 'قاعدة Firestore لسه متعملتش — أنشئها من كونسول Firebase'
    }
    if (/Firebase is client-only/i.test(msg)) {
      return 'جاري التحميل على المتصفح...'
    }
    return msg || 'تعذر تحميل المرضى من Firebase'
  })()

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="المرضى"
        description="افتح الملف لتسجيل العلاج أو الدفعة"
        action={
          <Button asChild>
            <Link to="/patients/new">
              <Plus />
              إضافة مريض
            </Link>
          </Button>
        }
      />
      <SearchBar value={q} onChange={setQ} placeholder="ابحث باسم المريض أو رقم الموبايل" />

      {isLoading ? (
        <div className="mt-3">
          <LoadingSkeleton rows={5} />
        </div>
      ) : isError ? (
        <div className="mt-3">
          <EmptyState
            title={errorHint}
            action={
              <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
            }
          />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={q ? 'مفيش نتيجة للبحث' : 'لسه مفيش مرضى — أضف أول مريض'}
            action={
              !q ? (
                <Button asChild>
                  <Link to="/patients/new">إضافة مريض</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-3 grid min-h-0 flex-1 content-start gap-2 overflow-auto sm:grid-cols-2 md:hidden">
            {list.map((x) => (
              <PatientCard key={x.id} patient={x} />
            ))}
          </div>
          <div className="glass mt-3 hidden min-h-0 flex-1 overflow-auto rounded-2xl md:block">
            <table className="w-full text-right">
              <thead className="sticky top-0 border-b border-border bg-muted text-sm text-muted-foreground">
                <tr>
                  {['اسم المريض', 'رقم الهاتف', 'السن', 'آخر زيارة', 'المدفوع', 'الباقي', 'الإجراءات'].map((x) => (
                    <th key={x} className="whitespace-nowrap px-3 py-2.5 font-semibold xl:px-4 xl:py-3">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3 font-semibold">{x.name}</td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3" dir="ltr">
                      {x.phone}
                    </td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3">{x.age || '—'}</td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3">{x.lastVisit}</td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3 text-success">{money(x.paid)}</td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3 text-warning">{money(x.total - x.paid)}</td>
                    <td className="px-3 py-2.5 xl:px-4 xl:py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/patients/$patientId" params={{ patientId: x.id }}>
                          عرض الملف
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageSurface>
  )
}
