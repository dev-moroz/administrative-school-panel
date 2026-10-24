export type StudentListItem = {
  id: string;
  fullName: string;
  telegramUsername: string | null;
};

export type StudentListResponse = {
  items: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StudentListParams = {
  q?: string;
  page: number;
  pageSize: number;
  isActive?: boolean;
};
