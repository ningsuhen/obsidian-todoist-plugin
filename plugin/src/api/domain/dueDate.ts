export type DueDate = {
  isRecurring: boolean;
  date: string;
  datetime?: string;
  string?: string; // Todoist's original due string like "every day", "every saturday"
};
