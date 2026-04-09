import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellValueChangedEvent } from 'ag-grid-community';
import type { WeightReading } from '../lib/types';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WeightGridProps {
  readings: WeightReading[];
  onUpdateReadings: (readings: WeightReading[]) => void;
}

function DeleteButton(props: { data: WeightReading; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => props.onClick(props.data.id)}
      className="text-red-400 hover:text-red-300 font-bold text-lg leading-none"
    >
      &times;
    </button>
  );
}

export function WeightGrid({ readings, onUpdateReadings }: WeightGridProps) {
  const readingsRef = useRef(readings);
  readingsRef.current = readings;

  const handleDelete = useCallback((id: string) => {
    const updated = readingsRef.current.filter(r => r.id !== id);
    const renumbered = updated.map((r, i) => ({ ...r, unitNumber: i + 1 }));
    onUpdateReadings(renumbered);
  }, [onUpdateReadings]);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '#',
      field: 'unitNumber',
      width: 90,
      editable: false,
      sortable: false,
      valueFormatter: (params) => {
        if (params.data?.isPartial) {
          return `P (${params.data.partialSizeGrams}g)`;
        }
        return `${params.value}`;
      },
    },
    {
      headerName: 'Weight (g)',
      field: 'weightGrams',
      width: 140,
      editable: true,
      cellDataType: 'number',
      valueParser: (params) => {
        const val = parseFloat(params.newValue);
        return isNaN(val) ? params.oldValue : Math.round(val * 10) / 10;
      },
    },
    {
      headerName: 'Timestamp',
      field: 'timestamp',
      flex: 1,
      editable: false,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const d = params.value instanceof Date ? params.value : new Date(params.value);
        return d.toLocaleTimeString();
      },
    },
    {
      headerName: '',
      width: 60,
      editable: false,
      sortable: false,
      cellRenderer: DeleteButton,
      cellRendererParams: { onClick: handleDelete },
    },
  ], [handleDelete]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const updated = readingsRef.current.map(r =>
      r.id === event.data.id ? { ...r, weightGrams: event.data.weightGrams } : r
    );
    onUpdateReadings(updated);
  }, [onUpdateReadings]);

  const runningTotal = useMemo(() =>
    readings.reduce((sum, r) => sum + r.weightGrams, 0),
    [readings]
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase">Recorded Weights</h3>
        <span className="text-sm text-gray-400">
          Running Total: <span className="text-white font-mono font-semibold">{runningTotal.toFixed(1)} g</span>
        </span>
      </div>
      <div className="ag-theme-alpine-dark w-full" style={{ height: Math.min(400, Math.max(200, readings.length * 42 + 48)) }}>
        <AgGridReact
          rowData={readings}
          columnDefs={columnDefs}
          getRowId={(params) => params.data.id}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit={true}
          domLayout="normal"
        />
      </div>
    </div>
  );
}
