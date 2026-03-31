
import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { toPng } from 'html-to-image';
import { ChartData, Series } from './types';
import FileUpload from './components/FileUpload';
import DataChart from './components/DataChart';
import ExportChart from './components/ExportChart';
import ManualInputModal from './components/ManualInputModal';
import { UploadIcon, ChartIcon, ErrorIcon } from './components/Icons';

interface SpecRange {
  start: string;
  end: string;
  yValue: number;
  comparison: string;
}

const App: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[] | null>(null);
  const [originalChartData, setOriginalChartData] = useState<ChartData[] | null>(null);
  const [series, setSeries] = useState<Series[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');

  const [manualPoints, setManualPoints] = useState<{name: string}[]>([]);
  const [showYInputModal, setShowYInputModal] = useState<boolean>(false);
  const [specRanges, setSpecRanges] = useState<SpecRange[]>([]);

  const [yMin, setYMin] = useState<number>(1);
  const [yMax, setYMax] = useState<number>(11);
  const [xStartCell, setXStartCell] = useState<string>('A4');
  const [yStartCell, setYStartCell] = useState<string>('B4');
  const [inputUnit, setInputUnit] = useState<string>('MHz');
  const exportChartRef = useRef<HTMLDivElement>(null);

  // Helper to read file as ArrayBuffer
  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as ArrayBuffer);
        } else {
          reject(new Error("File is empty"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async (files: File[], xCell: string, yCell: string, unit: string) => {
      let parsedX: { start: XLSX.CellAddress, end: XLSX.CellAddress | null };
      let parsedY: { start: XLSX.CellAddress, end: XLSX.CellAddress | null };
      
      try {
          const parseInput = (input: string) => {
              const normalizedInput = input.toUpperCase().replace(/到/g, '~').replace(/-/g, '~');
              const parts = normalizedInput.split(/[~:]/);
              const start = XLSX.utils.decode_cell(parts[0].trim());
              if (start.c === undefined || start.r === undefined || start.c < 0 || start.r < 0) throw new Error();
              
              if (parts.length === 1) {
                  return { start, end: null };
              } else if (parts.length >= 2) {
                  const end = XLSX.utils.decode_cell(parts[1].trim());
                  if (end.c === undefined || end.r === undefined || end.c < 0 || end.r < 0) throw new Error();
                  return { start, end };
              }
              throw new Error();
          };
          parsedX = parseInput(xCell);
          parsedY = parseInput(yCell);
      } catch (e) {
          throw new Error("Invalid cell format. Please use formats like 'A4', 'B132', 'B4~CM4', or 'B4:CM4'.");
      }
      
      const allDataMap = new Map<string, any>(); 
      const seriesList: Series[] = [];

      const promises = files.map(async (file) => {
          try {
              const buffer = await readFileAsArrayBuffer(file);
              const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              if (!sheetName) return null;

              const worksheet = workbook.Sheets[sheetName];
              const rawName = file.name.replace(/\.[^/.]+$/, "");

              let dirY = 1; // 1 for down, 0 for right
              let numSeries = 1;
              let yStarts: XLSX.CellAddress[] = [parsedY.start];
              
              if (parsedY.end) {
                  if (parsedY.start.r === parsedY.end.r) {
                      // Horizontal range (B4~CM4) -> Read downwards
                      dirY = 1; 
                      numSeries = parsedY.end.c - parsedY.start.c + 1;
                      yStarts = [];
                      for (let c = parsedY.start.c; c <= parsedY.end.c; c++) {
                          yStarts.push({ r: parsedY.start.r, c: c });
                      }
                  } else if (parsedY.start.c === parsedY.end.c) {
                      // Vertical range (B4~B100) -> Read rightwards
                      dirY = 0; 
                      numSeries = parsedY.end.r - parsedY.start.r + 1;
                      yStarts = [];
                      for (let r = parsedY.start.r; r <= parsedY.end.r; r++) {
                          yStarts.push({ r: r, c: parsedY.start.c });
                      }
                  } else {
                      throw new Error("Y range must be either horizontal (e.g., B4~CM4) or vertical (e.g., B4~B100).");
                  }
              } else {
                  // Single Y cell. Infer direction from X if X is a range.
                  if (parsedX.end && parsedX.start.r === parsedX.end.r) {
                      dirY = 0; // right
                  } else {
                      dirY = 1; // down
                  }
              }
              
              const dirX = dirY; 
              const fileSeriesData: { seriesName: string, data: {x: string, y: number}[] }[] = [];
              
              for (let s = 0; s < numSeries; s++) {
                  const yStart = yStarts[s];
                  const fileData: {x: string, y: number}[] = [];
                  
                  let rX = parsedX.start.r;
                  let cX = parsedX.start.c;
                  let rY = yStart.r;
                  let cY = yStart.c;
                  
                  let seriesName = rawName;
                  if (numSeries > 1 || files.length === 1) {
                      let headerCell;
                      if (dirY === 1 && yStart.r > 0) {
                          headerCell = worksheet[XLSX.utils.encode_cell({r: yStart.r - 1, c: yStart.c})];
                      } else if (dirY === 0 && yStart.c > 0) {
                          headerCell = worksheet[XLSX.utils.encode_cell({r: yStart.r, c: yStart.c - 1})];
                      }
                      
                      const headerStr = headerCell && headerCell.v !== undefined ? String(headerCell.v).trim() : '';
                      
                      if (headerStr !== '') {
                          seriesName = files.length === 1 ? headerStr : `${rawName} - ${headerStr}`;
                      } else if (numSeries > 1) {
                          if (dirY === 1) {
                              seriesName = files.length === 1 ? `Col ${XLSX.utils.encode_col(yStart.c)}` : `${rawName} - Col ${XLSX.utils.encode_col(yStart.c)}`;
                          } else {
                              seriesName = files.length === 1 ? `Row ${yStart.r + 1}` : `${rawName} - Row ${yStart.r + 1}`;
                          }
                      }
                  }

                  while (true) {
                      const cellA = worksheet[XLSX.utils.encode_cell({r: rX, c: cX})]; 
                      const cellB = worksheet[XLSX.utils.encode_cell({r: rY, c: cY})]; 

                      if (!cellA || cellA.v === undefined || !cellB || cellB.v === undefined) {
                          break;
                      }

                      let xVal = String(cellA.v).trim();
                      
                      const xNum = parseFloat(xVal);
                      if (!isNaN(xNum)) {
                          let mhzVal = xNum;
                          if (unit === 'Hz') {
                              mhzVal = xNum / 1000000;
                          } else if (unit === 'GHz') {
                              mhzVal = xNum * 1000;
                          }
                          xVal = String(parseFloat(mhzVal.toFixed(6))); 
                      }

                      const yVal = parseFloat(cellB.v);
                      if (xVal !== '' && !isNaN(yVal)) {
                          fileData.push({ x: xVal, y: yVal });
                      }

                      let stop = false;
                      if (parsedX.end) {
                          if (dirX === 1 && rX >= parsedX.end.r) stop = true;
                          if (dirX === 0 && cX >= parsedX.end.c) stop = true;
                      }
                      if (stop) break;

                      if (dirX === 1) rX++; else cX++;
                      if (dirY === 1) rY++; else cY++;
                  }
                  
                  if (fileData.length > 0) {
                      fileSeriesData.push({ seriesName, data: fileData });
                  }
              }
              
              return fileSeriesData;

          } catch (e) {
              console.warn(`Failed to parse ${file.name}`, e);
              return null;
          }
      });

      const results = await Promise.all(promises);

      results.forEach(fileSeriesArray => {
          if (!fileSeriesArray) return;
          fileSeriesArray.forEach(res => {
              seriesList.push({ name: res.seriesName });
              res.data.forEach(point => {
                 const existing = allDataMap.get(point.x) || { name: point.x };
                 existing[res.seriesName] = point.y;
                 allDataMap.set(point.x, existing);
              });
          });
      });

      if (allDataMap.size === 0) {
          throw new Error(`No data found starting from ${xCell}/${yCell}.`);
      }

      const combinedData = Array.from(allDataMap.values());

      // Sort by frequency (numeric)
      combinedData.sort((a, b) => {
          const numA = parseFloat(a.name);
          const numB = parseFloat(b.name);
          if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB;
          }
          return a.name.localeCompare(b.name);
      });

      return { data: combinedData, series: seriesList };
  };

  const handleFileParse = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setChartData(null);
    setOriginalChartData(null);
    setSeries(null);
    setSpecRanges([]);

    try {
        if (files.length === 1) {
            setFileName(files[0].name);
        } else {
            setFileName(`Batch Import (${files.length} files)`);
        }

        const result = await processFiles(files, xStartCell, yStartCell, inputUnit);

        setSeries(result.series);
        setChartData(result.data);
        setOriginalChartData(JSON.parse(JSON.stringify(result.data)));

    } catch (err) {
        if (err instanceof Error) {
            setError(`Error: ${err.message}`);
        } else {
            setError("An unknown error occurred.");
        }
    } finally {
        setIsLoading(false);
    }
  }, [xStartCell, yStartCell, inputUnit]);

  const resetState = () => {
    setChartData(null);
    setOriginalChartData(null);
    setSeries(null);
    setError(null);
    setIsLoading(false);
    setFileName('');
    setManualPoints([]);
    setShowYInputModal(false);
    setSpecRanges([]);
  };

  const handleChartClick = (e: any) => {
    if (!e || !e.activeLabel || manualPoints.length >= 2 || showYInputModal) return;
    if (manualPoints.find(p => p.name === e.activeLabel)) return;

    const newPoints = [...manualPoints, { name: e.activeLabel }];
    setManualPoints(newPoints);

    if (newPoints.length === 2) {
      setShowYInputModal(true);
    }
  };

  const handleManualLineSubmit = (yValue: number) => {
    if (!chartData || !series || manualPoints.length !== 2) return;

    const [point1, point2] = manualPoints;
    const startIndex = chartData.findIndex(d => d.name === point1.name);
    const endIndex = chartData.findIndex(d => d.name === point2.name);
  
    if (startIndex === -1 || endIndex === -1) return;
  
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    const dataSeries = series.filter(s => s.name !== 'SPEC');
    const intersectingSeries: string[] = [];

    for (const s of dataSeries) {
        for (let i = minIndex; i < maxIndex; i++) {
            const point1Data = chartData[i];
            const point2Data = chartData[i + 1];

            const y1 = point1Data[s.name];
            const y2 = point2Data[s.name];
            
            if (typeof y1 !== 'number' || typeof y2 !== 'number') continue;
            
            if (y1 === yValue || y2 === yValue || (y1 - yValue) * (y2 - yValue) < 0) {
                intersectingSeries.push(s.name);
                break;
            }
        }
    }

    if (intersectingSeries.length > 0) {
        alert(`SPEC line cannot be created as it intersects with the following series: ${intersectingSeries.join(', ')}.`);
        return;
    }
  
    const manualSeriesName = 'SPEC';
  
    if (!series?.some(s => s.name === manualSeriesName)) {
      setSeries(prevSeries => [...(prevSeries || []), { name: manualSeriesName }]);
    }
  
    let total = 0;
    let count = 0;
    for (let i = minIndex; i <= maxIndex; i++) {
        const dataPoint = chartData[i];
        for (const s of dataSeries) {
            const value = dataPoint[s.name];
            if (typeof value === 'number') {
                total += value;
                count++;
            }
        }
    }

    let comparison = '';
    if (count > 0) {
        const average = total / count;
        if (average > yValue) {
            comparison = '>';
        } else if (average < yValue) {
            comparison = '<';
        }
    }
  
    const newChartData = chartData.map((dataPoint, index) => {
      const newPoint = { ...dataPoint };
      
      if (index >= minIndex && index <= maxIndex) {
        newPoint[manualSeriesName] = yValue;
      } else {
        newPoint[manualSeriesName] = dataPoint[manualSeriesName] ?? undefined;
      }
      return newPoint;
    });
  
    const name1 = chartData[minIndex].name;
    const name2 = chartData[maxIndex].name;
    
    let newRange: SpecRange;
    const num1 = parseFloat(name1);
    const num2 = parseFloat(name2);

    if (!isNaN(num1) && !isNaN(num2)) {
        newRange = { start: String(Math.min(num1, num2)), end: String(Math.max(num1, num2)), yValue, comparison };
    } else {
        newRange = { start: name1, end: name2, yValue, comparison };
    }
    
    const newRanges = [...specRanges, newRange];

    setSpecRanges(newRanges);
    setChartData(newChartData);
  
    setShowYInputModal(false);
    setManualPoints([]);
  };

  const handleModalCancel = () => {
    setShowYInputModal(false);
    setManualPoints([]);
  };

  const handleResetManualLine = () => {
    if (!originalChartData) return;
    setChartData(JSON.parse(JSON.stringify(originalChartData)));
    setSeries(prevSeries => prevSeries?.filter(s => s.name !== 'SPEC') || null);
    setManualPoints([]);
    setSpecRanges([]);
  };

  const handleUndo = () => {
    if (specRanges.length === 0 || !originalChartData || !series) return;

    const newRanges = specRanges.slice(0, -1);

    if (newRanges.length === 0) {
        handleResetManualLine();
        return;
    }

    let newChartData = JSON.parse(JSON.stringify(originalChartData));
    const manualSeriesName = 'SPEC';

    newRanges.forEach(range => {
        const startIndex = newChartData.findIndex((d: ChartData) => d.name === range.start);
        const endIndex = newChartData.findIndex((d: ChartData) => d.name === range.end);

        if (startIndex === -1 || endIndex === -1) {
            return; 
        }

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        for (let i = minIndex; i <= maxIndex; i++) {
            newChartData[i][manualSeriesName] = range.yValue;
        }
    });

    setSpecRanges(newRanges);
    setChartData(newChartData);
  };

  const handleExport = async () => {
    if (!chartData || !series || !exportChartRef.current) return;

    try {
      const hasSpec = series.some(s => s.name === 'SPEC');
      const otherSeriesNames = series.map(s => s.name).filter(name => name !== 'SPEC');
      const headers = ['name', ...(hasSpec ? ['SPEC'] : []), ...otherSeriesNames];

      // Generate image
      const dataUrl = await toPng(exportChartRef.current, { cacheBust: true, backgroundColor: 'white' });

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Chart Data');

      // Add Image
      const imageId = workbook.addImage({
        base64: dataUrl,
        extension: 'png',
      });

      // Add Data (starting row 1)
      const startRow = 1;
      
      worksheet.getRow(startRow).values = headers;

      chartData.forEach((row, index) => {
        const rowValues = headers.map(header => {
          const value = row[header];
          if (value === undefined || value === null) return null;
          return typeof value === 'number' ? parseFloat(value.toFixed(4)) : value;
        });
        worksheet.getRow(startRow + 1 + index).values = rowValues;
      });

      // Add image to sheet (G10 is col 6, row 9)
      worksheet.addImage(imageId, {
        tl: { col: 6, row: 9 },
        ext: { width: 1000, height: 600 }
      });

      // SPEC Info Sheet
      if (specRanges.length > 0) {
          const specSheet = workbook.addWorksheet('SPEC Info');
          specSheet.addRow(['Start (Mhz)', 'End (Mhz)', 'Specification']);
          specRanges.forEach(range => {
              specSheet.addRow([range.start, range.end, `${range.comparison} ${range.yValue}`]);
          });
      }

      // Write buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = hasSpec ? 'chart_data_with_spec.xlsx' : 'chart_data.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const specLineExists = series?.some(s => s.name === 'SPEC');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 transition-all duration-300">
      <div className="w-full max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
            Data Visualizer
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Upload file(s) and click on the chart to draw lines.
          </p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-teal-500/10 border border-gray-700/50 p-6 sm:p-8">
          {!chartData && (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <div className="mb-8 flex flex-wrap justify-center gap-6 bg-gray-900/60 p-5 rounded-xl border border-gray-700">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-300 mb-2">Frequency Unit</label>
                  <select 
                    value={inputUnit} 
                    onChange={(e) => setInputUnit(e.target.value)}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none w-32 transition-all appearance-none"
                  >
                    <option value="Hz">Hz</option>
                    <option value="MHz">MHz</option>
                    <option value="GHz">GHz</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-300 mb-2">Frequency Range (X)</label>
                  <input 
                    type="text" 
                    value={xStartCell} 
                    onChange={(e) => setXStartCell(e.target.value)}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none w-32 transition-all"
                    placeholder="e.g. A4 or A4~A100"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-300 mb-2">Value Range (Y)</label>
                  <input 
                    type="text" 
                    value={yStartCell} 
                    onChange={(e) => setYStartCell(e.target.value)}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none w-32 transition-all"
                    placeholder="e.g. B4 or B4~CM4"
                  />
                </div>
              </div>

              <FileUpload onFileSelect={handleFileParse} disabled={isLoading} />
              {isLoading && <p className="mt-4 text-teal-400 animate-pulse">Processing file(s)...</p>}
              {error && (
                <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 w-full max-w-2xl flex items-start space-x-3">
                    <ErrorIcon className="w-6 h-6 flex-shrink-0 mt-0.5"/>
                    <div>
                        <h3 className="font-bold">Parsing Failed</h3>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
              )}
               {!isLoading && !error && (
                  <div className="mt-8 text-center text-gray-500">
                      <UploadIcon className="w-12 h-12 mx-auto mb-2" />
                      <p>Awaiting file upload...</p>
                  </div>
              )}
            </div>
          )}

          {chartData && series && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <ChartIcon className="w-8 h-8 text-teal-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Visualization Result</h2>
                    <p className="text-sm text-gray-400">{fileName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                   {specLineExists && (
                     <>
                      <button
                        onClick={handleUndo}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
                      >
                        Undo
                      </button>
                      <button
                        onClick={handleResetManualLine}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75"
                      >
                        Reset All
                      </button>
                     </>
                   )}
                   <button
                    onClick={handleExport}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  >
                    Export Data
                  </button>
                  <button
                    onClick={resetState}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                  >
                    Upload Another File
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-4 bg-gray-900/60 p-3 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400">Y Min:</label>
                    <input 
                      type="number" 
                      value={yMin} 
                      onChange={(e) => setYMin(Number(e.target.value))}
                      className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400">Y Max:</label>
                    <input 
                      type="number" 
                      value={yMax} 
                      onChange={(e) => setYMax(Number(e.target.value))}
                      className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div className='flex justify-center items-start gap-4'>
                    {!showYInputModal && (
                    <div className="text-center bg-gray-900/60 p-3 rounded-lg border border-gray-700 text-teal-300 flex-grow">
                        <p>
                        {manualPoints.length === 0 && 'Click on the chart to select the first X-axis point.'}
                        {manualPoints.length === 1 && `First point selected: ${manualPoints[0].name}. Now, select the second point.`}
                        </p>
                    </div>
                    )}
                    {specRanges.length > 0 && (
                        <div className="p-3 bg-violet-900/50 border border-violet-700 rounded-lg text-violet-300 flex-grow">
                            <p className="font-bold mb-1">SPEC Ranges:</p>
                            <ul className="space-y-1">
                                {specRanges.map((range, index) => (
                                    <li key={index} className="font-mono text-sm">
                                        {range.start} - {range.end} Mhz <span className="font-semibold text-white">{range.comparison} {range.yValue}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              </div>
              <div className="w-full h-[500px] bg-gray-900/60 rounded-xl p-4 border border-gray-700">
                <DataChart 
                  data={chartData} 
                  series={series} 
                  onChartClick={handleChartClick} 
                  yMin={yMin}
                  yMax={yMax}
                />
              </div>

              {/* Hidden Export Chart */}
              <div style={{ position: 'fixed', top: -10000, left: -10000 }}>
                 <div ref={exportChartRef}>
                   <ExportChart 
                     data={chartData} 
                     series={series} 
                     yMin={yMin} 
                     yMax={yMax} 
                     title={`Resonance (${chartData[0]?.name}MHz - ${chartData[chartData.length - 1]?.name}MHz)`}
                   />
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <footer className="text-center mt-8 text-gray-600 text-sm">
        <p>Built with React, TypeScript, and Tailwind CSS. Chart powered by Recharts.</p>
      </footer>
      <ManualInputModal 
        isOpen={showYInputModal}
        points={manualPoints}
        onClose={handleModalCancel}
        onSubmit={handleManualLineSubmit}
      />
    </div>
  );
};

export default App;
