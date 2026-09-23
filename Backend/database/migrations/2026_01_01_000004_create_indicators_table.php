<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parameters', function (Blueprint $table) {
            $table->string('parameter_letter', 10)->nullable()->after('area_id');
            $table->boolean('is_custom')->default(false)->after('details');
        });

        Schema::create('indicators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parameter_id')
                ->constrained()
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->enum('section_type', ['SYSTEM_INPUTS', 'IMPLEMENTATION', 'OUTCOME']);
            $table->string('code', 50);
            $table->text('description');
            $table->decimal('item_rating', 3, 2)->nullable();
            $table->boolean('is_custom')->default(false);
            $table->timestamps();

            $table->index(['parameter_id', 'section_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indicators');

        Schema::table('parameters', function (Blueprint $table) {
            $table->dropColumn(['parameter_letter', 'is_custom']);
        });
    }
};
