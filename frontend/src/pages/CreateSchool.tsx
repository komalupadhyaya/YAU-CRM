import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Save, ArrowLeft, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
    _id: string;
    name: string;
}

export default function CreateSchool() {
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
        grades: "",
        principal_name: "",
        principal_email: "",
        telephone: "",
        start_time: "",
        end_time: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        website: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        api.get("/campaigns")
            .then((r) => {
                setCampaigns(r.data);
                if (!initialCampaignId && r.data.length > 0) {
                    setFormData(prev => ({ ...prev, campaign_id: String(r.data[0]._id) }));
                }
            })
            .catch(() => toast.error("Failed to load campaigns"))
            .finally(() => setLoading(false));
    }, [initialCampaignId]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = "School name is required";
        if (!formData.campaign_id) newErrors.campaign_id = "Please select a campaign";
        if (formData.principal_email && !/\S+@\S+\.\S+/.test(formData.principal_email)) {
            newErrors.principal_email = "Invalid email format";
        }
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
        if (!validate()) {
            toast.error("Please fix the errors in the form.");
            return;
        }

        try {
            const res = await api.post("/schools", formData);
            toast.success("School created successfully!");
            navigate("/school/" + res.data._id);
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to create school.");
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
                    <h1 className="text-2xl font-bold text-foreground">Add New School</h1>
                    <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
                        <Save size={16} /> Save School
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Campaign Selection - Smart Dropdown */}
                    <div className="page-card">
                        <h2 className="font-semibold text-foreground mb-4">Target Campaign</h2>
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
                                <button type="button" onClick={handleCreateCampaign} className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
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

                    <div className="page-card grid grid-cols-1 md:grid-cols-2 gap-6">
                        <h2 className="md:col-span-2 font-semibold text-foreground mb-2">School Details</h2>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">School Name *</label>
                            <input
                                name="name"
                                className={`input-field ${errors.name ? "border-destructive focus:ring-destructive/20" : ""}`}
                                placeholder="Enter school name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">School Type</label>
                            <input name="type" className="input-field" placeholder="e.g. Public, Private, Charter" value={formData.type} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Grades</label>
                            <input name="grades" className="input-field" placeholder="e.g. PK–5, 6-8, 9-12" value={formData.grades} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone</label>
                            <input name="telephone" className="input-field" placeholder="(555) 000-0000" value={formData.telephone} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Principal / POC Name</label>
                            <input name="principal_name" className="input-field" placeholder="Enter principal name" value={formData.principal_name} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Principal Email</label>
                            <input
                                name="principal_email"
                                type="email"
                                className={`input-field ${errors.principal_email ? "border-destructive focus:ring-destructive/20" : ""}`}
                                placeholder="principal@school.edu"
                                value={formData.principal_email}
                                onChange={handleChange}
                            />
                            {errors.principal_email && <p className="text-xs text-destructive mt-1">{errors.principal_email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Website</label>
                            <input name="website" className="input-field" placeholder="https://www.school.edu" value={formData.website} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">School Start Time</label>
                                <input name="start_time" type="time" className="input-field" value={formData.start_time} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">School End Time</label>
                                <input name="end_time" type="time" className="input-field" value={formData.end_time} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="page-card grid grid-cols-1 md:grid-cols-2 gap-6">
                        <h2 className="md:col-span-2 font-semibold text-foreground mb-2">Address Details</h2>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Street Address</label>
                            <input name="address" className="input-field" placeholder="123 Education Lane" value={formData.address} onChange={handleChange} />
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
                        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary flex items-center gap-2">
                            <Save size={18} /> Create School
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
