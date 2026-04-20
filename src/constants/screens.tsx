
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

// Lazy-loaded pages — each page is a separate chunk for faster initial load
const Dashboard = React.lazy(() => import('../../pages/Dashboard'));
const Customers = React.lazy(() => import('../../pages/Customers'));
const Inspections = React.lazy(() => import('../../pages/Inspections'));
const Certificates = React.lazy(() => import('../../pages/Certificates'));
const UsersPage = React.lazy(() => import('../../pages/Users'));
const FormBuilder = React.lazy(() => import('../../pages/FormBuilder'));
const Diagnostics = React.lazy(() => import('../../pages/Diagnostics'));
const DbManager = React.lazy(() => import('../../pages/DbManager'));
const AuditLogs = React.lazy(() => import('../../pages/AuditLogs'));
const TriggersPage = React.lazy(() => import('../../pages/TriggersPage'));
const UpdateTables = React.lazy(() => import('../../pages/UpdateTables'));
const ImportExcel = React.lazy(() => import('../../pages/ImportExcel'));

export interface ScreenConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  showInMenu?: boolean;
  id?: string; // For Layout menu items if different from key
  component?: React.ComponentType<any>;
  defaultRoles?: string[]; // Roles that have access by default
}

export const APP_SCREENS: ScreenConfig[] = [
  { key: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={20} />, showInMenu: true, component: Dashboard, defaultRoles: ['ADMIN', 'OFFICE', 'USER'] },
  { key: 'customers', label: 'לקוחות', icon: <Users size={20} />, showInMenu: true, component: Customers, defaultRoles: ['ADMIN', 'OFFICE', 'USER'] },
  { key: 'inspections', label: 'ביקורות', icon: <ClipboardCheck size={20} />, showInMenu: true, component: Inspections, defaultRoles: ['ADMIN', 'OFFICE', 'USER'] },
  { key: 'certificates', label: 'אישורים / תעודות', icon: <FileText size={20} />, showInMenu: true, component: Certificates, defaultRoles: ['ADMIN', 'OFFICE'] },
  { key: 'users', label: 'ניהול משתמשים', icon: <Settings size={20} />, showInMenu: true, component: UsersPage, defaultRoles: ['ADMIN'] },
  { key: 'form_builder', label: 'עורך טפסים', icon: <Trello size={20} />, showInMenu: true, component: FormBuilder, defaultRoles: ['ADMIN'] },
  { key: 'update_tables', label: 'עדכון טבלאות', icon: <TableProperties size={20} />, showInMenu: true, component: UpdateTables, defaultRoles: ['ADMIN', 'OFFICE', 'USER'] },
  { key: 'import', label: 'ייבוא נתונים', icon: <Upload size={20} />, showInMenu: true, component: ImportExcel, defaultRoles: ['ADMIN', 'OFFICE'] },
  { key: 'import_flow', label: 'מדריך ייבוא', icon: <Info size={20} />, showInMenu: true, id: 'import_flow', component: ImportExcel, defaultRoles: ['ADMIN', 'OFFICE'] },
  { key: 'db_manager', label: 'ניהול בסיס נתונים', icon: <Database size={20} />, showInMenu: true, component: DbManager, defaultRoles: ['ADMIN'] },
  { key: 'audit_logs', label: 'יומן פעילות', icon: <History size={20} />, showInMenu: true, component: AuditLogs, defaultRoles: ['ADMIN'] },
  { key: 'diagnostics', label: 'אבחון מערכת', icon: <Activity size={20} />, showInMenu: true, component: Diagnostics, defaultRoles: ['ADMIN'] },
  { key: 'triggers', label: 'טריגרים', icon: <Zap size={20} />, showInMenu: true, component: TriggersPage, defaultRoles: ['ADMIN', 'OFFICE'] },
];
