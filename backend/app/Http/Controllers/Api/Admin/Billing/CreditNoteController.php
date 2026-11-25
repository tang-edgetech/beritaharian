<?php

namespace App\Http\Controllers\Api\Admin\Billing;

use App\Http\Controllers\Controller;
use App\Http\Resources\Billing\CreditNoteResource;
use App\Models\Billing\CreditNote;
use App\Services\Billing\DocumentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

class CreditNoteController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $notes = QueryBuilder::for(CreditNote::query()->with(['invoice', 'customer']))
            ->allowedFilters(
                AllowedFilter::callback('q', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('number', 'like', "%{$value}%")
                    ->orWhere('reason', 'like', "%{$value}%")
                    ->orWhereHas('invoice', fn (Builder $i) => $i->where('number', 'like', "%{$value}%"))
                    ->orWhereHas('customer', fn (Builder $c) => $c->withTrashed()->where('name', 'like', "%{$value}%")))),
                AllowedFilter::callback('issued_from', fn (Builder $q, $value) => $q->whereDate('issue_date', '>=', $value)),
                AllowedFilter::callback('issued_to', fn (Builder $q, $value) => $q->whereDate('issue_date', '<=', $value)),
            )
            ->allowedSorts('number', 'issue_date', AllowedSort::field('total', 'total_sen'))
            ->defaultSort('-issue_date')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return CreditNoteResource::collection($notes);
    }

    public function show(CreditNote $creditNote): CreditNoteResource
    {
        return new CreditNoteResource($creditNote->load(['invoice', 'customer', 'issuer']));
    }

    public function pdf(CreditNote $creditNote, DocumentService $documents): Response
    {
        return $documents->creditNote($creditNote)->download($documents->filename($creditNote->number, 'pdf'));
    }
}
