export type CameraFrameAnalysis = {
  averageLuminance: number
  luminanceDeviation: number
  edgeScore: number
  darkPixelRatio: number
  uniformityScore: number
  likelyObstructed: boolean
}

export const CAMERA_OBSTRUCTION_CONFIG = {
  analysisIntervalMs: 1000,
  analysisWidth: 160,
  analysisHeight: 90,
  requiredConsecutiveFrames: 4,
  recoveryConsecutiveFrames: 2,
  startupGraceMs: 2000,
  veryDarkLuminance: 22,
  lowDeviation: 8,
  lowEdgeScore: 5,
  highDarkPixelRatio: 0.88,
  highUniformityScore: 0.92,
  uniformPixelTolerance: 8,
} as const

const getLuminance = (red: number, green: number, blue: number) =>
  0.2126 * red + 0.7152 * green + 0.0722 * blue

export function analyzeCameraFrame(
  imageData: ImageData,
): CameraFrameAnalysis {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const luminanceValues = new Float32Array(pixelCount)
  let luminanceTotal = 0
  let darkPixelCount = 0

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4
    const luminance = getLuminance(
      data[dataIndex],
      data[dataIndex + 1],
      data[dataIndex + 2],
    )
    luminanceValues[pixelIndex] = luminance
    luminanceTotal += luminance

    if (luminance <= CAMERA_OBSTRUCTION_CONFIG.veryDarkLuminance) {
      darkPixelCount += 1
    }
  }

  const averageLuminance = luminanceTotal / pixelCount
  let pixelVariance = 0
  let uniformPixelCount = 0
  let edgeDifferenceTotal = 0
  let edgeComparisonCount = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x
      const luminance = luminanceValues[pixelIndex]
      const differenceFromAverage = luminance - averageLuminance
      pixelVariance += differenceFromAverage * differenceFromAverage

      if (
        Math.abs(differenceFromAverage) <=
        CAMERA_OBSTRUCTION_CONFIG.uniformPixelTolerance
      ) {
        uniformPixelCount += 1
      }

      if (x > 0) {
        edgeDifferenceTotal += Math.abs(
          luminance - luminanceValues[pixelIndex - 1],
        )
        edgeComparisonCount += 1
      }

      if (y > 0) {
        edgeDifferenceTotal += Math.abs(
          luminance - luminanceValues[pixelIndex - width],
        )
        edgeComparisonCount += 1
      }
    }
  }

  pixelVariance /= pixelCount
  const luminanceDeviation = Math.sqrt(pixelVariance)
  const edgeScore =
    edgeComparisonCount > 0 ? edgeDifferenceTotal / edgeComparisonCount : 0
  const darkPixelRatio = darkPixelCount / pixelCount
  const uniformityScore = uniformPixelCount / pixelCount
  const frameIsVeryDark =
    averageLuminance <= CAMERA_OBSTRUCTION_CONFIG.veryDarkLuminance ||
    darkPixelRatio >= CAMERA_OBSTRUCTION_CONFIG.highDarkPixelRatio
  const frameHasVeryLowVariance =
    luminanceDeviation <= CAMERA_OBSTRUCTION_CONFIG.lowDeviation
  const frameHasVeryLowEdgeDetail =
    edgeScore <= CAMERA_OBSTRUCTION_CONFIG.lowEdgeScore
  const frameIsHighlyUniform =
    uniformityScore >= CAMERA_OBSTRUCTION_CONFIG.highUniformityScore
  const likelyObstructed =
    frameIsVeryDark ||
    frameHasVeryLowVariance ||
    frameHasVeryLowEdgeDetail ||
    frameIsHighlyUniform

  return {
    averageLuminance,
    luminanceDeviation,
    edgeScore,
    darkPixelRatio,
    uniformityScore,
    likelyObstructed,
  }
}
