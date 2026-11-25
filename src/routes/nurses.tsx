import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { inputClass } from '@/components/clinic/form-layout'
import { EmptyState, LoadingSkeleton, PageHeader } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import { useClinicSettings, useSaveClinicSettings } from '@/lib/clinic-hooks'
import { errorText } from '@/lib/api-errors'

export const Route = createFileRoute('/nurses')({
  head: () => ({
    meta: [
      { title: 'الممرضات — عيادة الغندور' },
      { name: 'description', content: 'أسماء الممرضات اللي الاستقبال بيختار منها عند التسجيل.' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <NursesPage />
    </AdminOnly>
  ),
})

function NursesPage() {
  const { settings, isLoading, isError, refetch } = useClinicSettings()
  const save = useSaveClinicSettings()
  const [name, setName] = useState('')

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = name.trim()
    if (!next) return
    if (settings.nurses.some((n) => n === next)) {
      toast.error('الاسم ده موجود بالفعل')
      return
    }
    try {
      await save.mutateAsync({ ...settings, nurses: [...settings.nurses, next] })
      toast.success(`اتضافت ${next} ✅`)
      setName('')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإضافة'))
    }
  }

  const remove = async (nurse: string) => {
    if (!window.confirm(`تشيل «${nurse}» من القايمة؟`)) return
    try {
      await save.mutateAsync({ ...settings, nurses: settings.nurses.filter((n) => n !== nurse) })
      toast.success('اتشالت من القايمة')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحذف'))
    }
  }

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="أسماء الممرضات"
        description="الاستقبال بيختار من القايمة دي عند كل تسجيل أو دفعة"
      />

      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الممرضة"
          required
          disabled={isLoading || save.isPending}
          autoFocus
        />
        <Button type="submit" className="h-11 shrink-0 rounded-xl" disabled={isLoading || save.isPending}>
          <Plus className="size-4" />
          إضافة
        </Button>
      </form>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : isError ? (
        <EmptyState title="تعذر تحميل القايمة" action={<Button onClick={() => void refetch()}>حاول تاني</Button>} />
      ) : settings.nurses.length === 0 ? (
        <EmptyState title="لسه مفيش أسماء — ضيف الممرضات عشان يقدروا يسجّلوا الحالات" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {settings.nurses.map((nurse) => (
            <li
              key={nurse}
              className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <UserRound className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nurse}</span>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label={`مسح ${nurse}`}
                disabled={save.isPending}
                onClick={() => void remove(nurse)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageSurface>
  )
}
