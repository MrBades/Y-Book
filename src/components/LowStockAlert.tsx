import { AlertTriangle } from 'lucide-react';
import { Product } from '../types';

interface LowStockAlertProps {
    products: Product[];
    onRestock: (productId: string) => void;
}

export default function LowStockAlert({ products, onRestock }: LowStockAlertProps) {
    const lowStockProducts = products.filter(p => p.stock <= p.minQuantityCount);

    if (lowStockProducts.length === 0) return null;

    return (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 my-4">
            <div className="flex items-center gap-3 text-rose-800 mb-3">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm">Low Stock Alerts ({lowStockProducts.length})</h3>
            </div>
            <div className="space-y-2">
                {lowStockProducts.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-xs bg-white rounded-lg p-2 border border-rose-100">
                        <span className="font-semibold">{p.name} (In Stock: {p.stock})</span>
                        <button 
                            onClick={() => onRestock(p.id)}
                            className="bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold hover:bg-rose-200"
                        >
                            Restock
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
