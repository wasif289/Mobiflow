<?php
declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany};

final class Sale extends Model
{
    use BelongsToTenant;

    protected $fillable = ['branch_id', 'customer_id', 'invoice_no', 'sale_date', 'total_minor', 'received_minor', 'note', 'created_by'];
    protected $casts = ['sale_date' => 'date', 'total_minor' => 'integer', 'received_minor' => 'integer'];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function items(): HasMany { return $this->hasMany(SaleItem::class); }
}
