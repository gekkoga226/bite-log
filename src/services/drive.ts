const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID

/** multipartでDriveにアップロードし、閲覧用URLを返す */
export async function uploadImage(token: string, file: File): Promise<string> {
  const metadata = {
    name: `meal-${Date.now()}-${file.name}`,
    parents: [FOLDER_ID],
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  )
  if (!res.ok) throw new Error(`uploadImage failed: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return `https://drive.google.com/uc?id=${data.id}`
}
