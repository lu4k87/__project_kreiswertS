// Pictures of the "Status" box on the negotiation page (decision of 2026-11-28, preview Stand:A + B + C): a large
// status symbol, the progress over the five stations and a band showing who passes the material to whom.
import type { ReactNode } from "react";
import type { NegotiationDisplayStatus } from "@/server/domain/negotiation";
import type { PlatformMessages } from "@/i18n/platform";
import { BanIcon, CheckIcon, ClockIcon, FileTextIcon, HandshakeIcon, RefreshIcon, SendIcon, TruckIcon, BuildingIcon } from "@/components/ui/icons";
import { MaterialPhoto } from "@/components/ui/material-photo";
import type { Station, StationState } from "./progress";

const STATUS_ICON: Record<NegotiationDisplayStatus, ReactNode> = {
  open: <RefreshIcon size={34} />, agreed: <HandshakeIcon size={36} />, declined: <BanIcon size={34} />, withdrawn: <BanIcon size={34} />, expired: <ClockIcon size={34} />,
};
const STATUS_TONE: Record<NegotiationDisplayStatus, string> = {
  open: "bg-mint text-ink", agreed: "bg-brand text-white", declined: "bg-danger-soft text-danger", withdrawn: "bg-canvas text-ink", expired: "bg-notice-soft text-notice",
};

export function StatusMedal({ status, label, text }: { status: NegotiationDisplayStatus; label: string; text: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-1">
      <span aria-hidden="true" className={`grid size-14 place-items-center rounded-full ring-[6px] ring-mint *:size-7 sm:size-[4.5rem] sm:*:size-9 ${STATUS_TONE[status]}`}>
        {STATUS_ICON[status]}
      </span>
      <div className="grid min-w-0 gap-1">
        <p className="text-[1.375rem] leading-tight font-semibold">{label}</p>
        <p className="prose-justify text-[15px] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

const STATION_ICON: Record<Station, ReactNode> = {
  proposal: <SendIcon size={20} />, negotiation: <RefreshIcon size={20} />, agreed: <HandshakeIcon size={20} />, contract: <FileTextIcon size={20} />, exchange: <TruckIcon size={20} />,
};

export function ProgressSteps({ steps, t }: { steps: { station: Station; state: StationState; note: string }[]; t: PlatformMessages }) {
  const g = t.progress;
  return (
    <ol aria-label={g.label} className="grid gap-3 sm:grid-cols-5 sm:gap-0">
      {steps.map(({ station, state, note }, index) => {
        const reached = state === "done" || state === "now";
        return (
          <li key={station} className="relative flex items-center gap-3 sm:grid sm:justify-items-center sm:gap-1.5 sm:text-center" aria-current={state === "now" ? "step" : undefined}>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute top-[1.3rem] left-1/2 hidden h-0.5 w-full sm:block ${state === "done" ? "bg-brand" : "bg-line"}`} />
            )}
            <span
              aria-hidden="true"
              className={`relative grid size-11 flex-none place-items-center rounded-full border-2 ${
                state === "done" ? "border-brand bg-brand text-white" : state === "now" ? "border-brand bg-brand text-white ring-4 ring-mint" : state === "ended" ? "border-danger bg-danger-soft text-danger" : "border-line bg-surface text-muted"
              }`}
            >
              {state === "done" ? <CheckIcon size={20} strokeWidth={2.2} /> : state === "ended" ? <BanIcon size={20} /> : STATION_ICON[station]}
            </span>
            <span className="grid min-w-0">
              <span className={`text-[15px] leading-snug font-semibold ${reached || state === "ended" ? "" : "text-muted"}`}>{g[station]}</span>
              <span className="text-[13px] leading-snug text-muted">{note}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Party = { name: string; sub: string; you: boolean };

/** Offerer on the left, requester on the right, the material in the middle on the route (like the pathways on the map). */
export function TradeFlow({ from, to, form, material, t }: { from: Party; to: Party; form: string | null; material: string; t: PlatformMessages }) {
  const g = t.progress;
  const party = (p: Party, verb: string, tone: string) => (
    <div className="grid min-w-0 justify-items-center gap-1 text-center">
      <span aria-hidden="true" className={`grid size-12 place-items-center rounded-full text-white ${tone}`}>
        <BuildingIcon size={22} />
      </span>
      <span className="text-[15px] leading-tight font-semibold text-balance break-words">{p.you ? g.yourSite : p.name}</span>
      <span className="text-[13px] leading-snug text-muted text-balance">
        {p.you ? verb : `${p.sub} · ${verb}`}
      </span>
    </div>
  );
  return (
    <figure aria-label={g.flowLabel} className="grid items-center gap-4 rounded-xl bg-canvas px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
      {party(from, g.gives, "bg-map-offer")}
      <div className="relative grid justify-items-center gap-2 text-center">
        <span aria-hidden="true" className="absolute inset-x-[-1.5rem] top-9 hidden border-t-2 border-dashed border-map-flow sm:block" />
        <MaterialPhoto form={form} sizes="72px" className="relative size-[4.5rem] rounded-full border-[3px] border-surface ring-2 ring-map-flow" />
        <span className="relative text-[15px] leading-snug font-semibold text-balance">{material}</span>
      </div>
      {party(to, g.takes, "bg-map-both")}
    </figure>
  );
}
