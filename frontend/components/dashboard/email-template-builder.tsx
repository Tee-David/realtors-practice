"use client";

import React, { useRef, useState, useEffect } from "react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function EmailTemplateBuilder({
  open,
  templateName,
  initialDesign,
  onClose,
  onSave
}: {
  open: boolean;
  templateName: string;
  initialDesign?: any;
  onClose: () => void;
  onSave: (html: string, design: any) => void | Promise<void>;
}) {
  const emailEditorRef = useRef<EditorRef>(null);
  const [editorHeight, setEditorHeight] = useState(600);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEditorHeight(window.innerHeight - 70);
      const handleResize = () => setEditorHeight(window.innerHeight - 70);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [open]);

  const saveDesign = async () => {
    setSaving(true);
    emailEditorRef.current?.editor?.exportHtml(async (data: any) => {
      const { design, html } = data;
      await onSave(html, design);
      setSaving(false);
    });
  };

  const onLoad = () => {};
  const onReady = () => {
    // Load existing design if available
    if (initialDesign && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.loadDesign(initialDesign);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[2000] flex flex-col"
        style={{ backgroundColor: "var(--background)", display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0 bg-[var(--card)]" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold truncate" style={{ color: "var(--foreground)" }}>Edit: {templateName}</h2>
            <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
              Use merge tags in the sidebar to insert dynamic content
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
            <button
              onClick={onClose}
              className="p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--secondary)]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <X className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
            <button
              onClick={saveDesign}
              disabled={saving}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{saving ? "Saving..." : "Save Template"}</span>
            </button>
          </div>
        </div>

        {/* Editor — explicit pixel height so iframe resolves correctly */}
        <div className="bg-white" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <EmailEditor
            ref={emailEditorRef}
            onLoad={onLoad}
            onReady={onReady}
            minHeight={`${editorHeight}px`}
            options={{
              features: {
                textEditor: {
                  spellChecker: true,
                }
              },
              appearance: {
                theme: 'modern_light',
              },
              mergeTags: {
                user_first_name: {
                  name: "User First Name",
                  value: "{{user.firstName}}",
                  sample: "John"
                },
                user_last_name: {
                  name: "User Last Name",
                  value: "{{user.lastName}}",
                  sample: "Doe"
                },
                user_email: {
                  name: "User Email",
                  value: "{{user.email}}",
                  sample: "john@example.com"
                },
                property_title: {
                  name: "Property Title",
                  value: "{{property.title}}",
                  sample: "4 Bedroom Semi-Detached Duplex"
                },
                property_price: {
                  name: "Property Price",
                  value: "{{property.price}}",
                  sample: "₦120,000,000"
                },
                property_location: {
                  name: "Property Location",
                  value: "{{property.location}}",
                  sample: "Lekki Phase 1, Lagos"
                },
                property_bedrooms: {
                  name: "Property Bedrooms",
                  value: "{{property.bedrooms}}",
                  sample: "4"
                },
                property_url: {
                  name: "Property URL",
                  value: "{{property.url}}",
                  sample: "https://example.com/property/123"
                },
                saved_search_name: {
                  name: "Saved Search Name",
                  value: "{{savedSearch.name}}",
                  sample: "3 bed flat in Lekki"
                },
                app_name: {
                  name: "App Name",
                  value: "{{app.name}}",
                  sample: "Realtors' Practice"
                },
                app_url: {
                  name: "App URL",
                  value: "{{app.url}}",
                  sample: "https://realtors-practice.com"
                },
              }
            }}
            style={{ height: '100vh', width: '100%', flex: 1 }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
