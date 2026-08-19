export class PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
