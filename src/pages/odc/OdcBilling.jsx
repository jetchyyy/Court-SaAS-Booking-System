import { CheckCircle, CircleDollarSign, Receipt, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../../components/ui';
import {
  createOwnerInvoice,
  listBillingSummary,
  listInvoices,
  markOwnerInvoicePaid,
} from '../../services/superadmin';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function OdcBilling() {
  const [billing, setBilling] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    tenantId: '',
    periodStart: monthStartDate(),
    periodEnd: todayDate(),
    externalReference: '',
    notes: '',
  });

  const totals = useMemo(() => {
    return billing.reduce((acc, item) => {
      acc.bookingCount += item.unbilledBookingCount || 0;
      acc.totalAmount += item.unbilledTotalAmount || 0;
      return acc;
    }, { bookingCount: 0, totalAmount: 0 });
  }, [billing]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [billingRows, invoiceRows] = await Promise.all([
        listBillingSummary(),
        listInvoices(),
      ]);
      setBilling(billingRows);
      setInvoices(invoiceRows);
      if (!invoiceForm.tenantId && billingRows[0]?.id) {
        setInvoiceForm((prev) => ({ ...prev, tenantId: billingRows[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateInvoice = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createOwnerInvoice(invoiceForm);
      setInvoiceForm((prev) => ({ ...prev, externalReference: '', notes: '' }));
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    setSaving(true);
    setError('');
    try {
      await markOwnerInvoicePaid(invoiceId);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to mark invoice paid.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-brand-green-dark">Billing</h1>
          <p className="text-gray-500">Track unbilled bookings, create invoices, and mark owner payments.</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>Refresh</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unbilled Bookings</p>
              <p className="mt-1 text-3xl font-bold">{totals.bookingCount}</p>
            </div>
            <Receipt className="text-brand-orange" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Amount Due</p>
              <p className="mt-1 text-3xl font-bold">PHP {totals.totalAmount.toLocaleString()}</p>
            </div>
            <CircleDollarSign className="text-green-600" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="p-5">
          <h2 className="font-display font-bold text-lg text-brand-green-dark">Create Invoice</h2>
          <form onSubmit={handleCreateInvoice} className="mt-4 space-y-3">
            <select value={invoiceForm.tenantId} onChange={(event) => setInvoiceForm({ ...invoiceForm, tenantId: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" required>
              {billing.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - PHP {item.unbilledTotalAmount.toLocaleString()}</option>
              ))}
            </select>
            <input type="date" value={invoiceForm.periodStart} onChange={(event) => setInvoiceForm({ ...invoiceForm, periodStart: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" required />
            <input type="date" value={invoiceForm.periodEnd} onChange={(event) => setInvoiceForm({ ...invoiceForm, periodEnd: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" required />
            <input placeholder="External invoice/reference" value={invoiceForm.externalReference} onChange={(event) => setInvoiceForm({ ...invoiceForm, externalReference: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <textarea placeholder="Notes" value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" rows="3" />
            <Button type="submit" className="w-full text-white" disabled={saving || !invoiceForm.tenantId}>
              <Save size={16} /> Create Invoice
            </Button>
          </form>
        </Card>

        <Card className="p-0">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-display font-bold text-lg text-brand-green-dark">Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Bookings</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-5 py-3 font-mono text-xs">{invoice.invoice_number}</td>
                    <td className="px-5 py-3">{invoice.tenants?.name || '-'}</td>
                    <td className="px-5 py-3">{invoice.booking_count}</td>
                    <td className="px-5 py-3">{invoice.currency} {Number(invoice.total_amount || 0).toLocaleString()}</td>
                    <td className="px-5 py-3"><Badge variant={invoice.status === 'paid' ? 'green' : 'orange'}>{invoice.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      {invoice.status !== 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkPaid(invoice.id)} disabled={saving}>
                          <CheckCircle size={14} /> Mark Paid
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-5 py-8 text-center text-gray-500">No invoices yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
