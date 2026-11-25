/** اسم اللي فاتح الحساب — ملف رفيع عشان Auth ما يسحبش clinic-api / ExcelJS */

let actorName = ''

export function setActorName(name: string) {
  actorName = name
}

export function getActorName() {
  return actorName
}
