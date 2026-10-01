import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { PageSurface } from '@/components/clinic/app-shell'
import { Button } from '@/components/ui/button'
import { useIsAdmin } from '@/lib/clinic-hooks'

export function AdminOnly({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  if (isAdmin) return <>{children}</>
  return (
    <PageSurface>
      <div className="glass grid min-h-64 place-items-center rounded-2xl p-8 text-center">
        <div>
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">الصفحة دي للأدمن بس</h2>
          <p className="mt-1 text-sm text-muted-foreground">ادخل بحساب الأدمن عشان تشوفها</p>
          <Button asChild className="mt-4">
            <Link to="/">الرئيسية</Link>
          </Button>
        </div>
      </div>
    </PageSurface>
  )
}
