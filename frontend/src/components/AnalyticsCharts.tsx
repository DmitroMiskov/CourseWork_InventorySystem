import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Paper, Grid as Grid, Typography } from '@mui/material';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface Product {
  id: string;
  name: string;
  price: number;
  category?: { name: string };
  categoryId?: string;
  quantity: number;
}

interface AnalyticsChartsProps {
  products: Product[];
}

// 1. Інтерфейс даних для Recharts (дозволяємо динамічні ключі певних типів)
interface CategoryData {
  name: string;
  value: number;
  [key: string]: string | number | undefined; 
}

// 👇 2. ВИПРАВЛЕНИЙ ТИП: Додаємо "| undefined", щоб задовольнити TypeScript
type RechartsValue = number | string | Array<number | string> | undefined;

export default function AnalyticsCharts({ products }: AnalyticsChartsProps) {
  
  const categoryData = products.reduce<CategoryData[]>((acc, product) => {
    const catName = product.category?.name || 'Інше';
    const existing = acc.find(item => item.name === catName);
    
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: catName, value: 1 });
    }
    return acc;
  }, []);

  const expensiveData = [...products]
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map(p => ({
      name: p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name,
      price: p.price
    }));

  if (products.length === 0) return null;

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" align="center" gutterBottom>Структура складу</Typography>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ percent }: { percent?: number }) => `${((percent || 0) * 100).toFixed(0)}%`}
              >
                {categoryData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" align="center" gutterBottom>Топ-5 найдорожчих</Typography>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expensiveData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit=" грн" />
              <YAxis dataKey="name" type="category" width={100} />
              
              {/* 👇 3. БЕЗПЕЧНИЙ FORMATTER */}
              <Tooltip 
                formatter={(value: RechartsValue) => {
                  // Перевіряємо: якщо це число і воно існує -> форматуємо
                  if (value !== undefined && typeof value === 'number') {
                    return [`${value} грн`, 'Ціна'];
                  }
                  // В усіх інших випадках повертаємо як є (приводимо до рядка, якщо це масив)
                  return [String(value), 'Ціна'];
                }} 
              />
              
              <Bar dataKey="price" fill="#1976d2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );
}