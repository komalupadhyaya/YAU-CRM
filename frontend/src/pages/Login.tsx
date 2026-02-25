import { useState } from "react";
import api from "../api/api";
import { LogIn, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      return; // Button is disabled, but safety check
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      toast.success("Login successful");
      navigate("/dashboard");
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error("Invalid credentials. Please try again.");
      } else {
        toast.error(err.response?.data?.error || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = username.trim() !== "" && password.trim() !== "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-xl shadow-primary/25">
            <ShieldCheck size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">YAU CRM</h1>
          <p className="text-muted-foreground mt-2 font-medium">Internal access only</p>
        </div>

        <form onSubmit={handleLogin} className="page-card shadow-2xl border-border/50 backdrop-blur-sm bg-card/80">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                Username
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                Password
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:grayscale-[0.5] transition-all"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center mt-8 text-xs text-muted-foreground/60 font-medium">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  );
}
