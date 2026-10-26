import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import api from "../../api/api";
import {
  X,
  Upload,
  Globe,
  Image as ImageIcon,
  Loader2,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Search,
  Trash2,
  FolderHeart,
  Sparkles,
  Shapes,
  Circle,
  Square,
  RefreshCw,
  Plus,
  ArrowLeft,
  GripHorizontal,
  Move,
  Pencil,
  Save,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import GoogleDocsColorPickerPopover from "../common/GoogleDocsColorPickerPopover";

interface TemplateImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (imageHtml: string) => void;
}

export interface MediaAssetItem {
  _id: string;
  name: string;
  originalName?: string;
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  storage?: string;
  createdAt?: string;
}

type ModalTab = "library" | "upload" | "url";
type StudioMode = "picker" | "studio";
type ShapeType = "rectangle" | "rounded-sm" | "rounded-lg" | "pill" | "circle" | "squircle";
type AspectRatioType = "original" | "1:1" | "16:9" | "3:1";
type ShadowType = "none" | "soft" | "medium" | "elevated" | "glow";
type SizePreset = "logo" | "medium" | "banner" | "custom";
type Alignment = "left" | "center" | "right";

export const TemplateImageModal: React.FC<TemplateImageModalProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  // Navigation & View Mode
  const [mode, setMode] = useState<StudioMode>("picker"); // 'picker' = Clean Asset Browser, 'studio' = Canva Customizer
  const [activeTab, setActiveTab] = useState<ModalTab>("library");

  // Library Assets State
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const lastSearchQueryRef = useRef<string>("");
  const hasFetchedRef = useRef<boolean>(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<MediaAssetItem | null>(null);

  // Inline Image Renaming State
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);

  // Selected Active Image State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCustomName, setUploadCustomName] = useState<string>("");
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [webUrl, setWebUrl] = useState<string>("");
  const [webUrlName, setWebUrlName] = useState<string>("");
  const [isSavingWebUrl, setIsSavingWebUrl] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [selectedAssetName, setSelectedAssetName] = useState<string>("");
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number } | null>(null);

  // Computed displayed assets: Instant client-side filtering + server results
  const displayedAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    const q = searchQuery.toLowerCase().trim();
    return assets.filter(
      (asset) =>
        asset.name?.toLowerCase().includes(q) ||
        asset.originalName?.toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  // Canva-Style Shape & Framing Controls (Only in 'studio' mode)
  const [shape, setShape] = useState<ShapeType>("rectangle");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("original");
  const [objectFit, setObjectFit] = useState<"cover" | "contain">("cover");

  // Canva-Style Borders & Shadows
  const [borderWidth, setBorderWidth] = useState<number>(0); // 0, 1, 2, 4
  const [borderStyle, setBorderStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [borderColor, setBorderColor] = useState<string>("#2563EB");
  const [isBorderColorPickerOpen, setIsBorderColorPickerOpen] = useState<boolean>(false);
  const colorPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [shadow, setShadow] = useState<ShadowType>("none");

  // Email Design Controls
  const [sizePreset, setSizePreset] = useState<SizePreset>("logo");
  const [customWidth, setCustomWidth] = useState<string>("240px");
  const [alignment, setAlignment] = useState<Alignment>("center");
  const [clickThroughUrl, setClickThroughUrl] = useState<string>("");
  const [altText, setAltText] = useState<string>("");

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Media Assets from MongoDB
  const fetchAssets = useCallback(async (search = "", showSpinner = false) => {
    if (showSpinner) {
      setIsLoadingAssets(true);
    }
    try {
      const res = await api.get("/media-assets", {
        params: { search: search.trim() || undefined, limit: 60 },
      });
      if (res.data?.success && Array.isArray(res.data.assets)) {
        setAssets(res.data.assets);
      }
    } catch (err: any) {
      console.error("Failed to fetch media assets:", err);
    } finally {
      setIsLoadingAssets(false);
      hasFetchedRef.current = true;
    }
  }, []);

  // Debounced search effect (300ms) - only fires when user actively changes search query
  useEffect(() => {
    if (!isOpen) return;
    if (searchQuery === lastSearchQueryRef.current) return;
    const timer = setTimeout(() => {
      lastSearchQueryRef.current = searchQuery;
      fetchAssets(searchQuery, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchAssets, isOpen]);

  // Reset state on open without flashing
  useEffect(() => {
    if (isOpen) {
      setMode("picker");
      setActiveTab("library");
      setSelectedFile(null);
      setUploadCustomName("");
      setAssetPendingDelete(null);
      setRenamingAssetId(null);
      setRenameValue("");
      setFilePreviewUrl("");
      setWebUrl("");
      setIsUploading(false);
      setUploadedImageUrl("");
      setSelectedAssetName("");
      setDetectedDimensions(null);
      setShape("rectangle");
      setAspectRatio("original");
      setObjectFit("cover");
      setBorderWidth(0);
      setBorderStyle("solid");
      setBorderColor("#2563EB");
      setShadow("none");
      setSizePreset("logo");
      setCustomWidth("240px");
      setAlignment("center");
      setClickThroughUrl("");
      setAltText("");
      setIsDragging(false);
      setSearchQuery("");
      lastSearchQueryRef.current = "";

      // Silent background fetch if assets already loaded, or show spinner on first load
      fetchAssets("", assets.length === 0);
    }
  }, [isOpen, fetchAssets]);

  // Inline rename handlers
  const handleStartRename = (asset: MediaAssetItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingAssetId(asset._id);
    setRenameValue(asset.name || "");
  };

  const handleSaveRename = async (assetId: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!renameValue.trim()) {
      toast.error("Image name cannot be empty");
      return;
    }
    setIsSavingRename(true);
    try {
      const res = await api.patch(`/media-assets/${assetId}`, { name: renameValue.trim() });
      if (res.data?.success) {
        setAssets((prev) =>
          prev.map((a) => (a._id === assetId ? { ...a, name: renameValue.trim() } : a))
        );
        if (uploadedImageUrl && assets.find((a) => a._id === assetId)?.url === uploadedImageUrl) {
          setSelectedAssetName(renameValue.trim());
        }
        toast.success(`Image renamed to "${renameValue.trim()}"`);
        setRenamingAssetId(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to rename image");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenamingAssetId(null);
    setRenameValue("");
  };

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading && !deletingAssetId) {
        if (assetPendingDelete) {
          setAssetPendingDelete(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isUploading, deletingAssetId, assetPendingDelete]);

  if (!isOpen || typeof document === "undefined") return null;

  // Select an asset from the Library
  const handleSelectAsset = (asset: MediaAssetItem) => {
    setUploadedImageUrl(asset.url);
    setSelectedAssetName(asset.name || "Image");
    setFilePreviewUrl("");
    setSelectedFile(null);
    setWebUrl("");
    setAltText(asset.name || "Image");
    if (asset.width && asset.height) {
      setDetectedDimensions({ width: asset.width, height: asset.height });
      if (asset.width <= 250) setSizePreset("logo");
      else if (asset.width >= 550) setSizePreset("banner");
      else setSizePreset("medium");
    } else {
      const img = new Image();
      img.onload = () => {
        setDetectedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = asset.url;
    }
  };

  // Request verification dialog before deleting asset
  const handleRequestDelete = (asset: MediaAssetItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssetPendingDelete(asset);
  };

  // Perform permanent deletion from MongoDB and Cloudinary
  const handleConfirmDelete = async () => {
    if (!assetPendingDelete) return;
    const assetId = assetPendingDelete._id;
    const assetName = assetPendingDelete.name || "Asset";

    setDeletingAssetId(assetId);
    try {
      const res = await api.delete(`/media-assets/${assetId}`);
      if (res.data?.success) {
        setAssets((prev) => prev.filter((a) => a._id !== assetId));
        if (uploadedImageUrl === assetPendingDelete.url) {
          setUploadedImageUrl("");
          setSelectedAssetName("");
        }
        toast.success(`"${assetName}" permanently deleted from database and Cloudinary`);
        setAssetPendingDelete(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete asset");
    } finally {
      setDeletingAssetId(null);
    }
  };

  // Select File to stage for upload
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP, GIF, SVG)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size exceeds 10MB limit");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    const defaultName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    setUploadCustomName(defaultName);
    setSelectedAssetName(defaultName);

    const img = new Image();
    img.onload = () => {
      setDetectedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      if (img.naturalWidth <= 250) setSizePreset("logo");
      else if (img.naturalWidth >= 550) setSizePreset("banner");
      else setSizePreset("medium");
    };
    img.src = objectUrl;
  };

  // Explicitly Upload & Save to Cloudinary + MongoDB
  const handlePerformUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select or drop an image file first");
      return;
    }

    const trimmedName =
      uploadCustomName.trim() ||
      selectedAssetName.trim() ||
      selectedFile.name.replace(/\.[^/.]+$/, "").trim() ||
      "Uploaded Graphic";

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("name", trimmedName);

      const res = await api.post("/media-assets/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data?.url) {
        setUploadedImageUrl(res.data.url);
        setSelectedAssetName(res.data.asset?.name || trimmedName);
        toast.success(`"${trimmedName}" uploaded to Cloudinary & saved!`);
        fetchAssets(searchQuery);

        // Reset staged file and switch to library view
        setSelectedFile(null);
        setFilePreviewUrl("");
        setUploadCustomName("");
        setActiveTab("library");
      } else {
        throw new Error(res.data?.error || "Failed to upload image");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  // Save Web Image directly to MongoDB (without Cloudinary upload)
  const handleSaveWebUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedUrl = webUrl.trim();
    if (!trimmedUrl) {
      toast.error("Please enter a valid web image URL");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      toast.error("URL must begin with http:// or https://");
      return;
    }

    let defaultName = "Web Image";
    try {
      const parsed = new URL(trimmedUrl);
      const basename = parsed.pathname.split("/").pop()?.replace(/\.[^/.]+$/, "").trim();
      if (basename) defaultName = decodeURIComponent(basename);
    } catch {
      // url parse fallback
    }

    const trimmedName = webUrlName.trim() || defaultName;

    setIsSavingWebUrl(true);
    try {
      const res = await api.post("/media-assets/web", {
        url: trimmedUrl,
        name: trimmedName,
      });

      if (res.data?.success && res.data?.asset) {
        toast.success(`"${trimmedName}" saved to library!`);
        await fetchAssets(searchQuery);

        // Select the newly added web asset
        setUploadedImageUrl(res.data.asset.url);
        setSelectedAssetName(res.data.asset.name);

        // Reset web input state and switch to library view
        setWebUrl("");
        setWebUrlName("");
        setActiveTab("library");
      } else {
        throw new Error(res.data?.error || "Failed to save web image");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to save web image");
    } finally {
      setIsSavingWebUrl(false);
    }
  };

  const getEffectiveWidth = (): string => {
    switch (sizePreset) {
      case "logo":
        return "160px";
      case "medium":
        return "320px";
      case "banner":
        return "600px";
      case "custom":
        if (!customWidth.trim()) return "100%";
        return customWidth.trim().endsWith("px") || customWidth.trim().endsWith("%")
          ? customWidth.trim()
          : `${customWidth.trim()}px`;
      default:
        return "160px";
    }
  };

  // Compute CSS styling for Canva Shapes & Effects
  const getShapeStyles = () => {
    let borderRadius = "0px";
    let isCircle = false;

    switch (shape) {
      case "rounded-sm":
        borderRadius = "8px";
        break;
      case "rounded-lg":
        borderRadius = "16px";
        break;
      case "pill":
        borderRadius = "9999px";
        break;
      case "circle":
        borderRadius = "50%";
        isCircle = true;
        break;
      case "squircle":
        borderRadius = "28%";
        break;
      case "rectangle":
      default:
        borderRadius = "0px";
        break;
    }

    let boxShadow = "none";
    switch (shadow) {
      case "soft":
        boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
        break;
      case "medium":
        boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
        break;
      case "elevated":
        boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)";
        break;
      case "glow":
        boxShadow = `0 0 16px ${borderColor || "#2563EB"}55`;
        break;
      case "none":
      default:
        boxShadow = "none";
        break;
    }

    const borderCss =
      borderWidth > 0 ? `${borderWidth}px ${borderStyle} ${borderColor}` : "0";

    return {
      borderRadius,
      isCircle,
      boxShadow,
      borderCss,
    };
  };

  // Insert Directly (without extra customizer)
  const handleQuickInsert = (customUrl?: string, customAlt?: string) => {
    const url = customUrl || uploadedImageUrl || (activeTab === "url" ? webUrl.trim() : "");
    if (!url) {
      toast.error("Please select an image first");
      return;
    }
    const safeAlt = (customAlt || altText || selectedAssetName || "Image").replace(/"/g, "&quot;");
    const widthVal = getEffectiveWidth();
    const finalHtml = `<div style="text-align: center; margin: 16px 0;"><img src="${url}" alt="${safeAlt}" style="max-width: 100%; width: ${widthVal}; height: auto; border: 0; display: inline-block; vertical-align: middle;" /></div>`;

    onInsert(finalHtml);
    toast.success("Image inserted into template!");
    onClose();
  };

  // Insert Styled Image (from Canva Studio mode)
  const handleConfirmInsertStyled = () => {
    let finalImageUrl = uploadedImageUrl;
    if (!finalImageUrl && activeTab === "url") finalImageUrl = webUrl.trim();

    if (!finalImageUrl) {
      toast.error("Please select or upload an image first");
      return;
    }

    let formattedLink = clickThroughUrl.trim();
    if (formattedLink && !/^https?:\/\//i.test(formattedLink)) {
      formattedLink = `https://${formattedLink}`;
    }

    const widthVal = getEffectiveWidth();
    const safeAlt = (altText.trim() || selectedAssetName || "Image").replace(/"/g, "&quot;");
    const { borderRadius, isCircle, boxShadow, borderCss } = getShapeStyles();

    let heightStyle = "height: auto;";
    let aspectRatioStyle = "";
    if (isCircle) {
      heightStyle = `height: ${widthVal};`;
      aspectRatioStyle = "aspect-ratio: 1/1;";
    } else if (aspectRatio === "1:1") {
      aspectRatioStyle = "aspect-ratio: 1/1;";
    } else if (aspectRatio === "16:9") {
      aspectRatioStyle = "aspect-ratio: 16/9;";
    } else if (aspectRatio === "3:1") {
      aspectRatioStyle = "aspect-ratio: 3/1;";
    }

    const imgStyle = [
      "max-width: 100%",
      `width: ${widthVal}`,
      heightStyle,
      aspectRatioStyle,
      `object-fit: ${objectFit}`,
      `border-radius: ${borderRadius}`,
      `border: ${borderCss}`,
      boxShadow !== "none" ? `box-shadow: ${boxShadow}` : "",
      "display: inline-block",
      "vertical-align: middle",
      "outline: none",
    ]
      .filter(Boolean)
      .join("; ");

    const imgTag = `<img src="${finalImageUrl}" alt="${safeAlt}" style="${imgStyle};" />`;
    const wrappedContent = formattedLink
      ? `<a href="${formattedLink}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">${imgTag}</a>`
      : imgTag;

    const finalHtml = `<div style="text-align: ${alignment}; margin: 16px 0;">${wrappedContent}</div>`;

    onInsert(finalHtml);
    toast.success("Styled image inserted into template!");
    onClose();
  };

  const activePreviewUrl = uploadedImageUrl || filePreviewUrl || (activeTab === "url" ? webUrl : "");
  const { borderRadius, isCircle, boxShadow, borderCss } = getShapeStyles();

  return (
    <div
      className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pointer-events-auto animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${
          mode === "studio" ? "max-w-5xl max-h-[88vh]" : "max-w-2xl max-h-[82vh]"
        } bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in zoom-in-95`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
      {/* ========================================================================= */}
      {/* VIEW 1: CLEAN ASSET PICKER MODE (No Shape Clutter!)                       */}
      {/* ========================================================================= */}
        {mode === "picker" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Media & Image Assets</h3>
                  <p className="text-xs text-muted-foreground">
                    Select an image, drag it into your template, or style with Canva shapes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="flex p-1 bg-accent/50 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "library"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderHeart size={14} className="text-pink-500" />
                  My Uploads ({assets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "upload"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload size={14} className="text-blue-500" />
                  Upload New
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("url")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "url"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe size={14} className="text-emerald-500" />
                  Web URL
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4 custom-scrollbar">
              {/* TAB 1: MY UPLOADS GRID (CLEAN & NEAT) */}
              {activeTab === "library" && (
                <div className="space-y-3.5">
                  {/* Search bar & Refresh */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search your uploads by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Escape") {
                            setSearchQuery("");
                          }
                        }}
                        className="w-full pl-10 pr-9 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X size={13} />
                        </button>
                      ) : isLoadingAssets ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                          <Loader2 size={13} className="animate-spin" />
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchAssets(searchQuery)}
                      title="Refresh library"
                      className="p-2 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                    >
                      <RefreshCw size={14} className={isLoadingAssets ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {/* Drag-and-drop info banner */}
                  <div className="px-3.5 py-2 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-[11px] text-primary">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Move size={12} className="shrink-0" />
                      <span><strong>Pro-tip:</strong> Drag any image directly into the email editor or double-click an image name to rename it!</span>
                    </span>
                    <span className="text-[10px] opacity-75 hidden sm:inline shrink-0 font-mono">HTML5 Drag & Drop</span>
                  </div>

                  {/* Asset Grid */}
                  {isLoadingAssets && assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                      <Loader2 size={24} className="animate-spin text-primary" />
                      <span className="text-xs">Loading media library...</span>
                    </div>
                  ) : displayedAssets.length === 0 ? (
                    searchQuery ? (
                      <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl p-6 space-y-2.5">
                        <Search size={36} className="mx-auto text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-foreground">No images found for &ldquo;{searchQuery}&rdquo;</p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          We couldn't find any uploaded images matching that query.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="mt-1 px-3.5 py-1.5 text-xs font-bold rounded-xl border border-border bg-background hover:bg-accent text-foreground inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <X size={13} /> Clear Search
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl p-6 space-y-2">
                        <ImageIcon size={36} className="mx-auto text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-foreground">No uploaded images yet</p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Upload your company logo, banners, or event photos to store them permanently on Cloudinary CDN.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("upload")}
                          className="mt-2 btn-primary px-4 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} /> Upload First Image
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                      {/* Upload new quick tile */}
                      <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className="h-36 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all cursor-pointer bg-background/50 hover:bg-primary/5 group"
                      >
                        <div className="h-9 w-9 rounded-full bg-accent group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <Plus size={17} />
                        </div>
                        <span className="text-xs font-bold">Upload New</span>
                      </button>

                      {displayedAssets.map((asset) => {
                        const isSelected = uploadedImageUrl === asset.url;
                        const isRenaming = renamingAssetId === asset._id;

                        return (
                          <div
                            key={asset._id}
                            draggable={!isRenaming}
                            onDragStart={(e) => {
                              const dragHtml = `<div style="text-align: center; margin: 16px 0;"><img src="${asset.url}" alt="${asset.name || 'Image'}" style="max-width: 100%; width: 320px; height: auto; border: 0; display: inline-block;" /></div>`;
                              e.dataTransfer.setData("text/html", dragHtml);
                              e.dataTransfer.setData("text/plain", asset.url);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => !isRenaming && handleSelectAsset(asset)}
                            className={`group relative h-36 rounded-xl border overflow-hidden cursor-grab active:cursor-grabbing transition-all flex flex-col bg-background ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/40 shadow-md"
                                : "border-border hover:border-primary/60 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden p-2">
                              <img
                                src={asset.url}
                                alt={asset.name}
                                className="w-full h-full object-contain transition-transform group-hover:scale-105 pointer-events-none"
                                loading="lazy"
                              />
                            </div>

                            {/* Card Footer with Inline Name Editing */}
                            <div className="px-2.5 py-2 bg-card border-t border-border/60 flex items-center justify-between min-h-[36px]">
                              {isRenaming ? (
                                <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveRename(asset._id);
                                      } else if (e.key === "Escape") {
                                        handleCancelRename();
                                      }
                                    }}
                                    autoFocus
                                    disabled={isSavingRename}
                                    className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-background border border-primary rounded text-foreground focus:outline-none ring-1 ring-primary/40"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => handleSaveRename(asset._id, e)}
                                    disabled={isSavingRename}
                                    className="p-1 text-emerald-500 hover:text-emerald-600 rounded cursor-pointer"
                                    title="Save name"
                                  >
                                    {isSavingRename ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="stroke-[3]" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelRename}
                                    disabled={isSavingRename}
                                    className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between w-full min-w-0 gap-1.5">
                                  <span
                                    className="text-xs font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors flex-1"
                                    title="Double-click to rename"
                                    onDoubleClick={(e) => handleStartRename(asset, e)}
                                  >
                                    {asset.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartRename(asset, e)}
                                    title="Rename image"
                                    className="p-0.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  {asset.format && (
                                    <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono shrink-0 px-1 py-0.5 bg-muted/50 rounded">
                                      {asset.format}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Drag handle tooltip on hover */}
                            {!isRenaming && (
                              <div className="absolute bottom-10 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none">
                                <GripHorizontal size={10} /> Drag to insert
                              </div>
                            )}

                            {/* Delete button */}
                            {!isRenaming && (
                              <button
                                type="button"
                                onClick={(e) => handleRequestDelete(asset, e)}
                                disabled={deletingAssetId === asset._id}
                                title="Permanently delete from database & Cloudinary"
                                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-xs"
                              >
                                {deletingAssetId === asset._id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            )}

                            {/* Selected Badge */}
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                                <Check size={12} className="stroke-[3]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: UPLOAD IMAGE (CLEAN & SPACIOUS UX WITH CUSTOM NAME & SAVE BUTTON) */}
              {activeTab === "upload" && (
                <div className="space-y-4 py-2">
                  {!selectedFile ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] ${
                        isDragging
                          ? "border-primary bg-primary/10 scale-[0.99]"
                          : "border-border/80 hover:border-primary/50 hover:bg-accent/20 bg-background/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-xs">
                        <Upload size={28} />
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        Click to browse or drag and drop image here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        Upload your organization logos, headers, banners, or athlete photos
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                        {["PNG", "JPG", "WEBP", "GIF", "SVG"].map((fmt) => (
                          <span key={fmt} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-muted-foreground border border-border/60">
                            {fmt}
                          </span>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1">Up to 10MB</span>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!isUploading) {
                          handlePerformUpload();
                        }
                      }}
                      className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        {/* Large Thumbnail preview with clean change button */}
                        <div className="relative h-32 w-32 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-border/80 flex items-center justify-center overflow-hidden p-2 shadow-inner group">
                          {filePreviewUrl ? (
                            <img
                              src={filePreviewUrl}
                              alt="Upload preview"
                              className="max-h-full max-w-full object-contain rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="text-muted-foreground" size={32} />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              setFilePreviewUrl("");
                              setUploadCustomName("");
                            }}
                            disabled={isUploading}
                            title="Remove and pick different file"
                            className="absolute top-2 right-2 p-1 rounded-lg bg-black/70 hover:bg-red-600 text-white cursor-pointer transition-colors shadow-xs"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* File metadata & Info */}
                        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md">
                              Ready for Cloud Upload
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setFilePreviewUrl("");
                                setUploadCustomName("");
                              }}
                              disabled={isUploading}
                              className="text-xs text-muted-foreground hover:text-red-500 font-medium cursor-pointer transition-colors"
                            >
                              Change File
                            </button>
                          </div>
                          <p className="text-sm font-bold text-foreground truncate">
                            {selectedFile.name}
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-muted-foreground font-mono">
                            <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            {detectedDimensions && (
                              <>
                                <span>•</span>
                                <span>{detectedDimensions.width} × {detectedDimensions.height}px</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Custom Name Input with clear label */}
                      <div className="space-y-2 pt-3 border-t border-border/60">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Image Name</span>
                          <span className="text-[11px] font-normal text-muted-foreground">Stored in Database & Library</span>
                        </label>
                        <input
                          type="text"
                          value={uploadCustomName}
                          onChange={(e) => {
                            setUploadCustomName(e.target.value);
                            setSelectedAssetName(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isUploading) {
                              e.preventDefault();
                              handlePerformUpload();
                            }
                          }}
                          placeholder="e.g. YAU Sports Main Logo"
                          disabled={isUploading}
                          className="w-full px-4 py-2.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-2xs font-medium"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          This title will identify your image in the &ldquo;My Uploads&rdquo; library and search bar.
                        </p>
                      </div>

                      {/* Upload Progress Bar if uploading */}
                      {isUploading && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-primary font-semibold flex items-center gap-1.5">
                              <Loader2 size={13} className="animate-spin" /> Uploading to Cloudinary CDN...
                            </span>
                            <span className="text-muted-foreground text-[11px]">Saving database record...</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse rounded-full w-full" />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setFilePreviewUrl("");
                            setUploadCustomName("");
                          }}
                          disabled={isUploading}
                          className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="btn-primary px-6 py-2.5 text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload size={15} />
                              Save & Upload to Cloud
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: WEB URL (DIRECT DATABASE STORAGE) */}
              {activeTab === "url" && (
                <form onSubmit={handleSaveWebUrl} className="space-y-4 py-4 max-w-lg mx-auto">
                  {/* Image Name Field (BEFORE URL) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Image Name <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Header Banner or Sponsor Logo"
                      value={webUrlName}
                      onChange={(e) => setWebUrlName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Give your image a custom name so you can easily find it in My Uploads.
                    </p>
                  </div>

                  {/* Image Web URL Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Image Web Address (URL) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={webUrl}
                      onChange={(e) => {
                        setWebUrl(e.target.value);
                        setUploadedImageUrl(e.target.value);
                      }}
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must be a publicly accessible HTTP or HTTPS image link.
                    </p>
                  </div>

                  {webUrl && (
                    <div className="p-3 rounded-xl bg-accent/20 border border-border flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={webUrl}
                          alt="Web Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{webUrlName.trim() || webUrl}</p>
                        <p className="text-[10px] text-muted-foreground">Stored directly in database without Cloudinary upload</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={!webUrl.trim() || isSavingWebUrl}
                      className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingWebUrl ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Saving to Database...
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          Save to Media Library
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer with Selected Image Action Bar (Only in My Uploads) */}
            {activeTab === "library" && (
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-accent/20 shrink-0">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {activePreviewUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={activePreviewUrl}
                        alt="Thumbnail"
                        className="h-7 w-7 rounded-md object-contain border border-border bg-background"
                      />
                      <span className="font-semibold text-foreground truncate max-w-[160px]">
                        {selectedAssetName || "Selected Image"}
                      </span>
                    </div>
                  ) : (
                    <span>Select an image to insert or customize</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Simple Customize Button */}
                  <button
                    type="button"
                    onClick={() => setMode("studio")}
                    disabled={!activePreviewUrl || isUploading}
                    className="px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Customize
                  </button>

                  {/* Primary Import Button */}
                  <button
                    type="button"
                    onClick={() => handleQuickInsert()}
                    disabled={!activePreviewUrl || isUploading}
                    className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: CANVA STUDIO MODE (Dedicated Shape & Framing Customizer)           */
          /* ========================================================================= */
          <>
            {/* Header with Back button */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-accent/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    Canva Studio: Shape & Frame
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate max-w-sm">
                    Styling: <span className="font-semibold text-foreground">{selectedAssetName || "Image"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Split View Body: Left Controls, Right Live Studio Canvas */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col lg:flex-row gap-5">
              {/* LEFT COLUMN: Controls */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* 1. Canva Shapes */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Shapes size={13} className="text-primary" />
                    Shape Framing
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <button
                      type="button"
                      onClick={() => setShape("rectangle")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "rectangle"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Square size={16} />
                      <span className="text-[10px]">Rectangle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShape("rounded-sm")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "rounded-sm"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-xs border-2 border-current" />
                      <span className="text-[10px]">Soft Curve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShape("rounded-lg")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "rounded-lg"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="w-5 h-4 rounded-[3px] border-2 border-current flex flex-col overflow-hidden">
                        <div className="w-full h-1 border-b border-current/40 bg-current/20 shrink-0" />
                      </div>
                      <span className="text-[10px]">Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShape("pill")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "pill"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="w-5 h-3 rounded-full border-2 border-current" />
                      <span className="text-[10px]">Pill</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShape("circle")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "circle"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Circle size={16} />
                      <span className="text-[10px]">Circle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShape("squircle")}
                      className={`py-2 px-1 text-center rounded-lg border text-xs transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        shape === "squircle"
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-[28%] border-2 border-current" />
                      <span className="text-[10px]">Squircle</span>
                    </button>
                  </div>
                </div>

                {/* 2. Aspect Ratio & Fit */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground block">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatioType)}
                      disabled={isCircle}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="original">Original Ratio</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="3:1">3:1 (Header Banner)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground block">Image Fit</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setObjectFit("cover")}
                        className={`flex-1 py-1 px-2 rounded-lg border text-xs transition-all cursor-pointer ${
                          objectFit === "cover"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        Cover (Fill)
                      </button>
                      <button
                        type="button"
                        onClick={() => setObjectFit("contain")}
                        className={`flex-1 py-1 px-2 rounded-lg border text-xs transition-all cursor-pointer ${
                          objectFit === "contain"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        Contain
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Border Stroke */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Border Stroke</label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {borderWidth === 0 ? "None" : `${borderWidth}px ${borderStyle}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-border p-0.5 bg-background">
                      {[0, 1, 2, 4].map((width) => (
                        <button
                          key={width}
                          type="button"
                          onClick={() => setBorderWidth(width)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                            borderWidth === width
                              ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {width === 0 ? "None" : `${width}px`}
                        </button>
                      ))}
                    </div>

                    {borderWidth > 0 && (
                      <div className="flex rounded-lg border border-border p-0.5 bg-background">
                        {(["solid", "dashed", "dotted"] as const).map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setBorderStyle(style)}
                            className={`px-2 py-1 text-xs rounded-md capitalize transition-all cursor-pointer ${
                              borderStyle === style
                                ? "bg-accent text-foreground font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {borderWidth > 0 && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {/* Google Docs Style Color Picker Trigger & Popover */}
                      <div className="relative">
                        <button
                          ref={colorPickerTriggerRef}
                          type="button"
                          onClick={() => setIsBorderColorPickerOpen(!isBorderColorPickerOpen)}
                          title={`Border Color (${borderColor})`}
                          className={`h-8 px-2.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer shadow-2xs select-none ${
                            isBorderColorPickerOpen
                              ? 'border-primary ring-1 ring-primary bg-accent text-foreground'
                              : 'border-border bg-background hover:bg-accent text-foreground'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 shrink-0 shadow-xs relative overflow-hidden pointer-events-none"
                            style={{
                              backgroundColor: borderColor,
                              boxShadow: borderColor.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined
                            }}
                          />
                          <span className="font-mono text-xs font-semibold select-none">{borderColor.toUpperCase()}</span>
                          <ChevronDown size={12} className="opacity-60 shrink-0 pointer-events-none" />
                        </button>

                        <GoogleDocsColorPickerPopover
                          title="Border color"
                          isOpen={isBorderColorPickerOpen}
                          onClose={() => setIsBorderColorPickerOpen(false)}
                          currentColor={borderColor}
                          onSelectColor={(color) => setBorderColor(color)}
                          triggerRef={colorPickerTriggerRef}
                        />
                      </div>

                      {/* Quick Swatches for Instant Access */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['#2563EB', '#059669', '#DC2626', '#D97706', '#9333EA', '#000000', '#FFFFFF'].map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => setBorderColor(swatch)}
                            style={{ backgroundColor: swatch }}
                            title={swatch}
                            className={`h-5 w-5 rounded-full border transition-transform cursor-pointer ${
                              borderColor.toLowerCase() === swatch.toLowerCase()
                                ? 'scale-120 ring-2 ring-primary ring-offset-1 border-white dark:border-slate-900 shadow-xs'
                                : 'border-border/80 hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Drop Shadows / Glow */}
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <label className="text-xs font-bold text-foreground block">Shadow & Glow</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(["none", "soft", "medium", "elevated", "glow"] as const).map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setShadow(sh)}
                        className={`py-1 px-1.5 text-center rounded-lg border text-[11px] capitalize transition-all cursor-pointer ${
                          shadow === sh
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                            : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sh}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Size & Alignment */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Size Preset</label>
                    <select
                      value={sizePreset}
                      onChange={(e) => setSizePreset(e.target.value as SizePreset)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="logo">🏷️ Logo (160px)</option>
                      <option value="medium">📱 Medium (320px)</option>
                      <option value="banner">🖼️ Full Banner (600px)</option>
                      <option value="custom">⚙️ Custom Width</option>
                    </select>
                    {sizePreset === "custom" && (
                      <input
                        type="text"
                        placeholder="e.g. 240px or 80%"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1 text-xs bg-background border border-border rounded-lg text-foreground"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Alignment</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAlignment("left")}
                        className={`flex-1 py-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                          alignment === "left"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlignment("center")}
                        className={`flex-1 py-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                          alignment === "center"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlignment("right")}
                        className={`flex-1 py-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                          alignment === "right"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <AlignRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Link & Alt Text */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground block">
                      Link <span className="text-[10px] text-muted-foreground">(Optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://yausports.org"
                      value={clickThroughUrl}
                      onChange={(e) => setClickThroughUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground block">
                      Alt Text <span className="text-[10px] text-muted-foreground">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. YAU Sports Logo"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Interactive Canva Studio Canvas Preview */}
              <div className="w-full lg:w-[350px] shrink-0 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    Live Canvas Preview
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {getEffectiveWidth()} • {shape}
                  </span>
                </div>

                {/* Canvas Box */}
                <div className="flex-1 min-h-[260px] lg:min-h-[380px] rounded-xl border border-border/80 bg-slate-100/80 dark:bg-slate-950/80 p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  {activePreviewUrl && (
                    <div
                      className="w-full h-full flex items-center transition-all"
                      style={{
                        justifyContent:
                          alignment === "left"
                            ? "flex-start"
                            : alignment === "right"
                            ? "flex-end"
                            : "center",
                      }}
                    >
                      <div
                        className="relative transition-all duration-200"
                        style={{
                          maxWidth: "100%",
                          width: getEffectiveWidth(),
                          borderRadius,
                          boxShadow,
                          border: borderCss,
                          overflow: "hidden",
                          aspectRatio: isCircle
                            ? "1/1"
                            : aspectRatio === "1:1"
                            ? "1/1"
                            : aspectRatio === "16:9"
                            ? "16/9"
                            : aspectRatio === "3:1"
                            ? "3/1"
                            : undefined,
                          height: isCircle ? getEffectiveWidth() : "auto",
                          maxHeight: "280px",
                        }}
                      >
                        <img
                          src={activePreviewUrl}
                          alt="Preview"
                          style={{
                            width: "100%",
                            height: isCircle || aspectRatio !== "original" ? "100%" : "auto",
                            objectFit,
                            display: "block",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "0.2";
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Styling info badge */}
                <div className="p-2.5 rounded-lg bg-accent/30 border border-border/60 text-[11px] text-muted-foreground space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Radius:</span>
                    <span className="text-foreground font-semibold">{borderRadius}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Border:</span>
                    <span className="text-foreground font-semibold">
                      {borderWidth > 0 ? `${borderWidth}px ${borderStyle}` : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shadow:</span>
                    <span className="text-foreground font-semibold capitalize">{shadow}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Studio Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-accent/20 shrink-0">
              <button
                type="button"
                onClick={() => setMode("picker")}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={13} />
                Back to Library
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInsertStyled}
                  className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check size={13} />
                  Insert Styled Image
                </button>
              </div>
            </div>
          </>
        )}

        {/* VERIFICATION MODAL FOR PERMANENT DELETE */}
      {assetPendingDelete && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !deletingAssetId && setAssetPendingDelete(null)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Header */}
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-foreground">
                  Delete Media Asset?
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to permanently delete this file?
                </p>
              </div>
            </div>

            {/* Asset Preview Card */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-muted/40 border border-border/70">
              <div className="h-14 w-14 rounded-lg bg-background border border-border/80 flex items-center justify-center overflow-hidden shrink-0 p-1">
                <img
                  src={assetPendingDelete.url}
                  alt={assetPendingDelete.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {assetPendingDelete.name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {assetPendingDelete.format?.toUpperCase() || "IMAGE"}
                  {assetPendingDelete.size ? ` • ${(assetPendingDelete.size / 1024).toFixed(1)} KB` : ""}
                </p>
              </div>
            </div>

            {/* Permanent Deletion Notice */}
            <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-xs text-red-600 dark:text-red-400 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                ⚠️ Permanent Action
              </p>
              <p className="text-[11px] opacity-90 leading-relaxed">
                This image will be permanently removed from both your MongoDB database and Cloudinary cloud CDN. Any email template displaying this image URL may show a broken image.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={!!deletingAssetId}
                onClick={() => setAssetPendingDelete(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!deletingAssetId}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {deletingAssetId ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Yes, Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default TemplateImageModal;
