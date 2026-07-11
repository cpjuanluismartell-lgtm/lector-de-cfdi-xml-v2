import React, { useRef } from 'react';

interface FileUploadProps {
    onProcess: (xmlFiles: File[], noXmlFound?: boolean) => void;
    isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onProcess, isLoading }) => {
    const xmlInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const allFiles = event.target.files ? Array.from(event.target.files) : [];
        if (event.target) {
            event.target.value = ''; // Reset input to allow re-selection of the same file/folder
        }

        if (allFiles.length > 0) {
            // FIX: Add explicit type `File` to the `file` parameter to fix type inference issue.
            const xmlFiles = allFiles.filter((file: File) => file.name.toLowerCase().endsWith('.xml'));
            onProcess(xmlFiles, xmlFiles.length === 0);
        }
    };
    
    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const allFiles = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];

        if (allFiles.length > 0) {
            const xmlFiles = allFiles.filter((file: File) => file.name.toLowerCase().endsWith('.xml'));
            onProcess(xmlFiles, xmlFiles.length === 0);
        }
    }

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }

    return (
        <div 
            className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-2 border-dashed border-indigo-200 transition-all duration-300 ease-in-out text-center"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div className="flex flex-col items-center gap-3">
                 <h3 className="text-lg font-semibold text-indigo-800">1. Cargar Facturas (XML)</h3>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-2xl">
                    <button
                        type="button"
                        onClick={() => xmlInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition duration-150 ease-in-out disabled:opacity-50"
                    >
                        Seleccionar Archivos
                    </button>
                    <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex-1 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition duration-150 ease-in-out disabled:opacity-50"
                    >
                        Seleccionar Carpeta
                    </button>
                 </div>
                <p className="text-sm text-indigo-500">o arrastra los archivos / carpetas aquí</p>
                 <input 
                    type="file" 
                    className="hidden" 
                    accept=".xml,text/xml" 
                    multiple 
                    onChange={handleFileSelection}
                    ref={xmlInputRef}
                    disabled={isLoading}
                />
                 <input 
                    type="file" 
                    className="hidden" 
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFileSelection}
                    ref={folderInputRef}
                    disabled={isLoading}
                />
            </div>
             
             {isLoading && (
                <div className="mt-4 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-indigo-600 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Cargando...</span>
                    </div>
                     <p className="text-indigo-600 mt-2">Procesando facturas...</p>
                </div>
            )}
        </div>
    );
};