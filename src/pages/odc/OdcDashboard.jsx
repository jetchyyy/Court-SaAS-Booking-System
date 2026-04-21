import { Building2, CircleDollarSign, Plus, Power, Receipt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../../components/ui';
import {
  createTenant,
  firstFeeSetting,
  listBillingSummary,
  listTenants,
  updateTenantFee,
  updateTenantStatus,
} from '../../services/superadmin';

export function OdcDashboard() {
  const [tenants, setTenants] = useState([]);
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTenant, setNewTenant] = useState({
    name: '',
    customDomain: '',
    contactEmail: '',
    contactPhone: '',
    ownerPassword: '',
    defaultBookingFeeAmount: 5,
  });
  const [ownerCredentials, setOwnerCredentials] = useState(null);

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
      const [tenantRows, billingRows] = await Promise.all([
        listTenants(),
        listBillingSummary(),
      ]);
      setTenants(tenantRows);
      setBilling(billingRows);
    } catch (err) {
      setError(err.message || 'Failed to load ODC data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateTenant = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setOwnerCredentials(null);
    try {
      const result = await createTenant(newTenant);
      setOwnerCredentials(result?.owner || null);
      setNewTenant({ name: '', customDomain: '', contactEmail: '', contactPhone: '', ownerPassword: '', defaultBookingFeeAmount: 5 });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create tenant.');
    } finally {
      setSaving(false);
    }
  };

  const handleFeeSave = async (tenantId, value) => {
    setSaving(true);
    try {
      await updateTenantFee(tenantId, value, 'PHP');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update tenant fee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-brand-green-dark">ODC Superadmin</h1>
          <p className="text-gray-500">Onboard owners, control access, and track platform booking fees.</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>Refresh</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clients</p>
              <p className="mt-1 text-3xl font-bold">{tenants.length}</p>
            </div>
            <Building2 className="text-brand-green-dark" />
          </div>
        </Card>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card className="p-0">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-display font-bold text-lg text-brand-green-dark">Clients</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Domain</th>
                  <th className="px-5 py-3">Fee</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => {
                  const fee = firstFeeSetting(tenant.tenant_fee_settings)?.fee_amount ?? tenant.default_booking_fee_amount ?? 5;
                  return (
                    <tr key={tenant.id}>
                      <td className="px-5 py-3 font-medium">{tenant.name}</td>
                      <td className="px-5 py-3 text-gray-500">{tenant.custom_domain || '-'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fee}
                            onBlur={(event) => {
                              if (Number(event.target.value) !== Number(fee)) {
                                void handleFeeSave(tenant.id, event.target.value);
                              }
                            }}
                            className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                          />
                          <span className="text-gray-400">PHP</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={tenant.is_active ? 'green' : 'red'}>{tenant.is_active ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant={tenant.is_active ? 'danger' : 'outline'}
                          onClick={async () => {
                            await updateTenantStatus(tenant.id, !tenant.is_active);
                            await loadData();
                          }}
                          disabled={saving}
                        >
                          <Power size={14} /> {tenant.is_active ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && tenants.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-gray-500">No clients onboarded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-bold text-lg text-brand-green-dark">Onboard Client</h2>
          {ownerCredentials && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <p className="font-semibold">Owner admin created</p>
              <p className="mt-1 break-all">Email: {ownerCredentials.email}</p>
              <p className="break-all">Temporary password: {ownerCredentials.temporaryPassword}</p>
              <p className="mt-1 text-xs text-green-700">Share this securely and ask the owner to change it after first login.</p>
            </div>
          )}
          <form onSubmit={handleCreateTenant} className="mt-4 space-y-3">
            <input required placeholder="Business name" value={newTenant.name} onChange={(event) => setNewTenant({ ...newTenant, name: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <input required placeholder="customdomain.com" value={newTenant.customDomain} onChange={(event) => setNewTenant({ ...newTenant, customDomain: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <input required type="email" placeholder="Owner email" value={newTenant.contactEmail} onChange={(event) => setNewTenant({ ...newTenant, contactEmail: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <input type="password" placeholder="Temporary password (optional)" value={newTenant.ownerPassword} onChange={(event) => setNewTenant({ ...newTenant, ownerPassword: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <input placeholder="Phone" value={newTenant.contactPhone} onChange={(event) => setNewTenant({ ...newTenant, contactPhone: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <input type="number" min="0" step="0.01" value={newTenant.defaultBookingFeeAmount} onChange={(event) => setNewTenant({ ...newTenant, defaultBookingFeeAmount: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
            <Button type="submit" className="w-full text-white" disabled={saving}>
              <Plus size={16} /> Create Client
            </Button>
          </form>
        </Card>
      </div>

    </div>
  );
}
