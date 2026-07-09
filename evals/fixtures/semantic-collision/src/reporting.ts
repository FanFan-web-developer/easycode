export class ReportService {
  format(rows: string[]): string {
    return rows.join("\n")
  }
}
