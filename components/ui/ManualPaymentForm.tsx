"use client";

// ─── MANUAL NEFT/RTGS PAYMENT FORM ─────────────────────────────────────────
// Big-budget clients pay via NEFT/RTGS. They see Synapsis bank instructions,
// transfer the money, then submit UTR + screenshot here. Lands in admin queue.

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Building2, Upload, Lock, AlertCircle, CheckCircle, IndianRupee, Copy, Check } from "lucide-react";
import { SYNAPSIS_CONFIG } from "@/lib/synapsis-config";

type PaymentPhase = 3 | 4 | 6;

interface Props {
    token: string;
    paymentPhase: PaymentPhase;
    amount: number;            // INR (rupees)
    label: string;
    isSubmitted?: boolean;
    onSubmitted?: () => void;
}

export default function ManualPaymentForm({
    token, paymentPhase, amount, label, isSubmitted, onSubmitted,
}: Props) {
    const [step, setStep] = useState<"instructions" | "form">(isSubmitted ? "form" : "instructions");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(isSubmitted || false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState({
        utr: "",
        bankName: "",
        accountHolderName: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: "",
    });
    const [proofFile, setProofFile] = useState<File | null>(null);

    const bank = SYNAPSIS_CONFIG.bank;

    const copy = (label: string, value: string) => {
        navigator.clipboard.writeText(value);
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
    };

    const submit = async () => {
        setBusy(true); setError(null);
        try {
            if (form.utr.trim().length < 8) {
                throw new Error("UTR must be at least 8 characters");
            }
            const fd = new FormData();
            fd.append("token", token);
            fd.append("paymentPhase", String(paymentPhase));
            fd.append("utr", form.utr.trim());
            fd.append("amountRupees", String(amount));
            fd.append("bankName", form.bankName);
            fd.append("accountHolderName", form.accountHolderName);
            fd.append("paymentDate", form.paymentDate);
            fd.append("notes", form.notes);
            if (proofFile) fd.append("proof", proofFile);

            const res = await fetch("/api/payments/manual/submit", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Submission failed");

            setSubmitted(true);
            onSubmitted?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Submission failed");
        } finally {
            setBusy(false);
        }
    };

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-4"
            >
                <CheckCircle className="w-8 h-8 text-amber-400 shrink-0 mt-1" />
                <div className="flex-1">
                    <div className="text-amber-400 font-semibold text-sm tracking-widest uppercase">
                        Manual Payment · Awaiting Verification
                    </div>
                    <div className="text-white/70 text-sm mt-2 leading-relaxed">
                        Your NEFT proof has been submitted. Admin will verify against the bank statement
                        — typically within 24 hours. You will receive an email confirmation with your invoice.
                    </div>
                </div>
            </motion.div>
        );
    }

    if (step === "instructions") {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 space-y-5"
            >
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-[#3B6AE8]" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#3B6AE8]">
                            NEFT / RTGS Transfer
                        </span>
                    </div>
                    <div className="text-white font-semibold text-lg">{label}</div>
                    <div className="text-white/50 text-sm mt-1">
                        Transfer ₹{amount.toLocaleString("en-IN")} via NEFT or RTGS to the account below.
                    </div>
                </div>

                <div className="rounded-xl bg-black/30 border border-white/5 p-4 space-y-3">
                    <p className="text-[10px] tracking-widest uppercase text-white/40 font-semibold">Pay To</p>

                    <CopyRow label="Account Name" value={bank.accountHolderName} onCopy={copy} copied={copied} />
                    <CopyRow label="Bank" value={`${bank.bankName}, ${bank.branch}`} onCopy={copy} copied={copied} />
                    <CopyRow label={`${bank.accountType} Account`} value={`****${bank.accountLast4}`} hint="(Last 4 digits — full number sent on request)" onCopy={copy} copied={copied} />
                    <CopyRow label="IFSC" value={bank.ifsc} onCopy={copy} copied={copied} />
                    {bank.upiId && <CopyRow label="UPI" value={bank.upiId} onCopy={copy} copied={copied} />}
                </div>

                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-300/80 leading-relaxed">
                    <strong>Reference / Remark:</strong> Please write{" "}
                    <span className="font-mono text-amber-200">SYNAP-{token}-P{paymentPhase}</span>{" "}
                    in the NEFT remark/description field for faster verification.
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        onClick={() => setStep("form")}
                        className="flex-1 rounded-xl py-3 font-semibold text-sm bg-gradient-to-r from-[#11B8EA]/20 to-[#3B6AE8]/30 border border-[#11B8EA]/40 text-[#11B8EA] hover:border-[#11B8EA]/70 transition"
                    >
                        I have completed the transfer →
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 space-y-4"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <IndianRupee className="w-4 h-4 text-[#11B8EA]" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#11B8EA]">Submit NEFT Proof</span>
                    </div>
                    <div className="text-white font-semibold text-lg">{label} · ₹{amount.toLocaleString("en-IN")}</div>
                </div>
                <button
                    onClick={() => setStep("instructions")}
                    className="text-xs text-white/40 hover:text-white/70 transition"
                >
                    ← Show bank details
                </button>
            </div>

            <Field label="UTR / Transaction Reference *" hint="From your bank app — typically 12–22 alphanumeric characters">
                <input
                    type="text"
                    value={form.utr}
                    onChange={e => setForm({ ...form, utr: e.target.value.toUpperCase() })}
                    placeholder="e.g. HDFCN23042512345"
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/30 focus:border-[#11B8EA]/50 outline-none"
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Your Bank">
                    <input
                        type="text"
                        value={form.bankName}
                        onChange={e => setForm({ ...form, bankName: e.target.value })}
                        placeholder="e.g. HDFC, ICICI"
                        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#11B8EA]/50 outline-none"
                    />
                </Field>
                <Field label="Payment Date">
                    <input
                        type="date"
                        value={form.paymentDate}
                        onChange={e => setForm({ ...form, paymentDate: e.target.value })}
                        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#11B8EA]/50 outline-none"
                    />
                </Field>
            </div>

            <Field label="Account Holder Name (as on your bank account)">
                <input
                    type="text"
                    value={form.accountHolderName}
                    onChange={e => setForm({ ...form, accountHolderName: e.target.value })}
                    placeholder="Should match your billing/registered name"
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#11B8EA]/50 outline-none"
                />
            </Field>

            <Field label="Screenshot / Receipt (optional but recommended)">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/70 hover:border-[#11B8EA]/50 transition flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        {proofFile ? "Change file" : "Choose file"}
                    </button>
                    <span className="text-xs text-white/40 truncate">
                        {proofFile?.name || "PNG, JPG, or PDF"}
                    </span>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => setProofFile(e.target.files?.[0] || null)}
                    />
                </div>
            </Field>

            <Field label="Notes (optional)">
                <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Anything else admin should know"
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#11B8EA]/50 outline-none resize-none"
                />
            </Field>

            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <button
                onClick={submit}
                disabled={busy || !form.utr.trim()}
                className="w-full rounded-xl py-3 font-semibold text-sm bg-gradient-to-r from-[#11B8EA]/20 to-[#3B6AE8]/30 border border-[#11B8EA]/40 text-[#11B8EA] hover:border-[#11B8EA]/70 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                <Lock className="w-4 h-4" />
                {busy ? "Submitting…" : "Submit for Verification"}
            </button>

            <div className="text-[11px] text-white/30 leading-relaxed text-center">
                Verified within 24h against bank statement. Invoice emailed on confirmation.
            </div>
        </motion.div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] tracking-widest uppercase text-white/40 font-semibold mb-1.5">
                {label}
            </label>
            {children}
            {hint && <p className="text-[10px] text-white/30 mt-1">{hint}</p>}
        </div>
    );
}

function CopyRow({ label, value, hint, onCopy, copied }: {
    label: string; value: string; hint?: string;
    onCopy: (label: string, val: string) => void; copied: string | null;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="text-[10px] tracking-widest uppercase text-white/40 mb-0.5">{label}</p>
                <p className="text-sm text-white font-mono truncate">{value}</p>
                {hint && <p className="text-[10px] text-white/30 mt-0.5">{hint}</p>}
            </div>
            <button
                onClick={() => onCopy(label, value)}
                className="shrink-0 rounded-md p-1.5 hover:bg-white/5 transition text-white/50 hover:text-[#11B8EA]"
                title="Copy"
            >
                {copied === label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}
