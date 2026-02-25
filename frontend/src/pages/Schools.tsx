// import { useEffect, useState } from "react";
// import api from "../api/api";
// import AppLayout from "../layout/AppLayout";
// import { Link, useSearchParams } from "react-router-dom";
// import { ChevronRight, Search, MapPin, Plus } from "lucide-react";

// interface SchoolItem {
//   id: number;
//   name: string;
//   city?: string;
//   state?: string;
// }

// export default function Schools() {
//   const [searchParams] = useSearchParams();
//   const campaignId = searchParams.get("campaignId");
//   const [schools, setSchools] = useState<SchoolItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState("");

//   useEffect(() => {
//     const url = campaignId ? `/schools/campaign/${campaignId}` : "/schools";
//     api.get(url)
//       .then((r) => setSchools(r.data))
//       .catch(() => { })
//       .finally(() => setLoading(false));
//   }, [campaignId]);

//   const filteredSchools = schools.filter(s =>
//     s.name?.toLowerCase().includes(search.toLowerCase()) ||
//     s.city?.toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <AppLayout>
//       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
//         <h1 className="text-2xl font-bold text-foreground">Schools</h1>
//         <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
//           <div className="relative w-full md:w-64">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
//             <input
//               type="text"
//               placeholder="Search schools..."
//               className="input-field pl-10"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <Link
//             to={campaignId ? `/schools/create?campaignId=${campaignId}` : "/schools/create"}
//             className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
//           >
//             <Plus size={18} />
//             Create School
//           </Link>
//         </div>
//       </div>

//       <div className="page-card p-0 divide-y divide-border overflow-hidden">
//         {loading ? (
//           <div className="p-12 text-center text-muted-foreground animate-pulse">Loading schools...</div>
//         ) : filteredSchools.length === 0 ? (
//           <div className="p-12 text-sm text-muted-foreground text-center">
//             {search ? "No schools match your search." : "No schools found in this campaign."}
//           </div>
//         ) : (
//           filteredSchools.map((s) => (
//             <Link
//               to={"/school/" + s.id}
//               key={s.id}
//               className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
//             >
//               <div>
//                 <div className="font-medium text-foreground">{s.name}</div>
//                 {(s.city || s.state) && (
//                   <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
//                     <MapPin size={12} />
//                     {s.city}{s.city && s.state ? ", " : ""}{s.state}
//                   </div>
//                 )}
//               </div>
//               <ChevronRight size={18} className="text-muted-foreground" />
//             </Link>
//           ))
//         )}
//       </div>
//     </AppLayout>
//   );
// }
import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Search, MapPin, Plus } from "lucide-react";

// Use string for _id because MongoDB uses ObjectId
interface SchoolItem {
  _id: string;
  name: string;
  city?: string;
  state?: string;
}

export default function Schools() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId"); // Must be MongoDB ObjectId
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Make sure campaignId is valid MongoDB ObjectId string
    const url = campaignId ? `/schools/campaign/${campaignId}` : "/schools";
    api.get(url)
      .then((r) => setSchools(r.data))
      .catch((err) => console.error("Error fetching schools:", err))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const filteredSchools = schools.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schools</h1>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search schools..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link
            to={campaignId ? `/schools/create?campaignId=${campaignId}` : "/schools/create"}
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} />
            Create School
          </Link>
        </div>
      </div>

      <div className="page-card p-0 divide-y divide-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Loading schools...</div>
        ) : filteredSchools.length === 0 ? (
          <div className="p-12 text-sm text-muted-foreground text-center">
            {search ? "No schools match your search." : "No schools found in this campaign."}
          </div>
        ) : (
          filteredSchools.map((s) => (
            <Link
              to={"/school/" + s._id} // Use _id from MongoDB
              key={s._id}
              className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
            >
              <div>
                <div className="font-medium text-foreground">{s.name}</div>
                {(s.city || s.state) && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin size={12} />
                    {s.city}{s.city && s.state ? ", " : ""}{s.state}
                  </div>
                )}
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </AppLayout>
  );
}
