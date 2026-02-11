import axios from "axios";

export interface RecurrenceEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
}

export async function getRecurrenceEvents(startDate: string, endDate: string): Promise<RecurrenceEvent[]> {
  const url = process.env.RECURRENCE_API_URL;
  if (!url) return [];

  try {
    const response = await axios.get(url, {
      params: { start: startDate, end: endDate },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch recurrence events:", error);
    return [];
  }
}
