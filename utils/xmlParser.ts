import type { CFDI, DoctoRelacionado, Nomina, Percepcion, Deduccion, OtroPago } from '../types';

export const parseCFDIXML = (xmlString: string): CFDI | null => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");

        const errorNode = xmlDoc.querySelector('parsererror');
        if (errorNode) {
            console.error("Error parsing XML:", errorNode.textContent);
            return null;
        }

        const getAttr = (element: Element | null, attribute: string, defaultValue: string = ''): string => {
            return element?.getAttribute(attribute) || defaultValue;
        };

        const getFloatAttr = (element: Element | null, attribute: string): number => {
            const value = getAttr(element, attribute, '0');
            return value ? parseFloat(value) : 0;
        };
        
        const getIntAttr = (element: Element | null, attribute: string): number => {
            const value = getAttr(element, attribute, '0');
            return value ? parseInt(value, 10) : 0;
        };


        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0];
        if (!comprobante) return null;

        const tipoDeComprobante = getAttr(comprobante, 'TipoDeComprobante');
        const emisor = comprobante.getElementsByTagName('cfdi:Emisor')[0];
        const receptor = comprobante.getElementsByTagName('cfdi:Receptor')[0];
        const conceptosNodeList = comprobante.getElementsByTagName('cfdi:Concepto');
        const complemento = comprobante.getElementsByTagName('cfdi:Complemento')[0];
        const timbre = complemento?.getElementsByTagName('tfd:TimbreFiscalDigital')[0];

        const baseCFDI: Partial<CFDI> = {
            uuid: getAttr(timbre, 'UUID'),
            tipoDeComprobante: getAttr(comprobante, 'TipoDeComprobante'),
            fecha: getAttr(comprobante, 'Fecha').split('T')[0],
            fechaTimbrado: getAttr(timbre, 'FechaTimbrado').split('T')[0],
            rfcProvCertif: getAttr(timbre, 'RfcProvCertif'),
            serie: getAttr(comprobante, 'Serie'),
            folio: getAttr(comprobante, 'Folio'),
            rfcEmisor: getAttr(emisor, 'Rfc'),
            nombreEmisor: getAttr(emisor, 'Nombre'),
            rfcReceptor: getAttr(receptor, 'Rfc'),
            nombreReceptor: getAttr(receptor, 'Nombre'),
            subTotal: getFloatAttr(comprobante, 'SubTotal'),
            descuento: getFloatAttr(comprobante, 'Descuento'),
            total: getFloatAttr(comprobante, 'Total'),
            version: getAttr(comprobante, 'Version'),
            moneda: getAttr(comprobante, 'Moneda'),
            tipoCambio: getFloatAttr(comprobante, 'TipoCambio'),
            usoCFDI: getAttr(receptor, 'UsoCFDI'),
            lugarExpedicion: getAttr(comprobante, 'LugarExpedicion'),
            noCertificado: getAttr(comprobante, 'NoCertificado'),
            certificado: getAttr(comprobante, 'Certificado', '...'),
            sello: getAttr(comprobante, 'Sello', '...'),
            regimenFiscalEmisor: getAttr(emisor, 'RegimenFiscal'),
            regimenFiscalReceptor: getAttr(receptor, 'RegimenFiscalReceptor'),
            domicilioFiscalReceptor: getAttr(receptor, 'DomicilioFiscalReceptor'),
            exportacion: getAttr(comprobante, 'Exportacion'),
            metodoPago: getAttr(comprobante, 'MetodoPago'),
            formaPago: getAttr(comprobante, 'FormaPago'),
        };

        if (tipoDeComprobante === 'P') {
            const pagosNode = complemento?.getElementsByTagName('pago20:Pagos')[0];
            const totalesNode = pagosNode?.getElementsByTagName('pago20:Totales')[0];
            const pagoNode = pagosNode?.getElementsByTagName('pago20:Pago')[0];

            if (!pagosNode || !pagoNode || !totalesNode || !timbre) return null;

            const doctosRelacionados = pagoNode.getElementsByTagName('pago20:DoctoRelacionado');
            
            const parsedPagos: DoctoRelacionado[] = Array.from(doctosRelacionados).map(doc => {
                const impuestosDRNode = doc.getElementsByTagName('pago20:ImpuestosDR')[0];
                const trasladosDRNode = impuestosDRNode?.getElementsByTagName('pago20:TrasladosDR')[0];
                const trasladoDR = trasladosDRNode?.getElementsByTagName('pago20:TrasladoDR')[0];

                return {
                    idDocumento: getAttr(doc, 'IdDocumento'),
                    serie: getAttr(doc, 'Serie'),
                    folio: getAttr(doc, 'Folio'),
                    monedaDR: getAttr(doc, 'MonedaDR'),
                    equivalenciaDR: getFloatAttr(doc, 'EquivalenciaDR'),
                    numParcialidad: parseInt(getAttr(doc, 'NumParcialidad', '0'), 10),
                    impSaldoAnt: getFloatAttr(doc, 'ImpSaldoAnt'),
                    impPagado: getFloatAttr(doc, 'ImpPagado'),
                    impSaldoInsoluto: getFloatAttr(doc, 'ImpSaldoInsoluto'),
                    objetoImpDR: getAttr(doc, 'ObjetoImpDR'),
                    baseDR: getFloatAttr(trasladoDR, 'BaseDR'),
                    impuestoDR: getAttr(trasladoDR, 'ImpuestoDR'),
                    tipoFactorDR: getAttr(trasladoDR, 'TipoFactorDR'),
                    tasaOCuotaDR: getFloatAttr(trasladoDR, 'TasaOCuotaDR'),
                    importeDR: getFloatAttr(trasladoDR, 'ImporteDR'),
                };
            });
            
            const monedaP = getAttr(pagoNode, 'MonedaP');
            const tipoCambioP = getFloatAttr(pagoNode, 'TipoCambioP');

            const pagoCFDI: CFDI = {
                ...baseCFDI,
                descripcion: 'Complemento de Pago',
                subTotal: getFloatAttr(totalesNode, 'TotalTrasladosBaseIVA16'),
                iva: getFloatAttr(totalesNode, 'TotalTrasladosImpuestoIVA16'),
                total: getFloatAttr(totalesNode, 'MontoTotalPagos'),
                moneda: monedaP,
                tipoCambio: tipoCambioP,
                formaPago: getAttr(pagoNode, 'FormaDePagoP'),
                fechaPago: getAttr(pagoNode, 'FechaPago').split('T')[0],
                isrRetenido: 0,
                ivaRetenido: 0,
                otrosImpuestos: 0,
                descuento: 0,
                metodoPago: '',
                uuidRelacionado: '',
                pagos: parsedPagos,
            } as CFDI;
            
            return pagoCFDI;
        }
        
        if (tipoDeComprobante === 'N') {
            const nominaNode = complemento?.getElementsByTagName('nomina12:Nomina')[0];
            if (!nominaNode) return null;

            const nominaEmisor = nominaNode.getElementsByTagName('nomina12:Emisor')[0];
            const nominaReceptor = nominaNode.getElementsByTagName('nomina12:Receptor')[0];
            const percepcionesNode = nominaNode.getElementsByTagName('nomina12:Percepciones')[0];
            const deduccionesNode = nominaNode.getElementsByTagName('nomina12:Deducciones')[0];
            const otrosPagosNode = nominaNode.getElementsByTagName('nomina12:OtrosPagos')[0];
            
            const percepciones: Percepcion[] = Array.from(percepcionesNode?.getElementsByTagName('nomina12:Percepcion') || []).map(p => {
                const horasExtraNode = p.getElementsByTagName('nomina12:HorasExtra')[0];
                return {
                    tipoPercepcion: getAttr(p, 'TipoPercepcion'),
                    clave: getAttr(p, 'Clave'),
                    concepto: getAttr(p, 'Concepto'),
                    importeGravado: getFloatAttr(p, 'ImporteGravado'),
                    importeExento: getFloatAttr(p, 'ImporteExento'),
                    dias: horasExtraNode ? getIntAttr(horasExtraNode, 'Dias') : undefined,
                    tipoHoras: horasExtraNode ? getAttr(horasExtraNode, 'TipoHoras') : undefined,
                    horasExtra: horasExtraNode ? getIntAttr(horasExtraNode, 'HorasExtra') : undefined,
                    importePagado: horasExtraNode ? getFloatAttr(horasExtraNode, 'ImportePagado') : undefined,
                };
            });

            const deducciones: Deduccion[] = Array.from(deduccionesNode?.getElementsByTagName('nomina12:Deduccion') || []).map(d => ({
                tipoDeduccion: getAttr(d, 'TipoDeduccion'),
                clave: getAttr(d, 'Clave'),
                concepto: getAttr(d, 'Concepto'),
                importe: getFloatAttr(d, 'Importe'),
            }));
            
            const otrosPagos: OtroPago[] = Array.from(otrosPagosNode?.getElementsByTagName('nomina12:OtroPago') || []).map(o => {
                 const subsidio = o.getElementsByTagName('nomina12:SubsidioAlEmpleo')[0];
                 return {
                    tipoOtroPago: getAttr(o, 'TipoOtroPago'),
                    clave: getAttr(o, 'Clave'),
                    concepto: getAttr(o, 'Concepto'),
                    importe: getFloatAttr(o, 'Importe'),
                    subsidioCausado: subsidio ? getFloatAttr(subsidio, 'SubsidioCausado') : undefined,
                 };
            });

            const nomina: Nomina = {
                version: getAttr(nominaNode, 'Version'),
                tipoNomina: getAttr(nominaNode, 'TipoNomina'),
                fechaPago: getAttr(nominaNode, 'FechaPago'),
                fechaInicialPago: getAttr(nominaNode, 'FechaInicialPago'),
                fechaFinalPago: getAttr(nominaNode, 'FechaFinalPago'),
                numDiasPagados: getFloatAttr(nominaNode, 'NumDiasPagados'),
                totalPercepciones: getFloatAttr(percepcionesNode, 'TotalSueldos'),
                totalDeducciones: getFloatAttr(deduccionesNode, 'TotalOtrasDeducciones') + getFloatAttr(deduccionesNode, 'TotalImpuestosRetenidos'),
                totalOtrosPagos: getFloatAttr(otrosPagosNode, 'TotalOtrosPagos'),
                registroPatronal: getAttr(nominaEmisor, 'RegistroPatronal'),
                curp: getAttr(nominaReceptor, 'Curp'),
                numSeguridadSocial: getAttr(nominaReceptor, 'NumSeguridadSocial'),
                fechaInicioRelLaboral: getAttr(nominaReceptor, 'FechaInicioRelLaboral'),
                antiguedad: getAttr(nominaReceptor, 'Antigüedad'),
                tipoContrato: getAttr(nominaReceptor, 'TipoContrato'),
                sindicalizado: getAttr(nominaReceptor, 'Sindicalizado'),
                tipoJornada: getAttr(nominaReceptor, 'TipoJornada'),
                tipoRegimen: getAttr(nominaReceptor, 'TipoRegimen'),
                numEmpleado: getAttr(nominaReceptor, 'NumEmpleado'),
                puesto: getAttr(nominaReceptor, 'Puesto'),
                riesgoPuesto: getAttr(nominaReceptor, 'RiesgoPuesto'),
                periodicidadPago: getAttr(nominaReceptor, 'PeriodicidadPago'),
                salarioBaseCotApor: getFloatAttr(nominaReceptor, 'SalarioBaseCotApor'),
                salarioDiarioIntegrado: getFloatAttr(nominaReceptor, 'SalarioDiarioIntegrado'),
                claveEntFed: getAttr(nominaReceptor, 'ClaveEntFed'),
                percepciones,
                deducciones,
                otrosPagos,
            };
            
            return {
                ...baseCFDI,
                descripcion: Array.from(conceptosNodeList).map(c => getAttr(c, 'Descripcion')).join('; '),
                iva: 0,
                isrRetenido: getFloatAttr(deduccionesNode, 'TotalImpuestosRetenidos'),
                ivaRetenido: 0,
                otrosImpuestos: 0,
                uuidRelacionado: '',
                nomina,
            } as CFDI;
        }


        // Default handling for Ingreso, Egreso, etc.
        let ivaTrasladado = 0;
        let otrosImpuestos = 0;
        let ivaRetenido = 0;
        let isrRetenido = 0;

        // Find the global Impuestos node directly under Comprobante
        const globalImpuestosNode = Array.from(comprobante.children).find(child => child.tagName === 'cfdi:Impuestos');

        // Prefer the global Impuestos node if it exists, as it should contain the final totals.
        if (globalImpuestosNode) {
            const traslados = globalImpuestosNode.getElementsByTagName('cfdi:Traslados')[0]?.getElementsByTagName('cfdi:Traslado');
            if (traslados) {
                for (const traslado of Array.from(traslados)) {
                    if (getAttr(traslado, 'Impuesto') === '002') {
                        ivaTrasladado += getFloatAttr(traslado, 'Importe');
                    } else {
                        otrosImpuestos += getFloatAttr(traslado, 'Importe');
                    }
                }
            }
            
            const retenciones = globalImpuestosNode.getElementsByTagName('cfdi:Retenciones')[0]?.getElementsByTagName('cfdi:Retencion');
            if (retenciones) {
                for (const retencion of Array.from(retenciones)) {
                    if (getAttr(retencion, 'Impuesto') === '002') ivaRetenido += getFloatAttr(retencion, 'Importe');
                    if (getAttr(retencion, 'Impuesto') === '001') isrRetenido += getFloatAttr(retencion, 'Importe');
                }
            }
        } 
        // If no global Impuestos node, sum from individual concepts. This is common if the global node is omitted.
        else {
            for (const concepto of Array.from(conceptosNodeList)) {
                const impuestosConcepto = concepto.getElementsByTagName('cfdi:Impuestos')[0];
                if (!impuestosConcepto) continue;
                
                const trasladosConcepto = impuestosConcepto.getElementsByTagName('cfdi:Traslados')[0]?.getElementsByTagName('cfdi:Traslado');
                if (trasladosConcepto) {
                    for (const traslado of Array.from(trasladosConcepto)) {
                        if (getAttr(traslado, 'Impuesto') === '002') {
                            ivaTrasladado += getFloatAttr(traslado, 'Importe');
                        } else {
                            otrosImpuestos += getFloatAttr(traslado, 'Importe');
                        }
                    }
                }
                
                const retencionesConcepto = impuestosConcepto.getElementsByTagName('cfdi:Retenciones')[0]?.getElementsByTagName('cfdi:Retencion');
                if (retencionesConcepto) {
                    for (const retencion of Array.from(retencionesConcepto)) {
                        if (getAttr(retencion, 'Impuesto') === '002') ivaRetenido += getFloatAttr(retencion, 'Importe');
                        if (getAttr(retencion, 'Impuesto') === '001') isrRetenido += getFloatAttr(retencion, 'Importe');
                    }
                }
            }
        }

        const cfdiRelacionados = comprobante.getElementsByTagName('cfdi:CfdiRelacionados')[0];
        const cfdiRelacionado = cfdiRelacionados?.getElementsByTagName('cfdi:CfdiRelacionado')[0];
        
        const finalCFDI: CFDI = {
            ...baseCFDI,
            descripcion: Array.from(conceptosNodeList).map(c => getAttr(c, 'Descripcion')).join('; '),
            iva: ivaTrasladado,
            isrRetenido: isrRetenido,
            ivaRetenido: ivaRetenido,
            otrosImpuestos: otrosImpuestos,
            uuidRelacionado: getAttr(cfdiRelacionado, 'UUID'),
        } as CFDI;
        
        return finalCFDI;

    } catch (error) {
        console.error("Failed to parse XML string:", error);
        return null;
    }
};