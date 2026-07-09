import { InvoiceService } from "./billing"

export function renderReceipt(service: InvoiceService, total: number): string {
  return service.format(total)
}
