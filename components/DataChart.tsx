
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartData, Series } from '../types';
import { CHART_COLORS } from '../constants';

interface DataChartProps {
  data: ChartData[];
  series: Series[];
  onChartClick: (e: any) => void;
  yMin: number;
  yMax: number;
}

const DataChart: React.FC<DataChartProps> = ({ data, series, onChartClick, yMin, yMax }) => {
  // Generate ticks for the Y-axis based on min, max, and interval
  const yInterval = 1;
  const numTicks = Math.max(1, Math.floor((yMax - yMin) / yInterval) + 1);
  const yAxisTicks = Array.from({ length: numTicks }, (_, i) => {
    const val = yMin + i * yInterval;
    return parseFloat(val.toFixed(2));
  });
  
  // Performance optimization: Hide legend if too many series to prevent clutter and DOM overload
  const showLegend = series.length <= 20;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 20,
        }}
        onClick={onChartClick}
        style={{ cursor: 'crosshair' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
        <XAxis 
          dataKey="name" 
          stroke="#A0AEC0" 
          tick={{ fill: '#A0AEC0', fontSize: 12 }}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis 
          stroke="#A0AEC0" 
          tick={{ fill: '#A0AEC0', fontSize: 12 }}
          domain={[yMin, yMax]}
          ticks={yAxisTicks}
          allowDataOverflow={true}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(26, 32, 44, 0.8)',
            borderColor: '#4A5568',
            borderRadius: '0.5rem',
            backdropFilter: 'blur(4px)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
          labelStyle={{ color: '#E2E8F0' }}
          itemSorter={(item) => (item.name === 'SPEC' ? -1 : 1)}
        />
        {showLegend && <Legend wrapperStyle={{ color: '#E2E8F0', paddingTop: '20px' }}/>}
        {series.map((s, index) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={(row: any) => row[s.name]}
            name={s.name}
            stroke={s.name === 'SPEC' ? '#eab308' : CHART_COLORS[index % (CHART_COLORS.length - 1)]} // Reserve yellow for SPEC
            strokeWidth={s.name === 'SPEC' ? 2 : 1.5}
            activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
            dot={s.name === 'SPEC' ? { r: 3, fill: '#eab308' } : false}
            connectNulls={false}
            isAnimationActive={false} // Disable animation for performance with many lines
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default DataChart;
