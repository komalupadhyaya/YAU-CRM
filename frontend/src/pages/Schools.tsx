import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Schools() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/campaigns", { replace: true });
  }, [navigate]);
  return null;
}
