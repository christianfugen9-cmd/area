<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('areas', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();

            // Supports the default ordering (?sort_by=created_at).
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('areas');
    }
};