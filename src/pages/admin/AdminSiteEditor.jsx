import { GripVertical, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { AMENITY_ICONS, getSiteContent, updateSiteContent, uploadSiteImage } from '../../services/siteContent';

function updateAtPath(source, path, value) {
    const next = structuredClone(source);
    let current = next;
    path.slice(0, -1).forEach((key) => {
        current[key] = current[key] || {};
        current = current[key];
    });
    current[path[path.length - 1]] = value;
    return next;
}

function moveItem(items, fromIndex, toIndex) {
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

function TextField({ label, value, onChange, placeholder = '', type = 'text' }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            <input
                type={type}
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green"
            />
        </label>
    );
}

function TextArea({ label, value, onChange, rows = 3, placeholder = '' }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            <textarea
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green"
            />
        </label>
    );
}

function Panel({ title, children }) {
    return (
        <Card className="p-5 space-y-4">
            <h2 className="text-lg font-display font-bold text-brand-green-dark">{title}</h2>
            {children}
        </Card>
    );
}

export function AdminSiteEditor() {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingKey, setUploadingKey] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [draggedSection, setDraggedSection] = useState(null);
    const [draggedOffer, setDraggedOffer] = useState(null);

    useEffect(() => {
        getSiteContent({ force: true })
            .then(setContent)
            .catch((err) => setError(err.message || 'Failed to load website content.'))
            .finally(() => setLoading(false));
    }, []);

    const setPath = (path, value) => {
        setContent((prev) => updateAtPath(prev, path, value));
        setSuccess('');
    };

    const handleImageUpload = async (file, path, key) => {
        if (!file) return;
        setUploadingKey(key);
        setError('');
        try {
            const uploaded = await uploadSiteImage(file);
            setPath(path, uploaded.url);
        } catch (err) {
            setError(err.message || 'Failed to upload image.');
        } finally {
            setUploadingKey('');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const saved = await updateSiteContent(content);
            setContent(saved);
            setSuccess('Website content saved.');
        } catch (err) {
            setError(err.message || 'Failed to save website content.');
        } finally {
            setSaving(false);
        }
    };

    const toggleSection = (sectionId) => {
        setContent((prev) => ({
            ...prev,
            sections: prev.sections.map((section) => (
                section.id === sectionId ? { ...section, enabled: section.enabled === false } : section
            )),
        }));
        setSuccess('');
    };

    const dropSection = (targetId) => {
        if (!draggedSection || draggedSection === targetId) return;
        const fromIndex = content.sections.findIndex((section) => section.id === draggedSection);
        const toIndex = content.sections.findIndex((section) => section.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;
        setContent((prev) => ({ ...prev, sections: moveItem(prev.sections, fromIndex, toIndex) }));
        setDraggedSection(null);
        setSuccess('');
    };

    const dropOffer = (targetIndex) => {
        if (draggedOffer === null || draggedOffer === targetIndex) return;
        setContent((prev) => ({
            ...prev,
            offers: {
                ...prev.offers,
                items: moveItem(prev.offers.items || [], draggedOffer, targetIndex),
            },
        }));
        setDraggedOffer(null);
        setSuccess('');
    };

    const updateOffer = (index, field, value) => {
        setContent((prev) => {
            const items = [...(prev.offers.items || [])];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, offers: { ...prev.offers, items } };
        });
        setSuccess('');
    };

    const addOffer = () => {
        setContent((prev) => ({
            ...prev,
            offers: {
                ...prev.offers,
                items: [...(prev.offers.items || []), { id: `offer-${Date.now()}`, title: 'New Amenity', icon: 'Car' }],
            },
        }));
    };

    const removeOffer = (index) => {
        setContent((prev) => ({
            ...prev,
            offers: {
                ...prev.offers,
                items: prev.offers.items.filter((_, itemIndex) => itemIndex !== index),
            },
        }));
    };

    const updateSlide = (index, field, value) => {
        setContent((prev) => {
            const slides = [...(prev.hero.slides || [])];
            slides[index] = { ...slides[index], [field]: value };
            return { ...prev, hero: { ...prev.hero, slides } };
        });
        setSuccess('');
    };

    const addSlide = () => {
        setContent((prev) => ({
            ...prev,
            hero: {
                ...prev.hero,
                slides: [...(prev.hero.slides || []), { src: '/images/court1.jpg', title: 'New Slide', subtitle: '' }],
            },
        }));
    };

    const removeSlide = (index) => {
        setContent((prev) => ({
            ...prev,
            hero: {
                ...prev.hero,
                slides: prev.hero.slides.filter((_, slideIndex) => slideIndex !== index),
            },
        }));
    };

    const updatePhone = (index, value) => {
        setContent((prev) => {
            const phones = [...(prev.contact.phones || [])];
            phones[index] = value;
            return { ...prev, contact: { ...prev.contact, phones } };
        });
        setSuccess('');
    };

    const updateParking = (index, field, value) => {
        setContent((prev) => {
            const items = [...(prev.parking.items || [])];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, parking: { ...prev.parking, items } };
        });
        setSuccess('');
    };

    if (loading) {
        return <div className="text-gray-500">Loading website editor...</div>;
    }

    if (!content) {
        return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Website content could not be loaded.</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-display text-brand-green-dark">Website Editor</h1>
                    <p className="text-gray-500">Edit homepage content, images, section order, and amenities.</p>
                </div>
                <Button onClick={handleSave} disabled={saving || uploadingKey} className="text-white">
                    <Save size={18} /> {saving ? 'Saving...' : 'Save Website'}
                </Button>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Panel title="Homepage Sections">
                        <div className="space-y-2">
                            {content.sections.map((section) => (
                                <div
                                    key={section.id}
                                    draggable
                                    onDragStart={() => setDraggedSection(section.id)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => dropSection(section.id)}
                                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2"
                                >
                                    <GripVertical size={16} className="text-gray-400 cursor-move" />
                                    <span className="flex-1 text-sm font-medium">{section.label}</span>
                                    <label className="flex items-center gap-2 text-xs text-gray-500">
                                        <input
                                            type="checkbox"
                                            checked={section.enabled !== false}
                                            onChange={() => toggleSection(section.id)}
                                            className="h-4 w-4"
                                        />
                                        Show
                                    </label>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="Brand/Header">
                        <TextField label="Business Name" value={content.brand.name} onChange={(value) => setPath(['brand', 'name'], value)} />
                        <TextField label="Short Location" value={content.brand.shortLocation} onChange={(value) => setPath(['brand', 'shortLocation'], value)} />
                        <div>
                            <span className="block text-sm font-medium text-gray-700 mb-1">Logo</span>
                            {content.brand.logoUrl && <img src={content.brand.logoUrl} alt="Logo preview" className="mb-2 h-16 w-16 rounded-xl object-cover border border-gray-200" />}
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green-dark hover:bg-brand-green-light">
                                <ImagePlus size={16} />
                                {uploadingKey === 'logo' ? 'Uploading...' : 'Upload Logo'}
                                <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event.target.files?.[0], ['brand', 'logoUrl'], 'logo')} />
                            </label>
                        </div>
                    </Panel>
                </div>

                <div className="space-y-6">
                    <Panel title="Hero">
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextField label="Eyebrow" value={content.hero.eyebrow} onChange={(value) => setPath(['hero', 'eyebrow'], value)} />
                            <TextField label="Button Label" value={content.hero.primaryCta} onChange={(value) => setPath(['hero', 'primaryCta'], value)} />
                            <TextField label="Title Prefix" value={content.hero.titlePrefix} onChange={(value) => setPath(['hero', 'titlePrefix'], value)} />
                            <TextField label="Highlighted Title" value={content.hero.titleHighlight} onChange={(value) => setPath(['hero', 'titleHighlight'], value)} />
                        </div>
                        <TextArea label="Hero Description" value={content.hero.description} onChange={(value) => setPath(['hero', 'description'], value)} />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-700">Hero Images</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addSlide}><Plus size={15} /> Add Slide</Button>
                            </div>
                            {(content.hero.slides || []).map((slide, index) => (
                                <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3">
                                    {slide.src && <img src={slide.src} alt={slide.title || 'Slide'} className="h-32 w-full rounded-lg object-cover" />}
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <TextField label="Slide Title" value={slide.title} onChange={(value) => updateSlide(index, 'title', value)} />
                                        <TextField label="Slide Subtitle" value={slide.subtitle} onChange={(value) => updateSlide(index, 'subtitle', value)} />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green-dark hover:bg-brand-green-light">
                                            <ImagePlus size={16} />
                                            {uploadingKey === `slide-${index}` ? 'Uploading...' : 'Upload Image'}
                                            <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event.target.files?.[0], ['hero', 'slides', index, 'src'], `slide-${index}`)} />
                                        </label>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSlide(index)}><Trash2 size={15} /> Remove</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="Offers">
                        <TextField label="Section Title" value={content.offers.title} onChange={(value) => setPath(['offers', 'title'], value)} />
                        <TextArea label="Description" value={content.offers.description} onChange={(value) => setPath(['offers', 'description'], value)} />
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-700">Amenities</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addOffer}><Plus size={15} /> Add Amenity</Button>
                            </div>
                            {(content.offers.items || []).map((item, index) => (
                                <div
                                    key={item.id || index}
                                    draggable
                                    onDragStart={() => setDraggedOffer(index)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => dropOffer(index)}
                                    className="grid gap-3 rounded-xl border border-gray-200 p-3 md:grid-cols-[24px_minmax(0,1fr)_160px_40px] md:items-end"
                                >
                                    <GripVertical size={16} className="text-gray-400 cursor-move md:mb-3" />
                                    <TextField label="Amenity" value={item.title} onChange={(value) => updateOffer(index, 'title', value)} />
                                    <label className="block">
                                        <span className="block text-sm font-medium text-gray-700 mb-1">Icon</span>
                                        <select value={item.icon || 'Car'} onChange={(event) => updateOffer(index, 'icon', event.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-green">
                                            {AMENITY_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                                        </select>
                                    </label>
                                    <button type="button" onClick={() => removeOffer(index)} className="rounded-xl p-2 text-red-500 hover:bg-red-50 md:mb-1" aria-label="Remove amenity">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="Courts Section">
                        <TextField label="Section Title" value={content.courts.title} onChange={(value) => setPath(['courts', 'title'], value)} />
                        <TextArea label="Description" value={content.courts.description} onChange={(value) => setPath(['courts', 'description'], value)} />
                    </Panel>

                    <Panel title="Contact/Location">
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextField label="Section Title" value={content.contact.title} onChange={(value) => setPath(['contact', 'title'], value)} />
                            <TextField label="Email" value={content.contact.email} onChange={(value) => setPath(['contact', 'email'], value)} type="email" />
                            <TextField label="Location Name" value={content.contact.locationName} onChange={(value) => setPath(['contact', 'locationName'], value)} />
                            <TextField label="Operating Hours" value={content.contact.hoursTitle} onChange={(value) => setPath(['contact', 'hoursTitle'], value)} />
                        </div>
                        <TextArea label="Section Description" value={content.contact.description} onChange={(value) => setPath(['contact', 'description'], value)} />
                        <TextArea label="Address" value={content.contact.address} onChange={(value) => setPath(['contact', 'address'], value)} rows={2} />
                        <TextField label="Hours Note" value={content.contact.hoursNote} onChange={(value) => setPath(['contact', 'hoursNote'], value)} />
                        <TextField label="Google Map Embed URL" value={content.contact.mapEmbedUrl} onChange={(value) => setPath(['contact', 'mapEmbedUrl'], value)} />
                        <div className="grid gap-3 md:grid-cols-2">
                            {(content.contact.phones || ['']).map((phone, index) => (
                                <TextField key={index} label={`Phone ${index + 1}`} value={phone} onChange={(value) => updatePhone(index, value)} />
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPath(['contact', 'phones'], [...(content.contact.phones || []), ''])}><Plus size={15} /> Add Phone</Button>
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextField label="Facebook URL" value={content.contact.facebookUrl} onChange={(value) => setPath(['contact', 'facebookUrl'], value)} />
                            <TextField label="Instagram URL" value={content.contact.instagramUrl} onChange={(value) => setPath(['contact', 'instagramUrl'], value)} />
                        </div>
                        <TextArea label="Social Text" value={content.contact.socialText} onChange={(value) => setPath(['contact', 'socialText'], value)} rows={2} />
                    </Panel>

                    <Panel title="Parking">
                        <TextField label="Section Title" value={content.parking.title} onChange={(value) => setPath(['parking', 'title'], value)} />
                        <TextArea label="Description" value={content.parking.description} onChange={(value) => setPath(['parking', 'description'], value)} />
                        {(content.parking.items || []).map((item, index) => (
                            <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <TextField label="Time Label" value={item.timeLabel} onChange={(value) => updateParking(index, 'timeLabel', value)} />
                                    <TextField label="Parking Name" value={item.title} onChange={(value) => updateParking(index, 'title', value)} />
                                </div>
                                <TextArea label="Parking Description" value={item.description} onChange={(value) => updateParking(index, 'description', value)} rows={2} />
                                <TextField label="Map Embed URL" value={item.mapEmbedUrl} onChange={(value) => updateParking(index, 'mapEmbedUrl', value)} />
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => setPath(['parking', 'items'], [...(content.parking.items || []), { timeLabel: 'Parking', title: 'Parking Area', description: '', mapEmbedUrl: '' }])}><Plus size={15} /> Add Parking Option</Button>
                    </Panel>

                    <Panel title="Footer">
                        <TextField label="Copyright" value={content.footer.copyright} onChange={(value) => setPath(['footer', 'copyright'], value)} />
                    </Panel>
                </div>
            </div>
        </div>
    );
}
