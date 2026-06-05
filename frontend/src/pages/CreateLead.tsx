import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Save, ArrowLeft, X, Check, User, Phone, Mail, Clock, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { countryCodes } from "../utils/countryCodes";

interface Campaign {
    _id: string;
    name: string;
}

export default function CreateLead() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialCampaignId = searchParams.get("campaignId") || "";

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState("");

    const [formData, setFormData] = useState({
        campaign_id: initialCampaignId,
        name: "",
        type: "",
        category_group: "",
        department: "",
        main_contact_name: "",
        main_contact_email: "",
        telephone: "",
        telephone_extension: "",
        start_time: "",
        end_time: "",
        address_number: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        website: "",
        // Primary Contact Person
        contact_title: "",
        contact_department: "",
        contact_direct_phone: "",
        contact_extension: "",
        contact_email: "",
        contact_best_time: "",
        contact_preferred_method: "",
        // Secondary Contact
        secondary_contact_name: "",
        secondary_contact_title: "",
        secondary_contact_department: "",
        secondary_contact_phone: "",
        secondary_contact_extension: "",
        secondary_contact_email: "",
        // Prefixes
        contact_phone_prefix: "+1",
        secondary_phone_prefix: "+1",
        telephone_prefix: "+1",
    });
    const [customTitle, setCustomTitle] = useState("");
    const [secondaryCustomTitle, setSecondaryCustomTitle] = useState("");
    const [customLeadType, setCustomLeadType] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showSecondary, setShowSecondary] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleRadioChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        api.get("/campaigns")
            .then((r) => {
                setCampaigns(r.data);
            })
            .catch(() => toast.error("Failed to load campaigns"))
            .finally(() => setLoading(false));
    }, [initialCampaignId]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = "Organization / School name is required";
        if (!formData.campaign_id) newErrors.campaign_id = "Please select a target campaign";

        // Primary Contact Person Validation (ALL fields mandatory)
        if (!formData.main_contact_name.trim()) newErrors.main_contact_name = "Primary contact name is required";
        if (!formData.contact_title) {
            newErrors.contact_title = "Please select a title / role";
        } else if (formData.contact_title === "Other" && !customTitle.trim()) {
            newErrors.contact_title = "Please specify the custom title";
        }
        if (!formData.contact_department.trim()) newErrors.contact_department = "Department name is required";
        if (!formData.contact_direct_phone.trim()) newErrors.contact_direct_phone = "Direct phone number is required";

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.contact_email.trim()) {
            newErrors.contact_email = "Primary contact email is required";
        } else if (!emailRegex.test(formData.contact_email)) {
            newErrors.contact_email = "Please enter a valid email address";
        }

        if (formData.main_contact_email && !emailRegex.test(formData.main_contact_email)) {
            newErrors.main_contact_email = "Invalid email format";
        }

        if (!formData.contact_best_time) newErrors.contact_best_time = "Please select the best time to call";
        if (!formData.contact_preferred_method) newErrors.contact_preferred_method = "Please select a preferred contact method";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) {
            toast.error("Campaign name cannot be empty.");
            return;
        }
        try {
            const res = await api.post("/campaigns", { name: newCampaignName });
            setCampaigns([...campaigns, res.data]);
            setFormData({ ...formData, campaign_id: String(res.data._id) });
            setIsCreatingCampaign(false);
            setNewCampaignName("");
            toast.success("Campaign created successfully!");
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to create campaign.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validate()) {
            toast.error("Please fill in all required fields marked with *");
            return;
        }

        setIsSubmitting(true);
        try {
            const finalTitle = formData.contact_title === "Other" ? customTitle.trim() : formData.contact_title;
            const finalSecondaryTitle = formData.secondary_contact_title === "Other" ? secondaryCustomTitle.trim() : formData.secondary_contact_title;
            const finalLeadType = formData.type === "Other" ? customLeadType.trim() : formData.type;

            const payload = {
                ...formData,
                type: finalLeadType,
                contact_title: finalTitle,
                secondary_contact_title: finalSecondaryTitle,
                contact_direct_phone: formData.contact_phone_prefix + formData.contact_direct_phone.replace(/\D/g, ''),
                secondary_contact_phone: formData.secondary_contact_phone ? (formData.secondary_phone_prefix + formData.secondary_contact_phone.replace(/\D/g, '')) : "",
                telephone: formData.telephone ? (formData.telephone_prefix + formData.telephone.replace(/\D/g, '')) : ""
            };
            const res = await api.post("/leads", payload);
            toast.success("Lead created successfully!");
            navigate("/lead/" + res.data._id);
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to create lead.");
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    if (loading) return <AppLayout><div className="p-12 text-center animate-pulse">Loading...</div></AppLayout>;

    return (
        <AppLayout>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft size={16} /> Back
            </button>

            <div className="max-w-4xl mx-auto pb-12">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Add New Lead</h1>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`btn-primary flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Save size={16} /> {isSubmitting ? "Saving..." : "Save Lead"}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Campaign Selection - Smart Dropdown */}
                    <div className="page-card">
                        <h2 className="font-semibold text-foreground mb-4">Target Campaign *</h2>
                        {isCreatingCampaign ? (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="input-field flex-grow"
                                    placeholder="Enter new campaign name..."
                                    value={newCampaignName}
                                    onChange={e => setNewCampaignName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCampaign())}
                                />
                                <button type="button" onClick={handleCreateCampaign} className="p-2 bg-primary rounded-xl hover:bg-primary/90 transition-colors">
                                    <Check size={20} />
                                </button>
                                <button type="button" onClick={() => setIsCreatingCampaign(false)} className="p-2 bg-accent rounded-xl hover:bg-accent/80 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <select
                                    name="campaign_id"
                                    className={`input-field ${errors.campaign_id ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    value={formData.campaign_id}
                                    onChange={(e) => {
                                        if (e.target.value === "new") {
                                            setIsCreatingCampaign(true);
                                        } else {
                                            handleChange(e);
                                        }
                                    }}
                                >
                                    <option value="">-- Select a campaign --</option>
                                    {campaigns.map((c) => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                    <option value="new" className="font-bold text-primary">+ Create New Campaign</option>
                                </select>
                                {errors.campaign_id && <p className="text-xs text-destructive mt-1">{errors.campaign_id}</p>}
                            </div>
                        )}
                    </div>

                    {/* ── Primary Contact Person ───────────────────────────── */}
                    <div className="page-card space-y-5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                                <User size={16} className="text-primary" />
                            </div>
                            <h2 className="font-semibold text-foreground">Primary Contact Person</h2>
                            <span className="text-xs text-muted-foreground">(person being contacted)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Contact Name */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Contact Full Name *</label>
                                <input
                                    name="main_contact_name"
                                    className={`input-field ${errors.main_contact_name ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    placeholder="e.g. Davina Midgette"
                                    value={formData.main_contact_name}
                                    onChange={handleChange}
                                />
                                {errors.main_contact_name && <p className="text-xs text-destructive mt-1">{errors.main_contact_name}</p>}
                            </div>

                            {/* Title / Role */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Title / Role *</label>
                                <select
                                    name="contact_title"
                                    className={`input-field ${errors.contact_title ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    value={formData.contact_title}
                                    onChange={handleChange}
                                >
                                    <option value="">Select title...</option>
                                    <option>Principal</option>
                                    <option>Assistant Principal</option>
                                    <option>Athletic Director</option>
                                    <option>After-School Coordinator</option>
                                    <option>Front Office Administrator</option>
                                    <option>PTA/PTO Contact</option>
                                    <option>Other</option>
                                </select>
                                {errors.contact_title && <p className="text-xs text-destructive mt-1">{errors.contact_title}</p>}

                                {formData.contact_title === "Other" && (
                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <input
                                            className={`input-field ${errors.contact_title ? "border-destructive focus:ring-destructive/20" : ""}`}
                                            placeholder="Please specify title..."
                                            value={customTitle}
                                            onChange={(e) => setCustomTitle(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Department */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Department *
                                </label>
                                <input
                                    name="contact_department"
                                    className={`input-field ${errors.contact_department ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    placeholder="e.g. Administration"
                                    value={formData.contact_department}
                                    onChange={handleChange}
                                />
                                {errors.contact_department && <p className="text-xs text-destructive mt-1">{errors.contact_department}</p>}
                            </div>

                            {/* Direct Phone + Extension */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1">
                                    <Phone size={12} /> Direct Phone *
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative w-28 shrink-0">
                                        <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                                            {formData.contact_phone_prefix}
                                        </div>
                                        <select
                                            className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                                            style={{
                                                backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === formData.contact_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                                                backgroundPosition: 'left 0.5rem center'
                                            }}
                                            value={formData.contact_phone_prefix}
                                            onChange={(e) => setFormData({ ...formData, contact_phone_prefix: e.target.value })}
                                        >
                                            {countryCodes.map(c => (
                                                <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                                    {c.name} ({c.dialCode})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                            <ChevronDown size={12} />
                                        </div>
                                    </div>
                                    <input
                                        name="contact_direct_phone"
                                        className={`input-field flex-1 ${errors.contact_direct_phone ? "border-destructive focus:ring-destructive/20" : ""}`}
                                        placeholder="Phone"
                                        value={formData.contact_direct_phone}
                                        onChange={handleChange}
                                    />
                                    <input
                                        name="contact_extension"
                                        className="input-field w-20"
                                        placeholder="Ext."
                                        value={formData.contact_extension}
                                        onChange={handleChange}
                                    />
                                </div>
                                {errors.contact_direct_phone && <p className="text-xs text-destructive mt-1">{errors.contact_direct_phone}</p>}
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1">
                                    <Mail size={12} /> Email Address *
                                </label>
                                <input
                                    name="contact_email"
                                    type="email"
                                    className={`input-field ${errors.contact_email ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    placeholder="contact@school.edu"
                                    value={formData.contact_email}
                                    onChange={handleChange}
                                />
                                {errors.contact_email && <p className="text-xs text-destructive mt-1">{errors.contact_email}</p>}
                            </div>

                            {/* Best Time to Call */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1">
                                    <Clock size={12} /> Best Time to Call *
                                </label>
                                <select
                                    name="contact_best_time"
                                    className={`input-field ${errors.contact_best_time ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    value={formData.contact_best_time}
                                    onChange={handleChange}
                                >
                                    <option value="">Select time...</option>
                                    <option>Morning (8am–11am)</option>
                                    <option>Midday (11am–1pm)</option>
                                    <option>Afternoon (1pm–4pm)</option>
                                    <option>Late Afternoon (4pm–6pm)</option>
                                    <option>Anytime</option>
                                </select>
                                {errors.contact_best_time && <p className="text-xs text-destructive mt-1">{errors.contact_best_time}</p>}
                            </div>

                            {/* Preferred Contact Method */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                                    <MessageSquare size={12} /> Preferred Contact Method *
                                </label>
                                <div className="flex gap-5">
                                    {["Call", "Email", "Text"].map(method => (
                                        <label key={method} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                                            <input
                                                type="radio"
                                                name="contact_preferred_method"
                                                value={method}
                                                checked={formData.contact_preferred_method === method}
                                                onChange={() => handleRadioChange("contact_preferred_method", method)}
                                                className="accent-primary"
                                            />
                                            {method}
                                        </label>
                                    ))}
                                </div>
                                {errors.contact_preferred_method && <p className="text-xs text-destructive mt-1">{errors.contact_preferred_method}</p>}
                            </div>
                        </div>

                        {/* ── Secondary Contact (collapsible) ────────────── */}
                        <div className="border-t border-border/50 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowSecondary(s => !s)}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showSecondary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Add Secondary Contact <span className="text-xs">(optional)</span>
                            </button>

                            {showSecondary && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Secondary Name</label>
                                        <input
                                            name="secondary_contact_name"
                                            className="input-field"
                                            placeholder="Full name"
                                            value={formData.secondary_contact_name}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Secondary Title</label>
                                        <select
                                            name="secondary_contact_title"
                                            className="input-field"
                                            value={formData.secondary_contact_title}
                                            onChange={handleChange}
                                        >
                                            <option value="">Select title...</option>
                                            <option>Principal</option>
                                            <option>Assistant Principal</option>
                                            <option>Athletic Director</option>
                                            <option>After-School Coordinator</option>
                                            <option>Front Office Administrator</option>
                                            <option>PTA/PTO Contact</option>
                                            <option>Other</option>
                                        </select>
                                        {formData.secondary_contact_title === "Other" && (
                                            <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <input
                                                    className="input-field"
                                                    placeholder="Please specify title..."
                                                    value={secondaryCustomTitle}
                                                    onChange={(e) => setSecondaryCustomTitle(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Secondary Department</label>
                                        <input
                                            name="secondary_contact_department"
                                            className="input-field"
                                            placeholder="e.g. Administration"
                                            value={formData.secondary_contact_department}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Secondary Phone</label>
                                        <div className="flex gap-2">
                                            <div className="relative w-28 shrink-0">
                                                <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                                                    {formData.secondary_phone_prefix}
                                                </div>
                                                <select
                                                    className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                                                    style={{
                                                        backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === formData.secondary_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                                                        backgroundPosition: 'left 0.5rem center'
                                                    }}
                                                    value={formData.secondary_phone_prefix}
                                                    onChange={(e) => setFormData({ ...formData, secondary_phone_prefix: e.target.value })}
                                                >
                                                    {countryCodes.map(c => (
                                                        <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                                            {c.name} ({c.dialCode})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                                    <ChevronDown size={12} />
                                                </div>
                                            </div>
                                            <input
                                                name="secondary_contact_phone"
                                                className="input-field flex-1"
                                                placeholder="Phone"
                                                value={formData.secondary_contact_phone}
                                                onChange={handleChange}
                                            />
                                            <input
                                                name="secondary_contact_extension"
                                                className="input-field w-20"
                                                placeholder="Ext."
                                                value={formData.secondary_contact_extension}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Secondary Email</label>
                                        <input
                                            name="secondary_contact_email"
                                            type="email"
                                            className="input-field"
                                            placeholder="email@school.edu"
                                            value={formData.secondary_contact_email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="page-card grid grid-cols-1 md:grid-cols-2 gap-6">
                        <h2 className="md:col-span-2 font-semibold text-foreground mb-2">Lead Details</h2>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Name / Organization *</label>
                            <input
                                name="name"
                                className={`input-field ${errors.name ? "border-destructive focus:ring-destructive/20" : ""}`}
                                placeholder="Enter name or organization"
                                value={formData.name}
                                onChange={handleChange}
                            />
                            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Lead Type</label>
                            <select
                                name="type"
                                className="input-field"
                                value={formData.type}
                                onChange={handleChange}
                            >
                                <option value="">Select type...</option>
                                <option>Public</option>
                                <option>Private</option>
                                <option>Parent</option>
                                <option>Other</option>
                            </select>
                            {formData.type === "Other" && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <input
                                        className="input-field"
                                        placeholder="Please specify lead type..."
                                        value={customLeadType}
                                        onChange={(e) => setCustomLeadType(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Category / Group</label>
                            <input name="category_group" className="input-field" placeholder="e.g. PK–5, Partner, etc." value={formData.category_group} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Department</label>
                            <input name="department" className="input-field" placeholder="e.g. Administration" value={formData.department} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone</label>
                            <div className="flex gap-2">
                                <div className="relative w-28 shrink-0">
                                    <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                                        {formData.telephone_prefix}
                                    </div>
                                    <select
                                        className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                                        style={{
                                            backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === formData.telephone_prefix)?.code || 'US').toLowerCase()}.png)`,
                                            backgroundPosition: 'left 0.5rem center'
                                        }}
                                        value={formData.telephone_prefix}
                                        onChange={(e) => setFormData({ ...formData, telephone_prefix: e.target.value })}
                                    >
                                        {countryCodes.map(c => (
                                            <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                                {c.name} ({c.dialCode})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                        <ChevronDown size={12} />
                                    </div>
                                </div>
                                <input name="telephone" className="input-field flex-1" placeholder="Main Phone" value={formData.telephone} onChange={handleChange} />
                                <input name="telephone_extension" className="input-field w-20" placeholder="Ext." value={formData.telephone_extension} onChange={handleChange} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Website</label>
                            <input name="website" className="input-field" placeholder="https://www.example.com" value={formData.website} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Start Time</label>
                                <input name="start_time" type="time" className="input-field" value={formData.start_time} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">End Time</label>
                                <input name="end_time" type="time" className="input-field" value={formData.end_time} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="page-card grid grid-cols-1 md:grid-cols-2 gap-6">
                        <h2 className="md:col-span-2 font-semibold text-foreground mb-2">Address Details</h2>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Number</label>
                            <input name="address_number" className="input-field" placeholder="123" value={formData.address_number} onChange={handleChange} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Street Name</label>
                            <input name="address" className="input-field" placeholder="Main St" value={formData.address} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                            <input name="city" className="input-field" placeholder="City" value={formData.city} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                                <input name="state" className="input-field" placeholder="ST" value={formData.state} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Zip Code</label>
                                <input name="zip" className="input-field" placeholder="12345" value={formData.zip} onChange={handleChange} />
                            </div>
                        </div>
                    </div>



                    <div className="pt-4 border-t border-border flex justify-end gap-3">
                        <button type="button" onClick={() => navigate(-1)} className="btn-secondary border border-border">Cancel</button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`btn-primary flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Save size={18} /> {isSubmitting ? "Creating..." : "Create Lead"}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
