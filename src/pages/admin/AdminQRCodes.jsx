import { AlertCircle, Check, CreditCard, Eye, EyeOff, Loader, Plus, RefreshCw, Save, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '../../components/ui';
import {
    createQrOptionId,
    getQrCodes,
    MAX_QR_FILE_SIZE_MB,
    updateQrCode,
    uploadQrImage
} from '../../services/qrCodes';

const emptyNewOption = {
    label: '',
    account_name: '',
    image_url: '',
    file: null,
    localPreview: null,
};

function toForm(option) {
    return {
        label: option.label || '',
        account_name: option.account_name || '',
        image_url: option.image_url || '',
        is_active: option.is_active !== false,
        sort_order: Number(option.sort_order) || 0,
        file: null,
        localPreview: null,
    };
}

function getDisplayImage(formItem) {
    return formItem?.localPreview || formItem?.image_url || null;
}

export function AdminQRCodes() {
    const [activeId, setActiveId] = useState('');
    const [previewId, setPreviewId] = useState('');
    const [pageLoading, setPageLoading] = useState(true);
    const [options, setOptions] = useState([]);
    const [form, setForm] = useState({});
    const [savedData, setSavedData] = useState({});
    const [saving, setSaving] = useState({});
    const [saved, setSaved] = useState({});
    const [saveErr, setSaveErr] = useState({});
    const [fileErr, setFileErr] = useState({});
    const [newOption, setNewOption] = useState(emptyNewOption);
    const [adding, setAdding] = useState(false);
    const [addErr, setAddErr] = useState(null);
    const [addFileErr, setAddFileErr] = useState(null);
    const newFileRef = useRef(null);

    const activeOptions = useMemo(
        () => options.filter(option => form[option.id]?.is_active !== false),
        [options, form]
    );
    const activeOption = options.find(option => option.id === activeId) || options[0] || null;
    const previewOption = activeOptions.find(option => option.id === previewId) || activeOptions[0] || null;
    const activeForm = activeOption ? form[activeOption.id] : null;
    const previewForm = previewOption ? form[previewOption.id] : null;

    useEffect(() => { loadQrCodes(); }, []);

    useEffect(() => {
        if (options.length === 0) return;
        if (!activeId || !options.some(option => option.id === activeId)) {
            setActiveId(options[0].id);
        }
    }, [activeId, options]);

    useEffect(() => {
        if (activeOptions.length === 0) {
            setPreviewId('');
            return;
        }
        if (!previewId || !activeOptions.some(option => option.id === previewId)) {
            setPreviewId(activeOptions[0].id);
        }
    }, [activeOptions, previewId]);

    const loadQrCodes = async () => {
        setPageLoading(true);
        try {
            const data = await getQrCodes();
            const nextForm = {};
            const nextSaved = {};

            data.forEach(option => {
                nextForm[option.id] = toForm(option);
                nextSaved[option.id] = { ...option };
            });

            setOptions(data);
            setForm(nextForm);
            setSavedData(nextSaved);
            setSaveErr({});
            setFileErr({});
            if (data.length > 0) {
                setActiveId(data[0].id);
                setPreviewId(data.find(option => option.is_active !== false)?.id || '');
            }
        } catch (err) {
            console.error('Failed to load QR codes:', err);
        } finally {
            setPageLoading(false);
        }
    };

    const patch = (id, updates) =>
        setForm(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));

    const handleFileSelect = (id, e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (file.size > MAX_QR_FILE_SIZE_MB * 1024 * 1024) {
            setFileErr(prev => ({ ...prev, [id]: `File exceeds the ${MAX_QR_FILE_SIZE_MB} MB limit. Please choose a smaller image.` }));
            return;
        }

        setFileErr(prev => ({ ...prev, [id]: null }));
        const reader = new FileReader();
        reader.onloadend = () => patch(id, { file, localPreview: reader.result });
        reader.readAsDataURL(file);
    };

    const handleNewFileSelect = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (file.size > MAX_QR_FILE_SIZE_MB * 1024 * 1024) {
            setAddFileErr(`File exceeds the ${MAX_QR_FILE_SIZE_MB} MB limit. Please choose a smaller image.`);
            return;
        }

        setAddFileErr(null);
        const reader = new FileReader();
        reader.onloadend = () => setNewOption(prev => ({ ...prev, file, localPreview: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleSave = async (id) => {
        const current = form[id];
        if (!current?.label?.trim()) {
            setSaveErr(prev => ({ ...prev, [id]: 'Payment option name is required.' }));
            return;
        }

        setSaving(prev => ({ ...prev, [id]: true }));
        setSaveErr(prev => ({ ...prev, [id]: null }));

        try {
            let image_url = current.image_url;
            if (current.file) {
                image_url = await uploadQrImage(id, current.file);
            }

            const payload = {
                label: current.label,
                image_url,
                account_name: current.account_name,
                is_active: current.is_active,
                sort_order: current.sort_order,
            };

            await updateQrCode(id, payload);
            const savedOption = { id, ...payload };

            patch(id, { image_url, file: null, localPreview: null });
            setSavedData(prev => ({ ...prev, [id]: savedOption }));
            setOptions(prev => prev.map(option => option.id === id ? savedOption : option)
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
            setSaved(prev => ({ ...prev, [id]: true }));
            setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 3000);
        } catch (err) {
            setSaveErr(prev => ({ ...prev, [id]: err.message }));
        } finally {
            setSaving(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleAdd = async () => {
        const label = newOption.label.trim();
        if (!label) {
            setAddErr('Payment option name is required.');
            return;
        }

        setAdding(true);
        setAddErr(null);

        try {
            const id = createQrOptionId(label);
            let image_url = newOption.image_url;
            if (newOption.file) {
                image_url = await uploadQrImage(id, newOption.file);
            }

            const nextOrder = options.length > 0
                ? Math.max(...options.map(option => Number(option.sort_order) || 0)) + 10
                : 10;
            const payload = {
                label,
                image_url,
                account_name: newOption.account_name,
                is_active: true,
                sort_order: nextOrder,
            };

            await updateQrCode(id, payload);
            const created = { id, ...payload };
            setOptions(prev => [...prev, created].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
            setForm(prev => ({ ...prev, [id]: toForm(created) }));
            setSavedData(prev => ({ ...prev, [id]: created }));
            setActiveId(id);
            setPreviewId(id);
            setNewOption(emptyNewOption);
            setAddFileErr(null);
        } catch (err) {
            setAddErr(err.message);
        } finally {
            setAdding(false);
        }
    };

    const restoreSaved = (id) => {
        const savedOption = savedData[id];
        if (!savedOption) return;
        setActiveId(id);
        setForm(prev => ({ ...prev, [id]: toForm(savedOption) }));
        setFileErr(prev => ({ ...prev, [id]: null }));
        setSaveErr(prev => ({ ...prev, [id]: null }));
    };

    return (
        <div className="space-y-8 w-full max-w-full overflow-x-hidden">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold font-display text-brand-green-dark">QR Code Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Add, edit, and hide payment QR options shown in the booking modal.</p>
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
                        <p className="text-sm">Loading QR codes...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                        <Card className="p-6 border-none shadow-md space-y-5">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold text-gray-800">Payment Options</h2>
                                <span className="text-xs text-gray-500">{activeOptions.length} visible</span>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {options.map(option => (
                                    <button
                                        key={option.id}
                                        onClick={() => setActiveId(option.id)}
                                        className={`shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            activeId === option.id
                                                ? 'bg-white shadow-sm text-gray-900 ring-1 ring-brand-green'
                                                : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {form[option.id]?.is_active === false ? <EyeOff size={14} /> : <Eye size={14} />}
                                        {form[option.id]?.label || option.label}
                                    </button>
                                ))}
                            </div>

                            {activeOption && activeForm ? (
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">QR Image</p>
                                        <div className="relative mx-auto w-52 aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
                                            {getDisplayImage(activeForm) ? (
                                                <img
                                                    src={getDisplayImage(activeForm)}
                                                    alt={`${activeForm.label || activeOption.label} QR`}
                                                    className="w-full h-full object-contain"
                                                    onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/400x400?text=${encodeURIComponent(activeForm.label || 'Payment')}+QR`; }}
                                                />
                                            ) : (
                                                <p className="text-xs text-gray-400 text-center px-4">No image set</p>
                                            )}
                                            {activeForm.localPreview && (
                                                <span className="absolute top-2 right-2 bg-brand-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <input
                                            id={`qr-file-${activeOption.id}`}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => handleFileSelect(activeOption.id, e)}
                                        />
                                        <label
                                            htmlFor={`qr-file-${activeOption.id}`}
                                            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed transition-all text-sm font-medium ${
                                                saving[activeOption.id]
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : 'cursor-pointer'
                                            } ${
                                                fileErr[activeOption.id]
                                                    ? 'border-red-300 text-red-500 bg-red-50'
                                                    : activeForm.localPreview
                                                        ? 'border-brand-green text-brand-green-dark bg-green-50/60'
                                                        : 'border-gray-300 text-gray-500 hover:border-brand-green hover:text-brand-green-dark hover:bg-green-50/40'
                                            }`}
                                        >
                                            <Upload size={16} />
                                            {activeForm.localPreview ? 'Change Image' : 'Upload New QR Image'}
                                        </label>
                                        {fileErr[activeOption.id] ? (
                                            <p className="text-xs text-red-500 mt-1 text-center">{fileErr[activeOption.id]}</p>
                                        ) : activeForm.file ? (
                                            <p className="text-xs text-gray-400 mt-1 text-center truncate">
                                                {activeForm.file.name} ({(activeForm.file.size / 1024).toFixed(0)} KB) - will be compressed on save
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-1 text-center">Max {MAX_QR_FILE_SIZE_MB} MB. Compressed automatically on save.</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Name</label>
                                            <input
                                                type="text"
                                                value={activeForm.label}
                                                onChange={e => patch(activeOption.id, { label: e.target.value })}
                                                placeholder="e.g. GCash"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                            <input
                                                type="text"
                                                value={activeForm.account_name}
                                                onChange={e => patch(activeOption.id, { account_name: e.target.value })}
                                                placeholder="e.g. Juan Dela Cruz"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Or paste image URL</label>
                                        <input
                                            type="url"
                                            value={activeForm.image_url}
                                            onChange={e => patch(activeOption.id, { image_url: e.target.value, file: null, localPreview: null })}
                                            placeholder="https://..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Uploading a file above overrides this URL.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                                            <span>
                                                <span className="block text-sm font-medium text-gray-700">Visible to customers</span>
                                                <span className="block text-xs text-gray-400">Turn off to hide without deleting.</span>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={activeForm.is_active}
                                                onChange={e => patch(activeOption.id, { is_active: e.target.checked })}
                                                className="h-5 w-5 accent-brand-green"
                                            />
                                        </label>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                                            <input
                                                type="number"
                                                value={activeForm.sort_order}
                                                onChange={e => patch(activeOption.id, { sort_order: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {saveErr[activeOption.id] && (
                                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-red-700">{saveErr[activeOption.id]}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Button
                                            className="w-full text-white"
                                            onClick={() => handleSave(activeOption.id)}
                                            disabled={saving[activeOption.id] || !!fileErr[activeOption.id]}
                                        >
                                            {saving[activeOption.id] ? (
                                                <><Loader size={16} className="animate-spin" /> Saving...</>
                                            ) : saved[activeOption.id] ? (
                                                <><Check size={16} /> Saved!</>
                                            ) : (
                                                <><Save size={16} /> Save Option</>
                                            )}
                                        </Button>
                                        <button
                                            onClick={() => restoreSaved(activeOption.id)}
                                            disabled={!savedData[activeOption.id]}
                                            className="w-full text-sm font-semibold py-2.5 rounded-xl border transition-all disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green-dark hover:bg-green-50"
                                        >
                                            Restore Saved
                                        </button>
                                    </div>

                                    {saved[activeOption.id] && (
                                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl animate-in fade-in duration-300">
                                            <Check size={15} className="text-green-600 shrink-0" />
                                            <p className="text-xs text-green-700 font-medium">
                                                Payment option updated successfully.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-8">No payment options yet.</p>
                            )}
                        </Card>

                        <Card className="p-6 border-none shadow-md space-y-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-800">Add Payment Option</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Create another QR option for customers to choose.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    value={newOption.label}
                                    onChange={e => setNewOption(prev => ({ ...prev, label: e.target.value }))}
                                    placeholder="Payment name"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                />
                                <input
                                    type="text"
                                    value={newOption.account_name}
                                    onChange={e => setNewOption(prev => ({ ...prev, account_name: e.target.value }))}
                                    placeholder="Account name"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                                />
                            </div>

                            <input
                                type="url"
                                value={newOption.image_url}
                                onChange={e => setNewOption(prev => ({ ...prev, image_url: e.target.value, file: null, localPreview: null }))}
                                placeholder="Image URL, or upload a file below"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                            />

                            <input
                                ref={newFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleNewFileSelect}
                            />
                            <button
                                onClick={() => newFileRef.current?.click()}
                                disabled={adding}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                    addFileErr
                                        ? 'border-red-300 text-red-500 bg-red-50'
                                        : newOption.localPreview
                                            ? 'border-brand-green text-brand-green-dark bg-green-50/60'
                                            : 'border-gray-300 text-gray-500 hover:border-brand-green hover:text-brand-green-dark hover:bg-green-50/40'
                                }`}
                            >
                                <Upload size={16} />
                                {newOption.localPreview ? 'Change New QR Image' : 'Upload QR Image'}
                            </button>

                            {addFileErr && <p className="text-xs text-red-500 text-center">{addFileErr}</p>}
                            {newOption.file && !addFileErr && (
                                <p className="text-xs text-gray-400 text-center truncate">
                                    {newOption.file.name} ({(newOption.file.size / 1024).toFixed(0)} KB)
                                </p>
                            )}
                            {addErr && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700">{addErr}</p>
                                </div>
                            )}

                            <Button
                                className="w-full text-white"
                                onClick={handleAdd}
                                disabled={adding || !!addFileErr}
                            >
                                {adding ? <><Loader size={16} className="animate-spin" /> Adding...</> : <><Plus size={16} /> Add Payment Option</>}
                            </Button>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card className="p-4 border-none shadow-md">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-800">Live Preview</h2>
                                    <p className="text-xs text-gray-400">Only visible options appear here.</p>
                                </div>
                                <span className="text-xs font-medium text-brand-green-dark bg-brand-green-light px-2 py-0.5 rounded-full">
                                    Step 3 - Payment
                                </span>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full ${i <= 3 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-brand-green-light text-brand-green-dark flex items-center justify-center shrink-0">
                                            <CreditCard size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-brand-green-dark text-xs leading-tight">Payment</p>
                                            <p className="text-[10px] text-gray-400">Scan to pay with your selected method</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3">
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                        <p className="text-[10px] font-medium text-center text-gray-600 mb-2">Scan QR Code to Pay</p>

                                        {activeOptions.length > 0 ? (
                                            <>
                                                <div
                                                    className="grid gap-1 mb-2 p-0.5 bg-gray-200/50 rounded-lg"
                                                    style={{ gridTemplateColumns: `repeat(${Math.min(activeOptions.length, 3)}, minmax(0, 1fr))` }}
                                                >
                                                    {activeOptions.map(option => (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => setPreviewId(option.id)}
                                                            className={`py-1 px-2 rounded-md text-[10px] font-medium transition-all truncate ${
                                                                previewOption?.id === option.id
                                                                    ? 'bg-white text-brand-green-dark shadow-sm'
                                                                    : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                        >
                                                            {form[option.id]?.label || option.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                                                    <div className="w-32 aspect-square rounded-md overflow-hidden mb-2 bg-gray-50">
                                                        {getDisplayImage(previewForm) ? (
                                                            <img
                                                                src={getDisplayImage(previewForm)}
                                                                alt={`${previewForm?.label || previewOption.label} QR preview`}
                                                                className="w-full h-full object-contain"
                                                                onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/400x400?text=${encodeURIComponent(previewForm?.label || 'Payment')}+QR`; }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <p className="text-[9px] text-gray-400 text-center">No image</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-gray-400">Account Name</p>
                                                    <p className="font-bold text-gray-900 text-xs leading-tight text-center">
                                                        {previewForm?.account_name || <span className="text-gray-300 italic">Not set</span>}
                                                    </p>
                                                    <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5 text-brand-green-dark">
                                                        {previewForm?.label || previewOption.label} Payment
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-center text-[10px] text-gray-400 py-8">No visible payment options.</p>
                                        )}

                                        <p className="text-center text-[10px] text-gray-500 mt-2">
                                            Total: <span className="font-bold text-brand-orange">PHP 350</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4 border-none shadow-md">
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold text-gray-800">Saved QR Options</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Hidden options stay saved and editable.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {options.map(option => {
                                    const savedOption = savedData[option.id];
                                    const isActive = activeId === option.id;
                                    return (
                                        <div
                                            key={option.id}
                                            className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                                                isActive ? 'border-brand-green bg-green-50/40' : 'border-gray-200 bg-gray-50'
                                            }`}
                                        >
                                            <div className="w-20 aspect-square rounded-lg overflow-hidden bg-white border border-gray-200">
                                                {savedOption?.image_url ? (
                                                    <img
                                                        src={savedOption.image_url}
                                                        alt={`${savedOption.label} saved`}
                                                        className="w-full h-full object-contain"
                                                        onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/200x200?text=${encodeURIComponent(savedOption.label || 'QR')}`; }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <p className="text-[9px] text-gray-400">None</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-center w-full min-w-0">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-green-dark">
                                                    {savedOption?.label || option.label}
                                                </span>
                                                <p className="text-xs font-medium text-gray-700 truncate mt-0.5">
                                                    {savedOption?.account_name || <span className="text-gray-300 italic">-</span>}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {savedOption?.is_active === false ? 'Hidden' : 'Visible'}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => restoreSaved(option.id)}
                                                disabled={!savedOption}
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
