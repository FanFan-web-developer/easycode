export class InvoiceService {
  format(total: number): string {
    return `$${total.toFixed(2)}`
  }
}
