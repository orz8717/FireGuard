
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  FileText, 
  Settings, 
  Database, 
  Upload,
  Trello,
  Activity,
  History,
  Zap,
  Info,
  TableProperties
} from 'lucide-react';

// Import components for dynamic rendering
import Dashboard from '../../pages/Dashboard';
import Customers from '../../pages/Customers';
import Inspections from '../../pages/Inspections';
import Certificates from '../../pages/Certificates';
import UsersPage from '../../pages/Users';
import FormBuilder from '../../pages/FormBuilder';
import Diagnostics from '../../pages/Diagnostics';
import DbManager from '../../pages/DbManager';
import AuditLogs from '../../pages/AuditLogs';
import TriggersPage from '../../pages/TriggersPage';
import UpdateTables from '../../pages/UpdateTables';
import ImportExcel from '../../pages/ImportExcel';

export interface ScreenConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  showInMenu?: boolean;
  id?: string; // For Layout menu items if different from key
  component?: React.ComponentType<any>;
}

export const APP_SCREENS: ScreenConfig[] = [
  { key: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={20} />, showInMenu: true, component: Dashboard },
  { key: 'customers', label: 'לקוחות', icon: <Users size={20} />, showInMenu: true, component: Customers },
  { key: 'inspections', label: 'ביקורות', icon: <ClipboardCheck size={20} />, showInMenu: true, component: Inspections },
  { key: 'certificates', label: 'אישורים / תעודות', icon: <FileText size={20} />, showInMenu: true, component: Certificates },
  { key: 'users', label: 'ניהול משתמשים', icon: <Settings size={20} />, showInMenu: true, component: UsersPage },
  { key: 'form_builder', label: 'עורך טפסים', icon: <Trello size={20} />, showInMenu: true, component: FormBuilder },
  { key: 'update_tables', label: 'עדכון טבלאות', icon: <TableProperties size={20} />, showInMenu: true, component: UpdateTables },
  { key: 'import', label: 'ייבוא נתונים', icon: <Upload size={20} />, showInMenu: true, component: ImportExcel },
  { key: 'import_flow', label: 'מדריך ייבוא', icon: <Info size={20} />, showInMenu: true, id: 'import_flow', component: ImportExcel },
  { key: 'db_manager', label: 'ניהול בסיס נתונים', icon: <Database size={20} />, showInMenu: true, component: DbManager },
  { key: 'audit_logs', label: 'יומן פעילות', icon: <History size={20} />, showInMenu: true, component: AuditLogs },
  { key: 'diagnostics', label: 'אבחון מערכת', icon: <Activity size={20} />, showInMenu: true, component: Diagnostics },
  { key: 'triggers', label: 'טריגרים', icon: <Zap size={20} />, showInMenu: true, component: TriggersPage },
];
