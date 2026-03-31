
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(Array.from(e.target.files));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(Array.from(e.dataTransfer.files));
    }
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <label
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`
        w-full max-w-2xl p-8 border-2 border-dashed rounded-xl cursor-pointer
        flex flex-col items-center justify-center text-center
        transition-all duration-300
        ${isDragging ? 'border-teal-400 bg-gray-700/50' : 'border-gray-600 hover:border-teal-500 hover:bg-gray-700/30'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
    >
      <UploadIcon className={`w-16 h-16 mb-4 transition-colors ${isDragging ? 'text-teal-400' : 'text-gray-500'}`} />
      <h3 className="text-xl font-semibold text-gray-200">
        Drag & Drop your CSV or Excel file(s) here
      </h3>
      <p className="text-gray-400 mt-1">or click to browse (supports multiple files)</p>
      <input
        type="file"
        multiple
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <p className="text-xs text-gray-500 mt-4">
        Reads data downwards starting from the specified X and Y cells.
      </p>
    </label>
  );
};

export default FileUpload;
