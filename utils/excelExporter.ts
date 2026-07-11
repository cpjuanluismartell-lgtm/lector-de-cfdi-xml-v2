import type { CFDI, DoctoRelacionado, Percepcion, Deduccion, OtroPago } from '../types';
import type { ColumnDefinition } from '../components/ColumnSelector';

declare const XLSX: any;

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const mapPagoData = (item: CFDI, pago: DoctoRelacionado) => {
    return {
        ...item,
        uuidRelacionado: pago.idDocumento,
        serie: pago.serie,
        folio: pago.folio,
        subTotal: item.subTotal,
        iva: item.iva,
        total: item.total,
        // Related document specific fields
        baseDR: pago.baseDR,
        importeDR: pago.importeDR,
        numParcialidad: pago.numParcialidad,
        impSaldoAnt: pago.impSaldoAnt,
        impPagado: pago.impPagado,
        impSaldoInsoluto: pago.impSaldoInsoluto,
        monedaDR: pago.monedaDR,
        equivalenciaDR: pago.equivalenciaDR,
        objetoImpDR: pago.objetoImpDR,
        impuestoDR: pago.impuestoDR,
        tipoFactorDR: pago.tipoFactorDR,
        tasaOCuotaDR: pago.tasaOCuotaDR,
    };
}

const mapNominaDetail = (item: CFDI, detail: Percepcion | Deduccion | OtroPago, type: string) => {
    const base = { ...item };
    const mapped: Record<string, any> = {
        'detalle.tipo': type
    };

    if ('tipoPercepcion' in detail) { // Percepcion
        mapped['detalle.clave'] = detail.clave;
        mapped['detalle.concepto'] = detail.concepto;
        mapped['detalle.importeGravado'] = detail.importeGravado;
        mapped['detalle.importeExento'] = detail.importeExento;
        mapped['detalle.dias'] = detail.dias;
        mapped['detalle.tipoHoras'] = detail.tipoHoras;
        mapped['detalle.horasExtra'] = detail.horasExtra;
        mapped['detalle.importePagado'] = detail.importePagado;
    } else if ('tipoDeduccion' in detail) { // Deduccion
        mapped['detalle.clave'] = detail.clave;
        mapped['detalle.concepto'] = detail.concepto;
        mapped['detalle.importe'] = detail.importe;
    } else { // OtroPago
        mapped['detalle.clave'] = detail.clave;
        mapped['detalle.concepto'] = detail.concepto;
        mapped['detalle.importe'] = detail.importe;
    }

    return { ...base, ...mapped };
};


export const exportToExcel = (data: CFDI[], visibleColumns: ColumnDefinition[]): void => {
    if (typeof XLSX === 'undefined') {
        alert('La librería para exportar a Excel no está disponible.');
        return;
    }

    const headers = visibleColumns.map(col => col.label);
    const sheetData: (string | number | undefined)[][] = [headers];
    const columnKeys = visibleColumns.map(col => col.key);

    data.forEach(item => {
        // Main row for all types
        const mainRow = columnKeys.map(key => getNestedValue(item, key));
        sheetData.push(mainRow);
        
        // Detail rows for payments
        if (item.tipoDeComprobante === 'P' && item.pagos && item.pagos.length > 0) {
            item.pagos.forEach(pago => {
                const combinedData = mapPagoData(item, pago);
                const row = columnKeys.map(key => {
                     if (key === 'subTotal') return combinedData['baseDR'];
                     if (key === 'iva') return combinedData['importeDR'];
                     return getNestedValue(combinedData, key);
                });
                sheetData.push(row);
            });
             // Remove the main summary row for payments as details are added
            sheetData.pop();
        } 
        // Detail rows for payroll
        else if (item.tipoDeComprobante === 'N' && item.nomina) {
             if (item.nomina.percepciones.length > 0) {
                 sheetData.push(columnKeys.map(k => k === 'detalle.tipo' ? '--- PERCEPCIONES ---' : ''));
                 item.nomina.percepciones.forEach(p => {
                    const detailData = mapNominaDetail(item, p, 'Percepción');
                    sheetData.push(columnKeys.map(key => getNestedValue(detailData, key)));
                 });
             }
             if (item.nomina.deducciones.length > 0) {
                sheetData.push(columnKeys.map(k => k === 'detalle.tipo' ? '--- DEDUCCIONES ---' : ''));
                 item.nomina.deducciones.forEach(d => {
                    const detailData = mapNominaDetail(item, d, 'Deducción');
                    sheetData.push(columnKeys.map(key => getNestedValue(detailData, key)));
                 });
             }
             if (item.nomina.otrosPagos.length > 0) {
                sheetData.push(columnKeys.map(k => k === 'detalle.tipo' ? '--- OTROS PAGOS ---' : ''));
                 item.nomina.otrosPagos.forEach(o => {
                    const detailData = mapNominaDetail(item, o, 'Otro Pago');
                    sheetData.push(columnKeys.map(key => getNestedValue(detailData, key)));
                 });
             }
        }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    const currencyCols = visibleColumns.map((col, i) => col.isNumeric ? i : -1).filter(i => i !== -1);
    if (currencyCols.length > 0) {
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            for (const C of currencyCols) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (worksheet[cell_ref] && typeof worksheet[cell_ref].v === 'number') {
                    worksheet[cell_ref].t = 'n';
                    worksheet[cell_ref].z = '$#,##0.00';
                }
            }
        }
    }
    
    const colWidths = headers.map((_, i) => ({
      wch: sheetData.reduce((w, r) => Math.max(w, String(r[i] ?? '').length), 10)
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CFDI Data");
    XLSX.writeFile(workbook, "CFDI_Export.xlsx");
};