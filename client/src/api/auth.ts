import http from './http';
import { AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/register', payload);
  return data;
}
