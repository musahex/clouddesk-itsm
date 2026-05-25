import http from './http';
import { SystemHealth, SystemEventsResponse } from '../types/system';

export async function getSystemHealth(): Promise<SystemHealth> {
  const { data } = await http.get<SystemHealth>('/system/health');
  return data;
}

export async function getSystemEvents(limit = 50): Promise<SystemEventsResponse> {
  const { data } = await http.get<SystemEventsResponse>(`/system/events?limit=${limit}`);
  return data;
}
