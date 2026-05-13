import http from './http';
import {
  Ticket,
  CreateTicketPayload,
  UpdateStatusPayload,
  AddCommentPayload,
  AssignTicketPayload,
} from '../types/ticket';

export async function getTickets(): Promise<Ticket[]> {
  const { data } = await http.get<Ticket[]>('/tickets');
  return data;
}

export async function getTicketById(id: string): Promise<Ticket> {
  const { data } = await http.get<Ticket>(`/tickets/${id}`);
  return data;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const { data } = await http.post<Ticket>('/tickets', payload);
  return data;
}

export async function updateTicketStatus(id: string, payload: UpdateStatusPayload): Promise<Ticket> {
  const { data } = await http.patch<Ticket>(`/tickets/${id}/status`, payload);
  return data;
}

export async function addComment(id: string, payload: AddCommentPayload): Promise<Ticket> {
  const { data } = await http.post<Ticket>(`/tickets/${id}/comments`, payload);
  return data;
}

export async function assignTicket(id: string, payload: AssignTicketPayload): Promise<Ticket> {
  const { data } = await http.patch<Ticket>(`/tickets/${id}/assign`, payload);
  return data;
}
