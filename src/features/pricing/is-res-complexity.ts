/**
 * Canonical IS-Residential complexity multipliers (prompt 14 /
 * is-residential-master-rate-sheet.xlsx, "Complexity Multipliers", 16 rows).
 * All PERCENT; most apply to TOTAL_LABOR, with dedicated PROGRAMMING_LABOR and
 * NETWORK_LABOR buckets. Values are decimals (0.08 = 8%).
 * Descriptions are the sheet "Notes and Rules" text verbatim.
 */
import type { ComplexitySeed } from "./complexity-seed-types";

export const IS_RES_COMPLEXITY_MULTIPLIERS: ComplexitySeed[] = [
  {
    name: "Retrofit Cable Fishing and Finished Wall Work",
    slug: "retrofit-cable-fishing-and-finished-wall-work",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.15,
    description:
      "Applied when installation requires cable routing through existing finished walls, insulated cavities, attic spaces, or inaccessible framing conditions without open wall access. Reflects increased labor associated with cable fishing, access hole minimization, patch avoidance, and finish protection during retrofit installation activities.",
    sortOrder: 0,
  },
  {
    name: "Luxury Residential Finish Protection Requirements",
    slug: "luxury-residential-finish-protection-requirements",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.1,
    description:
      "Applied when installation occurs within high-end residential environments requiring enhanced protection of flooring, cabinetry, millwork, stone surfaces, designer finishes, or furnished living areas. Reflects increased setup time, protective material usage, and reduced installation speed necessary to prevent property damage.",
    sortOrder: 1,
  },
  {
    name: "Smart Home System Integration Complexity",
    slug: "smart-home-system-integration-complexity",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.18,
    description:
      "Applied when project scope includes integration between multiple smart home subsystems including lighting control, access control, HVAC automation, surveillance, distributed audio, shading systems, or third-party platforms. Reflects increased programming, commissioning, troubleshooting, and interoperability validation requirements.",
    sortOrder: 2,
  },
  {
    name: "Advanced Automation Programming and Scene Logic",
    slug: "advanced-automation-programming-and-scene-logic",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "PROGRAMMING_LABOR",
    value: 0.2,
    description:
      "Applied when client requested automation includes conditional logic, occupancy-based automation, scene programming, scheduling routines, geofencing, voice assistant integration, or custom automation sequences beyond standard device onboarding and configuration. Reflects increased software configuration and testing requirements.",
    sortOrder: 3,
  },
  {
    name: "Residential Network Infrastructure Complexity",
    slug: "residential-network-infrastructure-complexity",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "NETWORK_LABOR",
    value: 0.15,
    description:
      "Applied when installation includes managed networking equipment, VLAN configuration, VPN setup, multi-access-point roaming optimization, rack-mounted network systems, or high-density IoT environments supporting integrated smart home systems. Reflects increased configuration, validation, and troubleshooting requirements associated with advanced residential networking infrastructure.",
    sortOrder: 4,
  },
  {
    name: "Client-Supplied Smart Devices and Equipment",
    slug: "client-supplied-smart-devices-and-equipment",
    category: "Administrative",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.12,
    description:
      "Applied when installation includes owner furnished equipment or smart devices not procured through the integrator. Reflects increased troubleshooting risk, compatibility uncertainty, incomplete component availability, and lack of standardized hardware validation prior to deployment.",
    sortOrder: 5,
  },
  {
    name: "Wi-Fi Dependent System Deployment",
    slug: "wi-fi-dependent-system-deployment",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.08,
    description:
      "Applied when primary system functionality relies substantially on wireless communication including Wi-Fi smart devices, wireless cameras, wireless lighting controls, or mesh network connectivity. Reflects increased commissioning time, signal validation requirements, interference mitigation, and post-installation troubleshooting exposure.",
    sortOrder: 6,
  },
  {
    name: "Structured Media Enclosure or Rack Buildout",
    slug: "structured-media-enclosure-or-rack-buildout",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.1,
    description:
      "Applied when project includes structured wiring panel organization, rack assembly, cable management systems, patch panel termination, UPS integration, or professionally dressed low-voltage infrastructure. Reflects additional labor associated with organized system layout, labeling, and serviceability standards.",
    sortOrder: 7,
  },
  {
    name: "High Device Density Smart Home Deployment",
    slug: "high-device-density-smart-home-deployment",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.15,
    description:
      "Applied when smart home installation includes a large quantity of interconnected devices exceeding standard residential deployment density including extensive lighting zones, sensors, cameras, touch panels, speakers, or automation endpoints. Reflects increased commissioning complexity, network demands, and interoperability validation requirements.",
    sortOrder: 8,
  },
  {
    name: "Remote Property or Vacation Home Support Requirements",
    slug: "remote-property-or-vacation-home-support-requirements",
    category: "Access",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.1,
    description:
      "Applied when installation occurs within a secondary residence, vacation rental, or remotely managed property requiring remote access configuration, remote troubleshooting capability, automated recovery considerations, or extended support coordination with absentee property owners.",
    sortOrder: 9,
  },
  {
    name: "Occupied Residential Installation Conditions",
    slug: "occupied-residential-installation-conditions",
    category: "Access",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.08,
    description:
      "Applied when installation must occur within an actively occupied residence requiring daily cleanup, limited work hour coordination, protection of occupied living areas, pet containment considerations, or phased room access coordination with homeowners.",
    sortOrder: 10,
  },
  {
    name: "Interior Designer or Builder Coordination Requirements",
    slug: "interior-designer-or-builder-coordination-requirements",
    category: "Administrative",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.1,
    description:
      "Applied when project requires recurring coordination with interior designers, custom builders, architects, or other trades regarding device placement, finish selections, concealment methods, or schedule dependencies. Reflects increased project management and coordination demands.",
    sortOrder: 11,
  },
  {
    name: "Concealed Equipment and Minimal Visibility Requirements",
    slug: "concealed-equipment-and-minimal-visibility-requirements",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.15,
    description:
      "Applied when client requires hidden wiring, concealed equipment placement, flush-mounted devices, invisible speaker systems, hidden television installations, or minimized visible infrastructure. Reflects increased labor associated with custom mounting methods and aesthetic preservation.",
    sortOrder: 12,
  },
  {
    name: "Legacy Smart Home System Integration",
    slug: "legacy-smart-home-system-integration",
    category: "Systems Integration",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.18,
    description:
      "Applied when new equipment must integrate with or coexist alongside legacy automation systems, outdated hardware, unsupported protocols, or partially undocumented existing installations. Reflects increased troubleshooting time, compatibility limitations, and commissioning uncertainty.",
    sortOrder: 13,
  },
  {
    name: "Premium Client Training and System Orientation",
    slug: "premium-client-training-and-system-orientation",
    category: "Administrative",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.05,
    description:
      "Applied when project includes extended homeowner training, customized system documentation, personalized automation walkthroughs, or multi-user operational orientation sessions beyond standard turnover procedures.",
    sortOrder: 14,
  },
  {
    name: "Managed Service and Remote Monitoring Enablement",
    slug: "managed-service-and-remote-monitoring-enablement",
    category: "Service",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.08,
    description:
      "Applied when installation includes remote monitoring agents, cloud management platforms, managed network support configuration, remote firmware management, or proactive support infrastructure preparation. Reflects additional setup and validation labor associated with long-term managed service deployment.",
    sortOrder: 15,
  },
];
