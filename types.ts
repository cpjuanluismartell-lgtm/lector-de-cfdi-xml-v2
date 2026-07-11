export interface DoctoRelacionado {
  idDocumento: string;
  serie: string;
  folio: string;
  monedaDR: string;
  equivalenciaDR: number;
  numParcialidad: number;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  objetoImpDR: string;
  baseDR: number;
  impuestoDR: string;
  tipoFactorDR: string;
  tasaOCuotaDR: number;
  importeDR: number;
}

export interface Percepcion {
  tipoPercepcion: string;
  clave: string;
  concepto: string;
  importeGravado: number;
  importeExento: number;
  // Para Horas Extra
  dias?: number;
  tipoHoras?: string;
  horasExtra?: number;
  importePagado?: number;
}

export interface Deduccion {
  tipoDeduccion: string;
  clave: string;
  concepto: string;
  importe: number;
}

export interface OtroPago {
  tipoOtroPago: string;
  clave: string;
  concepto: string;
  importe: number;
  subsidioCausado?: number;
}

export interface Nomina {
  version: string;
  tipoNomina: string;
  fechaPago: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  numDiasPagados: number;
  totalPercepciones?: number;
  totalDeducciones?: number;
  totalOtrosPagos?: number;
  // Emisor
  registroPatronal?: string;
  // Receptor
  curp: string;
  numSeguridadSocial?: string;
  fechaInicioRelLaboral?: string;
  antiguedad?: string;
  tipoContrato: string;
  sindicalizado?: string;
  tipoJornada?: string;
  tipoRegimen: string;
  numEmpleado: string;
  puesto?: string;
  riesgoPuesto?: string;
  periodicidadPago: string;
  salarioBaseCotApor?: number;
  salarioDiarioIntegrado?: number;
  claveEntFed: string;
  // Arrays de detalle
  percepciones: Percepcion[];
  deducciones: Deduccion[];
  otrosPagos: OtroPago[];
}


export interface CFDI {
  uuid: string;
  tipoDeComprobante: string;
  fecha: string;
  fechaTimbrado: string;
  rfcProvCertif?: string;
  serie: string;
  folio: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  descripcion: string;
  subTotal: number;
  descuento: number;
  iva: number;
  isrRetenido: number;
  ivaRetenido: number;
  otrosImpuestos: number;
  total: number;
  metodoPago: string;
  formaPago: string;
  uuidRelacionado: string;
  version: string;
  moneda: string;
  tipoCambio: number;
  usoCFDI: string;
  estatus?: string;
  lugarExpedicion: string;
  noCertificado: string;
  certificado: string;
  sello: string;
  regimenFiscalEmisor: string;
  regimenFiscalReceptor: string;
  domicilioFiscalReceptor: string;
  exportacion: string;

  // For payment complements
  fechaPago?: string;
  pagos?: DoctoRelacionado[];

  // For payroll complements
  nomina?: Nomina;
  
  // For 69-B validation
  is69B?: boolean;
}