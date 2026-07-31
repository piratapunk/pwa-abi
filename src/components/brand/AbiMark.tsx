import { cn } from '@/lib/utils'

export function AbiMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('size-7', className)}
    >
      <path
        d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3.5"
      />
      <path
        d="M32 21 L42 27 L42 39 L32 45 L22 39 L22 27 Z"
        fill="var(--accent)"
      />
    </svg>
  )
}

export function AbiWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <AbiMark />
      <span className="font-logo text-xl font-bold tracking-tight text-text">
        Abi
      </span>
    </span>
  )
}
