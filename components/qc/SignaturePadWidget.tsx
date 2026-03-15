'use client'

/**
 * SignaturePadWidget
 *
 * Always loaded via `next/dynamic` with `ssr: false` from QCInspectionForm.
 * Because it is never server-rendered, react-signature-canvas / signature_pad
 * can safely use browser APIs (pointer events, HTMLCanvasElement, etc.) without
 * any server-side guard code.
 *
 * The parent gets the live SignatureCanvas instance through the `onReady` prop
 * (fired once after mount).  Using a callback prop — instead of a forwardRef —
 * sidesteps the TypeScript ref-forwarding limitation of next/dynamic.
 */

import { useRef, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import type { default as SignatureCanvasInstance } from 'react-signature-canvas'

interface Props {
  onReady: (instance: SignatureCanvasInstance) => void
}

export default function SignaturePadWidget({ onReady }: Props) {
  const ref = useRef<SignatureCanvasInstance>(null)

  // Fire onReady exactly once after the canvas has mounted
  useEffect(() => {
    if (ref.current) {
      onReady(ref.current)
    }
    // We intentionally omit `onReady` from deps: the callback is defined
    // inline in the parent and we only want to fire once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SignatureCanvas
      ref={ref}
      penColor="#1e1b4b"
      canvasProps={{
        className: 'w-full',
        style: { width: '100%', height: 140, display: 'block' },
      }}
    />
  )
}
