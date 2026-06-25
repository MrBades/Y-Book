import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface AgingData {
  name: string;
  value: number;
}

interface DebtorAgingPieChartProps {
  data0to15: number;
  data16to30: number;
  dataOver30: number;
}

const COLORS = ['#94A3B8', '#F59E0B', '#EF4444'];

export default function DebtorAgingPieChart({
  data0to15,
  data16to30,
  dataOver30,
}: DebtorAgingPieChartProps) {
  const data: AgingData[] = [
    { name: '0-15 Days', value: data0to15 },
    { name: '16-30 Days', value: data16to30 },
    { name: '30+ Days', value: dataOver30 },
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-gray-400 italic">No aging data available</div>;
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `₦${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
