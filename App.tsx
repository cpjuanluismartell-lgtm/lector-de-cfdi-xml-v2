import React, { useState, useCallback, useRef } from 'react';
import type { CFDI } from './types';
import { FileUpload } from './components/FileUpload';
import { ResultsTable, type ResultsTableRef } from './components/ResultsTable';
import { ScrollButtons } from './components/ScrollButtons';
import { parseCFDIXML } from './utils/xmlParser';

const App: React.FC = () => {
    const [cfdiData, setCfdiData] = useState<CFDI[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [hasMetadata, setHasMetadata] = useState<boolean>(false);
    const [has69BData, setHas69BData] = useState<boolean>(false);
    const tableRef = useRef<ResultsTableRef>(null);


    const handleFileProcess = useCallback(async (xmlFiles: File[], noXmlFound: boolean = false) => {
        setIsLoading(true);
        setError(null);
        setInfoMessage(null);
        setHasMetadata(false);
        setHas69BData(false);

        if (noXmlFound) {
            setError('No se encontraron archivos XML en la selección o carpeta.');
            setCfdiData([]);
            setIsLoading(false);
            return;
        }
        
        if (xmlFiles.length === 0) {
            setIsLoading(false);
            return;
        };

        const promises = xmlFiles.map(file => {
            return new Promise<CFDI | null>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const xmlString = e.target?.result as string;
                        if (!xmlString) {
                            console.error(`File is empty or could not be read: ${file.name}`);
                            resolve(null);
                            return;
                        }
                        const parsedData = parseCFDIXML(xmlString);
                        resolve(parsedData);
                    } catch (err)
 {
                        console.error(`Error parsing file ${file.name}:`, err);
                        resolve(null);
                    }
                };
                reader.onerror = () => {
                    console.error(`Error reading file: ${file.name}`);
                    resolve(null);
                }
                reader.readAsText(file, 'UTF-8');
            });
        });

        try {
            const results = await Promise.all(promises);
            const validData = results.filter((data): data is CFDI => data !== null);
            if (validData.length === 0 && xmlFiles.length > 0) {
                 setError('No se pudieron procesar los archivos XML. Verifique que el formato sea correcto (CFDI 3.3 o 4.0).');
                 setCfdiData([]);
            } else if (validData.length < xmlFiles.length) {
                setError('Algunos archivos XML no pudieron ser procesados. Verifique el formato.');
            }
            setCfdiData(validData);
        } catch (err) {
            setError('Ocurrió un error inesperado al procesar los archivos.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleMetadataUpdate = useCallback(async (metadataFiles: File[]) => {
        if (!metadataFiles || metadataFiles.length === 0 || cfdiData.length === 0) return;

        setIsLoading(true);
        setError(null);
        setInfoMessage(null);

        const statusMap = new Map<string, string>();
        try {
            for (const metadataFile of metadataFiles) {
                const text = await metadataFile.text();
                const lines = text.split(/\r?\n/).slice(1);
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    const columns = line.split('~');
                    if (columns.length > 10) { 
                        const uuid = columns[0].toUpperCase().trim();
                        const status = columns[10].trim();
                        if (uuid && status) {
                             statusMap.set(uuid, status === '1' ? 'Vigente' : 'Cancelado');
                        }
                    }
                }
            }

            if (statusMap.size === 0) {
                throw new Error("Los archivos de metadatos no contienen información de estatus válida.");
            }

        } catch (e: any) {
            console.error("Error reading metadata file(s)", e);
            setError(e.message || "Error al leer los archivos de metadatos.");
            setIsLoading(false);
            return;
        }

        setCfdiData(prevData => {
            return prevData.map(cfdi => {
                const newStatus = statusMap.get(cfdi.uuid.toUpperCase());
                return {
                    ...cfdi,
                    estatus: newStatus || cfdi.estatus || 'No en metadata'
                };
            });
        });

        setHasMetadata(true);
        setIsLoading(false);

    }, [cfdiData]);

    const handle69BCheck = useCallback(async (file69b: File) => {
        if (!file69b || cfdiData.length === 0) return;

        setIsLoading(true);
        setError(null);
        setInfoMessage(null);
        
        const rfcSet = new Set<string>();
        try {
            const text = await file69b.text();
            const lines = text.split(/\r?\n/);
            // Skip header (usually 1 line) and process the rest
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '') continue;
                // The RFC is typically the second column in the official CSV
                const columns = line.split(',');
                if (columns.length > 1) {
                    const rfc = columns[1]?.replace(/"/g, '').trim();
                    if (rfc && rfc.length >= 12) {
                        rfcSet.add(rfc);
                    }
                }
            }
             if (rfcSet.size === 0) {
                throw new Error("El archivo 69-B no contiene RFCs en el formato esperado.");
            }
        } catch (e: any) {
            console.error("Error reading 69-B file", e);
            setError(e.message || "Error al leer el archivo 69-B.");
            setIsLoading(false);
            return;
        }

        let matchesFound = 0;
        const updatedData = cfdiData.map(cfdi => {
            const isMatch = rfcSet.has(cfdi.rfcEmisor);
            if(isMatch) matchesFound++;
            return { ...cfdi, is69B: isMatch };
        });

        setCfdiData(updatedData);
        setHas69BData(true);

        if(matchesFound > 0){
            setInfoMessage(`Se encontraron ${matchesFound} factura(s) de emisores en la lista 69-B. La tabla ha sido filtrada.`);
            tableRef.current?.apply69BFilter();
        } else {
            setInfoMessage('Validación completa. Ninguno de los RFCs emisores se encuentra en la lista 69-B.');
        }

        setIsLoading(false);

    }, [cfdiData]);

    const handleClearData = useCallback(() => {
        setCfdiData([]);
        setError(null);
        setInfoMessage(null);
        setHasMetadata(false);
        setHas69BData(false);
    }, []);

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
            <header className="text-center mb-8">
                <h1 className="text-4xl font-bold text-indigo-800">Lector de Facturas XML (CFDI)</h1>
                <p className="text-lg text-indigo-600 mt-2">Importa, visualiza y exporta los datos de tus comprobantes fiscales.</p>
            </header>

            <main>
                <FileUpload onProcess={handleFileProcess} isLoading={isLoading} />
                
                {error && (
                    <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                         <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Cerrar">
                            <span className="text-2xl">&times;</span>
                        </button>
                    </div>
                )}
                {infoMessage && (
                     <div className="mt-6 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg relative" role="alert">
                        <strong className="font-bold">Info: </strong>
                        <span className="block sm:inline">{infoMessage}</span>
                        <button onClick={() => setInfoMessage(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Cerrar">
                            <span className="text-2xl">&times;</span>
                        </button>
                    </div>
                )}
                
                {cfdiData.length > 0 && (
                    <div className="mt-8">
                        <ResultsTable 
                            ref={tableRef}
                            data={cfdiData} 
                            onClear={handleClearData} 
                            hasMetadata={hasMetadata} 
                            onMetadataUpdate={handleMetadataUpdate}
                            has69BData={has69BData}
                            on69BCheck={handle69BCheck}
                            isLoading={isLoading}
                        />
                    </div>
                )}
            </main>
            <ScrollButtons />
        </div>
    );
};

export default App;