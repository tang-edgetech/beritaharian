<?php

/*
| Every setting the admin can change, with its default value, validation rule and
| whether the public site may read it. Values live in the `settings` table; anything
| not saved yet falls back to the default here. Secrets (API keys, passwords) do not
| belong here; keep them in .env.
*/

return [
    'general' => [
        'site_name' => ['default' => 'Cendol Satay', 'rules' => 'required|string|max:80', 'public' => true],
        'tagline' => ['default' => 'Melaka news & places', 'rules' => 'nullable|string|max:120', 'public' => true],
        'default_locale' => ['default' => 'en', 'rules' => 'required|in:en,ms,zh', 'public' => true],
        'enabled_locales' => ['default' => ['en'], 'rules' => 'required|array|min:1', 'public' => true],
        'timezone' => ['default' => 'Asia/Kuala_Lumpur', 'rules' => 'required|timezone', 'public' => true],
        'contact_email' => ['default' => null, 'rules' => 'nullable|email', 'public' => true],
        'contact_phone' => ['default' => null, 'rules' => 'nullable|string|max:20', 'public' => true],
        'social_links' => ['default' => ['facebook' => null, 'instagram' => null, 'tiktok' => null, 'x' => null], 'rules' => 'nullable|array', 'public' => true],
        'seo_title' => ['default' => 'Cendol Satay · Melaka news & places', 'rules' => 'nullable|string|max:70', 'public' => true],
        'seo_description' => ['default' => null, 'rules' => 'nullable|string|max:160', 'public' => true],
        'maintenance_mode' => ['default' => false, 'rules' => 'boolean', 'public' => true],
        'maintenance_message' => ['default' => 'We are making some improvements. Please check back soon.', 'rules' => 'nullable|string|max:200', 'public' => true],
    ],
    'security' => [
        'require_two_factor_roles' => ['default' => ['super-admin', 'admin'], 'rules' => 'array', 'public' => false],
        'password_min_length' => ['default' => 10, 'rules' => 'required|integer|min:8|max:64', 'public' => true],
        'max_login_attempts' => ['default' => 5, 'rules' => 'required|integer|min:3|max:20', 'public' => false],
        'lockout_minutes' => ['default' => 15, 'rules' => 'required|integer|min:1|max:1440', 'public' => false],
        'token_lifetime_hours' => ['default' => 12, 'rules' => 'required|integer|min:1|max:720', 'public' => false],
        'otp_channels' => ['default' => ['email'], 'rules' => 'required|array|min:1', 'public' => true],
        'admin_ip_allowlist' => ['default' => [], 'rules' => 'array', 'public' => false],
    ],
    // Printed on every invoice, receipt, credit note and report.
    'company' => [
        'business_name' => ['default' => 'Cendol Satay', 'rules' => 'required|string|max:190', 'public' => false],
        'registration_no' => ['default' => null, 'rules' => 'nullable|string|max:60', 'public' => false],
        'tax_id' => ['default' => null, 'rules' => 'nullable|string|max:40', 'public' => false],
        'sst_no' => ['default' => null, 'rules' => 'nullable|string|max:40', 'public' => false],
        'address' => ['default' => 'Melaka, Malaysia', 'rules' => 'nullable|string|max:500', 'public' => false],
        'email' => ['default' => null, 'rules' => 'nullable|email|max:190', 'public' => false],
        'phone' => ['default' => null, 'rules' => 'nullable|string|max:30', 'public' => false],
        'website' => ['default' => null, 'rules' => 'nullable|string|max:190', 'public' => false],
        'bank_name' => ['default' => null, 'rules' => 'nullable|string|max:120', 'public' => false],
        'bank_account_name' => ['default' => null, 'rules' => 'nullable|string|max:190', 'public' => false],
        'bank_account_no' => ['default' => null, 'rules' => 'nullable|string|max:40', 'public' => false],
    ],
    'billing' => [
        'invoice_prefix' => ['default' => 'CS-INV', 'rules' => 'required|string|max:12|regex:/^[A-Z0-9-]+$/', 'public' => false],
        'receipt_prefix' => ['default' => 'CS-RCP', 'rules' => 'required|string|max:12|regex:/^[A-Z0-9-]+$/', 'public' => false],
        'refund_prefix' => ['default' => 'CS-RFD', 'rules' => 'required|string|max:12|regex:/^[A-Z0-9-]+$/', 'public' => false],
        'credit_note_prefix' => ['default' => 'CS-CN', 'rules' => 'required|string|max:12|regex:/^[A-Z0-9-]+$/', 'public' => false],
        'expense_prefix' => ['default' => 'CS-EXP', 'rules' => 'required|string|max:12|regex:/^[A-Z0-9-]+$/', 'public' => false],
        'payment_terms_days' => ['default' => 14, 'rules' => 'required|integer|min:0|max:120', 'public' => false],
        'tax_enabled' => ['default' => false, 'rules' => 'boolean', 'public' => false],
        'tax_label' => ['default' => 'SST', 'rules' => 'required|string|max:20', 'public' => false],
        'default_tax_rate' => ['default' => 8, 'rules' => 'required|numeric|min:0|max:100', 'public' => false],
        'invoice_notes' => ['default' => 'Thank you for supporting Cendol Satay.', 'rules' => 'nullable|string|max:1000', 'public' => false],
        'invoice_terms' => ['default' => "Please quote the invoice number as your payment reference.\nThis is a computer-generated document; no signature is required.", 'rules' => 'nullable|string|max:2000', 'public' => false],
        'expense_categories' => [
            'default' => ['Hosting & software', 'Marketing', 'Printing & stationery', 'Transport', 'Equipment', 'Bank charges', 'Professional fees', 'Other'],
            'rules' => 'required|array|min:1',
            'public' => false,
        ],
    ],
    // Places directory and reviews.
    'directory' => [
        'checkin_radius_m' => ['default' => 150, 'rules' => 'required|integer|min:50|max:1000', 'public' => true],
        'reviews_per_day' => ['default' => 5, 'rules' => 'required|integer|min:1|max:50', 'public' => false],
        'blocked_words' => ['default' => [], 'rules' => 'array', 'public' => false],
        'map_center' => ['default' => ['lat' => 2.1960, 'lng' => 102.2480, 'zoom' => 13], 'rules' => 'required|array', 'public' => true],
    ],
    'extra' => [
        'google_analytics_id' => ['default' => null, 'rules' => 'nullable|string|max:30', 'public' => true],
        'items_per_page_default' => ['default' => 25, 'rules' => 'required|in:10,25,50,100', 'public' => false],
    ],
];
