import { fetchUserInvoices } from '@/app/actions/invoices';
import InvoiceTable from '@/components/features/invoices/invoice-table';

export const dynamic = 'force-dynamic'; // Ensures we don't cache stale DB records

export default async function InvoicesPage() {
  // Fetch fresh data securely on the server
  const invoices = await fetchUserInvoices();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Billing & Invoices
        </h1>
        <p className="text-slate-500 mt-1">
          View your transaction history and generate formal PDF receipts.
        </p>
      </div>

      <InvoiceTable initialInvoices={invoices} />
    </div>
  );
}
