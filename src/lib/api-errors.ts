export function apiErrorMessage(err: unknown) {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
  switch (code.replace(/^[a-z]+\//, '')) {
    case 'permission-denied':
      return 'مفيش صلاحية للعملية دي'
    case 'resource-exhausted':
      return 'السيرفر عليه ضغط دلوقتي — جرّب تاني بعد شوية'
    case 'unavailable':
      return 'مفيش اتصال بالسيرفر — اتأكد من النت'
    case 'unauthenticated':
      return 'الجلسة خلصت — اخرج وادخل تاني'
    case 'failed-precondition':
      return 'السيرفر محتاج إعداد للعملية دي'
    default:
      return code ? `حصلت مشكلة في السيرفر (${code})` : 'حصلت مشكلة في الاتصال بالسيرفر'
  }
}

/** أخطاء السيرفر بتترجم لرسالة عربي، وأخطاء التطبيق بتظهر زي ما هي */
export function errorText(err: unknown, fallback: string) {
  if (typeof err === 'object' && err && 'code' in err) return apiErrorMessage(err)
  return err instanceof Error && err.message ? err.message : fallback
}
