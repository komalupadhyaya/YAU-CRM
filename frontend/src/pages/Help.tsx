import AppLayout from "../layout/AppLayout";
import { BookOpen, Video, Mail, ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Help() {
    return (
        <AppLayout>
            <div className="space-y-8 max-w-5xl mx-auto pb-12">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <HelpCircle size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Help & Support</h1>
                        <p className="text-muted-foreground">Resources and support to help you get the most out of YAU CRM.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Training & Documentation */}
                    <div className="bg-card border border-sidebar-border rounded-xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-4 text-primary">
                            <BookOpen size={24} />
                            <h2 className="text-xl font-bold text-white">Training</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6 flex-grow">
                            Access guides and documentation to help you navigate YAU CRM.
                        </p>
                        <div className="space-y-3">
                            <Button asChild className="w-full gap-2">
                                <a href="#">
                                    View User Guide
                                    <ExternalLink size={14} />
                                </a>
                            </Button>
                            <p className="text-[10px] text-muted-foreground italic text-center">
                                Full documentation coming soon.
                            </p>
                        </div>
                    </div>

                    {/* Video Walkthroughs */}
                    <div className="bg-card border border-sidebar-border rounded-xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-4 text-primary">
                            <Video size={24} />
                            <h2 className="text-xl font-bold text-white">Videos</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6 flex-grow">
                            Watch step-by-step tutorials for using key CRM features.
                        </p>
                        <div className="space-y-3">
                            <Button variant="outline" asChild className="w-full gap-2 border-primary/20 hover:bg-primary/10">
                                <a href="#">
                                    Watch CRM Overview
                                    <Video size={14} />
                                </a>
                            </Button>
                            <p className="text-[10px] text-muted-foreground italic text-center">
                                Video walkthroughs coming soon.
                            </p>
                        </div>
                    </div>

                    {/* Contact Support */}
                    <div className="bg-card border border-sidebar-border rounded-xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-4 text-primary">
                            <Mail size={24} />
                            <h2 className="text-xl font-bold text-white">Contact</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Need help? Reach out to our support team for assistance.
                        </p>
                        <div className="mt-auto pt-4 border-t border-sidebar-border/50">
                            <div className="bg-secondary/50 rounded-lg p-3 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Support Email</p>
                                <a
                                    href="mailto:support@yaucrm.com"
                                    className="text-primary font-semibold hover:underline decoration-primary/30"
                                >
                                    support@yaucrm.com
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FAQ Placeholder / Quick Tips */}
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 mt-4">
                    <h3 className="text-lg font-bold text-white mb-2">Quick Tip</h3>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Did you know you can export all your Lead data as CSV from the Reports section?
                        Simply navigate to <strong>Reports</strong> and click <strong>Export Schools</strong> to get a full download of your database.
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
