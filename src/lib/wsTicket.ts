export interface WsTicket {
  ticket: string;
  origin: string;
}

export async function getWsTicket(courseId: string | number): Promise<WsTicket | null> {
  try {
    const response = await fetch(`/api/ws-ticket?courseId=${courseId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export function buildWsUrl(ticket: WsTicket, courseId: string | number): string {
  const base =
    ticket.origin ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${base}/ws/course/${courseId}/generation?ticket=${encodeURIComponent(ticket.ticket)}`;
}
