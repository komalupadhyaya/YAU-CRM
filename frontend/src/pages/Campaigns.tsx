import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Link } from "react-router-dom";
import { Plus, Folder } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  _id: string;
  name: string;
  createdAt: string;
}

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newName, setNewName] = useState("");

  const load = async () => {
    try {
      const r = await api.get("/campaigns");
      setCampaigns(r.data);
    } catch { }
  };

  useEffect(() => { load(); }, []);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    try {
      await api.post("/campaigns", { name: newName });
      toast.success("Campaign created successfully");
      setNewName("");
      load();
    } catch { }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
      </div>

      <form onSubmit={createCampaign} className="page-card mb-8">
        <label className="block text-sm font-medium text-foreground mb-1.5">New Campaign Name</label>
        <div className="flex gap-3">
          <input
            type="text"
            className="input-field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Spring 2026 Outreach"
          />
          <button type="submit" className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={18} /> Create Campaign
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.length === 0 ? (
          <div className="col-span-full p-12 text-center page-card text-muted-foreground">
            No campaigns yet. Create your first outreach effort above.
          </div>
        ) : (
          campaigns.map((c) => (
            <Link
              key={c._id}
              to={`/schools?campaignId=${c._id}`}
              className="page-card hover:border-primary transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Created {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Folder className="text-muted-foreground group-hover:text-primary transition-colors" size={24} />
              </div>
            </Link>
          ))
        )}
      </div>
    </AppLayout>
  );
};

export default Campaigns;
