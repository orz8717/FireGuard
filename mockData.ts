
import { User, UserRole, Customer, InspectionType, FormTemplate, FieldType, InspectionStatus } from './types';

export const SEED_USERS: User[] = [
  {
    id: 'u1',
    name: 'מנהל ראשי',
    email: 'admin@fireguard.co.il',
    phone: '050-1111111',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    name: 'אבי הטכנאי',
    email: 'avi@fireguard.co.il',
    phone: '050-2222222',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'u3',
    name: 'דנה מהמשרד',
    email: 'office@fireguard.co.il',
    phone: '050-3333333',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    customerNumber: '10001',
    name: 'קניון עזריאלי',
    address: 'דרך מנחם בגין 132',
    city: 'תל אביב',
    contactName: 'ישראל ישראלי',
    contactPhone: '03-1234567',
    contactEmail: 'israel@azrieli.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c2',
    customerNumber: '10002',
    name: 'מגדלי התאומים',
    address: 'ז\'בוטינסקי 33',
    city: 'רמת גן',
    contactName: 'משה כהן',
    contactPhone: '03-7654321',
    contactEmail: 'moshe@twins.co.il',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const ANNUAL_TEMPLATE: FormTemplate = {
  id: 'ft1',
  formKey: 'ANNUAL_INSPECTION',
  name: 'בדיקה שנתית למערכת גילוי אש',
  description: 'טופס בדיקה שנתי לפי תקן 1220 חלק 11',
  isActive: true,
  createdAt: new Date().toISOString(),
  fields: [
    {
      id: 'f1',
      formTemplateId: 'ft1',
      fieldKey: 'sec_panel',
      label: 'בדיקת רכזת',
      fieldType: FieldType.SECTION_TITLE,
      isRequired: false,
      orderIndex: 0
    },
    {
      id: 'f2',
      formTemplateId: 'ft1',
      fieldKey: 'panel_functional',
      label: 'רכזת תקינה ומתפקדת',
      fieldType: FieldType.BOOLEAN,
      isRequired: true,
      orderIndex: 1
    },
    {
      id: 'f3',
      formTemplateId: 'ft1',
      fieldKey: 'panel_voltage',
      label: 'מתח ספקי כוח (V)',
      fieldType: FieldType.NUMBER,
      isRequired: true,
      orderIndex: 2
    },
    {
      id: 'f4',
      formTemplateId: 'ft1',
      fieldKey: 'sec_detectors',
      label: 'בדיקת גלאים',
      fieldType: FieldType.SECTION_TITLE,
      isRequired: false,
      orderIndex: 3
    },
    {
      id: 'f5',
      formTemplateId: 'ft1',
      fieldKey: 'smoke_detectors_count',
      label: 'כמות גלאי עשן שנבדקו',
      fieldType: FieldType.NUMBER,
      isRequired: true,
      orderIndex: 4
    },
    {
      id: 'f6',
      formTemplateId: 'ft1',
      fieldKey: 'heat_detectors_count',
      label: 'כמות גלאי חום שנבדקו',
      fieldType: FieldType.NUMBER,
      isRequired: true,
      orderIndex: 5
    }
  ]
};

export const SEMI_ANNUAL_TEMPLATE: FormTemplate = {
  id: 'ft2',
  formKey: 'SEMI_ANNUAL_INSPECTION',
  name: 'בדיקה חצי שנתית',
  description: 'בדיקה תקופתית חצי שנתית',
  isActive: true,
  createdAt: new Date().toISOString(),
  fields: [
    {
      id: 'sf1',
      formTemplateId: 'ft2',
      fieldKey: 'sec_general',
      label: 'בדיקה כללית',
      fieldType: FieldType.SECTION_TITLE,
      isRequired: false,
      orderIndex: 0
    },
    {
      id: 'sf2',
      formTemplateId: 'ft2',
      fieldKey: 'visual_check',
      label: 'בדיקה ויזואלית תקינה',
      fieldType: FieldType.BOOLEAN,
      isRequired: true,
      orderIndex: 1
    }
  ]
};
