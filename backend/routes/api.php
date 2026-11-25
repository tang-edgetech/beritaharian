<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\Billing\CreditNoteController;
use App\Http\Controllers\Api\Admin\Billing\CustomerController;
use App\Http\Controllers\Api\Admin\Billing\ExpenseController;
use App\Http\Controllers\Api\Admin\Billing\InvoiceController;
use App\Http\Controllers\Api\Admin\Billing\PaymentController;
use App\Http\Controllers\Api\Admin\Billing\ReportController;
use App\Http\Controllers\Api\Admin\LogController;
use App\Http\Controllers\Api\Admin\RoleController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Services\AuthService;
use Illuminate\Support\Facades\Route;

/*
| All routes here are served under /api/v1 (see bootstrap/app.php).
| Full-access tokens carry the "*" ability; half-finished sign-ins carry only
| account:verify or auth:two-factor and can reach only their own step.
*/

Route::get('settings/public', [SettingController::class, 'public']);

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

        Route::get('audit-logs', [LogController::class, 'audit'])->middleware('permission:audit.view');
        Route::get('login-history', [LogController::class, 'logins'])->middleware('permission:logs.view');
    });
});
