// Result of a comparison as a badge with icon and word – never colour alone (D15: no score, four plain results).
import type { PlatformMessages } from "@/i18n/platform";
import type { MatchResult, Outcome } from "@/server/domain/matching";
import { Badge } from "@/components/ui/elements";
import { AlertIcon, CheckIcon, InfoIcon, MinusIcon, RecycleIcon } from "@/components/ui/icons";

const RESULT_TONE: Record<MatchResult, "solid" | "neutral" | "attention" | "outline"> = {
  compatible: "solid",
  processing_required: "neutral",
  conditional: "attention",
  incompatible: "outline",
};

export function MatchBadge({ result, t }: { result: MatchResult; t: PlatformMessages }) {
  const icon =
    result === "compatible" ? <CheckIcon size={14} /> : result === "processing_required" ? <RecycleIcon size={14} /> : result === "conditional" ? <InfoIcon size={14} /> : <MinusIcon size={14} />;
  return (
    <Badge tone={RESULT_TONE[result]} icon={icon}>
      {t.l2labels.matchResult[result]}
    </Badge>
  );
}

/** Outcome of one criterion as icon + word in a table cell. */
export function OutcomeLabel({ outcome, t }: { outcome: Outcome; t: PlatformMessages }) {
  const icon =
    outcome === "met" ? <CheckIcon size={16} /> : outcome === "processing" ? <RecycleIcon size={16} /> : outcome === "unknown" ? <InfoIcon size={16} /> : <AlertIcon size={16} />;
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${outcome === "failed" ? "text-danger" : outcome === "unknown" ? "text-notice" : ""}`}>
      {icon}
      {t.l2labels.outcome[outcome]}
    </span>
  );
}
