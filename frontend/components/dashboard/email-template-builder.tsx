"use client";

import React, { useRef } from "react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function EmailTemplateBuilder({
  open,
  templateName,
  onClose,
  onSave
}: {
  open: boolean;
  templateName: string;
  onClose: () => void;
  onSave: (html: string, design: any) => void;
}) {
  const emailEditorRef = useRef<EditorRef>(null);

  const saveDesign = () => {
    emailEditorRef.current?.editor?.exportHtml((data: any) => {
      const { design, html } = data;
      onSave(html, design);
    });
  };

  const onLoad = () => {
    // We can load a previous design if passed later
  };

  const onReady = () => {
    // editor is ready
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[2000] flex flex-col bg-[var(--background)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-[var(--card)]" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Edit Template: {templateName}</h2>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Available shortcodes: {'{{'}user.firstName{'}}'}, {'{{'}property.title{'}}'}, {'{{'}property.price{'}}'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--secondary)]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
            <button
              onClick={saveDesign}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Save className="w-4 h-4" /> Save Template
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 relative overflow-hidden bg-white" style={{ minHeight: 0, height: 'calc(100vh - 70px)' }}>
          <EmailEditor
            ref={emailEditorRef}
            onLoad={onLoad}
            onReady={onReady}
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
                   property_title: {
                       name: "Property Title",
                       value: "{{property.title}}",
                       sample: "4 Bedroom Semi-Detached Duplex"
                   },
                   property_price: {
                       name: "Property Price",
                       value: "{{property.price}}",
                       sample: "₦120,000,000"
                   }
               }
            }}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
