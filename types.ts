
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  OFFICE = 'OFFICE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  userId: string;
  screenKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
  canGenerateCertificates: boolean;
  canImportExcel: boolean;
}

export interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  address: string;
  city: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum InspectionType {
  ANNUAL = 'ANNUAL',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  OTHER = 'OTHER'
}

export enum InspectionStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'SubmittedByTechnician',
  REVIEWED = 'ReviewedByOffice',
  CLOSED = 'Closed'
}

export interface Inspection {
  id: string;
  inspectionSerialNumber: string; // e.g., AN-2024-0001
  inspectionType: InspectionType;
  templateName?: string; // Added to support filtering by form name
  customerId: string;
  technicianId: string;
  inspectionDate: string;
  status: InspectionStatus;
  data: Record<string, any>; // JSON content of the dynamic form
  tempChildData?: Record<string, any>; // Bundled child data for atomic saving
  createdAt: string;
  updatedAt: string;
}

export enum CertificateType {
  FORM_4 = 'FORM_4',
  FORM_5 = 'FORM_5',
  FORM_6 = 'FORM_6'
}

export enum CertificateStatus {
  DRAFT = 'Draft',
  ISSUED = 'Issued',
  SENT = 'SentToCustomer',
  CANCELLED = 'Cancelled'
}

export interface Certificate {
  id: string;
  inspectionId: string;
  certificateType: CertificateType;
  certificateNumber?: string;
  issueDate: string;
  status: CertificateStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum FieldType {
  TEXT = 'text',
  LONG_TEXT = 'longText',
  NUMBER = 'number',
  DECIMAL = 'decimal',
  PRICE = 'price',
  PERCENT = 'percent',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'dateTime',
  DURATION = 'duration',
  ENUM = 'enum',
  ENUM_LIST = 'enumList',
  YES_NO = 'yesNo',
  PHONE = 'phone',
  EMAIL = 'email',
  ADDRESS = 'address',
  IMAGE = 'image',
  FILE = 'file',
  SIGNATURE = 'signature',
  DRAWING = 'drawing',
  VIDEO = 'video',
  COLOR = 'color',
  PROGRESS = 'progress',
  SECTION_TITLE = 'sectionTitle',
  LINK_BUTTON = 'linkButton',
  // Backward compatibility aliases
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multiSelect'
}

export interface FormField {
  id: string;
  formTemplateId: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  defaultValue?: any;
  orderIndex: number;
  visibilityCondition?: string; // Expression
  validationFormula?: string;
  calculationFormula?: string;
  options?: { value: string; label: string }[];
  yesLabel?: string;
  noLabel?: string;
  // Enum/EnumList configuration
  dataSourceType?: 'Manual' | 'Supabase';
  displayMode?: 'Dropdown' | 'Buttons';
  manualOptions?: string[];
  supabaseConfig?: { tableName: string; columnName: string };
  targetFormId?: string;
  isVirtual?: boolean;
  isHidden?: boolean;
}

export interface AuditLog {
  id: string;
  created_at: string;
  user_name: string;
  action_type: string;
  description: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error_details?: any;
  execution_time?: number;
}

export interface FormTemplate {
  id: string;
  formKey: string;
  name: string;
  description: string;
  isActive: boolean;
  tableName?: string;
  fields: FormField[];
  createdAt: string;
  navigation_config?: {
    enabled: boolean;
    label: string;
    targetTemplateId: string;
    showAsButton?: boolean;
  };
}
