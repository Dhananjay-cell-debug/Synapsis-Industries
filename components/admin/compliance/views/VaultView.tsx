// ─── DOCUMENT VAULT VIEW ───────────────────────────────────────────────────
// Honest state: Supabase Storage bucket not yet provisioned. This view shows
// exactly what the vault will hold + the planned structure — no fake buttons.

"use client";

import React from "react";
import { FolderLock, FileText, ShieldCheck, Clock } from "lucide-react";
import { COMPLIANCE, Card, ViewHeader, SectionLabel, Badge } from "../ui";

const PLANNED: { folder: string; holds: string; example: string }[] = [
    { folder: "{fy}/gst-registration", holds: "GST registration certificate", example: "gst_cert_FY2026-27.pdf" },
    { folder: "{fy}/lut", holds: "Letter of Undertaking acknowledgements", example: "lut_FY2026-27.pdf" },
    { folder: "{fy}/gstr-1", holds: "Quarterly GSTR-1 filing receipts", example: "gstr1_Q1_ACK.pdf" },
    { folder: "{fy}/gstr-3b", holds: "Monthly GSTR-3B + challans", example: "3b_2026-05_ACK.pdf" },
    { folder: "{fy}/itr", holds: "ITR-4 acknowledgement (ITR-V)", example: "itr4_FY2026-27_ack.pdf" },
    { folder: "{fy}/advance-tax", holds: "Challan 280 payment proofs", example: "challan_2027-03-12.pdf" },
    { folder: "{fy}/firc", holds: "Foreign Inward Remittance Certificates", example: "firc_2026-06-04_5000usd.pdf" },
    { folder: "{fy}/expenses", holds: "Vendor invoices / expense receipts", example: "vercel_2026-05.pdf" },
    { folder: "permanent/nps", holds: "NPS PRAN + contribution proofs", example: "pran.pdf" },
    { folder: "permanent/insurance", holds: "Health insurance policy (80D proof)", example: "health_2026.pdf" },
];

export default function VaultView() {
    return (
        <div>
            <ViewHeader
                eyebrow="Audit-ready document store"
                title="Document Vault"
                subtitle="One organised home for every certificate, acknowledgement and receipt — so an audit, a notice, or a CA handoff is a one-click export."
                action={<Badge tone="warn"><Clock size={10} /> Phase pending</Badge>}
            />

            {/* status banner */}
            <Card className="mb-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: COMPLIANCE.accentSoft }}>
                        <FolderLock size={17} style={{ color: COMPLIANCE.accent }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: COMPLIANCE.ink }}>
                            Not wired yet — and that's intentional
                        </p>
                        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: COMPLIANCE.body }}>
                            The vault needs a Supabase Storage bucket (<code>synapsis-compliance</code>) provisioned with
                            access policies. Rather than ship a fake upload button, this view is honest: the structure
                            below is finalised and the table columns (<code>receipt_url</code>, <code>firc_url</code>,
                            <code> submission_pdf_url</code>) already exist — only the storage layer + upload UI remain.
                        </p>
                    </div>
                </div>
            </Card>

            {/* planned structure */}
            <Card padded={false}>
                <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                    <FileText size={15} style={{ color: COMPLIANCE.accent }} />
                    <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Planned structure</p>
                </div>
                <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-4 px-6 py-2.5 border-t border-b text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.muted }}>
                    <span>Folder</span><span>Holds</span><span>Example</span>
                </div>
                {PLANNED.map((p) => (
                    <div key={p.folder}
                        className="grid grid-cols-[1fr_1.2fr_1fr] gap-4 px-6 py-3 border-b last:border-b-0 items-center"
                        style={{ borderColor: COMPLIANCE.hairline }}>
                        <span className="font-mono text-[11px]" style={{ color: COMPLIANCE.accent }}>{p.folder}</span>
                        <span className="text-[12px]" style={{ color: COMPLIANCE.body }}>{p.holds}</span>
                        <span className="font-mono text-[11px]" style={{ color: COMPLIANCE.muted }}>{p.example}</span>
                    </div>
                ))}
            </Card>

            <div className="flex items-start gap-2 mt-4 px-1">
                <ShieldCheck size={13} style={{ color: COMPLIANCE.muted }} className="mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed" style={{ color: COMPLIANCE.muted }}>
                    Every document gets an immutable timestamp on upload. The CA-handoff package (a one-click monthly ZIP)
                    pulls straight from this vault — see <code>COMPLIANCE-OS-MASTER.md</code> Phase H & J.
                </p>
            </div>
        </div>
    );
}
