export function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf('base64,')
  return idx >= 0 ? dataUrl.slice(idx + 'base64,'.length) : dataUrl
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
