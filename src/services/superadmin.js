import { supabase } from '../lib/supabaseClient';

function firstFeeSetting(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export async function listTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('*, tenant_fee_settings(fee_amount, currency, is_active)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTenant({
  name,
  customDomain,
  contactEmail,
  contactPhone,
  ownerPassword,
  defaultBookingFeeAmount = 5,
  defaultBookingFeeCurrency = 'PHP',
}) {
  const { data, error } = await supabase.functions.invoke('onboard-tenant-owner', {
    body: {
      name,
      customDomain,
      contactEmail,
      contactPhone,
      ownerPassword,
      defaultBookingFeeAmount,
      defaultBookingFeeCurrency,
    },
  });

  if (error) {
    let details = '';
    const context = error.context;

    if (context?.json) {
      try {
        const body = await context.json();
        details = body?.error || body?.message || '';
      } catch {
        details = '';
      }
    } else if (context?.text) {
      try {
        details = await context.text();
      } catch {
        details = '';
      }
    }

    throw new Error(details || error.message || 'Onboarding function failed.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateTenantStatus(tenantId, isActive) {
  const { data, error } = await supabase
    .from('tenants')
    .update({
      is_active: !!isActive,
      disabled_reason: isActive ? null : 'Disabled by platform admin',
    })
    .eq('id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTenantFee(tenantId, feeAmount, currency = 'PHP') {
  const { data, error } = await supabase
    .from('tenant_fee_settings')
    .upsert({
      tenant_id: tenantId,
      fee_amount: Number(feeAmount) || 0,
      currency: currency || 'PHP',
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listBillingSummary() {
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, custom_domain, is_active, tenant_fee_settings(fee_amount, currency, is_active)')
    .order('name');

  if (tenantError) throw tenantError;

  const { data: ledger, error: ledgerError } = await supabase
    .from('booking_fee_ledger')
    .select('tenant_id, fee_amount, currency, status, invoice_id')
    .is('invoice_id', null)
    .eq('status', 'unbilled');

  if (ledgerError) throw ledgerError;

  const totalsByTenant = (ledger || []).reduce((acc, row) => {
    const current = acc[row.tenant_id] || { bookingCount: 0, totalAmount: 0, currency: row.currency || 'PHP' };
    current.bookingCount += 1;
    current.totalAmount += Number(row.fee_amount) || 0;
    current.currency = row.currency || current.currency;
    acc[row.tenant_id] = current;
    return acc;
  }, {});

  return (tenants || []).map((tenant) => ({
    ...tenant,
    unbilledBookingCount: totalsByTenant[tenant.id]?.bookingCount || 0,
    unbilledTotalAmount: totalsByTenant[tenant.id]?.totalAmount || 0,
    currency: totalsByTenant[tenant.id]?.currency || firstFeeSetting(tenant.tenant_fee_settings)?.currency || 'PHP',
  }));
}

export { firstFeeSetting };

export async function listInvoices() {
  const { data, error } = await supabase
    .from('owner_invoices')
    .select('*, tenants(name, custom_domain)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createOwnerInvoice({ tenantId, periodStart, periodEnd, externalReference = '', notes = '' }) {
  const { data, error } = await supabase.rpc('create_owner_invoice', {
    p_tenant_id: tenantId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_external_reference: externalReference || null,
    p_notes: notes || null,
  });

  if (error) throw error;
  return data;
}

export async function markOwnerInvoicePaid(invoiceId) {
  const { data, error } = await supabase.rpc('mark_owner_invoice_paid', {
    p_invoice_id: invoiceId,
  });

  if (error) throw error;
  return data;
}
