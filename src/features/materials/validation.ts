import type {
  MaterialAttribute,
  MaterialAttributeAssignment,
  MaterialAttributeInputType,
} from "@prisma/client";

export type AttributeValueInput = {
  attributeId: string;
  optionId?: string | null;
  /** MULTISELECT: JSON array of option `value` keys. TEXT: free text. */
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
};

export type AttributeForValidation = Pick<
  MaterialAttribute,
  "id" | "inputType" | "slug"
> & {
  options: { id: string; value: string; isActive: boolean }[];
};

function hasValue(
  inputType: MaterialAttributeInputType,
  v: AttributeValueInput | undefined,
): boolean {
  if (!v) return false;
  switch (inputType) {
    case "SELECT":
      return !!v.optionId;
    case "MULTISELECT": {
      if (!v.valueText?.trim()) return false;
      try {
        const parsed = JSON.parse(v.valueText) as unknown;
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    }
    case "TEXT":
      return !!(v.valueText && v.valueText.trim());
    case "NUMBER":
      return v.valueNumber != null && !Number.isNaN(v.valueNumber);
    case "BOOLEAN":
      return v.valueBool != null;
    default:
      return false;
  }
}

/**
 * Validates item attribute values against category assignments.
 * Throws Error with a user-facing message on failure.
 */
export function assertItemAttributeValues(opts: {
  assignments: (MaterialAttributeAssignment & {
    attribute: AttributeForValidation;
  })[];
  values: AttributeValueInput[];
}) {
  const { assignments, values } = opts;
  const assignedIds = new Set(assignments.map((a) => a.attributeId));
  const byAttr = new Map(values.map((v) => [v.attributeId, v]));

  for (const v of values) {
    if (!assignedIds.has(v.attributeId)) {
      throw new Error(
        `Attribute ${v.attributeId} is not assigned to this category.`,
      );
    }
  }

  for (const a of assignments) {
    const v = byAttr.get(a.attributeId);
    if (a.isRequired && !hasValue(a.attribute.inputType, v)) {
      throw new Error(
        `Required attribute "${a.attribute.slug}" is missing a value.`,
      );
    }
    if (!v || !hasValue(a.attribute.inputType, v)) continue;

    const type = a.attribute.inputType;
    if (type === "SELECT") {
      const opt = a.attribute.options.find((o) => o.id === v.optionId);
      if (!opt || !opt.isActive) {
        throw new Error(`Invalid option for attribute "${a.attribute.slug}".`);
      }
    }
    if (type === "MULTISELECT") {
      let keys: unknown;
      try {
        keys = JSON.parse(v.valueText ?? "[]");
      } catch {
        throw new Error(
          `Invalid multiselect payload for "${a.attribute.slug}".`,
        );
      }
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
        throw new Error(
          `Invalid multiselect payload for "${a.attribute.slug}".`,
        );
      }
      const allowed = new Set(
        a.attribute.options.filter((o) => o.isActive).map((o) => o.value),
      );
      for (const key of keys as string[]) {
        if (!allowed.has(key)) {
          throw new Error(
            `Option "${key}" is not valid for "${a.attribute.slug}".`,
          );
        }
      }
    }
  }
}
