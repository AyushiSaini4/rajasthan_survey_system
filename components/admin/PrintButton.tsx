'use client'

/** PrintButton — triggers the browser print dialog (users choose "Save as PDF" for an export). */
export default function PrintButton({ label = '🖨 Print / Export PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
    >
      {label}
    </button>
  )
}
