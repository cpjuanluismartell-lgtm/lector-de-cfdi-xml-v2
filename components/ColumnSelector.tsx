import React, { useState, useMemo, useEffect } from 'react';

// FIX: Add 'numeric' to the filter type to allow for numeric filtering options.
export interface ColumnDefinition {
    key: string;
    label: string;
    initialWidth: number;
    filter: 'text' | 'select' | 'numeric' | 'none';
    isNumeric?: boolean;
    group: string;
}

interface ColumnSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    allColumns: ColumnDefinition[];
    visibleColumns: Set<string>;
    onSave: (newVisibleColumns: Set<string>) => void;
    defaultColumns: Set<string>;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
    isOpen,
    onClose,
    allColumns,
    visibleColumns,
    onSave,
    defaultColumns,
}) => {
    const [selected, setSelected] = useState(new Set(visibleColumns));

    useEffect(() => {
        setSelected(new Set(visibleColumns));
    }, [visibleColumns, isOpen]);

    const handleToggle = (key: string) => {
        setSelected(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        setSelected(new Set(allColumns.map(c => c.key)));
    };

    const handleDeselectAll = () => {
        setSelected(new Set());
    };

    const handleResetToDefault = () => {
        setSelected(new Set(defaultColumns));
    };

    const handleSave = () => {
        onSave(selected);
        onClose();
    };

    const groupedColumns = useMemo(() => {
        const groups: Record<string, ColumnDefinition[]> = {};
        for (const col of allColumns) {
            if (!groups[col.group]) {
                groups[col.group] = [];
            }
            groups[col.group].push(col);
        }
        return groups;
    }, [allColumns]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-indigo-800">Personalizar Columnas Visibles</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                </header>
                
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {Object.entries(groupedColumns).map(([groupName, columns]) => (
                            <div key={groupName}>
                                <h3 className="text-md font-semibold text-indigo-700 border-b-2 border-indigo-200 pb-1 mb-2">{groupName}</h3>
                                <div className="space-y-1">
                                    {/* FIX: Cast `columns` to `ColumnDefinition[]` to resolve type inference issue with Object.entries. */}
                                    {(columns as ColumnDefinition[]).map(col => (
                                        <label key={col.key} className="flex items-center text-sm text-gray-700 hover:bg-indigo-50 p-1 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selected.has(col.key)}
                                                onChange={() => handleToggle(col.key)}
                                            />
                                            <span className="ml-2">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <footer className="p-4 border-t flex flex-wrap justify-between items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                         <button onClick={handleSelectAll} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400">
                            Seleccionar todo
                        </button>
                        <button onClick={handleDeselectAll} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400">
                            Deseleccionar todo
                        </button>
                        <button onClick={handleResetToDefault} className="px-4 py-2 text-sm bg-indigo-100 text-indigo-800 font-semibold rounded-lg hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            Restaurar Predeterminados
                        </button>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={onClose} className="px-4 py-2 text-sm bg-white text-gray-800 border border-gray-300 font-semibold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400">
                            Cancelar
                        </button>
                        <button onClick={handleSave} className="px-6 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            Aplicar
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};