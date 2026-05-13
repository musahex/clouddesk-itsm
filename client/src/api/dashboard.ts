import http from './http';
import { DashboardData } from '../types/dashboard';

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await http.get<DashboardData>('/dashboard');
  return data;
}
