// Administration → reference data (PG-16): the material catalogue, units, industrial parks and provenance as they
// are configured. Read-only apart from switching a category on or off; other changes go through the seed script.
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { nameOf } from "@/server/domain/catalogue";
import { Badge, Notice, PageHeader, Section } from "@/components/ui/elements";
import { FileTextIcon, MapIcon, RecycleIcon, RulerIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { CategoryToggle } from "@/components/admin/category-toggle";
import { platformPage } from "../../gate";

const cell = "border-b border-line px-3 py-2 align-top";
const head = "border-b border-ink/30 px-3 py-2 text-left font-semibold";

export default async function ReferenceDataPage() {
  const page = await platformPage("admin", ROUTES.adminReferenceData);
  const p = page.t.platform;
  const a = p.admin;
  if (page.blocked) return <><PageHeader title={a.referenceTitle} />{page.blocked}</>;

  const [catalogue, parks] = await Promise.all([getCatalogue(), listParks()]);
  const { locale } = page;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const formName = (categoryId: number, key: string) => {
    const form = catalogue.forms.find((candidate) => candidate.categoryId === categoryId && candidate.key === key);
    return form ? nameOf(form, locale) : key;
  };

  return (
    <>
      <PageHeader title={a.referenceTitle} intro={a.referenceIntro} />

      <Section title={a.categories} icon={<RecycleIcon size={18} />} id="categories">
        <ul className="grid gap-3">
          {catalogue.categories.map((category) => {
            const types = catalogue.types.filter((type) => type.categoryId === category.id);
            const forms = catalogue.forms.filter((form) => form.categoryId === category.id);
            return (
              <li key={category.id} className="grid gap-2 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="text-lg leading-tight font-semibold">{nameOf(category, locale)}</h3>
                  <Badge tone={category.enabled ? "solid" : "outline"}>{category.enabled ? a.enabled : a.disabled}</Badge>
                  <CategoryToggle categoryId={category.id} enabled={category.enabled} name={nameOf(category, locale)} t={p} />
                </div>
                {types.length > 0 && (
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">{a.types}:</span> {types.map((type) => nameOf(type, locale)).join(", ")}
                  </p>
                )}
                {forms.length > 0 && (
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">{a.forms}:</span> {forms.map((form) => nameOf(form, locale)).join(", ")}
                  </p>
                )}
                {category.unitKeys.length > 0 && (
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-medium">{a.units}:</span> {category.unitKeys.join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={a.attributes} icon={<RulerIcon size={18} />} id="attributes">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-[15px]">
            <thead>
              <tr>
                <th scope="col" className={head}>{a.categories}</th>
                <th scope="col" className={head}>{a.attributeName}</th>
                <th scope="col" className={head}>{a.attributeType}</th>
                <th scope="col" className={head}>{a.attributeUnit}</th>
                <th scope="col" className={head}>{a.attributeForms}</th>
                <th scope="col" className={head}>{a.flags}</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.attributes.map((attribute) => {
                const category = catalogue.categories.find((candidate) => candidate.id === attribute.categoryId);
                const limits = [attribute.unit, attribute.minValue != null ? `≥ ${number.format(attribute.minValue)}` : null, attribute.maxValue != null ? `≤ ${number.format(attribute.maxValue)}` : null].filter(Boolean);
                const requiredWith = catalogue.attributes.find((candidate) => candidate.key === attribute.requiredWith && candidate.categoryId === attribute.categoryId);
                const flags = [attribute.critical && a.flagCritical, attribute.required && a.flagRequired, requiredWith && `${a.flagRequiredWith} ${nameOf(requiredWith, locale)}`].filter(Boolean);
                return (
                  <tr key={attribute.id}>
                    <td className={cell}>{category ? nameOf(category, locale) : ""}</td>
                    <th scope="row" className={`${cell} text-left font-medium`}>{nameOf(attribute, locale)}</th>
                    <td className={cell}>{a.dataType[attribute.dataType] ?? attribute.dataType}</td>
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>{limits.join(" · ") || "–"}</td>
                    <td className={cell}>{attribute.forms.length === 0 ? a.allForms : attribute.forms.map((key) => formName(attribute.categoryId, key)).join(", ")}</td>
                    <td className={cell}>{flags.join(", ") || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title={a.units} icon={<FileTextIcon size={18} />} id="units">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr>
                  <th scope="col" className={head}>{a.units}</th>
                  <th scope="col" className={head}>{a.unitDimension}</th>
                  <th scope="col" className={`${head} text-right`}>{a.unitFactor}</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.units.map((unit) => (
                  <tr key={unit.key}>
                    <th scope="row" className={`${cell} text-left font-medium`}>{nameOf(unit, locale)}</th>
                    <td className={cell}>{a.dimension[unit.dimension] ?? unit.dimension}</td>
                    <td className={`${cell} text-right tabular-nums`}>{number.format(unit.toBase)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={a.parks} icon={<MapIcon size={18} />} id="parks">
          <ul className="grid gap-3">
            {parks.map((park) => (
              <li key={park.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                <h3 className="text-lg leading-snug font-semibold text-balance">{park.name}</h3>
                <p className="text-[15px]">
                  {park.city} · {a.parkPosition}: <span className="tabular-nums">{number.format(park.latitude)}, {number.format(park.longitude)}</span> · {number.format(park.radiusM)} m
                </p>
                <p className="text-[13px] leading-normal text-muted">
                  {a.parkSource}: {park.sourceNote}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Notice title={a.provenance}>{a.provenanceText}</Notice>
    </>
  );
}
