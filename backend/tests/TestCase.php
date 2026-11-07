<?php

namespace Tests;

use Closure;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    /** The tests wipe the database, so refuse to touch anything that is not a *_test database. */
    protected function setUpTraits()
    {
        $db = (string) config('database.connections.' . config('database.default') . '.database');

        if (! str_ends_with($db, '_test')) {
            throw new \RuntimeException("Refusing to run: tests wipe the database and '{$db}' is not a *_test database.");
        }

        return parent::setUpTraits();
    }
   
}
