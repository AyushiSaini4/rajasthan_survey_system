/**
 * Seed script — inserts 1,250 locations into the Supabase `locations` table.
 *
 * Run with:  npm run seed
 *
 * Reads .env.local from the project root automatically.
 * Uses the service-role key so it bypasses RLS and can write directly.
 * Skips the insert if rows already exist (safe to re-run).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// ─── 1. Load .env.local ───────────────────────────────────────────────────────

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local')
  let content: string
  try {
    content = readFileSync(envPath, 'utf-8')
  } catch {
    console.error('❌  Could not read .env.local — make sure you run this from the project root.')
    process.exit(1)
  }
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx < 0) continue
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

// ─── 2. Reference data ────────────────────────────────────────────────────────

const INSTITUTION_TYPES = [
  'Rajkiya Prathamik Vidyalaya',       // Govt. Primary School
  'Rajkiya Uchch Prathamik Vidyalaya', // Govt. Upper Primary School
  'Rajkiya Madhyamik Vidyalaya',       // Govt. Secondary School
  'Anganwadi Kendra',                  // Anganwadi Centre
  'Vishesh Aavashyakta Kendra',        // Special Needs Centre
  'Rajkiya Adarsh Vidyalaya',          // Govt. Model School
  'Balwadi Kendra',                    // Child Care Centre
] as const

// Word-parts used to build village names
const VILLAGE_WORDS = [
  'Ram', 'Shiv', 'Dev', 'Hari', 'Maha', 'Surya', 'Lal', 'Maan',
  'Bhim', 'Fateh', 'Pratap', 'Amar', 'Jai', 'Naya', 'Bhagwan',
  'Kali', 'Durga', 'Lakshmi', 'Ganesh', 'Tejaji', 'Mangal',
  'Nathu', 'Jeevan', 'Tulsi', 'Mohan', 'Kishan', 'Gopal',
  'Chandra', 'Nand', 'Bansi', 'Girdhar', 'Sohan', 'Megh',
  'Prem', 'Jagdish', 'Baldev', 'Umrao', 'Hukam', 'Sardar',
  'Neem', 'Peepal', 'Khejri', 'Babul', 'Kiran',
]

const VILLAGE_SUFFIXES = [
  'pura', 'puri', 'wali', 'wala', 'bas', 'nagar', 'garh',
  'ki Dhani', 'ka Bas', 'wala Khera', 'kalan', 'khurd',
  'da', 'ri', 'beri', 'sara',
]

// ─── 3. District configuration (20 districts, total = 1,250) ─────────────────

interface DistrictConfig {
  name:    string
  count:   number
  blocks:  string[]
}

const DISTRICTS: DistrictConfig[] = [
  {
    name: 'Jaipur', count: 100,
    blocks: [
      'Amber', 'Bagru', 'Bassi', 'Chaksu', 'Chomu', 'Dudu',
      'Govindgarh', 'Jamwa Ramgarh', 'Kotputli', 'Phagi',
      'Phulera', 'Sambhar', 'Sanganer', 'Shahpura', 'Viratnagar',
    ],
  },
  {
    name: 'Jodhpur', count: 85,
    blocks: [
      'Bhopalgarh', 'Bilara', 'Luni', 'Mandore', 'Osian',
      'Phalodi', 'Piparcity', 'Shergarh', 'Sheo', 'Balesar',
      'Jodhpur', 'Tinwari', 'Baori',
    ],
  },
  {
    name: 'Udaipur', count: 80,
    blocks: [
      'Badgaon', 'Bhinder', 'Girwa', 'Gogunda', 'Jhadol',
      'Kherwara', 'Kotra', 'Lasadiya', 'Mavli', 'Rishabhdeo',
      'Salumbar', 'Sarada', 'Vallabhnagar', 'Kurabad',
    ],
  },
  {
    name: 'Kota', count: 65,
    blocks: [
      'Hingoli', 'Itawa', 'Kaithun', 'Kanwas', 'Ladpura',
      'Pipalda', 'Ramganj Mandi', 'Sangod', 'Sultanpur', 'Kota',
    ],
  },
  {
    name: 'Ajmer', count: 75,
    blocks: [
      'Arai', 'Beawar', 'Bhinai', 'Bijainagar', 'Govindgarh',
      'Jawaja', 'Kekri', 'Kishangarh', 'Masuda', 'Nasirabad',
      'Peesangan', 'Sarwar', 'Srinagar', 'Vijainagar',
    ],
  },
  {
    name: 'Bikaner', count: 60,
    blocks: [
      'Bajju', 'Colayat', 'Deshnok', 'Dungargarh', 'Khajuwala',
      'Lunkaransar', 'Nokha', 'Pungal', 'Bikaner', 'Sridungargarh',
    ],
  },
  {
    name: 'Alwar', count: 70,
    blocks: [
      'Bahror', 'Bansur', 'Govindgarh', 'Kathumar', 'Kishangarhbas',
      'Laxmangarh', 'Mandawar', 'Narayanpur', 'Raipur', 'Ramgarh',
      'Rajgarh', 'Tapukara', 'Thanagazi', 'Tijara',
    ],
  },
  {
    name: 'Bharatpur', count: 65,
    blocks: [
      'Bayana', 'Bhusawar', 'Deeg', 'Kaman', 'Kumher',
      'Nadbai', 'Nagar', 'Pahari', 'Rupbas', 'Sewar',
      'Sikri', 'Weir',
    ],
  },
  {
    name: 'Sikar', count: 65,
    blocks: [
      'Danta Ramgarh', 'Dhod', 'Fatehpur', 'Khandela',
      'Laxmangarh', 'Neem Ka Thana', 'Patan', 'Piprali',
      'Ramgarh', 'Shrimadhopur', 'Sikar',
    ],
  },
  {
    name: 'Pali', count: 60,
    blocks: [
      'Bali', 'Desuri', 'Jaitaran', 'Kharchi', 'Marwar Junction',
      'Nimaj', 'Pali', 'Rani', 'Rohit', 'Sojat', 'Sumerpur',
    ],
  },
  {
    name: 'Nagaur', count: 65,
    blocks: [
      'Degana', 'Didwana', 'Jayal', 'Khinvsar', 'Kuchaman',
      'Ladnun', 'Makrana', 'Merta', 'Mundwa', 'Nagaur',
      'Nawa', 'Parbatsar', 'Riyan Badi',
    ],
  },
  {
    name: 'Chittorgarh', count: 55,
    blocks: [
      'Begun', 'Bhainsrorgarh', 'Bhadesar', 'Chittorgarh',
      'Dungla', 'Gangrar', 'Kapasan', 'Nimbahera', 'Rashmi',
    ],
  },
  {
    name: 'Bhilwara', count: 60,
    blocks: [
      'Asind', 'Banera', 'Bijoliya', 'Gangapur', 'Hamirgarh',
      'Hurda', 'Jahazpur', 'Kotri', 'Mandal', 'Mandalgarh',
      'Raipur', 'Sahada', 'Shahpura',
    ],
  },
  {
    name: 'Barmer', count: 55,
    blocks: [
      'Baitu', 'Barmer', 'Balotra', 'Chohtan', 'Dhorimanna',
      'Gadra', 'Gudamalani', 'Kawas', 'Pachpadra', 'Ramsar',
      'Sheo', 'Sindhari', 'Siwana',
    ],
  },
  {
    name: 'Jaisalmer', count: 40,
    blocks: [
      'Fatehgarh', 'Jaisalmer', 'Pokaran', 'Sam',
      'Sankra', 'Sattaio',
    ],
  },
  {
    name: 'Jhunjhunu', count: 60,
    blocks: [
      'Alsisar', 'Buhana', 'Chirawa', 'Jhunjhunu', 'Khetri',
      'Malsisar', 'Nawalgarh', 'Pilani', 'Singhana',
      'Surajgarh', 'Udaipurwati',
    ],
  },
  {
    name: 'Sawai Madhopur', count: 50,
    blocks: [
      'Bamanwas', 'Bonli', 'Chauth Ka Barwara', 'Gangapur',
      'Khandar', 'Mitrapura', 'Sawai Madhopur', 'Wazirpur',
    ],
  },
  {
    name: 'Tonk', count: 50,
    blocks: [
      'Deoli', 'Malpura', 'Niwai', 'Peeplu',
      'Todaraisingh', 'Tonk', 'Uniara',
    ],
  },
  {
    name: 'Bundi', count: 45,
    blocks: [
      'Bundi', 'Hindoli', 'Indergarh',
      'Keshoraipatan', 'Nainwa', 'Talera',
    ],
  },
  {
    name: 'Karauli', count: 45,
    blocks: [
      'Hindaun', 'Karauli', 'Mandrayal', 'Masalpur',
      'Nadoti', 'Sapotra', 'Shri Mahaveer Ji', 'Todabhim',
    ],
  },
]

// Verify total = 1,250
const totalCount = DISTRICTS.reduce((s, d) => s + d.count, 0)
if (totalCount !== 1250) {
  throw new Error(`District counts sum to ${totalCount}, expected 1250`)
}

// ─── 4. Location generator ────────────────────────────────────────────────────

interface LocationRow {
  location_code: string
  name:          string
  district:      string
  block:         string
  village:       string
  address:       string
  status:        'pending'
}

function padCode(n: number): string {
  return `RJ-${String(n).padStart(4, '0')}`
}

function buildVillageName(i: number): string {
  // Use different prime-step offsets so word+suffix combos spread evenly
  const word   = VILLAGE_WORDS[i % VILLAGE_WORDS.length]
  const suffix = VILLAGE_SUFFIXES[Math.floor(i / VILLAGE_WORDS.length) % VILLAGE_SUFFIXES.length]
  return `${word}${suffix}`
}

function generateLocations(): LocationRow[] {
  const rows: LocationRow[] = []
  let codeCounter = 1

  for (const district of DISTRICTS) {
    for (let i = 0; i < district.count; i++) {
      const institutionType = INSTITUTION_TYPES[i % INSTITUTION_TYPES.length]
      const block           = district.blocks[i % district.blocks.length]
      const village         = buildVillageName(codeCounter - 1)
      const code            = padCode(codeCounter)
      const name            = `${institutionType} ${village}`
      const address         = `${village}, ${block} Tehsil, ${district.name} District, Rajasthan`

      rows.push({
        location_code: code,
        name,
        district: district.name,
        block,
        village,
        address,
        status: 'pending',
      })

      codeCounter++
    }
  }

  return rows
}

// ─── 5. Main seed function ────────────────────────────────────────────────────

async function seed(): Promise<void> {
  loadEnvLocal()

  const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Guard: skip if already seeded ─────────────────────────────────────────
  const { count, error: countErr } = await supabase
    .from('locations')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    console.error('❌  Could not query locations table:', countErr.message)
    process.exit(1)
  }

  if ((count ?? 0) > 0) {
    console.log(`ℹ️   locations table already has ${count} rows — skipping seed.`)
    console.log('    Delete existing rows first if you want to re-seed.')
    process.exit(0)
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  console.log('⚙️   Generating 1,250 locations…')
  const locations = generateLocations()
  console.log(`✓   Generated ${locations.length} location records`)

  // ── Insert in batches of 100 ───────────────────────────────────────────────
  const BATCH = 100
  let inserted = 0

  for (let i = 0; i < locations.length; i += BATCH) {
    const batch = locations.slice(i, i + BATCH)
    const { error } = await supabase.from('locations').insert(batch)

    if (error) {
      console.error(`\n❌  Insert failed at row ${i + 1}:`, error.message)
      process.exit(1)
    }

    inserted += batch.length
    process.stdout.write(`\r📥  Inserted ${inserted} / ${locations.length}`)
  }

  console.log('\n')

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('✅  Seed complete!\n')
  console.log('District breakdown:')
  const pad = (s: string, n: number) => s.padEnd(n)
  console.log(`  ${pad('District', 20)} ${pad('Count', 8)} Codes`)
  console.log(`  ${'-'.repeat(48)}`)

  let start = 1
  for (const d of DISTRICTS) {
    const end = start + d.count - 1
    console.log(`  ${pad(d.name, 20)} ${pad(String(d.count), 8)} RJ-${String(start).padStart(4,'0')} → RJ-${String(end).padStart(4,'0')}`)
    start += d.count
  }

  console.log(`  ${'-'.repeat(48)}`)
  console.log(`  ${pad('TOTAL', 20)} ${locations.length}`)
}

seed().catch((err) => {
  console.error('❌  Unexpected error:', err)
  process.exit(1)
})
