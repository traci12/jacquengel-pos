// Product photos are shown at 125×125. They are saved at 250×250 so they stay
// sharp on phone screens, and stored with the product (about 10–20 KB each).
export const PHOTO_PX = 250

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Center-crops a photo to a square and shrinks it. Returns a data URL. */
export async function photoToSquare(file, size = PHOTO_PX) {
  const img = await loadImage(file)
  const w = img.width
  const h = img.height
  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  let url = canvas.toDataURL('image/webp', 0.8)
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.82)
  return url
}
