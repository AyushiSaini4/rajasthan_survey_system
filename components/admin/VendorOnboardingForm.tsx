'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Landmark,
  Package,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { onboardVendor } from '@/app/admin/vendors/new/actions'

// ─── Constants ───────────────────────────────────────────────────────────────

const RAJASTHAN_DISTRICTS = [
  'Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara',
  'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur',
  'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu',
  'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand',
  'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur',
]

const SUPPLY_CATEGORIES = [
  { id: 'tiles', label: 'Floor & Wall Tiles' },
  { id: 'toilet_units', label: 'Toilet Units & Sanitary Ware' },
  { id: 'ramp_materials', label: 'Ramp Construction Materials' },
  { id: 'fittings', label: 'Plumbing Fittings & Hardware' },
  { id: 'cement_concrete', label: 'Cement & Concrete' },
  { id: 'steel_iron', label: 'Steel / Iron / Reinforcement' },
  { id: 'paint_finishing', label: 'Paint & Finishing Materials' },
  { id: 'electrical', label: 'Electrical Fittings' },
  { id: 'transport', label: 'Transport & Logistics' },
  { id: 'other', label: 'Other / Miscellaneous' },
]

const VENDOR_TYPES = [
  { value: 'raw_materials', label: 'Raw Materials Supplier' },
  { value: 'tiles', label: 'Tiles Manufacturer / Trader' },
  { value: 'sanitary_fittings', label: 'Sanitary Fittings Supplier' },
  { value: 'construction_hardware', label: 'Construction Hardware' },
  { value: 'transport', label: 'Transport / Logistics' },
  { value: 'other', label: 'Other' },
]

// ─── Validation Schema ────────────────────────────────────────────────────────

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const PINCODE_REGEX = /^\d{6}$/

const vendorSchema = z
  .object({
    // Section 1
    company_name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
    vendor_type: z.enum(
      ['raw_materials', 'tiles', 'sanitary_fittings', 'construction_hardware', 'transport', 'other'] as const,
      { error: 'Please select a vendor type' }
    ),
    registration_number: z.string().max(50).optional().or(z.literal('')),

    // Section 2
    contact_person: z.string().min(2, 'Contact person name required').max(80),
    phone: z
      .string()
      .regex(PHONE_REGEX, 'Enter a valid 10-digit Indian mobile number'),
    email: z
      .string()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal('')),
    website: z
      .string()
      .url('Enter a valid URL (e.g. https://example.com)')
      .optional()
      .or(z.literal('')),

    // Section 3
    address: z.string().min(5, 'Address is required').max(200),
    district: z.string().min(1, 'Please select a district'),
    city: z.string().min(2, 'City / Town is required').max(60),
    state: z.string().min(2, 'State is required').max(60),
    pincode: z.string().regex(PINCODE_REGEX, 'Enter a valid 6-digit pincode'),

    // Section 4
    gst_number: z
      .string()
      .regex(GST_REGEX, 'Invalid GST number format (e.g. 08ABCDE1234F1Z5)')
      .optional()
      .or(z.literal('')),
    pan_number: z
      .string()
      .regex(PAN_REGEX, 'Invalid PAN format (e.g. ABCDE1234F)')
      .optional()
      .or(z.literal('')),

    // Section 5
    bank_name: z.string().min(2, 'Bank name is required').max(80),
    bank_account_holder: z.string().min(2, 'Account holder name required').max(80),
    bank_account_number: z.string().min(6, 'Account number is required').max(20),
    bank_account_number_confirm: z.string().min(1, 'Please confirm account number'),
    bank_ifsc: z
      .string()
      .regex(IFSC_REGEX, 'Invalid IFSC code (e.g. SBIN0001234)'),
    bank_account_type: z.enum(
      ['savings', 'current'] as const,
      { error: 'Please select account type' }
    ),

    // Section 6
    supply_categories: z
      .array(z.string())
      .min(1, 'Select at least one supply category'),

    // Section 7
    notes: z.string().max(500).optional().or(z.literal('')),
  })
  .refine((d) => d.bank_account_number === d.bank_account_number_confirm, {
    message: 'Account numbers do not match',
    path: ['bank_account_number_confirm'],
  })

type VendorFormValues = z.infer<typeof vendorSchema>

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
  step,
}: {
  icon: React.ElementType
  title: string
  description: string
  step: number
}) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
              {step}
            </Badge>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="mt-0.5">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

// ─── Form Component ───────────────────────────────────────────────────────────

export default function VendorOnboardingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      company_name: '',
      vendor_type: undefined,
      registration_number: '',
      contact_person: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      district: '',
      city: '',
      state: 'Rajasthan',
      pincode: '',
      gst_number: '',
      pan_number: '',
      bank_name: '',
      bank_account_holder: '',
      bank_account_number: '',
      bank_account_number_confirm: '',
      bank_ifsc: '',
      bank_account_type: undefined,
      supply_categories: [],
      notes: '',
    },
    mode: 'onTouched',
  })

  function onSubmit(values: VendorFormValues) {
    setSubmitError(null)
    startTransition(async () => {
      const { bank_account_number_confirm: _, ...payload } = values
      const result = await onboardVendor({
        ...payload,
        registration_number: payload.registration_number ?? '',
        email: payload.email ?? '',
        website: payload.website ?? '',
        gst_number: payload.gst_number ?? '',
        pan_number: payload.pan_number ?? '',
        notes: payload.notes ?? '',
      })

      if (result.success) {
        setSubmitted(true)
        setTimeout(() => router.push('/admin/vendors'), 2000)
      } else {
        setSubmitError(result.error ?? 'Something went wrong. Please try again.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Vendor onboarded successfully</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          The vendor record has been saved. Redirecting to vendor list…
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>

        {/* ── Global error banner ─────────────────────────────────────────────── */}
        {submitError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            Section 1 — Business Information
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={Building2}
            step={1}
            title="Business Information"
            description="Legal name and type of the vendor or supplier"
          />
          <CardContent className="space-y-5">
            {/* Company name */}
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Company / Firm Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. XYZ Raw Materials Pvt Ltd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Vendor type */}
              <FormField
                control={form.control}
                name="vendor_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Vendor Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VENDOR_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Registration number */}
              <FormField
                control={form.control}
                name="registration_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Registration No.</FormLabel>
                    <FormControl>
                      <Input placeholder="CIN / MSME / UDYAM (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 2 — Contact Details
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={User}
            step={2}
            title="Contact Details"
            description="Primary point of contact for orders and payments"
          />
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Contact person */}
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Contact Person <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Mobile Number <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="flex">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                          +91
                        </span>
                        <Input
                          className="rounded-l-none"
                          placeholder="98XXXXXXXX"
                          maxLength={10}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@vendor.com (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Website */}
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://vendor.com (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 3 — Address
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={MapPin}
            step={3}
            title="Business Address"
            description="Registered or operational address for correspondence"
          />
          <CardContent className="space-y-5">
            {/* Street address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Street / Locality <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Building, street, area" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              {/* District */}
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      District <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RAJASTHAN_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      City / Town <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Jaipur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* State */}
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      State <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Pre-filled as Rajasthan</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pincode */}
              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      PIN Code <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="3XXXXX" maxLength={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 4 — Tax & Compliance
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={FileText}
            step={4}
            title="Tax & Compliance"
            description="GST and PAN details — required for payment processing"
          />
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* GST */}
              <FormField
                control={form.control}
                name="gst_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="08ABCDE1234F1Z5"
                        maxLength={15}
                        className="font-mono uppercase tracking-wider"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormDescription>15-character GSTIN</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PAN */}
              <FormField
                control={form.control}
                name="pan_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className="font-mono uppercase tracking-wider"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormDescription>10-character Permanent Account Number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <strong>Note:</strong> At least one of GST or PAN is recommended for government payment
              compliance. Both fields are optional but strongly advised.
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 5 — Bank Details
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={Landmark}
            step={5}
            title="Bank Account Details"
            description="Used for NEFT / RTGS payment transfers — stored securely"
          />
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Bank name */}
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Bank Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. State Bank of India" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account holder */}
              <FormField
                control={form.control}
                name="bank_account_holder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Account Holder Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="As printed on passbook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Account number */}
              <FormField
                control={form.control}
                name="bank_account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Account Number <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter account number"
                        autoComplete="off"
                        className="font-mono tracking-wider"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm account number */}
              <FormField
                control={form.control}
                name="bank_account_number_confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Confirm Account Number <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Re-enter account number"
                        autoComplete="off"
                        onPaste={(e) => e.preventDefault()}
                        className="font-mono tracking-wider"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Paste disabled to prevent errors</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* IFSC */}
              <FormField
                control={form.control}
                name="bank_ifsc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      IFSC Code <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SBIN0001234"
                        maxLength={11}
                        className="font-mono uppercase tracking-wider"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>11-character bank branch code</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account type */}
              <FormField
                control={form.control}
                name="bank_account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Account Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="current">Current Account</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 6 — Supply Categories
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={Package}
            step={6}
            title="Supply Categories"
            description="Select all material types this vendor can supply"
          />
          <CardContent>
            <FormField
              control={form.control}
              name="supply_categories"
              render={() => (
                <FormItem>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SUPPLY_CATEGORIES.map((cat) => (
                      <FormField
                        key={cat.id}
                        control={form.control}
                        name="supply_categories"
                        render={({ field }) => {
                          const checked = field.value?.includes(cat.id)
                          return (
                            <FormItem
                              key={cat.id}
                              className="flex flex-row items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    const next = val
                                      ? [...(field.value ?? []), cat.id]
                                      : (field.value ?? []).filter((v) => v !== cat.id)
                                    field.onChange(next)
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal text-sm leading-snug">
                                {cat.label}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage className="mt-3" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            Section 7 — Notes
        ══════════════════════════════════════════════════════════════════════ */}
        <Card>
          <SectionHeader
            icon={Phone}
            step={7}
            title="Additional Notes"
            description="Any extra details, special conditions, or remarks"
          />
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="e.g. Preferred for bulk tile orders, 30-day credit terms, etc."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Max 500 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Actions ────────────────────────────────────────────────────────── */}
        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/vendors')}
            disabled={isPending}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving vendor…
              </>
            ) : (
              <>
                Onboard Vendor
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
