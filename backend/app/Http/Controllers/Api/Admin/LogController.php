<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Billing\CreditNote;
use App\Models\Billing\Invoice;
use App\Models\Billing\Payment;
use App\Models\LoginHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class LogController extends Controller
{
    /** Audit log: who changed what, with old and new values. Read-only. */
    public function audit(Request $request): JsonResponse
    {
        $page = QueryBuilder::for(Activity::query()->with(['causer', 'subject']))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $v) => $q->where('description', 'like', "%{$v}%")),
                AllowedFilter::exact('log_name'),
                AllowedFilter::exact('event'),
                AllowedFilter::callback('causer', fn (Builder $q, $v) => $q->where('causer_type', User::class)
                    ->where('causer_id', User::withTrashed()->where('ulid', $v)->value('id'))),
                // changes made to one person's account
                AllowedFilter::callback('subject_user', fn (Builder $q, $v) => $q->where('subject_type', User::class)
                    ->where('subject_id', User::withTrashed()->where('ulid', $v)->value('id'))),
                // everything that happened to one invoice: the invoice, its payments and its credit notes
                AllowedFilter::callback('subject_invoice', function (Builder $q, $v) {
                    $invoice = Invoice::where('ulid', $v)->first();
                    $q->where(fn (Builder $w) => $w
                        ->where(fn (Builder $s) => $s->where('subject_type', Invoice::class)->where('subject_id', $invoice?->id))
                        ->orWhere(fn (Builder $s) => $s->where('subject_type', Payment::class)->whereIn('subject_id', Payment::where('invoice_id', $invoice?->id)->select('id')))
                        ->orWhere(fn (Builder $s) => $s->where('subject_type', CreditNote::class)->whereIn('subject_id', CreditNote::where('invoice_id', $invoice?->id)->select('id'))));
                }),
                AllowedFilter::callback('date_from', fn (Builder $q, $v) => $q->whereDate('created_at', '>=', $v)),
                AllowedFilter::callback('date_to', fn (Builder $q, $v) => $q->whereDate('created_at', '<=', $v)),
            )
            ->allowedSorts('created_at', 'log_name')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        $page->getCollection()->transform(fn (Activity $a) => [
            'id' => $a->id,
            'area' => $a->log_name,
            'event' => $a->event,
            'description' => $a->description,
            'by' => $a->causer ? ['id' => $a->causer->ulid ?? null, 'name' => $a->causer->name ?? 'System'] : ['id' => null, 'name' => 'System'],
            'subject' => $a->subject ? [
                'type' => class_basename($a->subject_type),
                'label' => $a->subject->name ?? $a->subject->label ?? $a->subject->number ?? $a->subject->receipt_number ?? ('#'.$a->subject_id),
            ] : null,
            'old' => $a->properties['old'] ?? null,
            'new' => $a->properties['attributes'] ?? null,
            'created_at' => $a->created_at->toIso8601String(),
        ]);

        return response()->json($page);
    }

    /** Sign-in history: successful and failed sign-ins. */
    public function logins(Request $request): JsonResponse
    {
        $page = QueryBuilder::for(LoginHistory::query()->with('user'))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $v) => $q->where(fn (Builder $w) => $w
                    ->where('identifier', 'like', "%{$v}%")->orWhere('ip', 'like', "%{$v}%"))),
                AllowedFilter::callback('succeeded', fn (Builder $q, $v) => $q->where('succeeded', $v === 'yes' || $v === true)),
                AllowedFilter::exact('reason'),
                AllowedFilter::callback('date_from', fn (Builder $q, $v) => $q->whereDate('created_at', '>=', $v)),
                AllowedFilter::callback('date_to', fn (Builder $q, $v) => $q->whereDate('created_at', '<=', $v)),
            )
            ->allowedSorts('created_at', 'identifier')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        $reasons = [
            'wrong_password' => 'Wrong password', 'locked' => 'Locked after too many tries',
            'suspended' => 'Account suspended', 'banned' => 'Account banned', 'two_factor_failed' => 'Wrong two-step code',
        ];

        $page->getCollection()->transform(fn (LoginHistory $l) => [
            'id' => $l->id,
            'identifier' => $l->identifier,
            'user' => $l->user ? ['id' => $l->user->ulid, 'name' => $l->user->name] : null,
            'succeeded' => $l->succeeded,
            'reason' => $l->reason ? ($reasons[$l->reason] ?? $l->reason) : null,
            'ip' => $l->ip,
            'user_agent' => $l->user_agent,
            'created_at' => $l->created_at->toIso8601String(),
        ]);

        return response()->json($page);
    }
}
