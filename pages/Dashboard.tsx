
import React from 'react';
import { User, UserRole, InspectionStatus, Inspection, Customer, Certificate } from '../types';
import { dbService } from '../services/dbService';
import { 
  Users as UsersIcon, 
  ClipboardCheck, 
  FileText, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<{
    customers: Customer[];
    inspections: Inspection[];
    certificates: Certificate[];
  }>({ customers: [], inspections: [], certificates: [] });

  React.useEffect(() => {
    const load = async () => {
      try {
        const [c, i, certs] = await Promise.all([
          dbService.getCustomers(),
          dbService.getInspections(),
          dbService.getCertificates()
        ]);
        setData({ customers: c, inspections: i, certificates: certs });
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-medium">טוען נתונים מהשרת...</p>
      </div>
    );
  }

  const techInspections = user.role === UserRole.USER 
    ? data.inspections.filter(i => i.technicianId === user.id)
    : data.inspections;

  const stats = [
    { label: 'לקוחות', value: data.customers.length, icon: <UsersIcon className="text-blue-500" />, bg: 'bg-blue-50' },
    { label: 'ביקורות פתוחות', value: techInspections.filter(i => i.status !== InspectionStatus.CLOSED).length, icon: <ClipboardCheck className="text-orange-500" />, bg: 'bg-orange-50' },
    { label: 'אישורים שהונפקו', value: data.certificates.filter(c => c.status === 'Issued').length, icon: <FileText className="text-green-500" />, bg: 'bg-green-50' },
    { label: 'ביקורות באיחור', value: 0, icon: <AlertCircle className="text-red-500" />, bg: 'bg-red-50' },
  ];

  const chartData = [
    { name: 'מרץ', count: data.inspections.length },
  ];

  return (
    <div className="space-y-6">
      {/* Responsive Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={`p-5 md:p-6 rounded-xl border flex items-center space-x-4 space-x-reverse ${stat.bg} shadow-sm`}>
            <div className="p-3 bg-white rounded-lg shadow-sm">{stat.icon}</div>
            <div>
              <p className="text-xs md:text-sm text-gray-600">{stat.label}</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card */}
        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl border shadow-sm overflow-hidden">
          <h3 className="text-base md:text-lg font-bold mb-6">פעילות ביקורות</h3>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm flex flex-col min-h-[400px]">
          <h3 className="text-base md:text-lg font-bold mb-4">ביקורות אחרונות</h3>
          <div className="flex-1 space-y-3 md:space-y-4">
            {techInspections.slice(0, 6).map(i => {
              const customer = data.customers.find(c => c.id === i.customerId);
              return (
                <div key={i.id} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 truncate text-sm md:text-base">{customer?.name || 'לקוח לא ידוע'}</p>
                    <p className="text-[10px] md:text-xs text-gray-500">{i.inspectionSerialNumber}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] md:text-xs rounded-full font-medium whitespace-nowrap ${
                    i.status === InspectionStatus.CLOSED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {i.status === InspectionStatus.CLOSED ? 'סגור' : 'בטיפול'}
                  </span>
                </div>
              );
            })}
            {techInspections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <ClipboardCheck size={40} className="mb-2 opacity-20" />
                <p className="text-sm">אין ביקורות להצגה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
