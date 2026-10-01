export function firebaseErrorMessage(err: unknown) {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
  switch (code.replace(/^firestore\//, '')) {
    case 'permission-denied':
      return 'Firebase رافض الصلاحية — لازم قواعد Firestore الجديدة تتنشر من الـ Console'
    case 'resource-exhausted':
      return 'الحصة المجانية بتاعة Firebase خلصت النهاردة — هترجع تشتغل بكرة أو بعد الترقية'
    case 'unavailable':
      return 'مفيش اتصال بـ Firebase — اتأكد من النت'
    case 'unauthenticated':
      return 'الجلسة خلصت — اخرج وادخل تاني'
    case 'failed-precondition':
      return 'Firebase محتاج index للاستعلام ده'
    default:
      return code ? `حصلت مشكلة في Firebase (${code})` : 'حصلت مشكلة في الاتصال بـ Firebase'
  }
}
