<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\Billing\CreditNoteController;
use App\Http\Controllers\Api\Admin\Billing\CustomerController;
use App\Http\Controllers\Api\Admin\Billing\ExpenseController;
use App\Http\Controllers\Api\Admin\Billing\InvoiceController;
use App\Http\Controllers\Api\Admin\Billing\PaymentController;
use App\Http\Controllers\Api\Admin\Billing\ReportController;
use App\Http\Controllers\Api\Admin\LogController;
use App\Http\Controllers\Api\Admin\News\ArticleController;
use App\Http\Controllers\Api\Admin\News\CategoryController;
use App\Http\Controllers\Api\Admin\RoleController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\Directory\BusinessController;
use App\Http\Controllers\Api\Admin\Directory\ClaimController;
use App\Http\Controllers\Api\Admin\Directory\ReviewController as ReviewModerationController;
use App\Http\Controllers\Api\Admin\Directory\SectorController;
use App\Http\Controllers\Api\PlaceAccountController;
use App\Http\Controllers\Api\Public\NewsController;
use App\Http\Controllers\Api\Public\PlaceController;
use App\Services\AuthService;
use Illuminate\Support\Facades\Route;

/*
| All routes here are served under /api/v1 (see bootstrap/app.php).
| Full-access tokens carry the "*" ability; half-finished sign-ins carry only
| account:verify or auth:two-factor and can reach only their own step.
*/

Route::get('settings/public', [SettingController::class, 'public']);

// Public news for the website and the mobile app: no sign-in, read-only.
Route::prefix('public')->middleware('throttle:public')->group(function () {
    Route::get('home', [NewsController::class, 'home']);
    Route::get('articles', [NewsController::class, 'index']);
    Route::get('articles/{slug}', [NewsController::class, 'show']);
    Route::post('articles/{slug}/view', [NewsController::class, 'view'])->middleware('throttle:views');
    Route::get('categories', [NewsController::class, 'categories']);
    Route::get('areas', [NewsController::class, 'areas']);
    Route::get('tags/{slug}', [NewsController::class, 'tag']);

    // Peta Melaka: places, branches and reviews
    Route::get('sectors', [PlaceController::class, 'sectors']);
    Route::get('places', [PlaceController::class, 'index']);
    Route::get('places/pins', [PlaceController::class, 'pins']);
    Route::get('places/{slug}', [PlaceController::class, 'show']);
    Route::get('places/{slug}/reviews', [PlaceController::class, 'reviews']);
});

Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('password/forgot', [AuthController::class, 'forgotPassword']);
    Route::post('password/reset', [AuthController::class, 'resetPassword']);

    Route::middleware(['auth:sanctum', 'abilities:'.AuthService::ABILITY_VERIFY])->group(function () {
        Route::post('verification/send', [AuthController::class, 'sendVerification']);
        Route::post('verification/verify', [AuthController::class, 'verify']);
    });

    Route::post('two-factor/challenge', [AuthController::class, 'twoFactorChallenge'])
        ->middleware(['auth:sanctum', 'abilities:'.AuthService::ABILITY_TWO_FACTOR]);
});

Route::middleware(['auth:sanctum', 'abilities:*'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::prefix('account')->group(function () {
        Route::put('profile', [AccountController::class, 'updateProfile']);
        Route::put('password', [AccountController::class, 'updatePassword']);
        Route::post('two-factor', [AccountController::class, 'twoFactorBegin']);
        Route::post('two-factor/confirm', [AccountController::class, 'twoFactorConfirm']);
        Route::delete('two-factor', [AccountController::class, 'twoFactorDisable']);
        Route::post('two-factor/recovery-codes', [AccountController::class, 'recoveryCodes']);
        Route::get('sessions', [AccountController::class, 'sessions']);
        Route::delete('sessions/others', [AccountController::class, 'revokeOtherSessions']);
        Route::delete('sessions/{id}', [AccountController::class, 'revokeSession'])->whereNumber('id');
    });

    // Readers and owners: reviews, claims, suggestions and the owner's own listings.
    Route::prefix('me')->middleware('throttle:60,1')->group(function () {
        Route::get('places/{slug}', [PlaceAccountController::class, 'status']);
        Route::post('places/{slug}/reviews', [PlaceAccountController::class, 'writeReview'])->middleware('throttle:10,1,write-review');
        Route::post('places/{slug}/claims', [PlaceAccountController::class, 'claim'])->middleware('throttle:5,1,claim-place');
        Route::post('places', [PlaceAccountController::class, 'suggest'])->middleware('throttle:5,1,suggest-place');
        Route::get('reviews', [PlaceAccountController::class, 'myReviews']);
        Route::delete('reviews/{review}', [PlaceAccountController::class, 'deleteReview']);
        Route::post('reviews/{review}/helpful', [PlaceAccountController::class, 'helpful']);
        Route::post('reviews/{review}/report', [PlaceAccountController::class, 'report']);
        Route::put('reviews/{review}/reply', [PlaceAccountController::class, 'reply']);
        Route::delete('reviews/{review}/reply', [PlaceAccountController::class, 'deleteReply']);
        Route::get('businesses', [PlaceAccountController::class, 'myBusinesses']);
        Route::get('businesses/{business}', [PlaceAccountController::class, 'myBusiness']);
        Route::put('businesses/{business}', [PlaceAccountController::class, 'updateMyBusiness']);
        Route::get('businesses/{business}/reviews', [PlaceAccountController::class, 'businessReviews']);
        Route::post('businesses/{business}/photos', [PlaceAccountController::class, 'addPhoto'])->middleware('throttle:30,1,owner-photos');
        Route::put('businesses/{business}/photos/order', [PlaceAccountController::class, 'reorderPhotos']);
        Route::delete('businesses/{business}/photos/{media}', [PlaceAccountController::class, 'removePhoto']);
    });

    Route::prefix('admin')->middleware(['permission:admin.access', 'two-factor.enforced'])->group(function () {
        Route::middleware('permission:users.view')->group(function () {
            Route::get('users', [UserController::class, 'index']);
            Route::get('users/{user}', [UserController::class, 'show'])->withTrashed();
        });
        Route::post('users', [UserController::class, 'store'])->middleware('permission:users.create');
        Route::post('users/bulk', [UserController::class, 'bulk'])->middleware('permission:users.update|users.delete');
        Route::middleware('permission:users.update')->group(function () {
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::post('users/{user}/sign-out-everywhere', [UserController::class, 'signOutEverywhere']);
            Route::delete('users/{user}/two-factor', [UserController::class, 'resetTwoFactor']);
        });
        Route::middleware('permission:users.delete')->group(function () {
            Route::delete('users/{user}', [UserController::class, 'destroy']);
            Route::post('users/{user}/restore', [UserController::class, 'restore'])->withTrashed();
        });

        Route::middleware('permission:roles.manage')->group(function () {
            Route::get('permissions', [RoleController::class, 'permissions']);
            Route::get('roles', [RoleController::class, 'index']);
            Route::post('roles', [RoleController::class, 'store']);
            Route::put('roles/order', [RoleController::class, 'reorder']);
            Route::get('roles/{role:name}', [RoleController::class, 'show']);
            Route::put('roles/{role:name}', [RoleController::class, 'update']);
            Route::delete('roles/{role:name}', [RoleController::class, 'destroy']);
        });

        Route::middleware('permission:settings.manage')->group(function () {
            Route::get('settings/{group}', [SettingController::class, 'show']);
            Route::put('settings/{group}', [SettingController::class, 'update']);
        });

        /*
        | Newsroom: news.write (own drafts), news.edit_any, news.verify, news.publish, news.delete, news.categories.
        | Each workflow step is checked again in ArticleService, so the rules can't be skipped from the API.
        */
        Route::prefix('news')->group(function () {
            Route::middleware('permission:news.write|news.edit_any|news.verify|news.publish')->group(function () {
                Route::get('summary', [ArticleController::class, 'summary']);
                Route::get('articles', [ArticleController::class, 'index']);
                Route::get('articles/{article}', [ArticleController::class, 'show'])->withTrashed();
                Route::get('articles/{article}/revisions', [ArticleController::class, 'revisions']);
                Route::post('articles/{article}/workflow', [ArticleController::class, 'workflow']);
                Route::get('categories', [CategoryController::class, 'index']);
                Route::get('areas', [CategoryController::class, 'areas']);
            });
            Route::middleware('permission:news.write|news.edit_any')->group(function () {
                Route::post('articles', [ArticleController::class, 'store']);
                Route::put('articles/{article}', [ArticleController::class, 'update']);
                Route::delete('articles/{article}', [ArticleController::class, 'destroy']);
                Route::post('media', [ArticleController::class, 'upload'])->middleware('throttle:60,1');
            });
            Route::post('articles/bulk', [ArticleController::class, 'bulk'])->middleware('permission:news.publish|news.delete');
            Route::middleware('permission:news.categories')->group(function () {
                Route::post('categories', [CategoryController::class, 'store']);
                Route::put('categories/order', [CategoryController::class, 'reorder']);
                Route::get('categories/{category}', [CategoryController::class, 'show']);
                Route::put('categories/{category}', [CategoryController::class, 'update']);
                Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
            });
        });

        /*
        | Billing: billing.view reads, billing.manage prepares (customers, drafts, recording payments, expenses),
        | billing.approve makes things official that can't be undone (confirm payments, void, credit notes),
        | billing.reports prints reports and statements.
        */
        Route::prefix('billing')->group(function () {
            Route::middleware('permission:billing.view')->group(function () {
                Route::get('summary', [InvoiceController::class, 'summary']);
                Route::get('config', [InvoiceController::class, 'config']);
                Route::get('customers', [CustomerController::class, 'index']);
                Route::get('customers/options', [CustomerController::class, 'options']);
                Route::get('customers/{customer}', [CustomerController::class, 'show'])->withTrashed();
                Route::get('invoices', [InvoiceController::class, 'index']);
                Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
                Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'pdf']);
                Route::get('payments', [PaymentController::class, 'index']);
                Route::get('payments/{payment}', [PaymentController::class, 'show']);
                Route::get('payments/{payment}/receipt', [PaymentController::class, 'receipt']);
                Route::get('payments/{payment}/slip', [PaymentController::class, 'slip']);
                Route::get('credit-notes', [CreditNoteController::class, 'index']);
                Route::get('credit-notes/{creditNote}', [CreditNoteController::class, 'show']);
                Route::get('credit-notes/{creditNote}/pdf', [CreditNoteController::class, 'pdf']);
                Route::get('expenses', [ExpenseController::class, 'index']);
                Route::get('expenses/{expense}', [ExpenseController::class, 'show'])->withTrashed();
                Route::get('expenses/{expense}/attachment', [ExpenseController::class, 'attachment'])->withTrashed();
            });

            Route::middleware('permission:billing.manage')->group(function () {
                Route::post('customers', [CustomerController::class, 'store']);
                Route::put('customers/{customer}', [CustomerController::class, 'update']);
                Route::delete('customers/{customer}', [CustomerController::class, 'destroy']);
                Route::post('customers/{customer}/restore', [CustomerController::class, 'restore'])->withTrashed();
                Route::post('invoices', [InvoiceController::class, 'store']);
                Route::post('invoices/bulk', [InvoiceController::class, 'bulk']);
                Route::put('invoices/{invoice}', [InvoiceController::class, 'update']);
                Route::delete('invoices/{invoice}', [InvoiceController::class, 'destroy']);
                Route::post('invoices/{invoice}/issue', [InvoiceController::class, 'issue']);
                Route::post('invoices/{invoice}/duplicate', [InvoiceController::class, 'duplicate']);
                Route::post('invoices/{invoice}/payments', [InvoiceController::class, 'recordPayment']);
                Route::post('expenses', [ExpenseController::class, 'store']);
                Route::post('expenses/{expense}', [ExpenseController::class, 'update']); // multipart, so POST
                Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy']);
                Route::post('expenses/{expense}/restore', [ExpenseController::class, 'restore'])->withTrashed();
            });

            Route::middleware('permission:billing.approve')->group(function () {
                Route::post('invoices/{invoice}/void', [InvoiceController::class, 'void']);
                Route::post('invoices/{invoice}/credit-notes', [InvoiceController::class, 'issueCreditNote']);
                Route::post('payments/bulk', [PaymentController::class, 'bulk']);
                Route::post('payments/{payment}/confirm', [PaymentController::class, 'confirm']);
                Route::post('payments/{payment}/reject', [PaymentController::class, 'reject']);
            });

            Route::middleware('permission:billing.reports')->group(function () {
                Route::get('reports/{type}', [ReportController::class, 'show']);
                Route::get('customers/{customer}/statement', [CustomerController::class, 'statement'])->withTrashed();
            });
        });

        /*
        | Places directory: directory.manage edits places and sectors, directory.claims approves new places
        | and ownership claims, reviews.moderate checks receipts, flagged and reported reviews.
        */
        Route::prefix('directory')->group(function () {
            Route::middleware('permission:directory.manage|directory.claims|reviews.moderate')->group(function () {
                Route::get('summary', [BusinessController::class, 'summary']);
                Route::get('sectors', [SectorController::class, 'index']);
                Route::get('areas', [BusinessController::class, 'areas']);
                Route::get('businesses', [BusinessController::class, 'index']);
                Route::get('businesses/{business}', [BusinessController::class, 'show'])->withTrashed();
            });
            Route::middleware('permission:directory.manage')->group(function () {
                Route::get('geocode', [BusinessController::class, 'geocode'])->middleware('throttle:30,1');
                Route::post('businesses', [BusinessController::class, 'store']);
                Route::post('businesses/bulk', [BusinessController::class, 'bulk']);
                Route::put('businesses/{business}', [BusinessController::class, 'update']);
                Route::delete('businesses/{business}', [BusinessController::class, 'destroy']);
                Route::post('businesses/{business}/restore', [BusinessController::class, 'restore'])->withTrashed();
                Route::post('businesses/{business}/status', [BusinessController::class, 'status']);
                Route::post('businesses/{business}/photos', [BusinessController::class, 'addPhoto'])->middleware('throttle:60,1');
                Route::put('businesses/{business}/photos/order', [BusinessController::class, 'reorderPhotos']);
                Route::delete('businesses/{business}/photos/{media}', [BusinessController::class, 'removePhoto']);
                Route::delete('businesses/{business}/members/{user}', [BusinessController::class, 'removeMember']);
                Route::post('sectors', [SectorController::class, 'store']);
                Route::put('sectors/order', [SectorController::class, 'reorder']);
                Route::get('sectors/{sector}', [SectorController::class, 'show']);
                Route::put('sectors/{sector}', [SectorController::class, 'update']);
                Route::delete('sectors/{sector}', [SectorController::class, 'destroy']);
            });
            Route::middleware('permission:directory.claims')->group(function () {
                Route::get('claims', [ClaimController::class, 'index']);
                Route::get('claims/{claim}', [ClaimController::class, 'show']);
                Route::post('claims/{claim}/decide', [ClaimController::class, 'decide']);
                Route::get('claims/{claim}/document', [ClaimController::class, 'document']);
            });
            Route::middleware('permission:reviews.moderate')->group(function () {
                Route::get('reviews', [ReviewModerationController::class, 'index']);
                Route::post('reviews/bulk', [ReviewModerationController::class, 'bulk']);
                Route::get('reviews/{review}', [ReviewModerationController::class, 'show'])->withTrashed();
                Route::post('reviews/{review}/moderate', [ReviewModerationController::class, 'moderate']);
                Route::get('reviews/{review}/receipt', [ReviewModerationController::class, 'receipt'])->withTrashed();
            });
        });

        Route::get('audit-logs', [LogController::class, 'audit'])->middleware('permission:audit.view');
        Route::get('login-history', [LogController::class, 'logins'])->middleware('permission:logs.view');
    });
});
