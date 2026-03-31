import React, { useState, useEffect } from 'react';

interface ManualInputModalProps {
  isOpen: boolean;
  points: { name: string }[];
  onClose: () => void;
  onSubmit: (yValue: number) => void;
}

const ManualInputModal: React.FC<ManualInputModalProps> = ({ isOpen, points, onClose, onSubmit }) => {
  const [yValue, setYValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Reset form when modal becomes visible
    if (isOpen) {
      setYValue('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (yValue.trim() === '') {
      setError('Please enter a Y-value.');
      return;
    }

    const y = parseFloat(yValue);

    if (isNaN(y)) {
      setError('Please enter a valid number for the Y-value.');
      return;
    }

    onSubmit(y);
  };

  const showModal = isOpen && points.length === 2;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700 transform transition-all duration-300 ${
          showModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {showModal && (
            <>
                <h2 className="text-2xl font-bold mb-4 text-white">Enter Y-Axis Value</h2>
                <p className="text-gray-400 mb-6">
                    Set a constant Y-value for the SPEC line between points{' '}
                    <span className="font-bold text-teal-400">{points[0]?.name}</span> and{' '}
                    <span className="font-bold text-teal-400">{points[1]?.name}</span>.
                </p>
                
                <div className="space-y-4">
                    <div>
                      <label htmlFor="y-value" className="block text-sm font-medium text-gray-300 mb-1">
                        Y-Value for SPEC Line
                      </label>
                      <input
                        type="number"
                        id="y-value"
                        value={yValue}
                        onChange={(e) => setYValue(e.target.value)}
                        placeholder="e.g., 5.5"
                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                
                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 transition"
                  >
                    Draw Line
                  </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ManualInputModal;
