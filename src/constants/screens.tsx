
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

export interface ScreenConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  showInMenu?: boolean;
  id?: string; // For Layout menu items if different from key
}

export const APP_SCREENS: ScreenConfig[] = [
  { key: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={20} />, showInMenu: true },
  { key: 'customers', label: 'לקוחות', icon: <Users size={20} />, showInMenu: true },
  { key: 'inspections', label: 'ביקורות', icon: <ClipboardCheck size={20} />, showInMenu: true },
  { key: 'certificates', label: 'אישורים / תעודות', icon: <FileText size={20} />, showInMenu: true },
  { key: 'users', label: 'ניהול משתמשים', icon: <Settings size={20} />, showInMenu: true },
  { key: 'form_builder', label: 'עורך טפסים', icon: <Trello size={20} />, showInMenu: true },
  { key: 'update_tables', label: 'עדכון טבלאות', icon: <TableProperties size={20} />, showInMenu: true },
  { key: 'import', label: 'ייבוא נתונים', icon: <Upload size={20} />, showInMenu: true },
  { key: 'import_flow', label: 'מדריך ייבוא', icon: <Info size={20} />, showInMenu: true, id: 'import_flow' },
  { key: 'db_manager', label: 'ניהול בסיס נתונים', icon: <Database size={20} />, showInMenu: true },
  { key: 'audit_logs', label: 'יומן פעילות', icon: <History size={20} />, showInMenu: true },
  { key: 'diagnostics', label: 'אבחון מערכת', icon: <Activity size={20} />, showInMenu: true },
  { key: 'triggers', label: 'טריגרים', icon: <Zap size={20} />, showInMenu: true },
];
