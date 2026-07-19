export function formatDate(date: Date | string): string {
   // ust timezone
   const d = typeof date === "string" ? new Date(date) : date;
   return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
   });
}

export function formatDateYmd(date: Date | string): string {
   const d = typeof date === "string" ? new Date(date) : date;
   return d.toISOString().slice(0, 10);
}
