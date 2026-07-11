import React, { useMemo, useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { CFDI, Percepcion, Deduccion, OtroPago } from '../types';
import { exportToExcel } from '../utils/excelExporter';
import { ColumnSelector, type ColumnDefinition } from './ColumnSelector';

interface ResultsTableProps {
    data: CFDI[];
    onClear: () => void;
    hasMetadata: boolean;
    onMetadataUpdate: (files: File[]) => void;
    has69BData: boolean;
    on69BCheck: (file: File) => void;
    isLoading: boolean;
}

export interface ResultsTableRef {
  apply69BFilter: () => void;
}

const formatNumber = (num: number | undefined) => {
    if (typeof num !== 'number' || isNaN(num)) {
        return '$0.00';
    }
    return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
};

const ResizableHeader: React.FC<{
    label: string;
    width: number;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: () => void;
    sortOrder: 'asc' | 'desc' | undefined;
}> = ({ label, width, onMouseDown, onClick, sortOrder }) => {
    return (
        <th
            scope="col"
            style={{ width: `${width}px` }}
            className="px-4 py-3 relative whitespace-nowrap cursor-pointer select-none group"
            onClick={onClick}
        >
            <div className="flex items-center gap-1">
                 <span>{label}</span>
                <span className="w-4 h-4 text-xs text-indigo-300">
                  {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : <span className="opacity-0 group-hover:opacity-100">↕</span>}
                </span>
            </div>
            <div
                className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                onMouseDown={onMouseDown}
            />
        </th>
    );
};

const FooterCell: React.FC<{ children?: React.ReactNode; isNumeric?: boolean; colSpan?: number }> = ({ children, isNumeric = false, colSpan }) => (
    <td colSpan={colSpan} className={`px-4 py-3 font-bold ${isNumeric ? 'font-mono text-right' : ''}`}>{children}</td>
);

const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const ALL_COLUMNS: ColumnDefinition[] = [
    // --- General CFDI ---
    { key: 'uuid', label: 'UUID', initialWidth: 300, filter: 'text', group: 'General' },
    { key: 'tipoDeComprobante', label: 'TipoDeComprobante', initialWidth: 150, filter: 'select', group: 'General' },
    { key: 'estatus', label: 'Estatus SAT', initialWidth: 100, filter: 'select', group: 'General' },
    { key: 'is69B', label: 'En 69-B', initialWidth: 100, filter: 'select', group: 'General' },
    { key: 'fecha', label: 'Fecha', initialWidth: 120, filter: 'text', group: 'General' },
    { key: 'serie', label: 'Serie', initialWidth: 80, filter: 'text', group: 'General' },
    { key: 'folio', label: 'Folio', initialWidth: 100, filter: 'text', group: 'General' },
    { key: 'version', label: 'Version', initialWidth: 80, filter: 'text', group: 'General' },
    { key: 'lugarExpedicion', label: 'Lugar Expedición', initialWidth: 150, filter: 'text', group: 'General' },
    { key: 'exportacion', label: 'Exportación', initialWidth: 100, filter: 'text', group: 'General' },
    // --- Emisor / Receptor ---
    { key: 'rfcEmisor', label: 'RFC Emisor', initialWidth: 130, filter: 'text', group: 'Emisor' },
    { key: 'nombreEmisor', label: 'Nombre Emisor', initialWidth: 250, filter: 'text', group: 'Emisor' },
    { key: 'regimenFiscalEmisor', label: 'Régimen Fiscal Emisor', initialWidth: 200, filter: 'text', group: 'Emisor' },
    { key: 'rfcReceptor', label: 'RFC Receptor', initialWidth: 130, filter: 'text', group: 'Receptor' },
    { key: 'nombreReceptor', label: 'Nombre Receptor', initialWidth: 250, filter: 'text', group: 'Receptor' },
    { key: 'usoCFDI', label: 'UsoCFDI', initialWidth: 150, filter: 'text', group: 'Receptor' },
    { key: 'domicilioFiscalReceptor', label: 'Domicilio Fiscal Receptor', initialWidth: 200, filter: 'text', group: 'Receptor' },
    { key: 'regimenFiscalReceptor', label: 'Régimen Fiscal Receptor', initialWidth: 200, filter: 'text', group: 'Receptor' },
    // --- Conceptos e Importes ---
    { key: 'descripcion', label: 'Descripcion', initialWidth: 300, filter: 'text', group: 'Conceptos' },
    { key: 'subTotal', label: 'SubTotal', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'descuento', label: 'Descuento', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'iva', label: 'IVA', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'isrRetenido', label: 'ISR Retenido', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'ivaRetenido', label: 'IVA Retenido', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'otrosImpuestos', label: 'Otros impuestos', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'total', label: 'Total', initialWidth: 120, filter: 'numeric', isNumeric: true, group: 'Importes' },
    { key: 'moneda', label: 'Moneda', initialWidth: 80, filter: 'text', group: 'Importes' },
    { key: 'tipoCambio', label: 'TipoCambio', initialWidth: 90, filter: 'none', isNumeric: true, group: 'Importes' },
    // --- Pago ---
    { key: 'metodoPago', label: 'MetodoPago', initialWidth: 100, filter: 'select', group: 'Pago' },
    { key: 'formaPago', label: 'FormaPago', initialWidth: 100, filter: 'select', group: 'Pago' },
    // --- Timbre Fiscal / Relacionados ---
    { key: 'fechaTimbrado', label: 'FechaTimbrado', initialWidth: 150, filter: 'text', group: 'Timbre Fiscal' },
    { key: 'rfcProvCertif', label: 'RFC Prov. Certif.', initialWidth: 150, filter: 'text', group: 'Timbre Fiscal' },
    { key: 'noCertificado', label: 'No. Certificado', initialWidth: 180, filter: 'text', group: 'Timbre Fiscal' },
    { key: 'certificado', label: 'Certificado', initialWidth: 300, filter: 'none', group: 'Timbre Fiscal' },
    { key: 'sello', label: 'Sello', initialWidth: 300, filter: 'none', group: 'Timbre Fiscal' },
    { key: 'uuidRelacionado', label: 'UUID Relacionado', initialWidth: 300, filter: 'text', group: 'CFDI Relacionado' },
    // --- Complemento de Pago (Detalle) ---
    { key: 'fechaPago', label: 'FechaPago', initialWidth: 120, filter: 'text', group: 'Complemento de Pago (Detalle)' },
    { key: 'numParcialidad', label: 'Parcialidad', initialWidth: 100, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    { key: 'impSaldoAnt', label: 'Saldo Anterior', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    { key: 'impPagado', label: 'Importe Pagado', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    { key: 'impSaldoInsoluto', label: 'Saldo Insoluto', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    { key: 'monedaDR', label: 'Moneda DR', initialWidth: 90, filter: 'text', group: 'Complemento de Pago (Detalle)' },
    { key: 'equivalenciaDR', label: 'Equivalencia DR', initialWidth: 110, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    { key: 'objetoImpDR', label: 'ObjetoImpDR', initialWidth: 120, filter: 'text', group: 'Complemento de Pago (Detalle)' },
    { key: 'impuestoDR', label: 'ImpuestoDR', initialWidth: 100, filter: 'text', group: 'Complemento de Pago (Detalle)' },
    { key: 'tipoFactorDR', label: 'TipoFactorDR', initialWidth: 120, filter: 'text', group: 'Complemento de Pago (Detalle)' },
    { key: 'tasaOCuotaDR', label: 'TasaOCuotaDR', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Complemento de Pago (Detalle)' },
    // --- Nómina General ---
    { key: 'nomina.version', label: 'Versión Nómina', initialWidth: 120, filter: 'text', group: 'Nómina - General' },
    { key: 'nomina.tipoNomina', label: 'Tipo Nómina', initialWidth: 120, filter: 'text', group: 'Nómina - General' },
    { key: 'nomina.fechaPago', label: 'Fecha de Pago (N)', initialWidth: 140, filter: 'text', group: 'Nómina - General' },
    { key: 'nomina.fechaInicialPago', label: 'Fecha Ini. Pago (N)', initialWidth: 140, filter: 'text', group: 'Nómina - General' },
    { key: 'nomina.fechaFinalPago', label: 'Fecha Fin. Pago (N)', initialWidth: 140, filter: 'text', group: 'Nómina - General' },
    { key: 'nomina.numDiasPagados', label: 'Días Pagados', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Nómina - General' },
    // --- Nómina Emisor ---
    { key: 'nomina.registroPatronal', label: 'Registro Patronal', initialWidth: 180, filter: 'text', group: 'Nómina - Emisor' },
    // --- Nómina Receptor ---
    { key: 'nomina.curp', label: 'CURP', initialWidth: 180, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.numSeguridadSocial', label: 'NSS', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.fechaInicioRelLaboral', label: 'Inicio Rel. Laboral', initialWidth: 150, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.antiguedad', label: 'Antigüedad', initialWidth: 100, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.tipoContrato', label: 'Tipo Contrato', initialWidth: 150, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.sindicalizado', label: 'Sindicalizado', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.tipoJornada', label: 'Tipo Jornada', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.tipoRegimen', label: 'Tipo Régimen', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.numEmpleado', label: 'Num. Empleado', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.puesto', label: 'Puesto', initialWidth: 150, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.riesgoPuesto', label: 'Riesgo Puesto', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.periodicidadPago', label: 'Periodicidad Pago', initialWidth: 150, filter: 'text', group: 'Nómina - Receptor' },
    { key: 'nomina.salarioBaseCotApor', label: 'Salario Base', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Nómina - Receptor' },
    { key: 'nomina.salarioDiarioIntegrado', label: 'Salario Diario Int.', initialWidth: 140, filter: 'none', isNumeric: true, group: 'Nómina - Receptor' },
    { key: 'nomina.claveEntFed', label: 'Clave Ent. Fed.', initialWidth: 120, filter: 'text', group: 'Nómina - Receptor' },
    // --- Nómina Totales ---
    { key: 'nomina.totalPercepciones', label: 'Total Percepciones', initialWidth: 150, filter: 'none', isNumeric: true, group: 'Nómina - Totales' },
    { key: 'nomina.totalDeducciones', label: 'Total Deducciones', initialWidth: 150, filter: 'none', isNumeric: true, group: 'Nómina - Totales' },
    { key: 'nomina.totalOtrosPagos', label: 'Total Otros Pagos', initialWidth: 150, filter: 'none', isNumeric: true, group: 'Nómina - Totales' },
    // --- Nómina Detalles ---
    { key: 'detalle.tipo', label: 'Tipo Detalle', initialWidth: 120, filter: 'none', group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.clave', label: 'Clave Concepto', initialWidth: 120, filter: 'none', group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.concepto', label: 'Concepto Detalle', initialWidth: 250, filter: 'none', group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.importe', label: 'Importe Detalle', initialWidth: 120, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.importeGravado', label: 'Importe Gravado', initialWidth: 130, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.importeExento', label: 'Importe Exento', initialWidth: 130, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.subsidioCausado', label: 'Subsidio Causado', initialWidth: 130, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.dias', label: 'Días (HE)', initialWidth: 90, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.tipoHoras', label: 'Tipo Horas', initialWidth: 100, filter: 'none', group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.horasExtra', label: 'Horas Extra', initialWidth: 100, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
    { key: 'detalle.importePagado', label: 'Importe Pagado (HE)', initialWidth: 150, filter: 'none', isNumeric: true, group: 'Nómina - Detalle de Conceptos' },
];


const DEFAULT_VISIBLE_COLUMNS = new Set([
  'uuid', 'tipoDeComprobante', 'fecha', 'fechaTimbrado', 'serie', 'folio',
  'rfcEmisor', 'nombreEmisor', 'rfcReceptor', 'nombreReceptor', 'descripcion',
  'subTotal', 'descuento', 'iva', 'isrRetenido', 'ivaRetenido', 'otrosImpuestos', 'total',
  'metodoPago', 'formaPago', 'uuidRelacionado', 'version', 'moneda', 'tipoCambio', 'usoCFDI',
  'fechaPago'
]);

export const ResultsTable = forwardRef<ResultsTableRef, ResultsTableProps>(({ data, onClear, hasMetadata, onMetadataUpdate, has69BData, on69BCheck, isLoading }, ref) => {
    const [filters, setFilters] = useState<Partial<Record<string, string | Set<string>>>>({});
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const metadataInputRef = useRef<HTMLInputElement>(null);
    const file69BInputRef = useRef<HTMLInputElement>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>({ key: 'fecha', order: 'asc' });
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdownKey(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useImperativeHandle(ref, () => ({
      apply69BFilter: () => {
        setFilters(prev => ({ ...prev, is69B: 'Sí' }));
      }
    }));

    // FIX: Safely parse visible columns from localStorage, ensuring it is a string array.
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('cfdi-visible-columns');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
                    // FIX: The type predicate `(item): item is string` correctly narrows `parsed` to `string[]`.
                    // The explicit cast was unnecessary and caused a type error. It has been removed.
                    return new Set(parsed);
                }
            }
        } catch (e) {
            console.error("Failed to parse visible columns from localStorage", e);
        }
        return DEFAULT_VISIBLE_COLUMNS;
    });

    useEffect(() => {
        if (hasMetadata && !visibleColumns.has('estatus')) {
            setVisibleColumns(prev => {
                const newSet = new Set(prev);
                newSet.add('estatus');
                return newSet;
            });
        }
         if (has69BData && !visibleColumns.has('is69B')) {
            setVisibleColumns(prev => {
                const newSet = new Set(prev);
                newSet.add('is69B');
                return newSet;
            });
        }
    }, [hasMetadata, has69BData, visibleColumns]);

    const handleVisibleColumnsChange = (newVisible: Set<string>) => {
        setVisibleColumns(newVisible);
        try {
            localStorage.setItem('cfdi-visible-columns', JSON.stringify(Array.from(newVisible)));
        } catch (e) {
            console.error("Failed to save column preferences:", e);
        }
    };

    const columnDefinitions = useMemo(() => {
        let activeColumns = ALL_COLUMNS.filter(c => visibleColumns.has(c.key));
        if (!hasMetadata) activeColumns = activeColumns.filter(c => c.key !== 'estatus');
        if (!has69BData) activeColumns = activeColumns.filter(c => c.key !== 'is69B');
        return activeColumns;
    }, [hasMetadata, has69BData, visibleColumns]);
    
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
        ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: col.initialWidth }), {})
    );
    
    const resizingColumnRef = useRef<string | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    
    const onMouseDown = useCallback((key: string, e: React.MouseEvent) => {
        e.preventDefault();
        resizingColumnRef.current = key;
        startXRef.current = e.clientX;
        startWidthRef.current = columnWidths[key];
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [columnWidths]);
    
    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!resizingColumnRef.current) return;
        const key = resizingColumnRef.current;
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.max(startWidthRef.current + delta, 50);
        setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
    }, []);
    
    const onMouseUp = useCallback(() => {
        resizingColumnRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove]);
    
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    const selectOptions = useMemo(() => {
        const tipoFilter = filters.tipoDeComprobante;
        const preFilteredDataForFormaPago = (tipoFilter instanceof Set && tipoFilter.size > 0)
            ? data.filter(item => tipoFilter.has(item.tipoDeComprobante))
            : data;

        const options: Partial<Record<string, string[]>> = {};
        const selectCols = ALL_COLUMNS.filter(c => c.filter === 'select').map(c => c.key);

        selectCols.forEach(key => {
            const sourceData = key === 'formaPago' ? preFilteredDataForFormaPago : data;
            const uniqueValues = sourceData.reduce((acc, item) => {
                const value = getNestedValue(item, key);
                if (key === 'is69B') {
                    if (item.is69B === true) acc.add('Sí');
                    if (item.is69B === false) acc.add('No');
                } else if (value != null && value !== '') {
                    acc.add(String(value));
                }
                return acc;
            }, new Set<string>());
            options[key] = Array.from(uniqueValues).sort();
        });
        return options;
    }, [data, filters.tipoDeComprobante]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleMultiSelectChange = (key: string, option: string) => {
        setFilters(prev => {
            const currentFilter = prev[key];
            const newSet = new Set(currentFilter instanceof Set ? currentFilter : []);
            if (newSet.has(option)) {
                newSet.delete(option);
            } else {
                newSet.add(option);
            }
            return { ...prev, [key]: newSet };
        });
    };

    const handleClearFilters = () => setFilters({});
    const areFiltersActive = useMemo(() => Object.values(filters).some(v => v instanceof Set ? v.size > 0 : !!v), [filters]);

    const filteredData = useMemo(() => {
        const areFiltersReallyActive = Object.values(filters).some(v => (v instanceof Set ? v.size > 0 : !!v));
        if (!areFiltersReallyActive) {
            return data;
        }

        return data.filter(item => {
            return Object.entries(filters).every(([key, filterValue]) => {
                if (!filterValue || (filterValue instanceof Set && filterValue.size === 0)) {
                    return true;
                }

                const columnDef = ALL_COLUMNS.find(c => c.key === key);
                const rawValue = getNestedValue(item, key);

                if (columnDef?.filter === 'numeric') {
                    const numericValue = Number(rawValue ?? 0);
                    if (filterValue === '>0') return numericValue !== 0;
                    if (filterValue === '=0') return numericValue === 0;
                    return true;
                }

                if (filterValue instanceof Set) {
                    return filterValue.has(String(rawValue ?? ''));
                }

                let itemValue;
                if (key === 'is69B') {
                    itemValue = rawValue === true ? 'Sí' : (rawValue === false ? 'No' : '');
                } else {
                    itemValue = String(rawValue ?? '');
                }
                
                return itemValue.toLowerCase().includes(String(filterValue).toLowerCase());
            });
        });
    }, [data, filters]);

    const handleSort = (key: string) => {
        let order: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.order === 'asc') order = 'desc';
        setSortConfig({ key, order });
    };

    const allUuids = useMemo(() => new Set(data.map(d => d.uuid)), [data]);

    const handleScrollToUuid = (uuid: string) => {
        const element = document.getElementById(`row-${uuid}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-yellow-200', 'transition-all', 'duration-300');
            setTimeout(() => {
                element.classList.remove('bg-yellow-200');
            }, 2500);
        }
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);
                if (aValue == null) return 1;
                if (bValue == null) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return (aValue - bValue) * (sortConfig.order === 'asc' ? 1 : -1);
                }
                return String(aValue).localeCompare(String(bValue), 'es', { numeric: true }) * (sortConfig.order === 'asc' ? 1 : -1);
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const paymentComplementUUIDs = useMemo(() => filteredData.filter(i => i.tipoDeComprobante === 'P').map(i => i.uuid), [filteredData]);
    const nominaComplementUUIDs = useMemo(() => filteredData.filter(i => i.tipoDeComprobante === 'N').map(i => i.uuid), [filteredData]);
    
    const paymentDetailColumnKeys = useMemo(() =>
      ALL_COLUMNS.filter(c => c.group === 'Complemento de Pago (Detalle)').map(c => c.key),
      []
    );

    const isPaymentRowExpandable = useMemo(() => {
        // A payment row is expandable only if a column from its detail group is visible,
        // excluding 'fechaPago' which can be shown on the main row without implying expansion.
        return paymentDetailColumnKeys.some(key => key !== 'fechaPago' && visibleColumns.has(key));
    }, [visibleColumns, paymentDetailColumnKeys]);


    const handleToggleAll = (uuids: string[]) => {
        const currentExpanded = new Set(expandedRows);
        const allAreExpanded = uuids.every(uuid => currentExpanded.has(uuid));
        if (allAreExpanded) {
            uuids.forEach(uuid => currentExpanded.delete(uuid));
        } else {
            uuids.forEach(uuid => currentExpanded.add(uuid));
        }
        setExpandedRows(currentExpanded);
    };
    
    const totals = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            acc.subTotal += item.subTotal;
            acc.descuento += item.descuento;
            acc.iva += item.iva;
            acc.isrRetenido += item.isrRetenido;
            acc.ivaRetenido += item.ivaRetenido;
            acc.otrosImpuestos += item.otrosImpuestos;
            acc.total += item.total;
            return acc;
        }, { subTotal: 0, descuento: 0, iva: 0, isrRetenido: 0, ivaRetenido: 0, otrosImpuestos: 0, total: 0 });
    }, [filteredData]);

    const handleExport = () => exportToExcel(sortedData, columnDefinitions);

    const handleMetadataFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onMetadataUpdate(Array.from(event.target.files));
        }
        if (event.target) event.target.value = '';
    };

    const handle69BFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.[0]) on69BCheck(event.target.files[0]);
        if (event.target) event.target.value = '';
    };

    const firstTotalColIndex = useMemo(() => columnDefinitions.findIndex(c => c.isNumeric && c.group === 'Importes'), [columnDefinitions]);
    const lastTotalColIndex = useMemo(() => {
        let lastIndex = -1;
        columnDefinitions.forEach((c, i) => {
            if(c.isNumeric && c.group === 'Importes') lastIndex = i;
        });
        return lastIndex;
    }, [columnDefinitions]);

    const toggleRowExpansion = (uuid: string) => {
      setExpandedRows(prev => {
        const newSet = new Set(prev);
        if (newSet.has(uuid)) newSet.delete(uuid);
        else newSet.add(uuid);
        return newSet;
      });
    };
    
    const renderDetailRow = (cols: ColumnDefinition[], data: Record<string, any>, key: string) => (
        <tr key={key} className="bg-gray-50 border-b border-gray-200 text-xs">
            {cols.map(col => {
                const value = data[col.key];
                return (
                    <td key={`${col.key}-sub`} className={`px-4 py-2 ${col.isNumeric ? 'font-mono text-right' : ''} whitespace-nowrap overflow-hidden text-ellipsis`} title={String(value ?? '')}>
                        {col.isNumeric ? formatNumber(value) : String(value ?? '')}
                    </td>
                );
            })}
        </tr>
    );

    const selectedTipo = filters.tipoDeComprobante as Set<string>;
    let tipoButtonText = 'Todos';
    if (selectedTipo?.size === 1) {
        tipoButtonText = selectedTipo.values().next().value;
    } else if (selectedTipo?.size > 1) {
        tipoButtonText = `${selectedTipo.size} seleccionados`;
    }

    const selectedFormaPago = filters.formaPago as Set<string>;
    let formaPagoButtonText = 'Todos';
    if (selectedFormaPago?.size === 1) {
        formaPagoButtonText = selectedFormaPago.values().next().value;
    } else if (selectedFormaPago?.size > 1) {
        formaPagoButtonText = `${selectedFormaPago.size} seleccionados`;
    }

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center bg-indigo-700 text-white">
                <h2 className="text-2xl font-bold mb-4 sm:mb-0">Resultados ({filteredData.length} de {data.length} facturas)</h2>
                <div className="flex items-center space-x-2 flex-wrap gap-2">
                    <button type="button" onClick={() => setIsColumnSelectorOpen(true)} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400">Personalizar Columnas</button>
                    <ColumnSelector
                        isOpen={isColumnSelectorOpen}
                        onClose={() => setIsColumnSelectorOpen(false)}
                        allColumns={ALL_COLUMNS}
                        visibleColumns={visibleColumns}
                        onSave={handleVisibleColumnsChange}
                        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
                    />
                    <button type="button" onClick={() => metadataInputRef.current?.click()} disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:opacity-50">Actualizar Estatus</button>
                    <input type="file" className="hidden" accept=".txt" multiple onChange={handleMetadataFileChange} ref={metadataInputRef} disabled={isLoading} />
                    <button type="button" onClick={() => file69BInputRef.current?.click()} disabled={isLoading} className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 disabled:opacity-50">Verificar 69-B</button>
                    <input type="file" className="hidden" accept=".csv,.txt" onChange={handle69BFileChange} ref={file69BInputRef} disabled={isLoading} />
                    {paymentComplementUUIDs.length > 0 && isPaymentRowExpandable && <button onClick={() => handleToggleAll(paymentComplementUUIDs)} className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Expandir/Contraer Pagos</button>}
                    {nominaComplementUUIDs.length > 0 && <button onClick={() => handleToggleAll(nominaComplementUUIDs)} className="px-4 py-2 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Expandir/Contraer Nóminas</button>}
                    <button onClick={handleExport} className="px-4 py-2 bg-white text-indigo-700 font-semibold rounded-lg shadow-md hover:bg-indigo-100">Exportar a Excel</button>
                    {areFiltersActive && <button onClick={handleClearFilters} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600">Limpiar Filtros</button>}
                    <button onClick={onClear} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600">Limpiar Tabla</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-700" style={{ tableLayout: 'fixed' }}>
                    <thead className="text-xs text-white uppercase bg-indigo-600">
                        <tr>
                            {columnDefinitions.map(col => <ResizableHeader key={col.key} label={col.label} width={columnWidths[col.key]} onMouseDown={e => onMouseDown(col.key, e)} onClick={() => handleSort(col.key)} sortOrder={sortConfig?.key === col.key ? sortConfig.order : undefined} />)}
                        </tr>
                        <tr className="bg-indigo-500">
                            {columnDefinitions.map(col => (
                                <th key={col.key} className="p-1 font-normal">
                                    {col.key === 'tipoDeComprobante' || col.key === 'formaPago' ? (
                                        <div className="relative" ref={openDropdownKey === col.key ? dropdownRef : null}>
                                            <button
                                                type="button"
                                                onClick={() => setOpenDropdownKey(prev => prev === col.key ? null : col.key)}
                                                className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-md bg-indigo-50 text-gray-800 text-left flex justify-between items-center"
                                            >
                                                <span>{col.key === 'tipoDeComprobante' ? tipoButtonText : formaPagoButtonText}</span>
                                                <span className="ml-1">▼</span>
                                            </button>
                                            {openDropdownKey === col.key && (
                                                <div className="absolute z-20 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                                                    {selectOptions[col.key]?.map(option => (
                                                        <label key={option} className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                                checked={(filters[col.key] as Set<string>)?.has(option) ?? false}
                                                                onChange={() => handleMultiSelectChange(col.key, option)}
                                                            />
                                                            <span className="ml-2">{option}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : col.filter === 'select' ? (
                                        <select aria-label={`Filtrar por ${col.label}`} value={(filters[col.key] as string) || ''} onChange={e => handleFilterChange(col.key, e.target.value)} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-md bg-indigo-50 text-gray-800">
                                            <option value="">Todos</option>
                                            {selectOptions[col.key]?.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    ) : col.filter === 'text' ? (
                                        <input type="text" aria-label={`Filtrar por ${col.label}`} placeholder="Filtrar..." value={(filters[col.key] as string) || ''} onChange={e => handleFilterChange(col.key, e.target.value)} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-md bg-indigo-50 text-gray-800" />
                                    ) : col.filter === 'numeric' ? (
                                        <select aria-label={`Filtrar por ${col.label}`} value={(filters[col.key] as string) || ''} onChange={e => handleFilterChange(col.key, e.target.value)} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-md bg-indigo-50 text-gray-800">
                                            <option value="">Todos</option>
                                            <option value=">0">Con valor</option>
                                            <option value="=0">Sin valor (cero)</option>
                                        </select>
                                    ) : null}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((item, index) => {
                            const isExpandable = (item.tipoDeComprobante === 'P' && isPaymentRowExpandable) || item.tipoDeComprobante === 'N';
                            const isExpanded = isExpandable && expandedRows.has(item.uuid);
                            const rowClass = item.tipoDeComprobante === 'P' ? 'bg-blue-50 font-semibold' : item.tipoDeComprobante === 'N' ? 'bg-teal-50 font-semibold' : 'bg-white';
                            
                            return (
                                <React.Fragment key={item.uuid + index}>
                                    <tr id={`row-${item.uuid}`} className={`border-b hover:bg-indigo-50 ${rowClass}`}>
                                        {columnDefinitions.map(col => {
                                            const rawValue = getNestedValue(item, col.key);
                                            let cellContent: React.ReactNode = rawValue;

                                            if (col.key === 'is69B') {
                                                cellContent = rawValue === true
                                                    ? <span className="font-bold text-red-600">Sí</span>
                                                    : rawValue === false
                                                    ? <span className="text-green-700">No</span>
                                                    : '';
                                            } else if (col.key === 'uuid' && isExpandable) {
                                                cellContent = (
                                                    <div className="flex items-center">
                                                        <button onClick={() => toggleRowExpansion(item.uuid)} className="mr-2 text-indigo-600 hover:text-indigo-800 font-mono text-lg transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>{'>'}</button>
                                                        {item.uuid}
                                                    </div>
                                                );
                                            } else if (col.key === 'uuidRelacionado') {
                                                const relatedUuid = rawValue as string;
                                                if (relatedUuid && allUuids.has(relatedUuid)) {
                                                    cellContent = (
                                                        <button
                                                            onClick={() => handleScrollToUuid(relatedUuid)}
                                                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-medium"
                                                            title={`Ir a la factura ${relatedUuid}`}
                                                        >
                                                            {relatedUuid}
                                                        </button>
                                                    );
                                                }
                                            } else if (col.isNumeric) {
                                                cellContent = formatNumber(rawValue as number);
                                            }
                                            
                                            return <td key={col.key} className={`px-4 py-3 ${col.isNumeric ? 'font-mono text-right' : ''} whitespace-nowrap overflow-hidden text-ellipsis`} title={String(rawValue ?? '')}>{cellContent ?? ''}</td>;
                                        })}
                                    </tr>
                                    {isExpanded && item.tipoDeComprobante === 'P' && item.pagos?.map((p, pIdx) => renderDetailRow(columnDefinitions, { uuidRelacionado: p.idDocumento, serie: p.serie, folio: p.folio, subTotal: p.baseDR, iva: p.importeDR, numParcialidad: p.numParcialidad, impSaldoAnt: p.impSaldoAnt, impPagado: p.impPagado, impSaldoInsoluto: p.impSaldoInsoluto, monedaDR: p.monedaDR, equivalenciaDR: p.equivalenciaDR, objetoImpDR: p.objetoImpDR, impuestoDR: p.impuestoDR, tipoFactorDR: p.tipoFactorDR, tasaOCuotaDR: p.tasaOCuotaDR }, `${item.uuid}-pago-${pIdx}`))}
                                    {isExpanded && item.tipoDeComprobante === 'N' && item.nomina && (
                                        <>
                                            {item.nomina.percepciones.length > 0 && <tr className="bg-gray-100 font-bold text-gray-600 text-xs"><td colSpan={columnDefinitions.length} className="px-4 py-1">--- PERCEPCIONES ---</td></tr>}
                                            {item.nomina.percepciones.map((p, pIdx) => renderDetailRow(columnDefinitions, { 'detalle.tipo': 'Percepción', 'detalle.clave': p.clave, 'detalle.concepto': p.concepto, 'detalle.importeGravado': p.importeGravado, 'detalle.importeExento': p.importeExento, 'detalle.dias': p.dias, 'detalle.tipoHoras': p.tipoHoras, 'detalle.horasExtra': p.horasExtra, 'detalle.importePagado': p.importePagado }, `${item.uuid}-perp-${pIdx}`))}
                                            {item.nomina.deducciones.length > 0 && <tr className="bg-gray-100 font-bold text-gray-600 text-xs"><td colSpan={columnDefinitions.length} className="px-4 py-1">--- DEDUCCIONES ---</td></tr>}
                                            {item.nomina.deducciones.map((d, dIdx) => renderDetailRow(columnDefinitions, { 'detalle.tipo': 'Deducción', 'detalle.clave': d.clave, 'detalle.concepto': d.concepto, 'detalle.importe': d.importe }, `${item.uuid}-dedc-${dIdx}`))}
                                            {item.nomina.otrosPagos.length > 0 && <tr className="bg-gray-100 font-bold text-gray-600 text-xs"><td colSpan={columnDefinitions.length} className="px-4 py-1">--- OTROS PAGOS ---</td></tr>}
                                            {item.nomina.otrosPagos.map((o, oIdx) => renderDetailRow(columnDefinitions, { 'detalle.tipo': 'Otro Pago', 'detalle.clave': o.clave, 'detalle.concepto': o.concepto, 'detalle.importe': o.importe, 'detalle.subsidioCausado': o.subsidioCausado }, `${item.uuid}-otro-${oIdx}`))}
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                     <tfoot>
                        <tr className="bg-indigo-200 text-indigo-900">
                             {firstTotalColIndex >= 0 ? (
                                <>
                                    <FooterCell colSpan={firstTotalColIndex}>TOTALES</FooterCell>
                                    {columnDefinitions.slice(firstTotalColIndex, lastTotalColIndex + 1).map(col => <FooterCell key={col.key} isNumeric>{formatNumber(totals[col.key as keyof typeof totals])}</FooterCell>)}
                                    {columnDefinitions.length - lastTotalColIndex - 1 > 0 && <FooterCell colSpan={columnDefinitions.length - lastTotalColIndex - 1}></FooterCell>}
                                </>
                            ) : (
                                 <FooterCell colSpan={columnDefinitions.length}>TOTALES</FooterCell>
                            )}
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div className="p-4 bg-indigo-50 border-t border-indigo-200 text-right text-indigo-800 font-semibold">
                Resultados ({filteredData.length} de {data.length} facturas)
            </div>
        </div>
    );
});