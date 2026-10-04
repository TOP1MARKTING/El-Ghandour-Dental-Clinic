import type { FormEvent, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageSurface } from './app-shell'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:h-10 sm:text-[15px]'
export const areaClass =
  'min-h-16 w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-[15px]'

export function FormPage({
  title,
  description,
  children,
  submitLabel,
  onSubmit,
  icon,
  mode = 'default',
  submitDisabled = false,
  wide = false,
  gridClassName,
}: {
  title: string
  description: string
  children: ReactNode
  submitLabel: string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  icon?: ReactNode
  mode?: 'default' | 'compact'
  submitDisabled?: boolean
  /** 4 أعمدة على الشاشات الكبيرة عشان الفورم الطويل يبان من غير سكرول */
  wide?: boolean
  gridClassName?: string
}) {
  const router = useRouter()
  const compact = mode === 'compact'

  return (
    <PageSurface
      className={cn(
        'flex flex-col py-1 sm:py-2',
        compact ? 'justify-start lg:h-full lg:overflow-y-auto' : 'lg:h-full lg:overflow-hidden',
      )}
    >
      <div
        className={cn(
          'glass mx-auto flex w-full flex-col rounded-2xl',
          compact
            ? cn('shrink-0 p-3 sm:p-4', wide ? 'max-w-6xl lg:px-5' : 'max-w-3xl')
            : 'max-w-4xl p-4 sm:p-5 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden',
        )}
      >
        <div className={cn('mb-2 flex shrink-0 items-center gap-2 sm:mb-3', compact && 'gap-2.5')}>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 shrink-0 rounded-xl px-3 sm:h-8 sm:px-2"
            onClick={() => router.history.back()}
          >
            <ArrowRight className="size-4" />
            رجوع
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {icon ? (
              <span className="surface-ink grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-clinic">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h1 className={cn('font-semibold', compact ? 'text-lg sm:text-xl' : 'text-2xl')}>
                {title}
              </h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className={cn('flex flex-col', !compact && 'lg:min-h-0 lg:flex-1 lg:overflow-hidden')}>
          <div
            className={cn(
              'grid content-start',
              compact
                ? cn(
                    'shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-2.5',
                    wide && 'lg:gap-x-6',
                  )
                : 'gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3 lg:min-h-0 lg:flex-1 lg:overflow-auto',
              gridClassName,
            )}
          >
            {children}
          </div>

          <div
            className={cn(
              'flex shrink-0 items-center gap-2 border-t border-border/70',
              compact ? 'mt-3 pt-2.5' : 'mt-auto pt-3',
            )}
          >
            <Button
              type="submit"
              disabled={submitDisabled}
              className={cn(
                'min-w-0 flex-1 rounded-xl sm:flex-none',
                compact ? 'h-12 text-[15px] sm:h-11 sm:min-w-48 sm:text-sm' : 'h-12 text-base sm:min-w-44',
              )}
            >
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn('shrink-0 rounded-xl px-5', compact ? 'h-12 sm:h-11' : 'h-12')}
              onClick={() => router.history.back()}
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </PageSurface>
  )
}
