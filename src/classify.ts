import { loadDeclaration } from "./validator.js";

export type RiskLevel = "unacceptable" | "high" | "limited" | "minimal";

export interface Art43Route {
  /** Stable identifier for the route. */
  id:
    | "prohibited"
    | "annex-vi-internal-control"
    | "annex-vii-notified-body"
    | "sectoral-product-harmonisation"
    | "transparency-only"
    | "voluntary"
    | "unknown";
  /** One-line summary suitable for headline rendering. */
  headline: string;
  /** Legal citation that justifies the route. */
  citation: string;
  /** Free-form explanation of why this route was selected. */
  reasoning: string;
}

export interface ClassificationResult {
  riskLevel: RiskLevel | "unset";
  annexIiiTags: string[];
  prohibitedPractices: string[];
  art43Route: Art43Route;
  /** True when use_case_tags imply Annex III biometrics — a special-case route. */
  isBiometricsAnnexIii: boolean;
  /** True when product_harmonisation.under_annex_i_section_a was declared. */
  isUnderProductHarmonisation: boolean;
}

/**
 * Classify a parsed declaration against Articles 5, 6, and 43. This is a pure
 * function of the declaration's risk_classification + product_harmonisation
 * blocks — it does not look at the rest of the Annex IV body.
 */
export function classifyDeclaration(
  declaration: Record<string, unknown>,
): ClassificationResult {
  const rc = (declaration["risk_classification"] ?? {}) as Record<
    string,
    unknown
  >;
  const ph = (declaration["product_harmonisation"] ?? {}) as Record<
    string,
    unknown
  >;

  const riskLevel = ((rc["risk_level"] as RiskLevel) ??
    "unset") as ClassificationResult["riskLevel"];
  const tags = Array.isArray(rc["use_case_tags"])
    ? (rc["use_case_tags"] as string[])
    : [];
  const prohibited = Array.isArray(rc["prohibited_practices_claimed"])
    ? (rc["prohibited_practices_claimed"] as string[])
    : [];
  const isBiometricsAnnexIii = tags.includes("biometrics");
  const isUnderProductHarmonisation = ph["under_annex_i_section_a"] === true;

  return {
    riskLevel,
    annexIiiTags: tags,
    prohibitedPractices: prohibited,
    isBiometricsAnnexIii,
    isUnderProductHarmonisation,
    art43Route: routeFor(
      riskLevel,
      prohibited,
      isBiometricsAnnexIii,
      isUnderProductHarmonisation,
    ),
  };
}

export function classifyFile(declarationPath: string): ClassificationResult {
  return classifyDeclaration(loadDeclaration(declarationPath));
}

function routeFor(
  level: ClassificationResult["riskLevel"],
  prohibited: string[],
  isBiometricsAnnexIii: boolean,
  isUnderProductHarmonisation: boolean,
): Art43Route {
  if (prohibited.length > 0 || level === "unacceptable") {
    return {
      id: "prohibited",
      headline: "PROHIBITED — system may not be placed on the EU market",
      citation: "Article 5",
      reasoning:
        "The declaration claims one or more Article 5 prohibited practices, or the provider has classified the system as 'unacceptable risk'. Article 5 systems are categorically prohibited from being placed on the market, put into service, or used in the Union.",
    };
  }

  if (level === "high") {
    if (isUnderProductHarmonisation) {
      return {
        id: "sectoral-product-harmonisation",
        headline:
          "Sectoral conformity assessment under the applicable product harmonisation legislation",
        citation: "Article 43(3)",
        reasoning:
          "The system is a safety component of, or itself a product covered by, the Annex I Section A harmonisation legislation. Article 43(3) requires conformity assessment under the relevant sectoral act; the AI Act's requirements are integrated into that assessment.",
      };
    }
    if (isBiometricsAnnexIii) {
      return {
        id: "annex-vii-notified-body",
        headline:
          "Annex VII conformity assessment (Notified Body) — Annex VI possible only if fully harmonised standards apply",
        citation: "Article 43(1)",
        reasoning:
          "Annex III(1) biometric systems may use Annex VI (internal control) only when the provider has applied harmonised standards or common specifications that cover all the Chapter III Section 2 requirements. Where that condition is not met, Annex VII conformity assessment by a Notified Body is required.",
      };
    }
    return {
      id: "annex-vi-internal-control",
      headline:
        "Annex VI internal-control conformity assessment (default for non-biometric Annex III high-risk systems)",
      citation: "Article 43(2)",
      reasoning:
        "For high-risk AI systems referred to in points 2–8 of Annex III, the default conformity assessment route is Annex VI (internal control). The provider self-assesses and signs the EU declaration of conformity.",
    };
  }

  if (level === "limited") {
    return {
      id: "transparency-only",
      headline:
        "No conformity assessment required — Article 50 transparency obligations apply",
      citation: "Article 50",
      reasoning:
        "Limited-risk systems are subject only to Article 50 transparency obligations (e.g. disclosure that users are interacting with an AI system, labelling of synthetic content). No CE marking or conformity assessment is required.",
    };
  }

  if (level === "minimal") {
    return {
      id: "voluntary",
      headline: "No conformity assessment required",
      citation: "Article 95",
      reasoning:
        "Minimal-risk systems are not subject to mandatory obligations under the AI Act. Voluntary codes of conduct per Article 95 are encouraged.",
    };
  }

  return {
    id: "unknown",
    headline:
      "Risk level not declared — add a risk_classification block to classify",
    citation: "Article 6",
    reasoning:
      "The declaration does not include a risk_classification.risk_level. Run `actcheck init --risk-class <level>` or add the block manually, then re-run classify.",
  };
}
