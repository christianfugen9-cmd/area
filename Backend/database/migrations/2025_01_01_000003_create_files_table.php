<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('files', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->string('file_path', 1024);
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type', 191)->nullable();

            // Creates attachable_type + attachable_id and a composite index.
            $table->morphs('attachable');

            $table->timestamps();

            // Used by ?search= against file names.
            $table->index('file_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('files');
    }
};