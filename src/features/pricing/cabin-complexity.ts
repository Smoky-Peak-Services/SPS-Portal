/**
 * Canonical Cabin Services complexity multipliers (prompt 14 /
 * cabin-services-master-rate-sheet.xlsx, "Complexity Multipliers", 20 rows).
 * Every row applies to BASE_PACKAGE_RATE: FIXED values are flat dollars added
 * per billing cycle; PERCENT values are decimals of the base package rate.
 * Descriptions are the sheet "Note and Rules" text verbatim.
 */
import type { ComplexitySeed } from "./complexity-seed-types";

export const CABIN_COMPLEXITY_MULTIPLIERS: ComplexitySeed[] = [
  {
    name: "Additional Bathroom",
    slug: "additional-bathroom",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 8,
    description:
      "An additional bathroom is any full or partial bathroom that exists beyond the primary bathroom associated with the base bedroom count of the property. Includes all fixture types such as toilets, sinks, showers, and tubs. Each additional bathroom adds unclassified square footage and fixture count to the inspection and maintenance scope requiring additional time on every visit.",
    sortOrder: 0,
  },
  {
    name: "On-Premise Swim Spa or Hot Tub",
    slug: "on-premise-swim-spa-or-hot-tub",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 12,
    description:
      "A swim spa or hot tub is any on-premise hydrotherapy or recreational water fixture that requires function testing during inspections. Includes verification of heating elements, jet functionality, water clarity, cover condition, and accessible equipment. Repairs and chemical servicing must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 1,
  },
  {
    name: "On-Premise Sauna",
    slug: "on-premise-sauna",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 12,
    description:
      "An on-premise sauna is any dedicated dry or steam heat enclosure located on the property that requires function testing during inspections. Includes verification of heating elements, controls, ventilation, and structural condition of the enclosure. Repairs to heating or electrical components must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 2,
  },
  {
    name: "In-Unit Spa Tub",
    slug: "in-unit-spa-tub",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 10,
    description:
      "An in-unit spa tub is any jetted or whirlpool style bathtub installed within the primary dwelling that requires function testing beyond a standard bathtub inspection. Includes verification of jet functionality, drain performance, and visible plumbing access points. Repairs to jet systems or plumbing must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 3,
  },
  {
    name: "Vaulted Ceilings",
    slug: "vaulted-ceilings",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.025,
    description:
      "Vaulted ceilings are any ceiling structure that exceeds standard height and requires specialized access for routine maintenance tasks such as light fixture servicing, window cleaning, or ceiling fan maintenance. The percentage multiplier reflects the increased labor cost and access complexity on visits where elevated work is required and is spread across all billing cycles to balance the irregular nature of those tasks.",
    sortOrder: 4,
  },
  {
    name: "Gas Fireplace",
    slug: "gas-fireplace",
    category: "Amenity",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.04,
    description:
      "A gas fireplace is any permanently installed gas fired hearth appliance that requires function testing and visual inspection during each visit. Includes verification of ignition, flame presentation, ventilation, and accessible gas connections. Repairs to gas lines, ignition systems, or ventilation components must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 5,
  },
  {
    name: "Wood Burning Fireplace",
    slug: "wood-burning-fireplace",
    category: "Amenity",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.025,
    description:
      "A wood burning fireplace is any permanently installed solid fuel hearth appliance that requires periodic function and ventilation testing. A bi-annual inspection of the firebox, damper, and accessible flue components is included within the monthly multiplier rate. The percentage reflects the ongoing monitoring cost across all billing cycles with the bi-annual inspection absorbed into that recurring charge rather than billed as a separate line item.",
    sortOrder: 6,
  },
  {
    name: "HVAC Access in Attic or Crawl Space",
    slug: "hvac-access-in-attic-or-crawl-space",
    category: "Mechanical",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.04,
    description:
      "An attic or crawl space HVAC configuration is any heating or cooling system where primary components, ductwork, or air handlers are located in a space requiring non-standard access. Includes any system where the inspector must enter or access a confined, elevated, or below grade space to complete routine maintenance tasks. The percentage multiplier reflects the increased time and physical demands associated with access limitations on every qualifying visit.",
    sortOrder: 7,
  },
  {
    name: "Smart Home Integrations",
    slug: "smart-home-integrations",
    category: "Technology",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.08,
    description:
      "Smart home integrations are any network connected control systems installed on the property including but not limited to smart thermostats, automated lighting, connected locks, security systems, motorized shades, or whole home audio and video systems. The percentage multiplier reflects the increased scope of inspection and the technical knowledge required to verify system functionality, connectivity, and guest readiness on every visit.",
    sortOrder: 8,
  },
  {
    name: "Home Theater or Luxury Living Rooms",
    slug: "home-theater-or-luxury-living-rooms",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 18,
    description:
      "A home theater or luxury living room is any dedicated entertainment space containing premium audio, video, or experiential equipment beyond standard residential fixtures. Includes verification of display functionality, audio system operation, streaming device connectivity, seating condition, and any specialty lighting or control systems. The flat fee reflects the additional time required to inspect and document all entertainment package components on every visit.",
    sortOrder: 9,
  },
  {
    name: "ADU Dwelling",
    slug: "adu-dwelling",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 75,
    description:
      "An ADU is a secondary dwelling unit on the same property that contains its own independent living fixtures including sleeping, cooking, and bathroom facilities. Typically presented as a studio or apartment style unit. Does not apply to bunk rooms, bonus rooms, or overflow sleeping areas that share primary dwelling amenities. Must be paired with the primary dwelling service plan to qualify for the ADU multiplier rate.",
    sortOrder: 10,
  },
  {
    name: "Auxillery Shed or Garage",
    slug: "auxillery-shed-or-garage",
    category: "Outdoor",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 8,
    description:
      "An auxiliary shed or garage is any detached or semi-detached outbuilding located on the property that falls outside the footprint of the primary dwelling and requires independent inspection during each visit. Includes verification of structural condition, door and lock functionality, electrical if present, and general interior condition. Does not apply to attached garages already captured within the primary dwelling square footage.",
    sortOrder: 11,
  },
  {
    name: "Outdoor Kitchen",
    slug: "outdoor-kitchen",
    category: "Outdoor",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 12,
    description:
      "An outdoor kitchen is any permanent exterior cooking and food preparation installation that requires inspection and functional verification during each visit. Includes verification of grill or cooktop operation, refrigeration if present, sink and plumbing connections, countertop and cabinetry condition, and any connected utilities. Repairs to gas lines, plumbing, or electrical components must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 12,
  },
  {
    name: "Game Room",
    slug: "game-room",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 8,
    description:
      "A game room is any dedicated recreational space containing equipment or games requiring inspection and functional verification beyond standard living area scope. Includes verification of game table condition, electronic gaming equipment functionality, seating condition, and any specialty lighting or audio systems present. The flat fee reflects the additional time required to inspect and document all recreational equipment on every visit.",
    sortOrder: 13,
  },
  {
    name: "Bunk Room",
    slug: "bunk-room",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 15,
    description:
      "A bunk room is any unclassified space that has been converted to sleeping quarters but does not meet the definition of a bedroom. This includes loft conversions, living room conversions, or any open floor plan area being used for guest sleeping that was not originally designed or permitted as a bedroom. Does not apply if the space is an existing classified bedroom regardless of bed type.",
    sortOrder: 14,
  },
  {
    name: "Loft Space",
    slug: "loft-space",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 10,
    description:
      "A loft space is any open or semi-open elevated area within the primary dwelling that exists as unclassified square footage beyond the standard room count of the property. Includes any mezzanine, open upper level, or partial floor area used for sleeping, recreation, or storage that is not classified as a bedroom or dedicated room type. The flat fee reflects the additional square footage and access complexity added to the inspection scope on every visit.",
    sortOrder: 15,
  },
  {
    name: "Screened Porch or Sunroom",
    slug: "screened-porch-or-sunroom",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 8,
    description:
      "A screened porch or sunroom is any enclosed or semi-enclosed exterior living space attached to the primary dwelling that requires inspection beyond the standard interior scope. Includes verification of screen or window integrity, door and latch functionality, flooring condition, furniture condition, and any electrical or ceiling fan fixtures present. The flat fee reflects the additional time required to inspect this exterior living area on every visit.",
    sortOrder: 16,
  },
  {
    name: "EV Charging Station",
    slug: "ev-charging-station",
    category: "Amenity",
    multiplierType: "FIXED",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 8,
    description:
      "An EV charging station is any permanently installed electric vehicle charging unit located on the property that requires verification of active power and operational status during each visit. Includes confirmation that the unit is powered, accessible, and free of visible damage or safety concerns. Load testing is not included within the scope of this inspection. Repairs or electrical servicing must be completed by a certified vendor and are not included in the base inspection scope.",
    sortOrder: 17,
  },
  {
    name: "Elevator or Chair Lift",
    slug: "elevator-or-chair-lift",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.05,
    description:
      "An elevator or chair lift is any permanently installed vertical transport device located within the primary dwelling or on the property that requires functional verification during each visit. Includes verification of operational controls, safety features, door or gate functionality, and visible mechanical condition. Repairs and certified maintenance must be completed by a licensed vendor and are not included in the base inspection scope.",
    sortOrder: 18,
  },
  {
    name: "Seasonal Access Limitations",
    slug: "seasonal-access-limitations",
    category: "Access",
    multiplierType: "PERCENT",
    appliedTo: "BASE_PACKAGE_RATE",
    value: 0.085,
    description:
      "Seasonal access limitations apply to any property where primary access routes are subject to restriction due to terrain, weather conditions, road grade, or requirements for four wheel drive or high clearance vehicles. The percentage multiplier reflects the increased travel time, vehicle wear, and operational complexity associated with servicing properties under limited or restricted access conditions and applies for the duration of any qualifying access period.",
    sortOrder: 19,
  },
];
