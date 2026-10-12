<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Purchase extends Model
{
    use BelongsToTenant;

    protected $fillable = ['branch_id', 'supplier_id', 'invoice_no', 'purchase_date', 'total_minor', 'paid_minor', 'note', 'created_by'];
    protected $casts = ['purchase_date' => 'date', 'total_minor' => 'integer', 'paid_minor' => 'integer'];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}
