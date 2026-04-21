import { Plus, Trash2, Edit2, Power, AlertCircle, X, Pin, GripVertical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { createCourt, listCourts, subscribeToCourts, updateCourt, toggleCourtStatus, updateCourtOrder } from '../../services/courts';
import { moveCourtId, orderCourtsForHomepage } from '../../lib/courtDisplayOrder';

const COURT_TYPE_OPTIONS = ['Outdoor Hard', 'Exclusive / Whole Court'];
const CUSTOM_TYPE_VALUE = '__custom__';

function getCourtTypeFormState(type = 'Outdoor Hard') {
    const normalizedType = (type || '').trim();

    if (!normalizedType || COURT_TYPE_OPTIONS.includes(normalizedType)) {
        return {
            type: normalizedType || 'Outdoor Hard',
            typeSelection: normalizedType || 'Outdoor Hard',
            customType: ''
        };
    }

    return {
        type: normalizedType,
        typeSelection: CUSTOM_TYPE_VALUE,
        customType: normalizedType
    };
}

export function AdminCourts() {
    const queryClient = useQueryClient();
    const [courts, setCourts] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingCourtId, setEditingCourtId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [imagePreview, setImagePreview] = useState([]);
    const defaultTypeState = getCourtTypeFormState();
    const [formData, setFormData] = useState({
        name: '',
        type: defaultTypeState.type,
        price: 350,
        description: '',
        imageFiles: null,
        pricingRules: [], // Array of { startHour, endHour, price }
        maxPlayers: 10 // Default to 10 players
    });
    const [typeSelection, setTypeSelection] = useState(defaultTypeState.typeSelection);
    const [customType, setCustomType] = useState(defaultTypeState.customType);

    const [actionModal, setActionModal] = useState({
        isOpen: false,
        title: '',
        description: '',
        action: null,
        variant: 'primary',
        confirmLabel: 'Confirm',
        successTitle: 'Success!',
        successDescription: 'Action completed successfully.'
    });
    const [draggedCourtId, setDraggedCourtId] = useState(null);
    const [dragOverCourtId, setDragOverCourtId] = useState(null);
    const [isTouchDragging, setIsTouchDragging] = useState(false);

    const orderedCourts = orderCourtsForHomepage(courts);

    useEffect(() => {
        loadCourts();

        // Subscribe to real-time updates — patch local state directly instead of re-fetching
        const subscription = subscribeToCourts((payload) => {
            console.log('Court update received:', payload);
            const { eventType, new: newRecord, old: oldRecord } = payload;
            if (eventType === 'INSERT') {
                setCourts(prev => [newRecord, ...prev]);
            } else if (eventType === 'UPDATE') {
                setCourts(prev => prev.map(c => c.id === newRecord.id ? newRecord : c));
            } else if (eventType === 'DELETE') {
                setCourts(prev => prev.filter(c => c.id !== oldRecord.id));
            }
        });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const loadCourts = async ({ force = false } = {}) => {
        try {
            const data = await listCourts({ force });
            setCourts(data || []);
        } catch (err) {
            console.error('Error loading courts:', err);
            setError('Failed to load courts');
        }
    };

    const handleImageSelect = (e) => {
        const files = e.target.files;
        setFormData({ ...formData, imageFiles: files });

        // Show preview
        const previews = [];
        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previews.push(event.target.result);
                if (previews.length === files.length) {
                    setImagePreview(previews);
                }
            };
            reader.readAsDataURL(files[i]);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const resolvedType = (typeSelection === CUSTOM_TYPE_VALUE ? customType : typeSelection).trim();

            if (!resolvedType) {
                throw new Error('Please select or enter a court type');
            }

            if (isEditMode && editingCourtId) {
                // Update existing court
                await updateCourt(editingCourtId, {
                    name: formData.name,
                    type: resolvedType,
                    price: Number(formData.price),
                    description: formData.description,
                    imageFiles: formData.imageFiles || [],
                    pricingRules: formData.pricingRules || [],
                    maxPlayers: Number(formData.maxPlayers) || 10
                });
            } else {
                // Create new court
                await createCourt({
                    name: formData.name,
                    type: resolvedType,
                    price: Number(formData.price),
                    description: formData.description,
                    imageFiles: formData.imageFiles || [],
                    pricingRules: formData.pricingRules || [],
                    maxPlayers: Number(formData.maxPlayers) || 10
                });
            }

            await loadCourts({ force: true });
            queryClient.invalidateQueries(['courts']);
            resetForm();
        } catch (err) {
            console.error('Error saving court:', err);
            setError(err.message || 'Failed to save court');
        } finally {
            setLoading(false);
        }
    };

    const handleEditCourt = (court) => {
        const courtTypeState = getCourtTypeFormState(court.type);
        setIsEditMode(true);
        setEditingCourtId(court.id);
        setFormData({
            name: court.name,
            type: courtTypeState.type,
            price: court.price,
            description: court.description || '',
            imageFiles: null,
            pricingRules: court.pricing_rules || [],
            maxPlayers: court.max_players || 10
        });
        setTypeSelection(courtTypeState.typeSelection);
        setCustomType(courtTypeState.customType);
        setImagePreview((court.images && court.images.map(img => img.url)) || []);
        setIsFormOpen(true);
    };

    const handleTypeSelectionChange = (value) => {
        setTypeSelection(value);
        if (value !== CUSTOM_TYPE_VALUE) {
            setFormData(prev => ({ ...prev, type: value }));
        }
    };

    const handleCustomTypeChange = (value) => {
        setCustomType(value);
        setFormData(prev => ({ ...prev, type: value }));
    };

    const handleAddPricingRule = () => {
        setFormData({
            ...formData,
            pricingRules: [...(formData.pricingRules || []), { startHour: 6, endHour: 15, price: 450 }]
        });
    };

    const handleRemovePricingRule = (index) => {
        setFormData({
            ...formData,
            pricingRules: formData.pricingRules.filter((_, i) => i !== index)
        });
    };

    const handleUpdatePricingRule = (index, field, value) => {
        const updatedRules = [...formData.pricingRules];
        updatedRules[index] = { ...updatedRules[index], [field]: field === 'price' ? Number(value) : Number(value) };
        setFormData({
            ...formData,
            pricingRules: updatedRules
        });
    };

    const handleToggleStatus = (court) => {
        const currentStatus = court.is_active !== false; // Default to active
        const newStatus = !currentStatus;
        setActionModal({
            isOpen: true,
            title: newStatus ? 'Enable Court' : 'Disable Court',
            description: newStatus
                ? `Enable ${court.name}? It will be available for bookings.`
                : `Disable ${court.name}? It will not be available for new bookings.`,
            variant: newStatus ? 'primary' : 'warning',
            confirmLabel: newStatus ? 'Enable' : 'Disable',
            successTitle: newStatus ? 'Court Enabled' : 'Court Disabled',
            successDescription: `${court.name} has been ${newStatus ? 'enabled' : 'disabled'}.`,
            action: async () => {
                await toggleCourtStatus(court.id, newStatus);
                await loadCourts({ force: true });
                queryClient.invalidateQueries(['courts']);
            }
        });
    };

    const handleArchive = (court) => {
        setActionModal({
            isOpen: true,
            title: 'Archive Court',
            description: `Archive ${court.name} from the homepage? Booking records stay intact.`,
            variant: 'warning',
            confirmLabel: 'Archive Court',
            successTitle: 'Court Archived',
            successDescription: 'The court was hidden from the homepage while keeping all records.',
            action: async () => {
                await toggleCourtStatus(court.id, false);
                await loadCourts({ force: true });
                queryClient.invalidateQueries(['courts']);
            }
        });
    };

    const persistCourtOrder = async (ids) => {
        const byId = new Map(courts.map((court) => [String(court.id), court]));
        const nextCourts = ids.map((id, index) => ({
            ...byId.get(id),
            sort_order: (index + 1) * 10,
        })).filter(Boolean);

        setCourts(nextCourts);
        await updateCourtOrder(ids);
        await loadCourts({ force: true });
        queryClient.invalidateQueries(['courts']);
    };

    const handleSetFirst = async (court) => {
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const ids = orderedCourts.map(c => String(c.id)).filter((id) => id !== String(court.id));
            await persistCourtOrder([String(court.id), ...ids]);
        } catch (err) {
            setError(err.message || 'Failed to update court order');
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (courtId) => {
        setDraggedCourtId(String(courtId));
    };

    const handleDragOver = (event, courtId) => {
        event.preventDefault();
        const targetId = String(courtId);
        if (draggedCourtId && draggedCourtId !== targetId) {
            setDragOverCourtId(targetId);
        }
    };

    const handleDrop = async (targetCourtId) => {
        const nextIds = moveCourtId(
            orderedCourts.map(c => c.id),
            draggedCourtId,
            targetCourtId
        );

        if (nextIds.join('|') === orderedCourts.map(c => String(c.id)).join('|')) {
            setDraggedCourtId(null);
            setDragOverCourtId(null);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await persistCourtOrder(nextIds);
        } catch (err) {
            setError(err.message || 'Failed to update court order');
        } finally {
            setLoading(false);
            setDraggedCourtId(null);
            setDragOverCourtId(null);
        }
    };

    const handleDragEnd = () => {
        setDraggedCourtId(null);
        setDragOverCourtId(null);
    };

    const handleTouchStart = (courtId) => {
        setDraggedCourtId(String(courtId));
        setDragOverCourtId(String(courtId));
        setIsTouchDragging(true);
    };

    const handleTouchMove = (event) => {
        if (!isTouchDragging || !draggedCourtId) return;
        const touch = event.touches?.[0];
        if (!touch) return;

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const card = target?.closest?.('[data-court-id]');
        const targetId = card?.getAttribute?.('data-court-id');

        if (targetId && targetId !== draggedCourtId) {
            setDragOverCourtId(targetId);
        }
    };

    const handleTouchEnd = async () => {
        if (!isTouchDragging) return;

        const nextIds = moveCourtId(
            orderedCourts.map(c => c.id),
            draggedCourtId,
            dragOverCourtId
        );

        if (nextIds.join('|') === orderedCourts.map(c => String(c.id)).join('|')) {
            setDraggedCourtId(null);
            setDragOverCourtId(null);
            setIsTouchDragging(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await persistCourtOrder(nextIds);
        } catch (err) {
            setError(err.message || 'Failed to update court order');
        } finally {
            setLoading(false);
            setDraggedCourtId(null);
            setDragOverCourtId(null);
            setIsTouchDragging(false);
        }
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setIsEditMode(false);
        setEditingCourtId(null);
        const nextTypeState = getCourtTypeFormState();
        setFormData({
            name: '',
            type: nextTypeState.type,
            price: 350,
            description: '',
            imageFiles: null,
            pricingRules: [],
            maxPlayers: 10
        });
        setTypeSelection(nextTypeState.typeSelection);
        setCustomType(nextTypeState.customType);
        setImagePreview([]);
        setError('');
    };

    return (
        <div className="space-y-6 w-full max-w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-display text-brand-green-dark">Court Management</h1>
                    <p className="text-gray-500">Add, edit, archive, and control homepage order of courts</p>
                    <p className="text-xs text-gray-400 mt-1">Desktop: drag cards. Mobile/tablet: touch and drag cards. Pin sets first.</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} disabled={loading} className="text-white">
                    <Plus size={18} className="mr-2" /> Add Court
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-8">
                        <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit Court' : 'Add New Court'}</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Court Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                    placeholder="e.g. Court 3 (Indoor)"
                                    disabled={loading}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <div className="space-y-2">
                                        <select
                                            value={typeSelection}
                                            onChange={e => handleTypeSelectionChange(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                            disabled={loading}
                                        >
                                            {COURT_TYPE_OPTIONS.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                            <option value={CUSTOM_TYPE_VALUE}>Custom Type</option>
                                        </select>

                                        {typeSelection === CUSTOM_TYPE_VALUE && (
                                            <input
                                                required
                                                type="text"
                                                value={customType}
                                                onChange={e => handleCustomTypeChange(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                                placeholder="Enter custom court type"
                                                disabled={loading}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱/hr)</label>
                                    <input
                                        required
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={formData.maxPlayers}
                                    onChange={e => setFormData({ ...formData, maxPlayers: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                    placeholder="e.g. 10"
                                    disabled={loading}
                                />
                                <p className="text-xs text-gray-500 mt-1">Maximum number of players this court can accommodate</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green outline-none"
                                    rows="3"
                                    disabled={loading}
                                    placeholder="Describe the court features, amenities, etc."
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Court Images</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageSelect}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-green file:text-white hover:file:bg-brand-green-dark disabled:opacity-50"
                                    disabled={loading}
                                />
                                <p className="text-xs text-gray-500 mt-1">You can upload multiple images</p>
                                <p className="text-xs text-gray-500 mt-1">Limit: up to 5 images, 8MB each. Images are compressed before upload.</p>
                            </div>

                            {imagePreview.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {imagePreview.map((preview, idx) => (
                                        <div key={idx} className="relative aspect-square">
                                            <img src={preview} alt={`Preview ${idx}`} className="w-full h-full object-cover rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pricing Rules */}
                            <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-semibold text-gray-700">Time-Based Pricing (Optional)</label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAddPricingRule}
                                        disabled={loading}
                                    >
                                        <Plus size={16} className="mr-1" /> Add Rate
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Set different prices for different hours (e.g., 6am-3pm: ₱450, 4pm-6am: ₱600)</p>

                                {formData.pricingRules && formData.pricingRules.length > 0 ? (
                                    <div className="space-y-3 max-h-48 overflow-y-auto">
                                        {formData.pricingRules.map((rule, index) => {
                                            return (
                                                <div key={index} className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex-1">
                                                        <label className="text-xs font-medium text-gray-600">Start Hour</label>
                                                        <select
                                                            value={rule.startHour}
                                                            onChange={(e) => handleUpdatePricingRule(index, 'startHour', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-brand-green"
                                                            disabled={loading}
                                                        >
                                                            {Array.from({ length: 24 }, (_, i) => {
                                                                const period = i >= 12 ? 'PM' : 'AM';
                                                                const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
                                                                return <option key={i} value={i}>{displayHour.toString().padStart(2, '0')}:00 {period}</option>;
                                                            })}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs font-medium text-gray-600">End Hour</label>
                                                        <select
                                                            value={rule.endHour}
                                                            onChange={(e) => handleUpdatePricingRule(index, 'endHour', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-brand-green"
                                                            disabled={loading}
                                                        >
                                                            {Array.from({ length: 24 }, (_, i) => {
                                                                const period = i >= 12 ? 'PM' : 'AM';
                                                                const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
                                                                return <option key={i} value={i}>{displayHour.toString().padStart(2, '0')}:00 {period}</option>;
                                                            })}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs font-medium text-gray-600">Price (₱)</label>
                                                        <input
                                                            type="number"
                                                            value={rule.price}
                                                            onChange={(e) => handleUpdatePricingRule(index, 'price', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-brand-green"
                                                            disabled={loading}
                                                            min="1"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePricingRule(index)}
                                                        disabled={loading}
                                                        className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors disabled:opacity-50"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded text-center">No pricing rules set. Using default rate: ₱{formData.price}/hr</p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    type="button"
                                    className="flex-1"
                                    onClick={resetForm}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 text-white"
                                    disabled={loading}
                                >
                                    {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Court' : 'Create Court')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {courts.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">No courts added yet. Create your first court!</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orderedCourts.map((court, index) => {
                        const isActive = court.is_active !== false; // Default to active if not specified
                        const isDragOver = dragOverCourtId === String(court.id) && draggedCourtId !== String(court.id);
                        return (
                            <Card
                                key={court.id}
                                data-court-id={String(court.id)}
                                draggable={!loading}
                                onDragStart={() => handleDragStart(court.id)}
                                onDragOver={(event) => handleDragOver(event, court.id)}
                                onDrop={() => handleDrop(court.id)}
                                onDragEnd={handleDragEnd}
                                onTouchStart={() => handleTouchStart(court.id)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                className={`overflow-hidden group cursor-move ${!isActive ? 'opacity-60' : ''} ${isDragOver ? 'ring-2 ring-brand-green' : ''} ${isTouchDragging ? 'touch-none' : ''}`}
                            >
                                <div className="aspect-video relative overflow-hidden bg-gray-100">
                                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-white/85 text-gray-600 text-xs font-medium shadow-sm">
                                        <GripVertical size={14} /> Drag
                                    </div>
                                    <img
                                        src={(court.images && court.images[0]?.url) || '/images/court1.jpg'}
                                        alt={court.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {!isActive && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-2 text-white">
                                                <AlertCircle size={28} />
                                                <span className="font-semibold">Disabled</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <button
                                            onClick={() => handleSetFirst(court)}
                                            disabled={loading || index === 0}
                                            className="p-2 bg-white/90 hover:bg-amber-50 text-amber-600 rounded-full shadow-sm backdrop-blur-sm transition-colors disabled:opacity-40"
                                            title="Set as first on homepage"
                                        >
                                            <Pin size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEditCourt(court)}
                                            disabled={loading}
                                            className="p-2 bg-white/90 hover:bg-blue-50 text-blue-600 rounded-full shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50"
                                            title="Edit court"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(court)}
                                            disabled={loading}
                                            className={`p-2 rounded-full shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50 ${isActive
                                                ? 'bg-white/90 hover:bg-red-50 text-red-500'
                                                : 'bg-green-100/90 hover:bg-green-50 text-green-600'
                                                }`}
                                            title={isActive ? 'Disable court' : 'Enable court'}
                                        >
                                            <Power size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleArchive(court)}
                                            disabled={loading}
                                            className="p-2 bg-white/90 hover:bg-red-50 text-red-500 rounded-full shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50"
                                            title="Archive court"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{court.name}</h3>
                                            <p className="text-sm text-gray-500">{court.type}</p>
                                        </div>
                                        <span className="font-bold text-brand-orange">₱{court.price}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2">{court.description}</p>
                                    <p className="text-xs text-gray-400 mt-2">Homepage position: #{index + 1}</p>
                                    {court.images && court.images.length > 0 && (
                                        <p className="text-xs text-gray-400 mt-1">{court.images.length} image(s)</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Max {court.max_players || 10} players</p>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <AdminActionModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                title={actionModal.title}
                description={actionModal.description}
                action={actionModal.action}
                variant={actionModal.variant}
                confirmLabel={actionModal.confirmLabel}
                successTitle={actionModal.successTitle}
                successDescription={actionModal.successDescription}
            />
        </div>
    );
}
