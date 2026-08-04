'use client'

import { useEffect, useRef, useState } from 'react'
import { searchCWSNSchools } from '@/lib/supabase/schools-search'
import type { CWSNSchool } from '@/types'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  schoolName: string
  udiseCode: string
  /** Free typing in either field — always fires, works fully offline. */
  onSchoolNameChange: (value: string) => void
  onUdiseCodeChange: (value: string) => void
  /** Fires only when a directory match is picked from the dropdown. */
  onSelectSchool: (school: CWSNSchool) => void
  disabled?: boolean
}

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * SchoolSearchCombobox — autocomplete for the Section 1 "School Name" /
 * "UDISE Code" fields, backed by the public.cwsn_schools master directory.
 *
 * Offline-safe by design: the survey form must work with no signal (see
 * CLAUDE.md — offline sync is non-negotiable). This component never blocks
 * typing on a network round-trip — both fields stay plain, editable text
 * inputs at all times. The dropdown is a progressive enhancement: online,
 * typing 2+ characters searches the directory; offline, or when nothing
 * matches, the agent's typed text is simply used as-is.
 */
export default function SchoolSearchCombobox({
  schoolName,
  udiseCode,
  onSchoolNameChange,
  onUdiseCodeChange,
  onSelectSchool,
  disabled = false,
}: Props) {
  const [results, setResults]   = useState<CWSNSchool[]>([])
  const [isOpen, setIsOpen]     = useState(false)
  const [isLoading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [isOffline, setIsOffline] = useState(false)

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const goOnline  = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Close the dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function runSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (isOffline || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const thisRequestId = ++requestIdRef.current

    debounceRef.current = setTimeout(async () => {
      const matches = await searchCWSNSchools(query)
      // Ignore stale responses from an earlier keystroke that resolved late.
      if (thisRequestId !== requestIdRef.current) return
      setResults(matches)
      setLoading(false)
      setHighlighted(0)
    }, DEBOUNCE_MS)
  }

  function handleNameInput(value: string) {
    onSchoolNameChange(value)
    setIsOpen(true)
    runSearch(value)
  }

  function selectSchool(school: CWSNSchool) {
    onSelectSchool(school)
    setIsOpen(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectSchool(results[highlighted])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* ── School Name — search combobox ─────────────────────────────── */}
      <div className="relative">
        <p className="text-sm font-medium text-gray-700 mb-1.5">
          School Name<span className="text-red-500 ml-0.5">*</span>
        </p>
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            value={schoolName}
            onChange={(e) => handleNameInput(e.target.value)}
            onFocus={() => { if (schoolName.trim().length >= MIN_QUERY_LENGTH) setIsOpen(true) }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Start typing a school name…"
            className="w-full px-3 py-2.5 pr-9 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isLoading ? (
              <svg className="w-4 h-4 text-gray-400 animate-spin" width={16} height={16} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
              </svg>
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {isOpen && results.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto py-1"
          >
            {results.map((school, i) => (
              <li key={school.id} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep input focus, fire before blur
                  onClick={() => selectSchool(school)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    i === highlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-gray-900 truncate">{school.school_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-mono">{school.udise_code}</span>
                    {(school.district || school.block) && (
                      <span> · {[school.block, school.district].filter(Boolean).join(', ')}</span>
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* No-match hint — only once a real search has run */}
        {isOpen && !isLoading && results.length === 0 && schoolName.trim().length >= MIN_QUERY_LENGTH && !isOffline && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5">
            <p className="text-xs text-gray-500">
              No match in the CWSN school directory — the typed name will be saved as entered.
            </p>
          </div>
        )}

        {isOffline && (
          <p className="text-xs text-amber-600 mt-1">
            Offline — school directory search unavailable. Enter the name and UDISE code manually.
          </p>
        )}
      </div>

      {/* ── UDISE Code — plain field, auto-filled on selection, editable ─── */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">
          UDISE Code<span className="text-red-500 ml-0.5">*</span>
        </p>
        <input
          type="text"
          value={udiseCode}
          onChange={(e) => onUdiseCodeChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. 08230412345"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
        />
      </div>
    </div>
  )
}
