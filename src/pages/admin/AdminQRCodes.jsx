import { AlertCircle, Check, CreditCard, Loader, RefreshCw, Save, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { getQrCodes, MAX_QR_FILE_SIZE_MB, updateQrCode, uploadQrImage } from '../../services/qrCodes';

const PROVIDERS = [
    { id: 'gcash',  label: 'GCash',  accent: 'blue',   textColor: 'text-blue-700',   ringColor: 'ring-blue-400',   bgColor: 'bg-blue-50',   badgeColor: 'text-blue-600'   },
    { id: 'gotyme', label: 'GoTyme', accent: 'indigo', textColor: 'text-indigo-700', ringColor: 'ring-indigo-400', bgColor: 'bg-indigo-50', badgeColor: 'text-indigo-600' },
];

export function AdminQRCodes() {
    const [activeTab, setActiveTab]       = useState('gcash');
    const [previewMethod, setPreviewMethod] = useState('gcash');
    const [pageLoading, setPageLoading]   = useState(true);

    // Per-provider editable form state
    const [form, setForm] = useState({
        gcash:  { image_url: '', account_name: '', file: null, localPreview: null },
        gotyme: { image_url: '', account_name: '', file: null, localPreview: null },
    });
    // Snapshot of what's actually saved in the DB — used for the template cards
    const [savedData, setSavedData] = useState({ gcash: null, gotyme: null });

    // Per-provider save state
    const [saving,  setSaving]  = useState({ gcash: false, gotyme: false });
    const [saved,   setSaved]   = useState({ gcash: false, gotyme: false });
    const [saveErr, setSaveErr] = useState({ gcash: null,  gotyme: null  });
    const [fileErr, setFileErr] = useState({ gcash: null,  gotyme: null  });

    const fileRefs = { gcash: useRef(null), gotyme: useRef(null) };

    // ── Load ─────────────────────────────────────────────────────────────────
    useEffect(() => { loadQrCodes(); }, []);

    const loadQrCodes = async () => {
        setPageLoading(true);
        try {
            const data = await getQrCodes();
            const gcash  = { image_url: data.gcash.image_url,  account_name: data.gcash.account_name  };
            const gotyme = { image_url: data.gotyme.image_url, account_name: data.gotyme.account_name };
            setForm({
                gcash:  { ...gcash,  file: null, localPreview: null },
                gotyme: { ...gotyme, file: null, localPreview: null },
            });
            setSavedData({ gcash, gotyme });
        } catch (err) {
            console.error('Failed to load QR codes:', err);
        } finally {
            setPageLoading(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const patch = (provider, updates) =>
        setForm(prev => ({ ...prev, [provider]: { ...prev[provider], ...updates } }));

    const handleFileSelect = (provider, e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // Reset so the same file can be re-selected
        if (!file) return;

        if (file.size > MAX_QR_FILE_SIZE_MB * 1024 * 1024) {
            setFileErr(prev => ({ ...prev, [provider]: `File exceeds the ${MAX_QR_FILE_SIZE_MB} MB limit. Please choose a smaller image.` }));
            return;
        }

        setFileErr(prev => ({ ...prev, [provider]: null }));
        const reader = new FileReader();
        reader.onloadend = () => patch(provider, { file, localPreview: reader.result });
        reader.readAsDataURL(file);
    };

    const getDisplayImage = (provider) =>
        form[provider].localPreview || form[provider].image_url || null;

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (provider) => {
        setSaving(prev => ({ ...prev, [provider]: true  }));
        setSaveErr(prev => ({ ...prev, [provider]: null }));
        try {
            let image_url = form[provider].image_url;
            if (form[provider].file) {
                image_url = await uploadQrImage(provider, form[provider].file);
            }
            await updateQrCode(provider, { image_url, account_name: form[provider].account_name });
            patch(provider, { image_url, file: null, localPreview: null });
            setSavedData(prev => ({ ...prev, [provider]: { image_url, account_name: form[provider].account_name } }));
            setSaved(prev => ({ ...prev, [provider]: true }));
            setTimeout(() => setSaved(prev => ({ ...prev, [provider]: false })), 3000);
        } catch (err) {
            setSaveErr(prev => ({ ...prev, [provider]: err.message }));
        } finally {
            setSaving(prev => ({ ...prev, [provider]: false }));
        }
    };

    const activeProvider = PROVIDERS.find(p => p.id === activeTab);
    const previewProvider = PROVIDERS.find(p => p.id === previewMethod);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 w-full max-w-full overflow-x-hidden">

            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold font-display text-brand-green-dark">QR Code Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Update GCash and GoTyme payment QR codes shown in the booking modal.</p>
                </div>
                <button
                    onClick={loadQrCodes}
                    disabled={pageLoading}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-green-dark px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={15} className={pageLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {pageLoading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Loader size={32} className="animate-spin" />
                        <p className="text-sm">Loading QR codes…</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                    {/* ── LEFT: Editor ─────────────────────────────────────────── */}
                    <Card className="p-6 border-none shadow-md space-y-6">
                        <h2 className="text-base font-semibold text-gray-800">Edit QR Code</h2>

                        {/* Provider tabs */}
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                            {PROVIDERS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setActiveTab(p.id)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === p.id
                                            ? 'bg-white shadow-sm text-gray-900'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {PROVIDERS.map(p => (
                            <div key={p.id} className={activeTab === p.id ? 'block space-y-5' : 'hidden'}>

                                {/* Current / new image */}
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">QR Image</p>
                                    <div className={`relative mx-auto w-52 aspect-square rounded-2xl overflow-hidden border-2 ${
                                        form[p.id].localPreview ? 'border-brand-green' : 'border-gray-200'
                                    } ${p.bgColor} flex items-center justify-center`}>
                                        {getDisplayImage(p.id) ? (
                                            <img
                                                src={getDisplayImage(p.id)}
                                                alt={`${p.label} QR`}
                                                className="w-full h-full object-contain"
                                                onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/400x400?text=${p.label}+QR`; }}
                                            />
                                        ) : (
                                            <p className="text-xs text-gray-400 text-center px-4">No image set</p>
                                        )}
                                        {form[p.id].localPreview && (
                                            <span className="absolute top-2 right-2 bg-brand-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                NEW
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Upload button */}
                                <div>
                                    <input
                                        ref={fileRefs[p.id]}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => handleFileSelect(p.id, e)}
                                    />
                                    <button
                                        onClick={() => fileRefs[p.id].current?.click()}
                                        disabled={saving[p.id]}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                            fileErr[p.id]
                                                ? 'border-red-300 text-red-500 bg-red-50'
                                                : form[p.id].localPreview
                                                    ? 'border-brand-green text-brand-green-dark bg-green-50/60'
                                                    : 'border-gray-300 text-gray-500 hover:border-brand-green hover:text-brand-green-dark hover:bg-green-50/40'
                                        }`}
                                    >
                                        <Upload size={16} />
                                        {form[p.id].localPreview ? 'Change Image' : 'Upload New QR Image'}
                                    </button>
                                    {/* File info / error below the button */}
                                    {fileErr[p.id] ? (
                                        <p className="text-xs text-red-500 mt-1 text-center">{fileErr[p.id]}</p>
                                    ) : form[p.id].file ? (
                                        <p className="text-xs text-gray-400 mt-1 text-center truncate">
                                            {form[p.id].file.name} ({(form[p.id].file.size / 1024).toFixed(0)} KB)
                                            {' — '}<span className="text-brand-green-dark font-medium">will be compressed on save</span>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-400 mt-1 text-center">Max {MAX_QR_FILE_SIZE_MB} MB · Compressed automatically on save</p>
                                    )}
                                </div>

                                {/* Or enter URL directly */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Or paste image URL
                                    </label>
                                    <input
                                        type="url"
                                        value={form[p.id].image_url}
                                        onChange={e => patch(p.id, { image_url: e.target.value, file: null, localPreview: null })}
                                        placeholder="https://…"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Uploading a file above overrides this URL.</p>
                                </div>

                                {/* Account name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                    <input
                                        type="text"
                                        value={form[p.id].account_name}
                                        onChange={e => patch(p.id, { account_name: e.target.value })}
                                        placeholder="e.g. Juan Dela Cruz"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                    />
                                </div>

                                {/* Save error */}
                                {saveErr[p.id] && (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700">{saveErr[p.id]}</p>
                                    </div>
                                )}

                                {/* Save button */}
                                <Button
                                    className="w-full text-white"
                                    onClick={() => handleSave(p.id)}
                                    disabled={saving[p.id] || !!fileErr[p.id]}
                                >
                                    {saving[p.id] ? (
                                        <><Loader size={16} className="animate-spin" /> {form[p.id].file ? 'Compressing & Saving…' : 'Saving…'}</>
                                    ) : saved[p.id] ? (
                                        <><Check size={16} /> Saved!</>
                                    ) : (
                                        <><Save size={16} /> Save {p.label} QR</>
                                    )}
                                </Button>

                                {/* Success banner */}
                                {saved[p.id] && (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl animate-in fade-in duration-300">
                                        <Check size={15} className="text-green-600 shrink-0" />
                                        <p className="text-xs text-green-700 font-medium">
                                            {p.label} QR code updated successfully. Users will see the new QR on their next booking.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </Card>

                    {/* ── RIGHT: Preview + Templates ──────────────────────────── */}
                    <div className="space-y-4">

                        {/* Compact live preview */}
                        <Card className="p-4 border-none shadow-md">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-800">Live Preview</h2>
                                    <p className="text-xs text-gray-400">How it looks in the booking modal</p>
                                </div>
                                <span className="text-xs font-medium text-brand-green-dark bg-brand-green-light px-2 py-0.5 rounded-full">
                                    Step 3 — Payment
                                </span>
                            </div>

                            {/* Compact modal frame */}
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                {/* Mini header */}
                                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        {[1,2,3,4].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full ${i <= 3 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-brand-green-light text-brand-green-dark flex items-center justify-center shrink-0">
                                            <CreditCard size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-brand-green-dark text-xs leading-tight">Payment</p>
                                            <p className="text-[10px] text-gray-400">Scan to pay via GCash or GoTyme</p>
                                        </div>
                                    </div>
                                </div>

                                {/* QR section */}
                                <div className="p-3">
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                        <p className="text-[10px] font-medium text-center text-gray-600 mb-2">Scan QR Code to Pay</p>

                                        {/* Toggle */}
                                        <div className="grid grid-cols-2 gap-1 mb-2 p-0.5 bg-gray-200/50 rounded-lg">
                                            {PROVIDERS.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setPreviewMethod(p.id)}
                                                    className={`py-1 px-2 rounded-md text-[10px] font-medium transition-all ${
                                                        previewMethod === p.id
                                                            ? `bg-white ${p.textColor} shadow-sm`
                                                            : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* QR image + account */}
                                        <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                                            <div className={`w-32 aspect-square rounded-md overflow-hidden mb-2 ${previewProvider.bgColor}`}>
                                                {getDisplayImage(previewMethod) ? (
                                                    <img
                                                        src={getDisplayImage(previewMethod)}
                                                        alt={`${previewProvider.label} QR preview`}
                                                        className="w-full h-full object-contain"
                                                        onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/400x400?text=${previewProvider.label}+QR`; }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <p className="text-[9px] text-gray-400 text-center">No image</p>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-gray-400">Account Name</p>
                                            <p className="font-bold text-gray-900 text-xs leading-tight">
                                                {form[previewMethod].account_name || <span className="text-gray-300 italic">Not set</span>}
                                            </p>
                                            <span className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${previewProvider.badgeColor}`}>
                                                {previewProvider.label} Payment
                                            </span>
                                        </div>

                                        <p className="text-center text-[10px] text-gray-500 mt-2">
                                            Total: <span className="font-bold text-brand-orange">₱350</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-center text-[10px] text-gray-400 mt-2">
                                Reflects your edits instantly before saving.
                            </p>
                        </Card>

                        {/* Saved QR Templates */}
                        <Card className="p-4 border-none shadow-md">
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold text-gray-800">Saved QR Templates</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Click Restore to load a saved QR back into the editor.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {PROVIDERS.map(p => {
                                    const saved = savedData[p.id];
                                    const isActive = activeTab === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                                                isActive ? 'border-brand-green bg-green-50/40' : 'border-gray-200 bg-gray-50'
                                            }`}
                                        >
                                            {/* QR thumbnail */}
                                            <div className={`w-20 aspect-square rounded-lg overflow-hidden ${p.bgColor} border border-gray-200`}>
                                                {saved?.image_url ? (
                                                    <img
                                                        src={saved.image_url}
                                                        alt={`${p.label} saved`}
                                                        className="w-full h-full object-contain"
                                                        onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/200x200?text=${p.label}`; }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <p className="text-[9px] text-gray-400">None</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Label + name */}
                                            <div className="text-center w-full min-w-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${p.badgeColor}`}>{p.label}</span>
                                                <p className="text-xs font-medium text-gray-700 truncate mt-0.5">
                                                    {saved?.account_name || <span className="text-gray-300 italic">—</span>}
                                                </p>
                                            </div>

                                            {/* Restore button */}
                                            <button
                                                onClick={() => {
                                                    if (!saved) return;
                                                    setActiveTab(p.id);
                                                    patch(p.id, { image_url: saved.image_url, account_name: saved.account_name, file: null, localPreview: null });
                                                    setFileErr(prev => ({ ...prev, [p.id]: null }));
                                                }}
                                                disabled={!saved}
                                                className="w-full text-[10px] font-semibold py-1 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green-dark hover:bg-green-50"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                    </div>
                </div>
            )}
        </div>
    );
}
