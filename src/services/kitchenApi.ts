import { apiFetch } from './authApi';

export type CreateKitchenResponse = {
  kitchenTicketId: string;
  prepStatus: string;
};

export async function apiCreateKitchenTicket(orderId: string): Promise<{ ok: boolean; data?: CreateKitchenResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<CreateKitchenResponse>(`/orders/${orderId}/kitchen`, { method: 'POST' });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiUpdateKitchenStatus(orderId: string, prepStatus: string): Promise<{ ok: boolean; data?: { prepStatus: string }; error?: { code: string; message: string } }> {
  const res = await apiFetch<{ prepStatus: string }>(`/orders/${orderId}/kitchen/status`, {
    method: 'POST',
    body: { prepStatus },
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiCancelKitchenTicket(orderId: string): Promise<{ ok: boolean; error?: { code: string; message: string } }> {
  const res = await apiFetch(`/orders/${orderId}/kitchen`, { method: 'DELETE' });
  return { ok: res.status === 200 || res.status === 0, error: res.error };
}
