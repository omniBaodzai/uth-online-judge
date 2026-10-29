export type CropSize = { width: number; height: number }
export type CropOffset = { x: number; y: number }
export type CropRect = { x: number; y: number; width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function getBaseCropSize(source: CropSize, aspect: number): CropSize {
  const width = Math.min(source.width, source.height * aspect)
  return { width, height: width / aspect }
}

export function getMaxCropOffset(source: CropSize, zoom: number, aspect: number): CropOffset {
  const base = getBaseCropSize(source, aspect)
  return {
    x: Math.max(0, (source.width - base.width * zoom) / (2 * base.width * zoom)),
    y: Math.max(0, (source.height - base.height * zoom) / (2 * base.height * zoom)),
  }
}

export function constrainCropOffset(
  source: CropSize,
  zoom: number,
  aspect: number,
  offset: CropOffset,
): CropOffset {
  const limit = getMaxCropOffset(source, zoom, aspect)
  return { x: clamp(offset.x, -limit.x, limit.x), y: clamp(offset.y, -limit.y, limit.y) }
}

export function getCropRect(
  source: CropSize,
  zoom: number,
  aspect: number,
  offset: CropOffset,
): CropRect {
  const base = getBaseCropSize(source, aspect)
  const width = base.width / zoom
  const height = base.height / zoom
  const constrained = constrainCropOffset(source, zoom, aspect, offset)
  return {
    x: clamp(source.width / 2 - constrained.x * width - width / 2, 0, source.width - width),
    y: clamp(source.height / 2 - constrained.y * height - height / 2, 0, source.height - height),
    width,
    height,
  }
}

export function getCropImageStyle(
  source: CropSize,
  zoom: number,
  aspect: number,
  offset: CropOffset,
) {
  const base = getBaseCropSize(source, aspect)
  const constrained = constrainCropOffset(source, zoom, aspect, offset)
  return {
    width: `${(source.width / (base.width * zoom)) * 100}%`,
    height: `${(source.height / (base.height * zoom)) * 100}%`,
    left: `${(0.5 + constrained.x) * 100}%`,
    top: `${(0.5 + constrained.y) * 100}%`,
  }
}