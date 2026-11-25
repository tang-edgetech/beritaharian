<?php

namespace App\Exceptions;

use Exception;

/**
 * An error whose message is written for the person using the app, not for developers.
 * The `code` lets the front end react (for example, show a "Send new code" button).
 */
class FriendlyException extends Exception
{
    public function __construct(string $message, public readonly string $errorCode = 'ERROR', public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
