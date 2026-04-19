'use client';

import { useState } from 'react';
import WarehouseList from './warehouse-list';
import WarehouseForm from './warehouse-form';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { getWarehouses } from '@/app/actions/warehouse-actions';
import { Toaster } from 'react-hot-toast';

export default function WarehouseListWrapper({ initialWarehouses }: { initialWarehouses: any[] }) {
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [isAdding, setIsAdding] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);

  const refreshData = async () => {
    const data = await getWarehouses();
    setWarehouses(data);
    setIsAdding(false);
    setEditingWarehouse(null);
  };

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Registered Warehouses</h2>
        <Button 
          onClick={() => {
            setEditingWarehouse(null);
            setIsAdding(!isAdding);
          }}
          variant={isAdding ? "outline" : "default"}
        >
          {isAdding ? <><X className="mr-2 h-4 w-4" /> Cancel</> : <><Plus className="mr-2 h-4 w-4" /> Add Warehouse</>}
        </Button>
      </div>

      {(isAdding || editingWarehouse) && (
        <div className="mb-6">
          <WarehouseForm 
            warehouse={editingWarehouse} 
            onSuccess={refreshData} 
          />
        </div>
      )}

      <WarehouseList 
        warehouses={warehouses} 
        onEdit={(w) => {
          setIsAdding(false);
          setEditingWarehouse({
            id: w._id,
            name: w.name,
            address: w.address,
            totalCapacity: w.totalCapacity
          });
        }} 
      />
    </div>
  );
}
