export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isSameDay(dateString: string, d: Date): boolean {
  return toDateString(d) === dateString
}

/** YYYY-MM-DD に n 日を加算した日付文字列を返す（n は負も可） */
export function addDays(dateString: string, n: number): string {
  const [y, m, d] = dateString.split('-').map(Number)
  return toDateString(new Date(y, m - 1, d + n))
}
