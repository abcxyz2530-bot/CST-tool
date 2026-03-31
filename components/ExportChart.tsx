import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';
import { ChartData, Series } from '../types';
import { CHART_COLORS } from '../constants';

interface ExportChartProps {
  data: ChartData[];
  series: Series[];
  yMin: number;
  yMax: number;
  title: string;
}

const ExportChart: React.FC<ExportChartProps> = ({ data, series, yMin, yMax, title }) => {
  // Generate ticks for the Y-axis based on min, max, and interval
  const yInterval = 1;
  const numTicks = Math.max(1, Math.floor((yMax - yMin) / yInterval) + 1);
  const yAxisTicks = Array.from({ length: numTicks }, (_, i) => {
    const val = yMin + i * yInterval;
    return parseFloat(val.toFixed(2));
  });

  return (
    <div style={{ width: '1000px', height: '600px', backgroundColor: 'white', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: 'black' }}>
        {title}
      </h2>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 40,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            stroke="#000000" 
            tick={{ fill: '#000000', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          >
            <Label value="Frequency (MHz)" offset={-20} position="insideBottom" style={{ fill: 'black', fontWeight: 'bold' }} />
          </XAxis>
          <YAxis 
            stroke="#000000" 
            tick={{ fill: '#000000', fontSize: 12 }}
            domain={[yMin, yMax]}
            ticks={yAxisTicks}
            allowDataOverflow={true}
          >
             <Label value="Formatted Data" angle={-90} position="insideLeft" style={{ fill: 'black', fontWeight: 'bold', textAnchor: 'middle' }} />
          </YAxis>
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right"
            wrapperStyle={{ paddingLeft: '20px', color: 'black' }} 
          />
          {series.map((s, index) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={(row: any) => row[s.name]}
              name={s.name}
              stroke={s.name === 'SPEC' ? '#eab308' : CHART_COLORS[index % (CHART_COLORS.length - 1)]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExportChart;
