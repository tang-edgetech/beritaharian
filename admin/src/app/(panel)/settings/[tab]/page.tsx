"use client";

import { AuditListing } from "@/components/logs/audit-listing";
import { LoginListing } from "@/components/logs/login-listing";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { SettingsForm, type SettingSection } from "@/components/settings/settings-form";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/queries";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

const TABS = [
  { key: "general", label: "General", permission: "settings.manage" },
  { key: "security", label: "Security", permission: "settings.manage" },
  { key: "company", label: "Company", permission: "settings.manage" },
  { key: "billing", label: "Billing", permission: "settings.manage" },
  { key: "logs", label: "Logs", permission: "logs.view" },
  { key: "audit", label: "Audit log", permission: "audit.view" },
  { key: "extra", label: "Extra", permission: "settings.manage" },
] as const;

const GENERAL: SettingSection[] = [
  {
    title: "Site",
    description: "Shown in the header, browser tab and search results.",
    fields: [
      { key: "site_name", label: "Site name", type: "text" },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "seo_title", label: "Search result title", type: "text", hint: "Up to 70 characters." },
      { key: "seo_description", label: "Search result description", type: "textarea", hint: "Up to 160 characters." },
    ],
  },
  {
    title: "Language & time",
    fields: [
      {
        key: "default_locale",
        label: "Default language",
        type: "select",
        options: [
          { value: "en", label: "English" },
          { value: "ms", label: "Bahasa Melayu" },
          { value: "zh", label: "中文" },
        ],
      },
      {
        key: "enabled_locales",
        label: "Languages visitors can choose",
        type: "checklist",
        hint: "Bahasa Melayu and Chinese can be turned on once their translations are ready.",
        options: [
          { value: "en", label: "English" },
          { value: "ms", label: "Bahasa Melayu" },
          { value: "zh", label: "中文" },
        ],
      },
      { key: "timezone", label: "Time zone", type: "select", options: [{ value: "Asia/Kuala_Lumpur", label: "Malaysia (GMT+8)" }] },
    ],
  },
  {
    title: "Contact & social",
    fields: [
      { key: "contact_email", label: "Contact email", type: "email" },
      { key: "contact_phone", label: "Contact phone", type: "text" },
      {
        key: "social_links",
        label: "Social media pages",
        type: "object",
        fields: [
          { key: "facebook", label: "Facebook" },
          { key: "instagram", label: "Instagram" },
          { key: "tiktok", label: "TikTok" },
          { key: "x", label: "X" },
        ],
      },
    ],
  },
  {
    title: "Maintenance",
    fields: [
      { key: "maintenance_mode", label: "Show a maintenance notice on the public site", type: "switch", hint: "Staff can still use the admin panel." },
      { key: "maintenance_message", label: "Maintenance message", type: "textarea" },
    ],
  },
];

const COMPANY: SettingSection[] = [
  {
    title: "Business details",
    description: "Printed at the top of every invoice, receipt, credit note and report. Issued documents keep the details they were issued with.",
    fields: [
      { key: "business_name", label: "Registered business name", type: "text", hint: "Exactly as registered with SSM, once you register." },
      { key: "registration_no", label: "SSM registration number", type: "text", placeholder: "e.g. 202601234567 (1612345-X)" },
      { key: "tax_id", label: "Tax number (TIN)", type: "text", hint: "From LHDN. Needed for e-invoicing later." },
      { key: "sst_no", label: "SST registration number", type: "text", hint: "Only once you are registered for Sales and Service Tax." },
      { key: "address", label: "Business address", type: "textarea", hint: "One line per row, as it should print." },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "email", label: "Billing email", type: "email" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "website", label: "Website", type: "text" },
    ],
  },
  {
    title: "Bank account for payments",
    description: "Shown under \"How to pay\" on every invoice that still has money owing.",
    fields: [
      { key: "bank_name", label: "Bank", type: "text", placeholder: "e.g. Maybank" },
      { key: "bank_account_name", label: "Account name", type: "text" },
      { key: "bank_account_no", label: "Account number", type: "text" },
    ],
  },
];

const BILLING: SettingSection[] = [
  {
    title: "Document numbers",
    description: "Numbers run in order each year, e.g. CS-INV-2026-000001. Changing a prefix only affects new documents.",
    fields: [
      { key: "invoice_prefix", label: "Invoice prefix", type: "text" },
      { key: "receipt_prefix", label: "Receipt prefix", type: "text" },
      { key: "refund_prefix", label: "Refund voucher prefix", type: "text" },
      { key: "credit_note_prefix", label: "Credit note prefix", type: "text" },
      { key: "expense_prefix", label: "Expense prefix", type: "text" },
    ],
  },
  {
    title: "Payment terms & tax",
    fields: [
      { key: "payment_terms_days", label: "Days to pay", type: "number", hint: "Used for the due date when an invoice has none." },
      {
        key: "tax_enabled",
        label: "Charge tax on invoices",
        type: "switch",
        hint: "Leave off until you are registered for SST. When on, each invoice line gets a tax rate.",
      },
      { key: "tax_label", label: "Tax name on documents", type: "text" },
      { key: "default_tax_rate", label: "Default tax rate (%)", type: "number" },
    ],
  },
  {
    title: "Wording on invoices",
    fields: [
      { key: "invoice_notes", label: "Standard note to customers", type: "textarea" },
      { key: "invoice_terms", label: "Standard terms", type: "textarea" },
    ],
  },
  {
    title: "Expense categories",
    fields: [
      {
        key: "expense_categories",
        label: "Categories",
        type: "lines",
        placeholder: "One category per line",
        hint: "Used to group expenses in reports. Renaming one doesn't change expenses already recorded.",
      },
    ],
  },
];

const EXTRA: SettingSection[] = [
  {
    title: "Admin panel",
    fields: [
      {
        key: "items_per_page_default",
        label: "Rows per page in lists",
        type: "select",
        options: ["10", "25", "50", "100"].map((v) => ({ value: v, label: v })),
      },
    ],
  },
  {
    title: "Integrations",
    description: "Payment gateways, maps and WhatsApp keys are added in later phases. Secret keys live in the server's .env file, never here.",
    fields: [{ key: "google_analytics_id", label: "Google Analytics ID", type: "text", placeholder: "G-XXXXXXXXXX" }],
  },
];

function SecuritySettings() {
  const roles = useRoles();
  const sections: SettingSection[] = [
    {
      title: "Two-step sign-in",
      fields: [
        {
          key: "require_two_factor_roles",
          label: "Roles that must use two-step sign-in",
          type: "checklist",
          hint: "People with these roles are asked to set it up before they can use the admin panel.",
          options: (roles.data ?? []).map((r) => ({ value: r.name, label: r.label })),
        },
      ],
    },
    {
      title: "Passwords & sign-in",
      fields: [
        { key: "password_min_length", label: "Shortest password allowed", type: "number", hint: "Characters. 10 or more is recommended." },
        { key: "max_login_attempts", label: "Wrong passwords before a pause", type: "number" },
        { key: "lockout_minutes", label: "Pause length (minutes)", type: "number" },
        { key: "token_lifetime_hours", label: "Stay signed in for (hours)", type: "number" },
      ],
    },
    {
      title: "Account confirmation codes",
      fields: [
        {
          key: "otp_channels",
          label: "Ways to receive codes",
          type: "checklist",
          hint: "WhatsApp and SMS are added later; each sends codes through a paid provider.",
          options: [
            { value: "email", label: "Email" },
            { value: "whatsapp", label: "WhatsApp (coming later)", disabled: true },
            { value: "sms", label: "SMS (coming later)", disabled: true },
          ],
        },
      ],
    },
    {
      title: "Admin access",
      fields: [
        {
          key: "admin_ip_allowlist",
          label: "Only allow the admin panel from these IP addresses",
          type: "lines",
          placeholder: "One address per line. Leave empty to allow any.",
          hint: "Checked by the server in a later update. Leave empty for now.",
        },
      ],
    },
  ];

  return (
    <SettingsForm
      group="security"
      sections={sections}
      footer={
        <p className="text-sm text-muted-foreground">
          To turn on two-step sign-in for your own account, go to{" "}
          <Link href="/account/security" className="font-medium text-foreground underline underline-offset-4">
            Password &amp; security
          </Link>
          .
        </p>
      }
    />
  );
}

export default function SettingsTabPage() {
  const { tab } = useParams<{ tab: string }>();
  const { can } = useAuth();
  const current = TABS.find((t) => t.key === tab);

  if (!current) notFound();

  const visible = TABS.filter((t) => can(t.permission));

  return (
    <>
      <PageHeader title="Settings" description="Changes here are saved for everyone and recorded in the audit log." />
      <RouteTabs label="Settings sections" tabs={visible.map((t) => ({ href: `/settings/${t.key}`, label: t.label }))} />
      {!can(current.permission) ? (
        <p className="panel-card">You don&apos;t have permission to see this section.</p>
      ) : tab === "general" ? (
        <SettingsForm group="general" sections={GENERAL} />
      ) : tab === "security" ? (
        <SecuritySettings />
      ) : tab === "company" ? (
        <SettingsForm group="company" sections={COMPANY} />
      ) : tab === "billing" ? (
        <SettingsForm group="billing" sections={BILLING} />
      ) : tab === "logs" ? (
        <LoginListing />
      ) : tab === "audit" ? (
        <AuditListing />
      ) : (
        <SettingsForm group="extra" sections={EXTRA} />
      )}
    </>
  );
}
