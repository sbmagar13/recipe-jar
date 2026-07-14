// On-device OCR for photo import. Loaded with a dynamic import so tesseract.js
// and its ~6 MB engine never touch the main bundle or the offline precache.
// Every asset is self-hosted under /ocr, so nothing is sent to a server.

export type OcrProgress = (percent: number) => void

async function makeWorker(onProgress?: OcrProgress) {
  const { createWorker } = await import('tesseract.js')
  // 'eng', OEM 1 (LSTM). Paths are pinned to the self-hosted SIMD build so no
  // request ever goes to a CDN. SIMD is supported by every browser since 2023.
  return createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
    langPath: '/ocr',
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
}

/**
 * Read the text out of an image, entirely on-device. Returns the recognized
 * text, trimmed. Best on printed or typed pages; weak on cursive handwriting.
 */
export async function imageToText(image: File | Blob, onProgress?: OcrProgress): Promise<string> {
  const worker = await makeWorker(onProgress)
  try {
    const { data } = await worker.recognize(image)
    return (data.text ?? '').trim()
  } finally {
    await worker.terminate()
  }
}
